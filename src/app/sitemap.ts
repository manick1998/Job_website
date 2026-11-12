import type { MetadataRoute } from "next";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { blogPosts, companies, jobs } from "@/db/schema";
import { APP_URL } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [liveJobs, verifiedCompanies, posts] = await Promise.all([
    db.select({ slug: jobs.slug, updatedAt: jobs.updatedAt }).from(jobs).where(eq(jobs.status, "published")),
    db.select({ slug: companies.slug, updatedAt: companies.updatedAt }).from(companies).where(eq(companies.verificationStatus, "verified")),
    db.select({ slug: blogPosts.slug, updatedAt: blogPosts.updatedAt }).from(blogPosts).where(eq(blogPosts.published, true)),
  ]);

  const staticPages = ["", "/jobs", "/companies", "/career-advice", "/salary-insights", "/pricing"].map((p) => ({
    url: `${APP_URL}${p}`,
    changeFrequency: "daily" as const,
    priority: p === "" ? 1 : 0.8,
  }));

  return [
    ...staticPages,
    ...liveJobs.map((j) => ({ url: `${APP_URL}/jobs/${j.slug}`, lastModified: j.updatedAt, changeFrequency: "daily" as const, priority: 0.9 })),
    ...verifiedCompanies.map((c) => ({ url: `${APP_URL}/companies/${c.slug}`, lastModified: c.updatedAt, changeFrequency: "weekly" as const, priority: 0.6 })),
    ...posts.map((p) => ({ url: `${APP_URL}/career-advice/${p.slug}`, lastModified: p.updatedAt, changeFrequency: "monthly" as const, priority: 0.5 })),
  ];
}
