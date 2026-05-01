import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { generateBookingConfirmationMessage } from '@/lib/claude'

export async function POST(req: NextRequest) {
  const workerId = req.cookies.get('worker_id')?.value
  if (!workerId) {
    return NextResponse.json({ error: '未登入' }, { status: 401 })
  }

  try {
    const { data: worker, error } = await supabaseAdmin
      .from('workers')
      .select('business_name, bio')
      .eq('id', workerId)
      .single()

    if (error || !worker) {
      return NextResponse.json({ error: '讀取資料失敗' }, { status: 500 })
    }

    const businessName = (worker.business_name as string | null) ?? ''
    const bio = (worker.bio as string | null) ?? ''
    const message = await generateBookingConfirmationMessage(businessName, bio)

    return NextResponse.json({ message })
  } catch (e) {
    console.error('generate-booking-message:', e)
    return NextResponse.json({ error: '產生失敗，請稍後再試' }, { status: 500 })
  }
}
