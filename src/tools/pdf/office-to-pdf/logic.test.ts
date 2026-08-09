import { describe, expect, it } from "vitest";
import {
  officeKindFromName,
  extractDocxText,
  extractXlsxText,
  extractPptxText,
  extractCsvText,
} from "./logic";

describe("officeKindFromName", () => {
  it("detects file kinds by extension", () => {
    expect(officeKindFromName("report.docx")).toBe("docx");
    expect(officeKindFromName("data.XLSX")).toBe("xlsx");
    expect(officeKindFromName("deck.pptx")).toBe("pptx");
    expect(officeKindFromName("notes.txt")).toBe("text");
    expect(officeKindFromName("notes.rtf")).toBe("text");
    expect(officeKindFromName("data.csv")).toBe("text");
    expect(officeKindFromName("photo.png")).toBeNull();
  });
});

describe("extractDocxText", () => {
  it("extracts paragraphs with bold/italic markers", () => {
    const xml = `<w:document>
      <w:body>
        <w:p><w:r><w:t>Hello </w:t></w:r><w:r><w:b/><w:t>bold</w:t></w:r></w:p>
        <w:p><w:r><w:i/><w:t>italic</w:t></w:r></w:p>
      </w:body>
    </w:document>`;
    const t = extractDocxText(xml);
    expect(t).toContain("Hello **bold**");
    expect(t).toContain("*italic*");
  });

  it("decodes entities", () => {
    const xml = `<w:p><w:r><w:t>a &amp; b</w:t></w:r></w:p>`;
    expect(extractDocxText(xml)).toContain("a & b");
  });
});

describe("extractXlsxText", () => {
  it("maps shared string indices to values", () => {
    const sheet = `<worksheet><sheetData>
      <row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row>
      <row r="2"><c r="A2"><v>42</v></c></row>
    </sheetData></worksheet>`;
    const t = extractXlsxText(sheet, ["Name", "Value"]);
    expect(t).toContain("Name | Value");
    expect(t).toContain("42");
  });
});

describe("extractPptxText", () => {
  it("extracts a:t text blocks", () => {
    const xml = `<p:sp><a:t>Slide title</a:t></p:sp><p:sp><a:t>Second line</a:t></p:sp>`;
    const t = extractPptxText(xml);
    expect(t).toContain("Slide title");
    expect(t).toContain("Second line");
  });
});

describe("extractCsvText", () => {
  it("parses simple and quoted CSV", () => {
    expect(extractCsvText("a,b,c\n1,2,3")).toContain("a | b | c");
    expect(extractCsvText('x,"hello, world",z')).toContain("x | hello, world | z");
  });
});
