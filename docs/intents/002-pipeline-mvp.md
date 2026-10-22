# 002. 內容生產線 MVP（RSS）

- 狀態：可執行（intent 001 完成後）
- 依賴：001
- 相關 ADR：0004、0005、0006、0009

## 意圖

讓站長只要在 `content/people/` 新增一個帶 RSS 來源的人物，隔天就會收到一個 PR，裡面是這個人新文章的中文草稿，每一篇都已經通過 schema 與品質檢查，站長只需要審稿、寫觀點、merge。

## 範圍內

1. `packages/pipeline` CLI，指令：
   - `pipeline run [--person <slug>] [--limit N] [--dry-run]`：執行一次完整流程，`--dry-run` 只印出會產出什麼、不寫檔不呼叫 LLM。
   - 預設 `--limit 10`。
2. 流程（每個步驟一個模組，可單獨測試）：
   1. **讀名單**：透過 `content-schema` 的 `loadContent` 讀人物，只取 `active: true` 的 `rss` 來源。
   2. **抓取**：讀 RSS，取最近 N 天（預設 14 天）的項目。
   3. **去重**：`source_url` 已存在於任何文章（含 draft、rejected）者跳過。
   4. **取得全文**：RSS 有全文就用；沒有則抓網頁並抽取主要內容。原文只存在記憶體或 `.cache/`。
   5. **LLM 加工**：呼叫 Claude API，要求輸出結構化 JSON（`title`、`summary`、`body`、`category`、`tags`）。prompt 放在 `packages/pipeline/prompts/`。
   6. **品質檢查**（ADR-0009 第 3 節）：重疊檢查、語言檢查（含簡體字偵測）、結構檢查、schema 驗證。
   7. **寫檔**：通過者寫入 `content/posts/<YYYY>/<slug>.md`，`status: draft`、`starred: false`，正文末附空的「## 編者觀點」段落。
   8. **報告**：輸出一份執行報告（Markdown），列出新增、跳過、失敗（含原因）的項目。
3. GitHub Actions workflow：每日排程執行 `pipeline run`；有新檔案時開 PR，PR 描述放入執行報告；沒有新檔案時不開 PR。
4. `npm eval:pipeline`：對 `packages/pipeline/eval/samples/` 中的少量網址實際呼叫 LLM，輸出報告到 `.cache/eval/`，不寫入 `content/`。

## 範圍外

- `podcast`、`youtube`、`web` 類型的來源（schema 已允許，生產線遇到時記錄「不支援」並跳過）。
- 自動寫編者觀點、自動發布。
- 修改 `content-schema`（若需要，停下來問）。
- 網站相關程式碼。

## 不變條件

- 生產線**永遠不會**把文章寫成 `published`，也不會修改已存在的文章檔。
- 原文與逐字稿不會出現在任何被 commit 的檔案中（`.cache/` 已列入 `.gitignore`）。
- API 金鑰只從環境變數讀取，不會出現在 log、報告或檔案中。
- 單一項目失敗不中斷整批。
- 重跑同一批來源不會產生重複文章。
- `verify` 中的測試不連網、不呼叫真實 LLM。

## 驗收條件

| # | 條件 | 對應檢查 |
|---|---|---|
| 1 | 用錄好的 RSS fixture 與假 LLM client，`run` 產出的檔案全部通過 `content-check` | `verify:unit`（pipeline 整合測試） |
| 2 | 連續執行兩次，第二次不產生新檔案 | 同上，冪等性測試 |
| 3 | 已有 `rejected` 文章的 `source_url` 不會再被產出 | 去重單元測試 |
| 4 | 假 LLM 回傳與原文高度重疊的摘要時，該項目被拒絕並出現在報告的失敗清單 | 重疊檢查單元測試 |
| 5 | 假 LLM 回傳含簡體字的內容時被拒絕 | 語言檢查單元測試 |
| 6 | 假 LLM 回傳不合法 JSON 或缺欄位時，該項目失敗、其他項目照常產出 | 錯誤處理測試 |
| 7 | `--limit 3` 時最多產出 3 篇 | 單元測試 |
| 8 | `--dry-run` 不寫檔、不呼叫 LLM client | 單元測試（spy 確認未呼叫） |
| 9 | 遇到非 `rss` 來源時跳過並記錄 | 單元測試 |
| 10 | 所有寫入的檔案中搜尋不到測試用的假 API 金鑰字串 | 單元測試 |
| 11 | 排程 workflow 存在，使用 secrets 傳入金鑰，只在有新檔時開 PR | workflow 檔審查（人類確認） |

## 需要停下來問的情況

- 重疊檢查的門檻、n-gram 長度在真實樣本上明顯不合理。
- 某個 RSS 只提供摘要、抓網頁又被擋，無法取得足夠內容。
- 需要修改 `content-schema`。
- 需要引入 Claude SDK、RSS 解析器、HTML 正文抽取器以外的主要依賴。
- prompt 的設計方向（語氣、長度、結構）有多種合理選擇時，提出 2 至 3 個版本請站長選。

## 交付時要提供

- 驗收條件對照表與對應的檢查名稱。
- `npm verify` 輸出摘要。
- 一次 `eval:pipeline` 的報告，供站長檢視 prompt 品質。
- 後續建議（例如下一個要支援的來源類型）。
