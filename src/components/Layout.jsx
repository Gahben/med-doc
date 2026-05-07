import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useAuditLog } from '../hooks/useAuditLog'
import { useState, useEffect } from 'react'
import { prontuariosService } from '../lib/storage'
import styles from './Layout.module.css'

const Icons = {
  search: <svg fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  upload: <svg fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>,
  review: <svg fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>,
  logs:   <svg fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  trash:  <svg fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>,
  admin:  <svg fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 10-16 0"/></svg>,
  logout: <svg fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>,
  file:   <svg fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
}

const roleBadgeClass = { admin: 'admin', auditor: 'auditor', revisor: 'revisor', operador: 'operador' }

export default function Layout() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const log = useAuditLog()
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    // Auditores veem a fila de revisão de documentos; revisores não (recebem via sistema externo)
    if (profile?.role === 'admin' || profile?.role === 'auditor') {
      prontuariosService.list({ status: 'pending', perPage: 1 }).then(({ count }) => {
        if (count) setPendingCount(count)
      })
    }
  }, [profile])

  async function handleSignOut() {
    await log('login', 'Logout realizado')
    await signOut()
    navigate('/login')
  }

  const canUpload  = profile?.role === 'admin' || profile?.role === 'operador'
  const canAudit   = profile?.role === 'admin' || profile?.role === 'auditor'
  const canReview  = profile?.role === 'admin' || profile?.role === 'revisor'
  const isAdmin    = profile?.role === 'admin'

  return (
    <div className={styles.root}>
      {/* NAV */}
      <nav className={styles.nav}>
        <div className={styles.logo}>
          <div className={styles.logoMark}>{Icons.file}</div>
          MedDoc
        </div>
        <div className={styles.navUser}>
          <span>{profile?.name}</span>
          <span className={`${styles.navBadge} ${styles[roleBadgeClass[profile?.role] ?? 'operador']}`}>
            {profile?.role}
          </span>
          <button className={styles.btnLogout} onClick={handleSignOut} title="Sair">
            {Icons.logout}
          </button>
        </div>
      </nav>

      <div className={styles.mainLayout}>
        {/* SIDEBAR */}
        <aside className={styles.sidebar}>
          <span className={styles.sidebarLabel}>Principal</span>
          <NavLink to="/busca" className={({ isActive }) => `${styles.sidebarItem} ${isActive ? styles.active : ''}`}>
            {Icons.search} Busca
          </NavLink>
          {canUpload && (
            <NavLink to="/upload" className={({ isActive }) => `${styles.sidebarItem} ${isActive ? styles.active : ''}`}>
              {Icons.upload} Upload
            </NavLink>
          )}
          {canAudit && (
            <NavLink to="/revisao" className={({ isActive }) => `${styles.sidebarItem} ${isActive ? styles.active : ''}`}>
              {Icons.review} Auditoria
              {pendingCount > 0 && <span className={styles.sidebarBadge}>{pendingCount}</span>}
            </NavLink>
          )}
          {canAudit && (
            <>
              <span className={styles.sidebarLabel}>Auditoria</span>
              <NavLink to="/logs" className={({ isActive }) => `${styles.sidebarItem} ${isActive ? styles.active : ''}`}>
                {Icons.logs} Logs
              </NavLink>
            </>
          )}
          {canReview && (
            <NavLink to="/revisor" className={({ isActive }) => `${styles.sidebarItem} ${isActive ? styles.active : ''}`}>
              {Icons.review} Solicitações
            </NavLink>
          )}
          {isAdmin && (
            <>
              <span className={styles.sidebarLabel}>Administração</span>
              <NavLink to="/lixeira" className={({ isActive }) => `${styles.sidebarItem} ${isActive ? styles.active : ''}`}>
                {Icons.trash} Lixeira
              </NavLink>
              <NavLink to="/admin" className={({ isActive }) => `${styles.sidebarItem} ${isActive ? styles.active : ''}`}>
                {Icons.admin} Admin
              </NavLink>
            </>
          )}
        </aside>

        {/* CONTENT */}
        <main className={styles.content}>
          <div className="fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
