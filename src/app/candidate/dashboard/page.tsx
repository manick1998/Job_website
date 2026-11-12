import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getCandidateDashboard } from "@/lib/queries/dashboards";
import { BarChart, Card, EmptyState, JobCard, Notice, PageHeader, Stat, buttonClass } from "@/components/ui";
import { APPLICATION_STATUS_LABEL, formatDateTime, timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function CandidateDashboardPage() {
  const user = await requireUser("candidate");
  const d = await getCandidateDashboard(user.id);
  const chart = [
    { label: "Applied", value: d.byStatus.applied ?? 0 },
    { label: "Viewed", value: d.byStatus.viewed ?? 0 },
    { label: "Review", value: d.byStatus.under_review ?? 0 },
    { label: "Shortlist", value: d.byStatus.shortlisted ?? 0 },
    { label: "Interview", value: d.byStatus.interview_scheduled ?? 0 },
    { label: "Selected", value: (d.byStatus.selected ?? 0) + (d.byStatus.hired ?? 0) },
    { label: "Rejected", value: d.byStatus.rejected ?? 0 },
  ];

  return (
    <>
      <PageHeader
        title={`Welcome back, ${user.name.split(" ")[0]}`}
        description="Your job search at a glance — applications, interviews and matched roles."
        actions={<Link href="/jobs" className={buttonClass("primary")}>Search jobs</Link>}
      />

      {d.profile.resumes.length === 0 && (
        <div className="mb-6">
          <Notice tone="warning">
            You haven&apos;t uploaded a resume yet. <Link href="/candidate/resumes" className="font-semibold underline">Upload one now</Link> to apply faster.
          </Notice>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Applications" value={d.totalApplications} hint="All time" />
        <Stat label="Shortlisted" value={d.byStatus.shortlisted ?? 0} hint="Moving forward" />
        <Stat label="Upcoming interviews" value={d.upcomingInterviews.length} hint="Scheduled" />
        <Stat label="Saved jobs" value={d.savedCount} hint={`${d.alertCount} active alert${d.alertCount === 1 ? "" : "s"}`} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-fg">Application status</h2>
            <span className="text-xs text-muted">{d.totalApplications} total</span>
          </div>
          <div className="mt-6">
            {d.totalApplications ? <BarChart data={chart} /> : <EmptyState title="No applications yet" text="Apply to a job and track its progress here." />}
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-fg">Profile completeness</h2>
            <span className="text-lg font-extrabold text-brand">{d.completeness.percent}%</span>
          </div>
          <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={d.completeness.percent} aria-valuemin={0} aria-valuemax={100}>
            <div className="brand-gradient h-full rounded-full transition-all" style={{ width: `${d.completeness.percent}%` }} />
          </div>
          {d.completeness.missing.length > 0 ? (
            <ul className="mt-4 space-y-1.5 text-sm text-muted">
              {d.completeness.missing.slice(0, 5).map((m) => (
                <li key={m}>• {m}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-emerald-600">Great — your profile is complete.</p>
          )}
          <Link href="/candidate/profile" className="mt-5 inline-flex text-sm font-semibold text-brand hover:underline">Complete profile →</Link>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="font-bold text-fg">Upcoming interviews</h2>
          <div className="mt-4 space-y-3">
            {d.upcomingInterviews.map((iv) => (
              <div key={iv.id} className="rounded-xl border border-line p-4">
                <p className="font-semibold text-fg">{iv.jobTitle}</p>
                <p className="text-xs text-muted">{iv.companyName} · {formatDateTime(iv.scheduledAt)} IST · {iv.type}</p>
                {iv.meetingLink && <a href={iv.meetingLink} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-xs font-semibold text-brand hover:underline">Join meeting →</a>}
              </div>
            ))}
            {d.upcomingInterviews.length === 0 && <p className="text-sm text-muted">No interviews scheduled. Keep applying!</p>}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="font-bold text-fg">Recent activity</h2>
          <ol className="mt-4 space-y-4">
            {d.activity.map((a) => (
              <li key={a.id} className="flex gap-3">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand" />
                <div className="text-sm">
                  <p className="text-fg">
                    <span className="font-semibold">{a.jobTitle}</span> at {a.companyName}: <span className="text-brand">{APPLICATION_STATUS_LABEL[a.toStatus] ?? a.toStatus}</span>
                  </p>
                  <p className="text-xs text-muted">{timeAgo(a.createdAt)}</p>
                </div>
              </li>
            ))}
            {d.activity.length === 0 && <p className="text-sm text-muted">Your application updates will appear here.</p>}
          </ol>
        </Card>
      </div>

      <section className="mt-10">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-bold text-fg">Recommended for you</h2>
          <Link href="/jobs" className="text-sm font-semibold text-brand hover:underline">Browse all</Link>
        </div>
        {d.recommended.length ? (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {d.recommended.map((j) => <JobCard key={j.job.id} item={j} />)}
          </div>
        ) : (
          <EmptyState title="No recommendations yet" text="Add your skills in your profile to get personalised job matches." action={<Link href="/candidate/profile" className={buttonClass("secondary")}>Add skills</Link>} />
        )}
      </section>
    </>
  );
}
