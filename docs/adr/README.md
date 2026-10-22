# Architecture Decision Records

本資料夾記錄專案的架構決策。每份 ADR 一旦標為「已採納」就不再修改內容；要推翻時，新增一份 ADR 並把舊的標為「已被取代」。

| 編號 | 標題 | 狀態 |
|---|---|---|
| [0001](0001-record-architecture-decisions.md) | 使用 ADR 記錄架構決策 | 已採納 |
| [0002](0002-product-scope.md) | 產品定位：公開的 AI Coding 單一主題內容站 | 已採納 |
| [0003](0003-monorepo.md) | 採用 monorepo 結構 | 已採納 |
| [0004](0004-markdown-git-content-store.md) | 以 Markdown＋Git 作為內容儲存，PR 作為審稿關卡 | 已採納 |
| [0005](0005-content-policy.md) | 內容政策：摘要＋編者觀點＋原始連結 | 已採納 |
| [0006](0006-pipeline-runtime.md) | 生產線以 GitHub Actions 排程執行，MVP 只抓 RSS | 已採納 |
| [0007](0007-frontend-stack.md) | 前端技術棧：React、Redux Toolkit、MUI、靜態生成 | 提議中 |
| [0008](0008-client-side-search-filter.md) | 篩選與搜尋在前端執行，建置時產生索引 | 已採納 |
| [0009](0009-verification-strategy.md) | 驗證策略：單一 verify 指令與分層檢查 | 已採納 |

## 狀態定義

- **提議中**：尚未決定，agent 不得依此實作，需先由人類拍板。
- **已採納**：生效中，agent 必須遵守。
- **已被取代**：由後續 ADR 取代，保留作為歷史。

## 範本

```markdown
# NNNN. 標題

- 狀態：提議中 / 已採納 / 已被取代（由 NNNN 取代）
- 日期：YYYY-MM-DD

## 背景
## 決策
## 後果
## 考慮過的替代方案
```
