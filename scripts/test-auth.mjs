import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const anon = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

if (!url || !anon) {
  console.error('Missing Supabase env. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env')
  process.exit(1)
}

const client = createClient(url, anon)

const email = process.argv[2]
const password = process.argv[3]

if (!email || !password) {
  console.error('Usage: node scripts/test-auth.mjs <email> <password>')
  process.exit(1)
}

async function main() {
  try {
    const { data, error } = await client.auth.signInWithPassword({ email, password })
    if (error) {
      console.error('Sign-in failed:', error.message)
      process.exit(2)
    }
    console.log('Sign-in succeeded. User:', data.user?.email)
    process.exit(0)
  } catch (e) {
    console.error('Unexpected error:', e?.message || e)
    process.exit(3)
  }
}

main()
