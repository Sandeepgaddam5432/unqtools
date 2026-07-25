/**
 * Vigenère Cipher — pure logic.
 * Encrypt/decrypt using a keyword. Non-letter chars pass through.
 */

export type VigenereMode = "encrypt" | "decrypt";

/** Normalize a keyword to uppercase A-Z only. Returns "" if no letters. */
export function normalizeKeyword(keyword: string): string {
  const k = keyword.toUpperCase().replace(/[^A-Z]/g, "");
  return k;
}

/** Shift a single character (A-Z or a-z) by a key offset. */
function shiftChar(char: string, keyShift: number, mode: VigenereMode): string {
  const code = char.charCodeAt(0);
  const sign = mode === "encrypt" ? 1 : -1;
  if (code >= 65 && code <= 90) {
    return String.fromCharCode(((code - 65 + sign * keyShift + 26) % 26) + 65);
  }
  if (code >= 97 && code <= 122) {
    return String.fromCharCode(((code - 97 + sign * keyShift + 26) % 26) + 97);
  }
  return char;
}

/** Run Vigenère cipher on text using a keyword. */
export function vigenere(
  text: string,
  keyword: string,
  mode: VigenereMode = "encrypt",
): string {
  const key = normalizeKeyword(keyword);
  if (key.length === 0) return text;
  let keyIndex = 0;
  let out = "";
  for (const char of text) {
    const code = char.charCodeAt(0);
    const isLetter = (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
    if (isLetter) {
      const shift = key.charCodeAt(keyIndex % key.length) - 65;
      out += shiftChar(char, shift, mode);
      keyIndex++;
    } else {
      out += char;
    }
  }
  return out;
}

export function encrypt(text: string, keyword: string): string {
  return vigenere(text, keyword, "encrypt");
}

export function decrypt(text: string, keyword: string): string {
  return vigenere(text, keyword, "decrypt");
}

/** Validate that the keyword contains at least one letter. */
export function validateKeyword(keyword: string): string | { error: string } {
  const k = normalizeKeyword(keyword);
  if (k.length === 0) return { error: "Keyword must contain at least one letter" };
  return k;
}
