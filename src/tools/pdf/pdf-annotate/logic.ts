/**
 * Edit/Annotate PDF — real engine.
 *
 * Adds standard PDF annotations to pages:
 *   - Highlight (rect + color + opacity)
 *   - Text note (paperclip-style comment)
 *   - Square outline
 *   - Line (with arrowhead option)
 * Pure pdf-lib: annotations are registered in the document context and
 * appended to each page's /Annots array.
 */
import { PDFDocument, PDFName, PDFArray, PDFDict, PDFNumber, PDFString, rgb, type RGB } from "pdf-lib";
import type { ToolResult } from "../../../lib/tool";
import { parsePageRanges } from "../_shared/page-ranges";

export type AnnotType = "highlight" | "note" | "square" | "line";

export interface AnnotOptions {
  type: AnnotType;
  /** x,y,width,height of the annotation rect (pt). */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Highlight/note color (hex). Default "#ffeb3b". */
  color?: string;
  /** Opacity 0–1 for highlights. Default 0.6. */
  opacity?: number;
  /** Note/square contents (text). */
  text?: string;
  /** For line: end point (x2,y2). */
  x2?: number;
  y2?: number;
  /** Line arrowheads: true = both, "start"/"end". */
  arrow?: boolean | "start" | "end";
  /** Page range to annotate (empty = first page only). */
  pages?: string;
}

export interface AnnotResult {
  bytes: Uint8Array;
  annotationsAdded: number;
}

export function hexToRgb(hex: string): RGB {
  const clean = (hex || "#ffeb3b").replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return rgb(1, 0.92, 0.23);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

/** Register and append an annotation dict to a page. Pure-ish helper. */
export function appendAnnotation(
  page: ReturnType<PDFDocument["getPages"]>[number],
  doc: PDFDocument,
  dict: Record<string, unknown>
): void {
  const node = page.node;
  const existing = node.get(PDFName.of("Annots"));
  let annots: PDFArray;
  if (existing instanceof PDFArray) {
    annots = existing;
  } else {
    annots = PDFArray.withContext(doc.context);
    node.set(PDFName.of("Annots"), annots);
  }
  const ref = doc.context.register(doc.context.obj(dict));
  annots.push(ref);
}

/** Build an annotation dict for the given type. Pure + testable. */
export function buildAnnotationDict(
  type: AnnotType,
  opts: {
    x: number;
    y: number;
    width: number;
    height: number;
    color?: string;
    opacity?: number;
    text?: string;
    x2?: number;
    y2?: number;
    arrow?: boolean | "start" | "end";
  }
): Record<string, unknown> {
  const base = { Type: PDFName.of("Annot"), Rect: [opts.x, opts.y, opts.x + opts.width, opts.y + opts.height] };
  const color = hexToRgb(opts.color ?? "#ffeb3b");
  const cArr = [color.red, color.green, color.blue];

  switch (type) {
    case "highlight": {
      const opacity = Math.max(0, Math.min(1, opts.opacity ?? 0.6));
      return {
        ...base,
        Subtype: PDFName.of("Highlight"),
        Contents: PDFString.of(opts.text ?? ""),
        C: cArr,
        CA: opacity,
        QuadPoints: [
          opts.x, opts.y + opts.height,
          opts.x + opts.width, opts.y + opts.height,
          opts.x, opts.y,
          opts.x + opts.width, opts.y,
        ],
      };
    }
    case "note":
      return {
        ...base,
        Subtype: PDFName.of("Text"),
        Contents: PDFString.of(opts.text ?? "Note"),
        Name: PDFName.of("Comment"),
        C: cArr,
      };
    case "square":
      return {
        ...base,
        Subtype: PDFName.of("Square"),
        Contents: PDFString.of(opts.text ?? ""),
        C: cArr,
        BS: { W: 1, S: PDFName.of("S") },
      };
    case "line": {
      const x2 = opts.x2 ?? opts.x + opts.width;
      const y2 = opts.y2 ?? opts.y;
      const arrow = opts.arrow ?? false;
      const le = arrow === true || arrow === "end" ? { S: PDFName.of("OpenArrow") } : null;
      const re = arrow === true || arrow === "start" ? { S: PDFName.of("OpenArrow") } : null;
      return {
        ...base,
        Subtype: PDFName.of("Line"),
        L: [opts.x, opts.y, x2, y2],
        Contents: PDFString.of(opts.text ?? ""),
        C: cArr,
        BS: { W: 1, S: PDFName.of("S") },
        ...(le ? { LE: [re ? { S: PDFName.of("OpenArrow") } : null, le] } : {}),
      };
    }
  }
}

export async function annotatePdf(
  bytes: Uint8Array,
  options: AnnotOptions
): Promise<ToolResult<AnnotResult>> {
  if (!options.type) return { ok: false, error: "Choose an annotation type." };
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(bytes);
  } catch {
    return { ok: false, error: "Could not read the PDF — it may be corrupted or password-protected." };
  }
  const total = doc.getPageCount();
  let indices: number[];
  const spec = (options.pages ?? "").trim();
  if (spec) {
    const p = parsePageRanges(spec, total);
    if (!p.ok) return p;
    indices = [...new Set(p.output)];
  } else {
    indices = [0]; // default: first page only for a manual annotation
  }
  if (indices.length === 0) return { ok: false, error: "No pages matched." };

  try {
    const pages = doc.getPages();
    let count = 0;
    for (const i of indices) {
      const page = pages[i]!;
      const dict = buildAnnotationDict(options.type, {
        x: options.x,
        y: options.y,
        width: options.width,
        height: options.height,
        color: options.color,
        opacity: options.opacity,
        text: options.text,
        x2: options.x2,
        y2: options.y2,
        arrow: options.arrow,
      });
      appendAnnotation(page, doc, dict);
      count++;
    }
    return { ok: true, output: { bytes: await doc.save(), annotationsAdded: count } };
  } catch {
    return { ok: false, error: "Something went wrong while adding the annotation." };
  }
}

void PDFNumber;
void PDFDict;
