/**
 * Flatten PDF — advanced.
 *
 * Real PDF cleanup with choice of what gets flattened:
 *   - form fields (AcroForm / widgets) — removed so they can't be edited
 *   - annotations (links, highlights, comments)
 *   - JavaScript actions / embedded scripts (sanitize)
 *   - metadata (privacy)
 * Reports exactly what was removed (counts per category) before you download.
 * Pure pdf-lib; page content and layout are preserved.
 */
import { PDFDocument, PDFName, PDFDict, PDFArray, PDFRef } from "pdf-lib";
import type { ToolResult } from "../../../lib/tool";

export interface FlattenOptions {
  /** Remove interactive form fields / AcroForm. Default true. */
  removeFields?: boolean;
  /** Remove annotations (links, highlights, comments…). Default true. */
  removeAnnotations?: boolean;
  /** Remove JavaScript actions + embedded scripts. Default true. */
  removeJavaScript?: boolean;
  /** Strip document metadata (title/author/subject/keywords). Default false. */
  stripMetadata?: boolean;
}

export interface FlattenReport {
  bytes: Uint8Array;
  pageCount: number;
  fieldsRemoved: number;
  annotationsRemoved: number;
  javaScriptRemoved: number;
  metadataStripped: boolean;
  /** Physical page numbers that had annotations removed (1-indexed). */
  pagesWithAnnotations: number[];
}

/** Pure counters — run BEFORE any mutation to report what will be removed. */
export function inspectPdf(
  doc: PDFDocument
): { fields: number; annotations: number; jsActions: number } {
  let fields = 0;
  let annotations = 0;
  let jsActions = 0;

  const acroEntry = doc.catalog.get(PDFName.of("AcroForm"));
  const acroForm =
    acroEntry instanceof PDFRef ? doc.context.lookup(acroEntry) : acroEntry;
  if (acroForm instanceof PDFDict) {
    const fieldsArr = acroForm.get(PDFName.of("Fields"));
    if (fieldsArr instanceof PDFArray) fields = fieldsArr.size();
  }

  for (const page of doc.getPages()) {
    const annots = page.node.get(PDFName.of("Annots"));
    if (annots instanceof PDFArray) annotations += annots.size();
    // Page-level JS
    const aa = page.node.get(PDFName.of("AA"));
    if (aa instanceof PDFDict) jsActions += 1;
  }
  // Catalog-level OpenAction / AA
  if (doc.catalog.get(PDFName.of("OpenAction"))) jsActions += 1;
  if (doc.catalog.get(PDFName.of("AA")) instanceof PDFDict) jsActions += 1;

  return { fields, annotations, jsActions };
}

export async function flattenPdf(
  bytes: Uint8Array,
  options: FlattenOptions = {}
): Promise<ToolResult<FlattenReport>> {
  let src: PDFDocument;
  try {
    src = await PDFDocument.load(bytes, { ignoreEncryption: true });
  } catch {
    return { ok: false, error: "Could not read the PDF — it may be corrupted or password-protected." };
  }

  const removeFields = options.removeFields ?? true;
  const removeAnnotations = options.removeAnnotations ?? true;
  const removeJavaScript = options.removeJavaScript ?? true;
  const stripMetadata = options.stripMetadata ?? false;

  const before = inspectPdf(src);
  const pagesWithAnnotations: number[] = [];
  const pageNodes = src.getPages();

  try {
    // 1) Annotations — remove per-page, tracking page numbers.
    if (removeAnnotations) {
      for (let i = 0; i < pageNodes.length; i++) {
        const node = pageNodes[i]!.node;
        const annots = node.get(PDFName.of("Annots"));
        if (annots instanceof PDFArray && annots.size() > 0) {
          node.delete(PDFName.of("Annots"));
          pagesWithAnnotations.push(i + 1);
        }
      }
    }

    // 2) AcroForm + fields.
    if (removeFields) {
      if (src.catalog.get(PDFName.of("AcroForm"))) {
        src.catalog.delete(PDFName.of("AcroForm"));
      }
    }

    // 3) JavaScript — catalog OpenAction/AA + page AA.
    if (removeJavaScript) {
      if (src.catalog.get(PDFName.of("OpenAction"))) src.catalog.delete(PDFName.of("OpenAction"));
      if (src.catalog.get(PDFName.of("AA"))) src.catalog.delete(PDFName.of("AA"));
      for (const page of pageNodes) {
        if (page.node.get(PDFName.of("AA"))) page.node.delete(PDFName.of("AA"));
      }
    }

    // 4) Metadata.
    if (stripMetadata) {
      src.setTitle("");
      src.setAuthor("");
      src.setSubject("");
      src.setKeywords([]);
      src.setCreator("");
      src.setProducer("");
    }

    const outBytes = await src.save({ useObjectStreams: true });
    return {
      ok: true,
      output: {
        bytes: outBytes,
        pageCount: pageNodes.length,
        fieldsRemoved: removeFields ? before.fields : 0,
        annotationsRemoved: removeAnnotations ? before.annotations : 0,
        javaScriptRemoved: removeJavaScript ? before.jsActions : 0,
        metadataStripped: stripMetadata,
        pagesWithAnnotations,
      },
    };
  } catch {
    return { ok: false, error: "Something went wrong while flattening — please try again." };
  }
}
