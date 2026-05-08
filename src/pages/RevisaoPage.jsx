import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/storage'
import { STATUS_WORKFLOW, ALLOWED_TRANSITIONS_BY_ROLE } from '../lib/storage'
import { useAuth } from '../hooks/useAuth'
import { useAuditLog } from '../hooks/useAuditLog'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import toast from 'react-hot-toast'
import { PageHeader, EmptyState } from '../components/UI'
import styles from './RevisaoPage.module.css'

const PAGE_SIZE = 20

const SORT_OPTIONS = [
  { value: 'created_at:asc',     label: 'Mais antigos primeiro' },
  { value: 'created_at:desc',    label: 'Mais recentes primeiro' },
  { value: 'patient_name:asc',   label: 'Paciente (A→Z)' },
  { value: 'patient_name:desc',  label: 'Paciente (Z→A)' },
  { value: 'record_number:asc',  label: 'Número (crescente)' },
  { value: 'record_number:desc', label: 'Número (decrescente)' },
  { value: 'pages:desc',         label: 'Mais páginas primeiro' },
  { value: 'pages:asc',          label: 'Menos páginas primeiro' },
]

// Filtro de workflow para auditoria (substitui o antigo STATUS_FILTER_OPTIONS)
const WORKFLOW_FILTER_OPTIONS = [
  { value: '',                  label: 'Todos os status' },
  { value: 'in_audit',          label: '🔎 Em auditoria' },
  { value: 'correction_needed', label: '✏️ Correção solicitada' },
  { value: 'corrected',         label: '🔄 Corrigido' },
  { value: 'concluded',         label: '🏁 Concluído' },
]

// Ações do auditor sobre o workflow (não o status do documento)
// O auditor move o prontuário no fluxo: in_audit → correction_needed | concluded
const AUDITOR_WF_ACTIONS = [
  { value: 'correction_needed', label: '✏️ Solicitar correção' },
  { value: 'corrected',         label: '🔄 Marcar como corrigido' },
  { value: 'concluded',         label: '🏁 Concluir (auditoria OK)' },
]

function WfBadge({ status }) {
  if (!status) return <span className={styles.badgeNone}>—</span>
  const cfg = STATUS_WORKFLOW[status] || { label: status, color: 'info', icon: '' }
  return (
    <span className={`${styles.wfBadge} ${styles['wf_' + cfg.color]}`}>
      {cfg.icon} {cfg.label}
    </span>
  )
}

export default function RevisaoPage() {
  const { user, profile, loading: authLoading } = useAuth()
  const log = useAuditLog()

  const [rows,          setRows]          = useState([])
  const [total,         setTotal]         = useState(0)
  const [loading,       setLoading]       = useState(false)
  const [error,         setError]         = useState('')
  const [page,          setPage]          = useState(0)
  const [search,        setSearch]        = useState('')
  const [sort,          setSort]          = useState('created_at:asc')
  const [workflowFilter,  setWorkflowFilter]  = useState('')

  const [current,       setCurrent]       = useState(null)
  const [fileUrl,       setFileUrl]       = useState('')
  const [loadingUrl,    setLoadingUrl]    = useState(false)
  const [showInlinePdf, setShowInlinePdf] = useState(false)
  const [isPdf,         setIsPdf]         = useState(false)

  // Ação de workflow (fluxo de solicitação)
  const [wfAction,     setWfAction]     = useState('')
  const [wfNote,       setWfNote]       = useState('')
  const [savingWf,     setSavingWf]     = useState(false)

  const [sortField, sortDir] = sort.split(':')

  const userRole = profile?.role ?? 'auditor'
  const allowedWfTransitions = ALLOWED_TRANSITIONS_BY_ROLE[userRole] ?? {}

  const getAvailableWfActions = (currentWfStatus) => {
    const allowed = allowedWfTransitions[currentWfStatus] ?? []
    return AUDITOR_WF_ACTIONS.filter(a => allowed.includes(a.value))
  }

  const fetchFila = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      let q = supabase
        .from('prontuarios')
        .select('*, profiles!prontuarios_uploaded_by_fkey(name, role)', { count: 'exact' })
        .order(sortField, { ascending: sortDir === 'asc' })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)

      // Filtro de status de documento
      if (workflowFilter) {
        q = q.eq('status', workflowFilter)
      } else {
        q = q.neq('status', 'trash')
      }

      if (search.trim()) {
        q = q.or(
          `patient_name.ilike.%${search.trim()}%,record_number.ilike.%${search.trim()}%,patient_cpf.ilike.%${search.trim()}%`
        )
      }

      const { data, count, error: err } = await q
      if (err) throw err
      setRows(data ?? [])
      setTotal(count ?? 0)
    } catch {
      setError('Não foi possível carregar a fila. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }, [search, sort, page, workflowFilter, sortField, sortDir])

  useEffect(() => {
    if (!authLoading && user) fetchFila()
  }, [fetchFila, authLoading, user])

  async function openReview(row) {
    setCurrent(row)
    setFileUrl('')
    setShowInlinePdf(false)
    setIsPdf(false)
    setWfAction('')
    setWfNote('')

    if (row.file_path) {
      setLoadingUrl(true)
      try {
        const { data } = await supabase.storage
          .from('prontuarios')
          .createSignedUrl(row.file_path, 60 * 60)
        const url = data?.signedUrl ?? ''
        setFileUrl(url)
        // Detecta se é PDF pelo caminho ou extensão
        const ext = (row.file_name || row.file_path || '').split('.').pop()?.toLowerCase()
        setIsPdf(ext === 'pdf')
      } finally {
        setLoadingUrl(false)
      }
    }
  }

  function closeReview() {
    setCurrent(null)
    setFileUrl('')
    setShowInlinePdf(false)
    setWfAction('')
    setWfNote('')
  }

  /** Atualiza o status de fluxo (workflow) */
  async function updateWorkflow() {
  if (!wfAction || !current) return
  setSavingWf(true)
  try {
    // Mapeia workflow → document status
    const docStatusMap = {
      'concluded': 'approved',
      'correction_needed': 'reproved',
    }

    const updatePayload = {
      workflow_status: wfAction,
      ...(wfNote.trim() ? { workflow_note: wfNote.trim() } : {}),
      updated_at: new Date().toISOString(),
    }

    if (docStatusMap[wfAction]) {
      updatePayload.status = docStatusMap[wfAction]
      updatePayload.reviewed_at = new Date().toISOString()
      updatePayload.reviewed_by = user.id
    }

    const { error: err } = await supabase
      .from('prontuarios')
      .update(updatePayload)
      .eq('id', current.id)
    if (err) throw err

    const cfg = STATUS_WORKFLOW[wfAction]
    await log('workflow_update', `Workflow → "${cfg?.label}" · ${current.record_number}`, current.id)

    toast.success(`Fluxo: "${cfg?.label}".`)
    setCurrent(prev => ({ 
      ...prev, 
      workflow_status: wfAction,
      ...(docStatusMap[wfAction] ? { status: docStatusMap[wfAction] } : {})
    }))
    setWfAction('')
    setWfNote('')
    fetchFila()
  } catch {
    toast.error('Erro ao atualizar fluxo.')
  } finally {
    setSavingWf(false)
  }
}

  /** Download do arquivo */
  async function handleDownload() {
    if (!fileUrl) return
    const a = document.createElement('a')
    a.href = fileUrl
    a.download = current?.file_name || 'prontuario'
    a.target = '_blank'
    a.click()
    await log('download', `Download do prontuário ${current?.record_number}`, current?.id)
  }

  /** Impressão do PDF inline */
  function handlePrint() {
    if (!fileUrl) return
    const w = window.open(fileUrl, '_blank')
    w?.focus()
    setTimeout(() => w?.print(), 1000)
    log('print', `Impressão do prontuário ${current?.record_number}`, current?.id)
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div>
      <PageHeader
        title="Fila de Auditoria"
        subtitle="Analise prontuários, solicite correções e gerencie o fluxo de documentação"
        actions={
          <button onClick={fetchFila} disabled={loading} className={styles.btnRefresh}>
            <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <polyline points="23 4 23 10 17 10"/>
              <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
            </svg>
            Atualizar
          </button>
        }
      />

      <form onSubmit={e => { e.preventDefault(); setPage(0); fetchFila() }} className={styles.filters}>
        <input
          type="text"
          placeholder="Buscar por paciente, número ou CPF…"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(0) }}
          className={styles.searchInput}
        />
        <select value={workflowFilter} onChange={e => { setWorkflowFilter(e.target.value); setPage(0) }} className={styles.select}>
          {WORKFLOW_FILTER_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <select value={sort} onChange={e => { setSort(e.target.value); setPage(0) }} className={styles.select}>
          {SORT_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <button type="submit" className={styles.btnSearch}>
          <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          Buscar
        </button>
      </form>

      {error && <div className={styles.errorBox}>{error}</div>}

      <div className={styles.tableCard}>
        {loading ? (
          <div className={styles.loadingState}>
            <span className="spinner dark" /> Carregando…
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<svg fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>}
            title="Nenhum prontuário encontrado"
            subtitle={search ? 'Nenhum resultado para esta busca' : 'A fila está vazia para este filtro'}
          />
        ) : (
          <>
            <div className={styles.tableInfo}>
              {total} prontuário{total !== 1 ? 's' : ''}
            </div>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Paciente</th>
                    <th>Número</th>
                    <th>Tipo</th>
                    <th>Páginas</th>
                    <th>Status fluxo</th>
                    <th>Data</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => (
                    <tr key={row.id} className={styles.row}>
                      <td className={styles.tdName}>{row.patient_name || '—'}</td>
                      <td className={styles.tdMono}>{row.record_number || '—'}</td>
                      <td>{row.document_type || '—'}</td>
                      <td className={styles.tdCenter}>{row.pages || '—'}</td>
                      <td><WfBadge status={row.workflow_status} /></td>
                      <td className={styles.tdDate}>
                        {row.created_at
                          ? format(new Date(row.created_at), 'dd/MM/yyyy', { locale: ptBR })
                          : '—'}
                      </td>
                      <td>
                        <button onClick={() => openReview(row)} className={styles.btnAuditar}>
                          Auditar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className={styles.pagination}>
                <span className={styles.pageInfo}>{total} registros · página {page + 1} de {totalPages}</span>
                <div className={styles.pageControls}>
                  <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className={styles.btnPage}>← Anterior</button>
                  <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className={styles.btnPage}>Próxima →</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal de auditoria */}
      {current && (
        <div className={styles.overlay} onClick={closeReview}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <h3>Auditar Prontuário</h3>
                <span className={styles.modalSub}>{current.patient_name} · Nº {current.record_number}</span>
              </div>
              <button onClick={closeReview} className={styles.modalClose}>
                <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <div className={styles.modalBody}>
              <dl className={styles.detailGrid}>
                <div><dt>Paciente</dt><dd>{current.patient_name || '—'}</dd></div>
                <div><dt>CPF</dt><dd className={styles.mono}>{current.patient_cpf || '—'}</dd></div>
                <div><dt>Número</dt><dd className={styles.mono}>{current.record_number || '—'}</dd></div>
                <div><dt>Tipo</dt><dd>{current.document_type || '—'}</dd></div>
                <div><dt>Páginas</dt><dd>{current.pages || '—'}</dd></div>
                {current.origin_sector && (
                  <div><dt>Setor de origem</dt><dd>{current.origin_sector}</dd></div>
                )}
                <div>
                  <dt>Status de fluxo</dt>
                  <dd><WfBadge status={current.workflow_status} /></dd>
                </div>
                <div><dt>Enviado por</dt><dd>{current.profiles?.name || '—'}</dd></div>
                <div className={styles.colSpan2}>
                  <dt>Enviado em</dt>
                  <dd>{current.created_at
                    ? format(new Date(current.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                    : '—'}
                  </dd>
                </div>
                {current.upload_note && (
                  <div className={styles.colSpan2}>
                    <dt>Obs. do upload</dt>
                    <dd className={styles.preWrap}>{current.upload_note}</dd>
                  </div>
                )}
                {current.resubmit_note && (
                  <div className={styles.colSpan2}>
                    <dt className={styles.resubmitLabel}>
                      <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 16 16">
                        <path d="M13.5 2.5l-11 11M5 2.5H2.5V5M13.5 11v2.5H11"/>
                      </svg>
                      Nota do reenvio
                    </dt>
                    <dd className={styles.preWrap}>{current.resubmit_note}</dd>
                  </div>
                )}
                {current.workflow_note && (
                  <div className={styles.colSpan2}>
                    <dt>Nota do fluxo</dt>
                    <dd className={styles.preWrap}>{current.workflow_note}</dd>
                  </div>
                )}
              </dl>

              {/* Arquivo: visualização inline + download + impressão */}
              {current.file_path && (
                <div className={styles.fileSection}>
                  {loadingUrl ? (
                    <span className={styles.loadingText}>Gerando link…</span>
                  ) : fileUrl ? (
                    <>
                      <div className={styles.fileActions}>
                        {isPdf && (
                          <button
                            onClick={() => setShowInlinePdf(v => !v)}
                            className={styles.btnFileAction}
                          >
                            <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                              <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                            </svg>
                            {showInlinePdf ? 'Fechar visualização' : 'Visualizar PDF'}
                          </button>
                        )}
                        <a href={fileUrl} target="_blank" rel="noopener noreferrer" className={styles.btnFileAction}>
                          <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
                            <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                          </svg>
                          Abrir em nova aba
                        </a>
                        <button onClick={handleDownload} className={styles.btnFileAction}>
                          <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
                          </svg>
                          Download
                        </button>
                        <button onClick={handlePrint} className={styles.btnFileAction}>
                          <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <polyline points="6 9 6 2 18 2 18 9"/>
                            <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/>
                            <rect x="6" y="14" width="12" height="8"/>
                          </svg>
                          Imprimir
                        </button>
                      </div>

                      {/* Visualização inline do PDF */}
                      {showInlinePdf && isPdf && (
                        <div className={styles.inlinePdf}>
                          <iframe
                            src={fileUrl}
                            title="Prontuário"
                            className={styles.pdfFrame}
                          />
                        </div>
                      )}
                    </>
                  ) : (
                    <span className={styles.loadingText}>Arquivo não disponível.</span>
                  )}
                </div>
              )}

              {/* Ações de fluxo (workflow) */}
              {(() => {
                const wfActions = getAvailableWfActions(current.workflow_status)
                return wfActions.length > 0 ? (
                  <div className={styles.wfSection}>
                    <h4 className={styles.sectionTitle}>Atualizar fluxo de solicitação</h4>
                    <div className={styles.wfRow}>
                      <select value={wfAction} onChange={e => setWfAction(e.target.value)} className={styles.select}>
                        <option value="">Selecione ação de fluxo…</option>
                        {wfActions.map(a => (
                          <option key={a.value} value={a.value}>{a.label}</option>
                        ))}
                      </select>
                      <button
                        onClick={updateWorkflow}
                        disabled={!wfAction || savingWf}
                        className={styles.btnSaveWf}
                      >
                        {savingWf ? '…' : 'Atualizar fluxo'}
                      </button>
                    </div>
                    {wfAction && (
                      <textarea
                        rows={2}
                        value={wfNote}
                        onChange={e => setWfNote(e.target.value)}
                        placeholder="Nota sobre esta etapa do fluxo (opcional)…"
                        className={styles.textarea}
                        style={{ marginTop: 8 }}
                      />
                    )}
                  </div>
                ) : null
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
