import Link from "next/link";
import { registerCandidateAction, registerRecruiterAction } from "@/app/actions/auth";
import { ActionForm, CheckField, Field } from "@/components/form";
import { Card, buttonClass, cn } from "@/components/ui";
import { COMPANY_SIZES, INDIAN_CITIES, INDUSTRIES } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata = { title: "Create account" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const recruiter = sp.role === "recruiter";

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-fg">{recruiter ? "Post jobs & hire faster" : "Create your job seeker account"}</h1>
        <p className="mt-2 text-sm text-muted">Free to join. We&apos;ll email you a verification link to activate your account.</p>
      </div>

      <div className="mb-6 grid grid-cols-2 rounded-2xl border border-line bg-surface p-1">
        <Link href="/register" className={cn("rounded-xl py-2.5 text-center text-sm font-semibold", !recruiter ? "brand-gradient text-white shadow" : "text-muted hover:text-fg")}>
          I&apos;m looking for jobs
        </Link>
        <Link href="/register?role=recruiter" className={cn("rounded-xl py-2.5 text-center text-sm font-semibold", recruiter ? "brand-gradient text-white shadow" : "text-muted hover:text-fg")}>
          I&apos;m hiring
        </Link>
      </div>

      <Card className="p-6 sm:p-8">
        {recruiter ? (
          <ActionForm action={registerRecruiterAction} submitLabel="Create recruiter account" pendingLabel="Creating account…">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field name="name" label="Your full name" required autoComplete="name" />
              <Field name="designation" label="Designation" required placeholder="Talent Acquisition Lead" />
              <Field name="email" label="Work email" type="email" required autoComplete="email" hint="Use your company domain for faster verification." />
              <Field name="password" label="Password" type="password" required autoComplete="new-password" hint="8+ characters with a letter and a number." />
              <Field name="confirmPassword" label="Confirm password" type="password" required autoComplete="new-password" />
              <Field name="companyName" label="Company name" required />
              <Field name="industry" label="Industry" as="select" required options={INDUSTRIES.map((i) => ({ value: i, label: i }))} />
              <Field name="companySize" label="Company size" as="select" required options={COMPANY_SIZES.map((s) => ({ value: s, label: `${s} employees` }))} />
              <Field name="companyLocation" label="Headquarters" as="select" required options={INDIAN_CITIES.map((c) => ({ value: c, label: c }))} />
              <Field name="website" label="Company website" type="url" placeholder="https://" />
            </div>
          </ActionForm>
        ) : (
          <ActionForm action={registerCandidateAction} submitLabel="Create account" pendingLabel="Creating account…">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field name="name" label="Full name" required autoComplete="name" />
              <Field name="phone" label="Mobile number" type="tel" placeholder="98xxxxxxxx" hint="10-digit Indian mobile (optional)." />
              <Field name="email" label="Email" type="email" required autoComplete="email" />
              <Field name="password" label="Password" type="password" required autoComplete="new-password" hint="8+ characters with a letter and a number." />
              <Field name="confirmPassword" label="Confirm password" type="password" required autoComplete="new-password" />
            </div>
            <CheckField name="isFresher" label="I am a fresher" hint="Graduated in the last 12 months or no full-time experience yet." />
          </ActionForm>
        )}
        <p className="mt-6 text-center text-sm text-muted">
          Already have an account?{" "}
          <Link href={recruiter ? "/login?as=recruiter" : "/login"} className="font-semibold text-brand hover:underline">
            Log in
          </Link>
        </p>
        <p className="mt-4 text-center text-xs text-muted">
          By continuing you agree to our terms and privacy policy. Your data is processed under the DPDP Act, 2023.
        </p>
      </Card>
      <p className="mt-6 text-center">
        <Link href="/" className={buttonClass("ghost", "sm")}>← Back to home</Link>
      </p>
    </div>
  );
}
