/**
 * Edge Function: admin-actions
 * Deploy: supabase functions deploy admin-actions
 *
 * Ações administrativas que exigem service role:
 *   - reset_password  → envia e-mail de redefinição de senha para um usuário
 *   - delete_user     → remove usuário do Auth (soft delete via active=false antes)
 *   - update_role     → muda role e/ou active de um usuário
 *
 * Body: { action: string, target_user_id: string, ...params }
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Não autorizado')

    // Verifica o admin que está chamando
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: userErr } = await supabaseUser.auth.getUser()
    if (userErr || !user) throw new Error('Sessão inválida')

    const { data: callerProfile } = await supabaseUser
      .from('profiles')
      .select('role, active, name')
      .eq('id', user.id)
      .single()

    if (!callerProfile || callerProfile.role !== 'admin' || !callerProfile.active) {
      throw new Error('Apenas admins podem realizar esta ação')
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const body = await req.json()
    const { action, target_user_id } = body

    if (!action) throw new Error('Parâmetro "action" obrigatório')
    if (!target_user_id) throw new Error('Parâmetro "target_user_id" obrigatório')

    // Não deixa admin agir sobre si mesmo em ações destrutivas
    if (target_user_id === user.id && ['delete_user', 'update_role'].includes(action)) {
      throw new Error('Você não pode aplicar esta ação em si mesmo')
    }

    // Busca o perfil do alvo
    const { data: targetProfile } = await supabaseAdmin
      .from('profiles')
      .select('name, email, role, active')
      .eq('id', target_user_id)
      .single()

    if (!targetProfile) throw new Error('Usuário não encontrado')

    let logAction: string
    let logDetail: string
    let result: unknown = { ok: true }

    // ── RESET PASSWORD ──────────────────────────────────────────
    if (action === 'reset_password') {
      const { error } = await supabaseAdmin.auth.admin.generateLink({
        type: 'recovery',
        email: targetProfile.email,
      })
      if (error) throw error

      logAction = 'password_reset_sent'
      logDetail = `Admin "${callerProfile.name}" enviou reset de senha para "${targetProfile.name}" (${targetProfile.email})`
    }

    // ── DELETE USER ─────────────────────────────────────────────
    else if (action === 'delete_user') {
      // Primeiro desativa (soft delete no profile)
      await supabaseAdmin
        .from('profiles')
        .update({ active: false })
        .eq('id', target_user_id)

      // Depois remove do Auth
      const { error } = await supabaseAdmin.auth.admin.deleteUser(target_user_id)
      if (error) throw error

      logAction = 'user_deleted'
      logDetail = `Admin "${callerProfile.name}" excluiu o usuário "${targetProfile.name}" (${targetProfile.email})`
    }

    // ── UPDATE ROLE / ACTIVE ────────────────────────────────────
    else if (action === 'update_role') {
      const { role, active } = body
      const updates: Record<string, unknown> = {}

      if (role !== undefined) {
        if (!['admin', 'auditor', 'revisor', 'operador'].includes(role)) {
          throw new Error('Role inválido')
        }
        updates.role = role
      }
      if (active !== undefined) {
        updates.active = Boolean(active)
      }
      if (Object.keys(updates).length === 0) {
        throw new Error('Nenhuma alteração informada (role ou active)')
      }

      const { error } = await supabaseAdmin
        .from('profiles')
        .update(updates)
        .eq('id', target_user_id)

      if (error) throw error

      const changes = []
      if (role !== undefined) changes.push(`role: ${targetProfile.role} → ${role}`)
      if (active !== undefined) changes.push(`active: ${targetProfile.active} → ${active}`)

      logAction = active === false ? 'user_deactivated'
                : active === true  ? 'user_activated'
                : 'user_role_changed'

      logDetail = `Admin "${callerProfile.name}" alterou "${targetProfile.name}": ${changes.join(', ')}`
      result = { ok: true, changes: updates }
    }

    else {
      throw new Error(`Ação desconhecida: "${action}". Use: reset_password, delete_user, update_role`)
    }

    // Registra log de auditoria
    await supabaseAdmin.from('audit_logs').insert({
      user_id: user.id,
      action_type: logAction,
      detail: logDetail,
      target_user_id,
    })

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
