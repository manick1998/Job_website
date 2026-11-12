import { requireUser } from "@/lib/auth";
import { getCandidateProfile } from "@/lib/queries/dashboards";
import { deleteResumeAction, setPrimaryResumeAction, toggleResumeVisibilityAction, uploadResumeAction } from "@/app/actions/candidate";
import { ActionForm, Field } from "@/components/form";
import { Badge, Card, EmptyState, PageHeader, buttonClass } from "@/components/ui";
import { ConfirmButton } from "@/components/confirm-button";
import { formatDate } from "@/lib/utils";
import { profileCompleteness } from "@/lib/match";

export const dynamic = "force-dynamic";

export default async function ResumesPage() {
  const user = await requireUser("candidate");
  const { resumes, profile, skills } = await getCandidateProfile(user.id);
  const completeness = profileCompleteness({
    headline: profile?.headline,
    summary: profile?.summary,
    currentLocation: profile?.currentLocation,
    currentDesignation: profile?.currentDesignation,
    college: profile?.college,
    skillCount: skills.length,
    resumeCount: resumes.length,
    hasLinks: !!(profile?.linkedinUrl || profile?.githubUrl || profile?.portfolioUrl),
    expectedSalary: profile?.expectedSalary,
    noticePeriodDays: profile?.noticePeriodDays,
  });

  return (
    <>
      <PageHeader
        title="Resumes"
        description="Upload up to 5 versions (PDF or DOCX, max 5 MB). Choose one as primary to apply faster."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          {resumes.map((r) => (
            <Card key={r.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 font-semibold text-fg">
                  <span className="truncate">{r.label}</span>
                  {r.isPrimary && <Badge tone="brand">Primary</Badge>}
                  {!r.isVisible && <Badge>Hidden from recruiters</Badge>}
                </p>
                <p className="mt-1 truncate text-xs text-muted">
                  {r.fileName} · {(r.sizeBytes / 1024).toFixed(0)} KB · uploaded {formatDate(r.createdAt)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <a href={`/api/resumes/${r.id}?inline=1`} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary", "sm")}>
                  Preview
                </a>
                <a href={`/api/resumes/${r.id}`} className={buttonClass("secondary", "sm")}>
                  Download
                </a>
                {!r.isPrimary && (
                  <form action={setPrimaryResumeAction}>
                    <input type="hidden" name="id" value={r.id} />
                    <button type="submit" className={buttonClass("secondary", "sm")}>Set primary</button>
                  </form>
                )}
                <form action={toggleResumeVisibilityAction}>
                  <input type="hidden" name="id" value={r.id} />
                  <button type="submit" className={buttonClass("secondary", "sm")}>{r.isVisible ? "Hide from recruiters" : "Make visible"}</button>
                </form>
                <form action={deleteResumeAction}>
                  <input type="hidden" name="id" value={r.id} />
                  <ConfirmButton message="Delete this resume? This cannot be undone." className={buttonClass("danger", "sm")}>Delete</ConfirmButton>
                </form>
              </div>
            </Card>
          ))}
          {resumes.length === 0 && (
            <EmptyState title="No resumes uploaded" text="Add a PDF or DOCX resume to start applying." />
          )}
        </div>

        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="font-bold text-fg">Upload a resume</h2>
            <div className="mt-5">
              <ActionForm action={uploadResumeAction} encType="multipart/form-data" submitLabel="Upload resume" pendingLabel="Uploading…">
                <Field name="label" label="Label" placeholder="Backend resume 2026" defaultValue="" />
                <Field type="file" name="file" label="Resume file" required accept=".pdf,.docx" hint="Only PDF and DOCX. File contents are verified, not just the extension." />
              </ActionForm>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="font-bold text-fg">Resume completeness</h2>
            <p className="mt-2 text-3xl font-extrabold text-brand">{completeness.percent}%</p>
            <ul className="mt-3 space-y-1.5 text-sm text-muted">
              {(completeness.missing.length ? completeness.missing : ["Everything looks great!"]).map((m) => (
                <li key={m}>• {m}</li>
              ))}
            </ul>
          </Card>

          <Card className="p-6">
            <h2 className="font-bold text-fg">Resume builder</h2>
            <p className="mt-2 text-sm text-muted">
              Template-based resume generation and PDF export are on the roadmap. For now, build your profile in{" "}
              <a href="/candidate/profile" className="font-semibold text-brand hover:underline">My profile</a> — it powers recruiter search and match scores.
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}
