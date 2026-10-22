import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { EDITOR_NOTE_HEADING, type Post } from '@ai-content/content-schema';

const MAX_TITLE_SLUG_LENGTH = 60;

/** 由英文原始標題產生 slug；標題沒有可用的英數字時改用網址雜湊。 */
export function makeSlug(
  person: string,
  sourceTitle: string,
  sourceUrl: string,
  taken: Set<string>,
): string {
  let titleSlug = sourceTitle
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (titleSlug.length > MAX_TITLE_SLUG_LENGTH) {
    titleSlug = titleSlug.slice(0, MAX_TITLE_SLUG_LENGTH).replace(/-[^-]*$/, '');
  }
  if (!titleSlug) titleSlug = createHash('sha1').update(sourceUrl).digest('hex').slice(0, 8);

  const base = `${person}-${titleSlug}`;
  let slug = base;
  for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;
  return slug;
}

/** 正文加上待站長撰寫的編者觀點段落（ADR-0005）。 */
export function withEditorNotePlaceholder(body: string): string {
  return `${body.trim()}\n\n## ${EDITOR_NOTE_HEADING}\n\n<!-- 站長撰寫 -->\n`;
}

// JSON 字串同時也是合法的 YAML 雙引號字串，用來安全地輸出任意文字。
const quote = (value: string) => JSON.stringify(value);

/** 輸出文章 Markdown（YAML frontmatter＋正文）。欄位順序固定，方便 review diff。 */
export function renderPost(post: Post, body: string): string {
  const lines = [
    '---',
    `slug: ${post.slug}`,
    `title: ${quote(post.title)}`,
    `date: ${post.date}`,
    `created_at: ${post.created_at}`,
    `status: ${post.status}`,
    `person: ${post.person}`,
    `source_id: ${post.source_id}`,
    `source_url: ${quote(post.source_url)}`,
    `source_title: ${quote(post.source_title)}`,
    `category: ${post.category}`,
  ];
  if (post.tags && post.tags.length > 0) {
    lines.push('tags:', ...post.tags.map((tag) => `  - ${tag}`));
  }
  lines.push(`starred: ${post.starred}`, `summary: ${quote(post.summary)}`, '---', '', body);
  return lines.join('\n');
}

export function postPath(contentDir: string, post: Post): string {
  return path.join(contentDir, 'posts', post.date.slice(0, 4), `${post.slug}.md`);
}

/** 寫入新文章；檔案已存在時拋錯（生產線不修改既有文章）。 */
export async function writePost(file: string, markdown: string): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, markdown, { flag: 'wx' });
}
