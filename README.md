# AI 預約平台 - 架構說明

## 專案概述

個人工作者的專屬 AI 預約頁面平台，不限職業類型。

每位工作者擁有獨立子網域個人介紹頁（如 `jessica.yourdomain.com`），頁面由 AI 自動生成，並內建 AI 預約對話機器人。顧客不需安裝任何 App，點連結即可完成預約。工作者透過 LINE 登入後台查看預約日曆。

**實作進度：** 以 `to-do-list.md` 勾選為準；階段彙報見 **`PROGRESS.md`**。

**近期實作紀要（2026-05-06）**：`workers.booking_confirmation_message`；後台 **`/dashboard/profile`** 編輯與 **`POST /api/generate-booking-message`**（Claude）；預約完成頁改為「**預約申請已送出**」並顯示自訂或預設提醒文字（**正式網域已驗**）。

**近期實作紀要（2026-04-30）**：推薦連結先進 **`/join`** 確認代碼（httpOnly `referral_slug_intent`）再 **`/api/auth/line-bootstrap`** 導 LINE；OAuth `state` 仍帶 `ref`；`POST /api/auth/callback` 僅**首次登入**寫 `referred_by`／遞增 `referral_count`（回傳 `referralStatus`）；舊 Supabase 可執行 `supabase/migrations/20250430120000_workers_referral_columns.sql` 補欄位。

> **安全：** 切勿將 Supabase／LINE／Anthropic 金鑰寫入版本庫。若曾誤提交，請立即於各平台**輪替金鑰**。

### 目標族群

任何有「時間預約」需求的個人工作者，包含但不限於：

- 美髮師、美甲師
- 按摩師、整復師
- 攝影師、紋身師
- 家教老師、寵物美容師

### 市場策略

**Phase 1～2**：專注台灣美髮美甲圈。社群緊密、口碑傳播快，同一間沙龍多人使用，滾雪球效應明顯。
**Phase 3 之後**：相同產品架構，僅替換行銷訊息，擴展至其他職業族群。

### 核心賣點

- 不依賴 LINE 官方帳號（工作者不需額外付費給 LINE）
- 顧客不用安裝 App，點連結就能預約
- 工作者 3 分鐘內完成上線，不需技術背景
- 不做企業版，專注個人工作者

---

## 商業模式

| 項目 | 內容 |
|------|------|
| 定價 | 月費 NT$199／人，單一定價（可另設早鳥優惠，但產品功能不分方案） |
| 收款方式 | **MVP 階段人工收款（LINE Pay 轉帳）**；達到穩定用戶量後串接綠界金流 |
| 解鎖機制 | 推薦新用戶完成註冊即解鎖進階功能，不額外收費 |
| 平台成本 | Claude API + 伺服器，估計 NT$30～110／會員／月 |
| 毛利空間 | 約 NT$90～170／會員／月 |

> **成本假設**：每位工作者每月約 20～50 次對話，每次對話約 5～10 輪，以 claude-sonnet 定價估算。若對話量超出預期，優先考慮截斷對話歷史長度或快取 system prompt。



### 預約完成提醒文字

來自早期用戶試用回饋，解決設計師對「AI 自動接單後無法彈性調整」的疑慮。

**設計概念：**
預約完成畫面標題改為「預約申請已送出」，並顯示設計師自訂的提醒文字，讓顧客知道設計師還會確認，保留雙方溝通空間。

**設定流程：**
1. 設計師進後台設定頁，填寫「預約完成提醒文字」
2. 可點「AI 幫我生成」，Claude 根據 `business_name` 和 `bio` 產出符合風格的建議文字
3. 修改後儲存到 `workers.booking_confirmation_message`

**顧客端畫面：**
```
✅ 預約申請已送出

[工作者名稱] / [日期] [時間]

[booking_confirmation_message]
（未設定時預設：「我會盡快確認您的預約，如有時間調整會直接與您聯繫，謝謝！」）

📞 [contact_phone]

請截圖保存此頁面作為預約憑證
```

**DB 異動：**
```sql
ALTER TABLE workers
ADD COLUMN IF NOT EXISTS booking_confirmation_message TEXT;
```

### 解鎖功能導覽列

後台頁面（`/dashboard`）頂部中間區域，放置解鎖功能導覽列：

```
[ 🏠 ] [ icon黑名單 ] [ icon參考圖 ] [ icon簡訊通知 ]
```

**行為：**
- 🏠 點擊回到行事曆
- 未解鎖 icon：灰色半透明，點擊展開功能說明 + 複製推薦連結按鈕
- 已解鎖 icon：全彩，點擊展開功能入口
- icon 樣式由工程師決定

**解鎖判斷依據：** `workers.referral_count`

**導覽列下方動態提示（一行文字，置中小字灰色）：**

| referral_count | 顯示文字 |
|---------------|---------|
| 0～4 | 目前 X 人　還差 Y 人可解鎖 🚫 黑名單功能 |
| 5～9 | 目前 X 人　還差 Y 人可解鎖 🖼️ 參考圖功能 |
| 10～14 | 目前 X 人　還差 Y 人可解鎖 💬 簡訊通知功能 |
| ≥15 | 隱藏（全部解鎖） |

**分享彈窗結構：**
```
【顧客預約區塊】
你的專屬連結
https://[slug].mybookdate.com
[ 複製連結 ]

或讓客戶掃描 QR Code
[ QR Code 圖片 ]
客戶掃描後會直接開啟你的子網域預約頁

────────────────
【推薦設計師區塊（新增）】
推薦設計師加入
把連結分享給其他設計師，他們加入後自動計入你的推薦紀錄

https://www.mybookdate.com/[slug]
（推薦連結使用路徑，避免部分 LINE 內建瀏覽器吃掉 `?ref=` 參數；舊版 `?ref=` 仍相容）
[ 複製推薦連結 ]
```

**推薦計數邏輯：**
- 新工作者透過推薦連結（建議 `https://www.網域/{slug}`；相容舊版 `?ref=slug`）進入 → middleware **rewrite** 至 **`/join?ref=`**（網址列可仍顯示 `/{slug}`）→ 確認或手填代碼 → `POST /api/auth/referral-intent` 寫 cookie → **`/api/auth/line-bootstrap`** 產 OAuth `state`（內含 `ref`）並導向 LINE
- `POST /api/auth/callback` 自 `state` 還原 `ref`（slug），以 **`workers.slug`** 找推薦人；僅該 LINE **首次**建立 `workers` 列時寫入 **`referred_by`** 並為推薦人 **`referral_count + 1`**；回應含 **`referralStatus`**（`applied`／`skipped_*`）供除錯
- 推薦人須已在後台個人檔儲存**相同** slug，否則不計入（見 `skipped_no_referrer`）
- 同一 LINE 帳號只計算一次（非首次登入不會再寫推薦）

### 解鎖功能規劃

| 解鎖門檻 | 功能 | 說明 |
|---------|------|------|
| 推薦 5 人 | 黑名單機制 | 封鎖特定電話，自動拒絕預約。定位為「降低騷擾」，換號可繞過，UI 需說明清楚避免期待落差 |
| 推薦 10 人 | 參考圖上傳 | 顧客預約時可上傳一張參考圖（髮型、紋身等），讓工作者提前評估；限一張，存 Supabase Storage |
| 推薦 15 人 | 簡訊確認通知 | 預約完成後自動發簡訊給顧客（Every8d API）。顧客留電話時需勾選「同意接收預約通知簡訊」 |

> **推薦成功定義**：被推薦方完成平台註冊（LINE 登入）即算，不要求付費。
> **防刷機制**：以 LINE user ID 為唯一識別，同一 LINE 帳號只能被計算一次。

---

## 網域架構

```
yourdomain.com                  # 301 redirect → www.yourdomain.com
www.yourdomain.com              # 平台首頁（介紹產品、吸引工作者加入）
jessica.yourdomain.com          # 工作者個人介紹頁（根路徑 /）
jessica.yourdomain.com/booking  # 顧客 AI 預約對話頁
[slug].yourdomain.com           # 每位工作者的獨立子網域（自動生效，無需手動建立）
```

> **apex domain**（`yourdomain.com`）需在 Cloudflare Rules 設定 301 redirect 到 `www`。LINE Developers Console 的 Callback URL 只需登記 `www` 版本。

> **正式網域建議：** 設定 `NEXT_PUBLIC_ROOT_DOMAIN=mybookdate.com`（或你的根網域），讓系統只對 `*.根網域` 視為工作者子網域，避免 apex（如 `mybookdate.com`）被誤判成 slug。

### 子網域路由運作方式

對外是子網域根路徑（`jessica.yourdomain.com/`），middleware 讀取 `host` header 抽出 slug，以 Next.js `rewrite` 對應到內部頁面，**不走 URL path `/jessica`**，避免與 path-based 路由衝突：

```
外部 URL                              內部路由（rewrite）
jessica.yourdomain.com/           →   /worker-profile?slug=jessica
jessica.yourdomain.com/booking    →   /booking?slug=jessica
www.yourdomain.com/               →   /（平台首頁）
www.yourdomain.com/dashboard      →   /dashboard（需登入）
```

`src/middleware.ts` 需處理四種情況：
1. 主網域（www）→ 正常路由
2. 工作者子網域根路徑 → rewrite 到個人介紹頁
3. 工作者子網域 `/booking` → rewrite 到預約對話頁
4. 不存在的 slug → 404 頁面

### 個人介紹頁結構

```
jessica.yourdomain.com

┌─────────────────────────────┐
│  Jessica Chen                │
│  美甲師・台北大安區           │
│  8 年經驗                    │
│                             │
│  [AI 自動生成的個人簡介]      │
│                             │
│  服務特色：                  │
│  • 日系凝膠                  │
│  • 客製化手繪                │
│  • 療癒系手部護理             │
│                             │
│  ┌─────────────────────┐   │
│  │  立即預約            │   │  ← 跳到 jessica.yourdomain.com/booking
│  └─────────────────────┘   │
└─────────────────────────────┘
```

### AI 自動生成個人介紹

工作者註冊後填寫五個問題，Claude 自動產出個人介紹頁文案：

1. 你的名字／稱呼？
2. 你的職業／專長？
3. 你有幾年經驗？
4. 你的服務特色是什麼？
5. 你的工作地點在哪裡？

工作者可直接使用或微調後發布，並可在後台隨時重新生成。

---

## 技術棧

| 類別 | 技術 |
|------|------|
| 前端／後端 | Next.js 14（App Router）+ TypeScript |
| 樣式 | Tailwind CSS |
| 資料庫 | Supabase（PostgreSQL） |
| AI | Claude API（模型代號以 [Anthropic 官方文件](https://docs.anthropic.com/) 建議為準；範例：`claude-sonnet-4-20250514`） |
| 驗證 | LINE Login OAuth 2.0（手動 OAuth 流程，不使用 Supabase Auth；session 以 httpOnly cookie 管理） |
| 檔案儲存 | Supabase Storage（參考圖上傳，解鎖功能；bucket 私有，以 signed URL 提供工作者存取） |
| 部署 | Vercel（前後端）+ Supabase（資料庫）+ Cloudflare（DNS） |

---

## 專案結構

**建表與索引以 `supabase/schema.sql` 為唯一來源**；下列為程式目錄（與 repo 實際結構一致）。

```
src/
├── middleware.ts                 # 子網域 rewrite；主站推薦路徑 rewrite /join；保護 /dashboard；callback host 對齊
├── app/
│   ├── page.tsx                  # 平台首頁（www）
│   ├── join/                     # 推薦代碼確認頁（→ referral-intent cookie → line-bootstrap）
│   ├── privacy/、terms/          # 隱私權、服務條款
│   ├── worker-profile/           # 個人介紹（middleware rewrite）
│   ├── booking/                  # AI 預約（rewrite；內含時段選擇、查詢預約、聯絡表單）
│   ├── dashboard/                # 後台（appointments 日曆、profile 設定）
│   ├── api/auth/line-bootstrap、referral-intent、auth/login、auth/callback # LINE OAuth（Set-Cookie 僅 Route Handler）
│   └── api/
│       ├── chat/                 # Claude 對話 + session／rate limit
│       ├── appointments/       # GET／POST；lookup；manage；[id] PATCH
│       ├── workers/、workers/me/
│       ├── generate-bio/、generate-booking-message/  # 預約完成提醒文字（Claude）
│       └── auth/callback/        # 換票、UPSERT workers、寫入 cookie
├── lib/
│   ├── supabase.ts、supabase-admin.ts、claude.ts、utils.ts
│   ├── datetime-taipei.ts        # 台北日曆／星期（預約與 chat 共用）
│   ├── rate-limit.ts             # MVP 程序內計數（上線可換 Redis）
│   ├── line-oauth-state.ts       # LINE state：cookie 跨子網域（.lvh.me 等）
│   ├── referral-intent-cookie.ts # 推薦 slug httpOnly（進 LINE 前）
│   └── line-login-oauth.ts       # authorize URL、state 編碼、in-app UA 偵測
├── types/index.ts
supabase/schema.sql               # PostgreSQL schema（路線 A：REVOKE anon 等）
supabase/migrations/              # 可重複執行補欄位（例：referral_count／referred_by）
to-do-list.md                     # 實作勾選清單
PROGRESS.md                       # 階段進度彙報（與 to-do 對照）
```

---

## 資料庫 Schema

> **實際 DDL、索引、REVOKE** 請以 repo 內 **`supabase/schema.sql`** 為準。下列 JSON 與內嵌 SQL 片段為設計說明；若與檔案內容不一致，以檔案為準。

### working_hours JSON 結構

```json
{
  "mon": { "start": "10:00", "end": "20:00", "closed": false },
  "tue": { "start": "10:00", "end": "20:00", "closed": false },
  "wed": { "start": "10:00", "end": "20:00", "closed": false },
  "thu": { "start": "10:00", "end": "20:00", "closed": false },
  "fri": { "start": "10:00", "end": "20:00", "closed": false },
  "sat": { "start": "10:00", "end": "18:00", "closed": false },
  "sun": { "start": "00:00", "end": "00:00", "closed": true }
}
```

**可預約時段產生規則：**
- 時區：固定使用 `Asia/Taipei`（UTC+8），所有時間以台北時間儲存與比較
- 最小提前預約時間：1 小時（顧客不能預約 1 小時內的時段）
- 最晚可預約：30 天後
- 時段長度：由工作者設定 `slot_duration`（預設 60 分鐘）
- 不支援跨日預約（單次服務最長到當天營業結束）
- 不規則公休：工作者可在後台標記特定日期為公休（存為 `exceptions JSONB`，格式：`{"2025-02-10": true}`）

### 完整 Schema

```sql
-- =============================================
-- 工作者資料表
-- =============================================
CREATE TABLE workers (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  line_user_id        TEXT UNIQUE NOT NULL,
  display_name        TEXT NOT NULL,
  avatar_url          TEXT,
  slug                TEXT UNIQUE,
  business_name       TEXT,
  bio                 TEXT,
  bio_answers         JSONB,
  working_hours       JSONB NOT NULL DEFAULT '{
    "mon": {"start":"10:00","end":"20:00","closed":false},
    "tue": {"start":"10:00","end":"20:00","closed":false},
    "wed": {"start":"10:00","end":"20:00","closed":false},
    "thu": {"start":"10:00","end":"20:00","closed":false},
    "fri": {"start":"10:00","end":"20:00","closed":false},
    "sat": {"start":"10:00","end":"18:00","closed":false},
    "sun": {"start":"00:00","end":"00:00","closed":true}
  }'::jsonb,
  working_hours_exceptions JSONB DEFAULT '{}'::jsonb,  -- {"2025-02-10": true}
  slot_duration       INTEGER NOT NULL DEFAULT 60,
  referral_count      INTEGER NOT NULL DEFAULT 0,
  referred_by         UUID REFERENCES workers(id),
  subscription_status TEXT NOT NULL DEFAULT 'inactive'
                      CHECK (subscription_status IN ('active', 'inactive')),
  is_active           BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- 預約資料表
-- =============================================
CREATE TABLE appointments (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  worker_id             UUID NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  customer_name         TEXT NOT NULL,
  customer_phone        TEXT NOT NULL,
  appointment_date      DATE NOT NULL,
  appointment_time      TIME NOT NULL,
  duration              INTEGER NOT NULL DEFAULT 60,
  reference_image_url   TEXT,
  note                  TEXT,
  status                TEXT NOT NULL DEFAULT 'confirmed'
                        CHECK (status IN ('confirmed', 'cancelled', 'completed', 'no_show')),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- 防 double booking
  CONSTRAINT unique_worker_slot UNIQUE (worker_id, appointment_date, appointment_time)
);

-- =============================================
-- 對話紀錄資料表
-- =============================================
CREATE TABLE chat_sessions (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  worker_id      UUID NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  session_token  TEXT UNIQUE NOT NULL,
  messages       JSONB NOT NULL DEFAULT '[]'::jsonb,
  status         TEXT NOT NULL DEFAULT 'active'
                 CHECK (status IN ('active', 'completed', 'abandoned')),
  expires_at     TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- 索引
-- =============================================
CREATE INDEX idx_appointments_worker_date ON appointments(worker_id, appointment_date);
CREATE INDEX idx_appointments_status ON appointments(status);
CREATE INDEX idx_chat_sessions_token ON chat_sessions(session_token);
CREATE INDEX idx_chat_sessions_expires ON chat_sessions(expires_at);
CREATE INDEX idx_workers_slug ON workers(slug);

-- =============================================
-- updated_at 自動更新
-- =============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER workers_updated_at
  BEFORE UPDATE ON workers FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER appointments_updated_at
  BEFORE UPDATE ON appointments FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER chat_sessions_updated_at
  BEFORE UPDATE ON chat_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================
-- 路線 A（寫死）：不使用 RLS，所有資料存取走 API + service role
-- =============================================
-- 本專案採用「Next.js Route Handler + SUPABASE_SERVICE_ROLE_KEY」存取資料庫與 Storage。
-- 因此不依賴 Supabase Auth / RLS；授權邏輯由 API 以 httpOnly cookie（worker_id）判斷。
--
-- 建議：維持 RLS 為關閉（預設即為 disabled），避免誤以為可以直接用 anon key 讀寫表。
-- 如你過去啟用過 RLS，可用以下指令確認／關閉：
--   ALTER TABLE workers DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE appointments DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE chat_sessions DISABLE ROW LEVEL SECURITY;

-- =============================================
-- 撤銷 anon / authenticated 對資料表的直接存取權限
-- 確保任何人都無法繞過 API 直接用 anon key 讀寫資料
-- =============================================
REVOKE ALL ON TABLE workers       FROM anon, authenticated;
REVOKE ALL ON TABLE appointments  FROM anon, authenticated;
REVOKE ALL ON TABLE chat_sessions FROM anon, authenticated;

-- sequence 也要一起撤銷（若資料表用 SERIAL，UUID 不受影響可略）
-- REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;

-- 執行後驗證：用 anon key 直接查詢應回傳 permission denied
-- SELECT * FROM workers; -- 應該報錯
```

### 建立預約（防併發寫法）

```typescript
// api/appointments/route.ts
try {
  const { data, error } = await supabaseAdmin
    .from('appointments')
    .insert({ worker_id, customer_name, customer_phone, appointment_date, appointment_time })
    .select()
    .single()

  if (error?.code === '23505') {  // unique_violation
    return NextResponse.json(
      { error: '此時段已被預約，請選擇其他時間' },
      { status: 409 }
    )
  }
  if (error) throw error
  return NextResponse.json({ appointment: data }, { status: 201 })

} catch (error) {
  return NextResponse.json({ error: '預約失敗，請稍後再試' }, { status: 500 })
}
```

---

## 預約狀態機

### 狀態定義

| 狀態 | 說明 | 觸發者 |
|------|------|--------|
| `confirmed` | 預約已確認，待服務 | 系統（顧客完成預約自動設定） |
| `completed` | 服務已完成 | 工作者（後台手動標記） |
| `cancelled` | 預約已取消 | 工作者（後台操作後電話通知顧客） |
| `no_show` | 顧客未出現 | 工作者（後台手動標記） |

### 修改流程說明

- **取消／改期（顧客）**：預約完成頁提供 `manage_token` + 電話驗證，可呼叫 `PATCH /api/appointments/manage` 取消或改期（詳見 API 實作）。
- **取消／改期（後台）**：工作者以 cookie 身分更新預約狀態或電話聯繫顧客協調。
- **同電話重複預約**：允許，同一顧客在不同時段可有多筆 `confirmed` 狀態的預約
- **顧客未到（no_show）**：工作者手動標記，後續黑名單功能解鎖後可連動封鎖

---

## AI 對話設計

### System Prompt 核心約束

```
【硬規則 - 必須遵守】
1. 可預約與否以後端查詢結果為準，模型不得自行判斷或猜測
2. 只能預約未來時段，最早 1 小時後，最晚 30 天內
3. 每次服務時長固定為 {slot_duration} 分鐘
4. 若涉及特定日期的星期資訊，必須以後端注入的「台北時區星期幾」為準，模型不得自行推測
5. 時段確認後必須輸出 action token，格式如下：
   [ACTION:SHOW_CONTACT_FORM:YYYY-MM-DD:HH:MM]

【對話風格】
- 使用繁體中文，語氣親切自然
- 回覆簡短有重點，不超過 3 句話
- 不主動透露自己是 AI

【不能做的事】
- 不得承諾未經資料庫確認的時段
- 不得要求顧客提供電話以外的個資
- 不得討論與預約無關的話題
```

### 資料流（可預約判斷）

```
顧客輸入時間
    ↓
API route 接收訊息
    ↓
後端查詢 DB：該時段是否已有 confirmed 預約？是否在營業時間內？
    ↓
將查詢結果注入 system prompt（「10/15 14:00 可預約」或「已被預約」）
    ↓
Claude 根據已知結果與顧客對話（模型不自行判斷）
    ↓
時段確認 → 輸出 [ACTION:SHOW_CONTACT_FORM:...] token
    ↓
前端解析 token，顯示留資料表單
    ↓
顧客送出 → API 寫入 DB（unique constraint 防併發）
```

### 對話歷史截斷

傳給 Claude 的 `messages` 陣列最多保留最近 **20 則**，避免 token 成本過高與單列過大：

```typescript
const recentMessages = session.messages.slice(-20)
```

### session_token 規則

- 前端頁面載入時產生：`session_${Date.now()}_${nanoid(9)}`
- 儲存在前端 `sessionStorage`（頁面關閉即清除，不持久化）
- 後端 `chat_sessions.expires_at` 預設 24 小時後過期
- 過期的 session 可定期以 cron job 清除（Supabase Edge Function 或外部排程）

### 路線 A 的授權規則（一定要做）

本專案 **不使用 RLS**，所以「誰可以讀／寫」完全取決於 API 實作。最低限度規則如下：

- **公開端（顧客）**
  - `POST /api/chat`：必須帶 `session_token`，且後端必須驗證：
    - `chat_sessions.session_token` 存在
    - `expires_at > now()`
    - `worker_id` 存在且 `workers.is_active = true`
  - `POST /api/appointments`：必須驗證 `worker_id` 存在且 `is_active = true`，並做 rate limit + 格式驗證
- **後台端（工作者）**
  - 以 `worker_id` httpOnly cookie 作為登入態
  - 所有後台讀寫（查 appointments、更新 status、產生/讀取 signed URL 等）都必須先比對：`cookie.worker_id === row.worker_id`

---

## 公開 API 濫用防護

### Rate Limit 策略

| API | 限制 | 識別依據 |
|-----|------|---------|
| `POST /api/chat` | 30 次／小時 | `session_token` |
| `POST /api/appointments` | 5 次／小時 | IP + `worker_id` |
| `GET /api/workers` | 100 次／小時 | IP |
| `GET /api/appointments/lookup` | 10 次／小時 | IP |

**MVP 現況：** 以上已於 Route Handler 以**程序內記憶體**計數實作（`src/lib/rate-limit.ts`）；正式環境仍建議改 **Upstash Redis** 等分散式計數，避免多 instance 各自計數。

### 其他防護

- `POST /api/appointments` 必須驗證 `worker_id` 存在且 `is_active = true`
- `session_token` 必須存在於 `chat_sessions` 且未過期，否則拒絕對話請求
- 電話格式驗證：`/^(\+886|0)[0-9]{8,9}$/`

---

## Storage Policy（參考圖）

### 路線 A（寫死）做法

- **bucket**：`reference-images`（Private）
- **上傳路徑規則**：`{worker_id}/{appointment_id}/reference.jpg`
- **存取方式**：
  - 顧客上傳：走 `POST /api/appointments`（或獨立 `POST /api/reference-image`）由後端用 service role 上傳
  - 工作者查看：後端用 service role 產 signed URL（24 小時），前端只拿 URL 不拿任何 storage key

> 這條路線下，Storage 的「權限控制」不靠 RLS policy，而是靠「檔案永遠私有 + 只能由後端（service role）產 signed URL」。

```typescript
// 產生 signed URL（後端）
const { data } = await supabaseAdmin.storage
  .from('reference-images')
  .createSignedUrl(`${workerId}/${appointmentId}/reference.jpg`, 86400)
```

上傳限制：
- 檔案類型：`image/jpeg`、`image/png` 僅接受
- 檔案大小：5MB 以內
- 功能開關：`worker.referral_count >= 10` 才允許上傳

---

## LINE Login × Supabase 整合步驟

### Step 1｜LINE Developers Console

1. 登入 [LINE Developers Console](https://developers.line.biz/)
2. 建立 Provider（若無）
3. 建立 **LINE Login** channel（注意：不是 Messaging API channel）
4. Channel 設定：
   - Callback URL：`https://www.yourdomain.com/auth/callback`
   - Scopes：勾選 `profile`、`openid`（不需要 `email`）
5. 記下 `Channel ID`（= LINE_CLIENT_ID）與 `Channel Secret`（= LINE_CLIENT_SECRET）

### Step 2｜Supabase 自訂 OIDC Provider

Supabase Dashboard → Authentication → Providers → 選「Custom OIDC」（或手動 OAuth 流程）：

> ⚠️ 路線 A（本 README 採用）：**不使用 Supabase Auth**。我們仍然使用 Supabase Database/Storage，但登入 session 完全由應用端以 httpOnly cookie 管理。
> LINE Login 非標準 OIDC，建議採用「手動 OAuth 流程」較易控制 workers 建檔與 cookie 寫入。

**手動 OAuth 流程（建議）：**

```
1. 前端導向 LINE 授權頁（帶 client_id、redirect_uri、state）
2. LINE 導回 /auth/callback?code=xxx&state=xxx
3. app/auth/callback/page.tsx 驗證 state，呼叫 /api/auth/callback
4. api/auth/callback/route.ts：
   a. 用 code 換 LINE access token
   b. 用 access token 取得 LINE profile（userId、displayName、pictureUrl）
   c. UPSERT workers 資料表（line_user_id 為唯一鍵）
   d. 產生自訂 JWT 或寫入 httpOnly cookie（worker_id）
   e. redirect 到 /dashboard
```

### Step 3｜首次登入建檔

```typescript
// api/auth/callback/route.ts
const { data: worker } = await supabaseAdmin
  .from('workers')
  .upsert(
    {
      line_user_id: lineProfile.userId,
      display_name: lineProfile.displayName,
      avatar_url: lineProfile.pictureUrl,
    },
    { onConflict: 'line_user_id', ignoreDuplicates: false }
  )
  .select()
  .single()

// 寫入 httpOnly cookie
response.cookies.set('worker_id', worker.id, {
  httpOnly: true,
  secure: true,
  sameSite: 'lax',
  maxAge: 60 * 60 * 24 * 30,  // 30 天
})
```

---

## 本機開發子網域測試

### 問題

`*.localhost` 在大多數環境無法直接使用，需要額外設定。

### 方案一：修改 hosts 檔案（最簡單）

```bash
# macOS / Linux：編輯 /etc/hosts
# Windows：C:\Windows\System32\drivers\etc\hosts

127.0.0.1  www.localhost
127.0.0.1  jessica.localhost
127.0.0.1  david.localhost
```

瀏覽器開啟 `http://jessica.localhost:3000`，middleware 即可解析子網域。

> 缺點：每新增測試帳號就要手動加一行，適合 MVP 早期少量測試。

### 方案二：使用 lvh.me（免設定）

`lvh.me` 是一個公開服務，所有 `*.lvh.me` 都解析到 `127.0.0.1`：

```bash
# .env.local
NEXT_PUBLIC_APP_URL=http://www.lvh.me:3000
```

瀏覽器開啟 `http://jessica.lvh.me:3000`，無需修改任何系統設定。

> 需要網路連線才能 DNS 解析，離線環境不適用。

### LINE OAuth `state` 與子網域（`www` ↔ `{slug}.lvh.me`）

`sessionStorage` **無法**跨不同主機名稱。若 Callback 登記在 `www.lvh.me`，而使用者曾從子網域開過頁面，舊版會出現 state 驗證失敗。目前專案會將 `state` 同時寫入 **`domain=.lvh.me` 的 cookie**（見 `src/lib/line-oauth-state.ts`）。正式環境若有多子網域＋固定 `www` callback，可設定：

```env
NEXT_PUBLIC_AUTH_COOKIE_DOMAIN=.yourdomain.com
```

（本機 `*.lvh.me` 若不設，程式仍會自動對 `.lvh.me` 寫入共用 cookie。）

### 方案三：Cloudflare Tunnel（接近正式環境）

```bash
npx cloudflared tunnel --url http://localhost:3000
```

Cloudflare 會產生一個臨時的 `*.trycloudflare.com` 網址，支援 https，適合測試 LINE Login callback。

### 環境變數對照

| 環境 | NEXT_PUBLIC_APP_URL | LINE_CALLBACK_URL |
|------|--------------------|--------------------|
| 本機（hosts） | `http://www.localhost:3000` | `http://www.localhost:3000/auth/callback` |
| 本機（lvh.me） | `http://www.lvh.me:3000` | `http://www.lvh.me:3000/auth/callback` |
| 正式 | `https://www.yourdomain.com` | `https://www.yourdomain.com/auth/callback` |

> LINE Developers Console 的 Callback URL 需要對應填入，本機測試建議用 lvh.me 或 Cloudflare Tunnel（LINE 不接受 localhost）。  
> 前端授權請求使用 `NEXT_PUBLIC_LINE_CALLBACK_URL`，伺服器換票使用 `LINE_CALLBACK_URL`，**兩者須與 Console 登記的 URL 一致**。

---

## 核心流程

### 工作者上線流程
1. 進入 `www.yourdomain.com` → 點「立即加入」
2. LINE 登入（首次登入自動建立 workers 資料）
3. 填寫五個問題 → Claude 自動生成個人介紹頁
4. 設定 slug（子網域名稱）、營業時間
5. 取得專屬連結：`jessica.yourdomain.com`
6. 分享連結給顧客（IG bio、LINE 個人帳號、名片 QR code 等）
7. 完成繳費確認（MVP：LINE Pay 轉帳，人工開通 `subscription_status = 'active'`）

### 顧客預約流程
1. 點開工作者分享的連結（`jessica.yourdomain.com`）
2. 看到個人介紹頁，點「立即預約」
3. 跳到 `jessica.yourdomain.com/booking`
4. AI 對話框開啟，顧客輸入想預約的時間
5. 後端查詢資料庫確認時段（不依賴模型推測）
6. 時段確認 → 顧客留下姓名＋電話
7. 預約以 unique constraint 防併發寫入
8. 顧客看到確認畫面

### 工作者後台流程
1. 進入 `www.yourdomain.com/dashboard` → LINE 登入
2. 查看月曆上的預約清單
3. 若有顧客新增／取消／改期，後台右上角「通知」會顯示未讀數字（MVP：每 15 秒輪詢）
4. 需要調整時，直接點電話號碼聯繫顧客
5. 服務完成後標記 `completed`；顧客未到標記 `no_show`

---

## 實作要點

### 子網域與路由
middleware 以 `host` header 判斷，對內使用 `rewrite` 而非 redirect，保持子網域 URL 不變。`app/[slug]` 目錄不使用，避免與 path-based 路由衝突。

### Service Role Key 安全性
`SUPABASE_SERVICE_ROLE_KEY` 僅能出現在伺服器端（Route Handler、Server Actions），絕不可使用 `NEXT_PUBLIC_*` 前綴。

### auth/callback 分工
- `app/auth/callback/page.tsx`：處理使用者可見的導向與 UI 狀態
- `app/api/auth/callback/route.ts`：換票、寫入 Cookie、首次登入建立 workers 資料

### 對話歷史截斷
傳給 Claude 的 messages 最多保留最近 20 則，控制 token 成本與單列大小。

---

## 環境變數

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=          # 僅伺服器端，勿提交版本庫

# Claude API
ANTHROPIC_API_KEY=                  # 僅伺服器端，勿提交版本庫

# LINE Login
LINE_CLIENT_ID=
NEXT_PUBLIC_LINE_CLIENT_ID=         # 與 LINE_CLIENT_ID 相同，供前端 authorize 使用
LINE_CLIENT_SECRET=                 # 僅伺服器端，勿提交版本庫
LINE_CALLBACK_URL=                  # 伺服器換 token 的 redirect_uri，須與 LINE Console 一致
NEXT_PUBLIC_LINE_CALLBACK_URL=      # 須與 LINE_CALLBACK_URL 相同（前端導向 authorize 用）

# Rate limit
# 建立預約（POST /api/appointments）：每 IP + workerId 每小時上限（預設 5；設為 0 或負數可關閉）
APPOINTMENTS_POST_RATE_LIMIT=

# App
NEXT_PUBLIC_APP_URL=                # www 版本，如 https://www.yourdomain.com
# 必填（正式環境建議）：根網域（例：mybookdate.com），用於子網域判斷與分享連結組裝
NEXT_PUBLIC_ROOT_DOMAIN=
# 選填：多子網域時 OAuth state cookie 的 domain（例：.yourdomain.com）；本機 lvh.me 可不填
# NEXT_PUBLIC_AUTH_COOKIE_DOMAIN=
```

---

## 開發啟動

```bash
npm install
npm run dev
# 搭配 lvh.me 測試子網域：開啟 http://www.lvh.me:3000
```

---

## 部署步驟

### Step 1｜推上 GitHub
```bash
git init && git add . && git commit -m "init"
git remote add origin https://github.com/yourname/booking-platform.git
git push -u origin main
```

### Step 2｜Vercel 設定
1. [Vercel Dashboard](https://vercel.com/) → Add New Project → 選擇 repo
2. 設定所有環境變數
3. Deploy
4. Settings → Domains → 新增：`yourdomain.com`、`www.yourdomain.com`、`*.yourdomain.com`

### Step 3｜Cloudflare DNS / SSL 設定

進入 [Cloudflare Dashboard](https://dash.cloudflare.com/) → DNS → Records。

#### 3A｜目前現況（可用，但不一定是最佳實務）

> 這段用於記錄「你現在線上環境跑得動」的設定，方便回頭對照與除錯。

- DNS：`@`、`www`、`*` 皆 CNAME 指向 `cname.vercel-dns.com`
- Proxy 狀態：可依現況為灰雲（DNS only）或橘雲（Proxied）
- Cloudflare SSL/TLS：可依現況為 Flexible（若已上線可用）

#### 3B｜建議設定（最佳實務 / 降低風險）

> 若你使用 Vercel 代管與自動簽發憑證，通常建議避免 Cloudflare 對回源做 Proxy，以免造成憑證簽發/重導/回源不穩。

| 類型 | 名稱 | 值 | Proxy 狀態 |
|------|------|-----|-----------|
| CNAME | `www` | `cname.vercel-dns.com` | ☁️ DNS only（灰雲） |
| CNAME | `*` | `cname.vercel-dns.com` | ☁️ DNS only（灰雲） |
| CNAME | `@` | `cname.vercel-dns.com` | ☁️ DNS only（灰雲） |

- Cloudflare SSL/TLS：建議使用 **Full (strict)**

apex domain 301 redirect：Cloudflare → Rules → Redirect Rules：
```
條件：hostname equals yourdomain.com
動作：Static Redirect → https://www.yourdomain.com → 301
```

### Step 4｜Supabase 設定
1. SQL Editor → 執行 `supabase/schema.sql`
2. Storage → 建立 bucket `reference-images`，設定為 **Private**

> 路線 A 不使用 Supabase Auth，不需要設定 Redirect URLs。

### Step 5｜LINE Developers Console
Callback URL 填入：`https://www.yourdomain.com/auth/callback`

### Step 6｜最終確認清單

- [ ] `yourdomain.com` 301 redirect 到 `www`
- [ ] `www.yourdomain.com` 正常顯示平台首頁
- [ ] LINE 登入流程正常，首次登入自動建立 workers 資料
- [ ] 工作者設定 slug 後，`[slug].yourdomain.com` 立即可訪問
- [ ] `[slug].yourdomain.com/booking` 顧客預約流程正常
- [ ] double booking 防護測試（兩個視窗同時搶同一時段）
- [ ] Cloudflare DNS/SSL（現況）：`www` 與子網域可正常解析並可訪問
- [ ] Cloudflare DNS/SSL（建議）：`@`/`www`/`*` 為灰雲（DNS only）且 SSL/TLS 為 Full (strict)
- [ ] `/privacy` 與 `/terms` 頁面存在且內容正確

---


---

## 定價策略

| 方案 | 定價 | 說明 |
|------|------|------|
| 正式定價 | NT$199／月 | 單一定價，不分方案 |
| 早鳥優惠 | NT$99／月（終身鎖定） | 前 30 名（或可調整），用於測試付費意願並保護正式定價 |

**定價邏輯：**
- 損益兩平點：199元方案約 10 人，99元方案約 95 人
- 降價容易漲價難，199起跑保留促銷彈性
- 定價傳遞產品定位：「專業服務」而非「便宜工具」

**成本結構（每月）：**
- 固定：Vercel（依方案）＋網域（年費攤提）＋監控/通知等第三方服務（視需求）
- 變動：Claude API（依對話量）＋（若啟用）簡訊費用（Every8d 等）
- 未來：記帳/發票系統、人事（用戶量上來後再投入）

---

## 護城河策略

**現有護城河（薄但真實）：**
- 工作者慣性：顧客已習慣子網域連結，換平台需重新通知所有顧客
- 推薦網絡：解鎖機制讓早期用戶有動機拉人，後進者從零開始

**建設中護城河：**

| 優先順序 | 護城河 | 具體做法 |
|---------|--------|---------|
| 1 | 社群與口碑網絡 | 建 LINE 群／FB 社團，讓用戶互相介紹，製造業界共識 |
| 2 | 數據優勢 |  提供預約洞察，累積越久越有價值 |
| 3 | 垂直深化 | 做「美髮美甲師的經營夥伴」，而非泛用預約工具 |
| 4 | 轉換成本 | 顧客資料、回頭率紀錄在平台上，轉換就是放棄積累 |

**最大競爭威脅：LINE 官方**
對策：讓平台價值不只是「接受預約」，而是「幫工作者經營顧客關係」。
LINE 可以做預約，但不會做「沉睡顧客提醒」、「回頭率分析」等深度洞察。

## MVP 範圍（第一版）

- [x] 工作者子網域個人介紹頁（middleware rewrite 架構）
- [x] AI 自動生成個人介紹文案
- [x] 顧客 AI 對話預約（`jessica.yourdomain.com/booking`）
- [x] 併發防護（DB unique constraint）
- [x] 留下姓名＋電話
- [x] 工作者 LINE 登入（手動 OAuth 流程）
- [x] 後台預約日曆顯示（含狀態標記：完成／取消／no_show）
- [x] 人工收款（LINE Pay 轉帳）
- [x] `/privacy` 隱私權政策頁面
- [x] `/terms` 服務條款頁面
- [x] 預約確認頁顯示完整資訊（「預約申請已送出」、提醒文字、聯絡電話、截圖提示）
- [x] 顧客電話查詢預約功能

### 顧客查詢預約流程

**確認頁（預約申請送出後）**
顯示標題「預約申請已送出」、工作者名稱與預約日期時間、自訂或預設提醒文字（`booking_confirmation_message`）、工作者聯絡電話，並提示「請截圖保存此頁面作為預約憑證」。

**電話查詢（booking 頁）**
`[slug].yourdomain.com/booking` 頁面加入「查詢我的預約」入口，顧客輸入電話號碼後顯示：
- 該電話在此工作者的所有未來 `confirmed` 預約（`appointment_date >= today`）
- 每筆顯示：日期、時間
- 若需取消：顯示工作者聯絡電話，請顧客直接聯繫

**新增 API**
```
GET /api/appointments/lookup?phone=xxx&workerId=xxx
```
- 只回傳未來預約，不回傳歷史紀錄
- 不需登入，公開端點
- Rate limit：10 次／小時（依 IP），防止電話號碼掃描

## 解鎖功能（推薦機制觸發，不在 MVP 範圍）

| 推薦人數 | 功能 | 額外注意 |
|---------|------|---------|
| 5 人 | 黑名單機制 | UI 需說明「換號可繞過」，定位為降低騷擾 |
| 10 人 | 參考圖上傳（限一張） | Storage 私有 bucket，signed URL，限 jpg／png／5MB |
| 15 人 | 簡訊確認通知（Every8d） | 顧客需勾選同意接收簡訊 |

---

## 營運必備頁面

上線前需備妥以下頁面，建議由平台法律顧問或參考範本撰寫：

| 頁面 | 路徑 | 必要內容 |
|------|------|---------|
| 隱私權政策 | `/privacy` | 收集資料範圍（姓名、電話、參考圖）、用途、保存期限（預約完成後 180 天）、刪除方式 |
| 服務條款 | `/terms` | 服務說明、月費與退款政策、帳號終止條件、免責聲明 |
| 客服聯絡 | 頁面 footer | email 或 LINE 官方帳號（平台客服用，非工作者帳號） |

**資料刪除流程：**
- 對外說法：顧客或工作者可來信要求刪除個人資料，7 個工作天內完成
- 後台操作：Supabase Dashboard 直接刪除對應 `appointments` 紀錄，或將 `customer_phone` 匿名化為 `DELETED`

## 後續金流串接（人工收款穩定後）

- 綠界（ECPay）：台灣最常見，支援信用卡＋ATM，串接文件完整
- `subscription_status` 欄位已預留，串接後由人工維護改為自動更新

