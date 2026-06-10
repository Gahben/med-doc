'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Search, Download, Printer, Upload, Eye } from 'lucide-react'
import { formatDate, formatCPF, getStatusBadge } from '@/lib/utils'
import { Document } from '@/types'
import toast from 'react-hot-toast'
import Link from 'next/link'

export default function BuscaPage() {
  const { data: session } = useSession()
  const [search, setSearch] = useState('')
  const [documents, setDocuments] = useState<Document[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null)
  const [showModal, setShowModal] = useState(false)

  const userRole = session?.user?.role as string
  const canUpload = userRole === 'admin' || userRole === 'atendente'

  const fetchDocuments = useCallback(async () => {
    try {
      setIsLoading(true)
      const params = new URLSearchParams()
      if (search) params.append('search', search)
      
      const response = await fetch(`/api/documents?${params}`)
      const data = await response.json()
      
      if (response.ok) {
        setDocuments(data.documents || [])
      } else {
        toast.error('Erro ao buscar documentos')
      }
    } catch (error) {
      toast.error('Erro ao buscar documentos')
    } finally {
      setIsLoading(false)
    }
  }, [search])

  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

  const handleDownload = async (doc: Document) => {
    if (doc.status !== 'approved') {
      toast.error('Documento não aprovado não pode ser baixado')
      return
    }
    
    window.open(doc.file_url, '_blank')
    toast.success('Download iniciado!')
  }

  const handlePrint = (doc: Document) => {
    if (doc.status !== 'approved') {
      toast.error('Documento não aprovado não pode ser impresso')
      return
    }
    
    const printWindow = window.open(doc.file_url, '_blank')
    if (printWindow) {
      printWindow.onload = () => {
        printWindow.print()
      }
    }
    toast.success('Enviando para impressão...')
  }

  const openModal = (doc: Document) => {
    setSelectedDoc(doc)
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setSelectedDoc(null)
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-7">
        <h1 className="text-[22px] font-semibold tracking-tight">Prontuários</h1>
        <p className="text-sm text-text-2 mt-1">Busque por nome, CPF ou número do prontuário</p>
      </div>

      {/* Search Bar */}
      <div className="flex gap-2.5 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nome, CPF ou código..."
            className="w-full pl-10 pr-4 py-2.5 border border-border rounded-lg text-sm bg-surface focus:border-accent transition-colors"
          />
        </div>
        {canUpload && (
          <Link
            href="/dashboard/upload"
            className="bg-surface border border-border rounded-lg px-4 py-2 text-sm font-medium text-text hover:bg-surface-2 transition-colors flex items-center gap-1.5 whitespace-nowrap"
          >
            <Upload className="w-4 h-4" />
            Upload
          </Link>
        )}
      </div>

      {/* Table */}
      <div className="bg-surface border border-border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-surface-2 border-b border-border">
              <th className="text-left text-xs font-semibold text-text-2 uppercase tracking-wide py-3 px-4">Paciente</th>
              <th className="text-left text-xs font-semibold text-text-2 uppercase tracking-wide py-3 px-4">CPF</th>
              <th className="text-left text-xs font-semibold text-text-2 uppercase tracking-wide py-3 px-4">Código</th>
              <th className="text-left text-xs font-semibold text-text-2 uppercase tracking-wide py-3 px-4">Data</th>
              <th className="text-left text-xs font-semibold text-text-2 uppercase tracking-wide py-3 px-4">Status</th>
              <th className="text-left text-xs font-semibold text-text-2 uppercase tracking-wide py-3 px-4">Ações</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-text-3">
                  Carregando...
                </td>
              </tr>
            ) : documents.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-text-3">
                  Nenhum resultado encontrado
                </td>
              </tr>
            ) : (
              documents.map((doc) => {
                const status = getStatusBadge(doc.status, doc.never_delete)
                const canAct = doc.status === 'approved'
                
                return (
                  <tr 
                    key={doc.id} 
                    className="border-b border-border hover:bg-surface-2 transition-colors cursor-pointer"
                    onClick={() => openModal(doc)}
                  >
                    <td className="py-3 px-4 text-sm font-medium">{doc.patient_name}</td>
                    <td className="py-3 px-4 text-sm font-mono text-text-2">{formatCPF(doc.cpf)}</td>
                    <td className="py-3 px-4 text-sm font-mono text-text-2">{doc.system_code}</td>
                    <td className="py-3 px-4 text-sm text-text-2">{formatDate(doc.document_date)}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full ${status.className}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                        {canAct ? (
                          <>
                            <button
                              onClick={() => handleDownload(doc)}
                              className="p-1.5 border border-border rounded-md text-text-2 hover:bg-surface-2 hover:text-text transition-colors"
                              title="Baixar"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handlePrint(doc)}
                              className="p-1.5 border border-border rounded-md text-text-2 hover:bg-surface-2 hover:text-text transition-colors"
                              title="Imprimir"
                            >
                              <Printer className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <span className="text-xs text-text-3">
                            {doc.status === 'pending' ? 'Em revisão' : 
                             doc.status === 'reproved' ? 'Ver motivo' : '—'}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && selectedDoc && (
        <div 
          className="fixed inset-0 bg-black/35 z-50 flex items-center justify-center p-5"
          onClick={(e) => e.target === e.currentTarget && closeModal()}
        >
          <div className="bg-surface rounded-xl p-8 max-w-[500px] w-full shadow-lg">
            <h3 className="text-lg font-semibold mb-1.5">{selectedDoc.patient_name}</h3>
            <p className="text-sm text-text-2 mb-5">Selecione uma ação para este arquivo</p>
            
            <div className="bg-surface-2 rounded-lg p-4 mb-4 space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-text-2">Código:</span>
                <span className="font-medium font-mono">{selectedDoc.system_code}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-2">CPF:</span>
                <span className="font-medium font-mono">{formatCPF(selectedDoc.cpf)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-2">Tipo:</span>
                <span className="font-medium">{selectedDoc.type}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-2">Data:</span>
                <span className="font-medium">{formatDate(selectedDoc.document_date)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-2">Status:</span>
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${getStatusBadge(selectedDoc.status, selectedDoc.never_delete).className}`}>
                  {getStatusBadge(selectedDoc.status, selectedDoc.never_delete).label}
                </span>
              </div>
            </div>

            {selectedDoc.review_note && (
              <div className="bg-warning-light rounded-lg p-3 mb-4 text-sm text-warning border-l-3 border-warning">
                <strong className="block mb-1">
                  {selectedDoc.status === 'reproved' ? 'Motivo da não liberação:' : 'Ressalva do revisor:'}
                </strong>
                {selectedDoc.review_note}
              </div>
            )}

            <div className="flex gap-2.5 flex-wrap">
              {selectedDoc.status === 'approved' && (
                <>
                  <button
                    onClick={() => handlePrint(selectedDoc)}
                    className="bg-text text-white rounded-lg px-4 py-2.5 text-sm font-medium flex items-center gap-2 hover:opacity-85 transition-opacity"
                  >
                    <Printer className="w-4 h-4" />
                    Imprimir
                  </button>
                  <button
                    onClick={() => handleDownload(selectedDoc)}
                    className="bg-accent text-white rounded-lg px-4 py-2.5 text-sm font-medium flex items-center gap-2 hover:opacity-85 transition-opacity"
                  >
                    <Download className="w-4 h-4" />
                    Download
                  </button>
                </>
              )}
              <button
                onClick={() => window.open(selectedDoc.file_url, '_blank')}
                className="bg-surface border border-border rounded-lg px-4 py-2.5 text-sm font-medium flex items-center gap-2 hover:bg-surface-2 transition-colors"
              >
                <Eye className="w-4 h-4" />
                Visualizar
              </button>
              <button
                onClick={closeModal}
                className="ml-auto bg-transparent border border-border rounded-lg px-4 py-2.5 text-sm font-medium text-text-2 hover:bg-surface-2 transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
