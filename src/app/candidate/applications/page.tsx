import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listCandidateApplications } from "@/lib/queries/dashboards";
import { withdrawApplicationAction } from "@/app/actions/candidate";
import { Badge, Card, EmptyState, Notice, PageHeader, StatusBadge, buttonClass } from "@/components/ui";
import { ConfirmButton } from "@/components/confirm-button";
import { APPLICATION_STATUS_LABEL, formatDate, formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

const FINAL = ["hired", "selected", "rejected", "withdrawn"];

export default async function ApplicationsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser("candidate");
  const sp = await searchParams;
  const apps = await listCandidateApplications(user.id);
  const filter = sp.status;
  const list = filter ? apps.filter((a) => a.status === filter) : apps;

  return (
    <>
      <PageHeader title="My applications" description="Complete history of every application, with each status change." />
      {sp.applied && (
        <div className="mb-6">
          <Notice tone="success">Application submitted successfully. You will be notified about every status change.</Notice>
        </div>
      )}

      <div className="mb-6 flex flex-wrap gap-2 text-sm">
        <Link href="/candidate/applications" className={buttonClass(!filter ? "primary" : "secondary", "sm")}>All ({apps.length})</Link>
        {["applied", "under_review", "shortlisted", "interview_scheduled", "selected", "rejected", "withdrawn"].map((s) => {
          const count = apps.filter((a) => a.status === s).length;
          return (
            <Link key={s} href={`/candidate/applications?status=${s}`} className={buttonClass(filter === s ? "primary" : "secondary", "sm")}>
              {APPLICATION_STATUS_LABEL[s]} ({count})
            </Link>
          );
        })}
      </div>

      {list.length === 0 ? (
        <EmptyState
          title={apps.length ? "No applications in this status" : "You haven't applied yet"}
          text="Search for roles that match your skills and apply in one click."
          action={<Link href="/jobs" className={buttonClass("primary")}>Find jobs</Link>}
        />
      ) : (
        <div className="space-y-4">
          {list.map((a) => (
            <Card key={a.id} className="p-5 sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <Link href={`/jobs/${a.jobSlug}`} className="text-lg font-semibold text-fg hover:text-brand">{a.jobTitle}</Link>
                  <p className="text-sm text-muted">{a.companyName} · {a.jobCity}</p>
                  <p className="mt-1 text-xs text-muted">
                    Applied {formatDate(a.appliedAt)} · Resume: {a.resumeName ?? "—"}
                    {a.matchScore != null && <> · Match {a.matchScore}%</>}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={a.status} />
                  {!FINAL.includes(a.status) && (
                    <form action={withdrawApplicationAction}>
                      <input type="hidden" name="id" value={a.id} />
                      <ConfirmButton message="Withdraw this application?" className={buttonClass("secondary", "sm")}>Withdraw</ConfirmButton>
                    </form>
                  )}
                </div>
              </div>

              {a.interview && (
                <div className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
                  <p className="font-semibold">Interview: {formatDateTime(a.interview.scheduledAt)} IST</p>
                  <p className="text-xs">
                    {a.interview.type} · {a.interview.durationMinutes} min
                    {a.interview.meetingLink && (
                      <>
                        {" · "}
                        <a href={a.interview.meetingLink} target="_blank" rel="noopener noreferrer" className="font-semibold underline">Join link</a>
                      </>
                    )}
                  </p>
                </div>
              )}

              <details className="mt-4 group">
                <summary className="cursor-pointer text-sm font-semibold text-brand">Status history ({a.events.length})</summary>
                <ol className="mt-3 space-y-2 border-l-2 border-line pl-4">
                  {a.events.map((e) => (
                    <li key={e.id} className="text-sm">
                      <Badge tone="slate">{APPLICATION_STATUS_LABEL[e.toStatus] ?? e.toStatus}</Badge>
                      <span className="ml-2 text-xs text-muted">{formatDateTime(e.createdAt)}</span>
                    </li>
                  ))}
                </ol>
              </details>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
