const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const

/** 以台北日曆日解析 YYYY-MM-DD 對應的營業週期鍵（不依賴伺服器本機時區） */
export function dayKeyForDateTaipei(dateStr: string): (typeof DAY_KEYS)[number] {
  const wd = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Taipei',
    weekday: 'short',
  }).format(new Date(`${dateStr}T12:00:00+08:00`))
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  }
  const idx = map[wd] ?? 0
  return DAY_KEYS[idx]
}

/** 台北時區該日期的完整星期文字（供 system prompt 注入） */
export function weekdayLabelTaipei(dateStr: string): string {
  return new Intl.DateTimeFormat('zh-TW', {
    timeZone: 'Asia/Taipei',
    weekday: 'long',
  }).format(new Date(`${dateStr}T12:00:00+08:00`))
}

export function taipeiTodayYmd(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })
}

/** 台北日曆「今天」與目前分鐘數（0～1439），供預約／改期 UI 與驗證 */
export function taipeiNowYmdMinutes(): { ymd: string; minutes: number } {
  const now = new Date()
  const ymd = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Taipei',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now)
  const hh = Number(parts.find((p) => p.type === 'hour')?.value ?? '0')
  const mm = Number(parts.find((p) => p.type === 'minute')?.value ?? '0')
  return { ymd, minutes: (hh || 0) * 60 + (mm || 0) }
}
