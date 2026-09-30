import type { Locator, Page } from '@playwright/test';

/**
 * Share of pixels in an element's screenshot that are clearly not background.
 * Decoded in the page with a 2D canvas, so no image library is needed.
 */
export async function litShare(page: Page, target: Locator) {
  const png = (await target.screenshot()).toString('base64');
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
