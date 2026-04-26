import 'server-only'
import { createClient } from '@supabase/supabase-js'

// Server-only: SUPABASE_SERVICE_ROLE_KEY must never appear in client bundles
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKeyRaw = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url) {
  throw new Error('Missing env: NEXT_PUBLIC_SUPABASE_URL')
}

// 新版 Supabase：`sb_secret_…`；舊版 JWT：`eyJ…`
function isPlausibleServiceRoleKey(key: string): boolean {
  const t = key.trim()
  return t.startsWith('sb_secret_') || t.startsWith('eyJ')
}

const serviceRoleKey = (serviceRoleKeyRaw ?? '').trim()
if (!isPlausibleServiceRoleKey(serviceRoleKey)) {
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
