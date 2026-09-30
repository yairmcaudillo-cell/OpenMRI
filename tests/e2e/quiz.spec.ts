import { expect, test, type Page } from '@playwright/test';
import { crosshairIn } from './pixels';

async function focusAt(page: Page, point: number[]) {
  await expect
    .poll(
      async () => {
        const text = await page.locator('.coordinate-readout').innerText();
        const at = [...text.matchAll(/[XYZ]\s+(-?\d+(?:\.\d+)?)/g)].map((m) =>
          Number(m[1]),
        );
        return Math.max(...at.map((v, i) => Math.abs(v - point[i])));
      },
      { timeout: 30_000 },
    )
    .toBeLessThanOrEqual(1);
}

test('a quiz: find by clicking, a miss shows the answer, choices explain, the best score is kept', async ({
  page,
}) => {
  await page.goto('/');
  await page
    .getByRole('region', { name: 'Recent studies' })
    .getByRole('button', { name: /Jane/ })
    .click();
  await expect(page.getByText('Study open')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('.intro')).toHaveCount(0, { timeout: 20_000 });
  await page.getByRole('button', { name: 'Learn' }).click();
  const panel = page.getByRole('complementary', { name: 'Learning mode' });
  await panel.getByRole('button', { name: /Undergraduate/ }).click();
  await panel.getByRole('button', { name: /Inside the brain/ }).click();

  // Look at the frontal horn first, so the crosshair sits on it.
  await panel.getByRole('button', { name: /Lateral ventricle/ }).click();
  await expect(
    page.getByRole('heading', { name: /02 Axial MPRAGE/ }),
  ).toBeVisible();
  await focusAt(page, [11, 10, 2]);

  await panel.getByRole('button', { name: 'Quiz' }).click();
  await expect(
    panel.getByRole('button', { name: /Lateral ventricle/ }),
  ).toHaveCount(0);
  await panel.getByRole('button', { name: 'Start the quiz' }).click();
  const quiz = panel.getByRole('region', { name: 'Quiz' });
  await expect(quiz.getByText('Question 1 of 9')).toBeVisible();
  await expect(
    quiz.getByRole('heading', {
      name: 'Find the lateral ventricle, frontal horn',
    }),
  ).toBeVisible();
  const check = quiz.getByRole('button', { name: 'Check' });
  // No click on a slice yet. Late location updates from the viewer after a
  // load must not count as the student's answer.
  await page.setViewportSize({ width: 1400, height: 880 });
  await page.waitForTimeout(3000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(3000);
  await expect(check).toBeDisabled();

  // Q1, right: click the slice where the crosshair already marks the answer.
  const slices = page.getByLabel(/Three MRI slices/);
  const box = (await slices.boundingBox())!;
  const at = await crosshairIn(page, slices, 0);
  await page.mouse.click(box.x + at.x, box.y + at.y);
  await expect(check).toBeEnabled();
  await check.click();
  await expect(quiz.getByText('Correct.')).toBeVisible();

  // Q2, wrong: the same spot is far from the third ventricle; the answer is shown.
  await quiz.getByRole('button', { name: 'Next question' }).click();
  await expect(
    quiz.getByRole('heading', { name: 'Find the third ventricle' }),
  ).toBeVisible();
  await expect(check).toBeDisabled();
  await page.mouse.click(box.x + at.x, box.y + at.y);
  await check.click();
  await expect(
    quiz.getByText(/Not quite\. The marker now shows the Third ventricle/),
  ).toBeVisible();
  await focusAt(page, [1, -12, -2]);

  for (let i = 3; i <= 7; i++) {
    await quiz.getByRole('button', { name: 'Next question' }).click();
    await expect(quiz.getByText(`Question ${i} of 9`)).toBeVisible();
    await quiz.getByRole('button', { name: 'Skip' }).click();
  }

  // Q8, a choice that moves the marker to its landmark and explains the answer.
  await quiz.getByRole('button', { name: 'Next question' }).click();
  await focusAt(page, [11, 10, 2]);
  await quiz.getByRole('button', { name: /filled with fluid/ }).click();
  await expect(quiz.getByText('Correct.')).toBeVisible();
  await expect(quiz.locator('output')).toContainText('Fluid is dark on T1', {
    useInnerText: true,
  });

  // Q9, a wrong choice names the right answer.
  await quiz.getByRole('button', { name: 'Next question' }).click();
  await quiz.getByRole('button', { name: 'Putamen' }).click();
  await expect(
    quiz.getByText('Not quite. The answer is: Hippocampus.'),
  ).toBeVisible();

  await quiz.getByRole('button', { name: 'See the result' }).click();
  await expect(quiz.getByText('You got 2 of 9 right.')).toBeVisible();
  await expect(quiz.getByText('Best in this browser: 2 / 9')).toBeVisible();
  await page.screenshot({ path: 'test-results/quiz-result.png' });
});
