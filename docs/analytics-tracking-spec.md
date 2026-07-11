# 數據追蹤需求規格：GSC 曝光/點擊 + Onboarding 漏斗

**建立日：** 2026-07-11
**目的：** 目前完全無法判斷（1）SEO 曝光是否轉化為點擊、（2）使用者在四步 onboarding 中卡在哪一步流失。資料庫目前僅 3 筆 workers 記錄（皆為測試帳號），中途離開的使用者沒有任何痕跡。

**優先順序：** A 部分（GSC）由 Kenter 自行完成，不佔用工程師時間；B 部分（漏斗追蹤）請本週排入，上線後需累積 3-5 天資料才有意義，建議儘早上線。

---

## A. GSC 設定（Kenter 自行處理 + 工程師確認 meta）

### A1. Sitemap（工程師）
- 使用 Next.js 14 App Router 內建支援，於 `src/app/sitemap.ts` 產生 `sitemap.xml`
- 至少包含：
  - `https://www.mybookdate.com`（首頁）
  - `https://www.mybookdate.com/privacy`
  - `https://www.mybookdate.com/terms`
- **不建議**包含各工作者子網域（如 `jessica.mybookdate.com`），因為那些頁面目的是給顧客用，非 SEO 導流頁

### A2. 網域驗證（Kenter 自行操作，不需工程師）
1. Google Search Console → 新增資源 → 選「網域」屬性 → 輸入 `mybookdate.com`
2. 依 GSC 指示，於 Cloudflare DNS 新增一筆 TXT record
3. 驗證通過後，於 GSC 提交 sitemap：`https://www.mybookdate.com/sitemap.xml`
4. 等待 2-3 天後至「效能」報表查看關鍵字曝光次數、點擊次數、CTR、平均排名

### A3. Meta 標籤確認（工程師）
- 確認 `src/app/layout.tsx`（或首頁頁面）的 `<title>` 與 `<meta name="description">` 是否已針對核心關鍵字優化，例如：「個人工作室AI預約」「美甲師/美髮師/寵物美容師AI預約助理」
- 若尚未設定，建議 title：「麥不可 mybookdate — 個人工作室AI預約系統｜美髮美甲寵物美容適用」

---

## B. Onboarding 漏斗追蹤（工程師需新增程式碼）

### B1. 新增資料表

```sql
CREATE TABLE onboarding_events (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id    TEXT NOT NULL,        -- 前端產生，同一次 onboarding 流程共用同一組
  step          TEXT NOT NULL,        -- 見下方四種值
  line_user_id  TEXT,                 -- 若當下已知則填入，未知可為 NULL
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_onboarding_events_session ON onboarding_events(session_id);
CREATE INDEX idx_onboarding_events_step ON onboarding_events(step);

-- 比照現有表策略
REVOKE ALL ON TABLE onboarding_events FROM anon, authenticated;
-- GRANT ALL 給 service_role（依現行 schema.sql 慣例執行）
```

- 需同步更新 `supabase/schema.sql` 與新增一份 migration 檔（如 `supabase/migrations/20260711120000_onboarding_events.sql`），比照 `blocked_slots` 的建表流程

### B2. API

- 新增 `POST /api/onboarding-events`
  - 接收 body：`{ session_id: string, step: string, line_user_id?: string }`
  - 後端以 service role 寫入 `onboarding_events`
  - 基本格式驗證：`step` 僅接受下列四種列舉值，其餘拒絕
  - 不需 rate limit（內部埋點使用），但建議簡單防呆避免髒資料

### B3. 前端埋點（四步驟，各呼叫一次 API）

| 時機 | step 值 |
|------|---------|
| 進入 Step 1（業務名稱/職業輸入頁）| `step1_viewed` |
| Step 2 AI 生成簡介完成（`POST /api/generate-bio` 成功後）| `step2_bio_generated` |
| Step 3 slug 選定並通過唯一性驗證 | `step3_slug_selected` |
| Step 4 完成，`onboarding_completed = true` 寫入當下 | `step4_completed` |

**session_id 規則：**
- 每次 onboarding 依 `line_user_id` 產生一組 `onboarding_${Date.now()}_${crypto.randomUUID()}`
- 存於 `sessionStorage`（key：`onboarding_session_{line_user_id}`），同一次流程四步共用
- 完成 onboarding 後清除 sessionStorage，避免與下次測試或不同帳號混淆

### B4. 查詢方式（Kenter 自行於 Supabase Dashboard 使用）

**基本漏斗（各步驟達成人數）：**
```sql
SELECT step, COUNT(DISTINCT session_id) AS unique_sessions
FROM onboarding_events
GROUP BY step
ORDER BY step;
```

**近 7 天漏斗：**
```sql
SELECT step, COUNT(DISTINCT session_id) AS unique_sessions
FROM onboarding_events
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY step
ORDER BY step;
```

**各 session 實際路徑（看流失模式）：**
```sql
SELECT
  session_id,
  array_agg(step ORDER BY created_at) AS steps,
  MIN(created_at) AS started_at
FROM onboarding_events
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY session_id
ORDER BY started_at DESC;
```

---

## C. 每週例行查詢（上線後）

**首次查詢：** 上線後 **3–5 天**（建議 2026-07-16 週四）跑第一次，確認有足夠樣本。
**之後頻率：** 每週一次（建議固定週四），在 Supabase SQL Editor 執行下方步驟。

### C1. Onboarding 漏斗（Supabase）

依序執行 B4 的「近 7 天漏斗」與「各 session 實際路徑」兩段 SQL。

**解讀重點：**

| 現象 | 可能原因 |
|------|---------|
| step1 多、step2 少 | 多數在 Step 1 就離開，或 Step 2 未生成簡介 |
| step2 多、step3 少 | slug 選擇環節有摩擦 |
| step3 多、step4 少 | 營業時間設定或最後提交有問題 |
| 只有 `{step1_viewed}` | 中途離開（進 Step 2 但未生成簡介也會是這種 pattern） |

**注意：** 漏斗顯示某步驟流失高，不代表一定要改 onboarding。先確認流量是否為精準受眾（SEO 可能帶來同業好奇，而非真正想用的美髮師／美甲師）。若流失率高，優先問「這些流量是不是本來就不是目標用戶」，再決定是否調整流程。

### C2. GSC 成效（Google Search Console）

路徑：Search Console → **效能** → 日期範圍選「過去 28 天」或「過去 7 天」。

**解讀重點：**

| 現象 | 可能原因 | 應對方向 |
|------|---------|---------|
| 曝光高、點擊率低 | title / description 不夠吸引人 | 調整首頁 SEO 文案 |
| 曝光本身就低 | 排名不如預期 | 重新評估 SEO 優先度（主驗證路徑仍是 IG cold outreach） |

兩種情況應對完全不同；可把 GSC 截圖與 B4 SQL 結果一併留存，供週會或決策參考。

### C3. 每週交付物（可選）

1. GSC 成效報表截圖
2. 近 7 天 funnel SQL 結果
3. 各 session 路徑 SQL 結果（樣本少時可略）

---

## 驗收標準

- [x] `sitemap.xml` 可於 `https://www.mybookdate.com/sitemap.xml` 正常存取
- [x] GSC 網域驗證完成，sitemap 送出無錯誤
- [x] `onboarding_events` 資料表已建立，正式庫已執行 migration，RLS/REVOKE 與現行表一致
- [x] `POST /api/onboarding-events` 可正常寫入，格式錯誤時回傳 4xx
- [x] Onboarding 四步驟皆已埋點，測試一次完整流程後可於 Supabase 看到 4 筆對應 `session_id` 的紀錄
- [x] 中途離開測試（Step 1 填完 → 進 Step 2 未填就關閉）後，資料庫可看到該 session 僅有 `step1_viewed`
