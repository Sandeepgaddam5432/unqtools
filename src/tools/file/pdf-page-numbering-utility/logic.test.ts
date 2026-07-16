import { describe, it, expect, beforeEach } from "vitest";
import {
  DEFAULT_OPTIONS,
  toRomanUpper,
  toRomanLower,
  toAlphaLower,
  toAlphaUpper,
  formatLabel,
  computePosition,
  parseHexColor,
  isValidHexColor,
  addPageNumbers,
  formatBytes,
  loadHistory,
  saveToHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type NumberFormat,
  type NumberPosition,
  type PageNumberOptions,
} from "./logic";
import { PDFDocument, StandardFonts } from "pdf-lib";

// ===== Helpers =====

async function makeTestPdf(pageCount: number = 3): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < pageCount; i++) {
    const page = doc.addPage([612, 792]); // US Letter
    page.drawText(`Page ${i + 1}`, { x: 50, y: 700, size: 24, font });
  }
  return doc.save();
}

// ===== localStorage mock =====

let store: Record<string, string> = {};
beforeEach(() => {
  store = {};
  (globalThis as { localStorage?: Storage }).localStorage = {
    getItem: (k: string) => (k in store ? store[k]! : null),
    setItem: (k: string, v: string) => {
      store[k] = v;
    },
    removeItem: (k: string) => {
      delete store[k];
    },
    clear: () => {
      store = {};
    },
    key: (i: number) => Object.keys(store)[i] ?? null,
    length: Object.keys(store).length,
  } as Storage;
});

// ===== Roman numerals =====

describe("pdf-page-numbering-utility toRomanUpper", () => {
  it("converts 1 to 'I'", () => {
    expect(toRomanUpper(1)).toBe("I");
  });
  it("converts 4 to 'IV'", () => {
    expect(toRomanUpper(4)).toBe("IV");
  });
  it("converts 9 to 'IX'", () => {
    expect(toRomanUpper(9)).toBe("IX");
  });
  it("converts 49 to 'XLIX'", () => {
    expect(toRomanUpper(49)).toBe("XLIX");
  });
  it("converts 2024 to 'MMXXIV'", () => {
    expect(toRomanUpper(2024)).toBe("MMXXIV");
  });
  it("converts 3999 to 'MMMCMXCIX'", () => {
    expect(toRomanUpper(3999)).toBe("MMMCMXCIX");
  });
  it("returns plain number for out-of-range (0)", () => {
    expect(toRomanUpper(0)).toBe("0");
  });
  it("returns plain number for out-of-range (4000)", () => {
    expect(toRomanUpper(4000)).toBe("4000");
  });
});

describe("pdf-page-numbering-utility toRomanLower", () => {
  it("converts 1 to 'i'", () => {
    expect(toRomanLower(1)).toBe("i");
  });
  it("converts 4 to 'iv'", () => {
    expect(toRomanLower(4)).toBe("iv");
  });
  it("converts 9 to 'ix'", () => {
    expect(toRomanLower(9)).toBe("ix");
  });
  it("converts 49 to 'xlix'", () => {
    expect(toRomanLower(49)).toBe("xlix");
  });
});

// ===== Alpha numerals =====

describe("pdf-page-numbering-utility toAlphaLower", () => {
  it("converts 1 to 'a'", () => {
    expect(toAlphaLower(1)).toBe("a");
  });
  it("converts 26 to 'z'", () => {
    expect(toAlphaLower(26)).toBe("z");
  });
  it("converts 27 to 'aa'", () => {
    expect(toAlphaLower(27)).toBe("aa");
  });
  it("converts 28 to 'ab'", () => {
    expect(toAlphaLower(28)).toBe("ab");
  });
  it("converts 52 to 'az'", () => {
    expect(toAlphaLower(52)).toBe("az");
  });
  it("converts 53 to 'ba'", () => {
    expect(toAlphaLower(53)).toBe("ba");
  });
});

describe("pdf-page-numbering-utility toAlphaUpper", () => {
  it("converts 1 to 'A'", () => {
    expect(toAlphaUpper(1)).toBe("A");
  });
  it("converts 26 to 'Z'", () => {
    expect(toAlphaUpper(26)).toBe("Z");
  });
  it("converts 27 to 'AA'", () => {
    expect(toAlphaUpper(27)).toBe("AA");
  });
});

// ===== formatLabel =====

describe("pdf-page-numbering-utility formatLabel", () => {
  it("formats arabic", () => {
    expect(formatLabel("arabic", 5, 10)).toBe("5");
  });
  it("formats roman-lower", () => {
    expect(formatLabel("roman-lower", 5, 10)).toBe("v");
  });
  it("formats roman-upper", () => {
    expect(formatLabel("roman-upper", 5, 10)).toBe("V");
  });
  it("formats alpha-lower", () => {
    expect(formatLabel("alpha-lower", 2, 10)).toBe("b");
  });
  it("formats alpha-upper", () => {
    expect(formatLabel("alpha-upper", 2, 10)).toBe("B");
  });
  it("formats custom with {page} and {total}", () => {
    expect(formatLabel("custom", 3, 10, "Page {page} of {total}")).toBe("Page 3 of 10");
  });
  it("formats custom with just {page}", () => {
    expect(formatLabel("custom", 5, 10, "- {page} -")).toBe("- 5 -");
  });
  it("formats custom with {page}/{total}", () => {
    expect(formatLabel("custom", 7, 10, "{page}/{total}")).toBe("7/10");
  });
  it("falls back to plain string for unknown format", () => {
    expect(formatLabel("unknown" as NumberFormat, 5, 10)).toBe("5");
  });
});

// ===== computePosition =====

describe("pdf-page-numbering-utility computePosition", () => {
  const pageW = 612;
  const pageH = 792;
  const fontSize = 12;
  const textWidth = 30;
  const margin = 24;

  it("places top-left correctly", () => {
    const { x, y } = computePosition("top-left", pageW, pageH, textWidth, fontSize, margin);
    expect(x).toBe(margin);
    expect(y).toBe(pageH - margin - fontSize);
  });
  it("places top-center correctly", () => {
    const { x, y } = computePosition("top-center", pageW, pageH, textWidth, fontSize, margin);
    expect(x).toBe((pageW - textWidth) / 2);
    expect(y).toBe(pageH - margin - fontSize);
  });
  it("places top-right correctly", () => {
    const { x, y } = computePosition("top-right", pageW, pageH, textWidth, fontSize, margin);
    expect(x).toBe(pageW - margin - textWidth);
    expect(y).toBe(pageH - margin - fontSize);
  });
  it("places middle-left correctly", () => {
    const { x, y } = computePosition("middle-left", pageW, pageH, textWidth, fontSize, margin);
    expect(x).toBe(margin);
    expect(y).toBe((pageH - fontSize) / 2);
  });
  it("places middle-center correctly", () => {
    const { x, y } = computePosition("middle-center", pageW, pageH, textWidth, fontSize, margin);
    expect(x).toBe((pageW - textWidth) / 2);
    expect(y).toBe((pageH - fontSize) / 2);
  });
  it("places middle-right correctly", () => {
    const { x, y } = computePosition("middle-right", pageW, pageH, textWidth, fontSize, margin);
    expect(x).toBe(pageW - margin - textWidth);
    expect(y).toBe((pageH - fontSize) / 2);
  });
  it("places bottom-left correctly", () => {
    const { x, y } = computePosition("bottom-left", pageW, pageH, textWidth, fontSize, margin);
    expect(x).toBe(margin);
    expect(y).toBe(margin);
  });
  it("places bottom-center correctly", () => {
    const { x, y } = computePosition("bottom-center", pageW, pageH, textWidth, fontSize, margin);
    expect(x).toBe((pageW - textWidth) / 2);
    expect(y).toBe(margin);
  });
  it("places bottom-right correctly", () => {
    const { x, y } = computePosition("bottom-right", pageW, pageH, textWidth, fontSize, margin);
    expect(x).toBe(pageW - margin - textWidth);
    expect(y).toBe(margin);
  });
});

// ===== parseHexColor / isValidHexColor =====

describe("pdf-page-numbering-utility parseHexColor", () => {
  it("parses #000000 to (0,0,0)", () => {
    const c = parseHexColor("#000000");
    expect(c.r).toBe(0);
    expect(c.g).toBe(0);
    expect(c.b).toBe(0);
  });
  it("parses #FFFFFF to (1,1,1)", () => {
    const c = parseHexColor("#FFFFFF");
    expect(c.r).toBe(1);
    expect(c.g).toBe(1);
    expect(c.b).toBe(1);
  });
  it("parses #FF0000 to (1,0,0)", () => {
    const c = parseHexColor("#FF0000");
    expect(c.r).toBe(1);
    expect(c.g).toBe(0);
    expect(c.b).toBe(0);
  });
  it("parses short form #F00 to (1,0,0)", () => {
    const c = parseHexColor("#F00");
    expect(c.r).toBe(1);
    expect(c.g).toBe(0);
    expect(c.b).toBe(0);
  });
  it("parses #00FF00 to (0,1,0)", () => {
    const c = parseHexColor("#00FF00");
    expect(c.g).toBe(1);
  });
  it("parses lowercase #ff8800 to (1, 0.533, 0)", () => {
    const c = parseHexColor("#ff8800");
    expect(c.r).toBe(1);
    expect(Math.abs(c.g - 136 / 255)).toBeLessThan(0.001);
  });
  it("returns (0,0,0) for invalid input", () => {
    const c = parseHexColor("not-a-color");
    expect(c.r).toBe(0);
    expect(c.g).toBe(0);
    expect(c.b).toBe(0);
  });
});

describe("pdf-page-numbering-utility isValidHexColor", () => {
  it("returns true for #000", () => {
    expect(isValidHexColor("#000")).toBe(true);
  });
  it("returns true for #FF0000", () => {
    expect(isValidHexColor("#FF0000")).toBe(true);
  });
  it("returns true for short lowercase", () => {
    expect(isValidHexColor("abc")).toBe(true);
  });
  it("returns false for invalid input", () => {
    expect(isValidHexColor("not-a-color")).toBe(false);
  });
  it("returns false for 4-char input", () => {
    expect(isValidHexColor("#0000")).toBe(false);
  });
});

// ===== addPageNumbers =====

describe("pdf-page-numbering-utility addPageNumbers", () => {
  it("adds page numbers to a small PDF", async () => {
    const input = await makeTestPdf(3);
    const result = await addPageNumbers(input, DEFAULT_OPTIONS, "out.pdf");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.pageCount).toBe(3);
      expect(result.output.numberedCount).toBe(3);
      expect(result.output.skippedCount).toBe(0);
      expect(result.output.blob.size).toBeGreaterThan(0);
    }
  });
  it("respects skipPages", async () => {
    const input = await makeTestPdf(5);
    const result = await addPageNumbers(input, { ...DEFAULT_OPTIONS, skipPages: 2 }, "out.pdf");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.pageCount).toBe(5);
      expect(result.output.numberedCount).toBe(3);
      expect(result.output.skippedCount).toBe(2);
    }
  });
  it("respects startNumber (does not affect count, only label text)", async () => {
    const input = await makeTestPdf(3);
    const result = await addPageNumbers(input, { ...DEFAULT_OPTIONS, startNumber: 5 }, "out.pdf");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.numberedCount).toBe(3);
    }
  });
  it("fails on corrupted PDF", async () => {
    const result = await addPageNumbers(new Uint8Array([0, 1, 2, 3]));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/Could not read/i);
    }
  });
  it("handles roman format", async () => {
    const input = await makeTestPdf(2);
    const result = await addPageNumbers(
      input,
      { ...DEFAULT_OPTIONS, format: "roman-lower" },
      "out.pdf",
    );
    expect(result.ok).toBe(true);
  });
  it("handles custom format", async () => {
    const input = await makeTestPdf(3);
    const result = await addPageNumbers(
      input,
      { ...DEFAULT_OPTIONS, format: "custom", customFormat: "Page {page} of {total}" },
      "out.pdf",
    );
    expect(result.ok).toBe(true);
  });
});

// ===== formatBytes =====

describe("pdf-page-numbering-utility formatBytes", () => {
  it("formats 0 as '0 B'", () => {
    expect(formatBytes(0)).toBe("0 B");
  });
  it("formats 1024 as '1.0 KB'", () => {
    expect(formatBytes(1024)).toBe("1.0 KB");
  });
  it("formats 500 as '500 B'", () => {
    expect(formatBytes(500)).toBe("500 B");
  });
});

// ===== History =====

describe("pdf-page-numbering-utility history", () => {
  it("returns empty array when no history", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads entries", () => {
    const entry = {
      fileName: "test.pdf",
      pageCount: 5,
      numberedCount: 5,
      format: "arabic",
      position: "bottom-center",
      pdfBytes: 1000,
      convertedAt: "2026-01-01T00:00:00.000Z",
    };
    const updated = saveToHistory(entry);
    expect(updated.length).toBe(1);
    expect(loadHistory().length).toBe(1);
    expect(loadHistory()[0]!.fileName).toBe("test.pdf");
  });
  it("limits to 10 entries", () => {
    for (let i = 0; i < 15; i++) {
      saveToHistory({
        fileName: `f${i}.pdf`,
        pageCount: 1,
        numberedCount: 1,
        format: "arabic",
        position: "bottom-center",
        pdfBytes: i,
        convertedAt: new Date().toISOString(),
      });
    }
    expect(loadHistory().length).toBe(10);
  });
  it("clears history", () => {
    saveToHistory({
      fileName: "x.pdf",
      pageCount: 1,
      numberedCount: 1,
      format: "arabic",
      position: "bottom-center",
      pdfBytes: 1,
      convertedAt: new Date().toISOString(),
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ===== Shareable URL =====

describe("pdf-page-numbering-utility shareUrl", () => {
  it("builds a URL with all options", () => {
    (globalThis as { window?: unknown }).window = {
      location: { origin: "https://unqtools.app", pathname: "/tools/pdf-page-numbering-utility" },
    };
    const opts: PageNumberOptions = {
      ...DEFAULT_OPTIONS,
      position: "top-right",
      format: "custom",
      customFormat: "Page {page} of {total}",
      startNumber: 5,
      skipPages: 1,
      fontSize: 18,
      color: "#FF0000",
      margin: 30,
    };
    const url = buildShareUrl(opts);
    expect(url).toContain("pos=top-right");
    expect(url).toContain("fmt=custom");
    expect(url).toContain("custom=Page");
    expect(url).toContain("start=5");
    expect(url).toContain("skip=1");
    expect(url).toContain("fs=18");
    expect(url).toContain("color=%23FF0000");
    expect(url).toContain("margin=30");
    delete (globalThis as { window?: unknown }).window;
  });
  it("parses a share URL back to options", () => {
    const hash = "#pos=top-right&fmt=roman-upper&start=5&skip=2&fs=18&color=%23FF0000&margin=30";
    const opts = parseShareUrl(hash);
    expect(opts).not.toBeNull();
    expect(opts!.position).toBe("top-right");
    expect(opts!.format).toBe("roman-upper");
    expect(opts!.startNumber).toBe(5);
    expect(opts!.skipPages).toBe(2);
    expect(opts!.fontSize).toBe(18);
    expect(opts!.color).toBe("#FF0000");
    expect(opts!.margin).toBe(30);
  });
  it("returns null for empty hash", () => {
    expect(parseShareUrl("")).toBeNull();
    expect(parseShareUrl("no-hash")).toBeNull();
  });
  it("clamps fontSize to valid range", () => {
    const opts = parseShareUrl("#fmt=arabic&fs=999");
    expect(opts!.fontSize).toBe(72);
  });
  it("defaults to arabic/bottom-center for unknown values", () => {
    const opts = parseShareUrl("#pos=invalid&fmt=invalid");
    expect(opts!.position).toBe("bottom-center");
    expect(opts!.format).toBe("arabic");
  });
});

// ===== DEFAULT_OPTIONS sanity =====

describe("pdf-page-numbering-utility DEFAULT_OPTIONS", () => {
  it("has sensible defaults", () => {
    expect(DEFAULT_OPTIONS.position).toBe("bottom-center");
    expect(DEFAULT_OPTIONS.format).toBe("arabic");
    expect(DEFAULT_OPTIONS.startNumber).toBe(1);
    expect(DEFAULT_OPTIONS.skipPages).toBe(0);
    expect(DEFAULT_OPTIONS.fontSize).toBe(12);
    expect(DEFAULT_OPTIONS.color).toBe("#000000");
    expect(DEFAULT_OPTIONS.margin).toBe(24);
  });
});
