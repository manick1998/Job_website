import { z } from "zod";

const emptyToUndef = (v: unknown) => (v === "" || v === null || v === undefined ? undefined : v);

export const optStr = (max: number) =>
  z.preprocess(emptyToUndef, z.string().trim().max(max).optional());

export const optInt = (min: number, max: number) =>
  z.preprocess(
    (v) => (emptyToUndef(v) === undefined ? undefined : Number(v)),
    z.number({ message: "Enter a number" }).int().min(min).max(max).optional(),
  );

export const reqInt = (min: number, max: number, dflt: number) =>
  z.preprocess(
    (v) => (emptyToUndef(v) === undefined ? dflt : Number(v)),
    z.number({ message: "Enter a number" }).int().min(min).max(max),
  );

export const checkbox = z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean());

const optUrl = z.preprocess(
  emptyToUndef,
  z.string().trim().url("Enter a valid URL starting with https://").max(300).optional(),
);

export const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email address").max(255);
export const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(128, "Password is too long")
  .regex(/[A-Za-z]/, "Include at least one letter")
  .regex(/[0-9]/, "Include at least one number");

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
});

export const registerCandidateSchema = z
  .object({
    name: z.string().trim().min(2, "Enter your full name").max(120),
    email: emailSchema,
    phone: z.preprocess(
      emptyToUndef,
      z
        .string()
        .trim()
        .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number")
        .optional(),
    ),
    password: passwordSchema,
    confirmPassword: z.string(),
    isFresher: checkbox,
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const registerRecruiterSchema = z
  .object({
    name: z.string().trim().min(2, "Enter your full name").max(120),
    designation: z.string().trim().min(2, "Enter your designation").max(120),
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
    companyName: z.string().trim().min(2, "Enter the company name").max(160),
    industry: z.string().trim().min(2, "Select an industry").max(120),
    companySize: z.string().trim().min(1, "Select company size").max(40),
    companyLocation: z.string().trim().min(2, "Enter company location").max(120),
    website: optUrl,
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const resetPasswordSchema = z
  .object({
    token: z.string().min(10, "Invalid reset link"),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const profileSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name").max(120),
  phone: z.preprocess(
    emptyToUndef,
    z
      .string()
      .trim()
      .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number")
      .optional(),
  ),
  headline: optStr(160),
  summary: optStr(2000),
  currentLocation: optStr(120),
  preferredLocations: optStr(300),
  currentCompany: optStr(160),
  currentDesignation: optStr(160),
  totalExperienceYears: reqInt(0, 60, 0),
  currentSalary: optInt(0, 100000000),
  expectedSalary: optInt(0, 100000000),
  noticePeriodDays: optInt(0, 365),
  employmentPreference: z.preprocess(
    emptyToUndef,
    z.enum(["full_time", "part_time", "contract", "internship"]).optional(),
  ),
  preferredIndustries: optStr(300),
  preferredRoles: optStr(300),
  skills: optStr(1000),
  softSkills: optStr(300),
  college: optStr(200),
  degree: optStr(160),
  graduationYear: optInt(1950, 2040),
  certifications: optStr(2000),
  projects: optStr(3000),
  linkedinUrl: optUrl,
  githubUrl: optUrl,
  portfolioUrl: optUrl,
  isFresher: checkbox,
  profileVisible: checkbox,
  openToWork: checkbox,
});

export const jobSchema = z
  .object({
    title: z.string().trim().min(3, "Enter a job title").max(200),
    department: optStr(120),
    categoryId: optInt(1, 100000),
    description: z.string().trim().min(30, "Description should be at least 30 characters").max(10000),
    responsibilities: optStr(5000),
    benefits: optStr(3000),
    educationRequirement: optStr(200),
    minExperience: reqInt(0, 40, 0),
    maxExperience: optInt(0, 40),
    salaryMin: optInt(0, 100000000),
    salaryMax: optInt(0, 100000000),
    salaryHidden: checkbox,
    city: z.string().trim().min(2, "Enter a city").max(120),
    workMode: z.enum(["onsite", "hybrid", "remote"]),
    employmentType: z.enum(["full_time", "part_time", "contract", "internship"]),
    isFresher: checkbox,
    openings: reqInt(1, 500, 1),
    deadline: optStr(20),
    skills: optStr(600),
    preferredSkills: optStr(600),
    screeningQuestions: optStr(2000),
    intent: z.enum(["draft", "publish"]),
  })
  .refine((d) => d.maxExperience == null || d.maxExperience >= d.minExperience, {
    message: "Max experience must be greater than or equal to min",
    path: ["maxExperience"],
  })
  .refine((d) => d.salaryMin == null || d.salaryMax == null || d.salaryMax >= d.salaryMin, {
    message: "Maximum salary must be at least the minimum",
    path: ["salaryMax"],
  });

export const companySchema = z.object({
  name: z.string().trim().min(2, "Enter the company name").max(160),
  industry: z.string().trim().min(2, "Select an industry").max(120),
  companySize: z.string().trim().min(1, "Select company size").max(40),
  location: z.string().trim().min(2, "Enter company location").max(120),
  website: optUrl,
  logoUrl: optUrl,
  description: optStr(3000),
  benefits: optStr(2000),
});

export const interviewSchema = z.object({
  applicationId: z.string().uuid(),
  scheduledAt: z.string().min(1, "Pick a date and time"),
  durationMinutes: reqInt(15, 240, 45),
  type: z.enum(["phone", "video", "onsite"]),
  meetingLink: optUrl,
  interviewerName: optStr(120),
});

export const messageSchema = z.object({
  applicationId: z.string().uuid(),
  body: z.string().trim().min(1, "Write a message").max(2000),
});

export const applicationSchema = z.object({
  jobId: z.string().uuid(),
  coverLetter: optStr(3000),
  resumeId: z.string().min(1, "Choose or upload a resume"),
});

export const alertSchema = z.object({
  keywords: z.string().trim().min(2, "Enter at least one keyword").max(200),
  location: optStr(120),
  workMode: z.preprocess(emptyToUndef, z.enum(["onsite", "hybrid", "remote"]).optional()),
});

export const blogSchema = z.object({
  title: z.string().trim().min(5, "Enter a title").max(200),
  excerpt: optStr(300),
  category: z.string().trim().min(2).max(80),
  body: z.string().trim().min(40, "Body should be at least 40 characters").max(20000),
});
