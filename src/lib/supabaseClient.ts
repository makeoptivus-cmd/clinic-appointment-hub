import { createClient } from '@supabase/supabase-js'

// Prefer environment variables from Vite (client-side) or Node (tests/SSR)
const env = typeof import.meta !== 'undefined' ? (import.meta as any).env ?? {} : {}

const supabaseUrl: string =
  env.VITE_SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  ''

const supabaseAnonKey: string =
  env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  env.VITE_SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  ''

if (!supabaseUrl || !supabaseAnonKey) {
  // Fail fast to avoid leaking secrets in code; ensure .env is set
  console.warn(
    '[supabaseClient] Missing Supabase config. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in your .env.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
