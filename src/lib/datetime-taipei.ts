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
