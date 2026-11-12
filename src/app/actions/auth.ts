"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { candidateProfiles, companies, companyMembers, users } from "@/db/schema";
import { createSession, dashboardPathFor, destroySession, getCurrentUser, safeNextPath } from "@/lib/auth";
import { fail, formValues, ok, zodFail, type ActionState } from "@/lib/action-state";
import { hashPassword, hashToken, randomToken, verifyPassword } from "@/lib/password";
import { audit, rateLimit, sendEmail } from "@/lib/services";
import {
  emailSchema,
  loginSchema,
  registerCandidateSchema,
  registerRecruiterSchema,
  resetPasswordSchema,
} from "@/lib/validation";
import { APP_URL, slugify, uniqueSuffix } from "@/lib/utils";

async function clientKey() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
}

async function issueVerification(userId: string, email: string, name: string) {
  const token = randomToken();
  await db
    .update(users)
    .set({
      verificationTokenHash: hashToken(token),
      verificationExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    })
    .where(eq(users.id, userId));
  const link = `${APP_URL}/verify-email?token=${token}`;
  await sendEmail({
    to: email,
    kind: "verify_email",
    subject: "Verify your Manick Job Portal email",
    text: `Hi ${name},\n\nWelcome to Manick Job Portal! Verify your email to activate your account:\n${link}\n\nThis link expires in 24 hours. If you did not sign up, ignore this email.`,
  });
}

export async function registerCandidateAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formValues(formData);
  if (!rateLimit(`register:${await clientKey()}`, 10, 60 * 60 * 1000)) {
    return fail("Too many sign-up attempts. Please try again later.", values);
  }
  const parsed = registerCandidateSchema.safeParse(values);
  if (!parsed.success) return zodFail(parsed.error.issues, values);
  const d = parsed.data;

  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, d.email)).limit(1);
  if (existing.length) {
    return fail("An account with this email already exists. Try logging in.", values, { email: "Email already registered" });
  }

  const passwordHash = await hashPassword(d.password);
  const [user] = await db
    .insert(users)
    .values({ email: d.email, name: d.name, phone: d.phone, passwordHash, role: "candidate" })
    .returning({ id: users.id });
  await db.insert(candidateProfiles).values({ userId: user.id, isFresher: d.isFresher });
  await issueVerification(user.id, d.email, d.name);
  await createSession(user.id);
  redirect("/verify-email");
}

export async function registerRecruiterAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formValues(formData);
  if (!rateLimit(`register:${await clientKey()}`, 10, 60 * 60 * 1000)) {
    return fail("Too many sign-up attempts. Please try again later.", values);
  }
  const parsed = registerRecruiterSchema.safeParse(values);
  if (!parsed.success) return zodFail(parsed.error.issues, values);
  const d = parsed.data;

  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, d.email)).limit(1);
  if (existing.length) {
    return fail("An account with this email already exists. Try logging in.", values, { email: "Email already registered" });
  }

  const passwordHash = await hashPassword(d.password);
  const userId = await db.transaction(async (tx) => {
    const [user] = await tx
      .insert(users)
      .values({ email: d.email, name: d.name, passwordHash, role: "recruiter", phone: null })
      .returning({ id: users.id });
    const [company] = await tx
      .insert(companies)
      .values({
        name: d.companyName,
        slug: `${slugify(d.companyName)}-${uniqueSuffix()}`,
        industry: d.industry,
        companySize: d.companySize,
        location: d.companyLocation,
        website: d.website ?? null,
        verificationStatus: "pending",
      })
      .returning({ id: companies.id });
    await tx.insert(companyMembers).values({
      companyId: company.id,
      userId: user.id,
      designation: d.designation,
      role: "owner",
    });
    return user.id;
  });

  await issueVerification(userId, d.email, d.name);
  await createSession(userId);
  redirect("/verify-email");
}

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formValues(formData);
  const parsed = loginSchema.safeParse({ email: values.email ?? "", password: formData.get("password") ?? "" });
  if (!parsed.success) return zodFail(parsed.error.issues, values);
  const email = parsed.data.email;

  if (!rateLimit(`login:${email}`, 8, 15 * 60 * 1000)) {
    return fail("Too many login attempts. Please wait 15 minutes and try again.", { email });
  }

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const valid = !!user && (await verifyPassword(parsed.data.password, user.passwordHash));
  if (!user || !valid) return fail("Invalid email or password.", { email });
  if (user.status === "suspended") {
    return fail("Your account has been suspended. Contact support@manickjobportal.in.", { email });
  }

  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
  await createSession(user.id);
  redirect(safeNextPath(values.next, dashboardPathFor(user.role)));
}

export async function logoutAction() {
  await destroySession();
  redirect("/");
}

export async function forgotPasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formValues(formData);
  const parsed = emailSchema.safeParse(values.email ?? "");
  if (!parsed.success) return fail("Enter a valid email address.", values, { email: "Enter a valid email address" });
  if (!rateLimit(`forgot:${parsed.data}`, 5, 60 * 60 * 1000)) {
    return fail("Too many reset requests. Please try again later.", values);
  }

  const [user] = await db.select().from(users).where(eq(users.email, parsed.data)).limit(1);
  if (user) {
    const token = randomToken();
    await db
      .update(users)
      .set({ resetTokenHash: hashToken(token), resetExpiresAt: new Date(Date.now() + 60 * 60 * 1000) })
      .where(eq(users.id, user.id));
    await sendEmail({
      to: user.email,
      kind: "password_reset",
      subject: "Reset your Manick Job Portal password",
      text: `Hi ${user.name},\n\nUse this link to reset your password (valid for 1 hour):\n${APP_URL}/reset-password?token=${token}\n\nIf you did not request this, you can ignore this email.`,
    });
  }
  // Same response whether or not the account exists (prevents account enumeration).
  return ok("If an account exists for that email, a reset link has been sent. Check your inbox.");
}

export async function resetPasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formValues(formData);
  const parsed = resetPasswordSchema.safeParse({
    token: values.token ?? "",
    password: formData.get("password") ?? "",
    confirmPassword: formData.get("confirmPassword") ?? "",
  });
  if (!parsed.success) return zodFail(parsed.error.issues, { token: values.token ?? "" });

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.resetTokenHash, hashToken(parsed.data.token)))
    .limit(1);
  if (!user || !user.resetExpiresAt || user.resetExpiresAt < new Date()) {
    return fail("This reset link is invalid or has expired. Request a new one.", { token: values.token ?? "" });
  }

  const passwordHash = await hashPassword(parsed.data.password);
  await db
    .update(users)
    .set({ passwordHash, resetTokenHash: null, resetExpiresAt: null, updatedAt: new Date() })
    .where(eq(users.id, user.id));
  await audit({ actorId: user.id, action: "password.reset", entityType: "user", entityId: user.id });
  redirect("/login?reset=1");
}

export async function resendVerificationAction(_prev: ActionState, _formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first.");
  if (user.emailVerifiedAt) return ok("Your email is already verified.");
  if (!rateLimit(`verify:${user.id}`, 5, 60 * 60 * 1000)) return fail("Too many requests. Try again later.");
  await issueVerification(user.id, user.email, user.name);
  return ok("A new verification link has been sent to your email.");
}

export async function verifyEmailToken(token: string): Promise<"ok" | "invalid"> {
  if (!token || token.length < 10) return "invalid";
  const hash = hashToken(token);
  const [user] = await db.select().from(users).where(eq(users.verificationTokenHash, hash)).limit(1);
  if (!user || !user.verificationExpiresAt || user.verificationExpiresAt < new Date()) return "invalid";
  await db
    .update(users)
    .set({
      emailVerifiedAt: new Date(),
      verificationTokenHash: null,
      verificationExpiresAt: null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));
  return "ok";
}
