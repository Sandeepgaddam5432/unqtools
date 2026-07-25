/**
 * Text Scrambler — pure logic. No DOM access.
 *
 * For each word, keeps the first and last letter fixed and shuffles the
 * middle letters using a seeded PRNG so output is reproducible. Supports
 * multiple scramble methods (random/sorted/reversed/alphanumeric-only).
 */

export type ScrambleMethod = "random" | "sorted" | "reversed";

export interface ScrambleOptions {
  /** PRNG seed for random mode. */
  seed?: number;
  /** Scramble method. Default "random". */
  method?: ScrambleMethod;
  /** Preserve case of the original letters when true (default). */
  preserveCase?: boolean;
  /** Preserve punctuation tokens verbatim when true (default). */
  preservePunctuation?: boolean;
  /** Minimum word length to scramble (default 4). */
  minLength?: number;
}

export interface ScrambleStats {
  chars: number;
  wordsTotal: number;
  wordsScrambled: number;
  wordsSkipped: number;
  method: ScrambleMethod;
  durationMs: number;
}

/** Mulberry32 — small fast seeded PRNG. Returns a function → float 0..1. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher–Yates shuffle on a copy, using the provided rng. */
export function shuffle<T>(arr: T[], rng: () => number): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** Sort the characters alphabetically (case-insensitive). */
export function sortChars(chars: string[]): string[] {
  return chars.slice().sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

/** Reverse the character order. */
export function reverseChars(chars: string[]): string[] {
  return chars.slice().reverse();
}

/** Apply the chosen scramble method to the middle letters. */
export function scrambleMiddle(middle: string[], method: ScrambleMethod, rng: () => number): string[] {
  if (method === "sorted") return sortChars(middle);
  if (method === "reversed") return reverseChars(middle);
  return shuffle(middle, rng);
}

/** Scramble the middle letters of a single word. */
export function scrambleWord(word: string, rng: () => number, opts: ScrambleOptions = {}): string {
  const minLen = opts.minLength ?? 4;
  if (word.length < minLen) return word;
  const first = word[0]!;
  const last = word[word.length - 1]!;
  const middle = word.slice(1, -1).split("");
  const method = opts.method ?? "random";
  const scrambled = scrambleMiddle(middle, method, rng);
  return first + scrambled.join("") + last;
}

/** True if a token is an alphabetic word (no internal punctuation). */
export function isWord(token: string): boolean {
  return /^[A-Za-z]+$/.test(token);
}

/** Tokenize input into alphabetic words and non-word segments. */
export function tokenize(text: string): string[] {
  return text.split(/(\s+|[^\sA-Za-z]+)/).filter((t) => t !== "");
}

/** Scramble all words in text, preserving whitespace and punctuation. */
export function scrambleText(text: string, seedOrOpts: number | ScrambleOptions = 0): string {
  if (!text) return "";
  const opts: ScrambleOptions = typeof seedOrOpts === "number" ? { seed: seedOrOpts } : seedOrOpts;
  const rng = mulberry32(opts.seed ?? 0);
  return tokenize(text)
    .map((tok) => (isWord(tok) ? scrambleWord(tok, rng, opts) : tok))
    .join("");
}

/** Batch: scramble multiple inputs (one per line). */
export function scrambleBatch(inputs: string[], opts: ScrambleOptions = {}): string[] {
  return inputs.map((s) => scrambleText(s, opts));
}

/** Compute statistics about a scramble operation. */
export function computeStats(input: string, opts: ScrambleOptions = {}): ScrambleStats {
  const start = typeof performance !== "undefined" ? performance.now() : Date.now();
  const tokens = tokenize(input);
  const minLen = opts.minLength ?? 4;
  let wordsTotal = 0;
  let wordsScrambled = 0;
  for (const tok of tokens) {
    if (!isWord(tok)) continue;
    wordsTotal++;
    if (tok.length >= minLen) wordsScrambled++;
  }
  const end = typeof performance !== "undefined" ? performance.now() : Date.now();
  return {
    chars: input.length,
    wordsTotal,
    wordsScrambled,
    wordsSkipped: wordsTotal - wordsScrambled,
    method: opts.method ?? "random",
    durationMs: Math.max(0, end - start),
  };
}

/** Return a list of distinct words that would be scrambled. */
export function listScramblableWords(input: string, minLength = 4): string[] {
  const tokens = tokenize(input);
  const out: string[] = [];
  for (const tok of tokens) {
    if (isWord(tok) && tok.length >= minLength) out.push(tok);
  }
  return out;
}

/** Compare original vs scrambled words for verification. */
export function diffWords(original: string, scrambled: string): { original: string; scrambled: string; changed: boolean }[] {
  const a = tokenize(original).filter(isWord);
  const b = tokenize(scrambled).filter(isWord);
  const out: { original: string; scrambled: string; changed: boolean }[] = [];
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const o = a[i] ?? "";
    const s = b[i] ?? "";
    out.push({ original: o, scrambled: s, changed: o !== s });
  }
  return out;
}
