import { describe, it, expect, beforeEach } from "vitest";
import {
  isValidBase64, normalizeBase64, stripDataUrlPrefix, detectMime,
  decodeBase64, bytesToHex, suggestFilename, formatHexPreview,
  isDataUrl, decodeBatch,
  loadHistory, saveToHistory, clearHistory,
} from "./logic";
import {
  bytesToBase64,
} from "../base64-file-encoder/logic";

describe("b64dec isValidBase64", () => {
  it("accepts standard Base64", () => {
    expect(isValidBase64("SGVsbG8=")).toBe(true);
  });
  it("accepts URL-safe Base64", () => {
    expect(isValidBase64("a-b_c")).toBe(true);
  });
  it("accepts line-wrapped Base64", () => {
    expect(isValidBase64("SGVs\nbG8=")).toBe(true);
  });
  it("accepts data URL", () => {
    expect(isValidBase64("data:text/plain;base64,SGVsbG8=")).toBe(true);
  });
  it("rejects empty", () => {
    expect(isValidBase64("")).toBe(false);
  });
  it("rejects non-Base64 chars", () => {
    expect(isValidBase64("hello!@#")).toBe(false);
  });
});

describe("b64dec normalizeBase64", () => {
  it("strips data URL prefix", () => {
    expect(normalizeBase64("data:text/plain;base64,SGVsbG8=")).toBe("SGVsbG8=");
  });
  it("removes whitespace", () => {
    expect(normalizeBase64("SGVs\nbG8=")).toBe("SGVsbG8=");
  });
  it("converts URL-safe to standard", () => {
    const orig = bytesToBase64(new Uint8Array([255, 255, 255, 255, 255]));
    const urlSafe = orig.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    expect(normalizeBase64(urlSafe)).toBe(orig);
  });
  it("re-pads to multiple of 4", () => {
    const normalized = normalizeBase64("SGVsbG8"); // missing =
    expect(normalized.length % 4).toBe(0);
    expect(normalized).toBe("SGVsbG8=");
  });
});

describe("b64dec stripDataUrlPrefix", () => {
  it("parses data URL with mime + base64", () => {
    const r = stripDataUrlPrefix("data:image/png;base64,iVBORw0KGgo=");
    expect(r.isDataUrl).toBe(true);
    expect(r.mime).toBe("image/png");
    expect(r.isBase64).toBe(true);
    expect(r.value).toBe("iVBORw0KGgo=");
  });
  it("parses data URL without base64", () => {
    const r = stripDataUrlPrefix("data:text/plain,hello");
    expect(r.isDataUrl).toBe(true);
    expect(r.mime).toBe("text/plain");
    expect(r.isBase64).toBe(false);
    expect(r.value).toBe("hello");
  });
  it("returns input unchanged when not a data URL", () => {
    const r = stripDataUrlPrefix("SGVsbG8=");
    expect(r.isDataUrl).toBe(false);
    expect(r.value).toBe("SGVsbG8=");
  });
  it("handles empty input", () => {
    const r = stripDataUrlPrefix("");
    expect(r.isDataUrl).toBe(false);
  });
});

describe("b64dec isDataUrl", () => {
  it("returns true for data URL", () => {
    expect(isDataUrl("data:text/plain;base64,SGVsbG8=")).toBe(true);
  });
  it("returns false for raw Base64", () => {
    expect(isDataUrl("SGVsbG8=")).toBe(false);
  });
});

describe("b64dec detectMime", () => {
  it("returns mime from data URL when present", () => {
    expect(detectMime("data:image/png;base64,SGVsbG8=", new Uint8Array())).toBe("image/png");
  });
  it("falls back to magic bytes when no data URL", () => {
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    expect(detectMime("iVBORw0K", bytes)).toBe("image/png");
  });
  it("returns null when neither matches", () => {
    expect(detectMime("SGVsbG8=", new Uint8Array([1, 2, 3, 4]))).toBeNull();
  });
});

describe("b64dec decodeBase64", () => {
  it("decodes simple Base64", () => {
    const r = decodeBase64("SGVsbG8=");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(Array.from(r.bytes)).toEqual([72, 101, 108, 108, 111]);
    }
  });
  it("decodes data URL", () => {
    const r = decodeBase64("data:text/plain;base64,SGVsbG8=");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.mime).toBe("text/plain");
      expect(r.ext).toBe("txt");
      expect(Array.from(r.bytes)).toEqual([72, 101, 108, 108, 111]);
    }
  });
  it("decodes URL-safe Base64", () => {
    const orig = bytesToBase64(new Uint8Array([255, 255, 255, 255, 255]));
    const urlSafe = orig.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const r = decodeBase64(urlSafe);
    expect(r.ok).toBe(true);
    if (r.ok) expect(Array.from(r.bytes)).toEqual([255, 255, 255, 255, 255]);
  });
  it("decodes line-wrapped Base64", () => {
    const orig = bytesToBase64(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]));
    const wrapped = orig.match(/.{1,4}/g)!.join("\n");
    const r = decodeBase64(wrapped);
    expect(r.ok).toBe(true);
    if (r.ok) expect(Array.from(r.bytes)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });
  it("detects signature from magic bytes", () => {
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const b64 = bytesToBase64(pngBytes);
    const r = decodeBase64(b64);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.signature?.ext).toBe("png");
      expect(r.mime).toBe("image/png");
    }
  });
  it("returns hex preview", () => {
    const r = decodeBase64("SGVsbG8=");
    if (r.ok) expect(r.hexPreview).toContain("48656c6c6f");
  });
  it("returns error for empty input", () => {
    const r = decodeBase64("");
    expect(r.ok).toBe(false);
  });
  it("returns error for invalid input", () => {
    const r = decodeBase64("!!!not base64!!!");
    expect(r.ok).toBe(false);
  });
});

describe("b64dec bytesToHex", () => {
  it("converts bytes to hex", () => {
    expect(bytesToHex(new Uint8Array([0, 1, 255]))).toBe("0001ff");
  });
  it("supports separator", () => {
    expect(bytesToHex(new Uint8Array([0, 1, 255]), " ")).toBe("00 01 ff");
  });
});

describe("b64dec suggestFilename", () => {
  it("suggests filename from extension", () => {
    expect(suggestFilename("text/plain", "txt")).toBe("decoded.txt");
  });
  it("uses custom base name", () => {
    expect(suggestFilename("image/png", "png", "screenshot")).toBe("screenshot.png");
  });
});

describe("b64dec formatHexPreview", () => {
  it("formats 16-byte row", () => {
    const hex = bytesToHex(new Uint8Array([72, 101, 108, 108, 111]));
    const formatted = formatHexPreview(hex);
    expect(formatted).toContain("|Hello|");
  });
  it("includes offset", () => {
    const hex = bytesToHex(new Uint8Array([0, 1, 2]));
    const formatted = formatHexPreview(hex);
    expect(formatted).toContain("00000000");
  });
});

describe("b64dec decodeBatch", () => {
  it("decodes multiple inputs", () => {
    const results = decodeBatch(["SGVsbG8=", "d29ybGQ="]);
    expect(results).toHaveLength(2);
    expect(results[0].result.ok).toBe(true);
    expect(results[1].result.ok).toBe(true);
  });
  it("handles mixed valid/invalid inputs", () => {
    const results = decodeBatch(["SGVsbG8=", "!!!invalid!!!"]);
    expect(results[0].result.ok).toBe(true);
    expect(results[1].result.ok).toBe(false);
  });
});

describe("b64dec history", () => {
  beforeEach(() => {
    const store: Record<string, string> = {};
    (globalThis as unknown as { localStorage: Storage }).localStorage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
      clear: () => { for (const k of Object.keys(store)) delete store[k]; },
      key: (_i: number) => null,
      length: 0,
    } as Storage;
  });
  it("saves and loads", () => {
    saveToHistory({ inputSize: 8, outputSize: 5, mime: "text/plain", ext: "txt", decodedAt: "2026-01-01" });
    expect(loadHistory()).toHaveLength(1);
  });
  it("clears", () => {
    saveToHistory({ inputSize: 8, outputSize: 5, mime: "text/plain", ext: "txt", decodedAt: "2026-01-01" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});
