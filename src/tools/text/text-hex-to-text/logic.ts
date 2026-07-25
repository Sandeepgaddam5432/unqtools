/**
 * Hex to Text — pure conversion logic. No DOM access.
 */
export interface HexToTextOptions {
  /** Encoding to use when interpreting bytes. */
  encoding: "utf-8" | "utf-16le" | "utf-16be" | "ascii";
  /** Separator to insert between output characters (default none). */
  separator: string;
}

export interface HexToTextResult {
  output: string;
  inputLength: number;
  outputLength: number;
  byteCount: number;
  invalidBytes: number;
}

/** Strip all non-hex characters from input. */
export function normalizeHex(input: string): string {
  return input.replace(/[^0-9a-fA-F]/g, "").toLowerCase();
}

/** Validate a clean hex string (must be even length). */
export function isValidHex(s: string): boolean {
  return /^[0-9a-f]*$/.test(s) && s.length % 2 === 0;
}

/** Split clean hex into byte pairs. */
export function splitPairs(clean: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < clean.length; i += 2) {
    out.push(clean.slice(i, i + 2));
  }
  return out;
}

/** Convert a hex pair to a byte value (0-255). Returns -1 on invalid. */
export function hexPairToByte(pair: string): number {
  if (!/^[0-9a-f]{2}$/.test(pair)) return -1;
  return parseInt(pair, 16);
}

/** Decode a byte array to text per the given encoding. */
export function decodeBytes(bytes: number[], encoding: HexToTextOptions["encoding"]): string {
  if (encoding === "utf-8" || encoding === "ascii") {
    // Combine continuation bytes into code points.
    let out = "";
    let i = 0;
    while (i < bytes.length) {
      const b1 = bytes[i]!;
      if (encoding === "ascii" || b1 < 0x80) {
        out += String.fromCharCode(b1 & 0x7f);
        i++;
      } else if (b1 < 0xc0) {
        out += "\uFFFD"; i++;
      } else if (b1 < 0xe0) {
        const b2 = bytes[i + 1] ?? 0;
        out += String.fromCharCode(((b1 & 0x1f) << 6) | (b2 & 0x3f));
        i += 2;
      } else if (b1 < 0xf0) {
        const b2 = bytes[i + 1] ?? 0;
        const b3 = bytes[i + 2] ?? 0;
        out += String.fromCharCode(((b1 & 0x0f) << 12) | ((b2 & 0x3f) << 6) | (b3 & 0x3f));
        i += 3;
      } else {
        const b2 = bytes[i + 1] ?? 0;
        const b3 = bytes[i + 2] ?? 0;
        const b4 = bytes[i + 3] ?? 0;
        const cp = ((b1 & 0x07) << 18) | ((b2 & 0x3f) << 12) | ((b3 & 0x3f) << 6) | (b4 & 0x3f);
        try { out += String.fromCodePoint(cp); } catch { out += "\uFFFD"; }
        i += 4;
      }
    }
    return out;
  }
  // UTF-16 LE/BE
  let out = "";
  for (let i = 0; i + 1 < bytes.length; i += 2) {
    const code = encoding === "utf-16le"
      ? bytes[i]! | (bytes[i + 1]! << 8)
      : (bytes[i]! << 8) | bytes[i + 1]!;
    out += String.fromCharCode(code);
  }
  return out;
}

/** Convert full hex input to text. */
export function hexToText(input: string, opts: HexToTextOptions): HexToTextResult {
  const clean = normalizeHex(input);
  if (!clean) return { output: "", inputLength: 0, outputLength: 0, byteCount: 0, invalidBytes: 0 };
  const pairs = splitPairs(clean);
  let invalid = 0;
  const bytes: number[] = [];
  for (const p of pairs) {
    const b = hexPairToByte(p);
    if (b < 0) { invalid++; continue; }
    bytes.push(b);
  }
  const decoded = decodeBytes(bytes, opts.encoding);
  const output = opts.separator ? decoded.split("").join(opts.separator) : decoded;
  return {
    output,
    inputLength: input.length,
    outputLength: decoded.length,
    byteCount: bytes.length,
    invalidBytes: invalid,
  };
}

export function validateOptions(opts: HexToTextOptions): { ok: true } | { error: string } {
  if (!["utf-8", "utf-16le", "utf-16be", "ascii"].includes(opts.encoding)) return { error: "Unknown encoding" };
  return { ok: true };
}
