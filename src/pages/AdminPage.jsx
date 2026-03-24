import { useState, useEffect } from 'react'
import { supabase, profilesService } from '../lib/storage'
import { useAuditLog } from '../hooks/useAuditLog'
import toast from 'react-hot-toast'
import { PageHeader, BtnAccent, BtnSec, RoleBadge, Modal, Field, Input, Select, Card } from '../components/UI'
import styles from './AdminPage.module.css'

export default function AdminPage() {
  const log = useAuditLog()
  const [stats, setStats]   = useState(null)
  const [users, setUsers]   = useState([])
  const [loading, setLoading] = useState(true)

  const [showInvite, setShowInvite]   = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole]   = useState('operador')
  const [inviting, setInviting]       = useState(false)

  const [editUser, setEditUser]     = useState(null)
  const [editRole, setEditRole]     = useState('')
  const [editActive, setEditActive] = useState(true)
  const [saving, setSaving]         = useState(false)

  useEffect(() => {
    async function load() {
      const [{ data: s }, { data: u }] = await Promise.all([
        supabase.from('dashboard_stats').select('*').single(),
        profilesService.list(),
      ])
      setStats(s)
      setUsers(u || [])
      setLoading(false)
    }
    load()
  }, [])

  async function handleInvite(e) {
    e.preventDefault()
    if (!inviteEmail) { toast.error('Informe o e-mail.'); return }
    setInviting(true)
    try {
      const { error } = await supabase.auth.admin.inviteUserByEmail(inviteEmail, {
        data: { role: inviteRole },
      })
      if (error) throw error
      toast.success(`Convite enviado para ${inviteEmail}`)
      setShowInvite(false)
      setInviteEmail('')
    } catch (err) {
      // Admin API só disponível server-side; orientar o uso de Edge Function
      toast.error('Use a Edge Function "invite-user" ou convide pelo painel do Supabase.')
      console.error(err)
    } finally {
      setInviting(false)
    }
  }

  async function saveEdit() {
    setSaving(true)
    try {
      const { data } = await profilesService.update(editUser.id, { role: editRole, active: editActive })
      setUsers(u => u.map(x => x.id === editUser.id ? { ...x, role: editRole, active: editActive } : x))
      await log('login', `Alterou perfil de ${editUser.name}: role=${editRole}`)
      toast.success('Usuário atualizado.')
      setEditUser(null)
    } catch {
      toast.error('Erro ao salvar.')
    } finally {
      setSaving(false)
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
              <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
              <line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>
            </svg>
            Convidar usuário
          </BtnAccent>
        }
      />

      {/* Stats */}
      <div className={styles.statsGrid}>
        <StatCard value={S(stats?.total)}    label="Total de prontuários" color="accent" />
        <StatCard value={S(stats?.pending)}   label="Aguardando revisão"   color="warning" />
        <StatCard value={S(stats?.approved)}  label="Liberados"            color="accent" />
        <StatCard value={S(stats?.reproved)}  label="Não liberados"        color="danger" />
        <StatCard value={S(stats?.active_users)} label="Usuários ativos"  color="info" />
        <StatCard value={S(stats?.logs_24h)}  label="Eventos nas últimas 24h" color="purple" />
      </div>

      {/* Users table */}
      <h2 className={styles.sectionTitle}>Usuários</h2>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Nome</th>
              <th>Role</th>
              <th>Status</th>
              <th>Criado em</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className={styles.row}>
                <td className={styles.tdName}>{u.name}</td>
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
                  <BtnSec small onClick={() => { setEditUser(u); setEditRole(u.role); setEditActive(u.active) }}>
                    Editar
                  </BtnSec>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Invite Modal */}
      <Modal open={showInvite} onClose={() => setShowInvite(false)} title="Convidar usuário" width={420}>
        <form onSubmit={handleInvite}>
          <Field label="E-mail" required>
            <Input
              type="email"
              placeholder="usuario@empresa.com"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
            />
          </Field>
          <Field label="Role">
            <Select value={inviteRole} onChange={e => setInviteRole(e.target.value)}>
              <option value="operador">Operador</option>
              <option value="revisor">Revisor</option>
              <option value="admin">Admin</option>
            </Select>
          </Field>
          <p className={styles.inviteNote}>
            💡 O convite por API Admin exige uma Edge Function. Como alternativa, convide pelo painel do Supabase em <em>Auth → Users → Invite user</em> e depois atualize o role aqui.
          </p>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <BtnAccent type="submit" disabled={inviting}>
              {inviting ? <span className="spinner" /> : null}
              {inviting ? 'Enviando…' : 'Enviar convite'}
            </BtnAccent>
            <BtnSec type="button" onClick={() => setShowInvite(false)}>Cancelar</BtnSec>
          </div>
        </form>
      </Modal>

      {/* Edit user Modal */}
      <Modal open={!!editUser} onClose={() => setEditUser(null)} title="Editar usuário" width={380}>
        {editUser && (
          <div>
            <p className={styles.editName}>{editUser.name}</p>
            <Field label="Role">
              <Select value={editRole} onChange={e => setEditRole(e.target.value)}>
                <option value="operador">Operador</option>
                <option value="revisor">Revisor</option>
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
                {saving ? <span className="spinner" /> : null}
                {saving ? 'Salvando…' : 'Salvar'}
              </BtnAccent>
              <BtnSec onClick={() => setEditUser(null)} disabled={saving}>Cancelar</BtnSec>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

function StatCard({ value, label, color }) {
  const colorMap = {
    accent:  { val: 'var(--accent)',   bg: 'var(--accent-light)' },
    warning: { val: 'var(--warning)',  bg: 'var(--warning-light)' },
    danger:  { val: 'var(--danger)',   bg: 'var(--danger-light)' },
    info:    { val: 'var(--info)',     bg: 'var(--info-light)' },
    purple:  { val: 'var(--purple)',   bg: 'var(--purple-light)' },
  }
  const c = colorMap[color] || colorMap.accent
  return (
    <div className={styles.statCard} style={{ borderTopColor: c.val }}>
      <div className={styles.statValue} style={{ color: c.val }}>{value}</div>
      <div className={styles.statLabel}>{label}</div>
    </div>
  )
}
