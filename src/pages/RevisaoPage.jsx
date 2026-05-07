import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/storage'
import { useAuth } from '../hooks/useAuth'
import { useAuditLog } from '../hooks/useAuditLog'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import toast from 'react-hot-toast'
import { PageHeader, EmptyState } from '../components/UI'
import styles from './RevisaoPage.module.css'

const PAGE_SIZE = 20

const SORT_OPTIONS = [
  { value: 'created_at:asc',    label: 'Mais antigos primeiro' },
  { value: 'created_at:desc',   label: 'Mais recentes primeiro' },
  { value: 'patient_name:asc',  label: 'Paciente (A→Z)' },
  { value: 'patient_name:desc', label: 'Paciente (Z→A)' },
  { value: 'record_number:asc',  label: 'Número (crescente)' },
  { value: 'record_number:desc', label: 'Número (decrescente)' },
  { value: 'pages:desc', label: 'Mais páginas primeiro' },
  { value: 'pages:asc',  label: 'Menos páginas primeiro' },
]

export default function RevisaoPage() {
  const { user, loading: authLoading } = useAuth()
  const log = useAuditLog()

  const [rows,       setRows]       = useState([])
  const [total,      setTotal]      = useState(0)
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState('')
  const [page,       setPage]       = useState(0)
  const [search,     setSearch]     = useState('')
  const [sort,       setSort]       = useState('created_at:asc')

  const [current,    setCurrent]    = useState(null)
  const [fileUrl,    setFileUrl]    = useState('')
  const [loadingUrl, setLoadingUrl] = useState(false)
  const [obs,        setObs]        = useState('')
  const [saving,     setSaving]     = useState(false)

  const [sortField, sortDir] = sort.split(':')

  const fetchFila = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      let q = supabase
        .from('prontuarios')
        .select('*, profiles!prontuarios_uploaded_by_fkey(name, role)', { count: 'exact' })
        .eq('status', 'pending')
        .order(sortField, { ascending: sortDir === 'asc' })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)

      if (search.trim()) {
        q = q.or(`patient_name.ilike.%${search.trim()}%,record_number.ilike.%${search.trim()}%,patient_cpf.ilike.%${search.trim()}%`)
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
  }, [search, sort, page, sortField, sortDir])

  useEffect(() => {
    if (!authLoading && user) fetchFila()
  }, [fetchFila, authLoading, user])

  function handleSearchSubmit(e) {
    e.preventDefault()
    setPage(0)
    fetchFila()
  }

  async function openReview(row) {
    setCurrent(row)
    setObs('')
    setFileUrl('')
    if (row.file_path) {
      setLoadingUrl(true)
      try {
        const { data } = await supabase.storage
          .from('prontuarios')
          .createSignedUrl(row.file_path, 60 * 60)
        setFileUrl(data?.signedUrl ?? '')
      } finally {
        setLoadingUrl(false)
      }
    }
  }

  function closeReview() {
    setCurrent(null)
    setFileUrl('')
    setObs('')
  }

  async function decidir(novoStatus) {
    if (!current) return
    setSaving(true)
    try {
      const { error: err } = await supabase
        .from('prontuarios')
        .update({
          status: novoStatus,
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.id,
          workflow_status: novoStatus === 'approved' ? 'in_production' : null,
          ...(obs.trim() ? { review_note: obs.trim() } : {}),
        })
        .eq('id', current.id)
      if (err) throw err
      await log('auditoria', `Prontuário ${current.record_number} ${novoStatus === 'approved' ? 'aprovado' : 'reprovado'} pelo auditor`, current.id)
      toast.success(novoStatus === 'approved' ? '✓ Prontuário aprovado.' : '✕ Prontuário reprovado.')
      closeReview()
      fetchFila()
    } catch {
      toast.error('Erro ao salvar. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div>
      <PageHeader
        title="Fila de Auditoria"
        subtitle="Prontuários pendentes aguardando liberação"
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

      {/* Filtros */}
      <form onSubmit={handleSearchSubmit} className={styles.filters}>
        <input
          type="text"
          placeholder="Buscar por paciente, número ou CPF…"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(0) }}
          className={styles.searchInput}
        />
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
            title="Nenhum prontuário pendente"
            subtitle={search ? 'Nenhum resultado para esta busca' : 'A fila de auditoria está vazia no momento'}
          />
        ) : (
          <>
            <div className={styles.tableInfo}>
              {total} prontuário{total !== 1 ? 's' : ''} aguardando auditoria
            </div>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Paciente</th>
                    <th>Número</th>
                    <th>Tipo de documento</th>
                    <th>Páginas</th>
                    <th>Enviado por</th>
                    <th>Data de envio</th>
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
                      <td>{row.profiles?.name || '—'}</td>
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

      {/* Modal */}
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
                <div><dt>Enviado por</dt><dd>{current.profiles?.name || '—'}</dd></div>
                <div className={styles.colSpan2}>
                  <dt>Enviado em</dt>
                  <dd>{current.created_at ? format(new Date(current.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : '—'}</dd>
                </div>
                {current.upload_note && (
                  <div className={styles.colSpan2}>
                    <dt>Obs. do upload</dt>
                    <dd className={styles.preWrap}>{current.upload_note}</dd>
                  </div>
                )}
              </dl>

              {current.file_path && (
                <div className={styles.fileSection}>
                  {loadingUrl ? (
                    <span className={styles.loadingText}>Gerando link…</span>
                  ) : fileUrl ? (
                    <a href={fileUrl} target="_blank" rel="noopener noreferrer" className={styles.linkBtn}>
                      <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                        <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                      </svg>
                      Abrir arquivo do prontuário
                    </a>
                  ) : (
                    <span className={styles.loadingText}>Arquivo não disponível.</span>
                  )}
                </div>
              )}

              <div className={styles.obsField}>
                <label className={styles.obsLabel}>Observações da auditoria (opcional)</label>
                <textarea
                  rows={3}
                  value={obs}
                  onChange={e => setObs(e.target.value)}
                  placeholder="Justificativa da decisão, pendências, páginas com problema…"
                  className={styles.textarea}
                />
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button onClick={() => decidir('reproved')} disabled={saving} className={styles.btnReprovar}>
                {saving ? '…' : '✕ Reprovar'}
              </button>
              <button onClick={() => decidir('approved')} disabled={saving} className={styles.btnAprovar}>
                {saving ? '…' : '✓ Aprovar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
