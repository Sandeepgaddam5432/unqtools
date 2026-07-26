/**
 * Periodic Table Quiz — pure logic.
 *
 * Generates quiz questions from an embedded subset of periodic-table
 * data. The data covers the first 36 elements (H through Kr) plus a
 * handful of well-known extras — enough for a meaningful quiz without
 * bloating the bundle.
 *
 * Question modes:
 *   • symbol → name
 *   • name → symbol
 *   • atomic number → symbol/name
 *
 * Each question is multiple-choice with four options. The caller can
 * score answers and track progress.
 */

export type QuizMode = "symbol-to-name" | "name-to-symbol" | "number-to-symbol";

export interface Element {
  number: number;
  symbol: string;
  name: string;
  category: string;
}

export interface QuizQuestion {
  id: string;
  prompt: string;
  options: string[];
  answer: string;
  mode: QuizMode;
  element: Element;
}

export interface QuizResult {
  total: number;
  correct: number;
  incorrect: number;
  percent: number;
  grade: string;
  perQuestion: { id: string; correct: boolean }[];
}

// Subset of the periodic table (Z = 1..36 + a few famous extras).
export const ELEMENTS: Element[] = [
  { number: 1, symbol: "H", name: "Hydrogen", category: "nonmetal" },
  { number: 2, symbol: "He", name: "Helium", category: "noble" },
  { number: 3, symbol: "Li", name: "Lithium", category: "alkali" },
  { number: 4, symbol: "Be", name: "Beryllium", category: "alkaline" },
  { number: 5, symbol: "B", name: "Boron", category: "metalloid" },
  { number: 6, symbol: "C", name: "Carbon", category: "nonmetal" },
  { number: 7, symbol: "N", name: "Nitrogen", category: "nonmetal" },
  { number: 8, symbol: "O", name: "Oxygen", category: "nonmetal" },
  { number: 9, symbol: "F", name: "Fluorine", category: "halogen" },
  { number: 10, symbol: "Ne", name: "Neon", category: "noble" },
  { number: 11, symbol: "Na", name: "Sodium", category: "alkali" },
  { number: 12, symbol: "Mg", name: "Magnesium", category: "alkaline" },
  { number: 13, symbol: "Al", name: "Aluminium", category: "post-transition" },
  { number: 14, symbol: "Si", name: "Silicon", category: "metalloid" },
  { number: 15, symbol: "P", name: "Phosphorus", category: "nonmetal" },
  { number: 16, symbol: "S", name: "Sulfur", category: "nonmetal" },
  { number: 17, symbol: "Cl", name: "Chlorine", category: "halogen" },
  { number: 18, symbol: "Ar", name: "Argon", category: "noble" },
  { number: 19, symbol: "K", name: "Potassium", category: "alkali" },
  { number: 20, symbol: "Ca", name: "Calcium", category: "alkaline" },
  { number: 21, symbol: "Sc", name: "Scandium", category: "transition" },
  { number: 22, symbol: "Ti", name: "Titanium", category: "transition" },
  { number: 23, symbol: "V", name: "Vanadium", category: "transition" },
  { number: 24, symbol: "Cr", name: "Chromium", category: "transition" },
  { number: 25, symbol: "Mn", name: "Manganese", category: "transition" },
  { number: 26, symbol: "Fe", name: "Iron", category: "transition" },
  { number: 27, symbol: "Co", name: "Cobalt", category: "transition" },
  { number: 28, symbol: "Ni", name: "Nickel", category: "transition" },
  { number: 29, symbol: "Cu", name: "Copper", category: "transition" },
  { number: 30, symbol: "Zn", name: "Zinc", category: "transition" },
  { number: 31, symbol: "Ga", name: "Gallium", category: "post-transition" },
  { number: 32, symbol: "Ge", name: "Germanium", category: "metalloid" },
  { number: 33, symbol: "As", name: "Arsenic", category: "metalloid" },
  { number: 34, symbol: "Se", name: "Selenium", category: "nonmetal" },
  { number: 35, symbol: "Br", name: "Bromine", category: "halogen" },
  { number: 36, symbol: "Kr", name: "Krypton", category: "noble" },
  { number: 47, symbol: "Ag", name: "Silver", category: "transition" },
  { number: 53, symbol: "I", name: "Iodine", category: "halogen" },
  { number: 79, symbol: "Au", name: "Gold", category: "transition" },
  { number: 80, symbol: "Hg", name: "Mercury", category: "transition" },
  { number: 82, symbol: "Pb", name: "Lead", category: "post-transition" },
  { number: 92, symbol: "U", name: "Uranium", category: "actinide" },
];

function shuffle<T>(arr: T[], rng: () => number = Math.random): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** Generate `count` questions from the element pool. */
export function generateQuiz(count: number, mode: QuizMode, rng: () => number = Math.random): QuizQuestion[] {
  const n = Math.min(count, ELEMENTS.length);
  const picked = shuffle(ELEMENTS, rng).slice(0, n);
  return picked.map((el, idx) => {
    const pool = ELEMENTS.filter((e) => e.number !== el.number);
    const distractors = shuffle(pool, rng).slice(0, 3);
    let prompt: string;
    let answer: string;
    let optionsPool: string[];
    if (mode === "symbol-to-name") {
      prompt = `What is the name of element "${el.symbol}"?`;
      answer = el.name;
      optionsPool = [...distractors.map((d) => d.name), el.name];
    } else if (mode === "name-to-symbol") {
      prompt = `What is the symbol for "${el.name}"?`;
      answer = el.symbol;
      optionsPool = [...distractors.map((d) => d.symbol), el.symbol];
    } else {
      prompt = `Which element has atomic number ${el.number}?`;
      answer = el.symbol;
      optionsPool = [...distractors.map((d) => d.symbol), el.symbol];
    }
    return {
      id: `q-${idx + 1}`,
      prompt,
      options: shuffle(optionsPool, rng),
      answer,
      mode,
      element: el,
    };
  });
}

/** Score a complete set of answers (Map of questionId → selected option). */
export function scoreQuiz(questions: QuizQuestion[], answers: Map<string, string>): QuizResult {
  let correct = 0;
  const perQuestion: { id: string; correct: boolean }[] = [];
  for (const q of questions) {
    const sel = answers.get(q.id);
    const isCorrect = sel === q.answer;
    if (isCorrect) correct++;
    perQuestion.push({ id: q.id, correct: isCorrect });
  }
  const total = questions.length;
  const percent = total > 0 ? Math.round((correct / total) * 1000) / 10 : 0;
  return {
    total,
    correct,
    incorrect: total - correct,
    percent,
    grade: gradeFor(percent),
    perQuestion,
  };
}

export function gradeFor(percent: number): string {
  if (percent >= 90) return "A";
  if (percent >= 80) return "B";
  if (percent >= 70) return "C";
  if (percent >= 60) return "D";
  return "F";
}

/** Format a quiz result as a plain-text summary. */
export function resultToText(r: QuizResult): string {
  const lines: string[] = [];
  lines.push(`Score: ${r.correct} / ${r.total} (${r.percent}%)`);
  lines.push(`Grade: ${r.grade}`);
  lines.push(`Incorrect: ${r.incorrect}`);
  return lines.join("\n");
}

/** Convert questions to a printable worksheet (no answers shown). */
export function worksheetToText(questions: QuizQuestion[]): string {
  const lines: string[] = [];
  questions.forEach((q, i) => {
    lines.push(`${i + 1}. ${q.prompt}`);
    q.options.forEach((o, j) => lines.push(`   ${String.fromCharCode(65 + j)}) ${o}`));
    lines.push("");
  });
  return lines.join("\n");
}

/** Build an answer key for a quiz. */
export function answerKey(questions: QuizQuestion[]): string {
  const lines: string[] = ["Answer Key"];
  questions.forEach((q, i) => {
    lines.push(`${i + 1}. ${q.answer}`);
  });
  return lines.join("\n");
}
