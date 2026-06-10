'use client'

import { useSession, signOut } from 'next-auth/react'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect } from 'react'
import { 
  FileText, 
  Search, 
  Upload, 
  CheckSquare, 
  Users, 
  FileClock, 
  Settings,
  LogOut
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
  roles: string[]
  badge?: number
}

const navItems: NavItem[] = [
  { href: '/dashboard/busca', label: 'Buscar prontuários', icon: Search, roles: ['admin', 'revisor', 'atendente'] },
  { href: '/dashboard/upload', label: 'Fazer upload', icon: Upload, roles: ['admin', 'atendente'] },
  { href: '/dashboard/revisao', label: 'Fila de revisão', icon: CheckSquare, roles: ['admin', 'revisor'] },
  { href: '/dashboard/usuarios', label: 'Usuários', icon: Users, roles: ['admin'] },
  { href: '/dashboard/logs', label: 'Logs de auditoria', icon: FileClock, roles: ['admin'] },
  { href: '/dashboard/config', label: 'Configurações', icon: Settings, roles: ['admin'] },
]

const roleLabels: Record<string, { label: string; className: string }> = {
  admin: { label: 'ADMIN', className: 'bg-info-light text-info' },
  revisor: { label: 'REVISOR', className: 'bg-purple-light text-purple' },
  atendente: { label: 'ATENDENTE', className: 'bg-accent-light text-accent' },
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-text-2">Carregando...</div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  const userRole = session.user.role as string
  const roleConfig = roleLabels[userRole] || { label: userRole.toUpperCase(), className: 'bg-surface-2 text-text-2' }

  const visibleNavItems = navItems.filter(item => item.roles.includes(userRole))

  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <nav className="bg-surface border-b border-border px-8 h-[60px] flex items-center justify-between sticky top-0 z-50">
        <Link href="/dashboard/busca" className="flex items-center gap-2 font-semibold text-[17px] tracking-tight">
          <div className="w-7 h-7 bg-accent rounded-lg flex items-center justify-center">
            <FileText className="w-4 h-4 text-white" />
          </div>
          MedDoc
        </Link>

        <div className="flex items-center gap-3 text-sm text-text-2">
          <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full tracking-wide', roleConfig.className)}>
            {roleConfig.label}
          </span>
          <span>{session.user.name}</span>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="bg-transparent border border-border rounded-lg px-3 py-1.5 text-[13px] text-text-2 hover:bg-surface-2 transition-colors flex items-center gap-1.5"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>
      </nav>

      {/* Main Layout */}
      <div className="flex min-h-[calc(100vh-60px)]">
        {/* Sidebar */}
        <aside className="w-[220px] bg-surface border-r border-border py-6 px-3 flex-shrink-0 sticky top-[60px] h-[calc(100vh-60px)] overflow-y-auto">
          <div className="text-[10px] font-semibold tracking-wider text-text-3 uppercase px-2.5 mb-1.5">
            Menu
          </div>
          <nav className="space-y-0.5">
            {visibleNavItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all',
                    isActive 
                      ? 'bg-accent-light text-accent font-medium' 
                      : 'text-text-2 hover:bg-surface-2 hover:text-text'
                  )}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span className="flex-1">{item.label}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="ml-auto bg-danger text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                      {item.badge}
                    </span>
                  )}
                </Link>
              )
            })}
          </nav>
        </aside>

        {/* Content */}
        <main className="flex-1 p-8 max-w-[960px] animate-fade-in">
          {children}
        </main>
      </div>
    </div>
  )
}
