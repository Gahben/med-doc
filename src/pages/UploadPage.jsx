import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { prontuariosService, cpfHelpers } from '../lib/storage'
import { useAuth } from '../hooks/useAuth'
import { useAuditLog } from '../hooks/useAuditLog'
import toast from 'react-hot-toast'
import { PageHeader, BtnAccent, BtnSec, Field, Input, Select, Textarea } from '../components/UI'
import styles from './UploadPage.module.css'

const DOC_TYPES = [
  'Prontuário médico',
  'Sumário de alta',
  'Boletim de atendimento de urgência (BAU)',
  'Exame laboratorial',
  'Laudo de imagem (raio-x, tomografia, ressonância)',
  'Laudo anatomopatológico',
  'Receituário',
  'Prescrição médica',
  'Declaração / atestado médico',
  'Termo de consentimento',
  'Relatório cirúrgico',
  'Relatório de enfermagem',
  'Histórico de vacinação',
  'Outro',
]

const COMMON_SECTORS = [
  '',
  'Clínica Médica',
  'Clínica Cirúrgica',
  'Pronto-Socorro',
  'UTI Adulto',
  'UTI Neonatal',
  'Centro Cirúrgico',
  'Maternidade',
  'Pediatria',
  'Oncologia',
  'Ortopedia',
  'Cardiologia',
  'Neurologia',
  'Psiquiatria',
  'Endoscopia / Gastroenterologia',
  'Fisioterapia / Reabilitação',
  'Laboratório',
  'Radiologia / Imagem',
  'Farmácia',
  'Ambulatório',
  'Outro',
]

const INITIAL = {
  patient_name:    '',
  patient_cpf:     '',
  record_number:   '',
  document_type:   'Prontuário médico',
  document_date:   new Date().toISOString().split('T')[0],
  origin_sector:   '',
  upload_note:     '',
  locked:          false,
}

export default function UploadPage() {
  const { user } = useAuth()
  const log = useAuditLog()

  const [form,          setForm]          = useState(INITIAL)
  const [file,          setFile]          = useState(null)
  const [loading,       setLoading]       = useState(false)
  const [success,       setSuccess]       = useState(false)
  const [cpfError,      setCpfError]      = useState('')
  const [customSector,  setCustomSector]  = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

  const onDrop = useCallback(accepted => {
    if (accepted[0]) {
      // Validação de tipo - aceita PDF, JPG e PNG
      const validTypes = ['application/pdf', 'image/jpeg', 'image/png']
      if (!validTypes.includes(accepted[0].type)) {
        toast.error('Apenas arquivos PDF, JPG ou PNG são permitidos.')
        return
      }
      setFile(accepted[0])
      setUploadProgress(0)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png']
    },
    maxSize: 20 * 1024 * 1024,
    maxFiles: 1,
    multiple: false,
    onDropRejected: (rejections) => {
      const error = rejections[0]?.errors[0]
      if (error?.code === 'file-too-large') {
        toast.error('Arquivo muito grande. Máximo permitido: 20 MB.')
      } else if (error?.code === 'file-invalid-type') {
        toast.error('Formato inválido. Use PDF, JPG ou PNG.')
      } else {
        toast.error('Arquivo inválido. Verifique o formato e tamanho.')
      }
    },
  })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  function handleCpfChange(raw) {
    const masked = cpfHelpers.mask(raw)
    set('patient_cpf', masked)
    const stripped = cpfHelpers.strip(masked)
    if (stripped.length === 11) {
      setCpfError(cpfHelpers.isValid(masked) ? '' : 'CPF inválido')
    } else {
      setCpfError('')
    }
  }

  function handleSectorChange(value) {
    if (value === 'Outro') {
      setCustomSector(true)
      set('origin_sector', '')
    } else {
      setCustomSector(false)
      set('origin_sector', value)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()

    if (!form.patient_name || !form.patient_cpf || !form.record_number) {
      toast.error('Preencha todos os campos obrigatórios: nome, CPF e número do prontuário.')
      return
    }

    if (!cpfHelpers.isValid(form.patient_cpf)) {
      setCpfError('CPF inválido')
      toast.error('CPF inválido. Verifique o número digitado.')
      return
    }

    if (!file) {
      toast.error('Selecione um arquivo para enviar.')
      return
    }

    setLoading(true)
    setUploadProgress(10)

    try {
      // Usa o método createWithVersion do storage unificado
      // que já faz: hash, verificação de duplicata, upload e versionamento
      const prontuario = await prontuariosService.createWithVersion(file, {
        patient_name: form.patient_name,
        patient_cpf: cpfHelpers.format(form.patient_cpf),
        record_number: form.record_number,
        document_type: form.document_type,
        document_date: form.document_date,
        origin_sector: form.origin_sector,
        upload_note: form.upload_note,
        locked: form.locked,
        uploaded_by: user.id,
      })

      setUploadProgress(100)

      // Log de auditoria
      await log('upload', `Enviou prontuário ${form.record_number} de ${form.patient_name}`, prontuario.id)

      toast.success('Prontuário enviado para revisão!')
      setSuccess(true)
    } catch (err) {
      if (err?.message?.includes('duplicado') || err?.message?.includes('Documento duplicado')) {
        toast.error(err.message, { duration: 6000 })
      } else if (err?.message?.includes('unique') || err?.message?.includes('duplicate key')) {
        toast.error('Número de prontuário já cadastrado no sistema.')
      } else {
        toast.error('Erro ao enviar. Tente novamente.')
        console.error('Upload error:', err)
      }
      setUploadProgress(0)
    } finally {
      setLoading(false)
    }
  }

  function reset() {
    setForm(INITIAL)
    setFile(null)
    setSuccess(false)
    setCpfError('')
    setCustomSector(false)
    setUploadProgress(0)
  }

  if (success) {
    return (
      <div>
        <PageHeader title="Upload de Prontuário" />
        <div className={styles.successCard}>
          <div className={styles.checkCircle}>
            <svg fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path d="M20 6L9 17l-5-5"/>
            </svg>
          </div>
          <h3>Enviado para revisão!</h3>
          <p>O prontuário <strong>{form.record_number}</strong> de <strong>{form.patient_name}</strong> foi indexado e está aguardando aprovação de um Auditor.</p>
          <BtnAccent onClick={reset}>
            <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
            </svg>
            Novo upload
          </BtnAccent>
        </div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="Upload de Prontuário" subtitle="Envie um documento para a fila de revisão" />

      <form onSubmit={handleSubmit}>
        <div className={styles.grid}>
          {/* Drop zone melhorada */}
          <div
            {...getRootProps()}
            className={`${styles.dropZone} ${isDragActive ? styles.drag : ''} ${file ? styles.hasFile : ''}`}
          >
            <input {...getInputProps()} />
            
            {!file ? (
              <>
                <div className={styles.uploadIcon}>
                  {isDragActive ? '📂' : '📤'}
                </div>
                <p className={styles.uploadTitle}>
                  {isDragActive ? 'Solte o arquivo aqui' : 'Arraste o arquivo ou clique para selecionar'}
                </p>
                <span className={styles.uploadHint}>
                  PDF, JPG ou PNG — até 20 MB
                </span>
              </>
            ) : (
              <>
                <div className={styles.fileIcon}>
                  {file.type === 'application/pdf' ? '📄' : '🖼️'}
                </div>
                <p className={styles.fileName}>✓ {file.name}</p>
                <span className={styles.fileSize}>
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </span>
                <button
                  type="button"
                  className={styles.removeFile}
                  onClick={(e) => {
                    e.stopPropagation()
                    setFile(null)
                  }}
                >
                  Remover arquivo
                </button>
              </>
            )}

            {loading && (
              <div className={styles.progressBar}>
                <div 
                  className={styles.progressFill} 
                  style={{ width: `${uploadProgress}%` }}
                />
                <span className={styles.progressText}>
                  {uploadProgress < 30 && 'Calculando hash...'}
                  {uploadProgress >= 30 && uploadProgress < 60 && 'Enviando arquivo...'}
                  {uploadProgress >= 60 && uploadProgress < 90 && 'Registrando no banco...'}
                  {uploadProgress >= 90 && 'Finalizando...'}
                </span>
              </div>
            )}
          </div>

          {/* Fields card */}
          <div className={styles.fieldsCard}>
            <div className={styles.fieldsGrid}>
              <Field label="Nome completo do paciente" required>
                <Input
                  placeholder="Ex.: João da Silva"
                  value={form.patient_name}
                  onChange={e => set('patient_name', e.target.value)}
                  disabled={loading}
                />
              </Field>

              <Field label="CPF" required>
                <Input
                  placeholder="000.000.000-00"
                  value={form.patient_cpf}
                  onChange={e => handleCpfChange(e.target.value)}
                  maxLength={14}
                  className={cpfError ? styles.inputError : ''}
                  style={{ 
                    fontFamily: "'SF Mono', 'Fira Code', monospace",
                    letterSpacing: '1.2px',
                    fontSize: '15px' 
                  }}
                  inputMode="numeric"
                />
                {cpfError && <span className={styles.fieldError}>{cpfError}</span>}
              </Field>

              <Field label="Número do prontuário" required>
                <Input
                  placeholder="Ex.: 2024-00891"
                  value={form.record_number}
                  onChange={e => set('record_number', e.target.value)}
                  disabled={loading}
                />
              </Field>

              <Field label="Data do documento">
                <Input
                  type="date"
                  value={form.document_date}
                  onChange={e => set('document_date', e.target.value)}
                  disabled={loading}
                />
              </Field>

              <div className={styles.fullCol}>
                <Field label="Tipo de documento">
                  <Select
                    value={form.document_type}
                    onChange={e => set('document_type', e.target.value)}
                    disabled={loading}
                  >
                    {DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </Select>
                </Field>
              </div>

              <div className={styles.fullCol}>
                <Field label="Setor de origem">
                  {customSector ? (
                    <div className={styles.customSectorRow}>
                      <Input
                        placeholder="Digite o nome do setor…"
                        value={form.origin_sector}
                        onChange={e => set('origin_sector', e.target.value)}
                        disabled={loading}
                      />
                      <button
                        type="button"
                        className={styles.btnClearSector}
                        onClick={() => { setCustomSector(false); set('origin_sector', '') }}
                        title="Voltar para lista"
                        disabled={loading}
                      >✕</button>
                    </div>
                  ) : (
                    <Select
                      value={form.origin_sector}
                      onChange={e => handleSectorChange(e.target.value)}
                      disabled={loading}
                    >
                      <option value="">Selecione o setor…</option>
                      {COMMON_SECTORS.filter(Boolean).map(s => <option key={s} value={s}>{s}</option>)}
                    </Select>
                  )}
                </Field>
              </div>

              <div className={styles.fullCol}>
                <Field label="Observação de upload (opcional)">
                  <Textarea
                    placeholder="Alguma nota para o revisor sobre este documento…"
                    value={form.upload_note}
                    onChange={e => set('upload_note', e.target.value)}
                    disabled={loading}
                  />
                </Field>
              </div>
            </div>

            <div className={styles.toggleRow}>
              <div>
                <label>Proteger contra exclusão automática</label>
                <small>Este arquivo não será movido para lixeira nem apagado pelos ciclos automáticos</small>
              </div>
              <label className={styles.toggle}>
                <input
                  type="checkbox"
                  checked={form.locked}
                  onChange={e => set('locked', e.target.checked)}
                  disabled={loading}
                />
                <span className={styles.toggleSlider} />
              </label>
            </div>

            <div className={styles.formActions}>
              <BtnAccent type="submit" disabled={loading || !!cpfError || !file}>
                {loading ? (
                  <>
                    <span className="spinner" />
                    {uploadProgress < 30 && 'Verificando...'}
                    {uploadProgress >= 30 && uploadProgress < 60 && 'Enviando...'}
                    {uploadProgress >= 60 && 'Registrando...'}
                  </>
                ) : (
                  <>
                    <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
                    </svg>
                    Enviar para revisão
                  </>
                )}
              </BtnAccent>
              <BtnSec type="button" onClick={reset} disabled={loading}>
                Limpar
              </BtnSec>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}