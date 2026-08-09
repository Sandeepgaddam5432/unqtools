/**
 * PDF to HTML — real engine.
 *
 * Extracts per-page text and embedded images, then builds a single
 * self-contained HTML document (images inlined as data URLs). The HTML is
 * clean, readable and printable. Pure helpers are unit-tested in Node.
 */
import type { ToolResult } from "../../../lib/tool";
import { extractAllText } from "../_shared/text-extract";
import { extractImages, type ExtractedImage } from "../pdf-extract-images/logic";

export interface HtmlResult {
  html: string;
  bytes: Uint8Array;
  pageCount: number;
}

/** Escape text for safe HTML embedding. Pure + testable. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Wrap extracted lines into <p> paragraphs. Pure + testable. */
export function textToParagraphs(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((block) => block.split("\n").map((l) => escapeHtml(l)).join("<br>"))
    .filter(Boolean)
    .map((p) => `<p>${p}</p>`)
    .join("\n");
}

/** Build the full HTML document. Pure + testable. */
export function buildHtml(title: string, pageTexts: string[], images: ExtractedImage[]): string {
  const head = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
  body { font-family: Georgia, serif; max-width: 760px; margin: 2rem auto; padding: 0 1rem; color: #222; }
  h1 { border-bottom: 2px solid #ddd; padding-bottom: .4rem; }
  img { max-width: 100%; height: auto; margin: .75rem 0; }
  p { line-height: 1.55; }
  .page-break { border-top: 1px dashed #ccc; margin: 2rem 0; }
</style>
</head>
<body>
<h1>${escapeHtml(title)}</h1>
`;
  let body = "";
  if (images.length > 0) {
    for (const img of images) {
      const mime = img.format === "jpg" ? "image/jpeg" : img.format === "png" ? "image/png" : "application/octet-stream";
      const b64 = Buffer.from(img.bytes).toString("base64");
      body += `<img src="data:${mime};base64,${b64}" alt="${escapeHtml(img.name)}">\n`;
    }
    body += `<div class="page-break"></div>\n`;
  }
  for (const t of pageTexts) {
    if (!t.trim()) continue;
    body += textToParagraphs(t) + "\n";
    body += `<div class="page-break"></div>\n`;
  }
  return head + body + "</body>\n</html>\n";
}

export async function pdfToHtml(bytes: Uint8Array): Promise<ToolResult<HtmlResult>> {
  const textRes = await extractAllText(bytes);
  if (!textRes.ok) return textRes;

  const imgRes = await extractImages(bytes);
  const images = imgRes.ok ? imgRes.output.images : [];

  let title = "Converted PDF";
  try {
    const { PDFDocument } = await import("pdf-lib");
    const doc = await PDFDocument.load(bytes);
    title = doc.getTitle() ?? "Converted PDF";
  } catch {
    /* keep default */
  }

  const html = buildHtml(title, textRes.pages, images);
  return {
    ok: true,
    output: { html, bytes: new TextEncoder().encode(html), pageCount: textRes.pageCount },
  };
}
