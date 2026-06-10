import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { supabaseAdmin } from '@/lib/supabase'
import { logAccess } from '@/lib/auth'
import { fileToHash } from '@/lib/utils'

// GET - List documents with search
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession()
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
    const userId = session.user.id as string
    const userRole = session.user.role as string

    let query = supabaseAdmin
      .from('documents')
      .select(`
        *,
        uploader:uploaded_by(name),
        reviewer:reviewed_by(name)
      `)

    // Role-based filtering
    if (userRole === 'atendente') {
      // Atendentes see their own uploads + all approved
      if (status === 'approved' || !status) {
        query = query.or(`uploaded_by.eq.${userId},and(status.eq.approved)`) 
      } else {
        query = query.eq('uploaded_by', userId)
      }
    } else if (userRole === 'revisor') {
      // Revisores see pending + all approved
      if (status === 'pending') {
        query = query.eq('status', 'pending')
      } else if (status === 'approved') {
        query = query.eq('status', 'approved')
      }
    }
    // Admin sees everything (no filter)

    // Apply status filter
    if (status && userRole === 'admin') {
      query = query.eq('status', status)
    }

    // Apply search filter
    if (search) {
      const searchClean = search.trim()
      query = query.or(`
        patient_name.ilike.%${searchClean}%,
        cpf.ilike.%${searchClean}%,
        system_code.ilike.%${searchClean}%,
        prontuario_code.ilike.%${searchClean}%
      `)
    }

    // Order by created_at desc
    query = query.order('created_at', { ascending: false })

    const { data, error } = await query

    if (error) {
      console.error('Documents fetch error:', error)
      return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 })
    }

    // Transform data
    const documents = data.map((doc: any) => ({
      ...doc,
      uploader_name: doc.uploader?.name || '-',
      reviewer_name: doc.reviewer?.name || null,
    }))

    return NextResponse.json({ documents })
  } catch (error) {
    console.error('Documents API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Create new document
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession()
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = session.user.role as string
    if (userRole !== 'atendente' && userRole !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const {
      patient_name,
      cpf,
      prontuario_code,
      system_code,
      document_date,
      type,
      origin_sector,
      file_url,
      file_size,
      file_hash,
      never_delete,
    } = body

    // Check for duplicate file hash
    if (file_hash) {
      const { data: existing } = await supabaseAdmin
        .from('documents')
        .select('id')
        .eq('file_hash', file_hash)
        .limit(1)

      if (existing && existing.length > 0) {
        return NextResponse.json(
          { error: 'Este arquivo já foi enviado anteriormente' },
          { status: 409 }
        )
      }
    }

    // Check if there's a reproved version with same prontuario_code
    const { data: reprovedDoc } = await supabaseAdmin
      .from('documents')
      .select('*')
      .eq('prontuario_code', prontuario_code)
      .eq('status', 'reproved')
      .eq('uploaded_by', session.user.id)
      .order('created_at', { ascending: false })
      .limit(1)

    // If found, move old version to document_versions and delete file
    if (reprovedDoc && reprovedDoc.length > 0) {
      const oldDoc = reprovedDoc[0]
      
      // Create version record
      await supabaseAdmin.from('document_versions').insert({
        document_id: oldDoc.id,
        version_number: 1,
        file_url: oldDoc.file_url,
        status: oldDoc.status,
        review_note: oldDoc.review_note,
      })

      // Delete old file from storage
      if (oldDoc.file_url) {
        const path = oldDoc.file_url.split('/').pop()
        if (path) {
          await supabaseAdmin.storage.from('medical-documents').remove([path])
        }
      }

      // Delete old document record
      await supabaseAdmin.from('documents').delete().eq('id', oldDoc.id)
    }

    // Create new document
    const { data, error } = await supabaseAdmin
      .from('documents')
      .insert({
        patient_name,
        cpf,
        prontuario_code,
        system_code,
        document_date,
        type,
        origin_sector,
        file_url,
        file_size,
        file_hash,
        uploaded_by: session.user.id,
        status: 'pending',
        never_delete: never_delete || false,
      })
      .select()
      .single()

    if (error) {
      console.error('Document creation error:', error)
      return NextResponse.json({ error: 'Failed to create document' }, { status: 500 })
    }

    // Log access
    await logAccess(
      session.user.id as string,
      'upload',
      `Upload: ${patient_name} - ${system_code}`,
      request.headers.get('x-forwarded-for') || request.ip || null,
      data.id
    )

    return NextResponse.json({ document: data }, { status: 201 })
  } catch (error) {
    console.error('Document creation API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
