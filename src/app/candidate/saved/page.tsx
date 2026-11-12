import { requireUser } from "@/lib/auth";
import { listAlerts, listSavedJobs } from "@/lib/queries/dashboards";
import { createJobAlertAction, deleteJobAlertAction, toggleSaveJobAction } from "@/app/actions/candidate";
import { ActionForm, Field } from "@/components/form";
import { Badge, Card, EmptyState, JobCard, PageHeader, buttonClass } from "@/components/ui";
import { ConfirmButton } from "@/components/confirm-button";
import { WORK_MODE_LABEL } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function SavedPage() {
  const user = await requireUser("candidate");
  const [saved, alerts] = await Promise.all([listSavedJobs(user.id), listAlerts(user.id)]);

  return (
    <>
      <PageHeader title="Saved jobs & alerts" description="Keep track of roles you like and get notified when new matches appear." />

      <div className="grid gap-8 xl:grid-cols-[1fr_360px]">
        <section>
          <h2 className="mb-4 text-lg font-bold text-fg">Saved jobs ({saved.length})</h2>
          {saved.length ? (
            <div className="grid gap-5 md:grid-cols-2">
              {saved.map((j) => (
                <div key={j.job.id} className="flex flex-col gap-3">
                  <JobCard item={j} />
                  <form action={toggleSaveJobAction} className="px-1">
                    <input type="hidden" name="jobId" value={j.job.id} />
                    <button type="submit" className={buttonClass("secondary", "sm")}>Remove from saved</button>
                  </form>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No saved jobs" text="Tap “Save job” on any listing to keep it here." />
          )}
        </section>

        <section className="space-y-5">
          <Card className="p-6">
            <h2 className="font-bold text-fg">Create a job alert</h2>
            <p className="mt-1 text-sm text-muted">We&apos;ll email and notify you when a live job matches.</p>
            <div className="mt-5">
              <ActionForm action={createJobAlertAction} submitLabel="Create alert">
                <Field name="keywords" label="Keywords" required placeholder="React developer, Bengaluru" />
                <Field name="location" label="Location (optional)" placeholder="Pune" />
                <Field
                  name="workMode"
                  label="Work mode (optional)"
                  as="select"
                  placeholder="Any"
                  options={[
                    { value: "remote", label: "Remote / WFH" },
                    { value: "hybrid", label: "Hybrid" },
                    { value: "onsite", label: "Work from office" },
                  ]}
                />
              </ActionForm>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="font-bold text-fg">Your alerts</h2>
            <ul className="mt-4 space-y-3">
              {alerts.map((a) => (
                <li key={a.id} className="flex items-start justify-between gap-3 rounded-xl border border-line p-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-fg">{a.keywords}</p>
                    <p className="text-xs text-muted">
                      {[a.location, a.workMode ? WORK_MODE_LABEL[a.workMode] : null].filter(Boolean).join(" · ") || "Any location"}
                    </p>
                    {a.isActive ? <Badge tone="green">Active</Badge> : <Badge>Paused</Badge>}
                  </div>
                  <form action={deleteJobAlertAction}>
                    <input type="hidden" name="id" value={a.id} />
                    <ConfirmButton message="Delete this alert?" className={buttonClass("ghost", "sm")}>Delete</ConfirmButton>
                  </form>
                </li>
              ))}
              {alerts.length === 0 && <p className="text-sm text-muted">No alerts yet.</p>}
            </ul>
          </Card>
        </section>
      </div>
    </>
  );
}
