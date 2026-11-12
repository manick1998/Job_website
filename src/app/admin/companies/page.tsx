import Link from "next/link";
import { moderateCompanyAction } from "@/app/actions/admin";
import { Badge, Card, EmptyState, PageHeader, Pagination, buttonClass } from "@/components/ui";
import { listAdminCompanies } from "@/lib/queries/admin";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminCompaniesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const status = ["pending", "verified", "rejected"].includes(sp.status ?? "") ? sp.status : undefined;
  const page = Math.max(1, Number(sp.page) || 1);
  const result = await listAdminCompanies({ status, page });

  return (
    <>
      <PageHeader title="Companies" description="Verify employers, manage suspensions and review company profiles." />
      <div className="mb-6 flex flex-wrap gap-2">
        {[undefined, "pending", "verified", "rejected"].map((s) => (
          <Link key={s ?? "all"} href={s ? `/admin/companies?status=${s}` : "/admin/companies"} className={buttonClass(status === s ? "primary" : "secondary", "sm")}>
            {s ? s[0].toUpperCase() + s.slice(1) : "All"}
          </Link>
        ))}
      </div>

      {result.items.length === 0 ? (
        <EmptyState title="No companies here" text="Companies appear once recruiters register." />
      ) : (
        <div className="space-y-4">
          {result.items.map((c) => (
            <Card key={c.id} className="p-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/companies/${c.slug}`} className="font-semibold text-fg hover:text-brand">{c.name}</Link>
                    <Badge tone={c.verificationStatus === "verified" ? "green" : c.verificationStatus === "rejected" ? "red" : "amber"}>{c.verificationStatus}</Badge>
                    {c.suspended && <Badge tone="red">Suspended</Badge>}
                    <Badge>{c.planCode}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    {[c.industry, c.location, c.ownerEmail].filter(Boolean).join(" · ")} · {c.jobCount} job{c.jobCount === 1 ? "" : "s"} · joined {formatDate(c.createdAt)}
                  </p>
                </div>
                <form action={moderateCompanyAction} className="flex flex-wrap gap-2">
                  <input type="hidden" name="companyId" value={c.id} />
                  {c.verificationStatus !== "verified" && <button name="action" value="verify" className={buttonClass("primary", "sm")}>Verify</button>}
                  {c.verificationStatus !== "rejected" && <button name="action" value="reject" className={buttonClass("secondary", "sm")}>Reject</button>}
                  {c.suspended ? (
                    <button name="action" value="unsuspend" className={buttonClass("secondary", "sm")}>Unsuspend</button>
                  ) : (
                    <button name="action" value="suspend" className={buttonClass("danger", "sm")}>Suspend</button>
                  )}
                </form>
              </div>
            </Card>
          ))}
        </div>
      )}
      <Pagination basePath="/admin/companies" params={{ status }} page={page} pages={result.pages} />
    </>
  );
}
