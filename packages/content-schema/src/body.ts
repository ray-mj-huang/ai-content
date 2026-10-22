import { EDITOR_NOTE_HEADING } from './constants.ts';

export interface PostBody {
  /** 編者觀點以外的正文。 */
  main: string;
  /** 編者觀點段落內容；沒有該段落時為 `null`。 */
  editorNote: string | null;
}

const EDITOR_NOTE_PATTERN = new RegExp(`^##[ \\t]+${EDITOR_NOTE_HEADING}[ \\t]*$`);
const SECTION_END_PATTERN = /^#{1,2}[ \t]/;

/**
 * 把文章正文拆成主要內容與「## 編者觀點」段落。
 * 編者觀點段落從標題起，到下一個一、二級標題或檔案結尾為止。
 */
export function splitPostBody(body: string): PostBody {
  const lines = body.split(/\r?\n/);
  const start = lines.findIndex((line) => EDITOR_NOTE_PATTERN.test(line));
  if (start === -1) return { main: body, editorNote: null };

  let end = lines.findIndex((line, i) => i > start && SECTION_END_PATTERN.test(line));
  if (end === -1) end = lines.length;

  return {
    main: [...lines.slice(0, start), ...lines.slice(end)].join('\n'),
    editorNote: lines.slice(start + 1, end).join('\n'),
  };
}

/** 去掉 HTML 註解與空白後是否還有內容；草稿的佔位註解不算內容。 */
export function hasText(text: string | null): boolean {
  if (text === null) return false;
  return text.replace(/<!--[\s\S]*?-->/g, '').trim().length > 0;
}

/**
 * 計算字數：每個非 ASCII、非空白字元（中文字、全形標點）算 1 字，
 * 每個連續的英數字串（英文單字、數字）算 1 字。
 * ASCII 標點與 Markdown 語法符號不計。
 */
export function countChars(text: string): number {
  return text.match(/[A-Za-z0-9]+(?:['’][A-Za-z]+)*|(?!\s)\P{ASCII}/gu)?.length ?? 0;
}
