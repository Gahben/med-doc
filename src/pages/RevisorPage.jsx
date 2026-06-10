import { useState, useEffect } from 'react'
import { patientRequestsService, cpfHelpers, storageService } from '../lib/storage'
import toast from 'react-hot-toast'
import { useAuth } from '../hooks/useAuth'
import styles from './RevisorPage.module.css'
import { PageHeader, EmptyState } from '../components/UI'

const STATUS_LABELS = {
  pending: 'Pendente',
  approved: 'Aprovada',
  rejected: 'Recusada',
  completed: 'Concluída',
}

function statusBadgeClass(status, styles) {
  const key = status === 'rejected' ? 'reproved' : status
  return styles[`doc_${key}`] ?? styles.doc_pending
}

export default function RevisorPage() {
  const { user } = useAuth()
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
      // Passa o ID do usuário logado (user?.id) para identificar quem recebeu/atualizou
      const { error } = await patientRequestsService.updateStatus(
        selectedRequest.id,
        newStatus,
        notes || null,
        user?.id || null
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
    <div>
      <PageHeader
        title="Painel do Revisor"
        subtitle="Gerencie e aprove as solicitações de prontuários feitas pelos pacientes"
        actions={
          <button onClick={loadRequests} disabled={loading} className={styles.btnRefresh}>
            <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <polyline points="23 4 23 10 17 10"/>
              <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
            </svg>
            Atualizar
          </button>
        }
      />

      <div className={styles.infoBox}>
        <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className={styles.infoIcon}>
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <span>
          O Revisor analisa as solicitações de prontuários criadas pelos pacientes. 
          Verifique os dados informados, visualize o PDF assinado e depois aprove, recuse ou conclua a solicitação.
        </span>
      </div>

      <div className={styles.filters}>
        <input
          type="text"
          placeholder="Buscar por nome, CPF ou token..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className={styles.searchInput}
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className={styles.select}
        >
          <option value="all">Todos os Status</option>
          <option value="pending">Pendente</option>
          <option value="approved">Aprovada</option>
          <option value="rejected">Recusada</option>
          <option value="completed">Concluída</option>
        </select>
      </div>

      <div className={styles.tableCard}>
        {loading ? (
          <div className={styles.loadingState}>
            <span className="spinner dark" /> Carregando solicitações…
          </div>
        ) : requests.length === 0 ? (
          <EmptyState
            icon={
              <svg fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            }
            title="Nenhuma solicitação encontrada"
            subtitle="Tente ajustar os filtros ou buscar por outro termo"
          />
        ) : (
          <>
            <div className={styles.tableInfo}>
              {requests.length} solicitaç{requests.length !== 1 ? 'ões' : 'ão'}
            </div>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Token</th>
                    <th>Solicitante</th>
                    <th>CPF</th>
                    <th>Data</th>
                    <th>Status</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((request) => (
                    <tr key={request.id} className={styles.row}>
                      <td className={`${styles.tdMono} ${styles.tdToken}`}>
                        {request.token}
                      </td>
                      <td className={styles.tdName}>
                        <div>{request.requester_name}</div>
                        {request.is_third_party && (
                          <div className={styles.thirdPartyHint}>
                            Por: {request.third_party_name}
                          </div>
                        )}
                      </td>
                      <td className={styles.tdMono}>
                        {cpfHelpers.format(request.requester_cpf)}
                      </td>
                      <td className={styles.tdDate}>
                        {new Date(request.created_at).toLocaleDateString('pt-BR')}
                      </td>
                      <td>
                        <span className={`${styles.docBadge} ${statusBadgeClass(request.status, styles)}`}>
                          {STATUS_LABELS[request.status]}
                        </span>
                      </td>
                      <td>
                        <div className={styles.actionBtns}>
                          <button
                            onClick={() => {
                              setSelectedRequest(request)
                              setNotes(request.notes || '')
                            }}
                            className={styles.btnVer}
                          >
                            Gerenciar
                          </button>
                          {request.signature_file_path && (
                            <button
                              onClick={() => handleViewPDF(request)}
                              className={`${styles.btnVer} ${styles.btnVerAccent}`}
                            >
                              Ver PDF
                            </button>
                          )}
                          <button
                            onClick={() => copyLink(request.token)}
                            className={`${styles.btnVer} ${styles.btnVerMuted}`}
                          >
                            Copiar Link
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {selectedRequest && (
        <div className={styles.overlay} onClick={() => setSelectedRequest(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <h3>Gerenciar Solicitação {selectedRequest.token}</h3>
                <span className={styles.modalSub}>
                  Criada em {new Date(selectedRequest.created_at).toLocaleDateString('pt-BR')}
                </span>
              </div>
              <button onClick={() => setSelectedRequest(null)} className={styles.modalClose}>
                <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <div className={styles.modalBody}>
              <div className={`${styles.section} ${styles.sectionFirst}`}>
                <h4 className={styles.sectionTitle}>Dados do Solicitante</h4>
                <dl className={styles.detailGrid}>
                  <div>
                    <dt>Nome Completo</dt>
                    <dd>{selectedRequest.requester_name}</dd>
                  </div>
                  <div>
                    <dt>CPF</dt>
                    <dd className={styles.mono}>{cpfHelpers.format(selectedRequest.requester_cpf)}</dd>
                  </div>
                  <div>
                    <dt>Telefone para Contato</dt>
                    <dd>{selectedRequest.contact_phone}</dd>
                  </div>
                  <div>
                    <dt>Status da Solicitação</dt>
                    <dd>
                      <span className={`${styles.docBadge} ${statusBadgeClass(selectedRequest.status, styles)}`}>
                        {STATUS_LABELS[selectedRequest.status]}
                      </span>
                    </dd>
                  </div>
                </dl>
              </div>

              {selectedRequest.is_third_party && (
                <div className={styles.section}>
                  <h4 className={styles.sectionTitle}>Solicitação feita por Terceiro</h4>
                  <dl className={styles.detailGrid}>
                    <div>
                      <dt>Nome do Terceiro</dt>
                      <dd>{selectedRequest.third_party_name}</dd>
                    </div>
                    <div>
                      <dt>CPF do Terceiro</dt>
                      <dd className={styles.mono}>{cpfHelpers.format(selectedRequest.third_party_cpf)}</dd>
                    </div>
                    <div className={styles.colSpan2}>
                      <dt>Relação / Grau de Parentesco</dt>
                      <dd>{selectedRequest.third_party_relationship}</dd>
                    </div>
                  </dl>
                </div>
              )}

              <div className={styles.section}>
                <h4 className={styles.sectionTitle}>Detalhes do Pedido</h4>
                <dl className={styles.detailGrid}>
                  <div className={styles.colSpan2}>
                    <dt>Motivo da Solicitação</dt>
                    <dd className={styles.preWrap}>{selectedRequest.request_reason}</dd>
                  </div>
                  <div>
                    <dt>Período no Hospital</dt>
                    <dd>{selectedRequest.hospital_period}</dd>
                  </div>
                  {selectedRequest.insurance && (
                    <div>
                      <dt>Convênio</dt>
                      <dd>{selectedRequest.insurance}</dd>
                    </div>
                  )}
                </dl>
              </div>

              {selectedRequest.signature_file_path && (
                <div className={styles.section}>
                  <h4 className={styles.sectionTitle}>PDF Assinado</h4>
                  <div className={styles.fileActions}>
                    <button
                      onClick={() => handleViewPDF(selectedRequest)}
                      className={`${styles.btnFileAction} ${styles.btnFileActionFull}`}
                    >
                      <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                      </svg>
                      Visualizar PDF Assinado
                    </button>
                  </div>
                </div>
              )}

              <div className={styles.section}>
                <h4 className={styles.sectionTitle}>Observações (Salvo ao mudar status)</h4>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Escreva observações ou motivos de recusa..."
                  className={`${styles.textarea} ${styles.textareaFull}`}
                />
              </div>

              <div className={styles.section}>
                <h4 className={styles.sectionTitle}>Atualizar Status</h4>
                <div className={`${styles.fileActions} ${styles.statusActions}`}>
                  <button
                    onClick={() => handleUpdateStatus('approved')}
                    disabled={isUpdating}
                    className={`${styles.btnFileAction} ${styles.btnStatusApprove}`}
                  >
                    Aprovar
                  </button>
                  <button
                    onClick={() => handleUpdateStatus('rejected')}
                    disabled={isUpdating}
                    className={`${styles.btnFileAction} ${styles.btnStatusReject}`}
                  >
                    Recusar
                  </button>
                  <button
                    onClick={() => handleUpdateStatus('completed')}
                    disabled={isUpdating}
                    className={`${styles.btnFileAction} ${styles.btnStatusComplete}`}
                  >
                    Concluir
                  </button>
                  <button
                    onClick={() => handleUpdateStatus('pending')}
                    disabled={isUpdating}
                    className={`${styles.btnFileAction} ${styles.btnStatusPending}`}
                  >
                    Pendente
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
