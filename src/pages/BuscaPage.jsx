import { useState, useEffect, useCallback } from 'react'
import { supabase, prontuariosService, storageService, STATUS_WORKFLOW } from '../lib/storage'
import { useAuth } from '../hooks/useAuth'
import { useAuditLog } from '../hooks/useAuditLog'
import { useDropzone } from 'react-dropzone'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import toast from 'react-hot-toast'
import { PageHeader, Badge, EmptyState, LoadingRows } from '../components/UI'
import styles from './BuscaPage.module.css'

const PAGE_SIZE = 20

function WfBadge({ status }) {
  if (!status) return null
  const cfg = STATUS_WORKFLOW[status] || { label: status, color: 'info', icon: '' }
  return (
    <span className={`${styles.wfBadge} ${styles['wf_' + cfg.color]}`}>
      {cfg.icon} {cfg.label}
    </span>
  )
}

export default function BuscaPage() {
  const { user, profile, loading: authLoading } = useAuth()
  const log = useAuditLog()

  const [query,   setQuery]   = useState('')
  const [workflowFilter,  setWorkflowFilter]  = useState('')
  const [sector,  setSector]  = useState('')
  const [page,    setPage]    = useState(0)
  const [rows,    setRows]    = useState([])
  const [total,   setTotal]   = useState(0)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const [sectors, setSectors] = useState([])

  // Modal de detalhe
  const [selected,     setSelected]     = useState(null)
  const [fileUrl,      setFileUrl]      = useState('')
  const [showInlinePdf, setShowInlinePdf] = useState(false)
  const [isPdf,        setIsPdf]        = useState(false)

  // Modal de reenvio
  const [resubmitTarget, setResubmitTarget] = useState(null)
  const [resubmitFile,   setResubmitFile]   = useState(null)
  const [resubmitNote,   setResubmitNote]   = useState('')
  const [resubmitting,   setResubmitting]   = useState(false)

  const canUpload = profile?.role === 'admin' || profile?.role === 'operador'

  // Carrega lista de setores para o filtro
  useEffect(() => {
    prontuariosService.listSectors().then(setSectors).catch(() => {})
  }, [])

  const fetchProntuarios = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      let q = supabase
        .from('prontuarios')
        .select('*, profiles!prontuarios_uploaded_by_fkey(name, role)', { count: 'exact' })
        .neq('status', 'trash')
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)

      if (query.trim()) {
        q = q.or(`patient_name.ilike.%${query.trim()}%,record_number.ilike.%${query.trim()}%,patient_cpf.ilike.%${query.trim()}%`)
      }
      if (workflowFilter && workflowFilter !== 'todos') {
        q = q.eq('workflow_status', workflowFilter)
      }
      if (sector) {
        q = q.eq('origin_sector', sector)
      }

      const { data, count, error: err } = await q
      if (err) throw err
      setRows(data ?? [])
      setTotal(count ?? 0)
    } catch {
      setError('Não foi possível carregar os prontuários. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }, [query, status, sector, page])

  useEffect(() => {
    if (!authLoading && user) fetchProntuarios()
  }, [fetchProntuarios, authLoading, user])

  function handleFilterChange(field, value) {
    setPage(0)
    if (field === 'query')  setQuery(value)
    if (field === 'workflow') setWorkflowFilter(value)
    if (field === 'sector') setSector(value)
  }

  async function openDetail(row) {
    setSelected(row)
    setFileUrl('')
    setShowInlinePdf(false)
    setIsPdf(false)
    if (row.file_path) {
      const { data } = await supabase.storage
        .from('prontuarios')
        .createSignedUrl(row.file_path, 60 * 60)
      const url = data?.signedUrl ?? ''
      setFileUrl(url)
      const ext = (row.file_name || row.file_path || '').split('.').pop()?.toLowerCase()
      setIsPdf(ext === 'pdf')
      await log('download', `Visualizou prontuário ${row.record_number}`, row.id)
    }
  }

  function closeDetail() {
    setSelected(null)
    setFileUrl('')
    setShowInlinePdf(false)
  }

  async function handleDownload() {
    if (!fileUrl || !selected) return
    const a = document.createElement('a')
    a.href = fileUrl
    a.download = selected.file_name || 'prontuario'
    a.target = '_blank'
    a.click()
    await log('download', `Download do prontuário ${selected.record_number}`, selected.id)
  }

  function handlePrint() {
    if (!fileUrl || !selected) return
    const w = window.open(fileUrl, '_blank')
    w?.focus()
    setTimeout(() => w?.print(), 1000)
    log('print', `Impressão do prontuário ${selected.record_number}`, selected.id)
  }

  // ── REENVIO ──────────────────────────────────────────────────
  function openResubmit(row) {
    setResubmitTarget(row)
    setResubmitFile(null)
    setResubmitNote('')
    closeDetail()
  }

  function closeResubmit() {
    setResubmitTarget(null)
    setResubmitFile(null)
    setResubmitNote('')
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: accepted => { if (accepted[0]) setResubmitFile(accepted[0]) },
    accept: { 'application/pdf': [], 'image/jpeg': [], 'image/png': [] },
    maxSize: 20 * 1024 * 1024,
    multiple: false,
    onDropRejected: () => toast.error('Arquivo inválido. Use PDF, JPG ou PNG até 20 MB.'),
  })

  async function handleResubmit(e) {
    e.preventDefault()
    if (!resubmitFile) {
      toast.error('Selecione o arquivo corrigido.')
      return
    }
    setResubmitting(true)
    try {
      // 1. Upload do novo arquivo
      const ext  = resubmitFile.name.split('.').pop()
      const path = `${user.id}/${Date.now()}_${resubmitTarget.record_number}_v2.${ext}`
      await storageService.upload(resubmitFile, path)

      // 2. Atualiza o prontuário: volta para pending, novo arquivo, guarda nota de reenvio
      const { error: err } = await supabase
        .from('prontuarios')
        .update({
          status:        'pending',
          file_path:     path,
          file_name:     resubmitFile.name,
          file_size:     resubmitFile.size,
          resubmit_note: resubmitNote.trim() || null,
          reviewed_at:   null,
          reviewed_by:   null,
          review_note:   null,
        })
        .eq('id', resubmitTarget.id)
      if (err) throw err

      // 3. Log
      await log('resubmit', `Prontuário ${resubmitTarget.record_number} reenviado corrigido`, resubmitTarget.id)

      toast.success('Prontuário corrigido reenviado para auditoria!')
      closeResubmit()
      fetchProntuarios()
    } catch (err) {
      toast.error('Erro ao reenviar. Tente novamente.')
      console.error(err)
    } finally {
      setResubmitting(false)
    }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div>
      <PageHeader
        title="Busca de Prontuários"
        subtitle="Pesquise por paciente, CPF ou número do prontuário"
      />

      <div className={styles.filters}>
        <input
          type="text"
          placeholder="Paciente, CPF ou número do prontuário…"
          value={query}
          onChange={e => handleFilterChange('query', e.target.value)}
          className={styles.searchInput}
        />
        <select
          value={workflowFilter}
          onChange={e => handleFilterChange('workflow', e.target.value)}
          className={styles.select}
        >
          <option value="">Todos os status</option>
          {Object.entries(STATUS_WORKFLOW).map(([key, cfg]) => (
            <option key={key} value={key}>{cfg.icon} {cfg.label}</option>
          ))}
        </select>
        {sectors.length > 0 && (
          <select
            value={sector}
            onChange={e => handleFilterChange('sector', e.target.value)}
            className={styles.select}
          >
            <option value="">Todos os setores</option>
            {sectors.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
        <button onClick={fetchProntuarios} className={styles.btnSearch}>
          <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          Buscar
        </button>
      </div>

      {error && <div className={styles.errorBox}>{error}</div>}

      <div className={styles.tableCard}>
        {loading ? (
          <table className={styles.table}>
            <tbody><LoadingRows cols={7} rows={5} /></tbody>
          </table>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<svg fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>}
            title="Nenhum prontuário encontrado"
            subtitle="Tente ajustar os filtros de busca"
          />
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Paciente</th>
                <th>Número</th>
                <th>Tipo</th>
                <th>Setor</th>
                <th>Data</th>
                <th>Status fluxo</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.id}>
                  <td className={styles.tdName}>{row.patient_name || '—'}</td>
                  <td className={styles.tdMono}>{row.record_number || '—'}</td>
                  <td>{row.document_type || '—'}</td>
                  <td>{row.origin_sector || '—'}</td>
                  <td>
                    {row.document_date
                      ? format(new Date(row.document_date), 'dd/MM/yyyy', { locale: ptBR })
                      : '—'}
                  </td>
                  <td><WfBadge status={row.workflow_status} /></td>
                  <td className={styles.tdActions}>
                    <button onClick={() => openDetail(row)} className={styles.btnDetail}>
                      Ver detalhe
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className={styles.pagination}>
          <span className={styles.paginationInfo}>{total} registro{total !== 1 ? 's' : ''}</span>
          <div className={styles.paginationControls}>
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className={styles.btnPage}>← Anterior</button>
            <span className={styles.pageIndicator}>{page + 1} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className={styles.btnPage}>Próxima →</button>
          </div>
        </div>
      )}

      {/* ── Modal de detalhe ── */}
      {selected && (
        <div className={styles.overlay} onClick={closeDetail}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Detalhe do Prontuário</h3>
              <button onClick={closeDetail} className={styles.modalClose}>
                <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div className={styles.modalBody}>
              <dl className={styles.detailGrid}>
                <div><dt>Paciente</dt><dd>{selected.patient_name || '—'}</dd></div>
                <div><dt>CPF</dt><dd className={styles.mono}>{selected.patient_cpf || '—'}</dd></div>
                <div><dt>Número</dt><dd className={styles.mono}>{selected.record_number || '—'}</dd></div>
                <div><dt>Tipo</dt><dd>{selected.document_type || '—'}</dd></div>
                {selected.origin_sector && (
                  <div><dt>Setor de origem</dt><dd>{selected.origin_sector}</dd></div>
                )}
                <div><dt>Status doc.</dt><dd>{selected.status ? <Badge status={selected.status} /> : '—'}</dd></div>
                <div><dt>Status fluxo</dt><dd><WfBadge status={selected.workflow_status} /></dd></div>
                <div><dt>Data do doc.</dt><dd>
                  {selected.document_date
                    ? format(new Date(selected.document_date), 'dd/MM/yyyy', { locale: ptBR })
                    : '—'}
                </dd></div>
                <div><dt>Páginas</dt><dd>{selected.pages || '—'}</dd></div>
                <div><dt>Enviado por</dt><dd>{selected.profiles?.name || '—'}</dd></div>
                {selected.upload_note && (
                  <div className={styles.colSpan2}><dt>Obs. do upload</dt><dd>{selected.upload_note}</dd></div>
                )}
                {selected.review_note && (
                  <div className={styles.colSpan2}>
                    <dt className={styles.reviewNoteLabel}>Obs. da auditoria</dt>
                    <dd className={styles.reviewNoteText}>{selected.review_note}</dd>
                  </div>
                )}
                {selected.resubmit_note && (
                  <div className={styles.colSpan2}><dt>Obs. do reenvio</dt><dd>{selected.resubmit_note}</dd></div>
                )}
                {selected.workflow_note && (
                  <div className={styles.colSpan2}><dt>Nota do fluxo</dt><dd>{selected.workflow_note}</dd></div>
                )}
              </dl>

              {/* Arquivo: ações + inline PDF */}
              {selected.file_path && (
                <div className={styles.fileSection}>
                  {fileUrl ? (
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
                        <a href={fileUrl} target="_blank" rel="noopener noreferrer" className={styles.btnFileAction}>
                          <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
                            <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                          </svg>
                          Abrir em nova aba
                        </a>
                      </div>

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
                    <span className={styles.loadingText}>Gerando link…</span>
                  )}
                </div>
              )}
            </div>
            <div className={styles.modalFooter}>
              {canUpload && selected.status === 'reproved' && (
                <button onClick={() => openResubmit(selected)} className={styles.btnResubmit}>
                  <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
                  </svg>
                  Enviar corrigido
                </button>
              )}
              <button onClick={closeDetail} className={styles.btnSecondary}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal de reenvio corrigido ── */}
      {resubmitTarget && (
        <div className={styles.overlay} onClick={closeResubmit}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <h3>Enviar prontuário corrigido</h3>
                <span className={styles.modalSub}>{resubmitTarget.patient_name} · Nº {resubmitTarget.record_number}</span>
              </div>
              <button onClick={closeResubmit} className={styles.modalClose}>
                <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <form onSubmit={handleResubmit}>
              <div className={styles.modalBody}>
                {resubmitTarget.review_note && (
                  <div className={styles.reprovadoInfo}>
                    <div className={styles.reprovadoLabel}>
                      <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 16 16">
                        <circle cx="8" cy="8" r="7"/><line x1="8" y1="5" x2="8" y2="8"/><line x1="8" y1="11" x2="8.01" y2="11"/>
                      </svg>
                      Motivo da reprovação pelo auditor
                    </div>
                    <p className={styles.reprovadoText}>{resubmitTarget.review_note}</p>
                  </div>
                )}

                <div
                  {...getRootProps()}
                  className={`${styles.resubmitDrop} ${isDragActive ? styles.drag : ''} ${resubmitFile ? styles.hasFile : ''}`}
                >
                  <input {...getInputProps()} />
                  <svg fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
                  </svg>
                  <p>{resubmitFile ? `✓ ${resubmitFile.name}` : 'Arraste o arquivo corrigido ou clique para selecionar'}</p>
                  <span>{resubmitFile ? `${(resubmitFile.size / 1024 / 1024).toFixed(2)} MB` : 'PDF, JPG ou PNG — até 20 MB'}</span>
                </div>

                <div className={styles.obsField}>
                  <label className={styles.obsLabel}>Observação do reenvio (opcional)</label>
                  <textarea
                    rows={2}
                    value={resubmitNote}
                    onChange={e => setResubmitNote(e.target.value)}
                    placeholder="Ex: Corrigido o CPF na página 2, assinatura adicionada…"
                    className={styles.textarea}
                  />
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button type="submit" disabled={resubmitting || !resubmitFile} className={styles.btnSubmitResubmit}>
                  {resubmitting ? <><span className={styles.spinner} /> Enviando…</> : (
                    <>
                      <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
                      </svg>
                      Reenviar para auditoria
                    </>
                  )}
                </button>
                <button type="button" onClick={closeResubmit} disabled={resubmitting} className={styles.btnSecondary}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
