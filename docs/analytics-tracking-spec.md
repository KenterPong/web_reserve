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
- Onboarding 頁面載入時產生一組 `onboarding_${Date.now()}_${nanoid()}`
- 存於該次 onboarding 的前端 state 或 `sessionStorage`
- 四個步驟共用同一組 `session_id`，以便之後用 SQL 依 session 串接每個人的路徑

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

---

## 驗收標準

- [ ] `sitemap.xml` 可於 `https://www.mybookdate.com/sitemap.xml` 正常存取
- [ ] GSC 網域驗證完成，sitemap 送出無錯誤
- [ ] `onboarding_events` 資料表已建立，正式庫已執行 migration，RLS/REVOKE 與現行表一致
- [ ] `POST /api/onboarding-events` 可正常寫入，格式錯誤時回傳 4xx
- [ ] Onboarding 四步驟皆已埋點，測試一次完整流程後可於 Supabase 看到 4 筆對應 `session_id` 的紀錄
- [ ] 中途離開測試（例如只完成到 Step 2 就關閉頁面）後，資料庫應可看到 `step1_viewed`、`step2_bio_generated`，但無 `step3`、`step4` 記錄
