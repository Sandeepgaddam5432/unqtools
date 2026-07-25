/**
 * Base58 Encoder (Bitcoin alphabet) — pure conversion logic. No DOM access.
 */
const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export interface Base58Result {
  output: string;
  inputLength: number;
  outputLength: number;
}

/** Encode a byte array to a base58 string. */
export function encodeBase58(bytes: number[]): string {
  if (bytes.length === 0) return "";
  let leadingZeros = 0;
  while (leadingZeros < bytes.length && bytes[leadingZeros] === 0) leadingZeros++;
  // Convert bytes to a big-endian bigint-style array of base-58 digits.
  const digits: number[] = [];
  for (let i = leadingZeros; i < bytes.length; i++) {
    let carry = bytes[i]!;
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j]! << 8;
      digits[j] = carry % 58;
      carry = Math.floor(carry / 58);
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }
  let out = "";
  for (let i = 0; i < leadingZeros; i++) out += ALPHABET[0];
  // Digits are little-endian; emit in reverse.
  for (let i = digits.length - 1; i >= 0; i--) out += ALPHABET[digits[i]!];
  return out;
}

/** Decode a base58 string to a byte array. */
export function decodeBase58(input: string): number[] | { error: string } {
  if (input.length === 0) return [];
  const bytes: number[] = [];
  let leadingZeros = 0;
  for (const ch of input) {
    if (ch === ALPHABET[0]) leadingZeros++;
    else break;
  }
  for (const ch of input) {
    const idx = ALPHABET.indexOf(ch);
    if (idx < 0) return { error: `Invalid base58 character: ${ch}` };
    let carry = idx;
    for (let j = 0; j < bytes.length; j++) {
      carry += bytes[j]! * 58;
      bytes[j] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  // Strip excess leading zeros (we'll re-add the requested ones below).
  while (bytes.length > leadingZeros && bytes[bytes.length - 1] === 0) bytes.pop();
  for (let i = 0; i < leadingZeros; i++) bytes.push(0);
  return bytes.reverse();
}

/** Encode a JS string (UTF-8) to base58. */
export function encodeText(input: string): Base58Result {
  const bytes: number[] = [];
  for (const ch of Array.from(input)) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp < 0x80) bytes.push(cp);
    else if (cp < 0x800) bytes.push(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f));
    else if (cp < 0x10000) bytes.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
    else bytes.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3f), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
  }
  const output = encodeBase58(bytes);
  return { output, inputLength: input.length, outputLength: output.length };
}

/** Decode base58 back to a UTF-8 string. */
export function decodeText(input: string): Base58Result | { error: string } {
  const r = decodeBase58(input);
  if ("error" in r) return r;
  let out = "";
  let i = 0;
  const bytes = r;
  while (i < bytes.length) {
    const b1 = bytes[i]!;
    if (b1 < 0x80) { out += String.fromCharCode(b1); i++; }
    else if (b1 < 0xc0) { out += "\uFFFD"; i++; }
    else if (b1 < 0xe0) { out += String.fromCharCode(((b1 & 0x1f) << 6) | (bytes[i + 1]! & 0x3f)); i += 2; }
    else if (b1 < 0xf0) { out += String.fromCharCode(((b1 & 0x0f) << 12) | ((bytes[i + 1]! & 0x3f) << 6) | (bytes[i + 2]! & 0x3f)); i += 3; }
    else { const cp = ((b1 & 0x07) << 18) | ((bytes[i + 1]! & 0x3f) << 12) | ((bytes[i + 2]! & 0x3f) << 6) | (bytes[i + 3]! & 0x3f); out += String.fromCodePoint(cp); i += 4; }
  }
  return { output: out, inputLength: input.length, outputLength: out.length };
}

export function validateInput(input: string, mode: "encode" | "decode"): { ok: true } | { error: string } {
  if (mode === "decode" && /[^123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]/.test(input)) return { error: "Input contains invalid base58 characters" };
  return { ok: true };
}
