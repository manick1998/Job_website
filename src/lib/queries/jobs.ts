import { and, asc, count, desc, eq, gt, gte, ilike, inArray, isNotNull, isNull, lte, ne, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  blogPosts,
  companies,
  jobCategories,
  jobs,
  jobSkills,
  skills,
  type EmploymentType,
  type WorkMode,
} from "@/db/schema";
import { PAGE_SIZE, escapeLike, slugify, toNum } from "@/lib/utils";

export type JobSearchParams = {
  q?: string;
  city?: string;
  experience?: number;
  workMode?: WorkMode;
  employmentType?: EmploymentType;
  category?: string;
  skill?: string;
  company?: string;
  fresher?: boolean;
  salaryMin?: number;
  datePosted?: number;
  sort?: "relevant" | "latest" | "salary_asc" | "salary_desc";
  page?: number;
};

export type JobSkill = { name: string; slug: string; required: boolean };
export type JobCompany = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  industry: string | null;
  verificationStatus: string;
  location: string | null;
};
export type JobRow = {
  job: typeof jobs.$inferSelect;
  company: JobCompany;
  categoryName: string | null;
  categorySlug: string | null;
};
export type JobListItem = JobRow & { skills: JobSkill[] };

const jobSelect = {
  job: jobs,
  company: {
    id: companies.id,
    name: companies.name,
    slug: companies.slug,
    logoUrl: companies.logoUrl,
    industry: companies.industry,
    verificationStatus: companies.verificationStatus,
    location: companies.location,
  },
  categoryName: jobCategories.name,
  categorySlug: jobCategories.slug,
};

function jobQuery() {
  return db
    .select(jobSelect)
    .from(jobs)
    .innerJoin(companies, eq(companies.id, jobs.companyId))
    .leftJoin(jobCategories, eq(jobCategories.id, jobs.categoryId));
}

export async function attachSkills(rows: JobRow[]): Promise<JobListItem[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.job.id);
  const sk = await db
    .select({ jobId: jobSkills.jobId, name: skills.name, slug: skills.slug, required: jobSkills.required })
    .from(jobSkills)
    .innerJoin(skills, eq(skills.id, jobSkills.skillId))
    .where(inArray(jobSkills.jobId, ids));
  const map = new Map<string, JobSkill[]>();
  for (const s of sk) {
    const arr = map.get(s.jobId) ?? [];
    arr.push({ name: s.name, slug: s.slug, required: s.required });
    map.set(s.jobId, arr);
  }
  return rows.map((r) => ({ ...r, skills: map.get(r.job.id) ?? [] }));
}

/** Conditions that define a publicly visible, live job. */
export function liveConditions(): (SQL | undefined)[] {
  return [
    eq(jobs.status, "published"),
    eq(companies.suspended, false),
    or(isNull(jobs.deadline), gt(jobs.deadline, new Date())),
  ];
}

export async function listJobs(where: SQL | undefined, order: SQL[], limit: number, offset = 0) {
  const rows = await jobQuery().where(where).orderBy(...order).limit(limit).offset(offset);
  return attachSkills(rows);
}

function skillExists(condition: SQL) {
  return sql`exists (select 1 from ${jobSkills} inner join ${skills} on ${skills.id} = ${jobSkills.skillId} where ${jobSkills.jobId} = ${jobs.id} and ${condition})`;
}

export async function searchJobs(p: JobSearchParams) {
  const page = Math.max(1, p.page ?? 1);
  const conds: (SQL | undefined)[] = liveConditions();
  const q = p.q?.trim();

  if (q) {
    const pat = `%${escapeLike(q)}%`;
    conds.push(
      or(
        ilike(jobs.title, pat),
        ilike(companies.name, pat),
        ilike(jobs.department, pat),
        sql`to_tsvector('english', coalesce(${jobs.title}, '') || ' ' || coalesce(${jobs.description}, '')) @@ plainto_tsquery('english', ${q})`,
        skillExists(ilike(skills.name, pat)),
      ),
    );
  }
  if (p.city) conds.push(ilike(jobs.city, `%${escapeLike(p.city)}%`));
  if (p.experience != null) conds.push(lte(jobs.minExperience, p.experience));
  if (p.workMode) conds.push(eq(jobs.workMode, p.workMode));
  if (p.employmentType) conds.push(eq(jobs.employmentType, p.employmentType));
  if (p.category) conds.push(eq(jobCategories.slug, p.category));
  if (p.company) conds.push(eq(companies.slug, p.company));
  if (p.fresher) conds.push(or(eq(jobs.isFresher, true), eq(jobs.minExperience, 0)));
  if (p.skill) conds.push(skillExists(eq(skills.slug, slugify(p.skill))));
  if (p.salaryMin) conds.push(gte(jobs.salaryMax, p.salaryMin));
  if (p.datePosted) conds.push(gte(jobs.publishedAt, new Date(Date.now() - p.datePosted * 86400000)));

  const where = and(...conds);
  const order: SQL[] =
    p.sort === "latest"
      ? [desc(jobs.publishedAt)]
      : p.sort === "salary_desc"
        ? [sql`${jobs.salaryMax} desc nulls last`, desc(jobs.publishedAt)]
        : p.sort === "salary_asc"
          ? [sql`${jobs.salaryMin} asc nulls last`, desc(jobs.publishedAt)]
          : [desc(jobs.isFeatured), desc(jobs.publishedAt)];

  const [items, [totalRow]] = await Promise.all([
    listJobs(where, order, PAGE_SIZE, (page - 1) * PAGE_SIZE),
    db
      .select({ value: count() })
      .from(jobs)
      .innerJoin(companies, eq(companies.id, jobs.companyId))
      .leftJoin(jobCategories, eq(jobCategories.id, jobs.categoryId))
      .where(where),
  ]);
  const total = toNum(totalRow?.value);
  return { items, total, page, pageSize: PAGE_SIZE, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export async function getJobBySlug(slug: string) {
  const [row] = await jobQuery().where(eq(jobs.slug, slug)).limit(1);
  if (!row) return null;
  const [withSkills] = await attachSkills([row]);
  return withSkills ?? null;
}

export async function getSimilarJobs(job: { id: string; categoryId: number | null; city: string }) {
  const sameField = job.categoryId != null ? eq(jobs.categoryId, job.categoryId) : eq(jobs.city, job.city);
  return listJobs(and(...liveConditions(), ne(jobs.id, job.id), sameField), [desc(jobs.publishedAt)], 4);
}

export async function getRecommendedJobs(skillSlugs: string[], excludeIds: string[], limit = 6) {
  let ids: string[] | null = null;
  if (skillSlugs.length > 0) {
    const rows = await db
      .selectDistinct({ id: jobSkills.jobId })
      .from(jobSkills)
      .innerJoin(skills, eq(skills.id, jobSkills.skillId))
      .innerJoin(jobs, eq(jobs.id, jobSkills.jobId))
      .innerJoin(companies, eq(companies.id, jobs.companyId))
      .where(and(...liveConditions(), inArray(skills.slug, skillSlugs)))
      .limit(60);
    ids = rows.map((r) => r.id);
    if (ids.length === 0) return [];
  }
  const where = and(...liveConditions(), ids ? inArray(jobs.id, ids) : undefined);
  const list = await listJobs(where, [desc(jobs.publishedAt)], limit + excludeIds.length);
  return list.filter((j) => !excludeIds.includes(j.job.id)).slice(0, limit);
}

export async function getHomeData() {
  const [featured, latest, remote, fresher, walkins, topCompanies, categories, cities, industries, trending, posts, stats] =
    await Promise.all([
      listJobs(and(...liveConditions(), eq(jobs.isFeatured, true)), [desc(jobs.publishedAt)], 6),
      listJobs(and(...liveConditions()), [desc(jobs.publishedAt)], 6),
      listJobs(and(...liveConditions(), eq(jobs.workMode, "remote")), [desc(jobs.publishedAt)], 4),
      listJobs(and(...liveConditions(), or(eq(jobs.isFresher, true), eq(jobs.minExperience, 0))), [desc(jobs.publishedAt)], 4),
      listJobs(
        and(
          ...liveConditions(),
          or(ilike(jobs.title, "%walk%in%"), ilike(jobs.description, "%walk-in%"), ilike(jobs.description, "%walk in%")),
        ),
        [desc(jobs.publishedAt)],
        3,
      ),
      db
        .select({
          id: companies.id,
          name: companies.name,
          slug: companies.slug,
          logoUrl: companies.logoUrl,
          industry: companies.industry,
          location: companies.location,
          openJobs: sql<number>`count(${jobs.id})::int`,
        })
        .from(companies)
        .leftJoin(jobs, and(eq(jobs.companyId, companies.id), eq(jobs.status, "published")))
        .where(and(eq(companies.verificationStatus, "verified"), eq(companies.suspended, false)))
        .groupBy(companies.id)
        .orderBy(desc(sql`count(${jobs.id})`), asc(companies.name))
        .limit(8),
      db
        .select({
          id: jobCategories.id,
          name: jobCategories.name,
          slug: jobCategories.slug,
          openJobs: sql<number>`count(${jobs.id})::int`,
        })
        .from(jobCategories)
        .leftJoin(jobs, and(eq(jobs.categoryId, jobCategories.id), eq(jobs.status, "published")))
        .groupBy(jobCategories.id)
        .orderBy(desc(sql`count(${jobs.id})`), asc(jobCategories.name))
        .limit(12),
      db
        .select({ city: jobs.city, openJobs: sql<number>`count(*)::int` })
        .from(jobs)
        .innerJoin(companies, eq(companies.id, jobs.companyId))
        .where(and(...liveConditions()))
        .groupBy(jobs.city)
        .orderBy(desc(sql`count(*)`))
        .limit(8),
      db
        .select({ industry: companies.industry, companies: sql<number>`count(*)::int` })
        .from(companies)
        .where(and(eq(companies.verificationStatus, "verified"), isNotNull(companies.industry)))
        .groupBy(companies.industry)
        .orderBy(desc(sql`count(*)`))
        .limit(8),
      db
        .select({ name: skills.name, slug: skills.slug, demand: sql<number>`count(*)::int` })
        .from(jobSkills)
        .innerJoin(skills, eq(skills.id, jobSkills.skillId))
        .innerJoin(jobs, eq(jobs.id, jobSkills.jobId))
        .innerJoin(companies, eq(companies.id, jobs.companyId))
        .where(and(...liveConditions()))
        .groupBy(skills.id, skills.name, skills.slug)
        .orderBy(desc(sql`count(*)`))
        .limit(14),
      db
        .select()
        .from(blogPosts)
        .where(eq(blogPosts.published, true))
        .orderBy(desc(blogPosts.createdAt))
        .limit(3),
      Promise.all([
        db.select({ value: count() }).from(jobs).innerJoin(companies, eq(companies.id, jobs.companyId)).where(and(...liveConditions())),
        db.select({ value: count() }).from(companies).where(eq(companies.verificationStatus, "verified")),
        db.select({ value: count() }).from(jobs).innerJoin(companies, eq(companies.id, jobs.companyId)).where(and(...liveConditions(), eq(jobs.workMode, "remote"))),
      ]),
    ]);

  return {
    featured,
    latest,
    remote,
    fresher,
    walkins,
    topCompanies,
    categories,
    cities,
    industries,
    trending,
    posts,
    stats: {
      liveJobs: toNum(stats[0][0]?.value),
      verifiedCompanies: toNum(stats[1][0]?.value),
      remoteJobs: toNum(stats[2][0]?.value),
    },
  };
}

export async function getSalaryInsights() {
  const live = and(...liveConditions(), isNotNull(jobs.salaryMin), eq(jobs.salaryHidden, false));
  const [byCategory, byCity] = await Promise.all([
    db
      .select({
        name: sql<string>`coalesce(${jobCategories.name}, 'Other')`,
        avgMin: sql<number>`round(avg(${jobs.salaryMin}))::int`,
        avgMax: sql<number>`round(avg(${jobs.salaryMax}))::int`,
        samples: sql<number>`count(*)::int`,
      })
      .from(jobs)
      .innerJoin(companies, eq(companies.id, jobs.companyId))
      .leftJoin(jobCategories, eq(jobCategories.id, jobs.categoryId))
      .where(live)
      .groupBy(jobCategories.name)
      .orderBy(desc(sql`count(*)`)),
    db
      .select({
        city: jobs.city,
        avgMin: sql<number>`round(avg(${jobs.salaryMin}))::int`,
        avgMax: sql<number>`round(avg(${jobs.salaryMax}))::int`,
        samples: sql<number>`count(*)::int`,
      })
      .from(jobs)
      .innerJoin(companies, eq(companies.id, jobs.companyId))
      .where(live)
      .groupBy(jobs.city)
      .orderBy(desc(sql`count(*)`))
      .limit(12),
  ]);
  return { byCategory, byCity };
}

export async function getCompanyBySlug(slug: string) {
  const [company] = await db.select().from(companies).where(eq(companies.slug, slug)).limit(1);
  return company ?? null;
}

export async function getCompanyJobs(companyId: string) {
  return listJobs(and(...liveConditions(), eq(jobs.companyId, companyId)), [desc(jobs.publishedAt)], 50);
}

export async function getFilterOptions() {
  const [cats, skillRows] = await Promise.all([
    db.select({ slug: jobCategories.slug, name: jobCategories.name }).from(jobCategories).orderBy(asc(jobCategories.name)),
    db.select({ name: skills.name, slug: skills.slug }).from(skills).orderBy(asc(skills.name)).limit(200),
  ]);
  return { categories: cats, skills: skillRows };
}

export async function listBlogPosts(onlyPublished = true) {
  return db
    .select()
    .from(blogPosts)
    .where(onlyPublished ? eq(blogPosts.published, true) : undefined)
    .orderBy(desc(blogPosts.createdAt));
}

export async function getBlogPost(slug: string) {
  const [post] = await db.select().from(blogPosts).where(eq(blogPosts.slug, slug)).limit(1);
  return post ?? null;
}

export async function getPlans() {
  return db.select().from(subscriptionPlansTable()).orderBy(asc(subscriptionPlansTable().sortOrder));
}

import { subscriptionPlans } from "@/db/schema";
function subscriptionPlansTable() {
  return subscriptionPlans;
}
