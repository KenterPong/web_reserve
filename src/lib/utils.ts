import type { NextRequest } from 'next/server'

export function validatePhone(phone: string): boolean {
  return /^(\+886|0)[0-9]{8,9}$/.test(phone)
}

/** 將台灣門號統一成 0 開頭，供黑名單與預約比對（+8869… → 09…） */
export function normalizeTaiwanPhone(phone: string): string {
  let p = phone.trim().replace(/[\s-]/g, '')
  if (p.startsWith('+886')) return `0${p.slice(4)}`
  return p
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

/** 盡量在「使用者點擊」同一同步堆疊內啟動 Clipboard API，並提供 execCommand 後備（行動裝置較穩）。 */
export function copyTextToClipboard(text: string): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false)

  const fallbackExecCommand = (): boolean => {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.setAttribute('readonly', '')
      ta.style.position = 'fixed'
      ta.style.left = '-9999px'
      ta.style.top = '0'
      document.body.appendChild(ta)
      ta.focus()
      ta.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(ta)
      return ok
    } catch {
      return false
    }
  }

  if (navigator.clipboard?.writeText) {
    // 不要用 await：避免部分瀏覽器把複製判定為已脫離 user gesture
    return navigator.clipboard.writeText(text).then(() => true).catch(() => fallbackExecCommand())
  }

  return Promise.resolve(fallbackExecCommand())
}
