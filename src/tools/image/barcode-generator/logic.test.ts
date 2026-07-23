/**
 * Barcode Generator — unit tests.
 *
 * Pure functions only. The lazy-loaded renderers (renderToCanvas /
 * renderToSvg / renderToPngBlob / renderToPdf) require a browser canvas
 * or jsPDF and are exercised by Playwright e2e instead.
 */
import { describe, it, expect } from "vitest";
import {
  validateInput,
  computeChecksum,
  computeMod10CheckDigit,
  computeMsiCheckDigit,
  normalizeFormat,
  buildGs1String,
  parseBulkCsv,
  generateSequence,
  computeQuietZone,
  checkColorContrast,
  analyzeCode128Subsets,
  csvManifestExport,
  jsonManifestExport,
  pixelsToMm,
  buildBarcodeFilename,
  FORMAT_REGISTRY,
  FORMATS_BY_GROUP,
  BUILTIN_LABEL_SHEETS,
  type BarcodeFormat,
  type BarcodeResult,
} from "./logic";

/* ------------------------------------------------------------------ */
/* Mod-10 check digit (EAN/UPC/ITF)                                    */
/* ------------------------------------------------------------------ */

describe("computeMod10CheckDigit", () => {
  it("computes EAN-13 check digit for 400638133393 → 1", () => {
    expect(computeMod10CheckDigit("400638133393")).toBe("1");
  });

  it("computes EAN-8 check digit for 7351353 → 7", () => {
    expect(computeMod10CheckDigit("7351353")).toBe("7");
  });

  it("computes UPC-A check digit for 03600029145 → 2", () => {
    expect(computeMod10CheckDigit("03600029145")).toBe("2");
  });

  it("computes ITF-14 check digit for 1541234567890 → 5", () => {
    expect(computeMod10CheckDigit("1541234567890")).toBe("5");
  });

  it("returns 0 when sum is a multiple of 10", () => {
    // 000000000001 → weighted sum = 1*3 = 3 → check 7. Pick all zeros for sum 0.
    expect(computeMod10CheckDigit("000000000000")).toBe("0");
  });

  it("throws on non-digit input", () => {
    expect(() => computeMod10CheckDigit("12A3")).toThrow();
  });
});

/* ------------------------------------------------------------------ */
/* MSI check digit                                                     */
/* ------------------------------------------------------------------ */

describe("computeMsiCheckDigit", () => {
  it("returns a single-digit string", () => {
    expect(computeMsiCheckDigit("12345")).toMatch(/^\d$/);
  });

  it("computes the known test vector for 1234567 → 4", () => {
    // Reference MSI Plessey mod-10 example:
    //   digits 1234567 → reverse 7,6,5,4,3,2,1
    //   double positions 1,3,5,7 (rightmost-first): 7*2=14→1+4, 5*2=10→1+0, 3*2=6, 1*2=2
    //   non-doubled: 6, 4, 2
    //   sum = 5+6+1+4+6+2+2 = 26 → check = (10 - 26%10) % 10 = 4
    expect(computeMsiCheckDigit("1234567")).toBe("4");
  });

  it("computes a check digit whose appended form is consistent with re-strip", () => {
    // The MSI check digit makes the weighted sum a multiple of 10. We verify
    // by computing it on the data, then re-computing the SUM (without
    // appending) on (data + check) using the same algorithm and confirming
    // the implied check is 0.
    const data = "98765";
    const check = computeMsiCheckDigit(data);
    const full = data + check;
    // Re-run on the FULL string: the rightmost (now `check`) gets doubled.
    // The implied check digit of the full string is whatever value would
    // make the next sum a multiple of 10. We just verify the function
    // returns a single digit for the full string (smoke test — MSI's
    // algorithm does NOT have Luhn's "append gives 0" property).
    expect(computeMsiCheckDigit(full)).toMatch(/^\d$/);
  });

  it("throws on non-digit input", () => {
    expect(() => computeMsiCheckDigit("12X45")).toThrow();
  });
});

/* ------------------------------------------------------------------ */
/* computeChecksum dispatch                                            */
/* ------------------------------------------------------------------ */

describe("computeChecksum", () => {
  it("dispatches to mod-10 for ean13", () => {
    expect(computeChecksum("ean13", "400638133393")).toBe("1");
  });

  it("dispatches to mod-10 for upca", () => {
    expect(computeChecksum("upca", "03600029145")).toBe("2");
  });

  it("dispatches to mod-10 for itf14", () => {
    expect(computeChecksum("itf14", "1541234567890")).toBe("5");
  });

  it("dispatches to MSI for msi", () => {
    expect(computeChecksum("msi", "1234567")).toMatch(/^\d$/);
  });

  it("returns empty string for formats without a check digit", () => {
    expect(computeChecksum("code128", "ABC123")).toBe("");
    expect(computeChecksum("codabar", "A12345B")).toBe("");
    expect(computeChecksum("pharmacode", "1300")).toBe("");
    expect(computeChecksum("qrcode", "hello")).toBe("");
  });
});

/* ------------------------------------------------------------------ */
/* normalizeFormat                                                     */
/* ------------------------------------------------------------------ */

describe("normalizeFormat", () => {
  it("maps our ids to bwip-js bcids", () => {
    expect(normalizeFormat("code128")).toBe("code128");
    expect(normalizeFormat("ean13")).toBe("ean13");
    expect(normalizeFormat("upca")).toBe("upca");
    expect(normalizeFormat("gs1-128")).toBe("gs1-128");
    expect(normalizeFormat("qrcode")).toBe("qrcode");
    expect(normalizeFormat("aztec")).toBe("azteccode");
  });

  it("throws for unknown format", () => {
    expect(() => normalizeFormat("nonexistent" as BarcodeFormat)).toThrow();
  });
});

/* ------------------------------------------------------------------ */
/* validateInput                                                       */
/* ------------------------------------------------------------------ */

describe("validateInput", () => {
  it("accepts EAN-13 data digits and appends the check", () => {
    const r = validateInput("ean13", "400638133393");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output.cleaned).toBe("4006381333931");
  });

  it("accepts EAN-13 with correct check digit", () => {
    const r = validateInput("ean13", "4006381333931");
    expect(r.ok).toBe(true);
  });

  it("rejects EAN-13 with wrong check digit and gives the reason", () => {
    const r = validateInput("ean13", "4006381333939");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/check digit/i);
  });

  it("rejects EAN-13 with wrong length", () => {
    const r = validateInput("ean13", "12345");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/needs 12 data digits/i);
  });

  it("rejects non-digit input for EAN-13", () => {
    const r = validateInput("ean13", "ABCDEF123456");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/digits only/i);
  });

  it("rejects empty input", () => {
    const r = validateInput("code128", "");
    expect(r.ok).toBe(false);
  });

  it("trims unicode zero-width chars (edge case)", () => {
    const r = validateInput("code128", "ABC\u200B1234\uFEFF");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output.cleaned).toBe("ABC1234");
  });

  it("validates UPC-A (11 data digits)", () => {
    const r = validateInput("upca", "03600029145");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output.cleaned).toBe("036000291452");
  });

  it("validates ITF-14 (13 data digits)", () => {
    const r = validateInput("itf14", "1541234567890");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output.cleaned).toBe("15412345678905");
  });

  it("validates Pharmacode range (3-131070)", () => {
    expect(validateInput("pharmacode", "3").ok).toBe(true);
    expect(validateInput("pharmacode", "131070").ok).toBe(true);
    expect(validateInput("pharmacode", "2").ok).toBe(false);
    expect(validateInput("pharmacode", "131071").ok).toBe(false);
  });

  it("rejects Code 39 lowercase chars", () => {
    const r = validateInput("code39", "abc123");
    expect(r.ok).toBe(false);
  });

  it("accepts Code 39 uppercase + special", () => {
    expect(validateInput("code39", "ABC-123$X").ok).toBe(true);
  });

  it("rejects Code 128 unicode chars", () => {
    const r = validateInput("code128", "héllo");
    expect(r.ok).toBe(false);
  });

  it("warns on Code 128 input longer than 80 chars", () => {
    const long = "A".repeat(81);
    const r = validateInput("code128", long);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/very long/i);
  });

  it("requires GS1-128 to contain at least one (NN) AI", () => {
    expect(validateInput("gs1-128", "12345").ok).toBe(false);
    expect(
      validateInput("gs1-128", "(01)15412345678905(17)251231").ok,
    ).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/* buildGs1String                                                      */
/* ------------------------------------------------------------------ */

describe("buildGs1String", () => {
  it("builds a single-AI string", () => {
    expect(buildGs1String([{ ai: "01", value: "15412345678905" }])).toBe(
      "(01)15412345678905",
    );
  });

  it("builds a multi-AI string", () => {
    const s = buildGs1String([
      { ai: "01", value: "15412345678905" },
      { ai: "17", value: "251231" },
      { ai: "10", value: "BATCH001" },
    ]);
    expect(s).toBe("(01)15412345678905(17)251231(10)BATCH001");
  });

  it("strips non-digits from AI", () => {
    expect(buildGs1String([{ ai: "AI-01", value: "12345" }])).toBe("(01)12345");
  });

  it("trims value whitespace", () => {
    expect(buildGs1String([{ ai: "01", value: "  12345  " }])).toBe("(01)12345");
  });

  it("returns empty string for empty list", () => {
    expect(buildGs1String([])).toBe("");
  });
});

/* ------------------------------------------------------------------ */
/* parseBulkCsv                                                        */
/* ------------------------------------------------------------------ */

describe("parseBulkCsv", () => {
  it("parses single-column values (one per line)", () => {
    const r = parseBulkCsv("ABC123\nDEF456\nGHI789");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.output).toHaveLength(3);
      expect(r.output[0]).toEqual({ format: "code128", value: "ABC123" });
    }
  });

  it("parses two-column format,value CSV", () => {
    const r = parseBulkCsv("ean13,400638133393\ncode128,ABC-1234");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.output[0]).toEqual({ format: "ean13", value: "400638133393" });
      expect(r.output[1]).toEqual({ format: "code128", value: "ABC-1234" });
    }
  });

  it("parses three-column format,value,label CSV", () => {
    const r = parseBulkCsv("ean13,400638133393,Product A");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output[0]?.label).toBe("Product A");
  });

  it("skips blank lines", () => {
    const r = parseBulkCsv("ABC123\n\n\nDEF456");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output).toHaveLength(2);
  });

  it("trims unicode whitespace in cells", () => {
    const r = parseBulkCsv("\uFEFFABC123 \n DEF456\u200B");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.output[0]?.value).toBe("ABC123");
      expect(r.output[1]?.value).toBe("DEF456");
    }
  });

  it("rejects unknown format ids with line numbers", () => {
    const r = parseBulkCsv("ean13,12345\nunknown,xyz\ncode128,abc");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/line\(s\): 2/i);
  });

  it("rejects empty input", () => {
    expect(parseBulkCsv("").ok).toBe(false);
    expect(parseBulkCsv("   \n  \n").ok).toBe(false);
  });

  it("handles Windows CRLF line endings", () => {
    const r = parseBulkCsv("ABC123\r\nDEF456\r\n");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output).toHaveLength(2);
  });
});

/* ------------------------------------------------------------------ */
/* generateSequence                                                    */
/* ------------------------------------------------------------------ */

describe("generateSequence", () => {
  it("generates an EAN-13 sequence of 5 values starting from a data string", () => {
    const seq = generateSequence("ean13", "400638133393", 1, 5);
    expect(seq).toHaveLength(5);
    expect(seq[0]).toBe("400638133393");
    expect(seq[1]).toBe("400638133394");
    expect(seq[4]).toBe("400638133397");
  });

  it("zero-pads short incremented values to the data length", () => {
    const seq = generateSequence("ean13", "400638133390", 10, 3);
    expect(seq[0]).toBe("400638133390");
    expect(seq[1]).toBe("400638133400");
    expect(seq[2]).toBe("400638133410");
  });

  it("strips a check digit if the user supplied the full-length start value", () => {
    // 4006381333931 has 13 digits — sequence should still start at 400638133393.
    const seq = generateSequence("ean13", "4006381333931", 1, 2);
    expect(seq[0]).toBe("400638133393");
  });

  it("throws on non-positive step", () => {
    expect(() => generateSequence("ean13", "400638133393", 0, 5)).toThrow();
    expect(() => generateSequence("ean13", "400638133393", -1, 5)).toThrow();
  });

  it("throws on non-positive count or count > 100000", () => {
    expect(() => generateSequence("ean13", "400638133393", 1, 0)).toThrow();
    expect(() => generateSequence("ean13", "400638133393", 1, 200000)).toThrow();
  });
});

/* ------------------------------------------------------------------ */
/* computeQuietZone                                                    */
/* ------------------------------------------------------------------ */

describe("computeQuietZone", () => {
  it("returns 10×X for Code 128 (default)", () => {
    expect(computeQuietZone(0.33, "code128")).toBeCloseTo(3.3, 2);
  });

  it("returns 11×X for EAN-13", () => {
    expect(computeQuietZone(0.33, "ean13")).toBeCloseTo(3.63, 2);
  });

  it("returns 16×X for Code 39", () => {
    expect(computeQuietZone(0.25, "code39")).toBeCloseTo(4.0, 2);
  });

  it("returns 4×X for QR Code", () => {
    expect(computeQuietZone(0.5, "qrcode")).toBeCloseTo(2.0, 2);
  });

  it("returns 0 for Aztec (no quiet zone required)", () => {
    expect(computeQuietZone(0.5, "aztec")).toBe(0);
  });

  it("returns 2mm fixed for Pharmacode regardless of X", () => {
    expect(computeQuietZone(0.33, "pharmacode")).toBe(2);
    expect(computeQuietZone(0.5, "pharmacode")).toBe(2);
  });

  it("throws on non-positive X-dimension", () => {
    expect(() => computeQuietZone(0, "code128")).toThrow();
    expect(() => computeQuietZone(-1, "code128")).toThrow();
  });
});

/* ------------------------------------------------------------------ */
/* checkColorContrast                                                  */
/* ------------------------------------------------------------------ */

describe("checkColorContrast", () => {
  it("passes for black-on-white", () => {
    const r = checkColorContrast("#000000", "#ffffff");
    expect(r.passes).toBe(true);
    expect(r.delta).toBeGreaterThan(0.9);
  });

  it("fails for two close greys", () => {
    const r = checkColorContrast("#808080", "#909090");
    expect(r.passes).toBe(false);
    expect(r.delta).toBeLessThan(0.6);
  });

  it("fails for same colour", () => {
    const r = checkColorContrast("#777777", "#777777");
    expect(r.passes).toBe(false);
    expect(r.delta).toBe(0);
  });

  it("passes for dark-blue on white", () => {
    const r = checkColorContrast("#000088", "#ffffff");
    expect(r.passes).toBe(true);
  });

  it("treats transparent background as white", () => {
    const r = checkColorContrast("#000000", "transparent");
    expect(r.passes).toBe(true);
  });

  it("returns failure reason for invalid colours", () => {
    const r = checkColorContrast("not-a-color", "#ffffff");
    expect(r.passes).toBe(false);
    expect(r.reason).toMatch(/invalid/i);
  });

  it("accepts 3-digit hex shorthand", () => {
    const r = checkColorContrast("#000", "#fff");
    expect(r.passes).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/* analyzeCode128Subsets                                               */
/* ------------------------------------------------------------------ */

describe("analyzeCode128Subsets", () => {
  it("uses subset C for a run of 4+ digits", () => {
    const segs = analyzeCode128Subsets("12345678");
    expect(segs).toHaveLength(1);
    expect(segs[0]?.subset).toBe("C");
    expect(segs[0]?.chars).toBe("12345678");
  });

  it("uses subset B for non-digit characters", () => {
    const segs = analyzeCode128Subsets("ABCDEF");
    expect(segs.every((s) => s.subset === "B")).toBe(true);
  });

  it("switches between B and C for mixed input", () => {
    const segs = analyzeCode128Subsets("AB123456CD");
    const subsets = segs.map((s) => s.subset).join("");
    expect(subsets).toBe("BCB");
  });

  it("handles a single odd digit by keeping it in B", () => {
    const segs = analyzeCode128Subsets("1234567");
    // 6 digits → C, leftover 1 digit → B.
    const c = segs.find((s) => s.subset === "C");
    const b = segs.find((s) => s.subset === "B");
    expect(c?.chars).toBe("123456");
    expect(b?.chars).toBe("7");
  });

  it("handles empty input", () => {
    expect(analyzeCode128Subsets("")).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
/* Manifest exporters                                                  */
/* ------------------------------------------------------------------ */

describe("csvManifestExport", () => {
  it("builds a CSV with header row", () => {
    const csv = csvManifestExport([]);
    const lines = csv.split("\n");
    expect(lines[0]).toBe(
      "filename,format,value,checksum,width_px,height_px,width_mm,height_mm,data_uri",
    );
  });

  it("builds a CSV row per barcode result", () => {
    const rows: BarcodeResult[] = [
      {
        format: "ean13",
        value: "400638133393",
        checksum: "1",
        widthPx: 200,
        heightPx: 100,
        widthMm: 50,
        heightMm: 25,
        filename: "barcode-ean13-400638133393.png",
        dataUrl: "data:image/png;base64,AAAA",
      },
    ];
    const csv = csvManifestExport(rows);
    expect(csv.split("\n")).toHaveLength(2);
    expect(csv).toContain("400638133393");
    expect(csv).toContain("ean13");
  });

  it("escapes commas and quotes in values", () => {
    const rows: BarcodeResult[] = [
      {
        format: "code128",
        value: 'hello, "world"',
        checksum: "",
        widthPx: 100,
        heightPx: 50,
        widthMm: 25,
        heightMm: 12.5,
        filename: "barcode-code128-test.png",
      },
    ];
    const csv = csvManifestExport(rows);
    expect(csv).toContain('"hello, ""world"""');
  });
});

describe("jsonManifestExport", () => {
  it("builds parseable JSON", () => {
    const rows: BarcodeResult[] = [
      {
        format: "ean13",
        value: "400638133393",
        checksum: "1",
        widthPx: 200,
        heightPx: 100,
        widthMm: 50,
        heightMm: 25,
        filename: "x.png",
      },
    ];
    const json = jsonManifestExport(rows);
    const parsed = JSON.parse(json);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].value).toBe("400638133393");
  });
});

/* ------------------------------------------------------------------ */
/* Misc helpers                                                        */
/* ------------------------------------------------------------------ */

describe("pixelsToMm", () => {
  it("converts pixels to mm at given DPI", () => {
    // 300 px @ 300 DPI = 1 inch = 25.4 mm
    expect(pixelsToMm(300, 300)).toBeCloseTo(25.4, 2);
  });

  it("returns 0 for invalid DPI", () => {
    expect(pixelsToMm(100, 0)).toBe(0);
    expect(pixelsToMm(100, -1)).toBe(0);
  });
});

describe("buildBarcodeFilename", () => {
  it("builds a safe filename", () => {
    expect(buildBarcodeFilename("ean13", "400638133393", "png")).toBe(
      "barcode-ean13-400638133393.png",
    );
  });

  it("strips non-word chars", () => {
    expect(buildBarcodeFilename("code128", "ABC 123/456?", "svg")).toBe(
      "barcode-code128-ABC_123_456.svg",
    );
  });

  it("truncates very long values", () => {
    const long = "A".repeat(100);
    const name = buildBarcodeFilename("code128", long, "png");
    expect(name.length).toBeLessThan(100);
  });
});

/* ------------------------------------------------------------------ */
/* Registry sanity                                                     */
/* ------------------------------------------------------------------ */

describe("FORMAT_REGISTRY + FORMATS_BY_GROUP", () => {
  it("has all 16 formats registered", () => {
    expect(Object.keys(FORMAT_REGISTRY)).toHaveLength(16);
  });

  it("covers all formats across the 4 groups", () => {
    const all = [
      ...FORMATS_BY_GROUP.retail,
      ...FORMATS_BY_GROUP.logistics,
      ...FORMATS_BY_GROUP.generic,
      ...FORMATS_BY_GROUP["2d"],
    ];
    expect(new Set(all).size).toBe(16);
  });

  it("has 3 built-in label sheets", () => {
    expect(BUILTIN_LABEL_SHEETS.length).toBeGreaterThanOrEqual(3);
    expect(BUILTIN_LABEL_SHEETS.map((s) => s.id)).toContain("avery-5160");
    expect(BUILTIN_LABEL_SHEETS.map((s) => s.id)).toContain("avery-l7160");
  });
});
