import 'server-only'
import { createClient } from '@supabase/supabase-js'

// Server-only: SUPABASE_SERVICE_ROLE_KEY must never appear in client bundles
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url) {
  throw new Error('Missing env: NEXT_PUBLIC_SUPABASE_URL')
}

if (!serviceRoleKey || !serviceRoleKey.startsWith('sb_secret_')) {
  throw new Error('Missing/invalid env: SUPABASE_SERVICE_ROLE_KEY')
}

export const supabaseAdmin = createClient(
  url,
  serviceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
)
