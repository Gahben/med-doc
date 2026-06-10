'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { FileText } from 'lucide-react'
import toast from 'react-hot-toast'

const demoProfiles = [
  { role: 'admin', email: 'admin@clinica.com', label: '🔑 Admin', color: 'hover:border-info hover:text-info hover:bg-info-light' },
  { role: 'revisor', email: 'revisor@clinica.com', label: '🔍 Revisor', color: 'hover:border-purple hover:text-purple hover:bg-purple-light' },
  { role: 'atendente', email: 'atendente@clinica.com', label: '📂 Atendente', color: 'hover:border-accent hover:text-accent hover:bg-accent-light' },
]

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email || !password) {
      toast.error('Preencha email e senha')
      return
    }

    setIsLoading(true)

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        toast.error('Credenciais inválidas')
      } else {
        toast.success('Login realizado com sucesso!')
        router.push('/dashboard/busca')
        router.refresh()
      }
    } catch (error) {
      toast.error('Erro ao fazer login')
    } finally {
      setIsLoading(false)
    }
  }

  const setDemoProfile = (profileEmail: string) => {
    setEmail(profileEmail)
    setPassword('senha123')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="bg-surface border border-border rounded-2xl p-12 w-full max-w-[400px] shadow">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-7 h-7 bg-accent rounded-lg flex items-center justify-center">
            <FileText className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-xl">MedDoc</span>
        </div>

        <h2 className="text-[22px] font-semibold mb-1.5">Acesso ao sistema</h2>
        <p className="text-sm text-text-2 mb-4">
          Entre com suas credenciais para acessar o repositório.
        </p>

        {/* Demo profiles */}
        <p className="text-xs text-text-3 mb-2.5">
          👆 Clique em um perfil para simular o acesso:
        </p>
        <div className="flex gap-1.5 flex-wrap mb-5">
          {demoProfiles.map((profile) => (
            <button
              key={profile.role}
              onClick={() => setDemoProfile(profile.email)}
              className={`bg-surface-2 border border-border rounded-full px-3 py-1 text-xs text-text-2 cursor-pointer transition-all ${profile.color}`}
            >
              {profile.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-[13px] font-medium mb-1.5 text-text-2">
              E-mail
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              className="w-full border border-border rounded-lg px-3.5 py-2.5 text-sm bg-surface text-text focus:border-accent transition-colors"
            />
          </div>

          <div className="mb-4">
            <label className="block text-[13px] font-medium mb-1.5 text-text-2">
              Senha
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full border border-border rounded-lg px-3.5 py-2.5 text-sm bg-surface text-text focus:border-accent transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-accent text-white border-none rounded-lg py-2.5 text-[15px] font-medium mt-2 hover:opacity-[0.88] transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
