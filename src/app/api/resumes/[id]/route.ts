import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { applications, companies, companyMembers, jobs, resumes } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { readUpload } from "@/lib/services";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Secure resume download: owner, admin, or a recruiter whose company received an application with this resume. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const inline = new URL(req.url).searchParams.get("inline") === "1";
  const user = await getCurrentUser();
  if (!user || !user.emailVerifiedAt) return new Response("Unauthorized", { status: 401 });
  if (!UUID_RE.test(id)) return new Response("Not found", { status: 404 });

  const [resume] = await db.select().from(resumes).where(eq(resumes.id, id)).limit(1);
  if (!resume) return new Response("Not found", { status: 404 });

  let allowed = resume.userId === user.id || user.role === "admin";
  if (!allowed && user.role === "recruiter") {
    const [hit] = await db
      .select({ id: applications.id })
      .from(applications)
      .innerJoin(jobs, eq(jobs.id, applications.jobId))
      .innerJoin(companies, eq(companies.id, jobs.companyId))
      .innerJoin(companyMembers, and(eq(companyMembers.companyId, companies.id), eq(companyMembers.userId, user.id)))
      .where(eq(applications.resumeId, resume.id))
      .limit(1);
    allowed = !!hit;
  }
  if (!allowed) return new Response("Forbidden", { status: 403 });

  try {
    const buf = await readUpload(resume.storageKey);
    const safeName = resume.fileName.replace(/"/g, "");
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": resume.mimeType,
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${safeName}"`,
        "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("File unavailable", { status: 404 });
  }
}
