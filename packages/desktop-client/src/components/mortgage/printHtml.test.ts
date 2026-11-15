import { describe, expect, it } from 'vitest';

import { buildPrintHtml, escapeHtml } from './printHtml';
import type { PrintData } from './printHtml';

const data: PrintData = {
  title: 'מחשבון <משכנתא>',
  subtitle: '15.11.2026',
  summary: [{ label: 'החזר חודשי', value: '₪5,739' }],
  tracksTitle: 'מסלולים',
  trackHeads: ['מסלול', 'סכום'],
  trackRows: [
    ['פריים', '₪400,000'],
    ['<img src=x onerror=alert(1)>', '₪1'],
  ],
  scheduleTitle: 'לוח סילוקין',
  scheduleHeads: ['שנה', 'החזר'],
  scheduleRows: [['1', '₪68,000']],
  footer: 'סלע',
};

describe('buildPrintHtml', () => {
  const html = buildPrintHtml(data);

  it('is a right-to-left Hebrew page', () => {
    expect(html).toContain('<html lang="he" dir="rtl">');
    expect(html).toContain('<meta charset="utf-8">');
  });

  it('contains the summary, tracks and schedule', () => {
    expect(html).toContain('₪5,739');
    expect(html).toContain('<h2>מסלולים</h2>');
    expect(html).toContain('<h2>לוח סילוקין</h2>');
    expect(html.match(/<tr>/g)).toHaveLength(2 /* heads */ + 2 + 1);
  });

  it('escapes anything typed by the user', () => {
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('מחשבון &lt;משכנתא&gt;');
  });

  it('prints itself when it loads', () => {
    expect(html).toContain('window.print()');
  });
});

describe('escapeHtml', () => {
  it('escapes the five special characters', () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;',
    );
  });
});
