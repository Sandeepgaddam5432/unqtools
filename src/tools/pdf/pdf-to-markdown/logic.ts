/**
 * PDF to Markdown — real engine.
 *
 * Extracts text with line-level font sizes (from the content stream Tf
 * operators) and reconstructs Markdown: lines with a notably larger font
 * become headings (## / ###), paragraphs separated by blank lines, bullet
 * markers preserved when the source already had them. Output is selectable
 * Markdown text.
 */
import type { ToolResult } from "../../../lib/tool";
import { extractAllText, parseContentText, inflateBytes, type TextLine } from "../_shared/text-extract";
import { PDFDocument } from "pdf-lib";

export interface MdResult {
  markdown: string;
  bytes: Uint8Array;
  pageCount: number;
}

/** Pure: convert extracted lines (with font sizes) into Markdown. */
export function linesToMarkdown(lines: TextLine[], bodySize = 12): string {
  // Heuristic: find the most common font size → body.
  const sizes = lines.map((l) => l.fontSize).filter((s) => s > 0);
  const counts = new Map<number, number>();
  for (const s of sizes) counts.set(s, (counts.get(s) ?? 0) + 1);
  let body = bodySize;
  let best = 0;
  for (const [s, c] of counts) {
    if (c > best) {
      best = c;
      body = s;
    }
  }
  const out: string[] = [];
  let para: string[] = [];
  const flushPara = () => {
    if (para.length > 0) {
      out.push(para.join(" "));
      para = [];
    }
  };
  for (const l of lines) {
    const fs = l.fontSize > 0 ? l.fontSize : body;
    if (fs >= body * 1.35) {
      flushPara();
      const level = fs >= body * 1.8 ? "##" : "###";
      out.push(`${level} ${l.text}`);
    } else if (l.text.startsWith("- ") || l.text.startsWith("* ")) {
      flushPara();
      out.push(l.text);
    } else {
      para.push(l.text);
    }
  }
  flushPara();
  return out.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
}

export async function pdfToMarkdown(bytes: Uint8Array): Promise<ToolResult<MdResult>> {
  const r = await extractAllText(bytes);
  if (!r.ok) return r;

  // Get font-size-aware lines per page for heading detection.
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(bytes);
  } catch {
    return { ok: false, error: "Could not read the PDF." };
  }
  const md: string[] = [];
  const pages = doc.getPages();
  for (let p = 0; p < pages.length; p++) {
    const contents = pages[p]!.node.Contents();
    let lines: TextLine[] = [];
    if (contents) {
      const arr = (contents as unknown as { array?: unknown[] }).array;
      const items: unknown[] = Array.isArray(arr) ? arr : [contents];
      for (const item of items) {
        const ref = item as { objectNumber?: number };
        const looked = ref.objectNumber ? doc.context.lookup(ref as never) : (item as never);
        const raw = (looked as { contents?: Uint8Array }).contents;
        if (raw) {
          const inflated = await inflateBytes(raw);
          const data = inflated ?? raw;
          lines = lines.concat(parseContentText(data));
        }
      }
    }
    if (lines.length === 0) {
      // Fall back to plain text lines (no font info).
      lines = r.pages[p]!.split("\n").map((t) => ({ text: t, fontSize: 0 }));
    }
    md.push(linesToMarkdown(lines));
  }

  const markdown = md.join("\n\n---\n\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
  return {
    ok: true,
    output: { markdown, bytes: new TextEncoder().encode(markdown), pageCount: r.pageCount },
  };
}
