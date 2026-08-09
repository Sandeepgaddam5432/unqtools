/**
 * Shared PDF text extraction — real engine.
 *
 * Decodes each page's content streams (FlateDecode or raw), tokenizes the
 * PDF content operators and pulls out the actual text runs (`(...)` strings
 * after `Tj` / inside `TJ` arrays), reconstructing readable paragraphs with
 * line breaks where the layout moves to a new line (Td/TD/T* / ET).
 *
 * Honest limits: this is a text-run extractor, not a full PDF text
 * re-layout engine. Text that is vector outlines, in images, or encoded via
 * non-standard encodings will not come out perfectly — exactly like most
 * lightweight client-side extractors.
 */
import { PDFDocument, PDFName, PDFRawStream, PDFRef, PDFArray } from "pdf-lib";

/* ------------------------------------------------------------------ */
/* Flate decompression                                                 */
/* ------------------------------------------------------------------ */

/** Inflate raw bytes: tries zlib-wrapped (RFC1950) then raw deflate. */
export async function inflateBytes(bytes: Uint8Array): Promise<Uint8Array | null> {
  // Node
  if (typeof process !== "undefined" && process.versions?.node) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const zlib = require("node:zlib");
      try {
        return new Uint8Array(zlib.inflateSync(Buffer.from(bytes)));
      } catch {
        return new Uint8Array(zlib.inflateRawSync(Buffer.from(bytes)));
      }
    } catch {
      return null;
    }
  }
  // Browser
  try {
    for (const format of ["deflate", "deflate-raw"] as const) {
      try {
        const ds = new DecompressionStream(format);
        const stream = new Blob([bytes.slice().buffer as ArrayBuffer])
          .stream()
          .pipeThrough(ds);
        const buf = await new Response(stream).arrayBuffer();
        return new Uint8Array(buf);
      } catch {
        /* try next */
      }
    }
  } catch {
    /* fall through */
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* PDF string literal decoding                                         */
/* ------------------------------------------------------------------ */

/** Decode a `(...)` PDF string literal starting at i (returns text + next index). */
export function readPdfString(s: string, i: number): { str: string; next: number } {
  let out = "";
  let j = i + 1; // skip (
  while (j < s.length) {
    const c = s[j]!;
    if (c === "\\") {
      const n = s[j + 1];
      if (n === "n") out += "\n";
      else if (n === "r") out += "\r";
      else if (n === "t") out += "\t";
      else if (n === "b") out += "\b";
      else if (n === "f") out += "\f";
      else if (n === "(") out += "(";
      else if (n === ")") out += ")";
      else if (n === "\\") out += "\\";
      else if (n && /[0-7]/.test(n)) {
        // octal \ddd — backslash + 3 digits
        const octal = s.slice(j + 1, j + 4);
        const code = parseInt(octal, 8);
        if (!Number.isNaN(code)) out += String.fromCharCode(code);
        j += 4;
        continue;
      }
      j += 2;
      continue;
    }
    if (c === ")") {
      j++;
      break;
    }
    if (c === "(") {
      // nested — recurse
      const inner = readPdfString(s, j);
      out += inner.str;
      j = inner.next;
      continue;
    }
    out += c;
    j++;
  }
  return { str: out, next: j };
}

/** Decode a `<hex...>` PDF string starting at i (returns text + next index). */
export function readPdfHexString(s: string, i: number): { str: string; next: number } {
  let out = "";
  let j = i + 1;
  while (j < s.length && s[j] !== ">") {
    const pair = s.slice(j, j + 2);
    if (/^[0-9a-fA-F]{2}$/.test(pair)) {
      out += String.fromCharCode(parseInt(pair, 16));
      j += 2;
    } else {
      j += 1;
    }
  }
  return { str: out, next: Math.min(s.length, j + 1) };
}

/* ------------------------------------------------------------------ */
/* Content stream parsing                                              */
/* ------------------------------------------------------------------ */

export interface TextLine {
  text: string;
  /** Font size recorded at the start of the line (0 when unknown). */
  fontSize: number;
}

/**
 * Parse a page content stream into text lines.
 * Pure + testable in Node.
 */
export function parseContentText(streamBytes: Uint8Array): TextLine[] {
  const s = new TextDecoder("latin1").decode(streamBytes);
  const lines: TextLine[] = [];
  let current = "";
  let currentSize = 0;
  let inText = false;
  let i = 0;

  const flush = () => {
    if (current.trim()) lines.push({ text: current.replace(/\s+/g, " ").trim(), fontSize: currentSize });
    current = "";
  };

  while (i < s.length) {
    const ch = s[i]!;
    if (ch === "(" && inText) {
      const { str, next } = readPdfString(s, i);
      current += str;
      i = next;
      continue;
    }
    if (ch === "<" && inText && s[i + 1] !== "<") {
      const { str, next } = readPdfHexString(s, i);
      current += str;
      i = next;
      continue;
    }
    if (ch === "[" && inText) {
      // TJ array: gather all strings
      i++;
      while (i < s.length && s[i] !== "]") {
        if (s[i] === "(") {
          const { str, next } = readPdfString(s, i);
          current += str;
          i = next;
        } else if (s[i] === "<" && s[i + 1] !== "<") {
          const { str, next } = readPdfHexString(s, i);
          current += str;
          i = next;
        } else {
          i++;
        }
      }
      i++; // skip ]
      continue;
    }
    if (ch === "B" && s.startsWith("BT", i)) {
      inText = true;
      i += 2;
      continue;
    }
    if (ch === "E" && s.startsWith("ET", i)) {
      inText = false;
      flush();
      i += 2;
      continue;
    }
    if (ch === "T") {
      if (s.startsWith("Tj", i) || s.startsWith("TJ", i)) {
        i += 2;
        continue;
      }
      if (s.startsWith("Td", i) || s.startsWith("TD", i) || s.startsWith("T*", i)) {
        flush();
        i += 2;
        continue;
      }
      if (s.startsWith("Tm", i)) {
        flush();
        i += 2;
        continue;
      }
      if (s.startsWith("Tf", i)) {
        // font size: pattern " 12 Tf" — read number before
        const before = s.slice(0, i).trimEnd();
        const m = before.match(/([\d.]+)\s*$/);
        if (m) currentSize = Number(m[1]) || 0;
        i += 2;
        continue;
      }
      i++;
      continue;
    }
    i++;
  }
  flush();
  return lines.filter((l) => l.text.length > 0);
}

/* ------------------------------------------------------------------ */
/* Page-level extraction                                               */
/* ------------------------------------------------------------------ */

async function pageStreams(page: ReturnType<PDFDocument["getPages"]>[number], doc: PDFDocument): Promise<Uint8Array[]> {
  const out: Uint8Array[] = [];
  const contents = page.node.Contents();
  if (!contents) return out;
  const arr = (contents as unknown as { array?: unknown[] }).array;
  const items: unknown[] = Array.isArray(arr) ? arr : [contents];
  for (const item of items) {
    let stream: PDFRawStream | null = null;
    if (item instanceof PDFRef) {
      const looked = doc.context.lookup(item);
      if (looked instanceof PDFRawStream) stream = looked;
    } else if (item instanceof PDFRawStream) {
      stream = item;
    }
    if (stream) out.push(stream.contents);
  }
  return out;
}

/** Extract readable text from every page of a PDF. */
export async function extractAllText(bytes: Uint8Array): Promise<
  { ok: true; pages: string[]; fullText: string; pageCount: number }
  | { ok: false; error: string }
> {
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(bytes);
  } catch {
    return { ok: false, error: "Could not read the PDF — it may be corrupted or password-protected." };
  }
  const pageCount = doc.getPageCount();
  const pages: string[] = [];
  const pageNodes = doc.getPages();
  for (let p = 0; p < pageCount; p++) {
    const streams = await pageStreams(pageNodes[p]!, doc);
    let lines: TextLine[] = [];
    for (const raw of streams) {
      let data = raw;
      // Try to inflate compressed streams.
      const filter = (pageNodes[p]!.node.get(PDFName.of("Contents")) as never) ?? null;
      void filter;
      const inflated = await inflateBytes(raw);
      if (inflated) data = inflated;
      const parsed = parseContentText(data);
      if (parsed.length > 0) lines = lines.concat(parsed);
    }
    // Fall back to raw parse when inflated produced nothing.
    if (lines.length === 0) {
      for (const raw of streams) {
        lines = lines.concat(parseContentText(raw));
      }
    }
    const text = lines.map((l) => l.text).join("\n");
    pages.push(text);
  }
  const fullText = pages.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!fullText.trim()) {
    return { ok: false, error: "No extractable text found — this PDF is likely scanned images only (try OCR or the image tools)." };
  }
  return { ok: true, pages, fullText, pageCount };
}

void PDFName;
void PDFArray;
