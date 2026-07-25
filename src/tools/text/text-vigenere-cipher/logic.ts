/**
 * Vigenère Cipher — pure logic.
 * Encrypt/decrypt using a keyword. Non-letter chars pass through.
 *
 * Extras:
 *  1. Encrypt / decrypt modes
 *  2. Custom keyword
 *  3. Autokey mode (key = keyword + plaintext)
 *  4. Batch validation
 *  5. Stats (letter count, total chars)
 *  6. Identity check
 *  7. Letter shift helper
 *  8. Case preservation
 *  9. Presets (LEMON, SECRET, CIPHER)
 * 10. Keyword normalization
 * 11. Brute-force key length helper
 * 12. Format-preserving for non-letters
 */
export type VigenereMode = "encrypt" | "decrypt";

export interface VigenereOptions {
  keyword: string;
  mode: VigenereMode;
  /** Use autokey mode (key = keyword + plaintext). */
  autokey: boolean;
  /** Preserve non-letter characters. */
  preserveNonLetters: boolean;
}

export const DEFAULT_OPTIONS: VigenereOptions = {
  keyword: "LEMON", mode: "encrypt", autokey: false, preserveNonLetters: true,
};

/** Normalize a keyword to uppercase A-Z only. Returns "" if no letters. */
export function normalizeKeyword(keyword: string): string {
  return keyword.toUpperCase().replace(/[^A-Z]/g, "");
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

/** Generate the full key stream from keyword + (autokey) plaintext or ciphertext. */
export function buildKeyStream(keyword: string, text: string, mode: VigenereMode, autokey: boolean): number[] {
  const key = normalizeKeyword(keyword);
  const shifts: number[] = [];
  for (const ch of key) shifts.push(ch.charCodeAt(0) - 65);
  if (!autokey) {
    // Repeat-key mode: we'll cycle through these
    return shifts;
  }
  // Autokey mode: append plaintext (encrypt) or ciphertext (decrypt) letters
  for (const ch of text) {
    if (shifts.length >= 100000) break;
    const code = ch.charCodeAt(0);
    if (code >= 65 && code <= 90) shifts.push(code - 65);
    else if (code >= 97 && code <= 122) shifts.push(code - 97);
  }
  return shifts;
}

/** Run Vigenère cipher on text using a keyword. */
export function vigenere(text: string, keyword: string, mode: VigenereMode = "encrypt", autokey = false): string {
  const key = normalizeKeyword(keyword);
  if (key.length === 0) return text;
  const initialShifts = buildKeyStream(keyword, "", mode, false);
  const allShifts: number[] = [...initialShifts];
  const plainLetters: number[] = []; // collected plaintext letter codes (used for autokey extension)
  let keyIndex = 0;
  let out = "";
  const pushLetter = (code: number) => {
    plainLetters.push(code);
    if (autokey) {
      const shift = code >= 97 ? code - 97 : code - 65;
      allShifts.push(shift);
    }
  };
  for (const char of text) {
    const code = char.charCodeAt(0);
    const isLetter = (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
    if (isLetter) {
      const shift = autokey
        ? allShifts[keyIndex] ?? 0
        : allShifts[keyIndex % allShifts.length]!;
      const enc = shiftChar(char, shift, mode);
      out += enc;
      // For autokey encrypt: plaintext = input. For autokey decrypt: plaintext = output (decrypted).
      const plainCode = mode === "encrypt" ? code : enc.charCodeAt(0);
      pushLetter(plainCode);
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

/** Run Vigenère with full options. */
export function vigenereWithOptions(text: string, opts: VigenereOptions): string {
  if (!opts.preserveNonLetters) {
    // Strip non-letters, then encrypt
    const letters = text.replace(/[^A-Za-z]/g, "");
    return vigenere(letters, opts.keyword, opts.mode, opts.autokey);
  }
  return vigenere(text, opts.keyword, opts.mode, opts.autokey);
}

/** Validate that the keyword contains at least one letter. */
export function validateKeyword(keyword: string): string | { error: string } {
  const k = normalizeKeyword(keyword);
  if (k.length === 0) return { error: "Keyword must contain at least one letter" };
  return k;
}

/** Validate full options. */
export function validateOptions(opts: VigenereOptions): VigenereOptions | { error: string } {
  const k = validateKeyword(opts.keyword);
  if (typeof k === "object" && "error" in k) return k;
  if (!["encrypt", "decrypt"].includes(opts.mode)) return { error: "Invalid mode" };
  return { ...opts, keyword: k as string };
}

/** True when options produce a no-op (impossible for cipher). */
export function isIdentity(_opts: VigenereOptions): boolean {
  return false;
}

/** Batch-validate a list of inputs. */
export function batchValidate(inputs: { name: string }[], opts: VigenereOptions): { name: string; result: VigenereOptions | { error: string } }[] {
  return inputs.map((f) => ({ name: f.name, result: validateOptions(opts) }));
}

/** Stats about input. */
export function textStats(text: string): { letters: number; total: number; nonLetters: number } {
  let letters = 0;
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    if ((code >= 65 && code <= 90) || (code >= 97 && code <= 122)) letters++;
  }
  return { letters, total: text.length, nonLetters: text.length - letters };
}

/** Suggest possible key lengths based on Kasiski-like examination (simplified). */
export function suggestKeyLengths(ciphertext: string, maxLen = 10): number[] {
  const text = ciphertext.toUpperCase().replace(/[^A-Z]/g, "");
  const lengths: { len: number; score: number }[] = [];
  for (let len = 1; len <= maxLen; len++) {
    // Index of coincidence for each subgroup
    let totalIC = 0;
    for (let i = 0; i < len; i++) {
      const group: string[] = [];
      for (let j = i; j < text.length; j += len) group.push(text[j]!);
      const freq: Record<string, number> = {};
      for (const c of group) freq[c] = (freq[c] ?? 0) + 1;
      const n = group.length;
      if (n < 2) continue;
      const ic = Object.values(freq).reduce((s, f) => s + (f * (f - 1)) / (n * (n - 1)), 0);
      totalIC += ic;
    }
    lengths.push({ len, score: totalIC / len });
  }
  lengths.sort((a, b) => b.score - a.score);
  return lengths.slice(0, 3).map((l) => l.len);
}

/** Presets. */
export const PRESETS: { id: string; label: string; options: Omit<VigenereOptions, "keyword"> & { keyword: string } }[] = [
  { id: "lemon", label: "LEMON (classic)", options: { keyword: "LEMON", mode: "encrypt", autokey: false, preserveNonLetters: true } },
  { id: "secret", label: "SECRET", options: { keyword: "SECRET", mode: "encrypt", autokey: false, preserveNonLetters: true } },
  { id: "cipher", label: "CIPHER", options: { keyword: "CIPHER", mode: "encrypt", autokey: false, preserveNonLetters: true } },
  { id: "autokey", label: "Autokey (KEY)", options: { keyword: "KEY", mode: "encrypt", autokey: true, preserveNonLetters: true } },
  { id: "no-spaces", label: "Strip non-letters", options: { keyword: "LEMON", mode: "encrypt", autokey: false, preserveNonLetters: false } },
];

export function findPreset(id: string) {
  return PRESETS.find((p) => p.id === id);
}
