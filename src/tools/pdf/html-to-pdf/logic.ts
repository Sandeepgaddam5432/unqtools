import { PDFDocument, PageSizes, rgb } from "pdf-lib";
import type { ToolResult } from "../../../lib/tool";

export interface HtmlToPdfOptions { pageSize: "a4" | "letter"; orientation: "portrait" | "landscape"; margin: number; }

/**
 * Convert HTML to PDF by rendering in a hidden DOM element, rasterizing via
 * html2canvas, then embedding the canvas image in a pdf-lib document.
 *
 * This function is browser-only (uses document, html2canvas).
 */
export async function htmlToPdf(html: string, opts: HtmlToPdfOptions): Promise<ToolResult<Uint8Array>> {
  if (!html.trim()) return { ok: false, error: "Enter some HTML to convert." };
  if (typeof document === "undefined") return { ok: false, error: "This tool requires a browser environment." };
  try {
    // Dynamically import html2canvas (lazy-loaded)
    const { default: html2canvas } = await import("html2canvas");

    // Create a hidden container
    const container = document.createElement("div");
    container.style.position = "absolute";
    container.style.left = "-9999px";
    container.style.top = "0";
    container.style.width = "794px"; // ~A4 width at 96dpi
    container.style.padding = "20px";
    container.style.backgroundColor = "#ffffff";
    container.style.fontFamily = "Helvetica, Arial, sans-serif";
    container.style.fontSize = "14px";
    container.style.color = "#000000";
    container.innerHTML = html;
    document.body.appendChild(container);

    try {
      const canvas = await html2canvas(container, { scale: 2, backgroundColor: "#ffffff", useCORS: true, logging: false });
      const pngBytes = new Uint8Array(await new Promise<ArrayBuffer>((res) => canvas.toBlob(async (b) => res(await b!.arrayBuffer()), "image/png")));

      const doc = await PDFDocument.create();
      const pngImage = await doc.embedPng(pngBytes);
      const base = opts.pageSize === "a4" ? PageSizes.A4 : PageSizes.Letter;
      const isLandscape = opts.orientation === "landscape";
      const pageW = isLandscape ? Math.max(base[0], base[1]) : Math.min(base[0], base[1]);
      const pageH = isLandscape ? Math.min(base[0], base[1]) : Math.max(base[0], base[1]);

      // Scale image to fit page width, split across pages if too tall
      const imgW = pageW;
      const scale = imgW / pngImage.width;
      const imgH = pngImage.height * scale;
      let remaining = imgH;
      let offset = 0;
      while (remaining > 0) {
        const page = doc.addPage([pageW, pageH]);
        const sliceH = Math.min(remaining, pageH);
        page.drawImage(pngImage, {
          x: 0, y: pageH - sliceH,
          width: imgW, height: imgH,
          clip: { x: 0, y: pageH - sliceH - (offset > 0 ? 0 : 0), width: imgW, height: sliceH } as never,
        });
        remaining -= sliceH;
        offset += sliceH;
      }

      doc.setProducer("UnQTools — HTML to PDF"); doc.setCreator("UnQTools — HTML to PDF");
      doc.setCreationDate(new Date()); doc.setModificationDate(new Date());
      return { ok: true, output: await doc.save() };
    } finally {
      document.body.removeChild(container);
    }
  } catch (e) {
    return { ok: false, error: "Could not render the HTML. It may contain unsupported features." };
  }
}
