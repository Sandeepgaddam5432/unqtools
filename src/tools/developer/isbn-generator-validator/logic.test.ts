import { describe, it, expect, beforeEach } from "vitest";
import {
  ISBN_GROUPS,
  CANONICAL_VALID_ISBNS,
  CANONICAL_INVALID_ISBNS,
  HONESTY_BANNER,
  mulberry32,
  hashSeed,
  createRng,
  normalizeIsbn,
  detectVersion,
  computeIsbn10Check,
  computeIsbn13Check,
  verifyIsbn10,
  verifyIsbn13,
  validateIsbn,
  findGroup,
  findPublisher,
  parseIsbn,
  hyphenateIsbn,
  generateIsbn10,
  generateIsbn13,
  generateBatch,
  isbn10to13,
  isbn13to10,
  convertIsbn,
  parseBatchInput,
  validateBatch,
  summarizeBatch,
  renderBatchCsv,
  renderEan13Text,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type IsbnVersion,
  type IsbnFormat,
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

describe("isbn-generator-validator constants", () => {
  it("ships 10+ registration groups in the range table", () => {
    expect(ISBN_GROUPS.length).toBeGreaterThanOrEqual(10);
  });
  it("includes English (0), French (2), German (3), Japanese (4) groups", () => {
    const groups = ISBN_GROUPS.map((g) => g.group);
    expect(groups).toContain("0");
    expect(groups).toContain("2");
    expect(groups).toContain("3");
    expect(groups).toContain("4");
  });
  it("ships canonical valid ISBN test vectors", () => {
    expect(CANONICAL_VALID_ISBNS.length).toBeGreaterThanOrEqual(10);
  });
  it("ships canonical invalid ISBN test vectors", () => {
    expect(CANONICAL_INVALID_ISBNS.length).toBeGreaterThanOrEqual(3);
  });
  it("has honesty banner text", () => {
    expect(HONESTY_BANNER.length).toBeGreaterThan(20);
    expect(HONESTY_BANNER).toContain("UNREGISTERED");
  });
});

describe("isbn-generator-validator PRNG", () => {
  it("mulberry32 is deterministic for same seed", () => {
    const r1 = mulberry32(42);
    const r2 = mulberry32(42);
    expect(r1()).toBe(r2());
  });
  it("hashSeed handles strings and numbers", () => {
    expect(hashSeed(42)).toBe(42);
    expect(hashSeed("isbn")).toBe(hashSeed("isbn"));
    expect(hashSeed("isbn")).not.toBe(hashSeed("isbn2"));
  });
  it("createRng.int is inclusive on both ends", () => {
    const rng = createRng("seed-1");
    for (let i = 0; i < 100; i++) {
      const n = rng.int(3, 5);
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(5);
    }
  });
  it("createRng.pick returns an element of the array", () => {
    const rng = createRng("seed-2");
    const arr = ["a", "b", "c"];
    for (let i = 0; i < 20; i++) {
      expect(arr).toContain(rng.pick(arr));
    }
  });
});

describe("isbn-generator-validator normalizeIsbn", () => {
  it("strips hyphens and whitespace", () => {
    expect(normalizeIsbn("978-0-306-40615-7")).toBe("9780306406157");
  });
  it("uppercases lowercase x", () => {
    expect(normalizeIsbn("020161622x")).toBe("020161622X");
  });
  it("handles empty input", () => {
    expect(normalizeIsbn("")).toBe("");
  });
});

describe("isbn-generator-validator detectVersion", () => {
  it("detects ISBN-10 with digit check", () => {
    expect(detectVersion("0306406152")).toBe("isbn10");
  });
  it("detects ISBN-10 with X check digit", () => {
    expect(detectVersion("020161622X")).toBe("isbn10");
  });
  it("detects ISBN-13", () => {
    expect(detectVersion("9780306406157")).toBe("isbn13");
  });
  it("returns null for wrong length", () => {
    expect(detectVersion("12345")).toBeNull();
    expect(detectVersion("123456789012")).toBeNull(); // 12 digits
    expect(detectVersion("12345678901234")).toBeNull(); // 14 digits
  });
  it("returns null for empty input", () => {
    expect(detectVersion("")).toBeNull();
  });
});

describe("isbn-generator-validator check digit algorithms", () => {
  it("computeIsbn10Check: Wikipedia example (030640615 → 2)", () => {
    expect(computeIsbn10Check("030640615")).toBe("2");
  });
  it("computeIsbn10Check: Pragmatic Programmer (020161622 → X)", () => {
    expect(computeIsbn10Check("020161622")).toBe("X");
  });
  it("computeIsbn10Check throws on bad input length", () => {
    expect(() => computeIsbn10Check("12345")).toThrow();
  });
  it("computeIsbn13Check: Wikipedia example (978030640615 → 7)", () => {
    expect(computeIsbn13Check("978030640615")).toBe("7");
  });
  it("computeIsbn13Check throws on bad input length", () => {
    expect(() => computeIsbn13Check("12345")).toThrow();
  });
  it("verifyIsbn10 returns true for valid, false for invalid", () => {
    expect(verifyIsbn10("0306406152")).toBe(true);
    expect(verifyIsbn10("0306406153")).toBe(false);
  });
  it("verifyIsbn10 accepts X check digit", () => {
    expect(verifyIsbn10("020161622X")).toBe(true);
  });
  it("verifyIsbn13 returns true for valid, false for invalid", () => {
    expect(verifyIsbn13("9780306406157")).toBe(true);
    expect(verifyIsbn13("9780306406158")).toBe(false);
  });
});

describe("isbn-generator-validator validateIsbn", () => {
  it("accepts valid ISBN-10", () => {
    const r = validateIsbn("0306406152");
    expect(r.valid).toBe(true);
    expect(r.version).toBe("isbn10");
    expect(r.code).toBe("ok");
    expect(r.checkDigit).toBe("2");
  });
  it("accepts valid ISBN-13", () => {
    const r = validateIsbn("9780306406157");
    expect(r.valid).toBe(true);
    expect(r.version).toBe("isbn13");
    expect(r.code).toBe("ok");
  });
  it("accepts hyphenated input", () => {
    const r = validateIsbn("978-0-306-40615-7");
    expect(r.valid).toBe(true);
    expect(r.normalized).toBe("9780306406157");
  });
  it("rejects empty input", () => {
    const r = validateIsbn("");
    expect(r.valid).toBe(false);
    expect(r.code).toBe("empty");
  });
  it("rejects ISBN-10 with bad checksum", () => {
    const r = validateIsbn("0306406153");
    expect(r.valid).toBe(false);
    expect(r.code).toBe("bad_checksum");
    expect(r.message).toContain("2");
  });
  it("rejects ISBN-13 with bad checksum", () => {
    const r = validateIsbn("9780306406158");
    expect(r.valid).toBe(false);
    expect(r.code).toBe("bad_checksum");
  });
  it("rejects ISBN-13 with wrong prefix", () => {
    const r = validateIsbn("1230306406157");
    expect(r.valid).toBe(false);
    expect(r.message).toContain("978 or 979");
  });
  it("rejects ISBN-10 with X in non-final position", () => {
    const r = validateIsbn("X201616222");
    expect(r.valid).toBe(false);
    expect(r.code).toBe("bad_x_position");
  });
  it("rejects wrong-length input", () => {
    const r = validateIsbn("123456789");
    expect(r.valid).toBe(false);
    expect(r.code).toBe("wrong_length");
  });
  it("rejects non-digit/non-X characters", () => {
    const r = validateIsbn("030640615A");
    expect(r.valid).toBe(false);
    expect(r.code).toBe("bad_chars");
  });
  it("all canonical valid ISBNs pass", () => {
    for (const v of CANONICAL_VALID_ISBNS) {
      if (v.version === "isbn10" || v.version === "isbn13") {
        // The Wikipedia 9-digit-body vector is not a full ISBN — skip it.
        if (v.isbn.length === 9) continue;
        const r = validateIsbn(v.isbn);
        expect(r.valid, `expected ${v.isbn} (${v.note}) to be valid`).toBe(true);
      }
    }
  });
  it("all canonical invalid ISBNs fail", () => {
    for (const v of CANONICAL_INVALID_ISBNS) {
      const r = validateIsbn(v.isbn);
      expect(r.valid, `expected ${v.isbn} (${v.note}) to be invalid`).toBe(false);
    }
  });
});

describe("isbn-generator-validator range table lookups", () => {
  it("findGroup matches single-digit English group", () => {
    const r = findGroup("030640615");
    expect(r).not.toBeNull();
    expect(r!.spec.group).toBe("0");
    expect(r!.consumed).toBe(1);
  });
  it("findGroup matches two-digit Italian group", () => {
    const r = findGroup("884291234");
    expect(r).not.toBeNull();
    expect(r!.spec.group).toBe("88");
  });
  it("findGroup returns null for unknown prefix", () => {
    const r = findGroup("639999999");
    expect(r).toBeNull();
  });
  it("findPublisher matches a known range within group 0", () => {
    const group0 = ISBN_GROUPS.find((g) => g.group === "0")!;
    const r = findPublisher(group0, "30640615");
    expect(r).not.toBeNull();
    expect(r!.consumed).toBe(3); // 306 is a 3-digit publisher
  });
});

describe("isbn-generator-validator parseIsbn", () => {
  it("parses ISBN-10 into group/publisher/title/check", () => {
    const p = parseIsbn("0306406152");
    expect(p).not.toBeNull();
    expect(p!.version).toBe("isbn10");
    expect(p!.group).toBe("0");
    expect(p!.publisher).toBe("306");
    expect(p!.check).toBe("2");
    expect(p!.hyphenated).toBe("0-306-40615-2");
  });
  it("parses ISBN-13 into prefix/group/publisher/title/check", () => {
    const p = parseIsbn("9780306406157");
    expect(p).not.toBeNull();
    expect(p!.prefix).toBe("978");
    expect(p!.group).toBe("0");
    expect(p!.publisher).toBe("306");
    expect(p!.title).toBe("40615");
    expect(p!.check).toBe("7");
    expect(p!.hyphenated).toBe("978-0-306-40615-7");
  });
  it("parses ISBN-10 with X check digit", () => {
    const p = parseIsbn("020161622X");
    expect(p).not.toBeNull();
    expect(p!.check).toBe("X");
    expect(p!.hyphenated).toContain("-X");
  });
  it("returns null for unparseable input", () => {
    expect(parseIsbn("not an isbn")).toBeNull();
    expect(parseIsbn("")).toBeNull();
  });
  it("hyphenateIsbn falls back to raw when group unresolved", () => {
    // 6399... is not in our compact group table.
    expect(hyphenateIsbn("6399999999")).toBe("6399999999");
  });
});

describe("isbn-generator-validator generation", () => {
  it("generateIsbn10 produces valid ISBN-10", () => {
    const rng = createRng("test-1");
    for (let i = 0; i < 20; i++) {
      const isbn = generateIsbn10(rng);
      expect(isbn).toHaveLength(10);
      expect(verifyIsbn10(isbn)).toBe(true);
    }
  });
  it("generateIsbn10 with group hint produces ISBN in that group", () => {
    const rng = createRng("test-2");
    const isbn = generateIsbn10(rng, "0");
    expect(isbn[0]).toBe("0");
    expect(verifyIsbn10(isbn)).toBe(true);
  });
  it("generateIsbn13 produces valid ISBN-13 with 978 prefix", () => {
    const rng = createRng("test-3");
    for (let i = 0; i < 20; i++) {
      const isbn = generateIsbn13(rng);
      expect(isbn).toHaveLength(13);
      expect(isbn.startsWith("978")).toBe(true);
      expect(verifyIsbn13(isbn)).toBe(true);
    }
  });
  it("generateIsbn13 with 979 prefix produces valid ISBN-13", () => {
    const rng = createRng("test-4");
    const isbn = generateIsbn13(rng, { prefix: "979" });
    expect(isbn.startsWith("979")).toBe(true);
    expect(verifyIsbn13(isbn)).toBe(true);
  });
  it("generateBatch produces count ISBNs all valid", () => {
    const batch = generateBatch({
      version: "isbn13", count: 50, seed: "batch-1", prefix: "978",
    });
    expect(batch).toHaveLength(50);
    for (const b of batch) {
      expect(verifyIsbn13(b.isbn)).toBe(true);
      expect(b.version).toBe("isbn13");
    }
  });
  it("generateBatch is deterministic for same seed", () => {
    const a = generateBatch({ version: "isbn10", count: 5, seed: "det" });
    const b = generateBatch({ version: "isbn10", count: 5, seed: "det" });
    expect(a.map((x) => x.isbn)).toEqual(b.map((x) => x.isbn));
  });
  it("generateBatch caps at 1000", () => {
    const batch = generateBatch({ version: "isbn10", count: 5000, seed: "cap" });
    expect(batch).toHaveLength(1000);
  });
  it("generateBatch handles count 0", () => {
    const batch = generateBatch({ version: "isbn10", count: 0, seed: "zero" });
    expect(batch).toHaveLength(0);
  });
});

describe("isbn-generator-validator conversion", () => {
  it("isbn10to13 converts valid ISBN-10", () => {
    expect(isbn10to13("0306406152")).toBe("9780306406157");
  });
  it("isbn10to13 returns null for bad input", () => {
    expect(isbn10to13("bad")).toBeNull();
    expect(isbn10to13("03064061")).toBeNull(); // 8 digits
    expect(isbn10to13("03064061522")).toBeNull(); // 11 chars
  });
  it("isbn13to10 converts 978-prefixed ISBN-13", () => {
    expect(isbn13to10("9780306406157")).toBe("0306406152");
  });
  it("isbn13to10 returns null for 979 prefix", () => {
    expect(isbn13to10("9790306406154")).toBeNull();
  });
  it("isbn13to10 returns null for bad input", () => {
    expect(isbn13to10("bad")).toBeNull();
  });
  it("convertIsbn ISBN-10 → ISBN-13 succeeds", () => {
    const r = convertIsbn("0306406152", "isbn13");
    expect(r.ok).toBe(true);
    expect(r.output).toBe("9780306406157");
    expect(r.message).toContain("978");
  });
  it("convertIsbn ISBN-13 → ISBN-10 succeeds for 978", () => {
    const r = convertIsbn("9780306406157", "isbn10");
    expect(r.ok).toBe(true);
    expect(r.output).toBe("0306406152");
  });
  it("convertIsbn ISBN-13 → ISBN-10 fails for 979 with helpful message", () => {
    const r = convertIsbn("9790306406154", "isbn10");
    expect(r.ok).toBe(false);
    expect(r.message).toContain("979");
  });
  it("convertIsbn detects no-op when already target version", () => {
    const r = convertIsbn("0306406152", "isbn10");
    expect(r.ok).toBe(true);
    expect(r.output).toBe("0306406152");
    expect(r.message).toContain("already");
  });
  it("convertIsbn rejects invalid input", () => {
    const r = convertIsbn("not-an-isbn", "isbn13");
    expect(r.ok).toBe(false);
  });
  it("round-trip ISBN-10 → ISBN-13 → ISBN-10 returns original (for 978 prefix)", () => {
    const original = "0306406152";
    const step1 = isbn10to13(original)!;
    const step2 = isbn13to10(step1)!;
    expect(step2).toBe(original);
  });
});

describe("isbn-generator-validator batch operations", () => {
  it("parseBatchInput splits on newlines, commas, semicolons, whitespace", () => {
    expect(parseBatchInput("a\nb,c;d e")).toEqual(["a", "b", "c", "d", "e"]);
  });
  it("parseBatchInput skips blanks", () => {
    expect(parseBatchInput("a\n\n  \nb")).toEqual(["a", "b"]);
  });
  it("parseBatchInput handles empty input", () => {
    expect(parseBatchInput("")).toEqual([]);
  });
  it("validateBatch marks valid and invalid rows", () => {
    const rows = validateBatch(["0306406152", "0306406153", "9780306406157"]);
    expect(rows).toHaveLength(3);
    expect(rows[0]!.valid).toBe(true);
    expect(rows[1]!.valid).toBe(false);
    expect(rows[2]!.valid).toBe(true);
  });
  it("summarizeBatch counts valid/invalid and version breakdown", () => {
    const rows = validateBatch(["0306406152", "0306406153", "9780306406157"]);
    const s = summarizeBatch(rows);
    expect(s.total).toBe(3);
    expect(s.valid).toBe(2);
    expect(s.invalid).toBe(1);
    expect(s.isbn10Count).toBe(1);
    expect(s.isbn13Count).toBe(1);
  });
  it("renderBatchCsv produces header + rows", () => {
    const rows = validateBatch(["0306406152"]);
    const csv = renderBatchCsv(rows);
    expect(csv).toContain("index,raw,normalized,valid,version,code,message");
    expect(csv).toContain("0306406152");
    expect(csv).toContain("isbn10");
    expect(csv).toContain("ok");
  });
  it("batch validates 1000 ISBNs without crashing", () => {
    const batch = generateBatch({ version: "isbn13", count: 1000, seed: "big" });
    const raws = batch.map((b) => b.isbn);
    const rows = validateBatch(raws);
    const s = summarizeBatch(rows);
    expect(s.total).toBe(1000);
    expect(s.valid).toBe(1000);
    expect(s.invalid).toBe(0);
  });
});

describe("isbn-generator-validator EAN-13 text art", () => {
  it("renders ASCII art for valid ISBN-13", () => {
    const art = renderEan13Text("9780306406157");
    expect(art).toContain("||");
    // The first digit (9) appears on its own row; the 12 remaining digits
    // appear as two groups of 6 in the bottom row.
    expect(art).toContain("9");
    expect(art).toContain("780306");
    expect(art).toContain("406157");
  });
  it("returns empty for invalid input", () => {
    expect(renderEan13Text("bad")).toBe("");
    expect(renderEan13Text("")).toBe("");
  });
});

describe("isbn-generator-validator history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1, action: "generate", version: "isbn13",
      generateCount: 10, batchTotal: 0, batchValid: 0, batchInvalid: 0,
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i, action: "generate", version: "isbn10",
        generateCount: 1, batchTotal: 0, batchValid: 0, batchInvalid: 0,
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1, action: "generate", version: "isbn10",
      generateCount: 1, batchTotal: 0, batchValid: 0, batchInvalid: 0,
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("isbn-generator-validator shareable URL", () => {
  it("builds share URL with mode and params", () => {
    const url = buildShareUrl("generate", { version: "isbn13", count: "10" });
    expect(url).toContain("mode=generate");
    expect(url).toContain("version=isbn13");
    expect(url).toContain("count=10");
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("mode=generate&version=isbn13&count=10");
    expect(p.mode).toBe("generate");
    expect(p.params.version).toBe("isbn13");
    expect(p.params.count).toBe("10");
  });
  it("handles empty hash with defaults", () => {
    const p = parseShareUrl("");
    expect(p.mode).toBe("generate");
    expect(p.params).toEqual({});
  });
  it("filters unknown mode to generate", () => {
    const p = parseShareUrl("mode=unknown&foo=bar");
    expect(p.mode).toBe("generate");
    expect(p.params.foo).toBe("bar");
  });
  it("buildShareUrl falls back to query string when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("validate", { isbn: "9780306406157" });
    expect(url).toContain("?");
    expect(url).toContain("mode=validate");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
});

// Suppress unused-import lint for type-only imports
export type _Unused = IsbnVersion | IsbnFormat;
