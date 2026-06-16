import type { Metadata } from 'next'
import Link from 'next/link'
import { validateSlug } from '@/lib/utils'

const SITE_URL = 'https://www.mybookdate.com'
const PLATFORM_NAME = '麥不可預約表'
const DEMO_BOOKING_URL = 'https://lajer.mybookdate.com/booking'

export const metadata: Metadata = {
  title: '個人工作室 AI 預約頁面｜美髮、美甲、寵物美容免費試用 - 麥不可預約表',
  description:
    '不需要 LINE 官方帳號，3 分鐘建立你的專屬預約頁面。美髮師、美甲師、美睫師、按摩師、寵物美容師適用。顧客點連結即可預約，免費試用兩個月。',
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    title: '個人工作室 AI 預約頁面｜美髮、美甲、寵物美容免費試用 - 麥不可預約表',
    description:
      '不需要 LINE 官方帳號，3 分鐘建立你的專屬預約頁面。美髮師、美甲師、美睫師、按摩師、寵物美容師適用。顧客點連結即可預約，免費試用兩個月。',
    url: SITE_URL,
    siteName: PLATFORM_NAME,
    locale: 'zh_TW',
    type: 'website',
  },
}

const PROFESSIONS = [
  { icon: '✂️', label: '美髮師' },
  { icon: '💅', label: '美甲師' },
  { icon: '👁️', label: '美睫師' },
  { icon: '💆', label: '按摩師' },
  { icon: '🐾', label: '寵物美容' },
] as const

const FEATURES = [
  {
    icon: '💰',
    title: '不用 LINE 官方帳號',
    desc: '省下每月額外費用，顧客也不需要加你的官方帳號',
  },
  {
    icon: '🤖',
    title: 'AI 自動生成個人介紹頁',
    desc: '填 5 個問題，Claude 自動產出專業文案，馬上分享給顧客',
  },
  {
    icon: '⚡',
    title: '3 分鐘就能上線',
    desc: '24 小時自動接單，你睡著了顧客也能預約',
  },
] as const

type HomeProps = {
  searchParams: Record<string, string | string[] | undefined>
}

export default function HomePage({ searchParams }: HomeProps) {
  const rawRef = searchParams.ref
  const refParam = typeof rawRef === 'string' ? rawRef.trim() : ''
  const refForLogin = validateSlug(refParam) ? refParam : ''
  const loginHref = refForLogin ? `/${refForLogin}` : '/api/auth/line-bootstrap'

  return (
    <div className="min-h-screen bg-white">
      <nav className="px-6 py-4 flex justify-between items-center border-b border-gray-100 max-w-5xl mx-auto">
        <span className="font-bold text-gray-800">{PLATFORM_NAME}</span>
        <Link
          href={loginHref}
          className="bg-green-500 text-white text-sm px-4 py-2 rounded-full hover:bg-green-600 transition-colors"
        >
          工作者登入
        </Link>
      </nav>

      <main className="max-w-4xl mx-auto px-6">
        {/* Hero */}
        <section className="py-16 md:py-20 text-center space-y-6">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 leading-tight">
            美髮、美甲、按摩、寵物美容
            <br />
            每天花多少時間在回預約訊息？
          </h1>
          <p className="text-gray-500 text-lg max-w-2xl mx-auto">
            讓顧客自己預約，你只需要看後台確認。
            <br />
            不用 LINE 官方帳號，不用教顧客裝 App。
          </p>

          <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-sm text-gray-600">
            {PROFESSIONS.map((p) => (
              <span key={p.label} className="inline-flex items-center gap-1">
                <span aria-hidden="true">{p.icon}</span>
                {p.label}
              </span>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-stretch sm:items-center pt-2">
            <a
              href={DEMO_BOOKING_URL}
              className="inline-flex flex-col items-center justify-center bg-white text-green-600 font-semibold px-6 py-4 rounded-2xl border-2 border-green-500 hover:bg-green-50 transition-colors"
            >
              <span>先體驗顧客預約流程</span>
              <span className="text-xs font-normal text-gray-500 mt-1">不需要登入，直接體驗</span>
            </a>
            <Link
              href={loginHref}
              className="inline-flex flex-col items-center justify-center bg-green-500 text-white font-semibold px-6 py-4 rounded-2xl hover:bg-green-600 transition-colors"
            >
              <span>免費開始使用</span>
              <span className="text-xs font-normal text-green-100 mt-1">使用 LINE 登入</span>
            </Link>
          </div>
          <p className="text-xs text-gray-400">
            免費試用兩個月，之後 NT$199/月，隨時可取消
          </p>
        </section>

        {/* Features */}
        <section className="py-12 border-t border-gray-100">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex gap-4 p-5 bg-gray-50 rounded-2xl">
                <span className="text-2xl shrink-0" aria-hidden="true">
                  {f.icon}
                </span>
                <div>
                  <p className="font-semibold text-gray-800 text-sm">{f.title}</p>
                  <p className="text-gray-500 text-sm mt-1">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* About */}
        <section className="py-12 border-t border-gray-100">
          <div className="max-w-xl mx-auto text-gray-600 text-sm leading-relaxed space-y-3">
            <p>
              做這個產品是因為看到身邊的朋友
              <br />
              每天花很多時間在回預約訊息，
              <br />
              常常漏接、忘記，還要一直盯手機。
            </p>
            <p>
              {PLATFORM_NAME} 就是為了幫她們省下這些時間，
              <br />
              讓她們可以專心做自己最擅長的事。
            </p>
            <p>
              有任何問題歡迎聯絡 👇
              <br />
              <a
                href="mailto:support@mybookdate.com"
                className="text-green-600 hover:text-green-700"
              >
                📧 support@mybookdate.com
              </a>
            </p>
          </div>
        </section>

        {/* Pricing */}
        <section className="py-12 border-t border-gray-100 text-center space-y-6">
          <div className="space-y-2">
            <p className="text-lg font-semibold text-gray-800">免費試用兩個月</p>
            <p className="text-gray-500 text-sm">
              試用期結束後 NT$199/月
              <br />
              隨時可以取消，不會自動扣款
            </p>
          </div>
          <Link
            href={loginHref}
            className="inline-flex flex-col items-center justify-center bg-green-500 text-white font-semibold px-10 py-4 rounded-2xl hover:bg-green-600 transition-colors"
          >
            <span>免費開始使用</span>
            <span className="text-xs font-normal text-green-100 mt-1">使用 LINE 登入，30 秒完成註冊</span>
          </Link>
        </section>
      </main>

      <footer className="border-t border-gray-100 px-6 py-6 text-center text-sm text-gray-400 space-x-4 mt-8">
        <Link href="/privacy" className="hover:text-gray-600">
          隱私權政策
        </Link>
        <Link href="/terms" className="hover:text-gray-600">
          服務條款
        </Link>
        <a href="mailto:support@mybookdate.com" className="hover:text-gray-600">
          客服聯絡
        </a>
      </footer>
    </div>
  )
}
