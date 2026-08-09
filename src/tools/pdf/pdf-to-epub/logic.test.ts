import { describe, expect, it } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { pageToChapterHtml, buildOpf, buildNcx, pdfToEpub } from "./logic";

describe("pageToChapterHtml", () => {
  it("builds XHTML with escaped paragraphs", () => {
    const html = pageToChapterHtml(0, "Hello & welcome\n\nSecond para");
    expect(html).toContain("Hello &amp; welcome");
    expect(html).toContain("<p>Second para</p>");
    expect(html).toContain("<h2>Page 1</h2>");
  });
});

describe("buildOpf", () => {
  it("lists manifest + spine items", () => {
    const opf = buildOpf("My Book", 2);
    expect(opf).toContain("<dc:title>My Book</dc:title>");
    expect(opf).toContain('href="chap1.xhtml"');
    expect(opf).toContain('idref="ch2"');
  });
});

describe("buildNcx", () => {
  it("creates navPoints per chapter", () => {
    const ncx = buildNcx(3);
    expect(ncx).toContain("nav1");
    expect(ncx).toContain("nav3");
    expect(ncx).toContain('src="chap2.xhtml"');
  });
});

describe("pdfToEpub", () => {
  it("builds a valid EPUB container", async () => {
    const doc = await PDFDocument.create();
    doc.setTitle("Epub Book");
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const page = doc.addPage([300, 400]);
    page.drawText("Chapter one content here.", { x: 40, y: 300, size: 12, font });
    const r = await pdfToEpub(await doc.save());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.output.chapters).toBe(1);
      expect(r.output.bytes.length).toBeGreaterThan(200);
      // Check the zip contains the container.
      const { default: JSZip } = await import("jszip");
      const zip = await JSZip.loadAsync(r.output.bytes);
      expect(zip.file("META-INF/container.xml")).toBeTruthy();
      expect(zip.file("OEBPS/content.opf")).toBeTruthy();
    }
  });

  it("rejects corrupt PDFs", async () => {
    const r = await pdfToEpub(new Uint8Array([1, 2]));
    expect(r.ok).toBe(false);
  });
});
