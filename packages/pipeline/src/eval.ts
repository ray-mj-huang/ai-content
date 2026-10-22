#!/usr/bin/env node
// 以 eval/samples/ 的真實網址實際呼叫 LLM，產出報告供站長檢視 prompt 品質（ADR-0009）。
// 會花錢、結果不確定，不在 `npm run verify` 內；報告寫到 .cache/eval/，不寫入 content/。
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { countChars } from '@ai-content/content-schema';
import { fetchText } from './fetch.ts';
import { getFullText } from './fulltext.ts';
import { buildRequest, createClaudeClient, MODEL, parseLlmOutput } from './llm.ts';
import { checkQuality, overlapRatio } from './quality.ts';

interface Sample {
  person_name: string;
  title: string;
  url: string;
  published: string;
}

const SAMPLES_DIR = path.join(import.meta.dirname, '..', 'eval', 'samples');
const OUT_DIR = path.join('.cache', 'eval');

const files = (await readdir(SAMPLES_DIR)).filter((name) => name.endsWith('.json')).sort();
const llm = createClaudeClient();
const sections: string[] = [];

for (const name of files) {
  const sample = JSON.parse(await readFile(path.join(SAMPLES_DIR, name), 'utf8')) as Sample;
  console.error(`處理 ${name}…`);
  const lines = [
    `## ${sample.title}`,
    '',
    `- 作者：${sample.person_name}`,
    `- 原文：${sample.url}`,
  ];
  try {
    const sourceText = await getFullText(
      {
        url: sample.url,
        title: sample.title,
        published: new Date(sample.published),
        contentHtml: null,
      },
      fetchText,
    );
    const request = await buildRequest({
      personName: sample.person_name,
      sourceTitle: sample.title,
      sourceUrl: sample.url,
      published: sample.published,
      sourceText,
    });
    const output = parseLlmOutput(await llm.generate(request));
    const problems = checkQuality({ ...output, sourceText });
    const overlap = overlapRatio(`${output.summary}\n${output.body}`, sourceText);

    lines.push(
      `- 原文 ${countChars(sourceText)} 字；正文 ${countChars(output.body)} 字；summary ${countChars(output.summary)} 字；重疊 ${(overlap * 100).toFixed(1)}%`,
      `- 品質檢查：${problems.length === 0 ? '通過' : problems.join('；')}`,
      `- 分類：${output.category}；標籤：${output.tags.join(', ')}`,
      '',
      `### ${output.title}`,
      '',
      `> ${output.summary}`,
      '',
      output.body,
      '',
    );
  } catch (error) {
    lines.push(`- **失敗**：${(error as Error).message}`, '');
  }
  sections.push(lines.join('\n'));
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const file = path.join(OUT_DIR, `${stamp}.md`);
await mkdir(OUT_DIR, { recursive: true });
await writeFile(file, [`# eval:pipeline（${MODEL}）`, '', ...sections].join('\n'));
console.log(`報告：${file}`);
