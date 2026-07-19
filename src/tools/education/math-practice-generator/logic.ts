/**
 * Math Practice Generator — pure logic.
 *
 * Generate math problems for add/subtract/multiply/divide with 4 difficulty
 * levels, number range parser, mixed mode, seeded RNG, validators,
 * renderers (text/HTML/CSV/Markdown), history, shareable URL, summary stats.
 * Pure functions only.
 */

export type OperationType = "addition" | "subtraction" | "multiplication" | "division" | "mixed";
export type DifficultyLevel = "easy" | "medium" | "hard" | "expert";

export interface Problem {
  index: number;
  op: Exclude<OperationType, "mixed">;
  a: number;
  b: number;
  answer: number;
  text: string;
}

export interface Worksheet {
  problems: Problem[];
  operation: OperationType;
  difficulty: DifficultyLevel;
  rangeMin: number;
  rangeMax: number;
  allowNegatives: boolean;
  showAnswers: boolean;
  seed: number;
  createdAt: number;
}

export interface WorksheetSettings {
  operation: OperationType;
  difficulty: DifficultyLevel;
  numberOfProblems: number;
  numberRange: string;
  allowNegatives: boolean;
  showAnswers: boolean;
  seed?: number;
}

// ---- Difficulty presets ----

export const DIFFICULTY_PRESETS: Record<DifficultyLevel, { min: number; max: number; label: string }> = {
  easy: { min: 1, max: 20, label: "Easy (1-20)" },
  medium: { min: 1, max: 100, label: "Medium (1-100)" },
  hard: { min: 1, max: 1000, label: "Hard (1-1000)" },
  expert: { min: 1, max: 10000, label: "Expert (1-10000)" },
};

export const OPERATION_LABELS: Record<OperationType, string> = {
  addition: "Addition",
  subtraction: "Subtraction",
  multiplication: "Multiplication",
  division: "Division",
  mixed: "Mixed",
};

export const OP_SYMBOLS: Record<Exclude<OperationType, "mixed">, string> = {
  addition: "+",
  subtraction: "−",
  multiplication: "×",
  division: "÷",
};

/** Suggested time limit per difficulty (minutes per problem). */
export const TIMED_PRESETS: Record<DifficultyLevel, { perProblemSeconds: number; label: string }> = {
  easy: { perProblemSeconds: 15, label: "~15 sec/problem" },
  medium: { perProblemSeconds: 30, label: "~30 sec/problem" },
  hard: { perProblemSeconds: 60, label: "~60 sec/problem" },
  expert: { perProblemSeconds: 120, label: "~120 sec/problem" },
};

// ---- Seeded RNG (mulberry32) ----

/** Mulberry32 — small, fast seeded PRNG. */
export function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Random integer in [min, max] inclusive using provided RNG. */
export function randInt(rng: () => number, min: number, max: number): number {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  if (hi === lo) return lo;
  return Math.floor(rng() * (hi - lo + 1)) + lo;
}

/** Pick a random element from an array using provided RNG. */
export function pickRandom<T>(rng: () => number, arr: T[]): T {
  if (arr.length === 0) throw new Error("Cannot pick from empty array");
  return arr[Math.floor(rng() * arr.length)];
}

// ---- Fisher-Yates shuffle (seeded) ----

/** Shuffle an array in place using Fisher-Yates. Returns a new array. */
export function shuffle<T>(arr: T[], rng: () => number): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ---- Number range parser ----

export interface RangeParseResult {
  min: number;
  max: number;
  valid: boolean;
  error?: string;
}

/** Parse a range string like "1-100" or "5..50". */
export function parseNumberRange(input: string): RangeParseResult {
  const s = (input || "").trim();
  if (!s) return { min: 0, max: 0, valid: false, error: "Empty range" };
  // Allow "1-100", "1..100", "1,100"
  const m = s.match(/^(-?\d+)\s*[-,.\s]+\s*(-?\d+)$/);
  if (!m) {
    // Try single number
    if (/^-?\d+$/.test(s)) {
      const n = parseInt(s, 10);
      return { min: n, max: n, valid: true };
    }
    return { min: 0, max: 0, valid: false, error: "Use format like '1-100'" };
  }
  const lo = parseInt(m[1], 10);
  const hi = parseInt(m[2], 10);
  if (Number.isNaN(lo) || Number.isNaN(hi)) {
    return { min: 0, max: 0, valid: false, error: "Invalid numbers" };
  }
  return { min: Math.min(lo, hi), max: Math.max(lo, hi), valid: true };
}

/** Resolve the effective range from settings (custom range or difficulty preset). */
export function resolveRange(settings: WorksheetSettings): { min: number; max: number } {
  const parsed = parseNumberRange(settings.numberRange);
  if (parsed.valid) return { min: parsed.min, max: parsed.max };
  const preset = DIFFICULTY_PRESETS[settings.difficulty];
  return { min: preset.min, max: preset.max };
}

// ---- Answer calculator per operation ----

export function computeAnswer(op: Exclude<OperationType, "mixed">, a: number, b: number): number {
  switch (op) {
    case "addition": return a + b;
    case "subtraction": return a - b;
    case "multiplication": return a * b;
    case "division": return b === 0 ? NaN : a / b;
  }
}

// ---- Problem validator ----

export interface ValidationContext {
  allowNegatives: boolean;
}

export interface ProblemValidation {
  valid: boolean;
  error?: string;
}

/** Validate a problem: no division by zero, no unwanted negative results. */
export function validateProblem(
  op: Exclude<OperationType, "mixed">,
  a: number,
  b: number,
  ctx: ValidationContext,
): ProblemValidation {
  if (op === "division" && b === 0) {
    return { valid: false, error: "Division by zero" };
  }
  if (op === "division") {
    const ans = a / b;
    if (!Number.isInteger(ans)) {
      // We allow non-integer answers; validator just flags hard cases.
    }
    if (ans < 0 && !ctx.allowNegatives) {
      return { valid: false, error: "Negative quotient not allowed" };
    }
  }
  if (op === "subtraction") {
    const ans = a - b;
    if (ans < 0 && !ctx.allowNegatives) {
      return { valid: false, error: "Negative result not allowed" };
    }
  }
  return { valid: true };
}

// ---- Problem generator ----

const MIXED_OPS: Exclude<OperationType, "mixed">[] = [
  "addition", "subtraction", "multiplication", "division",
];

/** Generate a single problem given operation, range, RNG, and context. */
export function generateOne(
  op: Exclude<OperationType, "mixed">,
  rng: () => number,
  min: number,
  max: number,
  allowNegatives: boolean,
  index: number,
): Problem {
  let a: number;
  let b: number;
  let attempts = 0;
  // For division: pick b in [1, max], pick quotient in [min, max], then a = b * quotient.
  if (op === "division") {
    const qMin = Math.max(1, min);
    const qMax = Math.max(qMin, max);
    b = randInt(rng, 1, Math.max(1, max));
    const quotient = randInt(rng, qMin, qMax);
    a = b * quotient;
  } else if (op === "subtraction" && !allowNegatives) {
    // Ensure a >= b for non-negative result
    a = randInt(rng, min, max);
    b = randInt(rng, min, a);
  } else {
    a = randInt(rng, min, max);
    b = randInt(rng, min, max);
  }
  // Validate (defensive)
  const v = validateProblem(op, a, b, { allowNegatives });
  if (!v.valid && attempts < 5) {
    attempts++;
    // Retry with safer values
    if (op === "subtraction" && !allowNegatives) {
      a = Math.max(a, b);
    }
  }
  const answer = computeAnswer(op, a, b);
  const sym = OP_SYMBOLS[op];
  const text = `${a} ${sym} ${b} =`;
  return { index, op, a, b, answer, text };
}

/** Generate a full worksheet. */
export function generateWorksheet(settings: WorksheetSettings): Worksheet {
  const seed = settings.seed ?? randomSeed();
  const rng = makeRng(seed);
  const { min, max } = resolveRange(settings);
  const n = Math.max(1, Math.min(500, settings.numberOfProblems));
  const problems: Problem[] = [];
  for (let i = 0; i < n; i++) {
    const op: Exclude<OperationType, "mixed"> =
      settings.operation === "mixed" ? pickRandom(rng, MIXED_OPS) : settings.operation;
    problems.push(generateOne(op, rng, min, max, settings.allowNegatives, i + 1));
  }
  return {
    problems,
    operation: settings.operation,
    difficulty: settings.difficulty,
    rangeMin: min,
    rangeMax: max,
    allowNegatives: settings.allowNegatives,
    showAnswers: settings.showAnswers,
    seed,
    createdAt: Date.now(),
  };
}

/** Generate a random seed (browser-friendly). */
export function randomSeed(): number {
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    return arr[0];
  }
  return Math.floor(Math.random() * 0xffffffff);
}

// ---- Summary stats ----

export interface WorksheetStats {
  total: number;
  byOp: Record<Exclude<OperationType, "mixed">, number>;
  byDifficulty: Record<DifficultyLevel, number>;
  minAnswer: number | null;
  maxAnswer: number | null;
  avgAnswer: number | null;
  suggestedTimeSeconds: number;
}

export function computeStats(ws: Worksheet): WorksheetStats {
  const byOp: Record<Exclude<OperationType, "mixed">, number> = {
    addition: 0,
    subtraction: 0,
    multiplication: 0,
    division: 0,
  };
  const byDifficulty: Record<DifficultyLevel, number> = {
    easy: 0,
    medium: 0,
    hard: 0,
    expert: 0,
  };
  byDifficulty[ws.difficulty] = ws.problems.length;
  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  let count = 0;
  for (const p of ws.problems) {
    byOp[p.op] += 1;
    if (Number.isFinite(p.answer)) {
      min = Math.min(min, p.answer);
      max = Math.max(max, p.answer);
      sum += p.answer;
      count++;
    }
  }
  return {
    total: ws.problems.length,
    byOp,
    byDifficulty,
    minAnswer: count > 0 ? min : null,
    maxAnswer: count > 0 ? max : null,
    avgAnswer: count > 0 ? sum / count : null,
    suggestedTimeSeconds: ws.problems.length * TIMED_PRESETS[ws.difficulty].perProblemSeconds,
  };
}

// ---- Renderers ----

export function renderProblemLine(p: Problem, showAnswer = false): string {
  if (showAnswer) {
    return `${p.index}. ${p.text} ${formatAnswer(p.answer)}`;
  }
  return `${p.index}. ${p.text} ____`;
}

/** Format an answer — integers as-is, floats to 4 decimals. */
export function formatAnswer(n: number): string {
  if (!Number.isFinite(n)) return "undefined";
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(4).replace(/\.?0+$/, "");
}

/** Render worksheet as plain text. */
export function renderTextWorksheet(ws: Worksheet): string {
  const lines: string[] = [];
  lines.push(`Math Practice Worksheet`);
  lines.push(`Operation: ${OPERATION_LABELS[ws.operation]}`);
  lines.push(`Difficulty: ${DIFFICULTY_PRESETS[ws.difficulty].label}`);
  lines.push(`Range: ${ws.rangeMin} - ${ws.rangeMax}`);
  lines.push(`Problems: ${ws.problems.length}`);
  lines.push(`Seed: ${ws.seed}`);
  lines.push(`Allow negatives: ${ws.allowNegatives ? "yes" : "no"}`);
  lines.push("");
  lines.push("Problems:");
  for (const p of ws.problems) {
    lines.push(renderProblemLine(p, false));
  }
  if (ws.showAnswers) {
    lines.push("");
    lines.push("Answer Key:");
    for (const p of ws.problems) {
      lines.push(renderProblemLine(p, true));
    }
  }
  return lines.join("\n");
}

/** Render worksheet as HTML (printable, 2-column layout). */
export function renderHtmlWorksheet(ws: Worksheet): string {
  const opLabel = OPERATION_LABELS[ws.operation];
  const diffLabel = DIFFICULTY_PRESETS[ws.difficulty].label;
  const problems = ws.problems.map((p) => {
    return `<div class="problem"><span class="num">${p.index}.</span> <span class="eq">${escapeHtml(p.text)}</span> <span class="blank">______</span></div>`;
  }).join("\n");
  const answers = ws.problems.map((p) => {
    return `<div class="answer"><span class="num">${p.index}.</span> ${escapeHtml(p.text)} <strong>${escapeHtml(formatAnswer(p.answer))}</strong></div>`;
  }).join("\n");
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Math Worksheet — ${escapeHtml(opLabel)} — ${escapeHtml(diffLabel)}</title>
<style>
  body { font-family: Georgia, serif; margin: 24px; color: #111; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .meta { font-size: 12px; color: #555; margin-bottom: 16px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 24px; }
  .problem { font-size: 16px; padding: 4px 0; border-bottom: 1px dotted #ddd; }
  .problem .num { display: inline-block; width: 32px; color: #555; }
  .answer-key { margin-top: 32px; page-break-before: always; }
  .answer { font-size: 13px; padding: 2px 0; }
  @media print { .no-print { display: none; } }
</style>
</head>
<body>
  <h1>Math Practice Worksheet</h1>
  <div class="meta">
    Operation: <strong>${escapeHtml(opLabel)}</strong> ·
    Difficulty: <strong>${escapeHtml(diffLabel)}</strong> ·
    Range: ${ws.rangeMin}–${ws.rangeMax} ·
    Problems: ${ws.problems.length} ·
    Seed: ${ws.seed} ·
    Negatives: ${ws.allowNegatives ? "yes" : "no"}
  </div>
  <div class="grid">
${problems}
  </div>
${ws.showAnswers ? `
  <div class="answer-key">
    <h2>Answer Key</h2>
    <div class="grid">
${answers}
    </div>
  </div>
` : ""}
</body>
</html>`;
}

/** Render worksheet as CSV. */
export function renderCsvWorksheet(ws: Worksheet): string {
  const lines = ["index,operation,a,b,answer"];
  for (const p of ws.problems) {
    lines.push([
      p.index, p.op, p.a, p.b, formatAnswer(p.answer),
    ].join(","));
  }
  return lines.join("\n");
}

/** Render worksheet as Markdown (with spoiler answers). */
export function renderMarkdownWorksheet(ws: Worksheet): string {
  const lines: string[] = [];
  lines.push(`# Math Practice Worksheet`);
  lines.push("");
  lines.push(`- **Operation:** ${OPERATION_LABELS[ws.operation]}`);
  lines.push(`- **Difficulty:** ${DIFFICULTY_PRESETS[ws.difficulty].label}`);
  lines.push(`- **Range:** ${ws.rangeMin} – ${ws.rangeMax}`);
  lines.push(`- **Problems:** ${ws.problems.length}`);
  lines.push(`- **Seed:** ${ws.seed}`);
  lines.push(`- **Allow negatives:** ${ws.allowNegatives ? "yes" : "no"}`);
  lines.push("");
  lines.push(`## Problems`);
  lines.push("");
  for (const p of ws.problems) {
    lines.push(`${p.index}. ${p.text} ____`);
  }
  if (ws.showAnswers) {
    lines.push("");
    lines.push(`## Answer Key`);
    lines.push("");
    lines.push(`<details>`);
    lines.push(`<summary>Reveal answers</summary>`);
    lines.push("");
    for (const p of ws.problems) {
      lines.push(`${p.index}. ${p.text} **${formatAnswer(p.answer)}**`);
    }
    lines.push("");
    lines.push(`</details>`);
  }
  return lines.join("\n");
}

/** Escape HTML special chars. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:math-practice-generator:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  operation: OperationType;
  difficulty: DifficultyLevel;
  count: number;
  seed: number;
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

export function buildShareUrl(settings: WorksheetSettings): string {
  const params = new URLSearchParams();
  params.set("op", settings.operation);
  params.set("diff", settings.difficulty);
  params.set("n", String(settings.numberOfProblems));
  if (settings.numberRange) params.set("range", settings.numberRange);
  params.set("neg", settings.allowNegatives ? "1" : "0");
  params.set("ans", settings.showAnswers ? "1" : "0");
  if (settings.seed !== undefined) params.set("seed", String(settings.seed));
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<WorksheetSettings> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Partial<WorksheetSettings> = {};
  const op = params.get("op");
  if (op && ["addition", "subtraction", "multiplication", "division", "mixed"].includes(op)) {
    out.operation = op as OperationType;
  }
  const diff = params.get("diff");
  if (diff && ["easy", "medium", "hard", "expert"].includes(diff)) {
    out.difficulty = diff as DifficultyLevel;
  }
  const n = params.get("n");
  if (n && /^\d+$/.test(n)) out.numberOfProblems = parseInt(n, 10);
  const range = params.get("range");
  if (range) out.numberRange = range;
  const neg = params.get("neg");
  out.allowNegatives = neg === "1";
  const ans = params.get("ans");
  out.showAnswers = ans === "1";
  const seed = params.get("seed");
  if (seed && /^\d+$/.test(seed)) out.seed = parseInt(seed, 10);
  return out;
}

// ---- Defaults ----

export const DEFAULT_SETTINGS: WorksheetSettings = {
  operation: "addition",
  difficulty: "easy",
  numberOfProblems: 20,
  numberRange: "",
  allowNegatives: false,
  showAnswers: true,
};
