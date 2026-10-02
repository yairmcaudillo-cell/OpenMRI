import type { Locator, Page } from '@playwright/test';

/**
 * Share of pixels in an element's screenshot that are clearly not background.
 * Decoded in the page with a 2D canvas, so no image library is needed.
 */
export async function litShare(page: Page, target: Locator) {
  // Software WebGL can take a while to settle; keep the whole poll's budget.
  const png = (await target.screenshot({ timeout: 60_000 })).toString('base64');
  return page.evaluate(async (data) => {
    const image = new Image();
    image.src = `data:image/png;base64,${data}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d')!;
    context.drawImage(image, 0, 0);
    const { data: rgba } = context.getImageData(
      0,
      0,
      image.width,
      image.height,
    );
    let lit = 0;
    for (let i = 0; i < rgba.length; i += 4)
      if (rgba[i] + rgba[i + 1] + rgba[i + 2] > 90) lit++;
    return lit / (rgba.length / 4);
  }, png);
}

/**
 * Where the amber slice crosshair crosses inside one of the three stacked
 * slice tiles (0 axial, 1 coronal, 2 sagittal), in CSS pixels relative to the
 * element. Found from the pixels, so a click there hits the current focus.
 */
export async function crosshairIn(page: Page, target: Locator, tile: number) {
  const png = (await target.screenshot({ timeout: 60_000 })).toString('base64');
  return page.evaluate(
    async ({ data, tile }) => {
      const image = new Image();
      image.src = `data:image/png;base64,${data}`;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext('2d')!;
      context.drawImage(image, 0, 0);
      const top = Math.round((tile * image.height) / 3);
      const height = Math.round(image.height / 3);
      const { data: rgba } = context.getImageData(0, top, image.width, height);
      const columns = new Array<number>(image.width).fill(0);
      const rows = new Array<number>(height).fill(0);
      for (let y = 0; y < height; y++)
        for (let x = 0; x < image.width; x++) {
          const i = (y * image.width + x) * 4;
          // Crosshair colour [1, 0.72, 0.16] in viewer.tsx.
          if (
            rgba[i] > 215 &&
            Math.abs(rgba[i + 1] - 184) < 45 &&
            rgba[i + 2] < 110
          ) {
            columns[x]++;
            rows[y]++;
          }
        }
      const peak = (values: number[]) => values.indexOf(Math.max(...values));
      return { x: peak(columns), y: top + peak(rows) };
    },
    { data: png, tile },
  );
}

/** Share of pixels in an element's screenshot that are clearly blue. */
export async function blueShare(page: Page, target: Locator) {
  const png = (await target.screenshot({ timeout: 60_000 })).toString('base64');
  return page.evaluate(async (data) => {
    const image = new Image();
    image.src = `data:image/png;base64,${data}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d')!;
    context.drawImage(image, 0, 0);
    const { data: rgba } = context.getImageData(
      0,
      0,
      image.width,
      image.height,
    );
    let blue = 0;
    for (let i = 0; i < rgba.length; i += 4)
      if (rgba[i + 2] - rgba[i] > 50 && rgba[i + 2] - rgba[i + 1] > 20) blue++;
    return blue / (rgba.length / 4);
  }, png);
}
