# 0004. 以 Markdown＋Git 作為內容儲存，PR 作為審稿關卡

- 狀態：已採納
- 日期：2026-10-22

## 背景

站長需要審稿、寫編者觀點、打星號、調整分類。可選做法：Markdown＋Git、Headless CMS、自建資料庫＋後台。

## 決策

- 所有內容（人物、文章）以 **Markdown＋YAML frontmatter** 存在 `content/`。
- 人物的追蹤來源寫在人物檔的 frontmatter 裡，不另設來源檔。
- **生產線不直接寫入 main**：每次執行產出的新草稿，開成一個 Pull Request。
- 站長在 PR 或本機編輯器裡修改草稿，把 `status` 改為 `published` 後 merge。
- merge 到 main 觸發網站建置與部署。
- 只有 `status: published` 的文章會出現在網站上；`draft` 與 `rejected` 的文章不會被建置。

### 文章狀態

| status | 意義 |
|---|---|
| `draft` | 生產線產出、尚未審稿 |
| `published` | 已審稿，公開 |
| `rejected` | 站長決定不刊登；保留檔案避免生產線重複產出同一篇 |

### 原始素材不進 Git

抓回來的原文、逐字稿**不 commit 進 repo**（見 ADR-0005）。生產線只在執行期間使用原文，或放在 `.cache/`（列入 `.gitignore`）。去重靠文章 frontmatter 的 `source_url`。

## 後果

- 不需要後端與資料庫，網站可以純靜態部署。
- 每次內容修改都有 Git 紀錄，可回溯、可 review。
- 編輯體驗取決於站長的 Markdown 編輯器；需要後台 UI 時再另立 ADR。
- 「打星號」等操作就是改 frontmatter，沒有即時的 UI。

## 考慮過的替代方案

- **Headless CMS**：有現成編輯介面，但多一個外部服務與 API 依賴。未採用。
- **自建資料庫＋後台**：最彈性，工作量最大。留到之後。
