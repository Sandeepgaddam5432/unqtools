import { describe, it, expect, beforeEach } from "vitest";
import {
  DEFAULT_OPTIONS,
  clampDpi, clampQuality, ptsToPixels, getMimeType, getExtension,
  getPdfInfo, sanitizeFileName, expandFilenameTemplate,
  computeStats, packageImagesAsZip, dataUrlToBytes, base64ToBytes,
  formatBytes,
  loadHistory, saveToHistory, clearHistory,
  buildShareUrl, parseShareUrl,
  type ImageOptions, type RenderedImage, type ImageFormat,
} from "./logic";
import { PDFDocument, StandardFonts } from "pdf-lib";

// ===== Helpers =====

async function makeSimplePdf(pageCount = 1, width = 612, height = 792): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < pageCount; i++) {
    const page = doc.addPage([width, height]);
    page.drawText(`Page ${i + 1}`, {
      x: 50, y: 750, size: 12, font,
      color: { type: "RGB", red: 0, green: 0, blue: 0 } as never,
    });
  }
  return await doc.save();
}

function makeFakeImage(pageNumber: number, bytes: number, format: ImageFormat = "png"): RenderedImage {
  return {
    pageNumber,
    format,
    widthPx: 100,
    heightPx: 100,
    bytes,
    dataUrl: `data:image/${format};base64,AAEC`,
    fileName: `page-${pageNumber}.${format === "jpeg" ? "jpg" : format}`,
  };
}

// ===== localStorage mock =====
beforeEach(() => {
  (globalThis as { localStorage?: Storage }).localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {},
    key: () => null,
    length: 0,
  } as Storage;
});

// ===== DPI / quality clamping =====

describe("pdf-to-image-converter clampDpi", () => {
  it("clamps below minimum", () => {
    expect(clampDpi(10)).toBe(72);
  });
  it("clamps above maximum", () => {
    expect(clampDpi(9999)).toBe(600);
  });
  it("returns default for NaN", () => {
    expect(clampDpi(NaN)).toBe(150);
  });
  it("rounds to nearest integer", () => {
    expect(clampDpi(150.7)).toBe(151);
  });
  it("passes through valid DPI", () => {
    expect(clampDpi(300)).toBe(300);
  });
});

describe("pdf-to-image-converter clampQuality", () => {
  it("clamps below minimum", () => {
    expect(clampQuality(0.01)).toBe(0.1);
  });
  it("clamps above maximum", () => {
    expect(clampQuality(2)).toBe(1.0);
  });
  it("rounds to 2 decimal places", () => {
    expect(clampQuality(0.92345)).toBe(0.92);
  });
  it("returns default for NaN", () => {
    expect(clampQuality(NaN)).toBe(0.92);
  });
});

// ===== Pixel conversion =====

describe("pdf-to-image-converter ptsToPixels", () => {
  it("returns 72 px at 72 DPI for 72 pt", () => {
    expect(ptsToPixels(72, 72)).toBe(72);
  });
  it("returns 300 px at 300 DPI for 72 pt", () => {
    expect(ptsToPixels(72, 300)).toBe(300);
  });
  it("scales 1 inch (72 pt) to chosen DPI", () => {
    expect(ptsToPixels(72, 150)).toBe(150);
  });
});

// ===== Format helpers =====

describe("pdf-to-image-converter getMimeType", () => {
  it("returns image/png for png", () => {
    expect(getMimeType("png")).toBe("image/png");
  });
  it("returns image/jpeg for jpeg", () => {
    expect(getMimeType("jpeg")).toBe("image/jpeg");
  });
  it("returns image/webp for webp", () => {
    expect(getMimeType("webp")).toBe("image/webp");
  });
  it("defaults to png for unknown", () => {
    expect(getMimeType("foo" as ImageFormat)).toBe("image/png");
  });
});

describe("pdf-to-image-converter getExtension", () => {
  it("returns 'png' for png", () => {
    expect(getExtension("png")).toBe("png");
  });
  it("returns 'jpg' for jpeg", () => {
    expect(getExtension("jpeg")).toBe("jpg");
  });
  it("returns 'webp' for webp", () => {
    expect(getExtension("webp")).toBe("webp");
  });
});

// ===== PDF info =====

describe("pdf-to-image-converter getPdfInfo", () => {
  it("extracts page count and dimensions", async () => {
    const pdfBytes = await makeSimplePdf(3);
    const info = await getPdfInfo(pdfBytes, DEFAULT_OPTIONS);
    expect(info.ok).toBe(true);
    if (info.ok) {
      expect(info.output.pageCount).toBe(3);
      expect(info.output.pages).toHaveLength(3);
      expect(info.output.pages[0]!.widthPt).toBe(612);
      expect(info.output.pages[0]!.heightPt).toBe(792);
    }
  });
  it("computes pixel dimensions from DPI", async () => {
    const pdfBytes = await makeSimplePdf(1, 612, 792);
    const info = await getPdfInfo(pdfBytes, { ...DEFAULT_OPTIONS, dpi: 150 });
    expect(info.ok).toBe(true);
    if (info.ok) {
      expect(info.output.pages[0]!.widthPx).toBe(1275);
      expect(info.output.pages[0]!.heightPx).toBe(1650);
    }
  });
  it("returns error for invalid PDF", async () => {
    const info = await getPdfInfo(new Uint8Array([1, 2, 3, 4]), DEFAULT_OPTIONS);
    expect(info.ok).toBe(false);
    if (!info.ok) expect(info.error).toContain("Could not load PDF");
  });
  it("respects page range", async () => {
    const pdfBytes = await makeSimplePdf(5);
    const info = await getPdfInfo(pdfBytes, { ...DEFAULT_OPTIONS, pageRange: "1-2" });
    expect(info.ok).toBe(true);
    if (info.ok) {
      expect(info.output.pages).toHaveLength(2);
      expect(info.output.pages[0]!.pageNumber).toBe(1);
    }
  });
  it("returns error for empty page range match", async () => {
    const pdfBytes = await makeSimplePdf(2);
    const info = await getPdfInfo(pdfBytes, { ...DEFAULT_OPTIONS, pageRange: "999" });
    expect(info.ok).toBe(false);
  });
});

// ===== Filename templating =====

describe("pdf-to-image-converter sanitizeFileName", () => {
  it("strips .pdf extension", () => {
    expect(sanitizeFileName("hello.pdf")).toBe("hello");
  });
  it("replaces illegal chars with underscore", () => {
    expect(sanitizeFileName("a<b>c:d")).toBe("a_b_c_d");
  });
  it("replaces whitespace with dash", () => {
    expect(sanitizeFileName("hello world")).toBe("hello-world");
  });
  it("falls back to 'page' for empty", () => {
    expect(sanitizeFileName("")).toBe("page");
  });
});

describe("pdf-to-image-converter expandFilenameTemplate", () => {
  it("expands {name} and {page}", () => {
    const name = expandFilenameTemplate("{name}-{page}", "doc.pdf", 1, "png");
    expect(name).toBe("doc-1.png");
  });
  it("expands {ext}", () => {
    const name = expandFilenameTemplate("page{page}", "doc.pdf", 2, "jpeg");
    expect(name).toBe("page2.jpg");
  });
  it("expands {page0} (zero-indexed)", () => {
    const name = expandFilenameTemplate("slide-{page0}", "doc.pdf", 3, "png");
    expect(name).toBe("slide-2.png");
  });
  it("expands {padded} (zero-padded)", () => {
    const name = expandFilenameTemplate("img-{padded}", "doc.pdf", 5, "png");
    expect(name).toBe("img-005.png");
  });
  it("appends extension if not present", () => {
    const name = expandFilenameTemplate("page", "doc.pdf", 1, "webp");
    expect(name).toBe("page.webp");
  });
  it("does not duplicate extension if already present", () => {
    const name = expandFilenameTemplate("page.{ext}", "doc.pdf", 1, "png");
    expect(name).toBe("page.png");
  });
  it("handles empty template", () => {
    const name = expandFilenameTemplate("", "doc.pdf", 1, "png");
    expect(name).toMatch(/\.png$/);
  });
});

// ===== Stats =====

describe("pdf-to-image-converter computeStats", () => {
  it("returns zero stats for empty input", () => {
    const stats = computeStats([]);
    expect(stats.pageCount).toBe(0);
    expect(stats.totalBytes).toBe(0);
    expect(stats.averageBytes).toBe(0);
  });
  it("computes total and average bytes", () => {
    const images = [makeFakeImage(1, 1000), makeFakeImage(2, 2000), makeFakeImage(3, 3000)];
    const stats = computeStats(images);
    expect(stats.pageCount).toBe(3);
    expect(stats.totalBytes).toBe(6000);
    expect(stats.averageBytes).toBe(2000);
  });
  it("tracks smallest and largest", () => {
    const images = [makeFakeImage(1, 500), makeFakeImage(2, 200), makeFakeImage(3, 800)];
    const stats = computeStats(images);
    expect(stats.smallestBytes).toBe(200);
    expect(stats.largestBytes).toBe(800);
  });
  it("includes zipBytes when provided", () => {
    const images = [makeFakeImage(1, 1000)];
    const stats = computeStats(images, 5000);
    expect(stats.zipBytes).toBe(5000);
  });
});

// ===== ZIP packaging =====

describe("pdf-to-image-converter packageImagesAsZip", () => {
  it("returns null for empty input", () => {
    expect(packageImagesAsZip([])).toBeNull();
  });
  it("returns a Blob with the images", () => {
    const images = [makeFakeImage(1, 100), makeFakeImage(2, 200)];
    const result = packageImagesAsZip(images, "test.zip");
    expect(result).not.toBeNull();
    expect(result!.blob.size).toBeGreaterThan(0);
    expect(result!.fileName).toBe("test.zip");
  });
});

// ===== dataUrl / Base64 helpers =====

describe("pdf-to-image-converter dataUrlToBytes", () => {
  it("returns empty for invalid data URL", () => {
    expect(dataUrlToBytes("not a data url").length).toBe(0);
  });
  it("decodes base64 data URL", () => {
    const bytes = dataUrlToBytes("data:image/png;base64,AAEC");
    expect(bytes.length).toBe(3);
    expect(bytes[0]).toBe(0x00);
    expect(bytes[1]).toBe(0x01);
    expect(bytes[2]).toBe(0x02);
  });
});

describe("pdf-to-image-converter base64ToBytes", () => {
  it("decodes standard base64", () => {
    const bytes = base64ToBytes("aGVsbG8=");
    expect(new TextDecoder().decode(bytes)).toBe("hello");
  });
  it("handles URL-safe base64 (- and _)", () => {
    // `<?>` base64 = "PD8/" — URL-safe replaces + with -, / with _
    const bytes = base64ToBytes("Pz8_");
    expect(new TextDecoder().decode(bytes)).toBe("???");
  });
  it("handles missing padding", () => {
    const bytes = base64ToBytes("aGVsbG8");
    expect(new TextDecoder().decode(bytes)).toBe("hello");
  });
});

// ===== formatBytes =====

describe("pdf-to-image-converter formatBytes", () => {
  it("formats 0 bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
  });
  it("formats KB", () => {
    expect(formatBytes(1024)).toBe("1.0 KB");
  });
});

// ===== History =====

describe("pdf-to-image-converter history", () => {
  it("returns empty list when no history", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads history entries", () => {
    let store: Record<string, string> = {};
    (globalThis as { localStorage?: Storage }).localStorage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
      clear: () => { store = {}; },
      key: () => null,
      length: 0,
    } as Storage;
    saveToHistory({
      fileName: "test.pdf", pdfBytes: 1000, pageCount: 5,
      format: "png", dpi: 150, totalImageBytes: 50000,
      convertedAt: "2026-01-01T00:00:00.000Z",
    });
    const loaded = loadHistory();
    expect(loaded).toHaveLength(1);
    expect(loaded[0]!.fileName).toBe("test.pdf");
  });
  it("clears history", () => {
    let store: Record<string, string> = {};
    (globalThis as { localStorage?: Storage }).localStorage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
      clear: () => { store = {}; },
      key: () => null,
      length: 0,
    } as Storage;
    saveToHistory({
      fileName: "test.pdf", pdfBytes: 1000, pageCount: 5,
      format: "png", dpi: 150, totalImageBytes: 50000,
      convertedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(loadHistory()).toHaveLength(1);
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ===== Shareable URL =====

describe("pdf-to-image-converter share URL", () => {
  it("builds URL with options", () => {
    (globalThis as { window?: unknown }).window = {
      origin: "https://example.com",
      location: { pathname: "/tools/pdf-to-image-converter" },
    };
    const url = buildShareUrl({ ...DEFAULT_OPTIONS, pageRange: "1-3", format: "webp", dpi: 300 });
    expect(url).toContain("pages=1-3");
    expect(url).toContain("format=webp");
    expect(url).toContain("dpi=300");
  });
  it("parses share URL", () => {
    const parsed = parseShareUrl("#pages=1-3&format=jpeg&quality=0.8&dpi=300");
    expect(parsed?.pageRange).toBe("1-3");
    expect(parsed?.format).toBe("jpeg");
    expect(parsed?.quality).toBe(0.8);
    expect(parsed?.dpi).toBe(300);
  });
  it("returns null for empty hash", () => {
    expect(parseShareUrl("")).toBeNull();
  });
  it("returns null when no recognized params", () => {
    expect(parseShareUrl("#foo=bar")).toBeNull();
  });
  it("falls back to png for invalid format", () => {
    const parsed = parseShareUrl("#format=invalid");
    expect(parsed?.format).toBe("png");
  });
});
