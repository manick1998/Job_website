import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { skills } from "@/db/schema";
import { slugify } from "@/lib/utils";

type Exec = Pick<typeof db, "insert" | "select">;

/** Split a comma/newline separated list into unique, trimmed values. */
export function splitList(input?: string | null, max = 30) {
  const parts = (input ?? "")
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
  return [...new Set(parts)].slice(0, max);
}

export function splitLines(input?: string | null, max = 10) {
  return (input ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, max);
}

/** Insert missing skills (dedup by slug) and return their ids. */
export async function upsertSkills(exec: Exec, names: string[]): Promise<number[]> {
  const bySlug = new Map<string, string>();
  for (const n of names) {
    const slug = slugify(n);
    if (!bySlug.has(slug)) bySlug.set(slug, n.trim().slice(0, 80));
  }
  if (bySlug.size === 0) return [];
  const slugs = [...bySlug.keys()];
  await exec
    .insert(skills)
    .values(slugs.map((slug) => ({ slug, name: bySlug.get(slug) as string })))
    .onConflictDoNothing({ target: skills.slug });
  const rows = await exec.select({ id: skills.id }).from(skills).where(inArray(skills.slug, slugs));
  return rows.map((r) => r.id);
}
