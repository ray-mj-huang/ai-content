import { copyFile, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { formatError, loadContent, type RuleName } from '../src/index.ts';
import { copyToTemp, editFile, VALID_FIXTURE } from './helpers.ts';

const ALICE = path.join('people', 'alice.md');
const PUBLISHED = path.join('posts', '2026', 'published-post.md');
const DRAFT = path.join('posts', '2026', 'draft-post.md');

interface InvalidCase {
  name: string;
  rule: RuleName;
  /** 錯誤應指向的檔案（相對於 content 目錄）。 */
  file: string;
  field?: string;
  mutate: (dir: string) => Promise<void>;
}

const cases: InvalidCase[] = [
  {
    name: '文章缺少必填欄位',
    rule: 'schema',
    file: PUBLISHED,
    field: 'source_title',
    mutate: (dir) => editFile(path.join(dir, PUBLISHED), /^source_title:.*\n/m, ''),
  },
  {
    name: '分類不在清單中',
    rule: 'schema',
    file: PUBLISHED,
    field: 'category',
    mutate: (dir) => editFile(path.join(dir, PUBLISHED), 'category: tools', 'category: news'),
  },
  {
    name: '人物沒有任何來源',
    rule: 'schema',
    file: ALICE,
    field: 'sources',
    mutate: (dir) =>
      writeFile(
        path.join(dir, ALICE),
        '---\nslug: alice\nname: Alice\nbio: 簡介\nsources: []\nactive: true\n---\n',
      ),
  },
  {
    name: '人物內來源 id 重複',
    rule: 'schema',
    file: ALICE,
    field: 'sources.1.id',
    mutate: (dir) => editFile(path.join(dir, ALICE), 'id: talks', 'id: blog'),
  },
  {
    name: '未知的 frontmatter 欄位',
    rule: 'schema',
    file: PUBLISHED,
    mutate: (dir) =>
      editFile(path.join(dir, PUBLISHED), 'starred: true', 'starred: true\nstared: true'),
  },
  {
    name: 'frontmatter 不是合法 YAML',
    rule: 'frontmatter-parse',
    file: PUBLISHED,
    mutate: (dir) =>
      editFile(path.join(dir, PUBLISHED), 'title: 已發布的測試文章', 'title: [未關閉'),
  },
  {
    name: '文章不在年份目錄下',
    rule: 'file-location',
    file: path.join('posts', 'stray.md'),
    mutate: (dir) => copyFile(path.join(dir, PUBLISHED), path.join(dir, 'posts', 'stray.md')),
  },
  {
    name: '文章 slug 與檔名不一致',
    rule: 'slug-matches-filename',
    file: PUBLISHED,
    field: 'slug',
    mutate: (dir) =>
      editFile(path.join(dir, PUBLISHED), 'slug: published-post', 'slug: another-slug'),
  },
  {
    name: '人物 slug 與檔名不一致',
    rule: 'slug-matches-filename',
    file: ALICE,
    field: 'slug',
    mutate: (dir) => editFile(path.join(dir, ALICE), 'slug: alice', 'slug: bob'),
  },
  {
    name: '年份目錄與 date 不一致',
    rule: 'year-matches-date',
    file: PUBLISHED,
    field: 'date',
    mutate: (dir) => editFile(path.join(dir, PUBLISHED), 'date: 2026-01-15', 'date: 2025-12-31'),
  },
  {
    name: '文章 slug 重複',
    rule: 'unique-slug',
    file: path.join('posts', '2027', 'published-post.md'),
    field: 'slug',
    mutate: async (dir) => {
      await mkdir(path.join(dir, 'posts', '2027'));
      const copy = path.join(dir, 'posts', '2027', 'published-post.md');
      await copyFile(path.join(dir, PUBLISHED), copy);
      await editFile(copy, 'date: 2026-01-15', 'date: 2027-01-15');
      await editFile(copy, 'posts/1', 'posts/99');
    },
  },
  {
    name: 'source_url 重複',
    rule: 'unique-source-url',
    // 檔案依路徑排序讀取，重複值回報在後讀到的檔案上。
    file: PUBLISHED,
    field: 'source_url',
    mutate: (dir) => editFile(path.join(dir, DRAFT), 'posts/2', 'posts/1'),
  },
  {
    name: '人物不存在',
    rule: 'person-exists',
    file: PUBLISHED,
    field: 'person',
    mutate: (dir) => editFile(path.join(dir, PUBLISHED), 'person: alice', 'person: nobody'),
  },
  {
    name: '來源不屬於該人物',
    rule: 'source-exists',
    file: PUBLISHED,
    field: 'source_id',
    mutate: (dir) => editFile(path.join(dir, PUBLISHED), 'source_id: blog', 'source_id: podcast'),
  },
  {
    name: '已發布文章的編者觀點只有佔位註解',
    rule: 'editor-note-required',
    file: DRAFT,
    mutate: (dir) => editFile(path.join(dir, DRAFT), 'status: draft', 'status: published'),
  },
  {
    name: '已發布文章沒有編者觀點段落',
    rule: 'editor-note-required',
    file: PUBLISHED,
    mutate: (dir) => editFile(path.join(dir, PUBLISHED), /## 編者觀點[\s\S]*$/, ''),
  },
  {
    name: '正文超過 1,200 字',
    rule: 'body-length',
    file: PUBLISHED,
    mutate: (dir) => editFile(path.join(dir, PUBLISHED), '這是重點摘要。', '字'.repeat(1201)),
  },
  {
    name: 'summary 超過 120 字',
    rule: 'summary-length',
    file: PUBLISHED,
    field: 'summary',
    mutate: (dir) =>
      editFile(path.join(dir, PUBLISHED), 'summary: 測試用摘要。', `summary: ${'字'.repeat(121)}`),
  },
];

describe('content-check 規則', () => {
  it('合法 fixture 通過', async () => {
    const result = await loadContent(VALID_FIXTURE);
    expect(result.ok ? [] : result.errors).toEqual([]);
  });

  it.each(cases)('$rule：$name', async ({ rule, file, field, mutate }) => {
    const dir = await copyToTemp(VALID_FIXTURE);
    try {
      await mutate(dir);
      const result = await loadContent(dir);
      expect(result.ok).toBe(false);
      if (result.ok) return;

      const expectedFile = path.join(dir, file);
      const match = result.errors.find((e) => e.rule === rule && e.file === expectedFile);
      expect(match, `錯誤清單：\n${result.errors.map(formatError).join('\n')}`).toBeDefined();
      if (field) expect(match!.field).toBe(field);

      const message = formatError(match!);
      expect(message).toContain(expectedFile);
      expect(message).toContain(`[${rule}]`);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
