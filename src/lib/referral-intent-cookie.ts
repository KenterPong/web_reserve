import { lineOAuthStateCookieDomain } from '@/lib/line-oauth-state'
import { validateSlug } from '@/lib/utils'

/** httpOnly：使用者在 /join 確認後，供 GET /api/auth/line-bootstrap 讀取再寫入 OAuth state */
export const REFERRAL_INTENT_COOKIE_NAME = 'referral_slug_intent'
export const REFERRAL_INTENT_MAX_AGE_SEC = 60 * 60

export function referralIntentCookieOptions(hostHeader: string) {
  const domain = lineOAuthStateCookieDomain(hostHeader)
  return {
    path: '/' as const,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: REFERRAL_INTENT_MAX_AGE_SEC,
    ...(domain ? { domain } : {}),
  }
}

export function clearReferralIntentCookieOptions(hostHeader: string) {
  const domain = lineOAuthStateCookieDomain(hostHeader)
  return {
    path: '/' as const,
    maxAge: 0,
    ...(domain ? { domain } : {}),
  }
}

export function safeSlugFromString(raw: string | null | undefined): string {
  const t = (raw ?? '').trim().toLowerCase()
  return validateSlug(t) ? t : ''
}
