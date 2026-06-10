import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { supabaseAdmin } from '@/lib/supabase'

// GET - Get next system code
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession()
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = session.user.role as string
    if (userRole !== 'atendente' && userRole !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const currentYear = new Date().getFullYear()

    // Get the highest sequential number for current year
    const { data, error } = await supabaseAdmin
      .from('documents')
      .select('system_code')
      .ilike('system_code', `${currentYear}-%`)
      .order('system_code', { ascending: false })
      .limit(1)

    if (error) {
      console.error('Next code fetch error:', error)
      return NextResponse.json(
        { error: 'Failed to generate code' },
        { status: 500 }
      )
    }

    let nextSequential = 1

    if (data && data.length > 0) {
      const lastCode = data[0].system_code
      const lastSequential = parseInt(lastCode.split('-')[1])
      if (!isNaN(lastSequential)) {
        nextSequential = lastSequential + 1
      }
    }

    const nextCode = `${currentYear}-${nextSequential.toString().padStart(5, '0')}`

    return NextResponse.json({ code: nextCode })
  } catch (error) {
    console.error('Next code API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
