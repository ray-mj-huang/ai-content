import { readFile } from 'node:fs/promises';
import path from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import { CATEGORIES, type Category } from '@ai-content/content-schema';

export const MODEL = 'claude-opus-5-5';
const MAX_TOKENS = 16_000;
const PROMPTS_DIR = path.join(import.meta.dirname, '..', 'prompts');

export interface LlmRequest {
  system: string;
  user: string;
}

/** LLM 呼叫介面：回傳模型輸出的原始 JSON 字串。測試以假實作替換。 */
export interface LlmClient {
  generate(request: LlmRequest): Promise<string>;
}

export interface LlmOutput {
  title: string;
  summary: string;
  body: string;
  category: Category;
  tags: string[];
}

export interface PromptInput {
  personName: string;
  sourceTitle: string;
  sourceUrl: string;
  published: string;
  sourceText: string;
}

/** 讀取 `prompts/` 的範本並填入變數。 */
export async function buildRequest(input: PromptInput): Promise<LlmRequest> {
  const [system, template] = await Promise.all([
    readFile(path.join(PROMPTS_DIR, 'system.md'), 'utf8'),
    readFile(path.join(PROMPTS_DIR, 'user.md'), 'utf8'),
  ]);
  const values: Record<string, string> = {
    person_name: input.personName,
    source_title: input.sourceTitle,
    source_url: input.sourceUrl,
    published: input.published,
    source_text: input.sourceText,
  };
  // 單次替換，避免原文中剛好出現 {{...}} 時被二次展開。
  const user = template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => values[key] ?? match);
  return { system, user };
}

export const OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    summary: { type: 'string' },
    body: { type: 'string' },
    category: { type: 'string', enum: [...CATEGORIES] },
    tags: { type: 'array', items: { type: 'string' } },
  },
  required: ['title', 'summary', 'body', 'category', 'tags'],
  additionalProperties: false,
} as const;

/** 解析並檢查模型輸出；格式不符時拋出說明原因的錯誤。 */
export function parseLlmOutput(raw: string): LlmOutput {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(`LLM 輸出不是合法 JSON：${raw.slice(0, 80)}`);
  }
  if (typeof data !== 'object' || data === null) throw new Error('LLM 輸出不是 JSON 物件');
  const record = data as Record<string, unknown>;

  for (const field of ['title', 'summary', 'body', 'category'] as const) {
    if (typeof record[field] !== 'string' || record[field].trim() === '') {
      throw new Error(`LLM 輸出缺少欄位或不是字串：${field}`);
    }
  }
  if (!(CATEGORIES as readonly string[]).includes(record.category as string)) {
    throw new Error(`LLM 輸出的分類不在清單中：${String(record.category)}`);
  }
  const tags = record.tags;
  if (!Array.isArray(tags) || !tags.every((tag) => typeof tag === 'string')) {
    throw new Error('LLM 輸出的 tags 不是字串陣列');
  }

  return {
    title: (record.title as string).trim(),
    summary: (record.summary as string).trim(),
    body: (record.body as string).trim(),
    category: record.category as Category,
    tags,
  };
}

/** Claude API 實作。金鑰由 SDK 從環境變數讀取，不經過本程式的任何字串。 */
export function createClaudeClient(): LlmClient {
  const client = new Anthropic();
  return {
    async generate({ system, user }) {
      const response = await client.beta.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        // 被安全分類器拒答時，由 API 自動改用其他模型重跑。
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: {
          effort: 'medium',
          format: { type: 'json_schema', schema: OUTPUT_SCHEMA },
        },
        system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: user }],
      });

      if (response.stop_reason === 'refusal') {
        throw new Error(`模型拒絕處理（${response.stop_details?.category ?? '未提供分類'}）`);
      }
      if (response.stop_reason === 'max_tokens') throw new Error('模型輸出超過 max_tokens 被截斷');
      const text = response.content.find((block) => block.type === 'text');
      if (!text || text.type !== 'text') throw new Error('模型沒有回傳文字內容');
      return text.text;
    },
  };
}
