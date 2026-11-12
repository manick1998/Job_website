import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getCompanyPlan, getRecruiterCompany, getRecruiterDashboard } from "@/lib/queries/dashboards";
import { BarChart, Badge, Card, EmptyState, Notice, PageHeader, Stat, StatusBadge, buttonClass } from "@/components/ui";
import { APPLICATION_STATUS_LABEL, formatDateTime, timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function RecruiterDashboardPage() {
  const user = await requireUser("recruiter");
  const ctx = await getRecruiterCompany(user.id);
  if (!ctx) redirect("/register?role=recruiter");
  const [d, plan] = await Promise.all([getRecruiterDashboard(ctx.company.id), getCompanyPlan(ctx.company.planCode)]);

  const funnel = [
    { label: "Applied", value: (d.appsByStatus.applied ?? 0) + (d.appsByStatus.viewed ?? 0) },
    { label: "Review", value: d.appsByStatus.under_review ?? 0 },
    { label: "Shortlist", value: d.appsByStatus.shortlisted ?? 0 },
    { label: "Interview", value: d.appsByStatus.interview_scheduled ?? 0 },
    { label: "Selected", value: d.appsByStatus.selected ?? 0 },
    { label: "Hired", value: d.appsByStatus.hired ?? 0 },
  ];

  return (
    <>
      <PageHeader
        title={`Hello, ${user.name.split(" ")[0]}`}
        description={`${ctx.company.name} · hiring overview`}
        actions={
          <>
            <Link href="/recruiter/jobs/new" className={buttonClass("primary")}>Post a job</Link>
            <Link href="/recruiter/candidates" className={buttonClass("secondary")}>Search candidates</Link>
          </>
        }
      />

      {ctx.company.verificationStatus !== "verified" && (
        <div className="mb-6">
          <Notice tone="warning">
            Your company is <strong>{ctx.company.verificationStatus}</strong>. Jobs you publish are reviewed by SetuJobs before going live. Verification usually takes 1–2 business days.
          </Notice>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Active jobs" value={d.totals.activeJobs} hint={`${d.totals.jobs} total posted`} />
        <Stat label="Total applicants" value={d.totals.applicants} hint={`${d.totals.newApplicants} new`} />
        <Stat label="Shortlisted" value={d.totals.shortlisted} hint="Across all jobs" />
        <Stat label="Hired / selected" value={d.totals.hired} hint={`${d.totals.interviews} upcoming interviews`} />
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Expired / closed" value={d.totals.expiredJobs} />
        <Stat label="Plan" value={plan?.name ?? "Free"} hint={`Up to ${plan?.jobPostLimit ?? 1} active job(s)`} />
        <Stat label="Recruiter seats" value={plan?.seatLimit ?? 1} />
        <Stat label="Interviews" value={d.totals.interviews} hint="Scheduled" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-2">
          <h2 className="font-bold text-fg">Hiring funnel</h2>
          <p className="text-xs text-muted">Candidates by pipeline stage across all your jobs</p>
          <div className="mt-6">
            {d.totals.applicants ? <BarChart data={funnel} /> : <EmptyState title="No applicants yet" text="Publish a job to start receiving applications." />}
          </div>
        </Card>
        <Card className="p-6">
          <h2 className="font-bold text-fg">Upcoming interviews</h2>
          <ul className="mt-4 space-y-3">
            {d.upcoming.map((iv) => (
              <li key={iv.id} className="rounded-xl border border-line p-3 text-sm">
                <Link href={`/recruiter/applications/${iv.appId}`} className="font-semibold text-fg hover:text-brand">{iv.candidateName}</Link>
                <p className="text-xs text-muted">{iv.jobTitle} · {formatDateTime(iv.scheduledAt)} IST</p>
              </li>
            ))}
            {d.upcoming.length === 0 && <p className="text-sm text-muted">No interviews scheduled.</p>}
          </ul>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <div className="border-b border-line p-5"><h2 className="font-bold text-fg">Job performance</h2></div>
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-muted">
              <tr><th className="px-5 py-3">Job</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">Applicants</th><th className="px-5 py-3 text-right">Views</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {d.perJob.map((j) => (
                <tr key={j.id}>
                  <td className="px-5 py-3"><Link href={`/recruiter/jobs/${j.id}/applicants`} className="font-medium text-fg hover:text-brand">{j.title}</Link></td>
                  <td className="px-5 py-3"><StatusBadge status={j.status} /></td>
                  <td className="px-5 py-3 text-right font-semibold text-fg">{j.applicants}</td>
                  <td className="px-5 py-3 text-right text-muted">{j.views}</td>
                </tr>
              ))}
              {d.perJob.length === 0 && <tr><td colSpan={4} className="px-5 py-8 text-center text-muted">No jobs yet.</td></tr>}
            </tbody>
          </table>
        </Card>

        <Card className="p-6">
          <h2 className="font-bold text-fg">Recent applications</h2>
          <ul className="mt-4 divide-y divide-line">
            {d.recent.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <Link href={`/recruiter/applications/${a.id}`} className="font-semibold text-fg hover:text-brand">{a.candidateName}</Link>
                  <p className="truncate text-xs text-muted">{a.jobTitle} · {timeAgo(a.appliedAt)}</p>
                </div>
                <Badge tone="brand">{APPLICATION_STATUS_LABEL[a.status]}</Badge>
              </li>
            ))}
            {d.recent.length === 0 && <p className="py-6 text-sm text-muted">Recent applications will show here.</p>}
          </ul>
        </Card>
      </div>
    </>
  );
}
