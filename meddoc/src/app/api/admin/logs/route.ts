import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { supabaseAdmin } from '@/lib/supabase'

// GET - List access logs
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

    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action') || ''
    const limit = parseInt(searchParams.get('limit') || '100')

    let query = supabaseAdmin
      .from('access_logs')
      .select(`
        *,
        user:user_id(name)
      `)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (action && action !== 'all') {
      query = query.eq('action', action)
    }

    const { data, error } = await query

    if (error) {
      console.error('Logs fetch error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch logs' },
        { status: 500 }
      )
    }

    // Transform data
    const logs = data.map((log: any) => ({
      ...log,
      user_name: log.user?.name || '-',
    }))

    return NextResponse.json({ logs })
  } catch (error) {
    console.error('Logs API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
