'use client'

import { useState, useEffect, type FormEvent } from 'react'
import type { BlacklistEntry } from '@/types'
import { AppConfirmDialog } from '@/components/AppDialog'
import { formatInstantZhTaipei } from '@/lib/datetime-taipei'

export default function BlacklistPage() {
  const [items, setItems] = useState<BlacklistEntry[]>([])
  const [referralCount, setReferralCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [phone, setPhone] = useState('')
  const [note, setNote] = useState('')
  const [adding, setAdding] = useState(false)
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState<'success' | 'error' | ''>('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [listError, setListError] = useState('')
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)

  const unlocked = referralCount >= 5

  function formatApiError(data: { error?: string; hint?: string }) {
    return [data.error, data.hint]
      .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
      .join('\n')
  }

  useEffect(() => {
    fetch('/api/workers/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        setReferralCount(Number(data?.worker?.referral_count ?? 0))
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!unlocked) {
      setLoading(false)
      setItems([])
      return
    }
    setLoading(true)
    setListError('')
    fetch('/api/blacklist')
      .then(async (r) => {
        if (r.status === 401) {
          window.location.href = '/api/auth/line-bootstrap'
          return null
        }
        const data = await r.json().catch(() => ({}))
        if (!r.ok) {
          setListError(formatApiError(data) || '無法載入黑名單')
          return null
        }
        return data
      })
      .then((data) => {
        if (data?.items) setItems(data.items)
      })
      .catch(() => {
        setListError('無法載入黑名單')
      })
      .finally(() => setLoading(false))
  }, [unlocked])

  useEffect(() => {
    if (!msg) return
    const t = window.setTimeout(() => {
      setMsg('')
      setMsgType('')
    }, 2400)
    return () => window.clearTimeout(t)
  }, [msg])

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    if (!phone.trim()) return
    setAdding(true)
    setMsg('')
    setMsgType('')
    try {
      const res = await fetch('/api/blacklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim(), note: note.trim() || undefined }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setMsg('已加入黑名單')
        setMsgType('success')
        setPhone('')
        setNote('')
        if (data?.item) setItems((prev) => [data.item, ...prev])
      } else {
        setMsg(formatApiError(data) || '新增失敗')
        setMsgType('error')
      }
    } finally {
      setAdding(false)
    }
  }

  async function performDelete(id: string) {
    setDeletingId(id)
    setMsg('')
    setMsgType('')
    try {
      const res = await fetch(`/api/blacklist/${encodeURIComponent(id)}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setItems((prev) => prev.filter((x) => x.id !== id))
        setMsg('已移除')
        setMsgType('success')
      } else {
        setMsg(formatApiError(data) || '刪除失敗')
        setMsgType('error')
      }
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {msg ? (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50">
          <div
            className={`px-4 py-2 rounded-xl shadow-md text-sm border ${
              msgType === 'success'
                ? 'bg-white text-green-700 border-green-200'
                : 'bg-white text-red-600 border-red-200 max-w-md whitespace-pre-line text-left'
            }`}
          >
            {msg}
          </div>
        </div>
      ) : null}

      <div className="bg-white shadow-sm px-4 py-4 flex items-center gap-3">
        <a href="/dashboard/appointments" className="text-green-600 text-sm">
          ← 返回行事曆
        </a>
        <h1 className="text-lg font-bold text-gray-800">黑名單</h1>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {!unlocked ? (
          <div className="bg-white rounded-2xl shadow-sm p-5 text-sm text-gray-600">
            <p className="font-medium text-gray-800">黑名單功能尚未解鎖</p>
            <p className="mt-2 text-xs text-gray-500">
              推薦滿 5 位設計師加入後即可管理封鎖名單。請從行事曆頁複製推薦連結分享給其他人。
            </p>
          </div>
        ) : (
          <>
            {listError ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 whitespace-pre-line">
                {listError}
              </div>
            ) : null}
            <div className="bg-white rounded-2xl shadow-sm p-5 space-y-3">
              <h2 className="text-sm font-semibold text-gray-600">新增封鎖電話</h2>
              <p className="text-xs text-gray-500">
                被列管的門號將無法對你完成線上預約（若顧客換號仍可能預約，此功能僅降低騷擾）。
              </p>
              <form onSubmit={handleAdd} className="space-y-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">電話</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0912345678"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-400"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">備註（選填）</label>
                  <input
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="例：多次未出現"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-400"
                  />
                </div>
                <button
                  type="submit"
                  disabled={adding || !phone.trim()}
                  className="w-full py-2.5 rounded-xl bg-gray-900 text-white text-sm font-semibold disabled:opacity-50 hover:bg-gray-800"
                >
                  {adding ? '送出中…' : '加入黑名單'}
                </button>
              </form>
            </div>

            <div className="bg-white rounded-2xl shadow-sm p-5">
              <h2 className="text-sm font-semibold text-gray-600 mb-3">封鎖列表</h2>
              {loading ? (
                <p className="text-sm text-gray-500">載入中…</p>
              ) : listError ? (
                <p className="text-sm text-gray-500">無法顯示列表（見上方錯誤說明）</p>
              ) : items.length === 0 ? (
                <p className="text-sm text-gray-500">尚無項目</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {items.map((row) => (
                    <li key={row.id} className="py-3 flex items-start justify-between gap-3 first:pt-0">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800">{row.phone}</p>
                        {row.note ? <p className="text-xs text-gray-500 mt-1">{row.note}</p> : null}
                        <p className="text-[11px] text-gray-400 mt-1">
                          {formatInstantZhTaipei(Date.parse(row.created_at))}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setDeleteTargetId(row.id)}
                        disabled={deletingId === row.id}
                        className="shrink-0 text-xs text-red-600 hover:text-red-700 disabled:opacity-50"
                      >
                        {deletingId === row.id ? '刪除中…' : '刪除'}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>

      <AppConfirmDialog
        open={deleteTargetId !== null}
        title="移除黑名單"
        message="確定要從黑名單移除這支電話？"
        confirmLabel="移除"
        cancelLabel="先不要"
        danger
        onConfirm={() => {
          const id = deleteTargetId
          setDeleteTargetId(null)
          if (id) void performDelete(id)
        }}
        onCancel={() => setDeleteTargetId(null)}
      />
    </div>
  )
}
