import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { buildSystemPrompt, sendMessage, parseAction } from '@/lib/claude'
import { ChatMessage } from '@/types'
import { dayKeyForDateTaipei, taipeiTodayYmd, weekdayLabelTaipei } from '@/lib/datetime-taipei'
import { checkRateLimit } from '@/lib/rate-limit'

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

function isExceptionClosed(worker: { working_hours_exceptions?: Record<string, boolean> }, date: string): boolean {
  return Boolean(worker.working_hours_exceptions?.[date])
}

function buildSuggestionsForDate(args: {
  worker: any
  booked: { appointment_date: string; appointment_time: string }[]
  date: string
  requestedTime: string
}): string[] {
  if (isExceptionClosed(args.worker, args.date)) return []

  const dur = Number(args.worker.slot_duration ?? 60)
  const wh = args.worker.working_hours
  const key = dayKeyForDateTaipei(args.date)
  const s = wh?.[key]
  if (!s || s.closed) return []

  const start = toMinutes(s.start)
  const end = toMinutes(s.end)
  const req = toMinutes(args.requestedTime.slice(0, 5))

  const bookedSet = new Set(
    args.booked
      .filter((b) => b.appointment_date === args.date)
      .map((b) => String(b.appointment_time).slice(0, 5)),
  )

  const slots: string[] = []
  for (let t = start; t + dur <= end; t += dur) {
    const hh = String(Math.floor(t / 60)).padStart(2, '0')
    const mm = String(t % 60).padStart(2, '0')
    const hhmm = `${hh}:${mm}`
    if (!bookedSet.has(hhmm)) slots.push(hhmm)
  }

  if (slots.length === 0) return []

  // Prefer the next available slot(s) at/after requested time
  const next = slots.filter((t) => toMinutes(t) >= req)
  const out = (next.length > 0 ? next : slots).slice(0, 3)
  return out
}

export async function POST(req: NextRequest) {
  try {
    const { workerId, sessionToken, message } = await req.json()

    if (!workerId || !sessionToken || !message?.trim()) {
      return NextResponse.json({ error: '缺少必要參數' }, { status: 400 })
    }

    const rl = checkRateLimit({
      key: `chat:${sessionToken}`,
      limit: 30,
      windowMs: 60 * 60 * 1000,
    })
    if (!rl.allowed) {
      return NextResponse.json({ error: '對話次數過多，請稍後再試' }, { status: 429 })
    }

    // Validate worker exists and is active
    const { data: worker } = await supabaseAdmin
      .from('workers')
      .select('*')
      .eq('id', workerId)
      .eq('is_active', true)
      .single()

    if (!worker) {
      return NextResponse.json({ error: '找不到工作者' }, { status: 404 })
    }

    // Find or create chat session
    const now = new Date().toISOString()
    const { data: existingSession } = await supabaseAdmin
      .from('chat_sessions')
      .select('*')
      .eq('session_token', sessionToken)
      .single()

    let session = existingSession

    if (existingSession) {
      // Reject expired sessions
      if (existingSession.expires_at <= now) {
        return NextResponse.json({ error: 'Session 已過期，請重新整理頁面' }, { status: 401 })
      }
      // Reject mismatched worker
      if (existingSession.worker_id !== workerId) {
        return NextResponse.json({ error: '無效的 session' }, { status: 403 })
      }
    } else {
      // Create new session on first message
      const { data: newSession, error: sessionError } = await supabaseAdmin
        .from('chat_sessions')
        .insert({
          worker_id: workerId,
          session_token: sessionToken,
          messages: [],
        })
        .select()
        .single()

      if (sessionError || !newSession) {
        return NextResponse.json({ error: '無法建立對話' }, { status: 500 })
      }
      session = newSession
    }

    // Get confirmed appointments for next 30 days（日期以台北日曆為準）
    const today = taipeiTodayYmd()
    const future = new Date()
    future.setDate(future.getDate() + 30)
    const futureStr = future.toISOString().split('T')[0]

    const { data: appointments } = await supabaseAdmin
      .from('appointments')
      .select('appointment_date, appointment_time, duration')
      .eq('worker_id', workerId)
      .eq('status', 'confirmed')
      .gte('appointment_date', today)
      .lte('appointment_date', futureStr)

    const newUserMessage: ChatMessage = {
      role: 'user',
      content: message.trim(),
      timestamp: now,
    }

    const history: ChatMessage[] = [...(session.messages ?? []), newUserMessage]

    const rawDates = message.trim().match(/\d{4}-\d{2}-\d{2}/g) ?? []
    const dateMatches = Array.from(new Set(rawDates as string[])).slice(0, 12)
    const mentionedDateWeekdays =
      dateMatches.length > 0
        ? dateMatches.map((d) => `- ${d}：${weekdayLabelTaipei(d)}`).join('\n')
        : undefined

    const systemPrompt = buildSystemPrompt(worker, appointments ?? [], {
      mentionedDateWeekdays,
    })
    const rawReply = await sendMessage(history, systemPrompt)

    const { type, cleanText, proposedDate, proposedTime } = parseAction(rawReply)

    // Guardrail: if model proposes a non-aligned / invalid slot, don't show the form.
    if (type === 'SHOW_CONTACT_FORM' && proposedDate && proposedTime) {
      const dur = Number(worker.slot_duration ?? 60)
      const closedByException = isExceptionClosed(worker, proposedDate)
      const key = dayKeyForDateTaipei(proposedDate)
      const s = (worker.working_hours as any)?.[key] as { start: string; end: string; closed: boolean } | undefined
      const start = s && !s.closed && !closedByException ? toMinutes(s.start) : null
      const end = s && !s.closed && !closedByException ? toMinutes(s.end) : null
      const req = toMinutes(proposedTime)

      const withinHours =
        !closedByException &&
        start !== null &&
        end !== null &&
        req >= start &&
        req + dur <= end &&
        (req - start) % dur === 0

      const isBooked = (appointments ?? []).some(
        (a) => a.appointment_date === proposedDate && String(a.appointment_time).slice(0, 5) === proposedTime,
      )

      if (!withinHours || isBooked) {
        const suggestions = buildSuggestionsForDate({
          worker,
          booked: (appointments ?? []).map((a) => ({
            appointment_date: a.appointment_date,
            appointment_time: a.appointment_time,
          })),
          date: proposedDate,
          requestedTime: proposedTime,
        })

        const suggestText =
          suggestions.length > 0
            ? `可以的話，這天我建議你改選：${suggestions.join('、')}。你想預約哪一個時段？`
            : '這天可能已滿或不在營業時間內，請換一個日期或時段，我幫你看看。'

        const assistantMessage: ChatMessage = {
          role: 'assistant',
          content: `${cleanText}\n\n${suggestText}`.trim(),
          timestamp: new Date().toISOString(),
        }

        await supabaseAdmin
          .from('chat_sessions')
          .update({ messages: [...history, assistantMessage] })
          .eq('id', session.id)

        return NextResponse.json({ message: assistantMessage.content })
      }
    }

    const assistantMessage: ChatMessage = {
      role: 'assistant',
      content: cleanText,
      timestamp: new Date().toISOString(),
    }

    await supabaseAdmin
      .from('chat_sessions')
      .update({ messages: [...history, assistantMessage] })
      .eq('id', session.id)

    const body: Record<string, unknown> = { message: cleanText }
    if (type === 'SHOW_CONTACT_FORM') {
      body.action = { type, proposedDate, proposedTime }
    }

    return NextResponse.json(body)
  } catch (error) {
    console.error('Chat error:', error)
    return NextResponse.json({ error: '伺服器錯誤，請稍後再試' }, { status: 500 })
  }
}
