---
slug: simon-willison-lethal-trifecta
title: AI agent 的致命三要素
date: 2025-06-16
created_at: 2026-10-22T08:00:00Z
status: rejected
person: simon-willison
source_id: blog
source_url: https://simonwillison.net/2025/Jun/16/the-lethal-trifecta/
source_title: 'The lethal trifecta for AI agents: private data, untrusted content, and external communication'
category: agents
tags:
  - security
  - prompt-injection
starred: false
summary: 同時具備私人資料存取、接觸不受信任內容、對外傳輸能力的 agent，可能被攻擊者誘導外洩資料。
---

Simon Willison 指出，當 agent 同時能存取私人資料、會讀到不受信任的內容、又能對外傳送資訊時，攻擊者就能透過埋在網頁或文件中的指令，誘使 agent 把資料送出去。LLM 無法可靠分辨哪些指令來自使用者。最實際的防護是避免讓三種能力同時出現。

## 編者觀點
