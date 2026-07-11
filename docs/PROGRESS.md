# 任務階段進度報告

**更新日：** 2026-06-28（與 `README.md`、`to-do-list.md` 同步盤點）
**對照文件：** `to-do-list.md`（實作狀態以此檔勾選為準）、`README.md`（架構與商業說明）

---

## 本階段進行中（2026-06-28）

| 區塊 | 說明 |
|------|------|
| **首頁截圖區塊** | 三張截圖素材已備妥；Onboarding 已驗收完成，**下一項**為首頁新增展示區塊（規格見 `homepage-redesign-v2.md`） |
| **示範連結** | `lajer.mybookdate.com/booking` |

---

## 本階段已完成（2026-06-28）

| 區塊 | 說明 |
|------|------|
| **品牌 Logo 與 Favicon** | `public/logo.svg`、全站 `favicon.ico`（`src/app/favicon.ico`）；`BrandLogo` 元件套用於首頁導覽、`/onboarding`、`/join`（commit `145b26e`） |
| **Onboarding 引導流程** | `/onboarding` 四步 + 完成頁已上線；`onboarding_completed` 欄位與 migration 已套用正式庫；新用戶 LINE 登入 → onboarding → 後台；分享連結統一 `/booking`；**正式網域驗收通過**（規格 `onboarding-spec-v2.md`） |
| **文件整併** | v1 廢止、README／to-do／v2 已對齊 |

---

## 本階段進行中（2026-06-27，已結案）

| 區塊 | 說明 |
|------|------|
| ~~**Onboarding 引導流程**~~ | → 見上方「2026-06-28 已完成」 |
| ~~**首頁截圖區塊**~~ | 待 Onboarding 完成 → **現可開始** |

---


**更新日：** 2026-05-02（與 `README.md`、`to-do-list.md` 同步盤點）  
**對照文件：** `to-do-list.md`（實作狀態以此檔勾選為準）、`README.md`（架構與商業說明）

---

## 本階段已完成（摘要）

| 區塊 | 說明 |
|------|------|
| **Auth** | LINE 手動 OAuth；`worker_id` httpOnly cookie；**跨子網域** `state` 以 **`line-oauth-state`** cookie（`domain` 依 `NEXT_PUBLIC_ROOT_DOMAIN`）＋sessionStorage 備援。**推薦（2026-04-30）**：`/{slug}`／`?ref=` rewrite **`/join`** → `POST /api/auth/referral-intent`（**`referral_slug_intent`**）→ **`/api/auth/line-bootstrap`** 寫 `line_oauth_state` 導 LINE（in-app 走 **`/auth/login/in-app`**）；`/auth/login` 僅轉址 bootstrap（RSC 不可 `cookies().set`）。**Callback**：換票 UPSERT；**首次登入**依 `state.ref` 寫 **`referred_by`／`referral_count`**（`validateSlug`、`maybeSingle`、回傳 **`referralStatus`**）。 |
| **Middleware** | 子網域 rewrite：`/` → worker-profile、`/booking` → booking；主站推薦路徑 rewrite **`/join`**；apex 兩段 hostname 不誤判 slug；`/auth/callback` host 對齊 `NEXT_PUBLIC_LINE_CALLBACK_URL`；`join` 為保留路徑段。 |
| **Workers** | 公開 `GET /api/workers?slug=`（`is_active`、含 `contact_phone`、`booking_confirmation_message`、`working_hours_exceptions`）；**IP rate limit** 100/h；後台 PATCH 含聯絡電話與預約完成提醒文字（上限 5000 字）。 |
| **Chat** | Session 過期／worker 校驗、營業與例外與已預約注入 prompt、**台北時區星期**注入、訊息截斷 20 則、`ACTION` 解析與後端 guardrail、**30/h per session_token**；**封鎖時段**（`blocked_slots`）已注入 system prompt 與 guardrail。 |
| **Appointments** | 公開建立（時段、例外公休、**409** on `23505`）、後台 GET（cookie + 僅本人）、**PATCH `[id]`**：狀態轉換或 **後台改期**（`appointment_date`／`appointment_time`、營業／公休／衝突／**封鎖時段重疊**）；公開 GET 回傳 **`blockedTimes`**（與 `bookedTimes`）、支援 **`excludeAppointmentId`** 排除自己以選時段；**manage** 顧客取消／改期（同檢查封鎖）；**POST rate limit** 5/h IP+worker。 |
| **封鎖時段**（推薦 ≥15） | 表 **`blocked_slots`**（`supabase/migrations/20260207120000_blocked_slots.sql`）；**`/dashboard/profile#blocked-slots`** 月曆列表／新增／刪除；**`GET/POST /api/blocked-slots`**、**`DELETE /api/blocked-slots/[id]`**；正式庫 **RLS + `REVOKE anon/authenticated` + `GRANT` service_role** 與黑名單表策略一致；**預約頁**與**後台改期彈窗**皆合併 `blockedTimes` 為不可選；**2026-05-02 正式環境已驗**。 |
| **Lookup** | 僅未來 `confirmed`、欄位僅日期／時間、**10/h IP**。 |
| **Booking UI** | 內嵌聯絡表單、完成頁標題「**預約申請已送出**」、**自訂／預設提醒文字**（`booking_confirmation_message`）、名稱與時間、**聯絡電話**、截圖提示；「查詢我的預約」；**worker 為 null 時不存取欄位**（修復白屏）；時段選擇器合併 **`bookedTimes` + `blockedTimes`**。**正式網域完成頁已驗**；**封鎖時段與改期選時已驗（2026-05-02）**。 |
| **Onboarding**（2026-06-28） | **`/onboarding`** 四步精靈 + 完成頁；`workers.onboarding_completed`；callback／dashboard 導向；`generate-bio` 之 `save: false`；`GET /api/workers/check-slug`；分享連結 **`/booking`**。**正式網域驗收通過**。 |
| **品牌**（2026-06-28） | **`public/logo.svg`**、**`favicon.ico`**；**`BrandLogo`** 元件（首頁、`/onboarding`、`/join`）。 |
| **共用** | `src/lib/datetime-taipei.ts`、`src/lib/rate-limit.ts`（MVP 程序內計數；上線可換 Redis）。 |
| **文件** | `to-do-list.md` 與 `README` 結構對齊；**已刪除**過時／重複／敏感檔案（見下）。 |

---

## 已移除的檔案（與原因）

| 檔案 | 原因 |
|------|------|
| `supabase/set.txt` | 曾自 repo 移除以降低外洩風險；**已依需求還原於本機**供你自行移出。仍列於 `.gitignore`，**請勿 `git add` 提交**；移走後建議輪替曾暴露過的金鑰。 |
| `CURSOR_TASKS.md` | 內容過時（路徑與實作不符），與 `to-do-list.md` 重複。 |
| 根目錄 `schema.sql` | 與 **`supabase/schema.sql`** 重複且易混淆；**唯一建表來源**為 `supabase/schema.sql`。 |

---

## 進行中／待下一階段

- **推薦 30 人｜簡訊確認（Every8d）**：尚未實作發送；顧客同意勾選與 API 串接見 `README`／`to-do-list`。  
- **新資料表／migration**（如未來新增表）：除跑 migration 外，須比照 **`blocked_slots`／黑名單** 補齊 **RLS、`REVOKE anon/authenticated`、`GRANT` service_role**（見 `supabase/schema.sql` 與各 migration）。  
- Rate limit 上線強化：**Upstash Redis**（README 已列建議；目前 MVP 為程序內記憶體）。  
- **`/dashboard/insights`** 與 **`GET /api/insights`**：MVP 已上線；`to-do-list`「數據洞察」一節列第一～三級待擴充指標。  
- **LINE `access.line.me` 連線問題**：屬使用者網路／內建瀏覽器限制，產品面以 `/join` 外開與文案引導為主。  

**已就緒（上線前五項與解鎖多數已完成，僅列提醒勿誤判為待辦）**  
參考圖 **Storage `reference-images`**、signed URL、後台 `/dashboard/reference-images`；**Footer 客服**（`support@mybookdate.com`）；正式網域 **LINE 登入**、**AI 預約**、完成頁、**後台改期**、**封鎖時段**、DNS／子網域等均已於 `to-do-list` 勾選並於上表摘要。  

---

## 與 README 的對齊方式

- **架構、商業模式、網域、LINE 步驟**：以 `README.md` 為主；本報告不複寫。  
- **實作細節與檔案路徑**：README「專案結構」已改為與目前 `src/` 一致；**資料表定義**以 repo 內 `supabase/schema.sql` 為準（README 內嵌 SQL 僅作設計參考時請自行比對）。  
- **待辦勾選**：以 `to-do-list.md` 為準，與本報告同步更新。
