/**
 * PDF Security Remover — pure logic for parsing PDF /Encrypt dictionaries,
 * verifying user passwords against the stored /U hash, and stripping the
 * /Encrypt dictionary from the trailer.
 *
 * HONESTY CLAUSE: We parse the /Encrypt dictionary and verify the user
 * password (per PDF spec). We strip /Encrypt from the trailer so the PDF
 * opens without a password prompt. We do NOT decrypt encrypted streams —
 * for PDFs with full stream encryption (Acrobat-produced), the output
 * content remains encrypted and may appear as garbage. Documented in FAQ.
 */

import { PDFDocument } from "pdf-lib";
import {
  PDF_PADDING,
  padPassword,
  rc4Crypt,
  computeEncryptionKey,
  computeU,
  getEncryptionParams,
  encodePermissions,
  decodePermissions,
  describePermissions,
  type EncryptionLevel,
  type PermissionFlags,
} from "../pdf-password-encryptor/logic";

// Re-export commonly used types/functions for tests and UI
export {
  PDF_PADDING,
  padPassword,
  rc4Crypt,
  getEncryptionParams,
  encodePermissions,
  decodePermissions,
  describePermissions,
  type EncryptionLevel,
  type PermissionFlags,
};

export interface ParsedEncryptDict {
  /** True if the PDF has an /Encrypt dictionary in the trailer. */
  hasEncrypt: boolean;
  /** /V value (1 = 40-bit RC4, 2 = 128-bit RC4, 4 = 128-bit AES). */
  V: number | null;
  /** /R value (2, 3, or 4). */
  R: number | null;
  /** /Length value in bits (40 or 128). */
  length: number | null;
  /** /O hash (32 bytes). */
  O: Uint8Array | null;
  /** /U hash (32 bytes). */
  U: Uint8Array | null;
  /** /P permissions integer (signed 32-bit). */
  P: number | null;
  /** Decoded permission flags. */
  permissions: PermissionFlags | null;
  /** The encryption level inferred from V/R. */
  level: EncryptionLevel | null;
  /** Raw /Encrypt dictionary text (for display). */
  rawText: string;
  /** Error message if parsing failed. */
  error?: string;
}

/** Determine the encryption level from V and R values. */
export function inferEncryptionLevel(V: number | null, R: number | null): EncryptionLevel | null {
  if (V === 1 && R === 2) return "rc4-40";
  if (V === 2 && R === 3) return "rc4-128";
  if (V === 4 && R === 4) return "aes-128";
  return null;
}

/** Convert a signed 32-bit integer (as encoded in /P) to an unsigned 32-bit value. */
export function signedToUnsigned(signed: number): number {
  return signed >>> 0;
}

/** Parse a PDF hex string `<...>` into a Uint8Array. */
export function parsePdfHexString(hex: string): Uint8Array {
  const cleaned = hex.replace(/^</, "").replace(/>$/, "").replace(/\s/g, "");
  // Pad with trailing 0 if odd length (per PDF spec §7.3.4.3)
  const padded = cleaned.length % 2 === 1 ? cleaned + "0" : cleaned;
  const out = new Uint8Array(Math.floor(padded.length / 2));
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(padded.substring(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/**
 * Find the trailer dictionary text in a PDF.
 * Handles both old-style (`trailer << ... >>`) and new-style (PDF 1.5+ XRef
 * stream where the trailer dict is inside the last `N 0 obj << ... >>` before
 * `startxref`).
 */
export function findTrailerDict(pdfStr: string): { start: number; end: number; text: string } | null {
  const startxrefIdx = pdfStr.lastIndexOf("startxref");
  if (startxrefIdx === -1) return null;
  // Look for `trailer` keyword first
  const trailerIdx = pdfStr.lastIndexOf("trailer", startxrefIdx);
  if (trailerIdx !== -1) {
    // Old-style: find `<<` after trailer, then matching `>>`
    const afterTrailer = pdfStr.substring(trailerIdx);
    const dictStart = afterTrailer.indexOf("<<");
    if (dictStart !== -1) {
      const dictEnd = afterTrailer.indexOf(">>", dictStart);
      if (dictEnd !== -1) {
        return {
          start: trailerIdx + dictStart,
          end: trailerIdx + dictEnd + 2,
          text: afterTrailer.substring(dictStart, dictEnd + 2),
        };
      }
    }
  }
  // New-style: find the last `obj` keyword (word-bounded) before `startxref`.
  // The trailer dict is the `<<` right after that `N 0 obj`.
  const beforeStartxref = pdfStr.substring(0, startxrefIdx);
  const objMatches: number[] = [];
  const re = /(^|\s)obj(\s|$)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(beforeStartxref)) !== null) {
    objMatches.push(match.index + (match[1]?.length ?? 0));
  }
  if (objMatches.length === 0) return null;
  const lastObjIdx = objMatches[objMatches.length - 1]!;
  const afterObj = pdfStr.substring(lastObjIdx);
  const dictStart = afterObj.indexOf("<<");
  if (dictStart === -1) return null;
  const dictEnd = afterObj.indexOf(">>", dictStart);
  if (dictEnd === -1) return null;
  return {
    start: lastObjIdx + dictStart,
    end: lastObjIdx + dictEnd + 2,
    text: afterObj.substring(dictStart, dictEnd + 2),
  };
}

/**
 * Extract the /Encrypt dictionary text from a PDF byte array.
 * Searches the trailer (old-style or XRef stream) for `/Encrypt N 0 R`,
 * then finds that object and returns its dictionary text.
 */
export function extractEncryptDictText(pdfBytes: Uint8Array): { hasEncrypt: boolean; dictText: string; objNum: number | null } {
  const pdfStr = new TextDecoder().decode(pdfBytes);
  const trailer = findTrailerDict(pdfStr);
  if (!trailer) return { hasEncrypt: false, dictText: "", objNum: null };
  // Find /Encrypt N 0 R in the trailer
  const encMatch = trailer.text.match(/\/Encrypt\s+(\d+)\s+\d+\s+R/);
  if (!encMatch) return { hasEncrypt: false, dictText: "", objNum: null };
  const objNum = parseInt(encMatch[1]!, 10);
  // Find the object: "N 0 obj ... endobj"
  const objRegex = new RegExp(`${objNum}\\s+0\\s+obj(.*?)endobj`, "s");
  const objMatch = pdfStr.match(objRegex);
  if (!objMatch) return { hasEncrypt: true, dictText: "", objNum };
  return { hasEncrypt: true, dictText: objMatch[1]!.trim(), objNum };
}

/** Extract a key-value pair from the /Encrypt dictionary text. */
function extractValue(dictText: string, key: string): string | null {
  const regex = new RegExp(`/${key}\\s+(\\S+)`);
  const m = dictText.match(regex);
  return m ? m[1]! : null;
}

/** Extract a hex string value from the /Encrypt dictionary. */
function extractHexValue(dictText: string, key: string): Uint8Array | null {
  const regex = new RegExp(`/${key}\\s*(<[0-9a-fA-F\\s]+>)`);
  const m = dictText.match(regex);
  if (!m) return null;
  return parsePdfHexString(m[1]!);
}

/**
 * Parse the /Encrypt dictionary from a PDF byte array.
 */
export function parseEncryptDict(pdfBytes: Uint8Array): ParsedEncryptDict {
  const { hasEncrypt, dictText, objNum } = extractEncryptDictText(pdfBytes);
  if (!hasEncrypt) {
    return {
      hasEncrypt: false, V: null, R: null, length: null,
      O: null, U: null, P: null, permissions: null, level: null,
      rawText: "",
    };
  }
  if (!dictText) {
    return {
      hasEncrypt: true, V: null, R: null, length: null,
      O: null, U: null, P: null, permissions: null, level: null,
      rawText: "",
      error: `Found /Encrypt reference (object ${objNum}) but could not extract the dictionary text.`,
    };
  }
  const V = parseInt(extractValue(dictText, "V") ?? "0", 10) || null;
  const R = parseInt(extractValue(dictText, "R") ?? "0", 10) || null;
  const length = parseInt(extractValue(dictText, "Length") ?? "0", 10) || null;
  const O = extractHexValue(dictText, "O");
  const U = extractHexValue(dictText, "U");
  const PRaw = extractValue(dictText, "P");
  const P = PRaw ? parseInt(PRaw, 10) : null;
  const level = inferEncryptionLevel(V, R);
  const permissions = (P !== null && R !== null) ? decodePermissions(P, R) : null;
  return {
    hasEncrypt: true, V, R, length, O, U, P, permissions, level,
    rawText: dictText,
  };
}

/**
 * Verify the user password against the stored /U hash.
 * Returns true if the password is correct.
 *
 * HONESTY: This implements the actual PDF spec algorithm. We compute /U
 * from the supplied password + document ID and compare to the stored /U.
 */
export function verifyUserPassword(
  userPassword: string,
  parsed: ParsedEncryptDict,
  documentId: Uint8Array,
): boolean {
  if (!parsed.hasEncrypt || !parsed.U || !parsed.O || parsed.P === null || !parsed.R || !parsed.V) {
    return false;
  }
  const level = inferEncryptionLevel(parsed.V, parsed.R);
  if (!level) return false;
  const params = getEncryptionParams(level);
  const key = computeEncryptionKey(userPassword, parsed.O, parsed.P, documentId, params);
  const computedU = computeU(key, documentId, params);
  // For R=2: compare all 32 bytes. For R=3+: compare first 16 bytes.
  const compareLen = params.R === 2 ? 32 : 16;
  for (let i = 0; i < compareLen; i++) {
    if (computedU[i] !== parsed.U[i]) return false;
  }
  return true;
}

/** Extract the document ID (first element of the /ID array) from the trailer. */
export function extractDocumentId(pdfBytes: Uint8Array): Uint8Array | null {
  const pdfStr = new TextDecoder().decode(pdfBytes);
  const trailer = findTrailerDict(pdfStr);
  if (!trailer) return null;
  const idMatch = trailer.text.match(/\/ID\s*\[\s*(<[0-9a-fA-F\s]+>)\s*(?:<[0-9a-fA-F\s]+>)?\s*\]/);
  if (!idMatch) return null;
  return parsePdfHexString(idMatch[1]!);
}

/**
 * Remove the /Encrypt dictionary from a PDF.
 * Uses pdf-lib's `ignoreEncryption: true` option to load the PDF without
 * applying encryption, then re-saves without /Encrypt in the trailer.
 *
 * HONESTY: For PDFs with full stream encryption, the streams remain
 * encrypted after removal and the output may show garbage content.
 */
export async function removeSecurity(pdfBytes: Uint8Array): Promise<Uint8Array> {
  let pdfDoc: PDFDocument;
  try {
    pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  } catch (e) {
    throw new Error(`Could not load PDF: ${(e as Error).message}`);
  }
  const out = await pdfDoc.save();
  return out as unknown as Uint8Array;
}

// ===== Batch removal =====

export interface BatchRemoveInput {
  fileName: string;
  bytes: Uint8Array;
}

export interface BatchRemoveResult {
  outputs: Array<{
    fileName: string;
    bytes: Uint8Array | null;
    error: string | null;
  }>;
  totalOriginal: number;
  totalRemoved: number;
}

export async function removeSecurityBatch(inputs: BatchRemoveInput[]): Promise<BatchRemoveResult> {
  const outputs = await Promise.all(inputs.map(async (inp) => {
    try {
      const bytes = await removeSecurity(inp.bytes);
      return { fileName: inp.fileName, bytes, error: null };
    } catch (e) {
      return { fileName: inp.fileName, bytes: null, error: (e as Error).message };
    }
  }));
  const totalOriginal = inputs.reduce((s, i) => s + i.bytes.length, 0);
  const totalRemoved = outputs.reduce((s, o) => s + (o.bytes?.length ?? 0), 0);
  return { outputs, totalOriginal, totalRemoved };
}

// ===== Utilities =====

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const k = 1024;
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/** Convert bytes to lowercase hex string. */
export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ===== History (localStorage) =====

const HISTORY_KEY = "unqtools-pdf-security-remover-history";
const MAX_HISTORY = 10;

export interface HistoryEntry {
  fileCount: number;
  totalOriginal: number;
  totalRemoved: number;
  removedAt: string;
}

export function loadHistory(): HistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, MAX_HISTORY) : [];
  } catch { return []; }
}

export function saveToHistory(entry: HistoryEntry): HistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  const updated = [entry, ...loadHistory()].slice(0, MAX_HISTORY);
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(updated)); } catch { /* ignore */ }
  return updated;
}

export function clearHistory(): void {
  if (typeof localStorage === "undefined") return;
  try { localStorage.removeItem(HISTORY_KEY); } catch { /* ignore */ }
}

// ===== Shareable URL =====

export function buildShareUrl(): string {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}${window.location.pathname}`;
}

export function parseShareUrl(hash: string): boolean | null {
  if (!hash || !hash.startsWith("#")) return null;
  return hash === "#auto";
}
