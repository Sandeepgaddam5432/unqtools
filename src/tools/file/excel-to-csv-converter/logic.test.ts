import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  parseZipEntries, decompressEntry,
  parseXml, findChild, findChildren,
  parseWorkbook, parseWorkbookRels, resolveSheetPath,
  parseSharedStrings, parseStyles, parseCustomFormats, isDateFormat, excelSerialToDate,
  parseSheet, sheetToCsv, quoteCsv,
  columnToIndex, indexToColumn, parseCellRef,
  detectEncoding, previewRows, formatBytes,
  loadHistory, saveToHistory, clearHistory,
  buildShareUrl, parseShareUrl,
  convertXlsxToCsv,
  createZipBlob,
  type CsvDelimiter, type SheetInfo,
} from "./logic";
import {
  convertCsvsToXlsx, DEFAULT_OPTIONS,
} from "../csv-to-excel-converter/logic";

// DecompressionStream-backed tests for DEFLATE entries can leak async Z_DATA_ERROR
// events. Swallow them so the test runner doesn't crash.
const unhandledHandlers: Array<(...args: unknown[]) => void> = [];
beforeEach(() => {
  const handler = (err: unknown) => {
    const e = err as { code?: string };
    if (e && typeof e === "object" && e.code === "Z_DATA_ERROR") return;
    throw err;
  };
  unhandledHandlers.push(handler);
  process.on("unhandledRejection", handler as (...args: unknown[]) => void);
  process.on("uncaughtException", handler as (...args: unknown[]) => void);
});
afterEach(() => {
  for (const h of unhandledHandlers.splice(0)) {
    process.off("unhandledRejection", h as (...args: unknown[]) => void);
    process.off("uncaughtException", h as (...args: unknown[]) => void);
  }
});

// Helper: build an XLSX file from CSV content using the existing converter.
async function buildXlsx(csvs: Array<{ fileName: string; content: string; sheetName?: string }>): Promise<Uint8Array> {
  const result = convertCsvsToXlsx(csvs, DEFAULT_OPTIONS, "auto", "test.xlsx");
  const buf = new Uint8Array(await result.blob.arrayBuffer());
  return buf;
}

// ===== parseZipEntries =====

describe("excel2csv parseZipEntries", () => {
  it("parses a valid XLSX ZIP", async () => {
    const xlsx = await buildXlsx([{ fileName: "data.csv", content: "a,b\n1,2" }]);
    const entries = parseZipEntries(xlsx);
    expect(entries.length).toBeGreaterThan(0);
    const names = entries.map((e) => e.name);
    expect(names).toContain("[Content_Types].xml");
    expect(names).toContain("xl/workbook.xml");
    expect(names).toContain("xl/worksheets/sheet1.xml");
  });

  it("extracts entry data correctly", async () => {
    const xlsx = await buildXlsx([{ fileName: "data.csv", content: "a,b\n1,2" }]);
    const entries = parseZipEntries(xlsx);
    const workbook = entries.find((e) => e.name === "xl/workbook.xml")!;
    expect(workbook).toBeDefined();
    expect(workbook.compressionMethod).toBe(0); // csv-to-excel uses STORE
    expect(workbook.bytes.length).toBeGreaterThan(0);
  });

  it("returns empty for non-ZIP bytes", () => {
    const entries = parseZipEntries(new TextEncoder().encode("hello world"));
    expect(entries.length).toBe(0);
  });
});

// ===== decompressEntry =====

describe("excel2csv decompressEntry", () => {
  it("decompresses STORE entries (returns bytes as-is)", async () => {
    const xlsx = await buildXlsx([{ fileName: "data.csv", content: "a,b\n1,2" }]);
    const entries = parseZipEntries(xlsx);
    const workbook = entries.find((e) => e.name === "xl/workbook.xml")!;
    const out = await decompressEntry(workbook);
    expect(out.length).toBe(workbook.bytes.length);
    const text = new TextDecoder().decode(out);
    expect(text).toContain("<workbook");
  });

  it("decompresses DEFLATE entries", async () => {
    // Build a ZIP with a DEFLATE entry manually
    const text = "hello world ".repeat(100);
    const data = new TextEncoder().encode(text);
    // Compress with deflate-raw
    const stream = new CompressionStream("deflate-raw");
    const writer = stream.writable.getWriter();
    writer.write(data);
    writer.close();
    const reader = stream.readable.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
     
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) { chunks.push(value); total += value.length; }
    }
    const compressed = new Uint8Array(total);
    let pos = 0;
    for (const c of chunks) { compressed.set(c, pos); pos += c.length; }

    // Build ZIP local header
    const nameBytes = new TextEncoder().encode("test.txt");
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(localHeader.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(8, 8, true); // DEFLATE
    lv.setUint32(18, compressed.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, nameBytes.length, true);
    localHeader.set(nameBytes, 30);

    const zip = new Uint8Array(localHeader.length + compressed.length);
    zip.set(localHeader, 0);
    zip.set(compressed, localHeader.length);

    const entries = parseZipEntries(zip);
    expect(entries.length).toBe(1);
    const out = await decompressEntry(entries[0]!);
    expect(out).toEqual(data);
  });

  it("throws on unsupported compression method", async () => {
    const entry = {
      name: "x", compressionMethod: 99, compressedSize: 0, uncompressedSize: 0,
      dataOffset: 0, bytes: new Uint8Array(0),
    };
    await expect(decompressEntry(entry)).rejects.toThrow();
  });
});

// ===== parseXml =====

describe("excel2csv parseXml", () => {
  it("parses a simple element", () => {
    const xml = '<?xml version="1.0"?><root><child name="hello">text</child></root>';
    const root = parseXml(xml);
    const rootEl = findChild(root, "root");
    expect(rootEl).toBeDefined();
    const child = findChild(rootEl!, "child");
    expect(child).toBeDefined();
    expect(child!.attributes.name).toBe("hello");
    expect(child!.text).toBe("text");
  });

  it("parses self-closing tags", () => {
    const xml = '<root><child/></root>';
    const root = parseXml(xml);
    const rootEl = findChild(root, "root");
    expect(findChild(rootEl!, "child")).toBeDefined();
  });

  it("decodes XML entities", () => {
    const xml = "<root>a&amp;b&lt;c&gt;d&quot;e&apos;f</root>";
    const root = parseXml(xml);
    const rootEl = findChild(root, "root");
    expect(rootEl!.text).toBe('a&b<c>d"e\'f');
  });

  it("decodes numeric character references", () => {
    const xml = "<root>&#65;&#x42;</root>";
    const root = parseXml(xml);
    const rootEl = findChild(root, "root");
    expect(rootEl!.text).toBe("AB");
  });

  it("handles CDATA sections", () => {
    const xml = "<root><![CDATA[<not a tag>]]></root>";
    const root = parseXml(xml);
    const rootEl = findChild(root, "root");
    expect(rootEl!.text).toBe("<not a tag>");
  });

  it("skips comments", () => {
    const xml = "<root><!-- comment --><child>text</child></root>";
    const root = parseXml(xml);
    const rootEl = findChild(root, "root");
    expect(findChild(rootEl!, "child")).toBeDefined();
  });

  it("handles namespaced tags", () => {
    const xml = '<root xmlns:a="x"><a:child>text</a:child></root>';
    const root = parseXml(xml);
    const rootEl = findChild(root, "root");
    const child = findChild(rootEl!, "child");
    expect(child).toBeDefined();
    expect(child!.text).toBe("text");
  });

  it("handles attribute values with single quotes", () => {
    const xml = "<root><child name='single'/></root>";
    const root = parseXml(xml);
    const rootEl = findChild(root, "root");
    const child = findChild(rootEl!, "child");
    expect(child!.attributes.name).toBe("single");
  });
});

// ===== parseWorkbook =====

describe("excel2csv parseWorkbook", () => {
  it("parses sheet list from workbook.xml", async () => {
    const xlsx = await buildXlsx([{ fileName: "data.csv", content: "a,b\n1,2" }]);
    const entries = parseZipEntries(xlsx);
    const wbEntry = entries.find((e) => e.name === "xl/workbook.xml")!;
    const text = new TextDecoder().decode(wbEntry.bytes);
    const wb = parseWorkbook(text);
    expect(wb.sheets.length).toBe(1);
    expect(wb.sheets[0]!.name).toBe("data");
    expect(wb.sheets[0]!.index).toBe(0);
  });

  it("parses multiple sheets", async () => {
    const xlsx = await buildXlsx([
      { fileName: "a.csv", content: "x\n1" },
      { fileName: "b.csv", content: "x\n2" },
    ]);
    const entries = parseZipEntries(xlsx);
    const wbEntry = entries.find((e) => e.name === "xl/workbook.xml")!;
    const wb = parseWorkbook(new TextDecoder().decode(wbEntry.bytes));
    expect(wb.sheets.length).toBe(2);
  });

  it("returns empty array for missing sheets element", () => {
    const wb = parseWorkbook('<workbook xmlns="x"></workbook>');
    expect(wb.sheets).toEqual([]);
  });
});

// ===== parseWorkbookRels =====

describe("excel2csv parseWorkbookRels", () => {
  it("maps rId → target path", () => {
    const xml = `<Relationships xmlns="x">
      <Relationship Id="rId1" Type="t1" Target="worksheets/sheet1.xml"/>
      <Relationship Id="rId2" Type="t2" Target="sharedStrings.xml"/>
    </Relationships>`;
    const rels = parseWorkbookRels(xml);
    expect(rels.rId1).toBe("worksheets/sheet1.xml");
    expect(rels.rId2).toBe("sharedStrings.xml");
  });
});

// ===== resolveSheetPath =====

describe("excel2csv resolveSheetPath", () => {
  it("resolves relative path", () => {
    const sheet: SheetInfo = { name: "Sheet1", rId: "rId1", sheetId: "1", targetPath: "", index: 0 };
    const rels = { rId1: "worksheets/sheet1.xml" };
    expect(resolveSheetPath(sheet, rels)).toBe("xl/worksheets/sheet1.xml");
  });
  it("resolves absolute path (strips leading /)", () => {
    const sheet: SheetInfo = { name: "Sheet1", rId: "rId1", sheetId: "1", targetPath: "", index: 0 };
    const rels = { rId1: "/xl/worksheets/sheet1.xml" };
    expect(resolveSheetPath(sheet, rels)).toBe("xl/worksheets/sheet1.xml");
  });
  it("returns empty for unknown rId", () => {
    const sheet: SheetInfo = { name: "Sheet1", rId: "rId99", sheetId: "1", targetPath: "", index: 0 };
    expect(resolveSheetPath(sheet, {})).toBe("");
  });
});

// ===== parseSharedStrings =====

describe("excel2csv parseSharedStrings", () => {
  it("parses a simple shared strings table", () => {
    const xml = `<?xml version="1.0"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <si><t>hello</t></si>
  <si><t>world</t></si>
</sst>`;
    const ss = parseSharedStrings(xml);
    expect(ss.strings.length).toBe(2);
    expect(ss.strings[0]).toBe("hello");
    expect(ss.strings[1]).toBe("world");
  });

  it("decodes XML entities in shared strings", () => {
    const xml = `<sst xmlns="x"><si><t>a&amp;b</t></si></sst>`;
    const ss = parseSharedStrings(xml);
    expect(ss.strings[0]).toBe("a&b");
  });

  it("handles rich text runs (multiple <t> in one <si>)", () => {
    const xml = `<sst xmlns="x"><si><r><t>hello </t></r><r><t>world</t></r></si></sst>`;
    const ss = parseSharedStrings(xml);
    expect(ss.strings[0]).toBe("hello world");
  });

  it("returns empty for missing sst element", () => {
    expect(parseSharedStrings("<root></root>").strings).toEqual([]);
  });
});

// ===== parseStyles / isDateFormat =====

describe("excel2csv parseStyles", () => {
  it("parses cellXfs array", () => {
    const xml = `<styleSheet xmlns="x">
      <cellXfs count="3">
        <xf numFmtId="0"/>
        <xf numFmtId="14"/>
        <xf numFmtId="164"/>
      </cellXfs>
    </styleSheet>`;
    const styles = parseStyles(xml);
    expect(styles.length).toBe(3);
    expect(styles[0]!.numFmtId).toBe(0);
    expect(styles[1]!.numFmtId).toBe(14);
    expect(styles[2]!.numFmtId).toBe(164);
  });

  it("returns empty for missing cellXfs", () => {
    expect(parseStyles("<styleSheet></styleSheet>")).toEqual([]);
  });
});

describe("excel2csv isDateFormat", () => {
  it("returns true for built-in date formats", () => {
    expect(isDateFormat(14, {})).toBe(true); // mm-dd-yy
    expect(isDateFormat(22, {})).toBe(true); // m/d/yy h:mm
  });
  it("returns false for built-in non-date formats", () => {
    expect(isDateFormat(0, {})).toBe(false); // General
    expect(isDateFormat(1, {})).toBe(false); // 0
    expect(isDateFormat(2, {})).toBe(false); // 0.00
  });
  it("returns true for custom date formats", () => {
    expect(isDateFormat(164, { 164: "yyyy-mm-dd" })).toBe(true);
    expect(isDateFormat(165, { 165: "dd/mm/yyyy hh:mm:ss" })).toBe(true);
  });
  it("returns false for custom non-date formats", () => {
    expect(isDateFormat(164, { 164: "#,##0.00" })).toBe(false);
    expect(isDateFormat(165, { 165: '"$"#,##0.00' })).toBe(false);
  });
});

// ===== parseCustomFormats =====

describe("excel2csv parseCustomFormats", () => {
  it("parses numFmts element", () => {
    const xml = `<styleSheet xmlns="x">
      <numFmts count="2">
        <numFmt numFmtId="164" formatCode="yyyy-mm-dd"/>
        <numFmt numFmtId="165" formatCode="#,##0.00"/>
      </numFmts>
    </styleSheet>`;
    const cf = parseCustomFormats(xml);
    expect(Object.keys(cf).length).toBe(2);
    expect(cf[164]).toBe("yyyy-mm-dd");
    expect(cf[165]).toBe("#,##0.00");
  });
  it("returns empty for missing numFmts", () => {
    expect(parseCustomFormats("<styleSheet></styleSheet>")).toEqual({});
  });
});

// ===== excelSerialToDate =====

describe("excel2csv excelSerialToDate", () => {
  it("converts serial 1 to 1899-12-31 (1900 leap year bug)", () => {
    // Excel pretends 1900-02-29 exists. The "days since 1899-12-30" formula
    // gives serial 1 = 1899-12-31 (Excel's 1900-01-00 phantom day).
    // For modern dates (serial >= 61), the formula matches Excel exactly.
    expect(excelSerialToDate(1)).toBe("1899-12-31");
  });
  it("converts date-only serial without time component", () => {
    const date = excelSerialToDate(44927); // 2023-01-01
    expect(date).toBe("2023-01-01");
  });
  it("includes time for fractional serial", () => {
    const date = excelSerialToDate(44927.5); // 2023-01-01 12:00 UTC
    expect(date.startsWith("2023-01-01")).toBe(true);
  });
  it("returns empty for invalid serial", () => {
    expect(excelSerialToDate(NaN)).toBe("");
  });
});

// ===== columnToIndex / indexToColumn / parseCellRef =====

describe("excel2csv columnToIndex", () => {
  it("converts single-letter columns", () => {
    expect(columnToIndex("A")).toBe(0);
    expect(columnToIndex("B")).toBe(1);
    expect(columnToIndex("Z")).toBe(25);
  });
  it("converts two-letter columns", () => {
    expect(columnToIndex("AA")).toBe(26);
    expect(columnToIndex("AB")).toBe(27);
    expect(columnToIndex("AZ")).toBe(51);
    expect(columnToIndex("BA")).toBe(52);
  });
  it("converts three-letter columns", () => {
    expect(columnToIndex("AAA")).toBe(702);
    expect(columnToIndex("XFD")).toBe(16383); // max Excel column
  });
});

describe("excel2csv indexToColumn", () => {
  it("converts index 0 to A", () => { expect(indexToColumn(0)).toBe("A"); });
  it("converts index 25 to Z", () => { expect(indexToColumn(25)).toBe("Z"); });
  it("converts index 26 to AA", () => { expect(indexToColumn(26)).toBe("AA"); });
  it("converts index 16383 to XFD", () => { expect(indexToColumn(16383)).toBe("XFD"); });
  it("is the inverse of columnToIndex", () => {
    for (let i = 0; i < 100; i++) {
      expect(columnToIndex(indexToColumn(i))).toBe(i);
    }
  });
});

describe("excel2csv parseCellRef", () => {
  it("parses A1", () => {
    const r = parseCellRef("A1");
    expect(r.col).toBe("A");
    expect(r.row).toBe(1);
    expect(r.colIndex).toBe(0);
  });
  it("parses AB123", () => {
    const r = parseCellRef("AB123");
    expect(r.col).toBe("AB");
    expect(r.row).toBe(123);
    expect(r.colIndex).toBe(27);
  });
  it("returns defaults for invalid ref", () => {
    const r = parseCellRef("invalid");
    expect(r.col).toBe("A");
    expect(r.row).toBe(1);
    expect(r.colIndex).toBe(0);
  });
});

// ===== quoteCsv =====

describe("excel2csv quoteCsv", () => {
  it("does not quote simple values", () => {
    expect(quoteCsv("hello", ",")).toBe("hello");
    expect(quoteCsv("123", ",")).toBe("123");
  });
  it("quotes values with delimiter", () => {
    expect(quoteCsv("a,b", ",")).toBe('"a,b"');
  });
  it("quotes values with quotes", () => {
    expect(quoteCsv('say "hi"', ",")).toBe('"say ""hi"""');
  });
  it("quotes values with newlines", () => {
    expect(quoteCsv("line1\nline2", ",")).toBe('"line1\nline2"');
  });
  it("handles different delimiters", () => {
    expect(quoteCsv("a;b", ";")).toBe('"a;b"');
    expect(quoteCsv("a,b", ";")).toBe("a,b");
  });
  it("returns empty string for empty input", () => {
    expect(quoteCsv("", ",")).toBe("");
  });
});

// ===== sheetToCsv =====

describe("excel2csv sheetToCsv", () => {
  it("converts a simple sheet to CSV", () => {
    const sheet = {
      name: "Sheet1",
      rowCount: 2,
      columnCount: 2,
      rows: [
        [{ ref: "A1", type: "string" as const, value: "a" }, { ref: "B1", type: "string" as const, value: "b" }],
        [{ ref: "A2", type: "number" as const, value: "1" }, { ref: "B2", type: "number" as const, value: "2" }],
      ],
    };
    expect(sheetToCsv(sheet)).toBe("a,b\n1,2");
  });
  it("uses custom delimiter", () => {
    const sheet = {
      name: "Sheet1", rowCount: 1, columnCount: 2,
      rows: [[{ ref: "A1", type: "string" as const, value: "a" }, { ref: "B1", type: "string" as const, value: "b" }]],
    };
    expect(sheetToCsv(sheet, ";")).toBe("a;b");
  });
  it("pads short rows with empty cells", () => {
    const sheet = {
      name: "Sheet1", rowCount: 2, columnCount: 3,
      rows: [
        [{ ref: "A1", type: "string" as const, value: "a" }, { ref: "B1", type: "string" as const, value: "b" }, { ref: "C1", type: "string" as const, value: "c" }],
        [{ ref: "A2", type: "string" as const, value: "x" }],
      ],
    };
    expect(sheetToCsv(sheet)).toBe("a,b,c\nx,,");
  });
  it("handles empty sheet", () => {
    const sheet = { name: "Sheet1", rowCount: 0, columnCount: 0, rows: [] };
    expect(sheetToCsv(sheet)).toBe("");
  });
});

// ===== parseSheet =====

describe("excel2csv parseSheet", () => {
  it("parses a simple sheet with numbers", () => {
    const xml = `<?xml version="1.0"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    <row r="1">
      <c r="A1"><v>42</v></c>
      <c r="B1"><v>3.14</v></c>
    </row>
  </sheetData>
</worksheet>`;
    const data = parseSheet(xml, "Sheet1", { strings: [] }, [], {});
    expect(data.rowCount).toBe(1);
    expect(data.columnCount).toBe(2);
    expect(data.rows[0]![0]!.value).toBe("42");
    expect(data.rows[0]![0]!.type).toBe("number");
    expect(data.rows[0]![1]!.value).toBe("3.14");
  });

  it("resolves shared strings", () => {
    const xml = `<?xml version="1.0"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    <row r="1">
      <c r="A1" t="s"><v>0</v></c>
      <c r="B1" t="s"><v>1</v></c>
    </row>
  </sheetData>
</worksheet>`;
    const data = parseSheet(xml, "Sheet1", { strings: ["hello", "world"] }, [], {});
    expect(data.rows[0]![0]!.value).toBe("hello");
    expect(data.rows[0]![0]!.type).toBe("string");
    expect(data.rows[0]![1]!.value).toBe("world");
  });

  it("handles boolean cells", () => {
    const xml = `<worksheet xmlns="x"><sheetData>
      <row r="1"><c r="A1" t="b"><v>1</v></c><c r="B1" t="b"><v>0</v></c></row>
    </sheetData></worksheet>`;
    const data = parseSheet(xml, "Sheet1", { strings: [] }, [], {});
    expect(data.rows[0]![0]!.value).toBe("TRUE");
    expect(data.rows[0]![0]!.type).toBe("boolean");
    expect(data.rows[0]![1]!.value).toBe("FALSE");
  });

  it("handles inline strings", () => {
    const xml = `<worksheet xmlns="x"><sheetData>
      <row r="1"><c r="A1" t="inlineStr"><is><t>inline text</t></is></c></row>
    </sheetData></worksheet>`;
    const data = parseSheet(xml, "Sheet1", { strings: [] }, [], {});
    expect(data.rows[0]![0]!.value).toBe("inline text");
    expect(data.rows[0]![0]!.type).toBe("string");
  });

  it("detects dates via style index", () => {
    const xml = `<worksheet xmlns="x"><sheetData>
      <row r="1"><c r="A1" s="1"><v>44927</v></c></row>
    </sheetData></worksheet>`;
    // styles[1] has numFmtId=14 (date)
    const data = parseSheet(xml, "Sheet1", { strings: [] }, [{ numFmtId: 0 }, { numFmtId: 14 }], {});
    expect(data.rows[0]![0]!.type).toBe("date");
    expect(data.rows[0]![0]!.value).toBe("2023-01-01");
  });

  it("handles empty cells (pads with empty)", () => {
    const xml = `<worksheet xmlns="x"><sheetData>
      <row r="1"><c r="A1"><v>1</v></c><c r="C1"><v>3</v></c></row>
    </sheetData></worksheet>`;
    const data = parseSheet(xml, "Sheet1", { strings: [] }, [], {});
    expect(data.columnCount).toBe(3);
    expect(data.rows[0]!.length).toBe(3);
    expect(data.rows[0]![1]!.type).toBe("empty");
  });

  it("handles multiple rows", () => {
    const xml = `<worksheet xmlns="x"><sheetData>
      <row r="1"><c r="A1"><v>1</v></c></row>
      <row r="2"><c r="A2"><v>2</v></c></row>
      <row r="3"><c r="A3"><v>3</v></c></row>
    </sheetData></worksheet>`;
    const data = parseSheet(xml, "Sheet1", { strings: [] }, [], {});
    expect(data.rowCount).toBe(3);
    expect(data.rows[2]![0]!.value).toBe("3");
  });

  it("handles error cells", () => {
    const xml = `<worksheet xmlns="x"><sheetData>
      <row r="1"><c r="A1" t="e"><v>#REF!</v></c></row>
    </sheetData></worksheet>`;
    const data = parseSheet(xml, "Sheet1", { strings: [] }, [], {});
    expect(data.rows[0]![0]!.type).toBe("error");
    expect(data.rows[0]![0]!.value).toBe("#REF!");
  });

  it("returns empty for missing sheetData", () => {
    const xml = `<worksheet xmlns="x"></worksheet>`;
    const data = parseSheet(xml, "Sheet1", { strings: [] }, [], {});
    expect(data.rowCount).toBe(0);
    expect(data.columnCount).toBe(0);
  });
});

// ===== detectEncoding =====

describe("excel2csv detectEncoding", () => {
  it("detects UTF-8 BOM", () => {
    expect(detectEncoding(new Uint8Array([0xef, 0xbb, 0xbf, 0x68]))).toEqual({ encoding: "UTF-8", hasBom: true });
  });
  it("defaults to UTF-8 without BOM", () => {
    expect(detectEncoding(new Uint8Array([0x68, 0x69]))).toEqual({ encoding: "UTF-8", hasBom: false });
  });
});

// ===== previewRows =====

describe("excel2csv previewRows", () => {
  it("returns limited rows as objects", () => {
    const sheet = {
      name: "Sheet1", rowCount: 3, columnCount: 2,
      rows: [
        [{ ref: "A1", type: "string" as const, value: "a" }, { ref: "B1", type: "string" as const, value: "b" }],
        [{ ref: "A2", type: "string" as const, value: "c" }, { ref: "B2", type: "string" as const, value: "d" }],
        [{ ref: "A3", type: "string" as const, value: "e" }, { ref: "B3", type: "string" as const, value: "f" }],
      ],
    };
    const preview = previewRows(sheet, 2);
    expect(preview.length).toBe(2);
    expect(preview[0]).toEqual({ A: "a", B: "b" });
    expect(preview[1]).toEqual({ A: "c", B: "d" });
  });
});

// ===== formatBytes =====

describe("excel2csv formatBytes", () => {
  it("formats bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
  });
});

// ===== History (localStorage) =====

describe("excel2csv history", () => {
  beforeEach(() => {
    const store: Record<string, string> = {};
    (globalThis as { localStorage?: Storage }).localStorage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
      clear: () => { for (const k of Object.keys(store)) delete store[k]; },
      key: (i: number) => Object.keys(store)[i] ?? null,
      get length() { return Object.keys(store).length; },
    } as Storage;
  });

  it("returns empty when no history", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads entries", () => {
    saveToHistory({
      fileName: "data.xlsx", sheetCount: 2, totalRows: 10, totalCells: 20,
      csvBytes: 1024, convertedAt: new Date().toISOString(),
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 10 entries", () => {
    for (let i = 0; i < 15; i++) {
      saveToHistory({
        fileName: `f${i}.xlsx`, sheetCount: 1, totalRows: 1, totalCells: 1,
        csvBytes: 100, convertedAt: new Date().toISOString(),
      });
    }
    expect(loadHistory()).toHaveLength(10);
  });
  it("clears history", () => {
    saveToHistory({
      fileName: "x.xlsx", sheetCount: 1, totalRows: 1, totalCells: 1,
      csvBytes: 100, convertedAt: new Date().toISOString(),
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ===== Share URL =====

describe("excel2csv share URL", () => {
  beforeEach(() => {
    (globalThis as { window?: typeof globalThis & { location: { origin: string; pathname: string } } }).window = globalThis as unknown as typeof globalThis & { location: { origin: string; pathname: string } };
    (globalThis as { location?: { origin: string; pathname: string } }).location = {
      origin: "https://example.com",
      pathname: "/tools/excel-to-csv-converter",
    };
  });

  it("builds share URL with options", () => {
    const url = buildShareUrl({ delimiter: ";", convertAllSheets: true });
    expect(url).toContain("delim=");
    expect(url).toContain("all=true");
  });
  it("encodes tab as \\t", () => {
    const url = buildShareUrl({ delimiter: "\t", convertAllSheets: false });
    expect(url).toContain("delim=%5Ct");
  });
  it("parses share URL back", () => {
    const url = buildShareUrl({ delimiter: ";", convertAllSheets: true });
    const hash = url.substring(url.indexOf("#"));
    const parsed = parseShareUrl(hash);
    expect(parsed?.delimiter).toBe(";");
    expect(parsed?.convertAllSheets).toBe(true);
  });
  it("parses tab from \\t", () => {
    const url = buildShareUrl({ delimiter: "\t", convertAllSheets: false });
    const hash = url.substring(url.indexOf("#"));
    const parsed = parseShareUrl(hash);
    expect(parsed?.delimiter).toBe("\t");
  });
  it("returns null for empty hash", () => {
    expect(parseShareUrl("")).toBeNull();
    expect(parseShareUrl("#")).toBeNull();
  });
});

// ===== createZipBlob =====

describe("excel2csv createZipBlob", () => {
  it("creates valid ZIP signature", async () => {
    const blob = createZipBlob([
      { name: "a.csv", data: new TextEncoder().encode("a,b\n1,2") },
    ]);
    const buf = new Uint8Array(await blob.arrayBuffer());
    expect(buf[0]).toBe(0x50);
    expect(buf[1]).toBe(0x4b);
  });
});

// ===== convertXlsxToCsv (top-level) =====

describe("excel2csv convertXlsxToCsv", () => {
  it("converts a single-sheet XLSX to CSV", async () => {
    const xlsx = await buildXlsx([{ fileName: "data.csv", content: "name,age\nAlice,30\nBob,25" }]);
    const result = await convertXlsxToCsv(
      { fileName: "data.xlsx", bytes: xlsx },
      ",", null, false,
    );
    expect(result.sheets.length).toBe(1);
    expect(result.totalRows).toBe(3); // header + 2 data
    expect(result.blob).not.toBeNull();
    const csv = await result.blob!.text();
    expect(csv).toContain("name,age");
    expect(csv).toContain("Alice,30");
    expect(csv).toContain("Bob,25");
  });

  it("converts multiple sheets when convertAllSheets=true", async () => {
    const xlsx = await buildXlsx([
      { fileName: "a.csv", content: "x\n1" },
      { fileName: "b.csv", content: "y\n2" },
    ]);
    const result = await convertXlsxToCsv(
      { fileName: "multi.xlsx", bytes: xlsx },
      ",", null, true,
    );
    expect(result.sheets.length).toBe(2);
    expect(result.blob).not.toBeNull();
    // ZIP bundle for multiple sheets
    const buf = new Uint8Array(await result.blob!.arrayBuffer());
    expect(buf[0]).toBe(0x50); // ZIP magic
    expect(result.outputFileName).toContain("sheets.zip");
  });

  it("converts only the first sheet by default", async () => {
    const xlsx = await buildXlsx([
      { fileName: "a.csv", content: "x\n1" },
      { fileName: "b.csv", content: "y\n2" },
    ]);
    const result = await convertXlsxToCsv(
      { fileName: "multi.xlsx", bytes: xlsx },
      ",", null, false,
    );
    expect(result.sheets.length).toBe(1);
  });

  it("converts a specific sheet by index", async () => {
    const xlsx = await buildXlsx([
      { fileName: "a.csv", content: "x\n1" },
      { fileName: "b.csv", content: "y\n2" },
    ]);
    const result = await convertXlsxToCsv(
      { fileName: "multi.xlsx", bytes: xlsx },
      ",", 1, false,
    );
    expect(result.sheets.length).toBe(1);
    expect(result.sheets[0]!.sheetName).toBe("b");
  });

  it("preserves string and number cell types", async () => {
    const xlsx = await buildXlsx([{ fileName: "data.csv", content: "name,val\nAlice,42\nBob,3.14" }]);
    const result = await convertXlsxToCsv(
      { fileName: "data.xlsx", bytes: xlsx },
      ",", null, false,
    );
    const csv = await result.blob!.text();
    expect(csv).toContain("Alice,42");
    expect(csv).toContain("3.14");
  });

  it("throws on non-XLSX input", async () => {
    await expect(convertXlsxToCsv(
      { fileName: "x.txt", bytes: new TextEncoder().encode("hello") },
      ",", null, false,
    )).rejects.toThrow();
  });

  it("throws on out-of-range sheet index", async () => {
    const xlsx = await buildXlsx([{ fileName: "data.csv", content: "a,b\n1,2" }]);
    await expect(convertXlsxToCsv(
      { fileName: "data.xlsx", bytes: xlsx },
      ",", 99, false,
    )).rejects.toThrow();
  });

  it("uses custom delimiter in output", async () => {
    const xlsx = await buildXlsx([{ fileName: "data.csv", content: "a,b\n1,2" }]);
    const result = await convertXlsxToCsv(
      { fileName: "data.xlsx", bytes: xlsx },
      ";", null, false,
    );
    const csv = await result.blob!.text();
    expect(csv).toContain("a;b");
    expect(csv).toContain("1;2");
  });

  it("uses custom output filename", async () => {
    const xlsx = await buildXlsx([{ fileName: "data.csv", content: "a,b\n1,2" }]);
    const result = await convertXlsxToCsv(
      { fileName: "data.xlsx", bytes: xlsx },
      ",", null, false, "custom.csv",
    );
    expect(result.outputFileName).toBe("custom.csv");
  });
});
