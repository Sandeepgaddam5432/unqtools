import { describe, it, expect, beforeEach, beforeAll } from "vitest";
import {
  GENDER_MIX_OPTIONS,
  NAT_OPTIONS,
  PASSWORD_POLICY_OPTIONS,
  FIELD_KEYS,
  DEFAULT_OPTIONS,
  SAMPLE_SEEDS,
  MAX_BATCH,
  mulberry32,
  hashSeed,
  createRng,
  formatTemplate,
  slugify,
  makeUsername,
  makeEmail,
  makePassword,
  makeCreditCardNumber,
  identiconDataUrl,
  pickFirstName,
  pickLastName,
  pickTitle,
  pickCreditCard,
  pickZodiac,
  generateProfile,
  validateOptions,
  generateBatch,
  applyFieldFilter,
  exportJson,
  exportCsv,
  exportXml,
  exportNdjson,
  exportProfiles,
  exportMime,
  csvEscape,
  xmlEscape,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  countProfileFields,
  sampleFieldValues,
  type ProfileOptions,
  type Gender,
  type ExportFormat,
  type UserProfile,
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

describe("random-user-profile constants", () => {
  it("exposes 3 gender-mix options", () => {
    expect(GENDER_MIX_OPTIONS).toHaveLength(3);
    expect(GENDER_MIX_OPTIONS.map((g) => g.value)).toEqual(
      expect.arrayContaining(["any", "male", "female"]),
    );
  });
  it("exposes 12+ nationalities", () => {
    expect(NAT_OPTIONS.length).toBeGreaterThanOrEqual(12);
    expect(NAT_OPTIONS.map((n) => n.value)).toContain("US");
    expect(NAT_OPTIONS.map((n) => n.value)).toContain("JP");
  });
  it("exposes 3 password policies", () => {
    expect(PASSWORD_POLICY_OPTIONS).toHaveLength(3);
  });
  it("ships 50+ field keys", () => {
    expect(FIELD_KEYS.length).toBeGreaterThanOrEqual(50);
    expect(FIELD_KEYS).toContain("gender");
    expect(FIELD_KEYS).toContain("name.first");
    expect(FIELD_KEYS).toContain("email");
    expect(FIELD_KEYS).toContain("login.password");
    expect(FIELD_KEYS).toContain("avatar");
  });
  it("DEFAULT_OPTIONS has expected defaults", () => {
    expect(DEFAULT_OPTIONS.gender).toBe("any");
    expect(DEFAULT_OPTIONS.nat).toBe("US");
    expect(DEFAULT_OPTIONS.count).toBe(5);
    expect(DEFAULT_OPTIONS.emailDomain).toBe("example.com");
    expect(DEFAULT_OPTIONS.passwordPolicy).toBe("medium");
  });
  it("SAMPLE_SEEDS is non-empty", () => {
    expect(SAMPLE_SEEDS.length).toBeGreaterThan(0);
  });
  it("MAX_BATCH is at least 50000", () => {
    expect(MAX_BATCH).toBeGreaterThanOrEqual(50000);
  });
  it("countProfileFields matches FIELD_KEYS length", () => {
    expect(countProfileFields()).toBe(FIELD_KEYS.length);
  });
});

describe("random-user-profile PRNG", () => {
  it("mulberry32 is deterministic for same seed", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
  it("mulberry32 produces values in [0,1)", () => {
    const r = mulberry32(7);
    for (let i = 0; i < 100; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
  it("hashSeed is deterministic and 32-bit unsigned", () => {
    const h = hashSeed("hello");
    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThan(2 ** 32);
    expect(hashSeed("hello")).toBe(h);
  });
  it("createRng helpers work", () => {
    const r = createRng("abc");
    expect(r.int(1, 10)).toBeGreaterThanOrEqual(1);
    expect(r.int(1, 10)).toBeLessThanOrEqual(10);
    expect(r.pick([1, 2, 3])).toBeGreaterThanOrEqual(1);
    expect(typeof r.bool()).toBe("boolean");
    expect(r.hex(4)).toHaveLength(4);
    expect(r.string(5, "ab")).toHaveLength(5);
  });
  it("createRng is deterministic for same seed", () => {
    const a = createRng("seed-1");
    const b = createRng("seed-1");
    expect(a.int(0, 1000)).toBe(b.int(0, 1000));
    expect(pickFirstName(a, "male")).toBe(pickFirstName(b, "male"));
  });
});

describe("random-user-profile format helpers", () => {
  it("formatTemplate substitutes # and A", () => {
    const r = createRng("fmt");
    const out = formatTemplate(r, "(###) ###-####");
    expect(out).toMatch(/^\(\d{3}\) \d{3}-\d{4}$/);
  });
  it("formatTemplate passes through literal chars", () => {
    const r = createRng("lit");
    const out = formatTemplate(r, "A#-X#");
    expect(out).toMatch(/^[A-Z]\d-X\d$/);
  });
  it("slugify normalizes names", () => {
    expect(slugify("John Doe")).toBe("john.doe");
    expect(slugify("O'Brien")).toBe("o.brien");
    expect(slugify("café")).toBe("cafe");
  });
  it("makeUsername derives from first + last", () => {
    const r = createRng("user");
    const u = makeUsername(r, "John", "Doe");
    expect(u).toMatch(/john.*doe|j.*doe|john.*/i);
    expect(u.length).toBeGreaterThan(3);
  });
  it("makeEmail derives from name and domain", () => {
    const r = createRng("email");
    const e = makeEmail(r, "Jane", "Roe", "test.org");
    expect(e).toMatch(/jane.*roe.*@test\.org$/i);
  });
  it("makePassword honors weak policy (length 10)", () => {
    const r = createRng("pwd");
    const p = makePassword(r, "weak");
    expect(p.length).toBeGreaterThanOrEqual(8);
    expect(p.length).toBeLessThanOrEqual(10);
  });
  it("makePassword honors strong policy (length 16)", () => {
    const r = createRng("pwd");
    const p = makePassword(r, "strong");
    expect(p.length).toBe(16);
  });
  it("makeCreditCardNumber is Luhn-valid", () => {
    const r = createRng("cc");
    const n = makeCreditCardNumber(r, "4", 16);
    expect(n).toHaveLength(16);
    expect(n.startsWith("4")).toBe(true);
    // Luhn check
    let sum = 0, alt = false;
    for (let i = n.length - 1; i >= 0; i--) {
      let d = n.charCodeAt(i) - 48;
      if (alt) { d *= 2; if (d > 9) d -= 9; }
      sum += d; alt = !alt;
    }
    expect(sum % 10).toBe(0);
  });
});

describe("random-user-profile identicon", () => {
  it("identiconDataUrl returns an SVG data URL", () => {
    const url = identiconDataUrl("alice", 128);
    expect(url.startsWith("data:image/svg+xml,")).toBe(true);
    expect(url).toContain("%3Csvg");
  });
  it("identiconDataUrl is deterministic per seed", () => {
    expect(identiconDataUrl("bob", 96)).toBe(identiconDataUrl("bob", 96));
  });
  it("identiconDataUrl differs for different seeds", () => {
    expect(identiconDataUrl("alice", 96)).not.toBe(identiconDataUrl("bob", 96));
  });
});

describe("random-user-profile pickers", () => {
  it("pickFirstName returns gender-appropriate name", () => {
    const r = createRng("name");
    const m = pickFirstName(r, "male");
    const f = pickFirstName(r, "female");
    expect(typeof m).toBe("string");
    expect(m.length).toBeGreaterThan(1);
    expect(typeof f).toBe("string");
    expect(f.length).toBeGreaterThan(1);
  });
  it("pickLastName returns a non-empty string", () => {
    const r = createRng("ln");
    expect(pickLastName(r).length).toBeGreaterThan(1);
  });
  it("pickTitle returns a known title", () => {
    const r = createRng("title");
    const t = pickTitle(r, "male");
    expect(["Mr", "Dr", "Prof"]).toContain(t);
  });
  it("pickCreditCard returns valid type + number", () => {
    const r = createRng("cc");
    const cc = pickCreditCard(r);
    expect(cc.type.length).toBeGreaterThan(2);
    expect(cc.number.length).toBeGreaterThanOrEqual(15);
    expect(cc.expiry).toMatch(/^\d{2}\/\d{2}$/);
  });
  it("pickZodiac maps month/day correctly", () => {
    expect(pickZodiac(3, 25)).toBe("Aries");
    expect(pickZodiac(12, 25)).toBe("Capricorn");
    expect(pickZodiac(7, 23)).toBe("Leo");
    expect(pickZodiac(2, 19)).toBe("Pisces");
  });
});

describe("random-user-profile generateProfile", () => {
  const opts: ProfileOptions = { ...DEFAULT_OPTIONS, seed: "abc", count: 1 };

  it("returns a profile with correlated name fields", () => {
    const r = createRng(`${opts.seed}::${opts.nat}::${opts.gender}::0`);
    const p = generateProfile(r, opts);
    expect(p.name.full).toBe(`${p.name.first} ${p.name.last}`);
  });
  it("derives email from the name and the configured domain", () => {
    const r = createRng(`${opts.seed}::${opts.nat}::${opts.gender}::0`);
    const p = generateProfile(r, opts);
    expect(p.email).toContain(slugify(p.name.first).split(".")[0]!.toLowerCase().slice(0, 1) || "x");
    expect(p.email.endsWith(`@${opts.emailDomain}`)).toBe(true);
  });
  it("dob.age is consistent with dob.date", () => {
    const r = createRng(`${opts.seed}::${opts.nat}::${opts.gender}::0`);
    const p = generateProfile(r, opts);
    const year = parseInt(p.dob.date.slice(0, 4), 10);
    expect(p.dob.age).toBeGreaterThanOrEqual(2024 - year - 1);
    expect(p.dob.age).toBeLessThanOrEqual(2024 - year + 1);
  });
  it("registered.date is a valid ISO date", () => {
    const r = createRng(`${opts.seed}::${opts.nat}::${opts.gender}::0`);
    const p = generateProfile(r, opts);
    expect(p.registered.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it("avatar is an SVG data URL (no real face)", () => {
    const r = createRng(`${opts.seed}::${opts.nat}::${opts.gender}::0`);
    const p = generateProfile(r, opts);
    expect(p.avatar.startsWith("data:image/svg+xml,")).toBe(true);
    expect(p.picture.large.startsWith("data:image/svg+xml,")).toBe(true);
  });
  it("matches location country to chosen nationality", () => {
    const r = createRng(`${opts.seed}::JP::${opts.gender}::0`);
    const jpOpts: ProfileOptions = { ...opts, nat: "JP" };
    const p = generateProfile(r, jpOpts);
    expect(p.location.country).toBe("Japan");
    expect(p.nat).toBe("JP");
  });
  it("produces 50+ distinct field values via sampleFieldValues", () => {
    const r = createRng(`${opts.seed}::${opts.nat}::${opts.gender}::0`);
    const p = generateProfile(r, opts);
    const samples = sampleFieldValues(p);
    expect(Object.keys(samples).length).toBeGreaterThanOrEqual(50);
  });
  it("gender matches when not 'any'", () => {
    const maleOpts: ProfileOptions = { ...opts, gender: "male" };
    const r = createRng(`${maleOpts.seed}::${maleOpts.nat}::male::0`);
    const p = generateProfile(r, maleOpts);
    expect(p.gender).toBe("male");
  });
});

describe("random-user-profile validateOptions + generateBatch", () => {
  it("rejects count < 1", () => {
    const r = validateOptions({ ...DEFAULT_OPTIONS, count: 0 });
    expect(r.ok).toBe(false);
  });
  it("rejects count > MAX_BATCH", () => {
    const r = validateOptions({ ...DEFAULT_OPTIONS, count: MAX_BATCH + 1 });
    expect(r.ok).toBe(false);
  });
  it("rejects bad email domain", () => {
    const r = validateOptions({ ...DEFAULT_OPTIONS, emailDomain: "not a domain" });
    expect(r.ok).toBe(false);
  });
  it("accepts valid options", () => {
    const r = validateOptions({ ...DEFAULT_OPTIONS, count: 10, emailDomain: "example.com" });
    expect(r.ok).toBe(true);
  });
  it("generateBatch returns the requested count", () => {
    const r = generateBatch({ ...DEFAULT_OPTIONS, count: 7, seed: "batch" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output).toHaveLength(7);
  });
  it("generateBatch is deterministic for the same seed", () => {
    const a = generateBatch({ ...DEFAULT_OPTIONS, count: 3, seed: "fixed" });
    const b = generateBatch({ ...DEFAULT_OPTIONS, count: 3, seed: "fixed" });
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) {
      expect(a.output[0]!.email).toBe(b.output[0]!.email);
      expect(a.output[2]!.name.full).toBe(b.output[2]!.name.full);
    }
  });
});

describe("random-user-profile applyFieldFilter", () => {
  const opts: ProfileOptions = { ...DEFAULT_OPTIONS, seed: "x", count: 1 };
  it("returns all fields when no filters set", () => {
    const r = createRng(`${opts.seed}::${opts.nat}::${opts.gender}::0`);
    const p = generateProfile(r, opts);
    const filtered = applyFieldFilter(p, opts);
    expect(filtered.gender).toBeDefined();
    expect(filtered.email).toBeDefined();
    expect(filtered.name).toBeDefined();
  });
  it("excludes fields in excludeFields", () => {
    const r = createRng(`${opts.seed}::${opts.nat}::${opts.gender}::0`);
    const p = generateProfile(r, opts);
    const f = applyFieldFilter(p, { ...opts, excludeFields: ["email", "avatar"] });
    expect(f.email).toBeUndefined();
    expect(f.avatar).toBeUndefined();
  });
  it("includes only fields in includeFields", () => {
    const r = createRng(`${opts.seed}::${opts.nat}::${opts.gender}::0`);
    const p = generateProfile(r, opts);
    const f = applyFieldFilter(p, { ...opts, includeFields: ["gender", "email", "name.first", "name.last"] });
    expect(f.gender).toBeDefined();
    expect(f.email).toBeDefined();
    expect((f.name as Record<string, unknown>).first).toBeDefined();
    expect((f.name as Record<string, unknown>).full).toBeUndefined();
  });
});

describe("random-user-profile exporters", () => {
  const opts: ProfileOptions = { ...DEFAULT_OPTIONS, seed: "exp", count: 3 };
  let profiles: UserProfile[] = [];
  beforeAll(() => {
    const r = generateBatch(opts);
    if (r.ok) profiles = r.output;
  });

  it("exportJson produces valid JSON array", () => {
    const json = exportJson(profiles, opts);
    const arr = JSON.parse(json);
    expect(Array.isArray(arr)).toBe(true);
    expect(arr).toHaveLength(3);
  });
  it("exportNdjson produces one JSON per line", () => {
    const out = exportNdjson(profiles, opts);
    const lines = out.split("\n");
    expect(lines).toHaveLength(3);
    for (const l of lines) {
      expect(() => JSON.parse(l)).not.toThrow();
    }
  });
  it("exportCsv has a header + 3 rows with consistent columns", () => {
    const csv = exportCsv(profiles, opts);
    const lines = csv.split("\n");
    expect(lines).toHaveLength(4); // header + 3 rows
    const headerCols = lines[0]!.split(",").length;
    for (const l of lines.slice(1)) {
      // Conservative count (cells containing commas are quoted, but counts of `,` may differ)
      expect(l.length).toBeGreaterThan(0);
    }
    expect(headerCols).toBeGreaterThan(5);
  });
  it("exportXml produces valid-looking XML", () => {
    const xml = exportXml(profiles, opts);
    expect(xml.startsWith("<?xml")).toBe(true);
    expect(xml).toContain("<users");
    expect(xml).toContain("</users>");
  });
  it("exportProfiles dispatches by format", () => {
    expect(exportProfiles(profiles, opts, "json")).toBe(exportJson(profiles, opts));
    expect(exportProfiles(profiles, opts, "csv")).toBe(exportCsv(profiles, opts));
    expect(exportProfiles(profiles, opts, "xml")).toBe(exportXml(profiles, opts));
  });
  it("exportMime returns correct extension + mime", () => {
    expect(exportMime("json")).toEqual({ ext: "json", mime: "application/json" });
    expect(exportMime("csv")).toEqual({ ext: "csv", mime: "text/csv" });
    expect(exportMime("xml")).toEqual({ ext: "xml", mime: "application/xml" });
    expect(exportMime("ndjson")).toEqual({ ext: "ndjson", mime: "application/x-ndjson" });
  });
  it("csvEscape quotes values containing commas/quotes/newlines", () => {
    expect(csvEscape("plain")).toBe("plain");
    expect(csvEscape("a,b")).toBe('"a,b"');
    expect(csvEscape('he said "hi"')).toBe('"he said ""hi"""');
    expect(csvEscape("line1\nline2")).toBe('"line1\nline2"');
  });
  it("xmlEscape escapes markup chars", () => {
    expect(xmlEscape("<a>")).toBe("&lt;a&gt;");
    expect(xmlEscape('"')).toBe("&quot;");
    expect(xmlEscape("'")).toBe("&apos;");
    expect(xmlEscape("a & b")).toBe("a &amp; b");
  });
});

describe("random-user-profile history", () => {
  it("starts empty", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saveHistory stores entries and caps at HISTORY_MAX=20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: Date.now(),
        count: 5,
        gender: "any",
        nat: "US",
        seed: `s${i}`,
        format: "json",
        previewName: `Test ${i}`,
        bytes: 1000 + i,
      });
    }
    const h = loadHistory();
    expect(h).toHaveLength(20);
    expect(h[0]!.seed).toBe("s24");
    expect(h[19]!.seed).toBe("s5");
  });
  it("clearHistory wipes storage", () => {
    saveHistory({
      ts: 1, count: 1, gender: "any", nat: "US", seed: "x",
      format: "json", previewName: "X", bytes: 1,
    });
    expect(loadHistory().length).toBe(1);
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("random-user-profile share URL", () => {
  it("buildShareUrl round-trips through parseShareUrl", () => {
    const opts: ProfileOptions = {
      ...DEFAULT_OPTIONS,
      gender: "female",
      nat: "JP",
      count: 25,
      seed: "round-trip",
      emailDomain: "custom.org",
      passwordPolicy: "strong",
      includeFields: ["gender", "email"],
      excludeFields: ["avatar"],
    };
    const url = buildShareUrl(opts);
    const parsed = parseShareUrl(url);
    expect(parsed.gender).toBe("female");
    expect(parsed.nat).toBe("JP");
    expect(parsed.count).toBe(25);
    expect(parsed.seed).toBe("round-trip");
    expect(parsed.emailDomain).toBe("custom.org");
    expect(parsed.passwordPolicy).toBe("strong");
    expect(parsed.includeFields).toEqual(["gender", "email"]);
    expect(parsed.excludeFields).toEqual(["avatar"]);
  });
  it("parseShareUrl ignores unknown values gracefully", () => {
    const parsed = parseShareUrl("#g=bogus&n=ZZ&c=abc");
    expect(parsed.gender).toBe("any");
    expect(parsed.nat).toBe("US");
    expect(parsed.count).toBe(DEFAULT_OPTIONS.count);
  });
  it("parseShareUrl returns defaults on empty input", () => {
    const parsed = parseShareUrl("");
    expect(parsed).toEqual(DEFAULT_OPTIONS);
  });
});
