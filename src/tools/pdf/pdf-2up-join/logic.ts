/**
 * Combine Pages Side-by-Side (2-up) — real engine.
 *
 * Pairs consecutive pages (1+2, 3+4, …) onto one sheet side by side, like a
 * reader spread. Options: sheet size (A4/Letter/custom), orientation,
 * margin, gutter, optional last-page duplicate ("blank" page when odd), and
 * an optional thin divider line. Pure pdf-lib, text stays selectable.
 */
import { PDFDocument, PageSizes, rgb } from "pdf-lib";
import type { ToolResult } from "../../../lib/tool";

export interface TwoUpOptions {
  /** Output sheet size. Default "a4". */
  sheet?: "a4" | "letter" | "custom";
  customWidth?: number;
  customHeight?: number;
  orientation?: "portrait" | "landscape";
  /** Margin in pt. Default 10. */
  margin?: number;
  /** Gutter between the two pages in pt. Default 8. */
  gutter?: number;
  /** When the page count is odd, repeat the last page to fill the second slot. */
  duplicateLast?: boolean;
  /** Draw a thin divider line in the gutter. Default false. */
  divider?: boolean;
}

export interface TwoUpResult {
  bytes: Uint8Array;
  outputSheets: number;
  sourcePages: number;
}

/** Pure: pair indices (0,1), (2,3), … respecting duplicateLast. */
export function buildPairs(pageCount: number, duplicateLast: boolean): [number, number][] {
  const pairs: [number, number][] = [];
  for (let i = 0; i < pageCount; i += 2) {
    const a = i;
    let b = i + 1;
    if (b >= pageCount) {
      if (!duplicateLast) break;
      b = a; // repeat last page
    }
    pairs.push([a, b]);
  }
  return pairs;
}

export async function twoUpJoin(
  bytes: Uint8Array,
  options: TwoUpOptions = {}
): Promise<ToolResult<TwoUpResult>> {
  let src: PDFDocument;
  try {
    src = await PDFDocument.load(bytes);
  } catch {
    return { ok: false, error: "Could not read the PDF — it may be corrupted or password-protected." };
  }
  const total = src.getPageCount();
  if (total === 0) return { ok: false, error: "The PDF has no pages." };

  let sheetW: number;
  let sheetH: number;
  if (options.sheet === "custom") {
    const cw = Number(options.customWidth);
    const ch = Number(options.customHeight);
    if (!Number.isFinite(cw) || cw < 1 || !Number.isFinite(ch) || ch < 1) {
      return { ok: false, error: "Enter valid custom sheet width and height (pt)." };
    }
    sheetW = Math.floor(cw);
    sheetH = Math.floor(ch);
  } else {
    const base = options.sheet === "letter" ? PageSizes.Letter : PageSizes.A4;
    // Two pages side-by-side read naturally on a landscape sheet.
    const isLandscape = options.orientation !== "portrait";
    sheetW = isLandscape ? Math.max(base[0], base[1]) : Math.min(base[0], base[1]);
    sheetH = isLandscape ? Math.min(base[0], base[1]) : Math.max(base[0], base[1]);
  }

  const margin = Math.max(0, Number(options.margin) || 10);
  const gutter = Math.max(0, Number(options.gutter) || 8);
  const duplicateLast = options.duplicateLast ?? false;

  const pairs = buildPairs(total, duplicateLast);
  const srcPages = src.getPages();
  const cellW = (sheetW - margin * 2 - gutter) / 2;
  const cellH = sheetH - margin * 2;

  try {
    const out = await PDFDocument.create();
    for (const [a, b] of pairs) {
      const page = out.addPage([sheetW, sheetH]);
      const draw = async (idx: number, slot: 0 | 1) => {
        const sp = srcPages[idx]!;
        const { width: pw, height: ph } = sp.getSize();
        const scale = Math.min((cellW - 2) / pw, cellH / ph);
        const dw = pw * scale;
        const dh = ph * scale;
        const x = margin + slot * (cellW + gutter) + (cellW - dw) / 2;
        const y = margin + (cellH - dh) / 2;
        const embedded = await out.embedPage(sp);
        page.drawPage(embedded, { x, y, width: dw, height: dh });
      };
      await draw(a, 0);
      await draw(b, 1);
      if (options.divider) {
        const dy = margin + cellH / 2;
        page.drawLine({
          start: { x: margin + cellW + gutter / 2, y: margin + 4 },
          end: { x: margin + cellW + gutter / 2, y: sheetH - margin - 4 },
          thickness: 0.5,
          color: rgb(0.8, 0.8, 0.8),
        });
        void dy;
      }
    }

    out.setProducer("UnQTools — 2-up Join");
    out.setCreator("UnQTools — 2-up Join");
    out.setCreationDate(new Date());
    out.setModificationDate(new Date());
    return { ok: true, output: { bytes: await out.save(), outputSheets: pairs.length, sourcePages: total } };
  } catch {
    return { ok: false, error: "Something went wrong during the 2-up layout." };
  }
}
