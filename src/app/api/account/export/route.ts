import { eq } from "drizzle-orm";
import { db } from "@/db";
import { applicationEvents, applications, candidateProfiles, candidateSkills, jobs, notifications, resumes, savedJobs, skills, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** DPDP Act data-portability: export all personal data held for the signed-in user as JSON. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const [account] = await db
    .select({ id: users.id, email: users.email, name: users.name, phone: users.phone, role: users.role, createdAt: users.createdAt })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);
  const [profile] = await db.select().from(candidateProfiles).where(eq(candidateProfiles.userId, user.id)).limit(1);
  const skillRows = await db
    .select({ name: skills.name })
    .from(candidateSkills)
    .innerJoin(skills, eq(skills.id, candidateSkills.skillId))
    .where(eq(candidateSkills.userId, user.id));
  const resumeRows = await db
    .select({ id: resumes.id, label: resumes.label, fileName: resumes.fileName, createdAt: resumes.createdAt })
    .from(resumes)
    .where(eq(resumes.userId, user.id));
  const apps = await db
    .select({ id: applications.id, jobTitle: jobs.title, status: applications.status, appliedAt: applications.createdAt })
    .from(applications)
    .innerJoin(jobs, eq(jobs.id, applications.jobId))
    .where(eq(applications.candidateId, user.id));
  const events = await db
    .select({ applicationId: applicationEvents.applicationId, toStatus: applicationEvents.toStatus, at: applicationEvents.createdAt })
    .from(applicationEvents)
    .innerJoin(applications, eq(applications.id, applicationEvents.applicationId))
    .where(eq(applications.candidateId, user.id));
  const saved = await db.select({ jobId: savedJobs.jobId }).from(savedJobs).where(eq(savedJobs.userId, user.id));
  const notes = await db.select({ title: notifications.title, createdAt: notifications.createdAt }).from(notifications).where(eq(notifications.userId, user.id));

  const payload = {
    exportedAt: new Date().toISOString(),
    account,
    profile: profile ?? null,
    skills: skillRows.map((s) => s.name),
    resumes: resumeRows,
    applications: apps,
    applicationHistory: events,
    savedJobIds: saved.map((s) => s.jobId),
    notifications: notes,
  };

  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="setujobs-data-${user.id}.json"`,
      "Cache-Control": "private, no-store",
    },
  });
}
