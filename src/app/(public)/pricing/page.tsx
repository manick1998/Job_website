import Link from "next/link";
import { Check } from "lucide-react";
import { Badge, Card, Notice, buttonClass, cn } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { getRecruiterCompany, getCompanyPlan } from "@/lib/queries/dashboards";
import { getPlans } from "@/lib/queries/jobs";
import { formatINR } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata = { title: "Pricing", description: "Recruiter subscription plans for job posting, resume database access and analytics." };

export default async function PricingPage() {
  const [plans, user] = await Promise.all([getPlans(), getCurrentUser()]);
  const ctx = user?.role === "recruiter" ? await getRecruiterCompany(user.id) : null;
  const current = ctx ? await getCompanyPlan(ctx.company.planCode) : null;
  const recruiterPlans = plans.filter((p) => p.audience === "recruiter");

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-brand">Pricing</p>
        <h1 className="mt-2 text-4xl font-extrabold tracking-tight text-fg">Plans for every hiring team</h1>
        <p className="mt-3 text-muted">Start free. Upgrade when you need more active jobs, recruiter seats and resume database access. Prices in INR, excluding GST.</p>
      </div>

      <div className="mt-8">
        <Notice tone="warning">
          Online checkout is not yet enabled on this deployment. Razorpay credentials (<code>RAZORPAY_KEY_ID</code>, <code>RAZORPAY_KEY_SECRET</code>, <code>RAZORPAY_WEBHOOK_SECRET</code>) are required. Until then, plan changes are made by the SetuJobs team.
        </Notice>
      </div>

      <div className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {recruiterPlans.map((p) => {
          const featured = p.code === "professional";
          const isCurrent = current?.code === p.code;
          const features = [
            `${p.jobPostLimit} active job${p.jobPostLimit === 1 ? "" : "s"}`,
            `${p.seatLimit} recruiter seat${p.seatLimit === 1 ? "" : "s"}`,
            p.resumeSearchLimit > 0 ? `${p.resumeSearchLimit} resume database searches / month` : "Resume database: not included",
            p.featuredJobsPerMonth > 0 ? `${p.featuredJobsPerMonth} featured job listings / month` : "No featured listings",
            "Applicant tracking (ATS) pipeline",
            "Interview scheduling & notes",
          ];
          return (
            <Card key={p.code} className={cn("relative flex flex-col p-7", featured && "ring-2 ring-brand shadow-xl shadow-indigo-500/15")}>
              {featured && <Badge tone="brand">Most popular</Badge>}
              <h2 className="mt-3 text-xl font-bold text-fg">{p.name}</h2>
              <p className="mt-1 min-h-10 text-sm text-muted">{p.description}</p>
              <p className="mt-5 text-4xl font-extrabold text-fg">
                {p.priceMonthlyInr === 0 ? "Free" : formatINR(p.priceMonthlyInr)}
                {p.priceMonthlyInr > 0 && <span className="text-sm font-medium text-muted"> /month</span>}
              </p>
              <ul className="mt-6 flex-1 space-y-3 text-sm text-fg">
                {features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                {isCurrent ? (
                  <span className="block rounded-xl border border-line py-2.5 text-center text-sm font-semibold text-muted">Your current plan</span>
                ) : p.priceMonthlyInr === 0 ? (
                  <Link href={ctx ? "/recruiter" : "/register?role=recruiter"} className={`${buttonClass("secondary")} w-full`}>
                    {ctx ? "Go to dashboard" : "Start free"}
                  </Link>
                ) : (
                  <button type="button" disabled className={`${buttonClass("primary")} w-full`} title="Requires Razorpay configuration">
                    Upgrade (payments pending)
                  </button>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <section className="mt-16 rounded-3xl border border-line bg-surface p-8">
        <h2 className="text-xl font-bold text-fg">Candidate premium</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Featured profile visibility, resume review and advanced career insights are planned for the premium candidate tier. Payment processing for candidates will be enabled together with Razorpay.
        </p>
      </section>
    </div>
  );
}
