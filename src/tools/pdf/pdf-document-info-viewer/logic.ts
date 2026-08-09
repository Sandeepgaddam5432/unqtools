/**
 * PDF Document Info Viewer — real engine.
 *
 * Reads all standard document metadata (title/author/subject/keywords/
 * creator/producer), page count and page sizes, and returns them as a
 * structured object + JSON export. Pure pdf-lib.
 */
import { PDFDocument } from "pdf-lib";
import type { ToolResult } from "../../../lib/tool";

export interface PageInfo {
  page: number;
  width: number;
  height: number;
  rotation: number;
}

export interface DocInfo {
  title: string;
  author: string;
  subject: string;
  keywords: string[];
  creator: string;
  producer: string;
  pageCount: number;
  encrypted: boolean;
  pages: PageInfo[];
}

export interface InfoResult {
  info: DocInfo;
  json: string;
  bytes: Uint8Array;
}

export async function viewDocumentInfo(bytes: Uint8Array): Promise<ToolResult<InfoResult>> {
  let doc: PDFDocument;
  let encrypted = false;
  try {
    doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  } catch {
    return { ok: false, error: "Could not read the PDF — it may be corrupted." };
  }
  // Detect encryption by trying a strict load first.
  try {
    await PDFDocument.load(bytes, { ignoreEncryption: false });
  } catch {
    encrypted = true;
  }

  const pages: PageInfo[] = doc.getPages().map((p, i) => {
    const { width, height } = p.getSize();
    return { page: i + 1, width: Math.round(width * 100) / 100, height: Math.round(height * 100) / 100, rotation: p.getRotation().angle };
  });

  const info: DocInfo = {
    title: doc.getTitle() ?? "",
    author: doc.getAuthor() ?? "",
    subject: doc.getSubject() ?? "",
    keywords: doc.getKeywords() ?? [],
    creator: doc.getCreator() ?? "",
    producer: doc.getProducer() ?? "",
    pageCount: pages.length,
    encrypted,
    pages,
  };

  const json = JSON.stringify(info, null, 2);
  return { ok: true, output: { info, json, bytes: new TextEncoder().encode(json) } };
}
