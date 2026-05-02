import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { MIN_REFERRALS_BLOCKED_SLOTS } from '@/lib/blocked-slots'

export async function requireBlockedSlotsFeature(workerId: string): Promise<NextResponse | null> {
  const { data: w, error } = await supabaseAdmin
    .from('workers')
    .select('referral_count')
    .eq('id', workerId)
    .single()

  if (error || !w) {
    return NextResponse.json({ error: '找不到工作者' }, { status: 404 })
  }
  if (Number(w.referral_count ?? 0) < MIN_REFERRALS_BLOCKED_SLOTS) {
    return NextResponse.json({ error: '封鎖時段功能尚未解鎖（需推薦滿 15 人）' }, { status: 403 })
  }
  return null
}
