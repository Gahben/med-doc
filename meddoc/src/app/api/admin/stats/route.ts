import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { supabaseAdmin } from '@/lib/supabase'

// GET - Get dashboard statistics
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession()
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = session.user.role as string
    if (userRole !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get counts
    const [
      { count: totalApproved, error: err1 },
      { count: pendingReview, error: err2 },
      { count: inTrash, error: err3 },
      { data: pendingDocs, error: err4 },
    ] = await Promise.all([
      supabaseAdmin
        .from('documents')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'approved'),
      supabaseAdmin
        .from('documents')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending'),
      supabaseAdmin
        .from('documents')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'trash'),
      supabaseAdmin
        .from('documents')
        .select('created_at')
        .eq('status', 'pending'),
    ])

    if (err1 || err2 || err3 || err4) {
      console.error('Stats error:', err1, err2, err3, err4)
      return NextResponse.json(
        { error: 'Failed to fetch statistics' },
        { status: 500 }
      )
    }

    // Calculate pending alerts (more than 24 hours)
    const now = new Date()
    const alertThreshold = 24 * 60 * 60 * 1000 // 24 hours in ms
    let pendingAlert = 0

    if (pendingDocs) {
      pendingAlert = pendingDocs.filter((doc: any) => {
        const created = new Date(doc.created_at)
        return now.getTime() - created.getTime() > alertThreshold
      }).length
    }

    // Get storage usage (approximate from file sizes)
    const { data: files, error: err5 } = await supabaseAdmin
      .from('documents')
      .select('file_size')

    let storageUsed = 0
    if (files) {
      storageUsed = files.reduce((acc: number, doc: any) => acc + (doc.file_size || 0), 0)
    }

    // Format storage
    const formatStorage = (bytes: number): string => {
      if (bytes === 0) return '0 MB'
      const mb = bytes / (1024 * 1024)
      if (mb < 1024) return `${mb.toFixed(1)} MB`
      const gb = mb / 1024
      return `${gb.toFixed(2)} GB`
    }

    const stats = {
      totalApproved: totalApproved || 0,
      pendingReview: pendingReview || 0,
      inTrash: inTrash || 0,
      storageUsed: formatStorage(storageUsed),
      pendingAlert,
    }

    return NextResponse.json({ stats })
  } catch (error) {
    console.error('Stats API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
