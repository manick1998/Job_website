import { expect, test } from "@playwright/test";
import { expectNoHorizontalScroll } from "./helpers";

test.describe("Responsive layout (mobile)", () => {
  test("mobile navigation toggles and pages do not overflow horizontally", async ({ page }) => {
    await page.goto("/");
    await expectNoHorizontalScroll(page);
    const toggle = page.getByRole("button", { name: "Toggle navigation" });
    await expect(toggle).toBeVisible();
    await toggle.click();
    await expect(page.locator("#mobile-nav")).toBeVisible();
    await expect(page.locator("#mobile-nav").getByRole("link", { name: "Search Jobs" })).toBeVisible();
  });

  test("job search and job detail are usable on mobile", async ({ page }) => {
    await page.goto("/jobs");
    await expectNoHorizontalScroll(page);
    await page.locator("main a[href^='/jobs/']").first().click();
    await expectNoHorizontalScroll(page);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("candidate dashboard uses horizontal section nav on small screens", async ({ page }) => {
    await page.goto("/login");
    await page.fill("input[name=email]", "candidate@setujobs.in");
    await page.fill("input[name=password]", "Demo@12345");
    await page.getByRole("button", { name: "Log in" }).click();
    await page.waitForURL(/candidate\/dashboard/);
    await expectNoHorizontalScroll(page);
    await expect(page.getByRole("navigation", { name: "Dashboard mobile" })).toBeVisible();
  });
});
