import { PDFDocument, PDFName } from "pdf-lib";
import type { ToolResult } from "../../../lib/tool";

export interface Bookmark { title: string; page: number; }

export async function setBookmarks(bytes: Uint8Array, bookmarks: Bookmark[]): Promise<ToolResult<Uint8Array>> {
  if (bookmarks.length === 0) return { ok: false, error: "Add at least one bookmark." };
  let doc: PDFDocument;
  try { doc = await PDFDocument.load(bytes); } catch { return { ok: false, error: "Could not read the PDF — it may be corrupted or password-protected." }; }
  const total = doc.getPageCount();
  for (const bm of bookmarks) {
    if (!bm.title.trim()) return { ok: false, error: "Every bookmark needs a title." };
    if (bm.page < 1 || bm.page > total) return { ok: false, error: `Bookmark "${bm.title}": page must be between 1 and ${total}.` };
  }
  try {
    const pages = doc.getPages();
    // Create outline node refs
    const outlineRefs = bookmarks.map((bm) => {
      const dict = doc.context.obj({ Type: "Outline", Title: bm.title, Dest: [pages[bm.page - 1].ref, "Fit"] });
      return doc.context.register(dict);
    });
    // Link siblings via Next/Prev
    for (let i = 0; i < outlineRefs.length; i++) {
      const node = doc.context.lookup(outlineRefs[i]);
      if (node && typeof node === "object" && "set" in node) {
        const dict = node as { set: (k: typeof PDFName, v: typeof outlineRefs[0]) => void };
        if (i > 0) dict.set(PDFName.of("Prev"), outlineRefs[i - 1]);
        if (i < outlineRefs.length - 1) dict.set(PDFName.of("Next"), outlineRefs[i + 1]);
      }
    }
    // Create Outlines root dict and register it
    const outlinesDict = doc.context.obj({
      Type: "Outlines",
      First: outlineRefs[0],
      Last: outlineRefs[outlineRefs.length - 1],
      Count: outlineRefs.length,
    });
    const outlinesRef = doc.context.register(outlinesDict);
    doc.catalog.set(PDFName.of("Outlines"), outlinesRef);
    return { ok: true, output: await doc.save() };
  } catch { return { ok: false, error: "Something went wrong while setting bookmarks." }; }
}

export async function readBookmarks(bytes: Uint8Array): Promise<ToolResult<{ bytes: Uint8Array; bookmarks: Bookmark[] }>> {
  let doc: PDFDocument;
  try { doc = await PDFDocument.load(bytes); } catch { return { ok: false, error: "Could not read the PDF — it may be corrupted or password-protected." }; }
  const bookmarks: Bookmark[] = [];
  try {
    const outlinesRef = doc.catalog.get(PDFName.of("Outlines"));
    if (!outlinesRef) return { ok: true, output: { bytes, bookmarks: [] } };
    const outlines = doc.context.lookup(outlinesRef);
    if (!outlines || typeof outlines !== "object") return { ok: true, output: { bytes, bookmarks: [] } };
    let current = (outlines as { get?: (k: typeof PDFName) => unknown }).get?.(PDFName.of("First"));
    const pages = doc.getPages();
    let safety = 0;
    while (current && safety < 1000) {
      safety++;
      const node = doc.context.lookup(current as never);
      if (!node || typeof node !== "object") break;
      const dict = node as { get?: (k: typeof PDFName) => unknown; toString?: () => string };
      const titleVal = dict.get?.(PDFName.of("Title"));
      const title = titleVal?.toString() ?? "Untitled";
      const dest = dict.get?.(PDFName.of("Dest"));
      let pageNum = 1;
      if (Array.isArray(dest) && dest.length > 0) {
        const pageRef = dest[0];
        const idx = pages.findIndex((p) => p.ref === pageRef);
        if (idx >= 0) pageNum = idx + 1;
      }
      bookmarks.push({ title, page: pageNum });
      current = dict.get?.(PDFName.of("Next"));
    }
    return { ok: true, output: { bytes, bookmarks } };
  } catch { return { ok: true, output: { bytes, bookmarks: [] } }; }
}
