import { requireUser } from "@/lib/auth";
import { getCandidateProfile } from "@/lib/queries/dashboards";
import { updateProfileAction } from "@/app/actions/candidate";
import { ActionForm, CheckField, Field } from "@/components/form";
import { Card, PageHeader } from "@/components/ui";
import { profileCompleteness } from "@/lib/match";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await requireUser("candidate");
  const { user: u, profile: p, skills, resumes } = await getCandidateProfile(user.id);
  const completeness = profileCompleteness({
    headline: p?.headline,
    summary: p?.summary,
    currentLocation: p?.currentLocation,
    currentDesignation: p?.currentDesignation,
    college: p?.college,
    skillCount: skills.length,
    resumeCount: resumes.length,
    hasLinks: !!(p?.linkedinUrl || p?.githubUrl || p?.portfolioUrl),
    expectedSalary: p?.expectedSalary,
    noticePeriodDays: p?.noticePeriodDays,
  });

  return (
    <>
      <PageHeader title="My profile" description={`Profile ${completeness.percent}% complete. Recruiters see only what you make visible.`} />
      <div className="mb-6 h-2 overflow-hidden rounded-full bg-surface-2">
        <div className="brand-gradient h-full rounded-full" style={{ width: `${completeness.percent}%` }} />
      </div>

      <ActionForm action={updateProfileAction} submitLabel="Save profile" pendingLabel="Saving…" className="space-y-6">
        <Card className="grid gap-5 p-6 sm:grid-cols-2">
          <h2 className="text-base font-bold text-fg sm:col-span-2">Personal details</h2>
          <Field name="name" label="Full name" required defaultValue={u?.name} />
          <Field name="phone" label="Mobile number" type="tel" defaultValue={u?.phone ?? ""} hint="Shared with recruiters only after you apply." />
          <Field name="headline" label="Professional headline" placeholder="Full-stack developer | React & Node.js" defaultValue={p?.headline} className="sm:col-span-2" />
          <Field as="textarea" rows={4} name="summary" label="Career summary" defaultValue={p?.summary} className="sm:col-span-2" />
          <Field name="currentLocation" label="Current location" defaultValue={p?.currentLocation} />
          <Field name="preferredLocations" label="Preferred locations" placeholder="Bengaluru, Remote" defaultValue={p?.preferredLocations} />
        </Card>

        <Card className="grid gap-5 p-6 sm:grid-cols-2">
          <h2 className="text-base font-bold text-fg sm:col-span-2">Experience & compensation</h2>
          <Field name="currentCompany" label="Current company" defaultValue={p?.currentCompany} />
          <Field name="currentDesignation" label="Current designation" defaultValue={p?.currentDesignation} />
          <Field name="totalExperienceYears" label="Total experience (years)" type="number" min={0} max={60} defaultValue={p?.totalExperienceYears ?? 0} />
          <Field name="noticePeriodDays" label="Notice period (days)" type="number" min={0} max={365} defaultValue={p?.noticePeriodDays ?? ""} />
          <Field name="currentSalary" label="Current salary (₹ per year)" type="number" min={0} defaultValue={p?.currentSalary ?? ""} hint="Kept private — never shown to recruiters." />
          <Field name="expectedSalary" label="Expected salary (₹ per year)" type="number" min={0} defaultValue={p?.expectedSalary ?? ""} />
          <Field
            name="employmentPreference"
            label="Preferred employment type"
            as="select"
            defaultValue={p?.employmentPreference ?? ""}
            options={[
              { value: "full_time", label: "Full-time" },
              { value: "part_time", label: "Part-time" },
              { value: "contract", label: "Contract" },
              { value: "internship", label: "Internship" },
            ]}
            placeholder="No preference"
          />
          <Field name="preferredRoles" label="Preferred job roles" placeholder="Backend engineer, Data analyst" defaultValue={p?.preferredRoles} />
          <Field name="preferredIndustries" label="Preferred industries" placeholder="Fintech, SaaS" defaultValue={p?.preferredIndustries} className="sm:col-span-2" />
        </Card>

        <Card className="grid gap-5 p-6 sm:grid-cols-2">
          <h2 className="text-base font-bold text-fg sm:col-span-2">Skills</h2>
          <Field as="textarea" rows={3} name="skills" label="Technical skills (comma separated)" defaultValue={skills.join(", ")} placeholder="React, TypeScript, PostgreSQL, Docker" className="sm:col-span-2" hint="Up to 30 skills. These power job recommendations and match scores." />
          <Field name="softSkills" label="Soft skills" placeholder="Communication, Leadership" defaultValue={p?.softSkills} className="sm:col-span-2" />
        </Card>

        <Card className="grid gap-5 p-6 sm:grid-cols-2">
          <h2 className="text-base font-bold text-fg sm:col-span-2">Education & credentials</h2>
          <Field name="college" label="College / university" defaultValue={p?.college} />
          <Field name="degree" label="Degree & branch" placeholder="B.Tech, Computer Science" defaultValue={p?.degree} />
          <Field name="graduationYear" label="Graduation year" type="number" min={1950} max={2040} defaultValue={p?.graduationYear ?? ""} />
          <Field as="textarea" rows={3} name="certifications" label="Certifications" defaultValue={p?.certifications} placeholder="AWS Cloud Practitioner (2025)" />
          <Field as="textarea" rows={4} name="projects" label="Projects" defaultValue={p?.projects} className="sm:col-span-2" />
        </Card>

        <Card className="grid gap-5 p-6 sm:grid-cols-2">
          <h2 className="text-base font-bold text-fg sm:col-span-2">Links & visibility</h2>
          <Field name="linkedinUrl" label="LinkedIn URL" type="url" defaultValue={p?.linkedinUrl} placeholder="https://linkedin.com/in/..." />
          <Field name="githubUrl" label="GitHub URL" type="url" defaultValue={p?.githubUrl} placeholder="https://github.com/..." />
          <Field name="portfolioUrl" label="Portfolio URL" type="url" defaultValue={p?.portfolioUrl} className="sm:col-span-2" />
          <div className="grid gap-3 sm:col-span-2">
            <CheckField name="isFresher" label="I am a fresher" defaultChecked={p?.isFresher} />
            <CheckField name="openToWork" label="Open to work" hint="Shows an 'Open to work' badge in recruiter search." defaultChecked={p?.openToWork ?? true} />
            <CheckField name="profileVisible" label="Make my profile visible to recruiters" hint="When off, you won't appear in recruiter candidate search." defaultChecked={p?.profileVisible ?? true} />
          </div>
        </Card>
      </ActionForm>
    </>
  );
}
