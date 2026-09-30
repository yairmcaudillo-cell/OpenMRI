import { expect, test, type Page } from '@playwright/test';

const ORIGIN = 'http://127.0.0.1:4175';

/** Opens the demo and records every request and CSP complaint. */
async function open(page: Page) {
  const requests: string[] = [];
  const cspErrors: string[] = [];
  page.on('request', (r) => requests.push(r.url()));
  page.on('console', (m) => {
    if (/Content Security Policy/i.test(m.text())) cspErrors.push(m.text());
  });
  await page.goto('./');
  await expect(page.getByText('Study open')).toBeVisible({ timeout: 90_000 });
  return { requests, cspErrors };
}
const panel = (page: Page) =>
  page.getByRole('complementary', { name: 'Learning mode' });

test('opens straight into learning mode, with no way to import or reach a server', async ({
  page,
}) => {
  await open(page);
  await expect(
    panel(page).getByRole('heading', { name: 'Who is learning?' }),
  ).toBeVisible();
  for (const name of [
    'Import MRI',
    'Library',
    'Focus over time',
    'Edit patient details',
  ])
    await expect(page.getByRole('button', { name })).toHaveCount(0);
  await expect(page.locator('input[type=file]')).toHaveCount(0);
  // The badge is hidden by the header's responsive CSS at this width, as locally.
  await expect(page.getByText('Runs in your browser')).toBeAttached();
  await expect(
    page.locator('meta[http-equiv="Content-Security-Policy"]'),
  ).toHaveAttribute('content', /connect-src 'self'/);
});

test('a lesson works end to end, and every request stays on this site', async ({
  page,
}) => {
  const { requests, cspErrors } = await open(page);
  await panel(page)
    .getByRole('button', { name: /Undergraduate/ })
    .click();
  await panel(page)
    .getByRole('button', { name: /Inside the brain/ })
    .click();
  await panel(page)
    .getByRole('button', { name: /Thalamus \(right\)/ })
    .click();
  await expect(
    page.getByRole('heading', { name: /02 Axial MPRAGE/ }),
  ).toBeVisible({
    timeout: 90_000,
  });
  await expect(page.locator('.coordinate-readout')).toContainText('12.0', {
    timeout: 60_000,
  });
  await expect(page.locator('.coordinate-readout')).toContainText('-18.0');

  await panel(page).getByRole('button', { name: 'Medical student' }).click();
  await panel(page)
    .getByRole('button', { name: /All lessons/ })
    .click();
  await panel(page)
    .getByRole('button', { name: /FLAIR: T2 with the water nulled/ })
    .click();
  await panel(page)
    .getByRole('button', { name: /Fluid in a ventricle/ })
    .click();
  await expect(
    page
      .getByRole('combobox', { name: 'Series to compare' })
      .locator('option:checked'),
  ).toHaveText('04 Axial T2 FLAIR', { timeout: 90_000 });
  await expect(page.getByText('Study open')).toBeVisible({ timeout: 90_000 });

  expect(requests.length).toBeGreaterThan(5);
  expect(
    requests.filter(
      (u) =>
        !u.startsWith(ORIGIN + '/') &&
        !u.startsWith('blob:') &&
        !u.startsWith('data:'),
    ),
  ).toEqual([]);
  expect(requests.filter((u) => u.includes('/api/'))).toEqual([]);
  expect(cspErrors).toEqual([]);
});

test('a quiz runs, and a snapshot downloads instead of going to a server', async ({
  page,
}) => {
  await open(page);
  await panel(page)
    .getByRole('button', { name: /Undergraduate/ })
    .click();
  await panel(page)
    .getByRole('button', { name: /The brainstem/ })
    .click();
  await panel(page).getByRole('button', { name: 'Quiz' }).click();
  await panel(page).getByRole('button', { name: 'Start the quiz' }).click();
  const quiz = panel(page).getByRole('region', { name: 'Quiz' });
  await expect(quiz.getByText(/Question 1 of/)).toBeVisible();
  await quiz.getByRole('button', { name: 'Skip' }).click();
  await expect(quiz.getByText(/Not quite/)).toBeVisible();
  // Starting the quiz opened the lesson's series; Snapshot waits for the load.
  await expect(
    page.getByRole('heading', { name: /02 Axial MPRAGE/ }),
  ).toBeVisible();
  await expect(page.getByText('Study open')).toBeVisible({ timeout: 90_000 });

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save a PNG snapshot' }).click();
  expect((await download).suggestedFilename()).toMatch(/^OpenMRI-.*\.png$/);
  await page.screenshot({ path: 'test-results/online-demo.png' });
});
