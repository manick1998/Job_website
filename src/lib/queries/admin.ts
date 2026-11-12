import { and, count, desc, eq, gte, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  applications,
  auditLogs,
  blogPosts,
  companies,
  companyMembers,
  emailLog,
  jobCategories,
  jobs,
  platformSettings,
  reports,
  subscriptionPlans,
  users,
  type JobStatus,
} from "@/db/schema";
import { PAGE_SIZE, escapeLike, toNum } from "@/lib/utils";

export async function getSetting(key: string) {
  const [row] = await db.select({ value: platformSettings.value }).from(platformSettings).where(eq(platformSettings.key, key)).limit(1);
  return row?.value ?? null;
}

export async function getSettings() {
  const rows = await db.select().from(platformSettings);
  return Object.fromEntries(rows.map((r) => [r.key, r.value])) as Record<string, string>;
}

function bucketByDay(dates: Date[], days: number) {
  const out: { label: string; value: number }[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    out.push({
      label: new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short" }).format(d),
      value: dates.filter((x) => x.toISOString().slice(0, 10) === key).length,
    });
  }
  return out;
}

function bucketByMonth(dates: Date[], months: number) {
  const out: { label: string; value: number }[] = [];
  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = d.getMonth();
    out.push({
      label: new Intl.DateTimeFormat("en-IN", { month: "short", year: "2-digit" }).format(d),
      value: dates.filter((x) => x.getFullYear() === y && x.getMonth() === m).length,
    });
  }
  return out;
}

export async function getAdminStats() {
  const [userCounts] = await db
    .select({
      candidates: sql<number>`count(*) filter (where ${users.role} = 'candidate')::int`,
      recruiters: sql<number>`count(*) filter (where ${users.role} = 'recruiter')::int`,
      suspended: sql<number>`count(*) filter (where ${users.status} = 'suspended')::int`,
    })
    .from(users);
  const [jobStats] = await db
    .select({
      total: sql<number>`count(*)::int`,
      active: sql<number>`count(*) filter (where ${jobs.status} = 'published' and (${jobs.deadline} is null or ${jobs.deadline} > now()))::int`,
      expired: sql<number>`count(*) filter (where ${jobs.status} = 'published' and ${jobs.deadline} <= now())::int`,
      pending: sql<number>`count(*) filter (where ${jobs.status} = 'pending_review')::int`,
    })
    .from(jobs);
  const [companyStats] = await db
    .select({
      total: sql<number>`count(*)::int`,
      verified: sql<number>`count(*) filter (where ${companies.verificationStatus} = 'verified')::int`,
      pending: sql<number>`count(*) filter (where ${companies.verificationStatus} = 'pending')::int`,
    })
    .from(companies);
  const [appCount] = await db.select({ value: count() }).from(applications);
  const [openReports] = await db.select({ value: count() }).from(reports).where(eq(reports.status, "open"));

  const since = new Date();
  since.setMonth(since.getMonth() - 6);
  const recentUsers = await db.select({ createdAt: users.createdAt }).from(users).where(gte(users.createdAt, since)).limit(5000);
  const dates = recentUsers.map((u) => u.createdAt);

  const planRows = await db
    .select({
      code: subscriptionPlans.code,
      name: subscriptionPlans.name,
      price: subscriptionPlans.priceMonthlyInr,
      companies: sql<number>`count(${companies.id})::int`,
    })
    .from(subscriptionPlans)
    .leftJoin(companies, eq(companies.planCode, subscriptionPlans.code))
    .groupBy(subscriptionPlans.code)
    .orderBy(subscriptionPlans.sortOrder);

  const statusRows = await db
    .select({ status: applications.status, n: count() })
    .from(applications)
    .groupBy(applications.status);

  return {
    users: {
      candidates: toNum(userCounts?.candidates),
      recruiters: toNum(userCounts?.recruiters),
      suspended: toNum(userCounts?.suspended),
    },
    jobs: {
      total: toNum(jobStats?.total),
      active: toNum(jobStats?.active),
      expired: toNum(jobStats?.expired),
      pending: toNum(jobStats?.pending),
    },
    companies: {
      total: toNum(companyStats?.total),
      verified: toNum(companyStats?.verified),
      pending: toNum(companyStats?.pending),
    },
    applications: toNum(appCount?.value),
    openReports: toNum(openReports?.value),
    dailyRegistrations: bucketByDay(dates, 14),
    monthlyRegistrations: bucketByMonth(dates, 6),
    plans: planRows.map((p) => ({ ...p, mrr: p.price * p.companies })),
    estimatedMrr: planRows.reduce((sum, p) => sum + p.price * toNum(p.companies), 0),
    applicationStatus: statusRows.map((s) => ({ label: s.status, value: toNum(s.n) })),
  };
}

const PAGE = PAGE_SIZE;
const offset = (page: number) => (Math.max(1, page) - 1) * PAGE;

export async function listUsers(f: { q?: string; role?: string; status?: string; page?: number }) {
  const conds: (SQL | undefined)[] = [];
  if (f.q) {
    const pat = `%${escapeLike(f.q.trim())}%`;
    conds.push(or(ilike(users.name, pat), ilike(users.email, pat)));
  }
  if (f.role) conds.push(eq(users.role, f.role as never));
  if (f.status) conds.push(eq(users.status, f.status as never));
  const where = and(...conds);
  const [items, [total]] = await Promise.all([
    db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        status: users.status,
        emailVerifiedAt: users.emailVerifiedAt,
        createdAt: users.createdAt,
        lastLoginAt: users.lastLoginAt,
      })
      .from(users)
      .where(where)
      .orderBy(desc(users.createdAt))
      .limit(PAGE)
      .offset(offset(f.page ?? 1)),
    db.select({ value: count() }).from(users).where(where),
  ]);
  const t = toNum(total?.value);
  return { items, total: t, pages: Math.max(1, Math.ceil(t / PAGE)) };
}

export async function listAdminJobs(f: { q?: string; status?: string; page?: number }) {
  const conds: (SQL | undefined)[] = [];
  if (f.q) conds.push(ilike(jobs.title, `%${escapeLike(f.q.trim())}%`));
  if (f.status) conds.push(eq(jobs.status, f.status as JobStatus));
  const where = and(...conds);
  const [items, [total]] = await Promise.all([
    db
      .select({
        id: jobs.id,
        title: jobs.title,
        slug: jobs.slug,
        status: jobs.status,
        city: jobs.city,
        isFeatured: jobs.isFeatured,
        createdAt: jobs.createdAt,
        deadline: jobs.deadline,
        companyName: companies.name,
        companyVerification: companies.verificationStatus,
        companySuspended: companies.suspended,
      })
      .from(jobs)
      .innerJoin(companies, eq(companies.id, jobs.companyId))
      .where(where)
      .orderBy(desc(jobs.createdAt))
      .limit(PAGE)
      .offset(offset(f.page ?? 1)),
    db.select({ value: count() }).from(jobs).innerJoin(companies, eq(companies.id, jobs.companyId)).where(where),
  ]);
  const t = toNum(total?.value);
  return { items, total: t, pages: Math.max(1, Math.ceil(t / PAGE)) };
}

export async function listAdminCompanies(f: { status?: string; page?: number }) {
  const where = f.status ? eq(companies.verificationStatus, f.status as never) : undefined;
  const [items, [total]] = await Promise.all([
    db
      .select({
        id: companies.id,
        name: companies.name,
        slug: companies.slug,
        industry: companies.industry,
        location: companies.location,
        verificationStatus: companies.verificationStatus,
        suspended: companies.suspended,
        planCode: companies.planCode,
        createdAt: companies.createdAt,
        jobCount: count(jobs.id),
        ownerEmail: users.email,
      })
      .from(companies)
      .leftJoin(jobs, eq(jobs.companyId, companies.id))
      .leftJoin(companyMembers, and(eq(companyMembers.companyId, companies.id), eq(companyMembers.role, "owner")))
      .leftJoin(users, eq(users.id, companyMembers.userId))
      .where(where)
      .groupBy(companies.id, users.email)
      .orderBy(desc(companies.createdAt))
      .limit(PAGE)
      .offset(offset(f.page ?? 1)),
    db.select({ value: count() }).from(companies).where(where),
  ]);
  const t = toNum(total?.value);
  return { items, total: t, pages: Math.max(1, Math.ceil(t / PAGE)) };
}

export async function listReports(status?: string) {
  return db
    .select({
      id: reports.id,
      reason: reports.reason,
      details: reports.details,
      status: reports.status,
      resolutionNote: reports.resolutionNote,
      createdAt: reports.createdAt,
      jobId: reports.jobId,
      jobTitle: jobs.title,
      companyId: reports.companyId,
      companyName: companies.name,
      reporterName: users.name,
    })
    .from(reports)
    .leftJoin(jobs, eq(jobs.id, reports.jobId))
    .leftJoin(companies, eq(companies.id, reports.companyId))
    .leftJoin(users, eq(users.id, reports.reporterId))
    .where(status ? eq(reports.status, status as never) : undefined)
    .orderBy(desc(reports.createdAt))
    .limit(200);
}

export async function listCategoriesWithCounts() {
  return db
    .select({
      id: jobCategories.id,
      name: jobCategories.name,
      slug: jobCategories.slug,
      jobs: sql<number>`count(${jobs.id})::int`,
    })
    .from(jobCategories)
    .leftJoin(jobs, eq(jobs.categoryId, jobCategories.id))
    .groupBy(jobCategories.id)
    .orderBy(jobCategories.name);
}

export async function listAllBlogPosts() {
  return db.select().from(blogPosts).orderBy(desc(blogPosts.createdAt));
}

export async function listAuditLogs(limit = 150) {
  return db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      entityType: auditLogs.entityType,
      entityId: auditLogs.entityId,
      metadata: auditLogs.metadata,
      createdAt: auditLogs.createdAt,
      actorName: users.name,
    })
    .from(auditLogs)
    .leftJoin(users, eq(users.id, auditLogs.actorId))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);
}

export async function listEmailLog(limit = 100) {
  return db.select().from(emailLog).orderBy(desc(emailLog.createdAt)).limit(limit);
}

export async function listPlansWithUsage() {
  return db.select().from(subscriptionPlans).orderBy(subscriptionPlans.sortOrder);
}

