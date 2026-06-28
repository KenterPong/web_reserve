/** App 路由保留段；工作者 slug 不可與這些同名（含子網域） */
export const RESERVED_WORKER_SLUGS = new Set([
  'auth',
  'booking',
  'dashboard',
  'join',
  'onboarding',
  'privacy',
  'terms',
  'worker-profile',
  'www',
  'api',
])

export function isReservedWorkerSlug(slug: string): boolean {
  return RESERVED_WORKER_SLUGS.has(slug.toLowerCase())
}
