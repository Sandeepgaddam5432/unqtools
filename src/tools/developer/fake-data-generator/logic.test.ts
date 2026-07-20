import { describe, it, expect, beforeEach } from "vitest";
import {
  FIRST_NAMES,
  LAST_NAMES,
  CITIES,
  US_STATES,
  COUNTRIES,
  STREET_SUFFIXES,
  COMPANY_SUFFIXES,
  LOREM_WORDS,
  COLOR_NAMES,
  NATIONALITIES,
  TIMEZONES,
  JOB_TITLES,
  FIELD_TYPES,
  FIELD_TYPE_LABELS,
  DEFAULT_SCHEMA,
  GENERATOR_COUNT,
  mulberry32,
  hashSeed,
  createRng,
  firstName,
  lastName,
  fullName,
  username,
  email,
  phone,
  street,
  city,
  state,
  zip,
  country,
  fullAddress,
  uuid,
  ipv4,
  ipv6,
  mac,
  domainName,
  url,
  slug,
  company,
  jobTitle,
  catchPhrase,
  loremWord,
  loremSentence,
  loremParagraph,
  date,
  timestamp,
  time,
  money,
  age,
  hexColor,
  rgbColor,
  colorName,
  boolean as boolGen,
  integer,
  decimal,
  password,
  nationality,
  isbn,
  semver,
  timezone,
  generateField,
  generateRecord,
  generateBatch,
  exportJson,
  exportCsv,
  exportNdjson,
  exportSql,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  parseSchema,
  serializeSchema,
  addField,
  removeField,
  type FieldType,
  type FieldSchema,
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

describe("fake-data-generator constants", () => {
  it("exposes 30+ generator types", () => {
    expect(FIELD_TYPES.length).toBeGreaterThanOrEqual(30);
  });
  it("labels every type", () => {
    for (const t of FIELD_TYPES) {
      expect(FIELD_TYPE_LABELS[t]).toBeTruthy();
    }
  });
  it("default schema has fields", () => {
    expect(DEFAULT_SCHEMA.fields.length).toBeGreaterThan(5);
  });
  it("first names list is populated", () => {
    expect(FIRST_NAMES.length).toBeGreaterThan(50);
  });
  it("last names list is populated", () => {
    expect(LAST_NAMES.length).toBeGreaterThan(50);
  });
  it("GENERATOR_COUNT matches FIELD_TYPES length", () => {
    expect(GENERATOR_COUNT).toBe(FIELD_TYPES.length);
  });
});

describe("fake-data-generator PRNG", () => {
  it("mulberry32 is deterministic for same seed", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const seqA = [a(), a(), a()];
    const seqB = [b(), b(), b()];
    expect(seqA).toEqual(seqB);
  });
  it("mulberry32 produces values in [0,1)", () => {
    const r = mulberry32(7);
    for (let i = 0; i < 100; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
  it("hashSeed returns 32-bit unsigned for string", () => {
    const h = hashSeed("hello");
    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBeGreaterThanOrEqual(0);
  });
  it("hashSeed returns same input for same string", () => {
    expect(hashSeed("hello")).toBe(hashSeed("hello"));
  });
  it("createRng helpers work", () => {
    const r = createRng("abc");
    expect(r.int(1, 10)).toBeGreaterThanOrEqual(1);
    expect(r.int(1, 10)).toBeLessThanOrEqual(10);
    expect(r.pick([1, 2, 3])).toBeGreaterThanOrEqual(1);
    expect(r.bool()).toBeTypeOf("boolean");
    expect(r.hex(4)).toHaveLength(4);
    expect(r.string(5, "ab")).toHaveLength(5);
  });
  it("createRng is deterministic for same seed", () => {
    const a = createRng("seed-1");
    const b = createRng("seed-1");
    expect(a.int(0, 1000)).toBe(b.int(0, 1000));
    expect(firstName(a)).toBe(firstName(b));
  });
});

describe("fake-data-generator field generators", () => {
  const r = createRng("test-seed");
  it("firstName returns a known first name", () => {
    const v = firstName(r);
    expect(FIRST_NAMES).toContain(v);
  });
  it("lastName returns a known last name", () => {
    const v = lastName(r);
    expect(LAST_NAMES).toContain(v);
  });
  it("fullName is firstName + space + lastName", () => {
    const r2 = createRng("name-test");
    const first = firstName(r2);
    // Reset by recreating rng to compare
    const r3 = createRng("name-test");
    const full = fullName(r3);
    // full starts with a first name from the list
    expect(FIRST_NAMES.some((n) => full.startsWith(n + " "))).toBe(true);
    expect(full.split(" ").length).toBeGreaterThanOrEqual(2);
  });
  it("username is lowercase alphanumeric", () => {
    const u = username(r);
    expect(u).toMatch(/^[a-z0-9._]+$/);
  });
  it("email contains @ and a TLD", () => {
    const e = email(r);
    expect(e).toMatch(/^[a-z0-9._]+@[a-z]+\.[a-z]+$/);
  });
  it("phone matches (xxx) xxx-xxxx", () => {
    expect(phone(r)).toMatch(/^\(\d{3}\) \d{3}-\d{4}$/);
  });
  it("street ends with a suffix", () => {
    const s = street(r);
    expect(STREET_SUFFIXES.some((suf) => s.endsWith(" " + suf))).toBe(true);
  });
  it("city is from list", () => {
    expect(CITIES).toContain(city(r));
  });
  it("state is 2-letter US code", () => {
    const s = state(r);
    expect(s).toMatch(/^[A-Z]{2}$/);
    expect(US_STATES.includes(s)).toBe(true);
  });
  it("zip is 5 digits", () => {
    expect(zip(r)).toMatch(/^\d{5}$/);
  });
  it("country is from list", () => {
    expect(COUNTRIES).toContain(country(r));
  });
  it("fullAddress contains city and state", () => {
    const a = fullAddress(r);
    expect(a).toMatch(/\d+ .+,\s.+,\s[A-Z]{2} \d{5}$/);
  });
  it("uuid is valid v4 format", () => {
    const u = uuid(r);
    expect(u).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}$/);
  });
  it("ipv4 has 4 octets", () => {
    const parts = ipv4(r).split(".");
    expect(parts).toHaveLength(4);
    for (const p of parts) {
      expect(parseInt(p, 10)).toBeGreaterThanOrEqual(0);
      expect(parseInt(p, 10)).toBeLessThanOrEqual(255);
    }
  });
  it("ipv6 has 8 groups", () => {
    expect(ipv6(r).split(":")).toHaveLength(8);
  });
  it("mac has 6 hex groups", () => {
    const parts = mac(r).split(":");
    expect(parts).toHaveLength(6);
    for (const p of parts) expect(p).toMatch(/^[0-9A-F]{2}$/);
  });
  it("domainName has a TLD", () => {
    const d = domainName(r);
    expect(d).toMatch(/^[a-z]+\.[a-z]+$/);
  });
  it("url starts with http(s)://", () => {
    expect(url(r)).toMatch(/^https?:\/\/[a-z]+\.[a-z]+/);
  });
  it("slug is lowercase words joined by dash", () => {
    expect(slug(r, 3)).toMatch(/^[a-z]+(-[a-z]+){2}$/);
  });
  it("company has a suffix", () => {
    const c = company(r);
    expect(COMPANY_SUFFIXES.some((s) => c.endsWith(" " + s))).toBe(true);
  });
  it("jobTitle is from list", () => {
    expect(JOB_TITLES).toContain(jobTitle(r));
  });
  it("catchPhrase has 4 words", () => {
    expect(catchPhrase(r).split(" ").length).toBeGreaterThanOrEqual(4);
  });
  it("loremWord is from list", () => {
    expect(LOREM_WORDS).toContain(loremWord(r));
  });
  it("loremSentence starts with capital and ends with period", () => {
    const s = loremSentence(r);
    expect(s.charAt(0)).toMatch(/[A-Z]/);
    expect(s.endsWith(".")).toBe(true);
  });
  it("loremParagraph contains multiple sentences", () => {
    const p = loremParagraph(r, 4);
    expect(p.split(".").length).toBeGreaterThanOrEqual(4);
  });
  it("date matches YYYY-MM-DD", () => {
    expect(date(r, { minYear: 2000, maxYear: 2020 })).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it("timestamp ends with Z (UTC)", () => {
    expect(timestamp(r)).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
  });
  it("time is HH:MM:SS", () => {
    expect(time(r)).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });
  it("money is $X.YY format", () => {
    expect(money(r)).toMatch(/^\$\d+\.\d{2}$/);
  });
  it("age is in range", () => {
    const a = age(r, 21, 30);
    expect(a).toBeGreaterThanOrEqual(21);
    expect(a).toBeLessThanOrEqual(30);
  });
  it("hexColor is #RRGGBB", () => {
    expect(hexColor(r)).toMatch(/^#[0-9a-f]{6}$/);
  });
  it("rgbColor is rgb(r,g,b)", () => {
    expect(rgbColor(r)).toMatch(/^rgb\(\d+, \d+, \d+\)$/);
  });
  it("colorName is from list", () => {
    expect(COLOR_NAMES).toContain(colorName(r));
  });
  it("boolean is boolean", () => {
    expect([true, false]).toContain(boolGen(r));
  });
  it("integer is in range", () => {
    const v = integer(r, 5, 10);
    expect(v).toBeGreaterThanOrEqual(5);
    expect(v).toBeLessThanOrEqual(10);
  });
  it("decimal has correct precision", () => {
    const v = decimal(r, 0, 100, 3);
    const decimals = String(v).split(".")[1];
    expect((decimals ?? "").length).toBeLessThanOrEqual(3);
  });
  it("password has requested length", () => {
    expect(password(r, 20)).toHaveLength(20);
  });
  it("nationality is from list", () => {
    expect(NATIONALITIES).toContain(nationality(r));
  });
  it("isbn is 13 digits and passes ISBN-13 checksum", () => {
    const i = isbn(r);
    expect(i).toMatch(/^\d{13}$/);
    let sum = 0;
    for (let k = 0; k < 12; k++) {
      const d = parseInt(i[k]!, 10);
      sum += k % 2 === 0 ? d : d * 3;
    }
    const check = (10 - (sum % 10)) % 10;
    expect(parseInt(i[12]!, 10)).toBe(check);
  });
  it("semver has 3 parts", () => {
    expect(semver(r).split(".")).toHaveLength(3);
  });
  it("timezone is from list", () => {
    expect(TIMEZONES).toContain(timezone(r));
  });
});

describe("fake-data-generator schema + batch", () => {
  it("generateField dispatches by type", () => {
    const r = createRng("dispatch");
    const v = generateField({ name: "n", type: "firstName" }, r);
    expect(FIRST_NAMES).toContain(v);
  });
  it("generateField returns constant when type=constant", () => {
    const r = createRng("const");
    const v = generateField({ name: "c", type: "constant", value: "fixed" }, r);
    expect(v).toBe("fixed");
  });
  it("generateField returns null with nullChance=1", () => {
    const r = createRng("null");
    const v = generateField({ name: "x", type: "firstName", nullChance: 1 }, r);
    expect(v).toBeNull();
  });
  it("generateRecord builds all schema fields", () => {
    const r = createRng("rec");
    const rec = generateRecord(DEFAULT_SCHEMA, r);
    expect(Object.keys(rec).length).toBe(DEFAULT_SCHEMA.fields.length);
    expect(rec["id"]).toMatch(/^[0-9a-f-]+$/);
  });
  it("generateBatch is deterministic for same seed", () => {
    const a = generateBatch(DEFAULT_SCHEMA, 5, "seed-x");
    const b = generateBatch(DEFAULT_SCHEMA, 5, "seed-x");
    expect(a).toEqual(b);
  });
  it("generateBatch differs for different seeds", () => {
    const a = generateBatch(DEFAULT_SCHEMA, 5, "seed-1");
    const b = generateBatch(DEFAULT_SCHEMA, 5, "seed-2");
    expect(a).not.toEqual(b);
  });
  it("generateBatch returns requested count", () => {
    const out = generateBatch(DEFAULT_SCHEMA, 7, "count-test");
    expect(out).toHaveLength(7);
  });
  it("generateBatch clamps at 0", () => {
    expect(generateBatch(DEFAULT_SCHEMA, 0, "zero")).toEqual([]);
  });
});

describe("fake-data-generator exports", () => {
  const records = [
    { id: "abc", name: "Alice", age: 30 },
    { id: "def", name: "Bob", age: 25 },
  ];
  it("exportJson is valid JSON array", () => {
    const parsed = JSON.parse(exportJson(records));
    expect(parsed).toEqual(records);
  });
  it("exportCsv has header + 2 rows", () => {
    const csv = exportCsv(records);
    const lines = csv.split("\n");
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe("id,name,age");
  });
  it("exportCsv escapes commas", () => {
    const csv = exportCsv([{ a: 'hello, world', b: 1 }]);
    expect(csv.split("\n")[1]).toBe('"hello, world",1');
  });
  it("exportCsv returns empty for empty records", () => {
    expect(exportCsv([])).toBe("");
  });
  it("exportNdjson is one JSON per line", () => {
    const lines = exportNdjson(records).split("\n");
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0]!)).toEqual(records[0]);
  });
  it("exportSql emits INSERT statements", () => {
    const sql = exportSql(records, "users");
    expect(sql).toContain("INSERT INTO `users` (`id`, `name`, `age`)");
    expect(sql.split("\n").length).toBe(2);
    expect(sql).toContain("'Alice'");
  });
  it("exportSql escapes single quotes", () => {
    const sql = exportSql([{ name: "O'Brien" }], "t");
    expect(sql).toContain("'O''Brien'");
  });
});

describe("fake-data-generator history", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, seed: "abc", count: 10, fieldCount: 5, format: "json" });
    const h = loadHistory();
    expect(h).toHaveLength(1);
    expect(h[0]!.seed).toBe("abc");
  });
  it("caps at 20 entries", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, seed: `s${i}`, count: 10, fieldCount: 5, format: "json" });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, seed: "abc", count: 10, fieldCount: 5, format: "json" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("fake-data-generator shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("abc", 50, "csv", '{"fields":[]}');
    expect(url).toContain("seed=abc");
    expect(url).toContain("count=50");
    expect(url).toContain("fmt=csv");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("seed=abc&count=50&fmt=csv&schema=%7B%22fields%22%3A%5B%5D%7D");
    expect(p.seed).toBe("abc");
    expect(p.count).toBe(50);
    expect(p.format).toBe("csv");
  });
  it("handles empty hash with defaults", () => {
    const p = parseShareUrl("");
    expect(p.seed).toBe("");
    expect(p.count).toBe(10);
    expect(p.format).toBe("json");
  });
  it("rejects unknown format", () => {
    const p = parseShareUrl("fmt=xml");
    expect(p.format).toBe("json");
  });
  it("clamps count to valid range", () => {
    expect(parseShareUrl("count=0").count).toBe(1);
    expect(parseShareUrl("count=99999999").count).toBe(100000);
  });
});

describe("fake-data-generator schema utils", () => {
  it("parseSchema returns null for invalid JSON", () => {
    expect(parseSchema("not json")).toBeNull();
  });
  it("parseSchema returns null for missing fields array", () => {
    expect(parseSchema('{"foo":"bar"}')).toBeNull();
  });
  it("parseSchema returns null for unknown type", () => {
    expect(parseSchema('{"fields":[{"name":"x","type":"bogusType"}]}')).toBeNull();
  });
  it("parseSchema returns schema for valid input", () => {
    const s = parseSchema('{"fields":[{"name":"id","type":"uuid"}]}');
    expect(s).not.toBeNull();
    expect(s!.fields).toHaveLength(1);
  });
  it("serializeSchema produces JSON string", () => {
    const s = serializeSchema(DEFAULT_SCHEMA);
    expect(JSON.parse(s)).toEqual(DEFAULT_SCHEMA);
  });
  it("addField appends a field", () => {
    const next = addField({ fields: [] }, { name: "id", type: "uuid" });
    expect(next.fields).toHaveLength(1);
  });
  it("removeField removes by name", () => {
    const s = { fields: [{ name: "a", type: "uuid" as FieldType }, { name: "b", type: "email" as FieldType }] };
    const next = removeField(s, "a");
    expect(next.fields).toHaveLength(1);
    expect(next.fields[0]!.name).toBe("b");
  });
});

// Suppress unused-import lint
export type _Unused = FieldSchema;
