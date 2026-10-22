# AGENTS.md

在這個 repo 工作的方式。設計決策與任務規格在 `docs/`，這裡只放操作說明。

## 開始任務前

1. 讀 `docs/adr/README.md`，以及任務引用的每一份 ADR。
2. 讀對應的 intent contract（`docs/intents/`），只做「範圍內」的事。
3. 遇到 intent 列出的「需要停下來問」情況，或 intent 與 ADR 互相矛盾，停下來問人類。
4. 不得修改已採納的 ADR，也不得把「提議中」改成「已採納」。

## 環境

- Node 24（見 `.nvmrc`；用 `nvm use` 切換）。TypeScript 由 Node 直接執行（type stripping），不需要建置步驟。
- 因此只能使用可被抹除的 TS 語法（不用 `enum`、namespace、constructor 參數屬性），相對 import 要寫 `.ts` 副檔名。

## 結構

| 路徑                         | 內容                                                      |
| ---------------------------- | --------------------------------------------------------- |
| `packages/content-schema/`   | 內容資料模型（zod）、`loadContent()`、`content-check` CLI |
| `packages/pipeline/`         | 內容生產線（intent 002，尚未建立）                        |
| `apps/web/`                  | 前端網站（intent 003，等 ADR-0007 拍板）                  |
| `content/people/`            | 人物檔 `<slug>.md`                                        |
| `content/posts/<YYYY>/`      | 文章 `<slug>.md`                                          |
| `docs/adr/`、`docs/intents/` | 架構決策與任務規格                                        |

`apps/web` 與 `packages/pipeline` 只能共同依賴 `content-schema`，不得互相 import。

## 驗證

```sh
npm run verify           # 全部檢查；完成任何任務前必須通過
npm run verify:static    # tsc、ESLint、Prettier
npm run verify:content   # content/ 的 schema 與引用檢查
npm run verify:unit      # Vitest
npm run format           # 用 Prettier 自動排版
```

完成的定義：`npm run verify` 通過，且 intent 的每一條驗收條件都對應到一個自動化檢查。
