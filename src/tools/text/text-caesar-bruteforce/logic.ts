/**
 * Caesar Brute-Force — pure logic.
 * Returns all 25 Caesar-shift candidates of the input. Each shift undoes
 * a possible cipher rotation (1-25). Useful when the shift is unknown.
 */

export interface ShiftResult {
  shift: number;
  plaintext: string;
}

/** Apply a Caesar decryption with a given shift. */
export function caesarDecrypt(text: string, shift: number): string {
  const s = ((-shift % 26) + 26) % 26;
  return Array.from(text)
    .map((char) => {
      const code = char.charCodeAt(0);
      if (code >= 65 && code <= 90) {
        return String.fromCharCode(((code - 65 + s) % 26) + 65);
      }
      if (code >= 97 && code <= 122) {
        return String.fromCharCode(((code - 97 + s) % 26) + 97);
      }
      return char;
    })
    .join("");
}

/** Convenience alias for a single forward shift. */
export function caesarEncrypt(text: string, shift: number): string {
  const s = ((shift % 26) + 26) % 26;
  return Array.from(text)
    .map((char) => {
      const code = char.charCodeAt(0);
      if (code >= 65 && code <= 90) {
        return String.fromCharCode(((code - 65 + s) % 26) + 65);
      }
      if (code >= 97 && code <= 122) {
        return String.fromCharCode(((code - 97 + s) % 26) + 97);
      }
      return char;
    })
    .join("");
}

/** Generate all 25 shift candidates (shift = 1..25). */
export function bruteForce(text: string): ShiftResult[] {
  const out: ShiftResult[] = [];
  for (let shift = 1; shift <= 25; shift++) {
    out.push({ shift, plaintext: caesarDecrypt(text, shift) });
  }
  return out;
}

/** Chi-squared distance vs English letter frequencies (lower = better). */
const ENGLISH_FREQ: Record<string, number> = {
  a: 8.167, b: 1.492, c: 2.782, d: 4.253, e: 12.702, f: 2.228, g: 2.015,
  h: 6.094, i: 6.966, j: 0.153, k: 0.772, l: 4.025, m: 2.406, n: 6.749,
  o: 7.507, p: 1.929, q: 0.095, r: 5.987, s: 6.327, t: 9.056, u: 2.758,
  v: 0.978, w: 2.36, x: 0.15, y: 1.974, z: 0.074,
};

export function scoreEnglish(text: string): number {
  const letters = text.toLowerCase().replace(/[^a-z]/g, "");
  if (letters.length === 0) return Infinity;
  const counts: Record<string, number> = {};
  for (const c of letters) counts[c] = (counts[c] ?? 0) + 1;
  let chi = 0;
  for (const [char, count] of Object.entries(counts)) {
    const expected = ((ENGLISH_FREQ[char] ?? 0) / 100) * letters.length;
    if (expected > 0) chi += (count - expected) ** 2 / expected;
  }
  return chi;
}

/** Pick the most likely shift (lowest chi-squared score). */
export function bestGuess(text: string): ShiftResult | null {
  const all = bruteForce(text)
    .map((r) => ({ ...r, score: scoreEnglish(r.plaintext) }))
    .sort((a, b) => a.score - b.score);
  return all[0] ?? null;
}

/** Format the brute-force results as plain text. */
export function formatResults(results: ShiftResult[]): string {
  return results.map((r) => `Shift ${r.shift}: ${r.plaintext}`).join("\n");
}
