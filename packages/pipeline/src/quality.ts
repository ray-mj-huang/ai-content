import { EDITOR_NOTE_HEADING } from '@ai-content/content-schema';
import { findSimplified } from './simplified.ts';

/** 字元 n-gram 長度與重疊門檻（ADR-0009 第 3 節，初始值，可調）。 */
export const OVERLAP_NGRAM = 8;
export const OVERLAP_THRESHOLD = 0.15;

/** 正文中漢字占「漢字＋英文單字」的最低比例；技術名詞可保留英文，但正文要以中文為主。 */
export const MIN_HAN_RATIO = 0.5;

/** 直接引述上限（ADR-0005）：最多 1 段，每段不超過 25 個英文字或 40 個漢字。 */
export const MAX_QUOTES = 1;
export const MAX_QUOTE_WORDS = 25;
export const MAX_QUOTE_HAN = 40;

/** 行內英文引號中至少有這麼多英文字，才視為直接引述（避免把引號標示的術語算進去）。 */
const INLINE_QUOTE_MIN_WORDS = 5;

const normalize = (text: string) => text.toLowerCase().replace(/\s+/g, ' ').trim();

function ngrams(text: string, n: number): string[] {
  const chars = [...normalize(text)];
  const grams: string[] = [];
  for (let i = 0; i + n <= chars.length; i++) grams.push(chars.slice(i, i + n).join(''));
  return grams;
}

/** 產出文字的 n-gram 中，有多少比例也出現在原文。 */
export function overlapRatio(generated: string, source: string, n = OVERLAP_NGRAM): number {
  const generatedGrams = ngrams(generated, n);
  if (generatedGrams.length === 0) return 0;
  const sourceGrams = new Set(ngrams(source, n));
  const shared = generatedGrams.filter((gram) => sourceGrams.has(gram)).length;
  return shared / generatedGrams.length;
}

const countHan = (text: string) => text.match(/\p{Script=Han}/gu)?.length ?? 0;
const countWords = (text: string) => text.match(/[A-Za-z]+(?:['’][A-Za-z]+)*/g)?.length ?? 0;

export function hanRatio(text: string): number {
  const han = countHan(text);
  const total = han + countWords(text);
  return total === 0 ? 0 : han / total;
}

/** 找出正文中的直接引述：Markdown 引用區塊，以及含多個英文字的行內引號。 */
export function findQuotes(body: string): string[] {
  const quotes: string[] = [];
  let block: string[] = [];
  for (const line of body.split('\n')) {
    if (/^\s*>/.test(line)) {
      block.push(line.replace(/^\s*>\s?/, ''));
    } else if (block.length > 0) {
      quotes.push(block.join(' ').trim());
      block = [];
    }
  }
  if (block.length > 0) quotes.push(block.join(' ').trim());

  const outsideBlocks = body
    .split('\n')
    .filter((line) => !/^\s*>/.test(line))
    .join('\n');
  for (const match of outsideBlocks.matchAll(/[“"]([^”"\n]+)[”"]/g)) {
    if (countWords(match[1]!) >= INLINE_QUOTE_MIN_WORDS) quotes.push(match[1]!);
  }
  return quotes;
}

export interface QualityInput {
  title: string;
  summary: string;
  body: string;
  sourceText: string;
}

/** 執行確定性的品質檢查，回傳所有不通過的原因；空陣列表示通過。 */
export function checkQuality({ title, summary, body, sourceText }: QualityInput): string[] {
  const problems: string[] = [];

  const ratio = overlapRatio(`${summary}\n${body}`, sourceText);
  if (ratio > OVERLAP_THRESHOLD) {
    problems.push(
      `與原文重疊 ${(ratio * 100).toFixed(1)}%，超過門檻 ${OVERLAP_THRESHOLD * 100}%（${OVERLAP_NGRAM}-gram）`,
    );
  }

  const simplified = findSimplified(`${title}\n${summary}\n${body}`);
  if (simplified.length > 0) problems.push(`含簡體字：${simplified.join('')}`);

  const han = hanRatio(body);
  if (han < MIN_HAN_RATIO) {
    problems.push(`正文中文比例 ${(han * 100).toFixed(0)}%，低於 ${MIN_HAN_RATIO * 100}%`);
  }

  const quotes = findQuotes(body);
  if (quotes.length > MAX_QUOTES) {
    problems.push(`直接引述 ${quotes.length} 段，超過上限 ${MAX_QUOTES} 段`);
  }
  for (const quote of quotes) {
    if (countWords(quote) > MAX_QUOTE_WORDS || countHan(quote) > MAX_QUOTE_HAN) {
      problems.push(`直接引述過長：「${quote.slice(0, 40)}…」`);
    }
  }

  if (new RegExp(`^##\\s*${EDITOR_NOTE_HEADING}`, 'm').test(body)) {
    problems.push('正文不得包含編者觀點段落（由站長撰寫）');
  }
  return problems;
}
