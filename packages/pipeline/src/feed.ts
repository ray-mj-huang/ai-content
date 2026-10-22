import { parseFeed } from '@rowanmanning/feed-parser';

export interface FeedEntry {
  url: string;
  title: string;
  published: Date;
  /** feed 內附的 HTML 內容（可能只是摘要）；沒有時為 `null`。 */
  contentHtml: string | null;
}

export interface ParsedFeed {
  entries: FeedEntry[];
  /** 缺少網址、標題或發表日期而無法處理的項目數。 */
  incomplete: number;
}

/** 解析 RSS 或 Atom。 */
export function readFeed(xml: string): ParsedFeed {
  const feed = parseFeed(xml);
  const entries: FeedEntry[] = [];
  let incomplete = 0;

  for (const item of feed.items) {
    const published = item.published ?? item.updated;
    if (!item.url || !item.title || !published) {
      incomplete++;
      continue;
    }
    entries.push({
      url: item.url,
      title: item.title.trim(),
      published,
      contentHtml: item.content ?? item.description,
    });
  }
  return { entries, incomplete };
}

/** 只保留 `now` 往前 `days` 天內發表的項目。 */
export function recentEntries(entries: FeedEntry[], now: Date, days: number): FeedEntry[] {
  const since = now.getTime() - days * 24 * 60 * 60 * 1000;
  return entries.filter((entry) => entry.published.getTime() >= since);
}
