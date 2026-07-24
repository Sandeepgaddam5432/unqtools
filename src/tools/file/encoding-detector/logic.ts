/**
 * File Encoding Detector — pure logic.
 */

export type Encoding = "utf-8" | "utf-16le" | "utf-16be" | "utf-32le" | "utf-32be" | "ascii" | "latin-1" | "windows-1252" | "binary";

export interface EncodingCandidate {
  encoding: Encoding;
  confidence: number; // 0..1
  reason: string;
}

export interface DetectionResult {
  detected: Encoding;
  confidence: number;
  candidates: EncodingCandidate[];
  bom: { present: boolean; type: "utf-8" | "utf-16le" | "utf-16be" | "utf-32le" | "utf-32be" | null };
  fileSize: number;
  firstFourBytes: string; // hex
  printableAsciiRatio: number;
  nullByteCount: number;
  controlCharCount: number;
  lineEndings: "crlf" | "lf" | "cr" | "mixed" | "none";
  byteHistogram: { byte: number; count: number }[]; // top 20
  warnings: string[];
  preview: { hex: string; printable: string };
}

const BOMS: { bytes: number[]; encoding: DetectionResult["bom"]["type"]; utfEncoding: Encoding }[] = [
  { bytes: [0xEF, 0xBB, 0xBF], encoding: "utf-8", utfEncoding: "utf-8" },
  { bytes: [0xFF, 0xFE], encoding: "utf-16le", utfEncoding: "utf-16le" },
  { bytes: [0xFE, 0xFF], encoding: "utf-16be", utfEncoding: "utf-16be" },
  { bytes: [0xFF, 0xFE, 0x00, 0x00], encoding: "utf-32le", utfEncoding: "utf-32le" },
  { bytes: [0x00, 0x00, 0xFE, 0xFF], encoding: "utf-32be", utfEncoding: "utf-32be" },
];

function bytesToHex(bytes: Uint8Array, max = 256): string {
  return Array.from(bytes.slice(0, max)).map((b) => b.toString(16).padStart(2, "0")).join(" ");
}

function isUtf8Valid(bytes: Uint8Array): boolean {
  let i = 0;
  while (i < bytes.length) {
    const b = bytes[i]!;
    if (b < 0x80) { i++; continue; }
    let extra: number;
    let min: number;
    if (b >= 0xC2 && b <= 0xDF) { extra = 1; min = 0x80; }
    else if (b >= 0xE0 && b <= 0xEF) { extra = 2; min = 0x800; }
    else if (b >= 0xF0 && b <= 0xF4) { extra = 3; min = 0x10000; }
    else return false;
    if (i + extra >= bytes.length) return false;
    for (let j = 1; j <= extra; j++) {
      const c = bytes[i + j]!;
      if (c < 0x80 || c > 0xBF) return false;
    }
    i += 1 + extra;
  }
  return true;
}

export function detectEncoding(bytes: Uint8Array): DetectionResult {
  const candidates: EncodingCandidate[] = [];
  const warnings: string[] = [];
  const fileSize = bytes.length;

  // BOM check
  let bom: DetectionResult["bom"] = { present: false, type: null };
  for (const b of BOMS) {
    if (bytes.length >= b.bytes.length && b.bytes.every((v, i) => bytes[i] === v)) {
      bom = { present: true, type: b.encoding };
      candidates.push({ encoding: b.utfEncoding, confidence: 1.0, reason: `${b.encoding} BOM detected` });
      break;
    }
  }

  // UTF-16 detection (no BOM)
  if (!bom.present && fileSize >= 4) {
    const nullEven = bytes[0] !== 0 && bytes[1] === 0;
    const nullOdd = bytes[0] === 0 && bytes[1] !== 0;
    if (nullEven) {
      candidates.push({ encoding: "utf-16le", confidence: 0.85, reason: "Null byte at odd positions (UTF-16 LE pattern)" });
    }
    if (nullOdd) {
      candidates.push({ encoding: "utf-16be", confidence: 0.85, reason: "Null byte at even positions (UTF-16 BE pattern)" });
    }
  }

  // Strip BOM if present for further analysis
  const contentBytes = bom.present
    ? bytes.slice(BOMS.find((b) => b.encoding === bom.type)!.bytes.length)
    : bytes;

  // UTF-8 validity check (only if not already UTF-16)
  if (!bom.present && !candidates.some((c) => c.encoding.startsWith("utf-16"))) {
    if (isUtf8Valid(contentBytes)) {
      const hasMultibyte = contentBytes.some((b) => b >= 0x80);
      candidates.push({
        encoding: "utf-8",
        confidence: hasMultibyte ? 0.95 : 0.7,
        reason: hasMultibyte ? "Valid UTF-8 multi-byte sequences found" : "Valid ASCII (which is also valid UTF-8)",
      });
    } else {
      candidates.push({ encoding: "utf-8", confidence: 0.0, reason: "Invalid UTF-8 byte sequences" });
      warnings.push("Not valid UTF-8 — may be Latin-1, Windows-1252, or binary.");
    }
  }

  // ASCII vs Latin-1 vs Windows-1252
  let printableCount = 0;
  let nullCount = 0;
  let controlCount = 0;
  const histogram = new Array(256).fill(0);
  for (let i = 0; i < contentBytes.length; i++) {
    const b = contentBytes[i]!;
    histogram[b]++;
    if (b === 0) nullCount++;
    else if (b < 0x20 && b !== 0x09 && b !== 0x0A && b !== 0x0D) controlCount++;
    else if (b >= 0x20 && b < 0x7F) printableCount++;
    else if (b >= 0xA0) printableCount++; // Latin-1 printable
  }
  const printableAsciiRatio = contentBytes.length > 0 ? printableCount / contentBytes.length : 0;

  // ASCII
  const allAscii = contentBytes.every((b) => b < 0x80);
  if (allAscii && contentBytes.length > 0) {
    candidates.push({ encoding: "ascii", confidence: 0.9, reason: "All bytes are in ASCII range (0x00-0x7F)" });
  }

  // Latin-1 / Windows-1252 (fallback if not UTF-8)
  if (!candidates.some((c) => c.encoding === "utf-8" && c.confidence > 0.5)) {
    if (printableAsciiRatio > 0.8) {
      // Check for Windows-1252 specific bytes (0x80-0x9F range that's undefined in Latin-1)
      const hasWin1252Bytes = contentBytes.some((b) => b >= 0x80 && b <= 0x9F && b !== 0x81 && b !== 0x8D && b !== 0x8F && b !== 0x90 && b !== 0x9D);
      candidates.push({
        encoding: hasWin1252Bytes ? "windows-1252" : "latin-1",
        confidence: 0.6,
        reason: hasWin1252Bytes ? "Bytes in 0x80-0x9F range (Windows-1252 specific)" : "High printable ratio, Latin-1 compatible",
      });
    }
  }

  // Binary detection
  if (nullCount > contentBytes.length * 0.05 || printableAsciiRatio < 0.5) {
    candidates.push({ encoding: "binary", confidence: 0.7, reason: `High null-byte ratio or low printable ratio (${(printableAsciiRatio * 100).toFixed(1)}%)` });
    warnings.push("File appears to be binary (high null-byte or low printable ratio).");
  }

  // Sort candidates by confidence
  candidates.sort((a, b) => b.confidence - a.confidence);
  const detected = candidates[0]?.encoding ?? "binary";
  const confidence = candidates[0]?.confidence ?? 0;

  // Line endings (only meaningful for text)
  let lineEndings: DetectionResult["lineEndings"] = "none";
  const text = (() => {
    try {
      return new TextDecoder(detected === "binary" ? "utf-8" : detected, { fatal: false }).decode(bytes);
    } catch {
      return "";
    }
  })();
  if (text) {
    const crlf = (text.match(/\r\n/g) ?? []).length;
    const lf = (text.match(/(?<!\r)\n/g) ?? []).length;
    const cr = (text.match(/\r(?!\n)/g) ?? []).length;
    const types = [crlf > 0 && "crlf", lf > 0 && "lf", cr > 0 && "cr"].filter(Boolean);
    if (types.length === 0) lineEndings = "none";
    else if (types.length === 1) lineEndings = types[0] as DetectionResult["lineEndings"];
    else lineEndings = "mixed";
  }

  // Byte histogram top 20
  const byteHistogram = histogram
    .map((count, byte) => ({ byte, count }))
    .filter((h) => h.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  // First 4 bytes hex
  const firstFourBytes = bytesToHex(bytes, 4);

  // Preview
  const previewHex = bytesToHex(contentBytes, 256);
  const previewPrintable = Array.from(contentBytes.slice(0, 256))
    .map((b) => (b >= 0x20 && b < 0x7F) || b === 0x0A || b === 0x0D || b === 0x09 ? String.fromCharCode(b) : ".")
    .join("");

  if (bom.present) warnings.push(`BOM detected: ${bom.type}. Some legacy readers may need this stripped.`);
  if (lineEndings === "mixed") warnings.push("Mixed line endings detected.");

  return {
    detected,
    confidence,
    candidates,
    bom,
    fileSize,
    firstFourBytes,
    printableAsciiRatio,
    nullByteCount: nullCount,
    controlCharCount: controlCount,
    lineEndings,
    byteHistogram,
    warnings,
    preview: { hex: previewHex, printable: previewPrintable },
  };
}

/** Decode bytes using detected encoding. */
export function decodeWithEncoding(bytes: Uint8Array, encoding: Encoding): string {
  try {
    return new TextDecoder(encoding === "binary" || encoding === "ascii" || encoding === "latin-1" || encoding === "windows-1252" ? "utf-8" : encoding, { fatal: false }).decode(bytes);
  } catch {
    return "";
  }
}

export function detectionToCsv(results: { fileName: string; result: DetectionResult }[]): string {
  const lines = ["FileName,Detected,Confidence,BOM,FileSize,PrintableRatio,LineEndings"];
  for (const { fileName, result } of results) {
    lines.push(`${fileName},${result.detected},${(result.confidence * 100).toFixed(1)}%,${result.bom.present ? result.bom.type : "none"},${result.fileSize},${(result.printableAsciiRatio * 100).toFixed(1)}%,${result.lineEndings}`);
  }
  return lines.join("\n");
}
