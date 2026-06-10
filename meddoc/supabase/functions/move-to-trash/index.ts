// supabase/functions/move-to-trash/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
    console.log('🔄 Iniciando job move-to-trash...')

    const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
                                  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    try {
        const cutoffDate = new Date()
        cutoffDate.setDate(cutoffDate.getDate() - 180)

        const { data, error } = await supabase
        .from('documents')
        .update({
            status: 'trash',
            updated_at: new Date().toISOString()
        })
        .eq('status', 'approved')
        .eq('never_delete', false)
        .lt('last_accessed_at', cutoffDate.toISOString())

        if (error) {
            console.error('❌ Erro ao mover documentos:', error)
            return new Response(
                JSON.stringify({ error: error.message }),
                                { status: 500, headers: { 'Content-Type': 'application/json' } }
            )
        }

        console.log(`✅ Movidos para lixeira: ${data?.length || 0} documentos`)

        return new Response(
            JSON.stringify({
                success: true,
                moved: data?.length || 0
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error('❌ Erro no job move-to-trash:', error)
        return new Response(
            JSON.stringify({ error: String(error) }),
                            { status: 500, headers: { 'Content-Type': 'application/json' } }
        )
    }
})
