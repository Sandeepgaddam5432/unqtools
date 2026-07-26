/**
 * Assignment Rubric Maker — pure logic.
 * Criteria / levels / points, weighted scoring, export.
 */

export interface RubricLevel {
  name: string;
  description: string;
  points: number;
}

export interface RubricCriterion {
  id: string;
  name: string;
  description: string;
  weight: number; // multiplier, default 1
  levels: RubricLevel[]; // ordered high → low
}

export interface Rubric {
  id: string;
  title: string;
  subject: string;
  totalPoints: number;
  criteria: RubricCriterion[];
  createdAt: number;
}

export function createRubric(title: string, subject = "", totalPoints = 100): Rubric {
  return {
    id: `rubric-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: title.trim() || "Untitled rubric",
    subject,
    totalPoints,
    criteria: [],
    createdAt: Date.now(),
  };
}

export function addCriterion(
  rubric: Rubric,
  name: string,
  description = "",
  weight = 1,
  levels?: RubricLevel[],
): Rubric {
  const defaultLevels: RubricLevel[] = levels ?? [
    { name: "Excellent", description: "Exceeds expectations", points: 4 },
    { name: "Proficient", description: "Meets expectations", points: 3 },
    { name: "Developing", description: "Approaching expectations", points: 2 },
    { name: "Beginning", description: "Below expectations", points: 1 },
  ];
  const c: RubricCriterion = {
    id: `crit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: name.trim() || "Untitled criterion",
    description,
    weight,
    levels: defaultLevels,
  };
  return { ...rubric, criteria: [...rubric.criteria, c] };
}

export function removeCriterion(rubric: Rubric, id: string): Rubric {
  return { ...rubric, criteria: rubric.criteria.filter((c) => c.id !== id) };
}

export function updateCriterion(rubric: Rubric, id: string, patch: Partial<RubricCriterion>): Rubric {
  return {
    ...rubric,
    criteria: rubric.criteria.map((c) => (c.id === id ? { ...c, ...patch } : c)),
  };
}

/** Sum of all weights across criteria. */
export function totalWeight(rubric: Rubric): number {
  return rubric.criteria.reduce((s, c) => s + c.weight, 0);
}

/** Compute a student's score given selected points per criterion. */
export interface StudentScore {
  criterionId: string;
  selectedPoints: number;
}

export function computeScore(rubric: Rubric, selections: StudentScore[]): { raw: number; weighted: number; percent: number; maxPossible: number } {
  let raw = 0;
  let weighted = 0;
  let maxPossible = 0;
  for (const c of rubric.criteria) {
    const sel = selections.find((s) => s.criterionId === c.id);
    const maxPoints = Math.max(...c.levels.map((l) => l.points));
    maxPossible += maxPoints * c.weight;
    if (sel) {
      raw += sel.selectedPoints;
      weighted += sel.selectedPoints * c.weight;
    }
  }
  const percent = maxPossible > 0 ? (weighted / maxPossible) * 100 : 0;
  return { raw, weighted, percent, maxPossible };
}

/** Convert percentage to letter grade (US scale). */
export function letterGrade(percent: number): string {
  if (percent >= 93) return "A";
  if (percent >= 90) return "A-";
  if (percent >= 87) return "B+";
  if (percent >= 83) return "B";
  if (percent >= 80) return "B-";
  if (percent >= 77) return "C+";
  if (percent >= 73) return "C";
  if (percent >= 70) return "C-";
  if (percent >= 67) return "D+";
  if (percent >= 60) return "D";
  return "F";
}

/** GPA conversion (4.0 scale). */
export function gpaFromPercent(percent: number): number {
  if (percent >= 93) return 4.0;
  if (percent >= 90) return 3.7;
  if (percent >= 87) return 3.3;
  if (percent >= 83) return 3.0;
  if (percent >= 80) return 2.7;
  if (percent >= 77) return 2.3;
  if (percent >= 73) return 2.0;
  if (percent >= 70) return 1.7;
  if (percent >= 60) return 1.0;
  return 0;
}

/** Validate rubric. */
export function validateRubric(rubric: Rubric): string[] {
  const w: string[] = [];
  if (rubric.criteria.length === 0) w.push("Rubric has no criteria.");
  if (rubric.totalPoints <= 0) w.push("Total points must be positive.");
  for (const c of rubric.criteria) {
    if (c.levels.length < 2) w.push(`Criterion "${c.name}" has fewer than 2 levels.`);
    if (c.weight <= 0) w.push(`Criterion "${c.name}" has non-positive weight.`);
  }
  return w;
}

/** Export as CSV. */
export function exportRubricCSV(rubric: Rubric): string {
  const header = ["criterion", "description", "weight", "level_name", "level_description", "points"];
  const rows: string[] = [];
  for (const c of rubric.criteria) {
    for (const l of c.levels) {
      rows.push(
        [`"${c.name}"`, `"${c.description.replace(/"/g, '""')}"`, c.weight, `"${l.name}"`, `"${l.description.replace(/"/g, '""')}"`, l.points].join(","),
      );
    }
  }
  return [header.join(","), ...rows].join("\n");
}

/** Export as JSON. */
export function exportRubricJSON(rubric: Rubric): string {
  return JSON.stringify(rubric, null, 2);
}

/** Export as printable text. */
export function exportRubricText(rubric: Rubric): string {
  const lines: string[] = [`${rubric.title} (${rubric.subject || "general"})`, `Total points: ${rubric.totalPoints}`, ""];
  for (const c of rubric.criteria) {
    lines.push(`## ${c.name} (weight: ${c.weight})`);
    if (c.description) lines.push(c.description);
    for (const l of c.levels) {
      lines.push(`  - ${l.name} (${l.points} pts): ${l.description}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

/** Stats summary. */
export function rubricStats(rubric: Rubric): {
  criteriaCount: number;
  avgLevels: number;
  maxPossiblePoints: number;
  weightSum: number;
} {
  const criteriaCount = rubric.criteria.length;
  const avgLevels = criteriaCount ? rubric.criteria.reduce((s, c) => s + c.levels.length, 0) / criteriaCount : 0;
  const maxPossiblePoints = rubric.criteria.reduce(
    (s, c) => s + Math.max(...c.levels.map((l) => l.points)) * c.weight,
    0,
  );
  const weightSum = totalWeight(rubric);
  return { criteriaCount, avgLevels, maxPossiblePoints, weightSum };
}

/** Find best level per criterion. */
export function bestLevels(rubric: Rubric): Array<{ criterion: string; level: RubricLevel }> {
  return rubric.criteria.map((c) => ({
    criterion: c.name,
    level: [...c.levels].sort((a, b) => b.points - a.points)[0],
  }));
}

/** Find worst level per criterion. */
export function worstLevels(rubric: Rubric): Array<{ criterion: string; level: RubricLevel }> {
  return rubric.criteria.map((c) => ({
    criterion: c.name,
    level: [...c.levels].sort((a, b) => a.points - b.points)[0],
  }));
}

/** Convert rubric total to student's percentage based on raw points. */
export function percentFromRaw(rubric: Rubric, raw: number): number {
  if (rubric.totalPoints <= 0) return 0;
  return (raw / rubric.totalPoints) * 100;
}

/** Quick-pick a preset rubric. */
export function presetRubric(kind: "essay" | "presentation" | "lab-report" | "project"): Rubric {
  const presets: Record<string, () => Rubric> = {
    essay: () => {
      let r = createRubric("Essay Rubric", "English", 100);
      r = addCriterion(r, "Thesis & Argument", "Clear, defensible thesis", 2);
      r = addCriterion(r, "Evidence", "Cites relevant evidence", 1.5);
      r = addCriterion(r, "Organization", "Logical structure & transitions", 1);
      r = addCriterion(r, "Style & Voice", "Engaging academic voice", 1);
      r = addCriterion(r, "Mechanics", "Grammar, spelling, citation", 0.5);
      return r;
    },
    presentation: () => {
      let r = createRubric("Presentation Rubric", "Communication", 100);
      r = addCriterion(r, "Content Knowledge", "Demonstrates mastery of subject", 2);
      r = addCriterion(r, "Delivery", "Pace, eye contact, voice", 1.5);
      r = addCriterion(r, "Visual Aids", "Slides support content", 1);
      r = addCriterion(r, "Engagement", "Audience interaction", 1);
      return r;
    },
    "lab-report": () => {
      let r = createRubric("Lab Report Rubric", "Science", 100);
      r = addCriterion(r, "Hypothesis", "Testable and clearly stated", 1);
      r = addCriterion(r, "Procedure", "Reproducible steps", 1.5);
      r = addCriterion(r, "Data Analysis", "Correct statistical treatment", 2);
      r = addCriterion(r, "Conclusion", "Connects results to hypothesis", 1);
      return r;
    },
    project: () => {
      let r = createRubric("Project Rubric", "General", 100);
      r = addCriterion(r, "Creativity", "Original approach", 1.5);
      r = addCriterion(r, "Execution", "Quality of build", 2);
      r = addCriterion(r, "Documentation", "Clear write-up", 1);
      r = addCriterion(r, "Teamwork", "Collaboration evidence", 0.5);
      return r;
    },
  };
  return presets[kind]();
}
