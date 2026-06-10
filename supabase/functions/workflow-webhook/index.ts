/**
 * workflow-webhook — Integração externa com o fluxo unificado de solicitações
 *
 * Aceita patient_request_id, token ou prontuario_id/record_number.
 * Sincroniza patient_requests.workflow_status e prontuarios.workflow_status.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  received:           ['request_approved', 'request_rejected', 'cancelled'],
  request_approved:   ['in_production', 'cancelled'],
  request_rejected:   [],
  in_production:      ['in_audit', 'not_found', 'cancelled'],
  not_found:          ['cancelled'],
  in_audit:           ['correction_needed', 'concluded', 'cancelled'],
  correction_needed:  ['corrected', 'cancelled'],
  corrected:          ['in_audit', 'concluded', 'cancelled'],
  concluded:          ['ready_for_delivery', 'delivered', 'cancelled'],
  ready_for_delivery: ['delivered', 'cancelled'],
  delivered:          [],
  cancelled:          [],
}

const ROLE_TRANSITIONS: Record<string, string[]> = {
  revisor:  ['received', 'request_approved', 'request_rejected', 'in_production'],
  operador: ['in_production', 'not_found', 'corrected', 'ready_for_delivery', 'delivered', 'cancelled'],
  auditor:  ['in_audit', 'correction_needed', 'corrected', 'concluded', 'cancelled'],
  admin:    Object.keys(ALLOWED_TRANSITIONS),
}

function legacyStatus(workflowStatus: string) {
  if (workflowStatus === 'received') return 'pending'
  if (workflowStatus === 'request_rejected') return 'rejected'
  if (workflowStatus === 'delivered' || workflowStatus === 'cancelled') return 'completed'
  if (workflowStatus === 'request_approved') return 'approved'
  return 'approved'
}

Deno.serve(async (req: Request) => {
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
    const {
      patient_request_id,
      token,
      prontuario_id,
      record_number,
      workflow_status,
      caller_role = 'admin',
      note,
      auto_production_on_approve = true,
    } = body

    if (!workflow_status) {
      return new Response(JSON.stringify({ error: 'workflow_status é obrigatório' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    let patientRequest: Record<string, unknown> | null = null
    let prontuario: Record<string, unknown> | null = null

    if (patient_request_id) {
      const { data } = await supabase.from('patient_requests').select('*').eq('id', patient_request_id).maybeSingle()
      patientRequest = data
    } else if (token) {
      const { data } = await supabase.from('patient_requests').select('*').eq('token', String(token).toUpperCase()).maybeSingle()
      patientRequest = data
    }

    if (prontuario_id) {
      const { data } = await supabase.from('prontuarios').select('*').eq('id', prontuario_id).maybeSingle()
      prontuario = data
    } else if (record_number) {
      const { data } = await supabase.from('prontuarios').select('*').eq('record_number', record_number).maybeSingle()
      prontuario = data
    }

    if (!prontuario && patientRequest?.prontuario_id) {
      const { data } = await supabase.from('prontuarios').select('*').eq('id', patientRequest.prontuario_id).maybeSingle()
      prontuario = data
    }

    if (!patientRequest && prontuario?.patient_request_id) {
      const { data } = await supabase.from('patient_requests').select('*').eq('id', prontuario.patient_request_id).maybeSingle()
      patientRequest = data
    }

    if (!patientRequest && !prontuario) {
      return new Response(JSON.stringify({ error: 'Solicitação ou prontuário não encontrado' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const currentStatus = String(
      patientRequest?.workflow_status ?? prontuario?.workflow_status ?? 'received'
    )

    const allowedNext = ALLOWED_TRANSITIONS[currentStatus] ?? []
    const roleAllowed = ROLE_TRANSITIONS[caller_role] ?? ROLE_TRANSITIONS.admin

    if (!allowedNext.includes(workflow_status)) {
      return new Response(JSON.stringify({
        error: `Transição inválida: ${currentStatus} → ${workflow_status}`,
        allowed_transitions: allowedNext,
      }), { status: 422, headers: { 'Content-Type': 'application/json' } })
    }

    if (!roleAllowed.includes(workflow_status) && caller_role !== 'admin') {
      return new Response(JSON.stringify({
        error: `Role "${caller_role}" não pode definir status "${workflow_status}"`,
      }), { status: 403, headers: { 'Content-Type': 'application/json' } })
    }

    const statusesToApply = [workflow_status]
    if (workflow_status === 'request_approved' && auto_production_on_approve) {
      statusesToApply.push('in_production')
    }

    let lastStatus = currentStatus
    for (const status of statusesToApply) {
      const now = new Date().toISOString()
      if (patientRequest?.id) {
        await supabase.from('patient_requests').update({
          workflow_status: status,
          status: legacyStatus(status),
          notes: note ?? patientRequest.notes,
          updated_at: now,
        }).eq('id', patientRequest.id)
        patientRequest = { ...patientRequest, workflow_status: status }
      }
      const proId = prontuario?.id ?? patientRequest?.prontuario_id
      if (proId) {
        await supabase.from('prontuarios').update({
          workflow_status: status,
          ...(note ? { workflow_note: note } : {}),
          updated_at: now,
        }).eq('id', proId)
      }
      lastStatus = status
    }

    if (note && caller_role === 'revisor' && prontuario?.id) {
      await supabase.from('reviewer_notes').insert({
        prontuario_id: prontuario.id,
        note_text: note,
        note_type: workflow_status === 'request_rejected' ? 'correction_required' : 'info',
      })
    }

    await supabase.from('audit_logs').insert({
      action_type: 'workflow_update',
      detail: `Webhook: ${currentStatus} → ${lastStatus}${note ? ` | ${note}` : ''}`,
      prontuario_id: prontuario?.id ?? null,
    })

    return new Response(JSON.stringify({
      success: true,
      patient_request_id: patientRequest?.id ?? null,
      prontuario_id: prontuario?.id ?? patientRequest?.prontuario_id ?? null,
      previous_status: currentStatus,
      workflow_status: lastStatus,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
  } catch (err) {
    console.error('workflow-webhook error:', err)
    return new Response(JSON.stringify({ error: 'Erro interno do servidor' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
