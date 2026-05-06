import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import styles from './LoginPage.module.css'

export default function LoginPage() {
  const [view, setView] = useState('login') // 'login' | 'forgot'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState('')
  const [resetSent, setResetSent] = useState(false)
  const { signIn, signInWithGoogle, resetPasswordRequest } = useAuth()
  const navigate = useNavigate()

  async function handleLogin(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signIn(email.trim(), password)
      navigate('/')
    } catch {
      setError('E-mail ou senha incorretos.')
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogle() {
    setError('')
    setGoogleLoading(true)
    try {
      await signInWithGoogle()
      // redirect handled by Supabase OAuth flow
    } catch {
      setError('Não foi possível entrar com o Google. Tente novamente.')
      setGoogleLoading(false)
    }
  }

  async function handleForgot(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await resetPasswordRequest(email.trim())
      setResetSent(true)
    } catch {
      setError('Não foi possível enviar o e-mail. Verifique o endereço e tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  function backToLogin() {
    setView('login')
    setResetSent(false)
    setError('')
  }

  return (
    <div className={styles.page}>
      <div className={styles.bgOrb1} />
      <div className={styles.bgOrb2} />

      {/* Left panel */}
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
          <div className={styles.featureList}>
            {[
              'Acesso controlado por perfis de usuário',
              'Fluxo de revisão e aprovação de documentos',
              'Auditoria completa de todas as ações',
            ].map((f, i) => (
              <div key={i} className={styles.featureItem}>
                <span className={styles.featureDot} />
                {f}
              </div>
            ))}
          </div>
        </div>
        <p className={styles.brandFooter}>© 2025 MedDoc · Uso restrito a profissionais autorizados</p>
      </div>

      {/* Right panel */}
      <div className={styles.formPanel}>
        <div className={styles.card}>
          <div className={styles.mobileLogoRow}>
            <div className={styles.mobileLogoMark}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="12" y1="12" x2="12" y2="18"/>
                <line x1="9" y1="15" x2="15" y2="15"/>
              </svg>
            </div>
            <span className={styles.mobileLogoText}>MedDoc</span>
          </div>

          {/* ── FORGOT PASSWORD VIEW ── */}
          {view === 'forgot' ? (
            <>
              <button onClick={backToLogin} className={styles.backBtn}>
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd"/>
                </svg>
                Voltar ao login
              </button>

              {resetSent ? (
                <div className={styles.successBox}>
                  <div className={styles.successIcon}>
                    <svg viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                    </svg>
                  </div>
                  <h2 className={styles.cardTitle}>E-mail enviado!</h2>
                  <p className={styles.cardSubtitle}>
                    Enviamos um link de redefinição para <strong>{email}</strong>. Verifique sua caixa de entrada e a pasta de spam.
                  </p>
                  <button onClick={backToLogin} className={styles.submitBtn} style={{marginTop: 8}}>
                    Voltar ao login
                  </button>
                </div>
              ) : (
                <>
                  <h2 className={styles.cardTitle}>Esqueceu a senha?</h2>
                  <p className={styles.cardSubtitle}>
                    Digite seu e-mail e enviaremos um link para criar uma nova senha.
                  </p>
                  <form onSubmit={handleForgot} className={styles.form}>
                    <div className={styles.field}>
                      <label htmlFor="reset-email" className={styles.label}>E-mail</label>
                      <div className={styles.inputWrap}>
                        <span className={styles.inputIconLeft}>
                          <svg viewBox="0 0 20 20" fill="currentColor">
                            <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"/>
                            <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"/>
                          </svg>
                        </span>
                        <input
                          id="reset-email"
                          type="email"
                          required
                          value={email}
                          onChange={e => setEmail(e.target.value)}
                          placeholder="voce@exemplo.com"
                          className={styles.input}
                        />
                      </div>
                    </div>
                    {error && <div className={styles.errorBox}>{error}</div>}
                    <button type="submit" disabled={loading} className={styles.submitBtn}>
                      {loading ? <><span className={styles.spinner} /> Enviando…</> : 'Enviar link de redefinição'}
                    </button>
                  </form>
                </>
              )}
            </>
          ) : (
            /* ── LOGIN VIEW ── */
            <>
              <h2 className={styles.cardTitle}>Bem-vindo de volta</h2>
              <p className={styles.cardSubtitle}>Entre com suas credenciais para acessar o sistema</p>

              {/* Google button */}
              <button onClick={handleGoogle} disabled={googleLoading} className={styles.googleBtn}>
                {googleLoading ? (
                  <span className={`${styles.spinner} ${styles.spinnerDark}`} />
                ) : (
                  <svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                    <path fill="none" d="M0 0h48v48H0z"/>
                  </svg>
                )}
                Entrar com Google
              </button>

              <div className={styles.divider}>
                <span>ou</span>
              </div>

              <form onSubmit={handleLogin} className={styles.form}>
                <div className={styles.field}>
                  <label htmlFor="email" className={styles.label}>E-mail</label>
                  <div className={styles.inputWrap}>
                    <span className={styles.inputIconLeft}>
                      <svg viewBox="0 0 20 20" fill="currentColor">
                        <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"/>
                        <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"/>
                      </svg>
                    </span>
                    <input
                      id="email"
                      type="email"
                      required
                      autoComplete="username"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="voce@exemplo.com"
                      className={styles.input}
                    />
                  </div>
                </div>

                <div className={styles.field}>
                  <div className={styles.labelRow}>
                    <label htmlFor="password" className={styles.label}>Senha</label>
                    <button type="button" onClick={() => setView('forgot')} className={styles.forgotLink}>
                      Esqueci minha senha
                    </button>
                  </div>
                  <div className={styles.inputWrap}>
                    <span className={styles.inputIconLeft}>
                      <svg viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"/>
                      </svg>
                    </span>
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoComplete="current-password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className={`${styles.input} ${styles.inputPad}`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                      className={styles.eyeBtn}
                    >
                      {showPassword ? (
                        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <path d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/>
                        </svg>
                      ) : (
                        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
                          <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                {error && <div className={styles.errorBox}>{error}</div>}

                <button type="submit" disabled={loading} className={styles.submitBtn}>
                  {loading ? <><span className={styles.spinner} /> Entrando…</> : 'Entrar no sistema'}
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
