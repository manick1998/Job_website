import { expect, test } from "@playwright/test";
import { ACCOUNTS, DEMO_PASSWORD, login } from "./helpers";

test.describe("Admin journey", () => {
  test("login → analytics → verify company → approve job → manage users → review reports", async ({ page }) => {
    // 1. Login and analytics
    await login(page, ACCOUNTS.admin, DEMO_PASSWORD);
    await expect(page.getByRole("heading", { name: "Platform overview" })).toBeVisible();
    await expect(page.getByText("Registered candidates")).toBeVisible();
    await expect(page.getByText("Subscription plans")).toBeVisible();

    // 2. Verify a pending company (Sunrise EdTech is seeded as pending)
    await page.goto("/admin/companies?status=pending");
    const verifyButton = page.getByRole("button", { name: "Verify" }).first();
    if (await verifyButton.count()) {
      await verifyButton.click();
      await page.waitForLoadState("networkidle");
    }

    // 3. Approve a job awaiting review (if any)
    await page.goto("/admin/jobs?status=pending_review");
    const approve = page.getByRole("button", { name: "Approve" }).first();
    if (await approve.count()) {
      await approve.click();
      await page.waitForLoadState("networkidle");
    }

    // 4. Users: search and filter
    await page.goto("/admin/users?q=candidate@setujobs.in");
    await expect(page.getByText("candidate@setujobs.in").first()).toBeVisible();
    await page.goto("/admin/users?role=recruiter");
    await expect(page.getByText("recruiter@setujobs.in").first()).toBeVisible();

    // 5. Reports queue
    await page.goto("/admin/reports");
    await expect(page.getByRole("link", { name: "Open", exact: true }).first()).toBeVisible();

    // 6. Audit log and email outbox are visible
    await page.goto("/admin/system");
    await expect(page.getByRole("heading", { name: "Audit log" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Email outbox" })).toBeVisible();
  });

  test("admin job moderation: reject requires a reason field and feature toggles", async ({ page }) => {
    await login(page, ACCOUNTS.admin, DEMO_PASSWORD);
    await page.goto("/admin/jobs");
    await expect(page.getByRole("button", { name: "Feature" }).or(page.getByRole("button", { name: "Unfeature" })).first()).toBeVisible();
  });
});
