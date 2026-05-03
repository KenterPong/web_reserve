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

/** 月曆標題用：YYYY-MM → 「2026年5月」（SSR 與瀏覽器一致，固定台北時區） */
export function formatMonthYearZhTaipei(ym: string): string {
  return new Intl.DateTimeFormat('zh-TW', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: 'long',
  }).format(new Date(`${ym}-01T12:00:00+08:00`))
}

/** 選定日的標題列：YYYY-MM-DD → 「2026年5月3日 星期日」 */
export function formatYmdLongZhTaipei(dateStr: string): string {
  return new Intl.DateTimeFormat('zh-TW', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(new Date(`${dateStr}T12:00:00+08:00`))
}

/** 該日在台北為週日 0 … 週六 6，供月曆開頭空白格 */
export function taipeiWeekdaySun0(dateStr: string): number {
  const key = dayKeyForDateTaipei(dateStr)
  const map: Record<(typeof DAY_KEYS)[number], number> = {
    sun: 0,
    mon: 1,
    tue: 2,
    wed: 3,
    thu: 4,
    fri: 5,
    sat: 6,
  }
  return map[key]
}

/** 時間戳在台北時區的讀法（通知「更新」等，避免 SSR 與客戶端字串不一致） */
export function formatInstantZhTaipei(ms: number): string {
  if (!Number.isFinite(ms)) return ''
  return new Date(ms).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })
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

/**
 * 預約時段「結束」的 epoch 毫秒（Asia/Taipei）：開始時間 + duration 分鐘。
 * `appointmentTime` 可為 `HH:MM` 或 `HH:MM:SS`。
 */
export function appointmentSlotEndMsTaipei(
  appointmentDate: string,
  appointmentTime: string,
  durationMinutes: number,
): number {
  const hhmm = String(appointmentTime).slice(0, 5)
  const startMs = new Date(`${appointmentDate}T${hhmm}:00+08:00`).getTime()
  if (!Number.isFinite(startMs)) return NaN
  const dur =
    Number.isFinite(durationMinutes) && durationMinutes > 0 ? Math.floor(durationMinutes) : 60
  return startMs + dur * 60 * 1000
}
