/**
 * Transparent, explainable matching. No protected characteristics are used.
 * Score = 75% skill overlap (required skills weighted 1, preferred 0.5)
 *       + 25% experience fit. Recruiters always see the breakdown and decide.
 */
export function computeMatchScore(input: {
  requiredSkills: string[];
  preferredSkills: string[];
  candidateSkills: string[];
  candidateExperience: number;
  minExperience: number;
  maxExperience: number | null;
}) {
  const norm = (s: string) => s.trim().toLowerCase();
  const have = new Set(input.candidateSkills.map(norm));
  const required = input.requiredSkills.map(norm);
  const preferred = input.preferredSkills.map(norm);

  const total = required.length + preferred.length * 0.5;
  let matched = 0;
  for (const s of required) if (have.has(s)) matched += 1;
  for (const s of preferred) if (have.has(s)) matched += 0.5;
  const skillScore = total === 0 ? 60 : (matched / total) * 100;

  const exp = input.candidateExperience;
  let expScore: number;
  if (exp < input.minExperience) {
    expScore = Math.max(0, 100 - (input.minExperience - exp) * 25);
  } else if (input.maxExperience != null && exp > input.maxExperience + 2) {
    expScore = 80;
  } else {
    expScore = 100;
  }

  return Math.round(0.75 * skillScore + 0.25 * expScore);
}

export function profileCompleteness(input: {
  headline?: string | null;
  summary?: string | null;
  currentLocation?: string | null;
  currentDesignation?: string | null;
  college?: string | null;
  skillCount: number;
  resumeCount: number;
  hasLinks: boolean;
  expectedSalary?: number | null;
  noticePeriodDays?: number | null;
}) {
  const checks: [string, boolean][] = [
    ["Headline", !!input.headline],
    ["Summary", !!input.summary],
    ["Current location", !!input.currentLocation],
    ["Designation", !!input.currentDesignation],
    ["Education", !!input.college],
    ["At least 3 skills", input.skillCount >= 3],
    ["Resume uploaded", input.resumeCount > 0],
    ["LinkedIn / GitHub / Portfolio", input.hasLinks],
    ["Expected salary", input.expectedSalary != null],
    ["Notice period", input.noticePeriodDays != null],
  ];
  const done = checks.filter((c) => c[1]).length;
  return {
    percent: Math.round((done / checks.length) * 100),
    missing: checks.filter((c) => !c[1]).map((c) => c[0]),
  };
}
