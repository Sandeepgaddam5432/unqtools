import { describe, it, expect, beforeEach } from "vitest";
import {
  encodeText,
  encodeBytes,
  encodeBytesPlain,
  validateDataUrl,
  parseDataUrl,
  getDataUrlSize,
  getUrlLength,
  getMimeType,
  isBinaryMimeType,
  suggestExtension,
  formatBytes,
} from "./logic";

describe("data-url encodeText", () => {
  it("encodes text with default MIME type", () => {
    const url = encodeText("Hello");
    expect(url).toBe("data:text/plain;base64,SGVsbG8=");
  });

  it("encodes with custom MIME type", () => {
    const url = encodeText("<h1>Hi</h1>", "text/html");
    expect(url).toBe("data:text/html;base64,PGgxPkhpPC9oMT4=");
  });

  it("handles UTF-8 characters", () => {
    const url = encodeText("Héllo Wörld");
    // Decode and check round-trip
    const parsed = parseDataUrl(url);
    expect(parsed.data).toBe("Héllo Wörld");
  });

  it("handles empty string", () => {
    const url = encodeText("");
    expect(url).toBe("data:text/plain;base64,");
  });

  it("throws on non-string", () => {
    expect(() => encodeText(null as any)).toThrow();
  });
});

describe("data-url encodeBytes", () => {
  it("encodes bytes with default MIME type", () => {
    const bytes = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
    const url = encodeBytes(bytes);
    expect(url).toBe("data:application/octet-stream;base64,SGVsbG8=");
  });

  it("encodes with custom MIME type", () => {
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]); // PNG magic
    const url = encodeBytes(bytes, "image/png");
    expect(url).toBe("data:image/png;base64,iVBORw==");
  });

  it("throws on non-Uint8Array", () => {
    expect(() => encodeBytes("not bytes" as any)).toThrow();
  });
});

describe("data-url encodeBytesPlain", () => {
  it("encodes bytes as plain (non-base64) URL", () => {
    const bytes = new Uint8Array([72, 101, 108, 108, 111]);
    const url = encodeBytesPlain(bytes, "text/plain");
    expect(url).toBe("data:text/plain,Hello");
  });

  it("URL-encodes special characters", () => {
    const bytes = new TextEncoder().encode("a&b=c");
    const url = encodeBytesPlain(bytes, "text/plain");
    expect(url).toBe("data:text/plain,a%26b%3Dc");
  });
});

describe("data-url validateDataUrl", () => {
  it("accepts valid data URLs", () => {
    expect(validateDataUrl("data:text/plain;base64,SGVsbG8=")).toBeNull();
    expect(validateDataUrl("data:text/html,<h1>Hi</h1>")).toBeNull();
    expect(validateDataUrl("data:;base64,SGVsbG8=")).toBeNull();
  });

  it("rejects empty input", () => {
    expect(validateDataUrl("")).toMatch(/empty/i);
  });

  it("rejects non-data: URLs", () => {
    expect(validateDataUrl("https://example.com/")).toMatch(/data:/);
    expect(validateDataUrl("http://foo")).toMatch(/data:/);
  });

  it("rejects missing comma", () => {
    expect(validateDataUrl("data:text/plain;base64")).toMatch(/comma/);
  });
});

describe("data-url parseDataUrl", () => {
  it("parses base64 text/plain", () => {
    const r = parseDataUrl("data:text/plain;base64,SGVsbG8=");
    expect(r.isValid).toBe(true);
    expect(r.mimeType).toBe("text/plain");
    expect(r.isBase64).toBe(true);
    expect(r.data).toBe("Hello");
  });

  it("parses base64 with custom MIME type", () => {
    const r = parseDataUrl("data:image/png;base64,iVBORw==");
    expect(r.mimeType).toBe("image/png");
    expect(r.isBase64).toBe(true);
    // Binary bytes that aren't valid UTF-8 get replaced with the replacement
    // character — that's expected behavior for a UTF-8 decoder. We verify the
    // first valid ASCII byte ('P' = 0x50 = 'P' in 'PNG') round-trips.
    expect(r.data).toContain("PNG");
  });

  it("parses plain (non-base64) text", () => {
    const r = parseDataUrl("data:text/plain,Hello%20World");
    expect(r.isValid).toBe(true);
    expect(r.mimeType).toBe("text/plain");
    expect(r.isBase64).toBe(false);
    expect(r.data).toBe("Hello World");
  });

  it("parses HTML inline", () => {
    const r = parseDataUrl("data:text/html,<h1>Hello</h1>");
    expect(r.mimeType).toBe("text/html");
    expect(r.data).toBe("<h1>Hello</h1>");
  });

  it("defaults MIME type to text/plain when missing", () => {
    const r = parseDataUrl("data:;base64,SGVsbG8=");
    expect(r.mimeType).toBe("text/plain");
  });

  it("round-trips through encodeText/parseDataUrl", () => {
    const original = "Hello, World! 你好 🌍";
    const url = encodeText(original, "text/plain");
    const parsed = parseDataUrl(url);
    expect(parsed.data).toBe(original);
  });

  it("returns invalid for malformed URLs", () => {
    expect(parseDataUrl("not a data url").isValid).toBe(false);
    expect(parseDataUrl("").isValid).toBe(false);
  });

  it("returns invalid for bad base64", () => {
    const r = parseDataUrl("data:text/plain;base64,!!!invalid!!!");
    expect(r.isValid).toBe(false);
    expect(r.error).toMatch(/base64/i);
  });
});

describe("data-url getDataUrlSize", () => {
  it("returns the byte size of the data", () => {
    const url = encodeText("Hello");
    expect(getDataUrlSize(url)).toBe(5); // 5 ASCII bytes
  });

  it("returns 0 for invalid URL", () => {
    expect(getDataUrlSize("not a url")).toBe(0);
  });

  it("counts UTF-8 bytes correctly", () => {
    const url = encodeText("你好"); // 2 chars × 3 bytes = 6 bytes
    expect(getDataUrlSize(url)).toBe(6);
  });
});

describe("data-url getUrlLength", () => {
  it("returns the URL string length", () => {
    const url = "data:text/plain;base64,SGVsbG8=";
    expect(getUrlLength(url)).toBe(url.length);
  });
});

describe("data-url getMimeType", () => {
  it("extracts MIME type from valid URL", () => {
    expect(getMimeType("data:image/png;base64,xxx")).toBe("image/png");
    expect(getMimeType("data:text/html,<h1>")).toBe("text/html");
  });

  it("returns null for invalid URL", () => {
    expect(getMimeType("not a url")).toBeNull();
  });
});

describe("data-url isBinaryMimeType", () => {
  it("returns true for image/audio/video/font", () => {
    expect(isBinaryMimeType("image/png")).toBe(true);
    expect(isBinaryMimeType("audio/mpeg")).toBe(true);
    expect(isBinaryMimeType("video/mp4")).toBe(true);
    expect(isBinaryMimeType("font/woff2")).toBe(true);
  });

  it("returns true for application/octet-stream and pdf/zip", () => {
    expect(isBinaryMimeType("application/octet-stream")).toBe(true);
    expect(isBinaryMimeType("application/pdf")).toBe(true);
    expect(isBinaryMimeType("application/zip")).toBe(true);
  });

  it("returns false for text/*", () => {
    expect(isBinaryMimeType("text/plain")).toBe(false);
    expect(isBinaryMimeType("text/html")).toBe(false);
    expect(isBinaryMimeType("text/css")).toBe(false);
  });

  it("returns false for application/json", () => {
    expect(isBinaryMimeType("application/json")).toBe(false);
  });

  it("returns false for empty input", () => {
    expect(isBinaryMimeType("")).toBe(false);
  });
});

describe("data-url suggestExtension", () => {
  it("suggests common extensions", () => {
    expect(suggestExtension("text/plain")).toBe("txt");
    expect(suggestExtension("text/html")).toBe("html");
    expect(suggestExtension("image/png")).toBe("png");
    expect(suggestExtension("image/jpeg")).toBe("jpg");
    expect(suggestExtension("application/json")).toBe("json");
    expect(suggestExtension("application/pdf")).toBe("pdf");
  });

  it("defaults to 'bin' for unknown", () => {
    expect(suggestExtension("application/foo")).toBe("bin");
    expect(suggestExtension("")).toBe("bin");
  });
});

describe("data-url formatBytes", () => {
  it("formats 0 bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
  });

  it("formats bytes", () => {
    expect(formatBytes(500)).toBe("500 B");
  });

  it("formats KB", () => {
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(1536)).toBe("1.5 KB");
  });

  it("formats MB", () => {
    expect(formatBytes(1024 * 1024)).toBe("1.0 MB");
  });

  it("handles invalid input", () => {
    expect(formatBytes(-1)).toBe("—");
    expect(formatBytes(NaN)).toBe("—");
  });
});

// ===== v8.1 upgrade tests =====

import {
  checkDataUrlSize,
  optimizeSvgDataUrl,
  toImgTag,
  toCssBackground,
  toFaviconLink,
  loadDataUrlHistory,
  saveDataUrlToHistory,
  clearDataUrlHistory,
  batchEncodeFiles,
  batchToJson,
  dataUrlToBlob,
  compareDataUrls,
  generateEmbedTemplates,
  validateDataUrlDeep,
  estimateDataUrlSize,
  getFileInfo,
  buildDataUrlShareUrl,
  extractDataUrlFromFragment,
} from "./logic";

describe("dataurl checkDataUrlSize", () => {
  it("returns null for small URLs", () => {
    const url = encodeText("hello");
    expect(checkDataUrlSize(url)).toBeNull();
  });
  it("returns warning for large URLs", () => {
    const big = "data:text/plain;base64," + "A".repeat(200000);
    const w = checkDataUrlSize(big);
    expect(w).not.toBeNull();
    expect(w?.severity).toBe("warning");
  });
  it("returns error for >2MB URLs", () => {
    const huge = "data:text/plain;base64," + "A".repeat(3 * 1024 * 1024);
    const w = checkDataUrlSize(huge);
    expect(w?.severity).toBe("error");
  });
});

describe("dataurl optimizeSvgDataUrl", () => {
  it("optimizes SVG data URL", () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><circle r="10"/></svg>';
    const result = optimizeSvgDataUrl(svg);
    expect(result.url).toMatch(/^data:image\/svg\+xml/);
    expect(result.encoding).toBeTruthy();
  });
});

describe("dataurl toImgTag", () => {
  it("generates img tag", () => {
    const url = "data:image/png;base64,abc";
    const tag = toImgTag(url, "test image", 100, 50);
    expect(tag).toContain("<img");
    expect(tag).toContain('src="data:image/png;base64,abc"');
    expect(tag).toContain('alt="test image"');
    expect(tag).toContain('width="100"');
    expect(tag).toContain('height="50"');
  });
});

describe("dataurl toCssBackground", () => {
  it("generates CSS rule", () => {
    const css = toCssBackground("data:image/png;base64,abc", ".hero");
    expect(css).toContain(".hero");
    expect(css).toContain("background-image: url");
  });
});

describe("dataurl toFaviconLink", () => {
  it("generates favicon link tag", () => {
    const link = toFaviconLink("data:image/x-icon;base64,abc");
    expect(link).toContain('<link rel="icon"');
    expect(link).toContain('href="data:image');
  });
});

describe("dataurl history", () => {
  beforeEach(() => {
    const store: Record<string, string> = {};
    (globalThis as any).localStorage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
    };
  });
  it("saves and loads", () => {
    saveDataUrlToHistory(encodeText("test"));
    expect(loadDataUrlHistory()).toHaveLength(1);
  });
  it("clears", () => {
    saveDataUrlToHistory(encodeText("test"));
    clearDataUrlHistory();
    expect(loadDataUrlHistory()).toEqual([]);
  });
});

describe("dataurl batchEncodeFiles", () => {
  it("encodes multiple files", async () => {
    const file1 = new File(["hello"], "test1.txt", { type: "text/plain" });
    const file2 = new File(["world"], "test2.txt", { type: "text/plain" });
    const results = await batchEncodeFiles([file1, file2]);
    expect(results).toHaveLength(2);
    expect(results[0].filename).toBe("test1.txt");
    expect(results[0].dataUrl).toMatch(/^data:text\/plain;base64,/);
  });
});

describe("dataurl batchToJson", () => {
  it("formats batch as JSON", () => {
    const results = [{ filename: "test.txt", mimeType: "text/plain", dataUrl: "data:...", size: 5 }];
    const json = JSON.parse(batchToJson(results));
    expect(json.count).toBe(1);
    expect(json.files[0].filename).toBe("test.txt");
  });
});

describe("dataurl dataUrlToBlob", () => {
  it("converts data URL to Blob", () => {
    const url = encodeText("hello");
    const blob = dataUrlToBlob(url);
    expect(blob).not.toBeNull();
    expect(blob?.type).toBe("text/plain");
  });
  it("returns null for invalid URL", () => {
    expect(dataUrlToBlob("not-a-url")).toBeNull();
  });
});

describe("dataurl compareDataUrls", () => {
  it("finds differences", () => {
    const u1 = encodeText("hello");
    const u2 = encodeText("world");
    const diffs = compareDataUrls(u1, u2);
    const dataDiff = diffs.find((d) => d.field === "data");
    expect(dataDiff?.same).toBe(false);
  });
});

describe("dataurl generateEmbedTemplates", () => {
  it("generates multiple templates", () => {
    const url = encodeText("hello", "image/png");
    const templates = generateEmbedTemplates(url, "test.png");
    expect(templates.length).toBeGreaterThan(3);
    expect(templates.some((t) => t.name === "HTML <img>")).toBe(true);
    expect(templates.some((t) => t.name === "CSS background")).toBe(true);
  });
});

describe("dataurl validateDataUrlDeep", () => {
  it("validates a good URL", () => {
    const r = validateDataUrlDeep(encodeText("hello"));
    expect(r.isValid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });
  it("rejects invalid URL", () => {
    const r = validateDataUrlDeep("not-a-url");
    expect(r.isValid).toBe(false);
  });
});

describe("dataurl estimateDataUrlSize", () => {
  it("estimates sizes", () => {
    const est = estimateDataUrlSize(1000, "image/png");
    expect(est.inputBytes).toBe(1000);
    expect(est.base64UrlBytes).toBeGreaterThan(1000);
    expect(est.overhead).toBeGreaterThan(0);
  });
});

describe("dataurl getFileInfo", () => {
  it("extracts file info", () => {
    const file = new File(["test"], "example.txt", { type: "text/plain", lastModified: 1700000000000 });
    const info = getFileInfo(file);
    expect(info.name).toBe("example.txt");
    expect(info.size).toBe(4);
    expect(info.type).toBe("text/plain");
  });
});

describe("dataurl buildDataUrlShareUrl", () => {
  it("returns empty for huge URLs", () => {
    const huge = "data:text/plain;base64," + "A".repeat(3000);
    expect(buildDataUrlShareUrl(huge)).toBe("");
  });
  it("builds URL for small data URLs", () => {
    const origWindow = globalThis.window;
    (globalThis as any).window = { location: { origin: "https://x.com", pathname: "/tools/data-url-converter" } };
    const url = buildDataUrlShareUrl(encodeText("hi"));
    expect(url).toContain("#dataurl=");
    (globalThis as any).window = origWindow;
  });
});
