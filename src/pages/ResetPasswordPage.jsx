import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/storage'
import styles from './LoginPage.module.css'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [validSession, setValidSession] = useState(false)
  const { updatePassword } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    // Supabase sets the session automatically when the user lands via the reset link
    supabase.auth.getSession().then(({ data: { session } }) => {
      setValidSession(!!session)
    })
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.')
      return
    }
    if (password !== confirm) {
      setError('As senhas não coincidem.')
      return
    }
    setLoading(true)
    try {
      await updatePassword(password)
      setDone(true)
      setTimeout(() => navigate('/'), 2500)
    } catch {
      setError('Não foi possível atualizar a senha. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.bgOrb1} />
      <div className={styles.bgOrb2} />

      <div className={styles.brandPanel}>
        <div className={styles.brandContent}>
          <div className={styles.brandLogoWrap}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="12" y1="12" x2="12" y2="18"/>
              <line x1="9" y1="15" x2="15" y2="15"/>
            </svg>
          </div>
          <h1 className={styles.brandName}>MedDoc</h1>
          <p className={styles.brandTagline}>Repositório seguro de prontuários médicos</p>
        </div>
        <p className={styles.brandFooter}>© 2025 MedDoc · Uso restrito a profissionais autorizados</p>
      </div>

      <div className={styles.formPanel}>
        <div className={styles.card}>
          <div className={styles.mobileLogoRow}>
            <div className={styles.mobileLogoMark}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
            </div>
            <span className={styles.mobileLogoText}>MedDoc</span>
          </div>

          {done ? (
            <div className={styles.successBox}>
              <div className={styles.successIcon}>
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                </svg>
              </div>
              <h2 className={styles.cardTitle}>Senha atualizada!</h2>
              <p className={styles.cardSubtitle}>Sua senha foi redefinida. Redirecionando para o sistema…</p>
            </div>
          ) : !validSession ? (
            <>
              <h2 className={styles.cardTitle}>Link inválido ou expirado</h2>
              <p className={styles.cardSubtitle}>Este link de redefinição é inválido ou já expirou. Solicite um novo na tela de login.</p>
              <button onClick={() => navigate('/login')} className={styles.submitBtn} style={{marginTop: 16}}>
                Ir para o login
              </button>
            </>
          ) : (
            <>
              <h2 className={styles.cardTitle}>Criar nova senha</h2>
              <p className={styles.cardSubtitle}>Escolha uma senha forte para sua conta.</p>

              <form onSubmit={handleSubmit} className={styles.form}>
                <div className={styles.field}>
                  <label htmlFor="new-password" className={styles.label}>Nova senha</label>
                  <div className={styles.inputWrap}>
                    <span className={styles.inputIconLeft}>
                      <svg viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"/>
                      </svg>
                    </span>
                    <input
                      id="new-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      className={`${styles.input} ${styles.inputPad}`}
                    />
                    <button type="button" onClick={() => setShowPassword(v => !v)} className={styles.eyeBtn} aria-label="Mostrar senha">
                      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
                        <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                      </svg>
                    </button>
                  </div>
                </div>

                <div className={styles.field}>
                  <label htmlFor="confirm-password" className={styles.label}>Confirmar senha</label>
                  <div className={styles.inputWrap}>
                    <span className={styles.inputIconLeft}>
                      <svg viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"/>
                      </svg>
                    </span>
                    <input
                      id="confirm-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={confirm}
                      onChange={e => setConfirm(e.target.value)}
                      placeholder="Repita a senha"
                      className={styles.input}
                    />
                  </div>
                </div>

                {error && <div className={styles.errorBox}>{error}</div>}

                <button type="submit" disabled={loading} className={styles.submitBtn}>
                  {loading ? <><span className={styles.spinner} /> Salvando…</> : 'Salvar nova senha'}
                </button>
              </form>
            </>
          )}

          <div className={styles.secNote}>
            <svg viewBox="0 0 16 16" fill="currentColor" style={{width:13,height:13}}>
              <path d="M8 1a2.5 2.5 0 00-2.5 2.5V5h-1A1.5 1.5 0 003 6.5v6A1.5 1.5 0 004.5 14h7a1.5 1.5 0 001.5-1.5v-6A1.5 1.5 0 0011.5 5h-1V3.5A2.5 2.5 0 008 1zm1.5 4h-3V3.5a1.5 1.5 0 013 0V5z"/>
            </svg>
            Conexão segura e criptografada
          </div>
        </div>
      </div>
    </div>
  )
}
