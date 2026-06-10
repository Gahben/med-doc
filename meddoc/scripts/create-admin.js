#!/usr/bin/env node

/**
 * Script para criar o primeiro usuário administrador
 * 
 * Uso: node scripts/create-admin.js <email> <nome> <senha>
 * Exemplo: node scripts/create-admin.js admin@clinica.com "Administrador" senha123
 */

const { createClient } = require('@supabase/supabase-js')
const bcrypt = require('bcryptjs')

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('❌ Erro: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY devem estar definidos')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

async function createAdmin(email, name, password) {
  try {
    // Hash password
    const passwordHash = await bcrypt.hash(password, 12)

    // Check if user already exists
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase())
      .limit(1)

    if (existing && existing.length > 0) {
      console.error(`❌ Erro: Usuário com email ${email} já existe`)
      process.exit(1)
    }

    // Create admin user
    const { data, error } = await supabase
      .from('users')
      .insert({
        email: email.toLowerCase(),
        name,
        role: 'admin',
        password_hash: passwordHash,
        active: true,
      })
      .select()
      .single()

    if (error) {
      console.error('❌ Erro ao criar usuário:', error.message)
      process.exit(1)
    }

    console.log('✅ Usuário admin criado com sucesso!')
    console.log('')
    console.log('Dados de acesso:')
    console.log(`  Email: ${email}`)
    console.log(`  Senha: ${password}`)
    console.log(`  Perfil: Admin`)
    console.log('')
    console.log('⚠️  Importante: Altere a senha após o primeiro login!')

  } catch (error) {
    console.error('❌ Erro:', error.message)
    process.exit(1)
  }
}

// Main
const args = process.argv.slice(2)

if (args.length < 3) {
  console.log('Uso: node scripts/create-admin.js <email> <nome> <senha>')
  console.log('Exemplo: node scripts/create-admin.js admin@clinica.com "Administrador" senha123')
  process.exit(1)
}

const [email, name, password] = args

createAdmin(email, name, password)
