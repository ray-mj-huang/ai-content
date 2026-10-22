# 003. 前端網站 MVP

- 狀態：**阻塞**，等 ADR-0007 的框架拍板後才可執行
- 依賴：001
- 相關 ADR：0002、0004、0005、0007、0008、0009

## 意圖

把 `content/` 裡已發布的文章變成一個公開、可被搜尋引擎收錄的網站：訪客可以依分類、標籤、人物、精選篩選文章，也可以搜尋，每篇文章清楚呈現摘要、編者觀點與原始來源。

## 範圍內

### 頁面

| 路徑 | 內容 |
|---|---|
| `/` | 精選文章區塊＋最新文章列表（可篩選） |
| `/posts/<slug>` | 文章頁：標題、日期、人物、分類、標籤、重點摘要、編者觀點、原始來源卡片 |
| `/people` | 人物列表 |
| `/people/<slug>` | 人物頁：簡介、連結、該人物的文章 |
| `/categories/<category>` | 分類頁 |
| `/tags/<tag>` | 標籤頁 |
| `/search` | 搜尋頁 |
| `/about` | 關於本站與內容政策（說明摘要＋觀點＋原始連結的做法） |
| `/rss.xml`、`/sitemap.xml`、`/robots.txt` | |

### 功能

1. 全站靜態生成，只包含 `status: published` 的文章。
2. 篩選：分類、標籤（多選）、人物、只看精選；狀態放 Redux Toolkit，並與 URL query string 雙向同步（ADR-0008）。
3. 搜尋：建置時產生索引，支援中文查詢（ADR-0008）。
4. SEO：ADR-0007 列出的所有項目。
5. 響應式版面（手機寬度 360px 起），MUI 主題集中定義，支援深色模式。
6. 實作 ADR-0009 的 `verify:build` 與 `verify:site`。

## 範圍外

- 訪客帳號、收藏、留言（ADR-0002）。
- 後台編輯介面（ADR-0004）。
- 電子報訂閱、贊助按鈕。
- 視覺設計的精修（先求結構正確、可讀、一致）。

## 不變條件

- 網站只透過 `content-schema` 的 `loadContent` 讀取內容，不自己解析 Markdown frontmatter。
- `draft` 與 `rejected` 文章不得出現在任何建置產物中（HTML、索引 JSON、搜尋索引、sitemap、RSS）。
- 每個可索引的頁面都有預先渲染的 HTML 內容，不依賴 JavaScript 才出現主要內容。
- 原始來源連結在每篇文章頁都清楚可見。

## 驗收條件

| # | 條件 | 對應檢查 |
|---|---|---|
| 1 | 用範例 `content/` 建置成功，建置過程無警告 | `verify:build` |
| 2 | 建置產物中搜尋不到任何 draft／rejected 文章的 slug 或標題 | `verify:site`（產物掃描腳本） |
| 3 | 每個 HTML 有唯一 `<title>`、meta description、canonical | `verify:site`（SEO 腳本） |
| 4 | 文章頁有合法的 `Article` JSON-LD，人物頁有 `Person` JSON-LD | `verify:site`（SEO 腳本） |
| 5 | `sitemap.xml` 包含所有已發布頁面且無多餘項目 | `verify:site` |
| 6 | 站內連結沒有 404 | `verify:site`（連結檢查） |
| 7 | 在首頁選「分類＋標籤＋精選」後，URL 更新、列表正確；重新整理後狀態保留 | Playwright |
| 8 | 搜尋範例文章中的一個中文詞，能找到該文章 | Playwright |
| 9 | 主要頁面載入時 console 無錯誤（含 hydration 錯誤） | Playwright |
| 10 | 停用 JavaScript 時，文章頁與列表頁仍顯示主要內容 | Playwright（`javaScriptEnabled: false`） |
| 11 | 篩選的 reducer／selector 與 URL 序列化有單元測試 | `verify:unit` |

## 需要停下來問的情況

- ADR-0007 仍是「提議中」：**不要開始**。
- 搜尋工具（Pagefind／FlexSearch）對中文的效果不理想，需要換方案。
- 頁面結構或路由需要偏離上表。
- 需要引入框架、MUI、Redux Toolkit、搜尋工具、測試工具以外的主要依賴。

## 交付時要提供

- 驗收條件對照表與對應的檢查名稱。
- `npm verify` 輸出摘要。
- 首頁、文章頁、人物頁在手機與桌機寬度的截圖。
- 後續建議。
