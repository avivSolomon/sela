import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

// Set E2E_CHANNEL=chrome (or msedge) to use an installed browser instead of
// the bundled Chromium.
test.use({ channel: process.env.E2E_CHANNEL });

async function openMortgagePage(page: Page) {
  await page.goto('/');
  await page.getByRole('link', { name: 'משכנתא' }).click();
  await expect(page.getByText('מחשבון משכנתא').first()).toBeVisible({
    timeout: 60_000,
  });
}

function primeInput(page: Page) {
  // The dashboard's income field comes first in the page, so find the prime by its label.
  return page.getByLabel('ריבית הפריים (%)');
}

test.describe('Mortgage calculator', () => {
  test('shows the default mix with CPI linkage', async ({ page }) => {
    await openMortgagePage(page);

    await expect(page.getByText('החזר חודשי (חודש ראשון)')).toBeVisible();
    await expect(page.getByText('תוספת הצמדה למדד')).toBeVisible();
    // three default tracks
    await expect(page.getByRole('button', { name: 'הסרה' })).toHaveCount(3);
  });

  test('re-prices the loan when the prime changes', async ({ page }) => {
    await openMortgagePage(page);
    const payment = page.getByText('החזר חודשי (חודש ראשון)').locator('..');
    const before = await payment.innerText();

    await primeInput(page).fill('4');

    await expect(payment).not.toHaveText(before);
  });

  test('saves a mix and loads it again after a reload', async ({ page }) => {
    await openMortgagePage(page);

    await primeInput(page).fill('5');
    await page.getByLabel('שם התמהיל').fill('תוכנית בדיקה');
    await page.getByRole('button', { name: 'שמירת תמהיל' }).click();
    await expect(page.getByText('נשמר.')).toBeVisible();

    await page.reload();
    await page.getByRole('link', { name: 'משכנתא' }).click();

    // the work in progress survives the reload...
    await expect(primeInput(page)).toHaveValue('5');

    // ...and so does the named mix, which can be loaded again
    await page.getByRole('button', { name: 'התחלה מחדש' }).click();
    await expect(primeInput(page)).toHaveValue('6');
    await page.getByRole('button', { name: /התמהיל הנוכחי/ }).click();
    await page.getByText('תוכנית בדיקה').last().click();
    await expect(primeInput(page)).toHaveValue('5');
  });

  test('asks for a name before saving', async ({ page }) => {
    await openMortgagePage(page);

    await page.getByRole('button', { name: 'שמירת תמהיל' }).click();

    await expect(
      page.getByText('הזינו שם לתמהיל כדי לשמור אותו.'),
    ).toBeVisible();
  });

  test('imports a CPI table from a file', async ({ page }) => {
    await openMortgagePage(page);
    await page.getByRole('button', { name: /מתקדם/ }).click();

    await page.locator('input[type=file]').setInputFiles({
      name: 'cpi.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(
        'month,cpi\n2024-01,0.3\n2024-02,0.1\n2024-03,-0.2\n',
      ),
    });

    await expect(page.getByText('יובאו 3 חודשי מדד.')).toBeVisible();
    await expect(page.getByLabel('טבלת מדד', { exact: true })).toHaveValue('0.3, 0.1, -0.2');
  });

  test('compares the current mix with a saved one', async ({ page }) => {
    await openMortgagePage(page);
    await expect(
      page.getByText('שמרו לפחות תמהיל אחד כדי להשוות'),
    ).toBeVisible();

    await page.getByLabel('שם התמהיל').fill('תמהיל בסיס');
    await page.getByRole('button', { name: 'שמירת תמהיל' }).click();
    await expect(page.getByText('נשמר.')).toBeVisible();

    await primeInput(page).fill('3');

    await expect(page.getByText('השוואת התמהיל הנוכחי עם')).toBeVisible();
    await expect(page.getByText('הפרש')).toBeVisible();
    await expect(
      page.getByText(/גבוה ב-₪.* בתמהיל האחר/).first(),
    ).toBeVisible();
  });

  test('exports the amortization schedule as an Excel-ready CSV', async ({
    page,
  }) => {
    await openMortgagePage(page);

    const download = page.waitForEvent('download');
    await page
      .getByRole('button', { name: 'ייצוא לוח סילוקין (Excel / CSV)' })
      .click();
    const file = await (await download).createReadStream();

    const chunks: Buffer[] = [];
    for await (const chunk of file) chunks.push(chunk as Buffer);
    const bytes = Buffer.concat(chunks);

    expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]); // UTF-8 BOM
    const lines = bytes.toString('utf8').replace(/^﻿/, '').split(/\r?\n/);
    expect(lines[0]).toBe('מסלול,חודש,ריבית,הצמדה למדד,תשלום,ריבית,קרן,יתרה');
    expect(lines.length).toBeGreaterThan(800); // 300 + 300 + 240 months
  });

  test('opens a printable page for saving as PDF', async ({ page }) => {
    await openMortgagePage(page);

    const popup = page.waitForEvent('popup');
    await page.getByRole('button', { name: 'הדפסה או שמירה כ-PDF' }).click();
    const printPage = await popup;

    await expect(printPage.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(printPage.getByText('לוח סילוקין')).toBeVisible();
    await expect(printPage.getByText('החזר חודשי (חודש ראשון)')).toBeVisible();
  });

  test('shows the balance chart', async ({ page }) => {
    await openMortgagePage(page);

    await expect(
      page.getByRole('img', { name: 'יתרה והחזר חודשי לאורך השנים' }),
    ).toBeVisible();
  });
});
