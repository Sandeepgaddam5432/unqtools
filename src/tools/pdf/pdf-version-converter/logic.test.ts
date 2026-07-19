import { describe, it, expect, beforeEach } from "vitest";
import {
  TARGET_VERSIONS,
  VERSION_LABELS,
  HEADER_VERSIONS,
  VERSION_FAMILY,
  DEFAULT_OPTIONS,
  EMPTY_CONTENT,
  detectPdfVersion,
  classifyDetectedVersion,
  buildHeader,
  patchPdfHeader,
  checkPdfA1bRequirements,
  checkPdfA2bRequirements,
  checkPdfA3bRequirements,
  checkPdfX1aRequirements,
  checkRequirements,
  checkFeatureCompatibility,
  versionAtLeast,
  planRemovals,
  generateXmpMetadata,
  buildSrgbProfile,
  buildOutputIntent,
  rgbToCmyk,
  verifyFontEmbedding,
  checkCompliance,
  buildFeatureLossReport,
  buildConversionReport,
  renderTextReport,
  renderCsvReport,
  renderJsonReport,
  formatBytes,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  validateOptions,
  type TargetVersion,
  type ConverterOptions,
  type PdfContent,
  type HistoryEntry,
} from "./logic";

beforeEach(() => {
  const store: Record<string, string> = {};
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; },
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() { return Object.keys(store).length; },
  };
});

function asciiBytes(s: string): Uint8Array {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
  return out;
}

describe("pdf-version-converter constants", () => {
  it("has 9 target versions", () => {
    expect(TARGET_VERSIONS).toHaveLength(9);
  });
  it("labels all 9 versions", () => {
    for (const v of TARGET_VERSIONS) {
      expect(VERSION_LABELS[v]).toBeTruthy();
    }
  });
  it("has header version for every target", () => {
    for (const v of TARGET_VERSIONS) {
      expect(HEADER_VERSIONS[v]).toBeTruthy();
    }
  });
  it("PDF/A-1b is based on PDF 1.4", () => {
    expect(HEADER_VERSIONS["pdf-a-1b"]).toBe("1.4");
  });
  it("PDF/A-2b and A-3b are based on PDF 1.7", () => {
    expect(HEADER_VERSIONS["pdf-a-2b"]).toBe("1.7");
    expect(HEADER_VERSIONS["pdf-a-3b"]).toBe("1.7");
  });
  it("PDF/X-1a is based on PDF 1.3", () => {
    expect(HEADER_VERSIONS["pdf-x-1a"]).toBe("1.3");
  });
  it("classifies all standard versions as standard family", () => {
    expect(VERSION_FAMILY["pdf-1.4"]).toBe("standard");
    expect(VERSION_FAMILY["pdf-2.0"]).toBe("standard");
    expect(VERSION_FAMILY["pdf-a-1b"]).toBe("pdf-a");
    expect(VERSION_FAMILY["pdf-x-1a"]).toBe("pdf-x");
  });
  it("default target is pdf-1.7", () => {
    expect(DEFAULT_OPTIONS.targetVersion).toBe("pdf-1.7");
    expect(DEFAULT_OPTIONS.preserveMetadata).toBe(true);
    expect(DEFAULT_OPTIONS.embedFonts).toBe(true);
  });
});

describe("pdf-version-converter detectPdfVersion", () => {
  it("detects %PDF-1.7 header", () => {
    const bytes = asciiBytes("%PDF-1.7\n\x00\x00\x00\x00");
    const r = detectPdfVersion(bytes);
    expect(r.ok).toBe(true);
    expect(r.raw).toBe("1.7");
    expect(r.major).toBe(1);
    expect(r.minor).toBe(7);
  });
  it("detects %PDF-2.0 header", () => {
    const bytes = asciiBytes("%PDF-2.0\n");
    const r = detectPdfVersion(bytes);
    expect(r.ok).toBe(true);
    expect(r.raw).toBe("2.0");
  });
  it("rejects too-small files", () => {
    const r = detectPdfVersion(new Uint8Array(3));
    expect(r.ok).toBe(false);
  });
  it("rejects non-PDF bytes", () => {
    const r = detectPdfVersion(asciiBytes("NOTAPDF1234567"));
    expect(r.ok).toBe(false);
  });
  it("handles leading garbage with wider search", () => {
    const bytes = asciiBytes("XXXXXXX%PDF-1.6 rest of file");
    const r = detectPdfVersion(bytes);
    expect(r.ok).toBe(true);
    expect(r.raw).toBe("1.6");
  });
});

describe("pdf-version-converter classifyDetectedVersion", () => {
  it("returns the target label for known versions", () => {
    expect(classifyDetectedVersion({ raw: "1.4", major: 1, minor: 4, ok: true })).toBe("pdf-1.4");
    expect(classifyDetectedVersion({ raw: "2.0", major: 2, minor: 0, ok: true })).toBe("pdf-2.0");
  });
  it("returns null for unknown versions", () => {
    expect(classifyDetectedVersion({ raw: "9.9", major: 9, minor: 9, ok: true })).toBeNull();
  });
  it("returns null for failed detection", () => {
    expect(classifyDetectedVersion({ raw: "", major: 0, minor: 0, ok: false })).toBeNull();
  });
});

describe("pdf-version-converter buildHeader / patchPdfHeader", () => {
  it("builds %PDF-X.Y header", () => {
    const h = buildHeader("pdf-1.7");
    expect(Array.from(h)).toEqual(Array.from(asciiBytes("%PDF-1.7\n")));
  });
  it("uses PDF/A-1b's underlying 1.4 header", () => {
    const h = buildHeader("pdf-a-1b");
    expect(Array.from(h)).toEqual(Array.from(asciiBytes("%PDF-1.4\n")));
  });
  it("patches the header in place", () => {
    const original = asciiBytes("%PDF-1.4\nbinary content here");
    const patched = patchPdfHeader(original, "pdf-2.0");
    expect(Array.from(patched.subarray(0, 9))).toEqual(Array.from(asciiBytes("%PDF-2.0\n")));
    // rest of file preserved
    expect(Array.from(patched.subarray(9))).toEqual(Array.from(original.subarray(9)));
  });
});

describe("pdf-version-converter versionAtLeast", () => {
  it("compares correctly", () => {
    expect(versionAtLeast("1.7", "1.4")).toBe(true);
    expect(versionAtLeast("1.4", "1.7")).toBe(false);
    expect(versionAtLeast("2.0", "1.7")).toBe(true);
    expect(versionAtLeast("1.7", "1.7")).toBe(true);
  });
});

describe("pdf-version-converter requirements checkers", () => {
  it("PDF/A-1b has 7 requirements", () => {
    const reqs = checkPdfA1bRequirements(EMPTY_CONTENT);
    expect(reqs).toHaveLength(7);
    expect(reqs.some((r) => r.id === "no-encryption")).toBe(true);
    expect(reqs.some((r) => r.id === "fonts-embedded")).toBe(true);
    expect(reqs.some((r) => r.id === "xmp-metadata")).toBe(true);
  });
  it("PDF/A-2b removes embedded-files restriction", () => {
    const reqs = checkPdfA2bRequirements(EMPTY_CONTENT);
    expect(reqs.some((r) => r.id === "no-embedded-files-a1")).toBe(false);
  });
  it("PDF/A-3b removes embedded-files restriction", () => {
    const reqs = checkPdfA3bRequirements(EMPTY_CONTENT);
    expect(reqs.some((r) => r.id === "no-embedded-files-a1")).toBe(false);
  });
  it("PDF/X-1a has 7 requirements", () => {
    const reqs = checkPdfX1aRequirements(EMPTY_CONTENT);
    expect(reqs).toHaveLength(7);
    expect(reqs.some((r) => r.id === "output-intent")).toBe(true);
    expect(reqs.some((r) => r.id === "trim-box")).toBe(true);
    expect(reqs.some((r) => r.id === "bleed-box")).toBe(true);
    expect(reqs.some((r) => r.id === "no-rgb")).toBe(true);
  });
  it("checkRequirements dispatches correctly", () => {
    expect(checkRequirements("pdf-a-1b", EMPTY_CONTENT)).toHaveLength(7);
    expect(checkRequirements("pdf-x-1a", EMPTY_CONTENT)).toHaveLength(7);
    expect(checkRequirements("pdf-1.7", EMPTY_CONTENT)).toHaveLength(0);
  });
  it("flags missing fonts", () => {
    const content: PdfContent = { ...EMPTY_CONTENT, fontsAllEmbedded: false };
    const reqs = checkPdfA1bRequirements(content);
    const fontReq = reqs.find((r) => r.id === "fonts-embedded")!;
    expect(fontReq.met).toBe(false);
    expect(fontReq.remediation).toContain("Embed");
  });
});

describe("pdf-version-converter feature compatibility", () => {
  it("checks encryption compatibility", () => {
    const detected = { raw: "1.7", major: 1, minor: 7, ok: true };
    const content: PdfContent = { ...EMPTY_CONTENT, hasEncryption: true };
    const compat = checkFeatureCompatibility(detected, "pdf-1.4", content);
    expect(compat.some((c) => c.feature === "Encryption")).toBe(true);
  });
  it("flags object streams when downgrading to 1.4", () => {
    const detected = { raw: "1.7", major: 1, minor: 7, ok: true };
    const compat = checkFeatureCompatibility(detected, "pdf-1.4", EMPTY_CONTENT);
    const objStream = compat.find((c) => c.feature === "Object streams");
    expect(objStream?.supportedInTarget).toBe(false);
  });
  it("disallows JavaScript in PDF/A", () => {
    const detected = { raw: "1.7", major: 1, minor: 7, ok: true };
    const compat = checkFeatureCompatibility(detected, "pdf-a-1b", EMPTY_CONTENT);
    const js = compat.find((c) => c.feature === "JavaScript");
    expect(js?.supportedInTarget).toBe(false);
  });
  it("allows embedded files in PDF/A-3", () => {
    const detected = { raw: "1.7", major: 1, minor: 7, ok: true };
    const compat = checkFeatureCompatibility(detected, "pdf-a-3b", EMPTY_CONTENT);
    const embed = compat.find((c) => c.feature === "Embedded files (attachments)");
    expect(embed?.supportedInTarget).toBe(true);
  });
});

describe("pdf-version-converter planRemovals", () => {
  it("plans removal of encryption for PDF/A", () => {
    const content: PdfContent = { ...EMPTY_CONTENT, hasEncryption: true };
    const removals = planRemovals("pdf-a-1b", content);
    expect(removals.some((r) => r.feature === "Encryption" && r.action === "remove")).toBe(true);
  });
  it("plans conversion of RGB for PDF/X-1a", () => {
    const content: PdfContent = { ...EMPTY_CONTENT, hasRgbColors: true };
    const removals = planRemovals("pdf-x-1a", content);
    const rgb = removals.find((r) => r.feature === "RGB colors");
    expect(rgb?.action).toBe("convert");
  });
  it("plans removal of JavaScript for PDF/A", () => {
    const content: PdfContent = { ...EMPTY_CONTENT, hasJavaScript: true };
    const removals = planRemovals("pdf-a-2b", content);
    expect(removals.some((r) => r.feature === "JavaScript" && r.action === "remove")).toBe(true);
  });
  it("returns no removals for standard PDF target with clean content", () => {
    expect(planRemovals("pdf-1.7", EMPTY_CONTENT)).toHaveLength(0);
  });
  it("plans removal of embedded files only for PDF/A-1b", () => {
    const content: PdfContent = { ...EMPTY_CONTENT, hasEmbeddedFiles: true };
    expect(planRemovals("pdf-a-1b", content).some((r) => r.feature === "Embedded files")).toBe(true);
    expect(planRemovals("pdf-a-3b", content).some((r) => r.feature === "Embedded files")).toBe(false);
  });
});

describe("pdf-version-converter XMP metadata", () => {
  it("generates XMP with pdfaid:part for A-1b", () => {
    const xmp = generateXmpMetadata({
      title: "Test", author: "Auth", subject: "Sub",
      keywords: ["a", "b"], creator: "Cr", producer: "Pr",
      target: "pdf-a-1b",
    });
    expect(xmp).toContain("<?xpacket");
    expect(xmp).toContain("<pdfaid:part>1</pdfaid:part>");
    expect(xmp).toContain("<pdfaid:conformance>B</pdfaid:conformance>");
    expect(xmp).toContain("Test");
  });
  it("uses part 3 for PDF/A-3b", () => {
    const xmp = generateXmpMetadata({
      title: "T", author: "", subject: "",
      keywords: [], creator: "", producer: "",
      target: "pdf-a-3b",
    });
    expect(xmp).toContain("<pdfaid:part>3</pdfaid:part>");
  });
  it("escapes XML special chars", () => {
    const xmp = generateXmpMetadata({
      title: "<script>alert('x')</script>", author: "", subject: "",
      keywords: [], creator: "", producer: "",
      target: "pdf-a-1b",
    });
    expect(xmp).toContain("&lt;script&gt;");
    expect(xmp).not.toContain("<script>alert");
  });
});

describe("pdf-version-converter color profile + output intent", () => {
  it("builds an sRGB profile spec", () => {
    const p = buildSrgbProfile();
    expect(p.name).toContain("sRGB");
    expect(p.nComponents).toBe(3);
    expect(p.alternateSpace).toBe("DeviceRGB");
  });
  it("builds an output intent for PDF/X", () => {
    const oi = buildOutputIntent();
    expect(oi.outputConditionIdentifier).toBe("FOGRA39");
    expect(oi.profileName).toContain("FOGRA39");
  });
});

describe("pdf-version-converter rgbToCmyk", () => {
  it("converts black correctly", () => {
    const c = rgbToCmyk({ r: 0, g: 0, b: 0 });
    expect(c.c).toBe(0);
    expect(c.m).toBe(0);
    expect(c.y).toBe(0);
    expect(c.k).toBe(1);
  });
  it("converts white correctly", () => {
    const c = rgbToCmyk({ r: 255, g: 255, b: 255 });
    expect(c.k).toBe(0);
  });
  it("converts pure red correctly", () => {
    const c = rgbToCmyk({ r: 255, g: 0, b: 0 });
    expect(c.c).toBe(0);
    expect(c.m).toBeGreaterThan(0.99);
    expect(c.y).toBeGreaterThan(0.99);
  });
  it("produces values in 0-1 range", () => {
    const c = rgbToCmyk({ r: 128, g: 64, b: 200 });
    expect(c.c).toBeGreaterThanOrEqual(0);
    expect(c.c).toBeLessThanOrEqual(1);
    expect(c.m).toBeGreaterThanOrEqual(0);
    expect(c.m).toBeLessThanOrEqual(1);
    expect(c.y).toBeGreaterThanOrEqual(0);
    expect(c.y).toBeLessThanOrEqual(1);
    expect(c.k).toBeGreaterThanOrEqual(0);
    expect(c.k).toBeLessThanOrEqual(1);
  });
});

describe("pdf-version-converter verifyFontEmbedding", () => {
  it("returns allEmbedded=true when all fonts embedded", () => {
    const s = verifyFontEmbedding(5, 5);
    expect(s.allEmbedded).toBe(true);
    expect(s.missingFonts).toEqual([]);
  });
  it("returns allEmbedded=false when fonts missing", () => {
    const s = verifyFontEmbedding(5, 3, ["FontA", "FontB"]);
    expect(s.allEmbedded).toBe(false);
    expect(s.missingFonts).toEqual(["FontA", "FontB"]);
  });
});

describe("pdf-version-converter checkCompliance", () => {
  it("returns compliant when all required met", () => {
    const r = checkCompliance("pdf-a-1b", EMPTY_CONTENT);
    expect(r.compliant).toBe(true);
    expect(r.failedRequirements).toHaveLength(0);
  });
  it("returns non-compliant when requirements fail", () => {
    const content: PdfContent = {
      ...EMPTY_CONTENT,
      hasEncryption: true,
      hasJavaScript: true,
      fontsAllEmbedded: false,
    };
    const r = checkCompliance("pdf-a-1b", content);
    expect(r.compliant).toBe(false);
    expect(r.failedRequirements).toContain("no-encryption");
    expect(r.failedRequirements).toContain("no-javascript");
    expect(r.failedRequirements).toContain("fonts-embedded");
  });
  it("returns compliant for standard PDF target", () => {
    const r = checkCompliance("pdf-1.7", EMPTY_CONTENT);
    expect(r.compliant).toBe(true);
  });
});

describe("pdf-version-converter buildFeatureLossReport", () => {
  it("separates removals, conversions, and kept features", () => {
    const content: PdfContent = {
      ...EMPTY_CONTENT,
      hasEncryption: true,
      hasRgbColors: true,
    };
    const r = buildFeatureLossReport("pdf-x-1a", content);
    expect(r.removed.some((f) => f.feature === "Encryption")).toBe(true);
    expect(r.converted.some((f) => f.feature === "RGB colors")).toBe(true);
  });
});

describe("pdf-version-converter buildConversionReport", () => {
  it("builds a full report", () => {
    const opts: ConverterOptions = {
      targetVersion: "pdf-a-1b",
      preserveMetadata: true, embedFonts: true, removeUnsupportedFeatures: true,
    };
    const content: PdfContent = { ...EMPTY_CONTENT };
    const r = buildConversionReport("1.7", 100_000, 95_000, content, opts);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.output.sourceVersion).toBe("1.7");
    expect(r.output.targetVersion).toBe("pdf-a-1b");
    expect(r.output.summary.family).toBe("pdf-a");
    expect(r.output.summary.compliant).toBe(true);
    expect(r.output.requirements.length).toBeGreaterThan(0);
    expect(r.output.qualityImpacts.length).toBeGreaterThan(0);
  });
  it("rejects invalid target", () => {
    const opts = { ...DEFAULT_OPTIONS, targetVersion: "invalid" as TargetVersion };
    const r = buildConversionReport("1.7", 100, 100, EMPTY_CONTENT, opts);
    expect(r.ok).toBe(false);
  });
  it("includes quality impact notes for lossy changes", () => {
    const opts: ConverterOptions = {
      targetVersion: "pdf-x-1a",
      preserveMetadata: true, embedFonts: true, removeUnsupportedFeatures: true,
    };
    const content: PdfContent = {
      ...EMPTY_CONTENT, hasRgbColors: true, hasEncryption: true,
      hasJavaScript: true, hasEmbeddedFiles: true,
    };
    const r = buildConversionReport("1.7", 100, 100, content, opts);
    if (!r.ok) return;
    const qi = r.output.qualityImpacts;
    expect(qi.some((s) => s.includes("Encryption removed"))).toBe(true);
    expect(qi.some((s) => s.includes("RGB colors converted"))).toBe(true);
    expect(qi.some((s) => s.includes("JavaScript"))).toBe(true);
  });
});

describe("pdf-version-converter renderers", () => {
  const opts: ConverterOptions = {
    targetVersion: "pdf-a-1b",
    preserveMetadata: true, embedFonts: true, removeUnsupportedFeatures: true,
  };
  const sample = buildConversionReport("1.7", 100_000, 95_000, EMPTY_CONTENT, opts);
  if (!sample.ok) throw new Error("sample report failed");
  const r = sample.output;

  it("renderTextReport contains summary", () => {
    const t = renderTextReport(r);
    expect(t).toContain("Conversion Report");
    expect(t).toContain("Source:");
    expect(t).toContain("Target:");
    expect(t).toContain("Requirements:");
  });
  it("renderCsvReport has header + rows", () => {
    const csv = renderCsvReport(r);
    expect(csv).toContain("component,source,target,status,notes");
    expect(csv).toContain("version");
    expect(csv).toContain("size");
  });
  it("renderJsonReport is valid JSON", () => {
    const j = renderJsonReport(r);
    const parsed = JSON.parse(j);
    expect(parsed.sourceVersion).toBe("1.7");
    expect(parsed.targetVersion).toBe("pdf-a-1b");
  });
});

describe("pdf-version-converter formatBytes", () => {
  it("formats bytes", () => { expect(formatBytes(500)).toBe("500 B"); });
  it("formats KB", () => { expect(formatBytes(1500)).toBe("1.5 KB"); });
});

describe("pdf-version-converter history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    const entry: HistoryEntry = {
      ts: 1, fileName: "a.pdf", sourceVersion: "1.7",
      targetVersion: "pdf-a-1b", originalSize: 100, convertedSize: 90,
      compliant: true,
    };
    saveHistory(entry);
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i, fileName: "a.pdf", sourceVersion: "1.7",
        targetVersion: "pdf-a-1b", originalSize: 100, convertedSize: 90,
        compliant: true,
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1, fileName: "a.pdf", sourceVersion: "1.7",
      targetVersion: "pdf-a-1b", originalSize: 100, convertedSize: 90,
      compliant: true,
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("pdf-version-converter shareable URL", () => {
  it("builds share URL with all params", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      targetVersion: "pdf-a-1b",
      preserveMetadata: false, embedFonts: true,
      removeUnsupportedFeatures: true,
    });
    expect(url).toContain("target=pdf-a-1b");
    expect(url).toContain("meta=false");
    expect(url).toContain("fonts=true");
    expect(url).toContain("unsupported=true");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const parsed = parseShareUrl("target=pdf-x-1a&meta=true&fonts=false&unsupported=false");
    expect(parsed.targetVersion).toBe("pdf-x-1a");
    expect(parsed.preserveMetadata).toBe(true);
    expect(parsed.embedFonts).toBe(false);
    expect(parsed.removeUnsupportedFeatures).toBe(false);
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("filters unknown target", () => {
    expect(parseShareUrl("target=invalid").targetVersion).toBeUndefined();
  });
});

describe("pdf-version-converter validateOptions", () => {
  it("returns null for valid options", () => {
    expect(validateOptions(DEFAULT_OPTIONS)).toBeNull();
  });
  it("errors on invalid target", () => {
    expect(validateOptions({ ...DEFAULT_OPTIONS, targetVersion: "invalid" as TargetVersion })).toBeTruthy();
  });
});

// Suppress unused-import lint for type-only imports
export type _Unused = TargetVersion | HistoryEntry;
