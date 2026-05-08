import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/storage'
import { useAuth } from '../hooks/useAuth'
import { useAuditLog } from '../hooks/useAuditLog'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import toast from 'react-hot-toast'
import { PageHeader, EmptyState } from '../components/UI'
import styles from './RevisorPage.module.css'

const WORKFLOW_LABELS = {
  received:         { label: 'Recebida',      color: 'info'    },
  request_approved: { label: 'Aprovada',      color: 'success' },
  request_rejected: { label: 'Recusada',      color: 'danger'  },
  in_production:    { label: 'Em produção',   color: 'warning' },
  in_audit:         { label: 'Em auditoria',  color: 'purple'  },
  delivered:        { label: 'Entregue',      color: 'success' },
}

const NOTE_TYPES = [
  { value: 'needs_contact',       label: '📞 Precisa entrar em contato' },
  { value: 'correction_required', label: '✏️ Correção necessária' },
  { value: 'info',                label: 'ℹ️ Informativo' },
]

const SORT_OPTIONS = [
  { value: 'created_at:desc',    label: 'Mais recentes primeiro' },
  { value: 'created_at:asc',     label: 'Mais antigos primeiro' },
  { value: 'patient_name:asc',   label: 'Paciente (A→Z)' },
  { value: 'patient_name:desc',  label: 'Paciente (Z→A)' },
  { value: 'record_number:asc',  label: 'Número (crescente)' },
  { value: 'record_number:desc', label: 'Número (decrescente)' },
]

const STATUS_FILTER_OPTIONS = [
  { value: '',                 label: 'Todos os status de fluxo' },
  { value: 'received',         label: 'Recebidas' },
  { value: 'request_approved', label: 'Aprovadas' },
  { value: 'request_rejected', label: 'Recusadas' },
  { value: 'in_production',    label: 'Em produção' },
  { value: 'in_audit',         label: 'Em auditoria' },
  { value: 'delivered',        label: 'Entregues' },
]

const PAGE_SIZE = 20

export default function RevisorPage() {
  const { user, loading: authLoading } = useAuth()
  const log = useAuditLog()

  const [rows,         setRows]         = useState([])
  const [total,        setTotal]        = useState(0)
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState('')
  const [page,         setPage]         = useState(0)
  const [search,       setSearch]       = useState('')
  const [sort,         setSort]         = useState('created_at:desc')
  const [wfFilter,     setWfFilter]     = useState('')

  const [selected,     setSelected]     = useState(null)
  const [notes,        setNotes]        = useState([])
  const [loadingNotes, setLoadingNotes] = useState(false)

  const [noteText,     setNoteText]     = useState('')
  const [noteType,     setNoteType]     = useState('needs_contact')
  const [savingNote,   setSavingNote]   = useState(false)

  const [wfAction,     setWfAction]     = useState('')
  const [savingWf,     setSavingWf]     = useState(false)

  const [sortField, sortDir] = sort.split(':')

  const fetchRows = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      let q = supabase
        .from('prontuarios')
        .select('*, profiles!prontuarios_uploaded_by_fkey(name, role)', { count: 'exact' })
        .neq('status', 'trash')
        .order(sortField, { ascending: sortDir === 'asc' })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)

      if (search.trim()) {
        q = q.or(
          `patient_name.ilike.%${search.trim()}%,record_number.ilike.%${search.trim()}%,patient_cpf.ilike.%${search.trim()}%`
        )
      }
      if (wfFilter) q = q.eq('workflow_status', wfFilter)

      const { data, count, error: err } = await q
      if (err) throw err
      setRows(data ?? [])
      setTotal(count ?? 0)
    } catch {
      setError('Não foi possível carregar os prontuários. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }, [search, sort, page, wfFilter, sortField, sortDir])

  useEffect(() => {
    if (!authLoading && user) fetchRows()
  }, [fetchRows, authLoading, user])

  async function openDetail(row) {
    setSelected(row)
    setNoteText('')
    setNoteType('needs_contact')
    setWfAction('')
    setLoadingNotes(true)
    try {
      const { data, error: err } = await supabase
        .from('reviewer_notes')
        .select('*, profiles!author_id(name, role)')
        .eq('prontuario_id', row.id)
        .order('created_at', { ascending: false })
      if (err) throw err
      setNotes(data ?? [])
    } catch {
      setNotes([])
    } finally {
      setLoadingNotes(false)
    }
  }

  function closeDetail() {
    setSelected(null)
    setNotes([])
  }

  async function saveNote() {
    if (!noteText.trim() || !selected) return
    setSavingNote(true)
    try {
      const { error: err } = await supabase.from('reviewer_notes').insert({
        prontuario_id: selected.id,
        note_text:     noteText.trim(),
        note_type:     noteType,
      })
      if (err) throw err
      // FIX: usa 'reviewer_note' que é valor válido no enum
      await log('reviewer_note', `Nota adicionada ao prontuário ${selected.record_number}`, selected.id)
      toast.success('Nota registrada.')
      setNoteText('')
      const { data } = await supabase
        .from('reviewer_notes')
        .select('*, profiles!author_id(name, role)')
        .eq('prontuario_id', selected.id)
        .order('created_at', { ascending: false })
      setNotes(data ?? [])
    } catch {
      toast.error('Erro ao salvar nota.')
    } finally {
      setSavingNote(false)
    }
  }

  async function resolveNote(noteId) {
    try {
      const { error: err } = await supabase
        .from('reviewer_notes')
        .update({ resolved: true })
        .eq('id', noteId)
      if (err) throw err
      setNotes(prev => prev.map(n => n.id === noteId ? { ...n, resolved: true } : n))
      toast.success('Nota marcada como resolvida.')
    } catch {
      toast.error('Erro ao resolver nota.')
    }
  }

  async function updateWorkflow() {
    if (!wfAction || !selected) return
    setSavingWf(true)
    try {
      const { error: err } = await supabase
        .from('prontuarios')
        .update({ workflow_status: wfAction })
        .eq('id', selected.id)
      if (err) throw err
      // FIX: usa 'workflow_update' que é valor válido no enum
      await log('workflow_update', `Workflow → "${WORKFLOW_LABELS[wfAction]?.label}" · ${selected.record_number}`, selected.id)
      toast.success(`Status atualizado para "${WORKFLOW_LABELS[wfAction]?.label}".`)
      setSelected(prev => ({ ...prev, workflow_status: wfAction }))
      setWfAction('')
      fetchRows()
    } catch {
      toast.error('Erro ao atualizar status.')
    } finally {
      setSavingWf(false)
    }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  function WfBadge({ status }) {
    if (!status) return <span className={styles.badgeNone}>—</span>
    const cfg = WORKFLOW_LABELS[status] || { label: status, color: 'info' }
    return <span className={`${styles.wfBadge} ${styles['wf_' + cfg.color]}`}>{cfg.label}</span>
  }

  return (
    <div>
      <PageHeader
        title="Painel do Revisor"
        subtitle="Acompanhe prontuários, gerencie status de solicitações e registre notas"
        actions={
          <button onClick={fetchRows} disabled={loading} className={styles.btnRefresh}>
            <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <polyline points="23 4 23 10 17 10"/>
              <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
            </svg>
            Atualizar
          </button>
        }
      />

      <div className={styles.infoBox}>
        <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className={styles.infoIcon}>
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <span>
          As <strong>solicitações de prontuários</strong> chegarão pelo portal externo (em breve).
          Por aqui você acompanha o andamento, registra notas para o operador e atualiza o status de fluxo.
        </span>
      </div>

      <div className={styles.filters}>
        <input
          type="text"
          placeholder="Buscar por paciente, número ou CPF…"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(0) }}
          className={styles.searchInput}
        />
        <select value={wfFilter} onChange={e => { setWfFilter(e.target.value); setPage(0) }} className={styles.select}>
          {STATUS_FILTER_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <select value={sort} onChange={e => { setSort(e.target.value); setPage(0) }} className={styles.select}>
          {SORT_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {error && <div className={styles.errorBox}>{error}</div>}

      <div className={styles.tableCard}>
        {loading ? (
          <div className={styles.loadingState}><span className="spinner dark" /> Carregando…</div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<svg fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>}
            title="Nenhum prontuário encontrado"
            subtitle="Tente ajustar os filtros de busca"
          />
        ) : (
          <>
            <div className={styles.tableInfo}>{total} prontuário{total !== 1 ? 's' : ''}</div>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Paciente</th>
                    <th>Número</th>
                    <th>Tipo</th>
                    <th>Status doc.</th>
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
                      <td>
                        <span className={`${styles.docBadge} ${styles['doc_' + row.status]}`}>
                          {row.status === 'approved' ? 'Liberado'
                           : row.status === 'reproved' ? 'Não liberado'
                           : row.status === 'pending'  ? 'Aguardando'
                           : row.status}
                        </span>
                      </td>
                      <td><WfBadge status={row.workflow_status} /></td>
                      <td className={styles.tdDate}>
                        {row.created_at ? format(new Date(row.created_at), 'dd/MM/yy', { locale: ptBR }) : '—'}
                      </td>
                      <td>
                        <button onClick={() => openDetail(row)} className={styles.btnVer}>
                          Ver / Notas
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

      {selected && (
        <div className={styles.overlay} onClick={closeDetail}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <h3>{selected.patient_name}</h3>
                <span className={styles.modalSub}>Nº {selected.record_number} · {selected.document_type}</span>
              </div>
              <button onClick={closeDetail} className={styles.modalClose}>
                <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <div className={styles.modalBody}>
              <dl className={styles.detailGrid}>
                <div><dt>CPF</dt><dd className={styles.mono}>{selected.patient_cpf || '—'}</dd></div>
                <div><dt>Páginas</dt><dd>{selected.pages || '—'}</dd></div>
                <div>
                  <dt>Status do documento</dt>
                  <dd>
                    <span className={`${styles.docBadge} ${styles['doc_' + selected.status]}`}>
                      {selected.status === 'approved' ? 'Liberado'
                       : selected.status === 'reproved' ? 'Não liberado'
                       : 'Aguardando'}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt>Status de fluxo</dt>
                  <dd>
                    {selected.workflow_status
                      ? <span className={`${styles.wfBadge} ${styles['wf_' + (WORKFLOW_LABELS[selected.workflow_status]?.color || 'info')]}`}>
                          {WORKFLOW_LABELS[selected.workflow_status]?.label || selected.workflow_status}
                        </span>
                      : <span className={styles.badgeNone}>Sem status</span>
                    }
                  </dd>
                </div>
                <div><dt>Enviado por</dt><dd>{selected.profiles?.name || '—'}</dd></div>
                <div>
                  <dt>Data de envio</dt>
                  <dd>{selected.created_at ? format(new Date(selected.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : '—'}</dd>
                </div>
                {selected.upload_note && (
                  <div className={styles.colSpan2}>
                    <dt>Obs. do upload</dt>
                    <dd className={styles.preWrap}>{selected.upload_note}</dd>
                  </div>
                )}
                {selected.review_note && (
                  <div className={styles.colSpan2}>
                    <dt>Obs. da auditoria</dt>
                    <dd className={styles.preWrap}>{selected.review_note}</dd>
                  </div>
                )}
              </dl>

              {/* Atualizar status de fluxo */}
              <div className={styles.section}>
                <h4 className={styles.sectionTitle}>Atualizar status de fluxo</h4>
                <p className={styles.sectionHint}>
                  Registre manualmente o andamento desta solicitação.
                </p>
                <div className={styles.wfRow}>
                  <select value={wfAction} onChange={e => setWfAction(e.target.value)} className={styles.select}>
                    <option value="">Selecione o novo status…</option>
                    {Object.entries(WORKFLOW_LABELS).map(([val, cfg]) => (
                      <option key={val} value={val}>{cfg.label}</option>
                    ))}
                  </select>
                  <button
                    onClick={updateWorkflow}
                    disabled={!wfAction || savingWf}
                    className={styles.btnSaveWf}
                  >
                    {savingWf ? '…' : 'Salvar'}
                  </button>
                </div>
              </div>

              {/* Notas */}
              <div className={styles.section}>
                <h4 className={styles.sectionTitle}>
                  Notas para o operador
                  {notes.filter(n => !n.resolved).length > 0 && (
                    <span className={styles.noteBadge}>
                      {notes.filter(n => !n.resolved).length} pendente{notes.filter(n => !n.resolved).length > 1 ? 's' : ''}
                    </span>
                  )}
                </h4>
                <div className={styles.noteForm}>
                  <select value={noteType} onChange={e => setNoteType(e.target.value)} className={styles.select}>
                    {NOTE_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                  <textarea
                    rows={2}
                    value={noteText}
                    onChange={e => setNoteText(e.target.value)}
                    placeholder="Ex: Falta o documento X, entrar em contato para solicitar o CPF correto…"
                    className={styles.textarea}
                  />
                  <button
                    onClick={saveNote}
                    disabled={!noteText.trim() || savingNote}
                    className={styles.btnAddNote}
                  >
                    {savingNote ? '…' : '+ Registrar nota'}
                  </button>
                </div>

                {loadingNotes ? (
                  <div className={styles.notesLoading}><span className="spinner dark" /></div>
                ) : notes.length === 0 ? (
                  <p className={styles.notesEmpty}>Nenhuma nota registrada para este prontuário.</p>
                ) : (
                  <ul className={styles.notesList}>
                    {notes.map(n => (
                      <li key={n.id} className={`${styles.noteItem} ${n.resolved ? styles.noteResolved : ''}`}>
                        <div className={styles.noteTop}>
                          <span className={`${styles.noteTypeBadge} ${styles['nt_' + n.note_type]}`}>
                            {NOTE_TYPES.find(t => t.value === n.note_type)?.label || n.note_type}
                          </span>
                          <span className={styles.noteMeta}>
                            {n.profiles?.name || 'Sistema'} · {format(new Date(n.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                          </span>
                          {!n.resolved && (
                            <button onClick={() => resolveNote(n.id)} className={styles.btnResolve}>
                              ✓ Resolver
                            </button>
                          )}
                          {n.resolved && <span className={styles.resolvedTag}>Resolvida</span>}
                        </div>
                        <p className={styles.noteText}>{n.note_text}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
