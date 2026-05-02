import Link from 'next/link'

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white max-w-2xl mx-auto px-6 py-12">
      <Link href="/" className="text-green-600 text-sm mb-6 inline-block">← 返回首頁</Link>
      <h1 className="text-2xl font-bold text-gray-800 mb-8">隱私權政策</h1>

      <div className="prose prose-sm text-gray-600 space-y-6">
        <section>
          <h2 className="text-base font-semibold text-gray-800 mb-2">一、收集的資料範圍</h2>
          <p>本平台收集以下資料：</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>工作者：LINE 帳號 ID、顯示名稱、頭像（透過 LINE Login 取得）</li>
            <li>顧客：預約時填寫的姓名、聯絡電話</li>
            <li>選填：顧客上傳的參考圖片（解鎖功能）</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-gray-800 mb-2">二、資料用途</h2>
          <p>收集的資料僅用於：提供預約媒合服務、工作者管理個人預約排程。不用於廣告投放或轉售第三方。</p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-gray-800 mb-2">三、資料保存期限</h2>
          <p>預約完成後，顧客個人資料（姓名、電話）保存 <strong>180 天</strong>，期滿後自動刪除或匿名化處理。</p>
          <p className="mt-2">
            顧客選填上傳之參考圖片：於該筆預約之<strong>服務時段結束後約 2 小時</strong>自伺服器自動刪除，不另長期保存。
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-gray-800 mb-2">四、資料刪除</h2>
          <p>如需要求刪除個人資料，請來信 <a href="mailto:support@yourdomain.com" className="text-green-600">support@yourdomain.com</a>，我們將於 7 個工作天內完成處理。</p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-gray-800 mb-2">五、Cookie</h2>
          <p>本平台使用 httpOnly Cookie 維持工作者登入狀態，有效期 30 天。Cookie 不包含任何個人識別資訊。</p>
        </section>

        <p className="text-xs text-gray-400 mt-8">最後更新：2025 年</p>
      </div>
    </div>
  )
}
