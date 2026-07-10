import { PDFDocument, StandardFonts, PageSizes, rgb } from "pdf-lib";
import type { ToolResult } from "../../../lib/tool";

export interface TextToPdfOptions {
  fontSize: number; pageSize: "a4" | "letter"; orientation: "portrait" | "landscape";
  margin: number;
}

export async function textToPdf(text: string, opts: TextToPdfOptions): Promise<ToolResult<Uint8Array>> {
  if (!text.trim()) return { ok: false, error: "Enter some text to convert." };
  try {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const fs = Math.max(8, Math.min(opts.fontSize, 24));
    const margin = Math.max(20, opts.margin);
    const base = opts.pageSize === "a4" ? PageSizes.A4 : PageSizes.Letter;
    const isLandscape = opts.orientation === "landscape";
    const pageW = isLandscape ? Math.max(base[0], base[1]) : Math.min(base[0], base[1]);
    const pageH = isLandscape ? Math.min(base[0], base[1]) : Math.max(base[0], base[1]);
    const availW = pageW - margin * 2;
    const lineHeight = fs * 1.4;

    // Split text into lines, wrapping long lines
    const rawLines = text.split("\n");
    const wrappedLines: string[] = [];
    for (const line of rawLines) {
      if (line === "") { wrappedLines.push(""); continue; }
      const words = line.split(" ");
      let current = "";
      for (const word of words) {
        const test = current ? current + " " + word : word;
        const w = font.widthOfTextAtSize(test, fs);
        if (w > availW && current) { wrappedLines.push(current); current = word; }
        else { current = test; }
      }
      if (current) wrappedLines.push(current);
    }

    // Create pages
    let y = pageH - margin;
    let page = doc.addPage([pageW, pageH]);
    for (const line of wrappedLines) {
      if (y < margin) { page = doc.addPage([pageW, pageH]); y = pageH - margin; }
      if (line) page.drawText(line, { x: margin, y: y - fs, size: fs, font, color: rgb(0, 0, 0) });
      y -= lineHeight;
    }
    doc.setProducer("UnQTools — Text to PDF"); doc.setCreator("UnQTools — Text to PDF");
    doc.setCreationDate(new Date()); doc.setModificationDate(new Date());
    return { ok: true, output: await doc.save() };
  } catch { return { ok: false, error: "Something went wrong during conversion." }; }
}
