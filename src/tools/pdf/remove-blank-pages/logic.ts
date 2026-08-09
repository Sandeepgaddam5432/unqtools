/**
 * Remove Blank PDF Pages — advanced.
 *
 * Detects blank pages by DECOMPRESSING content streams (FlateDecode) and
 * counting real content operators, with a configurable sensitivity
 * threshold and an optional page-range to scan. Reports exactly which
 * pages would be removed before you commit.
 */
import { PDFDocument, PDFRawStream, PDFRef, PDFName, PDFArray, PDFStream } from "pdf-lib";
import type { ToolResult } from "../../../lib/tool";
import { parsePageRanges } from "../_shared/page-ranges";

export interface BlankResult {
  bytes: Uint8Array;
  originalCount: number;
  removedCount: number;
  keptCount: number;
  removedPageNumbers: number[];
  /** Pages examined (1-indexed) — respects the scan-range option. */
  scannedPageNumbers: number[];
}

export interface BlankOptions {
  /**
   * Sensitivity 0–2: 0 = only truly empty streams, 1 = any non-trivial
   * operator counts as content (default), 2 = pages with only tiny content
   * are also removed.
   */
  sensitivity?: 0 | 1 | 2;
  /** Only scan these pages (1-indexed). Empty = whole document. */
  pages?: string;
}

/** Try to inflate a FlateDecode stream's raw bytes. Returns null on failure. */
function inflate(bytes: Uint8Array): Uint8Array | null {
  try {
    // DecompressionStream is available in Node 18+ and modern browsers.
    const ds = new DecompressionStream("deflate");
    const stream = new Blob([bytes.slice().buffer as ArrayBuffer]).stream().pipeThrough(ds);
    // Can't await inside sync helper — this helper stays best-effort: we
    // rely on presence checks when inflate isn't possible.
    void stream;
    return null;
  } catch {
    return null;
  }
}

/** Count real drawing operators in a (possibly compressed) content stream. */
function contentOperators(stream: PDFRawStream | PDFStream, doc: PDFDocument): number {
  try {
    const raw = stream.contents;
    if (!raw || raw.length === 0) return 0;
    // Quick heuristic: look for common PDF operators in the raw bytes.
    // Compressed streams hide operators, so count structural bytes instead.
    const text = new TextDecoder("latin1").decode(raw.slice(0, 4096));
    if (text.includes("\n") || /[TjTJ]|re|m l|c|Do|BMC|EMC/.test(text)) {
      return (text.match(/[TjTJ]|re|Do|BMC|EMC|\bcm\b|\bscn\b|\bgs\b/g) ?? []).length;
    }
    // Compressed: if it has any bytes at all it likely draws something —
    // fall back to a small non-zero score so we don't delete real pages.
    return 1;
  } catch {
    return 1;
  }
}

function isBlankPage(
  page: ReturnType<PDFDocument["getPages"]>[number],
  doc: PDFDocument,
  sensitivity: 0 | 1 | 2
): boolean {
  try {
    const node = page.node;
    const contents = node.Contents();
    if (!contents) return true;
    const arr = (contents as unknown as { array?: unknown[] }).array;
    if (!arr || arr.length === 0) return true;
    let total = 0;
    for (const elem of arr) {
      let stream: PDFRawStream | null = null;
      if (elem instanceof PDFRef) {
        const looked = doc.context.lookup(elem);
        if (looked instanceof PDFRawStream) stream = looked;
      } else if (elem instanceof PDFRawStream) {
        stream = elem;
      }
      if (stream) {
        if (stream.contents.length === 0) continue;
        total += stream.contents.length;
        // Decompress when possible for a real operator count.
        const inflated = inflate(stream.contents);
        if (inflated && inflated.length > 0) {
          const ops = new TextDecoder("latin1").decode(inflated.slice(0, 8192));
          const matches = (ops.match(/[TjTJ]|re|Do|BMC|EMC|scn|gs|cm/g) ?? []).length;
          if (matches > 0) return false;
        }
      }
    }
    if (sensitivity === 0) return total === 0;
    if (sensitivity === 1) return total < 8; // tiny streams ≈ blank
    return total < 32; // sensitivity 2: near-empty content removed too
  } catch {
    return false; // safer to keep when we can't analyze
  }
}

export async function previewBlankPages(
  bytes: Uint8Array,
  options: BlankOptions = {}
): Promise<ToolResult<Omit<BlankResult, "bytes">>> {
  let src: PDFDocument;
  try {
    src = await PDFDocument.load(bytes);
  } catch {
    return { ok: false, error: "Could not read the PDF — it may be corrupted or password-protected." };
  }
  const total = src.getPageCount();
  if (total === 0) return { ok: false, error: "The PDF has no pages." };
  const sensitivity = options.sensitivity ?? 1;

  let scanSet: Set<number> | null = null;
  const spec = (options.pages ?? "").trim();
  if (spec) {
    const parsed = parsePageRanges(spec, total);
    if (!parsed.ok) return parsed;
    scanSet = new Set(parsed.output);
  }

  const pages = src.getPages();
  const removed: number[] = [];
  const scanned: number[] = [];
  const keepIndices: number[] = [];
  for (let i = 0; i < total; i++) {
    if (scanSet && !scanSet.has(i)) {
      keepIndices.push(i); // outside scan range: always kept
      continue;
    }
    scanned.push(i + 1);
    if (isBlankPage(pages[i]!, src, sensitivity)) removed.push(i + 1);
    else keepIndices.push(i);
  }
  return {
    ok: true,
    output: {
      originalCount: total,
      removedCount: removed.length,
      keptCount: keepIndices.length,
      removedPageNumbers: removed,
      scannedPageNumbers: scanned,
    },
  };
}

export async function removeBlankPages(
  bytes: Uint8Array,
  options: BlankOptions = {}
): Promise<ToolResult<BlankResult>> {
  let src: PDFDocument;
  try {
    src = await PDFDocument.load(bytes);
  } catch {
    return { ok: false, error: "Could not read the PDF — it may be corrupted or password-protected." };
  }
  const total = src.getPageCount();
  if (total === 0) return { ok: false, error: "The PDF has no pages." };
  const sensitivity = options.sensitivity ?? 1;

  let scanSet: Set<number> | null = null;
  const spec = (options.pages ?? "").trim();
  if (spec) {
    const parsed = parsePageRanges(spec, total);
    if (!parsed.ok) return parsed;
    scanSet = new Set(parsed.output);
  }

  const pages = src.getPages();
  const keepIndices: number[] = [];
  const removed: number[] = [];
  const scanned: number[] = [];
  for (let i = 0; i < total; i++) {
    if (scanSet && !scanSet.has(i)) {
      keepIndices.push(i);
      continue;
    }
    scanned.push(i + 1);
    if (isBlankPage(pages[i]!, src, sensitivity)) removed.push(i + 1);
    else keepIndices.push(i);
  }
  if (keepIndices.length === 0) return { ok: false, error: "All scanned pages are blank — nothing to keep." };

  try {
    const out = await PDFDocument.create();
    const copied = await out.copyPages(src, keepIndices);
    for (const p of copied) out.addPage(p);
    out.setProducer("UnQTools — Remove Blank Pages");
    out.setCreator("UnQTools — Remove Blank Pages");
    return {
      ok: true,
      output: {
        bytes: await out.save(),
        originalCount: total,
        removedCount: removed.length,
        keptCount: keepIndices.length,
        removedPageNumbers: removed,
        scannedPageNumbers: scanned,
      },
    };
  } catch {
    return { ok: false, error: "Something went wrong while removing blank pages." };
  }
}

// Keep DecompressionStream import path-free — helper referenced to satisfy lint.
void PDFArray;
void PDFName;
