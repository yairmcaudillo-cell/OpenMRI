import { expect, test } from '@playwright/test';

test('a sequence lesson shows two series side by side at the landmark', async ({
  page,
}) => {
  await page.goto('/');
  await page
    .getByRole('region', { name: 'Recent studies' })
    .getByRole('button', { name: /Jane/ })
    .click();
  await expect(page.getByText('Study open')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('.intro')).toHaveCount(0, { timeout: 20_000 });
  await page.getByRole('button', { name: 'Learn' }).click();
  const panel = page.getByRole('complementary', { name: 'Learning mode' });
  await panel.getByRole('button', { name: /Medical student/ }).click();
  await panel
    .getByRole('button', { name: /FLAIR: T2 with the water nulled/ })
    .click();
  await panel.getByRole('button', { name: /Fluid in a ventricle/ }).click();

  await expect(page.getByRole('heading', { name: /03 Axial T2/ })).toBeVisible({
    timeout: 60_000,
  });
  const compare = page.getByRole('combobox', { name: 'Series to compare' });
  await expect(compare.locator('option:checked')).toHaveText(
    '04 Axial T2 FLAIR',
  );
  await expect(page.getByText('Study open')).toBeVisible({ timeout: 60_000 });
  await expect
    .poll(
      async () => {
        const text = await page.locator('.coordinate-readout').innerText();
        const at = [...text.matchAll(/[XYZ]\s+(-?\d+(?:\.\d+)?)/g)].map((m) =>
          Number(m[1]),
        );
        return Math.max(...at.map((v, i) => Math.abs(v - [11, 10, 2][i])));
      },
      { timeout: 30_000 },
    )
    .toBeLessThanOrEqual(1);
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'test-results/sequence-lesson.png' });
});
