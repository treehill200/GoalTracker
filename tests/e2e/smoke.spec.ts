import { expect, test } from "@playwright/test";

/**
 * Smoke test (demo mode): open app → view seed goal dashboard → quick-log a
 * value → see the score update.
 */
test("quick-logging a value updates the goal score", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Demo mode:")).toBeVisible();

  // Both seed goals are on the home screen.
  const satCard = page.getByTestId("goal-card").filter({ hasText: "Get a 1500+ on the SAT" });
  await expect(satCard).toBeVisible();
  await expect(
    page.getByTestId("goal-card").filter({ hasText: "Gain 20 lbs of lean muscle" }),
  ).toBeVisible();

  // Dashboard renders the showpiece charts.
  await satCard.click();
  await expect(page.getByRole("heading", { name: "Get a 1500+ on the SAT" })).toBeVisible();
  await expect(page.getByTestId("projection-card")).toContainText("At this pace you'll finish on");
  await expect(page.getByTestId("pace-card")).toContainText("You need");
  await expect(page.locator(".recharts-surface").first()).toBeVisible();

  const scoreText = page.getByTestId("goal-score");
  const readScore = async () => Number((await scoreText.innerText()).match(/Score\s+([\d.]+)/)![1]);
  const before = await readScore();

  // Quick log: + → metric → value → save.
  await page.getByTestId("quick-log-fab").click();
  await page
    .getByRole("button", { name: /Practice test score/ })
    .first()
    .click();
  await page.getByTestId("quick-log-value").fill("1400");
  await page.getByTestId("quick-log-save").click();

  // Crossing 1300 and 1400 completes milestones → dismiss the celebrations.
  for (let i = 0; i < 6; i++) {
    const dialog = page.getByRole("dialog");
    if (!(await dialog.isVisible().catch(() => false))) break;
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
  }

  await expect.poll(readScore, { timeout: 10_000 }).toBeGreaterThan(before);
});
