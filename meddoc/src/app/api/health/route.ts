import { NextResponse } from 'next/server'
import { supabaseClient } from '@/lib/supabase'

export async function GET() {
  try {
    // Test Supabase connection
    const { error } = await supabaseClient.from('system_config').select('count').limit(1)
    
    if (error) {
      console.error('Health check - Supabase error:', error)
      return NextResponse.json(
        { status: 'error', message: 'Database connection failed' },
        { status: 503 }
      )
    }

    return NextResponse.json(
      { status: 'ok', timestamp: new Date().toISOString() },
      { status: 200 }
    )
  } catch (error) {
    console.error('Health check error:', error)
    return NextResponse.json(
      { status: 'error', message: 'Service unavailable' },
      { status: 503 }
    )
  }
}
