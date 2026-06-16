import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: '麥不可預約表',
    template: '%s | 麥不可預約表',
  },
  description: '個人工作室的專屬 AI 預約頁面',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-TW">
      <body>{children}</body>
    </html>
  )
}
