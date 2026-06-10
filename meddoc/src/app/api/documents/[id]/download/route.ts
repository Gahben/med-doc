import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { supabaseAdmin, STORAGE_BUCKET } from '@/lib/supabase'
import { logAccess } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Busca o documento
    const { data: doc, error } = await supabaseAdmin
      .from('documents')
      .select('*')
      .eq('id', params.id)
      .single()

    if (error || !doc) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // Apenas documentos aprovados podem ser baixados por atendentes
    const userRole = session.user.role as string
    if (userRole === 'atendente' && doc.status !== 'approved') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Gera Signed URL (1 hora de validade)
    const { data: signed, error: signErr } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(doc.file_url, 3600)

    if (signErr || !signed) {
      return NextResponse.json({ error: 'Failed to generate URL' }, { status: 500 })
    }

    // Atualiza last_accessed_at
    await supabaseAdmin
      .from('documents')
      .update({ last_accessed_at: new Date().toISOString() })
      .eq('id', params.id)

    // Registra no log de auditoria
    await logAccess(
      session.user.id as string,
      'download',
      `Download: ${doc.patient_name} - ${doc.system_code}`,
      request.headers.get('x-forwarded-for') || null,
      params.id
    )

    return NextResponse.json({ url: signed.signedUrl })
  } catch (err) {
    console.error('Download error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
