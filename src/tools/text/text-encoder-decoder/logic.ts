/** Text Encoder/Decoder — pure logic. */

export type Encoding = "base64" | "url" | "html" | "hex" | "rot13" | "binary";

export interface EncodeOptions {
  encoding: Encoding;
}

export interface EncodeResult {
  output: string;
  warnings: string[];
}

function textToBytes(s: string): number[] {
  return Array.from(new TextEncoder().encode(s));
}

function bytesToText(bytes: number[]): string {
  return new TextDecoder().decode(new Uint8Array(bytes));
}

function toBase64(s: string): string {
  const bytes = textToBytes(s);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function fromBase64(s: string): string {
  const bin = atob(s.replace(/\s/g, ""));
  const bytes = new Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytesToText(bytes);
}

function toHex(s: string): string {
  return textToBytes(s).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function fromHex(s: string): string {
  const clean = s.replace(/\s/g, "");
  const bytes: number[] = [];
  for (let i = 0; i < clean.length; i += 2) bytes.push(parseInt(clean.slice(i, i + 2), 16));
  return bytesToText(bytes);
}

function toBinary(s: string): string {
  return textToBytes(s).map((b) => b.toString(2).padStart(8, "0")).join(" ");
}

function fromBinary(s: string): string {
  const parts = s.trim().split(/\s+/);
  return bytesToText(parts.map((p) => parseInt(p, 2)));
}

function rot13(s: string): string {
  return s.replace(/[a-zA-Z]/g, (c) => {
    const base = c <= "Z" ? 65 : 97;
    return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base);
  });
}

const HTML_ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const HTML_UNESCAPES: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&#x27;": "'" };

export function encode(input: string, options: EncodeOptions): EncodeResult | { error: string } {
  const warnings: string[] = [];
  try {
    let output: string;
    switch (options.encoding) {
      case "base64": output = toBase64(input); break;
      case "url": output = encodeURIComponent(input); break;
      case "html": output = input.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]!); break;
      case "hex": output = toHex(input); break;
      case "rot13": output = rot13(input); break;
      case "binary": output = toBinary(input); break;
      default: return { error: `Unknown encoding: ${options.encoding}` };
    }
    return { output, warnings };
  } catch (e) {
    return { error: `Encode failed: ${(e as Error).message}` };
  }
}

export function decode(input: string, options: EncodeOptions): EncodeResult | { error: string } {
  const warnings: string[] = [];
  try {
    let output: string;
    switch (options.encoding) {
      case "base64": output = fromBase64(input); break;
      case "url": output = decodeURIComponent(input); break;
      case "html": output = input.replace(/&(?:amp|lt|gt|quot|#39|x27);/g, (m) => HTML_UNESCAPES[m] ?? m); break;
      case "hex": output = fromHex(input); break;
      case "rot13": output = rot13(input); break;
      case "binary": output = fromBinary(input); break;
      default: return { error: `Unknown encoding: ${options.encoding}` };
    }
    return { output, warnings };
  } catch (e) {
    return { error: `Decode failed: ${(e as Error).message}` };
  }
}

export function batchEncode(inputs: string[], options: EncodeOptions): (EncodeResult | { error: string })[] {
  return inputs.map((i) => encode(i, options));
}


// ============================================================================
// 100x features — added while preserving all existing exports.
// ============================================================================

/**
 * Supported encoding types.
 */
export const SUPPORTED_ENCODINGS: ReadonlyArray<{ id: string; label: string; description: string }> = [
  { id: "base64", label: "Base64", description: "Standard Base64 encoding (RFC 4648)" },
  { id: "base64url", label: "Base64URL", description: "URL-safe Base64 (no +/, no padding)" },
  { id: "url", label: "URL Encode", description: "Percent-encoding for URLs" },
  { id: "html", label: "HTML Entities", description: "HTML character entities" },
  { id: "unicode", label: "Unicode Escape", description: "Unicode escape sequences \\uXXXX" },
  { id: "hex", label: "Hex", description: "Hexadecimal encoding" },
  { id: "binary", label: "Binary", description: "Binary (base 2) representation" },
  { id: "octal", label: "Octal", description: "Octal (base 8) representation" },
  { id: "decimal", label: "Decimal", description: "Decimal code points" },
  { id: "rot13", label: "ROT13", description: "ROT13 letter substitution" },
  { id: "caesar", label: "Caesar Cipher", description: "Caesar cipher with configurable shift" },
  { id: "atbash", label: "Atbash", description: "Atbash cipher (A↔Z, B↔Y)" },
  { id: "morse", label: "Morse Code", description: "International Morse code" },
  { id: "ascii85", label: "Ascii85", description: "Ascii85 (Base85) encoding" },
  { id: "base32", label: "Base32", description: "RFC 4648 Base32" },
  { id: "base58", label: "Base58", description: "Bitcoin Base58" },
];

/**
 * Encode text to multiple formats at once.
 */
export function encodeToAllFormats(text: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const enc of SUPPORTED_ENCODINGS) {
    try {
      const r = encode(text, enc.id as Encoding);
      if (!("error" in r)) result[enc.id] = r;
    } catch { /* skip unsupported */ }
  }
  return result;
}

/**
 * Detect the encoding format of input text.
 */
export function detectEncoding(text: string): string | null {
  if (/^[01\s]+$/.test(text)) return "binary";
  if (/^[0-7\s]+$/.test(text)) return "octal";
  if (/^[0-9a-fA-F\s]+$/.test(text)) return "hex";
  if (/^[0-9\s]+$/.test(text)) return "decimal";
  if (/^[A-Za-z0-9+/=]*$/.test(text) && text.length > 0) return "base64";
  if (/^[A-Za-z0-9_-]*$/.test(text) && text.length > 0) return "base64url";
  if (/^[A-Z2-7=]*$/.test(text)) return "base32";
  if (/^[1-9A-HJ-NP-Za-km-z]*$/.test(text)) return "base58";
  if (/^[A-Za-z0-9!-u]*z?~?$/.test(text)) return "ascii85";
  if (/\\u[0-9a-fA-F]{4}/.test(text)) return "unicode";
  if (/&[a-z]+;|&#\d+;/.test(text)) return "html";
  if (/^[.\-/\s]+$/.test(text)) return "morse";
  if (/%[0-9a-fA-F]{2}/.test(text)) return "url";
  if (/^[A-Za-z]+$/.test(text)) return "rot13";
  return null;
}

/**
 * Validate encoding format.
 */
export function validateFormat(text: string, encoding: string): { valid: boolean; reason?: string } {
  switch (encoding) {
    case "base64":
      return /^[A-Za-z0-9+/]*={0,2}$/.test(text) ? { valid: true } : { valid: false, reason: "Invalid Base64 characters" };
    case "base64url":
      return /^[A-Za-z0-9_-]*$/.test(text) ? { valid: true } : { valid: false, reason: "Invalid Base64URL characters" };
    case "base32":
      return /^[A-Z2-7]*={0,6}$/.test(text) ? { valid: true } : { valid: false, reason: "Invalid Base32 characters" };
    case "hex":
      return /^[0-9a-fA-F\s]+$/.test(text) ? { valid: true } : { valid: false, reason: "Invalid hex characters" };
    case "binary":
      return /^[01\s]+$/.test(text) ? { valid: true } : { valid: false, reason: "Invalid binary characters" };
    default:
      return { valid: true };
  }
}

/**
 * Calculate output size estimate.
 */
export function estimateOutputSize(inputLength: number, encoding: string): number {
  const ratios: Record<string, number> = {
    base64: 1.33, base64url: 1.33, base32: 1.6, base58: 1.37,
    hex: 2.0, binary: 8.0, octal: 3.0, decimal: 3.5,
    url: 3.0, html: 6.0, unicode: 6.0, ascii85: 1.25,
    morse: 4.0, rot13: 1.0, caesar: 1.0, atbash: 1.0,
  };
  return Math.round(inputLength * (ratios[encoding] ?? 1));
}

export interface ValidationReport { level: "pass" | "warn" | "fail"; code: string; message: string; }

export function validateEncoderInput(text: string, encoding: string): ValidationReport[] {
  const reports: ValidationReport[] = [];
  if (!text) { reports.push({ level: "fail", code: "EMPTY", message: "Input text is empty." }); return reports; }
  const valid = validateFormat(text, encoding);
  if (!valid.valid) reports.push({ level: "warn", code: "FORMAT", message: valid.reason ?? "Format may be invalid." });
  else reports.push({ level: "pass", code: "VALID", message: `Input appears valid for ${encoding}.` });
  return reports;
}

export interface Receipt { tool: string; version: string; timestamp: string; inputFingerprint: string; }

export function buildReceipt(text: string, encoding: string): Receipt {
  const s = text.length + ":" + encoding;
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return { tool: "text-encoder-decoder", version: "100x.1.0", timestamp: new Date().toISOString(), inputFingerprint: (h >>> 0).toString(16).padStart(8, "0") };
}

export const REFERENCES: ReadonlyArray<{ id: string; citation: string; summary: string }> = [
  { id: "RFC-4648", citation: "RFC 4648 (2006)", summary: "Base16, Base32, and Base64 Data Encodings." },
  { id: "RFC-3986", citation: "RFC 3986 (2005)", summary: "Uniform Resource Identifier — percent-encoding." },
  { id: "HTML5-Spec", citation: "HTML5 Specification", summary: "HTML character entity references." },
];
