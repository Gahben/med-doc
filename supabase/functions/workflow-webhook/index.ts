/**
 * workflow-webhook — Edge Function para integração com sistema externo de solicitações
 * 
 * Esta função recebe chamadas do portal do solicitante (sistema externo) e atualiza
 * o workflow_status dos prontuários conforme o fluxo avança.
 * 
 * Fluxo de status:
 *   received          → Solicitação recebida pelo sistema externo
 *   request_approved  → Revisor aprovou a solicitação (no sistema externo)
 *   request_rejected  → Revisor rejeitou a solicitação (no sistema externo)
 *   in_production     → Operador está produzindo o prontuário
 *   in_audit          → Auditor está revisando o documento
 *   delivered         → Operador confirmou envio/entrega
 * 
 * O sistema externo chamará esta função via HTTP POST com um Bearer token secreto.
 * O painel do solicitante consome os status via outra rota do sistema externo.
 * 
 * TODO (futuro): conectar com o portal do solicitante via esta edge function.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  received:         ['request_approved', 'request_rejected'],
  request_approved: ['in_production'],
  request_rejected: [], // terminal — solicitante deve refazer
  in_production:    ['in_audit'],
  in_audit:         ['in_production', 'delivered'], // pode voltar para produção
  delivered:        [], // terminal
}

// Status que o REVISOR (sistema externo) pode definir
const REVIEWER_STATUSES = ['received', 'request_approved', 'request_rejected']

// Status que o OPERADOR pode definir
const OPERATOR_STATUSES = ['in_production', 'delivered']

// Status que o AUDITOR pode definir  
const AUDITOR_STATUSES = ['in_audit']

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, content-type, x-webhook-secret',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
    })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const webhookSecret = Deno.env.get('WORKFLOW_WEBHOOK_SECRET')

    // Valida o secret do webhook (quando configurado)
    if (webhookSecret) {
      const providedSecret = req.headers.get('x-webhook-secret')
      if (providedSecret !== webhookSecret) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        })
      }
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const body = await req.json()
    const { prontuario_id, record_number, workflow_status, caller_role, note } = body

    // Valida campos obrigatórios
    if (!workflow_status || (!prontuario_id && !record_number)) {
      return new Response(
        JSON.stringify({ error: 'Campos obrigatórios: workflow_status e (prontuario_id ou record_number)' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Busca o prontuário
    let query = supabase.from('prontuarios').select('id, record_number, workflow_status, status')
    if (prontuario_id) {
      query = query.eq('id', prontuario_id)
    } else {
      query = query.eq('record_number', record_number)
    }
    const { data: prontuario, error: fetchError } = await query.single()

    if (fetchError || !prontuario) {
      return new Response(JSON.stringify({ error: 'Prontuário não encontrado' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Valida transição de status
    const currentStatus = prontuario.workflow_status || 'received'
    const allowedNext = ALLOWED_TRANSITIONS[currentStatus] || []
    
    // Se o prontuário ainda não tem workflow_status, qualquer status inicial é válido
    const isInitial = !prontuario.workflow_status
    if (!isInitial && !allowedNext.includes(workflow_status)) {
      return new Response(
        JSON.stringify({
          error: `Transição inválida: ${currentStatus} → ${workflow_status}`,
          allowed_transitions: allowedNext,
        }),
        { status: 422, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Atualiza o workflow_status
    const updateData: Record<string, unknown> = { workflow_status }
    
    const { data: updated, error: updateError } = await supabase
      .from('prontuarios')
      .update(updateData)
      .eq('id', prontuario.id)
      .select()
      .single()

    if (updateError) throw updateError

    // Registra nota do revisor se fornecida
    if (note && caller_role === 'revisor') {
      await supabase.from('reviewer_notes').insert({
        prontuario_id: prontuario.id,
        // Usa service role — author_id será null pois é chamada externa
        // TODO: quando o sistema externo tiver auth, passar o user_id real
        note_text: note,
        note_type: workflow_status === 'request_rejected' ? 'correction_required' : 
                   workflow_status === 'request_approved' ? 'info' : 'needs_contact',
      })
    }

    // Registra no audit log
    await supabase.from('audit_logs').insert({
      action_type: 'workflow_update',
      detail: `Workflow atualizado: ${currentStatus} → ${workflow_status}${note ? ` | Nota: ${note}` : ''}`,
      prontuario_id: prontuario.id,
    })

    return new Response(
      JSON.stringify({
        success: true,
        prontuario_id: prontuario.id,
        record_number: prontuario.record_number,
        previous_status: currentStatus,
        workflow_status,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    )
  } catch (err) {
    console.error('workflow-webhook error:', err)
    return new Response(JSON.stringify({ error: 'Erro interno do servidor' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
