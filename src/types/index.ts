export interface WorkingHoursDay {
  start: string
  end: string
  closed: boolean
}

export interface WorkingHours {
  mon: WorkingHoursDay
  tue: WorkingHoursDay
  wed: WorkingHoursDay
  thu: WorkingHoursDay
  fri: WorkingHoursDay
  sat: WorkingHoursDay
  sun: WorkingHoursDay
}

export interface Worker {
  id: string
  line_user_id: string
  display_name: string
  avatar_url?: string | null
  /** 顧客預約確認／查詢時顯示的工作者聯絡電話 */
  contact_phone?: string | null
  /** 預約申請送出後顧客端顯示的提醒文字；未設定時用平台預設 */
  booking_confirmation_message?: string | null
  slug?: string | null
  business_name?: string | null
  bio?: string | null
  bio_answers?: Record<string, string> | null
  working_hours: WorkingHours
  working_hours_exceptions: Record<string, boolean>
  slot_duration: number
  referral_count: number
  referred_by?: string | null
  subscription_status: 'active' | 'inactive'
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Appointment {
  id: string
  worker_id: string
  customer_name: string
  customer_phone: string
  party_size: number
  service_item: string
  appointment_date: string
  appointment_time: string
  duration: number
  reference_image_url?: string | null
  note?: string | null
  /** 顧客改期／取消用；後台 GET 會帶出 */
  manage_token?: string | null
  status: 'confirmed' | 'cancelled' | 'completed' | 'no_show'
  created_at: string
  updated_at: string
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp?: string
}

export interface BlacklistEntry {
  id: string
  worker_id: string
  phone: string
  note: string | null
  created_at: string
}

export interface ChatSession {
  id: string
  worker_id: string
  session_token: string
  messages: ChatMessage[]
  status: 'active' | 'completed' | 'abandoned'
  expires_at: string
  created_at: string
  updated_at: string
}
