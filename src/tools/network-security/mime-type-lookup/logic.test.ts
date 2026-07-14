import { describe, it, expect, beforeEach } from "vitest";
import {
  MIME_TYPES,
  lookupByExtension,
  lookupAllByExtension,
  lookupByMimeType,
  extensionsFor,
  search,
  detectFromFilename,
  byCategory,
  count,
} from "./logic";

describe("mime lookupByExtension", () => {
  it("finds html", () => {
    const r = lookupByExtension("html");
    expect(r?.mimeType).toBe("text/html");
  });

  it("finds jpg", () => {
    const r = lookupByExtension("jpg");
    expect(r?.mimeType).toBe("image/jpeg");
  });

  it("finds jpeg", () => {
    const r = lookupByExtension("jpeg");
    expect(r?.mimeType).toBe("image/jpeg");
  });

  it("handles leading dot", () => {
    expect(lookupByExtension(".html")?.mimeType).toBe("text/html");
    expect(lookupByExtension(".png")?.mimeType).toBe("image/png");
  });

  it("is case-insensitive", () => {
    expect(lookupByExtension("HTML")?.mimeType).toBe("text/html");
    expect(lookupByExtension("PNG")?.mimeType).toBe("image/png");
    expect(lookupByExtension("Js")?.mimeType).toBe("text/javascript");
  });

  it("returns undefined for unknown extension", () => {
    expect(lookupByExtension("xyz")).toBeUndefined();
    expect(lookupByExtension("")).toBeUndefined();
  });

  it("finds json", () => {
    expect(lookupByExtension("json")?.mimeType).toBe("application/json");
  });
});

describe("mime lookupAllByExtension", () => {
  it("returns all matches for js", () => {
    const all = lookupAllByExtension("js");
    expect(all.length).toBeGreaterThan(0);
    expect(all.some((m) => m.mimeType === "text/javascript")).toBe(true);
  });

  it("returns empty array for unknown", () => {
    expect(lookupAllByExtension("xyz")).toHaveLength(0);
  });
});

describe("mime lookupByMimeType", () => {
  it("finds by exact type", () => {
    expect(lookupByMimeType("text/html")?.extensions).toContain("html");
  });

  it("finds by alias", () => {
    // application/javascript is an alias of text/javascript
    const r = lookupByMimeType("application/javascript");
    expect(r?.mimeType).toBe("text/javascript");
  });

  it("handles parameters (e.g. text/html; charset=utf-8)", () => {
    expect(lookupByMimeType("text/html; charset=utf-8")?.extensions).toContain("html");
    expect(lookupByMimeType("application/json; charset=utf-8")?.mimeType).toBe("application/json");
  });

  it("is case-insensitive", () => {
    expect(lookupByMimeType("TEXT/HTML")?.extensions).toContain("html");
  });

  it("returns undefined for unknown", () => {
    expect(lookupByMimeType("application/foo")).toBeUndefined();
    expect(lookupByMimeType("")).toBeUndefined();
  });
});

describe("mime extensionsFor", () => {
  it("returns extensions for a MIME type", () => {
    expect(extensionsFor("text/html")).toEqual(expect.arrayContaining(["html", "htm"]));
  });

  it("returns empty array for unknown", () => {
    expect(extensionsFor("application/foo")).toEqual([]);
  });
});

describe("mime search", () => {
  it("returns all for empty query", () => {
    expect(search("")).toHaveLength(MIME_TYPES.length);
    expect(search("   ")).toHaveLength(MIME_TYPES.length);
  });

  it("finds by MIME type substring", () => {
    const r = search("image/");
    expect(r.length).toBeGreaterThan(5);
    expect(r.every((m) => m.category === "image")).toBe(true);
  });

  it("finds by extension", () => {
    const r = search("jpg");
    expect(r.some((m) => m.mimeType === "image/jpeg")).toBe(true);
  });

  it("finds by description", () => {
    const r = search("pdf");
    expect(r.some((m) => m.mimeType === "application/pdf")).toBe(true);
  });

  it("is case-insensitive", () => {
    const a = search("PDF");
    const b = search("pdf");
    expect(a).toEqual(b);
  });
});

describe("mime detectFromFilename", () => {
  it("detects from filename with extension", () => {
    expect(detectFromFilename("photo.jpg")?.mimeType).toBe("image/jpeg");
    expect(detectFromFilename("index.html")?.mimeType).toBe("text/html");
    expect(detectFromFilename("data.json")?.mimeType).toBe("application/json");
  });

  it("handles filenames with multiple dots", () => {
    expect(detectFromFilename("my.file.name.txt")?.mimeType).toBe("text/plain");
  });

  it("returns undefined for no extension", () => {
    expect(detectFromFilename("README")).toBeUndefined();
  });

  it("returns undefined for trailing dot", () => {
    expect(detectFromFilename("README.")).toBeUndefined();
  });

  it("handles uppercase extension", () => {
    expect(detectFromFilename("PHOTO.JPG")?.mimeType).toBe("image/jpeg");
  });

  it("returns undefined for empty", () => {
    expect(detectFromFilename("")).toBeUndefined();
  });
});

describe("mime byCategory", () => {
  it("returns only image types", () => {
    const r = byCategory("image");
    expect(r.length).toBeGreaterThan(5);
    expect(r.every((m) => m.category === "image")).toBe(true);
  });

  it("returns only application types", () => {
    const r = byCategory("application");
    expect(r.length).toBeGreaterThan(5);
    expect(r.every((m) => m.category === "application")).toBe(true);
  });
});

describe("mime count", () => {
  it("matches array length", () => {
    expect(count()).toBe(MIME_TYPES.length);
  });

  it("has at least 50 entries", () => {
    expect(count()).toBeGreaterThan(50);
  });
});

describe("mime MIME_TYPES integrity", () => {
  it("every entry has required fields", () => {
    for (const m of MIME_TYPES) {
      expect(m.mimeType).toMatch(/^[a-z]+\/[a-z0-9.+-]+$/);
      expect(Array.isArray(m.extensions)).toBe(true);
      expect(m.description).toBeTruthy();
      expect(typeof m.isBinary).toBe("boolean");
    }
  });

  it("every mimeType is unique", () => {
    const types = MIME_TYPES.map((m) => m.mimeType);
    expect(new Set(types).size).toBe(types.length);
  });
});

// ===== v8.1 upgrade tests =====

import {
  getIanaUrl,
  detectCharset,
  detectFromMagicBytes,
  checkSniffingRisk,
  toHtaccess,
  toNginxMimeTypes,
  validateCustomMimeType,
  loadMimeHistory,
  saveMimeToHistory,
  clearMimeHistory,
  loadMimeFavorites,
  toggleMimeFavorite,
  getCategoryStats,
  analyzeExtension,
  findConflicts,
  buildContentTypeHeader,
  buildAcceptHeader,
  exportMimeTypesAsJson,
  generateMimeQuizQuestion,
  buildMimeShareUrl,
  type CustomMimeType,
} from "./logic";

describe("mime getIanaUrl", () => {
  it("builds IANA URL for text/html", () => {
    expect(getIanaUrl("text/html")).toBe("https://www.iana.org/assignments/media-types/text/html");
  });
  it("handles parameters in MIME type", () => {
    expect(getIanaUrl("text/html; charset=utf-8")).toBe("https://www.iana.org/assignments/media-types/text/html");
  });
});

describe("mime detectCharset", () => {
  it("returns utf-8 for text types by default", () => {
    expect(detectCharset("text/plain")).toBe("utf-8");
  });
  it("returns null for binary types", () => {
    expect(detectCharset("image/png")).toBeNull();
  });
  it("detects UTF-8 BOM", () => {
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, 0x48, 0x65]);
    expect(detectCharset("text/plain", bytes)).toBe("utf-8");
  });
  it("detects UTF-16LE BOM", () => {
    const bytes = new Uint8Array([0xff, 0xfe, 0x48, 0x00]);
    expect(detectCharset("text/plain", bytes)).toBe("utf-16le");
  });
});

describe("mime detectFromMagicBytes", () => {
  it("detects PNG", () => {
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
    const r = detectFromMagicBytes(bytes);
    expect(r?.mimeType).toBe("image/png");
  });
  it("detects JPEG", () => {
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
    expect(detectFromMagicBytes(bytes)?.mimeType).toBe("image/jpeg");
  });
  it("detects PDF", () => {
    const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
    expect(detectFromMagicBytes(bytes)?.mimeType).toBe("application/pdf");
  });
  it("detects ZIP", () => {
    const bytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);
    expect(detectFromMagicBytes(bytes)?.mimeType).toBe("application/zip");
  });
  it("returns null for unknown bytes", () => {
    const bytes = new Uint8Array([0x00, 0x00, 0x00, 0x00]);
    expect(detectFromMagicBytes(bytes)).toBeNull();
  });
});

describe("mime checkSniffingRisk", () => {
  it("warns for octet-stream", () => {
    const w = checkSniffingRisk("application/octet-stream");
    expect(w).not.toBeNull();
    expect(w?.severity).toBe("medium");
  });
  it("warns for text/plain", () => {
    expect(checkSniffingRisk("text/plain")?.severity).toBe("low");
  });
  it("returns null for specific types", () => {
    expect(checkSniffingRisk("image/png")).toBeNull();
  });
});

describe("mime toHtaccess", () => {
  it("generates AddType directives", () => {
    const ht = toHtaccess([MIME_TYPES[0]]);
    expect(ht).toContain("AddType");
  });
});

describe("mime toNginxMimeTypes", () => {
  it("generates nginx types block", () => {
    const nginx = toNginxMimeTypes([MIME_TYPES[0]]);
    expect(nginx).toContain("types {");
  });
});

describe("mime validateCustomMimeType", () => {
  it("accepts valid custom type", () => {
    const custom: CustomMimeType = { mimeType: "application/x-myapp", extensions: ["myapp"], description: "test", isBinary: true };
    expect(validateCustomMimeType(custom)).toBeNull();
  });
  it("rejects invalid format", () => {
    expect(validateCustomMimeType({ mimeType: "not-a-mime", extensions: ["x"], description: "", isBinary: false })).toMatch(/format/);
  });
  it("rejects no extensions", () => {
    expect(validateCustomMimeType({ mimeType: "application/x-test", extensions: [], description: "", isBinary: false })).toMatch(/extension/);
  });
});

describe("mime history", () => {
  beforeEach(() => {
    const store: Record<string, string> = {};
    (globalThis as any).localStorage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
    };
  });
  it("saves and loads", () => {
    saveMimeToHistory("image/png");
    expect(loadMimeHistory()).toHaveLength(1);
  });
  it("clears", () => {
    saveMimeToHistory("test");
    clearMimeHistory();
    expect(loadMimeHistory()).toEqual([]);
  });
});

describe("mime favorites", () => {
  beforeEach(() => {
    const store: Record<string, string> = {};
    (globalThis as any).localStorage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
    };
  });
  it("toggles favorites", () => {
    toggleMimeFavorite("image/png");
    expect(loadMimeFavorites()).toContain("image/png");
    toggleMimeFavorite("image/png");
    expect(loadMimeFavorites()).toEqual([]);
  });
});

describe("mime getCategoryStats", () => {
  it("returns stats for all categories", () => {
    const stats = getCategoryStats();
    expect(stats.length).toBeGreaterThan(0);
    expect(stats[0].count).toBeGreaterThan(0);
  });
});

describe("mime analyzeExtension", () => {
  it("finds MIME types for .html", () => {
    const r = analyzeExtension("html");
    expect(r).not.toBeNull();
    expect(r?.mimeTypes.length).toBeGreaterThan(0);
  });
  it("returns null for unknown extension", () => {
    expect(analyzeExtension("xyz123")).toBeNull();
  });
});

describe("mime findConflicts", () => {
  it("finds extensions claimed by multiple types", () => {
    const conflicts = findConflicts();
    // .xml is claimed by both text/xml and application/xml
    expect(conflicts.some((c) => c.extension === "xml")).toBe(true);
  });
});

describe("mime buildContentTypeHeader", () => {
  it("adds charset for text types", () => {
    const h = buildContentTypeHeader("text/html");
    expect(h.header).toContain("charset=utf-8");
  });
  it("omits charset for binary types", () => {
    const h = buildContentTypeHeader("image/png");
    expect(h.header).not.toContain("charset");
  });
});

describe("mime buildAcceptHeader", () => {
  it("builds Accept header with quality values", () => {
    const h = buildAcceptHeader([
      { mimeType: "text/html" },
      { mimeType: "application/json", quality: 0.9 },
    ]);
    expect(h).toBe("text/html, application/json;q=0.9");
  });
});

describe("mime exportMimeTypesAsJson", () => {
  it("exports as JSON with metadata", () => {
    const json = JSON.parse(exportMimeTypesAsJson());
    expect(json.count).toBe(MIME_TYPES.length);
    expect(json.mimeTypes).toBeDefined();
  });
});

describe("mime generateMimeQuizQuestion", () => {
  it("generates a question with 4 choices", () => {
    const q = generateMimeQuizQuestion();
    expect(q).not.toBeNull();
    expect(q?.choices).toHaveLength(4);
  });
});
