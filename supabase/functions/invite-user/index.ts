/**
 * Edge Function: invite-user
 * Deploy: supabase functions deploy invite-user
 *
 * Permite que admins convidem novos usuários.
 * O role desejado é passado no body e aplicado automaticamente
 * via raw_user_meta_data → trigger handle_new_user.
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

    // Client do usuário que está chamando (para verificar se é admin)
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: userErr } = await supabaseUser.auth.getUser()
    if (userErr || !user) throw new Error('Sessão inválida')

    // Verifica se quem chama é admin ativo
    const { data: profile } = await supabaseUser
      .from('profiles')
      .select('role, active, name')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'admin' || !profile.active) {
      throw new Error('Apenas admins podem convidar usuários')
    }

    const { email, role = 'operador', name = '' } = await req.json()
    if (!email) throw new Error('E-mail obrigatório')
    if (!['admin', 'revisor', 'operador'].includes(role)) {
      throw new Error('Role inválido. Use: admin, revisor ou operador')
    }

    // Client admin (service role) para criar o usuário
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: { role, name: name || email.split('@')[0] },
    })
    if (error) throw error

    // Registra log de auditoria
    await supabaseAdmin.from('audit_logs').insert({
      user_id: user.id,
      action_type: 'user_invited',
      detail: `Admin "${profile.name}" convidou ${email} com role "${role}"`,
      target_user_id: data.user?.id ?? null,
    })

    return new Response(
      JSON.stringify({ ok: true, user: { id: data.user?.id, email } }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
