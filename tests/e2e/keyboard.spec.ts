import { expect, test, type Page } from '@playwright/test';

/** Presses Tab until the focused element's text matches, like a keyboard user. */
async function tabTo(page: Page, name: RegExp, max = 30) {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press('Tab');
    // Past the last control, focus leaves for the browser and the page body
    // (whose text contains everything) becomes active; skip it.
    const text = await page.evaluate(() =>
      document.activeElement === document.body
        ? ''
        : (document.activeElement?.textContent?.trim() ?? ''),
    );
    if (name.test(text)) return;
  }
  throw new Error(`Tab never reached ${name}`);
}
const focusedText = (page: Page) =>
  page.evaluate(() => document.activeElement?.textContent?.trim() ?? '');

test('learning mode works with the keyboard alone, and focus follows each step', async ({
  page,
}) => {
  await page.goto('/');
  await page
    .getByRole('region', { name: 'Recent studies' })
    .getByRole('button', { name: /Jane/ })
    .click();
  await expect(page.getByText('Study open')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('.intro')).toHaveCount(0, { timeout: 20_000 });

  await page.getByRole('button', { name: 'Learn' }).focus();
  await page.keyboard.press('Enter');
  await tabTo(page, /^Undergraduate/);
  await page.keyboard.press('Enter');
  // The picker disappears; focus lands on the lesson list, not the page.
  await expect.poll(() => focusedText(page)).toBe('Lessons');

  await tabTo(page, /Inside the brain/);
  await page.keyboard.press('Enter');
  await expect.poll(() => focusedText(page)).toMatch(/^Inside the brain/);

  await tabTo(page, /^Thalamus \(right\)$/);
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('heading', { name: /02 Axial MPRAGE/ }),
  ).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.locator('.coordinate-readout')).toContainText('12.0', {
    timeout: 60_000,
  });

  // Back to the list: focus returns to the list heading.
  await tabTo(page, /All lessons/, 60);
  await page.keyboard.press('Enter');
  await expect.poll(() => focusedText(page)).toBe('Lessons');

  // Every panel control shows a visible focus ring.
  await tabTo(page, /Inside the brain/);
  const outline = await page.evaluate(
    () => getComputedStyle(document.activeElement!).outlineStyle,
  );
  expect(outline).not.toBe('none');
});

test('with reduced motion on, landmark jumps still land on the landmark', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  expect(
    await page.evaluate(
      () => matchMedia('(prefers-reduced-motion: reduce)').matches,
    ),
  ).toBe(true);
  await page
    .getByRole('region', { name: 'Recent studies' })
    .getByRole('button', { name: /Jane/ })
    .click();
  await expect(page.getByText('Study open')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('.intro')).toHaveCount(0, { timeout: 20_000 });
  await page.getByRole('button', { name: 'Learn' }).click();
  const panel = page.getByRole('complementary', { name: 'Learning mode' });
  await panel.getByRole('button', { name: /Undergraduate/ }).click();
  await panel.getByRole('button', { name: /The brainstem/ }).click();
  await panel.getByRole('button', { name: 'Midbrain' }).click();
  await expect(page.locator('.coordinate-readout')).toContainText('-14.0', {
    timeout: 60_000,
  });
  await expect(page.getByText('Study open')).toBeVisible({ timeout: 60_000 });

  // Midbrain (z −14) to pons (z −30). With reduced motion no reading lies in
  // between. This cannot prove the glide is off: without a GPU the page often
  // paints no in-between frame even when it runs. The unit test "reduced
  // motion reaches exact coordinates immediately" in
  // tests/focus-controller.test.mjs proves that part deterministically.
  await panel.getByRole('button', { name: 'Next landmark' }).click();
  const seen = new Set<string>();
  for (let i = 0; i < 40 && !seen.has('-30.0'); i++) {
    const text = await page.locator('.coordinate-readout').innerText();
    seen.add(/Z\s+(-?\d+\.\d)/.exec(text)?.[1] ?? '');
    await page.waitForTimeout(100);
  }
  expect([...seen].sort()).toEqual(
    seen.has('-14.0') ? ['-14.0', '-30.0'] : ['-30.0'],
  );
});
