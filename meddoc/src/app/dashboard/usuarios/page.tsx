'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Edit2, Ban, X, Check } from 'lucide-react'
import { User } from '@/types'
import { getRoleBadge, formatDateTime } from '@/lib/utils'
import toast from 'react-hot-toast'

const roles = [
  { value: 'atendente', label: 'Atendente' },
  { value: 'revisor', label: 'Revisor' },
  { value: 'admin', label: 'Admin do sistema' },
]

export default function UsuariosPage() {
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'atendente',
    password: 'Clinica@2025',
    active: true,
  })

  const fetchUsers = useCallback(async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/admin/users')
      const data = await response.json()
      
      if (response.ok) {
        setUsers(data.users || [])
      } else {
        toast.error('Erro ao carregar usuários')
      }
    } catch (error) {
      toast.error('Erro ao carregar usuários')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const openCreateModal = () => {
    setEditingUser(null)
    setFormData({
      name: '',
      email: '',
      role: 'atendente',
      password: 'Clinica@2025',
      active: true,
    })
    setShowModal(true)
  }

  const openEditModal = (user: User) => {
    setEditingUser(user)
    setFormData({
      name: user.name,
      email: user.email,
      role: user.role,
      password: '',
      active: user.active,
    })
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingUser(null)
  }

  const handleSubmit = async () => {
    if (!formData.name.trim() || !formData.email.trim()) {
      toast.error('Nome e email são obrigatórios')
      return
    }

    if (!editingUser && !formData.password) {
      toast.error('Senha é obrigatória para novo usuário')
      return
    }

    try {
      const url = '/api/admin/users'
      const method = editingUser ? 'PATCH' : 'POST'
      const body = editingUser 
        ? { 
            id: editingUser.id,
            name: formData.name,
            role: formData.role,
            active: formData.active,
            ...(formData.password && { password: formData.password }),
          }
        : formData

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (response.ok) {
        toast.success(editingUser ? 'Usuário atualizado!' : 'Usuário criado!')
        fetchUsers()
        closeModal()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Erro ao salvar usuário')
      }
    } catch (error) {
      toast.error('Erro ao salvar usuário')
    }
  }

  const handleToggleActive = async (user: User) => {
    try {
      const response = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: user.id,
          active: !user.active,
        }),
      })

      if (response.ok) {
        toast.success(user.active ? 'Usuário desativado' : 'Usuário ativado')
        fetchUsers()
      } else {
        toast.error('Erro ao atualizar usuário')
      }
    } catch (error) {
      toast.error('Erro ao atualizar usuário')
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-7">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight">Usuários</h1>
          <p className="text-sm text-text-2 mt-1">Gerencie os acessos ao sistema</p>
        </div>
        <button
          onClick={openCreateModal}
          className="bg-accent text-white rounded-lg px-4 py-2.5 text-sm font-medium flex items-center gap-2 hover:opacity-88 transition-opacity"
        >
          <Plus className="w-4 h-4" />
          Novo usuário
        </button>
      </div>

      {/* Table */}
      <div className="bg-surface border border-border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-surface-2 border-b border-border">
              <th className="text-left text-xs font-semibold text-text-2 uppercase tracking-wide py-3 px-4">Nome</th>
              <th className="text-left text-xs font-semibold text-text-2 uppercase tracking-wide py-3 px-4">E-mail</th>
              <th className="text-left text-xs font-semibold text-text-2 uppercase tracking-wide py-3 px-4">Perfil</th>
              <th className="text-left text-xs font-semibold text-text-2 uppercase tracking-wide py-3 px-4">Último acesso</th>
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
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-text-3">
                  Nenhum usuário encontrado
                </td>
              </tr>
            ) : (
              users.map((user) => {
                const role = getRoleBadge(user.role)
                
                return (
                  <tr key={user.id} className="border-b border-border hover:bg-surface-2 transition-colors">
                    <td className="py-3 px-4 text-sm font-medium">{user.name}</td>
                    <td className="py-3 px-4 text-sm font-mono text-text-2">{user.email}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full ${role.className}`}>
                        {role.label}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-text-2">
                      {user.last_login ? formatDateTime(user.last_login) : 'Nunca'}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full ${
                        user.active ? 'bg-accent-light text-accent' : 'bg-danger-light text-danger'
                      }`}>
                        {user.active ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => openEditModal(user)}
                          className="p-1.5 border border-border rounded-md text-text-2 hover:bg-surface-2 hover:text-text transition-colors"
                          title="Editar"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleToggleActive(user)}
                          className={`p-1.5 border border-border rounded-md transition-colors ${
                            user.active 
                              ? 'text-text-2 hover:bg-danger-light hover:text-danger hover:border-danger' 
                              : 'text-text-2 hover:bg-accent-light hover:text-accent hover:border-accent'
                          }`}
                          title={user.active ? 'Desativar' : 'Ativar'}
                        >
                          {user.active ? <Ban className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                        </button>
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
      {showModal && (
        <div 
          className="fixed inset-0 bg-black/35 z-50 flex items-center justify-center p-5"
          onClick={(e) => e.target === e.currentTarget && closeModal()}
        >
          <div className="bg-surface rounded-xl p-8 max-w-[420px] w-full shadow-lg">
            <h3 className="text-lg font-semibold mb-1.5">
              {editingUser ? 'Editar usuário' : 'Novo usuário'}
            </h3>
            <p className="text-sm text-text-2 mb-5">
              {editingUser ? 'Atualize os dados do usuário' : 'Preencha os dados para criar o acesso'}
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-[13px] font-medium mb-1.5 text-text-2">
                  Nome completo
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex.: Fernanda Lima"
                  className="w-full border border-border rounded-lg px-3.5 py-2.5 text-sm bg-surface focus:border-accent transition-colors"
                />
              </div>

              <div>
                <label className="block text-[13px] font-medium mb-1.5 text-text-2">
                  E-mail
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="fernanda@clinica.com"
                  disabled={!!editingUser}
                  className="w-full border border-border rounded-lg px-3.5 py-2.5 text-sm bg-surface focus:border-accent transition-colors disabled:bg-surface-2 disabled:text-text-2 disabled:cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-[13px] font-medium mb-1.5 text-text-2">
                  Perfil de acesso
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full border border-border rounded-lg px-3.5 py-2.5 text-sm bg-surface focus:border-accent transition-colors appearance-none cursor-pointer"
                >
                  {roles.map((role) => (
                    <option key={role.value} value={role.value}>{role.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[13px] font-medium mb-1.5 text-text-2">
                  {editingUser ? 'Nova senha (deixe em branco para manter)' : 'Senha temporária'}
                </label>
                <input
                  type="text"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder={editingUser ? '••••••••' : 'Clinica@2025'}
                  className="w-full border border-border rounded-lg px-3.5 py-2.5 text-sm bg-surface focus:border-accent transition-colors"
                />
              </div>

              {editingUser && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="active"
                    checked={formData.active}
                    onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                    className="w-4 h-4 accent-accent"
                  />
                  <label htmlFor="active" className="text-sm">Usuário ativo</label>
                </div>
              )}
            </div>

            <div className="flex gap-2.5 mt-6">
              <button
                onClick={handleSubmit}
                className="bg-accent text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:opacity-88 transition-opacity"
              >
                {editingUser ? 'Salvar alterações' : 'Criar usuário'}
              </button>
              <button
                onClick={closeModal}
                className="bg-transparent border border-border rounded-lg px-4 py-2.5 text-sm font-medium text-text-2 hover:bg-surface-2 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
