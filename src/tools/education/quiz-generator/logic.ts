/**
 * Quiz Generator & Grader — pure logic.
 *
 * Parse questions (pipe-separated or JSON), validate, shuffle questions and
 * options (Fisher-Yates), score the quiz, determine pass/fail, track answers,
 * generate per-question feedback, run a quiz state machine, track time,
 * render printable text/HTML/CSV, history (localStorage), shareable URL,
 * summary stats, true/false → MC auto-converter, presets, difficulty markers.
 *
 * Pure functions only — no DOM, no network.
 */

// ---- Types ----

export type Difficulty = "easy" | "medium" | "hard";

export interface Question {
  id: string;
  question: string;
  options: string[]; // all options (correct + wrongs), already shuffled if requested
  correctIndex: number; // index in options
  difficulty: Difficulty;
}

export interface Quiz {
  title: string;
  questions: Question[];
  passingScore: number; // 0-100
}

export interface AnswerRecord {
  questionId: string;
  selectedIndex: number | null; // null = skipped
  correct: boolean;
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  questionCount: number;
}

export interface QuizState {
  currentIndex: number;
  answers: AnswerRecord[]; // sparse array indexed by question position
  finished: boolean;
  startedAt: number | null;
  endedAt: number | null;
}

export interface QuizSummary {
  total: number;
  answered: number;
  correct: number;
  incorrect: number;
  skipped: number;
  score: number; // 0-100
  passed: boolean;
  durationMs: number;
  byDifficulty: Record<Difficulty, { total: number; correct: number }>;
}

export interface Feedback {
  questionId: string;
  question: string;
  correct: boolean;
  correctAnswer: string;
  selectedAnswer: string | null;
  message: string;
}

export interface HistoryEntry {
  ts: number;
  title: string;
  questionCount: number;
  score: number;
  passed: boolean;
  durationMs: number;
}

// ---- Constants ----

export const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard"];

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

export const DEFAULT_PASSING_SCORE = 70;

export interface QuizPreset {
  id: string;
  name: string;
  description: string;
  questionsText: string; // pipe-separated
}

export const QUIZ_PRESETS: QuizPreset[] = [
  {
    id: "general-knowledge",
    name: "General Knowledge",
    description: "10 mixed trivia questions",
    questionsText: [
      "What is the capital of France?|Paris|London|Berlin|Madrid|easy",
      "Which planet is known as the Red Planet?|Mars|Venus|Jupiter|Saturn|easy",
      "Who painted the Mona Lisa?|Leonardo da Vinci|Picasso|Van Gogh|Michelangelo|medium",
      "What is the largest ocean on Earth?|Pacific|Atlantic|Indian|Arctic|easy",
      "How many continents are there?|7|5|6|8|easy",
      "What is the chemical symbol for gold?|Au|Ag|Gd|Go|medium",
      "Who wrote 'Romeo and Juliet'?|Shakespeare|Dickens|Hemingway|Tolstoy|medium",
      "What is the tallest mountain in the world?|Everest|K2|Kangchenjunga|Denali|medium",
      "In what year did World War II end?|1945|1939|1918|1950|hard",
      "What is the smallest prime number?|2|1|0|3|hard",
    ].join("\n"),
  },
  {
    id: "math",
    name: "Math Basics",
    description: "10 arithmetic and geometry questions",
    questionsText: [
      "What is 7 × 8?|56|54|64|48|easy",
      "What is the square root of 144?|12|14|16|10|medium",
      "How many degrees in a triangle?|180|360|90|270|easy",
      "What is 15% of 200?|30|20|45|15|medium",
      "What is the value of π (to 2 decimals)?|3.14|3.41|3.16|2.14|medium",
      "What is 9² ?|81|72|99|18|easy",
      "How many sides does a hexagon have?|6|5|7|8|easy",
      "What is 100 ÷ 4?|25|20|40|50|easy",
      "What is the next prime after 7?|11|9|13|8|hard",
      "What is 12! / 10!?|132|120|110|144|hard",
    ].join("\n"),
  },
  {
    id: "geography",
    name: "World Geography",
    description: "10 geography questions",
    questionsText: [
      "What is the longest river in the world?|Nile|Amazon|Yangtze|Mississippi|medium",
      "Which country has the most population?|India|China|USA|Indonesia|medium",
      "What is the smallest country in the world?|Vatican City|Monaco|San Marino|Liechtenstein|hard",
      "Which desert is the largest in the world?|Sahara|Gobi|Antarctic|Arabian|medium",
      "Mount Everest is located in which mountain range?|Himalayas|Andes|Alps|Rockies|easy",
      "What is the capital of Australia?|Canberra|Sydney|Melbourne|Perth|medium",
      "Which African country has the most pyramids?|Sudan|Egypt|Libya|Morocco|hard",
      "Lake Baikal is in which country?|Russia|China|Mongolia|Kazakhstan|medium",
      "Which US state is the largest by area?|Alaska|Texas|California|Montana|medium",
      "The Amazon river primarily flows through which country?|Brazil|Peru|Colombia|Ecuador|easy",
    ].join("\n"),
  },
  {
    id: "science",
    name: "Science Fundamentals",
    description: "10 science questions across physics, chemistry, biology",
    questionsText: [
      "What gas do plants absorb from the atmosphere?|Carbon dioxide|Oxygen|Nitrogen|Hydrogen|easy",
      "What is the powerhouse of the cell?|Mitochondria|Nucleus|Ribosome|Chloroplast|medium",
      "What is the speed of light (approx, km/s)?|300,000|150,000|1,000,000|30,000|medium",
      "What is the most abundant gas in Earth's atmosphere?|Nitrogen|Oxygen|Carbon dioxide|Argon|medium",
      "Who developed the theory of relativity?|Einstein|Newton|Tesla|Galileo|easy",
      "What is the pH of pure water?|7|0|14|1|medium",
      "What is the atomic number of carbon?|6|12|8|4|hard",
      "What type of energy is stored in a battery?|Chemical|Kinetic|Thermal|Nuclear|medium",
      "How many bones are in the adult human body?|206|201|210|196|hard",
      "What is Newton's first law about?|Inertia|Gravity|Action-reaction|Energy|medium",
    ].join("\n"),
  },
];

// ---- Normalization ----

/** Trim + collapse whitespace. */
export function normalizeText(s: string): string {
  return (s || "").replace(/\s+/g, " ").trim();
}

/** Detect if a string is a valid difficulty. */
export function isDifficulty(s: string): s is Difficulty {
  return s === "easy" || s === "medium" || s === "hard";
}

/** Detect a true/false value. */
export function isTrueFalse(s: string): boolean {
  const v = (s || "").trim().toLowerCase();
  return v === "true" || v === "false" || v === "t" || v === "f";
}

/** Make a stable id for a question. */
export function makeQuestionId(q: string, idx: number): string {
  const safe = (q || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return safe ? `${safe.slice(0, 40)}-${idx}` : `q-${idx}`;
}

/** Build a Question object. */
export function makeQuestion(
  question: string,
  options: string[],
  correctIndex: number,
  difficulty: Difficulty = "medium",
  idx: number = 0,
): Question {
  return {
    id: makeQuestionId(question, idx),
    question: normalizeText(question),
    options: options.map(normalizeText),
    correctIndex,
    difficulty,
  };
}

/**
 * Convert a true/false question to a 2-option MC question.
 * If isTrue is true, "True" is the correct option.
 */
export function convertTrueFalseToMC(
  question: string,
  isTrue: boolean,
  difficulty: Difficulty = "medium",
  idx: number = 0,
): Question {
  const options = ["True", "False"];
  return makeQuestion(question, options, isTrue ? 0 : 1, difficulty, idx);
}

// ---- Question parser (multi-format) ----

/** Try parsing JSON array of questions. Returns null if not JSON. */
export function parseJsonQuestions(text: string): Question[] | null {
  const t = (text || "").trim();
  if (!t.startsWith("[") && !t.startsWith("{")) return null;
  let data: unknown;
  try {
    data = JSON.parse(t);
  } catch {
    return null;
  }
  const arr = Array.isArray(data) ? data : [data];
  const out: Question[] = [];
  arr.forEach((item, idx) => {
    if (!item || typeof item !== "object") return;
    const rec = item as Record<string, unknown>;
    const question = typeof rec.question === "string" ? rec.question : "";
    if (!question) return;
    let options: string[] = [];
    let correctIndex = -1;
    if (Array.isArray(rec.options)) {
      options = (rec.options as unknown[]).map(String);
    }
    if (typeof rec.correctIndex === "number") {
      correctIndex = rec.correctIndex;
    } else if (typeof rec.correct === "string") {
      correctIndex = options.indexOf(rec.correct);
    }
    if (options.length < 2 || correctIndex < 0 || correctIndex >= options.length) return;
    const diffRaw = typeof rec.difficulty === "string" ? rec.difficulty : "medium";
    out.push(makeQuestion(question, options, correctIndex, isDifficulty(diffRaw) ? diffRaw : "medium", idx));
  });
  return out;
}

/**
 * Parse questions from text. Auto-detects format:
 *  - JSON array → parsed as JSON
 *  - Lines: pipe-separated:
 *      question|correct|wrong1|wrong2|wrong3[|difficulty]
 *      question|true|false   (T/F auto-conversion when both fields are true/false)
 *      question|true         (T/F auto-conversion when only correct field is true/false)
 *
 * Empty lines and lines starting with `#` are skipped.
 */
export function parseQuestions(text: string): Question[] {
  if (!text) return [];
  const trimmed = text.trim();
  const json = parseJsonQuestions(trimmed);
  if (json) return json;

  const out: Question[] = [];
  const lines = trimmed.split(/\r?\n/);
  let idx = 0;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    if (!line.includes("|")) continue;

    const parts = line.split("|").map((s) => s.trim());
    const question = parts[0] || "";
    if (!question) continue;

    // Check if last field is a difficulty
    let difficulty: Difficulty = "medium";
    let fieldCount = parts.length;
    if (parts.length >= 3 && isDifficulty(parts[parts.length - 1])) {
      difficulty = parts[parts.length - 1] as Difficulty;
      fieldCount = parts.length - 1;
    }

    // fieldCount includes question (index 0) and correct (index 1)
    if (fieldCount < 3) {
      // 2 fields: question | correct — must be true/false
      const correctRaw = parts[1] || "";
      if (isTrueFalse(correctRaw)) {
        const isTrue = correctRaw.toLowerCase() === "true" || correctRaw.toLowerCase() === "t";
        out.push(convertTrueFalseToMC(question, isTrue, difficulty, idx));
        idx += 1;
      }
      // otherwise skip — invalid
      continue;
    }

    // True/false detection: question|true|false
    if (fieldCount === 3 && isTrueFalse(parts[1]) && isTrueFalse(parts[2])) {
      const isTrue = parts[1].toLowerCase() === "true" || parts[1].toLowerCase() === "t";
      out.push(convertTrueFalseToMC(question, isTrue, difficulty, idx));
      idx += 1;
      continue;
    }

    // Standard MC: question|correct|wrong1|wrong2|wrong3
    const correct = parts[1] || "";
    const wrongs = parts.slice(2, fieldCount).filter((p) => p.length > 0);
    const options = [correct, ...wrongs];
    if (options.length < 2) continue;
    out.push(makeQuestion(question, options, 0, difficulty, idx));
    idx += 1;
  }
  return out;
}

// ---- Validator ----

/** Validate a quiz: title required, >=1 question, each has >=2 options and valid correctIndex. */
export function validateQuiz(quiz: Quiz): ValidationResult {
  const errors: string[] = [];
  if (!quiz.title.trim()) errors.push("Quiz title is required");
  if (!quiz.questions || quiz.questions.length === 0) {
    errors.push("Quiz must contain at least 1 question");
    return { ok: false, errors, questionCount: 0 };
  }
  if (quiz.passingScore < 0 || quiz.passingScore > 100) {
    errors.push("Passing score must be between 0 and 100");
  }
  quiz.questions.forEach((q, i) => {
    if (!q.question.trim()) errors.push(`Question ${i + 1}: question text is empty`);
    if (q.options.length < 2) errors.push(`Question ${i + 1}: needs at least 2 options`);
    if (q.correctIndex < 0 || q.correctIndex >= q.options.length) {
      errors.push(`Question ${i + 1}: correctIndex out of range`);
    }
    const nonEmpty = q.options.filter((o) => o.trim().length > 0).length;
    if (nonEmpty !== q.options.length) {
      errors.push(`Question ${i + 1}: has empty option(s)`);
    }
  });
  return { ok: errors.length === 0, errors, questionCount: quiz.questions.length };
}

// ---- Shufflers (Fisher-Yates, pure) ----

/** Fisher-Yates shuffle returning a new array. */
export function shuffle<T>(arr: T[], rng: () => number = Math.random): T[] {
  if (!arr || arr.length <= 1) return arr ? [...arr] : [];
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Shuffle the order of questions in a quiz (returns new Question[]). */
export function shuffleQuestions(questions: Question[], rng: () => number = Math.random): Question[] {
  return shuffle(questions, rng);
}

/** Shuffle the options of a single question (correct answer moves to a new position). */
export function shuffleOptions(question: Question, rng: () => number = Math.random): Question {
  if (question.options.length <= 1) return { ...question, options: [...question.options] };
  const correctText = question.options[question.correctIndex];
  const shuffled = shuffle(question.options, rng);
  const newCorrectIndex = shuffled.indexOf(correctText);
  return {
    ...question,
    options: shuffled,
    correctIndex: newCorrectIndex,
  };
}

/** Shuffle options for every question in a list. */
export function shuffleAllOptions(questions: Question[], rng: () => number = Math.random): Question[] {
  return questions.map((q) => shuffleOptions(q, rng));
}

// ---- Score calculator ----

/** Calculate score as percentage: (correct / total) * 100, rounded to 1 decimal. */
export function calculateScore(correct: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((correct / total) * 1000) / 10;
}

// ---- Pass/fail determiner ----

/** Determine pass/fail based on score and passing threshold. */
export function determinePassFail(score: number, passingScore: number): boolean {
  return score >= passingScore;
}

// ---- Answer tracker ----

/** Record a user's answer for a question (returns a new AnswerRecord). */
export function recordAnswer(
  questionId: string,
  selectedIndex: number | null,
  correctIndex: number,
): AnswerRecord {
  return {
    questionId,
    selectedIndex,
    correct: selectedIndex !== null && selectedIndex === correctIndex,
  };
}

/** Tally answers to compute correct/incorrect/skipped counts. */
export function tallyAnswers(answers: AnswerRecord[]): {
  correct: number;
  incorrect: number;
  skipped: number;
  answered: number;
} {
  let correct = 0;
  let incorrect = 0;
  let skipped = 0;
  for (const a of answers) {
    if (a.selectedIndex === null) skipped += 1;
    else if (a.correct) correct += 1;
    else incorrect += 1;
  }
  return { correct, incorrect, skipped, answered: correct + incorrect };
}

// ---- Per-question feedback ----

/** Generate human-readable feedback for a question. */
export function generateFeedback(
  question: Question,
  answer: AnswerRecord,
): Feedback {
  const correctAnswer = question.options[question.correctIndex] ?? "";
  const selectedAnswer = answer.selectedIndex !== null
    ? (question.options[answer.selectedIndex] ?? "")
    : null;
  let message: string;
  if (answer.selectedIndex === null) {
    message = `Skipped. Correct answer: ${correctAnswer}`;
  } else if (answer.correct) {
    message = `Correct! Answer: ${correctAnswer}`;
  } else {
    message = `Incorrect. You answered: ${selectedAnswer}. Correct: ${correctAnswer}`;
  }
  return {
    questionId: question.id,
    question: question.question,
    correct: answer.correct,
    correctAnswer,
    selectedAnswer,
    message,
  };
}

/** Generate feedback for all answered questions. */
export function generateAllFeedback(
  questions: Question[],
  answers: AnswerRecord[],
): Feedback[] {
  return questions.map((q, i) => {
    const a = answers[i] ?? { questionId: q.id, selectedIndex: null, correct: false };
    return generateFeedback(q, a);
  });
}

// ---- Quiz state machine ----

/** Initialize the quiz state with the current question = 0 and empty answers. */
export function initQuizState(totalQuestions: number, now: number = Date.now()): QuizState {
  return {
    currentIndex: 0,
    answers: new Array(totalQuestions).fill(null),
    finished: false,
    startedAt: now,
    endedAt: null,
  };
}

/** Answer the current question and (optionally) advance. Returns a new state. */
export function answerQuestion(
  state: QuizState,
  questionPosition: number,
  selectedIndex: number,
  question: Question,
  advance: boolean = true,
  total: number = state.answers.length,
): QuizState {
  const record = recordAnswer(question.id, selectedIndex, question.correctIndex);
  const answers = [...state.answers];
  answers[questionPosition] = record;
  const nextIndex = advance
    ? Math.min(questionPosition + 1, total - 1)
    : questionPosition;
  return {
    ...state,
    answers,
    currentIndex: nextIndex,
  };
}

/** Skip the current question (records null selected index). */
export function skipQuestion(
  state: QuizState,
  questionPosition: number,
  question: Question,
  advance: boolean = true,
  total: number = state.answers.length,
): QuizState {
  const record: AnswerRecord = {
    questionId: question.id,
    selectedIndex: null,
    correct: false,
  };
  const answers = [...state.answers];
  answers[questionPosition] = record;
  const nextIndex = advance
    ? Math.min(questionPosition + 1, total - 1)
    : questionPosition;
  return { ...state, answers, currentIndex: nextIndex };
}

/** Move to a specific question index. */
export function goToQuestion(state: QuizState, index: number, total: number): QuizState {
  if (index < 0 || index >= total) return state;
  return { ...state, currentIndex: index };
}

/** Mark the quiz as finished. */
export function finishQuiz(state: QuizState, now: number = Date.now()): QuizState {
  return { ...state, finished: true, endedAt: now };
}

/** Check if the quiz is finished. */
export function isFinished(state: QuizState): boolean {
  return state.finished;
}

// ---- Time tracker ----

/** Record a start timestamp. */
export function recordStart(now: number = Date.now()): number {
  return now;
}

/** Record an end timestamp. */
export function recordEnd(now: number = Date.now()): number {
  return now;
}

/** Compute duration in milliseconds. */
export function computeDuration(start: number | null, end: number | null): number {
  if (start === null || end === null) return 0;
  if (end < start) return 0;
  return end - start;
}

/** Format a duration (ms) as mm:ss. */
export function formatDuration(ms: number): string {
  if (ms <= 0) return "0:00";
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ---- Summary stats ----

/** Compute full summary stats for a finished quiz. */
export function computeSummary(
  questions: Question[],
  answers: AnswerRecord[],
  passingScore: number,
  durationMs: number,
): QuizSummary {
  const tally = tallyAnswers(answers);
  const total = questions.length;
  const score = calculateScore(tally.correct, total);
  const passed = determinePassFail(score, passingScore);
  const byDifficulty: Record<Difficulty, { total: number; correct: number }> = {
    easy: { total: 0, correct: 0 },
    medium: { total: 0, correct: 0 },
    hard: { total: 0, correct: 0 },
  };
  questions.forEach((q, i) => {
    byDifficulty[q.difficulty].total += 1;
    if (answers[i]?.correct) byDifficulty[q.difficulty].correct += 1;
  });
  return {
    total,
    answered: tally.answered,
    correct: tally.correct,
    incorrect: tally.incorrect,
    skipped: tally.skipped,
    score,
    passed,
    durationMs,
    byDifficulty,
  };
}

// ---- Renderers ----

/** Render the quiz as plain text (printable answer key / student copy). */
export function renderText(quiz: Quiz, withAnswers: boolean = false): string {
  const lines: string[] = [quiz.title, ""];
  quiz.questions.forEach((q, i) => {
    lines.push(`${i + 1}. ${q.question}`);
    q.options.forEach((opt, j) => {
      const marker = withAnswers && j === q.correctIndex ? "✓" : "  ";
      lines.push(`   ${marker} ${String.fromCharCode(65 + j)}) ${opt}`);
    });
    lines.push("");
  });
  return lines.join("\n");
}

/** Escape an HTML attribute/text value. */
function escapeHtml(s: string): string {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Render the quiz as a standalone printable HTML document (inline CSS). */
export function renderHtml(quiz: Quiz, withAnswers: boolean = false): string {
  const q = quiz.questions.map((question, i) => {
    const options = question.options.map((opt, j) => {
      const isCorrect = withAnswers && j === question.correctIndex;
      const cls = isCorrect ? "option correct" : "option";
      return `<li class="${cls}"><strong>${String.fromCharCode(65 + j)})</strong> ${escapeHtml(opt)}</li>`;
    }).join("\n      ");
    return `<div class="question">
    <h3>${i + 1}. ${escapeHtml(question.question)} <span class="difficulty">${DIFFICULTY_LABELS[question.difficulty]}</span></h3>
    <ol class="options" type="A">
      ${options}
    </ol>
  </div>`;
  }).join("\n  ");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(quiz.title)}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; max-width: 760px; margin: 2rem auto; padding: 0 1rem; color: #1a1a1a; line-height: 1.5; }
  h1 { border-bottom: 2px solid #444; padding-bottom: .5rem; }
  .question { margin-bottom: 1.5rem; padding: 1rem; border: 1px solid #ddd; border-radius: 6px; }
  .question h3 { margin: 0 0 .5rem; font-size: 1rem; }
  .options { margin: .25rem 0 0 1.5rem; padding: 0; }
  .option { padding: .25rem 0; list-style: upper-alpha; }
  .option.correct { background: #d4f7d4; font-weight: 600; }
  .difficulty { font-size: .7rem; background: #eee; padding: .1rem .4rem; border-radius: 3px; margin-left: .5rem; vertical-align: middle; text-transform: uppercase; }
  @media print { .question { break-inside: avoid; } }
</style>
</head>
<body>
  <h1>${escapeHtml(quiz.title)}</h1>
  <p>Total questions: ${quiz.questions.length} · Passing score: ${quiz.passingScore}%</p>
  ${q}
</body>
</html>`;
}

/** Escape a CSV field. */
function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Render the quiz as CSV: question, correct_answer, options, difficulty. */
export function renderCsv(quiz: Quiz): string {
  const lines = ["question,correct_answer,option_b,option_c,option_d,difficulty"];
  for (const q of quiz.questions) {
    const correct = q.options[q.correctIndex] ?? "";
    const wrongs = q.options.filter((_, i) => i !== q.correctIndex);
    const row = [
      escapeCsv(q.question),
      escapeCsv(correct),
      escapeCsv(wrongs[0] ?? ""),
      escapeCsv(wrongs[1] ?? ""),
      escapeCsv(wrongs[2] ?? ""),
      q.difficulty,
    ];
    lines.push(row.join(","));
  }
  return lines.join("\n");
}

/** Render the original pipe-separated source (for re-import). */
export function renderSource(quiz: Quiz): string {
  return quiz.questions.map((q) => {
    const correct = q.options[q.correctIndex];
    const wrongs = q.options.filter((_, i) => i !== q.correctIndex);
    return [q.question, correct, ...wrongs, q.difficulty].join("|");
  }).join("\n");
}

// ---- Presets ----

/** Get a quiz preset by id. */
export function getQuizPreset(id: string): QuizPreset | undefined {
  return QUIZ_PRESETS.find((p) => p.id === id);
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:quiz-generator:history";
const HISTORY_MAX = 20;

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

/**
 * Build a shareable URL with quiz title + questions encoded in the hash.
 * Uses base64url for the questions text.
 */
export function buildShareUrl(
  title: string,
  questionsText: string,
  passingScore: number,
  shuffleQuestionsFlag: boolean,
  shuffleOptionsFlag: boolean,
): string {
  const params = new URLSearchParams();
  if (title) params.set("title", title);
  params.set("pass", String(passingScore));
  if (shuffleQuestionsFlag) params.set("sq", "1");
  if (shuffleOptionsFlag) params.set("so", "1");
  if (questionsText) {
    try {
      const b64 = typeof btoa !== "undefined"
        ? btoa(unescape(encodeURIComponent(questionsText)))
        : Buffer.from(questionsText, "utf8").toString("base64");
      params.set("d", b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""));
    } catch {
      params.set("t", questionsText);
    }
  }
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export interface ShareParams {
  title: string;
  questionsText: string;
  passingScore: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
}

/** Parse a shareable URL hash back into params. */
export function parseShareUrl(hash: string): ShareParams {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) {
    return {
      title: "",
      questionsText: "",
      passingScore: DEFAULT_PASSING_SCORE,
      shuffleQuestions: false,
      shuffleOptions: false,
    };
  }
  const params = new URLSearchParams(clean);
  const title = params.get("title") ?? "";
  const passRaw = params.get("pass");
  const passingScore = passRaw && !Number.isNaN(Number(passRaw))
    ? Math.max(0, Math.min(100, Number(passRaw)))
    : DEFAULT_PASSING_SCORE;
  const sq = params.get("sq") === "1";
  const so = params.get("so") === "1";

  let questionsText = "";
  const d = params.get("d");
  if (d) {
    try {
      const b64 = d.replace(/-/g, "+").replace(/_/g, "/");
      const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
      questionsText = typeof atob !== "undefined"
        ? decodeURIComponent(escape(atob(padded)))
        : Buffer.from(padded, "base64").toString("utf8");
    } catch {
      questionsText = "";
    }
  } else {
    questionsText = params.get("t") ?? "";
  }
  return {
    title,
    questionsText,
    passingScore,
    shuffleQuestions: sq,
    shuffleOptions: so,
  };
}
