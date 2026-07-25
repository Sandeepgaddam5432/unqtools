/**
 * Text to Hex — pure conversion logic. No DOM access.
 */
export interface TextToHexOptions {
  /** Encoding to use when emitting bytes. */
  encoding: "utf-8" | "utf-16le" | "utf-16be" | "ascii";
  /** Separator between hex bytes. */
  separator: string;
  /** Use uppercase hex letters. */
  uppercase: boolean;
}

export interface TextToHexResult {
  output: string;
  inputLength: number;
  outputLength: number;
  byteCount: number;
}

/** Encode a single UTF-16 code unit to UTF-8 byte sequence. */
export function utf8Encode(codePoint: number): number[] {
  if (codePoint < 0x80) return [codePoint];
  if (codePoint < 0x800) return [0xc0 | (codePoint >> 6), 0x80 | (codePoint & 0x3f)];
  if (codePoint < 0x10000) return [0xe0 | (codePoint >> 12), 0x80 | ((codePoint >> 6) & 0x3f), 0x80 | (codePoint & 0x3f)];
  return [
    0xf0 | (codePoint >> 18),
    0x80 | ((codePoint >> 12) & 0x3f),
    0x80 | ((codePoint >> 6) & 0x3f),
    0x80 | (codePoint & 0x3f),
  ];
}

/** Convert a string to a byte array per the given encoding. */
export function encodeToBytes(text: string, encoding: TextToHexOptions["encoding"]): number[] {
  const bytes: number[] = [];
  if (encoding === "utf-8") {
    for (const ch of Array.from(text)) {
      const cp = ch.codePointAt(0) ?? 0;
      for (const b of utf8Encode(cp)) bytes.push(b);
    }
  } else if (encoding === "ascii") {
    for (const ch of Array.from(text)) {
      const cp = ch.codePointAt(0) ?? 0;
      bytes.push(cp & 0x7f);
    }
  } else {
    // UTF-16 LE/BE — use code units (charCodeAt), not code points.
    for (let i = 0; i < text.length; i++) {
      const cu = text.charCodeAt(i);
      if (encoding === "utf-16le") {
        bytes.push(cu & 0xff, (cu >> 8) & 0xff);
      } else {
        bytes.push((cu >> 8) & 0xff, cu & 0xff);
      }
    }
  }
  return bytes;
}

/** Convert a byte to a 2-char hex string. */
export function byteToHex(b: number, uppercase: boolean): string {
  const h = (b & 0xff).toString(16).padStart(2, "0");
  return uppercase ? h.toUpperCase() : h;
}

/** Convert full text input to hex output. */
export function textToHex(input: string, opts: TextToHexOptions): TextToHexResult {
  if (!input) return { output: "", inputLength: 0, outputLength: 0, byteCount: 0 };
  const bytes = encodeToBytes(input, opts.encoding);
  const hexes = bytes.map((b) => byteToHex(b, opts.uppercase));
  const output = hexes.join(opts.separator);
  return {
    output,
    inputLength: Array.from(input).length,
    outputLength: output.length,
    byteCount: bytes.length,
  };
}

export function validateOptions(opts: TextToHexOptions): { ok: true } | { error: string } {
  if (!["utf-8", "utf-16le", "utf-16be", "ascii"].includes(opts.encoding)) return { error: "Unknown encoding" };
  return { ok: true };
}
