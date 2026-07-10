import { PDFDocument, PageSizes } from "pdf-lib";
import type { ToolResult } from "../../../lib/tool";

export interface SvgToPdfOptions { pageSize: "a4" | "letter" | "fit"; orientation: "portrait" | "landscape"; margin: number; }

/**
 * Convert SVG to PDF by rasterizing the SVG to a PNG via canvas,
 * then embedding the PNG in a pdf-lib document.
 *
 * This function is browser-only (uses document, Image, canvas).
 */
export async function svgToPdf(svg: string, opts: SvgToPdfOptions): Promise<ToolResult<Uint8Array>> {
  if (!svg.trim()) return { ok: false, error: "Enter some SVG content to convert." };
  if (!svg.includes("<svg")) return { ok: false, error: "The input doesn't appear to be valid SVG. SVG files start with '<svg'." };
  if (typeof document === "undefined") return { ok: false, error: "This tool requires a browser environment." };
  try {
    // Create an SVG blob and load it into an Image
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = () => reject(new Error("Could not load SVG")); img.src = url; });

    // Get SVG dimensions (default to 800x600 if not specified)
    const svgMatch = svg.match(/<svg[^>]*(?:width|height|viewBox)=/);
    let imgW = img.naturalWidth || 800;
    let imgH = img.naturalHeight || 600;
    // Try viewBox if naturalWidth is 0
    const vbMatch = svg.match(/viewBox=["']([^"']+)["']/);
    if (vbMatch) { const parts = vbMatch[1].split(/[\s,]+/); if (parts.length === 4) { imgW = Number(parts[2]) || imgW; imgH = Number(parts[3]) || imgH; } }
    if (imgW === 0) imgW = 800; if (imgH === 0) imgH = 600;

    // Render to canvas at 2x scale for high-DPI
    const scale = 2;
    const canvas = document.createElement("canvas");
    canvas.width = imgW * scale;
    canvas.height = imgH * scale;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);

    const pngBytes = new Uint8Array(await new Promise<ArrayBuffer>((res) => canvas.toBlob(async (b) => res(await b!.arrayBuffer()), "image/png")));

    const doc = await PDFDocument.create();
    const pngImage = await doc.embedPng(pngBytes);

    let pageW: number, pageH: number;
    if (opts.pageSize === "fit") {
      pageW = pngImage.width + opts.margin * 2;
      pageH = pngImage.height + opts.margin * 2;
    } else {
      const base = opts.pageSize === "a4" ? PageSizes.A4 : PageSizes.Letter;
      const isLandscape = opts.orientation === "landscape";
      pageW = isLandscape ? Math.max(base[0], base[1]) : Math.min(base[0], base[1]);
      pageH = isLandscape ? Math.min(base[0], base[1]) : Math.max(base[0], base[1]);
    }

    const page = doc.addPage([pageW, pageH]);
    const availW = pageW - opts.margin * 2;
    const availH = pageH - opts.margin * 2;
    const drawScale = Math.min(availW / pngImage.width, availH / pngImage.height, 1);
    const drawW = pngImage.width * drawScale;
    const drawH = pngImage.height * drawScale;
    page.drawImage(pngImage, { x: (pageW - drawW) / 2, y: (pageH - drawH) / 2, width: drawW, height: drawH });

    doc.setProducer("UnQTools — SVG to PDF"); doc.setCreator("UnQTools — SVG to PDF");
    doc.setCreationDate(new Date()); doc.setModificationDate(new Date());
    return { ok: true, output: await doc.save() };
  } catch (e) {
    return { ok: false, error: "Could not render the SVG. It may contain syntax errors or unsupported features." };
  }
}
