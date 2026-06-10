'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Upload, Check, Info, X } from 'lucide-react'
import { validateCPF, formatFileSize, fileToHash } from '@/lib/utils'
import toast from 'react-hot-toast'
import Link from 'next/link'

const documentTypes = [
  'Prontuário médico',
  'Exame laboratorial',
  'Laudo de imagem',
  'Receituário',
  'Declaração / atestado',
  'Outro',
]

const originSectors = [
  'Recepção',
  'Arquivo Médico',
  'Consultório',
  'Exames',
  'Outro',
]

export default function UploadPage() {
  const { data: session } = useSession()
  const [isDragging, setIsDragging] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [nextCode, setNextCode] = useState('')

  const [formData, setFormData] = useState({
    patient_name: '',
    cpf: '',
    prontuario_code: '',
    document_date: new Date().toISOString().split('T')[0],
    type: documentTypes[0],
    origin_sector: originSectors[0],
    observation: '',
    never_delete: false,
  })

  // Fetch next system code
  const fetchNextCode = useCallback(async () => {
    try {
      const response = await fetch('/api/documents/next-code')
      const data = await response.json()
      if (response.ok) {
        setNextCode(data.code)
      }
    } catch (error) {
      console.error('Error fetching next code:', error)
    }
  }, [])

  useEffect(() => {
    fetchNextCode()
  }, [fetchNextCode])

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) {
      validateAndSetFile(droppedFile)
    }
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      validateAndSetFile(selectedFile)
    }
  }

  const validateAndSetFile = (file: File) => {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png']
    const MAX_SIZE = 20 * 1024 * 1024 // 20MB

    if (!allowedTypes.includes(file.type)) {
      toast.error('Tipo de arquivo não permitido. Use PDF, JPG ou PNG.')
      return
    }

    if (file.size > MAX_SIZE) {
      toast.error('Arquivo muito grande. Máximo 20MB.')
      return
    }

    setFile(file)
  }

  const handleSubmit = async () => {
    // Validation
    if (!file) {
      toast.error('Selecione um arquivo')
      return
    }

    if (!formData.patient_name.trim()) {
      toast.error('Nome do paciente é obrigatório')
      return
    }

    if (!formData.cpf.trim()) {
      toast.error('CPF é obrigatório')
      return
    }

    if (!validateCPF(formData.cpf)) {
      toast.error('CPF inválido')
      return
    }

    if (!formData.prontuario_code.trim()) {
      toast.error('Número do prontuário é obrigatório')
      return
    }

    setIsUploading(true)

    try {
      // 1. Upload file to storage
      const uploadFormData = new FormData()
      uploadFormData.append('file', file)

      const uploadResponse = await fetch('/api/documents/upload', {
        method: 'POST',
        body: uploadFormData,
      })

      if (!uploadResponse.ok) {
        const error = await uploadResponse.json()
        throw new Error(error.error || 'Erro ao fazer upload do arquivo')
      }

      const uploadData = await uploadResponse.json()

      // 2. Calculate file hash
      const fileHash = await fileToHash(file)

      // 3. Create document record
      const documentResponse = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_name: formData.patient_name,
          cpf: formData.cpf.replace(/\D/g, ''),
          prontuario_code: formData.prontuario_code,
          system_code: nextCode,
          document_date: formData.document_date,
          type: formData.type,
          origin_sector: formData.origin_sector,
          file_url: uploadData.url,
          file_size: file.size,
          file_hash: fileHash,
          never_delete: formData.never_delete,
        }),
      })

      if (!documentResponse.ok) {
        const error = await documentResponse.json()
        throw new Error(error.error || 'Erro ao criar documento')
      }

      setIsSuccess(true)
      toast.success('Documento enviado com sucesso!')
    } catch (error: any) {
      toast.error(error.message || 'Erro ao enviar documento')
    } finally {
      setIsUploading(false)
    }
  }

  const resetForm = () => {
    setFile(null)
    setIsSuccess(false)
    setFormData({
      patient_name: '',
      cpf: '',
      prontuario_code: '',
      document_date: new Date().toISOString().split('T')[0],
      type: documentTypes[0],
      origin_sector: originSectors[0],
      observation: '',
      never_delete: false,
    })
    fetchNextCode()
  }

  if (isSuccess) {
    return (
      <div className="text-center py-16">
        <div className="w-14 h-14 bg-accent-light rounded-full flex items-center justify-center mx-auto mb-4">
          <Check className="w-7 h-7 text-accent" />
        </div>
        <h3 className="text-lg font-semibold mb-1.5">Enviado para revisão!</h3>
        <p className="text-sm text-text-2 mb-5">
          O prontuário foi indexado e está aguardando aprovação de um Revisor.
        </p>
        <button
          onClick={resetForm}
          className="bg-accent text-white rounded-lg px-4 py-2.5 text-sm font-medium flex items-center gap-2 mx-auto hover:opacity-88 transition-opacity"
        >
          <Upload className="w-4 h-4" />
          Novo upload
        </button>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-7">
        <h1 className="text-[22px] font-semibold tracking-tight">Novo upload</h1>
        <p className="text-sm text-text-2 mt-1">Preencha os dados e anexe o arquivo escaneado</p>
      </div>

      {/* Info Box */}
      <div className="bg-info-light rounded-lg p-3 mb-5 text-sm text-info flex items-start gap-2.5">
        <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <p>
          Após o upload, o prontuário ficará com status <strong>Aguardando revisão</strong> até que um Revisor o aprove. 
          Somente após aprovação ele estará disponível para download e impressão.
        </p>
      </div>

      {/* Upload Zone */}
      <div className="bg-surface border border-border rounded-lg p-6 mb-4">
        <div
          onClick={() => document.getElementById('file-input')?.click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            border-2 border-dashed rounded-lg py-10 px-6 text-center cursor-pointer transition-all
            ${isDragging ? 'border-accent bg-accent-light' : 'border-border hover:border-accent hover:bg-accent-light'}
            ${file ? 'border-accent bg-accent-light' : ''}
          `}
        >
          <Upload className={`w-9 h-9 mx-auto mb-2.5 ${file ? 'text-accent' : 'text-text-3'}`} />
          <p className={`text-sm ${file ? 'text-accent font-medium' : 'text-text-2'}`}>
            {file ? file.name : 'Arraste o arquivo ou clique para selecionar'}
          </p>
          <span className="text-xs text-text-3 mt-1 block">
            PDF, JPG ou PNG — até 20 MB
          </span>
          {file && (
            <span className="text-xs text-text-2 mt-1 block">
              {formatFileSize(file.size)}
            </span>
          )}
        </div>
        <input
          id="file-input"
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={handleFileInput}
          className="hidden"
        />
      </div>

      {/* Form */}
      <div className="bg-surface border border-border rounded-lg p-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[13px] font-medium mb-1.5 text-text-2">
                Nome completo do paciente <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                value={formData.patient_name}
                onChange={(e) => setFormData({ ...formData, patient_name: e.target.value })}
                placeholder="Ex.: João da Silva"
                className="w-full border border-border rounded-lg px-3.5 py-2.5 text-sm bg-surface focus:border-accent transition-colors"
              />
            </div>
            <div>
              <label className="block text-[13px] font-medium mb-1.5 text-text-2">
                CPF <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                value={formData.cpf}
                onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                placeholder="000.000.000-00"
                className="w-full border border-border rounded-lg px-3.5 py-2.5 text-sm bg-surface focus:border-accent transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-[13px] font-medium mb-1.5 text-text-2">
              Número do prontuário <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              value={formData.prontuario_code}
              onChange={(e) => setFormData({ ...formData, prontuario_code: e.target.value })}
              placeholder="Ex.: 2024-00891"
              className="w-full border border-border rounded-lg px-3.5 py-2.5 text-sm bg-surface focus:border-accent transition-colors"
            />
          </div>

          <div>
            <label className="block text-[13px] font-medium mb-1.5 text-text-2">
              Código do sistema
            </label>
            <input
              type="text"
              value={nextCode}
              disabled
              className="w-full border border-border rounded-lg px-3.5 py-2.5 text-sm bg-surface-2 text-text-2 cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-[13px] font-medium mb-1.5 text-text-2">
              Data do documento
            </label>
            <input
              type="date"
              value={formData.document_date}
              onChange={(e) => setFormData({ ...formData, document_date: e.target.value })}
              className="w-full border border-border rounded-lg px-3.5 py-2.5 text-sm bg-surface focus:border-accent transition-colors"
            />
          </div>

          <div className="col-span-2">
            <label className="block text-[13px] font-medium mb-1.5 text-text-2">
              Tipo de documento
            </label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              className="w-full border border-border rounded-lg px-3.5 py-2.5 text-sm bg-surface focus:border-accent transition-colors appearance-none cursor-pointer"
            >
              {documentTypes.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          <div className="col-span-2">
            <label className="block text-[13px] font-medium mb-1.5 text-text-2">
              Setor de origem
            </label>
            <select
              value={formData.origin_sector}
              onChange={(e) => setFormData({ ...formData, origin_sector: e.target.value })}
              className="w-full border border-border rounded-lg px-3.5 py-2.5 text-sm bg-surface focus:border-accent transition-colors appearance-none cursor-pointer"
            >
              {originSectors.map((sector) => (
                <option key={sector} value={sector}>{sector}</option>
              ))}
            </select>
          </div>

          <div className="col-span-2">
            <label className="block text-[13px] font-medium mb-1.5 text-text-2">
              Observação de upload (opcional)
            </label>
            <textarea
              value={formData.observation}
              onChange={(e) => setFormData({ ...formData, observation: e.target.value })}
              placeholder="Alguma nota para o revisor sobre este documento..."
              rows={3}
              className="w-full border border-border rounded-lg px-3.5 py-2.5 text-sm bg-surface focus:border-accent transition-colors resize-y min-h-[70px]"
            />
          </div>
        </div>

        {/* Toggle */}
        <div className="flex items-center justify-between py-3.5 border-t border-border mt-4">
          <div>
            <label className="text-sm font-medium">Não excluir automaticamente</label>
            <small className="text-xs text-text-2 block mt-0.5">
              Este arquivo não será movido para lixeira nem apagado pelos ciclos automáticos
            </small>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={formData.never_delete}
              onChange={(e) => setFormData({ ...formData, never_delete: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-[38px] h-[22px] bg-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-4 peer-checked:after:border-white after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent"></div>
          </label>
        </div>

        {/* Actions */}
        <div className="flex gap-2.5 mt-5">
          <button
            onClick={handleSubmit}
            disabled={isUploading}
            className="bg-accent text-white rounded-lg px-4 py-2.5 text-sm font-medium flex items-center gap-2 hover:opacity-88 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Upload className="w-4 h-4" />
            {isUploading ? 'Enviando...' : 'Enviar para revisão'}
          </button>
          <Link
            href="/dashboard/busca"
            className="bg-surface border border-border rounded-lg px-4 py-2.5 text-sm font-medium text-text hover:bg-surface-2 transition-colors"
          >
            Cancelar
          </Link>
        </div>
      </div>
    </div>
  )
}
