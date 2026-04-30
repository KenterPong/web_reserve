import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

import { validateSlug } from '@/lib/utils'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const { code, ref } = await req.json()

    if (!code) {
      return NextResponse.json({ error: '缺少授權碼' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl) {
      return NextResponse.json({ error: '缺少後端設定：NEXT_PUBLIC_SUPABASE_URL' }, { status: 500 })
    }
    const srk = serviceRoleKey?.trim() ?? ''
    const srkOk = srk.startsWith('sb_secret_') || srk.startsWith('eyJ')
    if (!srkOk) {
      return NextResponse.json({ error: '缺少後端設定：SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 })
    }

    const supabaseAdmin = createClient(supabaseUrl, srk, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Exchange code for LINE access token
    const tokenRes = await fetch('https://api.line.me/oauth2/v2.1/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.LINE_CALLBACK_URL!,
        client_id: process.env.LINE_CLIENT_ID!,
        client_secret: process.env.LINE_CLIENT_SECRET!,
      }),
    })

    if (!tokenRes.ok) {
      let details: unknown = null
      const contentType = tokenRes.headers.get('content-type') ?? ''
      try {
        details = contentType.includes('application/json') ? await tokenRes.json() : await tokenRes.text()
      } catch {
        details = null
      }
      return NextResponse.json(
        {
          error: 'LINE 驗證失敗',
          details,
          status: tokenRes.status,
        },
        { status: 401 },
      )
    }

    const tokenData = await tokenRes.json()

    // Get LINE profile
    const profileRes = await fetch('https://api.line.me/v2/profile', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    })

    if (!profileRes.ok) {
      let details: unknown = null
      try {
        details = await profileRes.text()
      } catch {
        details = null
      }
      return NextResponse.json({ error: '取得 LINE 個人資料失敗', details }, { status: 401 })
    }

    const profile = await profileRes.json()

    // Check existing worker to determine "first login" reliably (upsert alone can't tell)
    const { data: existingWorker } = await supabaseAdmin
      .from('workers')
      .select('id, referred_by')
      .eq('line_user_id', profile.userId)
      .maybeSingle()

    const isFirstLogin = !existingWorker

    // UPSERT worker (line_user_id is the unique key)
    const { data: worker, error } = await supabaseAdmin
      .from('workers')
      .upsert(
        {
          line_user_id: profile.userId,
          display_name: profile.displayName,
          avatar_url: profile.pictureUrl ?? null,
        },
        { onConflict: 'line_user_id', ignoreDuplicates: false },
      )
      .select()
      .single()

    if (error || !worker) {
      console.error('Worker upsert error:', error)
      return NextResponse.json({ error: '建立帳號失敗', details: error }, { status: 500 })
    }

    // Referral: 僅首次登入；推薦人須在 workers.slug 有與連結相同的代碼（後台個人檔已儲存）
    let referralStatus: 'none' | 'applied' | 'skipped_not_first' | 'skipped_invalid_ref' | 'skipped_no_referrer' =
      'none'
    const rawRef = typeof ref === 'string' ? ref.trim().toLowerCase() : ''
    const refSlug = validateSlug(rawRef) ? rawRef : ''

    if (!isFirstLogin) {
      referralStatus = refSlug ? 'skipped_not_first' : 'none'
    } else if (!refSlug) {
      referralStatus = rawRef ? 'skipped_invalid_ref' : 'none'
    } else {
      const { data: referrer, error: refLookupErr } = await supabaseAdmin
        .from('workers')
        .select('id, slug, referral_count')
        .eq('slug', refSlug)
        .maybeSingle()

      if (refLookupErr) {
        console.error('Referral lookup error:', refLookupErr.message, { refSlug })
        referralStatus = 'skipped_no_referrer'
      } else if (!referrer?.id || referrer.id === worker.id) {
        if (!referrer?.id) {
          console.warn(
            '[auth/callback] referral slug 找不到對應工作者（請確認推薦人已在後台儲存相同 slug）:',
            refSlug,
          )
        }
        referralStatus = 'skipped_no_referrer'
      } else {
        const { data: updated, error: setRefErr } = await supabaseAdmin
          .from('workers')
          .update({ referred_by: referrer.id })
          .eq('id', worker.id)
          .is('referred_by', null)
          .select('id')
          .maybeSingle()

        if (setRefErr) {
          console.error('referred_by update error:', setRefErr.message, { workerId: worker.id })
          referralStatus = 'skipped_no_referrer'
        } else if (!updated?.id) {
          referralStatus = 'skipped_no_referrer'
        } else {
          const nextCount = Number(referrer.referral_count ?? 0) + 1
          const { error: incErr } = await supabaseAdmin
            .from('workers')
            .update({ referral_count: nextCount })
            .eq('id', referrer.id)

          if (incErr) {
            console.error('referral_count update error:', incErr.message, { referrerId: referrer.id })
            referralStatus = 'skipped_no_referrer'
          } else {
            referralStatus = 'applied'
          }
        }
      }
    }

    // Set httpOnly session cookie
    const response = NextResponse.json({ ok: true, referralStatus })
    response.cookies.set('worker_id', worker.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/',
    })

    return response
  } catch (error) {
    console.error('Auth callback error:', error)
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 })
  }
}
