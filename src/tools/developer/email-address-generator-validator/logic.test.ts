import { describe, it, expect, beforeEach } from "vitest";
import {
  DISPOSABLE_DOMAINS,
  DISPOSABLE_DOMAIN_SET,
  COMMON_DOMAINS,
  DOMAIN_TYPOS,
  ROLE_LOCALPARTS,
  ROLE_LOCALPART_SET,
  NAME_FORMATS,
  mulberry32,
  hashSeed,
  createRng,
  normalizeEmail,
  parseEmail,
  validateEmail,
  isValidUnquotedLocal,
  isValidQuotedLocal,
  isValidDomain,
  isValidDomainLabel,
  isValidTld,
  isDisposableDomain,
  isRoleLocalPart,
  suggestDomainTypo,
  renderNameLocal,
  generateEmail,
  generateEmailBatch,
  maskEmail,
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
  CANONICAL_VALID_EMAILS,
  CANONICAL_INVALID_EMAILS,
  type NameFormat,
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

describe("email-address-generator-validator constants", () => {
  it("ships 100+ disposable domains", () => {
    expect(DISPOSABLE_DOMAINS.length).toBeGreaterThanOrEqual(100);
    expect(DISPOSABLE_DOMAIN_SET.size).toBeGreaterThanOrEqual(100);
  });
  it("disposable set contains known providers", () => {
    expect(DISPOSABLE_DOMAIN_SET.has("mailinator.com")).toBe(true);
    expect(DISPOSABLE_DOMAIN_SET.has("10minutemail.com")).toBe(true);
    expect(DISPOSABLE_DOMAIN_SET.has("guerrillamail.com")).toBe(true);
    expect(DISPOSABLE_DOMAIN_SET.has("tempmail.com")).toBe(true);
    expect(DISPOSABLE_DOMAIN_SET.has("yopmail.com")).toBe(true);
  });
  it("ships common provider domains", () => {
    expect(COMMON_DOMAINS.length).toBeGreaterThanOrEqual(5);
    expect(COMMON_DOMAINS).toContain("gmail.com");
    expect(COMMON_DOMAINS).toContain("outlook.com");
  });
  it("ships domain typo map", () => {
    expect(Object.keys(DOMAIN_TYPOS).length).toBeGreaterThanOrEqual(5);
    expect(DOMAIN_TYPOS["gmial.com"]).toBe("gmail.com");
    expect(DOMAIN_TYPOS["hotnail.com"]).toBe("hotmail.com");
    expect(DOMAIN_TYPOS["yaho.com"]).toBe("yahoo.com");
  });
  it("ships role local-parts", () => {
    expect(ROLE_LOCALPARTS.length).toBeGreaterThanOrEqual(10);
    expect(ROLE_LOCALPART_SET.has("info")).toBe(true);
    expect(ROLE_LOCALPART_SET.has("admin")).toBe(true);
    expect(ROLE_LOCALPART_SET.has("billing")).toBe(true);
  });
  it("ships name formats", () => {
    expect(NAME_FORMATS.length).toBeGreaterThanOrEqual(5);
    expect(NAME_FORMATS).toContain("first.last");
    expect(NAME_FORMATS).toContain("flast");
  });
  it("has honesty banner text", () => {
    expect(HONESTY_BANNER.length).toBeGreaterThan(20);
    expect(HONESTY_BANNER.toLowerCase()).toContain("testing");
  });
});

describe("email-address-generator-validator PRNG", () => {
  it("mulberry32 is deterministic for same seed", () => {
    const r1 = mulberry32(42);
    const r2 = mulberry32(42);
    expect(r1()).toBe(r2());
  });
  it("hashSeed handles strings and numbers", () => {
    expect(hashSeed("abc")).toBe(hashSeed("abc"));
    expect(hashSeed(42)).toBe(42);
  });
  it("createRng exposes helpers", () => {
    const rng = createRng("seed-x");
    expect(rng.int(1, 5)).toBeGreaterThanOrEqual(1);
    expect(rng.int(1, 5)).toBeLessThanOrEqual(5);
    expect(["a", "b"]).toContain(rng.pick(["a", "b"]));
    expect(rng.letter()).toMatch(/^[a-z]$/);
    expect(rng.digit()).toMatch(/^[0-9]$/);
  });
});

describe("email-address-generator-validator normalizeEmail", () => {
  it("lowercases and trims", () => {
    expect(normalizeEmail("  Foo@BAR.COM  ")).toBe("foo@bar.com");
  });
  it("handles empty", () => {
    expect(normalizeEmail("")).toBe("");
  });
});

describe("email-address-generator-validator parseEmail", () => {
  it("parses simple address", () => {
    const p = parseEmail("user@example.com");
    expect(p).not.toBeNull();
    expect(p!.local).toBe("user");
    expect(p!.domain).toBe("example.com");
    expect(p!.quoted).toBe(false);
    expect(p!.plusTag).toBeNull();
    expect(p!.baseLocal).toBe("user");
  });
  it("parses plus-addressing", () => {
    const p = parseEmail("user+tag@example.com");
    expect(p!.plusTag).toBe("tag");
    expect(p!.baseLocal).toBe("user");
  });
  it("parses quoted local-part", () => {
    const p = parseEmail('"hello world"@example.com');
    expect(p!.quoted).toBe(true);
    expect(p!.local).toBe('"hello world"');
  });
  it("returns null for missing @", () => {
    expect(parseEmail("no-at-sign")).toBeNull();
  });
  it("returns null for empty input", () => {
    expect(parseEmail("")).toBeNull();
  });
});

describe("email-address-generator-validator syntax helpers", () => {
  it("isValidUnquotedLocal accepts simple + specials", () => {
    expect(isValidUnquotedLocal("user")).toBe(true);
    expect(isValidUnquotedLocal("user.name")).toBe(true);
    expect(isValidUnquotedLocal("user+tag")).toBe(true);
    expect(isValidUnquotedLocal("a_b-c.d")).toBe(true);
  });
  it("isValidUnquotedLocal rejects bad patterns", () => {
    expect(isValidUnquotedLocal(".user")).toBe(false);
    expect(isValidUnquotedLocal("user.")).toBe(false);
    expect(isValidUnquotedLocal("user..name")).toBe(false);
    expect(isValidUnquotedLocal("user name")).toBe(false);
    expect(isValidUnquotedLocal('user"quoted"')).toBe(false);
  });
  it("isValidQuotedLocal accepts valid quoted forms", () => {
    expect(isValidQuotedLocal('"hello world"')).toBe(true);
    expect(isValidQuotedLocal('"much.more unusual"')).toBe(true);
  });
  it("isValidQuotedLocal rejects unescaped inner quotes", () => {
    expect(isValidQuotedLocal('"hello"world"')).toBe(false);
    expect(isValidQuotedLocal('"trailing\\"')).toBe(false);
  });
  it("isValidDomain checks structure", () => {
    expect(isValidDomain("example.com")).toBe(true);
    expect(isValidDomain("sub.example.co.uk")).toBe(true);
    expect(isValidDomain("example")).toBe(false);
    expect(isValidDomain(".example.com")).toBe(false);
    expect(isValidDomain("example..com")).toBe(false);
  });
  it("isValidDomainLabel checks chars and hyphens", () => {
    expect(isValidDomainLabel("example")).toBe(true);
    expect(isValidDomainLabel("my-label")).toBe(true);
    expect(isValidDomainLabel("123")).toBe(true);
    expect(isValidDomainLabel("-bad")).toBe(false);
    expect(isValidDomainLabel("bad-")).toBe(false);
    expect(isValidDomainLabel("bad_underscore")).toBe(false);
  });
  it("isValidTld requires 2+ letters", () => {
    expect(isValidTld("com")).toBe(true);
    expect(isValidTld("uk")).toBe(true);
    expect(isValidTld("c")).toBe(false);
    expect(isValidTld("123")).toBe(false);
    expect(isValidTld("")).toBe(false);
  });
});

describe("email-address-generator-validator disposable/role/typo", () => {
  it("isDisposableDomain detects known throwaways", () => {
    expect(isDisposableDomain("mailinator.com")).toBe(true);
    expect(isDisposableDomain("MAILINATOR.COM")).toBe(true);
    expect(isDisposableDomain("gmail.com")).toBe(false);
  });
  it("isRoleLocalPart detects role addresses", () => {
    expect(isRoleLocalPart("info")).toBe(true);
    expect(isRoleLocalPart("admin")).toBe(true);
    expect(isRoleLocalPart("alice")).toBe(false);
  });
  it("isRoleLocalPart strips plus-tag before checking", () => {
    expect(isRoleLocalPart("info+marketing")).toBe(true);
    expect(isRoleLocalPart("alice+personal")).toBe(false);
  });
  it("suggestDomainTypo returns correction", () => {
    expect(suggestDomainTypo("gmial.com")).toBe("gmail.com");
    expect(suggestDomainTypo("hotnail.com")).toBe("hotmail.com");
    expect(suggestDomainTypo("gmail.com")).toBeNull();
  });
});

describe("email-address-generator-validator validateEmail", () => {
  it("validates a simple address", () => {
    const r = validateEmail("user@example.com");
    expect(r.valid).toBe(true);
    expect(r.code).toBe("valid");
    expect(r.local).toBe("user");
    expect(r.domain).toBe("example.com");
    expect(r.tld).toBe("com");
  });
  it("validates a plus-tag address", () => {
    const r = validateEmail("user+newsletter@gmail.com");
    expect(r.valid).toBe(true);
    expect(r.plusTag).toBe("newsletter");
    expect(r.baseLocal).toBe("user");
  });
  it("validates a quoted local-part", () => {
    const r = validateEmail('"hello world"@example.com');
    expect(r.valid).toBe(true);
  });
  it("detects disposable domain", () => {
    const r = validateEmail("anything@mailinator.com");
    expect(r.valid).toBe(true);
    expect(r.isDisposable).toBe(true);
  });
  it("detects role address", () => {
    const r = validateEmail("info@company.com");
    expect(r.valid).toBe(true);
    expect(r.isRole).toBe(true);
  });
  it("detects typo", () => {
    const r = validateEmail("user@gmial.com");
    expect(r.valid).toBe(true);
    expect(r.typoSuggestion).toBe("gmail.com");
  });
  it("rejects empty input", () => {
    expect(validateEmail("").valid).toBe(false);
  });
  it("rejects missing @", () => {
    expect(validateEmail("notanemail").valid).toBe(false);
  });
  it("rejects TLD too short", () => {
    expect(validateEmail("user@example.c").valid).toBe(false);
  });
  it("all canonical valid emails pass", () => {
    for (const v of CANONICAL_VALID_EMAILS) {
      const r = validateEmail(v.email);
      expect(r.valid, `${v.email} should be valid (note: ${v.note})`).toBe(true);
    }
  });
  it("all canonical invalid emails fail", () => {
    for (const v of CANONICAL_INVALID_EMAILS) {
      const r = validateEmail(v.email);
      expect(r.valid, `${JSON.stringify(v.email)} should be invalid (note: ${v.note})`).toBe(false);
    }
  });
});

describe("email-address-generator-validator generation", () => {
  it("generates random-mode emails", () => {
    const batch = generateEmailBatch({ mode: "random", count: 5, seed: "rand-1" });
    expect(batch).toHaveLength(5);
    for (const e of batch) {
      const r = validateEmail(e);
      expect(r.valid, `${e} should be valid`).toBe(true);
    }
  });
  it("generates name-mode emails with format", () => {
    const batch = generateEmailBatch({
      mode: "name", count: 3, seed: "name-1",
      firstName: "Jane", lastName: "Doe", format: "first.last", domain: "example.com",
    });
    expect(batch).toHaveLength(3);
    expect(batch[0]).toBe("jane.doe@example.com");
  });
  it("renderNameLocal covers all formats", () => {
    expect(renderNameLocal("Jane", "Doe", "first.last")).toBe("jane.doe");
    expect(renderNameLocal("Jane", "Doe", "firstlast")).toBe("janedoe");
    expect(renderNameLocal("Jane", "Doe", "flast")).toBe("jdoe");
    expect(renderNameLocal("Jane", "Doe", "firstl")).toBe("janed");
    expect(renderNameLocal("Jane", "Doe", "last.first")).toBe("doe.jane");
    expect(renderNameLocal("Jane", "Doe", "f_last")).toBe("jane_doe");
    expect(renderNameLocal("Jane", "Doe", "first")).toBe("jane");
  });
  it("generates deterministic batch with same seed", () => {
    const b1 = generateEmailBatch({ mode: "random", count: 5, seed: "abc", domain: "example.com" });
    const b2 = generateEmailBatch({ mode: "random", count: 5, seed: "abc", domain: "example.com" });
    expect(b1).toEqual(b2);
  });
  it("caps batch at 1000", () => {
    const batch = generateEmailBatch({ mode: "random", count: 5000, seed: "x", domain: "example.com" });
    expect(batch.length).toBe(1000);
  });
  it("generateEmail uses provided domain", () => {
    const rng = createRng("d1");
    const e = generateEmail({ mode: "random", count: 1, domain: "myorg.test" }, rng);
    expect(e.endsWith("@myorg.test")).toBe(true);
  });
});

describe("email-address-generator-validator maskEmail", () => {
  it("masks middle of local-part", () => {
    const masked = maskEmail("alice@example.com");
    expect(masked).toContain("@example.com");
    expect(masked).toContain("•");
    expect(masked).toContain("a");
  });
  it("handles single-char local", () => {
    expect(maskEmail("a@b.com")).toBe("a@b.com");
  });
  it("handles invalid input", () => {
    expect(maskEmail("not-an-email")).toBe("not-an-email");
  });
});

describe("email-address-generator-validator batch", () => {
  it("parseBatchInput splits on newlines/commas", () => {
    expect(parseBatchInput("a@x.com\nb@y.com, c@z.com")).toEqual(["a@x.com", "b@y.com", "c@z.com"]);
  });
  it("parseBatchInput skips blank lines", () => {
    expect(parseBatchInput("a@x.com\n\nb@y.com")).toHaveLength(2);
  });
  it("validateBatch returns one row per input", () => {
    const rows = validateBatch(["user@example.com", "bad", "info@company.com"]);
    expect(rows).toHaveLength(3);
    expect(rows[0]!.valid).toBe(true);
    expect(rows[1]!.valid).toBe(false);
    expect(rows[2]!.isRole).toBe(true);
  });
  it("summarizeBatch computes counts", () => {
    const rows = validateBatch(["user@example.com", "info@company.com", "x@mailinator.com", "bad"]);
    const s = summarizeBatch(rows);
    expect(s.total).toBe(4);
    expect(s.valid).toBe(3);
    expect(s.invalid).toBe(1);
    expect(s.role).toBe(1);
    expect(s.disposable).toBe(1);
  });
  it("renderBatchCsv has headers", () => {
    const csv = renderBatchCsv([]);
    expect(csv).toContain("index,raw,normalized,valid,code,disposable,role,typo,tld,message");
  });
  it("renderBatchCsv renders row data", () => {
    const csv = renderBatchCsv(validateBatch(["user@example.com"]));
    expect(csv).toContain("user@example.com");
    expect(csv).toContain("valid");
    expect(csv).toContain("com");
  });
});

describe("email-address-generator-validator history (localStorage)", () => {
  it("loads empty initially", () => { expect(loadHistory()).toEqual([]); });
  it("saves and loads", () => {
    saveHistory({ ts: 1, action: "generate", mode: "random", domain: "example.com", generateCount: 5, batchTotal: 0, batchValid: 0, batchInvalid: 0, batchDisposable: 0 });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, action: "generate", mode: "random", domain: "example.com", generateCount: 1, batchTotal: 0, batchValid: 0, batchInvalid: 0, batchDisposable: 0 });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, action: "generate", mode: "random", domain: "example.com", generateCount: 1, batchTotal: 0, batchValid: 0, batchInvalid: 0, batchDisposable: 0 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("email-address-generator-validator shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("random", 10, "example.com", "first.last");
    expect(url).toContain("mode=random");
    expect(url).toContain("count=10");
    expect(url).toContain("domain=example.com");
    expect(url).toContain("fmt=first.last");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("mode=name&count=25&domain=gmail.com&fmt=flast");
    expect(p.mode).toBe("name");
    expect(p.count).toBe(25);
    expect(p.domain).toBe("gmail.com");
    expect(p.format).toBe("flast");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({ mode: "random", count: 10, domain: "", format: "first.last" });
  });
  it("filters unknown format", () => {
    const p = parseShareUrl("fmt=garbage");
    expect(p.format).toBe("first.last");
  });
  it("clamps count to 1..1000", () => {
    expect(parseShareUrl("count=0").count).toBe(1);
    expect(parseShareUrl("count=99999").count).toBe(1000);
  });
});

// Suppress unused-import lint
export type _Unused = NameFormat;
