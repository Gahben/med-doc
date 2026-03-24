import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useAuditLog } from '../hooks/useAuditLog'
import toast from 'react-hot-toast'
import styles from './LoginPage.module.css'

const DEMO_USERS = [
  { label: 'Admin', email: 'admin@meddoc.local', password: 'admin123' },
  { label: 'Revisor', email: 'revisor@meddoc.local', password: 'revisor123' },
  { label: 'Operador', email: 'operador@meddoc.local', password: 'operador123' },
]

export default function LoginPage() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email || !password) { toast.error('Preencha e-mail e senha.'); return }
    setLoading(true)
    try {
      await signIn(email, password)
      toast.success('Bem-vindo!')
    } catch (err) {
      toast.error('E-mail ou senha incorretos.')
    } finally {
      setLoading(false)
    }
  }

  function fillDemo(user) {
    setEmail(user.email)
    setPassword(user.password)
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>
          <div className={styles.logoMark}>
            <svg fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
          </div>
          MedDoc
        </div>

        <h2>Entrar no sistema</h2>
        <p>Repositório seguro de prontuários médicos</p>

        {/* Demo pills */}
        <div className={styles.demoPills}>
          {DEMO_USERS.map(u => (
            <button key={u.label} className={styles.demoPill} type="button" onClick={() => fillDemo(u)}>
              {u.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label>E-mail</label>
            <input
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
          <div className={styles.field}>
            <label>Senha</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <button className={styles.btnPrimary} type="submit" disabled={loading}>
            {loading ? <span className="spinner" /> : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
