import { redirect } from "next/navigation";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { jobCategories } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { getRecruiterCompany, getCompanyPlan } from "@/lib/queries/dashboards";
import { JobForm } from "@/components/job-form";
import { Card, Notice, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function NewJobPage() {
  const user = await requireUser("recruiter");
  const ctx = await getRecruiterCompany(user.id);
  if (!ctx) redirect("/register?role=recruiter");
  const [categories, plan] = await Promise.all([
    db.select({ id: jobCategories.id, name: jobCategories.name }).from(jobCategories).orderBy(asc(jobCategories.name)),
    getCompanyPlan(ctx.company.planCode),
  ]);

  return (
    <>
      <PageHeader
        title="Post a new job"
        description="Save as draft to finish later, or publish. Verified employers go live instantly; others are reviewed by our team."
      />
      <div className="mb-6">
        <Notice tone="info">
          Plan <strong>{plan?.name ?? "Free"}</strong>: up to {plan?.jobPostLimit ?? 1} active job(s). Screening questions help you shortlist faster — candidates must answer them to apply.
        </Notice>
      </div>
      <Card className="p-6 sm:p-8">
        <JobForm categories={categories} />
      </Card>
    </>
  );
}
