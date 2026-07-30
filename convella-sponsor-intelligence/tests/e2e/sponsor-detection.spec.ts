import { test, expect } from "@playwright/test";
import { MOCK_CHANNEL_HANDLE, MOCK_VIDEO_TITLE } from "./mock-youtube-server";

test.describe.configure({ mode: "serial" });

test("add a channel, run a mocked analysis, detect and confirm a sponsor, and export CSV", async ({ page }) => {
  // 1. Add a channel
  await page.goto("/channels/new");
  await page.getByLabel(/YouTube channel URL, handle/i).fill(MOCK_CHANNEL_HANDLE);
  await page.getByLabel(/Number of recent videos/i).fill("1");
  await page.getByLabel(/Analysis mode/i).selectOption("FIRST_SPONSOR_ONLY");
  await page.getByRole("button", { name: /Add and start analysis/i }).click();

  // 2. Channel details page loads with the imported video listed (videos are "imported" here).
  await expect(page).toHaveURL(/\/channels\//);
  await expect(page.getByRole("heading", { name: "E2E Fictional Creator" })).toBeVisible();
  const videoLink = page.getByRole("link", { name: MOCK_VIDEO_TITLE });
  await expect(videoLink).toBeVisible();

  // 3. Open the video
  await videoLink.click();
  await expect(page).toHaveURL(/\/videos\//);
  await expect(page.getByRole("heading", { name: MOCK_VIDEO_TITLE })).toBeVisible();

  // 4-6. The mocked analysis was queued automatically on import; wait for the
  // background worker (started in globalSetup) to pick it up and confirm a sponsor,
  // then stop — reload until the status badge reflects a completed, stopped analysis.
  await expect
    .poll(
      async () => {
        await page.reload();
        return page.getByText(/SPONSOR FOUND/i).isVisible();
      },
      { timeout: 30_000, intervals: [1000] },
    )
    .toBe(true);

  await expect(page.getByText("CodeRabbit", { exact: true })).toBeVisible();
  await expect(page.getByText(/SPONSORED INTEGRATION/i).first()).toBeVisible();

  // 7-8. Review and confirm the detection.
  await page.getByRole("button", { name: "Confirm sponsor" }).click();
  await expect(page.getByText("CONFIRMED")).toBeVisible();

  // 9. Export the channel's results to CSV.
  const channelLink = page.getByRole("link", { name: "E2E Fictional Creator" });
  await channelLink.click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Export CSV" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.csv$/);
});
