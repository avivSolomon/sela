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

function numberInputs(page: Page) {
  return page.locator('input[type=number]');
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

    await numberInputs(page).first().fill('4');

    await expect(payment).not.toHaveText(before);
  });

  test('saves a mix and loads it again after a reload', async ({ page }) => {
    await openMortgagePage(page);

    await numberInputs(page).first().fill('5');
    await page.getByLabel('שם התמהיל').fill('תוכנית בדיקה');
    await page.getByRole('button', { name: 'שמירת תמהיל' }).click();
    await expect(page.getByText('נשמר.')).toBeVisible();

    await page.reload();
    await page.getByRole('link', { name: 'משכנתא' }).click();

    // the work in progress survives the reload...
    await expect(numberInputs(page).first()).toHaveValue('5');

    // ...and so does the named mix, which can be loaded again
    await page.getByRole('button', { name: 'התחלה מחדש' }).click();
    await expect(numberInputs(page).first()).toHaveValue('6');
    await page.getByRole('button', { name: /התמהיל הנוכחי/ }).click();
    await page.getByText('תוכנית בדיקה').last().click();
    await expect(numberInputs(page).first()).toHaveValue('5');
  });

  test('asks for a name before saving', async ({ page }) => {
    await openMortgagePage(page);

    await page.getByRole('button', { name: 'שמירת תמהיל' }).click();

    await expect(
      page.getByText('הזינו שם לתמהיל כדי לשמור אותו.'),
    ).toBeVisible();
  });
});
