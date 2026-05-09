import { useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { prontuariosService } from '../lib/storage'
import { useAuth } from '../hooks/useAuth'
import { useAuditLog } from '../hooks/useAuditLog'
import toast from 'react-hot-toast'
import styles from './ResubmitModal.module.css'

const CORRECTION_TYPES = [
  { value: 'full', label: '📄 Documento completo corrigido' },
  { value: 'pages', label: '📑 Páginas específicas' },
]

export default function ResubmitModal({ prontuario, onClose, onSuccess }) {
  const { user } = useAuth()
  const log = useAuditLog()

  const [correctionType, setCorrectionType] = useState('full')
  const [file, setFile] = useState(null)
  const [note, setNote] = useState('')
  const [pageStart, setPageStart] = useState('')
  const [pageEnd, setPageEnd] = useState('')
  const [pageDescription, setPageDescription] = useState('')
  const [loading, setLoading] = useState(false)

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: accepted => { if (accepted[0]) setFile(accepted[0]) },
    accept: { 'application/pdf': ['.pdf'], 'image/jpeg': ['.jpg', '.jpeg'], 'image/png': ['.png'] },
    maxSize: 20 * 1024 * 1024,
    maxFiles: 1,
    multiple: false,
    onDropRejected: () => toast.error('Arquivo inválido. Use PDF, JPG ou PNG até 20 MB.'),
  })

  async function handleSubmit(e) {
    e.preventDefault()

    if (!file) {
      toast.error('Selecione um arquivo para enviar.')
      return
    }

    if (correctionType === 'pages' && (!pageStart || !pageDescription)) {
      toast.error('Informe as páginas e a descrição da correção.')
      return
    }

    setLoading(true)
    try {
      // Monta a nota detalhada
      let fullNote = ''
      if (correctionType === 'full') {
        fullNote = 'Documento completo substituído'
      } else {
        fullNote = `Páginas ${pageStart}${pageEnd ? ` a ${pageEnd}` : ''}: ${pageDescription}`
      }
      if (note.trim()) {
        fullNote += ` | Obs: ${note.trim()}`
      }

      // Usa o método resubmit do storage unificado
      await prontuariosService.resubmit(
        prontuario.id,
        file,
        fullNote,
        user.id
      )

      await log('resubmit', `Correção enviada: ${prontuario.record_number} - ${fullNote.substring(0, 80)}`, prontuario.id)

      toast.success('Correção enviada com sucesso!')
      onSuccess?.()
      onClose()
    } catch (err) {
      toast.error(err.message || 'Erro ao enviar correção.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <div>
            <h3>Corrigir Prontuário</h3>
            <span className={styles.modalSub}>
              {prontuario.patient_name} · Nº {prontuario.record_number}
            </span>
          </div>
          <button onClick={onClose} className={styles.modalClose}>
            <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={styles.modalBody}>
            {/* Tipo de correção */}
            <div className={styles.field}>
              <label className={styles.label}>Tipo de correção</label>
              <div className={styles.radioGroup}>
                {CORRECTION_TYPES.map(t => (
                  <label key={t.value} className={`${styles.radioOption} ${correctionType === t.value ? styles.radioActive : ''}`}>
                    <input
                      type="radio"
                      name="correctionType"
                      value={t.value}
                      checked={correctionType === t.value}
                      onChange={e => setCorrectionType(e.target.value)}
                    />
                    <span>{t.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Páginas específicas */}
            {correctionType === 'pages' && (
              <div className={styles.pagesSection}>
                <div className={styles.pagesRow}>
                  <div className={styles.pageField}>
                    <label>Página inicial</label>
                    <input
                      type="number"
                      min="1"
                      max={prontuario.pages || 999}
                      value={pageStart}
                      onChange={e => setPageStart(e.target.value)}
                      placeholder="Ex: 14"
                      className={styles.pageInput}
                    />
                  </div>
                  <div className={styles.pageField}>
                    <label>Página final (opcional)</label>
                    <input
                      type="number"
                      min={pageStart || 1}
                      max={prontuario.pages || 999}
                      value={pageEnd}
                      onChange={e => setPageEnd(e.target.value)}
                      placeholder="Ex: 16"
                      className={styles.pageInput}
                    />
                  </div>
                </div>
                <div className={styles.field}>
                  <label>O que foi corrigido?</label>
                  <textarea
                    rows={2}
                    value={pageDescription}
                    onChange={e => setPageDescription(e.target.value)}
                    placeholder="Ex: CPF corrigido, assinatura adicionada, rasura removida…"
                    className={styles.textarea}
                  />
                </div>
                <div className={styles.infoBox}>
                  <span>💡 O arquivo enviado substituirá apenas as páginas indicadas no documento original.</span>
                </div>
              </div>
            )}

            {/* Dropzone */}
            <div className={styles.field}>
              <label className={styles.label}>
                {correctionType === 'full' ? 'Documento completo corrigido' : 'Arquivo com páginas corrigidas'}
              </label>
              <div
                {...getRootProps()}
                className={`${styles.dropZone} ${isDragActive ? styles.drag : ''} ${file ? styles.hasFile : ''}`}
              >
                <input {...getInputProps()} />
                {!file ? (
                  <>
                    <span className={styles.dropIcon}>📤</span>
                    <p>{isDragActive ? 'Solte o arquivo aqui' : 'Arraste ou clique para selecionar'}</p>
                    <span className={styles.dropHint}>PDF, JPG ou PNG — até 20 MB</span>
                  </>
                ) : (
                  <>
                    <span className={styles.fileIcon}>{file.type === 'application/pdf' ? '📄' : '🖼️'}</span>
                    <p className={styles.fileName}>✓ {file.name}</p>
                    <span className={styles.fileSize}>{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                    <button type="button" className={styles.removeFile} onClick={(e) => { e.stopPropagation(); setFile(null) }}>
                      Remover arquivo
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Nota adicional */}
            <div className={styles.field}>
              <label className={styles.label}>Observação adicional (opcional)</label>
              <textarea
                rows={2}
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Qualquer informação extra sobre esta correção…"
                className={styles.textarea}
              />
            </div>

            {/* Informações do prontuário original */}
            <div className={styles.originalInfo}>
              <div className={styles.originalLabel}>📋 Documento original</div>
              <div className={styles.originalDetails}>
                <span>{prontuario.file_name || 'prontuario.pdf'}</span>
                <span>·</span>
                <span>{prontuario.pages || '?'} páginas</span>
                <span>·</span>
                <span>{(prontuario.file_size / 1024 / 1024).toFixed(2)} MB</span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className={styles.modalFooter}>
            <button type="submit" disabled={loading || !file} className={styles.btnSubmit}>
              {loading ? (
                <><span className="spinner" /> Enviando correção…</>
              ) : (
                <>
                  <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
                  </svg>
                  Enviar correção
                </>
              )}
            </button>
            <button type="button" onClick={onClose} disabled={loading} className={styles.btnCancel}>
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
