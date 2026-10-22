#!/usr/bin/env node
// 用法：pipeline run [--person <slug>] [--limit N] [--days N] [--dry-run] [--content <dir>] [--report <file>]
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fetchText } from './fetch.ts';
import { createClaudeClient } from './llm.ts';
import { renderReport } from './report.ts';
import { DEFAULT_DAYS, DEFAULT_LIMIT, run } from './run.ts';

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    person: { type: 'string' },
    limit: { type: 'string', default: String(DEFAULT_LIMIT) },
    days: { type: 'string', default: String(DEFAULT_DAYS) },
    'dry-run': { type: 'boolean', default: false },
    content: { type: 'string', default: 'content' },
    report: { type: 'string' },
  },
});

if (positionals[0] !== 'run') {
  console.error(
    '用法：pipeline run [--person <slug>] [--limit N] [--days N] [--dry-run] [--report <file>]',
  );
  process.exit(2);
}

const toPositiveInt = (name: string, value: string) => {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) {
    console.error(`--${name} 必須是正整數：${value}`);
    process.exit(2);
  }
  return n;
};

const report = await run(
  {
    contentDir: values.content,
    person: values.person,
    limit: toPositiveInt('limit', values.limit),
    days: toPositiveInt('days', values.days),
    dryRun: values['dry-run'],
  },
  { fetchText, createLlm: createClaudeClient },
);

const markdown = renderReport(report);
console.log(markdown);
if (values.report) {
  await mkdir(path.dirname(values.report), { recursive: true });
  await writeFile(values.report, markdown);
}
