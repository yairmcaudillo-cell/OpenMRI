import { expect, test, type Page } from '@playwright/test';

/**
 * Every visible text outside the scan area must meet WCAG contrast against
 * the background it is actually drawn on: 4.5:1, or 3:1 for large text.
 * Disabled controls are exempt (WCAG 1.4.3). Text over images or gradients
 * is skipped because its background cannot be read from CSS.
 */
async function contrastFailures(page: Page) {
  return page.evaluate(() => {
    const rgba = (s: string) => {
      const m = s.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0, 0];
      return { r: m[0], g: m[1], b: m[2], a: m[3] ?? 1 };
    };
    const lum = (c: { r: number; g: number; b: number }) =>
      [c.r, c.g, c.b]
        .map((v) => v / 255)
        .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
        .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
    const over = (
      top: ReturnType<typeof rgba>,
      below: ReturnType<typeof rgba>,
    ) => ({
      r: top.r * top.a + below.r * (1 - top.a),
      g: top.g * top.a + below.g * (1 - top.a),
      b: top.b * top.a + below.b * (1 - top.a),
      a: 1,
    });
    function background(el: Element | null): ReturnType<typeof rgba> | null {
      const layers = [];
      for (let e = el; e; e = e.parentElement) {
        const cs = getComputedStyle(e);
        if (cs.backgroundImage !== 'none') return null;
        const c = rgba(cs.backgroundColor);
        if (c.a > 0) layers.push(c);
        if (c.a >= 1) break;
      }
      return layers.reduceRight((below, top) => over(top, below), {
        r: 255,
        g: 255,
        b: 255,
        a: 1,
      });
    }
    const failures: string[] = [];
    for (const el of document.querySelectorAll('body *')) {
      const own = [...el.childNodes].some(
        (n) => n.nodeType === 3 && n.textContent!.trim(),
      );
      if (
        !own ||
        el.closest('.mri-stage, [aria-hidden="true"], [disabled], svg')
      )
        continue;
      const box = el.getBoundingClientRect();
      if (!box.width || !box.height || box.bottom < 0 || box.top > innerHeight)
        continue;
      const cs = getComputedStyle(el);
      if (cs.visibility !== 'visible') continue;
      let opacity = 1;
      for (let e: Element | null = el; e; e = e.parentElement)
        opacity *= +getComputedStyle(e).opacity;
      if (opacity < 1) continue;
      const bg = background(el);
      if (!bg) continue;
      const fg = over(rgba(cs.color), bg);
      const [hi, lo] = [lum(fg), lum(bg)].sort((a, b) => b - a);
      const ratio = (hi + 0.05) / (lo + 0.05);
      const size = parseFloat(cs.fontSize);
      const large = size >= 24 || (size >= 18.66 && +cs.fontWeight >= 700);
      if (ratio < (large ? 3 : 4.5))
        failures.push(
          `${ratio.toFixed(2)}:1 "${el.textContent!.trim().slice(0, 40)}" <${el.tagName.toLowerCase()} class="${el.className}"> ${cs.color} on rgb(${bg.r.toFixed(0)},${bg.g.toFixed(0)},${bg.b.toFixed(0)})`,
        );
    }
    return failures;
  });
}
const expectReadable = async (page: Page, where: string) =>
  expect(await contrastFailures(page), where).toEqual([]);

async function openJane(page: Page) {
  await page
    .getByRole('region', { name: 'Recent studies' })
    .getByRole('button', { name: /Jane/ })
    .click();
  await expect(page.getByText('Study open')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('.intro')).toHaveCount(0, { timeout: 20_000 });
}

test('light theme: all text is readable, and the scan area stays black', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expectReadable(page, 'welcome');

  await openJane(page);
  await expectReadable(page, 'viewer');
  const stage = await page
    .locator('.scan-stage')
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(stage).toMatch(/^rgba?\(0, 0, 0/);

  await page.getByRole('button', { name: 'Learn' }).click();
  const panel = page.getByRole('complementary', { name: 'Learning mode' });
  await expectReadable(page, 'track picker');
  await panel.getByRole('button', { name: /Undergraduate/ }).click();
  await panel.getByRole('button', { name: /Inside the brain/ }).click();
  await panel.getByRole('button', { name: 'Hippocampus (right)' }).click();
  await expect(page.getByText('Study open')).toBeVisible({ timeout: 60_000 });
  await expectReadable(page, 'lesson');
  await panel.getByRole('button', { name: 'Quiz' }).click();
  await panel.getByRole('button', { name: 'Start the quiz' }).click();
  await panel.getByRole('button', { name: 'Skip' }).click();
  await expectReadable(page, 'quiz feedback');

  await page.getByRole('button', { name: 'History' }).click();
  await expectReadable(page, 'history');
  await page.getByRole('button', { name: 'Library' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expectReadable(page, 'library');
});

test('the dark theme is one click away and is remembered', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Switch to the dark theme' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Switch to the light theme' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});
