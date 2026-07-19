/**
 * Typing Practice & WPM Test — pure logic.
 *
 * 5 practice modes (timed 1/3/5 min, custom text, word-count), 5 text types
 * (common words, quotes, code snippets, numbers, custom), built-in word/quote/
 * code pools, WPM + accuracy + error calculators, per-character diff,
 * time formatter, case-insensitive mode, cursor position tracker, test state
 * machine, history (localStorage), text/CSV renderers, shareable URL,
 * summary stats, net WPM.
 *
 * Pure functions only — no DOM, no network.
 */

// ---- Types ----

export type PracticeMode = "timed-1min" | "timed-3min" | "timed-5min" | "custom-text" | "word-count";

export type TextType = "common-words" | "quotes" | "code-snippets" | "numbers" | "custom";

export type TestState = "idle" | "running" | "finished";

export interface CharDiff {
  index: number;
  expected: string;
  actual: string | null; // null = missed (user didn't type this)
  status: "correct" | "incorrect" | "missed" | "extra";
}

export interface DiffResult {
  correctCount: number;
  incorrectCount: number;
  missedCount: number;
  extraCount: number;
  chars: CharDiff[];
}

export interface TypingResult {
  id: string;
  ts: number;
  mode: PracticeMode;
  textType: TextType;
  wpm: number;
  netWpm: number;
  accuracy: number;
  errors: number;
  durationMs: number;
  correctChars: number;
  totalTyped: number;
  targetTextLength: number;
  caseSensitive: boolean;
}

export interface SummaryStats {
  totalTests: number;
  bestWpm: number;
  avgWpm: number;
  avgAccuracy: number;
  avgNetWpm: number;
  totalErrors: number;
  totalDurationMs: number;
  recentTrend: number[]; // last 10 WPMs, oldest→newest
}

export interface HistoryEntry {
  ts: number;
  mode: PracticeMode;
  textType: TextType;
  wpm: number;
  accuracy: number;
  errors: number;
  durationMs: number;
}

export interface Settings {
  practiceMode: PracticeMode;
  textType: TextType;
  customText: string;
  wordCount: number;
  caseSensitive: boolean;
}

// ---- Constants ----

export const HISTORY_KEY = "unqtools:typing-practice:history";
export const HISTORY_MAX = 20;

export const PRACTICE_MODES: PracticeMode[] = [
  "timed-1min", "timed-3min", "timed-5min", "custom-text", "word-count",
];

export const PRACTICE_MODE_LABELS: Record<PracticeMode, string> = {
  "timed-1min": "Timed — 1 minute",
  "timed-3min": "Timed — 3 minutes",
  "timed-5min": "Timed — 5 minutes",
  "custom-text": "Custom text",
  "word-count": "Word count",
};

export const TEXT_TYPES: TextType[] = [
  "common-words", "quotes", "code-snippets", "numbers", "custom",
];

export const TEXT_TYPE_LABELS: Record<TextType, string> = {
  "common-words": "Common words",
  "quotes": "Famous quotes",
  "code-snippets": "Code snippets",
  "numbers": "Numbers",
  "custom": "Custom",
};

export const DEFAULT_SETTINGS: Settings = {
  practiceMode: "timed-1min",
  textType: "common-words",
  customText: "",
  wordCount: 50,
  caseSensitive: false,
};

export const TIMED_MODE_DURATIONS_MS: Record<"timed-1min" | "timed-3min" | "timed-5min", number> = {
  "timed-1min": 60_000,
  "timed-3min": 180_000,
  "timed-5min": 300_000,
};

// ---- Built-in pools ----

export const COMMON_WORDS_POOL: string[] = [
  "the","be","to","of","and","a","in","that","have","it","for","not","on","with","he","as","you","do","at",
  "this","but","his","by","from","they","we","say","her","she","or","an","will","my","one","all","would",
  "there","their","what","so","up","out","if","about","who","get","which","go","me","when","make","can",
  "like","time","no","just","him","know","take","people","into","year","your","good","some","could","them",
  "see","other","than","then","now","look","only","come","its","over","think","also","back","after","use",
  "two","how","our","work","first","well","way","even","new","want","because","any","these","give","day",
  "most","us","great","big","small","old","new","fast","slow","high","low","near","far","wide","narrow",
  "open","close","start","stop","begin","end","above","below","before","early","late","long","short","deep",
  "shallow","rich","poor","full","empty","strong","weak","hard","soft","bright","dark","warm","cool","dry",
  "wet","clean","dirty","safe","free","busy","easy","difficult","simple","complex","quiet","loud","smooth",
  "rough","sharp","dull","light","heavy","fresh","sweet","sour","bitter","plain","fancy","clean","warm",
  "cool","idea","story","place","word","letter","number","name","color","shape","sound","music","game",
  "play","read","write","draw","sing","dance","cook","drive","walk","run","jump","swim","fly","sleep",
  "wake","laugh","smile","cry","talk","listen","watch","learn","teach","build","break","fix","make",
];

export const QUOTES_POOL: string[] = [
  "The only way to do great work is to love what you do.",
  "In the middle of difficulty lies opportunity.",
  "Life is what happens when you're busy making other plans.",
  "The future belongs to those who believe in the beauty of their dreams.",
  "It does not matter how slowly you go as long as you do not stop.",
  "The journey of a thousand miles begins with a single step.",
  "Whether you think you can or you think you can't, you're right.",
  "The only limit to our realization of tomorrow is our doubts of today.",
  "Success is not final, failure is not fatal: it is the courage to continue that counts.",
  "Believe you can and you're halfway there.",
  "The best time to plant a tree was 20 years ago. The second best time is now.",
  "Your time is limited, so don't waste it living someone else's life.",
  "The mind is everything. What you think you become.",
  "An unexamined life is not worth living.",
  "If you want to lift yourself up, lift up someone else.",
  "I have not failed. I've just found 10,000 ways that won't work.",
  "The man who moves a mountain begins by carrying away small stones.",
  "Well done is better than well said.",
  "Tell me and I forget. Teach me and I remember. Involve me and I learn.",
  "It is during our darkest moments that we must focus to see the light.",
  "The wound is the place where the Light enters you.",
  "What we think, we become.",
];

export const CODE_SNIPPETS_POOL: string[] = [
  "const sum = (a, b) => a + b;",
  "function fibonacci(n) { return n < 2 ? n : fibonacci(n - 1) + fibonacci(n - 2); }",
  "const arr = [1, 2, 3].map(x => x * 2).filter(x => x > 2);",
  "for (let i = 0; i < 10; i++) { console.log(`Index: ${i}`); }",
  "const obj = { name: 'Alice', age: 30, city: 'NYC' };",
  "if (condition) { doSomething(); } else { doOtherThing(); }",
  "const promise = new Promise((resolve, reject) => { resolve(42); });",
  "def greet(name): return f'Hello, {name}!'",
  "def factorial(n): return 1 if n <= 1 else n * factorial(n - 1)",
  "list_comprehension = [x ** 2 for x in range(10) if x % 2 == 0]",
  "for item in items: print(item)",
  "class Dog: def __init__(self, name): self.name = name",
];

// ---- Random helpers (pure: accept an rng) ----

/** Fisher-Yates shuffle (pure). */
export function shuffle<T>(arr: T[], rng: () => number = Math.random): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Pick N random items from an array (with replacement if N > length). */
export function pickRandom<T>(arr: T[], n: number, rng: () => number = Math.random): T[] {
  if (arr.length === 0) return [];
  if (n <= 0) return [];
  const out: T[] = [];
  for (let i = 0; i < n; i++) {
    out.push(arr[Math.floor(rng() * arr.length)]);
  }
  return out;
}

/** Generate a random digit string of given length. */
export function randomDigits(length: number, rng: () => number = Math.random): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += String(Math.floor(rng() * 10));
    if (i < length - 1 && (i + 1) % 3 === 0) out += " ";
  }
  return out;
}

// ---- Text generation ----

/** Generate text for the chosen text type and mode. */
export function generateText(
  textType: TextType,
  mode: PracticeMode,
  customText: string,
  wordCount: number,
  rng: () => number = Math.random,
): string {
  if (textType === "custom") {
    return (customText || "").trim();
  }
  // For timed modes, we need more text; estimate ~3 chars/word at 100 WPM
  // For word-count mode, use exactly wordCount words
  const targetWords = mode === "word-count"
    ? Math.max(1, wordCount)
    : mode === "timed-1min" ? 80
      : mode === "timed-3min" ? 200
        : 350; // timed-5min + custom-text fallback

  if (textType === "common-words") {
    const picked = pickRandom(COMMON_WORDS_POOL, targetWords, rng);
    return picked.join(" ");
  }
  if (textType === "quotes") {
    // Repeat quotes to fill target word count
    const shuffled = shuffle(QUOTES_POOL, rng);
    const out: string[] = [];
    let count = 0;
    let i = 0;
    while (count < targetWords && out.length < 100) {
      const q = shuffled[i % shuffled.length];
      out.push(q);
      count += q.split(/\s+/).length;
      i++;
      if (i >= shuffled.length * 5) break; // safety
    }
    return out.join(" ");
  }
  if (textType === "code-snippets") {
    const shuffled = shuffle(CODE_SNIPPETS_POOL, rng);
    return shuffled.slice(0, Math.max(1, Math.ceil(targetWords / 8))).join("\n");
  }
  if (textType === "numbers") {
    // Generate groups of 3-digit sequences
    const groups = Math.max(5, Math.ceil(targetWords / 2));
    const parts: string[] = [];
    for (let i = 0; i < groups; i++) {
      parts.push(randomDigits(3, rng));
    }
    return parts.join("  ");
  }
  return "";
}

// ---- Text normalization ----

/** Normalize target text for comparison (case-insensitive mode lowercases). */
export function normalizeTarget(text: string, caseSensitive: boolean): string {
  if (caseSensitive) return text;
  return text.toLowerCase();
}

/** Normalize user input for comparison. */
export function normalizeInput(text: string, caseSensitive: boolean): string {
  if (caseSensitive) return text;
  return text.toLowerCase();
}

// ---- Diff ----

/** Compute per-character diff between target and user input. */
export function computeDiff(target: string, input: string): DiffResult {
  const targetLen = target.length;
  const inputLen = input.length;
  const chars: CharDiff[] = [];
  let correctCount = 0;
  let incorrectCount = 0;
  let missedCount = 0;
  let extraCount = 0;
  const minLen = Math.min(targetLen, inputLen);
  for (let i = 0; i < minLen; i++) {
    const expected = target[i];
    const actual = input[i];
    if (expected === actual) {
      chars.push({ index: i, expected, actual, status: "correct" });
      correctCount++;
    } else {
      chars.push({ index: i, expected, actual, status: "incorrect" });
      incorrectCount++;
    }
  }
  // Missed: target chars user never reached
  for (let i = minLen; i < targetLen; i++) {
    chars.push({ index: i, expected: target[i], actual: null, status: "missed" });
    missedCount++;
  }
  // Extra: user typed more than target
  for (let i = minLen; i < inputLen; i++) {
    chars.push({ index: i, expected: "", actual: input[i], status: "extra" });
    extraCount++;
  }
  return { correctCount, incorrectCount, missedCount, extraCount, chars };
}

// ---- WPM / accuracy / errors ----

/** Calculate gross WPM: (correctChars / 5) / minutesElapsed. */
export function calculateWpm(correctChars: number, durationMs: number): number {
  if (durationMs <= 0) return 0;
  const minutes = durationMs / 60_000;
  if (minutes <= 0) return 0;
  return Math.round((correctChars / 5) / minutes * 10) / 10;
}

/** Calculate accuracy: correctChars / totalTyped × 100. */
export function calculateAccuracy(correctChars: number, totalTyped: number): number {
  if (totalTyped <= 0) return 100;
  return Math.round((correctChars / totalTyped) * 1000) / 10;
}

/** Count errors: incorrect + extra characters typed. */
export function countErrors(diff: DiffResult): number {
  return diff.incorrectCount + diff.extraCount;
}

/** Calculate net WPM: gross - (errors / minutes / 5). */
export function calculateNetWpm(correctChars: number, errors: number, durationMs: number): number {
  if (durationMs <= 0) return 0;
  const minutes = durationMs / 60_000;
  if (minutes <= 0) return 0;
  const gross = (correctChars / 5) / minutes;
  const penalty = errors / 5 / minutes;
  return Math.max(0, Math.round((gross - penalty) * 10) / 10);
}

// ---- Time formatter ----

/** Format milliseconds as MM:SS. */
export function formatTime(ms: number): string {
  if (ms < 0) ms = 0;
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ---- Cursor position tracker ----

/** Get the current cursor position (capped at target length). */
export function getCursorIndex(inputLength: number, targetLength: number): number {
  return Math.min(inputLength, targetLength);
}

/** Get remaining characters to type. */
export function getRemainingChars(inputLength: number, targetLength: number): number {
  return Math.max(0, targetLength - inputLength);
}

// ---- Test state machine ----

export interface TestStateMachine {
  state: TestState;
  startedAt: number | null;
  endedAt: number | null;
}

export function initTestState(): TestStateMachine {
  return { state: "idle", startedAt: null, endedAt: null };
}

export function startTest(state: TestStateMachine, now: number = Date.now()): TestStateMachine {
  if (state.state === "running") return state;
  return { state: "running", startedAt: now, endedAt: null };
}

export function finishTest(state: TestStateMachine, now: number = Date.now()): TestStateMachine {
  if (state.state === "finished") return state;
  return { state: "finished", startedAt: state.startedAt ?? now, endedAt: now };
}

export function resetTest(): TestStateMachine {
  return initTestState();
}

export function isFinished(state: TestStateMachine): boolean {
  return state.state === "finished";
}

export function isRunning(state: TestStateMachine): boolean {
  return state.state === "running";
}

export function computeDuration(state: TestStateMachine, now: number = Date.now()): number {
  if (state.startedAt == null) return 0;
  const end = state.endedAt ?? now;
  return Math.max(0, end - state.startedAt);
}

// ---- Renderers ----

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Render a single result as a human-readable text report. */
export function renderTextReport(result: TypingResult): string {
  const lines = [
    "=== Typing Test Result ===",
    `Mode: ${PRACTICE_MODE_LABELS[result.mode]}`,
    `Text type: ${TEXT_TYPE_LABELS[result.textType]}`,
    `Duration: ${formatTime(result.durationMs)}`,
    `Gross WPM: ${result.wpm}`,
    `Net WPM: ${result.netWpm}`,
    `Accuracy: ${result.accuracy}%`,
    `Errors: ${result.errors}`,
    `Correct chars: ${result.correctChars}`,
    `Total typed: ${result.totalTyped}`,
    `Target length: ${result.targetTextLength}`,
    `Case sensitive: ${result.caseSensitive ? "yes" : "no"}`,
    `Date: ${new Date(result.ts).toLocaleString()}`,
  ];
  return lines.join("\n");
}

/** Render history as CSV (test_id, ts, wpm, accuracy, errors, duration, mode, text_type). */
export function renderCsv(results: TypingResult[]): string {
  const lines = ["test_id,ts,wpm,net_wpm,accuracy,errors,duration_ms,mode,text_type"];
  for (const r of results) {
    lines.push([
      escapeCsv(r.id),
      String(r.ts),
      String(r.wpm),
      String(r.netWpm),
      String(r.accuracy),
      String(r.errors),
      String(r.durationMs),
      r.mode,
      r.textType,
    ].join(","));
  }
  return lines.join("\n");
}

/** Render a summary stats report as text. */
export function renderSummaryText(stats: SummaryStats): string {
  const lines = [
    "=== Typing Test Summary ===",
    `Total tests: ${stats.totalTests}`,
    `Best WPM: ${stats.bestWpm}`,
    `Average WPM: ${stats.avgWpm}`,
    `Average net WPM: ${stats.avgNetWpm}`,
    `Average accuracy: ${stats.avgAccuracy}%`,
    `Total errors: ${stats.totalErrors}`,
    `Total practice time: ${formatTime(stats.totalDurationMs)}`,
    `Recent WPM trend: ${stats.recentTrend.join(", ") || "—"}`,
  ];
  return lines.join("\n");
}

// ---- Summary stats ----

export function computeSummaryStats(results: TypingResult[]): SummaryStats {
  if (results.length === 0) {
    return {
      totalTests: 0,
      bestWpm: 0,
      avgWpm: 0,
      avgAccuracy: 0,
      avgNetWpm: 0,
      totalErrors: 0,
      totalDurationMs: 0,
      recentTrend: [],
    };
  }
  let bestWpm = 0;
  let totalWpm = 0;
  let totalAccuracy = 0;
  let totalNetWpm = 0;
  let totalErrors = 0;
  let totalDurationMs = 0;
  for (const r of results) {
    if (r.wpm > bestWpm) bestWpm = r.wpm;
    totalWpm += r.wpm;
    totalAccuracy += r.accuracy;
    totalNetWpm += r.netWpm;
    totalErrors += r.errors;
    totalDurationMs += r.durationMs;
  }
  const n = results.length;
  const recent = results.slice(0, 10).reverse().map((r) => r.wpm);
  return {
    totalTests: n,
    bestWpm,
    avgWpm: Math.round((totalWpm / n) * 10) / 10,
    avgAccuracy: Math.round((totalAccuracy / n) * 10) / 10,
    avgNetWpm: Math.round((totalNetWpm / n) * 10) / 10,
    totalErrors,
    totalDurationMs,
    recentTrend: recent,
  };
}

// ---- History (localStorage) ----

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

export interface ShareState {
  settings: Settings;
}

export function buildShareUrl(state: ShareState): string {
  const params = new URLSearchParams();
  const s = state.settings;
  params.set("mode", s.practiceMode);
  params.set("type", s.textType);
  if (s.textType === "custom" && s.customText) params.set("text", s.customText);
  if (s.practiceMode === "word-count") params.set("count", String(s.wordCount));
  if (s.caseSensitive) params.set("case", "1");
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareState {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { settings: { ...DEFAULT_SETTINGS } };
  const params = new URLSearchParams(clean);
  const mode = params.get("mode") ?? DEFAULT_SETTINGS.practiceMode;
  const type = params.get("type") ?? DEFAULT_SETTINGS.textType;
  const customText = params.get("text") ?? "";
  const countStr = params.get("count");
  const wordCount = countStr ? Math.max(1, parseInt(countStr, 10) || DEFAULT_SETTINGS.wordCount) : DEFAULT_SETTINGS.wordCount;
  const caseSensitive = params.get("case") === "1";
  const validModes = PRACTICE_MODES as readonly string[];
  const validTypes = TEXT_TYPES as readonly string[];
  const practiceMode: PracticeMode = validModes.includes(mode) ? (mode as PracticeMode) : DEFAULT_SETTINGS.practiceMode;
  const textType: TextType = validTypes.includes(type) ? (type as TextType) : DEFAULT_SETTINGS.textType;
  return {
    settings: {
      practiceMode,
      textType,
      customText,
      wordCount,
      caseSensitive,
    },
  };
}
