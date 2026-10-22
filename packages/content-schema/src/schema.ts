import { z } from 'zod';
import { CATEGORIES, POST_STATUSES, SOURCE_TYPES } from './constants.ts';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const slugSchema = z
  .string()
  .regex(SLUG_PATTERN, '只能使用小寫英數字與連字號，且不可以連字號開頭或結尾');

// YAML 會把未加引號的日期解析成 Date 物件；統一轉回字串再驗證格式。
const isoDate = z.preprocess(
  (value) => (value instanceof Date ? value.toISOString().slice(0, 10) : value),
  z.iso.date(),
);

const isoDateTime = z.preprocess(
  (value) => (value instanceof Date ? value.toISOString() : value),
  z.iso.datetime({ offset: true }),
);

export const linkSchema = z.strictObject({
  label: z.string().min(1),
  url: z.url(),
});

export const sourceSchema = z.strictObject({
  id: slugSchema,
  type: z.enum(SOURCE_TYPES),
  url: z.url(),
  label: z.string().min(1).optional(),
});

export const personSchema = z
  .strictObject({
    slug: slugSchema,
    name: z.string().min(1),
    name_zh: z.string().min(1).optional(),
    bio: z.string().min(1),
    links: z.array(linkSchema).optional(),
    sources: z.array(sourceSchema).min(1),
    tags: z.array(z.string().min(1)).optional(),
    active: z.boolean(),
  })
  .superRefine((person, ctx) => {
    const seen = new Set<string>();
    person.sources.forEach((source, index) => {
      if (seen.has(source.id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['sources', index, 'id'],
          message: `來源 id「${source.id}」在此人物內重複`,
        });
      }
      seen.add(source.id);
    });
  });

export const postSchema = z.strictObject({
  slug: slugSchema,
  title: z.string().min(1),
  date: isoDate,
  created_at: isoDateTime,
  status: z.enum(POST_STATUSES),
  person: slugSchema,
  source_id: slugSchema,
  source_url: z.url(),
  source_title: z.string().min(1),
  category: z.enum(CATEGORIES),
  tags: z.array(slugSchema).optional(),
  starred: z.boolean(),
  summary: z.string().min(1),
});

export type Link = z.infer<typeof linkSchema>;
export type Source = z.infer<typeof sourceSchema>;
export type Person = z.infer<typeof personSchema>;
export type Post = z.infer<typeof postSchema>;
export type Category = (typeof CATEGORIES)[number];
export type PostStatus = (typeof POST_STATUSES)[number];
export type SourceType = (typeof SOURCE_TYPES)[number];
