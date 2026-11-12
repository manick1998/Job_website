import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { eq, inArray } from "drizzle-orm";
import { db, pool } from "@/db";
import { UPLOAD_DIR } from "@/lib/services";
import {
  applicationEvents,
  applications,
  candidateProfiles,
  candidateSkills,
  companies,
  companyMembers,
  jobCategories,
  jobSkills,
  jobs,
  platformSettings,
  resumes,
  skills,
  subscriptionPlans,
  users,
  blogPosts,
} from "@/db/schema";
import { hashPassword } from "@/lib/password";
import { slugify } from "@/lib/utils";

const DEMO_PASSWORD = "Demo@12345";

const PLANS = [
  { code: "free", name: "Free", audience: "recruiter", priceMonthlyInr: 0, jobPostLimit: 1, seatLimit: 1, resumeSearchLimit: 0, featuredJobsPerMonth: 0, description: "Try SetuJobs with one live job.", sortOrder: 1 },
  { code: "starter", name: "Starter", audience: "recruiter", priceMonthlyInr: 2999, jobPostLimit: 5, seatLimit: 2, resumeSearchLimit: 200, featuredJobsPerMonth: 1, description: "For growing teams hiring every month.", sortOrder: 2 },
  { code: "professional", name: "Professional", audience: "recruiter", priceMonthlyInr: 9999, jobPostLimit: 20, seatLimit: 6, resumeSearchLimit: 1000, featuredJobsPerMonth: 5, description: "ATS, analytics and featured listings.", sortOrder: 3 },
  { code: "enterprise", name: "Enterprise", audience: "recruiter", priceMonthlyInr: 24999, jobPostLimit: 100, seatLimit: 25, resumeSearchLimit: 10000, featuredJobsPerMonth: 20, description: "Unlimited hiring with priority support.", sortOrder: 4 },
  { code: "candidate_pro", name: "Candidate Pro", audience: "candidate", priceMonthlyInr: 199, jobPostLimit: 0, seatLimit: 0, resumeSearchLimit: 0, featuredJobsPerMonth: 0, description: "Featured profile and resume review (payments pending).", sortOrder: 5 },
];

const CATEGORIES = [
  ["Information Technology", "information-technology", "Software, data, cloud and product engineering"],
  ["Banking & Finance", "banking-finance", "Banking, NBFC, insurance and financial analysis"],
  ["Sales & Marketing", "sales-marketing", "Sales, business development, digital marketing"],
  ["Healthcare", "healthcare", "Clinical, pharma and hospital administration"],
  ["Customer Support", "customer-support", "Voice, chat and back-office support"],
  ["Operations & Logistics", "operations-logistics", "Supply chain, warehousing and operations"],
  ["Education & Training", "education-training", "Teaching, content and EdTech"],
  ["Design & Creative", "design-creative", "UI/UX, graphic and content design"],
  ["Human Resources", "human-resources", "Talent acquisition and HR operations"],
  ["Retail", "retail", "Store operations, merchandising and retail management"],
];

const SKILLS = [
  "JavaScript", "TypeScript", "React", "Node.js", "Python", "Java", "SQL", "PostgreSQL", "AWS", "Docker",
  "Kubernetes", "Data Analysis", "Machine Learning", "Excel", "Digital Marketing", "SEO", "Figma", "Communication",
  "Sales", "Customer Support", "Accounting", "Tally", "Recruitment", "Go", "Flutter", "Power BI", "Project Management",
];

type SeedCompany = { name: string; industry: string; size: string; location: string; website: string; verified: boolean; description: string; benefits: string };
const COMPANIES: SeedCompany[] = [
  { name: "Nimbus Technologies", industry: "Information Technology", size: "501-1000", location: "Bengaluru", website: "https://nimbus-tech.example.in", verified: true, description: "Nimbus builds cloud-native platforms for Indian enterprises, with a focus on developer tooling and observability.", benefits: "Hybrid work\nHealth insurance for family\nLearning budget ₹50,000/yr\nESOPs for senior roles" },
  { name: "Bharat Fintech Labs", industry: "Fintech", size: "201-500", location: "Mumbai", website: "https://bharatfintech.example.in", verified: true, description: "Payments and lending infrastructure for small businesses across Tier-2 and Tier-3 cities.", benefits: "Remote-friendly\nAnnual health checkup\nPerformance bonus" },
  { name: "GreenLeaf Retail", industry: "E-commerce & Retail", size: "1001-5000", location: "Delhi NCR", website: "https://greenleaf.example.in", verified: true, description: "Omnichannel grocery and home-goods retailer with 400+ stores across North India.", benefits: "Employee discounts\nMeal allowance\nCareer growth paths" },
  { name: "Aarohi Health", industry: "Healthcare", size: "201-500", location: "Hyderabad", website: "https://aarohihealth.example.in", verified: true, description: "Digital-first hospital network connecting patients with specialists through telehealth.", benefits: "Medical insurance\nFlexible shifts\nTraining certifications" },
  { name: "Kaveri Logistics", industry: "Logistics & Supply Chain", size: "1001-5000", location: "Chennai", website: "https://kaveri-logistics.example.in", verified: true, description: "Last-mile and warehousing solutions powering e-commerce deliveries across South India.", benefits: "Transport allowance\nPF & gratuity\nIncentive programs" },
  { name: "Sunrise EdTech", industry: "Education & EdTech", size: "51-200", location: "Gurugram", website: "https://sunriseedtech.example.in", verified: false, description: "Vernacular learning platform for competitive exams and skill certifications.", benefits: "Remote work\nLearning stipend" },
];

type SeedJob = {
  company: number; title: string; category: string; city: string; workMode: "onsite" | "hybrid" | "remote";
  employmentType: "full_time" | "part_time" | "contract" | "internship"; min: number; max: number | null;
  salaryMin: number | null; salaryMax: number | null; req: string[]; pref: string[]; fresher?: boolean; featured?: boolean;
  description: string; responsibilities: string; questions?: string[]; walkin?: boolean; status?: "published" | "pending_review"; daysValid?: number;
};

const JOBS: SeedJob[] = [
  { company: 0, title: "Senior React Engineer", category: "information-technology", city: "Bengaluru", workMode: "hybrid", employmentType: "full_time", min: 4, max: 7, salaryMin: 2200000, salaryMax: 3000000, req: ["React", "TypeScript", "Node.js", "PostgreSQL"], pref: ["AWS", "Docker"], featured: true, description: "Own the customer dashboard that thousands of engineering teams use daily. You will lead architecture for the React design system, mentor engineers and partner with product on performance and accessibility.", responsibilities: "Design and build complex React features end-to-end\nDrive frontend architecture and code quality\nMentor 2–3 engineers\nImprove Core Web Vitals and accessibility", questions: ["How many years of React experience do you have?", "Share a link to a project you are proud of."] },
  { company: 0, title: "Backend Engineer (Node.js)", category: "information-technology", city: "Bengaluru", workMode: "remote", employmentType: "full_time", min: 2, max: 5, salaryMin: 1400000, salaryMax: 2200000, req: ["Node.js", "PostgreSQL", "SQL"], pref: ["Docker", "Kubernetes"], description: "Build reliable APIs and event pipelines that power real-time analytics for enterprise customers. Strong ownership of database design and observability is expected.", responsibilities: "Design REST and event-driven APIs\nOptimise PostgreSQL queries\nWrite tests and operate services in production" },
  { company: 0, title: "Data Analyst – Fresher", category: "information-technology", city: "Pune", workMode: "onsite", employmentType: "full_time", min: 0, max: 0, salaryMin: 500000, salaryMax: 700000, req: ["SQL", "Excel", "Power BI"], pref: ["Python", "Data Analysis"], fresher: true, description: "Turn product and usage data into dashboards and insights for leadership. Ideal for graduates with strong SQL fundamentals and curiosity about business problems.", responsibilities: "Build weekly reports in Power BI\nWrite SQL to answer ad-hoc questions\nPresent findings to stakeholders", questions: ["Which SQL joins have you used in projects?"], walkin: false },
  { company: 1, title: "Full Stack Developer", category: "information-technology", city: "Mumbai", workMode: "hybrid", employmentType: "full_time", min: 3, max: 6, salaryMin: 1800000, salaryMax: 2600000, req: ["JavaScript", "React", "Node.js", "SQL"], pref: ["AWS"], featured: true, description: "Ship lending and payments features used by 80,000 merchants. You will work closely with risk and compliance teams in a fast-moving fintech environment.", responsibilities: "Own features across frontend and API\nWrite secure, PCI-aware code\nCollaborate with product on experiments" },
  { company: 1, title: "Risk Analyst", category: "banking-finance", city: "Mumbai", workMode: "onsite", employmentType: "full_time", min: 1, max: 3, salaryMin: 900000, salaryMax: 1300000, req: ["Data Analysis", "SQL", "Excel"], pref: ["Python"], description: "Build credit-risk models and monitoring dashboards that keep our lending book healthy. Strong analytical reasoning and attention to detail are key.", responsibilities: "Monitor portfolio performance\nBuild scorecards and reports\nCoordinate with credit operations" },
  { company: 1, title: "Customer Success Associate", category: "customer-support", city: "Hyderabad", workMode: "onsite", employmentType: "full_time", min: 0, max: 2, salaryMin: 360000, salaryMax: 480000, req: ["Communication", "Customer Support"], pref: ["Excel"], fresher: true, description: "Help merchants onboard and resolve payment questions quickly. A great entry point into fintech operations with clear growth paths.", responsibilities: "Respond to merchant tickets within SLA\nGuide onboarding calls\nLog product feedback" },
  { company: 2, title: "Store Operations Manager", category: "retail", city: "Delhi NCR", workMode: "onsite", employmentType: "full_time", min: 3, max: 8, salaryMin: 700000, salaryMax: 1000000, req: ["Project Management", "Communication"], pref: ["Excel"], description: "Lead daily operations for a cluster of 8 stores, improving inventory accuracy, staffing and customer experience.", responsibilities: "Manage store P&L and KPIs\nLead store managers and staff\nDrive audit compliance" },
  { company: 2, title: "Digital Marketing Executive", category: "sales-marketing", city: "Gurugram", workMode: "hybrid", employmentType: "full_time", min: 1, max: 3, salaryMin: 480000, salaryMax: 720000, req: ["Digital Marketing", "SEO"], pref: ["Excel", "Figma"], description: "Plan and run performance campaigns across Meta, Google and email. Deep understanding of conversion funnels is essential.", responsibilities: "Run paid and organic campaigns\nReport on ROAS and CAC\nWork with creative team on assets" },
  { company: 2, title: "Walk-in Drive: Sales Associates", category: "sales-marketing", city: "Delhi NCR", workMode: "onsite", employmentType: "full_time", min: 0, max: 2, salaryMin: 300000, salaryMax: 420000, req: ["Sales", "Communication"], pref: [], fresher: true, walkin: true, description: "Walk-in interview drive for store sales associates. Bring your updated resume and a government ID. Freshers and experienced candidates are welcome.", responsibilities: "Assist customers on the shop floor\nMeet daily sales targets" },
  { company: 3, title: "Telehealth Product Designer", category: "design-creative", city: "Hyderabad", workMode: "remote", employmentType: "full_time", min: 2, max: 5, salaryMin: 1200000, salaryMax: 1800000, req: ["Figma", "Communication"], pref: ["React"], description: "Design patient and clinician experiences for our telehealth app. Accessibility and simplicity are core to every flow we ship.", responsibilities: "Own end-to-end design for clinician workflows\nRun usability tests\nWork with engineers on design systems" },
  { company: 3, title: "Hospital Operations Coordinator", category: "healthcare", city: "Hyderabad", workMode: "onsite", employmentType: "full_time", min: 1, max: 4, salaryMin: 420000, salaryMax: 600000, req: ["Communication", "Project Management"], pref: ["Excel"], description: "Coordinate appointments, insurance pre-authorisations and patient follow-ups across our hospital network.", responsibilities: "Manage daily OPD schedules\nCoordinate with insurers\nTrack patient feedback" },
  { company: 3, title: "Clinical Data Analyst (Part-time)", category: "healthcare", city: "Hyderabad", workMode: "remote", employmentType: "part_time", min: 1, max: 3, salaryMin: 300000, salaryMax: 500000, req: ["SQL", "Data Analysis"], pref: ["Power BI"], description: "Part-time role analysing de-identified clinical operations data to improve turnaround times.", responsibilities: "Build weekly ops dashboards\nClean and validate data" },
  { company: 4, title: "Warehouse Operations Lead", category: "operations-logistics", city: "Chennai", workMode: "onsite", employmentType: "full_time", min: 3, max: 7, salaryMin: 600000, salaryMax: 900000, req: ["Project Management", "Excel"], pref: ["Communication"], description: "Lead a 300-person warehouse with a focus on throughput, safety and cost efficiency during peak seasons.", responsibilities: "Plan shifts and inbound/outbound flows\nDrive safety audits\nReport on SLA performance" },
  { company: 4, title: "Logistics Support Executive", category: "customer-support", city: "Chennai", workMode: "onsite", employmentType: "contract", min: 0, max: 1, salaryMin: 240000, salaryMax: 320000, req: ["Customer Support", "Excel"], pref: [], fresher: true, description: "Support customers with shipment tracking and delivery exceptions on a 6-month contract with possible conversion.", responsibilities: "Resolve shipment queries\nUpdate tracking records" },
  { company: 4, title: "Supply Chain Intern", category: "operations-logistics", city: "Chennai", workMode: "onsite", employmentType: "internship", min: 0, max: 0, salaryMin: 25000, salaryMax: 30000, req: ["Excel"], pref: ["Power BI"], fresher: true, description: "3-month internship supporting demand planning and route optimisation analysis. Stipend ₹25,000–30,000 per month.", responsibilities: "Maintain demand forecasts\nAssist with route planning" },
  { company: 5, title: "Content Developer – Exam Prep", category: "education-training", city: "Gurugram", workMode: "remote", employmentType: "full_time", min: 1, max: 4, salaryMin: 400000, salaryMax: 650000, req: ["Communication"], pref: ["Digital Marketing"], description: "Create high-quality exam preparation content in English and Hindi for government job aspirants.", responsibilities: "Write lesson notes and quizzes\nReview content for accuracy" },
  { company: 0, title: "Recruitment Partner", category: "human-resources", city: "Bengaluru", workMode: "hybrid", employmentType: "full_time", min: 2, max: 5, salaryMin: 700000, salaryMax: 1000000, req: ["Recruitment", "Communication"], pref: ["Excel"], description: "Own end-to-end hiring for engineering and product roles, partnering closely with hiring managers.", responsibilities: "Source and screen candidates\nRun structured interviews\nReport hiring funnel metrics" },
];

const BLOGS = [
  { title: "How to write a resume that passes ATS screening in India", slug: "ats-friendly-resume-india", category: "Resume tips", excerpt: "Keywords, formatting and section order that help recruiters find you.", body: "Most employers now use an applicant tracking system before a human reads your resume. Use standard headings like Experience, Education and Skills.\n\nMirror keywords from the job description where they honestly apply to your work. Avoid tables, text boxes and graphics that some parsers misread.\n\nQuantify impact: 'Reduced API latency by 35% across 12 services' beats 'Improved performance'." },
  { title: "Fresher's guide to walk-in interviews", slug: "fresher-walk-in-interview-guide", category: "Interviews", excerpt: "What to carry, how to prepare and how to follow up after a walk-in drive.", body: "Walk-in drives are fast. Carry three printed resumes, a government ID, passport photos if asked, and your offer letters if you have any.\n\nResearch the company in 10 minutes before you arrive and prepare a 60-second introduction about yourself.\n\nAfter the drive, send a short thank-you note to the recruiter within 24 hours." },
  { title: "Negotiating salary in India: a practical playbook", slug: "salary-negotiation-india", category: "Compensation", excerpt: "Use market data, anchor early and negotiate the full package.", body: "Start with market data for your role and city. Check the salary insights on SetuJobs for typical ranges.\n\nAnchor slightly above your target, and ask about the full compensation: variable pay, joining bonus, learning budget and notice-period waivers.\n\nAlways get the final offer in writing before you resign from your current role." },
];

async function main() {
  console.info("Seeding SetuJobs database…");
  const passwordHash = await hashPassword(DEMO_PASSWORD);

  await db.insert(subscriptionPlans).values(PLANS).onConflictDoNothing();
  await db.insert(jobCategories).values(CATEGORIES.map(([name, slug, description]) => ({ name, slug, description }))).onConflictDoNothing();
  await db.insert(skills).values(SKILLS.map((name) => ({ name, slug: slugify(name) }))).onConflictDoNothing();
  await db
    .insert(platformSettings)
    .values([
      { key: "site_name", value: "SetuJobs" },
      { key: "support_email", value: "support@setujobs.in" },
      { key: "maintenance_mode", value: "off" },
    ])
    .onConflictDoNothing();

  // Demo accounts
  const [admin] = await db
    .insert(users)
    .values({ email: "admin@setujobs.in", name: "Platform Admin", role: "admin", passwordHash, emailVerifiedAt: new Date() })
    .onConflictDoUpdate({ target: users.email, set: { passwordHash, emailVerifiedAt: new Date(), role: "admin" } })
    .returning({ id: users.id });

  const [candidate] = await db
    .insert(users)
    .values({ email: "candidate@setujobs.in", name: "Aditi Verma", role: "candidate", passwordHash, emailVerifiedAt: new Date(), phone: "9876543210" })
    .onConflictDoUpdate({ target: users.email, set: { passwordHash, emailVerifiedAt: new Date() } })
    .returning({ id: users.id });

  await db
    .insert(candidateProfiles)
    .values({
      userId: candidate.id,
      headline: "Frontend engineer | React & TypeScript",
      summary: "Frontend engineer with 3 years of experience building data-heavy dashboards and design systems for B2B SaaS. Passionate about accessibility and performance.",
      currentLocation: "Bengaluru",
      preferredLocations: "Bengaluru, Pune, Remote",
      currentCompany: "Quantia Software",
      currentDesignation: "Software Engineer II",
      totalExperienceYears: 3,
      currentSalary: 1500000,
      expectedSalary: 2200000,
      noticePeriodDays: 30,
      employmentPreference: "full_time",
      preferredRoles: "Frontend engineer, Full stack developer",
      college: "BMS College of Engineering",
      degree: "B.E. Computer Science",
      graduationYear: 2022,
      linkedinUrl: "https://linkedin.com/in/aditi-verma-demo",
      githubUrl: "https://github.com/aditi-verma-demo",
      isFresher: false,
      profileVisible: true,
      openToWork: true,
    })
    .onConflictDoNothing();
  const candSkillNames = ["JavaScript", "TypeScript", "React", "Node.js", "SQL", "Figma"];
  const candSkillRows = await db.select({ id: skills.id }).from(skills).where(inArray(skills.slug, candSkillNames.map(slugify)));
  await db.delete(candidateSkills).where(eq(candidateSkills.userId, candidate.id));
  await db.insert(candidateSkills).values(candSkillRows.map((s) => ({ userId: candidate.id, skillId: s.id }))).onConflictDoNothing();

  // Write a small valid placeholder PDF so the seeded resume can be previewed and downloaded.
  const pdf = Buffer.from(
    "%PDF-1.4\n1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>endobj\ntrailer<< /Root 1 0 R >>\n%%EOF\n",
    "ascii",
  );
  await mkdir(path.join(UPLOAD_DIR, "seed"), { recursive: true });
  await writeFile(path.join(UPLOAD_DIR, "seed", "placeholder.pdf"), pdf);

  const [resume] = await db
    .insert(resumes)
    .values({ userId: candidate.id, label: "Frontend resume 2026", fileName: "aditi-verma-resume.pdf", storageKey: "seed/placeholder.pdf", mimeType: "application/pdf", sizeBytes: pdf.length, isPrimary: true })
    .onConflictDoNothing()
    .returning({ id: resumes.id });

  const [recruiter] = await db
    .insert(users)
    .values({ email: "recruiter@setujobs.in", name: "Kavya Iyer", role: "recruiter", passwordHash, emailVerifiedAt: new Date() })
    .onConflictDoUpdate({ target: users.email, set: { passwordHash, emailVerifiedAt: new Date() } })
    .returning({ id: users.id });

  const companyIds: string[] = [];
  for (const c of COMPANIES) {
    const slug = slugify(c.name);
    const [row] = await db
      .insert(companies)
      .values({
        name: c.name,
        slug,
        industry: c.industry,
        companySize: c.size,
        location: c.location,
        website: c.website,
        description: c.description,
        benefits: c.benefits,
        verificationStatus: c.verified ? "verified" : "pending",
        planCode: c.name.startsWith("Nimbus") ? "professional" : "free",
      })
      .onConflictDoUpdate({ target: companies.slug, set: { description: c.description, verificationStatus: c.verified ? "verified" : "pending" } })
      .returning({ id: companies.id });
    companyIds.push(row.id);
  }
  // Kavya owns Nimbus and is a team member at Bharat Fintech.
  await db.delete(companyMembers).where(eq(companyMembers.userId, recruiter.id));
  await db.insert(companyMembers).values({ companyId: companyIds[0], userId: recruiter.id, designation: "Head of Talent", role: "owner" }).onConflictDoNothing();
  await db.insert(companyMembers).values({ companyId: companyIds[1], userId: recruiter.id, designation: "Talent Partner", role: "recruiter" }).onConflictDoNothing();

  const categoryRows = await db.select({ id: jobCategories.id, slug: jobCategories.slug }).from(jobCategories);
  const categoryId = (slug: string) => categoryRows.find((c) => c.slug === slug)?.id ?? null;
  const skillRows = await db.select({ id: skills.id, slug: skills.slug }).from(skills);
  const skillId = (name: string) => skillRows.find((s) => s.slug === slugify(name))?.id;

  // Reset seeded jobs so re-running the seed is idempotent.
  const existingSeedJobs = await db.select({ id: jobs.id }).from(jobs).where(eq(jobs.postedById, recruiter.id));
  if (existingSeedJobs.length) await db.delete(jobs).where(inArray(jobs.id, existingSeedJobs.map((j) => j.id)));

  const now = new Date();
  let firstJobId: string | null = null;
  for (const [i, j] of JOBS.entries()) {
    const deadline = new Date(now.getTime() + (j.daysValid ?? 45) * 86400000);
    const [row] = await db
      .insert(jobs)
      .values({
        companyId: companyIds[j.company],
        postedById: recruiter.id,
        categoryId: categoryId(j.category),
        title: j.title,
        slug: `${slugify(j.title)}-${slugify(COMPANIES[j.company].name)}-${i + 1}`,
        department: "Operations",
        description: j.description,
        responsibilities: j.responsibilities,
        benefits: COMPANIES[j.company].benefits,
        educationRequirement: j.fresher ? "Any graduate" : "B.E./B.Tech or equivalent",
        minExperience: j.min,
        maxExperience: j.max,
        salaryMin: j.salaryMin,
        salaryMax: j.salaryMax,
        city: j.city,
        workMode: j.workMode,
        employmentType: j.employmentType,
        isFresher: !!j.fresher,
        openings: 2 + (i % 4),
        deadline,
        status: j.status ?? (COMPANIES[j.company].verified ? "published" : "pending_review"),
        isFeatured: !!j.featured,
        viewsCount: 20 + i * 7,
        screeningQuestions: j.questions ?? [],
        publishedAt: new Date(now.getTime() - i * 3600000 * 5),
      })
      .returning({ id: jobs.id });
    if (!firstJobId) firstJobId = row.id;
    const jsRows = [
      ...j.req.map((n) => ({ jobId: row.id, skillId: skillId(n), required: true })),
      ...j.pref.map((n) => ({ jobId: row.id, skillId: skillId(n), required: false })),
    ].filter((r): r is { jobId: string; skillId: number; required: boolean } => typeof r.skillId === "number");
    if (jsRows.length) await db.insert(jobSkills).values(jsRows).onConflictDoNothing();
  }

  // Demo application so the candidate and recruiter dashboards show real activity.
  if (firstJobId && resume) {
    const [app] = await db
      .insert(applications)
      .values({ jobId: firstJobId, candidateId: candidate.id, resumeId: resume.id, status: "shortlisted", matchScore: 82, coverLetter: "I have shipped several React dashboards and would love to bring that experience to your design system team.", answers: { "How many years of React experience do you have?": "3 years" } })
      .onConflictDoNothing()
      .returning({ id: applications.id });
    if (app) {
      await db.insert(applicationEvents).values([
        { applicationId: app.id, fromStatus: null, toStatus: "applied", actorId: candidate.id },
        { applicationId: app.id, fromStatus: "applied", toStatus: "shortlisted", actorId: recruiter.id },
      ]);
    }
  }

  // Blog content
  await db
    .insert(blogPosts)
    .values(BLOGS)
    .onConflictDoNothing();

  void admin;
  console.info("Seed complete.");
  console.info(`  Admin:     admin@setujobs.in / ${DEMO_PASSWORD}`);
  console.info(`  Candidate: candidate@setujobs.in / ${DEMO_PASSWORD}`);
  console.info(`  Recruiter: recruiter@setujobs.in / ${DEMO_PASSWORD}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
