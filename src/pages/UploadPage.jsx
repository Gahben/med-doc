import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { prontuariosService, storageService, hashFile, checkDuplicateHash, cpfHelpers } from '../lib/storage'
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

// Setores hospitalares comuns — o operador também pode digitar livremente
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

  const [form,        setForm]        = useState(INITIAL)
  const [file,        setFile]        = useState(null)
  const [loading,     setLoading]     = useState(false)
  const [success,     setSuccess]     = useState(false)
  const [cpfError,    setCpfError]    = useState('')
  const [customSector, setCustomSector] = useState(false)

  const onDrop = useCallback(accepted => {
    if (accepted[0]) setFile(accepted[0])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': [], 'image/jpeg': [], 'image/png': [] },
    maxSize: 20 * 1024 * 1024,
    multiple: false,
    onDropRejected: () => toast.error('Arquivo inválido. Use PDF, JPG ou PNG até 20 MB.'),
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
      toast.error('Preencha todos os campos obrigatórios.')
      return
    }

    // Valida CPF
    if (!cpfHelpers.isValid(form.patient_cpf)) {
      setCpfError('CPF inválido')
      toast.error('CPF inválido. Verifique o número.')
      return
    }

    if (!file) {
      toast.error('Selecione um arquivo para enviar.')
      return
    }

    setLoading(true)
    try {
      // 1. Calcula hash e verifica duplicata
      const fileHash = await hashFile(file)
      const duplicate = await checkDuplicateHash(fileHash)
      if (duplicate) {
        toast.error(
          `Arquivo duplicado! Este documento já foi enviado como prontuário ${duplicate.record_number} (${duplicate.patient_name}).`,
          { duration: 6000 }
        )
        setLoading(false)
        return
      }

      // 2. Upload do arquivo para o Storage
      const ext = file.name.split('.').pop()
      const path = `${user.id}/${Date.now()}_${form.record_number}.${ext}`
      await storageService.upload(file, path)

      // 3. Inserir registro no banco
      const { data, error } = await prontuariosService.create({
        ...form,
        patient_cpf:  cpfHelpers.format(form.patient_cpf),
        file_path:    path,
        file_name:    file.name,
        file_size:    file.size,
        file_hash:    fileHash,
        status:       'pending',
        uploaded_by:  user.id,
      })
      if (error) throw error

      // 4. Log de auditoria
      await log('upload', `Enviou prontuário ${form.record_number} de ${form.patient_name}`, data.id)

      toast.success('Prontuário enviado para revisão!')
      setSuccess(true)
    } catch (err) {
      if (err?.message?.includes('unique')) {
        toast.error('Número de prontuário já cadastrado.')
      } else {
        toast.error('Erro ao enviar. Tente novamente.')
        console.error(err)
      }
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
          <p>O prontuário foi indexado e está aguardando aprovação de um Auditor.</p>
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
          {/* Drop zone */}
          <div
            {...getRootProps()}
            className={`${styles.dropZone} ${isDragActive ? styles.drag : ''} ${file ? styles.hasFile : ''}`}
          >
            <input {...getInputProps()} />
            <svg fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
            </svg>
            <p>{file ? `✓ ${file.name}` : 'Arraste o arquivo ou clique para selecionar'}</p>
            <span>
              {file
                ? `${(file.size / 1024 / 1024).toFixed(2)} MB`
                : 'PDF, JPG ou PNG — até 20 MB'}
            </span>
          </div>

          {/* Fields card */}
          <div className={styles.fieldsCard}>
            <div className={styles.fieldsGrid}>
              <Field label="Nome completo do paciente" required>
                <Input
                  placeholder="Ex.: João da Silva"
                  value={form.patient_name}
                  onChange={e => set('patient_name', e.target.value)}
                />
              </Field>

              <Field label="CPF" required error={cpfError}>
                <Input
                  placeholder="000.000.000-00"
                  value={form.patient_cpf}
                  onChange={e => handleCpfChange(e.target.value)}
                  maxLength={14}
                  className={cpfError ? styles.inputError : ''}
                />
                {cpfError && <span className={styles.fieldError}>{cpfError}</span>}
              </Field>

              <Field label="Número do prontuário" required>
                <Input
                  placeholder="Ex.: 2024-00891"
                  value={form.record_number}
                  onChange={e => set('record_number', e.target.value)}
                />
              </Field>

              <Field label="Data do documento">
                <Input
                  type="date"
                  value={form.document_date}
                  onChange={e => set('document_date', e.target.value)}
                />
              </Field>

              <div className={styles.fullCol}>
                <Field label="Tipo de documento">
                  <Select
                    value={form.document_type}
                    onChange={e => set('document_type', e.target.value)}
                  >
                    {DOC_TYPES.map(t => <option key={t}>{t}</option>)}
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
                      />
                      <button
                        type="button"
                        className={styles.btnClearSector}
                        onClick={() => { setCustomSector(false); set('origin_sector', '') }}
                        title="Voltar para lista"
                      >✕</button>
                    </div>
                  ) : (
                    <Select
                      value={form.origin_sector}
                      onChange={e => handleSectorChange(e.target.value)}
                    >
                      <option value="">Selecione o setor…</option>
                      {COMMON_SECTORS.filter(Boolean).map(s => <option key={s}>{s}</option>)}
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
                  />
                </Field>
              </div>
            </div>

            <div className={styles.toggleRow}>
              <div>
                <label>Não excluir automaticamente</label>
                <small>Este arquivo não será movido para lixeira nem apagado pelos ciclos automáticos</small>
              </div>
              <label className={styles.toggle}>
                <input
                  type="checkbox"
                  checked={form.locked}
                  onChange={e => set('locked', e.target.checked)}
                />
                <span className={styles.toggleSlider} />
              </label>
            </div>

            <div className={styles.formActions}>
              <BtnAccent type="submit" disabled={loading || !!cpfError}>
                {loading ? <span className="spinner" /> : (
                  <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
                  </svg>
                )}
                {loading ? 'Enviando…' : 'Enviar para revisão'}
              </BtnAccent>
              <BtnSec type="button" onClick={reset} disabled={loading}>Limpar</BtnSec>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
