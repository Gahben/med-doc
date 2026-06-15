import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { GoogleGenerativeAI } from 'https://esm.sh/@google/genai@0.1.1'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' } })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const geminiKey = Deno.env.get('GEMINI_API_KEY')!

    const supabase = createClient(supabaseUrl, supabaseKey)
    
    const requestData = await req.json()
    const { patient_request_id, context } = requestData

    if (!patient_request_id) {
      return new Response(JSON.stringify({ error: 'Missing patient_request_id' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }

    // 1. Buscar os dados do patient_request
    const { data: request, error: reqError } = await supabase
      .from('patient_requests')
      .select('*')
      .eq('id', patient_request_id)
      .single()

    if (reqError || !request) {
      return new Response(JSON.stringify({ error: 'Request not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } })
    }

    // 2. Preparar prompt
    const prompt = `
      Você é um assistente do setor de prontuários médicos.
      Sua tarefa é redigir uma mensagem de WhatsApp para um paciente, com tom profissional, acolhedor e claro.
      
      DADOS DO PACIENTE:
      Nome: ${request.requester_name}
      Token de acompanhamento: ${request.token}
      Motivo da solicitação: ${request.request_reason}
      
      CONTEXTO / SITUAÇÃO ATUAL:
      ${context}
      
      INSTRUÇÕES IMPORTANTES:
      - A mensagem será enviada por nós (setor de prontuários) para o paciente.
      - Não invente informações clínicas.
      - Mantenha a mensagem relativamente curta (ideal para WhatsApp).
      - Inclua o token da solicitação na mensagem.
      - Não use \`\`\` em volta do texto.
      - Retorne APENAS o texto da mensagem. Nada de explicações adicionais.
    `

    // 3. Chamar Gemini
    const ai = new GoogleGenerativeAI(geminiKey)
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
    })

    const messageText = response.text

    return new Response(JSON.stringify({ success: true, message: messageText }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })

  } catch (error) {
    console.error(error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
  }
})
