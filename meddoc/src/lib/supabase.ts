import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!

// Cliente com service role (para operações administrativas)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

// Cliente anônimo (para operações públicas)
export const supabaseClient = createClient(supabaseUrl, supabaseAnonKey)

// Cliente para Server Components
export async function createServerSupabaseClient() {
  const cookieStore = cookies()
  
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value
      },
      set(name: string, value: string, options: any) {
        cookieStore.set({ name, value, ...options })
      },
      remove(name: string, options: any) {
        cookieStore.set({ name, value: '', ...options })
      },
    },
  })
}

// Storage bucket name
export const STORAGE_BUCKET = 'medical-documents'

// Funções auxiliares para Storage
export async function uploadFile(file: File, path: string): Promise<string | null> {
  try {
    const { data, error } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .upload(path, file, {
        cacheControl: '3600',
        upsert: false,
      })

    if (error) {
      console.error('Upload error:', error)
      return null
    }

    const { data: { publicUrl } } = supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(data.path)

    return data.path
  } catch (error) {
    console.error('Upload error:', error)
    return null
  }
}

export async function deleteFile(path: string): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .remove([path])

    if (error) {
      console.error('Delete error:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('Delete error:', error)
    return false
  }
}

export async function getFileUrl(
  path: string,
  expiresIn = 3600  // 1 hora
): Promise<string | null> {
  try {
    const { data, error } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(path, expiresIn)
    if (error || !data) return null
      return data.signedUrl
  } catch (error) {
    console.error('Get signed URL error:', error)
    return null
  }
}
