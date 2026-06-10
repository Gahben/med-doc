// supabase/functions/permanent-delete/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
    // Log para debug
    console.log('🔄 Iniciando job permanent-delete...')

    // Criar cliente Supabase com service role (para bypass RLS)
    const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
                                  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    try {
        // 1. Buscar documentos na lixeira há mais de 60 dias
        const cutoffDate = new Date()
        cutoffDate.setDate(cutoffDate.getDate() - 60)

        const { data: docs, error: fetchError } = await supabase
        .from('documents')
        .select('id, file_url')
        .eq('status', 'trash')
        .eq('never_delete', false)
        .lt('updated_at', cutoffDate.toISOString())

        if (fetchError) {
            console.error('❌ Erro ao buscar documentos:', fetchError)
            return new Response(
                JSON.stringify({ error: fetchError.message }),
                                { status: 500, headers: { 'Content-Type': 'application/json' } }
            )
        }

        if (!docs || docs.length === 0) {
            console.log('📭 Nenhum documento para excluir permanentemente')
            return new Response(
                JSON.stringify({ success: true, deleted: 0 }),
                                { status: 200, headers: { 'Content-Type': 'application/json' } }
            )
        }

        console.log(`📄 Encontrados ${docs.length} documentos para excluir`)

        // 2. Excluir arquivos do storage
        let deletedFromStorage = 0
        for (const doc of docs) {
            const { error: storageError } = await supabase.storage
            .from('medical-documents')
            .remove([doc.file_url])

            if (!storageError) {
                deletedFromStorage++
                console.log(`✅ Arquivo excluído: ${doc.file_url}`)
            } else {
                console.error(`❌ Erro ao excluir arquivo ${doc.file_url}:`, storageError)
            }
        }

        // 3. Excluir registros do banco
        const ids = docs.map(d => d.id)
        const { error: deleteError } = await supabase
        .from('documents')
        .delete()
        .in('id', ids)

        if (deleteError) {
            console.error('❌ Erro ao excluir registros:', deleteError)
            return new Response(
                JSON.stringify({ error: deleteError.message }),
                                { status: 500, headers: { 'Content-Type': 'application/json' } }
            )
        }

        console.log(`✅ Excluídos: ${docs.length} registros, ${deletedFromStorage} arquivos`)

        return new Response(
            JSON.stringify({
                success: true,
                deleted: docs.length,
                deletedFromStorage
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error('❌ Erro no job permanent-delete:', error)
        return new Response(
            JSON.stringify({ error: String(error) }),
                            { status: 500, headers: { 'Content-Type': 'application/json' } }
        )
    }
})
