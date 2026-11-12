import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getRecruiterCompany, listCompanyJobs } from "@/lib/queries/dashboards";
import { jobLifecycleAction } from "@/app/actions/recruiter";
import { Badge, Card, EmptyState, Notice, PageHeader, StatusBadge, buttonClass } from "@/components/ui";
import { ConfirmButton } from "@/components/confirm-button";
import { EMPLOYMENT_LABEL, JOB_STATUS_LABEL, formatDate, salaryLabel } from "@/lib/utils";

export const dynamic = "force-dynamic";

const FILTERS = ["", "published", "pending_review", "paused", "draft", "closed", "rejected"];

export default async function RecruiterJobsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser("recruiter");
  const ctx = await getRecruiterCompany(user.id);
  if (!ctx) redirect("/register?role=recruiter");
  const sp = await searchParams;
  const status = sp.status && FILTERS.includes(sp.status) ? sp.status : "";
  const rows = await listCompanyJobs(ctx.company.id, status || undefined);

  const notice =
    sp.saved === "deleted"
      ? "Job deleted."
      : sp.saved === "pending_review"
        ? "Job submitted for review. It will go live once approved."
        : sp.saved === "published"
          ? "Job is live."
          : sp.saved === "draft"
            ? "Saved as draft."
            : sp.saved
              ? "Job updated."
              : null;

  return (
    <>
      <PageHeader
        title="Jobs"
        description="Manage lifecycle, applicants and performance for every role."
        actions={<Link href="/recruiter/jobs/new" className={buttonClass("primary")}>Post a job</Link>}
      />
      {notice && <div className="mb-5"><Notice tone="success">{notice}</Notice></div>}
      {sp.error && <div className="mb-5"><Notice tone="error">{sp.error}</Notice></div>}

      <div className="mb-6 flex flex-wrap gap-2 text-sm">
        {FILTERS.map((f) => (
          <Link key={f || "all"} href={f ? `/recruiter/jobs?status=${f}` : "/recruiter/jobs"} className={buttonClass(status === f ? "primary" : "secondary", "sm")}>
            {f ? JOB_STATUS_LABEL[f] : "All"}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No jobs here" text="Create a job posting to reach thousands of candidates." action={<Link href="/recruiter/jobs/new" className={buttonClass("primary")}>Post your first job</Link>} />
      ) : (
        <div className="space-y-4">
          {rows.map(({ job, applicants }) => {
            const canPause = job.status === "published";
            const canResume = job.status === "paused";
            const canSubmit = ["draft", "rejected", "closed"].includes(job.status);
            const canClose = ["published", "paused", "pending_review"].includes(job.status);
            return (
              <Card key={job.id} className="p-5 sm:p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/recruiter/jobs/${job.id}`} className="text-lg font-semibold text-fg hover:text-brand">{job.title}</Link>
                      <StatusBadge status={job.status} />
                      {job.isFeatured && <Badge tone="amber">Featured</Badge>}
                    </div>
                    <p className="mt-1 text-sm text-muted">
                      {job.city} · {EMPLOYMENT_LABEL[job.employmentType]} · {salaryLabel(job.salaryMin, job.salaryMax, job.salaryHidden)}
                    </p>
                    {job.rejectionReason && <p className="mt-2 text-xs text-red-600">Moderation note: {job.rejectionReason}</p>}
                    <p className="mt-2 text-xs text-muted">
                      Created {formatDate(job.createdAt)} · Deadline {job.deadline ? formatDate(job.deadline) : "open"} · {job.viewsCount} views
                    </p>
                  </div>
                  <div className="flex flex-col items-start gap-3 lg:items-end">
                    <div className="text-right">
                      <p className="text-2xl font-extrabold text-fg">{applicants}</p>
                      <p className="text-xs text-muted">applicants</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Link href={`/recruiter/jobs/${job.id}/applicants`} className={buttonClass("primary", "sm")}>Pipeline</Link>
                      <Link href={`/recruiter/jobs/${job.id}`} className={buttonClass("secondary", "sm")}>Edit</Link>
                      <Link href={`/jobs/${job.slug}`} className={buttonClass("secondary", "sm")}>Preview</Link>
                      <a href={`/api/recruiter/export?jobId=${job.id}`} className={buttonClass("secondary", "sm")}>Export CSV</a>
                    </div>
                    <form action={jobLifecycleAction} className="flex flex-wrap gap-2">
                      <input type="hidden" name="jobId" value={job.id} />
                      {canPause && <button name="intent" value="pause" className={buttonClass("secondary", "sm")}>Pause</button>}
                      {canResume && <button name="intent" value="resume" className={buttonClass("secondary", "sm")}>Resume</button>}
                      {canSubmit && <button name="intent" value="submit" className={buttonClass("secondary", "sm")}>{job.status === "draft" ? "Publish" : "Re-submit"}</button>}
                      {canClose && <ConfirmButton name="intent" value="close" message="Close this job? Candidates will no longer be able to apply." className={buttonClass("secondary", "sm")}>Close</ConfirmButton>}
                      <button name="intent" value="duplicate" className={buttonClass("secondary", "sm")}>Duplicate</button>
                      {applicants === 0 && (
                        <ConfirmButton name="intent" value="delete" message="Delete this job permanently?" className={buttonClass("danger", "sm")}>Delete</ConfirmButton>
                      )}
                    </form>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
      <p className="mt-6 text-xs text-muted">Jobs in {EMPLOYMENT_LABEL.full_time} and other types count toward your plan&apos;s active job limit when live or in review.</p>
    </>
  );
}
