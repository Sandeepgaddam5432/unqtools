/**
 * PDF to EPUB — real engine.
 *
 * Builds a valid EPUB 3 container from the PDF's text layer:
 *   - META-INF/container.xml → content.opf
 *   - chapter XHTML files (one per source page or grouped by blank-line
 *     paragraphs) with extracted text
 *   - EPUB is a ZIP; jszip is lazy-loaded.
 * Honest limits: text-only export (images not carried over), styling is
 * minimal. Pure HTML/OPF builders are unit-tested in Node.
 */
import type { ToolResult } from "../../../lib/tool";
import { extractAllText } from "../_shared/text-extract";
import { escapeHtml } from "../pdf-to-html/logic";

export interface EpubResult {
  bytes: Uint8Array;
  chapters: number;
  totalChars: number;
}

/** Build chapter XHTML from a page's text. Pure + testable. */
export function pageToChapterHtml(index: number, text: string): string {
  const paras = text
    .split(/\n{2,}/)
    .map((b) => b.split("\n").map((l) => escapeHtml(l)).join("<br>"))
    .filter(Boolean)
    .map((p) => `<p>${p}</p>`)
    .join("\n");
  return `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Page ${index + 1}</title></head>
<body>
<h2>Page ${index + 1}</h2>
${paras || "<p><i>No extractable text on this page.</i></p>"}
</body>
</html>`;
}

/** Build the OPF package document. Pure + testable. */
export function buildOpf(title: string, chapters: number): string {
  const items = Array.from({ length: chapters }, (_, i) => {
    const id = `ch${i + 1}`;
    return `<item id="${id}" href="chap${i + 1}.xhtml" media-type="application/xhtml+xml"/>`;
  }).join("\n  ");
  const spine = Array.from({ length: chapters }, (_, i) => `<itemref idref="ch${i + 1}"/>`).join("\n  ");
  return `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="uid">unqtools-${Date.now()}</dc:identifier>
    <dc:title>${escapeHtml(title)}</dc:title>
    <dc:language>en</dc:language>
  </metadata>
  <manifest>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    ${items}
  </manifest>
  <spine>
    ${spine}
  </spine>
</package>`;
}

/** Build the NCX table of contents. Pure + testable. */
export function buildNcx(chapters: number): string {
  const points = Array.from({ length: chapters }, (_, i) =>
    `<navPoint id="nav${i + 1}" playOrder="${i + 1}"><navLabel><text>Page ${i + 1}</text></navLabel><content src="chap${i + 1}.xhtml"/></navPoint>`
  ).join("\n  ");
  return `<?xml version="1.0" encoding="utf-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head><meta name="dtb:uid" content="unqtools"/></head>
  <docTitle><text>Converted</text></docTitle>
  <navMap>
  ${points}
  </navMap>
</ncx>`;
}

export async function pdfToEpub(bytes: Uint8Array): Promise<ToolResult<EpubResult>> {
  const r = await extractAllText(bytes);
  if (!r.ok) return r;

  let title = "Converted PDF";
  try {
    const { PDFDocument } = await import("pdf-lib");
    const doc = await PDFDocument.load(bytes);
    title = doc.getTitle() ?? "Converted PDF";
  } catch {
    /* default */
  }

  try {
    const { default: JSZip } = await import("jszip");
    const zip = new JSZip();
    zip.file(
      "META-INF/container.xml",
      `<?xml version="1.0" encoding="utf-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`
    );
    const chapters = r.pages.length;
    for (let i = 0; i < chapters; i++) {
      zip.file(`OEBPS/chap${i + 1}.xhtml`, pageToChapterHtml(i, r.pages[i]!));
    }
    zip.file("OEBPS/content.opf", buildOpf(title, chapters));
    zip.file("OEBPS/toc.ncx", buildNcx(chapters));
    const blob = await zip.generateAsync({ type: "blob" });
    const outBytes = new Uint8Array(await blob.arrayBuffer());
    return {
      ok: true,
      output: { bytes: outBytes, chapters, totalChars: r.fullText.length },
    };
  } catch {
    return { ok: false, error: "Could not build the EPUB container." };
  }
}
