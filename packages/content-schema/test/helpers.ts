import { cp, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

export const VALID_FIXTURE = path.join(import.meta.dirname, 'fixtures', 'valid');
export const REPO_CONTENT = path.join(import.meta.dirname, '..', '..', '..', 'content');

/** 把 `source` 複製到新的暫存目錄並回傳路徑，讓測試可以任意修改。 */
export async function copyToTemp(source: string): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'content-schema-'));
  await cp(source, dir, { recursive: true });
  return dir;
}

/** 以字串取代修改檔案；找不到 `search` 時拋錯，避免測試靜默失效。 */
export async function editFile(file: string, search: string | RegExp, replace: string) {
  const text = await readFile(file, 'utf8');
  const next = text.replace(search, replace);
  if (next === text) throw new Error(`editFile: ${file} 中找不到 ${String(search)}`);
  await writeFile(file, next);
}
