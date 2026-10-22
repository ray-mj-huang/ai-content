import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { readFeed, recentEntries } from '../src/feed.ts';
import { htmlToText } from '../src/html.ts';
import { buildRequest, parseLlmOutput } from '../src/llm.ts';
import { checkQuality, findQuotes, overlapRatio } from '../src/quality.ts';
import { findSimplified } from '../src/simplified.ts';
import { makeSlug } from '../src/write.ts';
import { FIXTURES, NOW } from './helpers.ts';

describe('feed', () => {
  it('解析 RSS 並篩選最近 14 天', async () => {
    const { entries, incomplete } = readFeed(
      await readFile(path.join(FIXTURES, 'feed.xml'), 'utf8'),
    );
    expect(entries).toHaveLength(6);
    expect(incomplete).toBe(0);
    expect(recentEntries(entries, NOW, 14).map((e) => e.url)).not.toContain(
      'https://alice.example.com/posts/old',
    );
  });
});

describe('htmlToText', () => {
  it('去掉標籤與 script，解碼 entity', () => {
    expect(htmlToText('<p>A &amp; B</p><script>x()</script><p>C&#39;s&nbsp;d</p>')).toBe(
      "A & B\nC's d",
    );
  });
});

describe('overlapRatio', () => {
  it('照抄時接近 1，改寫成中文時接近 0', () => {
    const source = 'The agent reads the repository and runs the test suite after every change.';
    expect(overlapRatio(source, source)).toBe(1);
    expect(overlapRatio('agent 會讀取整個 repo，每次修改後都跑測試。', source)).toBe(0);
  });
});

describe('findSimplified', () => {
  it('偵測簡體專用字，不誤判正體字', () => {
    expect(findSimplified('这是测试')).toEqual(['这', '测', '试']);
    expect(findSimplified('這是測試，後來的皇后與范先生')).toEqual([]);
  });
});

describe('findQuotes', () => {
  it('引用區塊與含多個英文字的行內引號都算直接引述', () => {
    const body =
      '作者說：\n\n> Tests are the spec.\n> Keep them fast.\n\n他也提到 "you cannot outsource the verification step" 這件事，以及 "vibe coding" 一詞。';
    expect(findQuotes(body)).toEqual([
      'Tests are the spec. Keep them fast.',
      'you cannot outsource the verification step',
    ]);
  });
});

describe('checkQuality', () => {
  const base = {
    title: '標題',
    summary: '摘要。',
    sourceText: 'Original English text about agents.',
  };

  it('正常的中文正文通過', () => {
    expect(checkQuality({ ...base, body: '作者認為 coding agent 需要清楚的完成定義。' })).toEqual(
      [],
    );
  });

  it('英文為主的正文不通過', () => {
    const problems = checkQuality({
      ...base,
      body: 'This body is written almost entirely in English 而已。',
    });
    expect(problems.join()).toContain('中文比例');
  });

  it('超過一段引述或引述過長不通過', () => {
    const long = `> ${'word '.repeat(30)}`;
    expect(checkQuality({ ...base, body: `作者表示：\n\n${long}` }).join()).toContain('過長');
    expect(
      checkQuality({ ...base, body: '作者表示：\n\n> 第一段\n\n說明\n\n> 第二段' }).join(),
    ).toContain('2 段');
  });

  it('正文含編者觀點段落不通過', () => {
    expect(checkQuality({ ...base, body: '摘要內容。\n\n## 編者觀點\n\n心得' }).join()).toContain(
      '編者觀點',
    );
  });
});

describe('makeSlug', () => {
  it('由英文標題產生，重複時加序號', () => {
    const taken = new Set(['alice-hello-world']);
    expect(makeSlug('alice', 'Hello, World!', 'https://x', taken)).toBe('alice-hello-world-2');
  });

  it('標題沒有英數字時改用網址雜湊', () => {
    expect(makeSlug('alice', '中文標題', 'https://x/1', new Set())).toMatch(/^alice-[0-9a-f]{8}$/);
  });

  it('過長的標題在單字邊界截斷', () => {
    const slug = makeSlug('alice', 'word '.repeat(30), 'https://x', new Set());
    expect(slug.length).toBeLessThanOrEqual('alice-'.length + 60);
    expect(slug.endsWith('-')).toBe(false);
  });
});

describe('llm', () => {
  it('buildRequest 填入變數，且不會展開原文中的 {{...}}', async () => {
    const request = await buildRequest({
      personName: 'Alice',
      sourceTitle: 'Title',
      sourceUrl: 'https://x',
      published: '2026-10-20',
      sourceText: 'literal {{person_name}} stays',
    });
    expect(request.user).toContain('作者：Alice');
    expect(request.user).toContain('literal {{person_name}} stays');
    expect(request.system).toContain('正體中文');
  });

  it('parseLlmOutput 檢查欄位', () => {
    const valid = { title: 't', summary: 's', body: 'b', category: 'tools', tags: ['x'] };
    expect(parseLlmOutput(JSON.stringify(valid)).category).toBe('tools');
    expect(() => parseLlmOutput('[]')).toThrow('缺少欄位');
    expect(() => parseLlmOutput(JSON.stringify({ ...valid, tags: 'x' }))).toThrow('tags');
  });
});
