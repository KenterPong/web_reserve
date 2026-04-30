import { randomBytes } from 'crypto'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'

import {
  LINE_OAUTH_STATE_COOKIE_NAME,
  lineOAuthStateCookieDomain,
} from '@/lib/line-oauth-state'
import { validateSlug } from '@/lib/utils'

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
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-6">
        <div className="w-16 h-16 bg-green-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <span className="text-white font-bold text-xl">LINE</span>
        </div>
        <h1 className="text-gray-900 font-semibold text-center mb-2">完成 LINE 登入</h1>
        <p className="text-gray-600 text-sm text-center mb-2 max-w-md">
          你目前可能正在 LINE、Facebook 或 Instagram 的內建瀏覽器中；請<strong>點下方綠色按鈕</strong>繼續（系統會盡量改以外部瀏覽器開啟）。
        </p>
        <p className="text-gray-500 text-xs text-center mb-6 max-w-md">
          若出現「無法連上網站」或連線中斷，請點右上角 <span className="whitespace-nowrap">⋯</span> 選「在
          Safari／Chrome 開啟」，再重新開啟分享連結。
        </p>
        <a
          href={authorizeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center rounded-xl bg-[#06C755] px-8 py-3 text-white font-semibold shadow"
        >
          前往 LINE 登入
        </a>
        <a
          href={authorizeUrl}
          className="mt-4 text-xs text-gray-500 underline underline-offset-2"
        >
          改在目前視窗開啟
        </a>
      </div>
    )
  }

  redirect(authorizeUrl)
}
