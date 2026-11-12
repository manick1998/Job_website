"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  applications,
  companies,
  companyMembers,
  jobs,
  messages,
  newsletterSubscribers,
  notifications,
  reports,
  sessions,
  users,
} from "@/db/schema";
import { destroySession, getCurrentUser, requireUser } from "@/lib/auth";
import { fail, formValues, ok, str, zodFail, type ActionState } from "@/lib/action-state";
import { hashPassword, verifyPassword } from "@/lib/password";
import { notify } from "@/lib/services";
import { emailSchema, messageSchema, passwordSchema } from "@/lib/validation";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function markAllNotificationsReadAction() {
  const user = await requireUser();
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, user.id), isNull(notifications.readAt)));
  revalidatePath("/inbox");
}

export async function deleteNotificationAction(formData: FormData) {
  const user = await requireUser();
  const id = str(formData, "id");
  if (!UUID_RE.test(id)) return;
  await db.delete(notifications).where(and(eq(notifications.id, id), eq(notifications.userId, user.id)));
  revalidatePath("/inbox");
}

export async function markMessageReadAction(formData: FormData) {
  const user = await requireUser();
  const id = str(formData, "id");
  if (!UUID_RE.test(id)) return;
  await db
    .update(messages)
    .set({ readAt: new Date() })
    .where(and(eq(messages.id, id), eq(messages.recipientId, user.id)));
  revalidatePath("/inbox");
}

/** Sends a message scoped to a job application. Only the candidate and that employer's team can converse. */
export async function sendMessageAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const values = formValues(formData);
  const parsed = messageSchema.safeParse({ applicationId: values.applicationId ?? "", body: values.body ?? "" });
  if (!parsed.success) return zodFail(parsed.error.issues, values);

  const [app] = await db
    .select({
      candidateId: applications.candidateId,
      companyId: jobs.companyId,
      jobTitle: jobs.title,
      postedById: jobs.postedById,
    })
    .from(applications)
    .innerJoin(jobs, eq(jobs.id, applications.jobId))
    .where(eq(applications.id, parsed.data.applicationId))
    .limit(1);
  if (!app) return fail("Conversation not found.");

  let recipientId: string | null = null;
  if (app.candidateId === user.id) {
    recipientId = app.postedById;
    if (!recipientId) {
      const [owner] = await db
        .select({ userId: companyMembers.userId })
        .from(companyMembers)
        .where(eq(companyMembers.companyId, app.companyId))
        .limit(1);
      recipientId = owner?.userId ?? null;
    }
  } else {
    const [member] = await db
      .select({ id: companyMembers.id })
      .from(companyMembers)
      .where(and(eq(companyMembers.companyId, app.companyId), eq(companyMembers.userId, user.id)))
      .limit(1);
    if (member) recipientId = app.candidateId;
  }
  if (!recipientId) return fail("You are not part of this conversation.");

  await db.insert(messages).values({
    senderId: user.id,
    recipientId,
    applicationId: parsed.data.applicationId,
    body: parsed.data.body,
  });
  await notify({
    userId: recipientId,
    type: "message",
    title: `New message about ${app.jobTitle}`,
    body: parsed.data.body.slice(0, 140),
    link: "/inbox",
  });
  revalidatePath("/inbox");
  return ok("Message sent.");
}

export async function reportAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in to report a listing.");
  const jobId = str(formData, "jobId");
  const companyId = str(formData, "companyId");
  const reason = str(formData, "reason").trim();
  const details = str(formData, "details").trim().slice(0, 2000) || null;
  if (!UUID_RE.test(jobId) && !UUID_RE.test(companyId)) return fail("Nothing to report.");
  if (reason.length < 3 || reason.length > 120) {
    return fail("Select or describe a reason.", { reason, details: details ?? "" }, { reason: "Describe the issue" });
  }
  await db.insert(reports).values({
    reporterId: user.id,
    jobId: UUID_RE.test(jobId) ? jobId : null,
    companyId: UUID_RE.test(companyId) ? companyId : null,
    reason,
    details,
  });
  return ok("Thanks. Our moderation team will review this report.");
}

export async function newsletterAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formValues(formData);
  const parsed = emailSchema.safeParse(values.email ?? "");
  if (!parsed.success) return fail("Enter a valid email address.", values, { email: "Enter a valid email address" });
  await db.insert(newsletterSubscribers).values({ email: parsed.data }).onConflictDoNothing();
  return ok("You're subscribed. Weekly job digests are on their way.");
}

export async function changePasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const current = str(formData, "currentPassword");
  const next = str(formData, "newPassword");
  const parsed = passwordSchema.safeParse(next);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Weak password";
    return fail(msg, {}, { newPassword: msg });
  }
  const [row] = await db.select({ hash: users.passwordHash }).from(users).where(eq(users.id, user.id)).limit(1);
  if (!(await verifyPassword(current, row?.hash))) {
    return fail("Current password is incorrect.", {}, { currentPassword: "Incorrect password" });
  }
  await db.update(users).set({ passwordHash: await hashPassword(next), updatedAt: new Date() }).where(eq(users.id, user.id));
  return ok("Password changed.");
}

export async function deleteAccountAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (user.role === "admin") return fail("Admin accounts cannot be self-deleted. Contact another administrator.");
  const password = str(formData, "password");
  const confirm = str(formData, "confirm");
  if (confirm !== "DELETE") return fail("Type DELETE to confirm.", {}, { confirm: "Type DELETE exactly" });
  const [row] = await db.select({ hash: users.passwordHash }).from(users).where(eq(users.id, user.id)).limit(1);
  if (!(await verifyPassword(password, row?.hash))) {
    return fail("Password is incorrect.", {}, { password: "Incorrect password" });
  }
  await db.delete(sessions).where(eq(sessions.userId, user.id));
  await destroySession();
  await db.delete(users).where(eq(users.id, user.id));
  redirect("/?deleted=1");
}
