import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/storage'
import { useAuth } from '../hooks/useAuth'
import { useAuditLog } from '../hooks/useAuditLog'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import toast from 'react-hot-toast'
import { PageHeader, EmptyState } from '../components/UI'
import styles from './RevisaoPage.module.css'

export default function RevisaoPage() {
  const { user, loading: authLoading } = useAuth()
  const { log }  = useAuditLog()

  const [fila,       setFila]       = useState([])
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState('')
  const [current,    setCurrent]    = useState(null)
  const [fileUrl,    setFileUrl]    = useState('')
  const [loadingUrl, setLoadingUrl] = useState(false)
  const [obs,        setObs]        = useState('')
  const [saving,     setSaving]     = useState(false)

  const fetchFila = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { data, error: err } = await supabase
        .from('prontuarios')
        .select('*, profiles(name, role)')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
      if (err) throw err
      setFila(data ?? [])
    } catch (err) {
      setError('Não foi possível carregar a fila. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { if (!authLoading && user) fetchFila() }, [fetchFila, authLoading, user])

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
      const updateData = {
        status: novoStatus,
        reviewed_at: new Date().toISOString(),
        reviewed_by: user.id,
        workflow_status: novoStatus === 'approved' ? 'in_production' : null,
        ...(obs.trim() ? { review_note: obs.trim() } : {}),
      }
      const { error: err } = await supabase
        .from('prontuarios')
        .update(updateData)
        .eq('id', current.id)
      if (err) throw err
      await log('auditoria', `Prontuário ${current.record_number} foi ${novoStatus === 'approved' ? 'aprovado' : 'reprovado'} pelo auditor`, current.id)
      toast.success(novoStatus === 'approved' ? 'Prontuário aprovado! Status de fluxo atualizado para Em produção.' : 'Prontuário reprovado.')
      closeReview()
      fetchFila()
    } catch {
      toast.error('Erro ao salvar auditoria. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Fila de Auditoria"
        subtitle="Prontuários aguardando liberação pelo auditor"
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

      {error && <div className={styles.errorBox}>{error}</div>}

      {loading ? (
        <div className={styles.loadingState}>
          <span className="spinner dark" />
          Carregando fila…
        </div>
      ) : fila.length === 0 ? (
        <div className={styles.tableCard}>
          <EmptyState
            icon={<svg fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>}
            title="Nenhum prontuário pendente"
            subtitle="A fila de revisão está vazia no momento"
          />
        </div>
      ) : (
        <div className={styles.tableCard}>
          <div className={styles.tableHeader}>
            <span>{fila.length} prontuário{fila.length !== 1 ? 's' : ''} aguardando revisão</span>
          </div>
          <ul className={styles.filaList}>
            {fila.map(row => (
              <li key={row.id} className={styles.filaItem}>
                <div className={styles.filaInfo}>
                  <p className={styles.filaName}>{row.patient_name || '(sem nome)'}</p>
                  <p className={styles.filaMeta}>
                    Nº {row.record_number || '—'} · {row.document_type || '—'} · enviado por {row.profiles?.name || '—'} ·{' '}
                    {row.created_at
                      ? format(new Date(row.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                      : '—'}
                  </p>
                </div>
                <button onClick={() => openReview(row)} className={styles.btnRevisar}>
                  Revisar
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Modal de revisão */}
      {current && (
        <div className={styles.overlay} onClick={closeReview}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Auditar Prontuário</h3>
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
                  <dd>{current.created_at
                    ? format(new Date(current.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                    : '—'}</dd>
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
                    <span className={styles.loadingText}>Gerando link do arquivo…</span>
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
                  placeholder="Justificativa da decisão, pendências…"
                  className={styles.textarea}
                />
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button
                onClick={() => decidir('reproved')}
                disabled={saving}
                className={styles.btnReprovar}
              >
                {saving ? '…' : '✕ Reprovar'}
              </button>
              <button
                onClick={() => decidir('approved')}
                disabled={saving}
                className={styles.btnAprovar}
              >
                {saving ? '…' : '✓ Aprovar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
