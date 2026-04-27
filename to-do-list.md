## Web Reserve To-do List（路線 A）

> **進度彙報：** 見根目錄 `PROGRESS.md`（與本清單同步維護）。

### 今日進度（2026-04-27）

- [x] **子網域導流修正**：個人介紹頁「立即預約」改為使用相對路徑 `/booking`，避免跳回 `project-*.vercel.app`
- [x] **子網域判斷強化**：新增 `NEXT_PUBLIC_ROOT_DOMAIN=mybookdate.com` 後，middleware 僅對 `*.mybookdate.com` 做 slug rewrite，避免 apex `mybookdate.com` 被誤判為 slug
- [x] **後台分享功能**：`/dashboard/appointments` 右上角新增「分享」按鈕，可複製個人子網域連結並顯示 QR Code 供顧客掃描開啟
- [x] **後台通知（免手動重整）**：`/dashboard/appointments` 右上角新增「通知」＋未讀數字；每 15 秒輪詢預約資料，偵測「新增/取消/改期」並顯示通知列表；點擊即已讀消失（已讀狀態暫存於 localStorage）
- [x] **新增依賴**：加入 `qrcode.react`（以 `QRCodeCanvas` 顯示 QR Code）
- [x] **驗證（正式網域）**：`kenter.mybookdate.com`「立即預約」連結與後台「分享」功能正常

### 今日進度（2026-04-26）

- [x] **GitHub**：初始化 repo、`.gitignore`、推 `main`（`KenterPong/web_reserve`）
- [x] **Vercel**：連結 GitHub App 權限、專案 `web_reserve`、Production 部署成功
- [x] **建置設定**：Framework **Next.js**、**Output Directory** 使用預設（修正誤設 `public` 造成失敗）
- [x] **環境變數（Production）**：Supabase、Anthropic、LINE、`NEXT_PUBLIC_APP_URL` 與 `LINE_CALLBACK_URL` / `NEXT_PUBLIC_LINE_CALLBACK_URL`（**https**、`project-c8c8z.vercel.app`）
- [x] **LINE Console**：Callback 改為 **https**…`/auth/callback`，與 Vercel 變數一致
- [x] **程式修正**：`SUPABASE_SERVICE_ROLE_KEY` 同時接受 `sb_secret_` 與舊版 `eyJ`；**middleware** 對 `*.vercel.app` **不**做 slug rewrite（預設網域首頁不再 404）
- [x] **驗證**：正式網址首頁、`/auth/login`、後台 `/dashboard/appointments`、預約流程 **以 `?slug=` 在 `project-c8c8z.vercel.app` 上測試通過**
- [x] **自訂網域**：購買 `mybookdate.com`（Cloudflare Registrar，$10.46/年）
- [x] **DNS 設定**：Cloudflare DNS 三筆 CNAME 指向 Vercel，`*` 改為橘雲（Proxied），SSL/TLS 模式設為 Flexible
- [x] **子網域驗證**：`kenter.mybookdate.com` 正常顯示個人介紹頁（頭像、簡介、營業時間、立即預約按鈕）✅
- [x] **更新環境變數/Callback**：`NEXT_PUBLIC_APP_URL`、`LINE_CALLBACK_URL` / `NEXT_PUBLIC_LINE_CALLBACK_URL` 改為 `https://www.mybookdate.com`，並同步更新 LINE Console Callback URL
- [ ] **待後續**：完整預約流程在正式網域驗證（含 LINE 登入、預約對話）

### 文件/設定（必做）
- [x] 在 Supabase 執行 `supabase/schema.sql`
- [x] 建立 Storage bucket：`reference-images`（Private，5MB 限制，限 jpg/png）
- [ ] 撤銷 `anon`/`authenticated` 對資料表與 sequence 權限
      → SQL 在 **`supabase/schema.sql`** 最下方「撤銷 anon 權限」段落，執行後用 anon key 直接查詢應回傳 permission denied
- [x] 確認環境變數齊全（至少 `SUPABASE_SERVICE_ROLE_KEY`、`ANTHROPIC_API_KEY`、LINE 相關）
- [x] DB：`workers.contact_phone`（顧客端顯示；可 `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`）

### Auth（工作者後台）
- [x] `GET /auth/login`：導向 LINE 授權頁（含 `state`）
- [x] `GET /auth/callback`：驗證 `state`、呼叫 `POST /api/auth/callback`
- [x] `POST /api/auth/callback`：
  - [x] 用 `code` 換 token
  - [x] 取 LINE profile（`userId`/`displayName`/`pictureUrl`）
  - [x] `workers` UPSERT（`line_user_id` 為唯一鍵）
  - [x] 寫入 httpOnly cookie：`worker_id`（secure、sameSite: lax、maxAge 30天）
- [x] 跨子網域／`www` 與 `{slug}.lvh.me`：`state` 以 **cookie**（`domain=.lvh.me` 或 `NEXT_PUBLIC_AUTH_COOKIE_DOMAIN`）＋`src/lib/line-oauth-state.ts` 保存
- [x] 後台頁面保護：未登入（無 `worker_id` cookie）導回 `/auth/login`

### Subdomain / Middleware
- [x] `src/middleware.ts` 解析 `host`，對子網域做 rewrite：
  - [x] `/` → `/worker-profile?slug=...`
  - [x] `/booking` → `/booking?slug=...`
  - [x] slug 不存在 → 404
- [x] 主網域（www）正常路由，不受子網域 rewrite 影響
- [x] **`*.vercel.app`**：排除 slug rewrite（Vercel 預設網域用 `/worker-profile?slug=`、`/booking?slug=` 測試；`*.lvh.me` 與自訂網域之 `{slug}.網域` 仍走 rewrite）

### Workers
- [x] `GET /api/workers?slug=`：回傳公開資料（`is_active=true`；含營業／例外／`contact_phone` 等顯示用欄位）
- [x] Dashboard profile：可設定/更新 `slug`、`working_hours`、`working_hours_exceptions`、`slot_duration`、`contact_phone`、重新生成 `bio`
- [x] slug 設定時驗證格式（英數小寫、不含特殊字元）並確認唯一性

### Booking / Chat（公開端）
- [x] `POST /api/chat`：
  - [x] 驗證 `session_token` 存在且未過期（`expires_at > now()`）
  - [x] 驗證 `worker_id` 存在且 `workers.is_active = true`
  - [x] 依 `working_hours` + `working_hours_exceptions` + 既有預約（`confirmed`）算出可用/不可用（prompt + action guardrail）
  - [x] 注入 system prompt（時段由後端資料決定）
  - [x] 使用者訊息中的 `YYYY-MM-DD`：後端計算**台北時區星期**並注入 prompt
  - [x] messages 截斷：只傳最近 20 則給 Claude（`src/lib/claude.ts`）
  - [x] 支援輸出 `[ACTION:SHOW_CONTACT_FORM:YYYY-MM-DD:HH:MM]`
- [x] 前端解析 action token，顯示聯絡／預約表單（內嵌於 `booking/page.tsx`）

### Appointments（公開建立 / 後台管理 / 顧客查詢）
- [x] `POST /api/appointments`（顧客建立）：
  - [x] 驗證 `worker_id` 存在且 `is_active = true`
  - [x] 驗證電話格式：`/^(\+886|0)[0-9]{8,9}$/`
  - [x] 驗證是否在營業時段內，且時間必須對齊 `slot_duration` 刻度
  - [x] 例外公休日不可預約
  - [x] 寫入 `appointments`，處理 `23505 unique_violation` → 409（回傳「此時段已被預約」）
  - [x] 時段選擇器：依 `working_hours + slot_duration` 產生可選時段，已預約（confirmed）時段 disabled
  - [ ] （解鎖功能）可上傳參考圖：由後端用 service role 上傳到 `{worker_id}/{appointment_id}/reference.jpg`；需先確認 `worker.referral_count >= 10`
- [x] `GET /api/appointments`（後台讀取 + 公開查詢佔用）：
  - [x] 後台：必須驗證 `worker_id` cookie
  - [x] 後台：只能讀自己的預約（`WHERE worker_id = cookie.worker_id`）
  - [x] 公開：`workerId`+`date` 查當日 booked 時段（供預約頁）
  - [x] 月份查詢修正：使用 `[monthStart, nextMonthStart)` 避免 `YYYY-MM-31` 導致查詢失敗
- [x] `PATCH /api/appointments/[id]`（後台更新狀態）：
  - [x] 必須驗證 `worker_id` cookie
  - [x] 只能改自己的預約（先查 `appointment.worker_id === cookie.worker_id`）
  - [x] 允許狀態：`confirmed → completed / cancelled / no_show`

- [x] DB 防重複：建立 partial unique index（只限制 `status='confirmed'`），取消後可釋出時段
- [x] 顧客端取消/改期：新增 `manage_token` + `PATCH /api/appointments/manage`（`manageToken + phone` 驗證）

- [x] `GET /api/appointments/lookup?phone=xxx&workerId=xxx`（顧客查詢，不需登入）：
  - [x] 只回傳 `appointment_date >= today`（台北日曆）且 `status = confirmed` 的預約
  - [x] Rate limit：10 次／小時（依 IP），防止電話號碼掃描
  - [x] 回傳欄位：日期、時間（不回傳其他顧客個資）

### 顧客端 UI（確認頁 + 查詢入口）
- [x] 預約確認頁顯示完整資訊：
  - [x] 工作者名稱、預約日期時間、工作者聯絡電話（後台設定 `contact_phone`）
  - [x] 提示文字：「請截圖保存此頁面作為預約憑證」
- [x] booking 頁加入「查詢我的預約」入口：
  - [x] 輸入電話號碼查詢
  - [x] 顯示該電話的所有未來確認預約（日期、時間）
  - [x] 若需取消：顯示工作者聯絡電話，請顧客直接聯繫

### Storage（參考圖，解鎖功能）
- [ ] 產 signed URL（後台）：先驗證 `cookie.worker_id === appointment.worker_id`，再呼叫 service role 產 URL
- [ ] signed URL 有效期 24 小時
- [ ] 上傳限制：檔案類型限 `image/jpeg`、`image/png`，大小限 5MB

### Rate Limit / Abuse 防護
- [x] `POST /api/chat`：30 次／小時（識別依據：`session_token`）— **MVP：程序內記憶體**
- [x] `POST /api/appointments`：5 次／小時（識別依據：IP + `worker_id`）— **MVP：程序內記憶體**
- [x] `GET /api/workers`：100 次／小時（識別依據：IP）— **MVP：程序內記憶體**
- [x] `GET /api/appointments/lookup`：10 次／小時（識別依據：IP）— **MVP：程序內記憶體**
- [ ] 正式環境建議：Upstash Redis 等分散式計數（取代單機記憶體）

### 營運必備頁面（上線前）
- [x] `/privacy` 隱私權政策（含資料範圍、保存 180 天、刪除方式）— **頁面已存在，法務文案仍建議審閱**
- [x] `/terms` 服務條款（含月費、退款、帳號終止）— **頁面已存在，法務文案仍建議審閱**
- [ ] Footer 客服聯絡方式（email 或 LINE 平台客服帳號）

### 測試清單（最低限度，部署後逐項確認）
- [x] **Vercel Production**：`https://project-c8c8z.vercel.app` 首頁、LINE 登入、後台日曆、以 `?slug=` 預約流程正常
- [x] 子網域 rewrite：`*.lvh.me:3000` 正常進 profile 頁與 booking 頁
- [x] 同時雙視窗搶同一時段：一方 201、一方 409
- [x] `session_token` 過期後 `POST /api/chat` 被拒絕（401）
- [x] 非本人 cookie 無法讀／改他人預約（403）
- [ ] anon key 直接查 `workers` 資料表應回傳 permission denied（**須已在 DB 執行 REVOKE**）
- [ ] `mybookdate.com` 301 redirect 到 `www.mybookdate.com`（Cloudflare Rules 設定）
- [ ] Cloudflare DNS：`*` 為橘雲（Proxied），其餘為灰雲；SSL/TLS 為 Flexible ✅
- [x] `/privacy` 與 `/terms` 頁面存在且可正常訪問
- [x] 預約完成後確認頁顯示完整資訊（工作者電話、日期時間、截圖提示）
- [x] 電話查詢：輸入正確電話可查到未來預約，不顯示歷史紀錄
- [x] 電話查詢：輸入不存在的電話顯示「查無預約」而非錯誤
- [x] 子網域正式網域： 正常顯示個人介紹頁 ✅
- [ ] 完整預約流程在  正式網域驗證（含 LINE 登入、預約對話）
