import Link from "next/link";
import { getAdminStats } from "@/lib/queries/admin";
import { BarChart, Badge, Card, PageHeader, Stat, buttonClass } from "@/components/ui";
import { APPLICATION_STATUS_LABEL, formatINR } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminOverview() {
  const s = await getAdminStats();
  return (
    <>
      <PageHeader
        title="Platform overview"
        description="Live metrics across candidates, employers, jobs and applications."
        actions={
          <>
            <Link href="/admin/jobs?status=pending_review" className={buttonClass("primary", "sm")}>Review jobs ({s.jobs.pending})</Link>
            <Link href="/admin/reports" className={buttonClass("secondary", "sm")}>Open reports ({s.openReports})</Link>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Registered candidates" value={s.users.candidates.toLocaleString("en-IN")} hint={`${s.users.suspended} suspended accounts`} />
        <Stat label="Recruiters" value={s.users.recruiters.toLocaleString("en-IN")} hint={`${s.companies.total} companies`} />
        <Stat label="Verified companies" value={s.companies.verified} hint={`${s.companies.pending} awaiting verification`} />
        <Stat label="Total applications" value={s.applications.toLocaleString("en-IN")} />
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Total jobs" value={s.jobs.total} />
        <Stat label="Active jobs" value={s.jobs.active} hint="Live & before deadline" />
        <Stat label="Expired jobs" value={s.jobs.expired} hint="Past deadline" />
        <Stat label="Pending review" value={s.jobs.pending} hint="Awaiting moderation" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="font-bold text-fg">Daily registrations (last 14 days)</h2>
          <div className="mt-6">
            <BarChart data={s.dailyRegistrations.map((d) => ({ label: d.label, value: d.value }))} />
          </div>
        </Card>
        <Card className="p-6">
          <h2 className="font-bold text-fg">Monthly registrations (last 6 months)</h2>
          <div className="mt-6">
            <BarChart data={s.monthlyRegistrations} />
          </div>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="overflow-hidden lg:col-span-2">
          <div className="border-b border-line p-5">
            <h2 className="font-bold text-fg">Subscription plans</h2>
            <p className="text-xs text-muted">Company distribution across plans. Revenue is an estimate from list prices until Razorpay billing is enabled.</p>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-5 py-3">Plan</th>
                <th className="px-5 py-3">Price / month</th>
                <th className="px-5 py-3 text-right">Companies</th>
                <th className="px-5 py-3 text-right">Est. MRR</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {s.plans.map((p) => (
                <tr key={p.code}>
                  <td className="px-5 py-3 font-medium text-fg">{p.name}</td>
                  <td className="px-5 py-3 text-muted">{p.price === 0 ? "Free" : formatINR(p.price)}</td>
                  <td className="px-5 py-3 text-right text-fg">{p.companies}</td>
                  <td className="px-5 py-3 text-right text-fg">{formatINR(p.mrr)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center justify-between border-t border-line bg-surface-2 px-5 py-3 text-sm">
            <span className="text-muted">Estimated monthly recurring revenue</span>
            <span className="font-bold text-fg">{formatINR(s.estimatedMrr)}</span>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="font-bold text-fg">Application pipeline</h2>
          <ul className="mt-4 space-y-3">
            {s.applicationStatus.map((a) => (
              <li key={a.label} className="flex items-center justify-between text-sm">
                <span className="text-fg">{APPLICATION_STATUS_LABEL[a.label] ?? a.label}</span>
                <Badge tone="brand">{a.value}</Badge>
              </li>
            ))}
            {s.applicationStatus.length === 0 && <p className="text-sm text-muted">No applications yet.</p>}
          </ul>
        </Card>
      </div>
    </>
  );
}
