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
    const { prontuario_id } = requestData

    if (!prontuario_id) {
      return new Response(JSON.stringify({ error: 'Missing prontuario_id' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }

    // 1. Buscar os dados do prontuário
    const { data: prontuario, error: reqError } = await supabase
      .from('prontuarios')
      .select('*')
      .eq('id', prontuario_id)
      .single()

    if (reqError || !prontuario) {
      return new Response(JSON.stringify({ error: 'Prontuario not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } })
    }

    // 2. Buscar histórico de versões do documento
    const { data: versions, error: versionsError } = await supabase
      .from('document_versions')
      .select('version_number, file_size, created_at')
      .eq('prontuario_id', prontuario_id)
      .order('version_number', { ascending: true })

    // 3. Preparar prompt
    const prompt = `
      Você é um assistente de auditoria de metadados em um sistema de gestão de prontuários médicos.
      Sua tarefa é analisar os metadados (E APENAS metadados, sem conteúdo clínico) e apontar anomalias ou dar avisos para o auditor.
      
      METADADOS DO PRONTUÁRIO:
      - Tipo: ${prontuario.document_type}
      - Páginas declaradas: ${prontuario.pages}
      - Tamanho do arquivo atual: ${prontuario.file_size} bytes
      - Setor de origem: ${prontuario.origin_sector || 'Não informado'}
      - Histórico de reenvios:
        ${versions && versions.length > 0 ? versions.map(v => `V${v.version_number}: ${v.file_size} bytes em ${v.created_at}`).join('\n        ') : 'Nenhuma versão anterior'}
      
      REGRAS DE ANÁLISE:
      - Se "Prontuário médico" tiver apenas 1 página, é suspeito (costumam ser longos).
      - Se houver reenvios num intervalo muito curto (menos de 1 hora), avise sobre possível erro ou envio apressado.
      - Se o tamanho do arquivo diminuir drasticamente entre versões, pode ter havido perda de páginas.
      
      Retorne um JSON válido com a seguinte estrutura:
      {
        "alerts": [
          {
            "severity": "low|medium|high",
            "message": "Aviso curto e direto"
          }
        ]
      }
      Se não houver problemas, retorne alerts vazio.
      NÃO use bloco de código markdown (\`\`\`json).
    `

    // 4. Chamar Gemini
    const ai = new GoogleGenerativeAI(geminiKey)
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: "application/json",
        }
    })

    const resultText = response.text
    const result = JSON.parse(resultText)

    return new Response(JSON.stringify({ success: true, alerts: result.alerts || [] }), {
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
