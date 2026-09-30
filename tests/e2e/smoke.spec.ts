import { expect, test } from '@playwright/test';
import { litShare } from './pixels';

test('the demo study opens and the 3D view renders', async ({ page }) => {
  await page.goto('/');
  const recent = page.getByRole('region', { name: 'Recent studies' });
  await recent.getByRole('button').first().click();
  const viewer = page.getByRole('region', { name: 'MRI viewer' });
  const canvas = viewer.locator('canvas').first();
  await expect(canvas).toBeVisible();
  // WebGL 2 must draw the head: a black or blank canvas fails.
  await expect
    .poll(() => litShare(page, canvas), { timeout: 60_000 })
    .toBeGreaterThan(0.05);
  await page.screenshot({ path: 'test-results/smoke-viewer.png' });
});

test('the pixel check reports a blank element as blank', async ({ page }) => {
  await page.setContent(
    '<div id="blank" style="width:200px;height:200px;background:#000"></div>',
  );
  expect(await litShare(page, page.locator('#blank'))).toBe(0);
});

test('the imported demo study is flagged as the demo', async ({ request }) => {
  const library = await (await request.get('/api/library')).json();
  expect(library.studies.length).toBeGreaterThan(0);
  expect(library.studies.every((s: { demo: boolean }) => s.demo)).toBe(true);
});
