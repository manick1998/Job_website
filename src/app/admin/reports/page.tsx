import Link from "next/link";
import { resolveReportAction } from "@/app/actions/admin";
import { Badge, Card, EmptyState, PageHeader, buttonClass } from "@/components/ui";
import { listReports } from "@/lib/queries/admin";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const status = ["open", "resolved", "dismissed"].includes(sp.status ?? "") ? sp.status : "open";
  const rows = await listReports(status);

  return (
    <>
      <PageHeader title="Reports & moderation" description="Community reports on jobs and companies. Every decision is logged in the audit trail." />
      <div className="mb-6 flex gap-2">
        {["open", "resolved", "dismissed"].map((s) => (
          <Link key={s} href={`/admin/reports?status=${s}`} className={buttonClass(status === s ? "primary" : "secondary", "sm")}>
            {s[0].toUpperCase() + s.slice(1)}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState title={`No ${status} reports`} text="Nothing needs attention right now." />
      ) : (
        <div className="space-y-4">
          {rows.map((r) => (
            <Card key={r.id} className="p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="red">{r.reason}</Badge>
                    {r.jobTitle && <span className="font-semibold text-fg">Job: {r.jobTitle}</span>}
                    {r.companyName && <span className="font-semibold text-fg">Company: {r.companyName}</span>}
                  </div>
                  {r.details && <p className="mt-2 text-sm text-fg/90">{r.details}</p>}
                  <p className="mt-2 text-xs text-muted">Reported by {r.reporterName ?? "anonymous"} · {formatDate(r.createdAt)}</p>
                  {r.resolutionNote && <p className="mt-2 text-xs text-muted">Resolution: {r.resolutionNote}</p>}
                </div>
                {r.status === "open" && (
                  <form action={resolveReportAction} className="w-full max-w-sm space-y-3">
                    <input type="hidden" name="reportId" value={r.id} />
                    <textarea name="note" rows={2} placeholder="Resolution note" className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-fg" />
                    {r.jobId && (
                      <label className="flex items-center gap-2 text-xs text-fg">
                        <input type="checkbox" name="hideJob" className="accent-indigo-600" /> Also take the job down (rejected)
                      </label>
                    )}
                    <div className="flex gap-2">
                      <button name="resolution" value="resolved" className={buttonClass("primary", "sm")}>Resolve</button>
                      <button name="resolution" value="dismissed" className={buttonClass("secondary", "sm")}>Dismiss</button>
                    </div>
                  </form>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
