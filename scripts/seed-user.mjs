import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error('[seed-user] Missing env. Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env')
  process.exit(1)
}

const admin = createClient(url, serviceKey)

const email = process.argv[2]
const password = process.argv[3]

if (!email || !password) {
  console.error('Usage: node scripts/seed-user.mjs <email> <password>')
  process.exit(1)
}

async function findUserByEmail(targetEmail) {
  const perPage = 200
  let page = 1
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error) throw error
    const match = data.users.find(u => u.email?.toLowerCase() === targetEmail.toLowerCase())
    if (match) return match
    if (data.users.length < perPage) return null
    page += 1
  }
}

async function main() {
  try {
    const existing = await findUserByEmail(email)
    if (!existing) {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      })
      if (error) throw error
      console.log(`[seed-user] Created user ${data.user.email} (confirmed)`) 
      process.exit(0)
    } else {
      const { data, error } = await admin.auth.admin.updateUserById(existing.id, {
        password,
        email_confirm: true,
      })
      if (error) throw error
      console.log(`[seed-user] Updated password for ${data.user.email}`)
      process.exit(0)
    }
  } catch (e) {
    console.error('[seed-user] Error:', e?.message || e)
    process.exit(2)
  }
}

main()
