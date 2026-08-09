/**
 * SVG to PDF — advanced.
 *
 * Rasterizes SVG in the browser (Image → canvas), then embeds it as a PNG
 * with configurable fit mode (contain / cover / fill / fit-to-content),
 * background (white or transparent), render DPI (1–4×), page size and
 * orientation. Pure sizing helpers are exported for tests.
 */
import { PDFDocument, PageSizes } from "pdf-lib";
import type { ToolResult } from "../../../lib/tool";

export interface SvgToPdfOptions {
  pageSize?: "a4" | "letter" | "fit";
  orientation?: "portrait" | "landscape";
  margin?: number;
  /** How the SVG fits the page. Default "contain". */
  fit?: "contain" | "cover" | "fill" | "actual";
  /** White background or transparent. Default true (white). */
  whiteBackground?: boolean;
  /** Render resolution multiplier (1–4). Default 2. */
  dpi?: number;
}

/** Pure: compute the draw rect for a given fit mode. */
export function computeDraw(
  fit: "contain" | "cover" | "fill" | "actual",
  imgW: number,
  imgH: number,
  pageW: number,
  pageH: number,
  margin: number
): { x: number; y: number; w: number; h: number } {
  const availW = Math.max(1, pageW - margin * 2);
  const availH = Math.max(1, pageH - margin * 2);
  if (fit === "actual") {
    return {
      x: margin + (availW - imgW) / 2,
      y: margin + (availH - imgH) / 2,
      w: imgW,
      h: imgH,
    };
  }
  const scaleW = availW / imgW;
  const scaleH = availH / imgH;
  const scale =
    fit === "fill" ? Math.max(scaleW, scaleH) : fit === "cover" ? Math.max(scaleW, scaleH) : Math.min(scaleW, scaleH);
  const w = imgW * scale;
  const h = imgH * scale;
  return {
    x: margin + (availW - w) / 2,
    y: margin + (availH - h) / 2,
    w,
    h,
  };
}

/** Parse an SVG's intrinsic size (width/height attrs or viewBox). Pure. */
export function parseSvgSize(
  svg: string,
  fallbackW = 800,
  fallbackH = 600
): { width: number; height: number } {
  const attr = (name: string): number | null => {
    const m = svg.match(new RegExp(`${name}\\s*=\\s*["']([\\d.]+)`, "i"));
    return m ? Number(m[1]) : null;
  };
  const w = attr("width");
  const h = attr("height");
  if (w && h) return { width: w, height: h };
  const vb = svg.match(/viewBox\s*=\s*["']([\d.\s,-]+)["']/i);
  if (vb) {
    const parts = vb[1]!.split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts[2]! > 0 && parts[3]! > 0) {
      return { width: parts[2]!, height: parts[3]! };
    }
  }
  return { width: fallbackW, height: fallbackH };
}

export async function svgToPdf(svg: string, opts: SvgToPdfOptions = {}): Promise<ToolResult<Uint8Array>> {
  if (!svg.trim()) return { ok: false, error: "Enter some SVG content to convert." };
  if (!svg.includes("<svg")) {
    return { ok: false, error: "The input doesn't appear to be valid SVG. SVG files start with '<svg'." };
  }
  if (typeof document === "undefined") return { ok: false, error: "This tool requires a browser environment." };
  try {
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Could not load SVG"));
      img.src = url;
    });

    const size = parseSvgSize(svg, img.naturalWidth || 800, img.naturalHeight || 600);
    const imgW = size.width;
    const imgH = size.height;

    const dpi = Math.max(1, Math.min(4, Math.floor(opts.dpi ?? 2)));
    const canvas = document.createElement("canvas");
    canvas.width = imgW * dpi;
    canvas.height = imgH * dpi;
    const ctx = canvas.getContext("2d")!;
    if (opts.whiteBackground !== false) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);

    const pngBytes = new Uint8Array(
      await new Promise<ArrayBuffer>((res) => canvas.toBlob(async (b) => res(await b!.arrayBuffer()), "image/png"))
    );

    const doc = await PDFDocument.create();
    const pngImage = await doc.embedPng(pngBytes);
    const margin = Math.max(0, Number(opts.margin) || 24);
    const fit = opts.fit ?? "contain";

    let pageW: number;
    let pageH: number;
    if (opts.pageSize === "fit") {
      pageW = pngImage.width + margin * 2;
      pageH = pngImage.height + margin * 2;
    } else {
      const base = opts.pageSize === "letter" ? PageSizes.Letter : PageSizes.A4;
      const isLandscape = opts.orientation === "landscape";
      pageW = isLandscape ? Math.max(base[0], base[1]) : Math.min(base[0], base[1]);
      pageH = isLandscape ? Math.min(base[0], base[1]) : Math.max(base[0], base[1]);
    }

    const page = doc.addPage([pageW, pageH]);
    const draw = computeDraw(fit, pngImage.width, pngImage.height, pageW, pageH, margin);
    page.drawImage(pngImage, { x: draw.x, y: draw.y, width: draw.w, height: draw.h });

    doc.setProducer("UnQTools — SVG to PDF");
    doc.setCreator("UnQTools — SVG to PDF");
    doc.setCreationDate(new Date());
    doc.setModificationDate(new Date());
    return { ok: true, output: await doc.save() };
  } catch {
    return { ok: false, error: "Could not render the SVG — it may contain unsupported features." };
  }
}
