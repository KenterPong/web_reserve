import type { Metadata } from 'next'
import './globals.css'
import { BRAND_NAME, BRAND_TAGLINE } from '@/lib/brand'

export const metadata: Metadata = {
  title: {
    default: BRAND_NAME,
    template: `%s | ${BRAND_NAME}`,
  },
  description: BRAND_TAGLINE,
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
