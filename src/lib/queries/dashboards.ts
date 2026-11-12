import { and, asc, count, desc, eq, gte, ilike, inArray, isNull, ne, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  applicationEvents,
  applications,
  candidateNotes,
  candidateProfiles,
  candidateSkills,
  companies,
  companyMembers,
  interviews,
  jobAlerts,
  jobs,
  jobSkills,
  messages,
  notifications,
  resumes,
  savedJobs,
  skills,
  subscriptionPlans,
  users,
} from "@/db/schema";
import { PAGE_SIZE, escapeLike, toNum } from "@/lib/utils";

/* ---------------- Recruiter / company ---------------- */

export async function getRecruiterCompany(userId: string) {
  const [row] = await db
    .select({ company: companies, membership: companyMembers })
    .from(companyMembers)
    .innerJoin(companies, eq(companies.id, companyMembers.companyId))
    .where(eq(companyMembers.userId, userId))
    .orderBy(asc(companyMembers.createdAt))
    .limit(1);
  return row ?? null;
}

export async function getCompanyPlan(code: string) {
  const [plan] = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.code, code)).limit(1);
  return plan ?? null;
}

function countBy<T extends Record<string, unknown>>(rows: T[], key: keyof T) {
  const out: Record<string, number> = {};
  for (const r of rows) out[String(r[key])] = toNum(r.n);
  return out;
}

export async function getRecruiterDashboard(companyId: string) {
  const [jobRows, appRows, recent, perJob, upcoming] = await Promise.all([
    db.select({ status: jobs.status, n: count() }).from(jobs).where(eq(jobs.companyId, companyId)).groupBy(jobs.status),
    db
      .select({ status: applications.status, n: count() })
      .from(applications)
      .innerJoin(jobs, eq(jobs.id, applications.jobId))
      .where(eq(jobs.companyId, companyId))
      .groupBy(applications.status),
    db
      .select({
        id: applications.id,
        status: applications.status,
        appliedAt: applications.createdAt,
        candidateName: users.name,
        jobTitle: jobs.title,
      })
      .from(applications)
      .innerJoin(jobs, eq(jobs.id, applications.jobId))
      .innerJoin(users, eq(users.id, applications.candidateId))
      .where(eq(jobs.companyId, companyId))
      .orderBy(desc(applications.createdAt))
      .limit(8),
    db
      .select({
        id: jobs.id,
        title: jobs.title,
        status: jobs.status,
        views: jobs.viewsCount,
        applicants: count(applications.id),
      })
      .from(jobs)
      .leftJoin(applications, eq(applications.jobId, jobs.id))
      .where(eq(jobs.companyId, companyId))
      .groupBy(jobs.id)
      .orderBy(desc(count(applications.id)))
      .limit(8),
    db
      .select({
        id: interviews.id,
        scheduledAt: interviews.scheduledAt,
        type: interviews.type,
        candidateName: users.name,
        jobTitle: jobs.title,
        appId: applications.id,
      })
      .from(interviews)
      .innerJoin(applications, eq(applications.id, interviews.applicationId))
      .innerJoin(jobs, eq(jobs.id, applications.jobId))
      .innerJoin(users, eq(users.id, applications.candidateId))
      .where(and(eq(jobs.companyId, companyId), eq(interviews.status, "scheduled"), gte(interviews.scheduledAt, new Date())))
      .orderBy(asc(interviews.scheduledAt))
      .limit(6),
  ]);
  const jobsByStatus = countBy(jobRows, "status");
  const appsByStatus = countBy(appRows, "status");
  return {
    jobsByStatus,
    appsByStatus,
    totals: {
      jobs: Object.values(jobsByStatus).reduce((a, b) => a + b, 0),
      activeJobs: (jobsByStatus.published ?? 0) + (jobsByStatus.pending_review ?? 0),
      expiredJobs: jobsByStatus.closed ?? 0,
      applicants: Object.values(appsByStatus).reduce((a, b) => a + b, 0),
      newApplicants: appsByStatus.applied ?? 0,
      shortlisted: appsByStatus.shortlisted ?? 0,
      interviews: upcoming.length,
      hired: (appsByStatus.hired ?? 0) + (appsByStatus.selected ?? 0),
    },
    recent,
    perJob,
    upcoming,
  };
}

export async function listCompanyJobs(companyId: string, status?: string) {
  const conds: (SQL | undefined)[] = [eq(jobs.companyId, companyId)];
  if (status) conds.push(eq(jobs.status, status as never));
  return db
    .select({
      job: jobs,
      applicants: count(applications.id),
    })
    .from(jobs)
    .leftJoin(applications, eq(applications.jobId, jobs.id))
    .where(and(...conds))
    .groupBy(jobs.id)
    .orderBy(desc(jobs.createdAt));
}

export async function getJobForCompany(jobId: string, companyId: string) {
  const [job] = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.id, jobId), eq(jobs.companyId, companyId)))
    .limit(1);
  if (!job) return null;
  const sk = await db
    .select({ name: skills.name, required: jobSkills.required })
    .from(jobSkills)
    .innerJoin(skills, eq(skills.id, jobSkills.skillId))
    .where(eq(jobSkills.jobId, job.id));
  return {
    job,
    requiredSkills: sk.filter((s) => s.required).map((s) => s.name),
    preferredSkills: sk.filter((s) => !s.required).map((s) => s.name),
  };
}

export async function getJobApplicants(jobId: string, companyId: string) {
  return db
    .select({
      id: applications.id,
      status: applications.status,
      rating: applications.rating,
      matchScore: applications.matchScore,
      appliedAt: applications.createdAt,
      candidateId: users.id,
      candidateName: users.name,
      headline: candidateProfiles.headline,
      experience: candidateProfiles.totalExperienceYears,
      resumeId: resumes.id,
      resumeName: resumes.fileName,
    })
    .from(applications)
    .innerJoin(jobs, eq(jobs.id, applications.jobId))
    .innerJoin(users, eq(users.id, applications.candidateId))
    .leftJoin(candidateProfiles, eq(candidateProfiles.userId, users.id))
    .leftJoin(resumes, eq(resumes.id, applications.resumeId))
    .where(and(eq(applications.jobId, jobId), eq(jobs.companyId, companyId)))
    .orderBy(desc(applications.createdAt));
}

export async function getApplicationDetail(appId: string, companyId: string) {
  const [row] = await db
    .select({
      app: applications,
      job: { id: jobs.id, title: jobs.title, slug: jobs.slug, minExperience: jobs.minExperience, maxExperience: jobs.maxExperience, screeningQuestions: jobs.screeningQuestions },
      candidate: { id: users.id, name: users.name, email: users.email, phone: users.phone },
      profile: candidateProfiles,
      resume: { id: resumes.id, fileName: resumes.fileName, label: resumes.label },
    })
    .from(applications)
    .innerJoin(jobs, eq(jobs.id, applications.jobId))
    .innerJoin(users, eq(users.id, applications.candidateId))
    .leftJoin(candidateProfiles, eq(candidateProfiles.userId, users.id))
    .leftJoin(resumes, eq(resumes.id, applications.resumeId))
    .where(and(eq(applications.id, appId), eq(jobs.companyId, companyId)))
    .limit(1);
  if (!row) return null;

  const [sk, notes, events, ivs, msgs] = await Promise.all([
    db
      .select({ name: skills.name, slug: skills.slug })
      .from(candidateSkills)
      .innerJoin(skills, eq(skills.id, candidateSkills.skillId))
      .where(eq(candidateSkills.userId, row.candidate.id)),
    db
      .select({ id: candidateNotes.id, body: candidateNotes.body, createdAt: candidateNotes.createdAt, author: users.name })
      .from(candidateNotes)
      .leftJoin(users, eq(users.id, candidateNotes.authorId))
      .where(eq(candidateNotes.applicationId, appId))
      .orderBy(desc(candidateNotes.createdAt)),
    db
      .select()
      .from(applicationEvents)
      .where(eq(applicationEvents.applicationId, appId))
      .orderBy(desc(applicationEvents.createdAt)),
    db
      .select()
      .from(interviews)
      .where(eq(interviews.applicationId, appId))
      .orderBy(desc(interviews.scheduledAt)),
    db
      .select({ id: messages.id, body: messages.body, createdAt: messages.createdAt, senderId: messages.senderId, senderName: users.name })
      .from(messages)
      .innerJoin(users, eq(users.id, messages.senderId))
      .where(eq(messages.applicationId, appId))
      .orderBy(asc(messages.createdAt)),
  ]);

  return { ...row, skills: sk, notes, events, interviews: ivs, messages: msgs };
}

/* ---------------- Candidate search (resume database) ---------------- */

export type CandidateFilters = {
  q?: string;
  skill?: string;
  minExp?: number;
  maxExp?: number;
  location?: string;
  education?: string;
  maxSalary?: number;
  maxNotice?: number;
  industry?: string;
  page?: number;
};

export async function searchCandidates(f: CandidateFilters) {
  const page = Math.max(1, f.page ?? 1);
  const conds: (SQL | undefined)[] = [
    eq(users.role, "candidate"),
    eq(users.status, "active"),
    sql`${users.emailVerifiedAt} is not null`,
    eq(candidateProfiles.profileVisible, true),
  ];
  if (f.q) {
    const pat = `%${escapeLike(f.q.trim())}%`;
    conds.push(
      or(
        ilike(users.name, pat),
        ilike(candidateProfiles.headline, pat),
        ilike(candidateProfiles.currentDesignation, pat),
        sql`exists (select 1 from ${candidateSkills} inner join ${skills} on ${skills.id} = ${candidateSkills.skillId} where ${candidateSkills.userId} = ${users.id} and ${skills.name} ilike ${pat})`,
      ),
    );
  }
  if (f.skill) {
    const pat = `%${escapeLike(f.skill.trim())}%`;
    conds.push(
      sql`exists (select 1 from ${candidateSkills} inner join ${skills} on ${skills.id} = ${candidateSkills.skillId} where ${candidateSkills.userId} = ${users.id} and ${skills.name} ilike ${pat})`,
    );
  }
  if (f.minExp != null) conds.push(gte(candidateProfiles.totalExperienceYears, f.minExp));
  if (f.maxExp != null) conds.push(sql`${candidateProfiles.totalExperienceYears} <= ${f.maxExp}`);
  if (f.location) {
    const pat = `%${escapeLike(f.location.trim())}%`;
    conds.push(or(ilike(candidateProfiles.currentLocation, pat), ilike(candidateProfiles.preferredLocations, pat)));
  }
  if (f.education) {
    const pat = `%${escapeLike(f.education.trim())}%`;
    conds.push(or(ilike(candidateProfiles.college, pat), ilike(candidateProfiles.degree, pat)));
  }
  if (f.maxSalary != null) conds.push(sql`${candidateProfiles.expectedSalary} <= ${f.maxSalary}`);
  if (f.maxNotice != null) conds.push(sql`${candidateProfiles.noticePeriodDays} <= ${f.maxNotice}`);
  if (f.industry) conds.push(ilike(candidateProfiles.preferredIndustries, `%${escapeLike(f.industry.trim())}%`));

  const where = and(...conds);
  const base = db
    .select({
      id: users.id,
      name: users.name,
      headline: candidateProfiles.headline,
      designation: candidateProfiles.currentDesignation,
      company: candidateProfiles.currentCompany,
      location: candidateProfiles.currentLocation,
      experience: candidateProfiles.totalExperienceYears,
      expectedSalary: candidateProfiles.expectedSalary,
      noticePeriodDays: candidateProfiles.noticePeriodDays,
      college: candidateProfiles.college,
      isFresher: candidateProfiles.isFresher,
      openToWork: candidateProfiles.openToWork,
    })
    .from(users)
    .innerJoin(candidateProfiles, eq(candidateProfiles.userId, users.id))
    .where(where);

  const [items, [totalRow]] = await Promise.all([
    base.orderBy(desc(candidateProfiles.updatedAt)).limit(PAGE_SIZE).offset((page - 1) * PAGE_SIZE),
    db
      .select({ value: count() })
      .from(users)
      .innerJoin(candidateProfiles, eq(candidateProfiles.userId, users.id))
      .where(where),
  ]);

  const ids = items.map((i) => i.id);
  const skillRows = ids.length
    ? await db
        .select({ userId: candidateSkills.userId, name: skills.name })
        .from(candidateSkills)
        .innerJoin(skills, eq(skills.id, candidateSkills.skillId))
        .where(inArray(candidateSkills.userId, ids))
    : [];
  const skillMap = new Map<string, string[]>();
  for (const s of skillRows) skillMap.set(s.userId, [...(skillMap.get(s.userId) ?? []), s.name]);

  const total = toNum(totalRow?.value);
  return {
    items: items.map((i) => ({ ...i, skills: skillMap.get(i.id) ?? [] })),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

/* ---------------- Candidate ---------------- */

export async function getCandidateProfile(userId: string) {
  const [user] = await db
    .select({ id: users.id, name: users.name, email: users.email, phone: users.phone, emailVerifiedAt: users.emailVerifiedAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const [profile] = await db.select().from(candidateProfiles).where(eq(candidateProfiles.userId, userId)).limit(1);
  const skillRows = await db
    .select({ name: skills.name })
    .from(candidateSkills)
    .innerJoin(skills, eq(skills.id, candidateSkills.skillId))
    .where(eq(candidateSkills.userId, userId))
    .orderBy(asc(skills.name));
  const resumeRows = await listResumes(userId);
  return { user, profile: profile ?? null, skills: skillRows.map((s) => s.name), resumes: resumeRows };
}

export async function getCandidateSkillSlugs(userId: string) {
  const rows = await db
    .select({ slug: skills.slug, name: skills.name })
    .from(candidateSkills)
    .innerJoin(skills, eq(skills.id, candidateSkills.skillId))
    .where(eq(candidateSkills.userId, userId));
  return rows;
}

export async function listResumes(userId: string) {
  return db.select().from(resumes).where(eq(resumes.userId, userId)).orderBy(desc(resumes.isPrimary), desc(resumes.createdAt));
}

export async function listCandidateApplications(userId: string) {
  const rows = await db
    .select({
      id: applications.id,
      status: applications.status,
      appliedAt: applications.createdAt,
      statusUpdatedAt: applications.statusUpdatedAt,
      matchScore: applications.matchScore,
      jobId: jobs.id,
      jobTitle: jobs.title,
      jobSlug: jobs.slug,
      jobCity: jobs.city,
      companyName: companies.name,
      resumeName: resumes.fileName,
    })
    .from(applications)
    .innerJoin(jobs, eq(jobs.id, applications.jobId))
    .innerJoin(companies, eq(companies.id, jobs.companyId))
    .leftJoin(resumes, eq(resumes.id, applications.resumeId))
    .where(eq(applications.candidateId, userId))
    .orderBy(desc(applications.createdAt));
  const ids = rows.map((r) => r.id);
  const events = ids.length
    ? await db.select().from(applicationEvents).where(inArray(applicationEvents.applicationId, ids)).orderBy(asc(applicationEvents.createdAt))
    : [];
  const ivs = ids.length
    ? await db
        .select()
        .from(interviews)
        .where(and(inArray(interviews.applicationId, ids), eq(interviews.status, "scheduled")))
        .orderBy(asc(interviews.scheduledAt))
    : [];
  return rows.map((r) => ({
    ...r,
    events: events.filter((e) => e.applicationId === r.id),
    interview: ivs.find((i) => i.applicationId === r.id) ?? null,
  }));
}

export async function listSavedJobs(userId: string) {
  const { listJobs } = await import("@/lib/queries/jobs");
  const rows = await db.select({ jobId: savedJobs.jobId }).from(savedJobs).where(eq(savedJobs.userId, userId)).orderBy(desc(savedJobs.createdAt));
  if (rows.length === 0) return [];
  const list = await listJobs(inArray(jobs.id, rows.map((r) => r.jobId)), [desc(jobs.createdAt)], 100);
  return list;
}

export async function listSavedJobIds(userId: string) {
  const rows = await db.select({ jobId: savedJobs.jobId }).from(savedJobs).where(eq(savedJobs.userId, userId));
  return new Set(rows.map((r) => r.jobId));
}

export async function listAlerts(userId: string) {
  return db.select().from(jobAlerts).where(eq(jobAlerts.userId, userId)).orderBy(desc(jobAlerts.createdAt));
}

export async function getCandidateDashboard(userId: string) {
  const [profileData, appCounts, savedCount, activity, upcomingInterviews, alertCount] = await Promise.all([
    getCandidateProfile(userId),
    db
      .select({ status: applications.status, n: count() })
      .from(applications)
      .where(eq(applications.candidateId, userId))
      .groupBy(applications.status),
    db.select({ value: count() }).from(savedJobs).where(eq(savedJobs.userId, userId)),
    db
      .select({
        id: applicationEvents.id,
        toStatus: applicationEvents.toStatus,
        createdAt: applicationEvents.createdAt,
        jobTitle: jobs.title,
        companyName: companies.name,
      })
      .from(applicationEvents)
      .innerJoin(applications, eq(applications.id, applicationEvents.applicationId))
      .innerJoin(jobs, eq(jobs.id, applications.jobId))
      .innerJoin(companies, eq(companies.id, jobs.companyId))
      .where(eq(applications.candidateId, userId))
      .orderBy(desc(applicationEvents.createdAt))
      .limit(8),
    db
      .select({
        id: interviews.id,
        scheduledAt: interviews.scheduledAt,
        type: interviews.type,
        meetingLink: interviews.meetingLink,
        jobTitle: jobs.title,
        companyName: companies.name,
      })
      .from(interviews)
      .innerJoin(applications, eq(applications.id, interviews.applicationId))
      .innerJoin(jobs, eq(jobs.id, applications.jobId))
      .innerJoin(companies, eq(companies.id, jobs.companyId))
      .where(and(eq(applications.candidateId, userId), eq(interviews.status, "scheduled"), gte(interviews.scheduledAt, new Date())))
      .orderBy(asc(interviews.scheduledAt))
      .limit(5),
    db.select({ value: count() }).from(jobAlerts).where(and(eq(jobAlerts.userId, userId), eq(jobAlerts.isActive, true))),
  ]);

  const byStatus = countBy(appCounts, "status");
  const skillSlugs = (await getCandidateSkillSlugs(userId)).map((s) => s.slug);
  const appliedIds = (await db.select({ jobId: applications.jobId }).from(applications).where(eq(applications.candidateId, userId))).map((r) => r.jobId);
  const { getRecommendedJobs } = await import("@/lib/queries/jobs");
  const recommended = await getRecommendedJobs(skillSlugs, appliedIds, 6);

  const p = profileData.profile;
  const { profileCompleteness } = await import("@/lib/match");
  const completeness = profileCompleteness({
    headline: p?.headline,
    summary: p?.summary,
    currentLocation: p?.currentLocation,
    currentDesignation: p?.currentDesignation,
    college: p?.college,
    skillCount: profileData.skills.length,
    resumeCount: profileData.resumes.length,
    hasLinks: !!(p?.linkedinUrl || p?.githubUrl || p?.portfolioUrl),
    expectedSalary: p?.expectedSalary,
    noticePeriodDays: p?.noticePeriodDays,
  });

  return {
    profile: profileData,
    completeness,
    byStatus,
    totalApplications: Object.values(byStatus).reduce((a, b) => a + b, 0),
    savedCount: toNum(savedCount[0]?.value),
    alertCount: toNum(alertCount[0]?.value),
    activity,
    upcomingInterviews,
    recommended,
  };
}

/* ---------------- Shared: notifications & messages ---------------- */

export async function getNotifications(userId: string, limit = 50) {
  const rows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
  const [unread] = await db
    .select({ value: count() })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  return { rows, unread: toNum(unread?.value) };
}

export async function getInbox(userId: string) {
  return db
    .select({
      id: messages.id,
      body: messages.body,
      createdAt: messages.createdAt,
      readAt: messages.readAt,
      senderId: messages.senderId,
      recipientId: messages.recipientId,
      senderName: users.name,
      applicationId: messages.applicationId,
      jobTitle: jobs.title,
    })
    .from(messages)
    .innerJoin(users, eq(users.id, messages.senderId))
    .leftJoin(applications, eq(applications.id, messages.applicationId))
    .leftJoin(jobs, eq(jobs.id, applications.jobId))
    .where(or(eq(messages.recipientId, userId), eq(messages.senderId, userId)))
    .orderBy(desc(messages.createdAt))
    .limit(100);
}

export async function unreadMessageCount(userId: string) {
  const [row] = await db
    .select({ value: count() })
    .from(messages)
    .where(and(eq(messages.recipientId, userId), isNull(messages.readAt)));
  return toNum(row?.value);
}

export async function getCompanyMemberUserIds(companyId: string) {
  const rows = await db.select({ userId: companyMembers.userId }).from(companyMembers).where(eq(companyMembers.companyId, companyId));
  return rows.map((r) => r.userId);
}

export async function getUserRole(userId: string) {
  const [u] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId)).limit(1);
  return u?.role ?? null;
}

