'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { readLineOAuthState, clearLineOAuthState } from '@/lib/line-oauth-state'

const lineCallbackInFlight = new Set<string>()

function base64UrlDecodeUtf8(input: string): string {
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/')
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
  const bin = atob(padded)
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

function CallbackHandler() {
  const [isError, setIsError] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const searchParams = useSearchParams()

  useEffect(() => {
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const savedState = readLineOAuthState()

    if (!code || !state) {
      setIsError(true)
      setErrorMessage('缺少授權參數（code 或 state）')
      return
    }

    if (state !== savedState) {
      clearLineOAuthState()
      setIsError(true)
      setErrorMessage('狀態驗證失敗（state 不一致）。請從同一瀏覽器完成登入，或改使用主網域登入。')
      return
    }

    let ref: string | null = null
    try {
      const decoded = base64UrlDecodeUtf8(state)
      const payload = JSON.parse(decoded) as { ref?: unknown }
      const maybe = typeof payload?.ref === 'string' ? payload.ref.trim() : ''
      ref = maybe ? maybe : null
    } catch {
      ref = null
    }

    // 避免 React Strict Mode 對同一個 code 呼叫 API 兩次（LINE code 多為單次有效）
    if (lineCallbackInFlight.has(code)) return
    lineCallbackInFlight.add(code)

    fetch('/api/auth/callback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, ref }),
    })
      .then(async (res) => {
        lineCallbackInFlight.delete(code)
        clearLineOAuthState()
        if (res.ok) {
          try {
            sessionStorage.removeItem('signup_ref')
          } catch {
            // ignore
          }
          // 硬導向：確保 Set-Cookie（worker_id）在進入後台前已由瀏覽器提交，避免 client navigation 時 middleware 讀不到 cookie
          window.location.assign('/dashboard')
        } else {
          setIsError(true)
          try {
            const data = await res.json()
            setErrorMessage(data?.error ?? `登入失敗（HTTP ${res.status}）`)
          } catch {
            setErrorMessage(`登入失敗（HTTP ${res.status}）`)
          }
        }
      })
      .catch(() => {
        lineCallbackInFlight.delete(code)
        clearLineOAuthState()
        setIsError(true)
        setErrorMessage('連線失敗，請稍後再試')
      })
  }, [searchParams])

  if (isError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-4">
          <p className="text-red-500">登入失敗，請重試</p>
          {errorMessage ? <p className="text-gray-500 text-sm">{errorMessage}</p> : null}
          <a href="/auth/login" className="text-green-600 text-sm underline">
            返回登入
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-gray-500 text-sm">登入中，請稍候...</p>
    </div>
  )
}

export default function CallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500 text-sm">載入中...</p>
      </div>
    }>
      <CallbackHandler />
    </Suspense>
  )
}
