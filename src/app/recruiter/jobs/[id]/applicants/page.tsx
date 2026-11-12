import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getJobApplicants, getJobForCompany, getRecruiterCompany } from "@/lib/queries/dashboards";
import { moveApplicationAction } from "@/app/actions/recruiter";
import { KanbanBoard, type KanbanCard } from "@/components/kanban";
import { Card, PageHeader, buttonClass } from "@/components/ui";
import { PIPELINE_COLUMNS } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ApplicantsPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser("recruiter");
  const ctx = await getRecruiterCompany(user.id);
  if (!ctx) redirect("/register?role=recruiter");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const found = await getJobForCompany(id, ctx.company.id);
  if (!found) notFound();
  const applicants = await getJobApplicants(id, ctx.company.id);

  const cards: KanbanCard[] = applicants.map((a) => ({
    id: a.id,
    candidateName: a.candidateName,
    headline: a.headline ?? (a.experience != null ? `${a.experience} yrs experience` : null),
    status: a.status,
    rating: a.rating,
    matchScore: a.matchScore,
    appliedAt: a.appliedAt.toISOString(),
  }));

  return (
    <>
      <PageHeader
        title={`Pipeline · ${found.job.title}`}
        description={`${applicants.length} applicant${applicants.length === 1 ? "" : "s"}. Drag cards between stages, or use “Move to…” for keyboard access.`}
        actions={
          <>
            <a href={`/api/recruiter/export?jobId=${id}`} className={buttonClass("secondary", "sm")}>Export CSV</a>
            <Link href={`/recruiter/jobs/${id}`} className={buttonClass("secondary", "sm")}>Edit job</Link>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {PIPELINE_COLUMNS.map((c) => (
          <Card key={c.key} className="p-4">
            <p className="text-xs text-muted">{c.label}</p>
            <p className="text-2xl font-bold text-fg">{cards.filter((x) => (c.statuses as readonly string[]).includes(x.status)).length}</p>
          </Card>
        ))}
      </div>

      {applicants.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="font-semibold text-fg">No applicants yet</p>
          <p className="mt-1 text-sm text-muted">Share the job link to attract candidates. {found.job.status !== "published" && "This job is not live yet."}</p>
        </Card>
      ) : (
        <KanbanBoard cards={cards} moveAction={moveApplicationAction} />
      )}
      <p className="mt-6 text-xs text-muted">
        Match scores are a transparent skill-and-experience overlap estimate to help you prioritise. They never reject candidates automatically — every decision is yours.
      </p>
    </>
  );
}
