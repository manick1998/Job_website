import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getApplicationDetail, getRecruiterCompany } from "@/lib/queries/dashboards";
import {
  addNoteAction,
  recruiterMessageAction,
  scheduleInterviewAction,
  setRatingAction,
  setStatusFormAction,
  updateInterviewAction,
} from "@/app/actions/recruiter";
import { ActionForm, Field } from "@/components/form";
import { Badge, Card, Notice, PageHeader, StatusBadge, buttonClass } from "@/components/ui";
import { ConfirmButton } from "@/components/confirm-button";
import { APPLICATION_STATUS_LABEL, experienceLabel, formatDateTime, timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STAGE_BUTTONS: { status: string; label: string; tone: "primary" | "secondary" | "danger" }[] = [
  { status: "under_review", label: "Move to screening", tone: "secondary" },
  { status: "shortlisted", label: "Shortlist", tone: "primary" },
  { status: "selected", label: "Mark selected", tone: "primary" },
  { status: "hired", label: "Mark hired", tone: "primary" },
  { status: "rejected", label: "Reject", tone: "danger" },
];

export default async function ApplicationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser("recruiter");
  const ctx = await getRecruiterCompany(user.id);
  if (!ctx) redirect("/register?role=recruiter");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const d = await getApplicationDetail(id, ctx.company.id);
  if (!d) notFound();

  const p = d.profile;
  const match = d.app.matchScore;
  const closed = ["withdrawn", "hired"].includes(d.app.status);

  return (
    <>
      <PageHeader
        title={d.candidate.name}
        description={`${d.job.title} · applied ${timeAgo(d.app.createdAt)}`}
        actions={
          <>
            <StatusBadge status={d.app.status} />
            <Link href={`/recruiter/jobs/${d.job.id}/applicants`} className={buttonClass("secondary", "sm")}>← Pipeline</Link>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Card className="p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted">Headline</p>
                <p className="mt-1 font-semibold text-fg">{p?.headline ?? "—"}</p>
                <p className="text-sm text-muted">{[p?.currentDesignation, p?.currentCompany].filter(Boolean).join(" at ") || "—"}</p>
              </div>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <dt className="text-muted">Experience</dt><dd className="text-fg">{experienceLabel(p?.totalExperienceYears ?? 0)}</dd>
                <dt className="text-muted">Location</dt><dd className="text-fg">{p?.currentLocation ?? "—"}</dd>
                <dt className="text-muted">Notice</dt><dd className="text-fg">{p?.noticePeriodDays != null ? `${p.noticePeriodDays} days` : "—"}</dd>
                <dt className="text-muted">Expected</dt><dd className="text-fg">{p?.expectedSalary ? `₹${(p.expectedSalary / 100000).toFixed(1)} LPA` : "—"}</dd>
                <dt className="text-muted">Education</dt><dd className="text-fg">{[p?.degree, p?.college].filter(Boolean).join(", ") || "—"}</dd>
                <dt className="text-muted">Contact</dt><dd className="break-all text-fg">{d.candidate.email}{d.candidate.phone ? ` · ${d.candidate.phone}` : ""}</dd>
              </dl>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {d.skills.map((s) => <Badge key={s.slug} tone="brand">{s.name}</Badge>)}
              {d.skills.length === 0 && <span className="text-sm text-muted">No skills listed</span>}
            </div>
            <div className="mt-5 flex flex-wrap gap-4 text-sm">
              {p?.linkedinUrl && <a href={p.linkedinUrl} target="_blank" rel="noopener noreferrer nofollow" className="font-semibold text-brand hover:underline">LinkedIn</a>}
              {p?.githubUrl && <a href={p.githubUrl} target="_blank" rel="noopener noreferrer nofollow" className="font-semibold text-brand hover:underline">GitHub</a>}
              {p?.portfolioUrl && <a href={p.portfolioUrl} target="_blank" rel="noopener noreferrer nofollow" className="font-semibold text-brand hover:underline">Portfolio</a>}
            </div>
            {p?.summary && <p className="mt-5 whitespace-pre-line text-sm leading-relaxed text-fg/90">{p.summary}</p>}
          </Card>

          <Card className="p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-bold text-fg">Resume</h2>
              {d.resume && (
                <div className="flex gap-2">
                  <a href={`/api/resumes/${d.resume.id}?inline=1`} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary", "sm")}>Open</a>
                  <a href={`/api/resumes/${d.resume.id}`} className={buttonClass("secondary", "sm")}>Download</a>
                </div>
              )}
            </div>
            {d.resume ? (
              <iframe title="Candidate resume" src={`/api/resumes/${d.resume.id}?inline=1`} className="mt-4 h-[520px] w-full rounded-xl border border-line bg-white" />
            ) : (
              <p className="mt-3 text-sm text-muted">No resume attached.</p>
            )}
            {d.app.coverLetter && (
              <div className="mt-5">
                <p className="text-xs uppercase tracking-wide text-muted">Cover letter</p>
                <p className="mt-2 whitespace-pre-line text-sm text-fg/90">{d.app.coverLetter}</p>
              </div>
            )}
            {Object.keys(d.app.answers ?? {}).length > 0 && (
              <div className="mt-5 space-y-3">
                <p className="text-xs uppercase tracking-wide text-muted">Screening answers</p>
                {Object.entries(d.app.answers).map(([q, a]) => (
                  <div key={q} className="rounded-xl bg-surface-2 p-4">
                    <p className="text-xs font-semibold text-muted">{q}</p>
                    <p className="mt-1 text-sm text-fg">{a}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-6">
            <h2 className="font-bold text-fg">Interviews</h2>
            <div className="mt-4 space-y-4">
              {d.interviews.map((iv) => (
                <div key={iv.id} className="rounded-xl border border-line p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-fg">{formatDateTime(iv.scheduledAt)} IST · {iv.type} · {iv.durationMinutes} min</p>
                    <Badge tone={iv.status === "completed" ? "green" : iv.status === "cancelled" ? "red" : "amber"}>{iv.status}</Badge>
                  </div>
                  {iv.meetingLink && <a href={iv.meetingLink} target="_blank" rel="noopener noreferrer" className="mt-1 block text-xs text-brand hover:underline">Meeting link</a>}
                  {iv.feedback && <p className="mt-2 text-sm text-fg/90">Feedback: {iv.feedback} {iv.feedbackRating ? `(${iv.feedbackRating}/5)` : ""}</p>}
                  {iv.status === "scheduled" && (
                    <div className="mt-4 grid gap-4 lg:grid-cols-2">
                      <ActionForm action={updateInterviewAction} submitLabel="Mark completed" pendingLabel="Saving…">
                        <input type="hidden" name="interviewId" value={iv.id} />
                        <input type="hidden" name="intent" value="complete" />
                        <Field as="textarea" rows={2} name="feedback" label="Interview feedback" />
                        <Field as="select" name="feedbackRating" label="Rating" options={[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: `${n} / 5` }))} />
                      </ActionForm>
                      <ActionForm action={updateInterviewAction} submitLabel="Cancel interview" pendingLabel="Cancelling…">
                        <input type="hidden" name="interviewId" value={iv.id} />
                        <input type="hidden" name="intent" value="cancel" />
                        <p className="text-xs text-muted">Cancelling notifies the candidate immediately.</p>
                      </ActionForm>
                    </div>
                  )}
                </div>
              ))}
              {d.interviews.length === 0 && <p className="text-sm text-muted">No interviews yet.</p>}
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="font-bold text-fg">Private notes</h2>
            <p className="text-xs text-muted">Visible only to your hiring team — never to the candidate.</p>
            <div className="mt-4 space-y-3">
              {d.notes.map((n) => (
                <div key={n.id} className="rounded-xl bg-surface-2 p-4">
                  <p className="whitespace-pre-line text-sm text-fg">{n.body}</p>
                  <p className="mt-2 text-xs text-muted">{n.author ?? "Team member"} · {timeAgo(n.createdAt)}</p>
                </div>
              ))}
            </div>
            <div className="mt-5">
              <ActionForm action={addNoteAction} submitLabel="Add note" pendingLabel="Saving…">
                <input type="hidden" name="applicationId" value={d.app.id} />
                <Field as="textarea" rows={3} name="body" label="New note" required placeholder="Strong system design answers; follow up on notice period." />
              </ActionForm>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="font-bold text-fg">Pipeline stage</h2>
            <p className="mt-1 text-sm text-muted">Current: <StatusBadge status={d.app.status} /></p>
            {closed ? (
              <p className="mt-4 text-sm text-muted">This application is {APPLICATION_STATUS_LABEL[d.app.status]?.toLowerCase()} and can no longer change stage.</p>
            ) : (
              <div className="mt-4 flex flex-wrap gap-2">
                {STAGE_BUTTONS.filter((b) => b.status !== d.app.status).map((b) => (
                  <form key={b.status} action={setStatusFormAction}>
                    <input type="hidden" name="applicationId" value={d.app.id} />
                    <input type="hidden" name="toStatus" value={b.status} />
                    {b.status === "rejected" ? (
                      <ConfirmButton message="Reject this candidate? They will be notified." className={buttonClass(b.tone, "sm")}>{b.label}</ConfirmButton>
                    ) : (
                      <button type="submit" className={buttonClass(b.tone, "sm")}>{b.label}</button>
                    )}
                  </form>
                ))}
              </div>
            )}

            <div className="mt-6 border-t border-line pt-5">
              <p className="text-sm font-semibold text-fg">Internal rating</p>
              <div className="mt-2 flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <form key={n} action={setRatingAction}>
                    <input type="hidden" name="applicationId" value={d.app.id} />
                    <input type="hidden" name="rating" value={n} />
                    <button type="submit" aria-label={`Rate ${n} of 5`} className={`text-2xl ${d.app.rating && d.app.rating >= n ? "text-amber-500" : "text-line hover:text-amber-400"}`}>★</button>
                  </form>
                ))}
              </div>
            </div>

            <div className="mt-6 border-t border-line pt-5">
              <p className="text-sm font-semibold text-fg">Match score</p>
              <p className="mt-1 text-3xl font-extrabold text-brand">{match != null ? `${match}%` : "—"}</p>
              <p className="mt-2 text-xs leading-relaxed text-muted">
                Transparent estimate: 75% required & preferred skill overlap plus 25% experience fit against this role. It supports, and never replaces, human review. Protected characteristics are not used.
              </p>
            </div>
          </Card>

          {!closed && (
            <Card className="p-6">
              <h2 className="font-bold text-fg">Schedule interview</h2>
              <div className="mt-4">
                <ActionForm action={scheduleInterviewAction} submitLabel="Schedule & notify" pendingLabel="Scheduling…">
                  <input type="hidden" name="applicationId" value={d.app.id} />
                  <Field name="scheduledAt" label="Date & time (IST)" type="datetime-local" required />
                  <div className="grid grid-cols-2 gap-4">
                    <Field name="durationMinutes" label="Duration (min)" type="number" min={15} max={240} defaultValue={45} />
                    <Field as="select" name="type" label="Type" required defaultValue="video" options={[
                      { value: "video", label: "Video" },
                      { value: "phone", label: "Phone" },
                      { value: "onsite", label: "On-site" },
                    ]} />
                  </div>
                  <Field name="meetingLink" label="Meeting link" type="url" placeholder="https://meet.google.com/..." />
                  <Field name="interviewerName" label="Interviewer" placeholder="Priya Sharma, Engineering Manager" />
                </ActionForm>
              </div>
            </Card>
          )}

          <Card className="p-6">
            <h2 className="font-bold text-fg">Messages</h2>
            <div className="mt-4 max-h-80 space-y-3 overflow-y-auto pr-1">
              {d.messages.map((m) => (
                <div key={m.id} className={`rounded-xl p-3 text-sm ${m.senderId === user.id ? "ml-6 bg-brand/10 text-fg" : "mr-6 bg-surface-2 text-fg"}`}>
                  <p className="text-xs text-muted">{m.senderId === user.id ? "You" : m.senderName} · {timeAgo(m.createdAt)}</p>
                  <p className="mt-1 whitespace-pre-line">{m.body}</p>
                </div>
              ))}
              {d.messages.length === 0 && <p className="text-sm text-muted">No messages yet.</p>}
            </div>
            <div className="mt-4">
              <ActionForm action={recruiterMessageAction} submitLabel="Send message" pendingLabel="Sending…">
                <input type="hidden" name="applicationId" value={d.app.id} />
                <Field as="textarea" rows={2} name="body" label="Message to candidate" required />
              </ActionForm>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="font-bold text-fg">Activity</h2>
            <ol className="mt-4 space-y-3 border-l-2 border-line pl-4">
              {d.events.map((e) => (
                <li key={e.id} className="text-sm">
                  <span className="font-medium text-fg">{APPLICATION_STATUS_LABEL[e.toStatus] ?? e.toStatus}</span>
                  <span className="ml-2 text-xs text-muted">{formatDateTime(e.createdAt)}</span>
                </li>
              ))}
            </ol>
          </Card>
          <Notice tone="info">Candidate data is shared only with your company for hiring purposes. Do not forward it outside your hiring team.</Notice>
        </div>
      </div>
    </>
  );
}
