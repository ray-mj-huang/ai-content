import path from 'node:path';
import {
  BODY_MAX_CHARS,
  countChars,
  formatError,
  loadContent,
  postSchema,
  SUMMARY_MAX_CHARS,
  type Person,
  type Post,
} from '@ai-content/content-schema';
import type { FetchText } from './fetch.ts';
import { readFeed, recentEntries, type FeedEntry } from './feed.ts';
import { getFullText } from './fulltext.ts';
import { buildRequest, parseLlmOutput, type LlmClient } from './llm.ts';
import { checkQuality } from './quality.ts';
import { emptyReport, type RunReport } from './report.ts';
import { makeSlug, postPath, renderPost, withEditorNotePlaceholder, writePost } from './write.ts';

export const DEFAULT_LIMIT = 10;
export const DEFAULT_DAYS = 14;

export interface RunOptions {
  contentDir: string;
  /** 只處理這位人物。 */
  person?: string;
  /** 最多處理幾個新項目（呼叫 LLM 的次數上限）。 */
  limit?: number;
  /** 只取最近幾天內發表的項目。 */
  days?: number;
  /** 只列出會處理的項目，不寫檔、不呼叫 LLM。 */
  dryRun?: boolean;
  now?: Date;
}

export interface RunDeps {
  fetchText: FetchText;
  /** 延遲建立，dry-run 時不會被呼叫。 */
  createLlm: () => LlmClient;
}

interface Candidate {
  person: Person;
  sourceId: string;
  entry: FeedEntry;
}

/** 執行一次完整流程（ADR-0006）。單一項目失敗只記錄在報告中，不中斷整批。 */
export async function run(options: RunOptions, deps: RunDeps): Promise<RunReport> {
  const { contentDir, limit = DEFAULT_LIMIT, days = DEFAULT_DAYS, dryRun = false } = options;
  const now = options.now ?? new Date();
  const report = emptyReport(dryRun);

  const content = await loadContent(contentDir);
  if (!content.ok) {
    throw new Error(
      `content/ 未通過檢查，停止執行：\n${content.errors.map(formatError).join('\n')}`,
    );
  }
  const knownUrls = new Set(content.posts.map((post) => post.data.source_url));
  const takenSlugs = new Set(content.posts.map((post) => post.data.slug));

  let people = content.people.map((entry) => entry.data).filter((person) => person.active);
  if (options.person) {
    people = people.filter((person) => person.slug === options.person);
    if (people.length === 0) throw new Error(`找不到啟用中的人物：${options.person}`);
  }

  const candidates: Candidate[] = [];
  for (const person of people) {
    for (const source of person.sources) {
      const label = `${person.slug}/${source.id}`;
      if (source.type !== 'rss') {
        report.skipped.push({
          source: label,
          reason: `不支援的來源類型「${source.type}」（MVP 只處理 rss）`,
        });
        continue;
      }
      let entries: FeedEntry[];
      try {
        const feed = readFeed(await deps.fetchText(source.url));
        if (feed.incomplete > 0) {
          report.skipped.push({
            source: label,
            reason: `${feed.incomplete} 個項目缺少網址、標題或日期`,
          });
        }
        entries = recentEntries(feed.entries, now, days);
      } catch (error) {
        report.failed.push({
          source: label,
          reason: `讀取 feed 失敗：${(error as Error).message}`,
        });
        continue;
      }
      for (const entry of entries) {
        if (knownUrls.has(entry.url)) {
          report.alreadyKnown++;
          continue;
        }
        knownUrls.add(entry.url);
        candidates.push({ person, sourceId: source.id, entry });
      }
    }
  }

  candidates.sort((a, b) => a.entry.published.getTime() - b.entry.published.getTime());
  const selected = candidates.slice(0, limit);
  for (const { entry } of candidates.slice(limit)) {
    report.skipped.push({
      source: entry.url,
      title: entry.title,
      reason: `超過本次上限 ${limit} 項，留待下次執行`,
    });
  }

  if (dryRun) {
    report.planned = selected.map(({ entry }) => ({ source: entry.url, title: entry.title }));
    return report;
  }

  const llm = selected.length > 0 ? deps.createLlm() : null;
  for (const candidate of selected) {
    const { entry } = candidate;
    try {
      const { post, body } = await draftPost(candidate, llm!, deps.fetchText, takenSlugs, now);
      const file = postPath(contentDir, post);
      await writePost(file, renderPost(post, body));
      takenSlugs.add(post.slug);
      report.created.push({
        source: entry.url,
        title: post.title,
        file: path.relative(process.cwd(), file),
      });
    } catch (error) {
      report.failed.push({
        source: entry.url,
        title: entry.title,
        reason: (error as Error).message,
      });
    }
  }
  return report;
}

async function draftPost(
  { person, sourceId, entry }: Candidate,
  llm: LlmClient,
  fetchText: FetchText,
  takenSlugs: Set<string>,
  now: Date,
): Promise<{ post: Post; body: string }> {
  const sourceText = await getFullText(entry, fetchText);
  const date = entry.published.toISOString().slice(0, 10);
  const request = await buildRequest({
    personName: person.name,
    sourceTitle: entry.title,
    sourceUrl: entry.url,
    published: date,
    sourceText,
  });
  const output = parseLlmOutput(await llm.generate(request));

  const problems = checkQuality({ ...output, sourceText });
  const bodyChars = countChars(output.body);
  if (bodyChars > BODY_MAX_CHARS)
    problems.push(`正文 ${bodyChars} 字，超過上限 ${BODY_MAX_CHARS} 字`);
  const summaryChars = countChars(output.summary);
  if (summaryChars > SUMMARY_MAX_CHARS) {
    problems.push(`summary ${summaryChars} 字，超過上限 ${SUMMARY_MAX_CHARS} 字`);
  }

  const parsed = postSchema.safeParse({
    slug: makeSlug(person.slug, entry.title, entry.url, takenSlugs),
    title: output.title,
    date,
    created_at: now.toISOString(),
    status: 'draft',
    person: person.slug,
    source_id: sourceId,
    source_url: entry.url,
    source_title: entry.title,
    category: output.category,
    tags: output.tags.length > 0 ? output.tags : undefined,
    starred: false,
    summary: output.summary,
  });
  if (!parsed.success) {
    problems.push(
      ...parsed.error.issues.map((issue) => `schema：${issue.path.join('.')} ${issue.message}`),
    );
  }

  if (problems.length > 0 || !parsed.success) throw new Error(problems.join('；'));
  return { post: parsed.data, body: withEditorNotePlaceholder(output.body) };
}
