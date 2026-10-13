# 匿名聊天室

一個不用登入的匿名聊天室：前端放在 GitHub Pages，即時傳訊用 Supabase。

## 規則

- 開始任何工作前，先讀 `docs/architecture.md`（需求在 `docs/requirements.md`）。
- 目前在**階段一**：只做前端，搭配模擬版聊天服務，**還不接 Supabase**。
- 不可以把金鑰檔案 commit 進 git（`.env`、`.env.local` 等）。只有 `.env.example`（只有變數名稱、沒有真實值）可以進 git。管理金鑰（service_role / secret key）與資料庫密碼絕對不放進專案任何檔案。
