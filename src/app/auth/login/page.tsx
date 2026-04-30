import { redirect } from 'next/navigation'

import { validateSlug } from '@/lib/utils'

export const dynamic = 'force-dynamic'

/**
 * 實際寫 cookie 與導向須在 Route Handler（/api/auth/line-bootstrap），
 * 此頁僅轉址以免在 Server Component 呼叫 cookies().set 造成 500。
 */
export default function LoginPage({
  searchParams,
}: {
  searchParams: { ref?: string | string[] }
}) {
  const rawRef = searchParams.ref
  const refParam = Array.isArray(rawRef) ? rawRef[0] : rawRef
  const refTrim = (refParam ?? '').trim()
  const safeRef = validateSlug(refTrim) ? refTrim : ''

  const q = new URLSearchParams()
  if (safeRef) q.set('ref', safeRef)
  const qs = q.toString()
  redirect(qs ? `/api/auth/line-bootstrap?${qs}` : '/api/auth/line-bootstrap')
}
