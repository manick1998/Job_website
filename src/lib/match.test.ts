import assert from "node:assert/strict";
import { test } from "node:test";
import { computeMatchScore, profileCompleteness } from "./match";
import { slugify, salaryLabel, experienceLabel } from "./utils";

test("perfect skill and experience match scores 100", () => {
  const score = computeMatchScore({
    requiredSkills: ["React", "TypeScript"],
    preferredSkills: [],
    candidateSkills: ["react", "typescript", "sql"],
    candidateExperience: 3,
    minExperience: 2,
    maxExperience: 5,
  });
  assert.equal(score, 100);
});

test("no skill overlap and under-experienced scores low", () => {
  const score = computeMatchScore({
    requiredSkills: ["Go", "Kubernetes"],
    preferredSkills: [],
    candidateSkills: ["Excel"],
    candidateExperience: 0,
    minExperience: 5,
    maxExperience: null,
  });
  assert.ok(score < 30, `expected low score, got ${score}`);
});

test("preferred skills contribute less than required skills", () => {
  const base = {
    requiredSkills: ["Python"],
    candidateSkills: ["Python"],
    candidateExperience: 1,
    minExperience: 1,
    maxExperience: 3,
  };
  const withRequiredMissing = computeMatchScore({ ...base, requiredSkills: ["Python", "Java"], preferredSkills: [] });
  const withPreferredMissing = computeMatchScore({ ...base, preferredSkills: ["Java"] });
  assert.ok(withPreferredMissing > withRequiredMissing);
});

test("profile completeness lists missing items", () => {
  const r = profileCompleteness({
    headline: "Engineer",
    skillCount: 1,
    resumeCount: 0,
    hasLinks: false,
  });
  assert.ok(r.percent > 0 && r.percent < 100);
  assert.ok(r.missing.includes("Resume uploaded"));
  assert.ok(r.missing.includes("At least 3 skills"));
});

test("slugify produces url-safe slugs", () => {
  assert.equal(slugify("Senior  React Developer (Remote)!"), "senior-react-developer-remote");
  assert.equal(slugify("***"), "item");
});

test("salary and experience labels are formatted for INR market", () => {
  assert.equal(salaryLabel(1200000, 1800000), "₹12 – 18 LPA");
  assert.equal(salaryLabel(null, null), "Not disclosed");
  assert.equal(experienceLabel(0, 0), "Fresher");
  assert.equal(experienceLabel(3, 6), "3–6 yrs");
});
