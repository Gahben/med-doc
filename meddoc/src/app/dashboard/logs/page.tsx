'use client'

import { useState, useEffect, useCallback } from 'react'
import { Download, LogIn, Upload, CheckCircle, XCircle, FileDown, Printer, Eye, UserPlus, UserCog, Settings } from 'lucide-react'
import { AccessLog } from '@/types'
import { formatDateTime } from '@/lib/utils'
import toast from 'react-hot-toast'

const filters = [
  { value: 'all', label: 'Todos' },
  { value: 'login', label: 'Acessos' },
  { value: 'upload', label: 'Uploads' },
  { value: 'approved', label: 'Aprovações' },
  { value: 'reproved', label: 'Reprovações' },
  { value: 'download', label: 'Downloads' },
  { value: 'print', label: 'Impressões' },
]

const actionIcons: Record<string, React.ElementType> = {
  login: LogIn,
  logout: LogIn,
  upload: Upload,
  approved: CheckCircle,
  reproved: XCircle,
  download: FileDown,
  print: Printer,
  view: Eye,
  user_create: UserPlus,
  user_update: UserCog,
  config_update: Settings,
}

const actionLabels: Record<string, string> = {
  login: 'Login no sistema',
  logout: 'Logout do sistema',
  upload: 'Upload de prontuário',
  approved: 'Prontuário liberado',
  reproved: 'Prontuário não liberado',
  download: 'Download de prontuário',
  print: 'Impressão de prontuário',
  view: 'Visualização de prontuário',
  user_create: 'Criação de usuário',
  user_update: 'Atualização de usuário',
  config_update: 'Atualização de configurações',
}

const actionColors: Record<string, string> = {
  login: 'bg-surface-2 text-text-2',
  logout: 'bg-surface-2 text-text-2',
  upload: 'bg-accent-light text-accent',
  approved: 'bg-accent-light text-accent',
  reproved: 'bg-danger-light text-danger',
  download: 'bg-info-light text-info',
  print: 'bg-accent-2-light text-accent-2',
  view: 'bg-surface-2 text-text-2',
  user_create: 'bg-purple-light text-purple',
  user_update: 'bg-purple-light text-purple',
  config_update: 'bg-info-light text-info',
}

export default function LogsPage() {
  const [logs, setLogs] = useState<AccessLog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState('all')

  const fetchLogs = useCallback(async () => {
    try {
      setIsLoading(true)
      const params = new URLSearchParams()
      if (activeFilter !== 'all') params.append('action', activeFilter)
      
      const response = await fetch(`/api/admin/logs?${params}`)
      const data = await response.json()
      
      if (response.ok) {
        setLogs(data.logs || [])
      } else {
        toast.error('Erro ao carregar logs')
      }
    } catch (error) {
      toast.error('Erro ao carregar logs')
    } finally {
      setIsLoading(false)
    }
  }, [activeFilter])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  const handleExport = () => {
    // Create CSV content
    const headers = ['Data/Hora', 'Usuário', 'Ação', 'Detalhes', 'IP']
    const rows = logs.map(log => [
      formatDateTime(log.created_at),
      log.user_name,
      actionLabels[log.action] || log.action,
      log.details || '',
      log.ip_address || '',
    ])
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n')
    
    // Download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `logs-meddoc-${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    
    toast.success('Exportando CSV...')
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-7">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight">Logs de auditoria</h1>
          <p className="text-sm text-text-2 mt-1">Registro de todas as ações no sistema</p>
        </div>
        <button
          onClick={handleExport}
          className="bg-surface border border-border rounded-lg px-4 py-2.5 text-sm font-medium text-text hover:bg-surface-2 transition-colors flex items-center gap-2"
        >
          <Download className="w-4 h-4" />
          Exportar CSV
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {filters.map((filter) => (
          <button
            key={filter.value}
            onClick={() => setActiveFilter(filter.value)}
            className={`
              rounded-full px-3.5 py-1.5 text-[13px] transition-all
              ${activeFilter === filter.value
                ? 'bg-accent-light border border-accent text-accent font-medium'
                : 'bg-surface border border-border text-text-2 hover:bg-accent-light hover:border-accent hover:text-accent'}
            `}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* Logs List */}
      <div className="bg-surface border border-border rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="text-center py-12 text-text-3">Carregando...</div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-10 h-10 bg-surface-2 rounded-full flex items-center justify-center mx-auto mb-3">
              <LogIn className="w-5 h-5 text-text-3" />
            </div>
            <h3 className="text-base font-semibold mb-1">Nenhum log encontrado</h3>
            <p className="text-sm text-text-2">Não há registros para o filtro selecionado</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {logs.map((log) => {
              const Icon = actionIcons[log.action] || LogIn
              const colorClass = actionColors[log.action] || 'bg-surface-2 text-text-2'
              
              return (
                <div key={log.id} className="flex gap-3.5 p-3 items-start">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${colorClass}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">
                      {actionLabels[log.action] || log.action}
                    </div>
                    {log.details && (
                      <div className="text-[13px] text-text-2 mt-0.5 truncate">
                        {log.details}
                      </div>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-xs text-text-3 whitespace-nowrap">
                      {formatDateTime(log.created_at)}
                    </div>
                    <div className="text-xs text-text-3 mt-0.5">
                      {log.user_name}
                    </div>
                    {log.ip_address && (
                      <div className="text-[10px] text-text-3 mt-0.5 font-mono">
                        {log.ip_address}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
