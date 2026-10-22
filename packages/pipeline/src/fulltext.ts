import { extractFromHtml } from '@extractus/article-extractor';
import { countChars } from '@ai-content/content-schema';
import type { FetchText } from './fetch.ts';
import type { FeedEntry } from './feed.ts';
import { htmlToText } from './html.ts';

/** 原文至少要有這麼多字（以 `countChars` 計，英文約等於單字數）才足以摘要。 */
export const MIN_SOURCE_CHARS = 100;

/**
 * 取得原文純文字：feed 內附全文就直接用，否則抓網頁抽取主要內容。
 * 原文只留在記憶體中，不寫入任何檔案（ADR-0004）。
 */
export async function getFullText(entry: FeedEntry, fetchText: FetchText): Promise<string> {
  if (entry.contentHtml) {
    const text = htmlToText(entry.contentHtml);
    if (countChars(text) >= MIN_SOURCE_CHARS) return text;
  }

  const html = await fetchText(entry.url);
  const article = await extractFromHtml(html, entry.url);
  const text = article?.content ? htmlToText(article.content) : '';
  if (countChars(text) < MIN_SOURCE_CHARS) {
    throw new Error(
      `無法取得足夠的原文內容（feed 只有摘要，網頁抽取後少於 ${MIN_SOURCE_CHARS} 字）`,
    );
  }
  return text;
}
