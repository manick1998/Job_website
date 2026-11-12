"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  blogPosts,
  companies,
  companyMembers,
  jobCategories,
  jobs,
  platformSettings,
  reports,
  sessions,
  users,
  type JobStatus,
} from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { fail, formValues, ok, str, zodFail, type ActionState } from "@/lib/action-state";
import { audit, notify } from "@/lib/services";
import { blogSchema } from "@/lib/validation";
import { slugify, uniqueSuffix } from "@/lib/utils";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function requireId(formData: FormData, key: string) {
  const v = str(formData, key);
  return UUID_RE.test(v) ? v : null;
}

export async function setUserStatusAction(formData: FormData) {
  const admin = await requireUser("admin");
  const id = requireId(formData, "userId");
  const status = str(formData, "status");
  if (!id || id === admin.id || !["active", "suspended"].includes(status)) return;
  await db.update(users).set({ status: status as "active" | "suspended", updatedAt: new Date() }).where(eq(users.id, id));
  if (status === "suspended") await db.delete(sessions).where(eq(sessions.userId, id));
  await audit({ actorId: admin.id, action: `user.${status}`, entityType: "user", entityId: id });
  revalidatePath("/admin/users");
}

export async function verifyUserEmailAction(formData: FormData) {
  const admin = await requireUser("admin");
  const id = requireId(formData, "userId");
  if (!id) return;
  await db.update(users).set({ emailVerifiedAt: new Date(), updatedAt: new Date() }).where(eq(users.id, id));
  await audit({ actorId: admin.id, action: "user.verify", entityType: "user", entityId: id });
  revalidatePath("/admin/users");
}

export async function changeUserRoleAction(formData: FormData) {
  const admin = await requireUser("admin");
  const id = requireId(formData, "userId");
  const role = str(formData, "role");
  if (!id || id === admin.id || !["candidate", "recruiter", "admin"].includes(role)) return;
  await db.update(users).set({ role: role as "candidate", updatedAt: new Date() }).where(eq(users.id, id));
  await db.delete(sessions).where(eq(sessions.userId, id));
  await audit({ actorId: admin.id, action: "user.role", entityType: "user", entityId: id, metadata: { role } });
  revalidatePath("/admin/users");
}

export async function deleteUserAction(formData: FormData) {
  const admin = await requireUser("admin");
  const id = requireId(formData, "userId");
  if (!id || id === admin.id) return;
  await audit({ actorId: admin.id, action: "user.delete", entityType: "user", entityId: id });
  await db.delete(users).where(eq(users.id, id));
  revalidatePath("/admin/users");
}

const JOB_ACTIONS = ["approve", "reject", "suspend", "feature", "unfeature", "close", "reopen", "delete"] as const;

export async function moderateJobAction(formData: FormData) {
  const admin = await requireUser("admin");
  const id = requireId(formData, "jobId");
  const action = str(formData, "action") as (typeof JOB_ACTIONS)[number];
  const reason = str(formData, "reason").trim().slice(0, 500) || null;
  if (!id || !JOB_ACTIONS.includes(action)) return;
  const [job] = await db.select().from(jobs).where(eq(jobs.id, id)).limit(1);
  if (!job) return;
  const [company] = await db.select().from(companies).where(eq(companies.id, job.companyId)).limit(1);
  const posterId = job.postedById;

  if (action === "delete") {
    await audit({ actorId: admin.id, action: "job.admin_delete", entityType: "job", entityId: id, metadata: { reason } });
    await db.delete(jobs).where(eq(jobs.id, id));
  } else {
    const patch: Partial<typeof jobs.$inferInsert> = { updatedAt: new Date() };
    let status: JobStatus | null = null;
    if (action === "approve") {
      status = "published";
      patch.publishedAt = job.publishedAt ?? new Date();
      patch.rejectionReason = null;
    } else if (action === "reject" || action === "suspend") {
      status = "rejected";
      patch.rejectionReason = reason ?? (action === "suspend" ? "Suspended by moderation" : "Does not meet listing guidelines");
    } else if (action === "feature") patch.isFeatured = true;
    else if (action === "unfeature") patch.isFeatured = false;
    else if (action === "close") status = "closed";
    else if (action === "reopen") status = "published";
    if (status) patch.status = status;
    await db.update(jobs).set(patch).where(eq(jobs.id, id));
    await audit({ actorId: admin.id, action: `job.${action}`, entityType: "job", entityId: id, metadata: { reason } });
    if (posterId && ["approve", "reject", "suspend"].includes(action)) {
      await notify({
        userId: posterId,
        type: "moderation",
        title: action === "approve" ? `Job approved: ${job.title}` : `Job update: ${job.title}`,
        body: action === "approve" ? "Your job is now live." : patch.rejectionReason ?? "Your job was not approved.",
        link: "/recruiter/jobs",
      });
    }
  }
  void company;
  revalidatePath("/admin/jobs");
  revalidatePath("/jobs");
}

export async function moderateCompanyAction(formData: FormData) {
  const admin = await requireUser("admin");
  const id = requireId(formData, "companyId");
  const action = str(formData, "action");
  if (!id || !["verify", "reject", "suspend", "unsuspend"].includes(action)) return;

  const patch: Partial<typeof companies.$inferInsert> = { updatedAt: new Date() };
  if (action === "verify") patch.verificationStatus = "verified";
  if (action === "reject") patch.verificationStatus = "rejected";
  if (action === "suspend") patch.suspended = true;
  if (action === "unsuspend") patch.suspended = false;
  await db.update(companies).set(patch).where(eq(companies.id, id));

  if (action === "verify") {
    // Verified employers' pending listings go live automatically.
    await db
      .update(jobs)
      .set({ status: "published", publishedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(jobs.companyId, id), eq(jobs.status, "pending_review")));
  }
  if (action === "suspend") {
    await db
      .update(jobs)
      .set({ status: "paused", updatedAt: new Date() })
      .where(eq(jobs.companyId, id));
  }

  const owners = await db.select({ userId: companyMembers.userId }).from(companyMembers).where(eq(companyMembers.companyId, id));
  const [company] = await db.select({ name: companies.name }).from(companies).where(eq(companies.id, id)).limit(1);
  for (const o of owners) {
    await notify({
      userId: o.userId,
      type: "moderation",
      title: `Company ${action === "verify" ? "verified" : action + "d/updated"}: ${company?.name ?? ""}`,
      link: "/recruiter/company",
    });
  }
  await audit({ actorId: admin.id, action: `company.${action}`, entityType: "company", entityId: id });
  revalidatePath("/admin/companies");
  revalidatePath("/companies");
}

export async function resolveReportAction(formData: FormData) {
  const admin = await requireUser("admin");
  const id = requireId(formData, "reportId");
  const resolution = str(formData, "resolution");
  const note = str(formData, "note").trim().slice(0, 1000) || null;
  if (!id || !["resolved", "dismissed"].includes(resolution)) return;
  await db
    .update(reports)
    .set({
      status: resolution as "resolved" | "dismissed",
      resolutionNote: note,
      resolvedById: admin.id,
      resolvedAt: new Date(),
    })
    .where(eq(reports.id, id));
  if (resolution === "resolved" && str(formData, "hideJob") === "on") {
    const [r] = await db.select({ jobId: reports.jobId }).from(reports).where(eq(reports.id, id)).limit(1);
    if (r?.jobId) await db.update(jobs).set({ status: "rejected", rejectionReason: note ?? "Removed after a user report", updatedAt: new Date() }).where(eq(jobs.id, r.jobId));
  }
  await audit({ actorId: admin.id, action: `report.${resolution}`, entityType: "report", entityId: id });
  revalidatePath("/admin/reports");
}

export async function createBlogPostAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireUser("admin");
  const values = formValues(formData);
  const parsed = blogSchema.safeParse(values);
  if (!parsed.success) return zodFail(parsed.error.issues, values);
  const d = parsed.data;
  await db.insert(blogPosts).values({
    title: d.title,
    slug: `${slugify(d.title)}-${uniqueSuffix()}`,
    excerpt: d.excerpt ?? null,
    category: d.category,
    body: d.body,
    published: true,
    authorName: admin.name,
  });
  revalidatePath("/career-advice");
  revalidatePath("/admin/content");
  return ok("Article published.");
}

export async function deleteBlogPostAction(formData: FormData) {
  await requireUser("admin");
  const id = requireId(formData, "postId");
  if (!id) return;
  await db.delete(blogPosts).where(eq(blogPosts.id, id));
  revalidatePath("/career-advice");
  revalidatePath("/admin/content");
}

export async function createCategoryAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser("admin");
  const name = str(formData, "name").trim();
  if (name.length < 2 || name.length > 120) return fail("Category name must be 2–120 characters.", { name }, { name: "Enter a name" });
  const slug = slugify(name);
  const existing = await db.select({ id: jobCategories.id }).from(jobCategories).where(eq(jobCategories.slug, slug)).limit(1);
  if (existing.length) return fail("A category with this name already exists.", { name }, { name: "Already exists" });
  await db.insert(jobCategories).values({ name, slug, description: str(formData, "description").trim() || null });
  revalidatePath("/admin/content");
  revalidatePath("/jobs");
  return ok(`Category "${name}" added.`);
}

export async function updateSettingsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireUser("admin");
  const entries: [string, string][] = [
    ["site_name", str(formData, "site_name").trim().slice(0, 80) || "SetuJobs"],
    ["support_email", str(formData, "support_email").trim().slice(0, 120) || "support@setujobs.in"],
    ["maintenance_mode", str(formData, "maintenance_mode") === "on" ? "on" : "off"],
  ];
  for (const [key, value] of entries) {
    await db
      .insert(platformSettings)
      .values({ key, value })
      .onConflictDoUpdate({ target: platformSettings.key, set: { value, updatedAt: new Date() } });
  }
  await audit({ actorId: admin.id, action: "settings.update", entityType: "settings", metadata: Object.fromEntries(entries) });
  revalidatePath("/admin/system");
  return ok("Platform settings saved.");
}

export async function bulkFeatureAction(formData: FormData) {
  await requireUser("admin");
  const ids = formData.getAll("jobIds").map(String).filter((v) => UUID_RE.test(v));
  if (ids.length === 0) return;
  await db.update(jobs).set({ isFeatured: true, updatedAt: new Date() }).where(inArray(jobs.id, ids));
  revalidatePath("/admin/jobs");
}
