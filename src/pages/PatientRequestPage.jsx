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

  const [signatureMethod, setSignatureMethod] = useState(null)
  const [submittedData, setSubmittedData] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

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
    
    // Espaço para assinatura do solicitante
    doc.setFont('helvetica', 'bold')
    doc.text('ASSINATURA DO SOLICITANTE:', 20, y)
    y += 5
    doc.setDrawColor(0, 0, 0)
    doc.line(20, y, 90, y)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text('Assinar aqui', 20, y + 5)
    y += 20
    
    // Espaço para assinatura de quem recebeu
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('ASSINATURA DE QUEM RECEBEU A SOLICITAÇÃO:', 20, y)
    y += 5
    doc.setDrawColor(0, 0, 0)
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

  const handleManualSignature = async () => {
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
      toast.success('Solicitação enviada com sucesso!')
    } catch (error) {
      console.error('Erro ao criar solicitação:', error)
      toast.error('Erro ao enviar solicitação. Tente novamente.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleGovBrSignature = () => {
    if (!validateForm()) return
    
    // Redireciona para gov.br (simulação - implementação real depende da API gov.br)
    toast.info('Redirecionando para assinatura gov.br...')
    // Aqui seria implementada a integração real com gov.br
    // Por enquanto, usa o fluxo manual
    handleManualSignature()
  }

  if (submittedData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Solicitação Enviada!</h2>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-600 mb-2">Seu token de acompanhamento:</p>
            <p className="text-3xl font-bold text-blue-600 tracking-wider">{submittedData.token}</p>
          </div>
          
          <p className="text-gray-600 mb-6">
            Salve este token para acompanhar o status da sua solicitação. 
            Você também receberá este token via WhatsApp em breve.
          </p>
          
          <button
            onClick={() => window.location.reload()}
            className="w-full bg-indigo-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-indigo-700 transition-colors"
          >
            Nova Solicitação
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Solicitação de Prontuário</h1>
            <p className="text-gray-600">Preencha o formulário abaixo para solicitar seu prontuário médico</p>
          </div>

          <form className="space-y-6">
            {/* Nome completo */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Nome Completo do Solicitante *
              </label>
              <input
                type="text"
                name="requesterName"
                value={formData.requesterName}
                onChange={handleInputChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="Digite seu nome completo"
                required
              />
            </div>

            {/* CPF */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                CPF *
              </label>
              <input
                type="text"
                name="requesterCpf"
                value={formData.requesterCpf}
                onChange={handleCpfChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="000.000.000-00"
                maxLength={14}
                required
              />
            </div>

            {/* Motivo da solicitação */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Motivo da Solicitação *
              </label>
              <textarea
                name="requestReason"
                value={formData.requestReason}
                onChange={handleInputChange}
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="Descreva o motivo da solicitação do prontuário"
                required
              />
            </div>

            {/* Data/período no hospital */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Data/Período que esteve no Hospital *
              </label>
              <input
                type="text"
                name="hospitalPeriod"
                value={formData.hospitalPeriod}
                onChange={handleInputChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="Ex: Janeiro/2024 ou 15/01/2024 a 20/01/2024"
                required
              />
            </div>

            {/* Convênio */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Convênio
              </label>
              <input
                type="text"
                name="insurance"
                value={formData.insurance}
                onChange={handleInputChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="Digite o nome do convênio (opcional)"
              />
            </div>

            {/* Telefone para contato */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Telefone para Contato *
              </label>
              <input
                type="tel"
                name="contactPhone"
                value={formData.contactPhone}
                onChange={handleInputChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="(00) 00000-0000"
                required
              />
            </div>

            {/* Solicitação por terceiros */}
            <div className="bg-gray-50 rounded-lg p-4">
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="isThirdParty"
                  checked={formData.isThirdParty}
                  onChange={handleInputChange}
                  className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                />
                <span className="text-sm font-semibold text-gray-700">
                  Solicitação feita por terceiro (acompanhante ou outra pessoa)
                </span>
              </label>

              {formData.isThirdParty && (
                <div className="mt-4 space-y-4 pl-8 border-l-2 border-indigo-200">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Nome do Terceiro Solicitante *
                    </label>
                    <input
                      type="text"
                      name="thirdPartyName"
                      value={formData.thirdPartyName}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="Nome completo de quem está solicitando"
                      required={formData.isThirdParty}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      CPF do Terceiro Solicitante *
                    </label>
                    <input
                      type="text"
                      name="thirdPartyCpf"
                      value={formData.thirdPartyCpf}
                      onChange={handleThirdPartyCpfChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="000.000.000-00"
                      maxLength={14}
                      required={formData.isThirdParty}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Grau de Parentesco/Relação *
                    </label>
                    <input
                      type="text"
                      name="thirdPartyRelationship"
                      value={formData.thirdPartyRelationship}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="Ex: Esposo(a), Filho(a), Irmão(ã), Advogado, etc."
                      required={formData.isThirdParty}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Botão de assinar */}
            <div className="pt-4">
              <label className="block text-sm font-semibold text-gray-700 mb-4">
                Assinar Solicitação *
              </label>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={handleManualSignature}
                  disabled={isSubmitting}
                  className="flex items-center justify-center space-x-2 bg-indigo-600 text-white py-4 px-6 rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span>Baixar PDF para Assinar</span>
                </button>

                <button
                  type="button"
                  onClick={handleGovBrSignature}
                  disabled={isSubmitting}
                  className="flex items-center justify-center space-x-2 bg-green-600 text-white py-4 px-6 rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  <span>Assinar com gov.br</span>
                </button>
              </div>

              <p className="text-xs text-gray-500 mt-3 text-center">
                Ao baixar o PDF, assine manualmente e envie escaneado. 
                Com gov.br, a assinatura é digital e mais rápida.
              </p>
            </div>
          </form>
        </div>

        <p className="text-center text-gray-500 text-sm mt-6">
          Esta solicitação gerará um token de acompanhamento que será enviado via WhatsApp
        </p>
      </div>
    </div>
  )
}
