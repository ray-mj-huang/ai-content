import { cp, mkdtemp, readdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { FetchText } from '../src/fetch.ts';
import type { LlmClient, LlmRequest } from '../src/llm.ts';

export const FIXTURES = path.join(import.meta.dirname, 'fixtures');
export const NOW = new Date('2026-10-22T00:00:00Z');

/** 把測試用 content/ 複製到暫存目錄，回傳路徑。 */
export async function copyContent(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'pipeline-'));
  await cp(path.join(FIXTURES, 'content'), dir, { recursive: true });
  return dir;
}

/** 依網址回傳錄好的 fixture；未錄製的網址一律失敗，確保測試不連網。 */
export async function fakeFetch(): Promise<FetchText> {
  const pages: Record<string, string> = {
    'https://alice.example.com/feed.xml': await readFile(path.join(FIXTURES, 'feed.xml'), 'utf8'),
    'https://alice.example.com/posts/summary-only': await readFile(
      path.join(FIXTURES, 'summary-only.html'),
      'utf8',
    ),
  };
  return async (url) => {
    const page = pages[url];
    if (page === undefined) throw new Error(`測試未錄製此網址：${url}`);
    return page;
  };
}

export const titleOf = (request: LlmRequest) => /^原始標題：(.*)$/m.exec(request.user)?.[1] ?? '';

export function goodOutput(request: LlmRequest): string {
  const title = titleOf(request);
  return JSON.stringify({
    title: `測試作者：${title}`,
    summary: `整理「${title}」的重點與作者的做法。`,
    body: `作者分享了「${title}」的心得。\n\n**重點一。** 把工作切成小步驟，每一步都能被檢查。\n\n**重點二。** 先寫好完成的定義，再讓工具開始動手。`,
    category: 'practice',
    tags: ['testing'],
  });
}

/** 假 LLM client：記錄收到的請求，依 `respond` 回傳固定輸出。 */
export function fakeLlm(respond: (request: LlmRequest) => string = goodOutput) {
  const requests: LlmRequest[] = [];
  const client: LlmClient = {
    async generate(request) {
      requests.push(request);
      return respond(request);
    },
  };
  return { client, requests };
}

/** 遞迴讀取目錄下所有檔案內容，key 為相對路徑。 */
export async function readTree(dir: string): Promise<Record<string, string>> {
  const files: Record<string, string> = {};
  for (const name of await readdir(dir, { recursive: true, withFileTypes: true })) {
    if (!name.isFile()) continue;
    const full = path.join(name.parentPath, name.name);
    files[path.relative(dir, full)] = await readFile(full, 'utf8');
  }
  return files;
}
