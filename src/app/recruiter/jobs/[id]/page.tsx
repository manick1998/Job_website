import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { jobCategories } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { getJobForCompany, getRecruiterCompany } from "@/lib/queries/dashboards";
import { JobForm } from "@/components/job-form";
import { Card, Notice, PageHeader, StatusBadge, buttonClass } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function EditJobPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser("recruiter");
  const ctx = await getRecruiterCompany(user.id);
  if (!ctx) redirect("/register?role=recruiter");
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const found = await getJobForCompany(id, ctx.company.id);
  if (!found) notFound();
  const categories = await db.select({ id: jobCategories.id, name: jobCategories.name }).from(jobCategories).orderBy(asc(jobCategories.name));

  return (
    <>
      <PageHeader
        title="Edit job"
        description={found.job.title}
        actions={
          <>
            <StatusBadge status={found.job.status} />
            <Link href={`/recruiter/jobs/${found.job.id}/applicants`} className={buttonClass("primary", "sm")}>Open pipeline</Link>
            <Link href={`/jobs/${found.job.slug}`} className={buttonClass("secondary", "sm")}>Preview</Link>
          </>
        }
      />
      {sp.duplicated && <div className="mb-6"><Notice tone="success">Job duplicated as a draft. Review and publish when ready.</Notice></div>}
      {found.job.status === "rejected" && found.job.rejectionReason && (
        <div className="mb-6"><Notice tone="error">Moderation note: {found.job.rejectionReason}. Update the posting and re-submit.</Notice></div>
      )}
      <Card className="p-6 sm:p-8">
        <JobForm categories={categories} job={found.job} requiredSkills={found.requiredSkills} preferredSkills={found.preferredSkills} />
      </Card>
    </>
  );
}
