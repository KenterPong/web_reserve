import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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

    // Referral: only count on first login, and only if worker not already referred
    const refSlug = typeof ref === 'string' ? ref.trim() : ''
    if (isFirstLogin && refSlug) {
      const { data: referrer } = await supabaseAdmin
        .from('workers')
        .select('id, slug, referral_count')
        .eq('slug', refSlug)
        .single()

      if (referrer?.id && referrer.id !== worker.id) {
        // Set referred_by exactly once (guards against retries)
        const { data: updated, error: setRefErr } = await supabaseAdmin
          .from('workers')
          .update({ referred_by: referrer.id })
          .eq('id', worker.id)
          .is('referred_by', null)
          .select('id')
          .maybeSingle()

        if (!setRefErr && updated?.id) {
          await supabaseAdmin
            .from('workers')
            .update({ referral_count: Number(referrer.referral_count ?? 0) + 1 })
            .eq('id', referrer.id)
        }
      }
    }

    // Set httpOnly session cookie
    const response = NextResponse.json({ ok: true })
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
