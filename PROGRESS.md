# 任務階段進度報告

**更新日：** 2026-05-06  
**對照文件：** `to-do-list.md`（實作狀態以此檔勾選為準）、`README.md`（架構與商業說明）

---

## 本階段已完成（摘要）

| 區塊 | 說明 |
|------|------|
| **Auth** | LINE 手動 OAuth；`worker_id` httpOnly cookie；**跨子網域** `state` 以 **`line-oauth-state`** cookie（`domain` 依 `NEXT_PUBLIC_ROOT_DOMAIN`）＋sessionStorage 備援。**推薦（2026-04-30）**：`/{slug}`／`?ref=` rewrite **`/join`** → `POST /api/auth/referral-intent`（**`referral_slug_intent`**）→ **`/api/auth/line-bootstrap`** 寫 `line_oauth_state` 導 LINE（in-app 走 **`/auth/login/in-app`**）；`/auth/login` 僅轉址 bootstrap（RSC 不可 `cookies().set`）。**Callback**：換票 UPSERT；**首次登入**依 `state.ref` 寫 **`referred_by`／`referral_count`**（`validateSlug`、`maybeSingle`、回傳 **`referralStatus`**）。 |
| **Middleware** | 子網域 rewrite：`/` → worker-profile、`/booking` → booking；主站推薦路徑 rewrite **`/join`**；apex 兩段 hostname 不誤判 slug；`/auth/callback` host 對齊 `NEXT_PUBLIC_LINE_CALLBACK_URL`；`join` 為保留路徑段。 |
| **Workers** | 公開 `GET /api/workers?slug=`（`is_active`、含 `contact_phone`、`booking_confirmation_message`、`working_hours_exceptions`）；**IP rate limit** 100/h；後台 PATCH 含聯絡電話與預約完成提醒文字（上限 5000 字）。 |
| **Chat** | Session 過期／worker 校驗、營業與例外與已預約注入 prompt、**台北時區星期**注入、訊息截斷 20 則、`ACTION` 解析與後端 guardrail、**30/h per session_token**。 |
| **Appointments** | 公開建立（時段、例外公休、**409** on `23505`）、後台 GET（cookie + 僅本人）、**PATCH `[id]`**：狀態轉換或 **後台改期**（`appointment_date`／`appointment_time`、營業／公休／衝突）；公開 GET 支援 **`excludeAppointmentId`** 排除自己以選時段；**manage** 顧客取消／改期；**POST rate limit** 5/h IP+worker。 |
| **Lookup** | 僅未來 `confirmed`、欄位僅日期／時間、**10/h IP**。 |
| **Booking UI** | 內嵌聯絡表單、完成頁標題「**預約申請已送出**」、**自訂／預設提醒文字**（`booking_confirmation_message`）、名稱與時間、**聯絡電話**、截圖提示；「查詢我的預約」；**worker 為 null 時不存取欄位**（修復白屏）。**正式網域完成頁已驗（2026-05-06）**。 |
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

- Supabase **Storage** `reference-images`（Private）與參考圖 signed URL、上傳限制。  
- **撤銷 anon** 等 SQL（`supabase/schema.sql` 文末）：若尚未執行請補跑。  
- Rate limit 上線強化：**Upstash Redis**（README 已列建議）。  
- Footer 客服、正式網域 **LINE 登入** 與 **AI 預約對話** 全流程回歸測試（預約完成頁與提醒文字已於正式網域驗證 ✅；**後台改期**已於正式網域驗證 ✅；DNS／子網域已驗證 ✅）。  
- **`/dashboard/insights`** 與 **`GET /api/insights`**：MVP 已上線；`to-do-list`「數據洞察」一節列第一～三級待擴充指標。  
- **LINE `access.line.me` 連線問題**：屬使用者網路／內建瀏覽器限制，產品面以 `/join` 外開與文案引導為主。  

---

## 與 README 的對齊方式

- **架構、商業模式、網域、LINE 步驟**：以 `README.md` 為主；本報告不複寫。  
- **實作細節與檔案路徑**：README「專案結構」已改為與目前 `src/` 一致；**資料表定義**以 repo 內 `supabase/schema.sql` 為準（README 內嵌 SQL 僅作設計參考時請自行比對）。  
- **待辦勾選**：以 `to-do-list.md` 為準，與本報告同步更新。
