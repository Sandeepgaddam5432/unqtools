import { describe, it, expect } from "vitest";
import { encodeBase64, decodeBase64, encodeBytes, decodeToBytes, toDataUrl } from "./logic";

describe("encodeBase64", () => {
  it("encodes empty string", () => {
    expect(encodeBase64("")).toBe("");
  });

  it("encodes ASCII text", () => {
    expect(encodeBase64("Hello")).toBe("SGVsbG8=");
    expect(encodeBase64("Hello, World!")).toBe("SGVsbG8sIFdvcmxkIQ==");
  });

  it("encodes UTF-8 correctly (emoji)", () => {
    // 👍 = U+1F44D = 4 UTF-8 bytes: F0 9F 91 8D
    expect(encodeBase64("👍")).toBe("8J+RjQ==");
  });

  it("encodes CJK correctly", () => {
    // 你 = U+4F60 = 3 UTF-8 bytes: E4 BD A0
    expect(encodeBase64("你")).toBe("5L2g");
  });

  it("URL-safe variant replaces + and / and drops padding", () => {
    const _std = encodeBase64("???", "standard");
    const url = encodeBase64("???", "urlsafe");
    expect(url).not.toContain("+");
    expect(url).not.toContain("/");
    expect(url).not.toContain("=");
    expect(url.length).toBeLessThanOrEqual(_std.length);
  });
});

describe("decodeBase64", () => {
  it("decodes ASCII text", () => {
    const r = decodeBase64("SGVsbG8sIFdvcmxkIQ==");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output).toBe("Hello, World!");
  });

  it("decodes UTF-8 emoji correctly", () => {
    const r = decodeBase64("8J+RjQ==");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output).toBe("👍");
  });

  it("decodes URL-safe variant", () => {
    const r = decodeBase64("8J-RjQ");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output).toBe("👍");
  });

  it("auto-restores missing padding", () => {
    // "5L2g" without "=" should still decode
    const r = decodeBase64("5L2g");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output).toBe("你");
  });

  it("errors on empty input", () => {
    expect(decodeBase64("").ok).toBe(false);
    expect(decodeBase64("   ").ok).toBe(false);
  });

  it("errors on length-1 input (invalid)", () => {
    expect(decodeBase64("A").ok).toBe(false);
  });

  it("errors on invalid characters", () => {
    expect(decodeBase64("not!valid!base64").ok).toBe(false);
  });
});

describe("round-trip", () => {
  const samples = [
    "a",
    "ab",
    "abc",
    "Hello, World!",
    "👍🌍你好",
    "Mix of 中文 and English with emoji 🎉",
  ];

  for (const sample of samples) {
    it(`round-trips "${sample.slice(0, 20)}"`, () => {
      const encoded = encodeBase64(sample);
      const decoded = decodeBase64(encoded);
      expect(decoded.ok).toBe(true);
      if (decoded.ok) expect(decoded.output).toBe(sample);
    });

    it(`round-trips "${sample.slice(0, 20)}" via URL-safe`, () => {
      const encoded = encodeBase64(sample, "urlsafe");
      const decoded = decodeBase64(encoded);
      expect(decoded.ok).toBe(true);
      if (decoded.ok) expect(decoded.output).toBe(sample);
    });
  }
});

describe("encodeBytes / decodeToBytes", () => {
  it("encodes and decodes bytes", () => {
    const bytes = new Uint8Array([0, 1, 2, 3, 255, 254]);
    const encoded = encodeBytes(bytes);
    const decoded = decodeToBytes(encoded);
    expect(decoded.ok).toBe(true);
    if (decoded.ok) {
      expect(Array.from(decoded.output)).toEqual([0, 1, 2, 3, 255, 254]);
    }
  });

  it("decodes URL-safe bytes", () => {
    const bytes = new Uint8Array([255, 254]); // produces + or / in standard
    const _std = encodeBytes(bytes, "standard");
    const url = encodeBytes(bytes, "urlsafe");
    expect(url).not.toContain("+");
    expect(url).not.toContain("/");
    void _std;
    const decoded = decodeToBytes(url);
    expect(decoded.ok).toBe(true);
    if (decoded.ok) expect(Array.from(decoded.output)).toEqual([255, 254]);
  });
});

describe("toDataUrl", () => {
  it("builds a valid data URL", () => {
    const url = toDataUrl("SGVsbG8=", "text/plain");
    expect(url).toBe("data:text/plain;base64,SGVsbG8=");
  });

  it("converts URL-safe to standard in data URL", () => {
    const url = toDataUrl("8J-SnQ", "image/png");
    expect(url).toBe("data:image/png;base64,8J+SnQ");
  });
});
