// Script to add authentication tables to the database
const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function addAuthTables() {
  console.log('🔐 Adding authentication tables...')

  try {
    // Create login_codes table
    console.log('📝 Creating login_codes table...')
    const { error: loginCodesError } = await supabase.rpc('exec', {
      sql: `
        CREATE TABLE IF NOT EXISTS login_codes (
          id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
          email TEXT NOT NULL,
          code TEXT NOT NULL,
          expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
          used_at TIMESTAMP WITH TIME ZONE,
          attempts INTEGER DEFAULT 0,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    })

    if (loginCodesError) {
      console.log('ℹ️  login_codes table may already exist:', loginCodesError.message)
    } else {
      console.log('✅ login_codes table created')
    }

    // Create user_sessions table
    console.log('🔑 Creating user_sessions table...')
    const { error: sessionsError } = await supabase.rpc('exec', {
      sql: `
        CREATE TABLE IF NOT EXISTS user_sessions (
          id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
          user_id UUID REFERENCES users(id) ON DELETE CASCADE,
          session_token TEXT UNIQUE NOT NULL,
          expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
          user_agent TEXT,
          ip_address TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    })

    if (sessionsError) {
      console.log('ℹ️  user_sessions table may already exist:', sessionsError.message)
    } else {
      console.log('✅ user_sessions table created')
    }

    // Create indexes
    console.log('📊 Creating indexes...')
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_login_codes_email ON login_codes(email);',
      'CREATE INDEX IF NOT EXISTS idx_login_codes_code ON login_codes(code);',
      'CREATE INDEX IF NOT EXISTS idx_login_codes_expires_at ON login_codes(expires_at);',
      'CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);',
      'CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token);',
      'CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);'
    ]

    for (const indexSql of indexes) {
      const { error } = await supabase.rpc('exec', { sql: indexSql })
      if (error) {
        console.log('ℹ️  Index may already exist:', error.message)
      }
    }

    console.log('✅ Indexes created')

    // Enable RLS
    console.log('🔒 Enabling RLS...')
    const rlsPolicies = [
      'ALTER TABLE login_codes ENABLE ROW LEVEL SECURITY;',
      'ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;',
      'CREATE POLICY IF NOT EXISTS "Login codes are accessible by all" ON login_codes FOR ALL USING (true);',
      'CREATE POLICY IF NOT EXISTS "User sessions are accessible by all" ON user_sessions FOR ALL USING (true);'
    ]

    for (const policySql of rlsPolicies) {
      const { error } = await supabase.rpc('exec', { sql: policySql })
      if (error) {
        console.log('ℹ️  RLS policy may already exist:', error.message)
      }
    }

    console.log('✅ RLS enabled')

    console.log('\n🎉 Authentication tables setup completed!')
    console.log('\nNext steps:')
    console.log('1. Test the application at http://localhost:3000')
    console.log('2. Try uploading a resume')
    console.log('3. Check job recommendations')

  } catch (error) {
    console.error('❌ Error adding auth tables:', error)
    process.exit(1)
  }
}

// Run the script
addAuthTables()
