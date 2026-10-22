# 0003. 採用 monorepo 結構

- 狀態：已採納
- 日期：2026-10-22

## 背景

系統分成兩大塊：**內容生產線**與**前端網站**，兩者透過「內容資料」溝通，不直接互相呼叫。需要決定程式碼與內容放在一個還是多個 repo。

## 決策

使用單一 repo，以 npm workspaces 管理，語言統一為 TypeScript：

```
ai-content/
├── apps/
│   └── web/                  # 前端網站（ADR-0007）
├── packages/
│   ├── content-schema/       # 內容資料模型與驗證（zod），兩塊共用
│   └── pipeline/             # 內容生產線（ADR-0006）
├── content/
│   ├── people/               # 人物檔，一人一檔：<person-slug>.md
│   └── posts/                # 文章：<YYYY>/<post-slug>.md
├── docs/
│   ├── adr/
│   └── intents/
├── .github/workflows/
├── AGENTS.md                 # agent 在本 repo 的工作方式，指向 docs/
└── package.json
```

- `packages/content-schema` 是兩塊之間的**唯一契約**：生產線寫出的檔案、網站讀入的檔案，都必須通過同一套 schema。
- `apps/web` 不得 import `packages/pipeline`，反之亦然。兩者只能共同依賴 `content-schema`。

## 後果

- 一個 PR 就能同時看到 schema 變更、生產線與網站的配合修改。
- 生產線開 PR 到同一個 repo，權限設定簡單。
- 內容與程式碼共用 Git 歷史，repo 會隨文章數量變大；文章量到數千篇前不構成問題。

## 考慮過的替代方案

- **生產線與網站分開兩個 repo**：職責較清楚，但要處理跨 repo 的權限與 schema 同步。未採用，日後若需要可再拆。
