/**
 * Hidden Characters Detector — unit tests.
 */
import { describe, it, expect } from "vitest";
import {
  detectHidden, removeByCategory, removeCodepoints, decodeSteganography,
  encodeSteganography, batchDetect, toCsv,
} from "./logic";

describe("detectHidden — zero-width chars", () => {
  it("detects zero-width space (U+200B)", () => {
    const r = detectHidden("hello\u200Bworld");
    expect(r.countsByCategory["zero-width"]).toBe(1);
    expect(r.total).toBe(1);
    expect(r.chars[0]!.name).toContain("Zero-width space");
  });
  it("detects ZWNJ and ZWJ", () => {
    const r = detectHidden("a\u200Cb\u200Dc");
    expect(r.countsByCategory["zero-width"]).toBe(2);
  });
  it("detects word joiner U+2060", () => {
    const r = detectHidden("x\u2060y");
    expect(r.countsByCategory["zero-width"]).toBe(1);
  });
});

describe("detectHidden — BOM", () => {
  it("detects BOM at start", () => {
    const r = detectHidden("\uFEFFhello");
    expect(r.countsByCategory.bom).toBe(1);
    expect(r.warnings.some((w) => w.includes("BOM"))).toBe(true);
  });
});

describe("detectHidden — control chars", () => {
  it("detects NULL", () => {
    const r = detectHidden("a\u0000b");
    expect(r.countsByCategory.control).toBe(1);
  });
  it("detects DEL", () => {
    const r = detectHidden("a\u007Fb");
    expect(r.countsByCategory.control).toBe(1);
  });
  it("detects C1 control chars", () => {
    const r = detectHidden("a\u0080b");
    expect(r.countsByCategory.control).toBeGreaterThanOrEqual(1);
  });
});

describe("detectHidden — directional & invisible", () => {
  it("detects LRM and RLM", () => {
    const r = detectHidden("a\u200Eb\u200Fc");
    expect(r.countsByCategory.directional).toBe(2);
  });
  it("detects invisible operators", () => {
    const r = detectHidden("a\u2061b\u2062c");
    expect(r.countsByCategory["invisible-op"]).toBe(2);
  });
  it("warns on directional (Trojan Source)", () => {
    const r = detectHidden("a\u202Eb");
    expect(r.warnings.some((w) => w.includes("Trojan"))).toBe(true);
  });
});

describe("detectHidden — variation selectors", () => {
  it("detects VS1-VS16", () => {
    const r = detectHidden("\uFE00\uFE01");
    expect(r.countsByCategory["variation-selector"]).toBe(2);
  });
  it("detects variation selector supplement", () => {
    const r = detectHidden("\u{E0100}");
    expect(r.countsByCategory["variation-selector"]).toBe(1);
  });
});

describe("detectHidden — special whitespace", () => {
  it("detects NBSP", () => {
    const r = detectHidden("a\u00A0b");
    expect(r.countsByCategory["whitespace-special"]).toBe(1);
  });
  it("detects soft hyphen", () => {
    const r = detectHidden("a\u00ADb");
    expect(r.countsByCategory["whitespace-special"]).toBe(1);
  });
  it("detects line separator", () => {
    const r = detectHidden("a\u2028b");
    expect(r.countsByCategory["whitespace-special"]).toBe(1);
  });
});

describe("detectHidden — position info", () => {
  it("computes line and column", () => {
    const r = detectHidden("ab\ncd\u200Be");
    const ch = r.chars[0]!;
    expect(ch.line).toBe(2);
    expect(ch.column).toBe(3);
    expect(ch.offset).toBe(5);
  });
  it("provides hex codepoint and escape", () => {
    const r = detectHidden("\u200B");
    expect(r.chars[0]!.hex).toBe("U+200B");
    expect(r.chars[0]!.escape).toContain("200B");
  });
});

describe("detectHidden — cleaned text", () => {
  it("removes all hidden chars from cleaned text", () => {
    const r = detectHidden("he\u200Bllo");
    expect(r.cleaned).toBe("hello");
  });
});

describe("removeByCategory", () => {
  it("removes only specified category", () => {
    const out = removeByCategory("a\u200Bb\u00A0c", ["zero-width"]);
    expect(out).toBe("ab\u00A0c");
  });
});

describe("removeCodepoints", () => {
  it("removes specific codepoints", () => {
    const out = removeCodepoints("a\u200Bb\u200Cc", [0x200B]);
    expect(out).toBe("ab\u200Cc");
  });
});

describe("steganography", () => {
  it("encode then decode roundtrip", () => {
    const carrier = "Hello World";
    const payload = "AB";
    const encoded = encodeSteganography(carrier, payload);
    const decoded = decodeSteganography(encoded);
    expect(decoded).not.toBeNull();
    expect(decoded).toContain("A");
    expect(decoded).toContain("B");
  });
  it("decode returns null on plain text", () => {
    expect(decodeSteganography("no hidden chars")).toBeNull();
  });
  it("decoded bits map correctly", () => {
    // "A" = 0x41 = 01000001 → 0,1,0,0,0,0,0,1 → ZWSP, ZWNJ, ZWSP×6, ZWNJ
    const encoded = "\u200B\u200C\u200B\u200B\u200B\u200B\u200B\u200C";
    const decoded = decodeSteganography(encoded);
    expect(decoded).toBe("A");
  });
});

describe("batchDetect", () => {
  it("processes multiple texts", () => {
    const results = batchDetect(["clean", "has\u200Bzwsp"]);
    expect(results.length).toBe(2);
    expect(results[1]!.total).toBe(1);
    expect(results[0]!.total).toBe(0);
  });
});

describe("toCsv", () => {
  it("produces CSV with header", () => {
    const r = detectHidden("a\u200Bb");
    const csv = toCsv(r);
    expect(csv.split("\n")[0]).toContain("Offset");
    expect(csv).toContain("U+200B");
  });
});
