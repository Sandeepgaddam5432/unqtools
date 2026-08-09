/**
 * EPUB to PDF — real engine.
 *
 * Parses an EPUB (a ZIP container):
 *   1. Reads META-INF/container.xml to find the OPF package file.
 *   2. Reads the OPF: manifest (id → href), spine (reading order).
 *   3. Extracts each chapter's XHTML, converts to plain text with
 *      heading/lists markers, and renders the whole book through the
 *      Markdown-to-PDF engine (selectable text, headers, page numbers).
 * 100% client-side; jszip is lazy-loaded only when a file is chosen.
 */
import type { ToolResult } from "../../../lib/tool";

export interface EpubOptions {
  pageSize?: "a4" | "letter";
  orientation?: "portrait" | "landscape";
  margin?: number;
  bodySize?: number;
  /** Prefix chapter titles with "Chapter N". Default true. */
  chapterTitles?: boolean;
}

export interface EpubResult {
  bytes: Uint8Array;
  chapters: number;
  totalChars: number;
}

/* ------------------------------------------------------------------ */
/* Pure parsing helpers (Node-testable)                                */
/* ------------------------------------------------------------------ */

/** Extract the OPF path from container.xml. */
export function opfPathFromContainer(containerXml: string): string | null {
  const m = containerXml.match(/full-path\s*=\s*["']([^"']+)["']/i);
  return m ? m[1]!.trim() : null;
}

/** Extract manifest items from OPF: map id → href (resolved vs base dir). */
export function parseOpfManifest(opfXml: string): { idToHref: Record<string, string>; spine: string[] } {
  const idToHref: Record<string, string> = {};
  const items = opfXml.match(/<item\b[^>]*>/gi) ?? [];
  for (const item of items) {
    const id = item.match(/\bid\s*=\s*["']([^"']+)["']/i)?.[1];
    const href = item.match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1];
    const media = item.match(/\bmedia-type\s*=\s*["']([^"']+)["']/i)?.[1];
    if (id && href && media && /xhtml|html/i.test(media)) {
      idToHref[id] = href;
    }
  }
  const spine: string[] = [];
  const refs = opfXml.match(/<itemref\b[^>]*>/gi) ?? [];
  for (const ref of refs) {
    const idref = ref.match(/\bidref\s*=\s*["']([^"']+)["']/i)?.[1];
    if (idref) spine.push(idref);
  }
  return { idToHref, spine };
}

/** Resolve a chapter href against the OPF's base directory. */
export function resolveHref(opfPath: string, href: string): string {
  const base = opfPath.includes("/") ? opfPath.slice(0, opfPath.lastIndexOf("/") + 1) : "";
  return base + href;
}

/**
 * Convert a chapter's XHTML to readable text: strips tags, keeps headings
 * (as "# " lines), lists ("- "), paragraphs, and &amp;-style entities.
 */
export function htmlToText(html: string): string {
  let s = html
    // Keep block boundaries
    .replace(/<h([1-6])[^>]*>/gi, (_, level) => "\n" + "#".repeat(Number(level)) + " ")
    .replace(/<\/h[1-6]>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n- ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<(p|div|br|tr)[^>]*>/gi, "\n")
    .replace(/<\/(p|div|tr)>/gi, "\n")
    .replace(/<\/td>/gi, " | ")
    .replace(/<t[dh][^>]*>/gi, " ")
    .replace(/<hr[^>]*>/gi, "\n---\n")
    // Strip remaining tags
    .replace(/<[^>]+>/g, "")
    // Entities
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    // Decode percent-encoded UTF-8 leftovers are rare; normalize whitespace
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim();
  return s;
}

/* ------------------------------------------------------------------ */
/* Full conversion (browser + Node both can use this path)             */
/* ------------------------------------------------------------------ */

export async function epubToPdf(
  epubBytes: Uint8Array,
  options: EpubOptions = {}
): Promise<ToolResult<EpubResult>> {
  try {
    const { default: JSZip } = await import("jszip");
    const zip = await JSZip.loadAsync(epubBytes);

    // 1. container.xml → OPF path
    const containerEntry = zip.file("META-INF/container.xml");
    if (!containerEntry) return { ok: false, error: "This doesn't look like a valid EPUB (no container.xml)." };
    const containerXml = await containerEntry.async("string");
    const opfPath = opfPathFromContainer(containerXml);
    if (!opfPath) return { ok: false, error: "Could not find the EPUB package file (OPF)." };

    // 2. OPF → manifest + spine
    const opfEntry = zip.file(opfPath);
    if (!opfEntry) return { ok: false, error: `Could not read ${opfPath}.` };
    const opfXml = await opfEntry.async("string");
    const { idToHref, spine } = parseOpfManifest(opfXml);
    if (spine.length === 0) return { ok: false, error: "The EPUB has no chapters in its spine." };

    // 3. Extract chapter texts
    const chapters: string[] = [];
    let chapterNumber = 0;
    for (const id of spine) {
      const href = idToHref[id];
      if (!href) continue;
      const resolved = resolveHref(opfPath, href);
      const entry = zip.file(resolved) ?? zip.file(decodeURIComponent(resolved));
      if (!entry) continue;
      const xml = await entry.async("string");
      const title = (xml.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? "").trim();
      const text = htmlToText(xml);
      if (!text) continue;
      chapterNumber++;
      const heading = options.chapterTitles !== false ? (title || `Chapter ${chapterNumber}`) : "";
      chapters.push(heading ? `# ${heading}\n\n${text}` : text);
    }
    if (chapters.length === 0) {
      return { ok: false, error: "No readable chapter content was found in this EPUB." };
    }

    // 4. Render through the Markdown engine.
    const { markdownToPdf } = await import("../markdown-to-pdf/logic");
    const md = chapters.join("\n\n---\n\n");
    const rendered = await markdownToPdf(md, {
      pageSize: options.pageSize,
      orientation: options.orientation,
      margin: options.margin,
      bodySize: options.bodySize,
      pageNumbers: true,
    });
    if (!rendered.ok) return rendered;
    const totalChars = md.replace(/[#\-\n|]/g, "").length;
    return { ok: true, output: { bytes: rendered.output, chapters: chapters.length, totalChars } };
  } catch {
    return { ok: false, error: "Could not read the EPUB — the file may be corrupted." };
  }
}
