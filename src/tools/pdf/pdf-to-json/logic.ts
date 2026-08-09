/**
 * PDF to JSON — real engine.
 *
 * Extracts document metadata + per-page text into a structured JSON object
 * (title, author, page count, per-page text arrays, aggregate word count).
 */
import { PDFDocument, StandardFonts } from "pdf-lib";
import type { ToolResult } from "../../../lib/tool";
import { extractAllText } from "../_shared/text-extract";
import { countWords } from "../pdf-word-count/logic";

export interface PdfJson {
  metadata: {
    title: string;
    author: string;
    subject: string;
    keywords: string[];
    creator: string;
    producer: string;
    pageCount: number;
  };
  pages: { page: number; text: string; wordCount: number }[];
  totalWords: number;
  extractedAt: string;
}

export async function pdfToJson(bytes: Uint8Array): Promise<ToolResult<{ json: PdfJson; bytes: Uint8Array }>> {
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(bytes);
  } catch {
    return { ok: false, error: "Could not read the PDF — it may be corrupted or password-protected." };
  }
  const r = await extractAllText(bytes);
  if (!r.ok) return r;

  const json: PdfJson = {
    metadata: {
      title: doc.getTitle() ?? "",
      author: doc.getAuthor() ?? "",
      subject: doc.getSubject() ?? "",
      keywords: doc.getKeywords() ?? [],
      creator: doc.getCreator() ?? "",
      producer: doc.getProducer() ?? "",
      pageCount: r.pageCount,
    },
    pages: r.pages.map((text, i) => ({ page: i + 1, text, wordCount: countWords(text) })),
    totalWords: countWords(r.fullText),
    extractedAt: new Date().toISOString(),
  };
  return {
    ok: true,
    output: { json, bytes: new TextEncoder().encode(JSON.stringify(json, null, 2)) },
  };
}

void StandardFonts;
