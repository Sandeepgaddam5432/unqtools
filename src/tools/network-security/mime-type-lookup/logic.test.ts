import { describe, it, expect } from "vitest";
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
