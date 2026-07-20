import { describe, it, expect, beforeEach } from "vitest";
import {
  PII_TYPE_LIST,
  PII_TYPE_LABELS,
  STRATEGY_LIST,
  STRATEGY_LABELS,
  FIRST_NAMES,
  LAST_NAMES,
  STREETS,
  CITIES,
  HONESTY_BANNER,
  MAX_INPUT_BYTES,
  DEFAULT_CONFIG,
  mulberry32,
  hashSeed,
  createRng,
  luhnValidate,
  luhnCheckDigit,
  detectEmails,
  detectPhones,
  detectSsns,
  detectCreditCards,
  detectIps,
  detectZipcodes,
  detectDobs,
  detectNames,
  detectAllPii,
  fakeEmail,
  fakePhone,
  fakeSsn,
  fakeCreditCard,
  fakeIp,
  fakeZipcode,
  fakeDob,
  fakeName,
  fakeAddress,
  applyMask,
  applyGeneralize,
  applyRedact,
  applyPreserveFormat,
  applyFake,
  applyStrategy,
  resolveStrategy,
  anonymizeText,
  splitCsvRow,
  parseCsv,
  escapeCsvCell,
  joinCsvRow,
  detectColumnPii,
  anonymizeCsv,
  anonymizeJsonValue,
  anonymizeJson,
  detectFormat,
  anonymize,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type PiiType,
  type Strategy,
  type StrategyConfig,
  type InputFormat,
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

describe("anonymizer constants", () => {
  it("exposes 8 PII types", () => {
    expect(PII_TYPE_LIST).toHaveLength(8);
  });
  it("exposes 6 strategies", () => {
    expect(STRATEGY_LIST).toHaveLength(6);
  });
  it("PII_TYPE_LABELS has entry for every type", () => {
    for (const t of PII_TYPE_LIST) {
      expect(PII_TYPE_LABELS[t].length).toBeGreaterThan(0);
    }
  });
  it("STRATEGY_LABELS has entry for every strategy", () => {
    for (const s of STRATEGY_LIST) {
      expect(STRATEGY_LABELS[s].length).toBeGreaterThan(0);
    }
  });
  it("FIRST_NAMES has 200+ entries", () => {
    expect(FIRST_NAMES.length).toBeGreaterThanOrEqual(200);
  });
  it("LAST_NAMES has 200+ entries", () => {
    expect(LAST_NAMES.length).toBeGreaterThanOrEqual(200);
  });
  it("STREETS and CITIES have entries", () => {
    expect(STREETS.length).toBeGreaterThan(10);
    expect(CITIES.length).toBeGreaterThan(10);
  });
  it("HONESTY_BANNER mentions client-side", () => {
    expect(HONESTY_BANNER.toLowerCase()).toContain("client-side");
  });
  it("MAX_INPUT_BYTES is 5 MB", () => {
    expect(MAX_INPUT_BYTES).toBe(5 * 1024 * 1024);
  });
  it("DEFAULT_CONFIG sets credit-card→preserve-format, dob→generalize, zipcode→generalize, default→pseudonymize", () => {
    expect(DEFAULT_CONFIG.default).toBe("pseudonymize");
    expect(DEFAULT_CONFIG.perType["credit-card"]).toBe("preserve-format");
    expect(DEFAULT_CONFIG.perType["dob"]).toBe("generalize");
    expect(DEFAULT_CONFIG.perType["zipcode"]).toBe("generalize");
  });
});

describe("anonymizer PRNG", () => {
  it("mulberry32 is deterministic", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
  it("hashSeed is stable for string", () => {
    expect(hashSeed("seed-x")).toBe(hashSeed("seed-x"));
  });
  it("createRng helpers work", () => {
    const r = createRng("test");
    expect(r.int(1, 5)).toBeGreaterThanOrEqual(1);
    expect(r.int(1, 5)).toBeLessThanOrEqual(5);
    expect(r.pick([1, 2, 3])).toBeGreaterThanOrEqual(1);
    expect(r.digits(8)).toMatch(/^\d{8}$/);
    expect(r.string(4, "ABCD")).toHaveLength(4);
  });
});

describe("anonymizer Luhn", () => {
  it("luhnValidate accepts Stripe test card 4242 4242 4242 4242", () => {
    expect(luhnValidate("4242424242424242")).toBe(true);
  });
  it("luhnValidate rejects corrupted last digit", () => {
    expect(luhnValidate("4242424242424243")).toBe(false);
  });
  it("luhnValidate rejects too-short or too-long numbers", () => {
    expect(luhnValidate("12345")).toBe(false);
    expect(luhnValidate("12345678901234567890")).toBe(false);
  });
  it("luhnValidate strips dashes and spaces", () => {
    expect(luhnValidate("4242-4242-4242-4242")).toBe(true);
    expect(luhnValidate("4242 4242 4242 4242")).toBe(true);
  });
  it("luhnCheckDigit computes 2 for partial 424242424242424", () => {
    expect(luhnCheckDigit("424242424242424")).toBe(2);
  });
});

describe("anonymizer PII detection", () => {
  it("detectEmails finds one email", () => {
    const out = detectEmails("Contact jane@example.com for info.");
    expect(out).toHaveLength(1);
    expect(out[0]!.value).toBe("jane@example.com");
    expect(out[0]!.type).toBe("email");
  });
  it("detectEmails finds multiple emails", () => {
    const out = detectEmails("a@x.com b@y.co.uk");
    expect(out).toHaveLength(2);
  });
  it("detectPhones finds US format with dashes", () => {
    const out = detectPhones("Call 555-123-4567.");
    expect(out).toHaveLength(1);
    expect(out[0]!.value).toBe("555-123-4567");
  });
  it("detectPhones finds +1 E.164 format", () => {
    const out = detectPhones("Call +1-555-123-4567.");
    expect(out).toHaveLength(1);
    expect(out[0]!.value).toContain("555-123-4567");
  });
  it("detectPhones ignores 5-digit numbers (too short)", () => {
    expect(detectPhones("ZIP 12345")).toHaveLength(0);
  });
  it("detectSsns finds formatted SSN", () => {
    const out = detectSsns("SSN: 123-45-6789");
    expect(out).toHaveLength(1);
    expect(out[0]!.value).toBe("123-45-6789");
  });
  it("detectCreditCards finds Luhn-valid card", () => {
    const out = detectCreditCards("Card 4242424242424242 used.");
    expect(out).toHaveLength(1);
    expect(out[0]!.type).toBe("credit-card");
  });
  it("detectCreditCards rejects non-Luhn digits", () => {
    expect(detectCreditCards("Card 4242424242424243 used.")).toHaveLength(0);
  });
  it("detectCreditCards handles spaced format", () => {
    const out = detectCreditCards("Card 4242 4242 4242 4242");
    expect(out).toHaveLength(1);
  });
  it("detectIps finds IPv4 addresses", () => {
    const out = detectIps("Server 192.168.1.1 and 10.0.0.1");
    expect(out).toHaveLength(2);
  });
  it("detectIps rejects out-of-range octets", () => {
    expect(detectIps("Bad 999.999.999.999")).toHaveLength(0);
  });
  it("detectZipcodes finds 5-digit ZIP", () => {
    const out = detectZipcodes("ZIP 90210 area");
    expect(out).toHaveLength(1);
    expect(out[0]!.value).toBe("90210");
  });
  it("detectZipcodes finds ZIP+4", () => {
    const out = detectZipcodes("ZIP 90210-1234");
    expect(out).toHaveLength(1);
    expect(out[0]!.value).toBe("90210-1234");
  });
  it("detectDobs finds ISO format YYYY-MM-DD", () => {
    const out = detectDobs("DOB 1990-05-15");
    expect(out).toHaveLength(1);
    expect(out[0]!.value).toBe("1990-05-15");
  });
  it("detectDobs finds MM/DD/YYYY format", () => {
    const out = detectDobs("DOB 05/15/1990");
    expect(out).toHaveLength(1);
    expect(out[0]!.value).toBe("05/15/1990");
  });
  it("detectNames finds dictionary-confirmed names", () => {
    const out = detectNames("John Smith visited today.");
    expect(out.some((m) => m.value === "John Smith")).toBe(true);
  });
  it("detectNames confirms names with capitalized context labels", () => {
    // "Patient John Smith" — regex greedily captures 3-word phrase; "John" is in dict so confirmed.
    const out = detectNames("Patient John Smith visited today.");
    expect(out.some((m) => m.value.includes("John Smith"))).toBe(true);
  });
  it("detectNames rejects non-dictionary phrases", () => {
    // The Quick Brown is not in the dictionary.
    const out = detectNames("The Quick Brown Fox jumps.");
    expect(out.find((m) => m.value === "Quick Brown")).toBeUndefined();
  });
  it("detectAllPii finds all PII types in mixed text", () => {
    const text = "Email: jane@example.com, Phone: 555-123-4567, SSN: 123-45-6789, IP: 10.0.0.1";
    const out = detectAllPii(text);
    expect(out.length).toBeGreaterThanOrEqual(4);
    const types = new Set(out.map((m) => m.type));
    expect(types.has("email")).toBe(true);
    expect(types.has("phone")).toBe(true);
    expect(types.has("ssn")).toBe(true);
    expect(types.has("ip")).toBe(true);
  });
  it("detectAllPii removes overlapping matches", () => {
    // "12345" could be ZIP, but inside "123-45-6789" SSN takes precedence.
    const out = detectAllPii("SSN 123-45-6789");
    expect(out).toHaveLength(1);
    expect(out[0]!.type).toBe("ssn");
  });
  it("detectAllPii returns matches sorted by start position", () => {
    const out = detectAllPii("a@b.com 10.0.0.1");
    expect(out[0]!.start).toBeLessThan(out[1]!.start);
  });
});

describe("anonymizer fake generators", () => {
  const rng = createRng("fake-test");
  it("fakeEmail produces valid-shape email", () => {
    const e = fakeEmail(rng, "jane@example.com");
    expect(e).toMatch(/^[a-z0-9]+@[a-z0-9.-]+\.[a-z]{2,}$/);
    expect(e).toContain("@example.com");
  });
  it("fakePhone preserves non-digit separators", () => {
    const p = fakePhone(rng, "(555) 123-4567");
    expect(p).toMatch(/^\(\d{3}\) \d{3}-\d{4}$/);
  });
  it("fakeSsn produces 900-XXX-XXXX reserved range", () => {
    for (let i = 0; i < 30; i++) {
      const s = fakeSsn(rng, "123-45-6789");
      const area = parseInt(s.slice(0, 3), 10);
      expect(area).toBeGreaterThanOrEqual(900);
      expect(area).toBeLessThanOrEqual(999);
      expect(s).toMatch(/^\d{3}-\d{2}-\d{4}$/);
    }
  });
  it("fakeCreditCard produces Luhn-valid same-length number", () => {
    const orig = "4242424242424242";
    const fake = fakeCreditCard(rng, orig);
    expect(fake.replace(/\D/g, "")).toHaveLength(16);
    expect(luhnValidate(fake)).toBe(true);
  });
  it("fakeCreditCard preserves original's separator pattern", () => {
    const fake = fakeCreditCard(rng, "4242 4242 4242 4242");
    expect(fake).toMatch(/^\d{4} \d{4} \d{4} \d{4}$/);
  });
  it("fakeIp produces valid IPv4", () => {
    const ip = fakeIp(rng, "192.168.1.1");
    expect(ip).toMatch(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/);
    const octets = ip.split(".").map(Number);
    expect(octets.every((o) => o >= 0 && o <= 255)).toBe(true);
  });
  it("fakeZipcode produces 5-digit ZIP", () => {
    const z = fakeZipcode(rng, "90210");
    expect(z).toMatch(/^\d{5}$/);
  });
  it("fakeZipcode produces ZIP+4 when given ZIP+4", () => {
    const z = fakeZipcode(rng, "90210-1234");
    expect(z).toMatch(/^\d{5}-\d{4}$/);
  });
  it("fakeDob produces ISO format when given ISO", () => {
    const d = fakeDob(rng, "1990-05-15");
    expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it("fakeDob produces slash format when given slash", () => {
    const d = fakeDob(rng, "05/15/1990");
    expect(d).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
  });
  it("fakeName produces First Last", () => {
    const n = fakeName(rng, "John Smith");
    expect(n.split(" ")).toHaveLength(2);
    expect(FIRST_NAMES).toContain(n.split(" ")[0]);
    expect(LAST_NAMES).toContain(n.split(" ")[1]);
  });
  it("fakeAddress produces full address", () => {
    const a = fakeAddress(rng, "123 Main St");
    expect(a).toMatch(/^\d+ .+, .+, [A-Z]{2} \d{5}$/);
  });
});

describe("anonymizer masking strategies", () => {
  it("applyMask replaces alphanumeric with asterisks, keeps separators", () => {
    expect(applyMask("jane@example.com", "email")).toBe("****@*******.***");
    expect(applyMask("555-123-4567", "phone")).toBe("***-***-****");
    expect(applyMask("4242 4242 4242 4242", "credit-card")).toBe("**** **** **** ****");
  });
  it("applyGeneralize reduces DOB to year only", () => {
    expect(applyGeneralize("1990-05-15", "dob")).toBe("1990");
    expect(applyGeneralize("05/15/1990", "dob")).toBe("1990");
  });
  it("applyGeneralize reduces ZIP to first 3 digits + ***", () => {
    expect(applyGeneralize("90210", "zipcode")).toBe("902***");
    expect(applyGeneralize("90210-1234", "zipcode")).toBe("902***");
  });
  it("applyGeneralize falls back to mask for non-generalizable types", () => {
    expect(applyGeneralize("jane@example.com", "email")).toBe("****@*******.***");
  });
  it("applyRedact returns [REDACTED]", () => {
    expect(applyRedact("jane@example.com", "email")).toBe("[REDACTED]");
  });
  it("applyPreserveFormat on credit card produces Luhn-valid replacement", () => {
    const rng = createRng("pf");
    const out = applyPreserveFormat("4242424242424242", "credit-card", rng);
    expect(luhnValidate(out)).toBe(true);
  });
  it("applyPreserveFormat on email keeps domain", () => {
    const rng = createRng("pf");
    const out = applyPreserveFormat("jane@example.com", "email", rng);
    expect(out).toContain("@example.com");
  });
  it("applyPreserveFormat on phone preserves separator pattern", () => {
    const rng = createRng("pf");
    const out = applyPreserveFormat("(555) 123-4567", "phone", rng);
    expect(out).toMatch(/^\(\d{3}\) \d{3}-\d{4}$/);
  });
  it("applyFake on name returns dictionary name", () => {
    const rng = createRng("fake");
    const out = applyFake("John Smith", "name", rng);
    expect(out.split(" ")).toHaveLength(2);
  });
  it("applyStrategy caches pseudonymized values for referential integrity", () => {
    const rng = createRng("p1");
    const map = new Map<string, string>();
    const a = applyStrategy("jane@example.com", "email", "pseudonymize", rng, map);
    const b = applyStrategy("jane@example.com", "email", "pseudonymize", rng, map);
    expect(a).toBe(b);
    expect(map.size).toBeGreaterThan(0);
  });
  it("applyStrategy redact always returns [REDACTED]", () => {
    const rng = createRng("r");
    const out = applyStrategy("jane@example.com", "email", "redact", rng, new Map());
    expect(out).toBe("[REDACTED]");
  });
  it("applyStrategy mask calls applyMask", () => {
    const rng = createRng("m");
    const out = applyStrategy("jane@example.com", "email", "mask", rng, new Map());
    expect(out).toBe("****@*******.***");
  });
  it("resolveStrategy returns per-type override when defined", () => {
    const cfg: StrategyConfig = {
      default: "mask",
      perType: { email: "redact" },
    };
    expect(resolveStrategy(cfg, "email")).toBe("redact");
    expect(resolveStrategy(cfg, "phone")).toBe("mask");
  });
});

describe("anonymizer text anonymization", () => {
  it("anonymizeText replaces all detected PII", () => {
    const text = "Email: jane@example.com, Phone: 555-123-4567, IP: 10.0.0.1";
    const result = anonymizeText(text, DEFAULT_CONFIG, "seed-1");
    expect(result.output).not.toContain("jane@example.com");
    expect(result.output).not.toContain("555-123-4567");
    expect(result.output).not.toContain("10.0.0.1");
    expect(result.stats.total).toBeGreaterThanOrEqual(3);
  });
  it("anonymizeText returns empty stats for clean text", () => {
    const result = anonymizeText("Hello world, no PII here.", DEFAULT_CONFIG, "seed-1");
    expect(result.stats.total).toBe(0);
    expect(result.output).toBe("Hello world, no PII here.");
  });
  it("anonymizeText is deterministic for same seed", () => {
    const text = "Email: jane@example.com";
    const a = anonymizeText(text, DEFAULT_CONFIG, "seed-1");
    const b = anonymizeText(text, DEFAULT_CONFIG, "seed-1");
    expect(a.output).toBe(b.output);
  });
  it("anonymizeText varies for different seeds", () => {
    const text = "Email: jane@example.com";
    const a = anonymizeText(text, DEFAULT_CONFIG, "seed-1");
    const b = anonymizeText(text, DEFAULT_CONFIG, "seed-2");
    // Pseudonymize uses fake generators which are seed-dependent.
    expect(a.output).not.toBe(b.output);
  });
  it("anonymizeText respects redact strategy", () => {
    const cfg: StrategyConfig = { default: "redact", perType: {} };
    const result = anonymizeText("Email: jane@example.com", cfg, "seed-1");
    expect(result.output).toContain("[REDACTED]");
    expect(result.output).not.toContain("jane@example.com");
  });
  it("anonymizeText respects generalize strategy for DOB", () => {
    const cfg: StrategyConfig = { default: "mask", perType: { dob: "generalize" } };
    const result = anonymizeText("DOB 1990-05-15", cfg, "seed-1");
    expect(result.output).toContain("1990");
    expect(result.output).not.toContain("1990-05-15");
  });
  it("anonymizeText preserves format-preserving credit card Luhn validity", () => {
    const cfg: StrategyConfig = { default: "mask", perType: { "credit-card": "preserve-format" } };
    const result = anonymizeText("Card 4242424242424242", cfg, "seed-1");
    // The output should contain a Luhn-valid number.
    const match = /\d{16}/.exec(result.output);
    expect(match).not.toBeNull();
    expect(luhnValidate(match![0])).toBe(true);
  });
  it("anonymizeText stats include byType breakdown", () => {
    const result = anonymizeText("Email: jane@example.com, IP: 10.0.0.1", DEFAULT_CONFIG, "seed-1");
    expect(result.stats.byType.email).toBe(1);
    expect(result.stats.byType.ip).toBe(1);
  });
  it("anonymizeText masked array records each replacement", () => {
    const result = anonymizeText("Email: jane@example.com", DEFAULT_CONFIG, "seed-1");
    expect(result.masked).toHaveLength(1);
    expect(result.masked[0]!.type).toBe("email");
    expect(result.masked[0]!.original).toBe("jane@example.com");
    expect(result.masked[0]!.replacement).not.toBe("jane@example.com");
  });
});

describe("anonymizer CSV parsing", () => {
  it("splitCsvRow splits simple", () => {
    expect(splitCsvRow("a,b,c")).toEqual(["a", "b", "c"]);
  });
  it("splitCsvRow handles quoted commas", () => {
    expect(splitCsvRow('"a,b",c')).toEqual(["a,b", "c"]);
  });
  it("splitCsvRow handles escaped quotes", () => {
    expect(splitCsvRow('"a""b",c')).toEqual(['a"b', "c"]);
  });
  it("parseCsv parses multiple rows", () => {
    expect(parseCsv("a,b\n1,2\n3,4")).toEqual([["a", "b"], ["1", "2"], ["3", "4"]]);
  });
  it("parseCsv returns empty for empty input", () => {
    expect(parseCsv("")).toEqual([]);
  });
  it("escapeCsvCell escapes commas and quotes", () => {
    expect(escapeCsvCell("hello")).toBe("hello");
    expect(escapeCsvCell("a,b")).toBe('"a,b"');
    expect(escapeCsvCell('a"b')).toBe('"a""b"');
  });
  it("joinCsvRow joins cells with commas", () => {
    expect(joinCsvRow(["a", "b", "c"])).toBe("a,b,c");
    expect(joinCsvRow(["a,b", "c"])).toBe('"a,b",c');
  });
});

describe("anonymizer CSV column detection", () => {
  it("detectColumnPii detects email column", () => {
    const csv = "id,email,name\n1,a@x.com,John\n2,b@y.com,Jane\n3,c@z.com,Bob";
    const rows = parseCsv(csv);
    const cols = detectColumnPii(rows);
    expect(cols[1]!.detectedType).toBe("email");
  });
  it("detectColumnPii detects SSN column", () => {
    const csv = "id,ssn\n1,123-45-6789\n2,234-56-7890\n3,345-67-8901";
    const rows = parseCsv(csv);
    const cols = detectColumnPii(rows);
    expect(cols[1]!.detectedType).toBe("ssn");
  });
  it("detectColumnPii returns null for non-PII column", () => {
    const csv = "id,note\n1,hello\n2,world\n3,foo";
    const rows = parseCsv(csv);
    const cols = detectColumnPii(rows);
    expect(cols[1]!.detectedType).toBeNull();
  });
  it("detectColumnPii handles empty input", () => {
    expect(detectColumnPii([])).toEqual([]);
  });
});

describe("anonymizer CSV anonymization", () => {
  it("anonymizeCsv replaces PII in detected columns", () => {
    const csv = "id,email\n1,a@x.com\n2,b@y.com";
    const result = anonymizeCsv({ input: csv, config: DEFAULT_CONFIG, seed: "s1", autoDetect: true });
    expect(result.output).toContain("id,email");
    expect(result.output).not.toContain("a@x.com");
    expect(result.output).not.toContain("b@y.com");
    expect(result.stats.byType.email).toBe(2);
  });
  it("anonymizeCsv with autoDetect=false still anonymizes inline PII", () => {
    const csv = "id,note\n1,Email: a@x.com\n2,b@y.com";
    const result = anonymizeCsv({ input: csv, config: DEFAULT_CONFIG, seed: "s1", autoDetect: false });
    // Note column is not auto-detected as email-only, so the second row's b@y.com should still be detected inline.
    expect(result.output).not.toContain("a@x.com");
    expect(result.output).not.toContain("b@y.com");
  });
  it("anonymizeCsv returns empty output for empty input", () => {
    const result = anonymizeCsv({ input: "", config: DEFAULT_CONFIG, seed: "s1", autoDetect: true });
    expect(result.output).toBe("");
    expect(result.stats.total).toBe(0);
  });
  it("anonymizeCsv is deterministic for same seed", () => {
    const csv = "id,email\n1,a@x.com\n2,b@y.com";
    const a = anonymizeCsv({ input: csv, config: DEFAULT_CONFIG, seed: "s1", autoDetect: true });
    const b = anonymizeCsv({ input: csv, config: DEFAULT_CONFIG, seed: "s1", autoDetect: true });
    expect(a.output).toBe(b.output);
  });
});

describe("anonymizer JSON anonymization", () => {
  it("anonymizeJson replaces PII in string values", () => {
    const json = JSON.stringify({
      user: { email: "jane@example.com", ip: "10.0.0.1" },
      tags: ["a@x.com", "b@y.com"],
    });
    const result = anonymizeJson({ input: json, config: DEFAULT_CONFIG, seed: "s1" });
    const parsed = JSON.parse(result.output);
    expect(parsed.user.email).not.toBe("jane@example.com");
    expect(parsed.user.ip).not.toBe("10.0.0.1");
    expect(parsed.tags[0]).not.toBe("a@x.com");
    expect(parsed.tags[1]).not.toBe("b@y.com");
  });
  it("anonymizeJson preserves non-PII strings", () => {
    const json = JSON.stringify({ name: "no-pii-here", count: 42, active: true });
    const result = anonymizeJson({ input: json, config: DEFAULT_CONFIG, seed: "s1" });
    const parsed = JSON.parse(result.output);
    expect(parsed.name).toBe("no-pii-here");
    expect(parsed.count).toBe(42);
    expect(parsed.active).toBe(true);
  });
  it("anonymizeJson falls back to text mode on invalid JSON", () => {
    const result = anonymizeJson({ input: "Email: jane@example.com", config: DEFAULT_CONFIG, seed: "s1" });
    expect(result.output).not.toContain("jane@example.com");
  });
  it("anonymizeJson handles nested objects and arrays", () => {
    const json = JSON.stringify({
      level1: { level2: { level3: ["Email: a@x.com"] } },
    });
    const result = anonymizeJson({ input: json, config: DEFAULT_CONFIG, seed: "s1" });
    const parsed = JSON.parse(result.output);
    expect(parsed.level1.level2.level3[0]).not.toContain("a@x.com");
  });
  it("anonymizeJsonValue handles primitive types unchanged", () => {
    const stats = {
      byType: { email: 0, phone: 0, ssn: 0, "credit-card": 0, ip: 0, zipcode: 0, dob: 0, name: 0 } as Record<PiiType, number>,
      byStrategy: { mask: 0, pseudonymize: 0, generalize: 0, fake: 0, "preserve-format": 0, redact: 0 } as Record<Strategy, number>,
    };
    const rng = createRng("s");
    expect(anonymizeJsonValue(42, DEFAULT_CONFIG, rng, new Map(), stats)).toBe(42);
    expect(anonymizeJsonValue(true, DEFAULT_CONFIG, rng, new Map(), stats)).toBe(true);
    expect(anonymizeJsonValue(null, DEFAULT_CONFIG, rng, new Map(), stats)).toBe(null);
  });
});

describe("anonymizer format detection + dispatch", () => {
  it("detectFormat identifies JSON object", () => {
    expect(detectFormat('{"a":1}')).toBe("json");
  });
  it("detectFormat identifies JSON array", () => {
    expect(detectFormat("[1,2,3]")).toBe("json");
  });
  it("detectFormat identifies CSV with consistent columns", () => {
    expect(detectFormat("a,b,c\n1,2,3")).toBe("csv");
  });
  it("detectFormat defaults to text for plain prose", () => {
    expect(detectFormat("Hello world, this is just text.")).toBe("text");
  });
  it("detectFormat returns text for empty input", () => {
    expect(detectFormat("")).toBe("text");
  });
  it("anonymize dispatches to CSV for CSV input", () => {
    const csv = "id,email\n1,a@x.com";
    const result = anonymize({ input: csv, config: DEFAULT_CONFIG, seed: "s1" });
    expect(result.output).toContain("id,email");
    expect(result.output).not.toContain("a@x.com");
  });
  it("anonymize dispatches to JSON for JSON input", () => {
    const json = '{"email":"a@x.com"}';
    const result = anonymize({ input: json, config: DEFAULT_CONFIG, seed: "s1" });
    expect(result.output).not.toContain("a@x.com");
  });
  it("anonymize dispatches to text for prose input", () => {
    const text = "Email: a@x.com";
    const result = anonymize({ input: text, config: DEFAULT_CONFIG, seed: "s1" });
    expect(result.output).not.toContain("a@x.com");
  });
  it("anonymize respects explicit format override", () => {
    const csv = "id,email\n1,a@x.com";
    const result = anonymize({ input: csv, config: DEFAULT_CONFIG, seed: "s1", format: "text" });
    // Treats the whole input as text — still detects email inline.
    expect(result.output).not.toContain("a@x.com");
  });
});

describe("anonymizer history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1, seed: "abc", format: "csv",
      inputBytes: 100, outputBytes: 110, totalPii: 5, defaultStrategy: "pseudonymize",
    });
    const h = loadHistory();
    expect(h).toHaveLength(1);
    expect(h[0]!.seed).toBe("abc");
  });
  it("caps at 20 entries", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i, seed: `s${i}`, format: "csv",
        inputBytes: 100, outputBytes: 110, totalPii: 5, defaultStrategy: "pseudonymize",
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1, seed: "abc", format: "csv",
      inputBytes: 100, outputBytes: 110, totalPii: 5, defaultStrategy: "pseudonymize",
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("anonymizer shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("abc", "redact", { email: "mask" });
    expect(url).toContain("seed=abc");
    expect(url).toContain("def=redact");
    expect(url).toContain("pt=email%3Amask");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("seed=abc&def=redact&pt=email%3Amask");
    expect(p.seed).toBe("abc");
    expect(p.defaultStrategy).toBe("redact");
    expect(p.perType.email).toBe("mask");
  });
  it("handles empty hash with defaults", () => {
    const p = parseShareUrl("");
    expect(p.seed).toBe("");
    expect(p.defaultStrategy).toBe("pseudonymize");
    expect(p.perType).toEqual({});
  });
  it("filters unknown types and strategies", () => {
    const p = parseShareUrl("def=invalid&pt=unknown-type%3Amask");
    expect(p.defaultStrategy).toBe("pseudonymize");
    expect(p.perType).toEqual({});
  });
});

// Suppress unused-import lint
export type _Unused = PiiType | Strategy | StrategyConfig | InputFormat;
