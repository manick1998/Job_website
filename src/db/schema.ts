import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

// ---------- Enums ----------
export const userRoleEnum = pgEnum("user_role", ["candidate", "recruiter", "admin"]);
export const userStatusEnum = pgEnum("user_status", ["active", "suspended"]);
export const verificationEnum = pgEnum("verification_status", ["pending", "verified", "rejected"]);
export const memberRoleEnum = pgEnum("member_role", ["owner", "recruiter"]);
export const jobStatusEnum = pgEnum("job_status", [
  "draft",
  "pending_review",
  "published",
  "paused",
  "closed",
  "rejected",
]);
export const workModeEnum = pgEnum("work_mode", ["onsite", "hybrid", "remote"]);
export const employmentTypeEnum = pgEnum("employment_type", [
  "full_time",
  "part_time",
  "contract",
  "internship",
]);
export const applicationStatusEnum = pgEnum("application_status", [
  "applied",
  "viewed",
  "shortlisted",
  "under_review",
  "interview_scheduled",
  "selected",
  "hired",
  "rejected",
  "withdrawn",
]);
export const interviewTypeEnum = pgEnum("interview_type", ["phone", "video", "onsite"]);
export const interviewStatusEnum = pgEnum("interview_status", ["scheduled", "completed", "cancelled"]);
export const reportStatusEnum = pgEnum("report_status", ["open", "resolved", "dismissed"]);

export type UserRole = (typeof userRoleEnum.enumValues)[number];
export type WorkMode = (typeof workModeEnum.enumValues)[number];
export type EmploymentType = (typeof employmentTypeEnum.enumValues)[number];
export type JobStatus = (typeof jobStatusEnum.enumValues)[number];
export type ApplicationStatus = (typeof applicationStatusEnum.enumValues)[number];

// ---------- Helpers ----------
const id = () => uuid("id").primaryKey().defaultRandom();
const timestamps = () => ({
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
const createdOnly = () => ({
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------- Identity ----------
export const users = pgTable(
  "users",
  {
    id: id(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    name: varchar("name", { length: 120 }).notNull(),
    passwordHash: text("password_hash"),
    role: userRoleEnum("role").notNull().default("candidate"),
    status: userStatusEnum("status").notNull().default("active"),
    phone: varchar("phone", { length: 20 }),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    verificationTokenHash: text("verification_token_hash"),
    verificationExpiresAt: timestamp("verification_expires_at", { withTimezone: true }),
    resetTokenHash: text("reset_token_hash"),
    resetExpiresAt: timestamp("reset_expires_at", { withTimezone: true }),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    index("users_role_idx").on(t.role),
    index("users_status_idx").on(t.status),
    index("users_created_idx").on(t.createdAt),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ...createdOnly(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

// ---------- Taxonomy ----------
export const skills = pgTable(
  "skills",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 80 }).notNull(),
    slug: varchar("slug", { length: 80 }).notNull(),
  },
  (t) => [uniqueIndex("skills_slug_uidx").on(t.slug)],
);

export const jobCategories = pgTable(
  "job_categories",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 120 }).notNull(),
    slug: varchar("slug", { length: 120 }).notNull(),
    description: text("description"),
  },
  (t) => [uniqueIndex("job_categories_slug_uidx").on(t.slug)],
);

export const subscriptionPlans = pgTable("subscription_plans", {
  code: varchar("code", { length: 40 }).primaryKey(),
  name: varchar("name", { length: 80 }).notNull(),
  audience: varchar("audience", { length: 20 }).notNull(),
  priceMonthlyInr: integer("price_monthly_inr").notNull().default(0),
  jobPostLimit: integer("job_post_limit").notNull().default(1),
  seatLimit: integer("seat_limit").notNull().default(1),
  resumeSearchLimit: integer("resume_search_limit").notNull().default(0),
  featuredJobsPerMonth: integer("featured_jobs_per_month").notNull().default(0),
  description: text("description"),
  sortOrder: integer("sort_order").notNull().default(0),
});

// ---------- Candidates ----------
export const candidateProfiles = pgTable("candidate_profiles", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  headline: varchar("headline", { length: 160 }),
  summary: text("summary"),
  currentLocation: varchar("current_location", { length: 120 }),
  preferredLocations: varchar("preferred_locations", { length: 300 }),
  currentCompany: varchar("current_company", { length: 160 }),
  currentDesignation: varchar("current_designation", { length: 160 }),
  totalExperienceYears: integer("total_experience_years").notNull().default(0),
  currentSalary: integer("current_salary"),
  expectedSalary: integer("expected_salary"),
  noticePeriodDays: integer("notice_period_days"),
  employmentPreference: employmentTypeEnum("employment_preference"),
  preferredIndustries: varchar("preferred_industries", { length: 300 }),
  preferredRoles: varchar("preferred_roles", { length: 300 }),
  softSkills: varchar("soft_skills", { length: 300 }),
  college: varchar("college", { length: 200 }),
  degree: varchar("degree", { length: 160 }),
  graduationYear: integer("graduation_year"),
  certifications: text("certifications"),
  projects: text("projects"),
  linkedinUrl: text("linkedin_url"),
  githubUrl: text("github_url"),
  portfolioUrl: text("portfolio_url"),
  isFresher: boolean("is_fresher").notNull().default(false),
  profileVisible: boolean("profile_visible").notNull().default(true),
  openToWork: boolean("open_to_work").notNull().default(true),
  ...timestamps(),
});

export const candidateSkills = pgTable(
  "candidate_skills",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    skillId: integer("skill_id")
      .notNull()
      .references(() => skills.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.skillId] })],
);

export const resumes = pgTable(
  "resumes",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    label: varchar("label", { length: 120 }).notNull(),
    fileName: varchar("file_name", { length: 255 }).notNull(),
    storageKey: text("storage_key").notNull().unique(),
    mimeType: varchar("mime_type", { length: 120 }).notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    isPrimary: boolean("is_primary").notNull().default(false),
    isVisible: boolean("is_visible").notNull().default(true),
    ...timestamps(),
  },
  (t) => [index("resumes_user_idx").on(t.userId)],
);

export const savedJobs = pgTable(
  "saved_jobs",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    ...createdOnly(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.jobId] })],
);

export const jobAlerts = pgTable(
  "job_alerts",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    keywords: varchar("keywords", { length: 200 }).notNull(),
    location: varchar("location", { length: 120 }),
    workMode: workModeEnum("work_mode"),
    isActive: boolean("is_active").notNull().default(true),
    ...createdOnly(),
  },
  (t) => [index("job_alerts_user_idx").on(t.userId)],
);

// ---------- Companies ----------
export const companies = pgTable(
  "companies",
  {
    id: id(),
    name: varchar("name", { length: 160 }).notNull(),
    slug: varchar("slug", { length: 180 }).notNull(),
    industry: varchar("industry", { length: 120 }),
    companySize: varchar("company_size", { length: 40 }),
    location: varchar("location", { length: 120 }),
    website: text("website"),
    description: text("description"),
    benefits: text("benefits"),
    logoUrl: text("logo_url"),
    verificationStatus: verificationEnum("verification_status").notNull().default("pending"),
    suspended: boolean("suspended").notNull().default(false),
    planCode: varchar("plan_code", { length: 40 })
      .notNull()
      .default("free")
      .references(() => subscriptionPlans.code),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("companies_slug_uidx").on(t.slug),
    index("companies_verification_idx").on(t.verificationStatus),
    index("companies_industry_idx").on(t.industry),
  ],
);

export const companyMembers = pgTable(
  "company_members",
  {
    id: id(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    designation: varchar("designation", { length: 120 }),
    role: memberRoleEnum("role").notNull().default("recruiter"),
    ...createdOnly(),
  },
  (t) => [uniqueIndex("company_members_uidx").on(t.companyId, t.userId), index("company_members_user_idx").on(t.userId)],
);

export const followedCompanies = pgTable(
  "followed_companies",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    ...createdOnly(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.companyId] })],
);

// ---------- Jobs ----------
export const jobs = pgTable(
  "jobs",
  {
    id: id(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    postedById: uuid("posted_by_id").references(() => users.id, { onDelete: "set null" }),
    categoryId: integer("category_id").references(() => jobCategories.id, { onDelete: "set null" }),
    title: varchar("title", { length: 200 }).notNull(),
    slug: varchar("slug", { length: 260 }).notNull(),
    department: varchar("department", { length: 120 }),
    description: text("description").notNull(),
    responsibilities: text("responsibilities"),
    benefits: text("benefits"),
    educationRequirement: varchar("education_requirement", { length: 200 }),
    minExperience: integer("min_experience").notNull().default(0),
    maxExperience: integer("max_experience"),
    salaryMin: integer("salary_min"),
    salaryMax: integer("salary_max"),
    salaryHidden: boolean("salary_hidden").notNull().default(false),
    city: varchar("city", { length: 120 }).notNull(),
    workMode: workModeEnum("work_mode").notNull().default("onsite"),
    employmentType: employmentTypeEnum("employment_type").notNull().default("full_time"),
    isFresher: boolean("is_fresher").notNull().default(false),
    openings: integer("openings").notNull().default(1),
    deadline: timestamp("deadline", { withTimezone: true }),
    status: jobStatusEnum("status").notNull().default("draft"),
    rejectionReason: text("rejection_reason"),
    isFeatured: boolean("is_featured").notNull().default(false),
    viewsCount: integer("views_count").notNull().default(0),
    screeningQuestions: jsonb("screening_questions")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("jobs_slug_uidx").on(t.slug),
    index("jobs_status_idx").on(t.status),
    index("jobs_company_idx").on(t.companyId),
    index("jobs_category_idx").on(t.categoryId),
    index("jobs_city_idx").on(t.city),
    index("jobs_published_idx").on(t.publishedAt),
  ],
);

export const jobSkills = pgTable(
  "job_skills",
  {
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    skillId: integer("skill_id")
      .notNull()
      .references(() => skills.id, { onDelete: "cascade" }),
    required: boolean("required").notNull().default(true),
  },
  (t) => [primaryKey({ columns: [t.jobId, t.skillId] }), index("job_skills_skill_idx").on(t.skillId)],
);

// ---------- Applications / ATS ----------
export const applications = pgTable(
  "applications",
  {
    id: id(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    candidateId: uuid("candidate_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    resumeId: uuid("resume_id").references(() => resumes.id, { onDelete: "set null" }),
    coverLetter: text("cover_letter"),
    answers: jsonb("answers")
      .$type<Record<string, string>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    status: applicationStatusEnum("status").notNull().default("applied"),
    rating: integer("rating"),
    matchScore: integer("match_score"),
    statusUpdatedAt: timestamp("status_updated_at", { withTimezone: true }).notNull().defaultNow(),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("applications_job_candidate_uidx").on(t.jobId, t.candidateId),
    index("applications_status_idx").on(t.status),
    index("applications_candidate_idx").on(t.candidateId),
  ],
);

export const applicationEvents = pgTable(
  "application_events",
  {
    id: id(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    fromStatus: varchar("from_status", { length: 40 }),
    toStatus: varchar("to_status", { length: 40 }).notNull(),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    note: text("note"),
    ...createdOnly(),
  },
  (t) => [index("application_events_app_idx").on(t.applicationId)],
);

export const candidateNotes = pgTable(
  "candidate_notes",
  {
    id: id(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
    body: text("body").notNull(),
    ...createdOnly(),
  },
  (t) => [index("candidate_notes_app_idx").on(t.applicationId)],
);

export const interviews = pgTable(
  "interviews",
  {
    id: id(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    scheduledById: uuid("scheduled_by_id").references(() => users.id, { onDelete: "set null" }),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
    durationMinutes: integer("duration_minutes").notNull().default(45),
    type: interviewTypeEnum("type").notNull().default("video"),
    meetingLink: text("meeting_link"),
    interviewerName: varchar("interviewer_name", { length: 120 }),
    status: interviewStatusEnum("status").notNull().default("scheduled"),
    feedback: text("feedback"),
    feedbackRating: integer("feedback_rating"),
    ...timestamps(),
  },
  (t) => [index("interviews_scheduled_idx").on(t.scheduledAt), index("interviews_app_idx").on(t.applicationId)],
);

// ---------- Communication ----------
export const notifications = pgTable(
  "notifications",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 40 }).notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    body: text("body"),
    link: text("link"),
    readAt: timestamp("read_at", { withTimezone: true }),
    ...createdOnly(),
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.readAt)],
);

export const messages = pgTable(
  "messages",
  {
    id: id(),
    senderId: uuid("sender_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    recipientId: uuid("recipient_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    applicationId: uuid("application_id").references(() => applications.id, { onDelete: "set null" }),
    body: text("body").notNull(),
    readAt: timestamp("read_at", { withTimezone: true }),
    ...createdOnly(),
  },
  (t) => [index("messages_recipient_idx").on(t.recipientId)],
);

export const newsletterSubscribers = pgTable("newsletter_subscribers", {
  id: id(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  ...createdOnly(),
});

// ---------- Moderation / content / platform ----------
export const reports = pgTable(
  "reports",
  {
    id: id(),
    reporterId: uuid("reporter_id").references(() => users.id, { onDelete: "set null" }),
    jobId: uuid("job_id").references(() => jobs.id, { onDelete: "cascade" }),
    companyId: uuid("company_id").references(() => companies.id, { onDelete: "cascade" }),
    reason: varchar("reason", { length: 120 }).notNull(),
    details: text("details"),
    status: reportStatusEnum("status").notNull().default("open"),
    resolutionNote: text("resolution_note"),
    resolvedById: uuid("resolved_by_id").references(() => users.id, { onDelete: "set null" }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    ...createdOnly(),
  },
  (t) => [index("reports_status_idx").on(t.status)],
);

export const blogPosts = pgTable(
  "blog_posts",
  {
    id: id(),
    title: varchar("title", { length: 200 }).notNull(),
    slug: varchar("slug", { length: 220 }).notNull(),
    excerpt: text("excerpt"),
    body: text("body").notNull(),
    category: varchar("category", { length: 80 }).notNull().default("Career advice"),
    published: boolean("published").notNull().default(true),
    authorName: varchar("author_name", { length: 120 }).notNull().default("SetuJobs Editorial"),
    ...timestamps(),
  },
  (t) => [uniqueIndex("blog_posts_slug_uidx").on(t.slug)],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: id(),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    action: varchar("action", { length: 80 }).notNull(),
    entityType: varchar("entity_type", { length: 60 }).notNull(),
    entityId: text("entity_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    ...createdOnly(),
  },
  (t) => [index("audit_logs_created_idx").on(t.createdAt)],
);

export const emailLog = pgTable(
  "email_log",
  {
    id: id(),
    toEmail: varchar("to_email", { length: 255 }).notNull(),
    subject: varchar("subject", { length: 255 }).notNull(),
    body: text("body").notNull(),
    kind: varchar("kind", { length: 40 }).notNull(),
    ...createdOnly(),
  },
  (t) => [index("email_log_created_idx").on(t.createdAt)],
);

export const platformSettings = pgTable("platform_settings", {
  key: varchar("key", { length: 80 }).primaryKey(),
  value: text("value").notNull(),
  ...timestamps(),
});
