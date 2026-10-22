import { execFile } from 'node:child_process';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, expectTypeOf, it } from 'vitest';
// 透過套件名稱 import，確認其他 workspace package 能取得型別（驗收條件 5）。
import { loadContent, type Person, type Post } from '@ai-content/content-schema';
import { copyToTemp, editFile, REPO_CONTENT } from './helpers.ts';

const CLI = path.join(import.meta.dirname, '..', 'src', 'cli.ts');
const run = promisify(execFile);

describe('repo 的 content/', () => {
  it('範例內容通過檢查，且涵蓋 draft、published、rejected', async () => {
    const result = await loadContent(REPO_CONTENT);
    if (!result.ok) throw new Error(result.errors.map((e) => e.message).join('\n'));

    expect(result.people.length).toBeGreaterThanOrEqual(2);
    const statuses = new Set(result.posts.map((p) => p.data.status));
    expect([...statuses].sort()).toEqual(['draft', 'published', 'rejected']);
  });

  it('清空已發布文章的編者觀點後，content-check CLI 失敗（驗收條件 4）', async () => {
    const dir = await copyToTemp(REPO_CONTENT);
    try {
      const before = await loadContent(dir);
      if (!before.ok) throw new Error('範例內容應該通過檢查');
      const published = before.posts.find((p) => p.data.status === 'published')!;
      await editFile(published.file, /(## 編者觀點\n)[\s\S]*$/, '$1\n');

      const error = await run(process.execPath, [CLI, dir]).then(
        () => null,
        (e: { code: number; stderr: string }) => e,
      );
      expect(error?.code).toBe(1);
      expect(error?.stderr).toContain(`${published.file}: [editor-note-required]`);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe('匯出型別', () => {
  it('Person 與 Post 型別包含必要欄位', () => {
    expectTypeOf<Person['sources'][number]['type']>().toEqualTypeOf<
      'rss' | 'podcast' | 'youtube' | 'web'
    >();
    expectTypeOf<Post['status']>().toEqualTypeOf<'draft' | 'published' | 'rejected'>();
    expectTypeOf<Post['date']>().toEqualTypeOf<string>();
  });
});
