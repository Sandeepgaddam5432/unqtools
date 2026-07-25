/**
 * GPA Calculator — pure logic.
 * Semester and cumulative GPA: GPA = Σ(grade_point × credits) / Σ(credits).
 */

export interface Course {
  name: string;
  credits: number;
  gradePoint: number; // 0.0 - 4.0 (or 5.0 scale if scale=5)
  term: string; // semester label e.g. "Fall 2024"
}

export interface SemesterResult {
  term: string;
  credits: number;
  qualityPoints: number;
  gpa: number;
  courses: Course[];
}

export interface GpaResult {
  semesters: SemesterResult[];
  cumulativeCredits: number;
  cumulativeQualityPoints: number;
  cumulativeGpa: number;
  isValid: boolean;
  error?: string;
}

/** Convert a letter grade to a 4.0 grade point. */
export function letterToGradePoint(letter: string): number {
  const map: Record<string, number> = {
    "A+": 4.0, "A": 4.0, "A-": 3.7,
    "B+": 3.3, "B": 3.0, "B-": 2.7,
    "C+": 2.3, "C": 2.0, "C-": 1.7,
    "D+": 1.3, "D": 1.0, "D-": 0.7,
    "F": 0.0,
  };
  return map[letter.toUpperCase().trim()] ?? -1;
}

/** Validate a course. */
export function validateCourse(c: Course): string | null {
  if (!c.name.trim()) return "Course name is required.";
  if (c.credits <= 0) return "Credits must be positive.";
  if (c.gradePoint < 0 || c.gradePoint > 4.0) return "Grade point must be between 0 and 4.0.";
  return null;
}

/** Compute semester and cumulative GPA. */
export function computeGpa(courses: Course[]): GpaResult {
  if (!Array.isArray(courses) || courses.length === 0) {
    return { semesters: [], cumulativeCredits: 0, cumulativeQualityPoints: 0, cumulativeGpa: 0, isValid: false, error: "No courses provided." };
  }
  for (const c of courses) {
    const e = validateCourse(c);
    if (e) return { semesters: [], cumulativeCredits: 0, cumulativeQualityPoints: 0, cumulativeGpa: 0, isValid: false, error: e };
  }

  const byTerm = new Map<string, Course[]>();
  for (const c of courses) {
    const list = byTerm.get(c.term) ?? [];
    list.push(c);
    byTerm.set(c.term, list);
  }

  const semesters: SemesterResult[] = [];
  let totalCredits = 0;
  let totalQuality = 0;
  for (const [term, list] of byTerm) {
    let credits = 0;
    let quality = 0;
    for (const c of list) {
      credits += c.credits;
      quality += c.credits * c.gradePoint;
    }
    const gpa = credits > 0 ? quality / credits : 0;
    semesters.push({ term, credits, qualityPoints: quality, gpa, courses: list });
    totalCredits += credits;
    totalQuality += quality;
  }

  semesters.sort((a, b) => a.term.localeCompare(b.term));

  return {
    semesters,
    cumulativeCredits: totalCredits,
    cumulativeQualityPoints: totalQuality,
    cumulativeGpa: totalCredits > 0 ? totalQuality / totalCredits : 0,
    isValid: true,
  };
}

/** Classification used by the UI. */
export function classifyGpa(gpa: number): { label: string; tone: string } {
  if (gpa >= 3.7) return { label: "Summa cum laude", tone: "emerald" };
  if (gpa >= 3.5) return { label: "Magna cum laude", tone: "blue" };
  if (gpa >= 3.3) return { label: "Cum laude", tone: "blue" };
  if (gpa >= 2.0) return { label: "Good standing", tone: "amber" };
  return { label: "Academic probation", tone: "red" };
}

export function makeEmptyCourse(term = "Fall 2024"): Course {
  return { name: "", credits: 3, gradePoint: 4.0, term };
}
