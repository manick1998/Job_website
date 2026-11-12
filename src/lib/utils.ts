export const SITE_NAME = "Manick Job Portal";
export const PAGE_SIZE = 12;
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const WORK_MODE_LABEL: Record<string, string> = {
  onsite: "Work from office",
  hybrid: "Hybrid",
  remote: "Remote / WFH",
};

export const EMPLOYMENT_LABEL: Record<string, string> = {
  full_time: "Full-time",
  part_time: "Part-time",
  contract: "Contract",
  internship: "Internship",
};

export const APPLICATION_STATUS_LABEL: Record<string, string> = {
  applied: "Applied",
  viewed: "Viewed",
  shortlisted: "Shortlisted",
  under_review: "Under review",
  interview_scheduled: "Interview scheduled",
  selected: "Selected",
  hired: "Hired",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

export const JOB_STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  pending_review: "Pending review",
  published: "Live",
  paused: "Paused",
  closed: "Closed",
  rejected: "Rejected",
};

/** Kanban pipeline: each column maps to one or more application statuses. */
export const PIPELINE_COLUMNS = [
  { key: "applied", label: "Applied", statuses: ["applied", "viewed"], moveTo: "applied" },
  { key: "screening", label: "Screening", statuses: ["under_review"], moveTo: "under_review" },
  { key: "shortlisted", label: "Shortlisted", statuses: ["shortlisted"], moveTo: "shortlisted" },
  { key: "interview", label: "Interview", statuses: ["interview_scheduled"], moveTo: "interview_scheduled" },
  { key: "selected", label: "Selected", statuses: ["selected"], moveTo: "selected" },
  { key: "hired", label: "Hired", statuses: ["hired"], moveTo: "hired" },
] as const;

export const INDIAN_CITIES = [
  "Bengaluru",
  "Mumbai",
  "Delhi NCR",
  "Hyderabad",
  "Pune",
  "Chennai",
  "Kolkata",
  "Ahmedabad",
  "Gurugram",
  "Noida",
  "Chandigarh",
  "Kochi",
  "Jaipur",
  "Indore",
];

export const INDUSTRIES = [
  "Information Technology",
  "Banking & Financial Services",
  "Fintech",
  "Healthcare",
  "E-commerce & Retail",
  "Education & EdTech",
  "Manufacturing",
  "Logistics & Supply Chain",
  "Telecom",
  "Media & Advertising",
  "Consulting",
  "Real Estate",
  "Hospitality",
  "Government & Public Sector",
  "Other",
];

export const COMPANY_SIZES = ["1-10", "11-50", "51-200", "201-500", "501-1000", "1001-5000", "5000+"];

export function slugify(input: string) {
  const s = input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return s || "item";
}

export function uniqueSuffix() {
  return Math.random().toString(36).slice(2, 8);
}

export function formatINR(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

function lpa(n: number) {
  const v = n / 100000;
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

export function salaryLabel(min?: number | null, max?: number | null, hidden?: boolean) {
  if (hidden || (!min && !max)) return "Not disclosed";
  if (min && max) return `₹${lpa(min)} – ${lpa(max)} LPA`;
  return `₹${lpa((min ?? max) as number)} LPA`;
}

export function experienceLabel(min: number, max?: number | null) {
  if (min === 0 && max === 0) return "Fresher";
  if (max == null) return `${min}+ yrs`;
  return `${min}–${max} yrs`;
}

export function timeAgo(date: Date | string | null | undefined) {
  if (!date) return "";
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(date);
}

export function formatDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" }).format(new Date(d));
}

export function formatDateTime(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(d));
}

export function toNum(x: unknown) {
  const n = Number(x ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export function escapeLike(q: string) {
  return q.replace(/[%_\\]/g, (m) => `\\${m}`);
}
