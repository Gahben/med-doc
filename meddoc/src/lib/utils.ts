//apenas garantindo que está comitado
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCPF(cpf: string): string {
  const cleaned = cpf.replace(/\D/g, '')
  if (cleaned.length !== 11) return cpf
  return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
}

export function validateCPF(cpf: string): boolean {
  const cleaned = cpf.replace(/\D/g, '')
  if (cleaned.length !== 11) return false
  if (/^(\d)\1{10}$/.test(cleaned)) return false

  let sum = 0
  let remainder

  for (let i = 1; i <= 9; i++) {
    sum += parseInt(cleaned.substring(i - 1, i)) * (11 - i)
  }

  remainder = (sum * 10) % 11
  if (remainder === 10 || remainder === 11) remainder = 0
  if (remainder !== parseInt(cleaned.substring(9, 10))) return false

  sum = 0
  for (let i = 1; i <= 10; i++) {
    sum += parseInt(cleaned.substring(i - 1, i)) * (12 - i)
  }

  remainder = (sum * 10) % 11
  if (remainder === 10 || remainder === 11) remainder = 0
  if (remainder !== parseInt(cleaned.substring(10, 11))) return false

  return true
}

export function generateSystemCode(year: number, sequential: number): string {
  return `${year}-${sequential.toString().padStart(5, '0')}`
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export function formatDate(dateString: string): string {
  if (!dateString) return '-'
  const date = new Date(dateString)
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function formatDateTime(dateString: string): string {
  if (!dateString) return '-'
  const date = new Date(dateString)
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function getStatusBadge(status: string, neverDelete?: boolean): { label: string; className: string } {
  if (neverDelete) {
    return { label: '🔒 Retido', className: 'bg-info-light text-info' }
  }
  
  switch (status) {
    case 'approved':
      return { label: '✓ Aprovado', className: 'bg-accent-light text-accent' }
    case 'pending':
      return { label: '⏳ Aguard. revisão', className: 'bg-warning-light text-warning' }
    case 'reproved':
      return { label: '✗ Não liberado', className: 'bg-danger-light text-danger' }
    case 'trash':
      return { label: 'Lixeira', className: 'bg-accent-2-light text-accent-2' }
    default:
      return { label: status, className: 'bg-surface-2 text-text-2' }
  }
}

export function getRoleBadge(role: string): { label: string; className: string } {
  switch (role) {
    case 'admin':
      return { label: 'Admin', className: 'bg-info-light text-info' }
    case 'revisor':
      return { label: 'Revisor', className: 'bg-purple-light text-purple' }
    case 'atendente':
      return { label: 'Atendente', className: 'bg-accent-light text-accent' }
    default:
      return { label: role, className: 'bg-surface-2 text-text-2' }
  }
}

export async function fileToHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}
