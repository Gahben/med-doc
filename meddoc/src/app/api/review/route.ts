import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { supabaseAdmin } from '@/lib/supabase'
import { logAccess } from '@/lib/auth'

// GET - Get pending review queue
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession()
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = session.user.role as string
    if (userRole !== 'revisor' && userRole !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get pending documents ordered by created_at (oldest first)
    const { data, error } = await supabaseAdmin
      .from('documents')
      .select(`
        *,
        uploader:uploaded_by(name)
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Review queue fetch error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch review queue' },
        { status: 500 }
      )
    }

    // Transform data
    const queue = data.map((doc: any) => ({
      id: doc.id,
      patient_name: doc.patient_name,
      cpf: doc.cpf,
      code: doc.system_code,
      type: doc.type,
      sender: doc.uploader?.name || '-',
      date: doc.created_at,
      pages: 1, // Simulated - would need actual page count from PDF
    }))

    return NextResponse.json({ queue })
  } catch (error) {
    console.error('Review API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Approve or reprove document
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession()
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = session.user.role as string
    if (userRole !== 'revisor' && userRole !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { document_id, action, note } = body

    if (!document_id || !action) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    if (action !== 'approve' && action !== 'reprove') {
      return NextResponse.json(
        { error: 'Invalid action' },
        { status: 400 }
      )
    }

    // If reproving, note is required
    if (action === 'reprove' && !note) {
      return NextResponse.json(
        { error: 'Motivo obrigatório para não liberação' },
        { status: 400 }
      )
    }

    const status = action === 'approve' ? 'approved' : 'reproved'

    // Update document
    const { data, error } = await supabaseAdmin
      .from('documents')
      .update({
        status,
        review_note: note || null,
        reviewed_by: session.user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', document_id)
      .select()
      .single()

    if (error) {
      console.error('Review update error:', error)
      return NextResponse.json(
        { error: 'Failed to update document' },
        { status: 500 }
      )
    }

    // Log access
    await logAccess(
      session.user.id as string,
      action === 'approve' ? 'approve' : 'reprove',
      `${action === 'approve' ? 'Aprovado' : 'Reprovado'}: ${data.patient_name} - ${data.system_code}${note ? ` - Nota: ${note}` : ''}`,
      request.headers.get('x-forwarded-for') || request.ip || null,
      document_id
    )

    return NextResponse.json({ document: data })
  } catch (error) {
    console.error('Review action API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
