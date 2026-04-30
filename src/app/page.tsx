import Link from 'next/link'
import { validateSlug } from '@/lib/utils'

type HomeProps = {
  searchParams: Record<string, string | string[] | undefined>
}

export default function HomePage({ searchParams }: HomeProps) {
  const rawRef = searchParams.ref
  const refParam = typeof rawRef === 'string' ? rawRef.trim() : ''
  const refForLogin = validateSlug(refParam) ? refParam : ''
  // 推薦用路徑 /{slug}，避免 LINE 內建瀏覽器吃掉 ?ref=；middleware 會轉到 /auth/login?ref=
  const loginHref = refForLogin ? `/${refForLogin}` : '/auth/login'

  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="px-6 py-4 flex justify-between items-center border-b border-gray-100">
        <span className="font-bold text-gray-800">AI 預約平台</span>
        <Link
          href={loginHref}
          className="bg-green-500 text-white text-sm px-4 py-2 rounded-full hover:bg-green-600 transition-colors"
        >
          工作者登入
        </Link>
      </nav>

      {/* Hero */}
      <main className="max-w-2xl mx-auto px-6 py-16 text-center space-y-8">
        <h1 className="text-4xl font-bold text-gray-900 leading-tight">
          你的專屬 AI 預約頁面<br />
          <span className="text-green-500">3 分鐘上線</span>
        </h1>
        <p className="text-gray-500 text-lg">
          不依賴 LINE 官方帳號，不用讓顧客安裝 App。<br />
          分享連結，顧客即可透過 AI 完成預約。
        </p>
        <Link
          href={loginHref}
          className="inline-block bg-green-500 text-white font-semibold px-8 py-4 rounded-2xl hover:bg-green-600 transition-colors text-lg"
        >
          立即加入 · NT$199/月
        </Link>

        {/* Features */}
        <div className="grid grid-cols-1 gap-4 text-left mt-12">
          {[
            { icon: '🤖', title: 'AI 自動生成個人介紹', desc: '填寫 5 個問題，Claude 自動產出專業文案' },
            { icon: '📅', title: '智慧 AI 預約對話', desc: '顧客用自然語言聊天即可完成預約，自動防止 double booking' },
            { icon: '📱', title: '不用安裝 App', desc: '顧客點連結即可，支援所有裝置' },
          ].map(f => (
            <div key={f.title} className="flex gap-4 p-4 bg-gray-50 rounded-2xl">
              <span className="text-2xl">{f.icon}</span>
              <div>
                <p className="font-semibold text-gray-800 text-sm">{f.title}</p>
                <p className="text-gray-500 text-sm">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 px-6 py-6 text-center text-sm text-gray-400 space-x-4">
        <Link href="/privacy" className="hover:text-gray-600">隱私權政策</Link>
        <Link href="/terms" className="hover:text-gray-600">服務條款</Link>
        <a href="mailto:support@yourdomain.com" className="hover:text-gray-600">客服聯絡</a>
      </footer>
    </div>
  )
}
