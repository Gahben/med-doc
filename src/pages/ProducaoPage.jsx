import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/storage'
import { STATUS_WORKFLOW, ALLOWED_TRANSITIONS_BY_ROLE } from '../lib/storage'
import { useAuth } from '../hooks/useAuth'
import { useAuditLog } from '../hooks/useAuditLog'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import toast from 'react-hot-toast'
import { PageHeader, EmptyState } from '../components/UI'
import ResubmitModal from '../components/ResubmitModal'
import styles from './RevisorPage.module.css'

const PAGE_SIZE = 20

const SORT_OPTIONS = [
  { value: 'created_at:desc',    label: 'Mais recentes primeiro' },
{ value: 'created_at:asc',     label: 'Mais antigos primeiro' },
{ value: 'patient_name:asc',   label: 'Paciente (A→Z)' },
{ value: 'patient_name:desc',  label: 'Paciente (Z→A)' },
{ value: 'record_number:asc',  label: 'Número (crescente)' },
{ value: 'record_number:desc', label: 'Número (decrescente)' },
]

const WF_FILTER_OPTIONS = [
  { value: '',                  label: 'Todos os meus status' },
{ value: 'request_approved',  label: '✅ Aprovadas (iniciar produção)' },
{ value: 'in_production',     label: '⚙️ Em produção' },
{ value: 'not_found',         label: '🔍 Não localizado' },
{ value: 'correction_needed', label: '✏️ Correção solicitada' },
{ value: 'corrected',         label: '🔄 Corrigido' },
{ value: 'concluded',         label: '🏁 Concluído' },
{ value: 'delivered',         label: '📦 Entregue' },
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

export default function ProducaoPage() {
  const { user, profile, loading: authLoading } = useAuth()
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
  const [wfAction,     setWfAction]     = useState('')
  const [wfActionNote, setWfActionNote] = useState('')
  const [savingWf,     setSavingWf]     = useState(false)

  const [correctionTarget, setCorrectionTarget] = useState(null)

  const [sortField, sortDir] = sort.split(':')

  const userRole = profile?.role ?? 'operador'
  const allowedTransitions = ALLOWED_TRANSITIONS_BY_ROLE[userRole] ?? {}

  const getAvailableActions = (currentStatus) => {
    const allowed = allowedTransitions[currentStatus] || []
    return Object.entries(STATUS_WORKFLOW)
    .filter(([key]) => allowed.includes(key))
    .map(([key, cfg]) => ({ value: key, label: `${cfg.icon} ${cfg.label}` }))
  }

  const fetchRows = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const operadorStatuses = ['request_approved', 'in_production', 'not_found', 'correction_needed', 'corrected', 'concluded', 'delivered']

      let q = supabase
      .from('prontuarios')
      .select('*, profiles!prontuarios_uploaded_by_fkey(name, role)', { count: 'exact' })
      .in('workflow_status', operadorStatuses)
      .neq('status', 'trash')
      .order(sortField, { ascending: sortDir === 'asc' })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)

      if (search.trim()) {
        q = q.or(`patient_name.ilike.%${search.trim()}%,record_number.ilike.%${search.trim()}%,patient_cpf.ilike.%${search.trim()}%`)
      }
      if (wfFilter) {
        q = q.eq('workflow_status', wfFilter)
      }

      const { data, count, error: err } = await q
      if (err) throw err
        setRows(data ?? [])
        setTotal(count ?? 0)
    } catch {
      setError('Não foi possível carregar os prontuários.')
    } finally {
      setLoading(false)
    }
  }, [search, sort, page, wfFilter, sortField, sortDir])

  useEffect(() => {
    if (!authLoading && user) fetchRows()
  }, [fetchRows, authLoading, user])

  function openDetail(row) {
    setSelected(row)
    setWfAction('')
    setWfActionNote('')
  }

  function closeDetail() {
    setSelected(null)
    setWfAction('')
    setWfActionNote('')
  }

  async function updateWorkflow() {
    if (!wfAction || !selected) return
      setSavingWf(true)
      try {
        const updatePayload = {
          workflow_status: wfAction,
          ...(wfActionNote.trim() ? { workflow_note: wfActionNote.trim() } : {}),
          updated_at: new Date().toISOString(),
        }

        const { error: err } = await supabase
        .from('prontuarios')
        .update(updatePayload)
        .eq('id', selected.id)
        if (err) throw err

          const cfg = STATUS_WORKFLOW[wfAction]
          await log('workflow_update', `Operador → "${cfg?.label}" · ${selected.record_number}`, selected.id)

          toast.success(`Status: "${cfg?.label}".`)
          setSelected(prev => ({ ...prev, workflow_status: wfAction }))
          setWfAction('')
          setWfActionNote('')
          fetchRows()
      } catch {
        toast.error('Erro ao atualizar status.')
      } finally {
        setSavingWf(false)
      }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const availableActions = selected ? getAvailableActions(selected.workflow_status) : []

  return (
    <div>
    <PageHeader
    title="Produção de Prontuários"
    subtitle="Gerencie o fluxo de produção, correção e entrega"
    />

    <div className={styles.infoBox}>
    <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className={styles.infoIcon}>
    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
    <span>
    Como <strong>Operador</strong>, você move os prontuários pelo fluxo de produção:
    inicia produção, marca correções, conclui e registra entregas.
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
    {WF_FILTER_OPTIONS.map(o => (
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
      subtitle="Nenhum prontuário na fila de produção"
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
      <th>Setor</th>
      <th>Status</th>
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
        <td>{row.origin_sector || '—'}</td>
        <td><WfBadge status={row.workflow_status} /></td>
        <td className={styles.tdDate}>
        {row.created_at ? format(new Date(row.created_at), 'dd/MM/yy', { locale: ptBR }) : '—'}
        </td>
        <td>
        <button onClick={() => openDetail(row)} className={styles.btnVer}>
        Atualizar
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

    {/* Modal de atualização */}
    {selected && (
      <div className={styles.overlay} onClick={closeDetail}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
      <div className={styles.modalHeader}>
      <div>
      <h3>{selected.patient_name}</h3>
      <span className={styles.modalSub}>Nº {selected.record_number} · {selected.origin_sector || '—'}</span>
      </div>
      <button onClick={closeDetail} className={styles.modalClose}>
      <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
      </button>
      </div>

      <div className={styles.modalBody}>
      <div className={styles.section}>
      <h4 className={styles.sectionTitle}>
      Status atual: <WfBadge status={selected.workflow_status} />
      </h4>
      </div>

      {/* Botão de correção (aparece quando correção solicitada) */}
      {selected.workflow_status === 'correction_needed' && (
        <div className={styles.section}>
        <button
        onClick={() => {
          setCorrectionTarget(selected)
          closeDetail()
        }}
        className={styles.btnSaveWf}
        style={{ background: 'var(--warning)', color: '#fff', width: '100%', justifyContent: 'center', padding: '12px' }}
        >
        📤 Enviar correção do documento
        </button>
        </div>
      )}

      <div className={styles.section}>
      <h4 className={styles.sectionTitle}>Atualizar status</h4>
      {availableActions.length > 0 ? (
        <>
        <div className={styles.wfRow}>
        <select value={wfAction} onChange={e => setWfAction(e.target.value)} className={styles.select}>
        <option value="">Selecione o novo status…</option>
        {availableActions.map(a => (
          <option key={a.value} value={a.value}>{a.label}</option>
        ))}
        </select>
        <button onClick={updateWorkflow} disabled={!wfAction || savingWf} className={styles.btnSaveWf}>
        {savingWf ? '…' : 'Atualizar'}
        </button>
        </div>
        {wfAction && (
          <textarea
          rows={2}
          value={wfActionNote}
          onChange={e => setWfActionNote(e.target.value)}
          placeholder="Observação (opcional)…"
          className={styles.textarea}
          style={{ marginTop: 8 }}
          />
        )}
        </>
      ) : (
        <p className={styles.sectionHint}>Nenhuma ação disponível para este status.</p>
      )}
      </div>
      </div>
      </div>
      </div>
    )}

    {/* Modal de correção/envio de arquivo */}
    {correctionTarget && (
      <ResubmitModal
      prontuario={correctionTarget}
      onClose={() => setCorrectionTarget(null)}
      onSuccess={() => {
        setCorrectionTarget(null)
        fetchRows()
      }}
      />
    )}
    </div>
  )
}
