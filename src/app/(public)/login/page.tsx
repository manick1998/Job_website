import Link from "next/link";
import { loginAction } from "@/app/actions/auth";
import { ActionForm, Field } from "@/components/form";
import { Card, Notice } from "@/components/ui";

export const dynamic = "force-dynamic";

export const metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const recruiter = sp.as === "recruiter";
  const next = sp.next && sp.next.startsWith("/") && !sp.next.startsWith("//") ? sp.next : "";

  return (
    <div className="mx-auto grid min-h-[75vh] max-w-md place-items-center px-4 py-12">
      <Card className="w-full p-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-brand">{recruiter ? "Employer portal" : "Job seekers"}</p>
        <h1 className="mt-2 text-2xl font-bold text-fg">{recruiter ? "Recruiter login" : "Log in to SetuJobs"}</h1>
        <p className="mt-1 text-sm text-muted">
          {recruiter ? "Manage jobs, candidates and interviews." : "Track applications, save jobs and get matched alerts."}
        </p>

        <div className="mt-6 space-y-4">
          {sp.reset && <Notice tone="success">Your password has been updated. Please log in.</Notice>}
          {sp.deleted && <Notice tone="info">Your account has been deleted.</Notice>}
        </div>

        <div className="mt-6">
          <ActionForm action={loginAction} submitLabel="Log in" pendingLabel="Logging in…">
            <input type="hidden" name="next" value={next} />
            <Field name="email" label="Email" type="email" autoComplete="email" required placeholder="you@company.com" />
            <Field name="password" label="Password" type="password" autoComplete="current-password" required />
          </ActionForm>
        </div>

        <div className="mt-5 flex items-center justify-between text-sm">
          <Link href="/reset-password" className="font-medium text-brand hover:underline">Forgot password?</Link>
          <Link href={recruiter ? "/register?role=recruiter" : "/register"} className="font-medium text-brand hover:underline">Create account</Link>
        </div>
        <div className="mt-6 border-t border-line pt-5 text-center text-sm text-muted">
          {recruiter ? (
            <Link href="/login" className="hover:text-brand">Job seeker? Log in here →</Link>
          ) : (
            <Link href="/login?as=recruiter" className="hover:text-brand">Recruiter or employer? Log in here →</Link>
          )}
        </div>
      </Card>
    </div>
  );
}
