# 0007. 前端技術棧：React、Redux Toolkit、MUI、靜態生成

- 狀態：**提議中**（框架尚未拍板，agent 不得開始 `apps/web` 的實作）
- 日期：2026-10-22

## 背景

站長指定的技術棧：React、Redux、MUI，並要處理 SSR／SEO。內容存在 Markdown（ADR-0004），只在 merge 時更新，非常適合**靜態生成（SSG）**：建置時把每頁預先輸出成 HTML。

## 已確定的部分

- UI：React＋MUI。
- 狀態管理：Redux Toolkit，負責前端互動狀態（篩選條件、搜尋、排序），並與 URL query string 同步，讓篩選結果可分享、可被搜尋引擎收錄。
- 渲染策略：全站 SSG。每篇文章、人物、分類、標籤都有獨立網址並預先產生 HTML。
- SEO：每頁有 `<title>`、meta description、canonical、Open Graph；文章頁輸出 JSON-LD（`Article`），人物頁輸出 JSON-LD（`Person`）；產生 `sitemap.xml`、`robots.txt` 與 RSS。
- 部署：靜態主機（Cloudflare Pages、Netlify 或 Vercel 擇一）。

## 待決定：框架

| 選項 | 優點 | 缺點 |
|---|---|---|
| **Next.js（static export）** | 生態最大，MUI 有官方整合，SSG／metadata API 完整 | 框架抽象多，SSR 原理被藏起來 |
| **React Router v7 框架模式（prerender）** | 輕量、貼近 Web 標準，支援預先渲染 | MUI 整合範例較少 |
| **Vite＋自建 SSG** | 最能理解 SSR／SSG 原理 | 要自己處理路由預渲染、CSS 抽取、hydration 等細節 |

建議：若以「盡快上線」為優先選 Next.js；若以「學習 SSR 原理」為優先選 Vite 自建。

## 後果（待框架決定後補完）

- 任何框架都必須滿足 ADR-0009 中前端的驗證項目（SEO 檢查、無 hydration 錯誤）。
