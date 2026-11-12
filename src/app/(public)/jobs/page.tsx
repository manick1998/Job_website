import Link from "next/link";
import { Search, SlidersHorizontal } from "lucide-react";
import { Card, EmptyState, JobCard, Pagination, buttonClass } from "@/components/ui";
import { getFilterOptions, searchJobs, type JobSearchParams } from "@/lib/queries/jobs";
import { INDIAN_CITIES } from "@/lib/utils";
import type { EmploymentType, WorkMode } from "@/db/schema";

export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;

function parseSearch(sp: SP): JobSearchParams {
  const s = (k: string) => {
    const v = sp[k];
    return typeof v === "string" && v.trim() ? v.trim() : undefined;
  };
  const num = (k: string) => {
    const v = s(k);
    const n = v === undefined ? NaN : Number(v);
    return Number.isFinite(n) ? n : undefined;
  };
  const wm = s("workMode");
  const et = s("employmentType");
  const sort = s("sort");
  return {
    q: s("q")?.slice(0, 120),
    city: s("city")?.slice(0, 120),
    experience: num("experience"),
    workMode: wm && ["onsite", "hybrid", "remote"].includes(wm) ? (wm as WorkMode) : undefined,
    employmentType: et && ["full_time", "part_time", "contract", "internship"].includes(et) ? (et as EmploymentType) : undefined,
    category: s("category")?.slice(0, 120),
    skill: s("skill")?.slice(0, 80),
    company: s("company")?.slice(0, 120),
    fresher: s("fresher") === "1",
    salaryMin: num("salaryMin") ? (num("salaryMin") as number) * 100000 : undefined,
    datePosted: num("datePosted"),
    sort: sort === "latest" || sort === "salary_asc" || sort === "salary_desc" ? sort : "relevant",
    page: num("page") ?? 1,
  };
}

const field = "mt-1.5 w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-fg focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/15";
const label = "block text-xs font-semibold uppercase tracking-wide text-muted";

export default async function JobsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const params = parseSearch(sp);
  const [result, options] = await Promise.all([searchJobs(params), getFilterOptions()]);
  const hasFilters = Object.entries(sp).some(([k, v]) => k !== "page" && v && v !== "relevant" && v !== "");

  const pageParams: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(sp)) if (typeof v === "string" && k !== "page") pageParams[k] = v;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-fg">Search jobs in India</h1>
        <p className="mt-2 text-sm text-muted">
          {result.total.toLocaleString("en-IN")} job{result.total === 1 ? "" : "s"} found
          {params.q ? <> for &ldquo;<span className="text-fg">{params.q}</span>&rdquo;</> : null}
        </p>
      </div>

      <form method="get" action="/jobs" className="grid gap-8 lg:grid-cols-[280px_1fr]">
        <Card className="h-fit space-y-5 p-5 lg:sticky lg:top-24">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold text-fg">
              <SlidersHorizontal className="h-4 w-4" /> Filters
            </h2>
            {hasFilters && (
              <Link href="/jobs" className="text-xs font-semibold text-brand hover:underline">
                Clear all
              </Link>
            )}
          </div>

          <div>
            <label htmlFor="q" className={label}>
              Keywords
            </label>
            <div className="relative mt-1.5">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                id="q"
                name="q"
                list="job-suggestions"
                defaultValue={params.q ?? ""}
                placeholder="Title, skill or company"
                className={`${field} pl-9`}
              />
              <datalist id="job-suggestions">
                {options.skills.map((s) => (
                  <option key={s.slug} value={s.name} />
                ))}
                {options.categories.map((c) => (
                  <option key={c.slug} value={c.name} />
                ))}
              </datalist>
            </div>
          </div>

          <div>
            <label htmlFor="city" className={label}>
              Location
            </label>
            <input id="city" name="city" list="city-list" defaultValue={params.city ?? ""} placeholder="e.g. Bengaluru" className={field} />
            <datalist id="city-list">
              {INDIAN_CITIES.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>

          <div>
            <label htmlFor="experience" className={label}>
              Experience
            </label>
            <select id="experience" name="experience" defaultValue={params.experience?.toString() ?? ""} className={field}>
              <option value="">Any</option>
              <option value="0">Fresher (0 yrs)</option>
              {Array.from({ length: 15 }, (_, i) => i + 1).map((y) => (
                <option key={y} value={y}>
                  {y} year{y > 1 ? "s" : ""}
                </option>
              ))}
              <option value="16">16+ years</option>
            </select>
          </div>

          <div>
            <label htmlFor="salaryMin" className={label}>
              Minimum salary
            </label>
            <select
              id="salaryMin"
              name="salaryMin"
              defaultValue={params.salaryMin ? String(params.salaryMin / 100000) : ""}
              className={field}
            >
              <option value="">Any</option>
              {[3, 6, 10, 15, 20, 30, 50].map((v) => (
                <option key={v} value={v}>
                  ₹{v}+ LPA
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="workMode" className={label}>
              Work mode
            </label>
            <select id="workMode" name="workMode" defaultValue={params.workMode ?? ""} className={field}>
              <option value="">Any</option>
              <option value="remote">Work from home / Remote</option>
              <option value="hybrid">Hybrid</option>
              <option value="onsite">Work from office</option>
            </select>
          </div>

          <div>
            <label htmlFor="employmentType" className={label}>
              Job type
            </label>
            <select id="employmentType" name="employmentType" defaultValue={params.employmentType ?? ""} className={field}>
              <option value="">Any</option>
              <option value="full_time">Full-time</option>
              <option value="part_time">Part-time</option>
              <option value="contract">Contract</option>
              <option value="internship">Internship</option>
            </select>
          </div>

          <div>
            <label htmlFor="category" className={label}>
              Category
            </label>
            <select id="category" name="category" defaultValue={params.category ?? ""} className={field}>
              <option value="">All categories</option>
              {options.categories.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="skill" className={label}>
              Skill
            </label>
            <input id="skill" name="skill" list="skill-list" defaultValue={params.skill ?? ""} placeholder="e.g. React" className={field} />
            <datalist id="skill-list">
              {options.skills.map((s) => (
                <option key={s.slug} value={s.name} />
              ))}
            </datalist>
          </div>

          <div>
            <label htmlFor="datePosted" className={label}>
              Date posted
            </label>
            <select id="datePosted" name="datePosted" defaultValue={params.datePosted?.toString() ?? ""} className={field}>
              <option value="">Any time</option>
              <option value="1">Last 24 hours</option>
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
            </select>
          </div>

          <label className="flex items-center gap-2 text-sm text-fg">
            <input type="checkbox" name="fresher" value="1" defaultChecked={params.fresher} className="h-4 w-4 accent-indigo-600" />
            Fresher friendly
          </label>

          <div>
            <label htmlFor="sort" className={label}>
              Sort by
            </label>
            <select id="sort" name="sort" defaultValue={params.sort ?? "relevant"} className={field}>
              <option value="relevant">Most relevant</option>
              <option value="latest">Latest jobs</option>
              <option value="salary_desc">Salary: High to low</option>
              <option value="salary_asc">Salary: Low to high</option>
            </select>
          </div>

          <button type="submit" className={`${buttonClass("primary")} w-full`}>
            Apply filters
          </button>
        </Card>

        <section aria-live="polite">
          {result.items.length ? (
            <>
              <div className="grid gap-5 md:grid-cols-2">
                {result.items.map((item) => (
                  <JobCard key={item.job.id} item={item} />
                ))}
              </div>
              <Pagination basePath="/jobs" params={pageParams} page={result.page} pages={result.pages} />
            </>
          ) : (
            <EmptyState
              icon={<Search className="h-6 w-6" />}
              title="No jobs match your search"
              text="Try broader keywords, remove a filter, or explore these popular options."
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  {options.categories.slice(0, 5).map((c) => (
                    <Link key={c.slug} href={`/jobs?category=${c.slug}`} className={buttonClass("secondary", "sm")}>
                      {c.name}
                    </Link>
                  ))}
                  <Link href="/jobs?fresher=1" className={buttonClass("secondary", "sm")}>
                    Fresher jobs
                  </Link>
                  <Link href="/jobs?workMode=remote" className={buttonClass("secondary", "sm")}>
                    Remote jobs
                  </Link>
                </div>
              }
            />
          )}
        </section>
      </form>
    </div>
  );
}
