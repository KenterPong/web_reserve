type Counter = { count: number; resetAt: number }

declare global {
  // eslint-disable-next-line no-var
  var __simpleRateLimitCounters: Map<string, Counter> | undefined
}

function getStore(): Map<string, Counter> {
  if (!globalThis.__simpleRateLimitCounters) {
    globalThis.__simpleRateLimitCounters = new Map()
  }
  return globalThis.__simpleRateLimitCounters
}

/** 以任意字串 key 做固定視窗計數（MVP：程序內記憶體；上線可換 Redis） */
export function checkRateLimit(options: {
  key: string
  limit: number
  windowMs: number
}): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now()
  const store = getStore()
  const current = store.get(options.key)

  if (!current || current.resetAt <= now) {
    const resetAt = now + options.windowMs
    store.set(options.key, { count: 1, resetAt })
    return { allowed: true, remaining: options.limit - 1, resetAt }
  }

  if (current.count >= options.limit) {
    return { allowed: false, remaining: 0, resetAt: current.resetAt }
  }

  current.count += 1
  store.set(options.key, current)
  return { allowed: true, remaining: options.limit - current.count, resetAt: current.resetAt }
}

/** @deprecated 使用 checkRateLimit；保留別名避免大範圍改名 */
export function checkIpRateLimit(options: {
  key: string
  limit: number
  windowMs: number
}): { allowed: boolean; remaining: number; resetAt: number } {
  return checkRateLimit(options)
}

