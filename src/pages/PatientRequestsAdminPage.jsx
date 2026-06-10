import { useState, useEffect } from 'react'
import { patientRequestsService, cpfHelpers, storageService } from '../lib/storage'
import toast from 'react-hot-toast'

const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  completed: 'bg-blue-100 text-blue-800',
}

const STATUS_LABELS = {
  pending: 'Pendente',
  approved: 'Aprovada',
  rejected: 'Recusada',
  completed: 'Concluída',
}

export default function PatientRequestsAdminPage() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [notes, setNotes] = useState('')
  const [isUpdating, setIsUpdating] = useState(false)

  useEffect(() => {
    loadRequests()
  }, [statusFilter, searchTerm])

  const loadRequests = async () => {
    setLoading(true)
    try {
      const { data, error } = await patientRequestsService.list({
        status: statusFilter === 'all' ? null : statusFilter,
        search: searchTerm,
      })
      
      if (error) throw error
      setRequests(data || [])
    } catch (error) {
      console.error('Erro ao carregar solicitações:', error)
      toast.error('Erro ao carregar solicitações')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateStatus = async (newStatus) => {
    if (!selectedRequest) return
    
    setIsUpdating(true)
    try {
      const { error } = await patientRequestsService.updateStatus(
        selectedRequest.id,
        newStatus,
        notes || null
      )
      
      if (error) throw error
      
      toast.success('Status atualizado com sucesso!')
      setSelectedRequest(null)
      setNotes('')
      loadRequests()
    } catch (error) {
      console.error('Erro ao atualizar status:', error)
      toast.error('Erro ao atualizar status')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleViewPDF = async (request) => {
    if (!request.signature_file_path) {
      toast.error('PDF assinado não disponível')
      return
    }

    try {
      const url = await storageService.getSignedUrl(request.signature_file_path)
      window.open(url, '_blank')
    } catch (error) {
      console.error('Erro ao abrir PDF:', error)
      toast.error('Erro ao abrir PDF')
    }
  }

  const copyLink = (token) => {
    const link = `${window.location.origin}/solicitacao?token=${token}`
    navigator.clipboard.writeText(link)
    toast.success('Link copiado para a área de transferência')
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Solicitações de Pacientes</h1>
        <p className="text-gray-600">Gerencie as solicitações de prontuário feitas pelos pacientes</p>
      </div>

      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex gap-4 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="Buscar por nome, CPF ou token..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          >
            <option value="all">Todos os Status</option>
            <option value="pending">Pendente</option>
            <option value="approved">Aprovada</option>
            <option value="rejected">Recusada</option>
            <option value="completed">Concluída</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Token
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Solicitante
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  CPF
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Data
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {requests.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    Nenhuma solicitação encontrada
                  </td>
                </tr>
              ) : (
                requests.map((request) => (
                  <tr key={request.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-mono font-bold text-indigo-600">{request.token}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{request.requester_name}</div>
                      {request.is_third_party && (
                        <div className="text-xs text-gray-500">Por: {request.third_party_name}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {cpfHelpers.format(request.requester_cpf)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(request.created_at).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${STATUS_COLORS[request.status]}`}>
                        {STATUS_LABELS[request.status]}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                      <button
                        onClick={() => setSelectedRequest(request)}
                        className="text-indigo-600 hover:text-indigo-900"
                      >
                        Gerenciar
                      </button>
                      {request.signature_file_path && (
                        <button
                          onClick={() => handleViewPDF(request)}
                          className="text-green-600 hover:text-green-900"
                        >
                          Ver PDF
                        </button>
                      )}
                      <button
                        onClick={() => copyLink(request.token)}
                        className="text-gray-600 hover:text-gray-900"
                      >
                        Copiar Link
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <h2 className="text-xl font-bold text-gray-800">
                  Gerenciar Solicitação {selectedRequest.token}
                </h2>
                <button
                  onClick={() => setSelectedRequest(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4 mb-6">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-800 mb-2">Dados do Solicitante</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-gray-600">Nome:</span>
                      <span className="ml-2">{selectedRequest.requester_name}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">CPF:</span>
                      <span className="ml-2">{cpfHelpers.format(selectedRequest.requester_cpf)}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Telefone:</span>
                      <span className="ml-2">{selectedRequest.contact_phone}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Status:</span>
                      <span className={`ml-2 px-2 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[selectedRequest.status]}`}>
                        {STATUS_LABELS[selectedRequest.status]}
                      </span>
                    </div>
                  </div>
                </div>

                {selectedRequest.is_third_party && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="font-semibold text-gray-800 mb-2">Solicitação por Terceiro</h3>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-gray-600">Nome:</span>
                        <span className="ml-2">{selectedRequest.third_party_name}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">CPF:</span>
                        <span className="ml-2">{cpfHelpers.format(selectedRequest.third_party_cpf)}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-gray-600">Relação:</span>
                        <span className="ml-2">{selectedRequest.third_party_relationship}</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-800 mb-2">Detalhes da Solicitação</h3>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-gray-600">Motivo:</span>
                      <p className="mt-1">{selectedRequest.request_reason}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Período no Hospital:</span>
                      <p className="mt-1">{selectedRequest.hospital_period}</p>
                    </div>
                    {selectedRequest.insurance && (
                      <div>
                        <span className="text-gray-600">Convênio:</span>
                        <p className="mt-1">{selectedRequest.insurance}</p>
                      </div>
                    )}
                  </div>
                </div>

                {selectedRequest.signature_file_path && (
                  <div className="bg-green-50 rounded-lg p-4">
                    <h3 className="font-semibold text-green-800 mb-2">PDF Assinado Recebido</h3>
                    <button
                      onClick={() => handleViewPDF(selectedRequest)}
                      className="text-green-600 hover:text-green-800 text-sm font-medium"
                    >
                      Visualizar PDF
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Observações (opcional)
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Adicione observações sobre esta solicitação..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Atualizar Status
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleUpdateStatus('approved')}
                      disabled={isUpdating}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Aprovar
                    </button>
                    <button
                      onClick={() => handleUpdateStatus('rejected')}
                      disabled={isUpdating}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Recusar
                    </button>
                    <button
                      onClick={() => handleUpdateStatus('completed')}
                      disabled={isUpdating}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Concluir
                    </button>
                    <button
                      onClick={() => handleUpdateStatus('pending')}
                      disabled={isUpdating}
                      className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Marcar como Pendente
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
