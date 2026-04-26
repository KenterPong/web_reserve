'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { readLineOAuthState, clearLineOAuthState } from '@/lib/line-oauth-state'

const lineCallbackInFlight = new Set<string>()

function CallbackHandler() {
  const [isError, setIsError] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const router = useRouter()
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

    // 避免 React Strict Mode 對同一個 code 呼叫 API 兩次（LINE code 多為單次有效）
    if (lineCallbackInFlight.has(code)) return
    lineCallbackInFlight.add(code)

    fetch('/api/auth/callback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    })
      .then(async (res) => {
        lineCallbackInFlight.delete(code)
        clearLineOAuthState()
        if (res.ok) {
          router.replace('/dashboard')
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
  }, [searchParams, router])

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
