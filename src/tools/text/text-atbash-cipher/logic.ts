/**
 * Atbash Cipher — pure logic.
 * Mirrors the alphabet: A↔Z, B↔Y, ..., M↔N. Equivalent to (25 - char).
 */

/** Mirror a single character using Atbash. */
export function atbashChar(char: string): string {
  const code = char.charCodeAt(0);
  if (code >= 65 && code <= 90) {
    return String.fromCharCode(90 - (code - 65));
  }
  if (code >= 97 && code <= 122) {
    return String.fromCharCode(122 - (code - 97));
  }
  return char;
}

/** Apply Atbash to a string. Atbash is its own inverse. */
export function atbash(text: string): string {
  return Array.from(text).map((c) => atbashChar(c)).join("");
}

/** Convenience aliases — same operation either way. */
export function encrypt(text: string): string {
  return atbash(text);
}

export function decrypt(text: string): string {
  return atbash(text);
}

/** Build the atbash mapping table for display. */
export function atbashTable(): { from: string; to: string }[] {
  const out: { from: string; to: string }[] = [];
  for (let i = 0; i < 26; i++) {
    const from = String.fromCharCode(65 + i);
    const to = String.fromCharCode(90 - i);
    out.push({ from, to });
  }
  return out;
}
