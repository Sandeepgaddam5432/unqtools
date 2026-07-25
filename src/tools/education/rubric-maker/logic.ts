/**
 * Rubric Maker — pure logic.
 * Create grading rubrics with criteria, performance levels, and point allocation.
 */

export interface RubricLevel {
  label: string;
  points: number;
  description: string;
}

export interface RubricCriterion {
  id: string;
  name: string;
  weight: number; // relative weight
  levels: RubricLevel[]; // ordered high → low
}

export interface Rubric {
  title: string;
  totalPoints: number;
  criteria: RubricCriterion[];
}

export const DEFAULT_LEVELS = ["Excellent", "Proficient", "Developing", "Beginning"];

/** Build default levels for a criterion with given max points. */
export function defaultLevels(maxPoints: number, labels = DEFAULT_LEVELS): RubricLevel[] {
  const step = maxPoints / labels.length;
  return labels.map((label, i) => ({
    label,
    points: Math.round((maxPoints - i * step) * 100) / 100,
    description: `${label} performance on this criterion.`,
  }));
}

/** Make an empty criterion. */
export function makeCriterion(name: string, maxPoints: number, weight = 1): RubricCriterion {
  return {
    id: `crit-${Math.random().toString(36).slice(2, 9)}`,
    name,
    weight,
    levels: defaultLevels(maxPoints),
  };
}

/** Validate a rubric. */
export function validateRubric(rubric: Rubric): string | null {
  if (!rubric.title.trim()) return "Rubric title is required.";
  if (rubric.criteria.length === 0) return "Add at least one criterion.";
  for (const c of rubric.criteria) {
    if (!c.name.trim()) return "Each criterion needs a name.";
    if (c.weight <= 0) return "Criterion weight must be positive.";
    if (c.levels.length < 2) return "Each criterion needs at least 2 performance levels.";
    for (const lv of c.levels) {
      if (lv.points < 0) return "Level points cannot be negative.";
      if (!lv.label.trim()) return "Each level needs a label.";
    }
  }
  return null;
}

/** Compute total possible points across all criteria. */
export function computeTotalPoints(criteria: RubricCriterion[]): number {
  return criteria.reduce((sum, c) => sum + (c.levels[0]?.points ?? 0) * c.weight, 0);
}

/** Score a rubric given selected levels per criterion. Returns final score / percentage. */
export interface SelectedLevel {
  criterionId: string;
  levelIndex: number;
}

export function scoreRubric(rubric: Rubric, selections: SelectedLevel[]): {
  earnedPoints: number;
  totalPoints: number;
  percentage: number;
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  let earned = 0;
  for (const c of rubric.criteria) {
    const sel = selections.find((s) => s.criterionId === c.id);
    if (!sel) {
      errors.push(`No selection for ${c.name}.`);
      continue;
    }
    const level = c.levels[sel.levelIndex];
    if (!level) {
      errors.push(`Invalid level index for ${c.name}.`);
      continue;
    }
    earned += level.points * c.weight;
  }
  const total = computeTotalPoints(rubric.criteria);
  return {
    earnedPoints: earned,
    totalPoints: total,
    percentage: total > 0 ? (earned / total) * 100 : 0,
    isValid: errors.length === 0,
    errors,
  };
}

/** Convert a rubric to Markdown table. */
export function rubricToMarkdown(rubric: Rubric): string {
  if (rubric.criteria.length === 0) return `# ${rubric.title}\n\n_No criteria yet._`;
  const levels = rubric.criteria[0].levels.map((l) => l.label);
  const header = `| Criterion | ${levels.join(" | ")} |`;
  const sep = `| --- | ${levels.map(() => "---").join(" | ")} |`;
  const rows = rubric.criteria.map((c) => {
    const cells = c.levels.map((l) => `${l.points} pts — ${l.description}`).join(" | ");
    return `| ${c.name} (×${c.weight}) | ${cells} |`;
  });
  return [`# ${rubric.title}`, "", header, sep, ...rows].join("\n");
}

/** Convert a rubric to CSV. */
export function rubricToCsv(rubric: Rubric): string {
  const rows = ["criterion,level,points,description"];
  for (const c of rubric.criteria) {
    for (const l of c.levels) {
      const desc = l.description.replace(/"/g, '""');
      rows.push(`"${c.name}","${l.label}",${l.points},"${desc}"`);
    }
  }
  return rows.join("\n");
}
