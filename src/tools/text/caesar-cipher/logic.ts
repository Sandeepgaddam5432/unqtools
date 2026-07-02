/**
 * Caesar Cipher — pure logic.
 * Encrypt/decrypt with any shift 1-25, ROT13 preset, brute-force solver,
 * and frequency-analysis auto-rank via chi-squared vs English letter frequencies.
 */

const ENGLISH_FREQ: Record<string, number> = {
  a: 8.167,
  b: 1.492,
  c: 2.782,
  d: 4.253,
  e: 12.702,
  f: 2.228,
  g: 2.015,
  h: 6.094,
  i: 6.966,
  j: 0.153,
  k: 0.772,
  l: 4.025,
  m: 2.406,
  n: 6.749,
  o: 7.507,
  p: 1.929,
  q: 0.095,
  r: 5.987,
  s: 6.327,
  t: 9.056,
  u: 2.758,
  v: 0.978,
  w: 2.36,
  x: 0.15,
  y: 1.974,
  z: 0.074,
};

export function caesarShift(text: string, shift: number): string {
  const s = ((shift % 26) + 26) % 26;
  return Array.from(text)
    .map((char) => {
      const code = char.charCodeAt(0);
      if (code >= 65 && code <= 90) return String.fromCharCode(((code - 65 + s) % 26) + 65);
      if (code >= 97 && code <= 122) return String.fromCharCode(((code - 97 + s) % 26) + 97);
      return char;
    })
    .join("");
}

export function encrypt(text: string, shift: number): string {
  return caesarShift(text, shift);
}

export function decrypt(text: string, shift: number): string {
  return caesarShift(text, -shift);
}

export function rot13(text: string): string {
  return caesarShift(text, 13);
}

export interface BruteForceResult {
  shift: number;
  plaintext: string;
  chiSquared: number;
}

export function bruteForce(ciphertext: string): BruteForceResult[] {
  const results: BruteForceResult[] = [];
  for (let shift = 1; shift <= 25; shift++) {
    const plaintext = decrypt(ciphertext, shift);
    const chi = chiSquared(plaintext);
    results.push({ shift, plaintext, chiSquared: chi });
  }
  // Sort by chi-squared ascending (lower = closer to English)
  results.sort((a, b) => a.chiSquared - b.chiSquared);
  return results;
}

function chiSquared(text: string): number {
  const lower = text.toLowerCase();
  const letters = lower.replace(/[^a-z]/g, "");
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

export function bestGuess(ciphertext: string): BruteForceResult | null {
  const results = bruteForce(ciphertext);
  return results[0] ?? null;
}
