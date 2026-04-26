# 任務階段進度報告

**更新日：** 2026-04-26  
**對照文件：** `to-do-list.md`（實作狀態以此檔勾選為準）、`README.md`（架構與商業說明）

---

## 本階段已完成（摘要）

| 區塊 | 說明 |
|------|------|
| **Auth** | LINE 手動 OAuth、`POST /api/auth/callback` 換票與 UPSERT、`worker_id` httpOnly cookie；**跨子網域**（`*.lvh.me` ↔ `www`）以 **cookie + `NEXT_PUBLIC_AUTH_COOKIE_DOMAIN`** 與 `src/lib/line-oauth-state.ts` 保存 `state`，避免 `sessionStorage` 分網域失敗。 |
| **Middleware** | 子網域 rewrite：`/` → worker-profile、`/booking` → booking；`www` 不走 slug。 |
| **Workers** | 公開 `GET /api/workers?slug=`（`is_active`、含 `contact_phone` / `working_hours_exceptions`）；**IP rate limit** 100/h；後台 PATCH 含聯絡電話驗證。 |
| **Chat** | Session 過期／worker 校驗、營業與例外與已預約注入 prompt、**台北時區星期**注入、訊息截斷 20 則、`ACTION` 解析與後端 guardrail、**30/h per session_token**。 |
| **Appointments** | 公開建立（時段、例外公休、**409** on `23505`）、後台 GET（cookie + 僅本人）、PATCH 狀態、**manage** 取消／改期；**POST rate limit** 5/h IP+worker。 |
| **Lookup** | 僅未來 `confirmed`、欄位僅日期／時間、**10/h IP**。 |
| **Booking UI** | 內嵌聯絡表單、預約成功頁（名稱、時間、**聯絡電話**、截圖提示）、「查詢我的預約」、**worker 為 null 時不存取欄位**（修復白屏）。 |
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
- Footer 客服、部署後測試清單（301、灰雲 DNS 等）。  

---

## 與 README 的對齊方式

- **架構、商業模式、網域、LINE 步驟**：以 `README.md` 為主；本報告不複寫。  
- **實作細節與檔案路徑**：README「專案結構」已改為與目前 `src/` 一致；**資料表定義**以 repo 內 `supabase/schema.sql` 為準（README 內嵌 SQL 僅作設計參考時請自行比對）。  
- **待辦勾選**：以 `to-do-list.md` 為準，與本報告同步更新。
