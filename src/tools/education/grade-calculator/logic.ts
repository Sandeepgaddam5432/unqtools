/**
 * Grade Calculator & GPA Projector — pure logic.
 *
 * Parse assignments (CSV-style), compute weighted scores, current grade,
 * grade needed on remaining work for a target grade, letter grade & GPA
 * conversion across multiple scales, what-if projections, render as
 * text/CSV, history (localStorage), shareable URL.
 *
 * Pure functions only — no DOM, no network.
 */

// ---- Types ----

export type GradingScale = "standard-10-point" | "plus-minus" | "pass-fail" | "custom";

export type GpaScale = "4.0" | "5.0" | "10.0" | "100-percentage";

export interface Assignment {
  name: string;
  score: number | null; // null = unattempted
  maxScore: number;
  weightPercent: number;
}

export interface AssignmentWithScore extends Assignment {
  weightedScore: number | null;
  attempted: boolean;
  percent: number | null; // score/maxScore × 100, or null
}

export interface GradeThreshold {
  minPercent: number;
  letter: string;
  gpa: number; // GPA on the 4.0 scale
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  assignmentCount: number;
  totalWeight: number;
  attemptedWeight: number;
  remainingWeight: number;
}

export interface CalculationResult {
  currentGrade: number;
  targetGrade: number;
  gradeNeeded: number | null;
  currentLetter: string;
  currentGpa: number;
  targetLetter: string;
  targetGpa: number;
  neededLetter: string;
  neededGpa: number;
  weightedScores: AssignmentWithScore[];
  totalWeight: number;
  attemptedWeight: number;
  remainingWeight: number;
  attemptedCount: number;
  remainingCount: number;
  weightSumPercent: number; // totalWeight normalized to a 100 baseline
}

export interface WhatIfScenario {
  assumedScore: number;
  projectedFinalGrade: number;
  projectedLetter: string;
  projectedGpa: number;
}

// ---- Constants / Presets ----

export const STANDARD_10_POINT: GradeThreshold[] = [
  { minPercent: 90, letter: "A", gpa: 4.0 },
  { minPercent: 80, letter: "B", gpa: 3.0 },
  { minPercent: 70, letter: "C", gpa: 2.0 },
  { minPercent: 60, letter: "D", gpa: 1.0 },
  { minPercent: 0,  letter: "F", gpa: 0.0 },
];

export const PLUS_MINUS: GradeThreshold[] = [
  { minPercent: 97, letter: "A+", gpa: 4.0 },
  { minPercent: 93, letter: "A",  gpa: 4.0 },
  { minPercent: 90, letter: "A-", gpa: 3.7 },
  { minPercent: 87, letter: "B+", gpa: 3.3 },
  { minPercent: 83, letter: "B",  gpa: 3.0 },
  { minPercent: 80, letter: "B-", gpa: 2.7 },
  { minPercent: 77, letter: "C+", gpa: 2.3 },
  { minPercent: 73, letter: "C",  gpa: 2.0 },
  { minPercent: 70, letter: "C-", gpa: 1.7 },
  { minPercent: 67, letter: "D+", gpa: 1.3 },
  { minPercent: 63, letter: "D",  gpa: 1.0 },
  { minPercent: 60, letter: "D-", gpa: 0.7 },
  { minPercent: 0,  letter: "F",  gpa: 0.0 },
];

export const PASS_FAIL: GradeThreshold[] = [
  { minPercent: 60, letter: "P", gpa: 2.0 },
  { minPercent: 0,  letter: "F", gpa: 0.0 },
];

export const GPA_5_0_THRESHOLDS: GradeThreshold[] = [
  { minPercent: 90, letter: "A", gpa: 5.0 },
  { minPercent: 80, letter: "B", gpa: 4.0 },
  { minPercent: 70, letter: "C", gpa: 3.0 },
  { minPercent: 60, letter: "D", gpa: 2.0 },
  { minPercent: 0,  letter: "F", gpa: 0.0 },
];

export const GRADING_SCALE_OPTIONS: GradingScale[] = [
  "standard-10-point", "plus-minus", "pass-fail", "custom",
];

export const GRADING_SCALE_LABELS: Record<GradingScale, string> = {
  "standard-10-point": "Standard 10-point (A/B/C/D/F)",
  "plus-minus": "Plus/Minus (A+, A, A-, B+, ...)",
  "pass-fail": "Pass/Fail (P/F)",
  "custom": "Custom (define thresholds)",
};

export const GPA_SCALE_OPTIONS: GpaScale[] = ["4.0", "5.0", "10.0", "100-percentage"];

export const GPA_SCALE_LABELS: Record<GpaScale, string> = {
  "4.0": "4.0 scale",
  "5.0": "5.0 scale",
  "10.0": "10.0 scale",
  "100-percentage": "100% scale",
};

export const DEFAULTS = {
  targetGrade: 90,
  gradingScale: "standard-10-point" as GradingScale,
  gpaScale: "4.0" as GpaScale,
};

export const SAMPLE_ASSIGNMENTS = `Midterm,85,100,25
Quiz 1,18,20,10
Quiz 2,,20,10
Final,,100,40
Project,45,50,15`;

// ---- CSV splitter ----

/** Split a CSV line respecting quoted fields. */
export function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      out.push(current); current = "";
    } else { current += ch; }
  }
  out.push(current);
  return out;
}

// ---- Assignment parser ----

/** Parse assignments from text. One assignment per line: name,score,max_score,weight_percent.
 *  Empty score = unattempted. Lines starting with # are comments. */
export function parseAssignments(text: string): Assignment[] {
  if (!text) return [];
  const lines = text.split(/\r?\n/);
  const out: Assignment[] = [];
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const parts = splitCsvLine(line);
    if (parts.length < 3) continue;

    const name = parts[0].trim();
    if (!name) continue;

    const scoreStr = parts[1].trim();
    const maxScoreStr = parts[2].trim();
    const weightStr = (parts[3] || "").trim();

    const maxScore = Number(maxScoreStr);
    if (Number.isNaN(maxScore) || maxScore <= 0) continue;

    let score: number | null = null;
    if (scoreStr !== "") {
      const n = Number(scoreStr);
      if (Number.isNaN(n) || n < 0 || n > maxScore) continue;
      score = n;
    }

    const weight = weightStr === "" ? 0 : Number(weightStr);
    if (Number.isNaN(weight) || weight < 0) continue;

    out.push({ name, score, maxScore, weightPercent: weight });
  }
  return out;
}

/** Parse custom grading thresholds: one per line "minPercent,letter,gpa". */
export function parseCustomThresholds(text: string): GradeThreshold[] {
  if (!text) return [];
  const lines = text.split(/\r?\n/);
  const out: GradeThreshold[] = [];
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const parts = splitCsvLine(line).map((s) => s.trim());
    if (parts.length < 3) continue;
    const minPercent = Number(parts[0]);
    const letter = parts[1];
    const gpa = Number(parts[2]);
    if (Number.isNaN(minPercent) || Number.isNaN(gpa) || !letter) continue;
    if (minPercent < 0 || minPercent > 100) continue;
    out.push({ minPercent, letter, gpa });
  }
  // Sort descending by minPercent
  out.sort((a, b) => b.minPercent - a.minPercent);
  return out;
}

// ---- Validators ----

/** Validate assignments: weights should ideally sum to 100%; scores within range. */
export function validateAssignments(assignments: Assignment[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (assignments.length === 0) {
    errors.push("No assignments entered");
  }

  assignments.forEach((a, i) => {
    if (!a.name) errors.push(`Assignment ${i + 1}: name is required`);
    if (a.maxScore <= 0) errors.push(`Assignment ${i + 1}: max_score must be > 0`);
    if (a.score != null && (a.score < 0 || a.score > a.maxScore)) {
      errors.push(`Assignment ${i + 1} (${a.name}): score must be between 0 and ${a.maxScore}`);
    }
    if (a.weightPercent < 0) {
      errors.push(`Assignment ${i + 1} (${a.name}): weight cannot be negative`);
    }
  });

  const totalWeight = computeTotalWeight(assignments);
  if (assignments.length > 0 && totalWeight !== 100) {
    if (totalWeight === 0) {
      errors.push("Total weight is 0 — add weight_percent values");
    } else {
      warnings.push(`Weights sum to ${totalWeight}% (recommended: 100%)`);
    }
  }

  const attemptedWeight = computeAttemptedWeight(assignments);
  const remainingWeight = computeRemainingWeight(assignments);

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    assignmentCount: assignments.length,
    totalWeight,
    attemptedWeight,
    remainingWeight,
  };
}

// ---- Score calculators ----

/** Compute the weighted contribution of a single assignment. Returns null if unattempted. */
export function computeWeightedScore(a: Assignment): number | null {
  if (a.score == null) return null;
  if (a.maxScore <= 0) return 0;
  return (a.score / a.maxScore) * a.weightPercent;
}

/** Compute total weight of all assignments. */
export function computeTotalWeight(assignments: Assignment[]): number {
  return assignments.reduce((sum, a) => sum + a.weightPercent, 0);
}

/** Compute weight of attempted assignments (score !== null). */
export function computeAttemptedWeight(assignments: Assignment[]): number {
  return assignments
    .filter((a) => a.score != null)
    .reduce((sum, a) => sum + a.weightPercent, 0);
}

/** Compute weight of remaining (unattempted) assignments. */
export function computeRemainingWeight(assignments: Assignment[]): number {
  return assignments
    .filter((a) => a.score == null)
    .reduce((sum, a) => sum + a.weightPercent, 0);
}

/** Compute cumulative weighted points earned so far (raw, 0 to totalWeight). */
export function computeCumulativeEarned(assignments: Assignment[]): number {
  return assignments.reduce((sum, a) => sum + (computeWeightedScore(a) ?? 0), 0);
}

/** Compute current grade (% on attempted work, normalized to attempted weight). */
export function computeCurrentGrade(assignments: Assignment[]): number {
  const attempted = assignments.filter((a) => a.score != null && a.maxScore > 0);
  if (attempted.length === 0) return 0;
  const weighted = attempted.reduce((sum, a) => sum + (computeWeightedScore(a) ?? 0), 0);
  const attemptedWeight = attempted.reduce((sum, a) => sum + a.weightPercent, 0);
  if (attemptedWeight === 0) return 0;
  return (weighted / attemptedWeight) * 100;
}

/** Compute the % needed on remaining work to achieve targetGrade. Returns null if no remaining. */
export function computeGradeNeeded(assignments: Assignment[], targetGrade: number): number | null {
  const remainingWeight = computeRemainingWeight(assignments);
  if (remainingWeight <= 0) return null;
  const totalWeight = computeTotalWeight(assignments);
  if (totalWeight <= 0) return null;
  const currentWeighted = computeCumulativeEarned(assignments);
  // Solve: targetGrade = (currentWeighted + (needed/100) × remainingWeight) / totalWeight × 100
  const needed = ((targetGrade * totalWeight / 100) - currentWeighted) * 100 / remainingWeight;
  return Math.round(needed * 100) / 100;
}

// ---- Letter grade + GPA converters ----

function getThresholds(scale: GradingScale, custom?: GradeThreshold[]): GradeThreshold[] {
  if (scale === "plus-minus") return PLUS_MINUS;
  if (scale === "pass-fail") return PASS_FAIL;
  if (scale === "custom") {
    if (custom && custom.length > 0) return [...custom].sort((a, b) => b.minPercent - a.minPercent);
    return STANDARD_10_POINT; // fallback
  }
  return STANDARD_10_POINT;
}

/** Convert a percentage (0-100) to a letter grade. */
export function computeLetterGrade(
  percent: number,
  scale: GradingScale,
  custom?: GradeThreshold[],
): string {
  const p = Math.max(0, Math.min(100, percent));
  const table = getThresholds(scale, custom);
  for (const t of table) {
    if (p >= t.minPercent) return t.letter;
  }
  return table[table.length - 1].letter;
}

/** Convert a percentage (0-100) to GPA points on the chosen scale. */
export function computeGpa(percent: number, gpaScale: GpaScale): number {
  const p = Math.max(0, Math.min(100, percent));
  if (gpaScale === "10.0") return Math.round((p / 10) * 100) / 100;
  if (gpaScale === "100-percentage") return Math.round(p * 100) / 100;
  const table = gpaScale === "5.0" ? GPA_5_0_THRESHOLDS : STANDARD_10_POINT;
  for (const t of table) {
    if (p >= t.minPercent) return t.gpa;
  }
  return 0;
}

// ---- What-if / projection ----

/** Project the final grade assuming all remaining assignments score `assumedScore` (0-100). */
export function projectFinalGrade(assignments: Assignment[], assumedScore: number): number {
  const totalWeight = computeTotalWeight(assignments);
  if (totalWeight <= 0) return 0;
  const currentWeighted = computeCumulativeEarned(assignments);
  const remainingWeight = computeRemainingWeight(assignments);
  const projectedWeighted = currentWeighted + (assumedScore / 100) * remainingWeight;
  return Math.round((projectedWeighted / totalWeight * 100) * 100) / 100;
}

/** Build a what-if scenario: assume all remaining work scores X%, compute projected final grade. */
export function computeWhatIf(
  assignments: Assignment[],
  assumedScore: number,
  scale: GradingScale,
  gpaScale: GpaScale,
  custom?: GradeThreshold[],
): WhatIfScenario {
  const projected = projectFinalGrade(assignments, assumedScore);
  return {
    assumedScore,
    projectedFinalGrade: projected,
    projectedLetter: computeLetterGrade(projected, scale, custom),
    projectedGpa: computeGpa(projected, gpaScale),
  };
}

// ---- Summary stats ----

/** Compute the full summary statistics for the assignment set + target grade. */
export function computeSummaryStats(
  assignments: Assignment[],
  targetGrade: number,
  scale: GradingScale,
  gpaScale: GpaScale,
  custom?: GradeThreshold[],
): CalculationResult {
  const totalWeight = computeTotalWeight(assignments);
  const attemptedWeight = computeAttemptedWeight(assignments);
  const remainingWeight = computeRemainingWeight(assignments);
  const currentGrade = computeCurrentGrade(assignments);
  const gradeNeeded = computeGradeNeeded(assignments, targetGrade);
  const attemptedCount = assignments.filter((a) => a.score != null).length;
  const remainingCount = assignments.filter((a) => a.score == null).length;

  const weightedScores: AssignmentWithScore[] = assignments.map((a) => {
    const weightedScore = computeWeightedScore(a);
    return {
      ...a,
      weightedScore,
      attempted: a.score != null,
      percent: a.score != null && a.maxScore > 0
        ? Math.round((a.score / a.maxScore) * 1000) / 10
        : null,
    };
  });

  return {
    currentGrade: Math.round(currentGrade * 100) / 100,
    targetGrade,
    gradeNeeded,
    currentLetter: computeLetterGrade(currentGrade, scale, custom),
    currentGpa: computeGpa(currentGrade, gpaScale),
    targetLetter: computeLetterGrade(targetGrade, scale, custom),
    targetGpa: computeGpa(targetGrade, gpaScale),
    neededLetter: gradeNeeded != null ? computeLetterGrade(gradeNeeded, scale, custom) : "—",
    neededGpa: gradeNeeded != null ? computeGpa(gradeNeeded, gpaScale) : 0,
    weightedScores,
    totalWeight,
    attemptedWeight,
    remainingWeight,
    attemptedCount,
    remainingCount,
    weightSumPercent: totalWeight,
  };
}

// ---- Renderers ----

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Render the assignment breakdown + summary as a text report. */
export function renderText(
  assignments: Assignment[],
  stats: CalculationResult,
  scale: GradingScale,
  gpaScale: GpaScale,
): string {
  const lines: string[] = [];
  lines.push("Grade Calculator Report");
  lines.push("=".repeat(50));
  lines.push("");
  lines.push(`Target grade:        ${stats.targetGrade}% (${stats.targetLetter}, GPA ${stats.targetGpa})`);
  lines.push(`Current grade:       ${stats.currentGrade}% (${stats.currentLetter}, GPA ${stats.currentGpa})`);
  if (stats.gradeNeeded != null) {
    lines.push(`Grade needed:        ${stats.gradeNeeded}% (${stats.neededLetter}, GPA ${stats.neededGpa})`);
  } else {
    lines.push(`Grade needed:        — (no remaining assignments)`);
  }
  lines.push("");
  lines.push(`Total weight:        ${stats.totalWeight}%`);
  lines.push(`Attempted weight:    ${stats.attemptedWeight}% (${stats.attemptedCount} assignments)`);
  lines.push(`Remaining weight:    ${stats.remainingWeight}% (${stats.remainingCount} assignments)`);
  lines.push("");
  lines.push("Assignment Breakdown:");
  lines.push("-".repeat(50));
  for (const a of stats.weightedScores) {
    const scoreStr = a.attempted
      ? `${a.score}/${a.maxScore} (${a.percent}%)`
      : `—/${a.maxScore} (not yet attempted)`;
    const weightedStr = a.weightedScore != null
      ? `${Math.round(a.weightedScore * 100) / 100}/${a.weightPercent}`
      : `—/${a.weightPercent}`;
    lines.push(`  ${a.name}`);
    lines.push(`    Score:    ${scoreStr}`);
    lines.push(`    Weight:   ${a.weightPercent}%`);
    lines.push(`    Weighted: ${weightedStr}`);
  }
  lines.push("");
  lines.push(`Grading scale: ${GRADING_SCALE_LABELS[scale]}`);
  lines.push(`GPA scale:     ${GPA_SCALE_LABELS[gpaScale]}`);
  return lines.join("\n");
}

/** Render assignments as CSV: name,score,max_score,weight_percent,weighted_score,percent,attempted. */
export function renderCsv(assignments: Assignment[]): string {
  const lines = ["name,score,max_score,weight_percent,weighted_score,percent,attempted"];
  for (const a of assignments) {
    const ws = computeWeightedScore(a);
    const pct = a.score != null && a.maxScore > 0
      ? Math.round((a.score / a.maxScore) * 1000) / 10
      : null;
    lines.push([
      escapeCsv(a.name),
      a.score != null ? String(a.score) : "",
      String(a.maxScore),
      String(a.weightPercent),
      ws != null ? String(Math.round(ws * 100) / 100) : "",
      pct != null ? String(pct) : "",
      a.score != null ? "yes" : "no",
    ].join(","));
  }
  return lines.join("\n");
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:grade-calculator:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  currentGrade: number;
  targetGrade: number;
  gradeNeeded: number | null;
  currentGpa: number;
  assignmentCount: number;
}

export function loadHistory(): HistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(arr) ? arr.slice(0, HISTORY_MAX) : [];
  } catch {
    return [];
  }
}

export function saveHistory(entry: HistoryEntry): HistoryEntry[] {
  const next = [entry, ...loadHistory()].slice(0, HISTORY_MAX);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}

export function clearHistory(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    // ignore
  }
}

// ---- Shareable URL ----

export interface ShareParams {
  assignmentsText: string;
  targetGrade: number;
  gradingScale: GradingScale;
  gpaScale: GpaScale;
}

/**
 * Build a shareable URL with assignments + target grade + scales encoded in the hash.
 * Assignments text is base64url-encoded.
 */
export function buildShareUrl(
  assignmentsText: string,
  targetGrade: number,
  gradingScale: GradingScale,
  gpaScale: GpaScale,
): string {
  const params = new URLSearchParams();
  params.set("target", String(targetGrade));
  params.set("scale", gradingScale);
  params.set("gpa", gpaScale);
  if (assignmentsText) {
    try {
      const b64 = typeof btoa !== "undefined"
        ? btoa(unescape(encodeURIComponent(assignmentsText)))
        : Buffer.from(assignmentsText, "utf8").toString("base64");
      params.set("d", b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""));
    } catch {
      params.set("t", assignmentsText);
    }
  }
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

/** Parse a shareable URL hash back into ShareParams. */
export function parseShareUrl(hash: string): ShareParams {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  const empty: ShareParams = {
    assignmentsText: "",
    targetGrade: DEFAULTS.targetGrade,
    gradingScale: DEFAULTS.gradingScale,
    gpaScale: DEFAULTS.gpaScale,
  };
  if (!clean) return empty;
  const params = new URLSearchParams(clean);

  const targetRaw = params.get("target");
  const targetGrade = targetRaw && !Number.isNaN(Number(targetRaw))
    ? Math.max(0, Math.min(100, Number(targetRaw)))
    : DEFAULTS.targetGrade;

  const scaleRaw = params.get("scale") as GradingScale | null;
  const gradingScale = scaleRaw && GRADING_SCALE_OPTIONS.includes(scaleRaw)
    ? scaleRaw
    : DEFAULTS.gradingScale;

  const gpaRaw = params.get("gpa") as GpaScale | null;
  const gpaScale = gpaRaw && GPA_SCALE_OPTIONS.includes(gpaRaw)
    ? gpaRaw
    : DEFAULTS.gpaScale;

  let assignmentsText = "";
  const d = params.get("d");
  if (d) {
    try {
      const b64 = d.replace(/-/g, "+").replace(/_/g, "/");
      const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
      assignmentsText = typeof atob !== "undefined"
        ? decodeURIComponent(escape(atob(padded)))
        : Buffer.from(padded, "base64").toString("utf8");
    } catch {
      assignmentsText = "";
    }
  } else {
    assignmentsText = params.get("t") ?? "";
  }

  return { assignmentsText, targetGrade, gradingScale, gpaScale };
}
