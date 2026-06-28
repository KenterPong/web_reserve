# Onboarding 引導流程規格書 v2

**更新日：** 2026-06-27
**對照文件：** `README.md`、`to-do-list.md`、`PROGRESS.md`

---

## 一、資料庫異動

### 新增欄位
```sql
ALTER TABLE workers
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT false;
```

> `onboarding_completed = true` 才算完成 onboarding，不以 `slug` 是否有值判斷。

### 寫入時機
- **所有欄位（包含 `slug`）延後到 Step 4 按下「完成設定」後才一次寫入 DB**
- 過程中資料暫存於前端 state，不提前寫入
- 完成後一次寫入：`business_name`、`bio_answers`、`bio`、`slug`、`working_hours`、`onboarding_completed = true`

### Reserved Slug 清單新增
`onboarding` 加入 middleware 的 `RESERVED_PATH_SEGMENTS`，與 `join`、`auth`、`booking` 等並列。

---

## 二、觸發條件與導向邏輯

### 新用戶（首次登入）
LINE 登入 → `/auth/callback` 換票成功 → **`GET /api/workers/me`** 讀取 `onboarding_completed`：
- `false` → redirect `/onboarding`
- `true` → redirect `/dashboard/appointments`

> **注意：** middleware **不查 DB**；登入後首次導向由 **`/auth/callback` 頁**負責（見 `README.md`「auth/callback 分工」）。

### 舊用戶（`onboarding_completed = false`）
- 強制走 onboarding（與 slug 是否為空無關）
- Step 1–2 若 DB 已有資料（`business_name`、`bio_answers`）則預填，允許修改

### 保護規則
- `/onboarding` 需登入（有 `worker_id` cookie）；未登入 → `/api/auth/line-bootstrap`
- `onboarding_completed = false` 時，`/dashboard/*` 全部 redirect `/onboarding`，不可跳過（建議 **`dashboard/layout`** 伺服器端讀 `workers/me`，或由 middleware 轉向 `/onboarding` 再由該頁驗證登入）

---

## 三、流程結構（共四步）

### Step 1：基本資料
**標題：** 先來認識你一下 👋

**欄位：**
- 工作室名稱（`business_name`）— 必填，placeholder：「例如：Jessica 美髮工作室」
- 職業類型（單選）— 必填，存入 `bio_answers.profession`
  - 💇 美髮師
  - 💅 美甲師
  - 👁️ 美睫師
  - 💆 按摩師／整復師
  - 🐾 寵物美容師
  - 其他（補填文字框）

**按鈕：** 下一步

---

### Step 2：AI 生成介紹頁
**標題：** 讓 AI 幫你寫介紹 ✨

**說明文字：** 回答三個問題，Claude 自動幫你產出專業介紹文案

**欄位：**
- 你有幾年經驗？— 必填，placeholder：「例如：8 年」，存入 `bio_answers.experience`
- 你的服務特色是什麼？— 必填，placeholder：「例如：擅長日系染髮、護髮療程」，存入 `bio_answers.features`
- 你的工作地點在哪裡？— 必填，placeholder：「例如：高雄苓雅區」，存入 `bio_answers.location`

**傳給 `POST /api/generate-bio` 的五個欄位：**
| 欄位 | 來源 |
|------|------|
| `name` | Step 1 的 `business_name` |
| `profession` | Step 1 的職業類型（若選「其他」則用補填文字） |
| `experience` | Step 2 的年資 |
| `features` | Step 2 的服務特色 |
| `location` | Step 2 的地點 |

**按鈕：** 幫我生成介紹頁

生成後顯示預覽文案，可手動修改。

> **API 行為：** Onboarding 期間呼叫 `POST /api/generate-bio` 時須帶 `save: false`（或同等參數），**不提前寫入 DB**；bio 與 `bio_answers` 於 Step 4 與其他欄位一次 PATCH。

**失敗處理：** API 錯誤時顯示「生成失敗，請重試」按鈕，同時開放手動填寫 bio 文字框，讓用戶可以略過 AI 直接填寫。

確認後按「下一步」。

---

### Step 3：設定你的專屬連結
**標題：** 設定你的預約連結 🔗

**說明文字：** 這是你的顧客預約頁面網址，設定後可以傳給客人

**欄位：**
- Slug 輸入框（`slug`）— 必填，只能輸入英文小寫和數字，3–30 字元
- 即時預覽：`https://[slug].mybookdate.com/booking`
- 即時驗證（debounce 500ms）：
  - 已被使用 → 紅字「此名稱已被使用」
  - 保留字（join／auth／booking／onboarding 等）→ 紅字「此名稱不可使用」
  - 可用 → 綠字「可以使用！」

> **注意：slug 此步驟只暫存前端 state，不寫入 DB**

**按鈕：** 下一步

---

### Step 4：設定營業時間
**標題：** 你什麼時候上班？🗓️

**說明文字：** 顧客只能預約你的營業時間內的時段

**介面：**
- 每天一列（週一到週日）
- 每列有開關（預設週一到週六開、週日關）
- 開啟時顯示開始時間／結束時間選擇器
- 預設時間以 `supabase/schema.sql` 為準：週一至週五 10:00–20:00，週六 10:00–18:00
- 關閉時該列變灰色顯示「休息」

**按鈕：** 完成設定

按下後一次寫入所有資料：
```
business_name, bio_answers, bio, slug, working_hours, onboarding_completed = true
```

---

## 四、完成畫面

**標題：** 🎉 你的預約頁面已上線！

**內容：**
```
你的顧客預約連結：
https://[slug].mybookdate.com/booking
[ 複製連結 ]

把這個連結傳給客人，她們點開就能自己預約！
```

**說明區塊一：**
```
📅 免費試用兩個月
從你註冊當天起算，試用期結束後 NT$199/月
不會自動扣款，後台會在到期前提醒你
試用期結束後有 3 天寬限期，逾期預約頁將暫停服務
```

**說明區塊二：**
```
💳 如何付款？
後台會在試用期結束前提醒你付款方式
付款方式：LINE Pay 轉帳
有任何問題請聯繫：support@mybookdate.com
```

**按鈕：** 進入後台

點擊後導向 `/dashboard/appointments`

---

## 五、互動規則

- **返回：** 每一步都可以返回上一步修改，前端 state 保留
- **進度條：** 頁面頂部顯示四步進度條，讓用戶知道目前在哪一步
- **跳過：** 不允許跳過任何步驟，所有必填欄位都需完成才能進入下一步
- **完成頁複製連結：** 使用現有 `copyTextToClipboard` 後備方案，相容 LINE 內建瀏覽器

---

## 六、不在 onboarding 涵蓋範圍內的設定

以下欄位維持「進後台 `/dashboard/profile` 再設」：
- `slot_duration`（預約時段粒度，DB 預設 60 分鐘）
- `contact_phone`（顧客端顯示電話）
- `booking_confirmation_message`（預約完成提醒文字）

---

## 七、優先順序

Onboarding 優先於首頁截圖區塊，因為它直接影響新用戶能否自己完成設定。
