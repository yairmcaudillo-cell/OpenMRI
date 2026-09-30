import { expect, test, type Page } from '@playwright/test';
import { SYNTHETIC_PATIENT } from './global-setup';

async function openStudy(page: Page, patient: RegExp | string) {
  await page.goto('/');
  await page
    .getByRole('region', { name: 'Recent studies' })
    .getByRole('button', { name: patient })
    .click();
  await expect(page.getByText('Study open')).toBeVisible({ timeout: 60_000 });
  // The entering transition covers the page for up to 6.5 s.
  await expect(page.locator('.intro')).toHaveCount(0, { timeout: 20_000 });
}

/** The focus position shown in the viewer footer, in mm. */
async function readout(page: Page) {
  const text = await page.locator('.coordinate-readout').innerText();
  const values = [...text.matchAll(/[XYZ]\s+(-?\d+(?:\.\d+)?)/g)].map((m) =>
    Number(m[1]),
  );
  expect(values).toHaveLength(3);
  return values;
}
async function expectFocusAt(page: Page, point: number[]) {
  await expect
    .poll(
      async () => {
        const at = await readout(page);
        return Math.max(...at.map((v, i) => Math.abs(v - point[i])));
      },
      { timeout: 30_000 },
    ) // a series switch reloads the volume first
    .toBeLessThanOrEqual(1);
}

const panel = (page: Page) =>
  page.getByRole('complementary', { name: 'Learning mode' });

async function startLearning(
  page: Page,
  track: 'Undergraduate' | 'Medical student',
) {
  await openStudy(page, /Jane/);
  await page.getByRole('button', { name: 'Learn' }).click();
  await panel(page)
    .getByRole('button', { name: new RegExp(track) })
    .click();
}

test('learning mode is not offered on a study that is not the demo', async ({
  page,
}) => {
  await openStudy(page, SYNTHETIC_PATIENT);
  await expect(page.getByRole('button', { name: 'Library' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Learn' })).toHaveCount(0);
});

test('the first visit asks for a track and remembers it', async ({ page }) => {
  await openStudy(page, /Jane/);
  await page.getByRole('button', { name: 'Learn' }).click();
  await expect(
    panel(page).getByRole('heading', { name: 'Who is learning?' }),
  ).toBeVisible();
  await panel(page)
    .getByRole('button', { name: /Undergraduate/ })
    .click();
  await expect(
    panel(page).getByRole('button', { name: 'Undergraduate', pressed: true }),
  ).toBeVisible();
  // A new visit in the same browser: the choice comes from storage.
  await openStudy(page, /Jane/);
  await page.getByRole('button', { name: 'Learn' }).click();
  await expect(
    panel(page).getByRole('heading', { name: 'Who is learning?' }),
  ).toHaveCount(0);
  await expect(
    panel(page).getByRole('button', { name: 'Undergraduate', pressed: true }),
  ).toBeVisible();
});

test('a landmark moves the focus to its point on the reference series', async ({
  page,
}) => {
  await startLearning(page, 'Undergraduate');
  await expect(panel(page).getByText(/not a normal reference/)).toBeVisible();
  await panel(page)
    .getByRole('button', { name: /Inside the brain/ })
    .click();
  await panel(page)
    .getByRole('button', { name: /Thalamus \(right\)/ })
    .click();
  // The demo opens on 01 +C Axial MPRAGE; lessons are placed on 02.
  await expect(
    page.getByRole('heading', { name: /02 Axial MPRAGE/ }),
  ).toBeVisible({ timeout: 60_000 });
  await expectFocusAt(page, [12, -18, -3]);
  await expect(
    panel(page).getByText('Draft, not reviewed').first(),
  ).toBeVisible();

  // Same series: the jump is immediate.
  await panel(page).getByRole('button', { name: 'Next landmark' }).click();
  await expect(
    panel(page).getByRole('heading', { name: 'Caudate nucleus, head (right)' }),
  ).toBeVisible();
  await expectFocusAt(page, [17, 10, 4]);
  await panel(page).getByRole('button', { name: 'Previous landmark' }).click();
  await expectFocusAt(page, [12, -18, -3]);
  await page.screenshot({ path: 'test-results/learning-panel.png' });
});

test('each track shows its own landmarks and switching keeps the position', async ({
  page,
}) => {
  await startLearning(page, 'Undergraduate');
  await panel(page)
    .getByRole('button', { name: /Inside the brain/ })
    .click();
  await expect(
    panel(page).getByRole('button', { name: /Putamen/ }),
  ).toHaveCount(0);
  await panel(page)
    .getByRole('button', { name: /Hippocampus/ })
    .click();
  await expectFocusAt(page, [28, -22, -18]);

  await panel(page).getByRole('button', { name: 'Medical student' }).click();
  await expect(
    panel(page).getByRole('button', { name: /Putamen/ }),
  ).toBeVisible();
  await expect(panel(page).getByText(/episodic memory/)).toBeVisible();
  await expectFocusAt(page, [28, -22, -18]);
});
