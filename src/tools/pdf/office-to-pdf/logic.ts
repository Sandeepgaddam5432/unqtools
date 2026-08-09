/**
 * Office to PDF — real engine.
 *
 * Converts Word (.docx), Excel (.xlsx), PowerPoint (.pptx) and plain text
 * (.txt/.rtf) files into a PDF entirely in the browser:
 *   - DOCX: unzip → word/document.xml → paragraphs (bold/italic preserved as
 *     markdown-ish markers) → rendered through the Markdown engine.
 *   - XLSX: unzip → shared strings + worksheet rows → rendered as a table.
 *   - PPTX: unzip → slide XML text → rendered with slide separators.
 *   - TXT/RTF: direct text (RTF parsed by the RTF tool's extractor).
 * Pure XML→text helpers are unit-tested in Node.
 */
import type { ToolResult } from "../../../lib/tool";

export interface OfficeToPdfOptions {
  pageSize?: "a4" | "letter";
  orientation?: "portrait" | "landscape";
  margin?: number;
  bodySize?: number;
}

export interface OfficeToPdfResult {
  bytes: Uint8Array;
  kind: "docx" | "xlsx" | "pptx" | "text";
  extractedChars: number;
}

export function officeKindFromName(name: string): "docx" | "xlsx" | "pptx" | "text" | null {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "docx") return "docx";
  if (ext === "xlsx") return "xlsx";
  if (ext === "pptx") return "pptx";
  if (["txt", "text", "md", "markdown", "rtf", "csv"].includes(ext)) return "text";
  return null;
}

/* ------------------------------------------------------------------ */
/* Pure XML extraction helpers (Node-testable)                         */
/* ------------------------------------------------------------------ */

/** DOCX: extract paragraphs with **bold** / *italic* markers. */
export function extractDocxText(documentXml: string): string {
  const paragraphs = documentXml.match(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/gi) ?? [];
  const out: string[] = [];
  for (const p of paragraphs) {
    const runs = p.match(/<w:r\b[^>]*>[\s\S]*?<\/w:r>/gi) ?? [];
    let line = "";
    for (const run of runs) {
      const text = (run.match(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/i)?.[1] ?? "")
        .replace(/<[^>]+>/g, "")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'");
      const bold = /<w:b\b/.test(run);
      const italic = /<w:i\b/.test(run);
      const wrap = bold ? "**" : italic ? "*" : "";
      line += text ? `${wrap}${text}${wrap}` : "";
    }
    if (line.trim()) out.push(line);
  }
  return out.join("\n");
}

/** XLSX: extract rows from a worksheet XML using shared strings. */
export function extractXlsxText(
  sheetXml: string,
  sharedStrings: string[]
): string {
  const rows = sheetXml.match(/<row\b[^>]*>[\s\S]*?<\/row>/gi) ?? [];
  const out: string[] = [];
  for (const row of rows) {
    const cells = row.match(/<c\b[^>]*>[\s\S]*?<\/c>/gi) ?? [];
    const values: string[] = [];
    for (const cell of cells) {
      const t = cell.match(/<v>([\s\S]*?)<\/v>/i)?.[1] ?? "";
      const type = cell.match(/\bt="([^"]+)"/i)?.[1];
      if (type === "s" || type === "inlineStr") {
        const idx = Number(t);
        values.push(sharedStrings[idx] ?? t);
      } else if (type === "str") {
        values.push(t);
      } else if (t !== "") {
        values.push(t);
      } else {
        values.push("");
      }
    }
    out.push(values.join(" | "));
  }
  return out.join("\n");
}

/** PPTX: extract text blocks from a slide XML. */
export function extractPptxText(slideXml: string): string {
  const shapes = slideXml.match(/<a:t>([\s\S]*?)<\/a:t>/gi) ?? [];
  return shapes
    .map((s) => s.replace(/<\/?a:t>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">"))
    .join("\n")
    .trim();
}

/** CSV: naive but correct-enough parser to a markdown-ish table. */
export function extractCsvText(csv: string): string {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim());
  const parseLine = (line: string): string[] => {
    const cells: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]!;
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === "," && !inQuotes) {
        cells.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
    cells.push(cur);
    return cells;
  };
  return lines.map((l) => parseLine(l).join(" | ")).join("\n");
}

/* ------------------------------------------------------------------ */
/* Full conversion                                                     */
/* ------------------------------------------------------------------ */

export async function officeToPdf(
  fileName: string,
  fileBytes: Uint8Array,
  options: OfficeToPdfOptions = {}
): Promise<ToolResult<OfficeToPdfResult>> {
  const kind = officeKindFromName(fileName);
  if (!kind) {
    return { ok: false, error: "Unsupported file type. Use .docx, .xlsx, .pptx, .txt, .rtf or .csv." };
  }
  try {
    const { textToPdf } = await import("../text-to-pdf/logic");
    const { rtfToPdf } = await import("../rtf-to-pdf/logic");

    let markdown: string;
    let extractedChars = 0;

    if (kind === "text") {
      const text = new TextDecoder("utf-8", { fatal: false }).decode(fileBytes);
      if (fileName.toLowerCase().endsWith(".rtf")) {
        const r = await rtfToPdf(text, { pageSize: options.pageSize, orientation: options.orientation, margin: options.margin });
        if (!r.ok) return r;
        extractedChars = text.length;
        return {
          ok: true,
          output: { bytes: r.output, kind, extractedChars },
        };
      }
      markdown = fileName.toLowerCase().endsWith(".csv") ? extractCsvText(text) : text;
      extractedChars = text.length;
    } else {
      const { default: JSZip } = await import("jszip");
      const zip = await JSZip.loadAsync(fileBytes);

      if (kind === "docx") {
        const entry = zip.file("word/document.xml");
        if (!entry) return { ok: false, error: "This .docx has no document.xml — it may be corrupted." };
        const xml = await entry.async("string");
        markdown = extractDocxText(xml);
        extractedChars = markdown.length;
      } else if (kind === "xlsx") {
        const sstEntry = zip.file("xl/sharedStrings.xml");
        const sstXml = sstEntry ? await sstEntry.async("string") : "";
        const shared = [...sstXml.matchAll(/<si>[\s\S]*?<\/si>/g)].map((m) =>
          (m[0]!.match(/<t[^>]*>([\s\S]*?)<\/t>/g) ?? [])
            .map((t) => t.replace(/<\/?t[^>]*>/g, ""))
            .join("")
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
        );
        const sheetPaths = Object.keys(zip.files).filter((p) => /^xl\/worksheets\/sheet\d+\.xml$/.test(p)).sort();
        if (sheetPaths.length === 0) return { ok: false, error: "This .xlsx has no worksheets." };
        const parts: string[] = [];
        for (const p of sheetPaths) {
          const xml = await zip.file(p)!.async("string");
          parts.push(extractXlsxText(xml, shared));
        }
        markdown = parts.join("\n\n");
        extractedChars = markdown.length;
      } else {
        // pptx
        const slidePaths = Object.keys(zip.files).filter((p) => /^ppt\/slides\/slide\d+\.xml$/.test(p)).sort((a, b) => {
          const na = Number(a.match(/(\d+)/)?.[1] ?? 0);
          const nb = Number(b.match(/(\d+)/)?.[1] ?? 0);
          return na - nb;
        });
        if (slidePaths.length === 0) return { ok: false, error: "This .pptx has no slides." };
        const parts: string[] = [];
        for (let i = 0; i < slidePaths.length; i++) {
          const xml = await zip.file(slidePaths[i]!)!.async("string");
          const text = extractPptxText(xml);
          parts.push(text ? `## Slide ${i + 1}\n\n${text}` : `## Slide ${i + 1}\n\n_(no text)_`);
        }
        markdown = parts.join("\n\n---\n\n");
        extractedChars = markdown.length;
      }
    }

    if (extractedChars === 0) {
      return { ok: false, error: "No text content was found in this file." };
    }

    const { markdownToPdf } = await import("../markdown-to-pdf/logic");
    const rendered = await markdownToPdf(markdown, {
      pageSize: options.pageSize,
      orientation: options.orientation,
      margin: options.margin,
      bodySize: options.bodySize,
      pageNumbers: true,
    });
    if (!rendered.ok) return rendered;

    return { ok: true, output: { bytes: rendered.output, kind, extractedChars } };
  } catch {
    return { ok: false, error: "Could not read this Office file — it may be corrupted or password-protected." };
  }
}
