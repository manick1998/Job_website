import Link from "next/link";
import type { ReactNode } from "react";
import { Briefcase, Building2, Clock, IndianRupee, MapPin, Sparkles, Wifi } from "lucide-react";
import type { JobListItem } from "@/lib/queries/jobs";
import {
  APPLICATION_STATUS_LABEL,
  EMPLOYMENT_LABEL,
  JOB_STATUS_LABEL,
  WORK_MODE_LABEL,
  experienceLabel,
  salaryLabel,
  timeAgo,
} from "@/lib/utils";

export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export function buttonClass(variant: "primary" | "secondary" | "ghost" | "danger" = "primary", size: "sm" | "md" = "md") {
  const sizes = size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2.5 text-sm";
  const variants = {
    primary: "brand-gradient text-white shadow-md shadow-indigo-500/20 hover:opacity-95",
    secondary: "border border-line bg-surface text-fg hover:bg-surface-2",
    ghost: "text-brand hover:bg-surface-2",
    danger: "bg-red-600 text-white hover:bg-red-700",
  };
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
    sizes,
    variants[variant],
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-2xl border border-line bg-surface shadow-sm shadow-slate-900/5", className)}>
      {children}
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-fg sm:text-3xl">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Badge({
  children,
  tone = "slate",
}: {
  children: ReactNode;
  tone?: "slate" | "brand" | "green" | "amber" | "red" | "sky";
}) {
  const tones = {
    slate: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
    brand: "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",
    green: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    amber: "bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
    red: "bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300",
    sky: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  };
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", tones[tone])}>
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const label = APPLICATION_STATUS_LABEL[status] ?? JOB_STATUS_LABEL[status] ?? status;
  const tone =
    status === "hired" || status === "selected" || status === "published"
      ? "green"
      : status === "rejected" || status === "closed"
        ? "red"
        : status === "shortlisted" || status === "interview_scheduled" || status === "pending_review"
          ? "amber"
          : status === "withdrawn" || status === "draft"
            ? "slate"
            : "brand";
  return <Badge tone={tone}>{label}</Badge>;
}

export function Notice({ tone = "info", children }: { tone?: "info" | "success" | "error" | "warning"; children: ReactNode }) {
  const tones = {
    info: "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200",
    error: "border-red-200 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200",
    warning: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200",
  };
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cn("rounded-xl border px-4 py-3 text-sm", tones[tone])}>
      {children}
    </div>
  );
}

export function EmptyState({
  title,
  text,
  action,
  icon,
}: {
  title: string;
  text?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-surface px-6 py-12 text-center">
      <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-surface-2 text-brand">
        {icon ?? <Sparkles className="h-6 w-6" />}
      </div>
      <h3 className="text-base font-semibold text-fg">{title}</h3>
      {text && <p className="mt-1 max-w-md text-sm text-muted">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <Card className="p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-2 text-3xl font-bold tracking-tight text-fg">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </Card>
  );
}

export function BarChart({ data, unit = "" }: { data: { label: string; value: number }[]; unit?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex h-48 items-end gap-2">
      {data.map((d) => (
        <div key={d.label} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
          <span className="text-xs font-medium text-fg">
            {d.value}
            {unit}
          </span>
          <div
            className="w-full min-h-[4px] rounded-t-lg brand-gradient transition-all"
            style={{ height: `${Math.max(3, (d.value / max) * 100)}%` }}
            title={`${d.label}: ${d.value}`}
          />
          <span className="truncate text-[11px] text-muted">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

export function Pagination({
  basePath,
  params,
  page,
  pages,
}: {
  basePath: string;
  params: Record<string, string | undefined>;
  page: number;
  pages: number;
}) {
  if (pages <= 1) return null;
  const href = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
    if (p > 1) sp.set("page", String(p));
    const qs = sp.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };
  return (
    <nav aria-label="Pagination" className="mt-8 flex items-center justify-center gap-2">
      {page > 1 && (
        <Link href={href(page - 1)} className={buttonClass("secondary", "sm")}>
          ← Prev
        </Link>
      )}
      <span className="px-3 text-sm text-muted">
        Page {page} of {pages}
      </span>
      {page < pages && (
        <Link href={href(page + 1)} className={buttonClass("secondary", "sm")}>
          Next →
        </Link>
      )}
    </nav>
  );
}

export function JobCard({ item, highlight = false }: { item: JobListItem; highlight?: boolean }) {
  const { job, company } = item;
  return (
    <Link
      href={`/jobs/${job.slug}`}
      className={cn(
        "group block rounded-2xl border bg-surface p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-indigo-500/10",
        highlight ? "border-brand/40 ring-1 ring-brand/20" : "border-line",
      )}
    >
      <div className="flex items-start gap-4">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-surface-2 text-brand">
          <Building2 className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-base font-semibold text-fg group-hover:text-brand">{job.title}</h3>
            {job.isFeatured && <Badge tone="amber">Featured</Badge>}
          </div>
          <p className="truncate text-sm text-muted">
            {company.name}
            {company.verificationStatus === "verified" && <span className="ml-1 text-emerald-600">✔ Verified</span>}
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted">
        <span className="inline-flex items-center gap-1">
          <MapPin className="h-3.5 w-3.5" />
          {job.city}
        </span>
        <span className="inline-flex items-center gap-1">
          <Briefcase className="h-3.5 w-3.5" />
          {experienceLabel(job.minExperience, job.maxExperience)}
        </span>
        <span className="inline-flex items-center gap-1">
          <IndianRupee className="h-3.5 w-3.5" />
          {salaryLabel(job.salaryMin, job.salaryMax, job.salaryHidden)}
        </span>
        <span className="inline-flex items-center gap-1">
          <Wifi className="h-3.5 w-3.5" />
          {WORK_MODE_LABEL[job.workMode]}
        </span>
      </div>
      {item.skills.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {item.skills.slice(0, 5).map((s) => (
            <Badge key={s.name} tone="brand">
              {s.name}
            </Badge>
          ))}
        </div>
      )}
      <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-xs text-muted">
        <span>{EMPLOYMENT_LABEL[job.employmentType]}</span>
        <span className="inline-flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" />
          {timeAgo(job.publishedAt ?? job.createdAt)}
        </span>
      </div>
    </Link>
  );
}
