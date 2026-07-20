import { describe, it, expect, beforeEach } from "vitest";
import {
  PHONE_REGISTRY,
  COUNTRY_LIST,
  CANONICAL_VALID_NUMBERS,
  CANONICAL_INVALID_NUMBERS,
  getCountrySpec,
  listCountries,
  mulberry32,
  hashSeed,
  createRng,
  normalizePhoneNumber,
  digitsOnly,
  detectCountry,
  validatePhoneNumber,
  detectType,
  generatePhoneNumber,
  generatePhoneBatch,
  formatPhoneNumber,
  applyTemplate,
  maskPhoneNumber,
  parseBatchInput,
  validateBatch,
  summarizeBatch,
  renderBatchCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  HONESTY_BANNER,
  type PhoneFormat,
  type NumberTypeFilter,
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

describe("phone-number-generator-validator constants", () => {
  it("ships 30+ countries in the registry", () => {
    expect(Object.keys(PHONE_REGISTRY).length).toBeGreaterThanOrEqual(30);
  });
  it("exposes a sorted country list", () => {
    expect(COUNTRY_LIST).toEqual([...COUNTRY_LIST].sort());
    expect(COUNTRY_LIST).toContain("US");
    expect(COUNTRY_LIST).toContain("GB");
    expect(COUNTRY_LIST).toContain("JP");
  });
  it("ships canonical valid test vectors", () => {
    expect(CANONICAL_VALID_NUMBERS.length).toBeGreaterThanOrEqual(10);
  });
  it("ships canonical invalid test vectors", () => {
    expect(CANONICAL_INVALID_NUMBERS.length).toBeGreaterThanOrEqual(4);
  });
  it("has honesty banner text", () => {
    expect(HONESTY_BANNER.length).toBeGreaterThan(20);
    expect(HONESTY_BANNER.toLowerCase()).toContain("testing");
  });
});

describe("phone-number-generator-validator registry lookups", () => {
  it("looks up a known country spec", () => {
    const us = getCountrySpec("US");
    expect(us).not.toBeNull();
    expect(us!.name).toBe("United States");
    expect(us!.callingCode).toBe("1");
    expect(us!.nsnLength).toBe(10);
  });
  it("returns null for unknown country", () => {
    expect(getCountrySpec("ZZ")).toBeNull();
    expect(getCountrySpec("")).toBeNull();
  });
  it("normalizes case-insensitively", () => {
    expect(getCountrySpec("us")!.country).toBe("US");
    expect(getCountrySpec("gb")!.country).toBe("GB");
  });
  it("listCountries returns array of meta", () => {
    const list = listCountries();
    expect(list.length).toBeGreaterThanOrEqual(30);
    expect(list.find((c) => c.country === "US")).toBeTruthy();
  });
  it("every spec has required fields", () => {
    for (const cc of COUNTRY_LIST) {
      const s = PHONE_REGISTRY[cc]!;
      expect(s.country).toBe(cc);
      expect(s.name.length).toBeGreaterThan(0);
      expect(s.callingCode.length).toBeGreaterThan(0);
      expect(s.nsnLength).toBeGreaterThan(0);
      expect(s.mobilePrefixes.length).toBeGreaterThan(0);
      expect(s.fixedPrefixes.length).toBeGreaterThan(0);
      expect(s.nationalFormat.length).toBeGreaterThan(0);
      expect(s.internationalFormat.length).toBeGreaterThan(0);
    }
  });
});

describe("phone-number-generator-validator PRNG", () => {
  it("mulberry32 is deterministic for same seed", () => {
    const r1 = mulberry32(42);
    const r2 = mulberry32(42);
    expect(r1()).toBe(r2());
  });
  it("hashSeed handles strings and numbers", () => {
    expect(hashSeed("abc")).toBe(hashSeed("abc"));
    expect(hashSeed(42)).toBe(42);
    expect(hashSeed("hello")).not.toBe(hashSeed("world"));
  });
  it("createRng exposes int/pick/digit helpers", () => {
    const rng = createRng("seed-1");
    expect(rng.int(1, 10)).toBeGreaterThanOrEqual(1);
    expect(rng.int(1, 10)).toBeLessThanOrEqual(10);
    expect(["a", "b", "c"]).toContain(rng.pick(["a", "b", "c"]));
    expect(rng.digit()).toMatch(/^[0-9]$/);
  });
});

describe("phone-number-generator-validator normalizePhoneNumber", () => {
  it("strips whitespace and punctuation", () => {
    expect(normalizePhoneNumber("+1 (415) 555-2671")).toBe("+14155552671");
    expect(normalizePhoneNumber("415.555.2671")).toBe("4155552671");
    expect(normalizePhoneNumber("44 207 183 8750")).toBe("442071838750");
  });
  it("preserves leading plus", () => {
    expect(normalizePhoneNumber("+1 415 555 2671")).toBe("+14155552671");
  });
  it("handles empty input", () => {
    expect(normalizePhoneNumber("")).toBe("");
  });
  it("strips alphabetic extension markers", () => {
    // Note: ext digits are preserved in the digit stream — extension
    // stripping is intentionally not done to keep behavior predictable.
    expect(normalizePhoneNumber("+1 800 555 1234 ext 99")).toBe("+1800555123499");
  });
  it("digitsOnly drops the plus", () => {
    expect(digitsOnly("+14155552671")).toBe("14155552671");
    expect(digitsOnly("")).toBe("");
  });
});

describe("phone-number-generator-validator detectCountry", () => {
  it("detects US from +1", () => {
    expect(detectCountry("+14155552671")).toBe("US");
  });
  it("detects UK from +44", () => {
    expect(detectCountry("+442071838750")).toBe("GB");
  });
  it("detects Japan from +81", () => {
    expect(detectCountry("+819012345678")).toBe("JP");
  });
  it("returns null for unknown calling code", () => {
    expect(detectCountry("+9999123456")).toBeNull();
  });
  it("prefers longest calling code match", () => {
    // +966 should resolve to SA (966) not anything else.
    expect(detectCountry("+966512345678")).toBe("SA");
  });
});

describe("phone-number-generator-validator validatePhoneNumber", () => {
  it("validates a canonical US mobile number", () => {
    const r = validatePhoneNumber("+14155552671");
    expect(r.valid).toBe(true);
    expect(r.country).toBe("US");
    expect(r.type).toBe("mobile");
    expect(r.code).toBe("valid");
  });
  it("validates a UK fixed-line number", () => {
    const r = validatePhoneNumber("+442071838750");
    expect(r.valid).toBe(true);
    expect(r.country).toBe("GB");
    expect(r.type).toBe("fixed");
  });
  it("validates a France fixed number", () => {
    const r = validatePhoneNumber("+33170182345");
    expect(r.valid).toBe(true);
    expect(r.country).toBe("FR");
    expect(r.type).toBe("fixed");
  });
  it("detects a US toll-free number", () => {
    const r = validatePhoneNumber("+18005551234");
    expect(r.valid).toBe(true);
    expect(r.country).toBe("US");
    expect(r.type).toBe("toll-free");
  });
  it("rejects too-short input", () => {
    const r = validatePhoneNumber("+12345");
    expect(r.valid).toBe(false);
    expect(r.code).toBe("wrong_length");
  });
  it("rejects empty input", () => {
    const r = validatePhoneNumber("");
    expect(r.valid).toBe(false);
    expect(r.code).toBe("empty");
  });
  it("rejects non-numeric input", () => {
    const r = validatePhoneNumber("abc");
    expect(r.valid).toBe(false);
    expect(r.code).toBe("empty");
  });
  it("rejects unknown country code", () => {
    const r = validatePhoneNumber("+9999123456");
    expect(r.valid).toBe(false);
    expect(r.code).toBe("unknown_country");
  });
  it("uses defaultCountry for non-plus input", () => {
    const r = validatePhoneNumber("02071838750", "GB");
    expect(r.valid).toBe(true);
    expect(r.country).toBe("GB");
  });
  it("all canonical valid numbers pass", () => {
    for (const v of CANONICAL_VALID_NUMBERS) {
      const r = validatePhoneNumber(v.number);
      expect(r.valid, `${v.number} should be valid (note: ${v.note})`).toBe(true);
      expect(r.country).toBe(v.country);
      expect(r.type).toBe(v.type);
    }
  });
  it("all canonical invalid numbers fail", () => {
    for (const v of CANONICAL_INVALID_NUMBERS) {
      const r = validatePhoneNumber(v.number);
      expect(r.valid, `${v.number} should be invalid (note: ${v.note})`).toBe(false);
    }
  });
});

describe("phone-number-generator-validator detectType", () => {
  it("detects mobile from US spec", () => {
    expect(detectType("4155552671", PHONE_REGISTRY.US!)).toBe("mobile");
  });
  it("detects toll-free from US spec", () => {
    expect(detectType("8005551234", PHONE_REGISTRY.US!)).toBe("toll-free");
  });
  it("returns unknown for unknown prefix", () => {
    // US prefixes cover 2-9; 1xx would not match a real NANP area code.
    // But "1" doesn't start any US prefix list, so it returns unknown.
    expect(detectType("1000000000", PHONE_REGISTRY.US!)).toBe("unknown");
  });
});

describe("phone-number-generator-validator generation", () => {
  it("generates a valid-format US mobile number", () => {
    const rng = createRng("test-1");
    const num = generatePhoneNumber("US", "mobile", rng);
    expect(num.startsWith("+1")).toBe(true);
    const r = validatePhoneNumber(num);
    expect(r.valid).toBe(true);
    expect(r.country).toBe("US");
    expect(r.type).toBe("mobile");
  });
  it("generates a valid-format UK fixed number", () => {
    const rng = createRng("test-2");
    const num = generatePhoneNumber("GB", "fixed", rng);
    const r = validatePhoneNumber(num);
    expect(r.valid).toBe(true);
    expect(r.country).toBe("GB");
  });
  it("generates a US toll-free number", () => {
    const rng = createRng("test-3");
    const num = generatePhoneNumber("US", "toll-free", rng);
    const r = validatePhoneNumber(num);
    expect(r.valid).toBe(true);
    expect(r.type).toBe("toll-free");
  });
  it("throws for unknown country", () => {
    const rng = createRng("test-4");
    expect(() => generatePhoneNumber("ZZ", "mobile", rng)).toThrow();
  });
  it("generates deterministic batch with same seed", () => {
    const b1 = generatePhoneBatch({ country: "US", count: 5, seed: "abc", type: "mobile" });
    const b2 = generatePhoneBatch({ country: "US", count: 5, seed: "abc", type: "mobile" });
    expect(b1).toEqual(b2);
  });
  it("all generated numbers pass validation", () => {
    const batch = generatePhoneBatch({ country: "DE", count: 20, seed: "de-seed", type: "fixed" });
    for (const n of batch) {
      const r = validatePhoneNumber(n);
      expect(r.valid, `${n} should be valid`).toBe(true);
    }
  });
  it("caps batch at 1000", () => {
    const batch = generatePhoneBatch({ country: "US", count: 5000, seed: "x", type: "mobile" });
    expect(batch.length).toBe(1000);
  });
});

describe("phone-number-generator-validator formatPhoneNumber", () => {
  it("formats to E.164", () => {
    expect(formatPhoneNumber("+14155552671", "e164")).toBe("+14155552671");
  });
  it("formats to international form for US", () => {
    expect(formatPhoneNumber("+14155552671", "international")).toBe("+1 415 555-2671");
  });
  it("formats to national form for US", () => {
    expect(formatPhoneNumber("+14155552671", "national")).toBe("(415) 555-2671");
  });
  it("formats to RFC 3966 tel: URI", () => {
    expect(formatPhoneNumber("+14155552671", "rfc3966")).toBe("tel:+14155552671");
  });
  it("applies template correctly", () => {
    expect(applyTemplate("(NNN) NNN-NNNN", "1", "4155552671")).toBe("(415) 555-2671");
    expect(applyTemplate("+N NNN NNN-NNNN", "1", "4155552671")).toBe("+1 415 555-2671");
  });
  it("falls back when country cannot be detected", () => {
    expect(formatPhoneNumber("+9999123456", "e164")).toBe("+9999123456");
    expect(formatPhoneNumber("+9999123456", "rfc3966")).toBe("tel:+9999123456");
  });
  it("handles national input with default country", () => {
    // UK national-form input via defaultCountry.
    expect(formatPhoneNumber("02071838750", "e164", "GB")).toBe("+442071838750");
  });
});

describe("phone-number-generator-validator maskPhoneNumber", () => {
  it("masks middle digits", () => {
    const masked = maskPhoneNumber("+14155552671");
    expect(masked).toContain("+1");
    expect(masked).toContain("2671");
    expect(masked).toContain("•");
  });
  it("handles short input", () => {
    expect(maskPhoneNumber("+1234")).toBe("1234");
  });
  it("handles empty input", () => {
    expect(maskPhoneNumber("")).toBe("");
  });
});

describe("phone-number-generator-validator batch", () => {
  it("parseBatchInput splits on newlines/commas", () => {
    expect(parseBatchInput("+14155552671\n+442071838750, +33170182345")).toEqual([
      "+14155552671", "+442071838750", "+33170182345",
    ]);
  });
  it("parseBatchInput skips blank lines", () => {
    expect(parseBatchInput("+14155552671\n\n+442071838750")).toHaveLength(2);
  });
  it("validateBatch returns one row per input", () => {
    const rows = validateBatch(["+14155552671", "+442071838750", "bad"]);
    expect(rows).toHaveLength(3);
    expect(rows[0]!.valid).toBe(true);
    expect(rows[2]!.valid).toBe(false);
  });
  it("summarizeBatch computes counts", () => {
    const rows = validateBatch(["+14155552671", "+442071838750", "bad"]);
    const s = summarizeBatch(rows);
    expect(s.total).toBe(3);
    expect(s.valid).toBe(2);
    expect(s.invalid).toBe(1);
    expect(s.byType.mobile).toBeGreaterThan(0);
  });
  it("renderBatchCsv has headers", () => {
    const csv = renderBatchCsv([]);
    expect(csv).toContain("index,raw,normalized,valid,possible,code,country,type,message");
  });
  it("renderBatchCsv renders row data", () => {
    const csv = renderBatchCsv(validateBatch(["+14155552671"]));
    expect(csv).toContain("+14155552671");
    expect(csv).toContain("valid");
    expect(csv).toContain("United States");
    expect(csv).toContain("mobile");
  });
});

describe("phone-number-generator-validator history (localStorage)", () => {
  it("loads empty initially", () => { expect(loadHistory()).toEqual([]); });
  it("saves and loads", () => {
    saveHistory({ ts: 1, action: "generate", country: "US", format: "e164", generateCount: 5, generateType: "mobile", batchTotal: 0, batchValid: 0, batchInvalid: 0 });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, action: "generate", country: "US", format: "e164", generateCount: 1, generateType: "mobile", batchTotal: 0, batchValid: 0, batchInvalid: 0 });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, action: "generate", country: "US", format: "e164", generateCount: 1, generateType: "mobile", batchTotal: 0, batchValid: 0, batchInvalid: 0 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("phone-number-generator-validator shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("US", 10, "e164", "mobile");
    expect(url).toContain("cc=US");
    expect(url).toContain("count=10");
    expect(url).toContain("fmt=e164");
    expect(url).toContain("type=mobile");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("cc=GB&count=25&fmt=international&type=fixed");
    expect(p.country).toBe("GB");
    expect(p.count).toBe(25);
    expect(p.format).toBe("international");
    expect(p.type).toBe("fixed");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({ country: "US", count: 10, format: "e164", type: "mobile" });
  });
  it("filters unknown country", () => {
    const p = parseShareUrl("cc=ZZ");
    expect(p.country).toBe("US");
  });
  it("clamps count to 1..1000", () => {
    const p1 = parseShareUrl("count=0");
    expect(p1.count).toBe(1);
    const p2 = parseShareUrl("count=99999");
    expect(p2.count).toBe(1000);
  });
});

// Suppress unused-import lint
export type _Unused = PhoneFormat | NumberTypeFilter;
