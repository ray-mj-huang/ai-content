export interface ReportItem {
  /** 來源項目網址，或 `<person>/<source_id>` 表示整個來源。 */
  source: string;
  title?: string;
  /** 產出的檔案路徑。 */
  file?: string;
  reason?: string;
}

export interface RunReport {
  dryRun: boolean;
  created: ReportItem[];
  /** dry-run 時會處理的項目。 */
  planned: ReportItem[];
  skipped: ReportItem[];
  failed: ReportItem[];
  /** 已存在於 content/ 而略過的項目數。 */
  alreadyKnown: number;
}

export function emptyReport(dryRun: boolean): RunReport {
  return { dryRun, created: [], planned: [], skipped: [], failed: [], alreadyKnown: 0 };
}

function section(
  heading: string,
  items: ReportItem[],
  render: (item: ReportItem) => string,
): string[] {
  if (items.length === 0) return [];
  return [`### ${heading}（${items.length}）`, '', ...items.map((item) => `- ${render(item)}`), ''];
}

const link = (item: ReportItem) => (item.title ? `[${item.title}](${item.source})` : item.source);

export function renderReport(report: RunReport): string {
  const lines = [
    report.dryRun ? '## 生產線執行報告（dry-run）' : '## 生產線執行報告',
    '',
    `新增 ${report.created.length} 篇、略過 ${report.skipped.length} 項、失敗 ${report.failed.length} 項；已存在 ${report.alreadyKnown} 項。`,
    '',
    ...section('新增', report.created, (item) => `${link(item)} → \`${item.file}\``),
    ...section('將處理（dry-run）', report.planned, link),
    ...section('略過', report.skipped, (item) => `${link(item)}：${item.reason}`),
    ...section('失敗', report.failed, (item) => `${link(item)}：${item.reason}`),
  ];
  return lines.join('\n');
}
