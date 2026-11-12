import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getRecruiterCompany, searchCandidates } from "@/lib/queries/dashboards";
import { Badge, Card, EmptyState, JobCard, PageHeader, Pagination, buttonClass } from "@/components/ui";
import { experienceLabel } from "@/lib/utils";

export const dynamic = "force-dynamic";

const field = "mt-1.5 w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-fg focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/15";

export default async function CandidateSearchPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser("recruiter");
  const ctx = await getRecruiterCompany(user.id);
  if (!ctx) redirect("/register?role=recruiter");
  const sp = await searchParams;
  const num = (v?: string) => (v && v !== "" && Number.isFinite(Number(v)) ? Number(v) : undefined);
  const filters = {
    q: sp.q?.slice(0, 120) || undefined,
    skill: sp.skill?.slice(0, 80) || undefined,
    minExp: num(sp.minExp),
    maxExp: num(sp.maxExp),
    location: sp.location?.slice(0, 120) || undefined,
    education: sp.education?.slice(0, 120) || undefined,
    maxSalary: num(sp.maxSalary) ? (num(sp.maxSalary) as number) * 100000 : undefined,
    maxNotice: num(sp.maxNotice),
    industry: sp.industry?.slice(0, 120) || undefined,
    page: num(sp.page) ?? 1,
  };
  const result = await searchCandidates(filters);
  const pageParams: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(sp)) if (typeof v === "string" && k !== "page") pageParams[k] = v;

  return (
    <>
      <PageHeader title="Candidate search" description="Search the SetuJobs talent pool. Only candidates with visible profiles appear. Contact details are revealed after they apply to your job." />

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <Card className="h-fit space-y-4 p-5 lg:sticky lg:top-24">
          <form method="get" action="/recruiter/candidates" className="space-y-4">
            <div>
              <label htmlFor="q" className="text-xs font-semibold uppercase tracking-wide text-muted">Name, skill or title</label>
              <input id="q" name="q" defaultValue={filters.q ?? ""} className={field} placeholder="Java, Product Manager" />
            </div>
            <div>
              <label htmlFor="skill" className="text-xs font-semibold uppercase tracking-wide text-muted">Skill</label>
              <input id="skill" name="skill" defaultValue={filters.skill ?? ""} className={field} placeholder="PostgreSQL" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="minExp" className="text-xs font-semibold uppercase tracking-wide text-muted">Min yrs</label>
                <input id="minExp" type="number" min={0} max={60} name="minExp" defaultValue={filters.minExp ?? ""} className={field} />
              </div>
              <div>
                <label htmlFor="maxExp" className="text-xs font-semibold uppercase tracking-wide text-muted">Max yrs</label>
                <input id="maxExp" type="number" min={0} max={60} name="maxExp" defaultValue={filters.maxExp ?? ""} className={field} />
              </div>
            </div>
            <div>
              <label htmlFor="location" className="text-xs font-semibold uppercase tracking-wide text-muted">Location</label>
              <input id="location" name="location" defaultValue={filters.location ?? ""} className={field} placeholder="Bengaluru" />
            </div>
            <div>
              <label htmlFor="education" className="text-xs font-semibold uppercase tracking-wide text-muted">Education</label>
              <input id="education" name="education" defaultValue={filters.education ?? ""} className={field} placeholder="B.Tech, IIT, MBA" />
            </div>
            <div>
              <label htmlFor="maxSalary" className="text-xs font-semibold uppercase tracking-wide text-muted">Expected salary up to (LPA)</label>
              <input id="maxSalary" type="number" min={0} name="maxSalary" defaultValue={sp.maxSalary ?? ""} className={field} />
            </div>
            <div>
              <label htmlFor="maxNotice" className="text-xs font-semibold uppercase tracking-wide text-muted">Notice period up to (days)</label>
              <select id="maxNotice" name="maxNotice" defaultValue={sp.maxNotice ?? ""} className={field}>
                <option value="">Any</option>
                <option value="0">Immediate</option>
                <option value="15">15 days</option>
                <option value="30">30 days</option>
                <option value="60">60 days</option>
                <option value="90">90 days</option>
              </select>
            </div>
            <div>
              <label htmlFor="industry" className="text-xs font-semibold uppercase tracking-wide text-muted">Preferred industry</label>
              <input id="industry" name="industry" defaultValue={filters.industry ?? ""} className={field} placeholder="Fintech" />
            </div>
            <div className="flex gap-2">
              <button type="submit" className={`${buttonClass("primary")} flex-1`}>Search</button>
              <Link href="/recruiter/candidates" className={buttonClass("secondary")}>Clear</Link>
            </div>
          </form>
        </Card>

        <section>
          <p className="mb-4 text-sm text-muted">{result.total.toLocaleString("en-IN")} candidate{result.total === 1 ? "" : "s"} found</p>
          {result.items.length === 0 ? (
            <EmptyState title="No candidates match these filters" text="Broaden skills or experience, or remove the notice-period filter." />
          ) : (
            <div className="space-y-4">
              {result.items.map((c) => (
                <Card key={c.id} className="p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 text-base font-semibold text-fg">
                        {c.name}
                        {c.openToWork && <Badge tone="green">Open to work</Badge>}
                        {c.isFresher && <Badge tone="sky">Fresher</Badge>}
                      </p>
                      <p className="text-sm text-muted">{c.headline ?? [c.designation, c.company].filter(Boolean).join(" at ") ?? "—"}</p>
                      <p className="mt-1 text-xs text-muted">
                        {[c.location, experienceLabel(c.experience), c.college].filter(Boolean).join(" · ")}
                        {c.expectedSalary ? ` · Expects ₹${(c.expectedSalary / 100000).toFixed(1)} LPA` : ""}
                        {c.noticePeriodDays != null ? ` · ${c.noticePeriodDays}d notice` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {c.skills.slice(0, 10).map((s) => <Badge key={s} tone="brand">{s}</Badge>)}
                  </div>
                </Card>
              ))}
            </div>
          )}
          <Pagination basePath="/recruiter/candidates" params={pageParams} page={result.page} pages={result.pages} />
        </section>
      </div>
    </>
  );
}
