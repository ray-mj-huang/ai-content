# 001. Repo 骨架與內容資料模型

- 狀態：完成
- 依賴：無
- 相關 ADR：0001、0003、0004、0005、0009

## 意圖

建立 monorepo 骨架與 `packages/content-schema`，讓「什麼是一份合法的內容檔」有唯一、可執行的定義，並讓 `npm run verify` 從第一天就能運作。之後的生產線與網站都建立在這份契約上。

## 範圍內

1. 依 ADR-0003 建立目錄結構、npm workspaces、TypeScript、ESLint、Prettier、Vitest 的基本設定。
2. `packages/content-schema`：
   - 以 zod 定義 `Person`、`Source`、`Post` 的 frontmatter schema（欄位見下方）。
   - 匯出型別（`z.infer`）供其他 package 使用。
   - 提供 `loadContent(dir)`：讀取 `content/` 下所有 Markdown，解析 frontmatter 與正文，回傳型別化資料，或回傳帶檔案路徑與欄位的錯誤清單。
   - 提供 CLI `content-check`：執行 ADR-0009「content」層的所有檢查，輸出人類可讀的錯誤（檔案路徑＋欄位＋原因），有錯誤時結束碼非零。
3. 根目錄 `package.json` 提供 `verify`、`verify:static`、`verify:content`、`verify:unit`；`verify:build`、`verify:site` 先放空實作並印出「尚未實作」，但結束碼為 0。
4. `content/` 放入範例資料：2 個人物檔、3 篇文章（至少包含 draft、published、rejected 各一）。
5. GitHub Actions workflow：每個 PR 執行 `npm run verify`。
6. `AGENTS.md`：說明 repo 結構、如何跑驗證、開始任務前必讀 `docs/adr/README.md` 與對應 intent。保持精簡，細節指向 docs。

## 資料模型

### Person（`content/people/<slug>.md`）

| 欄位 | 型別 | 必填 | 說明 |
|---|---|---|---|
| `slug` | string | 是 | 小寫英數與連字號，需與檔名一致 |
| `name` | string | 是 | 顯示名稱 |
| `name_zh` | string | 否 | 中文譯名 |
| `bio` | string | 是 | 一兩句簡介（正體中文） |
| `links` | `{ label, url }[]` | 否 | 個人網站、社群等 |
| `sources` | Source[] | 是 | 至少 1 個 |
| `tags` | string[] | 否 | |
| `active` | boolean | 是 | `false` 時生產線不抓取 |

正文：可選，較長的人物介紹。

### Source（內嵌於 Person.sources）

| 欄位 | 型別 | 必填 | 說明 |
|---|---|---|---|
| `id` | string | 是 | 在該人物內唯一 |
| `type` | `"rss" \| "podcast" \| "youtube" \| "web"` | 是 | MVP 生產線只處理 `rss` |
| `url` | URL | 是 | feed 或頻道網址 |
| `label` | string | 否 | 例如「個人部落格」 |

### Post（`content/posts/<YYYY>/<slug>.md`）

| 欄位 | 型別 | 必填 | 說明 |
|---|---|---|---|
| `slug` | string | 是 | 全站唯一，需與檔名一致 |
| `title` | string | 是 | 本站的中文標題 |
| `date` | ISO date | 是 | 原始內容的發表日期；目錄的年份需與之一致 |
| `created_at` | ISO datetime | 是 | 生產線產出時間 |
| `status` | `"draft" \| "published" \| "rejected"` | 是 | |
| `person` | string | 是 | 對應 Person.slug |
| `source_id` | string | 是 | 對應該人物的 Source.id |
| `source_url` | URL | 是 | 原始內容網址，全站唯一 |
| `source_title` | string | 是 | 原始標題 |
| `category` | enum | 是 | 初始值：`tools`、`practice`、`agents`、`industry`、`opinion`；放在 schema 常數中統一管理 |
| `tags` | string[] | 否 | 小寫、連字號 |
| `starred` | boolean | 是 | 預設 `false` |
| `summary` | string | 是 | 120 字以內的中文摘要，用於列表與 meta description |

正文結構：

```markdown
（AI 整理的重點，正體中文）

## 編者觀點

（站長撰寫）
```

### 檢查規則（`content-check`）

1. 所有 frontmatter 通過 schema。
2. 檔名與 `slug` 一致；文章所在年份目錄與 `date` 年份一致。
3. `slug`、`source_url` 全站唯一。
4. `person` 存在，且 `source_id` 存在於該人物的 `sources`。
5. `status: published` 的文章，「## 編者觀點」段落存在且非空白。
6. 正文中「編者觀點」以外的部分不超過 1,200 個中文字（以字元計，英文單字算 1 字）。
7. `summary` 不超過 120 字。

## 範圍外

- 生產線的任何抓取或 LLM 程式碼（intent 002）。
- 網站程式碼（intent 003）。
- 重疊檢查、語言檢查（屬於生產線，intent 002）。

## 不變條件

- `content-schema` 不依賴任何其他 workspace package。
- `content-schema` 的檢查是純函式加上檔案讀取，不連網。
- 錯誤訊息必須包含檔案路徑，讓人類或 agent 能直接定位。

## 驗收條件

| # | 條件 | 對應檢查 |
|---|---|---|
| 1 | 全新 clone 後 `npm install && npm run verify` 通過 | CI workflow |
| 2 | 每一條「檢查規則」都有至少一個會失敗的 fixture，且測試確認錯誤訊息包含檔案路徑與規則名稱 | `verify:unit`（content-schema 測試） |
| 3 | 範例 `content/` 通過 `content-check` | `verify:content` |
| 4 | 故意把一篇 published 文章的編者觀點清空，`npm run verify` 失敗 | `content-schema` 的整合測試（複製範例到暫存目錄後修改） |
| 5 | `Person`、`Post` 型別可被其他 package import | 型別測試或 `verify:static` |
| 6 | PR 上 CI 會執行 `npm run verify` | workflow 檔存在，且在 PR 觸發 |

## 需要停下來問的情況

- 認為需要新增、刪除或改名資料模型欄位。
- 分類清單需要調整。
- 想引入 zod、gray-matter（或同類 frontmatter 解析器）、Vitest 以外的主要依賴。

## 交付時要提供

- 驗收條件對照表與對應的檢查名稱。
- `npm run verify` 的輸出摘要。
- 後續建議（若有）。
