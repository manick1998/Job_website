import { expect, type Page } from "@playwright/test";
import { Pool } from "pg";

export const DEMO_PASSWORD = "Demo@12345";
export const ACCOUNTS = {
  candidate: "candidate@manickjobportal.in",
  recruiter: "recruiter@manickjobportal.in",
  admin: "admin@manickjobportal.in",
};

/** Minimal but structurally valid PDF used for resume upload tests. */
export function makePdf(): Buffer {
  return Buffer.from(
    "%PDF-1.4\n1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>endobj\ntrailer<< /Root 1 0 R >>\n%%EOF\n",
    "ascii",
  );
}

/**
 * Development test flow: emails are written to the email outbox (email_log).
 * Reads the most recent verification link for an address, as a test inbox would.
 */
export async function latestVerificationLink(email: string): Promise<string | null> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:5432/app_db" });
  try {
    const { rows } = await pool.query(
      "select body from email_log where to_email = $1 and kind = 'verify_email' order by created_at desc limit 1",
      [email],
    );
    const match = (rows[0]?.body as string | undefined)?.match(/https?:\/\/\S+\/verify-email\?token=\S+/);
    return match ? match[0] : null;
  } finally {
    await pool.end();
  }
}

export async function login(page: Page, email: string, password = DEMO_PASSWORD) {
  await page.goto("/login");
  // Wait for hydration so the form's JavaScript handler (not a native fallback) processes the submit.
  await page.waitForLoadState("networkidle");
  await page.fill("input[name=email]", email);
  await page.fill("input[name=password]", password);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 30_000 });
}

export async function logout(page: Page) {
  await page.context().clearCookies();
}

export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, "page should not scroll horizontally").toBeLessThanOrEqual(2);
}
