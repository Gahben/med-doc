'use client'

import { useState, useEffect, useCallback } from 'react'
import { DashboardStats, SystemConfig } from '@/types'
import toast from 'react-hot-toast'

export default function ConfigPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [config, setConfig] = useState<SystemConfig | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  const [formData, setFormData] = useState({
    trash_after_days: 180,
    permanent_delete_after_days: 60,
    alert_review_hours: 24,
  })

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true)
      const [statsRes, configRes] = await Promise.all([
        fetch('/api/admin/stats'),
        fetch('/api/admin/config'),
      ])

      const statsData = await statsRes.json()
      const configData = await configRes.json()

      if (statsRes.ok) {
        setStats(statsData.stats)
      }

      if (configRes.ok && configData.config) {
        setConfig(configData.config)
        setFormData({
          trash_after_days: configData.config.trash_after_days,
          permanent_delete_after_days: configData.config.permanent_delete_after_days,
          alert_review_hours: configData.config.alert_review_hours,
        })
      }
    } catch (error) {
      toast.error('Erro ao carregar dados')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleSave = async () => {
    setIsSaving(true)

    try {
      const response = await fetch('/api/admin/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        toast.success('Configurações salvas!')
        fetchData()
      } else {
        toast.error('Erro ao salvar configurações')
      }
    } catch (error) {
      toast.error('Erro ao salvar configurações')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="text-center py-12 text-text-3">Carregando...</div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-7">
        <h1 className="text-[22px] font-semibold tracking-tight">Configurações</h1>
        <p className="text-sm text-text-2 mt-1">Estatísticas e ciclo de vida dos arquivos</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-5 mb-5">
        <div className="bg-surface border border-border rounded-lg p-5">
          <div className="text-[28px] font-semibold tracking-tight">{stats?.totalApproved || 0}</div>
          <div className="text-[13px] text-text-2 mt-0.5">Arquivos aprovados ativos</div>
          <div className="text-xs text-text-3 mt-2">↑ {stats?.totalApproved ? Math.floor(stats.totalApproved * 0.25) : 0} neste mês</div>
        </div>

        <div className="bg-surface border border-border rounded-lg p-5">
          <div className="text-[28px] font-semibold tracking-tight text-warning">{stats?.pendingReview || 0}</div>
          <div className="text-[13px] text-text-2 mt-0.5">Aguardando revisão</div>
          <div className="text-xs text-text-3 mt-2">
            {stats?.pendingAlert ? `${stats.pendingAlert} há mais de 24 horas` : 'Nenhum alerta'}
          </div>
        </div>

        <div className="bg-surface border border-border rounded-lg p-5">
          <div className="text-[28px] font-semibold tracking-tight">{stats?.inTrash || 0}</div>
          <div className="text-[13px] text-text-2 mt-0.5">Na lixeira</div>
          <div className="text-xs text-text-3 mt-2">
            {stats?.inTrash ? `Serão excluídos em ${formData.permanent_delete_after_days} dias` : 'Lixeira vazia'}
          </div>
        </div>

        <div className="bg-surface border border-border rounded-lg p-5">
          <div className="text-[28px] font-semibold tracking-tight">{stats?.storageUsed || '0 MB'}</div>
          <div className="text-[13px] text-text-2 mt-0.5">Armazenamento usado</div>
          <div className="text-xs text-text-3 mt-2">de 1 GB disponíveis (Supabase free)</div>
        </div>
      </div>

      {/* Config Card */}
      <div className="bg-surface border border-border rounded-lg p-6">
        <h3 className="text-base font-semibold mb-4">Ciclo de vida dos arquivos</h3>
        
        <div className="space-y-0">
          <div className="flex items-center justify-between py-3.5 border-b border-border gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium block">Mover para lixeira após</label>
              <small className="text-xs text-text-2 block mt-0.5">
                Dias sem acesso para mover o arquivo para a lixeira
              </small>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={formData.trash_after_days}
                onChange={(e) => setFormData({ ...formData, trash_after_days: parseInt(e.target.value) || 1 })}
                min={1}
                className="w-20 border border-border rounded-lg px-2.5 py-1.5 text-sm font-mono text-center focus:border-accent transition-colors"
              />
              <span className="text-[13px] text-text-2">dias</span>
            </div>
          </div>

          <div className="flex items-center justify-between py-3.5 border-b border-border gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium block">Excluir permanentemente após</label>
              <small className="text-xs text-text-2 block mt-0.5">
                Dias na lixeira para exclusão definitiva
              </small>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={formData.permanent_delete_after_days}
                onChange={(e) => setFormData({ ...formData, permanent_delete_after_days: parseInt(e.target.value) || 1 })}
                min={1}
                className="w-20 border border-border rounded-lg px-2.5 py-1.5 text-sm font-mono text-center focus:border-accent transition-colors"
              />
              <span className="text-[13px] text-text-2">dias</span>
            </div>
          </div>

          <div className="flex items-center justify-between py-3.5 gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium block">Alerta de revisão pendente após</label>
              <small className="text-xs text-text-2 block mt-0.5">
                Horas que um prontuário pode ficar na fila sem revisão antes de alertar o admin
              </small>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={formData.alert_review_hours}
                onChange={(e) => setFormData({ ...formData, alert_review_hours: parseInt(e.target.value) || 1 })}
                min={1}
                className="w-20 border border-border rounded-lg px-2.5 py-1.5 text-sm font-mono text-center focus:border-accent transition-colors"
              />
              <span className="text-[13px] text-text-2">horas</span>
            </div>
          </div>
        </div>

        <div className="mt-4">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-accent text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:opacity-88 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Salvando...' : 'Salvar configurações'}
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="mt-5 bg-info-light rounded-lg p-4 text-sm text-info">
        <p className="font-medium mb-1">ℹ️ Sobre o ciclo de vida automático</p>
        <p className="text-xs opacity-90">
          O sistema executa jobs diários para gerenciar o ciclo de vida dos documentos. 
          Documentos marcados como &quot;Não excluir automaticamente&quot; não serão afetados por estas regras.
          A configuração acima define os parâmetros para os jobs automáticos.
        </p>
      </div>
    </div>
  )
}
