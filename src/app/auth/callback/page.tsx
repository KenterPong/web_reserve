'use client'

import { useEffect, useRef, useState } from 'react'
import { readLineOAuthState, clearLineOAuthState } from '@/lib/line-oauth-state'

/** 同一 authorization code 只發一次 POST（Strict Mode 雙掛載、多元件實例共用） */
const callbackPostByCode = new Map<string, Promise<Response>>()

function postAuthCallback(code: string, ref: string | null): Promise<Response> {
  let p = callbackPostByCode.get(code)
  if (!p) {
    p = fetch('/api/auth/callback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, ref }),
    }).finally(() => {
      callbackPostByCode.delete(code)
    })
    callbackPostByCode.set(code, p)
  }
  return p
}

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
  const aliveRef = useRef(true)

  useEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    // 以網址列為準：避免部分環境下 useSearchParams 首幀尚未帶 query，誤判缺參數或與 Strict Mode 競態
    const urlParams = new URLSearchParams(window.location.search)
    const lineError = urlParams.get('error')
    const lineErrorDesc = urlParams.get('error_description')

    if (lineError) {
      setIsError(true)
      const decodedDesc = lineErrorDesc ? decodeURIComponent(lineErrorDesc.replace(/\+/g, ' ')) : ''
      setErrorMessage(
        lineError === 'access_denied'
          ? '你已取消或未同意 LINE 登入，請再試一次。'
          : decodedDesc || `LINE 回傳錯誤：${lineError}`,
      )
      return
    }

    const code = urlParams.get('code')
    const state = urlParams.get('state')
    const savedState = readLineOAuthState()

    if (!code || !state) {
      setIsError(true)
      setErrorMessage('缺少授權參數（code 或 state）。請勿重新整理此頁，請從登入重新開始。')
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

    postAuthCallback(code, ref)
      .then(async (res) => {
        if (!aliveRef.current) return
        clearLineOAuthState()
        if (res.ok) {
          try {
            sessionStorage.removeItem('signup_ref')
          } catch {
            // ignore
          }
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
        if (!aliveRef.current) return
        clearLineOAuthState()
        setIsError(true)
        setErrorMessage('連線失敗，請稍後再試')
      })
    // LINE 導回為整頁 GET，僅掛載時讀一次網址列即可
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally once on mount
  }, [])

  if (isError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-4">
          <p className="text-red-500">登入失敗，請重試</p>
          {errorMessage ? <p className="text-gray-500 text-sm">{errorMessage}</p> : null}
          <a href="/api/auth/line-bootstrap" className="text-green-600 text-sm underline">
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
  return <CallbackHandler />
}
