import { validateSlug } from '@/lib/utils'

import { JoinForm } from './join-form'

export const dynamic = 'force-dynamic'

/**
 * 推薦註冊／登入前確認頁（主站 /{slug} 或 /?ref= 會 rewrite 至此）。
 * 預約連結為工作者子網域 /booking 等，不會進入此頁。
 */
export default function JoinPage({
  searchParams,
}: {
  searchParams: { ref?: string | string[] }
}) {
  const rawRef = searchParams.ref
  const refParam = Array.isArray(rawRef) ? rawRef[0] : rawRef
  const refTrim = (refParam ?? '').trim().toLowerCase()
  const initialSlug = validateSlug(refTrim) ? refTrim : ''

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6 py-12">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#06C755]">
          <span className="text-lg font-bold text-white">LINE</span>
        </div>
        <h1 className="text-xl font-semibold text-gray-900">登入前確認</h1>
        <p className="mt-2 max-w-md text-sm text-gray-600">
          請確認推薦人代碼是否正確，再進行 LINE 登入。代碼須與推薦人在<strong>後台個人檔</strong>已儲存的專屬網址代碼一致，系統才能寫入推薦紀錄。
        </p>
        <p className="mt-2 max-w-md text-xs text-gray-500">
          若你是從<strong>預約連結</strong>進來，請改開工作者提供給你的專屬預約網址。
        </p>
      </div>
      <JoinForm initialSlug={initialSlug} />
    </div>
  )
}
