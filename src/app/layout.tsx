import type { Metadata } from 'next'
import './globals.css'
import { BRAND_NAME } from '@/lib/brand'

export const metadata: Metadata = {
  title: {
    default: `${BRAND_NAME} — 個人工作室AI預約系統｜美髮美甲寵物美容適用`,
    template: `%s | ${BRAND_NAME}`,
  },
  description:
    '個人工作室 AI 預約助理。美髮師、美甲師、美睫師、按摩師、寵物美容師適用，3 分鐘建立專屬預約頁面，免費試用兩個月。',
  icons: {
    icon: '/favicon.ico',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-TW">
      <body>{children}</body>
    </html>
  )
}
