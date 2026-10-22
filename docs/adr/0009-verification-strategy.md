# 0009. 驗證策略：單一 verify 指令與分層檢查

- 狀態：已採納
- 日期：2026-10-22

## 背景

本專案由 agent 實作，agent 需要一個**不依賴人類判斷**的方式確認自己做對了。驗證要能在本機、在 Claude Code 的迴圈中、在 CI 裡執行同樣的檢查，結果一致。

## 決策

### 1. 單一入口

根目錄提供 `npm verify`，依序執行所有檢查，任一失敗即回傳非零結束碼。Agent 完成任何任務前必須跑過並通過。CI 在每個 PR 上執行同一指令。

```
npm verify
 ├─ verify:static    型別檢查、lint、格式
 ├─ verify:content   內容 schema 與引用完整性
 ├─ verify:unit      各 package 的單元測試
 ├─ verify:build     建置網站
 └─ verify:site      對建置產物做 SEO 與端對端檢查
```

各層也能單獨執行（例如 `npm verify:content`），讓 agent 在迭代時只跑相關的那層。

### 2. 各層內容

**static**：`tsc --noEmit`、ESLint、Prettier 檢查。

**content**（`packages/content-schema` 提供 CLI）：
- 每個 Markdown 檔的 frontmatter 通過 zod schema。
- 文章的 `person` 必須對應到存在的人物檔。
- slug 全站唯一；`source_url` 全站唯一。
- `status: published` 的文章必須有非空的「編者觀點」段落（ADR-0005）。
- 正文長度不超過上限（ADR-0005）。

**unit**：
- `content-schema`：合法與不合法的 fixture 各一組，確保 schema 該擋的有擋。
- `pipeline`：抓取、解析、去重、寫檔各自測試。**單元測試不得連網、不得呼叫真實 LLM**；RSS 用錄好的 fixture，LLM 用假的 client 回傳固定輸出。
- `web`：篩選邏輯（Redux reducer／selector）、URL 同步、元件行為（Vitest＋React Testing Library）。

**build**：網站必須能成功建置；建置中出現的警告視為錯誤（可設白名單）。

**site**（對建置產物執行）：
- SEO 檢查腳本：每個 HTML 都有唯一 `<title>`、meta description、canonical；文章頁有合法 JSON-LD；`sitemap.xml` 涵蓋所有已發布頁面；沒有 draft 文章出現在產物中。
- 連結檢查：站內連結沒有 404。
- Playwright 端對端：首頁可載入、篩選後 URL 更新且結果正確、搜尋能找到已知文章、主要頁面瀏覽器 console 沒有錯誤（包括 hydration 錯誤）。

### 3. AI 產出的品質檢查（生產線專用）

LLM 的輸出是不確定的，因此除了 schema 外，生產線在寫檔前還要執行**確定性的檢查**，不通過的項目不寫入、記錄在 PR 描述：

- **重疊檢查**：計算摘要與原文的字元 n-gram（例如 8-gram）重疊比例，超過門檻（初始值 15%，可調）即拒絕。這是 ADR-0005 的機械化守門。
- **語言檢查**：正文以中文為主，且不含簡體字（以簡繁對照表偵測）。
- **結構檢查**：必有原始連結、作者、標題；引述次數與長度符合 ADR-0005。

另設一組**不在 `npm verify` 內**的 `npm eval:pipeline`：以少量真實樣本實際呼叫 LLM，產出報告供站長人工檢視 prompt 品質。因為會花錢、結果不確定，只在調整 prompt 時手動執行。

### 4. 與 Claude Code 的整合

- `AGENTS.md` 寫明：完成任務的定義是 `npm verify` 通過，且滿足該 intent contract 的驗收條件。
- 可在 Claude Code 設定 hook，於 agent 結束任務前自動執行 `npm verify`，失敗時把錯誤回饋給 agent 繼續修正。

## 後果

- Agent 有清楚的「完成」定義，可以自行跑「實作 → 驗證 → 修正」的迴圈。
- 驗證本身也是程式碼，需要維護；新增功能時要一併新增對應的檢查。
- 「內容好不好看、觀點有沒有價值」仍需人類判斷，這由 PR 審稿處理（ADR-0004）。

## 考慮過的替代方案

- **只靠單元測試**：抓不到內容資料錯誤與 SEO 問題。未採用。
- **用 LLM 評審 LLM 輸出作為 CI 關卡**：結果不穩定、會花錢。只放在手動的 `eval:pipeline`。
