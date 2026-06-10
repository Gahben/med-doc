import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { supabaseAdmin } from '@/lib/supabase'
import { logAccess } from '@/lib/auth'

// GET - Get system config
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

    const { data, error } = await supabaseAdmin
      .from('system_config')
      .select('*')
      .single()

    if (error) {
      console.error('Config fetch error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch config' },
        { status: 500 }
      )
    }

    return NextResponse.json({ config: data })
  } catch (error) {
    console.error('Config API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH - Update system config
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession()
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = session.user.role as string
    if (userRole !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { trash_after_days, permanent_delete_after_days, alert_review_hours } = body

    const updateData: any = {}
    if (trash_after_days !== undefined) updateData.trash_after_days = trash_after_days
    if (permanent_delete_after_days !== undefined) updateData.permanent_delete_after_days = permanent_delete_after_days
    if (alert_review_hours !== undefined) updateData.alert_review_hours = alert_review_hours

    const { data, error } = await supabaseAdmin
      .from('system_config')
      .update(updateData)
      .eq('id', 1)
      .select()
      .single()

    if (error) {
      console.error('Config update error:', error)
      return NextResponse.json(
        { error: 'Failed to update config' },
        { status: 500 }
      )
    }

    // Log access
    await logAccess(
      session.user.id as string,
      'config_update',
      `Configurações atualizadas: Lixeira=${trash_after_days}d, Exclusão=${permanent_delete_after_days}d, Alerta=${alert_review_hours}h`,
      request.headers.get('x-forwarded-for') || request.ip || undefined
    )

    return NextResponse.json({ config: data })
  } catch (error) {
    console.error('Config update API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
