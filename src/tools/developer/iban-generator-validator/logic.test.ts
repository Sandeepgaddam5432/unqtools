import { describe, it, expect, beforeEach } from "vitest";
import {
  IBAN_REGISTRY,
  COUNTRY_LIST,
  CANONICAL_VALID_IBANS,
  CANONICAL_INVALID_IBANS,
  getCountrySpec,
  listCountries,
  mulberry32,
  hashSeed,
  createRng,
  normalizeIban,
  charToValue,
  alphaToDigits,
  mod97,
  validateIban,
  bbanMatchesStructure,
  charMatchesType,
  computeCheckDigits,
  generateBban,
  generateIban,
  generateIbanBatch,
  decodeIban,
  formatIban,
  maskIban,
  parseBatchInput,
  validateBatch,
  summarizeBatch,
  renderBatchCsv,
  autocompleteIban,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  HONESTY_BANNER,
  type IbanFormat,
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

describe("iban-generator-validator constants", () => {
  it("ships 70+ countries in the registry", () => {
    expect(Object.keys(IBAN_REGISTRY).length).toBeGreaterThanOrEqual(70);
  });
  it("exposes a sorted country list", () => {
    expect(COUNTRY_LIST).toEqual([...COUNTRY_LIST].sort());
    expect(COUNTRY_LIST).toContain("DE");
    expect(COUNTRY_LIST).toContain("GB");
    expect(COUNTRY_LIST).toContain("FR");
  });
  it("ships canonical valid IBAN test vectors", () => {
    expect(CANONICAL_VALID_IBANS.length).toBeGreaterThanOrEqual(10);
  });
  it("ships canonical invalid IBAN test vectors", () => {
    expect(CANONICAL_INVALID_IBANS.length).toBeGreaterThanOrEqual(3);
  });
  it("has honesty banner text", () => {
    expect(HONESTY_BANNER.length).toBeGreaterThan(20);
  });
});

describe("iban-generator-validator registry lookups", () => {
  it("looks up a known country spec", () => {
    const de = getCountrySpec("DE");
    expect(de).not.toBeNull();
    expect(de!.name).toBe("Germany");
    expect(de!.length).toBe(22);
  });
  it("returns null for unknown country", () => {
    expect(getCountrySpec("ZZ")).toBeNull();
    expect(getCountrySpec("")).toBeNull();
  });
  it("lowercases input is normalized to upper", () => {
    expect(getCountrySpec("de")!.country).toBe("DE");
  });
  it("listCountries returns array of meta", () => {
    const list = listCountries();
    expect(list.length).toBeGreaterThanOrEqual(70);
    expect(list[0]!.country).toBe("AD");
  });
});

describe("iban-generator-validator PRNG", () => {
  it("mulberry32 is deterministic for same seed", () => {
    const r1 = mulberry32(42);
    const r2 = mulberry32(42);
    expect(r1()).toBe(r2());
  });
  it("hashSeed handles strings and numbers", () => {
    expect(typeof hashSeed("hello")).toBe("number");
    expect(typeof hashSeed(42)).toBe("number");
    expect(hashSeed("hello")).not.toBe(hashSeed("world"));
  });
  it("createRng returns bounded int", () => {
    const rng = createRng("seed");
    for (let i = 0; i < 20; i++) {
      const n = rng.int(0, 9);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThanOrEqual(9);
    }
  });
  it("createRng.pick returns an element from the array", () => {
    const rng = createRng("seed");
    const arr = ["a", "b", "c"];
    expect(arr).toContain(rng.pick(arr));
  });
});

describe("iban-generator-validator normalizeIban", () => {
  it("uppercases and strips spaces", () => {
    expect(normalizeIban("gb82 west 1234 5698 7654 32")).toBe("GB82WEST12345698765432");
  });
  it("handles empty", () => {
    expect(normalizeIban("")).toBe("");
  });
  it("strips tabs and newlines", () => {
    expect(normalizeIban("GB82\tWEST\n1234")).toBe("GB82WEST1234");
  });
});

describe("iban-generator-validator charToValue", () => {
  it("returns 0-9 for digits", () => {
    expect(charToValue("0")).toBe(0);
    expect(charToValue("9")).toBe(9);
  });
  it("returns 10-35 for A-Z", () => {
    expect(charToValue("A")).toBe(10);
    expect(charToValue("Z")).toBe(35);
  });
  it("is case-insensitive", () => {
    expect(charToValue("a")).toBe(10);
    expect(charToValue("z")).toBe(35);
  });
  it("throws on invalid chars", () => {
    expect(() => charToValue("!")).toThrow();
  });
});

describe("iban-generator-validator alphaToDigits", () => {
  it("converts a known IBAN rearrangement", () => {
    // GB82WEST12345698765432 — country code GB → 1611, check digits stay
    // For "WEST12345698765432GB82":
    // W=32, E=14, S=28, T=29 → "32142829"
    expect(alphaToDigits("WEST")).toBe("32142829");
  });
  it("leaves digit-only strings unchanged", () => {
    expect(alphaToDigits("12345")).toBe("12345");
  });
  it("mixes letters and digits", () => {
    expect(alphaToDigits("AB12")).toBe("101112");
  });
});

describe("iban-generator-validator mod97", () => {
  it("computes mod 97 for the GB example rearranged string", () => {
    // Wikipedia: GB82WEST12345698765432
    // Rearrange: WEST12345698765432GB82
    // → 3214282912345698765432161182
    // mod 97 should be 1 (valid)
    const digits = alphaToDigits("WEST12345698765432GB82");
    expect(mod97(digits)).toBe(1);
  });
  it("handles short digit strings", () => {
    expect(mod97("97")).toBe(0);
    expect(mod97("100")).toBe(3);
  });
  it("handles very long digit strings (chunked)", () => {
    // 50 nines
    const s = "9".repeat(50);
    const result = mod97(s);
    // Doesn't overflow — should be a non-negative integer < 97
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThan(97);
    // Compare against BigInt reference
    const expected = Number(BigInt(s) % BigInt(97));
    expect(result).toBe(expected);
  });
  it("throws on non-digit input", () => {
    expect(() => mod97("abc")).toThrow();
  });
});

describe("iban-generator-validator computeCheckDigits", () => {
  it("computes the GB check digits (82)", () => {
    expect(computeCheckDigits("GB", "WEST12345698765432")).toBe("82");
  });
  it("computes the DE check digits (89)", () => {
    expect(computeCheckDigits("DE", "370400440532013000")).toBe("89");
  });
  it("computes the BE check digits (68)", () => {
    expect(computeCheckDigits("BE", "539007547034")).toBe("68");
  });
  it("zero-pads single-digit results", () => {
    // Find a case where check digit would be < 10 — use a made-up BBAN
    // The function should always return 2 chars
    const cd = computeCheckDigits("AT", "1904300234573201");
    expect(cd.length).toBe(2);
  });
  it("throws on invalid country code", () => {
    expect(() => computeCheckDigits("12", "ABC")).toThrow();
  });
});

describe("iban-generator-validator validateIban", () => {
  it("accepts all canonical valid IBANs", () => {
    for (const v of CANONICAL_VALID_IBANS) {
      const r = validateIban(v.iban);
      expect(r.valid, `${v.iban} should be valid: ${r.message}`).toBe(true);
      expect(r.code).toBe("valid");
      expect(r.country).toBe(v.country);
    }
  });
  it("rejects all canonical invalid IBANs", () => {
    for (const v of CANONICAL_INVALID_IBANS) {
      const r = validateIban(v.iban);
      expect(r.valid, `${v.iban} should be invalid`).toBe(false);
    }
  });
  it("flags empty input", () => {
    const r = validateIban("");
    expect(r.valid).toBe(false);
    expect(r.code).toBe("empty");
  });
  it("flags too-short input", () => {
    const r = validateIban("GB82");
    expect(r.valid).toBe(false);
    expect(r.code).toBe("too_short");
  });
  it("flags bad characters", () => {
    const r = validateIban("GB82!WEST12345698765432");
    expect(r.valid).toBe(false);
    expect(r.code).toBe("bad_chars");
  });
  it("flags unknown country", () => {
    const r = validateIban("ZZ82WEST12345698765432");
    expect(r.valid).toBe(false);
    expect(r.code).toBe("unknown_country");
  });
  it("flags wrong length", () => {
    // GB expects 22 chars — give it 20
    const r = validateIban("GB82WEST123456987654");
    expect(r.valid).toBe(false);
    expect(r.code).toBe("wrong_length");
    expect(r.expectedLength).toBe(22);
  });
  it("flags bad MOD-97 checksum", () => {
    // Last digit changed from 2 to 3
    const r = validateIban("GB82WEST12345698765433");
    expect(r.valid).toBe(false);
    expect(r.code).toBe("bad_checksum");
    expect(r.mod97Remainder).not.toBe(1);
  });
  it("normalizes lowercase + spaces before validating", () => {
    const r = validateIban("gb82 west 1234 5698 7654 32");
    expect(r.valid).toBe(true);
  });
});

describe("iban-generator-validator bbanMatchesStructure & charMatchesType", () => {
  it("charMatchesType works for n/a/c", () => {
    expect(charMatchesType("5", "n")).toBe(true);
    expect(charMatchesType("A", "n")).toBe(false);
    expect(charMatchesType("A", "a")).toBe(true);
    expect(charMatchesType("5", "a")).toBe(false);
    expect(charMatchesType("A", "c")).toBe(true);
    expect(charMatchesType("5", "c")).toBe(true);
  });
  it("matches a valid DE BBAN (18n)", () => {
    expect(bbanMatchesStructure("370400440532013000", IBAN_REGISTRY.DE.bban)).toBe(true);
  });
  it("rejects letters in numeric-only segment", () => {
    expect(bbanMatchesStructure("37040044053201300A", IBAN_REGISTRY.DE.bban)).toBe(false);
  });
  it("rejects wrong total length", () => {
    expect(bbanMatchesStructure("37040044053201300", IBAN_REGISTRY.DE.bban)).toBe(false);
  });
  it("matches a valid GB BBAN (4a,6n,8n)", () => {
    expect(bbanMatchesStructure("WEST12345698765432", IBAN_REGISTRY.GB.bban)).toBe(true);
  });
});

describe("iban-generator-validator generateIban", () => {
  it("generates a valid IBAN for Germany", () => {
    const rng = createRng("test-seed");
    const iban = generateIban("DE", rng);
    expect(iban.length).toBe(22);
    expect(iban.startsWith("DE")).toBe(true);
    const r = validateIban(iban);
    expect(r.valid).toBe(true);
  });
  it("generates valid IBANs for every country in the registry", () => {
    const rng = createRng("all-countries");
    for (const cc of COUNTRY_LIST) {
      const iban = generateIban(cc, rng);
      const r = validateIban(iban);
      expect(r.valid, `${cc}: ${iban} should be valid — ${r.message}`).toBe(true);
    }
  });
  it("is deterministic for the same seed", () => {
    const r1 = createRng("seeded");
    const r2 = createRng("seeded");
    expect(generateIban("FR", r1)).toBe(generateIban("FR", r2));
  });
  it("throws on unknown country", () => {
    const rng = createRng("x");
    expect(() => generateIban("ZZ", rng)).toThrow();
  });
});

describe("iban-generator-validator generateBban", () => {
  it("generates a BBAN of the correct length", () => {
    const rng = createRng("test");
    const bban = generateBban(IBAN_REGISTRY.FR, rng);
    // FR BBAN: 10n + 11c + 2n = 23
    expect(bban.length).toBe(23);
  });
  it("generates a BBAN matching the segment structure", () => {
    const rng = createRng("test");
    const bban = generateBban(IBAN_REGISTRY.GB, rng);
    expect(bbanMatchesStructure(bban, IBAN_REGISTRY.GB.bban)).toBe(true);
  });
});

describe("iban-generator-validator generateIbanBatch", () => {
  it("generates the requested count", () => {
    const batch = generateIbanBatch({ country: "DE", count: 50, seed: "x" });
    expect(batch).toHaveLength(50);
    for (const iban of batch) {
      expect(validateIban(iban).valid).toBe(true);
    }
  });
  it("caps at 1000", () => {
    const batch = generateIbanBatch({ country: "DE", count: 5000, seed: "x" });
    expect(batch).toHaveLength(1000);
  });
  it("is deterministic with the same seed", () => {
    const a = generateIbanBatch({ country: "GB", count: 5, seed: "abc" });
    const b = generateIbanBatch({ country: "GB", count: 5, seed: "abc" });
    expect(a).toEqual(b);
  });
  it("throws on unknown country", () => {
    expect(() => generateIbanBatch({ country: "ZZ", count: 5, seed: "x" })).toThrow();
  });
  it("handles count=0", () => {
    expect(generateIbanBatch({ country: "DE", count: 0, seed: "x" })).toEqual([]);
  });
});

describe("iban-generator-validator decodeIban", () => {
  it("decodes a GB IBAN into segments", () => {
    const d = decodeIban("GB82WEST12345698765432");
    expect(d).not.toBeNull();
    expect(d!.country).toBe("GB");
    expect(d!.countryName).toBe("United Kingdom");
    expect(d!.checkDigits).toBe("82");
    expect(d!.bban).toBe("WEST12345698765432");
    expect(d!.segments.length).toBe(3);
    expect(d!.segments[0]!.label).toBe("Bank (BIC)");
    expect(d!.segments[0]!.value).toBe("WEST");
    expect(d!.segments[1]!.label).toBe("Sort code");
    expect(d!.segments[1]!.value).toBe("123456");
    expect(d!.segments[2]!.label).toBe("Account");
    expect(d!.segments[2]!.value).toBe("98765432");
  });
  it("decodes a DE IBAN (single numeric segment)", () => {
    const d = decodeIban("DE89370400440532013000");
    expect(d).not.toBeNull();
    expect(d!.country).toBe("DE");
    expect(d!.bban).toBe("370400440532013000");
    expect(d!.segments).toHaveLength(1);
  });
  it("returns null for unknown country", () => {
    expect(decodeIban("ZZ12ABC")).toBeNull();
  });
  it("returns null for too-short input", () => {
    expect(decodeIban("DE")).toBeNull();
  });
});

describe("iban-generator-validator formatIban & maskIban", () => {
  it("formats electronic (no spaces)", () => {
    expect(formatIban("GB82WEST12345698765432", "electronic")).toBe("GB82WEST12345698765432");
  });
  it("formats print (4-char groups)", () => {
    expect(formatIban("GB82WEST12345698765432", "print")).toBe("GB82 WEST 1234 5698 7654 32");
  });
  it("normalizes input before formatting", () => {
    expect(formatIban("gb82 west 1234 5698 7654 32", "electronic")).toBe("GB82WEST12345698765432");
  });
  it("masks all but first 4 and last 4", () => {
    const masked = maskIban("GB82WEST12345698765432");
    expect(masked.startsWith("GB82")).toBe(true);
    expect(masked.endsWith("5432")).toBe(true);
    expect(masked).toContain("•");
    expect(masked.length).toBe(22);
  });
  it("returns short IBANs as-is", () => {
    expect(maskIban("GB82")).toBe("GB82");
  });
});

describe("iban-generator-validator batch validation", () => {
  it("parses newline-separated input", () => {
    expect(parseBatchInput("GB82WEST12345698765432\nDE89370400440532013000"))
      .toEqual(["GB82WEST12345698765432", "DE89370400440532013000"]);
  });
  it("parses comma-separated input", () => {
    expect(parseBatchInput("GB82WEST12345698765432, DE89370400440532013000"))
      .toEqual(["GB82WEST12345698765432", "DE89370400440532013000"]);
  });
  it("skips blank lines", () => {
    expect(parseBatchInput("GB82WEST12345698765432\n\n\nDE89370400440532013000"))
      .toEqual(["GB82WEST12345698765432", "DE89370400440532013000"]);
  });
  it("returns empty for empty input", () => {
    expect(parseBatchInput("")).toEqual([]);
  });
  it("validates a mix of valid and invalid", () => {
    const rows = validateBatch([
      "GB82WEST12345698765432",
      "DE89370400440532013000",
      "GB82WEST12345698765433",
    ]);
    expect(rows).toHaveLength(3);
    expect(rows[0]!.valid).toBe(true);
    expect(rows[1]!.valid).toBe(true);
    expect(rows[2]!.valid).toBe(false);
    expect(rows[2]!.code).toBe("bad_checksum");
  });
  it("summarizes by country", () => {
    const rows = validateBatch([
      "GB82WEST12345698765432",
      "DE89370400440532013000",
      "GB82WEST12345698765433",
    ]);
    const s = summarizeBatch(rows);
    expect(s.total).toBe(3);
    expect(s.valid).toBe(2);
    expect(s.invalid).toBe(1);
    expect(s.byCountry["United Kingdom"]).toBe(2);
    expect(s.byCountry["Germany"]).toBe(1);
  });
  it("returns zeros for empty input", () => {
    const s = summarizeBatch([]);
    expect(s.total).toBe(0);
    expect(s.valid).toBe(0);
  });
});

describe("iban-generator-validator renderBatchCsv", () => {
  it("renders header row", () => {
    expect(renderBatchCsv([])).toContain("index,raw,normalized,valid,code,country,message");
  });
  it("renders data rows", () => {
    const rows = validateBatch(["GB82WEST12345698765432"]);
    const csv = renderBatchCsv(rows);
    expect(csv).toContain("0,GB82WEST12345698765432,GB82WEST12345698765432,valid,valid,United Kingdom,");
  });
  it("escapes commas in raw input", () => {
    const rows = validateBatch(["GB82 WEST,1234 5698 7654 32"]);
    const csv = renderBatchCsv(rows);
    expect(csv).toContain('"');
  });
});

describe("iban-generator-validator autocompleteIban", () => {
  it("fills in ? placeholders with valid characters", () => {
    const rng = createRng("auto");
    const filled = autocompleteIban("DE??37040044053201300?", rng);
    expect(filled.length).toBe(22);
    expect(filled.startsWith("DE")).toBe(true);
    expect(validateIban(filled).valid).toBe(true);
    expect(filled).not.toContain("?");
  });
  it("preserves known characters", () => {
    const rng = createRng("auto");
    const filled = autocompleteIban("GB82WEST??????????????", rng);
    expect(filled.startsWith("GB")).toBe(true);
    expect(filled.slice(4, 8)).toBe("WEST");
    expect(validateIban(filled).valid).toBe(true);
  });
  it("throws on unknown country", () => {
    const rng = createRng("auto");
    expect(() => autocompleteIban("ZZ12????", rng)).toThrow();
  });
  it("is deterministic for same seed", () => {
    const r1 = createRng("seeded");
    const r2 = createRng("seeded");
    expect(autocompleteIban("FR???????????????????????", r1))
      .toBe(autocompleteIban("FR???????????????????????", r2));
  });
});

describe("iban-generator-validator history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1,
      action: "generate",
      country: "DE",
      format: "print",
      generateCount: 10,
      batchTotal: 0,
      batchValid: 0,
      batchInvalid: 0,
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20 entries", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i,
        action: "generate",
        country: "DE",
        format: "print",
        generateCount: 1,
        batchTotal: 0,
        batchValid: 0,
        batchInvalid: 0,
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1,
      action: "generate",
      country: "DE",
      format: "print",
      generateCount: 1,
      batchTotal: 0,
      batchValid: 0,
      batchInvalid: 0,
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("iban-generator-validator shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("DE", 10, "print");
    expect(url).toContain("cc=DE");
    expect(url).toContain("count=10");
    expect(url).toContain("fmt=print");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("cc=FR&count=50&fmt=electronic");
    expect(p.country).toBe("FR");
    expect(p.count).toBe(50);
    expect(p.format).toBe("electronic");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({ country: "DE", count: 10, format: "print" });
  });
  it("falls back to DE for unknown country", () => {
    const p = parseShareUrl("cc=ZZ&count=5");
    expect(p.country).toBe("DE");
    expect(p.count).toBe(5);
  });
  it("clamps count to [1, 1000]", () => {
    const p1 = parseShareUrl("cc=DE&count=99999");
    expect(p1.count).toBe(1000);
    const p2 = parseShareUrl("cc=DE&count=-5");
    expect(p2.count).toBe(1); // negative count clamped to 1
    const p3 = parseShareUrl("cc=DE&count=abc");
    expect(p3.count).toBe(10); // NaN → default
  });
});

// Suppress unused-import lint
export type _Unused = IbanFormat;
