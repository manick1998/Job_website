import Link from "next/link";
import { and, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import { Search } from "lucide-react";
import { db } from "@/db";
import { companies, jobs } from "@/db/schema";
import { Badge, EmptyState, Pagination, buttonClass } from "@/components/ui";
import { PAGE_SIZE, escapeLike } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function CompaniesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const q = sp.q?.trim().slice(0, 120) ?? "";
  const page = Math.max(1, Number(sp.page) || 1);
  const pat = `%${escapeLike(q)}%`;

  const where = and(
    eq(companies.verificationStatus, "verified"),
    eq(companies.suspended, false),
    q ? or(ilike(companies.name, pat), ilike(companies.industry, pat), ilike(companies.location, pat)) : undefined,
  );

  const [rows, [total]] = await Promise.all([
    db
      .select({
        id: companies.id,
        name: companies.name,
        slug: companies.slug,
        industry: companies.industry,
        location: companies.location,
        companySize: companies.companySize,
        openJobs: sql<number>`count(${jobs.id}) filter (where ${jobs.status} = 'published')::int`,
      })
      .from(companies)
      .leftJoin(jobs, eq(jobs.companyId, companies.id))
      .where(where)
      .groupBy(companies.id)
      .orderBy(desc(sql`count(${jobs.id}) filter (where ${jobs.status} = 'published')`), companies.name)
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ value: count() }).from(companies).where(where),
  ]);
  const totalNum = Number(total?.value ?? 0);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-fg">Companies hiring on Manick Job Portal</h1>
          <p className="mt-2 text-sm text-muted">Verified employers with open roles across India.</p>
        </div>
        <form method="get" className="flex w-full max-w-md gap-2">
          <label className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <span className="sr-only">Search companies</span>
            <input name="q" defaultValue={q} placeholder="Company, industry or city" className="w-full rounded-xl border border-line bg-surface py-2.5 pl-9 pr-3 text-sm text-fg" />
          </label>
          <button className={buttonClass("primary")}>Search</button>
        </form>
      </div>

      {rows.length ? (
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((c) => (
            <Link key={c.id} href={`/companies/${c.slug}`} className="group rounded-2xl border border-line bg-surface p-6 transition hover:-translate-y-0.5 hover:shadow-lg">
              <div className="flex items-start justify-between gap-3">
                <div className="brand-gradient grid h-12 w-12 place-items-center rounded-xl text-lg font-bold text-white">{c.name.slice(0, 1)}</div>
                <Badge tone="green">✔ Verified</Badge>
              </div>
              <h2 className="mt-4 font-semibold text-fg group-hover:text-brand">{c.name}</h2>
              <p className="text-sm text-muted">{c.industry ?? "Industry not specified"}</p>
              <p className="mt-1 text-xs text-muted">{[c.location, c.companySize ? `${c.companySize} employees` : null].filter(Boolean).join(" · ")}</p>
              <p className="mt-4 text-sm font-semibold text-brand">{c.openJobs} open role{c.openJobs === 1 ? "" : "s"}</p>
            </Link>
          ))}
        </div>
      ) : (
        <div className="mt-10">
          <EmptyState title="No companies match" text="Try another keyword or browse all jobs." action={<Link href="/companies" className={buttonClass("secondary")}>Reset search</Link>} />
        </div>
      )}
      <Pagination basePath="/companies" params={{ q: q || undefined }} page={page} pages={Math.max(1, Math.ceil(totalNum / PAGE_SIZE))} />
    </div>
  );
}
