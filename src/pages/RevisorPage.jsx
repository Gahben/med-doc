import { useState, useEffect } from 'react'
import {
  patientRequestsService,
  cpfHelpers,
  storageService,
  STATUS_WORKFLOW,
  getAllowedTransitions,
  notifyWorkflowChange,
  aiService
} from '../lib/storage'
import toast from 'react-hot-toast'
import { useAuth } from '../hooks/useAuth'
import { useAuditLog } from '../hooks/useAuditLog'
import styles from './RevisorPage.module.css'
import { PageHeader, EmptyState } from '../components/UI'

const WF_FILTER_OPTIONS = [
  { value: 'all', label: 'Todos os Status' },
  ...Object.entries(STATUS_WORKFLOW).map(([value, cfg]) => ({
    value,
    label: `${cfg.icon} ${cfg.label}`,
  })),
]

function WfBadge({ status }) {
  if (!status) return <span className={styles.badgeNone}>—</span>
  const cfg = STATUS_WORKFLOW[status] || { label: status, color: 'info', icon: '' }
  return (
    <span className={`${styles.wfBadge} ${styles['wf_' + cfg.color]}`}>
      {cfg.icon} {cfg.label}
    </span>
  )
}

function WfBadgeUrgency({ level }) {
  if (!level) return null
  const cfg = {
    low: { label: 'Baixa', color: 'info', icon: '🟢' },
    medium: { label: 'Média', color: 'warning', icon: '🟡' },
    high: { label: 'Alta', color: 'orange', icon: '🟠' },
    critical: { label: 'Crítica', color: 'danger', icon: '🔴' }
  }[level] || { label: level, color: 'info', icon: '' }
  
  return (
    <span className={`${styles.wfBadge} ${styles['wf_' + cfg.color]}`} style={{ marginLeft: '4px' }}>
      {cfg.icon} {cfg.label}
    </span>
  )
}

function whatsAppUrl(phone, message) {
  const digits = (phone || '').replace(/\D/g, '')
  const withCountry = digits.startsWith('55') ? digits : `55${digits}`
  return `https://wa.me/${withCountry}?text=${encodeURIComponent(message)}`
}

export default function RevisorPage() {
  const { user } = useAuth()
  const log = useAuditLog()
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [notes, setNotes] = useState('')
  const [isUpdating, setIsUpdating] = useState(false)
  
  // AI states
  const [generatedMessage, setGeneratedMessage] = useState('')
  const [generatingMessage, setGeneratingMessage] = useState(false)
  const [triaging, setTriaging] = useState(false)

  useEffect(() => {
    loadRequests()
  }, [statusFilter, searchTerm])

  const loadRequests = async () => {
    setLoading(true)
    try {
      const { data, error } = await patientRequestsService.list({
        workflowStatus: statusFilter === 'all' ? null : statusFilter,
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

    if (newStatus === 'request_rejected' || newStatus === 'cancelled') {
      if (!window.confirm(`ATENÇÃO: Deseja realmente mudar o status para "${STATUS_WORKFLOW[newStatus]?.label}"?\n\nIsso exigirá nova ação do paciente ou interromperá o fluxo.`)) {
        return;
      }
    }

    setIsUpdating(true)
    try {
      let finalStatus = newStatus

      if (newStatus === 'request_approved') {
        const { error: approveErr } = await patientRequestsService.updateWorkflowStatus(
          selectedRequest.id,
          'request_approved',
          notes || null,
          user?.id || null
        )
        if (approveErr) throw approveErr
        finalStatus = 'in_production'
      }

      const { error } = await patientRequestsService.updateWorkflowStatus(
        selectedRequest.id,
        finalStatus,
        notes || null,
        user?.id || null
      )

      if (error) throw error

      const cfg = STATUS_WORKFLOW[finalStatus]
      if (selectedRequest.prontuario_id) {
        await notifyWorkflowChange(finalStatus, {
          id: selectedRequest.prontuario_id,
          record_number: selectedRequest.record_number || selectedRequest.token,
          patient_name: selectedRequest.requester_name,
        }, user?.id)
      } else if (finalStatus === 'in_production') {
        await notifyWorkflowChange('request_approved', {
          id: selectedRequest.id,
          record_number: selectedRequest.record_number || selectedRequest.token,
          patient_name: selectedRequest.requester_name,
        }, user?.id)
      }

      const msg = newStatus === 'request_approved'
        ? 'Solicitação aprovada e encaminhada para produção'
        : `Status atualizado: ${cfg?.label}`
      toast.success(msg)
      setSelectedRequest(null)
      setNotes('')
      setGeneratedMessage('')
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

  const handleGenerateMessage = async () => {
    if (!selectedRequest) return
    setGeneratingMessage(true)
    try {
      const ctx = selectedRequest.workflow_status === 'request_rejected' ? 'Informar que a solicitação foi recusada e precisamos de correções: ' + notes : 
                  selectedRequest.workflow_status === 'received' ? 'Informar que recebemos a solicitação e estamos em análise.' :
                  'Informar sobre o andamento.'
      const res = await aiService.generateWhatsAppMessage(selectedRequest.id, ctx)
      if (res.data?.error) throw new Error(res.data.error)
      setGeneratedMessage(res.data?.message || '')
      toast.success('Mensagem gerada com sucesso')
    } catch (err) {
      console.error(err)
      toast.error('Erro ao gerar mensagem')
    } finally {
      setGeneratingMessage(false)
    }
  }

  const handleTriage = async (request) => {
    setTriaging(true)
    try {
      const res = await aiService.triage(request.id)
      if (res.data?.error) throw new Error(res.data.error)
      toast.success('Triagem concluída')
      loadRequests()
    } catch (err) {
      console.error(err)
      toast.error('Erro na triagem')
    } finally {
      setTriaging(false)
    }
  }

  const availableActions = selectedRequest
    ? getAllowedTransitions('revisor', selectedRequest.workflow_status)
    : []

  return (
    <div>
      <PageHeader
        title="Painel do Revisor"
        subtitle="Analise solicitações, aprove ou recuse e encaminhe para produção"
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
          Novas solicitações chegam como <strong>Recebida</strong>. Ao aprovar, a solicitação vai automaticamente para <strong>Em Produção</strong>.
          Em caso de divergências, entre em contato pelo WhatsApp antes de aprovar.
        </span>
      </div>

      <div className={styles.filters}>
        <input
          type="text"
          placeholder="Buscar por nome, CPF, token ou nº prontuário..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className={styles.searchInput}
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className={styles.select}
        >
          {WF_FILTER_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
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
                    <th>Prontuário</th>
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
                      <td className={styles.tdMono}>
                        {request.record_number || '—'}
                      </td>
                      <td className={styles.tdDate}>
                        {new Date(request.created_at).toLocaleDateString('pt-BR')}
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <WfBadge status={request.workflow_status} />
                          {request.ai_triage_results && request.ai_triage_results.length > 0 && (
                            <WfBadgeUrgency level={request.ai_triage_results[0].urgency_level} />
                          )}
                        </div>
                      </td>
                      <td>
                        <div className={styles.actionBtns}>
                          <button
                            onClick={() => {
                              setSelectedRequest(request)
                              setNotes(request.notes || '')
                              setGeneratedMessage('')
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
                  {selectedRequest.record_number && ` · Prontuário ${selectedRequest.record_number}`}
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
                      <WfBadge status={selectedRequest.workflow_status} />
                      {selectedRequest.ai_triage_results && selectedRequest.ai_triage_results.length > 0 && (
                        <WfBadgeUrgency level={selectedRequest.ai_triage_results[0].urgency_level} />
                      )}
                    </dd>
                  </div>
                </dl>
              </div>

              {/* Seção IA */}
              <div className={styles.section}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 className={styles.sectionTitle}>Triagem IA</h4>
                  {(!selectedRequest.ai_triage_results || selectedRequest.ai_triage_results.length === 0) && (
                     <button onClick={() => handleTriage(selectedRequest)} disabled={triaging} className={styles.btnVer} style={{ fontSize: '12px' }}>
                       {triaging ? 'Analisando...' : '✨ Analisar agora'}
                     </button>
                  )}
                </div>
                {selectedRequest.ai_triage_results && selectedRequest.ai_triage_results.length > 0 ? (
                  <dl className={styles.detailGrid} style={{ background: 'var(--info-light)', padding: '12px', borderRadius: '8px' }}>
                    <div className={styles.colSpan2}>
                      <dt style={{ color: 'var(--info)' }}>Resumo</dt>
                      <dd>{selectedRequest.ai_triage_results[0].summary}</dd>
                    </div>
                    {selectedRequest.ai_triage_results[0].urgency_reason && (
                      <div className={styles.colSpan2}>
                        <dt style={{ color: 'var(--info)' }}>Motivo Urgência</dt>
                        <dd>{selectedRequest.ai_triage_results[0].urgency_reason}</dd>
                      </div>
                    )}
                    {selectedRequest.ai_triage_results[0].inconsistencies && selectedRequest.ai_triage_results[0].inconsistencies.length > 0 && (
                      <div className={styles.colSpan2}>
                        <dt style={{ color: 'var(--danger)' }}>Inconsistências Detectadas</dt>
                        <dd>
                          <ul style={{ margin: 0, paddingLeft: '16px' }}>
                            {selectedRequest.ai_triage_results[0].inconsistencies.map((inc, i) => (
                              <li key={i} style={{ color: 'var(--danger)' }}>{inc}</li>
                            ))}
                          </ul>
                        </dd>
                      </div>
                    )}
                  </dl>
                ) : (
                  <p className={styles.sectionHint}>Nenhuma triagem automatizada encontrada para esta solicitação.</p>
                )}
              </div>

              {selectedRequest.contact_phone && (
                <div className={styles.section}>
                  <h4 className={styles.sectionTitle}>Contato via WhatsApp</h4>
                  <p className={styles.sectionHint}>
                    Use o WhatsApp para solicitar correções quando houver divergências nos dados ou no PDF assinado.
                  </p>
                  
                  {generatedMessage && (
                    <div style={{ marginBottom: '12px' }}>
                      <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Mensagem gerada (pode editar):</label>
                      <textarea
                        value={generatedMessage}
                        onChange={(e) => setGeneratedMessage(e.target.value)}
                        rows={4}
                        className={styles.textarea}
                        style={{ width: '100%', background: 'var(--purple-light)', borderColor: 'var(--purple)' }}
                      />
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <a
                      href={whatsAppUrl(
                        selectedRequest.contact_phone,
                        generatedMessage || `Olá ${selectedRequest.requester_name}, somos do setor de prontuários. Precisamos de ajustes na sua solicitação ${selectedRequest.token}.`
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`${styles.btnFileAction} ${styles.btnFileActionFull}`}
                      onClick={() => log('whatsapp_opened', `WhatsApp aberto para solicitação ${selectedRequest.token}`, selectedRequest.prontuario_id)}
                    >
                      Abrir conversa no WhatsApp
                    </a>
                    
                    <button
                      onClick={handleGenerateMessage}
                      disabled={generatingMessage}
                      className={styles.btnFileAction}
                      style={{ background: 'var(--purple-light)', color: 'var(--purple)', borderColor: 'var(--purple)', flexShrink: 0 }}
                    >
                      {generatingMessage ? 'Gerando...' : '✨ Gerar com IA'}
                    </button>
                  </div>
                </div>
              )}

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
                <h4 className={styles.sectionTitle}>Observações (salvas ao mudar status)</h4>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Escreva observações ou motivos de recusa..."
                  className={`${styles.textarea} ${styles.textareaFull}`}
                />
              </div>

              {availableActions.length > 0 && (
                <div className={styles.section}>
                  <h4 className={styles.sectionTitle}>Atualizar Status</h4>
                  <div className={`${styles.fileActions} ${styles.statusActions}`}>
                    {availableActions.map(action => {
                      const cfg = STATUS_WORKFLOW[action]
                      const btnClass = action === 'request_rejected' || action === 'cancelled'
                        ? styles.btnStatusReject
                        : action === 'request_approved' || action === 'in_production'
                          ? styles.btnStatusApprove
                          : styles.btnStatusComplete
                      return (
                        <button
                          key={action}
                          onClick={() => handleUpdateStatus(action)}
                          disabled={isUpdating}
                          className={`${styles.btnFileAction} ${btnClass}`}
                        >
                          {cfg?.icon} {cfg?.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
