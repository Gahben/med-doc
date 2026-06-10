import { useState } from 'react'
import { patientRequestsService } from '../lib/storage'
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

export default function PatientTrackingPage() {
  const [token, setToken] = useState('')
  const [request, setRequest] = useState(null)
  const [loading, setLoading] = useState(false)
  const [notFound, setNotFound] = useState(false)

  const handleSearch = async (e) => {
    e.preventDefault()
    if (!token.trim()) {
      toast.error('Digite o token de acompanhamento')
      return
    }

    setLoading(true)
    setNotFound(false)
    setRequest(null)

    try {
      const { data, error } = await patientRequestsService.getByToken(token.trim().toUpperCase())
      
      if (error) throw error
      
      setRequest(data)
    } catch (error) {
      console.error('Erro ao buscar solicitação:', error)
      setNotFound(true)
      toast.error('Solicitação não encontrada')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Acompanhar Solicitação</h1>
            <p className="text-gray-600">Digite o token para verificar o status da sua solicitação</p>
          </div>

          <form onSubmit={handleSearch} className="mb-8">
            <div className="flex gap-4">
              <input
                type="text"
                value={token}
                onChange={(e) => setToken(e.target.value.toUpperCase())}
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-center text-2xl font-mono tracking-wider"
                placeholder="TOKEN"
                maxLength={8}
              />
              <button
                type="submit"
                disabled={loading}
                className="px-8 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Buscando...' : 'Buscar'}
              </button>
            </div>
          </form>

          {notFound && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
              <p className="text-red-800">Solicitação não encontrada. Verifique o token e tente novamente.</p>
            </div>
          )}

          {request && (
            <div className="space-y-6 animate-fade-in">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Token de Acompanhamento</p>
                    <p className="text-3xl font-bold text-blue-600 tracking-wider">{request.token}</p>
                  </div>
                  <span className={`px-4 py-2 rounded-full text-sm font-semibold ${STATUS_COLORS[request.status]}`}>
                    {STATUS_LABELS[request.status]}
                  </span>
                </div>
              </div>

              <div className="space-y-4">
                <div className="border-b pb-4">
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">Dados do Solicitante</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">Nome</p>
                      <p className="font-medium">{request.requester_name}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">CPF</p>
                      <p className="font-medium">{request.requester_cpf}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Telefone</p>
                      <p className="font-medium">{request.contact_phone}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Data da Solicitação</p>
                      <p className="font-medium">{new Date(request.created_at).toLocaleDateString('pt-BR')}</p>
                    </div>
                  </div>
                </div>

                {request.is_third_party && (
                  <div className="border-b pb-4">
                    <h3 className="text-lg font-semibold text-gray-800 mb-3">Solicitação por Terceiro</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-600">Nome</p>
                        <p className="font-medium">{request.third_party_name}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">CPF</p>
                        <p className="font-medium">{request.third_party_cpf}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-gray-600">Relação</p>
                        <p className="font-medium">{request.third_party_relationship}</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="border-b pb-4">
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">Detalhes da Solicitação</h3>
                  <div className="space-y-2 text-sm">
                    <div>
                      <p className="text-gray-600">Motivo</p>
                      <p className="font-medium">{request.request_reason}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Período no Hospital</p>
                      <p className="font-medium">{request.hospital_period}</p>
                    </div>
                    {request.insurance && (
                      <div>
                        <p className="text-gray-600">Convênio</p>
                        <p className="font-medium">{request.insurance}</p>
                      </div>
                    )}
                  </div>
                </div>

                {request.notes && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">Observações</h3>
                    <p className="text-sm text-gray-600">{request.notes}</p>
                  </div>
                )}

                {request.received_at && (
                  <div className="text-sm text-gray-600">
                    <p>Recebido em: {new Date(request.received_at).toLocaleString('pt-BR')}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-gray-500 text-sm mt-6">
          Se você não tem o token, entre em contato com o hospital.
        </p>
      </div>
    </div>
  )
}
