import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { Bookmark, BookmarkCheck, Building2, Calendar, CheckCircle2, GraduationCap, IndianRupee, MapPin, Users, Wifi, Briefcase } from "lucide-react";
import { db } from "@/db";
import { applications, jobs } from "@/db/schema";
import { toggleSaveJobAction } from "@/app/actions/candidate";
import { applyToJobAction } from "@/app/actions/candidate";
import { reportAction } from "@/app/actions/shared";
import { ActionForm, Field } from "@/components/form";
import { Badge, Card, JobCard, Notice, StatusBadge, buttonClass } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { getRecruiterCompany, listResumes, listSavedJobIds } from "@/lib/queries/dashboards";
import { getJobBySlug, getSimilarJobs } from "@/lib/queries/jobs";
import { APPLICATION_STATUS_LABEL, APP_URL, EMPLOYMENT_LABEL, WORK_MODE_LABEL, experienceLabel, formatDate, salaryLabel, timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params) {
  const { slug } = await params;
  const item = await getJobBySlug(slug);
  if (!item) return { title: "Job not found" };
  const title = `${item.job.title} at ${item.company.name}`;
  return {
    title,
    description: `${item.job.title} in ${item.job.city} at ${item.company.name}. ${salaryLabel(item.job.salaryMin, item.job.salaryMax, item.job.salaryHidden)}. Apply on SetuJobs.`,
    alternates: { canonical: `${APP_URL}/jobs/${item.job.slug}` },
    openGraph: { title, url: `${APP_URL}/jobs/${item.job.slug}` },
  };
}

function Lines({ text }: { text?: string | null }) {
  if (!text) return null;
  const items = text.split("\n").map((l) => l.replace(/^[-•*]\s*/, "").trim()).filter(Boolean);
  if (items.length === 1) return <p className="whitespace-pre-line leading-relaxed text-fg/90">{items[0]}</p>;
  return (
    <ul className="list-disc space-y-2 pl-5 text-fg/90">
      {items.map((i, idx) => (
        <li key={idx}>{i}</li>
      ))}
    </ul>
  );
}

function Section({ title, children, id }: { title: string; children: React.ReactNode; id?: string }) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="mb-3 text-lg font-bold text-fg">{title}</h2>
      {children}
    </section>
  );
}

export default async function JobDetailPage({ params }: Params) {
  const { slug } = await params;
  const item = await getJobBySlug(slug);
  if (!item) notFound();
  const { job, company } = item;

  const user = await getCurrentUser();
  const ownCompany = user?.role === "recruiter" ? (await getRecruiterCompany(user.id))?.company.id : null;
  const canPreview = user?.role === "admin" || (!!ownCompany && ownCompany === job.companyId);
  if (job.status !== "published" && !canPreview) notFound();
  const isPreview = job.status !== "published";

  if (!isPreview && user?.role !== "recruiter") {
    await db.update(jobs).set({ viewsCount: sql`${jobs.viewsCount} + 1` }).where(eq(jobs.id, job.id));
  }

  const similar = await getSimilarJobs({ id: job.id, categoryId: job.categoryId, city: job.city });

  let applied: { status: string; id: string } | null = null;
  let saved = false;
  let resumes: Awaited<ReturnType<typeof listResumes>> = [];
  if (user?.role === "candidate") {
    const [app] = await db
      .select({ id: applications.id, status: applications.status })
      .from(applications)
      .where(and(eq(applications.jobId, job.id), eq(applications.candidateId, user.id)))
      .limit(1);
    applied = app ?? null;
    saved = (await listSavedJobIds(user.id)).has(job.id);
    resumes = await listResumes(user.id);
  }

  const primary = resumes.find((r) => r.isPrimary) ?? resumes[0];
  const questions = job.screeningQuestions ?? [];
  const jobUrl = `${APP_URL}/jobs/${job.slug}`;
  const ld = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    description: job.description,
    datePosted: (job.publishedAt ?? job.createdAt).toISOString(),
    validThrough: job.deadline ? job.deadline.toISOString() : undefined,
    employmentType: job.employmentType.toUpperCase().replace("_", "_"),
    hiringOrganization: { "@type": "Organization", name: company.name, sameAs: company.slug ? `${APP_URL}/companies/${company.slug}` : undefined },
    jobLocation: { "@type": "Place", address: { "@type": "PostalAddress", addressLocality: job.city, addressCountry: "IN" } },
    jobLocationType: job.workMode === "remote" ? "TELECOMMUTE" : undefined,
    baseSalary:
      !job.salaryHidden && job.salaryMin
        ? { "@type": "MonetaryAmount", currency: "INR", value: { "@type": "QuantitativeValue", minValue: job.salaryMin, maxValue: job.salaryMax ?? job.salaryMin, unitText: "YEAR" } }
        : undefined,
    directApply: true,
    url: jobUrl,
  };

  const shareText = encodeURIComponent(`${job.title} at ${company.name} — ${jobUrl}`);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }} />

      {isPreview && <div className="mb-6"><Notice tone="warning">Preview mode — this job is <strong>{APPLICATION_STATUS_LABEL[job.status] ?? job.status}</strong> and not visible to candidates yet.</Notice></div>}
      {job.rejectionReason && isPreview && <div className="mb-6"><Notice tone="error">Moderation note: {job.rejectionReason}</Notice></div>}

      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <article className="min-w-0 space-y-10">
          <header className="rounded-3xl border border-line bg-surface p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-2">
              {job.isFeatured && <Badge tone="amber">Featured</Badge>}
              <Badge tone="brand">{EMPLOYMENT_LABEL[job.employmentType]}</Badge>
              <Badge tone="sky">{WORK_MODE_LABEL[job.workMode]}</Badge>
              {job.isFresher && <Badge tone="green">Freshers welcome</Badge>}
            </div>
            <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-fg sm:text-4xl">{job.title}</h1>
            <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted">
              <Link href={`/companies/${company.slug}`} className="inline-flex items-center gap-1.5 font-semibold text-fg hover:text-brand">
                <Building2 className="h-4 w-4" /> {company.name}
              </Link>
              {company.verificationStatus === "verified" && <span className="text-emerald-600">✔ Verified employer</span>}
              <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" /> {job.city}</span>
              <span>Posted {timeAgo(job.publishedAt ?? job.createdAt)}</span>
            </p>

            <dl className="mt-7 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                { icon: IndianRupee, k: "Salary", v: salaryLabel(job.salaryMin, job.salaryMax, job.salaryHidden) },
                { icon: Briefcase, k: "Experience", v: experienceLabel(job.minExperience, job.maxExperience) },
                { icon: Wifi, k: "Work mode", v: WORK_MODE_LABEL[job.workMode] },
                { icon: Users, k: "Openings", v: String(job.openings) },
                { icon: GraduationCap, k: "Education", v: job.educationRequirement || "Not specified" },
                { icon: Calendar, k: "Apply by", v: job.deadline ? formatDate(job.deadline) : "Open until filled" },
                { icon: MapPin, k: "Location", v: job.city },
                { icon: Briefcase, k: "Department", v: job.department || "—" },
              ].map((f) => {
                const Icon = f.icon;
                return (
                  <div key={f.k} className="rounded-2xl bg-surface-2 p-4">
                    <dt className="flex items-center gap-1.5 text-xs text-muted"><Icon className="h-3.5 w-3.5" /> {f.k}</dt>
                    <dd className="mt-1 text-sm font-semibold text-fg">{f.v}</dd>
                  </div>
                );
              })}
            </dl>
          </header>

          <Section title="About the role">
            <Lines text={job.description} />
          </Section>
          {job.responsibilities && (
            <Section title="Responsibilities">
              <Lines text={job.responsibilities} />
            </Section>
          )}
          <Section title="Required skills">
            <div className="flex flex-wrap gap-2">
              {item.skills.filter((s) => s.required).map((s) => <Badge key={s.slug} tone="brand">{s.name}</Badge>)}
              {item.skills.filter((s) => s.required).length === 0 && <p className="text-sm text-muted">Not specified</p>}
            </div>
          </Section>
          {item.skills.some((s) => !s.required) && (
            <Section title="Preferred skills">
              <div className="flex flex-wrap gap-2">
                {item.skills.filter((s) => !s.required).map((s) => <Badge key={s.slug}>{s.name}</Badge>)}
              </div>
            </Section>
          )}
          {job.benefits && (
            <Section title="Benefits">
              <Lines text={job.benefits} />
            </Section>
          )}
          <Section title={`About ${company.name}`}>
            <Card className="p-6">
              <p className="text-sm text-muted">{company.industry ?? "Industry not specified"} · {company.location ?? job.city}</p>
              <Link href={`/companies/${company.slug}`} className="mt-3 inline-flex text-sm font-semibold text-brand hover:underline">
                View company profile & all openings →
              </Link>
            </Card>
          </Section>

          {/* Application */}
          <section id="apply" className="scroll-mt-24 rounded-3xl border border-line bg-surface p-6 sm:p-8">
            <h2 className="text-xl font-bold text-fg">Apply for this role</h2>
            {isPreview ? (
              <p className="mt-2 text-sm text-muted">Applications open once this job is published.</p>
            ) : !user ? (
              <div className="mt-4">
                <p className="text-sm text-muted">Create a free job-seeker account or log in to apply in one click.</p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Link href={`/login?next=/jobs/${job.slug}%23apply`} className={buttonClass("primary")}>Log in to apply</Link>
                  <Link href="/register" className={buttonClass("secondary")}>Create account</Link>
                </div>
              </div>
            ) : user.role !== "candidate" ? (
              <p className="mt-2 text-sm text-muted">Recruiter and admin accounts cannot apply. Log in as a job seeker to apply.</p>
            ) : applied ? (
              <div className="mt-4 space-y-3">
                <Notice tone="success">You applied for this role. Current status: <strong>{APPLICATION_STATUS_LABEL[applied.status]}</strong>.</Notice>
                <Link href="/candidate/applications" className={buttonClass("secondary")}>Track my applications</Link>
              </div>
            ) : job.status !== "published" || (job.deadline && job.deadline < new Date()) ? (
              <p className="mt-2 text-sm text-muted">This job is no longer accepting applications.</p>
            ) : resumes.length === 0 ? (
              <div className="mt-4 space-y-3">
                <p className="text-sm text-muted">Upload a resume below and submit your application in one step.</p>
              </div>
            ) : null}

            {!isPreview && user?.role === "candidate" && !applied && job.status === "published" && (!job.deadline || job.deadline >= new Date()) && (
              <div className="mt-6">
                <ActionForm action={applyToJobAction} encType="multipart/form-data" submitLabel="Submit application" pendingLabel="Submitting…">
                  <input type="hidden" name="jobId" value={job.id} />
                  <Field
                    as="select"
                    name="resumeId"
                    label="Resume"
                    required
                    defaultValue={primary?.id ?? "new"}
                    options={[
                      ...resumes.map((r) => ({ value: r.id, label: `${r.label} — ${r.fileName}${r.isPrimary ? " (primary)" : ""}` })),
                      { value: "new", label: "Upload a new resume" },
                    ]}
                  />
                  <Field type="file" name="newResume" label="New resume (PDF or DOCX, up to 5 MB)" accept=".pdf,.docx" hint="Only used when “Upload a new resume” is selected." />
                  <Field as="textarea" name="coverLetter" label="Cover letter (optional)" rows={4} placeholder="Why are you a great fit for this role?" />
                  {questions.map((q, i) => (
                    <Field key={i} as="textarea" rows={2} name={`answer_${i}`} label={q} required />
                  ))}
                </ActionForm>
              </div>
            )}
          </section>

          {similar.length > 0 && (
            <section aria-labelledby="similar">
              <h2 id="similar" className="mb-4 text-lg font-bold text-fg">Similar jobs</h2>
              <div className="grid gap-5 md:grid-cols-2">
                {similar.map((s) => <JobCard key={s.job.id} item={s} />)}
              </div>
            </section>
          )}
        </article>

        <aside className="space-y-5 lg:sticky lg:top-24 lg:h-fit">
          <Card className="space-y-4 p-6">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted">Salary</p>
              <p className="text-2xl font-extrabold text-fg">{salaryLabel(job.salaryMin, job.salaryMax, job.salaryHidden)}</p>
            </div>
            <StatusBadge status={job.status} />
            {!isPreview && user?.role === "candidate" && !applied && (
              <a href="#apply" className={`${buttonClass("primary")} w-full`}>Apply now</a>
            )}
            {!isPreview && !user && (
              <Link href={`/login?next=/jobs/${job.slug}%23apply`} className={`${buttonClass("primary")} w-full`}>Log in to apply</Link>
            )}
            {applied && <Notice tone="success">Applied · {APPLICATION_STATUS_LABEL[applied.status]}</Notice>}

            {user?.role === "candidate" && (
              <form action={toggleSaveJobAction}>
                <input type="hidden" name="jobId" value={job.id} />
                <button type="submit" className={`${buttonClass("secondary")} w-full`}>
                  {saved ? <BookmarkCheck className="h-4 w-4 text-brand" /> : <Bookmark className="h-4 w-4" />}
                  {saved ? "Saved" : "Save job"}
                </button>
              </form>
            )}

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Share</p>
              <div className="flex flex-wrap gap-2 text-xs">
                <a className={buttonClass("secondary", "sm")} href={`https://wa.me/?text=${shareText}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>
                <a className={buttonClass("secondary", "sm")} href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(jobUrl)}`} target="_blank" rel="noopener noreferrer">LinkedIn</a>
                <a className={buttonClass("secondary", "sm")} href={`mailto:?subject=${encodeURIComponent(job.title)}&body=${shareText}`}>Email</a>
              </div>
            </div>

            <dl className="space-y-2 border-t border-line pt-4 text-sm">
              <div className="flex justify-between"><dt className="text-muted">Openings</dt><dd className="font-medium text-fg">{job.openings}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Views</dt><dd className="font-medium text-fg">{job.viewsCount}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Posted</dt><dd className="font-medium text-fg">{formatDate(job.publishedAt ?? job.createdAt)}</dd></div>
            </dl>
            {isPreview && canPreview && (
              <Link href={`/recruiter/jobs/${job.id}`} className={`${buttonClass("secondary")} w-full`}>Back to editor</Link>
            )}
          </Card>

          {user && (
            <details className="rounded-2xl border border-line bg-surface p-5 text-sm">
              <summary className="cursor-pointer font-semibold text-fg">Report this listing</summary>
              <div className="mt-4">
                <ActionForm action={reportAction} submitLabel="Submit report" className="space-y-3">
                  <input type="hidden" name="jobId" value={job.id} />
                  <Field as="select" name="reason" label="Reason" required options={[
                    { value: "Fake or fraudulent job", label: "Fake or fraudulent job" },
                    { value: "Requests money or fees", label: "Requests money or fees" },
                    { value: "Misleading salary or details", label: "Misleading salary or details" },
                    { value: "Discriminatory or inappropriate", label: "Discriminatory or inappropriate" },
                    { value: "Other", label: "Other" },
                  ]} />
                  <Field as="textarea" rows={2} name="details" label="Details (optional)" />
                </ActionForm>
              </div>
            </details>
          )}
        </aside>
      </div>
    </div>
  );
}
