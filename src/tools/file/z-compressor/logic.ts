/**
 * Z Compressor — pure-JS Unix .Z (LZW) compress / decompress.
 *
 * .Z format (ncompress / compress):
 *   Byte 0: 0x1f   (magic)
 *   Byte 1: 0x9d   (magic)
 *   Byte 2: flags
 *     bit 0x1f (5 bits): max_bits (typically 16, range 9-16)
 *     bit 0x80:          block_mode (1 = block mode, the default)
 *
 *   Then a stream of variable-width LZW codes (9 to max_bits bits each,
 *   little-endian bit order — codes are packed LSB-first). Code 256 is
 *   CLEAR in block mode (reset dictionary), code 257 is FIRST free entry.
 *
 * We implement LZW as described by Welch (1984) and the ncompress source.
 */

import type { ToolResult } from "../../../lib/tool";

// ===== Constants =====

export const Z_MAGIC = [0x1f, 0x9d];
export const Z_DEFAULT_MAX_BITS = 16;
export const Z_MIN_BITS = 9;
export const Z_MAX_BITS_CAP = 16;
export const Z_BLOCK_MODE_FLAG = 0x80;
export const Z_INIT_BITS = 9;
export const Z_FIRST_CODE = 257;     // first free code (256 = CLEAR)
export const Z_CLEAR_CODE = 256;

// ===== Types =====

export interface ZHeader {
  magic: number[];
  maxBits: number;
  blockMode: boolean;
  isValid: boolean;
}

export interface ZStats {
  inputSize: number;
  outputSize: number;
  ratio: number;     // output / input (compress) or input / output (decompress)
  saved: number;     // bytes saved (positive = compression; negative = expansion)
  savedPercent: number;
  mode: "compress" | "decompress";
}

export interface ZOptions {
  maxBits: number;
  blockMode: boolean;
}

export const DEFAULT_OPTIONS: ZOptions = {
  maxBits: Z_DEFAULT_MAX_BITS,
  blockMode: true,
};

// ===== Header detection / parsing =====

/** Check if bytes start with the .Z magic (0x1f 0x9d). */
export function isZMagic(bytes: Uint8Array): boolean {
  return bytes.length >= 2 && bytes[0] === Z_MAGIC[0] && bytes[1] === Z_MAGIC[1];
}

/** Parse the 3-byte .Z header. */
export function parseHeader(bytes: Uint8Array): ZHeader {
  if (bytes.length < 3) {
    return { magic: [], maxBits: 0, blockMode: false, isValid: false };
  }
  const magic = [bytes[0]!, bytes[1]!];
  const flags = bytes[2]!;
  const maxBits = flags & 0x1f;
  const blockMode = (flags & Z_BLOCK_MODE_FLAG) !== 0;
  return {
    magic, maxBits, blockMode,
    isValid: isZMagic(bytes) && maxBits >= Z_MIN_BITS && maxBits <= Z_MAX_BITS_CAP,
  };
}

/** Build the 3-byte .Z header. */
export function buildHeader(opts: ZOptions): Uint8Array {
  const bits = Math.max(Z_MIN_BITS, Math.min(Z_MAX_BITS_CAP, opts.maxBits));
  const flags = (bits & 0x1f) | (opts.blockMode ? Z_BLOCK_MODE_FLAG : 0);
  return new Uint8Array([Z_MAGIC[0], Z_MAGIC[1], flags]);
}

// ===== Bit reader / writer (LSB-first) =====

class BitWriter {
  private bytes: number[] = [];
  private current = 0;
  private bitsInCurrent = 0;

  writeCode(code: number, width: number): void {
    this.current |= (code << this.bitsInCurrent) & 0xffffffff;
    this.bitsInCurrent += width;
    while (this.bitsInCurrent >= 8) {
      this.bytes.push(this.current & 0xff);
      this.current = (this.current >>> 8) & 0xffffff;
      this.bitsInCurrent -= 8;
    }
  }

  flush(): Uint8Array {
    if (this.bitsInCurrent > 0) {
      this.bytes.push(this.current & 0xff);
      this.current = 0;
      this.bitsInCurrent = 0;
    }
    return new Uint8Array(this.bytes);
  }
}

class BitReader {
  private current = 0;
  private bitsInCurrent = 0;
  private pos: number;
  constructor(private data: Uint8Array, startPos: number) {
    this.pos = startPos;
  }
  /**
   * Read a code of `width` bits. Returns null when no more real bits are
   * available (i.e., the read would consume only zero padding or extend
   * past end-of-file).
   */
  readCode(width: number): number | null {
    while (this.bitsInCurrent < width) {
      if (this.pos >= this.data.length) {
        // Can't read more bytes. Any bits in `current` are the trailing
        // padding bits — signal EOF.
        return null;
      }
      this.current |= (this.data[this.pos]! << this.bitsInCurrent) >>> 0;
      this.pos++;
      this.bitsInCurrent += 8;
    }
    this.bitsInCurrent -= width;
    const mask = (1 << width) - 1;
    const code = this.current & mask;
    this.current = (this.current >>> width) >>> 0;
    return code >>> 0;
  }
  get position(): number {
    return this.pos;
  }
}

// ===== LZW compression =====

/**
 * Compress bytes using LZW with variable-width codes (9 to maxBits).
 * Output is the .Z payload WITHOUT the 3-byte header (callers prepend it).
 */
export function compressLzw(data: Uint8Array, opts: ZOptions = DEFAULT_OPTIONS): Uint8Array {
  const maxBits = Math.max(Z_MIN_BITS, Math.min(Z_MAX_BITS_CAP, opts.maxBits));
  const blockMode = opts.blockMode;
  const writer = new BitWriter();
  // Initialize dictionary with single-byte entries (0–255).
  // Code 256 = CLEAR (only used in block mode), 257 = FIRST free.
  let nextCode = Z_FIRST_CODE;
  let bitWidth = Z_INIT_BITS;
  const maxCode = (1 << maxBits) - 1;

  // Dictionary: each code maps to a Map<nextByte, childCode>.
  // Initialize single-byte entries (0..255) with empty child maps.
  const dict = new Map<number, Map<number, number>>();
  for (let i = 0; i < 256; i++) {
    dict.set(i, new Map<number, number>());
  }

  if (data.length === 0) {
    return writer.flush();
  }

  // Initial prefix = first byte.
  let prefix = data[0]!;
  for (let i = 1; i < data.length; i++) {
    const b = data[i]!;
    const childMap = dict.get(prefix);
    if (!childMap) {
      // Shouldn't happen — prefix should always be in dict.
      writer.writeCode(prefix, bitWidth);
      prefix = b;
      continue;
    }
    const existing = childMap.get(b);
    if (existing !== undefined) {
      prefix = existing;
      continue;
    }
    // Output the prefix code.
    writer.writeCode(prefix, bitWidth);
    // Check if we need to increase bitWidth BEFORE adding the new entry.
    // (Matches ncompress: the check uses nextCode's value BEFORE the
    // increment that happens when adding the new entry this iteration.)
    if (nextCode > (1 << bitWidth) - 1 && bitWidth < maxBits) {
      bitWidth++;
    }
    // Add new dictionary entry (if dictionary isn't full).
    if (nextCode <= maxCode) {
      childMap.set(b, nextCode);
      dict.set(nextCode, new Map<number, number>());
      nextCode++;
    } else if (blockMode) {
      // Dictionary is full — emit CLEAR and reset.
      writer.writeCode(Z_CLEAR_CODE, bitWidth);
      nextCode = Z_FIRST_CODE;
      bitWidth = Z_INIT_BITS;
      dict.clear();
      for (let k = 0; k < 256; k++) dict.set(k, new Map<number, number>());
    }
    prefix = b;
  }
  // Flush the final prefix.
  writer.writeCode(prefix, bitWidth);

  return writer.flush();
}

// ===== LZW decompression =====

/**
 * Decompress .Z LZW payload. The data argument is the FULL .Z file (including
 * the 3-byte header); we start reading after the header.
 */
export function decompressLzw(data: Uint8Array, header: ZHeader): Uint8Array {
  if (!header.isValid) {
    throw new Error("Invalid .Z header — cannot decompress.");
  }
  const maxBits = header.maxBits;
  const blockMode = header.blockMode;
  const maxCode = (1 << maxBits) - 1;
  const reader = new BitReader(data, 3);

  // Output buffer (growable).
  const out: number[] = [];

  // Initialize dictionary: code -> byte sequence (stored as number[] for simplicity).
  // For memory efficiency, we use the standard trick: each entry stores its first byte
  // and a back-pointer to its prefix code, then we reconstruct by walking back.
  // We track: prefixCode[], lastChar[], and we maintain our own dynamic array of strings.
  const firstByte: number[] = new Array(maxCode + 1);
  const prevCode: number[] = new Array(maxCode + 1);   // prefix code for each new entry
  // Single-byte codes: firstByte[i] = i, prevCode[i] = -1
  for (let i = 0; i < 256; i++) {
    firstByte[i] = i;
    prevCode[i] = -1;
  }
  // 256 = CLEAR (block mode), 257 = FIRST
  let nextCode = Z_FIRST_CODE;
  let bitWidth = Z_INIT_BITS;

  // Helper: decode a code into a byte sequence (in order) and append to out.
  const decodeCode = (code: number): number => {
    // Walk back to find the first byte, then collect bytes in reverse.
    const stack: number[] = [];
    let c = code;
    while (c >= Z_FIRST_CODE && prevCode[c] !== -1) {
      stack.push(firstByte[c]!);
      c = prevCode[c]!;
    }
    // c is now a single-byte code (0..255).
    const firstByteValue = c;
    // Output first byte first.
    out.push(firstByteValue);
    // Output stacked bytes in reverse order.
    for (let i = stack.length - 1; i >= 0; i--) {
      out.push(stack[i]!);
    }
    return firstByteValue;  // first byte of the decoded sequence
  };

  let prevDecodedFirstByte = -1;
  let oldCode = -1;
  let first = true;

  // Read codes until end of stream.
  while (true) {
    // Check bitWidth BEFORE reading the next code so we use the same width
    // as the encoder (which bumps bitWidth AFTER writing code K but BEFORE
    // writing code K+1 — the decoder must mirror this).
    if (!first && nextCode > (1 << bitWidth) - 1 && bitWidth < maxBits) {
      bitWidth++;
    }
    const code = reader.readCode(bitWidth);
    if (code === null) break;
    handleCode(code);
  }

  function handleCode(code: number): void {
    if (code === Z_CLEAR_CODE && blockMode) {
      // Reset dictionary.
      nextCode = Z_FIRST_CODE;
      bitWidth = Z_INIT_BITS;
      oldCode = -1;
      first = true;
      return;
    }
    if (first) {
      // First non-CLEAR code: must be a single-byte (0..255).
      // Output the byte and remember it as oldCode.
      out.push(code);
      oldCode = code;
      prevDecodedFirstByte = code;
      first = false;
      return;
    }
    if (code < nextCode) {
      // Code is in dictionary.
      const fb = decodeCode(code);
      // Add (oldCode + first byte of new code) to dictionary.
      if (nextCode <= maxCode) {
        firstByte[nextCode] = fb;
        prevCode[nextCode] = oldCode;
        nextCode++;
      }
      oldCode = code;
      prevDecodedFirstByte = fb;
    } else if (code === nextCode) {
      // Special case: code === next free entry. The sequence is
      //   decode(oldCode) + prevDecodedFirstByte
      if (oldCode < 0) {
        throw new Error("Invalid .Z stream: code used before any prefix was established.");
      }
      const fb = decodeCode(oldCode);
      out.push(prevDecodedFirstByte);
      if (nextCode <= maxCode) {
        firstByte[nextCode] = prevDecodedFirstByte;
        prevCode[nextCode] = oldCode;
        nextCode++;
      }
      oldCode = code;
      prevDecodedFirstByte = fb;
    } else {
      throw new Error(`Invalid .Z stream: code ${code} out of range (next=${nextCode}).`);
    }
  }

  return new Uint8Array(out);
}

// ===== Top-level compress / decompress =====

export function compressZ(data: Uint8Array, opts: ZOptions = DEFAULT_OPTIONS): ToolResult<Uint8Array> {
  if (data.length === 0) {
    return { ok: false, error: "Nothing to compress — input is empty." };
  }
  try {
    const header = buildHeader(opts);
    const payload = compressLzw(data, opts);
    const out = new Uint8Array(header.length + payload.length);
    out.set(header, 0);
    out.set(payload, header.length);
    return { ok: true, output: out };
  } catch (e) {
    return { ok: false, error: `Compression failed: ${(e as Error).message}` };
  }
}

export function decompressZ(data: Uint8Array): ToolResult<Uint8Array> {
  if (!isZMagic(data)) {
    return { ok: false, error: "Not a .Z file — missing magic 0x1f 0x9d." };
  }
  if (data.length < 4) {
    return { ok: false, error: "Truncated .Z file — header but no payload." };
  }
  try {
    const header = parseHeader(data);
    if (!header.isValid) {
      return { ok: false, error: `Invalid .Z header: maxBits=${header.maxBits} (must be 9–16).` };
    }
    const out = decompressLzw(data, header);
    return { ok: true, output: out };
  } catch (e) {
    return { ok: false, error: `Decompression failed: ${(e as Error).message}` };
  }
}

// ===== Stats =====

export function computeStats(inputSize: number, outputSize: number, mode: "compress" | "decompress"): ZStats {
  // For compress: ratio = compressed / original (smaller is better).
  // For decompress: ratio = compressed / uncompressed (same — compressed is
  // always the smaller side). We compute compressed / uncompressed regardless
  // of mode.
  const compressed = mode === "compress" ? outputSize : inputSize;
  const uncompressed = mode === "compress" ? inputSize : outputSize;
  const ratio = uncompressed === 0 ? 0 : compressed / uncompressed;
  const saved = uncompressed - compressed;
  const savedPercent = uncompressed === 0 ? 0 : (saved / uncompressed) * 100;
  return { inputSize, outputSize, ratio, saved, savedPercent, mode };
}

// ===== Hex preview =====

export function hexPreview(bytes: Uint8Array, maxBytes = 256): string {
  const slice = bytes.subarray(0, Math.min(bytes.length, maxBytes));
  const lines: string[] = [];
  for (let i = 0; i < slice.length; i += 16) {
    const lineBytes = slice.subarray(i, Math.min(i + 16, slice.length));
    const hexPart = Array.from(lineBytes).map((b) => b.toString(16).padStart(2, "0")).join(" ");
    const asciiPart = Array.from(lineBytes).map((b) => b >= 0x20 && b <= 0x7e ? String.fromCharCode(b) : ".").join("");
    lines.push(`${i.toString(16).padStart(8, "0")}  ${hexPart.padEnd(48, " ")}  ${asciiPart}`);
  }
  if (bytes.length > maxBytes) {
    lines.push(`... (${bytes.length - maxBytes} more bytes)`);
  }
  return lines.join("\n");
}

// ===== Batch operations =====

export interface BatchResult {
  fileName: string;
  ok: boolean;
  error?: string;
  inputSize: number;
  outputSize: number;
  output?: Uint8Array;
  outputName: string;
}

export function batchCompress(
  files: Array<{ name: string; data: Uint8Array }>,
  opts: ZOptions = DEFAULT_OPTIONS,
): BatchResult[] {
  return files.map((f) => {
    const result = compressZ(f.data, opts);
    if (!result.ok) {
      return {
        fileName: f.name, ok: false, error: result.error,
        inputSize: f.data.length, outputSize: 0, outputName: "",
      };
    }
    return {
      fileName: f.name, ok: true,
      inputSize: f.data.length, outputSize: result.output.length,
      output: result.output,
      outputName: f.name + ".Z",
    };
  });
}

export function batchDecompress(
  files: Array<{ name: string; data: Uint8Array }>,
): BatchResult[] {
  return files.map((f) => {
    const result = decompressZ(f.data);
    if (!result.ok) {
      return {
        fileName: f.name, ok: false, error: result.error,
        inputSize: f.data.length, outputSize: 0, outputName: "",
      };
    }
    const outName = f.name.replace(/\.Z$/i, "").replace(/\.taz$/i, ".tar");
    return {
      fileName: f.name, ok: true,
      inputSize: f.data.length, outputSize: result.output.length,
      output: result.output,
      outputName: outName,
    };
  });
}

// ===== Auto-detection =====

export type ZMode = "compress" | "decompress";

/** Detect compress vs. decompress mode from filename + content. */
export function detectMode(fileName: string, data: Uint8Array): ZMode {
  // Magic bytes win.
  if (isZMagic(data)) return "decompress";
  // Otherwise, extension hints.
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".z") || lower.endsWith(".taz")) return "decompress";
  return "compress";
}

// ===== Utilities =====

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const k = 1024;
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

// ===== History (localStorage) =====

const HISTORY_KEY = "unqtools-z-compressor-history";
const MAX_HISTORY = 20;

export interface HistoryEntry {
  fileName: string;
  mode: ZMode;
  inputSize: number;
  outputSize: number;
  savedPercent: number;
  processedAt: string;
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

export function buildShareUrl(opts: ZOptions): string {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams();
  params.set("bits", String(opts.maxBits));
  params.set("block", opts.blockMode ? "1" : "0");
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ZOptions | null {
  if (!hash || !hash.startsWith("#")) return null;
  const params = new URLSearchParams(hash.slice(1));
  if (!params.has("bits") && !params.has("block")) return null;
  const bits = parseInt(params.get("bits") ?? "16", 10);
  const block = params.get("block") !== "0";
  return {
    maxBits: isNaN(bits) ? Z_DEFAULT_MAX_BITS : Math.max(Z_MIN_BITS, Math.min(Z_MAX_BITS_CAP, bits)),
    blockMode: block,
  };
}
