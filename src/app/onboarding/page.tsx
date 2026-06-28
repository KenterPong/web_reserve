'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { getDefaultWorkingHours } from '@/lib/default-working-hours'
import { copyTextToClipboard } from '@/lib/utils'
import type { WorkingHours } from '@/types'

const PROFESSIONS = [
  { value: '美髮師', emoji: '💇' },
  { value: '美甲師', emoji: '💅' },
  { value: '美睫師', emoji: '👁️' },
  { value: '按摩師／整復師', emoji: '💆' },
  { value: '寵物美容師', emoji: '🐾' },
  { value: '其他', emoji: '✏️' },
] as const

const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
const DAY_LABELS: Record<(typeof DAY_KEYS)[number], string> = {
  mon: '週一',
  tue: '週二',
  wed: '週三',
  thu: '週四',
  fri: '週五',
  sat: '週六',
  sun: '週日',
}

type Step = 1 | 2 | 3 | 4 | 'done'
type SlugStatus = 'idle' | 'checking' | 'available' | 'taken' | 'reserved' | 'invalid'

export default function OnboardingPage() {
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? ''
  const [step, setStep] = useState<Step>(1)
  const [loading, setLoading] = useState(true)

  const [businessName, setBusinessName] = useState('')
  const [profession, setProfession] = useState('')
  const [professionOther, setProfessionOther] = useState('')

  const [experience, setExperience] = useState('')
  const [features, setFeatures] = useState('')
  const [location, setLocation] = useState('')
  const [bio, setBio] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [generateError, setGenerateError] = useState('')

  const [slug, setSlug] = useState('')
  const [slugStatus, setSlugStatus] = useState<SlugStatus>('idle')

  const [workingHours, setWorkingHours] = useState<WorkingHours>(getDefaultWorkingHours())
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [copyMsg, setCopyMsg] = useState('')

  const professionLabel = useMemo(() => {
    if (profession === '其他') return professionOther.trim()
    return profession
  }, [profession, professionOther])

  const bookingUrl = useMemo(() => {
    if (!slug) return ''
    if (rootDomain) return `https://${slug}.${rootDomain}/booking`
    if (typeof window === 'undefined') return ''
    const host = window.location.host.replace(/^www\./, '')
    return `${window.location.protocol}//${slug}.${host}/booking`
  }, [slug, rootDomain])

  useEffect(() => {
    fetch('/api/workers/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data?.worker) return
        const w = data.worker
        if (w.business_name) setBusinessName(w.business_name)
        const ans = (w.bio_answers ?? {}) as Record<string, string>
        if (ans.profession) {
          const known = PROFESSIONS.some((p) => p.value === ans.profession)
          if (known) {
            setProfession(ans.profession)
          } else {
            setProfession('其他')
            setProfessionOther(ans.profession)
          }
        }
        if (ans.experience) setExperience(ans.experience)
        if (ans.features) setFeatures(ans.features)
        if (ans.location) setLocation(ans.location)
        if (w.bio) setBio(w.bio)
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (step !== 3) return
    const raw = slug.trim().toLowerCase()
    if (!raw) {
      setSlugStatus('idle')
      return
    }

    setSlugStatus('checking')
    const timer = window.setTimeout(() => {
      fetch(`/api/workers/check-slug?slug=${encodeURIComponent(raw)}`)
        .then((r) => (r.ok ? r.json() : { status: 'invalid' }))
        .then((data: { status?: SlugStatus }) => {
          setSlugStatus(data.status ?? 'invalid')
        })
        .catch(() => setSlugStatus('invalid'))
    }, 500)

    return () => window.clearTimeout(timer)
  }, [slug, step])

  const bioAnswersForApi = useCallback(() => {
    return {
      name: businessName.trim(),
      profession: professionLabel,
      experience: experience.trim(),
      features: features.trim(),
      location: location.trim(),
    }
  }, [businessName, professionLabel, experience, features, location])

  const storedBioAnswers = useCallback(() => {
    return {
      profession: professionLabel,
      experience: experience.trim(),
      features: features.trim(),
      location: location.trim(),
    }
  }, [professionLabel, experience, features, location])

  async function handleGenerateBio() {
    setGenerateError('')
    setIsGenerating(true)
    try {
      const res = await fetch('/api/generate-bio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: bioAnswersForApi(), save: false }),
      })
      const data = await res.json()
      if (res.ok && typeof data.bio === 'string') {
        setBio(data.bio)
      } else {
        setGenerateError(data.error ?? '生成失敗，請重試')
      }
    } catch {
      setGenerateError('生成失敗，請重試')
    } finally {
      setIsGenerating(false)
    }
  }

  function validateStep1(): boolean {
    if (!businessName.trim()) return false
    if (!profession) return false
    if (profession === '其他' && !professionOther.trim()) return false
    return true
  }

  function validateStep2(): boolean {
    if (!experience.trim() || !features.trim() || !location.trim()) return false
    if (!bio.trim()) return false
    return true
  }

  function validateStep3(): boolean {
    return slugStatus === 'available'
  }

  async function handleComplete() {
    setSubmitError('')
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/workers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_name: businessName.trim(),
          bio: bio.trim(),
          bio_answers: storedBioAnswers(),
          slug: slug.trim().toLowerCase(),
          working_hours: workingHours,
          onboarding_completed: true,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setSubmitError(data.error ?? '儲存失敗，請稍後再試')
        return
      }
      setStep('done')
    } catch {
      setSubmitError('連線失敗，請稍後再試')
    } finally {
      setIsSubmitting(false)
    }
  }

  function toggleDay(day: (typeof DAY_KEYS)[number]) {
    setWorkingHours((prev) => ({
      ...prev,
      [day]: { ...prev[day], closed: !prev[day].closed },
    }))
  }

  function updateHours(day: (typeof DAY_KEYS)[number], field: 'start' | 'end', value: string) {
    setWorkingHours((prev) => ({
      ...prev,
      [day]: { ...prev[day], [field]: value },
    }))
  }

  function handleCopyLink() {
    if (!bookingUrl) return
    void copyTextToClipboard(bookingUrl).then((ok) =>
      setCopyMsg(ok ? '已複製' : '複製失敗'),
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500 text-sm">載入中…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {step !== 'done' && (
        <div className="bg-white border-b border-gray-100 px-4 py-4">
          <div className="max-w-lg mx-auto flex gap-2">
            {[1, 2, 3, 4].map((n) => (
              <div
                key={n}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  typeof step === 'number' && step >= n ? 'bg-green-500' : 'bg-gray-200'
                }`}
              />
            ))}
          </div>
          <p className="max-w-lg mx-auto text-center text-xs text-gray-400 mt-2">
            步驟 {typeof step === 'number' ? step : 4} / 4
          </p>
        </div>
      )}

      <div className="max-w-lg mx-auto px-4 py-8">
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-xl font-bold text-gray-800">先來認識你一下 👋</h1>
            </div>
            <div>
              <label className="text-sm text-gray-600 mb-1 block">工作室名稱 *</label>
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="例如：Jessica 美髮工作室"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-green-400"
              />
            </div>
            <div>
              <label className="text-sm text-gray-600 mb-2 block">職業類型 *</label>
              <div className="grid grid-cols-2 gap-2">
                {PROFESSIONS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setProfession(p.value)}
                    className={`text-left px-3 py-3 rounded-xl border text-sm transition-colors ${
                      profession === p.value
                        ? 'border-green-500 bg-green-50 text-green-800'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-green-200'
                    }`}
                  >
                    {p.emoji ? `${p.emoji} ` : ''}
                    {p.value}
                  </button>
                ))}
              </div>
              {profession === '其他' && (
                <input
                  type="text"
                  value={professionOther}
                  onChange={(e) => setProfessionOther(e.target.value)}
                  placeholder="請填寫你的職業"
                  className="mt-2 w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-green-400"
                />
              )}
            </div>
            <button
              type="button"
              disabled={!validateStep1()}
              onClick={() => setStep(2)}
              className="w-full bg-green-500 text-white rounded-xl py-3 text-sm font-semibold disabled:opacity-40 hover:bg-green-600 transition-colors"
            >
              下一步
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-xl font-bold text-gray-800">讓 AI 幫你寫介紹 ✨</h1>
              <p className="text-sm text-gray-500 mt-1">回答三個問題，Claude 自動幫你產出專業介紹文案</p>
            </div>
            <div>
              <label className="text-sm text-gray-600 mb-1 block">你有幾年經驗？ *</label>
              <input
                type="text"
                value={experience}
                onChange={(e) => setExperience(e.target.value)}
                placeholder="例如：8 年"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-green-400"
              />
            </div>
            <div>
              <label className="text-sm text-gray-600 mb-1 block">你的服務特色是什麼？ *</label>
              <input
                type="text"
                value={features}
                onChange={(e) => setFeatures(e.target.value)}
                placeholder="例如：擅長日系染髮、護髮療程"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-green-400"
              />
            </div>
            <div>
              <label className="text-sm text-gray-600 mb-1 block">你的工作地點在哪裡？ *</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="例如：高雄苓雅區"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-green-400"
              />
            </div>
            <button
              type="button"
              disabled={
                isGenerating ||
                !experience.trim() ||
                !features.trim() ||
                !location.trim() ||
                !validateStep1()
              }
              onClick={handleGenerateBio}
              className="w-full border border-green-400 text-green-600 rounded-xl py-3 text-sm font-semibold hover:bg-green-50 disabled:opacity-40 transition-colors"
            >
              {isGenerating ? 'AI 生成中…' : '幫我生成介紹頁'}
            </button>
            {generateError && (
              <p className="text-sm text-red-500 text-center">{generateError}</p>
            )}
            <div>
              <label className="text-sm text-gray-600 mb-1 block">介紹文案（可手動修改）*</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={5}
                placeholder="可點上方按鈕 AI 生成，或直接填寫"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-green-400 resize-none"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex-1 border border-gray-200 text-gray-600 rounded-xl py-3 text-sm font-semibold hover:bg-gray-50"
              >
                上一步
              </button>
              <button
                type="button"
                disabled={!validateStep2()}
                onClick={() => setStep(3)}
                className="flex-1 bg-green-500 text-white rounded-xl py-3 text-sm font-semibold disabled:opacity-40 hover:bg-green-600"
              >
                下一步
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-xl font-bold text-gray-800">設定你的預約連結 🔗</h1>
              <p className="text-sm text-gray-500 mt-1">這是你的顧客預約頁面網址，設定後可以傳給客人</p>
            </div>
            <div>
              <label className="text-sm text-gray-600 mb-1 block">專屬網址名稱 *</label>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))}
                placeholder="jessica"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-green-400"
              />
              <p className="text-xs text-gray-400 mt-1">小寫英數字，3～30 字元</p>
              {slug && (
                <p className="text-xs text-gray-500 mt-2 break-all">
                  預覽：
                  {rootDomain
                    ? `https://${slug}.${rootDomain}/booking`
                    : `${slug}.yourdomain.com/booking`}
                </p>
              )}
              {slugStatus === 'checking' && (
                <p className="text-xs text-gray-400 mt-1">檢查中…</p>
              )}
              {slugStatus === 'available' && (
                <p className="text-xs text-green-600 mt-1">可以使用！</p>
              )}
              {slugStatus === 'taken' && (
                <p className="text-xs text-red-500 mt-1">此名稱已被使用</p>
              )}
              {slugStatus === 'reserved' && (
                <p className="text-xs text-red-500 mt-1">此名稱不可使用</p>
              )}
              {slugStatus === 'invalid' && slug.length > 0 && (
                <p className="text-xs text-red-500 mt-1">格式不正確（3～30 字小寫英數字）</p>
              )}
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="flex-1 border border-gray-200 text-gray-600 rounded-xl py-3 text-sm font-semibold hover:bg-gray-50"
              >
                上一步
              </button>
              <button
                type="button"
                disabled={!validateStep3()}
                onClick={() => setStep(4)}
                className="flex-1 bg-green-500 text-white rounded-xl py-3 text-sm font-semibold disabled:opacity-40 hover:bg-green-600"
              >
                下一步
              </button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-xl font-bold text-gray-800">你什麼時候上班？🗓️</h1>
              <p className="text-sm text-gray-500 mt-1">顧客只能預約你的營業時間內的時段</p>
            </div>
            <div className="bg-white rounded-2xl shadow-sm p-4 space-y-2.5">
              {DAY_KEYS.map((day) => {
                const s = workingHours[day]
                return (
                  <div
                    key={day}
                    className={`grid grid-cols-[auto_1fr] items-center gap-x-2 ${s.closed ? 'opacity-50' : ''}`}
                  >
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-sm text-gray-600 w-9">{DAY_LABELS[day]}</span>
                      <button
                        type="button"
                        onClick={() => toggleDay(day)}
                        className={`text-xs px-2 py-1 rounded-full border whitespace-nowrap ${
                          s.closed
                            ? 'border-gray-200 text-gray-400'
                            : 'border-green-400 text-green-600 bg-green-50'
                        }`}
                      >
                        {s.closed ? '休息' : '營業'}
                      </button>
                    </div>
                    {!s.closed ? (
                      <div className="flex items-center justify-end gap-0.5 min-w-0">
                        <input
                          type="time"
                          value={s.start}
                          onChange={(e) => updateHours(day, 'start', e.target.value)}
                          className="min-w-0 w-[5.6rem] max-w-[42%] border border-gray-200 rounded-lg px-1 py-1.5 text-xs leading-none focus:outline-none focus:border-green-400"
                        />
                        <span className="text-gray-400 text-xs shrink-0 px-0.5">～</span>
                        <input
                          type="time"
                          value={s.end}
                          onChange={(e) => updateHours(day, 'end', e.target.value)}
                          className="min-w-0 w-[5.6rem] max-w-[42%] border border-gray-200 rounded-lg px-1 py-1.5 text-xs leading-none focus:outline-none focus:border-green-400"
                        />
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400 text-right">休息</span>
                    )}
                  </div>
                )
              })}
            </div>
            {submitError && <p className="text-sm text-red-500 text-center">{submitError}</p>}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="flex-1 border border-gray-200 text-gray-600 rounded-xl py-3 text-sm font-semibold hover:bg-gray-50"
              >
                上一步
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleComplete}
                className="flex-1 bg-green-500 text-white rounded-xl py-3 text-sm font-semibold disabled:opacity-50 hover:bg-green-600"
              >
                {isSubmitting ? '儲存中…' : '完成設定'}
              </button>
            </div>
          </div>
        )}

        {step === 'done' && (
          <div className="space-y-6 text-center">
            <h1 className="text-2xl font-bold text-gray-800">🎉 你的預約頁面已上線！</h1>
            <div className="bg-white rounded-2xl shadow-sm p-5 text-left space-y-3">
              <p className="text-sm text-gray-600">你的顧客預約連結：</p>
              <p className="text-sm font-mono text-green-700 break-all">{bookingUrl}</p>
              <button
                type="button"
                onClick={handleCopyLink}
                className="w-full border border-green-400 text-green-600 rounded-xl py-2.5 text-sm font-semibold hover:bg-green-50"
              >
                複製連結
              </button>
              {copyMsg && <p className="text-xs text-gray-500 text-center">{copyMsg}</p>}
              <p className="text-sm text-gray-500">把這個連結傳給客人，她們點開就能自己預約！</p>
            </div>
            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 text-left text-sm text-amber-900 space-y-2">
              <p className="font-semibold">📅 免費試用兩個月</p>
              <p>從你註冊當天起算，試用期結束後 NT$199/月</p>
              <p>不會自動扣款，後台會在到期前提醒你</p>
              <p>試用期結束後有 3 天寬限期，逾期預約頁將暫停服務</p>
            </div>
            <div className="bg-white rounded-2xl shadow-sm p-4 text-left text-sm text-gray-600 space-y-2">
              <p className="font-semibold text-gray-800">💳 如何付款？</p>
              <p>後台會在試用期結束前提醒你付款方式</p>
              <p>付款方式：LINE Pay 轉帳</p>
              <p>
                有任何問題請聯繫：
                <a href="mailto:support@mybookdate.com" className="text-green-600 underline">
                  support@mybookdate.com
                </a>
              </p>
            </div>
            <a
              href="/dashboard/appointments"
              className="block w-full bg-green-500 text-white rounded-xl py-3 text-sm font-semibold hover:bg-green-600"
            >
              進入後台
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
