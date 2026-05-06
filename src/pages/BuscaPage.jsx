import { useState, useEffect, useCallback } from 'react'
import { supabase, prontuariosService } from '../lib/storage'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { PageHeader, Badge, EmptyState, LoadingRows } from '../components/UI'
import styles from './BuscaPage.module.css'

const PAGE_SIZE = 20

export default function BuscaPage() {
  const [query,    setQuery]    = useState('')
  const [status,   setStatus]   = useState('')
  const [page,     setPage]     = useState(0)
  const [rows,     setRows]     = useState([])
  const [total,    setTotal]    = useState(0)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [selected, setSelected] = useState(null)
  const [fileUrl,  setFileUrl]  = useState('')

  const fetchProntuarios = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      let q = supabase
        .from('prontuarios')
        .select('*, profiles(name, role)', { count: 'exact' })
        .neq('status', 'trash')  // exclui lixeira explicitamente
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)

      if (query.trim()) {
        q = q.or(`patient_name.ilike.%${query.trim()}%,record_number.ilike.%${query.trim()}%`)
      }
      if (status && status !== 'todos') {
        q = q.eq('status', status)
      }

      const { data, count, error: err } = await q
      if (err) throw err
      setRows(data ?? [])
      setTotal(count ?? 0)
    } catch (err) {
      setError('Não foi possível carregar os prontuários. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }, [query, status, page])

  useEffect(() => { fetchProntuarios() }, [fetchProntuarios])

  function handleFilterChange(field, value) {
    setPage(0)
    if (field === 'query')  setQuery(value)
    if (field === 'status') setStatus(value)
  }

  async function openDetail(row) {
    setSelected(row)
    setFileUrl('')
    if (row.file_path) {
      const { data } = await supabase.storage
        .from('prontuarios')
        .createSignedUrl(row.file_path, 60 * 60)
      setFileUrl(data?.signedUrl ?? '')
    }
  }

  function closeDetail() {
    setSelected(null)
    setFileUrl('')
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div>
      <PageHeader
        title="Busca de Prontuários"
        subtitle="Pesquise por paciente ou número do prontuário"
      />

      {/* Filtros */}
      <div className={styles.filters}>
        <input
          type="text"
          placeholder="Paciente ou número do prontuário…"
          value={query}
          onChange={e => handleFilterChange('query', e.target.value)}
          className={styles.searchInput}
        />
        <select
          value={status}
          onChange={e => handleFilterChange('status', e.target.value)}
          className={styles.select}
        >
          <option value="">Todos os status</option>
          <option value="pending">Aguardando</option>
          <option value="approved">Liberado</option>
          <option value="reproved">Não liberado</option>
        </select>
        <button onClick={fetchProntuarios} className={styles.btnSearch}>
          <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          Buscar
        </button>
      </div>

      {/* Erro */}
      {error && <div className={styles.errorBox}>{error}</div>}

      {/* Tabela */}
      <div className={styles.tableCard}>
        {loading ? (
          <table className={styles.table}>
            <tbody><LoadingRows cols={6} rows={5} /></tbody>
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
                <th>Data</th>
                <th>Status</th>
                <th>Enviado por</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.id}>
                  <td className={styles.tdName}>{row.patient_name || '—'}</td>
                  <td className={styles.tdMono}>{row.record_number || '—'}</td>
                  <td>{row.document_type || '—'}</td>
                  <td>
                    {row.document_date
                      ? format(new Date(row.document_date), 'dd/MM/yyyy', { locale: ptBR })
                      : '—'}
                  </td>
                  <td>{row.status ? <Badge status={row.status} /> : '—'}</td>
                  <td>{row.profiles?.name || '—'}</td>
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

      {/* Paginação */}
      {totalPages > 1 && (
        <div className={styles.pagination}>
          <span className={styles.paginationInfo}>{total} registro{total !== 1 ? 's' : ''}</span>
          <div className={styles.paginationControls}>
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className={styles.btnPage}
            >← Anterior</button>
            <span className={styles.pageIndicator}>{page + 1} / {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className={styles.btnPage}
            >Próxima →</button>
          </div>
        </div>
      )}

      {/* Modal de detalhe */}
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
                <div><dt>Status</dt><dd>{selected.status ? <Badge status={selected.status} /> : '—'}</dd></div>
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
                  <div className={styles.colSpan2}><dt>Obs. da revisão</dt><dd>{selected.review_note}</dd></div>
                )}
              </dl>

              {selected.file_path && (
                <div className={styles.fileLink}>
                  {fileUrl ? (
                    <a href={fileUrl} target="_blank" rel="noopener noreferrer" className={styles.linkBtn}>
                      <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                      </svg>
                      Visualizar arquivo
                    </a>
                  ) : (
                    <span className={styles.loadingText}>Gerando link…</span>
                  )}
                </div>
              )}
            </div>
            <div className={styles.modalFooter}>
              <button onClick={closeDetail} className={styles.btnSecondary}>Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
