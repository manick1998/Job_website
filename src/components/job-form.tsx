import { saveJobAction } from "@/app/actions/recruiter";
import { ActionForm, CheckField, Field } from "@/components/form";
import { INDIAN_CITIES } from "@/lib/utils";
import type { jobs } from "@/db/schema";

type JobRecord = typeof jobs.$inferSelect;

/** Shared job posting form (create + edit). Two submit buttons: save as draft or publish. */
export function JobForm({
  categories,
  job,
  requiredSkills = [],
  preferredSkills = [],
}: {
  categories: { id: number; name: string }[];
  job?: JobRecord;
  requiredSkills?: string[];
  preferredSkills?: string[];
}) {
  const btn =
    "inline-flex items-center justify-center rounded-xl px-5 py-2.5 text-sm font-semibold transition disabled:opacity-60";
  return (
    <ActionForm action={saveJobAction} hideSubmit className="space-y-8">
      {job && <input type="hidden" name="jobId" value={job.id} />}

      <fieldset className="grid gap-5 sm:grid-cols-2">
        <legend className="mb-2 text-base font-bold text-fg">Role basics</legend>
        <div className="sm:col-span-2">
          <Field name="title" label="Job title" required defaultValue={job?.title} placeholder="e.g. Senior Backend Engineer" />
        </div>
        <Field name="department" label="Department" defaultValue={job?.department} placeholder="Engineering" />
        <Field
          name="categoryId"
          label="Job category"
          as="select"
          defaultValue={job?.categoryId ?? ""}
          options={categories.map((c) => ({ value: String(c.id), label: c.name }))}
          placeholder="Select category"
        />
        <Field name="city" label="Job location (city)" required defaultValue={job?.city} hint={`For example: ${INDIAN_CITIES.slice(0, 4).join(", ")}`} />
        <Field
          name="workMode"
          label="Work mode"
          as="select"
          required
          defaultValue={job?.workMode ?? "onsite"}
          options={[
            { value: "onsite", label: "Work from office" },
            { value: "hybrid", label: "Hybrid" },
            { value: "remote", label: "Remote / WFH" },
          ]}
        />
        <Field
          name="employmentType"
          label="Employment type"
          as="select"
          required
          defaultValue={job?.employmentType ?? "full_time"}
          options={[
            { value: "full_time", label: "Full-time" },
            { value: "part_time", label: "Part-time" },
            { value: "contract", label: "Contract" },
            { value: "internship", label: "Internship" },
          ]}
        />
        <Field name="openings" label="Number of openings" type="number" min={1} max={500} defaultValue={job?.openings ?? 1} />
        <Field name="deadline" label="Application deadline" type="date" defaultValue={job?.deadline ? job.deadline.toISOString().slice(0, 10) : ""} />
      </fieldset>

      <fieldset className="grid gap-5 sm:grid-cols-2">
        <legend className="mb-2 text-base font-bold text-fg">Compensation & experience</legend>
        <Field name="minExperience" label="Minimum experience (years)" type="number" min={0} max={40} defaultValue={job?.minExperience ?? 0} />
        <Field name="maxExperience" label="Maximum experience (years)" type="number" min={0} max={40} defaultValue={job?.maxExperience ?? ""} hint="Leave empty for no upper limit." />
        <Field name="salaryMin" label="Minimum salary (₹ per year)" type="number" min={0} defaultValue={job?.salaryMin ?? ""} hint="e.g. 1200000 for ₹12 LPA" />
        <Field name="salaryMax" label="Maximum salary (₹ per year)" type="number" min={0} defaultValue={job?.salaryMax ?? ""} />
        <Field name="educationRequirement" label="Education requirement" defaultValue={job?.educationRequirement} placeholder="B.Tech / MCA / any graduate" />
        <div className="grid gap-3 self-end">
          <CheckField name="salaryHidden" label="Hide salary from candidates" defaultChecked={job?.salaryHidden} />
          <CheckField name="isFresher" label="Freshers can apply" hint="Mark roles suitable for recent graduates." defaultChecked={job?.isFresher} />
        </div>
      </fieldset>

      <fieldset className="grid gap-5">
        <legend className="mb-2 text-base font-bold text-fg">Description & requirements</legend>
        <Field as="textarea" rows={8} name="description" label="Job description" required defaultValue={job?.description} hint="At least 30 characters. Describe the team, mission and impact." />
        <Field as="textarea" rows={4} name="responsibilities" label="Responsibilities (one per line)" defaultValue={job?.responsibilities} />
        <Field name="skills" label="Required skills (comma separated)" defaultValue={requiredSkills.join(", ")} placeholder="React, TypeScript, PostgreSQL" hint="Used for candidate matching and search." />
        <Field name="preferredSkills" label="Preferred skills (comma separated)" defaultValue={preferredSkills.join(", ")} placeholder="Docker, AWS" />
        <Field as="textarea" rows={3} name="benefits" label="Benefits (one per line)" defaultValue={job?.benefits} />
        <Field as="textarea" rows={3} name="screeningQuestions" label="Screening questions (one per line, max 10)" defaultValue={(job?.screeningQuestions ?? []).join("\n")} hint="Candidates must answer these when applying." />
      </fieldset>

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line pt-6">
        <button type="submit" name="intent" value="draft" className={`${btn} border border-line bg-surface text-fg hover:bg-surface-2`}>
          Save as draft
        </button>
        <button type="submit" name="intent" value="publish" className={`${btn} brand-gradient text-white shadow-md shadow-indigo-500/20 hover:opacity-95`}>
          Publish job
        </button>
      </div>
    </ActionForm>
  );
}
