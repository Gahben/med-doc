import { useState, useEffect, useCallback } from 'react'
import { supabase, prontuariosService, storageService } from '../lib/storage'
import { useAuth } from '../hooks/useAuth'
import { useAuditLog } from '../hooks/useAuditLog'
import { useDropzone } from 'react-dropzone'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import toast from 'react-hot-toast'
import { PageHeader, Badge, EmptyState, LoadingRows } from '../components/UI'
import styles from './BuscaPage.module.css'

const PAGE_SIZE = 20

export default function BuscaPage() {
  const { user, profile, loading: authLoading } = useAuth()
  const log = useAuditLog()

  const [query,    setQuery]    = useState('')
  const [status,   setStatus]   = useState('')
  const [page,     setPage]     = useState(0)
  const [rows,     setRows]     = useState([])
  const [total,    setTotal]    = useState(0)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  // Modal de detalhe
  const [selected, setSelected] = useState(null)
  const [fileUrl,  setFileUrl]  = useState('')

  // Modal de reenvio
  const [resubmitTarget,  setResubmitTarget]  = useState(null)
  const [resubmitFile,    setResubmitFile]    = useState(null)
  const [resubmitNote,    setResubmitNote]    = useState('')
  const [resubmitting,    setResubmitting]    = useState(false)

  const canUpload = profile?.role === 'admin' || profile?.role === 'operador'

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
        q = q.or(`patient_name.ilike.%${query.trim()}%,record_number.ilike.%${query.trim()}%`)
      }
      if (status && status !== 'todos') {
        q = q.eq('status', status)
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
  }, [query, status, page])

  useEffect(() => {
    if (!authLoading && user) fetchProntuarios()
  }, [fetchProntuarios, authLoading, user])

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
        subtitle="Pesquise por paciente ou número do prontuário"
      />

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
                  <div className={styles.colSpan2}>
                    <dt className={styles.reviewNoteLabel}>Obs. da auditoria</dt>
                    <dd className={styles.reviewNoteText}>{selected.review_note}</dd>
                  </div>
                )}
                {selected.resubmit_note && (
                  <div className={styles.colSpan2}><dt>Obs. do reenvio</dt><dd>{selected.resubmit_note}</dd></div>
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
              {/* Botão de reenvio: só aparece para quem pode fazer upload e o prontuário foi reprovado */}
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
                {/* Motivo da reprovação (contexto para quem reenvia) */}
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

                {/* Dropzone */}
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
