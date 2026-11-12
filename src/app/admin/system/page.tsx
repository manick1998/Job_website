import { updateSettingsAction } from "@/app/actions/admin";
import { ActionForm, CheckField, Field } from "@/components/form";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { getSettings, listAuditLogs, listEmailLog, listPlansWithUsage } from "@/lib/queries/admin";
import { formatDateTime, formatINR } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function SystemPage() {
  const [settings, audit, emails, plans] = await Promise.all([getSettings(), listAuditLogs(60), listEmailLog(40), listPlansWithUsage()]);

  return (
    <>
      <PageHeader title="System" description="Platform configuration, subscription plans, audit trail and outgoing email log." />

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="p-6">
          <h2 className="font-bold text-fg">Website configuration</h2>
          <div className="mt-5">
            <ActionForm action={updateSettingsAction} submitLabel="Save settings" pendingLabel="Saving…">
              <Field name="site_name" label="Site name" defaultValue={settings.site_name ?? "SetuJobs"} />
              <Field name="support_email" label="Support email" type="email" defaultValue={settings.support_email ?? "support@setujobs.in"} />
              <CheckField name="maintenance_mode" label="Maintenance mode" hint="Shows a banner and pauses new applications for everyone." defaultChecked={settings.maintenance_mode === "on"} />
            </ActionForm>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="font-bold text-fg">Subscription plans</h2>
          <ul className="mt-4 divide-y divide-line text-sm">
            {plans.map((p) => (
              <li key={p.code} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-semibold text-fg">{p.name} <span className="text-xs font-normal text-muted">({p.audience})</span></p>
                  <p className="text-xs text-muted">{p.jobPostLimit} jobs · {p.seatLimit} seats · {p.resumeSearchLimit} resume searches</p>
                </div>
                <Badge tone="brand">{p.priceMonthlyInr ? `${formatINR(p.priceMonthlyInr)}/mo` : "Free"}</Badge>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-muted">Plan pricing is seeded. Editing plans and Razorpay billing require payment credentials (see README).</p>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card className="overflow-hidden">
          <div className="border-b border-line p-5"><h2 className="font-bold text-fg">Audit log</h2></div>
          {audit.length === 0 ? (
            <div className="p-5"><EmptyState title="No audit entries yet" text="Admin and recruiter actions are recorded here." /></div>
          ) : (
            <ul className="max-h-[520px] divide-y divide-line overflow-y-auto text-sm">
              {audit.map((a) => (
                <li key={a.id} className="px-5 py-3">
                  <p className="font-medium text-fg">{a.action}</p>
                  <p className="text-xs text-muted">{a.actorName ?? "System"} · {a.entityType}{a.entityId ? ` ${a.entityId.slice(0, 8)}` : ""} · {formatDateTime(a.createdAt)}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b border-line p-5">
            <h2 className="font-bold text-fg">Email outbox</h2>
            <p className="text-xs text-muted">Transactional emails are recorded here. Connect SMTP / SES / Resend via environment variables to deliver them externally.</p>
          </div>
          {emails.length === 0 ? (
            <div className="p-5"><EmptyState title="No emails sent" text="Verification, reset and application emails appear here." /></div>
          ) : (
            <ul className="max-h-[520px] divide-y divide-line overflow-y-auto text-sm">
              {emails.map((e) => (
                <li key={e.id} className="px-5 py-3">
                  <p className="font-medium text-fg">{e.subject}</p>
                  <p className="text-xs text-muted">To {e.toEmail} · {e.kind} · {formatDateTime(e.createdAt)}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
