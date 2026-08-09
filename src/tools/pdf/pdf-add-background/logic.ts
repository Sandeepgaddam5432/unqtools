/**
 * Add Background to PDF — real engine.
 *
 * Three background modes on any page range:
 *   1. Solid color fill (with opacity)
 *   2. Image watermark (PNG/JPEG) — fitted, tiled or stretched, with opacity
 *   3. Page-from-another-PDF underlay
 * Pure pdf-lib; backgrounds are drawn with an ExtGState so opacity works, and
 * content is prepended so existing page content stays on top.
 */
import { PDFDocument, PDFName, PDFRawStream, PDFArray, PDFRef, PDFDict } from "pdf-lib";
import type { ToolResult } from "../../../lib/tool";
import { parsePageRanges } from "../_shared/page-ranges";

export type BgMode = "color" | "image" | "page";
export type ImageFit = "fit" | "tile" | "stretch";

export interface BackgroundOptions {
  mode: BgMode;
  /** Hex color like "#ffeeaa" (color mode). */
  color?: string;
  /** 0–1 fill opacity. Default 1. */
  opacity?: number;
  /** Image bytes (PNG/JPEG) for image mode. */
  imageBytes?: Uint8Array;
  /** How the image is placed. Default "fit". */
  imageFit?: ImageFit;
  /** Underlay PDF bytes for page mode. */
  underlayBytes?: Uint8Array;
  /** Underlay page (1-indexed) to draw. Default 1. */
  underlayPage?: number;
  /** Page range to apply to (empty = all). */
  pages?: string;
}

export interface BackgroundResult {
  bytes: Uint8Array;
  pagesModified: number;
}

export interface RgbParts { r: number; g: number; b: number }

export function hexToRgb(hex: string): RgbParts {
  const clean = (hex || "#ffffff").replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return { r: 1, g: 1, b: 1 };
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
}

/** Pure: build the PDF operators for a solid background fill. */
export function colorBackgroundOperators(w: number, h: number, hex: string): string {
  const c = hexToRgb(hex);
  return `q /GS_bg gs ${c.r.toFixed(4)} ${c.g.toFixed(4)} ${c.b.toFixed(4)} rg 0 0 ${w} ${h} re f Q\n`;
}

/**
 * Prepend a raw content stream to a page (drawn FIRST = behind existing
 * content). Exposed for tests.
 */
export function prependContentStream(
  page: ReturnType<PDFDocument["getPages"]>[number],
  doc: PDFDocument,
  operators: string
): void {
  const node = page.node;
  const existing = node.get(PDFName.of("Contents"));
  const stream = PDFRawStream.of(doc.context, new Uint8Array(new TextEncoder().encode(operators)));
  // Some pdf-lib versions leave stream.dict as a non-dict object — ensure a
  // real PDFDict so save() can serialize it.
  stream.dict = PDFDict.withContext(doc.context);
  const streamRef = doc.context.register(stream);
  let contents: PDFArray;
  if (existing instanceof PDFArray) {
    contents = existing;
  } else {
    contents = PDFArray.withContext(doc.context);
    if (existing instanceof PDFRef) contents.push(existing);
    node.set(PDFName.of("Contents"), contents);
  }
  contents.insert(0, streamRef);
}

export async function addBackground(
  bytes: Uint8Array,
  options: BackgroundOptions
): Promise<ToolResult<BackgroundResult>> {
  if (!options.mode) return { ok: false, error: "Choose a background mode." };
  let src: PDFDocument;
  try {
    src = await PDFDocument.load(bytes);
  } catch {
    return { ok: false, error: "Could not read the PDF — it may be corrupted or password-protected." };
  }
  const total = src.getPageCount();
  let indices: number[];
  const spec = (options.pages ?? "").trim();
  if (spec) {
    const p = parsePageRanges(spec, total);
    if (!p.ok) return p;
    indices = [...new Set(p.output)];
  } else {
    indices = Array.from({ length: total }, (_, i) => i);
  }
  if (indices.length === 0) return { ok: false, error: "No pages matched." };

  const opacity = Math.max(0, Math.min(1, options.opacity ?? 1));

  // Register an ExtGState for opacity once.
  const gsRef = src.context.register(src.context.obj({ CA: opacity, ca: opacity }));
  src.catalog.set(PDFName.of("ExtGState"), gsRef);

  // Prepare image.
  let bgImage: Awaited<ReturnType<PDFDocument["embedPng"]>> | null = null;
  if (options.mode === "image") {
    if (!options.imageBytes) return { ok: false, error: "Choose a background image (PNG or JPEG)." };
    try {
      bgImage = await src.embedPng(options.imageBytes);
    } catch {
      try {
        bgImage = await src.embedJpg(options.imageBytes);
      } catch {
        return { ok: false, error: "Could not embed the image — use PNG or JPEG." };
      }
    }
  }

  // Prepare underlay PDF.
  let underlayDoc: PDFDocument | null = null;
  let underlayPageIdx = 0;
  if (options.mode === "page") {
    if (!options.underlayBytes) return { ok: false, error: "Choose the PDF to use as a background." };
    try {
      underlayDoc = await PDFDocument.load(options.underlayBytes);
    } catch {
      return { ok: false, error: "Could not read the background PDF." };
    }
    const up = Math.max(1, Math.floor(options.underlayPage ?? 1));
    if (up > underlayDoc.getPageCount()) {
      return { ok: false, error: `Background PDF has ${underlayDoc.getPageCount()} pages — page ${up} doesn't exist.` };
    }
    underlayPageIdx = up - 1;
  }

  try {
    const pages = src.getPages();
    let modified = 0;

    for (const i of indices) {
      const page = pages[i]!;
      const { width, height } = page.getSize();

      if (options.mode === "color") {
        prependContentStream(page, src, colorBackgroundOperators(width, height, options.color ?? "#ffffff"));
        modified++;
      } else if (options.mode === "image" && bgImage) {
        const fit = options.imageFit ?? "fit";
        const margin = 12;
        if (fit === "tile") {
          // Tile at a sensible cell size (at least 40pt) so tiny images
          // don't explode into tens of thousands of draws.
          const cellW = Math.max(40, Math.min(bgImage.width, width));
          const cellH = (bgImage.height / bgImage.width) * cellW;
          const cols = Math.ceil(width / cellW);
          const rows = Math.ceil(height / cellH);
          for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
              page.drawImage(bgImage, {
                x: c * cellW,
                y: height - (r + 1) * cellH,
                width: cellW,
                height: cellH,
                opacity,
              });
            }
          }
          modified++;
          continue;
        }
        let dw = width - margin * 2;
        let dh = (bgImage.height / bgImage.width) * dw;
        let dx = margin;
        let dy = (height - dh) / 2;
        if (fit === "stretch") {
          dw = width;
          dh = height;
          dx = 0;
          dy = 0;
        }
        page.drawImage(bgImage, { x: dx, y: dy, width: dw, height: dh, opacity });
        modified++;
      } else if (options.mode === "page" && underlayDoc) {
        const srcPage = underlayDoc.getPages()[underlayPageIdx]!;
        const embedded = await src.embedPage(srcPage);
        const scale = Math.min(width / embedded.width, height / embedded.height);
        const dw = embedded.width * scale;
        const dh = embedded.height * scale;
        page.drawPage(embedded, {
          x: (width - dw) / 2,
          y: (height - dh) / 2,
          width: dw,
          height: dh,
          opacity,
        });
        modified++;
      }
    }

    return { ok: true, output: { bytes: await src.save(), pagesModified: modified } };
  } catch {
    return { ok: false, error: "Something went wrong while adding the background." };
  }
}
