/** 文章分類。調整清單需要站長同意（intent 001）。 */
export const CATEGORIES = ['tools', 'practice', 'agents', 'industry', 'opinion'] as const;

export const POST_STATUSES = ['draft', 'published', 'rejected'] as const;

/** MVP 生產線只處理 `rss`，其他類型可宣告但會被跳過（ADR-0006）。 */
export const SOURCE_TYPES = ['rss', 'podcast', 'youtube', 'web'] as const;

/** 正文（不含編者觀點）上限，以 `countChars` 計算（ADR-0005）。 */
export const BODY_MAX_CHARS = 1200;

/** `summary` 上限，以 `countChars` 計算。 */
export const SUMMARY_MAX_CHARS = 120;

/** 編者觀點段落的標題文字。 */
export const EDITOR_NOTE_HEADING = '編者觀點';
