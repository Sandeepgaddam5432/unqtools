/**
 * Grade Calculator — pure logic.
 * Weighted average + letter grade + GPA conversion.
 */

export interface GradeItem {
  name: string;
  score: number; // raw score
  maxScore: number; // max possible
  weight: number; // relative weight (any positive number)
}

export interface GradeResult {
  weightedAverage: number; // 0-100 percent
  totalWeight: number;
  letterGrade: string;
  gpa4: number; // on 4.0 scale
  gpa5: number; // on 5.0 scale
  pass: boolean;
  message: string;
}

export interface GradeBoundary {
  min: number; // inclusive percent
  letter: string;
  gpa4: number;
  gpa5: number;
  pass: boolean;
}

export const DEFAULT_BOUNDARIES: GradeBoundary[] = [
  { min: 93, letter: "A", gpa4: 4.0, gpa5: 5.0, pass: true },
  { min: 90, letter: "A-", gpa4: 3.7, gpa5: 4.7, pass: true },
  { min: 87, letter: "B+", gpa4: 3.3, gpa5: 4.3, pass: true },
  { min: 83, letter: "B", gpa4: 3.0, gpa5: 4.0, pass: true },
  { min: 80, letter: "B-", gpa4: 2.7, gpa5: 3.7, pass: true },
  { min: 77, letter: "C+", gpa4: 2.3, gpa5: 3.3, pass: true },
  { min: 73, letter: "C", gpa4: 2.0, gpa5: 3.0, pass: true },
  { min: 70, letter: "C-", gpa4: 1.7, gpa5: 2.7, pass: true },
  { min: 67, letter: "D+", gpa4: 1.3, gpa5: 2.3, pass: true },
  { min: 63, letter: "D", gpa4: 1.0, gpa5: 2.0, pass: true },
  { min: 60, letter: "D-", gpa4: 0.7, gpa5: 1.7, pass: true },
  { min: 0, letter: "F", gpa4: 0.0, gpa5: 0.0, pass: false },
];

/** Find the grade boundary for a percentage. */
export function findBoundary(percent: number, boundaries: GradeBoundary[] = DEFAULT_BOUNDARIES): GradeBoundary {
  for (const b of boundaries) {
    if (percent >= b.min) return b;
  }
  return boundaries[boundaries.length - 1];
}

/** Calculate a weighted grade from a list of items. */
export function calculateGrade(items: GradeItem[], boundaries: GradeBoundary[] = DEFAULT_BOUNDARIES): GradeResult | null {
  if (!Array.isArray(items) || items.length === 0) return null;
  let totalWeight = 0;
  let weightedSum = 0;
  for (const item of items) {
    if (item.maxScore <= 0 || item.weight <= 0) continue;
    const percent = (item.score / item.maxScore) * 100;
    weightedSum += percent * item.weight;
    totalWeight += item.weight;
  }
  if (totalWeight === 0) return null;
  const weightedAverage = weightedSum / totalWeight;
  const boundary = findBoundary(weightedAverage, boundaries);
  return {
    weightedAverage,
    totalWeight,
    letterGrade: boundary.letter,
    gpa4: boundary.gpa4,
    gpa5: boundary.gpa5,
    pass: boundary.pass,
    message: boundary.pass
      ? `Passing grade: ${boundary.letter} (${weightedAverage.toFixed(1)}%)`
      : `Failing grade: ${boundary.letter} (${weightedAverage.toFixed(1)}%)`,
  };
}

/** Validate a grade item. */
export function validateItem(item: GradeItem): string | null {
  if (item.score < 0) return "Score cannot be negative.";
  if (item.maxScore <= 0) return "Max score must be positive.";
  if (item.score > item.maxScore) return "Score cannot exceed max score.";
  if (item.weight <= 0) return "Weight must be positive.";
  return null;
}

/** Add an item with default values. */
export function makeEmptyItem(): GradeItem {
  return { name: "", score: 0, maxScore: 100, weight: 1 };
}

/** Sum weights of all items. */
export function sumWeights(items: GradeItem[]): number {
  return items.reduce((s, i) => s + (i.weight > 0 ? i.weight : 0), 0);
}

/** Compute letter for a raw percentage (helper). */
export function letterForPercent(percent: number, boundaries: GradeBoundary[] = DEFAULT_BOUNDARIES): string {
  return findBoundary(percent, boundaries).letter;
}
