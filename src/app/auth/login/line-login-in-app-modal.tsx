'use client'

/**
 * LINE／FB／IG 等 in-app WebView：以彈窗引導使用者主動外開 LINE OAuth（target=_blank），避免自動導向失敗。
 */
export function LineLoginInAppModal({ authorizeUrl }: { authorizeUrl: string }) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6"
      role="presentation"
    >
      <div className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="line-inapp-title"
        className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-black/5"
      >
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#06C755]">
          <span className="text-lg font-bold text-white">LINE</span>
        </div>
        <h1 id="line-inapp-title" className="text-center text-lg font-semibold text-gray-900">
          請用外開方式完成登入
        </h1>
        <p className="mt-3 text-center text-sm leading-relaxed text-gray-600">
          偵測到你正在 App 內建瀏覽器中；自動跳轉到 LINE 可能失敗。請點下方按鈕，將以<strong className="text-gray-800">新視窗／系統瀏覽器</strong>
          開啟 LINE 登入。
        </p>
        <p className="mt-2 text-center text-xs text-gray-500">
          若仍無法開啟，請點 App 右上角 <span className="whitespace-nowrap">⋯</span> →「在 Safari／Chrome 開啟」本頁後再試。
        </p>
        <a
          href={authorizeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 flex w-full items-center justify-center rounded-xl bg-[#06C755] py-3.5 text-sm font-semibold text-white shadow-md transition hover:bg-[#05b34c] active:scale-[0.99]"
        >
          外開 LINE 登入
        </a>
        <a
          href={authorizeUrl}
          className="mt-3 block w-full text-center text-xs text-gray-500 underline underline-offset-2 hover:text-gray-700"
        >
          改在目前視窗開啟
        </a>
      </div>
    </div>
  )
}
