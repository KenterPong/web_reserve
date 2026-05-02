import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const MIN_REFERRALS_BLACKLIST = 5

export async function requireBlacklistFeature(workerId: string): Promise<NextResponse | null> {
  const { data: w, error } = await supabaseAdmin
    .from('workers')
    .select('referral_count')
    .eq('id', workerId)
    .single()

  if (error || !w) {
    return NextResponse.json({ error: '找不到工作者' }, { status: 404 })
  }
  if (Number(w.referral_count ?? 0) < MIN_REFERRALS_BLACKLIST) {
    return NextResponse.json({ error: '黑名單功能尚未解鎖' }, { status: 403 })
  }
  return null
}
