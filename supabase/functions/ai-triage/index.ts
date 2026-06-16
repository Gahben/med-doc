import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { GoogleGenerativeAI } from 'https://esm.sh/@google/generative-ai@0.21.0'

Deno.serve(async (req) => {
  // CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' } })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const geminiKey = Deno.env.get('GEMINI_API_KEY')

    if (!geminiKey) {
      return new Response(JSON.stringify({ error: 'GEMINI_API_KEY not configured in Supabase Secrets' }), { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)
    
    // Obter o JSON do request
    const requestData = await req.json()
    const { patient_request_id } = requestData

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

    // 2. Preparar prompt para o Gemini
    const prompt = `
      Você é um assistente de triagem médica. 
      Analise os dados da solicitação de prontuário abaixo e retorne um JSON válido.
      
      DADOS DA SOLICITAÇÃO:
      Nome: ${request.requester_name}
      Motivo: ${request.request_reason}
      Período Hospital: ${request.hospital_period}
      Notas adicionais: ${request.notes || 'Nenhuma'}
      
      Sua tarefa é retornar APENAS um objeto JSON válido (sem \`\`\`json) com as seguintes chaves:
      1. "urgency_level": Um dos seguintes valores: "low", "medium", "high", "critical". (Use "critical" para judicial, óbito; "high" para continuação de tratamento; "medium" para perícia; "low" para histórico).
      2. "urgency_reason": Breve justificativa para o nível escolhido.
      3. "summary": Resumo da solicitação em uma única frase.
      4. "inconsistencies": Array de strings listando qualquer informação que pareça estranha ou inconsistente (ex: datas impossíveis, faltam dados vitals). Array vazio se não houver.
      5. "prontuario_notes": Notas explicativas ou recomendações clínicas/administrativas extraídas ou inferidas dos dados da solicitação para guiar os operadores ao organizar o prontuário (uma string simples ou null).
    `

    // 3. Chamar Gemini
    const ai = new GoogleGenerativeAI(geminiKey)
    const model = ai.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        responseMimeType: "application/json",
      }
    })
    
    const response = await model.generateContent(prompt)
    const resultText = response.response.text()
    const aiData = JSON.parse(resultText)

    // 4. Salvar resultado
    const { data: savedResult, error: saveError } = await supabase
      .from('ai_triage_results')
      .insert({
        patient_request_id: request.id,
        urgency_level: aiData.urgency_level,
        urgency_reason: aiData.urgency_reason,
        summary: aiData.summary,
        inconsistencies: aiData.inconsistencies || [],
        prontuario_notes: aiData.prontuario_notes || null,
        raw_response: aiData
      })
      .select()
      .single()

    if (saveError) {
        console.error("Save error:", saveError)
        return new Response(JSON.stringify({ error: 'Error saving result' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ success: true, data: savedResult }), {
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
