import { PDFDocument } from "pdf-lib";
import type { ToolResult } from "../../../lib/tool";

export interface PdfMetadata {
  title: string;
  author: string;
  subject: string;
  keywords: string;
  creator: string;
  producer: string;
  creationDate?: string;
  modificationDate?: string;
}

export type ReadResult = { bytes: Uint8Array; metadata: PdfMetadata };

export async function readPdfMetadata(bytes: Uint8Array): Promise<ToolResult<ReadResult>> {
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(bytes);
  } catch {
    return { ok: false, error: "Could not read the PDF — it may be corrupted or password-protected." };
  }
  const metadata: PdfMetadata = {
    title: doc.getTitle() ?? "",
    author: doc.getAuthor() ?? "",
    subject: doc.getSubject() ?? "",
    keywords: doc.getKeywords() ?? "",
    creator: doc.getCreator() ?? "",
    producer: doc.getProducer() ?? "",
    creationDate: doc.getCreationDate()?.toISOString(),
    modificationDate: doc.getModificationDate()?.toISOString(),
  };
  return { ok: true, output: { bytes, metadata } };
}

export async function writePdfMetadata(
  bytes: Uint8Array,
  metadata: Omit<PdfMetadata, "creationDate" | "modificationDate">
): Promise<ToolResult<Uint8Array>> {
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(bytes);
  } catch {
    return { ok: false, error: "Could not read the PDF — it may be corrupted or password-protected." };
  }
  doc.setTitle(metadata.title);
  doc.setAuthor(metadata.author);
  doc.setSubject(metadata.subject);
  // pdf-lib's setKeywords expects a string[] (one keyword per element).
  // Users type a comma-separated list like "kw1, kw2" — split it.
  const keywords = metadata.keywords
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
  doc.setKeywords(keywords);
  doc.setCreator(metadata.creator);
  doc.setProducer(metadata.producer);
  return { ok: true, output: await doc.save() };
}
