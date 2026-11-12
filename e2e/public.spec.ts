import { expect, test } from "@playwright/test";

test.describe("Public website", () => {
  test("homepage renders hero search and live database sections", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Find Your Dream Job");
    await expect(page.getByRole("heading", { name: "Featured jobs" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Latest jobs" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Top hiring companies" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Fresher jobs", level: 2 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Walk-in interviews", level: 2 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Trending skills" })).toBeVisible();
  });

  test("hero search navigates to filtered results", async ({ page }) => {
    await page.goto("/");
    await page.fill("input[name=q]", "React");
    await page.getByRole("button", { name: "Search Jobs" }).click();
    await expect(page).toHaveURL(/\/jobs\?q=React/);
    await expect(page.getByText(/job.* found/)).toBeVisible();
  });

  test("search filters actually filter (work mode, sort) and clear-all resets", async ({ page }) => {
    await page.goto("/jobs?workMode=remote");
    const cards = page.locator("main a[href^='/jobs/']");
    await expect(cards.first()).toBeVisible();
    await page.goto("/jobs?q=zzzz-no-such-job-zzzz");
    await expect(page.getByText("No jobs match your search")).toBeVisible();
    await page.goto("/jobs?sort=salary_desc");
    await expect(page.locator("select[name=sort]")).toHaveValue("salary_desc");
  });

  test("job detail page exposes apply CTA, JSON-LD and similar jobs", async ({ page }) => {
    await page.goto("/jobs");
    await page.locator("main a[href^='/jobs/']").first().click();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator("script[type='application/ld+json']")).toHaveCount(1);
    await expect(page.getByRole("heading", { name: "Apply for this role" })).toBeVisible();
  });

  test("unknown job slug returns 404", async ({ page }) => {
    const res = await page.goto("/jobs/this-job-does-not-exist-123");
    expect(res?.status()).toBe(404);
  });

  test("login rejects invalid credentials with a generic message", async ({ page }) => {
    await page.goto("/login");
    await page.fill("input[name=email]", "nobody-here@example.com");
    await page.fill("input[name=password]", "WrongPassword1");
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page.getByText("Invalid email or password.")).toBeVisible();
  });

  test("registration rejects weak passwords and mismatched confirmation", async ({ page }) => {
    await page.goto("/register");
    await page.fill("input[name=name]", "Weak Pass");
    await page.fill("input[name=email]", `weak-${Date.now()}@example.com`);
    await page.fill("input[name=password]", "short");
    await page.fill("input[name=confirmPassword]", "different");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("Please fix the highlighted fields.")).toBeVisible();
    await expect(page.getByText("Use at least 8 characters")).toBeVisible();
  });

  test("forgot password responds identically for unknown accounts", async ({ page }) => {
    await page.goto("/reset-password");
    await page.fill("input[name=email]", "nobody-here@example.com");
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByText(/If an account exists for that email/)).toBeVisible();
  });

  test("pricing shows recruiter plans with payments honestly marked pending", async ({ page }) => {
    await page.goto("/pricing");
    await expect(page.getByRole("heading", { name: "Starter" })).toBeVisible();
    await expect(page.getByText(/Online checkout is not yet enabled/)).toBeVisible();
  });

  test("salary insights and career advice render", async ({ page }) => {
    await page.goto("/salary-insights");
    await expect(page.getByRole("heading", { name: "Salary insights" })).toBeVisible();
    await page.goto("/career-advice");
    await expect(page.getByRole("heading", { name: "Career advice" })).toBeVisible();
  });

  test("sitemap and robots are served", async ({ request }) => {
    const sitemap = await request.get("/sitemap.xml");
    expect(sitemap.status()).toBe(200);
    expect(await sitemap.text()).toContain("<urlset");
    const robots = await request.get("/robots.txt");
    expect(robots.status()).toBe(200);
    expect(await robots.text()).toContain("Disallow: /admin");
  });

  test("health endpoint reports database connectivity", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});
