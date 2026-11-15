export type PrintData = {
  title: string;
  subtitle: string;
  summary: { label: string; value: string }[];
  tracksTitle: string;
  trackHeads: string[];
  trackRows: string[][];
  scheduleTitle: string;
  scheduleHeads: string[];
  scheduleRows: string[][];
  footer: string;
};

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function table(heads: string[], rows: string[][]): string {
  const head = heads.map(h => `<th>${escapeHtml(h)}</th>`).join('');
  const body = rows
    .map(
      row => `<tr>${row.map(c => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`,
    )
    .join('');
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

/**
 * A self-contained, print-ready (and "Save as PDF"-ready) page for a mortgage
 * mix. All text is passed in already translated and formatted.
 */
export function buildPrintHtml(data: PrintData): string {
  const summary = data.summary
    .map(
      item =>
        `<div class="card"><div class="label">${escapeHtml(item.label)}</div><div class="value">${escapeHtml(item.value)}</div></div>`,
    )
    .join('');

  return `<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<title>${escapeHtml(data.title)}</title>
<style>
  body { font-family: Arial, 'Segoe UI', sans-serif; color: #1a1a1a; margin: 24px; }
  h1 { font-size: 24px; margin: 0 0 4px; }
  h2 { font-size: 18px; margin: 28px 0 8px; }
  .sub { color: #555; margin-bottom: 16px; }
  .cards { display: flex; flex-wrap: wrap; gap: 10px; }
  .card { border: 1px solid #bbb; border-radius: 6px; padding: 8px 14px; min-width: 150px; }
  .label { font-size: 12px; color: #555; }
  .value { font-size: 18px; font-weight: 700; }
  table { width: 100%; border-collapse: collapse; margin-top: 6px; }
  th, td { border-bottom: 1px solid #ccc; padding: 5px 8px; text-align: right; font-size: 13px; font-variant-numeric: tabular-nums; }
  th { background: #f0f0f0; }
  .foot { margin-top: 24px; font-size: 11px; color: #666; }
  @media print { body { margin: 10mm; } h2 { break-after: avoid; } tr { break-inside: avoid; } }
</style>
</head>
<body>
<h1>${escapeHtml(data.title)}</h1>
<div class="sub">${escapeHtml(data.subtitle)}</div>
<div class="cards">${summary}</div>
<h2>${escapeHtml(data.tracksTitle)}</h2>
${table(data.trackHeads, data.trackRows)}
<h2>${escapeHtml(data.scheduleTitle)}</h2>
${table(data.scheduleHeads, data.scheduleRows)}
<div class="foot">${escapeHtml(data.footer)}</div>
<script>window.addEventListener('load', function () { setTimeout(function () { window.print(); }, 300); });</script>
</body>
</html>`;
}
