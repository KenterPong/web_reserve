import { NextRequest, NextResponse } from 'next/server'

import {
  LINE_OAUTH_STATE_COOKIE_NAME,
  lineOAuthStateCookieDomain,
} from '@/lib/line-oauth-state'
import {
  buildLineAuthorizeUrl,
  createLineOAuthState,
  preferManualLineLoginNavigation,
  safeRefFromQuery,
} from '@/lib/line-login-oauth'
import {
  REFERRAL_INTENT_COOKIE_NAME,
  clearReferralIntentCookieOptions,
  safeSlugFromString,
} from '@/lib/referral-intent-cookie'

function resolveBootstrapRef(request: NextRequest): string {
  const fromQuery = safeRefFromQuery(request.nextUrl.searchParams.get('ref'))
  if (fromQuery) return fromQuery
  const fromCookie = safeSlugFromString(
    request.cookies.get(REFERRAL_INTENT_COOKIE_NAME)?.value,
  )
  return fromCookie
}

/**
 * 設定 line_oauth_state cookie 並導向 LINE，或導向 in-app 登入頁。
 * 必須在 Route Handler 做 cookies().set（不可在 Server Component page 使用）。
 */
export async function GET(request: NextRequest) {
  const hostHeader = request.headers.get('host') ?? 'localhost'
  const safeRef = resolveBootstrapRef(request)

  const state = createLineOAuthState(safeRef)
  const domain = lineOAuthStateCookieDomain(hostHeader)

  let authorizeUrl: string
  try {
    authorizeUrl = buildLineAuthorizeUrl(state)
  } catch {
    return NextResponse.json(
      { error: 'LINE OAuth 環境變數未設定' },
      { status: 500 },
    )
  }

  const ua = request.headers.get('user-agent') ?? ''
  const dest = preferManualLineLoginNavigation(ua)
    ? new URL('/auth/login/in-app', request.url)
    : authorizeUrl

  const response = NextResponse.redirect(dest)
  response.cookies.set(LINE_OAUTH_STATE_COOKIE_NAME, state, {
    path: '/',
    maxAge: 600,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    ...(domain ? { domain } : {}),
  })
  // 推薦意圖僅供進 LINE 前使用一次，避免舊 cookie 影響下次登入
  response.cookies.set(
    REFERRAL_INTENT_COOKIE_NAME,
    '',
    clearReferralIntentCookieOptions(hostHeader),
  )

  return response
}
