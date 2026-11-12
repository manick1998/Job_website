"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, count, eq, inArray, ne } from "drizzle-orm";
import { db } from "@/db";
import {
  applicationEvents,
  applications,
  candidateNotes,
  companies,
  companyMembers,
  interviews,
  jobSkills,
  jobs,
  users,
  type ApplicationStatus,
  type JobStatus,
} from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { fail, formValues, ok, str, zodFail, type ActionState } from "@/lib/action-state";
import { getCompanyPlan, getJobForCompany, getRecruiterCompany } from "@/lib/queries/dashboards";
import { audit, notify, sendEmail } from "@/lib/services";
import { splitList, splitLines, upsertSkills } from "@/lib/taxonomy";
import { APPLICATION_STATUS_LABEL, APP_URL, slugify, uniqueSuffix } from "@/lib/utils";
import { companySchema, interviewSchema, jobSchema, messageSchema } from "@/lib/validation";
import { messages } from "@/db/schema";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LIVE_LIKE: JobStatus[] = ["published", "pending_review", "paused"];

async function recruiterContext() {
  const user = await requireUser("recruiter");
  const ctx = await getRecruiterCompany(user.id);
  if (!ctx) redirect("/register?role=recruiter");
  return { user, company: ctx.company, membership: ctx.membership };
}

function stripId<T extends { id: string }>(row: T): Omit<T, "id"> {
  const { id: _ignored, ...rest } = row;
  return rest;
}

async function activeJobCount(companyId: string, excludeJobId?: string) {
  const [row] = await db
    .select({ value: count() })
    .from(jobs)
    .where(
      and(
        eq(jobs.companyId, companyId),
        inArray(jobs.status, LIVE_LIKE),
        excludeJobId ? ne(jobs.id, excludeJobId) : undefined,
      ),
    );
  return Number(row?.value ?? 0);
}

async function notifyAdmins(title: string, body: string, link: string) {
  const admins = await db.select({ id: users.id }).from(users).where(eq(users.role, "admin"));
  for (const a of admins) await notify({ userId: a.id, type: "moderation", title, body, link });
}

export async function updateCompanyAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { company } = await recruiterContext();
  const values = formValues(formData);
  const parsed = companySchema.safeParse(values);
  if (!parsed.success) return zodFail(parsed.error.issues, values);
  const d = parsed.data;
  await db
    .update(companies)
    .set({
      name: d.name,
      industry: d.industry,
      companySize: d.companySize,
      location: d.location,
      website: d.website ?? null,
      logoUrl: d.logoUrl ?? null,
      description: d.description ?? null,
      benefits: d.benefits ?? null,
      updatedAt: new Date(),
    })
    .where(eq(companies.id, company.id));
  revalidatePath("/recruiter/company");
  revalidatePath(`/companies/${company.slug}`);
  return ok("Company profile updated.");
}

export async function inviteMemberAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user: me, company, membership } = await recruiterContext();
  if (membership.role !== "owner") return fail("Only the company owner can invite recruiters.");
  const values = formValues(formData);
  const email = (values.email ?? "").trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) return fail("Enter a valid email.", values, { email: "Enter a valid email" });

  const [invitee] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!invitee || invitee.role !== "recruiter") {
    return fail("That person must first register as a recruiter on Manick Job Portal.", values, { email: "No recruiter account with this email" });
  }
  const plan = await getCompanyPlan(company.planCode);
  const [{ value }] = await db.select({ value: count() }).from(companyMembers).where(eq(companyMembers.companyId, company.id));
  if (plan && Number(value) >= plan.seatLimit) {
    return fail(`Your ${plan.name} plan allows ${plan.seatLimit} recruiter seat(s). Upgrade to add more.`, values);
  }
  await db
    .insert(companyMembers)
    .values({ companyId: company.id, userId: invitee.id, designation: values.designation?.trim() || null, role: "recruiter" })
    .onConflictDoNothing();
  await notify({ userId: invitee.id, type: "team", title: `Added to ${company.name}`, body: `${me.name} added you to the hiring team.`, link: "/recruiter" });
  revalidatePath("/recruiter/company");
  return ok(`${invitee.name} now has access to ${company.name}.`);
}

export async function saveJobAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user, company } = await recruiterContext();
  const values = formValues(formData);
  const parsed = jobSchema.safeParse({
    ...values,
    salaryHidden: formData.get("salaryHidden") ?? undefined,
    isFresher: formData.get("isFresher") ?? undefined,
  });
  if (!parsed.success) return zodFail(parsed.error.issues, values);
  const d = parsed.data;
  const jobId = str(formData, "jobId");
  const isEdit = UUID_RE.test(jobId);

  let existing: typeof jobs.$inferSelect | null = null;
  if (isEdit) {
    const found = await getJobForCompany(jobId, company.id);
    if (!found) return fail("Job not found.");
    existing = found.job;
  }

  const wantsPublish = d.intent === "publish";
  if (wantsPublish) {
    const plan = await getCompanyPlan(company.planCode);
    const active = await activeJobCount(company.id, existing?.id);
    const alreadyLive = existing?.status === "published";
    if (plan && !alreadyLive && active >= plan.jobPostLimit) {
      return fail(
        `Your ${plan.name} plan allows ${plan.jobPostLimit} active job(s). Close a job or upgrade your plan to publish more.`,
        values,
      );
    }
  }

  let status: JobStatus = "draft";
  if (wantsPublish) {
    if (existing?.status === "published") status = "published";
    else status = company.verificationStatus === "verified" ? "published" : "pending_review";
  }
  const publishedAt = status === "published" || status === "pending_review" ? (existing?.publishedAt ?? new Date()) : null;

  const fields = {
    companyId: company.id,
    postedById: user.id,
    categoryId: d.categoryId ?? null,
    title: d.title,
    department: d.department ?? null,
    description: d.description,
    responsibilities: d.responsibilities ?? null,
    benefits: d.benefits ?? null,
    educationRequirement: d.educationRequirement ?? null,
    minExperience: d.minExperience,
    maxExperience: d.maxExperience ?? null,
    salaryMin: d.salaryMin ?? null,
    salaryMax: d.salaryMax ?? null,
    salaryHidden: d.salaryHidden,
    city: d.city,
    workMode: d.workMode,
    employmentType: d.employmentType,
    isFresher: d.isFresher,
    openings: d.openings,
    deadline: d.deadline ? new Date(`${d.deadline}T23:59:59+05:30`) : null,
    status,
    publishedAt,
    screeningQuestions: splitLines(d.screeningQuestions, 10),
    updatedAt: new Date(),
  };

  const resultId = await db.transaction(async (tx) => {
    let id: string;
    if (existing) {
      await tx.update(jobs).set(fields).where(eq(jobs.id, existing.id));
      id = existing.id;
    } else {
      const [row] = await tx
        .insert(jobs)
        .values({ ...fields, slug: `${slugify(d.title)}-${uniqueSuffix()}` })
        .returning({ id: jobs.id });
      id = row.id;
    }
    await tx.delete(jobSkills).where(eq(jobSkills.jobId, id));
    const req = splitList(d.skills, 20);
    const pref = splitList(d.preferredSkills, 20).filter((s) => !req.map((r) => r.toLowerCase()).includes(s.toLowerCase()));
    const reqIds = await upsertSkills(tx, req);
    const prefIds = await upsertSkills(tx, pref);
    const rows = [
      ...reqIds.map((skillId) => ({ jobId: id, skillId, required: true })),
      ...prefIds.map((skillId) => ({ jobId: id, skillId, required: false })),
    ];
    if (rows.length) await tx.insert(jobSkills).values(rows).onConflictDoNothing();
    return id;
  });

  if (status === "pending_review") {
    await notifyAdmins("Job awaiting review", `${company.name}: ${d.title}`, "/admin/jobs?status=pending_review");
  }
  await audit({ actorId: user.id, action: isEdit ? "job.update" : "job.create", entityType: "job", entityId: resultId, metadata: { status } });
  revalidatePath("/recruiter/jobs");
  redirect(`/recruiter/jobs?saved=${status}`);
}

export async function jobLifecycleAction(formData: FormData) {
  const { user, company } = await recruiterContext();
  const jobId = str(formData, "jobId");
  const intent = str(formData, "intent");
  if (!UUID_RE.test(jobId)) redirect("/recruiter/jobs?error=Invalid+job");
  const found = await getJobForCompany(jobId, company.id);
  if (!found) redirect("/recruiter/jobs?error=Job+not+found");
  const job = found.job;
  const verified = company.verificationStatus === "verified";

  if (intent === "pause") {
    if (job.status !== "published") redirect("/recruiter/jobs?error=Only+live+jobs+can+be+paused");
    await db.update(jobs).set({ status: "paused", updatedAt: new Date() }).where(eq(jobs.id, job.id));
  } else if (intent === "resume" || intent === "submit") {
    if (!["paused", "draft", "rejected", "closed"].includes(job.status)) redirect("/recruiter/jobs?error=Job+cannot+be+published+now");
    const plan = await getCompanyPlan(company.planCode);
    const active = await activeJobCount(company.id, job.id);
    if (plan && active >= plan.jobPostLimit) {
      redirect(`/recruiter/jobs?error=${encodeURIComponent(`Your ${plan.name} plan allows ${plan.jobPostLimit} active job(s).`)}`);
    }
    const next: JobStatus = verified ? "published" : "pending_review";
    await db
      .update(jobs)
      .set({ status: next, publishedAt: job.publishedAt ?? new Date(), updatedAt: new Date() })
      .where(eq(jobs.id, job.id));
    if (next === "pending_review") await notifyAdmins("Job awaiting review", `${company.name}: ${job.title}`, "/admin/jobs?status=pending_review");
  } else if (intent === "close") {
    await db.update(jobs).set({ status: "closed", updatedAt: new Date() }).where(eq(jobs.id, job.id));
  } else if (intent === "duplicate") {
    const [copy] = await db
      .insert(jobs)
      .values({
        ...stripId(job),
        title: `${job.title} (Copy)`.slice(0, 200),
        slug: `${slugify(job.title)}-${uniqueSuffix()}`,
        status: "draft",
        publishedAt: null,
        viewsCount: 0,
        isFeatured: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning({ id: jobs.id });
    if (copy) {
      const reqIds = await upsertSkills(db, found.requiredSkills);
      const prefIds = await upsertSkills(db, found.preferredSkills);
      const rows = [
        ...reqIds.map((skillId) => ({ jobId: copy.id, skillId, required: true })),
        ...prefIds.map((skillId) => ({ jobId: copy.id, skillId, required: false })),
      ];
      if (rows.length) await db.insert(jobSkills).values(rows).onConflictDoNothing();
    }
    redirect(`/recruiter/jobs/${copy.id}?duplicated=1`);
  } else if (intent === "delete") {
    const [{ value }] = await db.select({ value: count() }).from(applications).where(eq(applications.jobId, job.id));
    if (Number(value) > 0) redirect("/recruiter/jobs?error=Jobs+with+applicants+cannot+be+deleted.+Close+them+instead.");
    await db.delete(jobs).where(eq(jobs.id, job.id));
    await audit({ actorId: user.id, action: "job.delete", entityType: "job", entityId: job.id });
    revalidatePath("/recruiter/jobs");
    redirect("/recruiter/jobs?saved=deleted");
  }

  await audit({ actorId: user.id, action: `job.${intent}`, entityType: "job", entityId: job.id });
  revalidatePath("/recruiter/jobs");
  redirect(`/recruiter/jobs?saved=${intent}`);
}

const MOVABLE: ApplicationStatus[] = ["applied", "viewed", "under_review", "shortlisted", "selected", "hired", "rejected"];

export async function moveApplicationAction(applicationId: string, toStatus: string): Promise<ActionState> {
  const { user, company } = await recruiterContext();
  if (!UUID_RE.test(applicationId)) return fail("Invalid application.");
  if (!MOVABLE.includes(toStatus as ApplicationStatus)) return fail("That stage cannot be set manually.");

  const [row] = await db
    .select({ app: applications, jobTitle: jobs.title, companyId: jobs.companyId })
    .from(applications)
    .innerJoin(jobs, eq(jobs.id, applications.jobId))
    .where(and(eq(applications.id, applicationId), eq(jobs.companyId, company.id)))
    .limit(1);
  if (!row) return fail("Application not found.");
  if (row.app.status === toStatus) return ok("Already in this stage.");
  if (row.app.status === "withdrawn") return fail("Withdrawn applications cannot be moved.");

  const to = toStatus as ApplicationStatus;
  await db.transaction(async (tx) => {
    await tx
      .update(applications)
      .set({ status: to, statusUpdatedAt: new Date(), updatedAt: new Date() })
      .where(eq(applications.id, applicationId));
    await tx.insert(applicationEvents).values({
      applicationId,
      fromStatus: row.app.status,
      toStatus: to,
      actorId: user.id,
    });
  });

  const label = APPLICATION_STATUS_LABEL[to];
  await notify({
    userId: row.app.candidateId,
    type: "application_status",
    title: `Application update: ${label}`,
    body: `Your application for ${row.jobTitle} is now "${label}".`,
    link: "/candidate/applications",
  });
  if (["shortlisted", "selected", "hired", "rejected"].includes(to)) {
    const [cand] = await db.select({ email: users.email, name: users.name }).from(users).where(eq(users.id, row.app.candidateId)).limit(1);
    if (cand) {
      await sendEmail({
        to: cand.email,
        kind: "application_status",
        subject: `Update on your application: ${row.jobTitle}`,
        text: `Hi ${cand.name},\n\nYour application for ${row.jobTitle} is now: ${label}.\nView details: ${APP_URL}/candidate/applications`,
      });
    }
  }
  revalidatePath(`/recruiter/jobs`);
  revalidatePath(`/recruiter/applications/${applicationId}`);
  return ok(`Moved to ${label}.`);
}

export async function setRatingAction(formData: FormData) {
  const { company } = await recruiterContext();
  const id = str(formData, "applicationId");
  const rating = Number(str(formData, "rating"));
  if (!UUID_RE.test(id) || !Number.isInteger(rating) || rating < 1 || rating > 5) return;
  const [row] = await db
    .select({ id: applications.id })
    .from(applications)
    .innerJoin(jobs, eq(jobs.id, applications.jobId))
    .where(and(eq(applications.id, id), eq(jobs.companyId, company.id)))
    .limit(1);
  if (!row) return;
  await db.update(applications).set({ rating, updatedAt: new Date() }).where(eq(applications.id, id));
  revalidatePath(`/recruiter/applications/${id}`);
  revalidatePath(`/recruiter/jobs`);
}

export async function addNoteAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user, company } = await recruiterContext();
  const id = str(formData, "applicationId");
  const body = str(formData, "body").trim();
  if (!UUID_RE.test(id)) return fail("Invalid application.");
  if (body.length < 2 || body.length > 2000) return fail("Notes must be between 2 and 2000 characters.");
  const [row] = await db
    .select({ id: applications.id })
    .from(applications)
    .innerJoin(jobs, eq(jobs.id, applications.jobId))
    .where(and(eq(applications.id, id), eq(jobs.companyId, company.id)))
    .limit(1);
  if (!row) return fail("Application not found.");
  await db.insert(candidateNotes).values({ applicationId: id, authorId: user.id, body });
  revalidatePath(`/recruiter/applications/${id}`);
  return ok("Private note saved. Only your hiring team can see it.");
}

export async function scheduleInterviewAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user, company } = await recruiterContext();
  const values = formValues(formData);
  const parsed = interviewSchema.safeParse({
    applicationId: values.applicationId ?? "",
    scheduledAt: values.scheduledAt ?? "",
    durationMinutes: values.durationMinutes ?? "",
    type: values.type ?? "",
    meetingLink: values.meetingLink ?? "",
    interviewerName: values.interviewerName ?? "",
  });
  if (!parsed.success) return zodFail(parsed.error.issues, values);
  const d = parsed.data;

  // datetime-local is entered in IST for this platform (Indian market).
  const when = new Date(d.scheduledAt.length === 16 ? `${d.scheduledAt}:00+05:30` : d.scheduledAt);
  if (Number.isNaN(when.getTime())) return fail("Pick a valid date and time.", values, { scheduledAt: "Pick a valid date and time" });
  if (when.getTime() < Date.now() - 5 * 60 * 1000) return fail("Interview time must be in the future.", values, { scheduledAt: "Choose a future time" });

  const [row] = await db
    .select({
      app: applications,
      jobTitle: jobs.title,
      candidateName: users.name,
      candidateEmail: users.email,
    })
    .from(applications)
    .innerJoin(jobs, eq(jobs.id, applications.jobId))
    .innerJoin(users, eq(users.id, applications.candidateId))
    .where(and(eq(applications.id, d.applicationId), eq(jobs.companyId, company.id)))
    .limit(1);
  if (!row) return fail("Application not found.");
  if (["rejected", "withdrawn", "hired"].includes(row.app.status)) return fail("This application is closed for interviews.");

  await db.transaction(async (tx) => {
    await tx.insert(interviews).values({
      applicationId: d.applicationId,
      scheduledById: user.id,
      scheduledAt: when,
      durationMinutes: d.durationMinutes,
      type: d.type,
      meetingLink: d.meetingLink ?? null,
      interviewerName: d.interviewerName ?? null,
    });
    if (row.app.status !== "interview_scheduled") {
      await tx
        .update(applications)
        .set({ status: "interview_scheduled", statusUpdatedAt: new Date(), updatedAt: new Date() })
        .where(eq(applications.id, d.applicationId));
      await tx.insert(applicationEvents).values({
        applicationId: d.applicationId,
        fromStatus: row.app.status,
        toStatus: "interview_scheduled",
        actorId: user.id,
      });
    }
  });

  const whenText = new Intl.DateTimeFormat("en-IN", { dateStyle: "full", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(when);
  await notify({
    userId: row.app.candidateId,
    type: "interview",
    title: `Interview scheduled: ${row.jobTitle}`,
    body: `${company.name} — ${whenText} (${d.type}).`,
    link: "/candidate/dashboard",
  });
  await sendEmail({
    to: row.candidateEmail,
    kind: "interview_invitation",
    subject: `Interview invitation: ${row.jobTitle} at ${company.name}`,
    text: `Hi ${row.candidateName},\n\nYou are invited to a ${d.type} interview for ${row.jobTitle} at ${company.name}.\nWhen: ${whenText} IST (${d.durationMinutes} minutes)\n${d.meetingLink ? `Meeting link: ${d.meetingLink}\n` : ""}\nGood luck!\n— Manick Job Portal`,
  });
  revalidatePath(`/recruiter/applications/${d.applicationId}`);
  revalidatePath("/recruiter");
  return ok("Interview scheduled and the candidate has been notified.");
}

export async function updateInterviewAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user, company } = await recruiterContext();
  const id = str(formData, "interviewId");
  const intent = str(formData, "intent");
  if (!UUID_RE.test(id)) return fail("Invalid interview.");

  const [row] = await db
    .select({ iv: interviews, appId: applications.id, candidateId: applications.candidateId, jobTitle: jobs.title })
    .from(interviews)
    .innerJoin(applications, eq(applications.id, interviews.applicationId))
    .innerJoin(jobs, eq(jobs.id, applications.jobId))
    .where(and(eq(interviews.id, id), eq(jobs.companyId, company.id)))
    .limit(1);
  if (!row) return fail("Interview not found.");

  if (intent === "complete") {
    const rating = Number(str(formData, "feedbackRating"));
    const feedback = str(formData, "feedback").trim().slice(0, 4000);
    await db
      .update(interviews)
      .set({
        status: "completed",
        feedback: feedback || null,
        feedbackRating: rating >= 1 && rating <= 5 ? rating : null,
        updatedAt: new Date(),
      })
      .where(eq(interviews.id, id));
  } else if (intent === "cancel") {
    await db.update(interviews).set({ status: "cancelled", updatedAt: new Date() }).where(eq(interviews.id, id));
    await notify({
      userId: row.candidateId,
      type: "interview",
      title: `Interview cancelled: ${row.jobTitle}`,
      body: `${company.name} cancelled the scheduled interview.`,
      link: "/candidate/dashboard",
    });
  } else if (intent === "reschedule") {
    const raw = str(formData, "scheduledAt");
    const when = new Date(raw.length === 16 ? `${raw}:00+05:30` : raw);
    if (Number.isNaN(when.getTime())) return fail("Pick a valid date and time.");
    await db.update(interviews).set({ scheduledAt: when, updatedAt: new Date() }).where(eq(interviews.id, id));
    await notify({
      userId: row.candidateId,
      type: "interview",
      title: `Interview rescheduled: ${row.jobTitle}`,
      body: `New time: ${new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(when)} IST.`,
      link: "/candidate/dashboard",
    });
  } else {
    return fail("Unknown action.");
  }
  await audit({ actorId: user.id, action: `interview.${intent}`, entityType: "interview", entityId: id });
  revalidatePath("/recruiter");
  revalidatePath(`/recruiter/applications/${row.appId}`);
  return ok("Interview updated.");
}

export async function recruiterMessageAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user, company } = await recruiterContext();
  const values = formValues(formData);
  const parsed = messageSchema.safeParse({ applicationId: values.applicationId ?? "", body: values.body ?? "" });
  if (!parsed.success) return zodFail(parsed.error.issues, values);
  const [row] = await db
    .select({ candidateId: applications.candidateId, jobTitle: jobs.title })
    .from(applications)
    .innerJoin(jobs, eq(jobs.id, applications.jobId))
    .where(and(eq(applications.id, parsed.data.applicationId), eq(jobs.companyId, company.id)))
    .limit(1);
  if (!row) return fail("Application not found.");
  const { messages } = await import("@/db/schema");
  await db.insert(messages).values({
    senderId: user.id,
    recipientId: row.candidateId,
    applicationId: parsed.data.applicationId,
    body: parsed.data.body,
  });
  await notify({
    userId: row.candidateId,
    type: "message",
    title: `New message from ${company.name}`,
    body: row.jobTitle,
    link: "/inbox",
  });
  revalidatePath(`/recruiter/applications/${parsed.data.applicationId}`);
  return ok("Message sent.");
}

/** Form-friendly wrapper so plain <form action> buttons can move a candidate between stages. */
export async function setStatusFormAction(formData: FormData) {
  await moveApplicationAction(str(formData, "applicationId"), str(formData, "toStatus"));
}
