import { describe, expect, it } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { escapeHtml, textToParagraphs, buildHtml, pdfToHtml } from "./logic";

describe("escapeHtml", () => {
  it("escapes HTML metacharacters", () => {
    expect(escapeHtml(`<b>"x" & 'y'</b>`)).toBe("&lt;b&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;/b&gt;");
  });
});

describe("textToParagraphs", () => {
  it("splits blank-line blocks into paragraphs", () => {
    const html = textToParagraphs("First line\ncontinued\n\nSecond para");
    expect(html).toContain("<p>First line<br>continued</p>");
    expect(html).toContain("<p>Second para</p>");
  });
});

describe("buildHtml", () => {
  it("produces a full document", () => {
    const html = buildHtml("My Doc", ["Hello world", "Second page"], []);
    expect(html).toContain("<title>My Doc</title>");
    expect(html).toContain("<h1>My Doc</h1>");
    expect(html).toContain("<p>Hello world</p>");
    expect(html).toContain("page-break");
  });
});

describe("pdfToHtml", () => {
  it("converts a real PDF", async () => {
    const doc = await PDFDocument.create();
    doc.setTitle("Report 2026");
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const page = doc.addPage([300, 400]);
    page.drawText("Quarterly results", { x: 40, y: 320, size: 16, font });
    page.drawText("Revenue grew 20%.", { x: 40, y: 290, size: 12, font });
    const r = await pdfToHtml(await doc.save());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.output.html).toContain("Report 2026");
      expect(r.output.html).toContain("Quarterly results");
      expect(r.output.html).toContain("Revenue grew 20%.");
      expect(r.output.pageCount).toBe(1);
    }
  });

  it("rejects corrupt PDFs", async () => {
    const r = await pdfToHtml(new Uint8Array([1, 2]));
    expect(r.ok).toBe(false);
  });
});
