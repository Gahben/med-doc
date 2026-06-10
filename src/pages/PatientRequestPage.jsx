import { useState } from 'react'
import { cpfHelpers, patientRequestsService } from '../lib/storage'
import jsPDF from 'jspdf'
import toast from 'react-hot-toast'

export default function PatientRequestPage() {
  const [formData, setFormData] = useState({
    requesterName: '',
    requesterCpf: '',
    requestReason: '',
    hospitalPeriod: '',
    insurance: '',
    contactPhone: '',
    isThirdParty: false,
    thirdPartyName: '',
    thirdPartyCpf: '',
    thirdPartyRelationship: '',
  })

  const [submittedData, setSubmittedData] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [signedFile, setSignedFile] = useState(null)
  const [isUploading, setIsUploading] = useState(false)

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  const handleCpfChange = (e) => {
    const masked = cpfHelpers.mask(e.target.value)
    setFormData(prev => ({ ...prev, requesterCpf: masked }))
  }

  const handleThirdPartyCpfChange = (e) => {
    const masked = cpfHelpers.mask(e.target.value)
    setFormData(prev => ({ ...prev, thirdPartyCpf: masked }))
  }

  const validateForm = () => {
    if (!formData.requesterName.trim()) {
      toast.error('Nome completo é obrigatório')
      return false
    }
    if (!cpfHelpers.isValid(formData.requesterCpf)) {
      toast.error('CPF inválido')
      return false
    }
    if (!formData.requestReason.trim()) {
      toast.error('Motivo da solicitação é obrigatório')
      return false
    }
    if (!formData.hospitalPeriod.trim()) {
      toast.error('Data/período no hospital é obrigatório')
      return false
    }
    if (!formData.contactPhone.trim()) {
      toast.error('Telefone para contato é obrigatório')
      return false
    }
    if (formData.isThirdParty) {
      if (!formData.thirdPartyName.trim()) {
        toast.error('Nome do terceiro solicitante é obrigatório')
        return false
      }
      if (!cpfHelpers.isValid(formData.thirdPartyCpf)) {
        toast.error('CPF do terceiro solicitante é inválido')
        return false
      }
      if (!formData.thirdPartyRelationship.trim()) {
        toast.error('Grau de parentesco/relação é obrigatório')
        return false
      }
    }
    return true
  }

  const generatePDF = (data) => {
    const doc = new jsPDF()
    
    // Título
    doc.setFontSize(20)
    doc.setFont('helvetica', 'bold')
    doc.text('SOLICITAÇÃO DE PRONTUÁRIO MÉDICO', 105, 20, { align: 'center' })
    
    // Linha decorativa
    doc.setDrawColor(0, 0, 0)
    doc.setLineWidth(0.5)
    doc.line(20, 25, 190, 25)
    
    // Informações do solicitante
    doc.setFontSize(12)
    doc.setFont('helvetica', 'normal')
    
    let y = 35
    const lineHeight = 8
    
    doc.setFont('helvetica', 'bold')
    doc.text('DADOS DO SOLICITANTE:', 20, y)
    y += lineHeight
    
    doc.setFont('helvetica', 'normal')
    doc.text(`Nome Completo: ${data.requesterName}`, 20, y)
    y += lineHeight
    doc.text(`CPF: ${cpfHelpers.format(data.requesterCpf)}`, 20, y)
    y += lineHeight
    doc.text(`Telefone: ${data.contactPhone}`, 20, y)
    y += lineHeight + 5
    
    // Informações do terceiro se aplicável
    if (data.isThirdParty) {
      doc.setFont('helvetica', 'bold')
      doc.text('SOLICITAÇÃO POR TERCEIRO:', 20, y)
      y += lineHeight
      
      doc.setFont('helvetica', 'normal')
      doc.text(`Nome: ${data.thirdPartyName}`, 20, y)
      y += lineHeight
      doc.text(`CPF: ${cpfHelpers.format(data.thirdPartyCpf)}`, 20, y)
      y += lineHeight
      doc.text(`Relação: ${data.thirdPartyRelationship}`, 20, y)
      y += lineHeight + 5
    }
    
    // Detalhes da solicitação
    doc.setFont('helvetica', 'bold')
    doc.text('DETALHES DA SOLICITAÇÃO:', 20, y)
    y += lineHeight
    
    doc.setFont('helvetica', 'normal')
    doc.text(`Motivo: ${data.requestReason}`, 20, y)
    y += lineHeight
    doc.text(`Período no Hospital: ${data.hospitalPeriod}`, 20, y)
    y += lineHeight
    if (data.insurance) {
      doc.text(`Convênio: ${data.insurance}`, 20, y)
      y += lineHeight
    }
    y += lineHeight + 5
    
    // Data
    doc.setFont('helvetica', 'bold')
    doc.text(`Data da Solicitação: ${new Date().toLocaleDateString('pt-BR')}`, 20, y)
    y += lineHeight + 10
    
    // Espaço para assinatura do solicitante (manual)
    doc.setFont('helvetica', 'bold')
    doc.text('ASSINATURA DO SOLICITANTE:', 20, y)
    y += 5
    doc.setDrawColor(0, 0, 0)
    doc.line(20, y, 90, y)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text('Assinar manualmente aqui', 20, y + 5)
    y += 15
    
    // Espaço para assinatura gov.br
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('OU ASSINATURA DIGITAL (GOV.BR):', 20, y)
    y += 5
    doc.setDrawColor(0, 0, 0)
    doc.setLineWidth(0.3)
    doc.rect(20, y, 70, 30)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text('Colar assinatura digital gov.br aqui', 25, y + 15)
    y += 35
    
    // Espaço para assinatura de quem recebeu
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('ASSINATURA DE QUEM RECEBEU A SOLICITAÇÃO:', 20, y)
    y += 5
    doc.setDrawColor(0, 0, 0)
    doc.setLineWidth(0.5)
    doc.line(20, y, 90, y)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text('Assinar aqui', 20, y + 5)
    y += 20
    
    // Token de acompanhamento
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text(`TOKEN DE ACOMPANHAMENTO: ${data.token}`, 20, y)
    y += lineHeight
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text('Use este token para acompanhar o status da sua solicitação', 20, y)
    
    return doc
  }

  const handleDownloadPDF = async () => {
    if (!validateForm()) return
    
    setIsSubmitting(true)
    
    try {
      const { data, error } = await patientRequestsService.create({
        requester_name: formData.requesterName.trim(),
        requester_cpf: cpfHelpers.strip(formData.requesterCpf),
        request_reason: formData.requestReason.trim(),
        hospital_period: formData.hospitalPeriod.trim(),
        insurance: formData.insurance.trim() || null,
        contact_phone: formData.contactPhone.trim(),
        is_third_party: formData.isThirdParty,
        third_party_name: formData.isThirdParty ? formData.thirdPartyName.trim() : null,
        third_party_cpf: formData.isThirdParty ? cpfHelpers.strip(formData.thirdPartyCpf) : null,
        third_party_relationship: formData.isThirdParty ? formData.thirdPartyRelationship.trim() : null,
        signature_method: 'manual',
      })
      
      if (error) throw error
      
      // Gera PDF para download
      const doc = generatePDF({
        ...formData,
        token: data.token,
      })
      
      doc.save(`solicitacao_prontuario_${data.token}.pdf`)
      
      setSubmittedData(data)
      toast.success('PDF baixado! Assine e envie abaixo.')
    } catch (error) {
      console.error('Erro ao criar solicitação:', error)
      toast.error('Erro ao gerar PDF. Tente novamente.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (file && file.type === 'application/pdf') {
      setSignedFile(file)
    } else {
      toast.error('Por favor, selecione um arquivo PDF.')
    }
  }

  const handleUploadSignedPDF = async () => {
    if (!signedFile) {
      toast.error('Por favor, selecione o PDF assinado.')
      return
    }
    
    if (!submittedData) {
      toast.error('Primeiro baixe o PDF para assinar.')
      return
    }

    setIsUploading(true)
    
    try {
      const { storageService } = await import('../lib/storage')
      const ext = signedFile.name.split('.').pop()
      const path = `patient_requests/${submittedData.token}_signed.${ext}`
      
      await storageService.upload(signedFile, path)
      await patientRequestsService.updateSignatureFile(submittedData.token, path)
      
      toast.success('Solicitação enviada com sucesso!')
      setSignedFile(null)
    } catch (error) {
      console.error('Erro ao fazer upload:', error)
      toast.error('Erro ao enviar PDF assinado. Tente novamente.')
    } finally {
      setIsUploading(false)
    }
  }

  if (submittedData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
          <div className="text-center mb-6">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            
            <h2 className="text-2xl font-bold text-gray-800 mb-2">PDF Gerado!</h2>
            <p className="text-gray-600">Baixe, assine e envie o PDF abaixo</p>
          </div>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-600 mb-2">Seu token de acompanhamento:</p>
            <p className="text-3xl font-bold text-blue-600 tracking-wider text-center">{submittedData.token}</p>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Enviar PDF Assinado *
              </label>
              <input
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              {signedFile && (
                <p className="text-sm text-green-600 mt-2">Arquivo selecionado: {signedFile.name}</p>
              )}
            </div>
            
            <button
              onClick={handleUploadSignedPDF}
              disabled={isUploading || !signedFile}
              className="w-full bg-indigo-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUploading ? 'Enviando...' : 'Enviar Solicitação'}
            </button>
            
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-gray-200 text-gray-700 py-3 px-6 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
            >
              Nova Solicitação
            </button>
          </div>
          
          <p className="text-center text-gray-500 text-xs mt-6">
            Use o token para acompanhar o status em /acompanhamento
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
          <div className="text-center">
            <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Solicitação de Prontuário</h1>
            <p className="text-gray-600">Preencha o formulário abaixo para solicitar seu prontuário médico</p>
          </div>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <form className="space-y-6">
            {/* Section: Dados Pessoais */}
            <div className="border-b border-gray-200 pb-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                <svg className="w-5 h-5 mr-2 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Dados do Solicitante
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Nome completo */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nome Completo *
                  </label>
                  <input
                    type="text"
                    name="requesterName"
                    value={formData.requesterName}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                    placeholder="Digite seu nome completo"
                    required
                  />
                </div>

                {/* CPF */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    CPF *
                  </label>
                  <input
                    type="text"
                    name="requesterCpf"
                    value={formData.requesterCpf}
                    onChange={handleCpfChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                    placeholder="000.000.000-00"
                    maxLength={14}
                    required
                  />
                </div>

                {/* Telefone */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Telefone para Contato *
                  </label>
                  <input
                    type="tel"
                    name="contactPhone"
                    value={formData.contactPhone}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                    placeholder="(00) 00000-0000"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Section: Detalhes da Solicitação */}
            <div className="border-b border-gray-200 pb-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                <svg className="w-5 h-5 mr-2 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                Detalhes da Solicitação
              </h2>

              <div className="space-y-4">
                {/* Motivo da solicitação */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Motivo da Solicitação *
                  </label>
                  <textarea
                    name="requestReason"
                    value={formData.requestReason}
                    onChange={handleInputChange}
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all resize-none"
                    placeholder="Descreva o motivo da solicitação do prontuário"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Data/período no hospital */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Período no Hospital *
                    </label>
                    <input
                      type="text"
                      name="hospitalPeriod"
                      value={formData.hospitalPeriod}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                      placeholder="Ex: Janeiro/2024"
                      required
                    />
                  </div>

                  {/* Convênio */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Convênio
                    </label>
                    <input
                      type="text"
                      name="insurance"
                      value={formData.insurance}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                      placeholder="Nome do convênio (opcional)"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Section: Terceiro */}
            <div className="bg-indigo-50 rounded-xl p-6">
              <label className="flex items-start space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="isThirdParty"
                  checked={formData.isThirdParty}
                  onChange={handleInputChange}
                  className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500 mt-0.5"
                />
                <div>
                  <span className="text-sm font-semibold text-gray-800">
                    Solicitação feita por terceiro
                  </span>
                  <p className="text-xs text-gray-600 mt-1">
                    Marque se um acompanhante ou outra pessoa está fazendo a solicitação em seu nome
                  </p>
                </div>
              </label>

              {formData.isThirdParty && (
                <div className="mt-6 space-y-4 pl-4 border-l-2 border-indigo-300">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Nome do Terceiro Solicitante *
                      </label>
                      <input
                        type="text"
                        name="thirdPartyName"
                        value={formData.thirdPartyName}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all bg-white"
                        placeholder="Nome completo"
                        required={formData.isThirdParty}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        CPF do Terceiro *
                      </label>
                      <input
                        type="text"
                        name="thirdPartyCpf"
                        value={formData.thirdPartyCpf}
                        onChange={handleThirdPartyCpfChange}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all bg-white"
                        placeholder="000.000.000-00"
                        maxLength={14}
                        required={formData.isThirdParty}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Relação *
                      </label>
                      <input
                        type="text"
                        name="thirdPartyRelationship"
                        value={formData.thirdPartyRelationship}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all bg-white"
                        placeholder="Ex: Esposo(a), Filho(a)"
                        required={formData.isThirdParty}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Botão de baixar PDF */}
            <div className="pt-4">
              <button
                type="button"
                onClick={handleDownloadPDF}
                disabled={isSubmitting}
                className="w-full flex items-center justify-center space-x-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-4 px-6 rounded-xl font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shadow-lg"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>{isSubmitting ? 'Gerando PDF...' : 'Baixar PDF para Assinar'}</span>
              </button>

              <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-800 flex items-start">
                  <svg className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>
                    O PDF conterá espaço para assinatura manual ou digital (gov.br). 
                    Após assinar, você poderá enviar o arquivo na próxima tela.
                  </span>
                </p>
              </div>
            </div>
          </form>
        </div>

        {/* Footer Info */}
        <div className="mt-6 text-center">
          <p className="text-gray-600 text-sm">
            Após o envio, você receberá um token para acompanhar o status via WhatsApp
          </p>
          <p className="text-gray-500 text-xs mt-2">
            Acompanhe sua solicitação em <span className="font-medium text-indigo-600">/acompanhamento</span>
          </p>
        </div>
      </div>
    </div>
  )
}
