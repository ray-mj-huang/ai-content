import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import type { z } from 'zod';
import { countChars, hasText, splitPostBody } from './body.ts';
import { BODY_MAX_CHARS, EDITOR_NOTE_HEADING, SUMMARY_MAX_CHARS } from './constants.ts';
import { personSchema, postSchema, type Person, type Post } from './schema.ts';

/** `content-check` 的規則名稱，出現在每一則錯誤訊息中。 */
export type RuleName =
  | 'file-location'
  | 'frontmatter-parse'
  | 'schema'
  | 'slug-matches-filename'
  | 'year-matches-date'
  | 'unique-slug'
  | 'unique-source-url'
  | 'person-exists'
  | 'source-exists'
  | 'editor-note-required'
  | 'body-length'
  | 'summary-length';

export interface ContentError {
  /** 出錯的檔案路徑（以 `loadContent` 收到的目錄為基準組合）。 */
  file: string;
  rule: RuleName;
  /** 出錯的 frontmatter 欄位，例如 `sources.0.url`。 */
  field?: string;
  message: string;
}

export interface PersonEntry {
  file: string;
  data: Person;
  /** 人物檔正文（較長的人物介紹），可為空字串。 */
  body: string;
}

export interface PostEntry {
  file: string;
  data: Post;
  /** 完整正文，含編者觀點段落。 */
  body: string;
  /** 編者觀點以外的正文。 */
  main: string;
  /** 編者觀點段落內容；沒有該段落時為 `null`。 */
  editorNote: string | null;
}

export interface Content {
  people: PersonEntry[];
  posts: PostEntry[];
}

export type LoadResult = ({ ok: true } & Content) | { ok: false; errors: ContentError[] };

export function formatError(error: ContentError): string {
  const field = error.field ? `${error.field}: ` : '';
  return `${error.file}: [${error.rule}] ${field}${error.message}`;
}

/**
 * 讀取 `dir`（通常是 `content/`）下所有人物與文章，並執行所有檢查規則。
 * 全部通過時回傳型別化資料；任一規則失敗時回傳完整的錯誤清單。
 */
export async function loadContent(dir: string): Promise<LoadResult> {
  const errors: ContentError[] = [];
  const people = await readPeople(dir, errors);
  const posts = await readPosts(dir, errors);
  checkReferences(people, posts, errors);

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, people, posts };
}

async function readPeople(dir: string, errors: ContentError[]): Promise<PersonEntry[]> {
  const peopleDir = path.join(dir, 'people');
  const entries: PersonEntry[] = [];

  for (const rel of await listMarkdown(peopleDir, errors)) {
    const file = path.join(peopleDir, rel);
    if (rel.includes(path.sep)) {
      errors.push({ file, rule: 'file-location', message: '人物檔必須直接放在 people/ 底下' });
      continue;
    }
    const parsed = await parseFile(file, personSchema, errors);
    if (!parsed) continue;

    const expected = path.basename(rel, '.md');
    if (parsed.data.slug !== expected) {
      errors.push({
        file,
        rule: 'slug-matches-filename',
        field: 'slug',
        message: `slug「${parsed.data.slug}」與檔名「${expected}」不一致`,
      });
    }
    entries.push({ file, data: parsed.data, body: parsed.body });
  }
  return entries;
}

async function readPosts(dir: string, errors: ContentError[]): Promise<PostEntry[]> {
  const postsDir = path.join(dir, 'posts');
  const entries: PostEntry[] = [];

  for (const rel of await listMarkdown(postsDir, errors)) {
    const file = path.join(postsDir, rel);
    const parts = rel.split(path.sep);
    if (parts.length !== 2 || !/^\d{4}$/.test(parts[0]!)) {
      errors.push({
        file,
        rule: 'file-location',
        message: '文章必須放在 posts/<YYYY>/<slug>.md',
      });
      continue;
    }
    const parsed = await parseFile(file, postSchema, errors);
    if (!parsed) continue;
    const { data, body } = parsed;

    const expected = path.basename(rel, '.md');
    if (data.slug !== expected) {
      errors.push({
        file,
        rule: 'slug-matches-filename',
        field: 'slug',
        message: `slug「${data.slug}」與檔名「${expected}」不一致`,
      });
    }
    if (data.date.slice(0, 4) !== parts[0]) {
      errors.push({
        file,
        rule: 'year-matches-date',
        field: 'date',
        message: `date 年份 ${data.date.slice(0, 4)} 與目錄年份 ${parts[0]} 不一致`,
      });
    }

    const { main, editorNote } = splitPostBody(body);
    if (data.status === 'published' && !hasText(editorNote)) {
      errors.push({
        file,
        rule: 'editor-note-required',
        message: `已發布的文章必須有非空白的「## ${EDITOR_NOTE_HEADING}」段落`,
      });
    }
    const bodyChars = countChars(main);
    if (bodyChars > BODY_MAX_CHARS) {
      errors.push({
        file,
        rule: 'body-length',
        message: `正文（不含編者觀點）${bodyChars} 字，超過上限 ${BODY_MAX_CHARS} 字`,
      });
    }
    const summaryChars = countChars(data.summary);
    if (summaryChars > SUMMARY_MAX_CHARS) {
      errors.push({
        file,
        rule: 'summary-length',
        field: 'summary',
        message: `summary ${summaryChars} 字，超過上限 ${SUMMARY_MAX_CHARS} 字`,
      });
    }
    entries.push({ file, data, body, main, editorNote });
  }
  return entries;
}

function checkReferences(people: PersonEntry[], posts: PostEntry[], errors: ContentError[]): void {
  checkUnique(people, (p) => p.data.slug, 'unique-slug', 'slug', errors);
  checkUnique(posts, (p) => p.data.slug, 'unique-slug', 'slug', errors);
  checkUnique(posts, (p) => p.data.source_url, 'unique-source-url', 'source_url', errors);

  const peopleBySlug = new Map(people.map((p) => [p.data.slug, p.data]));
  for (const post of posts) {
    const person = peopleBySlug.get(post.data.person);
    if (!person) {
      errors.push({
        file: post.file,
        rule: 'person-exists',
        field: 'person',
        message: `找不到人物「${post.data.person}」`,
      });
      continue;
    }
    if (!person.sources.some((s) => s.id === post.data.source_id)) {
      errors.push({
        file: post.file,
        rule: 'source-exists',
        field: 'source_id',
        message: `人物「${person.slug}」沒有 id 為「${post.data.source_id}」的來源`,
      });
    }
  }
}

function checkUnique<T extends { file: string }>(
  entries: T[],
  key: (entry: T) => string,
  rule: RuleName,
  field: string,
  errors: ContentError[],
): void {
  const firstFile = new Map<string, string>();
  for (const entry of entries) {
    const value = key(entry);
    const existing = firstFile.get(value);
    if (existing) {
      errors.push({
        file: entry.file,
        rule,
        field,
        message: `「${value}」已在 ${existing} 使用`,
      });
    } else {
      firstFile.set(value, entry.file);
    }
  }
}

/** 列出目錄下所有 `.md` 檔（相對路徑），忽略以 `.` 開頭的檔案與目錄。 */
async function listMarkdown(dir: string, errors: ContentError[]): Promise<string[]> {
  let names: string[];
  try {
    names = await readdir(dir, { recursive: true });
  } catch {
    errors.push({ file: dir, rule: 'file-location', message: '目錄不存在或無法讀取' });
    return [];
  }
  return names
    .filter((name) => name.endsWith('.md'))
    .filter((name) => !name.split(path.sep).some((part) => part.startsWith('.')))
    .sort();
}

async function parseFile<S extends z.ZodType>(
  file: string,
  schema: S,
  errors: ContentError[],
): Promise<{ data: z.infer<S>; body: string } | null> {
  let parsed: matter.GrayMatterFile<string>;
  try {
    // 傳入空的 options 物件以避開 gray-matter 依內容快取結果的行為。
    parsed = matter(await readFile(file, 'utf8'), {});
  } catch (error) {
    errors.push({
      file,
      rule: 'frontmatter-parse',
      message: `frontmatter 無法解析：${(error as Error).message}`,
    });
    return null;
  }

  const result = schema.safeParse(parsed.data);
  if (!result.success) {
    for (const issue of result.error.issues) {
      errors.push({
        file,
        rule: 'schema',
        field: issue.path.length > 0 ? issue.path.join('.') : undefined,
        message: issue.message,
      });
    }
    return null;
  }
  return { data: result.data, body: parsed.content };
}
