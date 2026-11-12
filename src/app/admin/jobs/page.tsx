import Link from "next/link";
import { moderateJobAction } from "@/app/actions/admin";
import { Badge, Card, EmptyState, PageHeader, Pagination, StatusBadge, buttonClass } from "@/components/ui";
import { ConfirmButton } from "@/components/confirm-button";
import { listAdminJobs } from "@/lib/queries/admin";
import { JOB_STATUS_LABEL, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUSES = ["", "pending_review", "published", "paused", "closed", "rejected", "draft"];

export default async function AdminJobsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const status = sp.status && STATUSES.includes(sp.status) ? sp.status : "";
  const page = Math.max(1, Number(sp.page) || 1);
  const result = await listAdminJobs({ q: sp.q, status: status || undefined, page });

  return (
    <>
      <PageHeader title="Job moderation" description="Approve listings, suspend suspicious postings and feature top roles." />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        {STATUSES.map((s) => (
          <Link key={s || "all"} href={s ? `/admin/jobs?status=${s}` : "/admin/jobs"} className={buttonClass(status === s ? "primary" : "secondary", "sm")}>
            {s ? JOB_STATUS_LABEL[s] : "All"}
          </Link>
        ))}
        <form method="get" className="ml-auto flex gap-2">
          {status && <input type="hidden" name="status" value={status} />}
          <input name="q" defaultValue={sp.q ?? ""} placeholder="Search title" className="rounded-xl border border-line bg-surface px-3 py-2 text-sm text-fg" />
          <button type="submit" className={buttonClass("secondary", "sm")}>Search</button>
        </form>
      </div>

      {result.items.length === 0 ? (
        <EmptyState title="No jobs in this view" text="Jobs matching the filter will appear here." />
      ) : (
        <div className="space-y-4">
          {result.items.map((j) => (
            <Card key={j.id} className="p-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/jobs/${j.slug}`} className="font-semibold text-fg hover:text-brand">{j.title}</Link>
                    <StatusBadge status={j.status} />
                    {j.isFeatured && <Badge tone="amber">Featured</Badge>}
                    {j.companyVerification !== "verified" && <Badge tone="red">Unverified company</Badge>}
                    {j.companySuspended && <Badge tone="red">Company suspended</Badge>}
                  </div>
                  <p className="mt-1 text-sm text-muted">{j.companyName} · {j.city} · posted {formatDate(j.createdAt)}{j.deadline ? ` · deadline ${formatDate(j.deadline)}` : ""}</p>
                </div>
                <form className="flex flex-wrap items-center gap-2" action={moderateJobAction}>
                  <input type="hidden" name="jobId" value={j.id} />
                  <input name="reason" placeholder="Reason (optional)" className="w-48 rounded-lg border border-line bg-surface px-2 py-1.5 text-xs text-fg" />
                  <button name="action" value="approve" className={buttonClass("primary", "sm")}>Approve</button>
                  <button name="action" value="reject" className={buttonClass("secondary", "sm")}>Reject</button>
                  <button name="action" value="suspend" className={buttonClass("secondary", "sm")}>Suspend</button>
                  <button name="action" value={j.isFeatured ? "unfeature" : "feature"} className={buttonClass("secondary", "sm")}>{j.isFeatured ? "Unfeature" : "Feature"}</button>
                  {j.status === "closed" ? (
                    <button name="action" value="reopen" className={buttonClass("secondary", "sm")}>Reopen</button>
                  ) : (
                    <button name="action" value="close" className={buttonClass("secondary", "sm")}>Close</button>
                  )}
                  <ConfirmButton name="action" value="delete" message="Permanently delete this job and its applications?" className={buttonClass("danger", "sm")}>Delete</ConfirmButton>
                </form>
              </div>
            </Card>
          ))}
        </div>
      )}
      <Pagination basePath="/admin/jobs" params={{ status: status || undefined, q: sp.q }} page={page} pages={result.pages} />
    </>
  );
}
