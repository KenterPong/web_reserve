import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { LineLoginInAppModal } from '../line-login-in-app-modal'
import { LINE_OAUTH_STATE_COOKIE_NAME } from '@/lib/line-oauth-state'
import { buildLineAuthorizeUrl } from '@/lib/line-login-oauth'

export const dynamic = 'force-dynamic'

/** in-app 流程：cookie 已由 /api/auth/line-bootstrap 寫入，此頁只讀取並顯示外開彈窗 */
export default function LoginInAppPage() {
  const state = cookies().get(LINE_OAUTH_STATE_COOKIE_NAME)?.value
  if (!state) {
    redirect('/api/auth/line-bootstrap')
  }

  let authorizeUrl: string
  try {
    authorizeUrl = buildLineAuthorizeUrl(state)
  } catch {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
        <p className="text-red-600 text-center text-sm">
          伺服器未設定 LINE 登入，請聯絡管理員。
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <LineLoginInAppModal authorizeUrl={authorizeUrl} />
    </div>
  )
}
