import { expect, test, type Page } from '@playwright/test';
import { GLIOMA } from './global-setup';
import { blueShare } from './pixels';

test.skip(!GLIOMA, 'the glioma case needs the internet once');

const panel = (page: Page) =>
  page.getByRole('complementary', { name: 'Learning mode' });

async function openLesson(page: Page) {
  await page.goto('/');
  await page
    .getByRole('region', { name: 'Recent studies' })
    .getByRole('button', { name: /Glioma teaching case/ })
    .click();
  await expect(page.getByText('Study open')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('.intro')).toHaveCount(0, { timeout: 20_000 });
  await page.getByRole('button', { name: 'Learn' }).click();
  await panel(page)
    .getByRole('button', { name: /Medical student/ })
    .click();
  await expect(panel(page).getByText(/not about this person/)).toBeVisible();
  // Only the glioma case's lessons are listed.
  await expect(
    panel(page).getByRole('button', { name: /Brainstem/ }),
  ).toHaveCount(0);
  await panel(page)
    .getByRole('button', { name: /Glioma on MRI/ })
    .click();
}

test('the glioma lesson draws the expert outline on the slices and in 3D', async ({
  page,
}) => {
  test.setTimeout(300_000);
  await openLesson(page);
  const legend = panel(page).getByRole('region', { name: 'Expert outline' });
  await expect(legend.getByRole('row')).toHaveCount(4); // header + 3 regions
  const credit = panel(page).getByRole('link', {
    name: /Medical Segmentation Decathlon/,
  });
  await expect(credit).toHaveAttribute('href', 'https://medicaldecathlon.com');
  await expect(panel(page).getByText(/CC BY-SA 4\.0/)).toBeVisible();
  const download = legend.getByRole('link', {
    name: 'Download the Enhancing tumour 3D model (STL)',
  });
  await expect(download).toHaveAttribute('download', 'enhancing-tumour.stl');
  const href = await download.getAttribute('href');
  const stl = await page.request.get(href!);
  expect(stl.ok()).toBe(true);
  const body = await stl.body();
  expect(body.length).toBe(84 + 50 * body.readUInt32LE(80));

  // The study opens on another series, so the outline is added, then removed
  // with it by the series load, then added again.
  await expect
    .poll(() => blueShare(page, page.getByLabel(/Three MRI slices/)), {
      timeout: 60_000,
    })
    .toBeGreaterThan(0.0005);
  await panel(page).getByRole('button', { name: 'Enhancing rim' }).click();
  await expect(page.getByRole('heading', { name: /03 T1 \+C/ })).toBeVisible({
    timeout: 60_000,
  });
  const slices = page.getByLabel(/Three MRI slices/);
  const render = page.getByLabel(/3D volume rendering/);
  // Blue is the enhancing tumour; nothing else on the page is blue.
  await expect
    .poll(() => blueShare(page, slices), { timeout: 60_000 })
    .toBeGreaterThan(0.002);
  await page.screenshot({ path: 'test-results/glioma-lesson.png' });
  // The lesson compares two series side by side; the 3D view has its own mode.
  await page.getByRole('tab', { name: 'Volume + slices' }).click();
  // Seen through the translucent edema the models are a muted blue.
  await expect
    .poll(() => blueShare(page, render), { timeout: 60_000 })
    .toBeGreaterThan(0.0002);
  const models = await blueShare(page, render);
  await page.screenshot({ path: 'test-results/glioma-3d.png' });

  await legend
    .getByRole('checkbox', {
      name: 'Enhancing tumour on the slices',
      exact: true,
    })
    .uncheck();
  await expect
    .poll(() => blueShare(page, slices), { timeout: 30_000 })
    .toBeLessThan(0.0005);
  await legend
    .getByRole('checkbox', { name: 'Enhancing tumour in 3D', exact: true })
    .uncheck();
  await expect
    .poll(() => blueShare(page, render), { timeout: 30_000 })
    .toBeLessThan(models / 3);
  await legend
    .getByRole('checkbox', {
      name: 'Enhancing tumour on the slices',
      exact: true,
    })
    .check();
  await expect
    .poll(() => blueShare(page, slices), { timeout: 30_000 })
    .toBeGreaterThan(0.002);

  // Leaving the lesson removes the outline.
  await panel(page).getByRole('button', { name: 'All lessons' }).click();
  await expect
    .poll(() => blueShare(page, slices), { timeout: 30_000 })
    .toBeLessThan(0.0005);
});
