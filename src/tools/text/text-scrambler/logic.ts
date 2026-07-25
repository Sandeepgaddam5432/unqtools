/**
 * Text Scrambler — pure logic. No DOM access.
 *
 * For each word, keeps the first and last letter fixed and shuffles the
 * middle letters using a seeded PRNG so output is reproducible.
 */

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

/** Scramble the middle letters of a single word. */
export function scrambleWord(word: string, rng: () => number): string {
  if (word.length <= 3) return word;
  const first = word[0]!;
  const last = word[word.length - 1]!;
  const middle = word.slice(1, -1).split("");
  const shuffled = shuffle(middle, rng).join("");
  return first + shuffled + last;
}

/** True if a token is an alphabetic word (no internal punctuation). */
export function isWord(token: string): boolean {
  return /^[A-Za-z]+$/.test(token);
}

/** Scramble all words in text, preserving whitespace and punctuation. */
export function scrambleText(text: string, seed: number): string {
  if (!text) return "";
  const rng = mulberry32(seed);
  // Tokenize into words and non-words (whitespace/punct).
  return text
    .split(/(\s+|[^\sA-Za-z]+)/)
    .map((tok) => (isWord(tok) ? scrambleWord(tok, rng) : tok))
    .join("");
}
