#!/usr/bin/env node
// 用法：content-check [content 目錄]（預設為 ./content）
import { formatError, loadContent } from './load.ts';

const dir = process.argv[2] ?? 'content';
const result = await loadContent(dir);

if (result.ok) {
  console.log(
    `content-check：${dir} 通過（${result.people.length} 位人物，${result.posts.length} 篇文章）`,
  );
} else {
  for (const error of result.errors) console.error(formatError(error));
  console.error(`\ncontent-check：${dir} 有 ${result.errors.length} 個錯誤`);
  process.exitCode = 1;
}
