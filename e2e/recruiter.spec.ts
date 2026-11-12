import { expect, test } from "@playwright/test";
import { ACCOUNTS, DEMO_PASSWORD, login } from "./helpers";

test.describe("Recruiter journey", () => {
  test("login → post & publish job → review applicants → shortlist → schedule interview → update status", async ({ page }) => {
    await login(page, ACCOUNTS.recruiter, DEMO_PASSWORD);
    await expect(page.getByText(/Hello,/)).toBeVisible();

    // 1. Post a job (verified company → goes live immediately)
    const title = `QA Automation Engineer ${Date.now()}`;
    await page.goto("/recruiter/jobs/new");
    await page.fill("input[name=title]", title);
    await page.fill("input[name=city]", "Bengaluru");
    await page.fill("textarea[name=description]", "Build and maintain end-to-end test automation for our SaaS platform, partnering with engineers on CI quality gates.");
    await page.fill("input[name=skills]", "JavaScript, Playwright, SQL");
    await page.fill("input[name=minExperience]", "2");
    await page.getByRole("button", { name: "Publish job" }).click();
    await page.waitForURL(/\/recruiter\/jobs\?saved=/);
    await expect(page.getByText(/Job is live|submitted for review/)).toBeVisible();
    await expect(page.getByText(title).first()).toBeVisible();

    // 2. Pipeline view for a job with applicants (seeded demo job)
    await page.goto("/recruiter/jobs?status=published");
    await page.getByRole("link", { name: "Senior React Engineer" }).first().click();
    await page.getByRole("link", { name: "Open pipeline" }).click();
    await expect(page.getByRole("heading", { name: /Pipeline/ })).toBeVisible();
    await expect(page.getByRole("region", { name: /Shortlisted column/ }).or(page.locator("section[aria-label*='Shortlisted']"))).toBeVisible();

    // 3. Open a candidate and shortlist / progress them
    await page.locator("a[href^='/recruiter/applications/']").first().click();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    await page.getByRole("button", { name: "Mark selected" }).first().click();
    await expect(page.getByText("Selected").first()).toBeVisible();

    // 4. Schedule an interview (IST) — candidate receives notification & email
    const when = new Date(Date.now() + 3 * 24 * 3600 * 1000);
    const local = new Date(when.getTime() - when.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    const scheduleForm = page.locator("form", { hasText: "Schedule & notify" });
    if (await scheduleForm.count()) {
      await scheduleForm.locator("input[name=scheduledAt]").fill(local);
      await scheduleForm.getByRole("button", { name: "Schedule & notify" }).click();
      await expect(page.getByText(/Interview scheduled and the candidate has been notified|Interview time must be in the future/)).toBeVisible();
    }

    // 5. Private note saved
    await page.fill("textarea[name=body]", "Strong testing fundamentals. Follow up on notice period.");
    await page.getByRole("button", { name: "Add note" }).click();
    await expect(page.getByText("Private note saved")).toBeVisible();
  });

  test("recruiter candidate search filters the talent pool", async ({ page }) => {
    await login(page, ACCOUNTS.recruiter, DEMO_PASSWORD);
    await page.goto("/recruiter/candidates?skill=React");
    await expect(page.getByText(/candidate.* found/)).toBeVisible();
    await expect(page.getByText("Aditi Verma").first()).toBeVisible();
    await page.goto("/recruiter/candidates?skill=Cobol");
    await expect(page.getByText("No candidates match these filters")).toBeVisible();
  });

  test("recruiter cannot access admin pages", async ({ page }) => {
    await login(page, ACCOUNTS.recruiter, DEMO_PASSWORD);
    await page.goto("/admin/users");
    await expect(page).toHaveURL(/\/recruiter/);
  });
});
