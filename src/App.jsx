import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import LoginPage from './pages/LoginPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import Layout from './components/Layout'
import BuscaPage from './pages/BuscaPage'
import UploadPage from './pages/UploadPage'
import RevisaoPage from './pages/RevisaoPage'
import LogsPage from './pages/LogsPage'
import AdminPage from './pages/AdminPage'
import LixeiraPage from './pages/LixeiraPage'
import RevisorPage from './pages/RevisorPage'
import ProducaoPage from './pages/ProducaoPage'

function RequireAuth({ children, roles }) {
  const { user, profile, loading } = useAuth()

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <span className="spinner dark" />
    </div>
  )

  if (!user) return <Navigate to="/login" replace />
  if (roles && profile && !roles.includes(profile.role)) return <Navigate to="/" replace />

  return children
}

export default function App() {
  const { user } = useAuth()

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      <Route path="/" element={<RequireAuth><Layout /></RequireAuth>}>
        <Route index element={<Navigate to="/busca" replace />} />
        <Route path="busca" element={<BuscaPage />} />
        // Em App.jsx, atualizar as roles das rotas:
        <Route path="upload" element={
          <RequireAuth roles={['admin', 'operador']}><UploadPage /></RequireAuth>
        } />
        <Route path="revisao" element={
          <RequireAuth roles={['admin', 'auditor']}><RevisaoPage /></RequireAuth>
        } />
        <Route path="logs" element={
          <RequireAuth roles={['admin', 'auditor']}><LogsPage /></RequireAuth>
        } />
        <Route path="revisor" element={
          <RequireAuth roles={['admin', 'revisor']}><RevisorPage /></RequireAuth>
        } />
        <Route path="lixeira" element={
          <RequireAuth roles={['admin', 'auditor']}><LixeiraPage /></RequireAuth>
        } />
        <Route path="admin" element={
          <RequireAuth roles={['admin']}><AdminPage /></RequireAuth>
        } />
        <Route path="producao" element={
          <RequireAuth roles={['admin', 'operador']}><ProducaoPage /></RequireAuth>
        } />
      </Route>
      

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
