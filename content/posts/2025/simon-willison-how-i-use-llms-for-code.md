---
slug: simon-willison-how-i-use-llms-for-code
title: Simon Willison：我如何用 LLM 幫忙寫程式
date: 2025-03-11
created_at: 2026-10-22T08:00:00Z
status: published
person: simon-willison
source_id: blog
source_url: https://simonwillison.net/2025/Mar/11/using-llms-for-code/
source_title: Here's how I use LLMs to help me write code
category: practice
tags:
  - workflow
  - testing
starred: true
summary: Simon Willison 整理自己用 LLM 寫程式的做法：把模型當成過度自信的結對夥伴，管理好上下文、下精確指令，並且一定要自己測試。
---

用 LLM 寫程式並不直覺，Simon Willison 認為宣稱「很簡單」的人往往低估了學習成本。他整理了自己累積下來的工作方式。

**把模型當成結對程式設計的助手。** 它查資料快、願意做繁瑣的工作，但非常有自信，也會犯錯，例如編造不存在的 API。使用者自己的專業判斷仍然不可或缺。

**留意訓練資料的截止時間。** 模型對穩定、廣為使用的函式庫最熟悉；用到較新的套件時，應該把最新的文件或範例放進提示。

**上下文管理是關鍵。** 開新對話等於清空上下文；先放入既有程式碼或範例，能有效引導輸出方向。

**寫正式程式碼時，像寫規格一樣下指令。** 直接給出函式簽章與需求，再用後續對話要求修改或補測試。

**一定要測試。** 確認程式能動的責任無法外包給模型；能在沙盒中執行程式碼、或自動反覆執行的工具，讓這件事容易很多。

**Vibe coding 適合學習與一次性專案。** 不仔細審查就接受產出，是了解模型能力的好方法，但不適合正式產品。

他認為最大的好處是速度：原本不值得花時間的小專案，現在可以順手做出來。LLM 放大的是既有的專業，而不是取代它。拿它來理解陌生的程式碼庫也很實用，因為答錯了很容易察覺。

## 編者觀點

（範例內容，上線前請由站長改寫。）這篇適合當作入門讀物：它沒有把 LLM 神化，而是把「測試」與「上下文管理」放在核心位置，這兩點也正是本站自己用 coding agent 開發時最常踩到的地方。
