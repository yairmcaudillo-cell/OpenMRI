import { expect, test, type Page } from '@playwright/test';

async function openLesson(page: Page, track: RegExp) {
  await page.goto('/');
  await page
    .getByRole('region', { name: 'Recent studies' })
    .getByRole('button', { name: /Jane/ })
    .click();
  await expect(page.getByText('Study open')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('.intro')).toHaveCount(0, { timeout: 20_000 });
  await page.getByRole('button', { name: 'Learn' }).click();
  const panel = page.getByRole('complementary', { name: 'Learning mode' });
  await panel.getByRole('button', { name: track }).click();
  await panel
    .getByRole('button', { name: /Inside the brain|Ventricles/ })
    .click();
  return panel;
}

test('undergraduates get definitions on keyboard focus, and Escape hides them', async ({
  page,
}) => {
  const panel = await openLesson(page, /Undergraduate/);
  const term = panel.getByRole('button', { name: 'ventricles' });
  await term.focus();
  const tip = panel.getByRole('tooltip');
  await expect(tip).toBeVisible();
  await expect(tip).toContainText('fluid-filled spaces');
  await expect(term).toHaveAccessibleDescription(/fluid-filled spaces/);
  await page.keyboard.press('Escape');
  await expect(tip).toBeHidden();
  await term.hover();
  await expect(panel.getByRole('tooltip')).toBeVisible();
});

test('medical students have definitions off until they turn them on', async ({
  page,
}) => {
  const panel = await openLesson(page, /Medical student/);
  await panel.getByRole('button', { name: /Lateral ventricle/ }).click();
  // The landmark switches series; software WebGL blocks the page while it loads.
  await expect(
    page.getByRole('heading', { name: /02 Axial MPRAGE/ }),
  ).toBeVisible();
  await expect(page.getByText('Study open')).toBeVisible({ timeout: 60_000 });
  await expect(panel.getByRole('button', { name: 'CSF' })).toHaveCount(0);
  await panel.getByRole('checkbox', { name: 'Show definitions' }).check();
  await expect(
    panel.getByRole('button', { name: 'CSF' }).first(),
  ).toBeVisible();
});
