import { compare, hash } from 'bcryptjs'
import { supabaseAdmin } from './supabase'

export async function hashPassword(password: string): Promise<string> {
  return hash(password, 12)
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return compare(password, hashedPassword)
}

export async function getUserByEmail(email: string) {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('email', email.toLowerCase())
    .eq('active', true)
    .single()

  if (error || !data) return null
  return data
}

export async function updateLastLogin(userId: string) {
  await supabaseAdmin
    .from('users')
    .update({ last_login: new Date().toISOString() })
    .eq('id', userId)
}

export async function createUser(
  email: string,
  name: string,
  role: 'admin' | 'revisor' | 'atendente',
  password: string
) {
  const hashedPassword = await hashPassword(password)
  
  const { data, error } = await supabaseAdmin
    .from('users')
    .insert({
      email: email.toLowerCase(),
      name,
      role,
      password_hash: hashedPassword,
      active: true,
    })
    .select()
    .single()

  if (error) {
    console.error('Create user error:', error)
    return null
  }

  return data
}

export async function logAccess(
  userId: string,
  action: string,
  details?: string,
  ipAddress?: string | null,  // <-- ADICIONA | null aqui
  documentId?: string
) {
  // Converte null para undefined
  const finalIp = ipAddress === null ? undefined : ipAddress

  await supabaseAdmin
  .from('access_logs')
  .insert({
    user_id: userId,
    action,
    details,
    ip_address: finalIp,
    document_id: documentId || null,
  })
}
