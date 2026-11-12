"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, count, eq, inArray, ne } from "drizzle-orm";
import { db } from "@/db";
import {
  applicationEvents,
  applications,
  candidateProfiles,
  candidateSkills,
  companies,
  companyMembers,
  followedCompanies,
  jobAlerts,
  jobSkills,
  jobs,
  resumes,
  savedJobs,
  skills,
  users,
} from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { fail, formValues, ok, str, zodFail, type ActionState } from "@/lib/action-state";
import { computeMatchScore } from "@/lib/match";
import { audit, deleteUpload, notify, saveUpload, sendEmail, validateResume } from "@/lib/services";
import { splitList, upsertSkills } from "@/lib/taxonomy";
import { alertSchema, applicationSchema, profileSchema } from "@/lib/validation";
import { APP_URL } from "@/lib/utils";
import { getSetting } from "@/lib/queries/admin";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_RESUMES = 5;

function cleanFileName(name: string) {
  return name.replace(/[^\w.\- ]/g, "_").slice(0, 200) || "resume";
}

export async function updateProfileAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser("candidate");
  const values = formValues(formData);
  const parsed = profileSchema.safeParse({
    ...values,
    isFresher: formData.get("isFresher") ?? undefined,
    profileVisible: formData.get("profileVisible") ?? undefined,
    openToWork: formData.get("openToWork") ?? undefined,
  });
  if (!parsed.success) return zodFail(parsed.error.issues, values);
  const d = parsed.data;
  const skillNames = splitList(d.skills, 30);

  const profileFields = {
    headline: d.headline ?? null,
    summary: d.summary ?? null,
    currentLocation: d.currentLocation ?? null,
    preferredLocations: d.preferredLocations ?? null,
    currentCompany: d.currentCompany ?? null,
    currentDesignation: d.currentDesignation ?? null,
    totalExperienceYears: d.totalExperienceYears,
    currentSalary: d.currentSalary ?? null,
    expectedSalary: d.expectedSalary ?? null,
    noticePeriodDays: d.noticePeriodDays ?? null,
    employmentPreference: d.employmentPreference ?? null,
    preferredIndustries: d.preferredIndustries ?? null,
    preferredRoles: d.preferredRoles ?? null,
    softSkills: d.softSkills ?? null,
    college: d.college ?? null,
    degree: d.degree ?? null,
    graduationYear: d.graduationYear ?? null,
    certifications: d.certifications ?? null,
    projects: d.projects ?? null,
    linkedinUrl: d.linkedinUrl ?? null,
    githubUrl: d.githubUrl ?? null,
    portfolioUrl: d.portfolioUrl ?? null,
    isFresher: d.isFresher,
    profileVisible: d.profileVisible,
    openToWork: d.openToWork,
  };

  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ name: d.name, phone: d.phone ?? null, updatedAt: new Date() })
      .where(eq(users.id, user.id));
    await tx
      .insert(candidateProfiles)
      .values({ userId: user.id, ...profileFields })
      .onConflictDoUpdate({
        target: candidateProfiles.userId,
        set: { ...profileFields, updatedAt: new Date() },
      });
    await tx.delete(candidateSkills).where(eq(candidateSkills.userId, user.id));
    const ids = await upsertSkills(tx, skillNames);
    if (ids.length) {
      await tx
        .insert(candidateSkills)
        .values(ids.map((skillId) => ({ userId: user.id, skillId })))
        .onConflictDoNothing();
    }
  });

  revalidatePath("/candidate/profile");
  revalidatePath("/candidate/dashboard");
  return ok("Profile saved. Your changes are live.");
}

export async function uploadResumeAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser("candidate");
  const file = formData.get("file");
  const label = (str(formData, "label").trim() || "My resume").slice(0, 120);
  if (!(file instanceof File) || file.size === 0) return fail("Choose a PDF or DOCX file to upload.");

  const existing = await db.select({ id: resumes.id }).from(resumes).where(eq(resumes.userId, user.id));
  if (existing.length >= MAX_RESUMES) {
    return fail(`You can store up to ${MAX_RESUMES} resumes. Delete one to upload another.`);
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const check = validateResume(buf, file.type, file.size);
  if ("error" in check) return fail(check.error);

  const key = await saveUpload(buf, check.ext, `resumes/${user.id}`);
  await db.insert(resumes).values({
    userId: user.id,
    label,
    fileName: cleanFileName(file.name),
    storageKey: key,
    mimeType: file.type,
    sizeBytes: file.size,
    isPrimary: existing.length === 0,
  });
  revalidatePath("/candidate/resumes");
  return ok("Resume uploaded successfully.");
}

export async function setPrimaryResumeAction(formData: FormData) {
  const user = await requireUser("candidate");
  const id = str(formData, "id");
  if (!UUID_RE.test(id)) return;
  await db.transaction(async (tx) => {
    await tx.update(resumes).set({ isPrimary: false }).where(eq(resumes.userId, user.id));
    await tx.update(resumes).set({ isPrimary: true }).where(and(eq(resumes.id, id), eq(resumes.userId, user.id)));
  });
  revalidatePath("/candidate/resumes");
}

export async function toggleResumeVisibilityAction(formData: FormData) {
  const user = await requireUser("candidate");
  const id = str(formData, "id");
  if (!UUID_RE.test(id)) return;
  const [r] = await db.select().from(resumes).where(and(eq(resumes.id, id), eq(resumes.userId, user.id))).limit(1);
  if (!r) return;
  await db.update(resumes).set({ isVisible: !r.isVisible, updatedAt: new Date() }).where(eq(resumes.id, id));
  revalidatePath("/candidate/resumes");
}

export async function deleteResumeAction(formData: FormData) {
  const user = await requireUser("candidate");
  const id = str(formData, "id");
  if (!UUID_RE.test(id)) return;
  const [r] = await db.select().from(resumes).where(and(eq(resumes.id, id), eq(resumes.userId, user.id))).limit(1);
  if (!r) return;
  await deleteUpload(r.storageKey);
  await db.delete(resumes).where(eq(resumes.id, id));
  if (r.isPrimary) {
    const [next] = await db.select({ id: resumes.id }).from(resumes).where(eq(resumes.userId, user.id)).limit(1);
    if (next) await db.update(resumes).set({ isPrimary: true }).where(eq(resumes.id, next.id));
  }
  revalidatePath("/candidate/resumes");
}

export async function applyToJobAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser("candidate");
  const values = formValues(formData);

  if ((await getSetting("maintenance_mode")) === "on") {
    return fail("Applications are temporarily paused for maintenance. Please try again shortly.", values);
  }

  const parsed = applicationSchema.safeParse({
    jobId: str(formData, "jobId"),
    coverLetter: values.coverLetter ?? "",
    resumeId: values.resumeId ?? "",
  });
  if (!parsed.success) return zodFail(parsed.error.issues, values);
  const { jobId, coverLetter } = parsed.data;

  const [row] = await db
    .select({
      job: jobs,
      companyName: companies.name,
      companySuspended: companies.suspended,
    })
    .from(jobs)
    .innerJoin(companies, eq(companies.id, jobs.companyId))
    .where(eq(jobs.id, jobId))
    .limit(1);
  if (
    !row ||
    row.job.status !== "published" ||
    row.companySuspended ||
    (row.job.deadline && row.job.deadline < new Date())
  ) {
    return fail("This job is no longer accepting applications.");
  }

  const dup = await db
    .select({ id: applications.id })
    .from(applications)
    .where(and(eq(applications.jobId, jobId), eq(applications.candidateId, user.id)))
    .limit(1);
  if (dup.length) return fail("You have already applied for this job.");

  // Resume: either an existing owned resume or a freshly uploaded one.
  let resumeId: string;
  if (parsed.data.resumeId === "new") {
    const file = formData.get("newResume");
    if (!(file instanceof File) || file.size === 0) {
      return fail("Upload a PDF or DOCX resume, or select an existing one.", values, { resumeId: "Upload a resume" });
    }
    const buf = Buffer.from(await file.arrayBuffer());
    const check = validateResume(buf, file.type, file.size);
    if ("error" in check) return fail(check.error, values, { resumeId: check.error });
    const owned = await db.select({ id: resumes.id }).from(resumes).where(eq(resumes.userId, user.id));
    if (owned.length >= MAX_RESUMES) return fail(`You can store up to ${MAX_RESUMES} resumes. Delete one first.`, values);
    const key = await saveUpload(buf, check.ext, `resumes/${user.id}`);
    const [created] = await db
      .insert(resumes)
      .values({
        userId: user.id,
        label: "Uploaded while applying",
        fileName: cleanFileName(file.name),
        storageKey: key,
        mimeType: file.type,
        sizeBytes: file.size,
        isPrimary: owned.length === 0,
      })
      .returning({ id: resumes.id });
    resumeId = created.id;
  } else {
    if (!UUID_RE.test(parsed.data.resumeId)) return fail("Choose a valid resume.", values, { resumeId: "Choose a resume" });
    const [owned] = await db
      .select({ id: resumes.id })
      .from(resumes)
      .where(and(eq(resumes.id, parsed.data.resumeId), eq(resumes.userId, user.id)))
      .limit(1);
    if (!owned) return fail("Selected resume was not found in your account.", values, { resumeId: "Choose a valid resume" });
    resumeId = owned.id;
  }

  // Screening answers (all required).
  const questions = row.job.screeningQuestions ?? [];
  const answers: Record<string, string> = {};
  for (let i = 0; i < questions.length; i++) {
    const a = (str(formData, `answer_${i}`) ?? "").trim();
    if (!a) return fail("Please answer all screening questions.", values, { [`answer_${i}`]: "This answer is required" });
    answers[questions[i]] = a.slice(0, 1000);
  }

  // Transparent skill + experience matching (explainable, human-reviewed).
  const jobSkillRows = await db
    .select({ name: skills.name, required: jobSkills.required })
    .from(jobSkills)
    .innerJoin(skills, eq(skills.id, jobSkills.skillId))
    .where(eq(jobSkills.jobId, jobId));
  const candSkillRows = await db
    .select({ name: skills.name })
    .from(candidateSkills)
    .innerJoin(skills, eq(skills.id, candidateSkills.skillId))
    .where(eq(candidateSkills.userId, user.id));
  const [profile] = await db.select().from(candidateProfiles).where(eq(candidateProfiles.userId, user.id)).limit(1);
  const matchScore = computeMatchScore({
    requiredSkills: jobSkillRows.filter((s) => s.required).map((s) => s.name),
    preferredSkills: jobSkillRows.filter((s) => !s.required).map((s) => s.name),
    candidateSkills: candSkillRows.map((s) => s.name),
    candidateExperience: profile?.totalExperienceYears ?? 0,
    minExperience: row.job.minExperience,
    maxExperience: row.job.maxExperience,
  });

  let appId: string;
  try {
    appId = await db.transaction(async (tx) => {
      const [app] = await tx
        .insert(applications)
        .values({
          jobId,
          candidateId: user.id,
          resumeId,
          coverLetter: coverLetter ?? null,
          answers,
          matchScore,
          status: "applied",
        })
        .returning({ id: applications.id });
      await tx.insert(applicationEvents).values({ applicationId: app.id, fromStatus: null, toStatus: "applied", actorId: user.id });
      return app.id;
    });
  } catch (err) {
    if (typeof err === "object" && err && "code" in err && (err as { code?: string }).code === "23505") {
      return fail("You have already applied for this job.");
    }
    throw err;
  }

  await notify({
    userId: user.id,
    type: "application",
    title: "Application submitted",
    body: `You applied for ${row.job.title} at ${row.companyName}.`,
    link: "/candidate/applications",
  });
  await sendEmail({
    to: user.email,
    kind: "application_confirmation",
    subject: `Application received: ${row.job.title} at ${row.companyName}`,
    text: `Hi ${user.name},\n\nYour application for ${row.job.title} at ${row.companyName} has been submitted.\nTrack its status at ${APP_URL}/candidate/applications\n\n— SetuJobs`,
  });

  // Notify every recruiter on the hiring team.
  const members = await db
    .select({ userId: companyMembers.userId, email: users.email, name: users.name })
    .from(companyMembers)
    .innerJoin(users, eq(users.id, companyMembers.userId))
    .where(eq(companyMembers.companyId, row.job.companyId));
  for (const m of members) {
    await notify({
      userId: m.userId,
      type: "new_applicant",
      title: "New applicant",
      body: `${user.name} applied for ${row.job.title} (match ${matchScore}%).`,
      link: `/recruiter/applications/${appId}`,
    });
    await sendEmail({
      to: m.email,
      kind: "new_applicant",
      subject: `New applicant for ${row.job.title}`,
      text: `Hi ${m.name},\n\n${user.name} applied for ${row.job.title}. Match score: ${matchScore}%.\nReview: ${APP_URL}/recruiter/applications/${appId}`,
    });
  }

  await audit({ actorId: user.id, action: "application.submit", entityType: "application", entityId: appId, metadata: { jobId, matchScore } });
  revalidatePath("/candidate/applications");
  redirect("/candidate/applications?applied=1");
}

export async function withdrawApplicationAction(formData: FormData) {
  const user = await requireUser("candidate");
  const id = str(formData, "id");
  if (!UUID_RE.test(id)) return;
  const [app] = await db
    .select()
    .from(applications)
    .where(and(eq(applications.id, id), eq(applications.candidateId, user.id)))
    .limit(1);
  if (!app || ["hired", "selected", "rejected", "withdrawn"].includes(app.status)) return;
  await db.transaction(async (tx) => {
    await tx
      .update(applications)
      .set({ status: "withdrawn", statusUpdatedAt: new Date(), updatedAt: new Date() })
      .where(eq(applications.id, id));
    await tx.insert(applicationEvents).values({
      applicationId: id,
      fromStatus: app.status,
      toStatus: "withdrawn",
      actorId: user.id,
    });
  });
  revalidatePath("/candidate/applications");
}

export async function toggleSaveJobAction(formData: FormData) {
  const user = await requireUser("candidate");
  const jobId = str(formData, "jobId");
  if (!UUID_RE.test(jobId)) return;
  const [existing] = await db
    .select()
    .from(savedJobs)
    .where(and(eq(savedJobs.userId, user.id), eq(savedJobs.jobId, jobId)))
    .limit(1);
  if (existing) {
    await db.delete(savedJobs).where(and(eq(savedJobs.userId, user.id), eq(savedJobs.jobId, jobId)));
  } else {
    await db.insert(savedJobs).values({ userId: user.id, jobId }).onConflictDoNothing();
  }
  revalidatePath("/candidate/saved");
}

export async function toggleFollowCompanyAction(formData: FormData) {
  const user = await requireUser("candidate");
  const companyId = str(formData, "companyId");
  if (!UUID_RE.test(companyId)) return;
  const [existing] = await db
    .select()
    .from(followedCompanies)
    .where(and(eq(followedCompanies.userId, user.id), eq(followedCompanies.companyId, companyId)))
    .limit(1);
  if (existing) {
    await db
      .delete(followedCompanies)
      .where(and(eq(followedCompanies.userId, user.id), eq(followedCompanies.companyId, companyId)));
  } else {
    await db.insert(followedCompanies).values({ userId: user.id, companyId }).onConflictDoNothing();
  }
  revalidatePath("/candidate/saved");
}

export async function createJobAlertAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser("candidate");
  const values = formValues(formData);
  const parsed = alertSchema.safeParse({
    keywords: values.keywords ?? "",
    location: values.location ?? "",
    workMode: values.workMode ?? "",
  });
  if (!parsed.success) return zodFail(parsed.error.issues, values);
  const [{ value }] = await db
    .select({ value: count() })
    .from(jobAlerts)
    .where(eq(jobAlerts.userId, user.id));
  if (Number(value) >= 10) return fail("You can create up to 10 job alerts.", values);
  await db.insert(jobAlerts).values({
    userId: user.id,
    keywords: parsed.data.keywords,
    location: parsed.data.location ?? null,
    workMode: parsed.data.workMode ?? null,
  });
  revalidatePath("/candidate/saved");
  return ok("Job alert created. We'll notify you about matching roles.");
}

export async function deleteJobAlertAction(formData: FormData) {
  const user = await requireUser("candidate");
  const id = str(formData, "id");
  if (!UUID_RE.test(id)) return;
  await db.delete(jobAlerts).where(and(eq(jobAlerts.id, id), eq(jobAlerts.userId, user.id)));
  revalidatePath("/candidate/saved");
}

