import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { companyMembers, users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { getCompanyPlan, getRecruiterCompany } from "@/lib/queries/dashboards";
import { inviteMemberAction, updateCompanyAction } from "@/app/actions/recruiter";
import { ActionForm, Field } from "@/components/form";
import { Badge, Card, PageHeader, StatusBadge, buttonClass } from "@/components/ui";
import { COMPANY_SIZES, INDUSTRIES, INDIAN_CITIES } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function CompanyPage() {
  const user = await requireUser("recruiter");
  const ctx = await getRecruiterCompany(user.id);
  if (!ctx) redirect("/register?role=recruiter");
  const c = ctx.company;
  const [plan, members] = await Promise.all([
    getCompanyPlan(c.planCode),
    db
      .select({ name: users.name, email: users.email, role: companyMembers.role, designation: companyMembers.designation })
      .from(companyMembers)
      .innerJoin(users, eq(users.id, companyMembers.userId))
      .where(eq(companyMembers.companyId, c.id)),
  ]);
  const isOwner = ctx.membership.role === "owner";

  return (
    <>
      <PageHeader
        title="Company & team"
        description="Your public company profile, verification status and recruiter seats."
        actions={<Link href={`/companies/${c.slug}`} className={buttonClass("secondary", "sm")}>View public profile</Link>}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-xs text-muted">Verification</p>
          <div className="mt-2"><Badge tone={c.verificationStatus === "verified" ? "green" : c.verificationStatus === "rejected" ? "red" : "amber"}>{c.verificationStatus}</Badge></div>
          <p className="mt-2 text-xs text-muted">{c.verificationStatus === "verified" ? "Verified employer badge is shown." : "Verification is reviewed by Manick Job Portal."}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs text-muted">Plan</p>
          <p className="mt-2 text-xl font-bold text-fg">{plan?.name ?? "Free"}</p>
          <p className="text-xs text-muted">{plan?.jobPostLimit ?? 1} active jobs · {plan?.seatLimit ?? 1} seats</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs text-muted">Recruiters on team</p>
          <p className="mt-2 text-xl font-bold text-fg">{members.length}</p>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <Card className="p-6">
          <h2 className="font-bold text-fg">Company profile</h2>
          <div className="mt-5">
            <ActionForm action={updateCompanyAction} submitLabel="Save company" pendingLabel="Saving…">
              <div className="grid gap-5 sm:grid-cols-2">
                <Field name="name" label="Company name" required defaultValue={c.name} />
                <Field name="industry" label="Industry" as="select" required defaultValue={c.industry ?? ""} options={INDUSTRIES.map((i) => ({ value: i, label: i }))} />
                <Field name="companySize" label="Company size" as="select" required defaultValue={c.companySize ?? ""} options={COMPANY_SIZES.map((s) => ({ value: s, label: `${s} employees` }))} />
                <Field name="location" label="Headquarters" as="select" required defaultValue={c.location ?? ""} options={INDIAN_CITIES.map((x) => ({ value: x, label: x }))} />
                <Field name="website" label="Website" type="url" defaultValue={c.website ?? ""} placeholder="https://" />
                <Field name="logoUrl" label="Logo URL" type="url" defaultValue={c.logoUrl ?? ""} hint="Direct image URL (object storage upload coming soon)." />
                <Field as="textarea" rows={5} name="description" label="About the company" defaultValue={c.description ?? ""} className="sm:col-span-2" />
                <Field as="textarea" rows={4} name="benefits" label="Benefits & culture (one per line)" defaultValue={c.benefits ?? ""} className="sm:col-span-2" />
              </div>
            </ActionForm>
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="font-bold text-fg">Hiring team</h2>
            <ul className="mt-4 divide-y divide-line">
              {members.map((m) => (
                <li key={m.email} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-fg">{m.name}</p>
                    <p className="truncate text-xs text-muted">{m.email}{m.designation ? ` · ${m.designation}` : ""}</p>
                  </div>
                  <Badge tone={m.role === "owner" ? "brand" : "slate"}>{m.role}</Badge>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="p-6">
            <h2 className="font-bold text-fg">Invite a recruiter</h2>
            {isOwner ? (
              <p className="mt-1 text-sm text-muted">The colleague must already have a recruiter account on Manick Job Portal.</p>
            ) : (
              <p className="mt-1 text-sm text-muted">Only the company owner can invite team members.</p>
            )}
            {isOwner && (
              <div className="mt-4">
                <ActionForm action={inviteMemberAction} submitLabel="Add to team" pendingLabel="Adding…">
                  <Field name="email" label="Colleague's email" type="email" required />
                  <Field name="designation" label="Designation (optional)" placeholder="Talent Acquisition Manager" />
                </ActionForm>
              </div>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
