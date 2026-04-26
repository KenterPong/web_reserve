import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'AI 預約平台',
  description: '個人工作者的專屬 AI 預約頁面',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-TW">
      <body>{children}</body>
    </html>
  )
}
