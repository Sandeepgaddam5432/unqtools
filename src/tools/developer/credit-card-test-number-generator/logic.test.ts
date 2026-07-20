import { describe, it, expect, beforeEach } from "vitest";
import {
  BRAND_SPECS,
  BRAND_LIST,
  PROCESSOR_TEST_CARDS,
  HONESTY_BANNER,
  mulberry32,
  hashSeed,
  createRng,
  getBrandSpec,
  luhnCheckDigit,
  luhnValidate,
  generateNumber,
  generateExpiry,
  generateCvv,
  generateCardholder,
  generateBundle,
  generateBundleBulk,
  formatCard,
  detectBrand,
  formatBundleLine,
  cardsByProcessor,
  cardsByScenario,
  bundlesToJson,
  bundlesToCsv,
  bundlesToText,
  processorCardsToJson,
  processorCardsToCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type CardBrand,
  type CardFormat,
  type CardBundle,
  type ProcessorTestCard,
  type ProcessorScenario,
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

describe("credit-card constants", () => {
  it("exposes 8 brands", () => {
    expect(BRAND_LIST).toHaveLength(8);
  });
  it("BRAND_SPECS has entry for every brand", () => {
    for (const b of BRAND_LIST) {
      expect(BRAND_SPECS[b]).toBeDefined();
      expect(BRAND_SPECS[b].prefixes.length).toBeGreaterThan(0);
      expect(BRAND_SPECS[b].lengths.length).toBeGreaterThan(0);
    }
  });
  it("Amex has 4-digit CVV", () => {
    expect(BRAND_SPECS.amex.cvvLength).toBe(4);
  });
  it("Visa prefix is 4", () => {
    expect(BRAND_SPECS.visa.prefixes).toContain("4");
  });
  it("Mastercard includes 2-series prefix 2221", () => {
    expect(BRAND_SPECS.mastercard.prefixes).toContain("2221");
  });
  it("processor test cards include Stripe 4242", () => {
    expect(PROCESSOR_TEST_CARDS.some((c) => c.number === "4242424242424242")).toBe(true);
  });
  it("honesty banner is non-empty", () => {
    expect(HONESTY_BANNER.length).toBeGreaterThan(50);
    expect(HONESTY_BANNER.toLowerCase()).toContain("sandbox");
  });
  it("getBrandSpec returns spec", () => {
    expect(getBrandSpec("visa").brand).toBe("visa");
  });
});

describe("credit-card PRNG", () => {
  it("mulberry32 is deterministic", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
  it("hashSeed is stable for string", () => {
    expect(hashSeed("visa-seed")).toBe(hashSeed("visa-seed"));
  });
  it("createRng helpers work", () => {
    const r = createRng("test");
    expect(r.int(1, 5)).toBeGreaterThanOrEqual(1);
    expect(r.int(1, 5)).toBeLessThanOrEqual(5);
    expect(r.pick([1, 2, 3])).toBeGreaterThanOrEqual(1);
    expect(r.bool()).toBeTypeOf("boolean");
    expect(r.string(4, "0123456789")).toHaveLength(4);
  });
});

describe("credit-card Luhn algorithm", () => {
  it("luhnCheckDigit computes 2 for 4242...424 (Stripe Visa)", () => {
    // Full Stripe test card is 4242424242424242; partial (15 digits) is 424242424242424
    expect(luhnCheckDigit("424242424242424")).toBe(2);
  });
  it("luhnCheckDigit computes 5 for Stripe Amex 37828224631000 (15 digits)", () => {
    // Full: 378282246310005 (15 digits). Partial (14 digits) is 37828224631000
    expect(luhnCheckDigit("37828224631000")).toBe(5);
  });
  it("luhnValidate accepts Stripe 4242 4242 4242 4242", () => {
    expect(luhnValidate("4242424242424242")).toBe(true);
  });
  it("luhnValidate accepts Stripe 5555 5555 5555 4444 (Mastercard)", () => {
    expect(luhnValidate("5555555555554444")).toBe(true);
  });
  it("luhnValidate accepts Stripe Amex 3782 822463 10005", () => {
    expect(luhnValidate("378282246310005")).toBe(true);
  });
  it("luhnValidate rejects a clearly invalid number", () => {
    expect(luhnValidate("4242424242424243")).toBe(false);
  });
  it("luhnValidate rejects non-digit input", () => {
    expect(luhnValidate("abcd")).toBe(false);
  });
  it("luhnValidate rejects too-short input", () => {
    expect(luhnValidate("4")).toBe(false);
  });
  it("luhnValidate strips spaces and dashes", () => {
    expect(luhnValidate("4242 4242 4242 4242")).toBe(true);
    expect(luhnValidate("4242-4242-4242-4242")).toBe(true);
  });
});

describe("credit-card number generation", () => {
  const rng = createRng("gen-test");
  it("generateNumber produces Luhn-valid Visa", () => {
    const n = generateNumber("visa", rng);
    expect(n).toMatch(/^4\d{15}$/);
    expect(luhnValidate(n)).toBe(true);
  });
  it("generateNumber produces Luhn-valid Amex (15 digits, 34/37 prefix)", () => {
    const n = generateNumber("amex", rng);
    expect(n).toMatch(/^3[47]\d{13}$/);
    expect(luhnValidate(n)).toBe(true);
  });
  it("generateNumber produces Luhn-valid Mastercard (51-55 or 2221-2720 prefix)", () => {
    const n = generateNumber("mastercard", rng);
    expect(n).toHaveLength(16);
    expect(luhnValidate(n)).toBe(true);
    expect(detectBrand(n)).toBe("mastercard");
  });
  it("generateNumber produces Luhn-valid Discover", () => {
    const n = generateNumber("discover", rng);
    expect(n).toHaveLength(16);
    expect(luhnValidate(n)).toBe(true);
    expect(detectBrand(n)).toBe("discover");
  });
  it("generateNumber is deterministic for same seed", () => {
    const a = generateNumber("visa", createRng("seed-1"));
    const b = generateNumber("visa", createRng("seed-1"));
    expect(a).toBe(b);
  });
  it("1000 random cards all pass Luhn", () => {
    for (let i = 0; i < 1000; i++) {
      const brand = BRAND_LIST[i % BRAND_LIST.length]!;
      const n = generateNumber(brand, createRng(`seed-${i}`));
      expect(luhnValidate(n)).toBe(true);
    }
  });
});

describe("credit-card expiry / cvv / cardholder", () => {
  const rng = createRng("exp-test");
  it("generateExpiry returns MM/YY with valid month", () => {
    const e = generateExpiry(rng);
    expect(e.month).toMatch(/^(0[1-9]|1[0-2])$/);
    expect(e.year).toMatch(/^\d{2}$/);
  });
  it("generateExpiry is in the future", () => {
    const now = new Date();
    const curYearShort = parseInt(String(now.getFullYear()).slice(-2), 10);
    const curMonth = now.getMonth() + 1;
    for (let i = 0; i < 20; i++) {
      const e = generateExpiry(rng);
      const y = parseInt(e.year, 10);
      const m = parseInt(e.month, 10);
      expect(y > curYearShort || (y === curYearShort && m > curMonth)).toBe(true);
    }
  });
  it("generateCvv returns 3 digits for Visa", () => {
    expect(generateCvv("visa", rng)).toMatch(/^\d{3}$/);
  });
  it("generateCvv returns 4 digits for Amex", () => {
    expect(generateCvv("amex", rng)).toMatch(/^\d{4}$/);
  });
  it("generateCardholder returns First Last", () => {
    const name = generateCardholder(rng);
    expect(name.split(" ")).toHaveLength(2);
    expect(name).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+$/);
  });
});

describe("credit-card bundle generation", () => {
  it("generateBundle produces a valid bundle", () => {
    const b = generateBundle("visa", createRng("bundle-1"));
    expect(b.brand).toBe("visa");
    expect(luhnValidate(b.number)).toBe(true);
    expect(b.cvv).toMatch(/^\d{3}$/);
    expect(b.expiryMonth).toMatch(/^(0[1-9]|1[0-2])$/);
    expect(b.cardholder.split(" ")).toHaveLength(2);
  });
  it("generateBundleBulk returns requested count", () => {
    const out = generateBundleBulk({ count: 25, seed: "bulk-1", brands: ["visa"] });
    expect(out).toHaveLength(25);
    expect(out.every((b) => b.brand === "visa")).toBe(true);
    expect(out.every((b) => luhnValidate(b.number))).toBe(true);
  });
  it("generateBundleBulk clamps at 0", () => {
    expect(generateBundleBulk({ count: 0, seed: "x" })).toEqual([]);
  });
  it("generateBundleBulk picks random brands when none specified", () => {
    const out = generateBundleBulk({ count: 30, seed: "multi-brand" });
    const brands = new Set(out.map((b) => b.brand));
    expect(brands.size).toBeGreaterThan(1);
  });
  it("generateBundleBulk is deterministic for same seed", () => {
    const a = generateBundleBulk({ count: 5, seed: "deterministic", brands: ["visa"] });
    const b = generateBundleBulk({ count: 5, seed: "deterministic", brands: ["visa"] });
    expect(a).toEqual(b);
  });
});

describe("credit-card formatting + brand detection", () => {
  it("formatCard plain returns digits", () => {
    expect(formatCard("4242424242424242", "plain")).toBe("4242424242424242");
  });
  it("formatCard spaced groups by 4", () => {
    expect(formatCard("4242424242424242", "spaced")).toBe("4242 4242 4242 4242");
  });
  it("formatCard dashed groups by 4", () => {
    expect(formatCard("4242424242424242", "dashed")).toBe("4242-4242-4242-4242");
  });
  it("formatCard grouped uses 4-6-5 for Amex", () => {
    expect(formatCard("378282246310005", "grouped")).toBe("3782 822463 10005");
  });
  it("formatCard strips non-digits", () => {
    expect(formatCard("4242 4242 4242 4242", "plain")).toBe("4242424242424242");
  });
  it("detectBrand identifies Visa", () => {
    expect(detectBrand("4242424242424242")).toBe("visa");
  });
  it("detectBrand identifies Amex", () => {
    expect(detectBrand("378282246310005")).toBe("amex");
  });
  it("detectBrand identifies Mastercard 2-series", () => {
    expect(detectBrand("2223003122003222")).toBe("mastercard");
  });
  it("detectBrand returns null for unknown prefix", () => {
    expect(detectBrand("9999999999999999")).toBeNull();
  });
  it("formatBundleLine includes brand, number, expiry, cvv, cardholder", () => {
    const b: CardBundle = {
      brand: "visa",
      number: "4242424242424242",
      expiryMonth: "12",
      expiryYear: "30",
      cvv: "123",
      cardholder: "John Smith",
    };
    const line = formatBundleLine(b, "grouped");
    expect(line).toContain("Visa");
    expect(line).toContain("4242 4242 4242 4242");
    expect(line).toContain("12/30");
    expect(line).toContain("CVV 123");
    expect(line).toContain("John Smith");
  });
});

describe("credit-card processor library", () => {
  it("cardsByProcessor returns Stripe cards", () => {
    const cards = cardsByProcessor("stripe");
    expect(cards.length).toBeGreaterThan(10);
    expect(cards.every((c) => c.processor === "stripe")).toBe(true);
  });
  it("cardsByScenario returns decline cards", () => {
    const cards = cardsByScenario("decline");
    expect(cards.length).toBeGreaterThan(0);
    expect(cards.every((c) => c.scenario === "decline")).toBe(true);
  });
  it("all processor test cards are Luhn-valid", () => {
    for (const c of PROCESSOR_TEST_CARDS) {
      expect(luhnValidate(c.number)).toBe(true);
    }
  });
  it("processor cards cover all 4 processors", () => {
    const procs = new Set(PROCESSOR_TEST_CARDS.map((c) => c.processor));
    expect(procs.size).toBe(4);
    expect(procs.has("stripe")).toBe(true);
    expect(procs.has("adyen")).toBe(true);
    expect(procs.has("braintree")).toBe(true);
    expect(procs.has("paypal")).toBe(true);
  });
});

describe("credit-card exports", () => {
  const bundles: CardBundle[] = [
    { brand: "visa", number: "4242424242424242", expiryMonth: "12", expiryYear: "30", cvv: "123", cardholder: "John Smith" },
    { brand: "amex", number: "378282246310005", expiryMonth: "06", expiryYear: "28", cvv: "1234", cardholder: "Jane Doe" },
  ];
  it("bundlesToJson is valid JSON array", () => {
    expect(JSON.parse(bundlesToJson(bundles))).toEqual(bundles);
  });
  it("bundlesToCsv has header + 2 rows", () => {
    const csv = bundlesToCsv(bundles);
    const lines = csv.split("\n");
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe("brand,number,expiry_month,expiry_year,cvv,cardholder");
  });
  it("bundlesToText is one line per bundle", () => {
    const txt = bundlesToText(bundles, "grouped");
    expect(txt.split("\n")).toHaveLength(2);
    expect(txt).toContain("Visa");
    expect(txt).toContain("American Express");
  });
  it("processorCardsToJson is valid JSON array", () => {
    const json = processorCardsToJson(cardsByProcessor("stripe"));
    const parsed = JSON.parse(json);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBeGreaterThan(0);
  });
  it("processorCardsToCsv has header row", () => {
    const csv = processorCardsToCsv(cardsByProcessor("stripe"));
    expect(csv.split("\n")[0]).toBe("processor,brand,number,scenario,description");
  });
});

describe("credit-card history", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, seed: "abc", count: 10, brands: ["visa"], format: "grouped" });
    const h = loadHistory();
    expect(h).toHaveLength(1);
    expect(h[0]!.seed).toBe("abc");
  });
  it("caps at 20 entries", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, seed: `s${i}`, count: 10, brands: ["visa"], format: "grouped" });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, seed: "abc", count: 10, brands: [], format: "plain" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("credit-card shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("abc", 50, "spaced", ["visa", "amex"]);
    expect(url).toContain("seed=abc");
    expect(url).toContain("count=50");
    expect(url).toContain("fmt=spaced");
    expect(url).toContain("brands=visa%2Camex");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("seed=abc&count=50&fmt=dashed&brands=visa%2Camex");
    expect(p.seed).toBe("abc");
    expect(p.count).toBe(50);
    expect(p.format).toBe("dashed");
    expect(p.brands).toEqual(["visa", "amex"]);
  });
  it("handles empty hash with defaults", () => {
    const p = parseShareUrl("");
    expect(p.seed).toBe("");
    expect(p.count).toBe(10);
    expect(p.format).toBe("grouped");
    expect(p.brands).toEqual([]);
  });
  it("rejects unknown format", () => {
    const p = parseShareUrl("fmt=xml");
    expect(p.format).toBe("grouped");
  });
  it("filters unknown brands", () => {
    const p = parseShareUrl("brands=visa%2CbogusBrand");
    expect(p.brands).toEqual(["visa"]);
  });
  it("clamps count to valid range", () => {
    expect(parseShareUrl("count=0").count).toBe(1);
    expect(parseShareUrl("count=99999999").count).toBe(10000);
  });
});

// Suppress unused-import lint
export type _Unused = CardBrand | CardFormat | ProcessorTestCard | ProcessorScenario;
