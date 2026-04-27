import { NextRequest, NextResponse } from 'next/server'

const ROOT_DOMAIN = (process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? '').toLowerCase()

// Returns the worker slug if the host is a worker subdomain (not www).
// If NEXT_PUBLIC_ROOT_DOMAIN is set, only treat *.ROOT_DOMAIN as valid worker subdomains.
function extractSlug(host: string): string | null {
  const hostname = host.split(':')[0].toLowerCase()

  if (hostname === 'localhost' || hostname === '127.0.0.1') return null
  if (hostname.startsWith('www.')) return null

  const parts = hostname.split('.')
  if (parts.length < 2) return null

  if (ROOT_DOMAIN) {
    if (hostname === ROOT_DOMAIN) return null
    if (!hostname.endsWith(`.${ROOT_DOMAIN}`)) return null
  }

  return parts[0]
}

export function middleware(req: NextRequest) {
  const host = req.headers.get('host') ?? ''
  const hostname = host.split(':')[0].toLowerCase()
  const { pathname } = req.nextUrl

  // Protect /dashboard pages — API routes validate their own cookies
  if (pathname.startsWith('/dashboard')) {
    const workerId = req.cookies.get('worker_id')?.value
    if (!workerId) {
      return NextResponse.redirect(new URL('/auth/login', req.url))
    }
  }

  // Vercel 預設網域（*.vercel.app）的第一段是專案／部署 id，不是工作者 slug；
  // 若當成 slug 會 rewrite 到不存在的 profile → 404。
  if (hostname.endsWith('.vercel.app')) {
    return NextResponse.next()
  }

  const slug = extractSlug(host)
  if (!slug) return NextResponse.next()

  // Subdomain rewrite: keep the external URL intact, map to internal routes
  if (pathname === '/') {
    return NextResponse.rewrite(
      new URL(`/worker-profile?slug=${encodeURIComponent(slug)}`, req.url),
    )
  }
  if (pathname === '/booking') {
    return NextResponse.rewrite(
      new URL(`/booking?slug=${encodeURIComponent(slug)}`, req.url),
    )
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
