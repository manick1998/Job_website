import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { applications, candidateProfiles, jobs, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getRecruiterCompany } from "@/lib/queries/dashboards";
import { APPLICATION_STATUS_LABEL, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

function csvCell(v: unknown) {
  const s = v == null ? "" : String(v);
  // Neutralise spreadsheet formula injection.
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** Recruiter-only CSV export of applicants for one of their jobs. */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "recruiter" || !user.emailVerifiedAt) return new Response("Forbidden", { status: 403 });
  const jobId = new URL(req.url).searchParams.get("jobId") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(jobId)) return new Response("Bad request", { status: 400 });

  const ctx = await getRecruiterCompany(user.id);
  if (!ctx) return new Response("Forbidden", { status: 403 });

  const [job] = await db
    .select({ id: jobs.id, title: jobs.title })
    .from(jobs)
    .where(and(eq(jobs.id, jobId), eq(jobs.companyId, ctx.company.id)))
    .limit(1);
  if (!job) return new Response("Not found", { status: 404 });

  const rows = await db
    .select({
      name: users.name,
      email: users.email,
      phone: users.phone,
      status: applications.status,
      rating: applications.rating,
      matchScore: applications.matchScore,
      experience: candidateProfiles.totalExperienceYears,
      location: candidateProfiles.currentLocation,
      appliedAt: applications.createdAt,
    })
    .from(applications)
    .innerJoin(users, eq(users.id, applications.candidateId))
    .leftJoin(candidateProfiles, eq(candidateProfiles.userId, users.id))
    .where(eq(applications.jobId, job.id))
    .orderBy(applications.createdAt);

  const header = ["Name", "Email", "Phone", "Stage", "Rating", "Match %", "Experience (yrs)", "Location", "Applied on"];
  const lines = [header.map(csvCell).join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.name,
        r.email,
        r.phone,
        APPLICATION_STATUS_LABEL[r.status],
        r.rating,
        r.matchScore,
        r.experience,
        r.location,
        formatDate(r.appliedAt),
      ]
        .map(csvCell)
        .join(","),
    );
  }

  const fileName = `applicants-${job.title.replace(/[^\w]+/g, "-").toLowerCase()}.csv`;
  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
