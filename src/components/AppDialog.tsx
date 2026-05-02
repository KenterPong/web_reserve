'use client'

type AppAlertDialogProps = {
  open: boolean
  title?: string
  message: string
  confirmLabel?: string
  onClose: () => void
}

/** 單按鈕訊息（取代瀏覽器 alert），樣式與後台 modal 一致 */
export function AppAlertDialog({
  open,
  title = '提示',
  message,
  confirmLabel = '確定',
  onClose,
}: AppAlertDialogProps) {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="app-alert-title"
        aria-describedby="app-alert-desc"
        className="w-full max-w-sm rounded-2xl bg-white shadow-lg p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="app-alert-title" className="text-base font-bold text-gray-800">
          {title}
        </h2>
        <p id="app-alert-desc" className="mt-3 text-sm text-gray-600 whitespace-pre-line">
          {message}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full py-2.5 rounded-xl bg-green-500 text-white text-sm font-semibold hover:bg-green-600 transition-colors"
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  )
}

type AppConfirmDialogProps = {
  open: boolean
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  /** true 時確認鈕為紅色系（刪除／取消預約等） */
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/** 雙按鈕確認（取代瀏覽器 confirm） */
export function AppConfirmDialog({
  open,
  title = '請確認',
  message,
  confirmLabel = '確定',
  cancelLabel = '取消',
  danger = false,
  onConfirm,
  onCancel,
}: AppConfirmDialogProps) {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4"
      onClick={onCancel}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="app-confirm-title"
        aria-describedby="app-confirm-desc"
        className="w-full max-w-sm rounded-2xl bg-white shadow-lg p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="app-confirm-title" className="text-base font-bold text-gray-800">
          {title}
        </h2>
        <p id="app-confirm-desc" className="mt-3 text-sm text-gray-600 whitespace-pre-line">
          {message}
        </p>
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => onConfirm()}
            className={
              danger
                ? 'flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors'
                : 'flex-1 py-2.5 rounded-xl bg-green-500 text-white text-sm font-semibold hover:bg-green-600 transition-colors'
            }
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
