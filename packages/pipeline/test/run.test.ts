import { rm } from 'node:fs/promises';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadContent } from '@ai-content/content-schema';
import type { LlmRequest } from '../src/llm.ts';
import { renderReport } from '../src/report.ts';
import { run, type RunOptions } from '../src/run.ts';
import { copyContent, fakeFetch, fakeLlm, goodOutput, NOW, readTree, titleOf } from './helpers.ts';

const NEW_URLS = [
  'https://alice.example.com/posts/static-sites',
  'https://alice.example.com/posts/prompt-caching',
  'https://alice.example.com/posts/summary-only',
  'https://alice.example.com/posts/small-steps',
];

const dirs: string[] = [];
afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function setup(respond?: (request: LlmRequest) => string, options: Partial<RunOptions> = {}) {
  const contentDir = await copyContent();
  dirs.push(contentDir);
  const llm = fakeLlm(respond);
  const createLlm = vi.fn(() => llm.client);
  const deps = { fetchText: await fakeFetch(), createLlm };
  const runOnce = (extra: Partial<RunOptions> = {}) =>
    run({ contentDir, now: NOW, ...options, ...extra }, deps);
  return { contentDir, llm, createLlm, runOnce };
}

/** 讓標題符合 `title` 的項目回傳 `bad`，其他項目正常。 */
const failFor = (title: string, bad: (request: LlmRequest) => string) => (request: LlmRequest) =>
  titleOf(request) === title ? bad(request) : goodOutput(request);

describe('pipeline run', () => {
  it('1. 產出的檔案全部通過 content-check，且都是 draft', async () => {
    const { contentDir, runOnce } = await setup();
    const report = await runOnce();

    expect(report.failed).toEqual([]);
    expect(report.created.map((item) => item.source)).toEqual(NEW_URLS);

    const content = await loadContent(contentDir);
    if (!content.ok) throw new Error(content.errors.map((e) => e.message).join('\n'));
    const created = content.posts.filter((post) => NEW_URLS.includes(post.data.source_url));
    expect(created).toHaveLength(4);
    for (const post of created) {
      expect(post.data.status).toBe('draft');
      expect(post.data.starred).toBe(false);
      expect(post.editorNote).not.toBeNull();
    }
  });

  it('只有摘要的項目會抓網頁抽取全文', async () => {
    const { llm, runOnce } = await setup();
    await runOnce();
    const request = llm.requests.find((r) => titleOf(r) === 'Reviewing Agent Code')!;
    expect(request.user).toContain('I start every review by reading the tests');
    expect(request.user).not.toContain('Copyright Alice Example');
  });

  it('2. 連續執行兩次，第二次不產生新檔案', async () => {
    const { contentDir, runOnce } = await setup();
    await runOnce();
    const before = await readTree(contentDir);

    const second = await runOnce();
    expect(second.created).toEqual([]);
    expect(second.alreadyKnown).toBe(5);
    expect(await readTree(contentDir)).toEqual(before);
  });

  it('3. 已有 rejected 文章的 source_url 不會再被產出，既有文章不被修改', async () => {
    const { contentDir, runOnce } = await setup();
    const before = await readTree(contentDir);
    const report = await runOnce();

    expect(report.created.map((item) => item.source)).not.toContain(
      'https://alice.example.com/posts/known',
    );
    expect(report.alreadyKnown).toBe(1);
    const after = await readTree(contentDir);
    for (const [file, text] of Object.entries(before)) expect(after[file]).toBe(text);
  });

  it('4. 摘要與原文高度重疊時，該項目被拒絕並列在失敗清單', async () => {
    const copySource = (request: LlmRequest) => {
      const source = /<article>\n([\s\S]*)\n<\/article>/.exec(request.user)![1]!;
      return JSON.stringify({ ...JSON.parse(goodOutput(request)), body: source });
    };
    const { runOnce } = await setup(failFor('Small Steps for Coding Agents', copySource));
    const report = await runOnce();

    expect(report.created).toHaveLength(3);
    expect(report.failed).toHaveLength(1);
    expect(report.failed[0]!.source).toBe('https://alice.example.com/posts/small-steps');
    expect(report.failed[0]!.reason).toContain('重疊');
    expect(renderReport(report)).toContain('small-steps');
  });

  it('5. LLM 回傳含簡體字的內容時被拒絕', async () => {
    const simplified = (request: LlmRequest) =>
      JSON.stringify({ ...JSON.parse(goodOutput(request)), summary: '这个问题我们来说明。' });
    const { runOnce } = await setup(failFor('Static Sites Are Enough', simplified));
    const report = await runOnce();

    expect(report.failed).toHaveLength(1);
    expect(report.failed[0]!.reason).toContain('簡體');
    expect(report.created).toHaveLength(3);
  });

  it.each([
    ['不合法 JSON', () => 'not json at all', '不是合法 JSON'],
    [
      '缺少欄位',
      (r: LlmRequest) => JSON.stringify({ ...JSON.parse(goodOutput(r)), body: undefined }),
      'body',
    ],
    [
      '分類不在清單',
      (r: LlmRequest) => JSON.stringify({ ...JSON.parse(goodOutput(r)), category: 'news' }),
      '分類',
    ],
    [
      'LLM 呼叫拋錯',
      () => {
        throw new Error('API 暫時無法使用');
      },
      'API 暫時無法使用',
    ],
  ])('6. LLM %s 時該項目失敗，其他項目照常產出', async (_name, bad, reason) => {
    const { runOnce } = await setup(failFor('What Prompt Caching Taught Me', bad));
    const report = await runOnce();

    expect(report.failed).toHaveLength(1);
    expect(report.failed[0]!.reason).toContain(reason);
    expect(report.created).toHaveLength(3);
  });

  it('7. --limit 3 時最多產出 3 篇，其餘留待下次', async () => {
    const { llm, runOnce } = await setup(undefined, { limit: 3 });
    const report = await runOnce();

    expect(report.created).toHaveLength(3);
    expect(llm.requests).toHaveLength(3);
    expect(report.skipped.filter((item) => item.reason?.includes('上限'))).toHaveLength(1);
  });

  it('8. --dry-run 不寫檔、不呼叫 LLM client', async () => {
    const { contentDir, createLlm, llm, runOnce } = await setup(undefined, { dryRun: true });
    const before = await readTree(contentDir);
    const report = await runOnce();

    expect(createLlm).not.toHaveBeenCalled();
    expect(llm.requests).toEqual([]);
    expect(report.planned.map((item) => item.source)).toEqual(NEW_URLS);
    expect(await readTree(contentDir)).toEqual(before);
  });

  it('9. 非 rss 來源會被跳過並記錄；停用的人物不處理', async () => {
    const { runOnce } = await setup();
    const report = await runOnce();

    const skipped = report.skipped.find((item) => item.source === 'alice/talks');
    expect(skipped?.reason).toContain('youtube');
    expect(report.failed.map((item) => item.source)).not.toContain('bob/blog');
  });

  it('10. 寫入的檔案與報告中找不到 API 金鑰', async () => {
    const key = 'sk-ant-test-FAKE-KEY-0123456789';
    vi.stubEnv('ANTHROPIC_API_KEY', key);
    try {
      const { contentDir, llm, runOnce } = await setup();
      const report = await runOnce();
      expect(report.created).toHaveLength(4);

      const outputs = [...Object.values(await readTree(contentDir)), renderReport(report)];
      for (const text of outputs) expect(text).not.toContain(key);
      for (const request of llm.requests) expect(JSON.stringify(request)).not.toContain(key);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('feed 讀取失敗只記錄在報告，不中斷整批', async () => {
    const { runOnce } = await setup();
    const report = await runOnce({ person: 'alice' });
    expect(report.created).toHaveLength(4);

    const contentDir = await copyContent();
    dirs.push(contentDir);
    const failing = await run(
      { contentDir, now: NOW },
      {
        fetchText: async () => {
          throw new Error('連線逾時');
        },
        createLlm: () => fakeLlm().client,
      },
    );
    expect(failing.failed).toEqual([{ source: 'alice/blog', reason: '讀取 feed 失敗：連線逾時' }]);
  });

  it('--person 指定不存在或停用的人物時拋錯', async () => {
    const { runOnce } = await setup();
    await expect(runOnce({ person: 'bob' })).rejects.toThrow('找不到啟用中的人物');
  });
});
