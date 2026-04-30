import { randomBytes } from 'crypto'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'

import {
  LINE_OAUTH_STATE_COOKIE_NAME,
  lineOAuthStateCookieDomain,
} from '@/lib/line-oauth-state'
import { validateSlug } from '@/lib/utils'

import { LineLoginInAppModal } from './line-login-in-app-modal'

export const dynamic = 'force-dynamic'

function base64UrlEncodeUtf8(input: string): string {
  return Buffer.from(input, 'utf8').toString('base64url')
}

function createLineOAuthState(ref: string): string {
  const nonce = randomBytes(16).toString('hex') + Date.now().toString(36)
  return base64UrlEncodeUtf8(JSON.stringify({ nonce, ref }))
}

function buildLineAuthorizeUrl(state: string): string {
  const clientId = process.env.NEXT_PUBLIC_LINE_CLIENT_ID
  const redirectUri = process.env.NEXT_PUBLIC_LINE_CALLBACK_URL
  if (!clientId || !redirectUri) {
    throw new Error('LINE OAuth env missing')
  }
  const lineParams = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    scope: 'profile openid',
  })
  return `https://access.line.me/oauth2/v2.1/authorize?${lineParams.toString()}`
}

/**
 * LINE／Facebook／Instagram 等 in-app WebView 對自動跳轉至 access.line.me 常不穩（例如 ERR_CONNECTION_CLOSED）；
 * 改為由使用者主動點連結，並優先嘗試另開視窗（部分環境會改以外部瀏覽器開啟）。
 */
function preferManualLineLoginNavigation(userAgent: string): boolean {
  const u = userAgent
  return (
    /\bLine\//i.test(u) ||
    /\bFBAN\b/i.test(u) ||
    /\bFBAV\b/i.test(u) ||
    /\bInstagram\b/i.test(u)
  )
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { ref?: string | string[] }
}) {
  const rawRef = searchParams.ref
  const refParam = Array.isArray(rawRef) ? rawRef[0] : rawRef
  const refTrim = (refParam ?? '').trim()
  const safeRef = validateSlug(refTrim) ? refTrim : ''

  const state = createLineOAuthState(safeRef)
  const hostHeader = headers().get('host') ?? 'localhost'
  const domain = lineOAuthStateCookieDomain(hostHeader)

  cookies().set(LINE_OAUTH_STATE_COOKIE_NAME, state, {
    path: '/',
    maxAge: 600,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    ...(domain ? { domain } : {}),
  })

  let authorizeUrl: string
  try {
    authorizeUrl = buildLineAuthorizeUrl(state)
  } catch {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
        <p className="text-red-600 text-center text-sm">
          伺服器未設定 LINE 登入（NEXT_PUBLIC_LINE_CLIENT_ID／NEXT_PUBLIC_LINE_CALLBACK_URL），請聯絡管理員。
        </p>
      </div>
    )
  }

  const ua = headers().get('user-agent') ?? ''

  if (preferManualLineLoginNavigation(ua)) {
    return (
      <div className="min-h-screen bg-gray-100">
        <LineLoginInAppModal authorizeUrl={authorizeUrl} />
      </div>
    )
  }

  redirect(authorizeUrl)
}
