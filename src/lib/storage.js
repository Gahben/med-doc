/**
 * storage.js — Abstração completa de Supabase + Storage
 * Provider atual: Supabase
 *
 * INCLUI:
 *  - Workflow unificado com todas as transições por role
 *  - Hash SHA-256 + detecção de duplicatas
 *  - Versionamento de documentos (histórico de uploads)
 *  - Exportação CSV e XLSX de logs
 *  - Helpers de CPF (formatação, validação, máscara)
 *  - Configurações do sistema (lixeira automática, notificações)
 *  - Serviço de email (estrutura pronta)
 *  - Setor de origem e flag never_delete
 */

import { createClient } from '@supabase/supabase-js'

// ==================== CLIENTE SUPABASE ====================

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    '❌ Variáveis de ambiente Supabase não configuradas.\n' +
    'Copie .env.example para .env e preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ==================== STATUS DE FLUXO UNIFICADO ====================
//
// Fluxo principal:
//   received → request_approved / request_rejected
//   request_approved → in_production → not_found (último caso) OU in_audit
//   in_audit → correction_needed → corrected → concluded → delivered
//
// Quem pode mover para cada status:
//   REVISOR     : received, request_approved, request_rejected
//   OPERADOR    : in_production, not_found, corrected, concluded, delivered
//   AUDITOR     : in_audit, correction_needed, corrected, concluded
//   ADMIN       : todos

export const STATUS_WORKFLOW = {
  received:          { label: 'Recebida',            color: 'info',    icon: '📥', order: 1 },
  request_approved:  { label: 'Solicitação Aprovada', color: 'success', icon: '✅', order: 2 },
  request_rejected:  { label: 'Solicitação Recusada', color: 'danger',  icon: '❌', order: 2 },
  in_production:     { label: 'Em Produção',          color: 'warning', icon: '⚙️', order: 3 },
  not_found:         { label: 'Não Localizado',       color: 'danger',  icon: '🔍', order: 3 },
  in_audit:          { label: 'Em Auditoria',         color: 'purple',  icon: '🔎', order: 4 },
  correction_needed: { label: 'Correção Solicitada',  color: 'orange',  icon: '✏️', order: 5 },
  corrected:         { label: 'Corrigido',            color: 'info',    icon: '🔄', order: 6 },
  concluded:         { label: 'Concluído',            color: 'success', icon: '🏁', order: 7 },
  delivered:         { label: 'Entregue',             color: 'success', icon: '📦', order: 8 },
}

// Transições permitidas por role
export const ALLOWED_TRANSITIONS_BY_ROLE = {
  revisor: {
    received:         ['request_approved', 'request_rejected'],
    request_approved: [],
    request_rejected: [],
  },
  operador: {
    request_approved:  ['in_production'],
    in_production:     ['in_audit', 'not_found'],
    correction_needed: ['corrected'],
    corrected:         ['in_audit'],
    concluded:         ['delivered'],
  },
  auditor: {
    in_audit:          ['correction_needed', 'concluded'],
    corrected:         ['concluded'],
    correction_needed: ['corrected'],
  },
  admin: Object.keys(STATUS_WORKFLOW).reduce((acc, k) => {
    acc[k] = Object.keys(STATUS_WORKFLOW).filter(s => s !== k)
    return acc
  }, {}),
}

// ==================== HELPERS DE CPF ====================

export const cpfHelpers = {
  /** Remove tudo que não é dígito */
  strip: (cpf) => (cpf || '').replace(/\D/g, ''),

  /** Formata para 000.000.000-00 */
  format: (cpf) => {
    const d = cpfHelpers.strip(cpf)
    if (d.length !== 11) return cpf
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
  },

  /**
   * Valida CPF (algoritmo oficial)
   * Retorna true se válido, false caso contrário
   */
  isValid: (cpf) => {
    const d = cpfHelpers.strip(cpf)
    if (d.length !== 11) return false
    if (/^(\d)\1{10}$/.test(d)) return false

    let sum = 0
    for (let i = 0; i < 9; i++) sum += parseInt(d[i]) * (10 - i)
    let rem = (sum * 10) % 11
    if (rem === 10 || rem === 11) rem = 0
    if (rem !== parseInt(d[9])) return false

    sum = 0
    for (let i = 0; i < 10; i++) sum += parseInt(d[i]) * (11 - i)
    rem = (sum * 10) % 11
    if (rem === 10 || rem === 11) rem = 0
    return rem === parseInt(d[10])
  },

  /** Aplica máscara enquanto o usuário digita */
  mask: (value) => {
    const d = cpfHelpers.strip(value).slice(0, 11)
    if (d.length <= 3) return d
    if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
    if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
  },
}

// ==================== HASH DE ARQUIVO + DUPLICATAS ====================

/**
 * Calcula SHA-256 de um File ou Blob.
 * Usado para detectar duplicatas antes do upload.
 * @param {File} file
 * @returns {Promise<string>} hex string
 */
export async function hashFile(file) {
  const buffer = await file.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Verifica se já existe prontuário com o mesmo hash.
 * @param {string} hash
 * @returns {Promise<object|null>} prontuário duplicado ou null
 */
export async function checkDuplicateHash(hash) {
  const { data } = await supabase
    .from('prontuarios')
    .select('id, record_number, patient_name, file_name')
    .eq('file_hash', hash)
    .neq('status', 'trash')
    .maybeSingle()
  return data ?? null
}

// ==================== AUTH ====================

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

// ==================== STORAGE (ARQUIVOS) ====================

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

// ==================== PRONTUÁRIOS ====================

export const prontuariosService = {
  list: ({ search = '', status = null, workflowStatus = null, originSector = null, page = 1, perPage = 20 } = {}) => {
    let query = supabase
      .from('prontuarios')
      .select('*, profiles!prontuarios_uploaded_by_fkey(name, role)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * perPage, page * perPage - 1)

    if (search) {
      query = query.or(
        `patient_name.ilike.%${search}%,patient_cpf.ilike.%${search}%,record_number.ilike.%${search}%`
      )
    }
    if (status) query = query.eq('status', status)
    if (workflowStatus) query = query.eq('workflow_status', workflowStatus)
    if (originSector) query = query.eq('origin_sector', originSector)
    return query
  },

  getById: (id) =>
    supabase
      .from('prontuarios')
      .select('*, profiles!prontuarios_uploaded_by_fkey(name, role)')
      .eq('id', id)
      .single(),

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

  /**
   * Cria prontuário com hash, upload e primeira versão automática
   */
  createWithVersion: async (file, metadata) => {
    // 1. Calcula hash e verifica duplicata
    const fileHash = await hashFile(file)
    const duplicate = await checkDuplicateHash(fileHash)
    if (duplicate) {
      throw new Error(
        `Documento duplicado! Já existe como prontuário ${duplicate.record_number} (${duplicate.patient_name})`
      )
    }

    // 2. Upload do arquivo
    const ext = file.name.split('.').pop()
    const path = `${metadata.uploaded_by}/${Date.now()}_${metadata.record_number}.${ext}`
    await storageService.upload(file, path)

    // 3. Insere registro no banco
    const { data: prontuario, error } = await prontuariosService.create({
      ...metadata,
      file_path: path,
      file_name: file.name,
      file_size: file.size,
      file_hash: fileHash,
      status: 'pending',
    })
    if (error) throw error

    // 4. Cria primeira versão no histórico
    await documentVersionsService.create({
      prontuario_id: prontuario.id,
      version_number: 1,
      file_path: path,
      file_name: file.name,
      file_size: file.size,
      file_hash: fileHash,
      uploaded_by: metadata.uploaded_by,
    })

    return prontuario
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

  /** Atualiza o workflow_status (fluxo de solicitação) */
  updateWorkflowStatus: (id, workflowStatus, note = null) =>
    supabase
      .from('prontuarios')
      .update({
        workflow_status: workflowStatus,
        ...(note ? { workflow_note: note } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single(),

  /**
   * Reenvia prontuário corrigido (nova versão)
   */
  resubmit: async (prontuarioId, file, note, userId) => {
    const fileHash = await hashFile(file)
    const ext = file.name.split('.').pop()
    const path = `${userId}/${Date.now()}_resubmit.${ext}`
    
    await storageService.upload(file, path)

    const nextVersion = await documentVersionsService.nextVersion(prontuarioId)

    // Atualiza prontuário
    const { error } = await supabase
      .from('prontuarios')
      .update({
        status: 'pending',
        file_path: path,
        file_name: file.name,
        file_size: file.size,
        file_hash: fileHash,
        resubmit_note: note?.trim() || null,
        reviewed_at: null,
        reviewed_by: null,
        review_note: null,
      })
      .eq('id', prontuarioId)
    if (error) throw error

    // Registra nova versão
    await documentVersionsService.create({
      prontuario_id: prontuarioId,
      version_number: nextVersion,
      file_path: path,
      file_name: file.name,
      file_size: file.size,
      file_hash: fileHash,
      uploaded_by: userId,
      upload_note: note,
    })

    return true
  },

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

  hardDelete: async (id) => {
    // Busca todas as versões para remover arquivos
    const { data: versions } = await documentVersionsService.list(id)
    const paths = (versions || []).map(v => v.file_path).filter(Boolean)
    
    // Remove arquivos do storage
    if (paths.length > 0) {
      await storageService.remove(paths)
    }

    // Remove registro
    return supabase.from('prontuarios').delete().eq('id', id)
  },

  /** Lista os setores distintos cadastrados (para filtros e dropdowns) */
  listSectors: async () => {
    const { data } = await supabase
      .from('prontuarios')
      .select('origin_sector')
      .not('origin_sector', 'is', null)
      .neq('origin_sector', '')
    const sectors = [...new Set((data ?? []).map(r => r.origin_sector))].sort()
    return sectors
  },
}

// ==================== VERSÕES DE DOCUMENTO ====================
// Histórico completo de uploads de um prontuário (arquivo original + reenvios)

export const documentVersionsService = {
  /**
   * Lista todas as versões de um prontuário em ordem decrescente.
   */
  list: (prontuarioId) =>
    supabase
      .from('document_versions')
      .select('*, profiles!uploaded_by(name, role)')
      .eq('prontuario_id', prontuarioId)
      .order('version_number', { ascending: false }),

  /** Registra uma nova versão (chamado a cada upload/reenvio) */
  create: (data) =>
    supabase.from('document_versions').insert(data),

  /**
   * Retorna o próximo número de versão para um prontuário.
   * Se não houver versões, retorna 1.
   */
  nextVersion: async (prontuarioId) => {
    const { data } = await supabase
      .from('document_versions')
      .select('version_number')
      .eq('prontuario_id', prontuarioId)
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle()
    return data ? data.version_number + 1 : 1
  },
}

// ==================== LOGS DE AUDITORIA ====================

export const logsService = {
  list: ({ type = null, userId = null, search = '', page = 1, perPage = 50, dateFrom = null, dateTo = null } = {}) => {
    let query = supabase
      .from('audit_logs')
      .select('*, profiles!user_id(name, role)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * perPage, page * perPage - 1)

    if (type) query = query.eq('action_type', type)
    if (userId) query = query.eq('user_id', userId)
    if (search) query = query.ilike('detail', `%${search}%`)
    if (dateFrom) query = query.gte('created_at', dateFrom)
    if (dateTo) query = query.lte('created_at', dateTo)
    return query
  },

  create: (data) => supabase.from('audit_logs').insert(data),

  /**
   * Exporta logs para CSV e dispara o download no browser.
   * @param {object} filters - mesmos filtros de list()
   * @param {string} filename
   */
  exportCSV: async (filters = {}, filename = 'logs_auditoria.csv') => {
    // Busca até 5000 registros para o export
    const { data, error } = await logsService.list({ ...filters, perPage: 5000 })
    if (error) throw error

    const escape = (v) => {
      if (v == null) return ''
      const s = String(v)
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"`
        : s
    }

    const header = ['Data/Hora', 'Usuário', 'Role', 'Ação', 'Detalhe', 'ID Prontuário']
    const rows = (data ?? []).map(l => [
      new Date(l.created_at).toLocaleString('pt-BR'),
      l.profiles?.name ?? '',
      l.profiles?.role ?? '',
      l.action_type,
      l.detail ?? '',
      l.prontuario_id ?? '',
    ])

    const csv = [header, ...rows].map(r => r.map(escape).join(',')).join('\r\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  },

  /**
   * Exporta logs para XLSX e dispara o download no browser.
   * Requer biblioteca xlsx (npm install xlsx)
   * @param {object} filters - mesmos filtros de list()
   * @param {string} filename
   */
  exportXLSX: async (filters = {}, filename = 'logs_auditoria.xlsx') => {
    try {
      const XLSX = await import('xlsx')
      const { data, error } = await logsService.list({ ...filters, perPage: 5000 })
      if (error) throw error

      const rows = (data ?? []).map(l => ({
        'Data/Hora': new Date(l.created_at).toLocaleString('pt-BR'),
        'Usuário': l.profiles?.name ?? '',
        'Role': l.profiles?.role ?? '',
        'Ação': l.action_type,
        'Detalhe': l.detail ?? '',
        'ID Prontuário': l.prontuario_id ?? '',
      }))

      const ws = XLSX.utils.json_to_sheet(rows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Logs')
      XLSX.writeFile(wb, filename)
    } catch {
      // Fallback para CSV se xlsx não estiver disponível
      await logsService.exportCSV(filters, filename.replace('.xlsx', '.csv'))
    }
  },
}

// ==================== USUÁRIOS / PERFIS ====================

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

// ==================== NOTAS DO REVISOR ====================

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

// ==================== WORKFLOW ====================

export const workflowService = {
  updateStatus: (prontuarioId, workflowStatus, note = null) =>
    supabase
      .from('prontuarios')
      .update({
        workflow_status: workflowStatus,
        ...(note ? { workflow_note: note } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', prontuarioId)
      .select()
      .single(),

  listByWorkflow: (workflowStatus) =>
    supabase
      .from('prontuarios')
      .select('*, profiles!prontuarios_uploaded_by_fkey(name, role)')
      .eq('workflow_status', workflowStatus)
      .order('updated_at', { ascending: false }),
}

// ==================== CONFIGURAÇÕES DO SISTEMA ====================
// Tabela esperada: system_config (key text PK, value jsonb, updated_at, updated_by)

export const systemConfigService = {
  /**
   * Lê todas as configurações.
   * Retorna objeto { key: value, ... }
   */
  getAll: async () => {
    const { data } = await supabase.from('system_config').select('*')
    return Object.fromEntries((data ?? []).map(r => [r.key, r.value]))
  },

  /** Lê uma configuração específica. Retorna o value já parseado. */
  get: async (key, defaultValue = null) => {
    const { data } = await supabase
      .from('system_config')
      .select('value')
      .eq('key', key)
      .maybeSingle()
    return data?.value ?? defaultValue
  },

  /** Grava ou atualiza uma configuração. */
  set: (key, value, userId = null) =>
    supabase
      .from('system_config')
      .upsert({ key, value, updated_at: new Date().toISOString(), updated_by: userId }),

  // Chaves de configuração conhecidas:
  // 'trash_auto_days'     → number (dias até exclusão automática da lixeira, 0 = desativado)
  // 'email_notifications' → boolean
  // 'smtp_host'           → string
  // 'smtp_port'           → number
  // 'smtp_from'           → string
}

// ==================== SERVIÇO DE EMAIL ====================
//
// Para ativar: crie a Edge Function 'send-email' e configure as variáveis
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM nos secrets do Supabase.
//
// A função recebe { to, subject, html } e envia via nodemailer (Deno).

export const emailService = {
  /**
   * Dispara um email via Edge Function 'send-email'.
   * Falha silenciosa — não quebra o fluxo principal.
   */
  send: async ({ to, subject, html }) => {
    try {
      const enabled = await systemConfigService.get('email_notifications', false)
      if (!enabled) return

      await supabase.functions.invoke('send-email', {
        body: { to, subject, html },
      })
    } catch {
      // Notificações nunca devem interromper o fluxo principal
    }
  },

  /** Templates prontos */
  templates: {
    workflowUpdated: (prontuario, newStatus) => ({
      subject: `[MedDoc] Status atualizado: ${prontuario.record_number}`,
      html: `
        <p>O prontuário <strong>${prontuario.record_number}</strong> de <strong>${prontuario.patient_name}</strong>
        teve seu status atualizado para <strong>${STATUS_WORKFLOW[newStatus]?.label ?? newStatus}</strong>.</p>
        <p>Acesse o sistema para mais detalhes.</p>
      `,
    }),

    correctionNeeded: (prontuario, note) => ({
      subject: `[MedDoc] Correção solicitada: ${prontuario.record_number}`,
      html: `
        <p>O prontuário <strong>${prontuario.record_number}</strong> requer correção.</p>
        ${note ? `<blockquote>${note}</blockquote>` : ''}
      `,
    }),
  },
}