/** 與 `blocked-slots-access`、後台導覽列解鎖邏輯一致 */
export const MIN_REFERRALS_BLOCKED_SLOTS = 15

/** Parse Postgres TIME / "HH:MM" / "HH:MM:SS" to minutes from midnight */
export function timeStrToMinutes(s: string): number {
  const parts = String(s).trim().split(':')
  const h = Number(parts[0] ?? 0)
  const m = Number(parts[1] ?? 0)
  return (h || 0) * 60 + (m || 0)
}

/** Half-open intervals [a, b) */
export function rangesOverlap(
  aStart: number,
  aEndExclusive: number,
  bStart: number,
  bEndExclusive: number,
): boolean {
  return aStart < bEndExclusive && aEndExclusive > bStart
}

export type BlockedSlotRow = {
  blocked_date: string
  start_time: string
  end_time: string
}

/** Whether an appointment slot [slotStart, slotStart+durationMin) overlaps any block on that date */
export function appointmentOverlapsBlockedSlots(
  appointmentDate: string,
  slotStartHhmm: string,
  durationMin: number,
  rows: BlockedSlotRow[],
): boolean {
  const slotStart = timeStrToMinutes(slotStartHhmm)
  const slotEnd = slotStart + durationMin
  for (const row of rows) {
    if (row.blocked_date !== appointmentDate) continue
    const bs = timeStrToMinutes(row.start_time)
    const be = timeStrToMinutes(row.end_time)
    if (rangesOverlap(slotStart, slotEnd, bs, be)) return true
  }
  return false
}

/**
 * Slot start times (HH:MM) within [businessStart, businessEnd) that overlap any blocked range.
 */
export function blockedSlotStartHhmmSet(
  slotDurationMin: number,
  businessStartMin: number,
  businessEndMin: number,
  blocks: Array<{ start_time: string; end_time: string }>,
): Set<string> {
  const out = new Set<string>()
  const blocksMin = blocks.map((b) => ({
    a: timeStrToMinutes(b.start_time),
    b: timeStrToMinutes(b.end_time),
  }))
  for (let t = businessStartMin; t + slotDurationMin <= businessEndMin; t += slotDurationMin) {
    const te = t + slotDurationMin
    for (const blk of blocksMin) {
      if (rangesOverlap(t, te, blk.a, blk.b)) {
        const hh = String(Math.floor(t / 60)).padStart(2, '0')
        const mm = String(t % 60).padStart(2, '0')
        out.add(`${hh}:${mm}`)
        break
      }
    }
  }
  return out
}
