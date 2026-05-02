import Anthropic from '@anthropic-ai/sdk'
import { ChatMessage, Worker, Appointment } from '@/types'

type AppointmentSlot = Pick<Appointment, 'appointment_date' | 'appointment_time' | 'duration'>

export type BlockedSlotPromptRow = {
  blocked_date: string
  start_time: string
  end_time: string
}

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

const DAY_NAMES: Record<string, string> = {
  mon: '週一', tue: '週二', wed: '週三',
  thu: '週四', fri: '週五', sat: '週六', sun: '週日',
}

export function buildSystemPrompt(
  worker: Worker,
  appointments: AppointmentSlot[],
  opts?: { mentionedDateWeekdays?: string; blockedSlots?: BlockedSlotPromptRow[] },
): string {
  const todayStr = new Date().toLocaleDateString('zh-TW', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
    timeZone: 'Asia/Taipei',
  })

  const workingHoursText = Object.entries(worker.working_hours)
    .map(([day, s]) =>
      s.closed ? `${DAY_NAMES[day]}：公休` : `${DAY_NAMES[day]}：${s.start}～${s.end}`,
    )
    .join('\n')

  const exceptionsText =
    Object.entries(worker.working_hours_exceptions)
      .filter(([, closed]) => closed)
      .map(([date]) => date)
      .join('、') || '（無）'

  const bookedText =
    appointments.length === 0
      ? '目前尚無預約'
      : appointments
          .map(a => `${a.appointment_date} ${a.appointment_time.slice(0, 5)}`)
          .join('、')

  const blockedSlots = opts?.blockedSlots ?? []
  const blockedText =
    blockedSlots.length === 0
      ? '（無）'
      : blockedSlots
          .map(
            (b) =>
              `${b.blocked_date} ${String(b.start_time).slice(0, 5)}～${String(b.end_time).slice(0, 5)}`,
          )
          .join('、')

  const workerName = worker.business_name || worker.display_name

  const dateWeekdayBlock = opts?.mentionedDateWeekdays?.trim()
    ? `【顧客訊息中出現的日期 — 星期幾（已由後端依台北時區算出，不得自行推測）】
${opts.mentionedDateWeekdays}

`
    : ''

  return `你是「${workerName}」的 AI 預約助理，負責幫顧客完成預約。

今天是 ${todayStr}（台北時間）。

${dateWeekdayBlock}【硬規則 - 必須遵守】
1. 只能預約未來時段：最早 1 小時後，最晚 30 天內
2. 每次服務時長固定為 ${worker.slot_duration} 分鐘
3. 可預約與否以本 prompt 所提供的資料為準，不得自行猜測
4. 時段確認後必須輸出 action token（輸出到回覆最末）：
   [ACTION:SHOW_CONTACT_FORM:YYYY-MM-DD:HH:MM]

【${workerName} 的營業時間】
${workingHoursText}

【不規則公休日】
${exceptionsText}

【已預約時段（confirmed）】
${bookedText}

【封鎖時段（該時段不可預約，與「已預約」不同）】
${blockedText}

【判斷邏輯】
- 顧客要求的時段不在營業時間、屬公休日、已有預約、或落在封鎖時段內 → 說明原因，主動提供 2～3 個替代時段
- 時段可預約 → 確認時段，請顧客提供姓名與電話，並輸出 action token

【對話風格】
- 繁體中文，語氣親切自然
- 回覆簡短有重點，不超過 3 句話
- 不主動透露自己是 AI
- 不要求電話以外的個資
- 不討論與預約無關的話題`
}

export async function sendMessage(
  messages: ChatMessage[],
  systemPrompt: string,
): Promise<string> {
  const recent = messages.slice(-20)

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 500,
    system: systemPrompt,
    messages: recent.map(m => ({ role: m.role, content: m.content })),
  })

  const content = response.content[0]
  if (content.type !== 'text') throw new Error('Unexpected response type')
  return content.text
}

export async function generateBio(answers: Record<string, string>): Promise<string> {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 300,
    messages: [
      {
        role: 'user',
        content: `請根據以下資訊，用繁體中文寫一段 2～3 句的個人簡介，語氣親切專業，吸引顧客預約。不要使用 Markdown 格式。

姓名／稱呼：${answers.name || ''}
職業／專長：${answers.profession || ''}
工作年資：${answers.experience || ''}
服務特色：${answers.features || ''}
工作地點：${answers.location || ''}`,
      },
    ],
  })

  const content = response.content[0]
  if (content.type !== 'text') throw new Error('Unexpected response type')
  return content.text
}

/** 顧客送出預約後顯示的提醒文字（後台可再編輯） */
export async function generateBookingConfirmationMessage(
  businessName: string,
  bio: string,
): Promise<string> {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 280,
    messages: [
      {
        role: 'user',
        content: `請用繁體中文寫一段「預約申請已送出後」要顯示給顧客看的簡短提醒（約 2～4 句，總長不超過 150 字）。
目的：讓顧客知道店家會再確認預約、必要時會聯繫調整，語氣誠懇自然，不要像制式公告。不要 Markdown、不要編號、不要加引號框住全文。

店家／稱呼：${businessName.trim() || '（未設定）'}
簡介參考（模仿語氣即可，勿逐句抄寫）：${(bio || '').trim().slice(0, 600) || '（無）'}`,
      },
    ],
  })

  const content = response.content[0]
  if (content.type !== 'text') throw new Error('Unexpected response type')
  return content.text.trim()
}

export function parseAction(text: string) {
  const match = text.match(
    /\[ACTION:SHOW_CONTACT_FORM:(\d{4}-\d{2}-\d{2}):(\d{2}:\d{2})\]/,
  )
  if (match) {
    return {
      type: 'SHOW_CONTACT_FORM' as const,
      proposedDate: match[1],
      proposedTime: match[2],
      cleanText: text.replace(match[0], '').trim(),
    }
  }
  return {
    type: null as null,
    proposedDate: undefined as string | undefined,
    proposedTime: undefined as string | undefined,
    cleanText: text,
  }
}
