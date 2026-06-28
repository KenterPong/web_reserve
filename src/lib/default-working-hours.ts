import type { WorkingHours } from '@/types'

/** 與 supabase/schema.sql 預設一致 */
export function getDefaultWorkingHours(): WorkingHours {
  return {
    mon: { start: '10:00', end: '20:00', closed: false },
    tue: { start: '10:00', end: '20:00', closed: false },
    wed: { start: '10:00', end: '20:00', closed: false },
    thu: { start: '10:00', end: '20:00', closed: false },
    fri: { start: '10:00', end: '20:00', closed: false },
    sat: { start: '10:00', end: '18:00', closed: false },
    sun: { start: '00:00', end: '00:00', closed: true },
  }
}
