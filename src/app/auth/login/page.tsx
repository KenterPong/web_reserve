'use client'

import { useEffect } from 'react'
import { persistLineOAuthState } from '@/lib/line-oauth-state'

export default function LoginPage() {
  useEffect(() => {
    const state = Math.random().toString(36).substring(2) + Date.now().toString(36)
    persistLineOAuthState(state)

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: process.env.NEXT_PUBLIC_LINE_CLIENT_ID!,
      redirect_uri: process.env.NEXT_PUBLIC_LINE_CALLBACK_URL!,
      state,
      scope: 'profile openid',
    })

    window.location.href = `https://access.line.me/oauth2/v2.1/authorize?${params}`
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center space-y-3">
        <div className="w-16 h-16 bg-green-500 rounded-2xl flex items-center justify-center mx-auto">
          <span className="text-white font-bold text-xl">LINE</span>
        </div>
        <p className="text-gray-500 text-sm">正在導向 LINE 登入...</p>
      </div>
    </div>
  )
}
