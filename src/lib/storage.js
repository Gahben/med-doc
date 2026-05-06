/**
 * storage.js — Abstração de banco de dados / storage
 * Provider atual: Supabase
 */
import { createClient } from '@supabase/supabase-js'

const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    '❌ Variáveis de ambiente Supabase não configuradas.\n' +
    'Copie .env.example para .env e preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ─── AUTH ────────────────────────────────────────────────────────────────────

export const authService = {
  signIn: (email, password) =>
    supabase.auth.signInWithPassword({ email, password }),

  signInWithGoogle: () =>
    supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    }),

  resetPasswordRequest: (email) =>
    supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    }),

  updatePassword: (newPassword) =>
    supabase.auth.updateUser({ password: newPassword }),

  signOut: () => supabase.auth.signOut(),

  getSession: () => supabase.auth.getSession(),

  onAuthStateChange: (callback) =>
    supabase.auth.onAuthStateChange(callback),
}

// ─── PRONTUÁRIOS ─────────────────────────────────────────────────────────────

export const prontuariosService = {
  list: ({ search = '', status = null, page = 1, perPage = 20 } = {}) => {
    let query = supabase
      .from('prontuarios')
      .select('*, profiles!uploaded_by(name, role)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * perPage, page * perPage - 1)

    if (search) {
      query = query.or(
        `patient_name.ilike.%${search}%,patient_cpf.ilike.%${search}%,record_number.ilike.%${search}%`
      )
    }
    if (status) query = query.eq('status', status)
    return query
  },

  getById: (id) =>
    supabase
      .from('prontuarios')
      .select('*, profiles!uploaded_by(name, role)')
      .eq('id', id)
      .single(),

  // FIX: insert separado do select para não colidir com RLS de operadores
  create: async (data) => {
    const { error: insertError } = await supabase
      .from('prontuarios')
      .insert(data)
    if (insertError) return { data: null, error: insertError }

    return supabase
      .from('prontuarios')
      .select('*')
      .eq('record_number', data.record_number)
      .single()
  },

  updateStatus: (id, status, reviewNote = null) =>
    supabase
      .from('prontuarios')
      .update({
        status,
        review_note: reviewNote,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single(),

  softDelete: (id) =>
    supabase
      .from('prontuarios')
      .update({ status: 'trash', deleted_at: new Date().toISOString() })
      .eq('id', id),

  restore: (id) =>
    supabase
      .from('prontuarios')
      .update({ status: 'pending', deleted_at: null })
      .eq('id', id),

  hardDelete: (id) =>
    supabase.from('prontuarios').delete().eq('id', id),
}

// ─── STORAGE (arquivos) ──────────────────────────────────────────────────────

export const storageService = {
  upload: async (file, path) => {
    const { data, error } = await supabase.storage
      .from('prontuarios')
      .upload(path, file, { upsert: false, cacheControl: '3600' })
    if (error) throw error
    return data
  },

  getSignedUrl: async (path, expiresIn = 3600) => {
    const { data, error } = await supabase.storage
      .from('prontuarios')
      .createSignedUrl(path, expiresIn)
    if (error) throw error
    return data.signedUrl
  },

  remove: async (paths) => {
    const { error } = await supabase.storage
      .from('prontuarios')
      .remove(Array.isArray(paths) ? paths : [paths])
    if (error) throw error
  },
}

// ─── LOGS DE AUDITORIA ───────────────────────────────────────────────────────

export const logsService = {
  list: ({ type = null, page = 1, perPage = 50 } = {}) => {
    let query = supabase
      .from('audit_logs')
      .select('*, profiles!user_id(name, role)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * perPage, page * perPage - 1)

    if (type) query = query.eq('action_type', type)
    return query
  },

  create: (data) => supabase.from('audit_logs').insert(data),
}

// ─── USUÁRIOS / PERFIS ────────────────────────────────────────────────────────

export const profilesService = {
  list: () =>
    supabase.from('profiles').select('*').order('name'),

  getById: (id) =>
    supabase.from('profiles').select('*').eq('id', id).single(),

  update: (id, data) =>
    supabase.from('profiles').update(data).eq('id', id).select().single(),

  // Convida usuário via Edge Function (só admins)
  invite: (email, role, name = '') =>
    supabase.functions.invoke('invite-user', {
      body: { email, role, name },
    }),

  // Ações administrativas via Edge Function (reset senha, excluir, mudar role)
  adminAction: (action, targetUserId, params = {}) =>
    supabase.functions.invoke('admin-actions', {
      body: { action, target_user_id: targetUserId, ...params },
    }),
}

// ─── NOTAS DO REVISOR ────────────────────────────────────────────────────────
// Comunicação interna entre revisor e operador sobre pendências de solicitação

export const reviewerNotesService = {
  listByProntuario: (prontuarioId) =>
    supabase
      .from('reviewer_notes')
      .select('*, profiles!author_id(name, role)')
      .eq('prontuario_id', prontuarioId)
      .order('created_at', { ascending: false }),

  listPending: () =>
    supabase
      .from('reviewer_notes')
      .select('*, profiles!author_id(name, role), prontuarios(patient_name, record_number)')
      .eq('resolved', false)
      .order('created_at', { ascending: false }),

  create: (prontuarioId, noteText, noteType = 'info') =>
    supabase.from('reviewer_notes').insert({
      prontuario_id: prontuarioId,
      note_text: noteText,
      note_type: noteType,
    }),

  resolve: (id) =>
    supabase.from('reviewer_notes').update({ resolved: true }).eq('id', id),
}

// ─── WORKFLOW (integração com sistema externo via edge function) ──────────────
// O sistema externo (portal do solicitante) atualiza workflow_status via edge function.
// Este serviço permite que operadores e revisores consultem e atualizem o status interno.

export const workflowService = {
  // Atualiza o workflow_status de um prontuário
  // Usado pelo operador (in_production, delivered) e pelo auditor (in_audit)
  updateStatus: (prontuarioId, workflowStatus) =>
    supabase
      .from('prontuarios')
      .update({ workflow_status: workflowStatus })
      .eq('id', prontuarioId)
      .select()
      .single(),

  // Lista prontuários por workflow_status (para o operador acompanhar o fluxo)
  listByWorkflow: (workflowStatus) =>
    supabase
      .from('prontuarios')
      .select('*, profiles!uploaded_by(name, role)')
      .eq('workflow_status', workflowStatus)
      .order('updated_at', { ascending: false }),
}
