/**
 * Text Encoding Converter — pure logic.
 */
import { detectEncoding, type Encoding } from "../encoding-detector/logic";

export type TargetEncoding = "utf-8" | "utf-16le" | "utf-16be" | "ascii" | "latin-1" | "windows-1252";

export interface ConvertOptions {
  target: TargetEncoding;
  bom: "add" | "strip" | "preserve";
  /** Replace invalid chars with '?' instead of throwing. Default true. */
  lossy?: boolean;
}

export interface ConvertResult {
  output: Uint8Array;
  sourceEncoding: Encoding;
  targetEncoding: TargetEncoding;
  sizeBefore: number;
  sizeAfter: number;
  sizeDelta: number;
  hasBom: boolean;
  warnings: string[];
  hexPreview: string;
  textPreview: string;
}

const BOMS: Record<TargetEncoding, number[]> = {
  "utf-8": [0xEF, 0xBB, 0xBF],
  "utf-16le": [0xFF, 0xFE],
  "utf-16be": [0xFE, 0xFF],
  ascii: [],
  "latin-1": [],
  "windows-1252": [],
};

function bytesToHex(bytes: Uint8Array, max = 80): string {
  return Array.from(bytes.slice(0, max)).map((b) => b.toString(16).padStart(2, "0")).join(" ");
}

export function convertEncoding(sourceBytes: Uint8Array, options: ConvertOptions): ConvertResult | { error: string } {
  const detection = detectEncoding(sourceBytes);
  const sourceEncoding = detection.detected;

  // Decode source to string
  let text: string;
  try {
    const decoder = new TextDecoder(
      sourceEncoding === "binary" || sourceEncoding === "ascii" ? "utf-8" :
      sourceEncoding === "utf-16le" || sourceEncoding === "utf-16be" ? sourceEncoding :
      sourceEncoding === "utf-32le" || sourceEncoding === "utf-32be" ? "utf-8" : // fallback
      sourceEncoding,
      { fatal: !options.lossy }
    );
    text = decoder.decode(sourceBytes);
  } catch (e) {
    if (options.lossy) {
      text = new TextDecoder("utf-8", { fatal: false }).decode(sourceBytes);
    } else {
      return { error: `Failed to decode source as ${sourceEncoding}: ${(e as Error).message}` };
    }
  }

  // Encode to target
  let output: Uint8Array;
  const warnings: string[] = [];

  switch (options.target) {
    case "utf-8": {
      output = new TextEncoder().encode(text);
      break;
    }
    case "utf-16le":
    case "utf-16be": {
      const view = new DataView(new ArrayBuffer(text.length * 2));
      for (let i = 0; i < text.length; i++) {
        const code = text.charCodeAt(i);
        if (options.target === "utf-16le") view.setUint16(i * 2, code, true);
        else view.setUint16(i * 2, code, false);
      }
      output = new Uint8Array(view.buffer);
      break;
    }
    case "ascii": {
      const arr: number[] = [];
      for (let i = 0; i < text.length; i++) {
        const code = text.charCodeAt(i);
        if (code < 0x80) arr.push(code);
        else if (options.lossy) arr.push(0x3F); // '?'
        else return { error: `Char at index ${i} (U+${code.toString(16)}) is outside ASCII range. Use lossy mode to replace with '?'.` };
      }
      output = new Uint8Array(arr);
      if (arr.some((c) => c === 0x3F)) warnings.push("Some characters replaced with '?' (outside ASCII range).");
      break;
    }
    case "latin-1":
    case "windows-1252": {
      const arr: number[] = [];
      for (let i = 0; i < text.length; i++) {
        const code = text.charCodeAt(i);
        if (code <= 0xFF) arr.push(code);
        else if (options.lossy) arr.push(0x3F);
        else return { error: `Char at index ${i} (U+${code.toString(16)}) is outside ${options.target} range. Use lossy mode.` };
      }
      output = new Uint8Array(arr);
      if (arr.some((c) => c === 0x3F)) warnings.push(`Some characters replaced with '?' (outside ${options.target} range).`);
      break;
    }
    default:
      return { error: `Unsupported target encoding: ${options.target}` };
  }

  // Handle BOM
  let hasBom = false;
  const bomBytes = BOMS[options.target];
  if (bomBytes.length > 0) {
    const startsWithBom = output.length >= bomBytes.length && bomBytes.every((b, i) => output[i] === b);
    if (options.bom === "add" && !startsWithBom) {
      const newOutput = new Uint8Array(bomBytes.length + output.length);
      newOutput.set(bomBytes, 0);
      newOutput.set(output, bomBytes.length);
      output = newOutput;
      hasBom = true;
    } else if (options.bom === "strip" && startsWithBom) {
      output = output.slice(bomBytes.length);
      hasBom = false;
    } else if (options.bom === "preserve") {
      hasBom = startsWithBom || detection.bom.present;
      if (detection.bom.present && !startsWithBom) {
        const newOutput = new Uint8Array(bomBytes.length + output.length);
        newOutput.set(bomBytes, 0);
        newOutput.set(output, bomBytes.length);
        output = newOutput;
        hasBom = true;
      }
    } else {
      hasBom = startsWithBom;
    }
  } else if (options.bom === "strip") {
    // For ASCII/Latin-1/Windows-1252, strip any leading BOM bytes if present
    if (output.length >= 3 && output[0] === 0xEF && output[1] === 0xBB && output[2] === 0xBF) {
      output = output.slice(3);
    }
  }

  const sizeBefore = sourceBytes.length;
  const sizeAfter = output.length;
  const sizeDelta = sizeAfter - sizeBefore;

  const hexPreview = bytesToHex(output, 80);
  const textPreview = (() => {
    try {
      return new TextDecoder(options.target === "ascii" || options.target === "latin-1" || options.target === "windows-1252" ? "utf-8" : options.target, { fatal: false }).decode(output).slice(0, 200);
    } catch {
      return "";
    }
  })();

  if (detection.warnings.length > 0) warnings.push(...detection.warnings);
  if (sourceEncoding === "binary") warnings.push("Source was detected as binary — conversion may produce unexpected output.");

  return {
    output,
    sourceEncoding,
    targetEncoding: options.target,
    sizeBefore,
    sizeAfter,
    sizeDelta,
    hasBom,
    warnings,
    hexPreview,
    textPreview,
  };
}

/** Generate HTML charset declaration for a given encoding. */
export function generateCharsetDeclaration(encoding: TargetEncoding): string {
  const charset = encoding === "utf-8" ? "utf-8" : encoding === "utf-16le" || encoding === "utf-16be" ? "utf-16" : encoding === "windows-1252" ? "windows-1252" : encoding === "latin-1" ? "iso-8859-1" : "us-ascii";
  return `<meta charset="${charset}">\n<!-- OR equivalent: -->\n<meta http-equiv="Content-Type" content="text/html; charset=${charset}">`;
}

/** Trigger download of converted bytes. */
export function downloadBytes(bytes: Uint8Array, filename: string, mime = "application/octet-stream"): void {
  const blob = new Blob([bytes], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
