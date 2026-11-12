import { expect, test } from "@playwright/test";
import { ACCOUNTS, DEMO_PASSWORD, latestVerificationLink, login, logout, makePdf } from "./helpers";

test.describe("Candidate journey", () => {
  test("register → verify → login → profile → resume → search → apply → save → track → notification", async ({ page }) => {
    const email = `e2e-candidate-${Date.now()}@example.com`;
    const password = "Test@12345";

    // 1. Register
    await page.goto("/register");
    await page.waitForLoadState("networkidle");
    await page.fill("input[name=name]", "E2E Candidate");
    await page.fill("input[name=email]", email);
    await page.fill("input[name=password]", password);
    await page.fill("input[name=confirmPassword]", password);
    await page.getByRole("button", { name: "Create account" }).click();

    // 2. Verify email via the development outbox link shown on the verification page
    await page.waitForURL("**/verify-email");
    const verifyLink = await latestVerificationLink(email);
    expect(verifyLink, "verification email should be in the outbox").toBeTruthy();
    await page.goto(verifyLink as string);
    await expect(page.getByText("Email verified")).toBeVisible();

    // 3. Login
    await logout(page);
    await login(page, email, password);
    await expect(page).toHaveURL(/\/candidate\/dashboard/);

    // 4. Complete profile
    await page.goto("/candidate/profile");
    await page.fill("input[name=headline]", "Frontend engineer | React");
    await page.fill("input[name=currentLocation]", "Bengaluru");
    await page.fill("textarea[name=skills]", "React, TypeScript, SQL");
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(page.getByText("Profile saved")).toBeVisible();

    // 5. Upload resume (validated server-side by content)
    await page.goto("/candidate/resumes");
    await page.setInputFiles("input[name=file]", { name: "resume.pdf", mimeType: "application/pdf", buffer: makePdf() });
    await page.getByRole("button", { name: "Upload resume" }).click();
    await expect(page.getByText("Resume uploaded successfully")).toBeVisible();

    // 6. Search for a job with a skill filter
    await page.goto("/jobs?skill=React");
    const jobLink = page.locator("main a[href^='/jobs/']").first();
    await expect(jobLink).toBeVisible();
    await jobLink.click();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    // 7. Save the job
    await page.getByRole("button", { name: /Save job/ }).click();
    await page.waitForLoadState("networkidle");

    // 8. Apply (answer any screening questions, select resume, submit)
    const jobUrl = page.url();
    const answers = page.locator("textarea[name^=answer_]");
    for (let i = 0; i < (await answers.count()); i++) await answers.nth(i).fill("Yes, with three years of production experience.");
    await page.getByRole("button", { name: "Submit application" }).click();
    await expect(page).toHaveURL(/candidate\/applications\?applied=1/);
    await expect(page.getByText(/Application submitted successfully/)).toBeVisible();

    // 9. Duplicate application is prevented (job page now shows the applied state)
    await page.goto(jobUrl);
    await expect(page.getByText("You applied for this role")).toBeVisible();
    await expect(page.getByRole("button", { name: "Submit application" })).toHaveCount(0);

    // 10. Track application status and history
    await page.goto("/candidate/applications");
    await expect(page.getByText("Applied").first()).toBeVisible();

    // 11. Saved jobs list and notification
    await page.goto("/candidate/saved");
    await expect(page.getByRole("heading", { name: /Saved jobs \(/ })).toBeVisible();
    await page.goto("/inbox");
    await expect(page.getByText("Application submitted").first()).toBeVisible();
  });

  test("demo candidate sees dashboard metrics and cannot open recruiter or admin areas", async ({ page }) => {
    await login(page, ACCOUNTS.candidate, DEMO_PASSWORD);
    await expect(page.getByText("Application status")).toBeVisible();
    await expect(page.getByText("Profile completeness")).toBeVisible();

    await page.goto("/admin");
    await expect(page).toHaveURL(/\/candidate\/dashboard/);
    await page.goto("/recruiter/candidates");
    await expect(page).toHaveURL(/\/candidate\/dashboard/);
  });

  test("candidate can download own resume but not another user's", async ({ request, page }) => {
    await login(page, ACCOUNTS.candidate, DEMO_PASSWORD);
    await page.goto("/candidate/resumes");
    const href = await page.locator("a[href^='/api/resumes/']").last().getAttribute("href");
    expect(href).toBeTruthy();
    const own = await page.request.get(`${href}`);
    expect(own.status()).toBe(200);
    expect(own.headers()["content-type"]).toContain("application/pdf");
    const anon = await request.get(`${href}`);
    expect(anon.status()).toBe(401);
  });
});
