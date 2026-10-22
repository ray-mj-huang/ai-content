/** 抓取網址並回傳文字內容。測試以假實作替換，確保不連網。 */
export type FetchText = (url: string) => Promise<string>;

const TIMEOUT_MS = 30_000;
const USER_AGENT = 'ai-content-pipeline/0.0 (+https://github.com/ray-mj-huang/ai-content)';

export const fetchText: FetchText = async (url) => {
  const response = await fetch(url, {
    headers: { 'user-agent': USER_AGENT },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}：${url}`);
  return response.text();
};
