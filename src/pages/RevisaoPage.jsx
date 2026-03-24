import { useState, useEffect, useCallback } from 'react'
import { prontuariosService, storageService } from '../lib/storage'
import { useAuth } from '../hooks/useAuth'
import { useAuditLog } from '../hooks/useAuditLog'
import toast from 'react-hot-toast'
import { PageHeader, BtnAccent, BtnSec, BtnDanger, EmptyState, Badge } from '../components/UI'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import styles from './RevisaoPage.module.css'

export default function RevisaoPage() {
  const { user } = useAuth()
  const log = useAuditLog()

  const [queue, setQueue]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [selected, setSelected]   = useState(null)
  const [signedUrl, setSignedUrl] = useState(null)
  const [decision, setDecision]   = useState(null) // 'approve' | 'reprove'
  const [note, setNote]           = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]         = useState('')

  const fetchQueue = useCallback(async () => {
    setLoading(true)
    const { data } = await prontuariosService.list({ status: 'pending', perPage: 100 })
    setQueue(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchQueue() }, [fetchQueue])

  async function openItem(item) {
    setSelected(item)
    setDecision(null)
    setNote('')
    setError('')
    setSignedUrl(null)
    if (item.file_path) {
      try {
        const url = await storageService.getSignedUrl(item.file_path, 3600)
        setSignedUrl(url)
      } catch { /* sem arquivo */ }
    }
  }

  function back() { setSelected(null); setSignedUrl(null) }

  async function confirm() {
    if (decision === 'reprove' && !note.trim()) {
      setError('Informe o motivo da não liberação.')
      return
    }
    setSubmitting(true)
    try {
      const newStatus = decision === 'approve' ? 'approved' : 'reproved'
      await prontuariosService.updateStatus(selected.id, newStatus, note || null)
      await log(
        decision === 'approve' ? 'approved' : 'reproved',
        `${decision === 'approve' ? 'Liberou' : 'Reprovou'} prontuário ${selected.record_number}`,
        selected.id
      )
      toast.success(decision === 'approve' ? 'Prontuário liberado!' : 'Prontuário não liberado.')
      setQueue(q => q.filter(i => i.id !== selected.id))
      back()
    } catch {
      toast.error('Erro ao salvar decisão.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── LISTA ──
  if (!selected) return (
    <div>
      <PageHeader
        title="Fila de revisão"
        subtitle={`${queue.length} prontuário${queue.length !== 1 ? 's' : ''} aguardando`}
      />

      {loading ? (
        <div className={styles.loadingWrap}><span className="spinner dark" /></div>
      ) : queue.length === 0 ? (
        <div className={styles.emptyWrap}>
          <EmptyState
            icon={<svg fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>}
            title="Fila vazia"
            subtitle="Nenhum prontuário aguardando revisão."
          />
        </div>
      ) : (
        <div className={styles.list}>
          {queue.map(item => (
            <div key={item.id} className={styles.card} onClick={() => openItem(item)}>
              <div className={styles.cardIcon}>
                <svg fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
              </div>
              <div className={styles.cardBody}>
                <div className={styles.cardName}>{item.patient_name}</div>
                <div className={styles.cardMeta}>
                  {item.document_type} · Cód. {item.record_number} · {item.pages} pág. · Por <strong>{item.profiles?.name || '—'}</strong>
                </div>
              </div>
              <div className={styles.cardRight}>
                <div className={styles.cardTime}>
                  {format(new Date(item.created_at), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
                </div>
                <Badge status="pending" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  // ── DETALHE ──
  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <BtnSec onClick={back}>
          <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
          Voltar à fila
        </BtnSec>
      </div>

      {/* Header */}
      <div className={styles.viewerHeader}>
        <h2>{selected.patient_name}</h2>
        <div className={styles.metaRow}>
          <MetaItem label="Código"     value={selected.record_number} />
          <MetaItem label="CPF"        value={selected.patient_cpf} />
          <MetaItem label="Tipo"       value={selected.document_type} />
          <MetaItem label="Enviado por" value={selected.profiles?.name || '—'} />
          <MetaItem label="Data"       value={format(new Date(selected.created_at), 'dd/MM/yyyy', { locale: ptBR })} />
        </div>
        {selected.upload_note && (
          <div className={styles.uploadNote}>
            <strong>Obs. do operador:</strong> {selected.upload_note}
          </div>
        )}
      </div>

      {/* File viewer */}
      <div className={styles.fileCard}>
        <div className={styles.fileCardHeader}>
          <span>Arquivo do documento</span>
          {signedUrl && (
            <a href={signedUrl} target="_blank" rel="noreferrer" className={styles.openLink}>
              Abrir em nova aba ↗
            </a>
          )}
        </div>
        <div className={styles.filePreview}>
          {!selected.file_path ? (
            <p className={styles.noFile}>Nenhum arquivo enviado com este prontuário.</p>
          ) : !signedUrl ? (
            <div className={styles.loadingFile}><span className="spinner dark" /></div>
          ) : selected.file_name?.endsWith('.pdf') ? (
            <iframe src={signedUrl} title="Documento" className={styles.iframe} />
          ) : (
            <img src={signedUrl} alt="Documento" className={styles.previewImg} />
          )}
        </div>
      </div>

      {/* Decision */}
      <div className={styles.decisionCard}>
        <h3>Decisão de revisão</h3>
        <div className={styles.decisionBtns}>
          <button
            className={`${styles.decisionBtn} ${styles.approve} ${decision === 'approve' ? styles.selected : ''}`}
            onClick={() => { setDecision('approve'); setError('') }}
          >
            <svg fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>
            Liberar prontuário
          </button>
          <button
            className={`${styles.decisionBtn} ${styles.reprove} ${decision === 'reprove' ? styles.selected : ''}`}
            onClick={() => { setDecision('reprove'); setError('') }}
          >
            <svg fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            Não liberar
          </button>
        </div>

        {decision === 'approve' && (
          <div className={styles.noteArea}>
            <label>Comentário de aprovação (opcional)</label>
            <textarea
              placeholder="Adicione uma observação sobre a liberação…"
              value={note}
              onChange={e => setNote(e.target.value)}
              className={styles.textarea}
            />
          </div>
        )}

        {decision === 'reprove' && (
          <div className={styles.noteArea}>
            <label>Motivo da não liberação <span className={styles.req}>*</span></label>
            <textarea
              placeholder="Descreva o motivo pelo qual este prontuário não pode ser liberado…"
              value={note}
              onChange={e => { setNote(e.target.value); setError('') }}
              className={styles.textarea}
            />
            {error && <span className={styles.errMsg}>{error}</span>}
          </div>
        )}

        {decision && (
          <div className={styles.confirmRow}>
            <BtnAccent onClick={confirm} disabled={submitting}>
              {submitting ? <span className="spinner" /> : null}
              {submitting ? 'Salvando…' : 'Confirmar decisão'}
            </BtnAccent>
            <BtnSec onClick={() => { setDecision(null); setNote(''); setError('') }}>Cancelar</BtnSec>
          </div>
        )}
      </div>
    </div>
  )
}

function MetaItem({ label, value }) {
  return (
    <span className={styles.metaItem}>
      <strong>{label}:</strong> {value}
    </span>
  )
}
