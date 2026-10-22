---
slug: armin-ronacher-agentic-coding-recommendations
title: Armin Ronacher 的 agentic coding 建議
date: 2025-06-12
created_at: 2026-10-22T08:00:00Z
status: draft
person: armin-ronacher
source_id: blog
source_url: https://lucumr.pocoo.org/2025/6/12/agentic-coding/
source_title: Agentic Coding Recommendations
category: agents
tags:
  - claude-code
  - tooling
starred: false
summary: Flask 作者分享用 Claude Code 開發的心得：給 agent 足夠權限、工具要快且錯誤訊息清楚、偏好簡單穩定的技術選擇。
---

Armin Ronacher 主要使用 Claude Code，把任務交給權限較寬的 agent 完成，很少中途介入。他關閉權限確認，並建議搭配 Docker 降低風險。

他很少使用 MCP：agent 通常能直接執行一般的命令列工具，只有在這些工具不夠可靠時才需要 MCP。

新的後端專案他推薦 Go：明確傳遞 context、增量測試快、介面是結構式的，生態系也穩定；相較之下，Python 對 agent 來說較慢、也較容易出錯。

工具設計上，任何 agent 能觀察或操作的東西都可以是工具。好工具要快、錯誤訊息清楚、不容易被誤用，並且方便除錯；把 log 寫進檔案，能讓 agent 自己診斷問題。

他也提醒：agent 讓升級變得很便宜，反而容易讓人草率更新依賴，應該保守一點。他偏好產生出來的程式碼勝過額外依賴、簡單函式勝過類別、直接寫 SQL 勝過 ORM。專案變大後，agent 會在龐雜的程式碼中迷失，要在適當時機重構。

## 編者觀點

<!-- 站長撰寫 -->
