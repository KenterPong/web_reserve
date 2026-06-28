import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { generateBio } from '@/lib/claude'

export async function POST(req: NextRequest) {
  const workerId = req.cookies.get('worker_id')?.value
  if (!workerId) {
    return NextResponse.json({ error: '未登入' }, { status: 401 })
  }

  const body = await req.json()
  const { answers, save = true } = body

  if (!answers || typeof answers !== 'object') {
    return NextResponse.json({ error: '缺少問卷答案' }, { status: 400 })
  }

  const bio = await generateBio(answers)

  if (save !== false) {
    await supabaseAdmin
      .from('workers')
      .update({ bio, bio_answers: answers, updated_at: new Date().toISOString() })
      .eq('id', workerId)
  }

  return NextResponse.json({ bio })
}
