/**
 * HTML to PDF — advanced, browser-only.
 *
 * Renders HTML in a hidden container with html2canvas at high resolution,
 * then slices the full-height canvas into real pages (A4 / Letter / A5,
 * portrait or landscape) honouring configurable margins and zoom scale.
 * Each page slice is embedded as JPEG (quality-controlled) so output stays
 * small. Optionally draws page numbers in the margin footer.
 */
import { PDFDocument, PDFFont, StandardFonts, PageSizes, rgb } from "pdf-lib";
import type { ToolResult } from "../../../lib/tool";

export type HtmlPageSize = "a4" | "letter" | "a5";
export type HtmlOrientation = "portrait" | "landscape";

export interface HtmlToPdfOptions {
  pageSize?: HtmlPageSize;
  orientation?: HtmlOrientation;
  /** Margin in mm (0–40). */
  marginMm?: number;
  /** Zoom scale 0.5–3 (higher = sharper, larger file). */
  scale?: number;
  /** JPEG quality 0.5–1 for page slices. */
  quality?: number;
  /** Draw "Page N" in the bottom margin. */
  pageNumbers?: boolean;
}

export const HTML_PAGE_SIZES: Record<HtmlPageSize, [number, number]> = {
  a4: PageSizes.A4,
  letter: PageSizes.Letter,
  a5: PageSizes.A5,
};

/** Pure helpers (unit-testable in Node). */

export function resolvePageSize(
  pageSize: HtmlPageSize,
  orientation: HtmlOrientation
): { width: number; height: number } {
  const base = HTML_PAGE_SIZES[pageSize] ?? PageSizes.A4;
  const [w, h] = base;
  if (orientation === "landscape") return { width: Math.max(w, h), height: Math.min(w, h) };
  return { width: Math.min(w, h), height: Math.max(w, h) };
}

export function mmToPt(mm: number): number {
  return (Math.max(0, Math.min(40, mm || 0)) * 72) / 25.4;
}

export interface SlicePlan {
  /** Number of pages the content will span. */
  pages: number;
  /** Page size in pt. */
  pageW: number;
  pageH: number;
  /** Margin in pt. */
  margin: number;
  /** Content area (page minus margins). */
  contentW: number;
  contentH: number;
}

export function planSlices(
  contentHeightPx: number,
  contentWidthPx: number,
  opts: HtmlToPdfOptions
): SlicePlan {
  const { width: pageW, height: pageH } = resolvePageSize(opts.pageSize ?? "a4", opts.orientation ?? "portrait");
  const margin = mmToPt(opts.marginMm ?? 15);
  const contentW = pageW - margin * 2;
  const contentH = pageH - margin * 2;
  // Scale the raster content so its width fits contentW exactly.
  const scale = contentW / contentWidthPx;
  const scaledH = contentHeightPx * scale;
  const pages = Math.max(1, Math.ceil(scaledH / contentH));
  return { pages, pageW, pageH, margin, contentW, contentH };
}

/**
 * Browser-only conversion. In Node this returns a friendly error.
 */
export async function htmlToPdf(html: string, opts: HtmlToPdfOptions = {}): Promise<ToolResult<Uint8Array>> {
  if (!html.trim()) return { ok: false, error: "Enter some HTML to convert." };
  if (typeof document === "undefined") {
    return { ok: false, error: "This tool requires a browser environment." };
  }
  const { width: pageW, height: pageH } = resolvePageSize(opts.pageSize ?? "a4", opts.orientation ?? "portrait");
  const margin = mmToPt(opts.marginMm ?? 15);
  const contentW = pageW - margin * 2;
  const contentH = pageH - margin * 2;
  const zoom = Math.max(0.5, Math.min(3, opts.scale ?? 2));

  try {
    const { default: html2canvas } = await import("html2canvas");

    // Render content in a hidden container sized to the content width.
    const container = document.createElement("div");
    container.style.position = "absolute";
    container.style.left = "-9999px";
    container.style.top = "0";
    container.style.width = `${Math.round(contentW * (96 / 72) * zoom)}px`;
    container.style.backgroundColor = "#ffffff";
    container.style.color = "#000000";
    container.style.fontFamily = "Helvetica, Arial, sans-serif";
    container.style.fontSize = `${14 * zoom}px`;
    container.style.lineHeight = "1.5";
    container.innerHTML = html;
    document.body.appendChild(container);

    let canvas: HTMLCanvasElement;
    try {
      canvas = await html2canvas(container, {
        scale: 1,
        backgroundColor: "#ffffff",
        useCORS: true,
        logging: false,
        windowWidth: Math.round(contentW * (96 / 72) * zoom),
        windowHeight: Math.max(container.scrollHeight, 600),
      });
    } finally {
      document.body.removeChild(container);
    }

    const doc = await PDFDocument.create();
    const helv = await doc.embedFont(StandardFonts.Helvetica);
    const sliceH = Math.round((contentH / contentW) * canvas.width);
    const pageCount = Math.max(1, Math.ceil(canvas.height / sliceH));

    for (let p = 0; p < pageCount; p++) {
      const page = doc.addPage([pageW, pageH]);
      const srcY = p * sliceH;
      const h = Math.min(sliceH, canvas.height - srcY);
      const sliceCanvas = document.createElement("canvas");
      sliceCanvas.width = canvas.width;
      sliceCanvas.height = h;
      const sctx = sliceCanvas.getContext("2d");
      if (!sctx) continue;
      sctx.drawImage(canvas, 0, srcY, canvas.width, h, 0, 0, canvas.width, h);
      const jpeg = sliceCanvas.toDataURL("image/jpeg", opts.quality ?? 0.85);
      const imgBytes = dataUrlToBytes(jpeg);
      const image = await doc.embedJpg(imgBytes);
      const drawW = contentW;
      const drawH = (image.height / image.width) * drawW;
      page.drawImage(image, {
        x: margin,
        y: pageH - margin - drawH,
        width: drawW,
        height: drawH,
      });
      if (opts.pageNumbers) {
        const label = `Page ${p + 1} of ${pageCount}`;
        const w = helv.widthOfTextAtSize(label, 8);
        page.drawText(label, {
          x: (pageW - w) / 2,
          y: margin / 2,
          size: 8,
          font: helv,
          color: rgb(0.45, 0.45, 0.45),
        });
      }
    }

    doc.setProducer("UnQTools — HTML to PDF");
    doc.setCreator("UnQTools — HTML to PDF");
    doc.setCreationDate(new Date());
    doc.setModificationDate(new Date());
    return { ok: true, output: await doc.save({ useObjectStreams: true }) };
  } catch {
    return {
      ok: false,
      error: "Could not render the HTML. It may contain unsupported features or external resources.",
    };
  }
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const b64 = dataUrl.split(",")[1] ?? "";
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
