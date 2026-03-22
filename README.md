# 雲端筆記 (Cloud Notes)

一個輕量級的線上筆記管理應用，支援使用者登入、筆記的新增/編輯/刪除，以及簡單的使用者列表查看。  
完全使用 Cloudflare Pages + Pages Functions + D1 資料庫實現，無需後端伺服器，部署快速且免費。


- 使用者登入 / 登出（Session 基於 Cookie + D1 資料表）
- 新增、編輯、刪除個人筆記
- 筆記列表顯示（含標題、內容、作者、更新時間）
- 管理員可查看所有使用者列表（/api/users）
- 前後端分離：純靜態 HTML + JavaScript + Cloudflare Pages Functions 作為 API
- CORS 支援、OPTIONS 預檢請求處理
- 簡潔的響應式介面（手機 / 電腦皆可使用）

## 技術棧

- 前端：純 HTML + CSS + Vanilla JavaScript（無框架）
- 後端：Cloudflare Pages Functions（JavaScript）
- 資料庫：Cloudflare D1（SQLite 相容）
- 部署平台：Cloudflare Pages

## 專案結構

├── index.html               # 主頁面（登入畫面 + 筆記管理介面）

├── favicon.ico              # 網站圖示

├── functions/

│   └── api/

│       └── [[path]].js      # 所有 API 路由集中在此（catch-all 路由）

├── wrangler.toml            # D1 綁定設定、本地開發用

└── README.md


- `index.html`：靜態前端頁面，包含登入表單、筆記列表、使用者列表、編輯彈窗
- `functions/api/[[path]].js`：處理所有 `/api/*` 請求（登入、筆記 CRUD、使用者列表等）
- `wrangler.toml`：定義 D1 資料庫綁定（本地開發與部分部署情境使用）

## 資料庫結構（D1）

需手動建立以下表格（可透過 Wrangler 或 Dashboard 執行 SQL）：

```sql
-- Users Table
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Notes Table
CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  content TEXT DEFAULT '',
  user_id INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Sessions Table
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Pre-test admin user
INSERT OR IGNORE INTO users (username, password) VALUES ('admin', 'admin123@');

```


## 部署到 Cloudflare Pages 步驟
### 前置條件

已註冊 Cloudflare 帳號
已建立一個 D1 資料庫（Workers & Pages → D1 → Create database）
準備好 GitHub / GitLab 儲存庫（或直接用 Wrangler 部署）

### 步驟

將專案推送到 GitHub / GitLab
建立一個新的 repository
將本專案所有檔案 commit & push

在 Cloudflare Dashboard 建立 Pages 專案
登入 Cloudflare Dashboard
左側選單 → Workers & Pages → Overview → Create application → Pages → Connect to Git
選擇你的 GitHub / GitLab 帳號並授權
選取剛剛 push 的 repository

設定建置參數
Project name：自訂（例如：cloud-notes）
Production branch：main 或 master
Framework preset：留空（None）
Build command：留空
Build output directory：留空 或填 .（根目錄）
點擊 Save and Deploy

綁定 D1 資料庫（重要！）
部署完成後，進入該 Pages 專案
左側選單 → Settings → Bindings
點擊 Add → 選擇 D1 database bindings
Variable name：填 DB（必須與程式碼一致，大寫）
D1 database：選擇你剛建立的 D1 資料庫
儲存

重新部署（讓 binding 生效）
回到專案首頁 → Deployments → 點擊 Redeploy（或 push 一個空 commit 觸發自動部署）

初始化資料（可選）
透過 Wrangler CLI 連線 D1 插入測試資料

訪問網站
部署完成後，Cloudflare 會給你一個 *.pages.dev 子域名
例如：https://cloud-notes.pages.dev

## 注意事項

目前密碼是明文儲存，僅供學習使用。生產環境請改用 bcrypt 或 argon2 雜湊。
Session 有效期為 7 天（可調整 Max-Age）。
若要支援多使用者權限管理，可擴充 users 表加入 role 欄位。
本專案未實作註冊功能，需手動在 D1 插入使用者。

## 授權
MIT License

