import Link from 'next/link'

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white max-w-2xl mx-auto px-6 py-12">
      <Link href="/" className="text-green-600 text-sm mb-6 inline-block">← 返回首頁</Link>
      <h1 className="text-2xl font-bold text-gray-800 mb-8">服務條款</h1>

      <div className="prose prose-sm text-gray-600 space-y-6">
        <section>
          <h2 className="text-base font-semibold text-gray-800 mb-2">一、服務說明</h2>
          <p>AI 預約平台（以下稱「本服務」）提供個人工作者建立專屬 AI 預約頁面的 SaaS 服務。本服務不涉及工作者與顧客之間的交易，平台僅提供媒合工具。</p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-gray-800 mb-2">二、費用與付款</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>月費：NT$199／人，單一定價</li>
            <li>目前採人工收款（LINE Pay 轉帳），收到款項後人工開通帳號</li>
            <li>月費按月計算，不自動續約</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-gray-800 mb-2">三、退款政策</h2>
          <p>已付月費如因服務品質問題申請退款，請於付款後 7 日內聯繫客服，經審核後退還剩餘天數比例費用。逾期或已使用完整月份者，不予退款。</p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-gray-800 mb-2">四、帳號終止</h2>
          <p>以下情況我們保留終止帳號權利，恕不退費：</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>惡意濫用 AI 對話或 API</li>
            <li>利用平台從事詐騙或非法活動</li>
            <li>連續 3 個月未繳費</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-gray-800 mb-2">五、免責聲明</h2>
          <p>本平台不對工作者與顧客之間的預約履行結果負責。AI 對話內容僅供輔助，最終預約確認以工作者實際服務為準。</p>
        </section>

        <p className="text-xs text-gray-400 mt-8">最後更新：2025 年</p>
      </div>
    </div>
  )
}
