'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { ArrowLeft, Check, X, FileText, AlertCircle } from 'lucide-react'
import { formatDateTime, formatCPF, getStatusBadge } from '@/lib/utils'
import { ReviewQueueItem } from '@/types'
import toast from 'react-hot-toast'

export default function RevisaoPage() {
  const { data: session } = useSession()
  const [queue, setQueue] = useState<ReviewQueueItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedItem, setSelectedItem] = useState<ReviewQueueItem | null>(null)
  const [decision, setDecision] = useState<'approve' | 'reprove' | null>(null)
  const [note, setNote] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const fetchQueue = useCallback(async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/review')
      const data = await response.json()
      
      if (response.ok) {
        setQueue(data.queue || [])
      } else {
        toast.error('Erro ao carregar fila de revisão')
      }
    } catch (error) {
      toast.error('Erro ao carregar fila de revisão')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchQueue()
  }, [fetchQueue])

  const handleSelectItem = (item: ReviewQueueItem) => {
    setSelectedItem(item)
    setDecision(null)
    setNote('')
  }

  const handleBackToQueue = () => {
    setSelectedItem(null)
    setDecision(null)
    setNote('')
  }

  const handleSubmitDecision = async () => {
    if (!selectedItem || !decision) return

    if (decision === 'reprove' && !note.trim()) {
      toast.error('O motivo é obrigatório para não liberar')
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch('/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document_id: selectedItem.id,
          action: decision,
          note: note.trim(),
        }),
      })

      if (response.ok) {
        toast.success(decision === 'approve' ? 'Prontuário liberado!' : 'Prontuário não liberado')
        fetchQueue()
        handleBackToQueue()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Erro ao processar decisão')
      }
    } catch (error) {
      toast.error('Erro ao processar decisão')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Queue List View
  if (!selectedItem) {
    return (
      <div>
        {/* Header */}
        <div className="mb-7">
          <h1 className="text-[22px] font-semibold tracking-tight">Fila de revisão</h1>
          <p className="text-sm text-text-2 mt-1">Prontuários aguardando sua aprovação para liberação</p>
        </div>

        {/* Queue */}
        {isLoading ? (
          <div className="text-center py-12 text-text-3">Carregando...</div>
        ) : queue.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-10 h-10 bg-surface-2 rounded-full flex items-center justify-center mx-auto mb-3">
              <Check className="w-5 h-5 text-text-3" />
            </div>
            <h3 className="text-base font-semibold mb-1">Fila vazia</h3>
            <p className="text-sm text-text-2">Não há prontuários aguardando revisão</p>
          </div>
        ) : (
          <div className="space-y-3">
            {queue.map((item) => (
              <div
                key={item.id}
                onClick={() => handleSelectItem(item)}
                className="bg-surface border border-border rounded-lg p-5 flex items-center gap-4 cursor-pointer hover:border-accent hover:shadow-sm transition-all"
              >
                <div className="w-11 h-11 bg-warning-light rounded-lg flex items-center justify-center flex-shrink-0">
                  <FileText className="w-5 h-5 text-warning" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-[15px]">{item.patient_name}</div>
                  <div className="text-sm text-text-2 mt-0.5">
                    {item.type} • Código: {item.code} • {item.pages} página{item.pages > 1 ? 's' : ''}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-text-3 whitespace-nowrap">
                    Enviado por {item.sender}
                  </div>
                  <div className="text-xs text-text-3 mt-0.5">
                    {formatDateTime(item.date)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // Review Detail View
  return (
    <div>
      {/* Back Button */}
      <div className="mb-5">
        <button
          onClick={handleBackToQueue}
          className="bg-surface border border-border rounded-lg px-4 py-2 text-sm font-medium text-text hover:bg-surface-2 transition-colors flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar à fila
        </button>
      </div>

      {/* Document Header */}
      <div className="bg-surface border border-border rounded-lg p-5 mb-4">
        <h2 className="text-lg font-semibold">{selectedItem.patient_name}</h2>
        <div className="flex flex-wrap gap-5 mt-2.5">
          <span className="text-sm text-text-2">
            <strong className="text-text">Código:</strong> {selectedItem.code}
          </span>
          <span className="text-sm text-text-2">
            <strong className="text-text">CPF:</strong> {formatCPF(selectedItem.cpf)}
          </span>
          <span className="text-sm text-text-2">
            <strong className="text-text">Tipo:</strong> {selectedItem.type}
          </span>
          <span className="text-sm text-text-2">
            <strong className="text-text">Enviado por:</strong> {selectedItem.sender}
          </span>
          <span className="text-sm text-text-2">
            <strong className="text-text">Data:</strong> {formatDateTime(selectedItem.date)}
          </span>
        </div>
      </div>

      {/* Pages Viewer */}
      <div className="bg-surface border border-border rounded-lg overflow-hidden mb-4">
        <div className="px-5 py-3.5 border-b border-border bg-surface-2 flex items-center justify-between">
          <span className="text-sm font-medium text-text-2">Páginas do documento</span>
          <span className="text-xs text-text-3">Visualização simulada</span>
        </div>
        <div className="p-5 flex gap-3 flex-wrap">
          {Array.from({ length: selectedItem.pages }).map((_, i) => (
            <div
              key={i}
              className="w-20 h-[106px] bg-surface-2 border-2 border-border rounded-md flex flex-col items-center justify-center cursor-pointer hover:border-accent transition-colors"
            >
              <FileText className="w-6 h-6 text-text-3 mb-1" />
              <span className="text-[11px] text-text-3 font-semibold">Página {i + 1}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Decision */}
      <div className="bg-surface border border-border rounded-lg p-6">
        <h3 className="text-[15px] font-semibold mb-4">Decisão de revisão</h3>
        
        {/* Decision Buttons */}
        <div className="flex gap-2.5 mb-5">
          <button
            onClick={() => setDecision('approve')}
            className={`
              flex-1 rounded-lg py-3 px-4 text-sm font-medium flex items-center justify-center gap-2 transition-all
              ${decision === 'approve' 
                ? 'bg-accent text-white' 
                : 'bg-accent-light text-accent hover:bg-accent hover:text-white'}
            `}
          >
            <Check className="w-4 h-4" />
            Liberar prontuário
          </button>
          <button
            onClick={() => setDecision('reprove')}
            className={`
              flex-1 rounded-lg py-3 px-4 text-sm font-medium flex items-center justify-center gap-2 transition-all
              ${decision === 'reprove' 
                ? 'bg-danger text-white' 
                : 'bg-danger-light text-danger hover:bg-danger hover:text-white'}
            `}
          >
            <X className="w-4 h-4" />
            Não liberar
          </button>
        </div>

        {/* Approve Note */}
        {decision === 'approve' && (
          <div>
            <label className="block text-[13px] font-medium mb-2 text-text-2">
              Comentário de ressalva (opcional)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ex.: Página 3 com leve corte na margem, mas informações completas. Aprovado."
              rows={4}
              className="w-full border border-border rounded-lg px-3.5 py-2.5 text-sm bg-surface focus:border-accent transition-colors resize-y min-h-[90px]"
            />
            <button
              onClick={handleSubmitDecision}
              disabled={isSubmitting}
              className="mt-3 bg-accent text-white rounded-lg px-4 py-2.5 text-sm font-medium flex items-center gap-2 hover:opacity-88 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Check className="w-4 h-4" />
              {isSubmitting ? 'Processando...' : 'Confirmar liberação'}
            </button>
          </div>
        )}

        {/* Reprove Note */}
        {decision === 'reprove' && (
          <div>
            <p className="text-xs text-danger mb-2 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              O motivo é obrigatório para não liberar.
            </p>
            <label className="block text-[13px] font-medium mb-2 text-text-2">
              Motivo da não liberação <span className="text-danger">*</span>
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ex.: Faltam as páginas 4 e 5. CPF ilegível. Por favor reescanear o documento completo."
              rows={4}
              className="w-full border border-border rounded-lg px-3.5 py-2.5 text-sm bg-surface focus:border-accent transition-colors resize-y min-h-[90px]"
            />
            <button
              onClick={handleSubmitDecision}
              disabled={isSubmitting || !note.trim()}
              className="mt-3 bg-danger text-white rounded-lg px-4 py-2.5 text-sm font-medium flex items-center gap-2 hover:opacity-88 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <X className="w-4 h-4" />
              {isSubmitting ? 'Processando...' : 'Confirmar não liberação'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
