import Link from "next/link";
import { ArrowRight, Building2, GraduationCap, Laptop, MapPin, Search, Sparkles, TrendingUp, Wifi } from "lucide-react";
import { Badge, Card, EmptyState, JobCard, buttonClass, cn } from "@/components/ui";
import { getHomeData } from "@/lib/queries/jobs";
import { COMPANY_SIZES, INDIAN_CITIES } from "@/lib/utils";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

const EXPERIENCE = [
  { value: "0", label: "Fresher" },
  ...Array.from({ length: 15 }, (_, i) => ({ value: String(i + 1), label: `${i + 1} year${i ? "s" : ""}` })),
  { value: "16", label: "16+ years" },
];

function SectionHeader({ kicker, title, href, linkLabel = "View all" }: { kicker: string; title: string; href?: string; linkLabel?: string }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-brand">{kicker}</p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight text-fg sm:text-3xl">{title}</h2>
      </div>
      {href && (
        <Link href={href} className="inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline">
          {linkLabel} <ArrowRight className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
}

export default async function HomePage() {
  const data = await getHomeData();
  const popular = data.trending.slice(0, 6);

  return (
    <>
      <section className="hero-bg relative overflow-hidden">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24">
          <div className="animate-fade-up">
            <Badge tone="brand">Built for India&apos;s workforce · ₹ INR salaries</Badge>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.1] tracking-tight text-fg sm:text-5xl lg:text-6xl">
              Find Your Dream Job.{" "}
              <span className="bg-gradient-to-r from-indigo-600 to-sky-500 bg-clip-text text-transparent">Build Your Future.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted">
              Verified employers, salary ranges in ₹ LPA, and one-click applications with live status tracking — from your first internship to your next leadership role.
            </p>

            <form
              action="/jobs"
              method="get"
              role="search"
              className="mt-8 grid gap-3 rounded-2xl border border-line bg-surface p-3 shadow-xl shadow-indigo-500/10 sm:grid-cols-[1.5fr_1fr_0.9fr_auto]"
            >
              <label className="flex items-center gap-2 rounded-xl px-3">
                <Search className="h-4 w-4 shrink-0 text-muted" aria-hidden />
                <span className="sr-only">Job title, skills or company</span>
                <input
                  name="q"
                  list="search-suggestions"
                  placeholder="Job title, skills or company"
                  className="w-full bg-transparent py-2.5 text-sm text-fg placeholder:text-muted/70 outline-none"
                />
              </label>
              <label className="flex items-center gap-2 rounded-xl px-3">
                <MapPin className="h-4 w-4 shrink-0 text-muted" aria-hidden />
                <span className="sr-only">Location</span>
                <select name="city" className="w-full bg-transparent py-2.5 text-sm text-fg outline-none">
                  <option value="">All locations</option>
                  {INDIAN_CITIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 rounded-xl px-3">
                <span className="sr-only">Experience</span>
                <select name="experience" className="w-full bg-transparent py-2.5 text-sm text-fg outline-none">
                  <option value="">Any experience</option>
                  {EXPERIENCE.map((e) => (
                    <option key={e.value} value={e.value}>
                      {e.label}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" className={buttonClass("primary")}>
                Search Jobs
              </button>
            </form>
            <datalist id="search-suggestions">
              {data.trending.map((s) => (
                <option key={s.slug} value={s.name} />
              ))}
            </datalist>

            <div className="mt-5 flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted">Popular searches:</span>
              {popular.map((s) => (
                <Link
                  key={s.slug}
                  href={`/jobs?skill=${encodeURIComponent(s.name)}`}
                  className="rounded-full border border-line bg-surface px-3 py-1 text-fg transition hover:border-brand hover:text-brand"
                >
                  {s.name}
                </Link>
              ))}
            </div>
          </div>

          <div className="relative hidden h-[420px] lg:block" aria-hidden>
            <div className="absolute left-4 top-6 w-72 animate-float-slow rounded-2xl border border-line bg-surface p-5 shadow-2xl shadow-indigo-500/20">
              <p className="text-xs font-semibold text-brand">Live on Manick Job Portal</p>
              <p className="mt-2 text-4xl font-extrabold text-fg">{data.stats.liveJobs}</p>
              <p className="text-sm text-muted">open roles across India</p>
            </div>
            <div className="absolute right-0 top-40 w-64 animate-float-slow rounded-2xl border border-line bg-surface p-5 shadow-2xl shadow-sky-500/20 [animation-delay:1.5s]">
              <p className="text-xs font-semibold text-sky-600">Verified employers</p>
              <p className="mt-2 text-3xl font-extrabold text-fg">{data.stats.verifiedCompanies}</p>
              <p className="text-sm text-muted">companies hiring now</p>
            </div>
            <div className="absolute bottom-4 left-12 w-72 animate-float-slow rounded-2xl border border-line bg-surface p-5 shadow-2xl shadow-indigo-500/20 [animation-delay:3s]">
              <p className="text-xs font-semibold text-emerald-600">Work from anywhere</p>
              <p className="mt-2 text-3xl font-extrabold text-fg">{data.stats.remoteJobs}</p>
              <p className="text-sm text-muted">remote &amp; WFH roles</p>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-20 px-4 py-16 sm:px-6">
        {/* Featured */}
        <section aria-labelledby="featured">
          <SectionHeader kicker="Handpicked" title="Featured jobs" href="/jobs?sort=relevant" />
          {data.featured.length ? (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {data.featured.map((j) => (
                <JobCard key={j.job.id} item={j} highlight />
              ))}
            </div>
          ) : (
            <EmptyState title="No featured jobs yet" text="Featured listings from top employers will appear here." />
          )}
        </section>

        {/* Latest */}
        <section aria-labelledby="latest">
          <SectionHeader kicker="Just posted" title="Latest jobs" href="/jobs?sort=latest" />
          {data.latest.length ? (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {data.latest.map((j) => (
                <JobCard key={j.job.id} item={j} />
              ))}
            </div>
          ) : (
            <EmptyState title="No live jobs right now" text="Check back soon — employers post new roles daily." />
          )}
        </section>

        {/* Top companies */}
        <section aria-labelledby="companies">
          <SectionHeader kicker="Employers" title="Top hiring companies" href="/companies" />
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {data.topCompanies.map((c) => (
              <Link key={c.id} href={`/companies/${c.slug}`} className="group rounded-2xl border border-line bg-surface p-5 transition hover:-translate-y-0.5 hover:shadow-lg">
                <div className="brand-gradient grid h-11 w-11 place-items-center rounded-xl text-base font-bold text-white">
                  {c.name.slice(0, 1)}
                </div>
                <p className="mt-4 truncate font-semibold text-fg group-hover:text-brand">{c.name}</p>
                <p className="truncate text-xs text-muted">{c.industry ?? "Industry not specified"}</p>
                <p className="mt-3 text-xs font-medium text-brand">{c.openJobs} open role{c.openJobs === 1 ? "" : "s"}</p>
              </Link>
            ))}
            {data.topCompanies.length === 0 && (
              <p className="col-span-full text-sm text-muted">Verified companies will appear here once onboarded.</p>
            )}
          </div>
        </section>

        {/* Categories + locations + industries */}
        <section className="grid gap-8 lg:grid-cols-3">
          <Card className="p-6 lg:col-span-1">
            <h2 className="text-lg font-bold text-fg">Popular job categories</h2>
            <ul className="mt-4 divide-y divide-line">
              {data.categories.map((c) => (
                <li key={c.id}>
                  <Link href={`/jobs?category=${c.slug}`} className="flex items-center justify-between py-2.5 text-sm hover:text-brand">
                    <span className="text-fg">{c.name}</span>
                    <span className="text-muted">{c.openJobs}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
          <Card className="p-6">
            <h2 className="flex items-center gap-2 text-lg font-bold text-fg">
              <MapPin className="h-4 w-4 text-brand" /> Jobs by location
            </h2>
            <ul className="mt-4 grid grid-cols-2 gap-2">
              {data.cities.map((c) => (
                <li key={c.city}>
                  <Link href={`/jobs?city=${encodeURIComponent(c.city)}`} className="flex items-center justify-between rounded-xl border border-line px-3 py-2.5 text-sm hover:border-brand">
                    <span className="truncate text-fg">{c.city}</span>
                    <span className="text-xs text-muted">{c.openJobs}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
          <Card className="p-6">
            <h2 className="flex items-center gap-2 text-lg font-bold text-fg">
              <Building2 className="h-4 w-4 text-brand" /> Jobs by industry
            </h2>
            <ul className="mt-4 space-y-2">
              {data.industries.map((i) => (
                <li key={i.industry}>
                  <Link href={`/companies?q=${encodeURIComponent(i.industry ?? "")}`} className="flex items-center justify-between rounded-xl px-3 py-2 text-sm hover:bg-surface-2">
                    <span className="text-fg">{i.industry}</span>
                    <span className="text-xs text-muted">{i.companies} companies</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </section>

        {/* Segment shortcuts */}
        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4" aria-label="Job segments">
          {[
            { href: "/jobs?fresher=1", title: "Fresher jobs", text: "Graduates & 0-year experience roles", icon: GraduationCap, tone: "from-indigo-500 to-violet-500" },
            { href: "/jobs?workMode=remote", title: "Remote jobs", text: "Work from anywhere in India", icon: Wifi, tone: "from-sky-500 to-cyan-500" },
            { href: "/jobs?workMode=remote&q=work+from+home", title: "Work from home", text: "WFH roles with flexible hours", icon: Laptop, tone: "from-emerald-500 to-teal-500" },
            { href: "/jobs?category=information-technology", title: "IT jobs", text: "Engineering, data & product", icon: Sparkles, tone: "from-fuchsia-500 to-pink-500" },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <Link key={s.href} href={s.href} className="group relative overflow-hidden rounded-2xl border border-line bg-surface p-6 transition hover:-translate-y-0.5 hover:shadow-lg">
                <div className={cn("grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br text-white", s.tone)}>
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-bold text-fg group-hover:text-brand">{s.title}</h3>
                <p className="mt-1 text-sm text-muted">{s.text}</p>
              </Link>
            );
          })}
        </section>

        {/* Fresher & remote lists */}
        <section className="grid gap-10 lg:grid-cols-2">
          <div>
            <SectionHeader kicker="Start your career" title="Fresher jobs" href="/jobs?fresher=1" />
            <div className="space-y-4">
              {data.fresher.map((j) => (
                <JobCard key={j.job.id} item={j} />
              ))}
              {data.fresher.length === 0 && <p className="text-sm text-muted">No fresher roles listed yet.</p>}
            </div>
          </div>
          <div>
            <SectionHeader kicker="Flexible" title="Remote & WFH jobs" href="/jobs?workMode=remote" />
            <div className="space-y-4">
              {data.remote.map((j) => (
                <JobCard key={j.job.id} item={j} />
              ))}
              {data.remote.length === 0 && <p className="text-sm text-muted">No remote roles listed yet.</p>}
            </div>
          </div>
        </section>

        {/* Walk-ins */}
        <section aria-labelledby="walkins">
          <SectionHeader kicker="Apply today" title="Walk-in interviews" href="/jobs?q=walk-in" />
          {data.walkins.length ? (
            <div className="grid gap-5 md:grid-cols-3">
              {data.walkins.map((j) => (
                <JobCard key={j.job.id} item={j} />
              ))}
            </div>
          ) : (
            <EmptyState title="No walk-in drives this week" text="Walk-in interview listings appear here as employers schedule them." />
          )}
        </section>

        {/* Trending skills */}
        <section aria-labelledby="skills">
          <SectionHeader kicker="In demand" title="Trending skills" />
          <div className="flex flex-wrap gap-3">
            {data.trending.map((s) => (
              <Link key={s.slug} href={`/jobs?skill=${encodeURIComponent(s.name)}`} className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-sm font-medium text-fg hover:border-brand hover:text-brand">
                <TrendingUp className="h-3.5 w-3.5 text-brand" />
                {s.name}
                <span className="rounded-full bg-surface-2 px-2 text-xs text-brand">{s.demand}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* Career advice + salary */}
        <section className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <SectionHeader kicker="Learn" title="Career advice" href="/career-advice" />
            <div className="grid gap-5 md:grid-cols-3">
              {data.posts.map((p) => (
                <Link key={p.id} href={`/career-advice/${p.slug}`} className="rounded-2xl border border-line bg-surface p-5 transition hover:-translate-y-0.5 hover:shadow-lg">
                  <Badge tone="sky">{p.category}</Badge>
                  <h3 className="mt-3 font-semibold leading-snug text-fg">{p.title}</h3>
                  <p className="mt-2 line-clamp-3 text-sm text-muted">{p.excerpt}</p>
                  <p className="mt-4 text-xs text-muted">{formatDate(p.createdAt)}</p>
                </Link>
              ))}
              {data.posts.length === 0 && <p className="text-sm text-muted">Articles will appear here.</p>}
            </div>
          </div>
          <Card className="flex flex-col justify-between bg-gradient-to-br from-indigo-600 to-sky-500 p-6 text-white">
            <div>
              <p className="text-sm font-semibold text-white/80">Salary insights</p>
              <h3 className="mt-2 text-xl font-bold">What are peers earning?</h3>
              <p className="mt-2 text-sm text-white/85">Explore average salary bands by role category and city, built from live listings.</p>
            </div>
            <Link href="/salary-insights" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-indigo-700">
              Explore salaries <ArrowRight className="h-4 w-4" />
            </Link>
          </Card>
        </section>

        {/* Employer CTA */}
        <section className="rounded-3xl border border-line bg-surface p-8 sm:p-12">
          <div className="grid items-center gap-8 lg:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-brand">For employers</p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight text-fg">Hire faster with an AI-ready ATS</h2>
              <p className="mt-3 text-muted">
                Kanban hiring pipelines, transparent skill-match scores, interview scheduling and a searchable resume database — built for Indian hiring teams.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/register?role=recruiter" className={buttonClass("primary")}>
                  Post a job free
                </Link>
                <Link href="/pricing" className={buttonClass("secondary")}>
                  View plans
                </Link>
              </div>
            </div>
            <ul className="grid gap-3 text-sm text-fg sm:grid-cols-2">
              {["Drag-and-drop pipeline", "Private notes & ratings", "Interview scheduling", "Candidate search", "CSV applicant export", "Verified company badge"].map((f) => (
                <li key={f} className="flex items-center gap-2 rounded-xl border border-line px-4 py-3">
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-emerald-100 text-xs text-emerald-700">✓</span>
                  {f}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Testimonials */}
        <section aria-labelledby="testimonials">
          <SectionHeader kicker="Community" title="What members say" />
          <div className="grid gap-5 md:grid-cols-3">
            {[
              { q: "The match score showed me exactly which skills to add. I got shortlisted within a week.", n: "Candidate, Pune" },
              { q: "Our pipeline moved from spreadsheets to a real ATS in an afternoon. Interview scheduling alone saves hours.", n: "Talent lead, Bengaluru" },
              { q: "Clean, fast and honest about salaries. The walk-in listings helped me land my first job.", n: "Fresher, Hyderabad" },
            ].map((t) => (
              <Card key={t.n} className="p-6">
                <p className="text-sm text-fg">“{t.q}”</p>
                <p className="mt-4 text-xs font-semibold text-muted">— {t.n}</p>
              </Card>
            ))}
          </div>
        </section>

        <p className="text-center text-xs text-muted">
          Company sizes supported: {COMPANY_SIZES.join(", ")} · Salaries shown in ₹ per annum (LPA = lakh per annum)
        </p>
      </div>
    </>
  );
}
