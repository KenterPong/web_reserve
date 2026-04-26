import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { generateBio } from '@/lib/claude'

export async function POST(req: NextRequest) {
  const workerId = req.cookies.get('worker_id')?.value
  if (!workerId) {
    return NextResponse.json({ error: '未登入' }, { status: 401 })
  }

  const { answers } = await req.json()

  if (!answers || typeof answers !== 'object') {
    return NextResponse.json({ error: '缺少問卷答案' }, { status: 400 })
  }

  const bio = await generateBio(answers)

  // Save bio and answers to the worker record
  await supabaseAdmin
    .from('workers')
    .update({ bio, bio_answers: answers })
    .eq('id', workerId)

  return NextResponse.json({ bio })
}
