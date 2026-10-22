# 0006. 生產線以 GitHub Actions 排程執行，MVP 只抓 RSS

- 狀態：已採納
- 日期：2026-10-22

## 背景

生產線需要定期依追蹤名單抓取新內容、交給 LLM 加工、產出草稿。不同來源的抓取難度差異很大：

- 容易：部落格／電子報的 RSS
- 中等：Podcast（需轉錄）、YouTube（字幕或轉錄）、一般網頁
- 困難：X、LinkedIn 等社群平台（API 限制與服務條款）

## 決策

- 生產線是 `packages/pipeline` 裡的 Node.js CLI，可在本機手動執行，也由 GitHub Actions 排程執行（每日一次）。
- 流程：讀取 `content/people/` → 對每個來源抓取新項目 → 以 `source_url` 去重 → 取得全文 → 呼叫 LLM 產出摘要與 metadata → 通過 `content-schema` 驗證 → 寫入 `content/posts/` → 開 PR。
- **MVP 只支援 `rss` 來源類型**。其他類型在 schema 中可以宣告，但生產線遇到時跳過並記錄。
- LLM 使用 Claude API，金鑰放在 GitHub Actions secrets，不得寫入任何檔案或 log。
- 每次執行有上限（預設最多處理 10 個新項目），避免意外的 API 費用。
- LLM 的 prompt 放在 `packages/pipeline/prompts/`，以檔案管理、可被 review。
- 生產線必須是**可重跑的（idempotent）**：同一來源項目重跑不會產生重複文章。
- 單一項目失敗不得中斷整批；失敗項目記錄在 PR 描述中。

## 後果

- 不需要自己的伺服器。
- 先用最容易的來源把整條路跑通，之後再逐步加入 Podcast、YouTube。
- 依賴 GitHub Actions 的排程精準度（可能延遲數分鐘到數十分鐘），對本站可接受。

## 考慮過的替代方案

- **自架排程伺服器**：維運成本高。未採用。
- **一次支援所有來源**：範圍過大，延後完成第一條可運作的管線。未採用。
