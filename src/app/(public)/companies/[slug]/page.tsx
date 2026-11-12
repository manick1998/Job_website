import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { Building2, Globe, MapPin, Users } from "lucide-react";
import { db } from "@/db";
import { followedCompanies } from "@/db/schema";
import { toggleFollowCompanyAction } from "@/app/actions/candidate";
import { Badge, Card, EmptyState, JobCard, buttonClass } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { getCompanyBySlug, getCompanyJobs } from "@/lib/queries/jobs";
import { APP_URL } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = await getCompanyBySlug(slug);
  if (!c) return { title: "Company not found" };
  return {
    title: `${c.name} careers`,
    description: c.description?.slice(0, 150) ?? `Explore open roles at ${c.name} on SetuJobs.`,
    alternates: { canonical: `${APP_URL}/companies/${c.slug}` },
  };
}

export default async function CompanyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const company = await getCompanyBySlug(slug);
  if (!company || company.suspended || company.verificationStatus !== "verified") notFound();
  const [openJobs, user] = await Promise.all([getCompanyJobs(company.id), getCurrentUser()]);

  let following = false;
  if (user?.role === "candidate") {
    const [row] = await db
      .select({ c: followedCompanies.companyId })
      .from(followedCompanies)
      .where(and(eq(followedCompanies.userId, user.id), eq(followedCompanies.companyId, company.id)))
      .limit(1);
    following = !!row;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <header className="rounded-3xl border border-line bg-surface p-6 sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-5">
            <div className="brand-gradient grid h-16 w-16 place-items-center rounded-2xl text-2xl font-bold text-white">{company.name.slice(0, 1)}</div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-3xl font-extrabold tracking-tight text-fg">{company.name}</h1>
                <Badge tone="green">✔ Verified employer</Badge>
              </div>
              <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                {company.industry && <span className="inline-flex items-center gap-1"><Building2 className="h-4 w-4" />{company.industry}</span>}
                {company.location && <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" />{company.location}</span>}
                {company.companySize && <span className="inline-flex items-center gap-1"><Users className="h-4 w-4" />{company.companySize} employees</span>}
                {company.website && (
                  <a href={company.website} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-brand hover:underline">
                    <Globe className="h-4 w-4" />Website
                  </a>
                )}
              </p>
            </div>
          </div>
          {user?.role === "candidate" && (
            <form action={toggleFollowCompanyAction}>
              <input type="hidden" name="companyId" value={company.id} />
              <button type="submit" className={buttonClass(following ? "secondary" : "primary")}>
                {following ? "Following ✓" : "Follow company"}
              </button>
            </form>
          )}
        </div>
      </header>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="space-y-8">
          <section>
            <h2 className="mb-3 text-xl font-bold text-fg">Open roles ({openJobs.length})</h2>
            {openJobs.length ? (
              <div className="grid gap-5 md:grid-cols-2">
                {openJobs.map((j) => <JobCard key={j.job.id} item={j} />)}
              </div>
            ) : (
              <EmptyState title="No open roles right now" text="Follow this company to get notified when new roles open." />
            )}
          </section>
        </div>
        <aside className="space-y-5">
          <Card className="p-6">
            <h2 className="font-bold text-fg">About {company.name}</h2>
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted">{company.description ?? "This company has not added a description yet."}</p>
          </Card>
          {company.benefits && (
            <Card className="p-6">
              <h2 className="font-bold text-fg">Benefits & culture</h2>
              <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-muted">
                {company.benefits.split("\n").filter(Boolean).map((b, i) => <li key={i}>{b}</li>)}
              </ul>
            </Card>
          )}
          <Link href="/companies" className="block text-center text-sm font-semibold text-brand hover:underline">← All companies</Link>
        </aside>
      </div>
    </div>
  );
}
