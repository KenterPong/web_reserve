'use client'

import { useState } from 'react'

import { validateSlug } from '@/lib/utils'

type Props = {
  initialSlug: string
}

export function JoinForm({ initialSlug }: Props) {
  const [slug, setSlug] = useState(initialSlug)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    const t = slug.trim().toLowerCase()
    if (t && !validateSlug(t)) {
      setErr('代碼須為 3～30 個小寫英文或數字')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/referral-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: t }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null
        setErr(data?.error ?? '儲存失敗，請稍後再試')
        setLoading(false)
        return
      }
      window.location.assign('/api/auth/line-bootstrap')
    } catch {
      setErr('連線失敗，請稍後再試')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="w-full max-w-md space-y-5">
      <div>
        <label htmlFor="ref-slug" className="mb-2 block text-sm font-medium text-gray-700">
          推薦人代碼（可留空）
        </label>
        <input
          id="ref-slug"
          type="text"
          inputMode="text"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          value={slug}
          onChange={(e) => setSlug(e.target.value.replace(/\s/g, '').toLowerCase())}
          placeholder="例如：kenter"
          className="w-full rounded-xl border border-gray-200 px-4 py-3 text-gray-900 shadow-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20"
        />
        <p className="mt-2 text-xs text-gray-500">
          若從推薦連結進入，代碼會自動帶入；若要改或沒有推薦人可清空。
        </p>
      </div>
      {err ? <p className="text-sm text-red-600">{err}</p> : null}
      <button
        type="submit"
        disabled={loading}
        className="flex w-full items-center justify-center rounded-xl bg-[#06C755] py-3.5 text-sm font-semibold text-white shadow transition hover:bg-[#05b34c] disabled:opacity-60"
      >
        {loading ? '處理中…' : '下一步：LINE 登入'}
      </button>
    </form>
  )
}
