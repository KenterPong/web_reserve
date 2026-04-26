import type { NextRequest } from 'next/server'

export function validatePhone(phone: string): boolean {
  return /^(\+886|0)[0-9]{8,9}$/.test(phone)
}

export function getClientIp(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0]?.trim() || 'unknown'
  const xri = req.headers.get('x-real-ip')
  if (xri) return xri.trim()
  const cf = req.headers.get('cf-connecting-ip')
  if (cf) return cf.trim()
  return 'unknown'
}

export function validateSlug(slug: string): boolean {
  return /^[a-z0-9]{3,30}$/.test(slug)
}

export function getWorkerIdFromCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null
  const match = cookieHeader.match(/worker_id=([^;]+)/)
  return match ? match[1] : null
}
