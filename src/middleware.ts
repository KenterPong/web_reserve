import { NextRequest, NextResponse } from 'next/server'

import { validateSlug } from '@/lib/utils'

const ROOT_DOMAIN = (process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? '').toLowerCase()

/** 主網域單一路徑段若與 App 路由同名，不可當成推薦 slug（避免誤轉） */
const RESERVED_PATH_SEGMENTS = new Set([
  'auth',
  'booking',
  'dashboard',
  'privacy',
  'terms',
  'worker-profile',
])

function isMainMarketingHost(hostname: string): boolean {
  if (ROOT_DOMAIN) {
    return hostname === `www.${ROOT_DOMAIN}` || hostname === ROOT_DOMAIN
  }
  // 本機子網域測試：常見入口是 www.lvh.me
  return hostname === 'www.lvh.me'
}

/**
 * 從 Host 抽出「工作者子網域 slug」。
 * - 已設定 NEXT_PUBLIC_ROOT_DOMAIN：僅 *.ROOT_DOMAIN（且非 www、非 apex）視為子網域 slug。
 * - 未設定 ROOT：僅「至少三層」hostname（例如 slug.lvh.me）視為子網域，避免 mybookdate.com 被誤判成 slug=mybookdate。
 */
function extractWorkerSlugFromHost(host: string): string | null {
  const hostname = host.split(':')[0].toLowerCase()

  if (hostname === 'localhost' || hostname === '127.0.0.1') return null
  if (hostname.startsWith('www.')) return null

  const parts = hostname.split('.')
  if (parts.length < 2) return null

  if (ROOT_DOMAIN) {
    if (hostname === ROOT_DOMAIN) return null
    if (!hostname.endsWith(`.${ROOT_DOMAIN}`)) return null
    return parts[0]
  }

  if (parts.length < 3) return null
  return parts[0]
}

export function middleware(req: NextRequest) {
  const host = req.headers.get('host') ?? ''
  const hostname = host.split(':')[0].toLowerCase()
  const pathname = req.nextUrl.pathname.replace(/\/+$/, '') || '/'

  // Protect /dashboard pages — API routes validate their own cookies
  if (pathname.startsWith('/dashboard')) {
    const workerId = req.cookies.get('worker_id')?.value
    if (!workerId) {
      return NextResponse.redirect(new URL('/api/auth/line-bootstrap', req.url))
    }
  }

  // Vercel 預設網域（*.vercel.app）的第一段是專案／部署 id，不是工作者 slug；
  // 若當成 slug 會 rewrite 到不存在的 profile → 404。
  if (hostname.endsWith('.vercel.app')) {
    return NextResponse.next()
  }

  const hostWorkerSlug = extractWorkerSlugFromHost(host)

  // 推薦連結：導向 line-bootstrap（寫 cookie + 導 LINE 或 in-app 頁；不可只進 /auth/login page 因 cookies().set 須在 Route Handler）
  // 1) 舊版：www?ref=slug（部分 LINE 內建瀏覽器會丟 query）
  // 2) 建議：www/{slug} 或 apex {slug}（路徑較不易被吃掉）；僅在主站 host，不在工作者子網域
  if (!hostWorkerSlug && isMainMarketingHost(hostname)) {
    if (pathname === '/') {
      const ref = req.nextUrl.searchParams.get('ref')?.trim() ?? ''
      if (ref && validateSlug(ref)) {
        const dest = new URL(req.url)
        dest.pathname = '/api/auth/line-bootstrap'
        dest.search = `?ref=${encodeURIComponent(ref)}`
        return NextResponse.redirect(dest)
      }
    }

    const one = pathname.match(/^\/([^/]+)$/)
    if (one) {
      const seg = one[1]!.toLowerCase()
      if (!RESERVED_PATH_SEGMENTS.has(seg) && validateSlug(seg)) {
        const dest = new URL(req.url)
        dest.pathname = '/api/auth/line-bootstrap'
        dest.search = `?ref=${encodeURIComponent(seg)}`
        return NextResponse.redirect(dest)
      }
    }
  }

  if (!hostWorkerSlug) return NextResponse.next()

  // Subdomain rewrite: keep the external URL intact, map to internal routes
  if (pathname === '/') {
    return NextResponse.rewrite(
      new URL(`/worker-profile?slug=${encodeURIComponent(hostWorkerSlug)}`, req.url),
    )
  }
  if (pathname === '/booking') {
    return NextResponse.rewrite(
      new URL(`/booking?slug=${encodeURIComponent(hostWorkerSlug)}`, req.url),
    )
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
