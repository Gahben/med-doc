import { createContext, useContext, useEffect, useState } from 'react'
import { authService, profilesService } from '../lib/storage'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    authService.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) loadProfile(session.user.id)
      else setLoading(false)
    })

    const { data: { subscription } } = authService.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) loadProfile(session.user.id)
      else { setProfile(null); setLoading(false) }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function loadProfile(userId) {
    const { data } = await profilesService.getById(userId)
    setProfile(data)
    setLoading(false)
  }

  async function signIn(email, password) {
    const { error } = await authService.signIn(email, password)
    if (error) throw error
  }

  async function signInWithGoogle() {
    const { error } = await authService.signInWithGoogle()
    if (error) throw error
  }

  async function resetPasswordRequest(email) {
    const { error } = await authService.resetPasswordRequest(email)
    if (error) throw error
  }

  async function updatePassword(newPassword) {
    const { error } = await authService.updatePassword(newPassword)
    if (error) throw error
  }

  async function signOut() {
    await authService.signOut()
    setUser(null)
    setProfile(null)
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signInWithGoogle, resetPasswordRequest, updatePassword, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
