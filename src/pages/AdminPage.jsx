import { useState, useEffect, useCallback } from 'react'
import { supabase, profilesService } from '../lib/storage'
import { useAuth } from '../hooks/useAuth'
import { useAuditLog } from '../hooks/useAuditLog'
import toast from 'react-hot-toast'
import { PageHeader, BtnAccent, BtnSec, RoleBadge, Modal, Field, Input, Select } from '../components/UI'
import styles from './AdminPage.module.css'

export default function AdminPage() {
  const { user } = useAuth()
  const log = useAuditLog()
  const [stats,   setStats]   = useState(null)
  const [users,   setUsers]   = useState([])
  const [loading, setLoading] = useState(true)

  // Invite
  const [showInvite,  setShowInvite]  = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName,  setInviteName]  = useState('')
  const [inviteRole,  setInviteRole]  = useState('operador')
  const [inviting,    setInviting]    = useState(false)

  // Edit user
  const [editUser,   setEditUser]   = useState(null)
  const [editRole,   setEditRole]   = useState('')
  const [editActive, setEditActive] = useState(true)
  const [saving,     setSaving]     = useState(false)

  // Confirm delete
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting,     setDeleting]     = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: s }, { data: u }] = await Promise.all([
      supabase.from('dashboard_stats').select('*').single(),
      profilesService.list(),
    ])
    setStats(s)
    setUsers(u || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // ── CONVIDAR ────────────────────────────────────────────────
  async function handleInvite(e) {
    e.preventDefault()
    setInviting(true)
    try {
      const { data, error } = await profilesService.invite(inviteEmail, inviteRole, inviteName)
      if (error) throw new Error(error.message || 'Erro ao convidar')
      toast.success(`Convite enviado para ${inviteEmail}`)
      setShowInvite(false)
      setInviteEmail('')
      setInviteName('')
      load()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setInviting(false)
    }
  }

  // ── EDITAR ROLE / ATIVO ─────────────────────────────────────
  async function saveEdit() {
    setSaving(true)
    try {
      const { error } = await profilesService.adminAction('update_role', editUser.id, {
        role: editRole,
        active: editActive,
      })
      if (error) throw new Error(error.message)
      setUsers(u => u.map(x => x.id === editUser.id ? { ...x, role: editRole, active: editActive } : x))
      toast.success('Usuário atualizado.')
      setEditUser(null)
    } catch (err) {
      toast.error(err.message || 'Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  // ── RESET SENHA ─────────────────────────────────────────────
  async function handleResetPassword(u) {
    try {
      const { error } = await profilesService.adminAction('reset_password', u.id)
      if (error) throw new Error(error.message)
      toast.success(`E-mail de redefinição enviado para ${u.email || u.name}`)
    } catch (err) {
      toast.error(err.message || 'Erro ao enviar reset.')
    }
  }

  // ── EXCLUIR ─────────────────────────────────────────────────
  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const { error } = await profilesService.adminAction('delete_user', deleteTarget.id)
      if (error) throw new Error(error.message)
      setUsers(u => u.filter(x => x.id !== deleteTarget.id))
      toast.success(`Usuário "${deleteTarget.name}" excluído.`)
      setDeleteTarget(null)
    } catch (err) {
      toast.error(err.message || 'Erro ao excluir.')
    } finally {
      setDeleting(false)
    }
  }

  const S = (v) => loading ? '—' : (v ?? 0)

  return (
    <div>
      <PageHeader
        title="Painel Admin"
        subtitle="Estatísticas e gerenciamento de usuários"
        actions={
          <BtnAccent onClick={() => setShowInvite(true)}>
            <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <line x1="19" y1="8" x2="19" y2="14"/>
              <line x1="22" y1="11" x2="16" y2="11"/>
            </svg>
            Convidar usuário
          </BtnAccent>
        }
      />

      {/* Stats */}
      <div className={styles.statsGrid}>
        <StatCard value={S(stats?.total)}                  label="Total de prontuários"    color="accent"  />
        <StatCard value={S(stats?.pending)}                 label="Aguardando auditoria"    color="warning" />
        <StatCard value={S(stats?.approved)}                label="Liberados"               color="accent"  />
        <StatCard value={S(stats?.reproved)}                label="Não liberados"           color="danger"  />
        <StatCard value={S(stats?.active_users)}            label="Usuários ativos"         color="info"    />
        <StatCard value={S(stats?.logs_24h)}                label="Eventos nas últimas 24h" color="purple"  />
      </div>

      {/* Workflow stats */}
      <h2 className={styles.sectionTitle} style={{ marginTop: 24, marginBottom: 12 }}>Fluxo de Solicitações</h2>
      <div className={styles.statsGrid}>
        <StatCard value={S(stats?.workflow_received)}       label="Recebidas"               color="info"    />
        <StatCard value={S(stats?.workflow_approved)}       label="Aprovadas"               color="success" />
        <StatCard value={S(stats?.workflow_rejected)}       label="Recusadas"               color="danger"  />
        <StatCard value={S(stats?.workflow_in_production)}  label="Em produção"             color="warning" />
        <StatCard value={S(stats?.workflow_not_found)}      label="Não localizados"         color="danger"  />
        <StatCard value={S(stats?.workflow_in_audit)}       label="Em auditoria"            color="purple"  />
        <StatCard value={S(stats?.workflow_correction_needed)} label="Correção solicitada"  color="orange"  />
        <StatCard value={S(stats?.workflow_corrected)}      label="Corrigidos"              color="info"    />
        <StatCard value={S(stats?.workflow_concluded)}      label="Concluídos"              color="accent"  />
        <StatCard value={S(stats?.workflow_delivered)}      label="Entregues"               color="accent"  />
        <StatCard value={S(stats?.pending_reviewer_notes)}  label="Notas pendentes"         color="danger"  />
      </div>

      {/* Users table */}
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Usuários</h2>
        <button onClick={load} className={styles.btnRefresh} disabled={loading}>
          <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <polyline points="23 4 23 10 17 10"/>
            <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
          </svg>
          Atualizar
        </button>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Nome</th>
              <th>E-mail</th>
              <th>Role</th>
              <th>Status</th>
              <th>Criado em</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className={`${styles.row} ${!u.active ? styles.rowInactive : ''}`}>
                <td className={styles.tdName}>{u.name}</td>
                <td className={styles.tdEmail}>{u.email || '—'}</td>
                <td><RoleBadge role={u.role} /></td>
                <td>
                  <span className={u.active ? styles.badgeActive : styles.badgeInactive}>
                    {u.active ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                <td className={styles.tdDate}>
                  {new Date(u.created_at).toLocaleDateString('pt-BR')}
                </td>
                <td>
                  {/* Não mostra ações sobre o próprio usuário logado */}
                  {u.id !== user?.id ? (
                    <div className={styles.actionBtns}>
                      <BtnSec small onClick={() => { setEditUser(u); setEditRole(u.role); setEditActive(u.active) }}>
                        Editar
                      </BtnSec>
                      <button
                        className={styles.btnIconWarn}
                        title="Enviar reset de senha"
                        onClick={() => handleResetPassword(u)}
                      >
                        <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                          <path d="M7 11V7a5 5 0 0110 0v4"/>
                        </svg>
                      </button>
                      <button
                        className={styles.btnIconDanger}
                        title="Excluir usuário"
                        onClick={() => setDeleteTarget(u)}
                      >
                        <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <polyline points="3 6 5 6 21 6"/>
                          <path d="M19 6l-1 14H6L5 6"/>
                          <path d="M10 11v6M14 11v6"/>
                          <path d="M9 6V4h6v2"/>
                        </svg>
                      </button>
                    </div>
                  ) : (
                    <span className={styles.youBadge}>Você</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── MODAL: Convidar ── */}
      <Modal open={showInvite} onClose={() => setShowInvite(false)} title="Convidar usuário" width={440}>
        <form onSubmit={handleInvite}>
          <Field label="Nome (opcional)">
            <Input
              placeholder="Ex.: Maria Silva"
              value={inviteName}
              onChange={e => setInviteName(e.target.value)}
            />
          </Field>
          <Field label="E-mail" required>
            <Input
              type="email"
              placeholder="usuario@empresa.com"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              required
            />
          </Field>
          <Field label="Nível de acesso">
            <Select value={inviteRole} onChange={e => setInviteRole(e.target.value)}>
              <option value="operador">Operador — faz upload de prontuários</option>
              <option value="revisor">Revisor — valida solicitações e contata pacientes</option>
              <option value="auditor">Auditor — aprova ou reprova documentos</option>
              <option value="admin">Admin — acesso total ao sistema</option>
            </Select>
          </Field>
          <p className={styles.inviteNote}>
            O usuário receberá um e-mail com link para criar a senha. O role será aplicado automaticamente.
          </p>
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <BtnAccent type="submit" disabled={inviting}>
              {inviting && <span className="spinner" />}
              {inviting ? 'Enviando…' : 'Enviar convite'}
            </BtnAccent>
            <BtnSec type="button" onClick={() => setShowInvite(false)}>Cancelar</BtnSec>
          </div>
        </form>
      </Modal>

      {/* ── MODAL: Editar usuário ── */}
      <Modal open={!!editUser} onClose={() => setEditUser(null)} title="Editar usuário" width={400}>
        {editUser && (
          <div>
            <p className={styles.editName}>{editUser.name}</p>
            {editUser.email && <p className={styles.editEmail}>{editUser.email}</p>}

            <Field label="Nível de acesso">
              <Select value={editRole} onChange={e => setEditRole(e.target.value)}>
                <option value="operador">Operador</option>
                <option value="revisor">Revisor</option>
                <option value="auditor">Auditor</option>
                <option value="admin">Admin</option>
              </Select>
            </Field>

            <div className={styles.toggleRow}>
              <div>
                <label>Usuário ativo</label>
                <small>Usuários inativos não conseguem fazer login</small>
              </div>
              <label className={styles.toggle}>
                <input type="checkbox" checked={editActive} onChange={e => setEditActive(e.target.checked)} />
                <span className={styles.toggleSlider} />
              </label>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
              <BtnAccent onClick={saveEdit} disabled={saving}>
                {saving && <span className="spinner" />}
                {saving ? 'Salvando…' : 'Salvar'}
              </BtnAccent>
              <BtnSec onClick={() => setEditUser(null)} disabled={saving}>Cancelar</BtnSec>
            </div>
          </div>
        )}
      </Modal>

      {/* ── MODAL: Confirmar exclusão ── */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Excluir usuário" width={400}>
        {deleteTarget && (
          <div>
            <p className={styles.deleteWarning}>
              Tem certeza que deseja excluir permanentemente o usuário{' '}
              <strong>{deleteTarget.name}</strong>?
            </p>
            <p className={styles.deleteNote}>
              Esta ação não pode ser desfeita. Os prontuários enviados por este usuário serão preservados.
            </p>
            <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
              <button onClick={handleDelete} disabled={deleting} className={styles.btnDeleteConfirm}>
                {deleting ? 'Excluindo…' : 'Sim, excluir'}
              </button>
              <BtnSec onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancelar</BtnSec>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

function StatCard({ value, label, color }) {
  const colorMap = {
    accent:  { val: 'var(--accent)',  bg: 'var(--accent-light)'  },
    warning: { val: 'var(--warning)', bg: 'var(--warning-light)' },
    danger:  { val: 'var(--danger)',  bg: 'var(--danger-light)'  },
    info:    { val: 'var(--info)',    bg: 'var(--info-light)'    },
    purple:  { val: 'var(--purple)',  bg: 'var(--purple-light)'  },
  }
  const c = colorMap[color] || colorMap.accent
  return (
    <div className={styles.statCard} style={{ borderTopColor: c.val }}>
      <div className={styles.statValue} style={{ color: c.val }}>{value}</div>
      <div className={styles.statLabel}>{label}</div>
    </div>
  )
}
