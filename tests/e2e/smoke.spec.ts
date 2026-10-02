import { expect, test } from '@playwright/test';
import { litShare } from './pixels';
import { SYNTHETIC_PATIENT } from './global-setup';

test('the demo study opens and the 3D view renders', async ({ page }) => {
  await page.goto('/');
  const recent = page.getByRole('region', { name: 'Recent studies' });
  await recent.getByRole('button', { name: /Jane/ }).click();
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

test('only the imported demo study is flagged as the demo', async ({
  request,
}) => {
  const library = await (await request.get('/api/library')).json();
  const nameOf = (id: string) =>
    library.patients.find((p: { id: string }) => p.id === id).name;
  const flags = library.studies.map(
    (s: { patient_id: string; teachingCase: string | null }) => [
      nameOf(s.patient_id),
      s.teachingCase,
    ],
  );
  expect(flags).toContainEqual(['Jane', 'jane']);
  expect(flags).toContainEqual([SYNTHETIC_PATIENT, null]);
});
