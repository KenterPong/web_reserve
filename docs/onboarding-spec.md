# onboarding-spec.md（已廢止）

此文件已廢止，請見 **`onboarding-spec-v2.md`**。

v1 與 v2 的主要差異：
- 判斷條件從「slug 為空」改為 `onboarding_completed` 欄位
- 所有資料延後到 Step 4 一次寫入（v1 是每步即時寫入）
- 登入後導向由 `/auth/callback` 讀 `workers/me`，非 middleware 查 DB
- 分享連結統一為 `https://[slug].mybookdate.com/booking`
- 新增 `onboarding` 至 reserved slug 清單
- Onboarding 期間 `generate-bio` 帶 `save: false` 不提前寫 DB
