import { NextResponse } from 'next/server'

type DbErr = { code?: string; message?: string; details?: string }

export function mapBlacklistDbError(error: DbErr, action: 'read' | 'insert' | 'delete') {
  const m = (error.message ?? '').toLowerCase()
  const missingTable =
    error.code === '42P01' ||
    m.includes('does not exist') ||
    m.includes('could not find the table')
  const permissionDenied = m.includes('permission denied')
  const base =
    action === 'read' ? '讀取黑名單失敗' : action === 'insert' ? '新增失敗' : '刪除失敗'
  if (missingTable) {
    return NextResponse.json(
      {
        error: base,
        hint: '請確認部署環境的 NEXT_PUBLIC_SUPABASE_URL 與你執行 SQL 的專案相同，並已執行 supabase/migrations/add_blacklist.sql。',
      },
      { status: 500 },
    )
  }
  if (permissionDenied) {
    return NextResponse.json(
      {
        error: base,
        hint: '請在 Supabase SQL Editor 執行：GRANT ALL ON TABLE public.blacklist TO service_role; GRANT ALL ON TABLE public.blacklist TO postgres;（或執行專案內 supabase/migrations/fix_blacklist_grants.sql）',
      },
      { status: 500 },
    )
  }
  return NextResponse.json(
    {
      error: base,
      hint: error.message || error.details || undefined,
      code: error.code,
    },
    { status: 500 },
  )
}
