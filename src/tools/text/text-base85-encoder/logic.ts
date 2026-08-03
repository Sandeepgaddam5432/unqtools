/**
 * Base85 Encoder (Ascii85 / Z85 compatible) — pure conversion logic.
 * No DOM access.
 */
const ASCII85_CHARS = "!\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstu";

export interface Base85Result {
  output: string;
  inputLength: number;
  outputLength: number;
}

/** Encode a byte array to ascii85 with optional <~ ~> delimiters. */
export function encodeAscii85(bytes: number[], opts: { delimiter: boolean }): string {
  let out = "";
  if (opts.delimiter) out += "<~";
  let i = 0;
  while (i < bytes.length) {
    const chunk: number[] = [];
    for (let j = 0; j < 4; j++) chunk.push(i + j < bytes.length ? bytes[i + j]! : 0);
    let n = (chunk[0]! << 24) >>> 0;
    n |= (chunk[1]! << 16) >>> 0;
    n |= (chunk[2]! << 8) >>> 0;
    n |= chunk[3]! >>> 0;
    const actualBytes = Math.min(4, bytes.length - i);
    if (n === 0 && actualBytes === 4) {
      out += "z";
      i += 4;
      continue;
    }
    const digits: string[] = [];
    for (let k = 0; k < 5; k++) {
      digits.unshift(ASCII85_CHARS[n % 85]!);
      n = Math.floor(n / 85);
    }
    out += digits.slice(0, actualBytes + 1).join("");
    i += 4;
  }
  if (opts.delimiter) out += "~>";
  return out;
}

/** Decode an ascii85 string to a byte array. */
export function decodeAscii85(input: string): number[] | { error: string } {
  let clean = input.replace(/<~|~>/g, "").replace(/\s/g, "");
  clean = clean.replace(/z/g, "!!!!!");
  const out: number[] = [];
  let i = 0;
  while (i < clean.length) {
    const chunk = clean.slice(i, i + 5);
    if (chunk.length < 5) {
      // pad with 'u' (84)
      const padded = chunk.padEnd(5, "u");
      let n = 0;
      for (let j = 0; j < 5; j++) {
        const idx = ASCII85_CHARS.indexOf(padded[j]!);
        if (idx < 0) return { error: `Invalid ascii85 character: ${padded[j]}` };
        n = n * 85 + idx;
      }
      const bytes = [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
      // Only keep chunk.length - 1 bytes
      out.push(...bytes.slice(0, chunk.length - 1));
      break;
    }
    let n = 0;
    for (let j = 0; j < 5; j++) {
      const idx = ASCII85_CHARS.indexOf(chunk[j]!);
      if (idx < 0) return { error: `Invalid ascii85 character: ${chunk[j]}` };
      n = n * 85 + idx;
    }
    out.push((n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff);
    i += 5;
  }
  return out;
}

/** Encode a JS string (UTF-8) to ascii85. */
export function encodeText(input: string, opts: { delimiter: boolean }): Base85Result {
  const bytes: number[] = [];
  for (const ch of Array.from(input)) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp < 0x80) bytes.push(cp);
    else if (cp < 0x800) bytes.push(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f));
    else if (cp < 0x10000) bytes.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
    else bytes.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3f), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
  }
  const output = encodeAscii85(bytes, opts);
  return { output, inputLength: input.length, outputLength: output.length };
}

/** Decode ascii85 back to a UTF-8 string. */
export function decodeText(input: string): Base85Result | { error: string } {
  const r = decodeAscii85(input);
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
  if (mode === "decode") {
    const stripped = input.replace(/<~|~>/g, "").replace(/\s/g, "").replace(/z/g, "");
    if (/[^!"#$%&'()*+,\-./0-9:;<=>?@A-Za-z\[\\\]^`]/.test(stripped)) return { error: "Input contains invalid ascii85 characters" };
  }
  return { ok: true };
}


// ============================================================================
// 100x features — added while preserving all existing exports.
// ============================================================================

/**
 * Base85 variants.
 */
export const BASE85_VARIANTS: ReadonlyArray<{ id: string; label: string; description: string }> = [
  { id: "ascii85", label: "Ascii85", description: "Adobe's Ascii85 (used in PDF/PostScript)" },
  { id: "btoa", label: "btoa", description: "Older Unix btoa format" },
  { id: "ipv6", label: "IPv6", description: "RFC 1924 IPv6 address encoding" },
  { id: "rfc1924", label: "RFC 1924", description: "Same as IPv6 variant" },
  { id: "z85", label: "ZeroMQ Z85", description: "ZeroMQ's Z85 encoding" },
];

/**
 * Z85 alphabet (different from Ascii85).
 */
const Z85_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ.-:+=^!/*?&<>()[]{}@%$#";

/**
 * Encode using Z85 (ZeroMQ variant).
 */
export function encodeZ85(data: Uint8Array): string {
  if (data.length % 4 !== 0) throw new Error("Z85 requires input length to be multiple of 4");
  let result = "";
  for (let i = 0; i < data.length; i += 4) {
    const value = (data[i]! * 256 * 256 * 256) + (data[i + 1]! * 256 * 256) + (data[i + 2]! * 256) + (data[i + 3]!);
    let chars = "";
    let v = value;
    for (let j = 0; j < 5; j++) { chars = Z85_ALPHABET[v % 85] + chars; v = Math.floor(v / 85); }
    result += chars;
  }
  return result;
}

/**
 * Decode Z85.
 */
export function decodeZ85(text: string): Uint8Array {
  if (text.length % 5 !== 0) throw new Error("Z85 requires input length to be multiple of 5");
  const bytes: number[] = [];
  for (let i = 0; i < text.length; i += 5) {
    let value = 0;
    for (let j = 0; j < 5; j++) { value = value * 85 + Z85_ALPHABET.indexOf(text[i + j]!); }
    bytes.push(Math.floor(value / 16777216) & 0xFF);
    bytes.push(Math.floor(value / 65536) & 0xFF);
    bytes.push(Math.floor(value / 256) & 0xFF);
    bytes.push(value & 0xFF);
  }
  return new Uint8Array(bytes);
}

/**
 * Calculate compression ratio.
 */
export function compressionRatio(inputBytes: number, outputChars: number): number {
  return Math.round((outputChars / inputBytes) * 100) / 100;
}

export interface ValidationReport { level: "pass" | "warn" | "fail"; code: string; message: string; }

export function validateBase85Input(text: string): ValidationReport[] {
  const reports: ValidationReport[] = [];
  if (!text) { reports.push({ level: "fail", code: "EMPTY", message: "Input text is empty." }); return reports; }
  if (text.startsWith("<~") && text.endsWith("~>")) {
    reports.push({ level: "pass", code: "ASCII85_DELIMITED", message: "Ascii85 with delimiters detected." });
  } else if (/^[0-9a-zA-Z.\-:+=^!/*?&<>()\[\]{}@%$#]+$/.test(text)) {
    reports.push({ level: "pass", code: "VALID_CHARS", message: "Valid Base85 characters." });
  } else {
    reports.push({ level: "warn", code: "INVALID_CHARS", message: "Text contains characters outside Base85 alphabet." });
  }
  return reports;
}

export interface Receipt { tool: string; version: string; timestamp: string; inputFingerprint: string; }

export function buildReceipt(text: string): Receipt {
  const s = text.length + ":" + (text.charCodeAt(0) ?? 0);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return { tool: "text-base85-encoder", version: "100x.1.0", timestamp: new Date().toISOString(), inputFingerprint: (h >>> 0).toString(16).padStart(8, "0") };
}

export const REFERENCES: ReadonlyArray<{ id: string; citation: string; summary: string }> = [
  { id: "Ascii85-Adobe", citation: "Adobe PostScript Reference", summary: "Ascii85 encoding in PostScript/PDF." },
  { id: "Z85-ZeroMQ", citation: "ZeroMQ RFC 32", summary: "Z85 encoding specification." },
  { id: "RFC-1924", citation: "RFC 1924 (1996)", summary: "IPv6 address encoding using Base85." },
];
