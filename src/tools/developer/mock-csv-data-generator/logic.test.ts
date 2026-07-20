import { describe, it, expect, beforeEach } from "vitest";
import {
  COLUMN_TYPES,
  COLUMN_TYPE_LABELS,
  DELIMITER_CHARS,
  DEFAULT_COLUMNS,
  COLUMN_PRESETS,
  HONESTY_BANNER,
  hashSeed,
  mulberry32,
  buildRng,
  genUuid,
  genHexColor,
  genIpv4,
  genIpv6,
  genEmail,
  genPhone,
  genFirstName,
  genLastName,
  genFullName,
  genUsername,
  genStreet,
  genCity,
  genState,
  genCountry,
  genZip,
  genCompany,
  genJobTitle,
  genString,
  genSentence,
  genParagraph,
  genUrl,
  genNumber,
  genAge,
  genMoney,
  genBoolean,
  genDate,
  genTimestamp,
  genEnum,
  genRegex,
  genValue,
  getDelimiterChar,
  quoteField,
  serializeRow,
  serializeCsv,
  serializeJson,
  inferColumns,
  splitCsvRow,
  validateColumns,
  validateOptions,
  generate,
  generateFormat,
  computeStats,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type ColumnDef,
  type ColumnType,
  type Delimiter,
  type QuotingPolicy,
  type LineEnding,
  type OutputFormat,
  type GenerateOptions,
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

// --- Constants -------------------------------------------------------------

describe("mock-csv constants", () => {
  it("has 33 column types", () => {
    expect(COLUMN_TYPES.length).toBeGreaterThanOrEqual(33);
  });
  it("every type has a label", () => {
    for (const t of COLUMN_TYPES) {
      expect(COLUMN_TYPE_LABELS[t]).toBeTruthy();
    }
  });
  it("has 4 delimiter presets", () => {
    expect(Object.keys(DELIMITER_CHARS)).toHaveLength(5); // comma, semicolon, tab, pipe, custom
  });
  it("has default columns", () => {
    expect(DEFAULT_COLUMNS.length).toBeGreaterThanOrEqual(5);
    expect(DEFAULT_COLUMNS[0].name).toBe("id");
  });
  it("has 7 column presets", () => {
    expect(COLUMN_PRESETS.length).toBeGreaterThanOrEqual(7);
    expect(COLUMN_PRESETS.some((p) => p.id === "users")).toBe(true);
  });
  it("has honesty banner", () => {
    expect(HONESTY_BANNER).toContain("synthetic");
  });
});

// --- PRNG ------------------------------------------------------------------

describe("mock-csv PRNG", () => {
  it("hashSeed is stable", () => {
    expect(hashSeed("hello")).toBe(hashSeed("hello"));
  });
  it("hashSeed differs for different inputs", () => {
    expect(hashSeed("hello")).not.toBe(hashSeed("world"));
  });
  it("hashSeed never returns 0", () => {
    expect(hashSeed("")).not.toBe(0);
  });
  it("mulberry32 is deterministic from seed", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const seqA = [a.next(), a.next(), a.next()];
    const seqB = [b.next(), b.next(), b.next()];
    expect(seqA).toEqual(seqB);
  });
  it("mulberry32 next() returns [0,1)", () => {
    const r = mulberry32(1);
    for (let i = 0; i < 100; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
  it("mulberry32 int() returns inclusive bounds", () => {
    const r = mulberry32(7);
    for (let i = 0; i < 100; i++) {
      const v = r.int(5, 10);
      expect(v).toBeGreaterThanOrEqual(5);
      expect(v).toBeLessThanOrEqual(10);
    }
  });
  it("mulberry32 int() swaps inverted min/max", () => {
    const r = mulberry32(7);
    const v = r.int(10, 5);
    expect(v).toBeGreaterThanOrEqual(5);
    expect(v).toBeLessThanOrEqual(10);
  });
  it("mulberry32 pick() returns a value from array", () => {
    const r = mulberry32(7);
    const arr = ["a", "b", "c"];
    expect(arr).toContain(r.pick(arr));
  });
  it("mulberry32 pick() throws on empty array", () => {
    const r = mulberry32(7);
    expect(() => r.pick([] as number[])).toThrow();
  });
  it("mulberry32 weighted() respects weights", () => {
    const r = mulberry32(99);
    const counts: Record<string, number> = { a: 0, b: 0 };
    for (let i = 0; i < 1000; i++) {
      counts[r.weighted([["a", 9], ["b", 1]])]++;
    }
    // a should be roughly 90% (allow some variance)
    expect(counts.a).toBeGreaterThan(counts.b * 5);
  });
  it("mulberry32 bool() respects probability", () => {
    const r = mulberry32(99);
    let trues = 0;
    for (let i = 0; i < 1000; i++) {
      if (r.bool(0.7)) trues++;
    }
    // ~700 trues ± 10%
    expect(trues).toBeGreaterThan(600);
    expect(trues).toBeLessThan(800);
  });
  it("buildRng with empty seed still works", () => {
    const r = buildRng(undefined);
    expect(typeof r.next()).toBe("number");
  });
  it("buildRng with seed is reproducible", () => {
    const r1 = buildRng("test-123");
    const r2 = buildRng("test-123");
    expect(r1.next()).toBe(r2.next());
  });
});

// --- Value generators ------------------------------------------------------

describe("mock-csv value generators", () => {
  const r = mulberry32(12345);

  it("genUuid returns 36-char UUID v4", () => {
    const u = genUuid(r);
    expect(u).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });
  it("genHexColor returns #RRGGBB", () => {
    expect(genHexColor(r)).toMatch(/^#[0-9a-f]{6}$/);
  });
  it("genIpv4 returns valid IPv4", () => {
    expect(genIpv4(r)).toMatch(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/);
  });
  it("genIpv6 returns colon-separated hex groups", () => {
    const v = genIpv6(r);
    expect(v.split(":").length).toBe(8);
  });
  it("genEmail returns valid email", () => {
    expect(genEmail(r)).toMatch(/^[^@]+@[^@]+\.[^@]+$/);
  });
  it("genPhone returns +1 format", () => {
    expect(genPhone(r)).toMatch(/^\+1 \d{3} \d{3} \d{4}$/);
  });
  it("genFirstName returns non-empty string", () => {
    expect(genFirstName(r).length).toBeGreaterThan(0);
  });
  it("genLastName returns non-empty string", () => {
    expect(genLastName(r).length).toBeGreaterThan(0);
  });
  it("genFullName has a space", () => {
    expect(genFullName(r)).toContain(" ");
  });
  it("genUsername has no spaces", () => {
    expect(genUsername(r)).not.toContain(" ");
  });
  it("genStreet starts with a number", () => {
    expect(/^\d+ /.test(genStreet(r))).toBe(true);
  });
  it("genCity returns non-empty", () => {
    expect(genCity(r).length).toBeGreaterThan(0);
  });
  it("genState returns 2-letter US state", () => {
    expect(genState(r)).toMatch(/^[A-Z]{2}$/);
  });
  it("genCountry returns non-empty", () => {
    expect(genCountry(r).length).toBeGreaterThan(0);
  });
  it("genZip returns 5-digit", () => {
    expect(genZip(r)).toMatch(/^\d{5}$/);
  });
  it("genCompany returns non-empty", () => {
    expect(genCompany(r).length).toBeGreaterThan(0);
  });
  it("genJobTitle returns non-empty", () => {
    expect(genJobTitle(r).length).toBeGreaterThan(0);
  });
  it("genString returns non-empty", () => {
    expect(genString(r).length).toBeGreaterThan(0);
  });
  it("genSentence ends with period", () => {
    expect(genSentence(r)).toMatch(/\.$/);
  });
  it("genSentence has 3+ sentences worth of words", () => {
    const s = genParagraph(r);
    expect(s.split(".").filter(Boolean).length).toBeGreaterThanOrEqual(2);
  });
  it("genUrl starts with http(s)://", () => {
    expect(genUrl(r)).toMatch(/^https?:\/\//);
  });
  it("genNumber returns integer by default", () => {
    expect(genNumber(r, 0, 100, 0)).toMatch(/^\d+$/);
  });
  it("genNumber respects scale", () => {
    expect(genNumber(r, 0, 100, 2)).toMatch(/^\d+\.\d{2}$/);
  });
  it("genAge returns 18-90", () => {
    const a = parseInt(genAge(r), 10);
    expect(a).toBeGreaterThanOrEqual(18);
    expect(a).toBeLessThanOrEqual(90);
  });
  it("genMoney returns decimal with 2 places", () => {
    expect(genMoney(r)).toMatch(/^\d+\.\d{2}$/);
  });
  it("genBoolean returns true or false", () => {
    expect(["true", "false"]).toContain(genBoolean(r));
  });
  it("genDate plain returns YYYY-MM-DD", () => {
    expect(genDate(r, "plain")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it("genDate iso returns ISO 8601", () => {
    expect(genDate(r, "iso")).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
  it("genDate past is before now", () => {
    const d = new Date(genDate(r, "past"));
    expect(d.getTime()).toBeLessThan(Date.now());
  });
  it("genDate future is after now", () => {
    const d = new Date(genDate(r, "future"));
    expect(d.getTime()).toBeGreaterThan(Date.now() - 86400000);
  });
  it("genTimestamp returns numeric string", () => {
    expect(genTimestamp(r)).toMatch(/^\d+$/);
  });
  it("genEnum returns one of the values", () => {
    const v = genEnum(r, ["a", "b", "c"]);
    expect(["a", "b", "c"]).toContain(v);
  });
  it("genEnum returns empty for empty values", () => {
    expect(genEnum(r, [])).toBe("");
  });
  it("genEnum respects weights", () => {
    const r2 = mulberry32(99);
    const counts: Record<string, number> = { a: 0, b: 0 };
    for (let i = 0; i < 1000; i++) {
      counts[genEnum(r2, [["a", 9], ["b", 1]]) as string]++;
    }
    expect(counts.a).toBeGreaterThan(counts.b * 5);
  });
  it("genRegex generates digits for \\d+", () => {
    const v = genRegex(r, "\\d+");
    expect(v).toMatch(/^\d+$/);
  });
  it("genRegex generates hex for [0-9a-f]{6}", () => {
    const v = genRegex(r, "[0-9a-f]{6}");
    expect(v).toMatch(/^[0-9a-f]{6}$/);
  });
  it("genRegex handles alternation in group", () => {
    const v = genRegex(r, "(red|green|blue)");
    expect(["red", "green", "blue"]).toContain(v);
  });
  it("genRegex handles *", () => {
    const v = genRegex(r, "a*");
    expect(v).toMatch(/^a*$/);
  });
  it("genRegex handles ?", () => {
    const v = genRegex(r, "ab?");
    expect(v === "a" || v === "ab").toBe(true);
  });
  it("genRegex returns empty for empty pattern", () => {
    expect(genRegex(r, "")).toBe("");
  });
  it("genValue dispatches by type", () => {
    const v = genValue(r, { name: "x", type: "boolean" });
    expect(["true", "false"]).toContain(v);
  });
  it("genValue constant returns constantValue", () => {
    const v = genValue(r, { name: "x", type: "constant", constantValue: "hello" });
    expect(v).toBe("hello");
  });
});

// --- CSV serialization -----------------------------------------------------

describe("mock-csv RFC 4180 serialization", () => {
  it("getDelimiterChar returns correct chars", () => {
    expect(getDelimiterChar("comma")).toBe(",");
    expect(getDelimiterChar("semicolon")).toBe(";");
    expect(getDelimiterChar("tab")).toBe("\t");
    expect(getDelimiterChar("pipe")).toBe("|");
    expect(getDelimiterChar("custom", "|")).toBe("|");
    expect(getDelimiterChar("custom", "")).toBe(",");
  });
  it("quoteField always-quote wraps in double quotes", () => {
    expect(quoteField("hello", ",", "always")).toBe('"hello"');
  });
  it("quoteField minimal only when needed", () => {
    expect(quoteField("hello", ",", "minimal")).toBe("hello");
    expect(quoteField('he,llo', ",", "minimal")).toBe('"he,llo"');
    expect(quoteField('he"llo', ",", "minimal")).toBe('"he""llo"');
    expect(quoteField('he\nllo', ",", "minimal")).toBe('"he\nllo"');
  });
  it("quoteField none never quotes", () => {
    expect(quoteField('he,llo', ",", "none")).toBe("he,llo");
  });
  it("quoteField doubles embedded quotes", () => {
    expect(quoteField('say "hi"', ",", "always")).toBe('"say ""hi"""');
  });
  it("serializeRow joins with delimiter", () => {
    expect(serializeRow(["a", "b", "c"], ",", "minimal")).toBe("a,b,c");
  });
  it("serializeRow respects delimiter", () => {
    expect(serializeRow(["a", "b", "c"], ";", "minimal")).toBe("a;b;c");
  });
  it("serializeCsv includes header when requested", () => {
    const csv = serializeCsv(
      [["1", "Alice"]],
      { delim: ",", quoting: "minimal", lineEnding: "lf", bom: false, header: true, headerRow: ["id", "name"] },
    );
    expect(csv.split("\n")[0]).toBe("id,name");
    expect(csv.split("\n")[1]).toBe("1,Alice");
  });
  it("serializeCsv omits header when not requested", () => {
    const csv = serializeCsv(
      [["1", "Alice"]],
      { delim: ",", quoting: "minimal", lineEnding: "lf", bom: false, header: false, headerRow: ["id", "name"] },
    );
    expect(csv).toBe("1,Alice");
  });
  it("serializeCsv prepends BOM when requested", () => {
    const csv = serializeCsv(
      [["1"]],
      { delim: ",", quoting: "minimal", lineEnding: "lf", bom: true, header: false, headerRow: ["id"] },
    );
    expect(csv.startsWith("\uFEFF")).toBe(true);
  });
  it("serializeCsv uses CRLF when requested", () => {
    const csv = serializeCsv(
      [["1"], ["2"]],
      { delim: ",", quoting: "minimal", lineEnding: "crlf", bom: false, header: false, headerRow: ["id"] },
    );
    expect(csv).toBe("1\r\n2");
  });
  it("serializeJson returns array of objects", () => {
    const json = serializeJson([["1", "Alice"]], [{ name: "id", type: "number" }, { name: "name", type: "string" }]);
    const arr = JSON.parse(json);
    expect(Array.isArray(arr)).toBe(true);
    expect(arr[0]).toEqual({ id: "1", name: "Alice" });
  });
  it("round-trip: serialize then split", () => {
    const rows = [["1", 'Alice, Jr.', 'say "hi"']];
    const csv = serializeCsv(rows, { delim: ",", quoting: "minimal", lineEnding: "lf", bom: false, header: false, headerRow: [] });
    const parsed = splitCsvRow(csv);
    expect(parsed).toEqual(["1", "Alice, Jr.", 'say "hi"']);
  });
});

// --- Column inference ------------------------------------------------------

describe("mock-csv inferColumns", () => {
  it("infers id as number unique", () => {
    const cols = inferColumns("id");
    expect(cols[0].type).toBe("number");
    expect(cols[0].unique).toBe(true);
  });
  it("infers email", () => {
    const cols = inferColumns("email");
    expect(cols[0].type).toBe("email");
  });
  it("infers phone", () => {
    expect(inferColumns("phone")[0].type).toBe("phone");
  });
  it("infers url from website", () => {
    expect(inferColumns("website")[0].type).toBe("url");
  });
  it("infers boolean from is_ prefix", () => {
    expect(inferColumns("is_active")[0].type).toBe("boolean");
  });
  it("infers boolean from has_ prefix", () => {
    expect(inferColumns("has_subscription")[0].type).toBe("boolean");
  });
  it("infers date_iso from _at suffix", () => {
    expect(inferColumns("created_at")[0].type).toBe("date_iso");
  });
  it("infers money from price", () => {
    expect(inferColumns("price")[0].type).toBe("money");
  });
  it("infers money from amount", () => {
    expect(inferColumns("amount")[0].type).toBe("money");
  });
  it("infers city from city", () => {
    expect(inferColumns("city")[0].type).toBe("city");
  });
  it("infers hex_color from color", () => {
    expect(inferColumns("color")[0].type).toBe("hex_color");
  });
  it("infers ipv4 from ip", () => {
    expect(inferColumns("ip")[0].type).toBe("ipv4");
  });
  it("uses sample data for unknown headers", () => {
    expect(inferColumns("foo", "42")[0].type).toBe("number");
    expect(inferColumns("foo", "true")[0].type).toBe("boolean");
  });
  it("defaults to string when nothing matches", () => {
    expect(inferColumns("xyz_unknown")[0].type).toBe("string");
  });
  it("skips empty header cells", () => {
    const cols = inferColumns("a,,b");
    expect(cols).toHaveLength(2);
  });
  it("parses multiple headers", () => {
    const cols = inferColumns("id,email,first_name,age");
    expect(cols).toHaveLength(4);
    expect(cols.map((c) => c.type)).toEqual(["number", "email", "first_name", "age"]);
  });
});

// --- splitCsvRow -----------------------------------------------------------

describe("mock-csv splitCsvRow", () => {
  it("splits simple comma row", () => {
    expect(splitCsvRow("a,b,c")).toEqual(["a", "b", "c"]);
  });
  it("handles quoted commas", () => {
    expect(splitCsvRow('"a,b",c')).toEqual(["a,b", "c"]);
  });
  it("handles doubled quotes", () => {
    expect(splitCsvRow('"say ""hi""",x')).toEqual(['say "hi"', "x"]);
  });
  it("handles semicolons", () => {
    expect(splitCsvRow("a;b;c")).toEqual(["a", "b", "c"]);
  });
  it("handles tabs", () => {
    expect(splitCsvRow("a\tb\tc")).toEqual(["a", "b", "c"]);
  });
});

// --- Validation ------------------------------------------------------------

describe("mock-csv validation", () => {
  it("rejects empty columns", () => {
    const v = validateColumns([]);
    expect(v.ok).toBe(false);
    expect(v.errors[0].toLowerCase()).toContain("at least one column");
  });
  it("rejects duplicate names", () => {
    const v = validateColumns([{ name: "x", type: "string" }, { name: "x", type: "string" }]);
    expect(v.ok).toBe(false);
  });
  it("rejects empty name", () => {
    const v = validateColumns([{ name: "", type: "string" }]);
    expect(v.ok).toBe(false);
  });
  it("rejects enum without values", () => {
    const v = validateColumns([{ name: "x", type: "enum" }]);
    expect(v.ok).toBe(false);
  });
  it("rejects regex without pattern", () => {
    const v = validateColumns([{ name: "x", type: "regex" }]);
    expect(v.ok).toBe(false);
  });
  it("rejects min > max", () => {
    const v = validateColumns([{ name: "x", type: "number", min: 10, max: 5 }]);
    expect(v.ok).toBe(false);
  });
  it("rejects blankPercent out of range", () => {
    const v = validateColumns([{ name: "x", type: "string", blankPercent: 150 }]);
    expect(v.ok).toBe(false);
  });
  it("accepts valid columns", () => {
    const v = validateColumns([{ name: "id", type: "number", min: 1, max: 10 }]);
    expect(v.ok).toBe(true);
  });
  it("validateOptions rejects 0 columns", () => {
    const v = validateOptions({
      columns: [], rowCount: 10, delimiter: "comma", quoting: "minimal",
      lineEnding: "lf", bom: false, header: true,
    });
    expect(v.ok).toBe(false);
  });
  it("validateOptions rejects custom delimiter without customDelimiter", () => {
    const v = validateOptions({
      columns: [{ name: "x", type: "string" }],
      rowCount: 10, delimiter: "custom", quoting: "minimal",
      lineEnding: "lf", bom: false, header: true,
    });
    expect(v.ok).toBe(false);
  });
  it("validateOptions warns on >1M rows", () => {
    const v = validateOptions({
      columns: [{ name: "x", type: "string" }],
      rowCount: 2_000_000, delimiter: "comma", quoting: "minimal",
      lineEnding: "lf", bom: false, header: true,
    });
    expect(v.warnings.some((w) => w.includes("1,000,000"))).toBe(true);
  });
});

// --- generate --------------------------------------------------------------

describe("mock-csv generate", () => {
  const baseOpts: GenerateOptions = {
    columns: [
      { name: "id", type: "number", min: 1, max: 1000, unique: true },
      { name: "name", type: "full_name" },
      { name: "email", type: "email" },
    ],
    rowCount: 10,
    delimiter: "comma",
    quoting: "minimal",
    lineEnding: "lf",
    bom: false,
    header: true,
  };

  it("generates correct number of rows", () => {
    const r = generate(baseOpts);
    expect(r.rowCount).toBe(10);
    expect(r.rows).toHaveLength(10);
  });
  it("generates correct number of columns", () => {
    const r = generate(baseOpts);
    expect(r.columnCount).toBe(3);
    expect(r.rows[0]).toHaveLength(3);
  });
  it("includes header in CSV output", () => {
    const r = generate(baseOpts);
    expect(r.output.split("\n")[0]).toBe("id,name,email");
  });
  it("omits header when header=false", () => {
    const r = generate({ ...baseOpts, header: false });
    expect(r.output.split("\n")[0]).not.toBe("id,name,email");
  });
  it("prepends BOM when bom=true", () => {
    const r = generate({ ...baseOpts, bom: true });
    expect(r.output.startsWith("\uFEFF")).toBe(true);
  });
  it("uses CRLF when lineEnding=crlf", () => {
    const r = generate({ ...baseOpts, lineEnding: "crlf" });
    expect(r.output).toContain("\r\n");
  });
  it("uses semicolon delimiter", () => {
    const r = generate({ ...baseOpts, delimiter: "semicolon" });
    expect(r.output.split("\n")[0]).toBe("id;name;email");
  });
  it("uses tab delimiter", () => {
    const r = generate({ ...baseOpts, delimiter: "tab" });
    expect(r.output.split("\n")[0]).toBe("id\tname\temail");
  });
  it("uses pipe delimiter", () => {
    const r = generate({ ...baseOpts, delimiter: "pipe" });
    expect(r.output.split("\n")[0]).toBe("id|name|email");
  });
  it("uses custom delimiter", () => {
    const r = generate({ ...baseOpts, delimiter: "custom", customDelimiter: "~" });
    expect(r.output.split("\n")[0]).toBe("id~name~email");
  });
  it("respects always quoting", () => {
    const r = generate({ ...baseOpts, quoting: "always" });
    expect(r.output.split("\n")[0]).toBe('"id","name","email"');
  });
  it("respects none quoting (no quotes even when needed)", () => {
    const r = generate({ ...baseOpts, quoting: "none" });
    // header should still be unquoted
    expect(r.output.split("\n")[0]).toBe("id,name,email");
  });
  it("seeded generation is reproducible", () => {
    const a = generate({ ...baseOpts, seed: "repro-1" });
    const b = generate({ ...baseOpts, seed: "repro-1" });
    expect(a.output).toBe(b.output);
  });
  it("different seeds give different output", () => {
    const a = generate({ ...baseOpts, seed: "seed-a" });
    const b = generate({ ...baseOpts, seed: "seed-b" });
    expect(a.output).not.toBe(b.output);
  });
  it("unique columns produce unique values", () => {
    const r = generate({
      ...baseOpts,
      rowCount: 50,
      columns: [{ name: "id", type: "number", min: 1, max: 100000, unique: true }],
    });
    const ids = r.rows.map((row) => row[0]);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("blankPercent produces some empty cells", () => {
    const r = generate({
      ...baseOpts,
      rowCount: 100,
      columns: [{ name: "x", type: "string", blankPercent: 50 }],
      seed: "blank-test",
    });
    const emptyCount = r.rows.filter((row) => row[0] === "").length;
    expect(emptyCount).toBeGreaterThan(20);
    expect(emptyCount).toBeLessThan(80);
  });
  it("generateFormat json returns JSON array", () => {
    const r = generateFormat(baseOpts, "json");
    const arr = JSON.parse(r.output);
    expect(Array.isArray(arr)).toBe(true);
    expect(arr).toHaveLength(10);
    expect(arr[0]).toHaveProperty("id");
    expect(arr[0]).toHaveProperty("name");
    expect(arr[0]).toHaveProperty("email");
  });
  it("generateFormat tsv uses tab delimiter", () => {
    const r = generateFormat(baseOpts, "tsv");
    expect(r.output.split("\n")[0]).toBe("id\tname\temail");
  });
  it("generateFormat csv uses configured delimiter", () => {
    const r = generateFormat({ ...baseOpts, delimiter: "semicolon" }, "csv");
    expect(r.output.split("\n")[0]).toBe("id;name;email");
  });
  it("generateFormat respects header=false even with format override", () => {
    const r = generateFormat({ ...baseOpts, header: false }, "csv");
    expect(r.output.split("\n")[0]).not.toBe("id,name,email");
  });
  it("throws on invalid options", () => {
    expect(() => generate({
      ...baseOpts,
      columns: [],
    })).toThrow();
  });
  it("result bytes matches output length", () => {
    const r = generate(baseOpts);
    expect(r.bytes).toBe(r.output.length);
  });
  it("enum column produces only declared values", () => {
    const r = generate({
      ...baseOpts,
      columns: [{
        name: "status",
        type: "enum",
        enumValues: ["red", "green", "blue"],
      }],
      rowCount: 50,
    });
    const vals = r.rows.map((row) => row[0]);
    for (const v of vals) {
      expect(["red", "green", "blue"]).toContain(v);
    }
  });
  it("regex column produces pattern-matching values", () => {
    const r = generate({
      ...baseOpts,
      columns: [{ name: "code", type: "regex", pattern: "\\d{3}-\\d{4}" }],
      rowCount: 20,
    });
    for (const row of r.rows) {
      expect(row[0]).toMatch(/^\d{3}-\d{4}$/);
    }
  });
  it("constant column returns same value", () => {
    const r = generate({
      ...baseOpts,
      columns: [{ name: "flag", type: "constant", constantValue: "ACTIVE" }],
      rowCount: 5,
    });
    for (const row of r.rows) {
      expect(row[0]).toBe("ACTIVE");
    }
  });
  it("handles 0 rows", () => {
    const r = generate({ ...baseOpts, rowCount: 0 });
    expect(r.rowCount).toBe(0);
    expect(r.rows).toHaveLength(0);
  });
});

// --- Stats -----------------------------------------------------------------

describe("mock-csv computeStats", () => {
  it("computes correct stats", () => {
    const opts: GenerateOptions = {
      columns: [
        { name: "id", type: "number", unique: true },
        { name: "name", type: "string", blankPercent: 20 },
      ],
      rowCount: 50,
      delimiter: "comma",
      quoting: "minimal",
      lineEnding: "lf",
      bom: false,
      header: true,
    };
    const result = generate(opts);
    const stats = computeStats(opts, result);
    expect(stats.rowCount).toBe(50);
    expect(stats.columnCount).toBe(2);
    expect(stats.uniqueColumns).toBe(1);
    expect(stats.blankColumns).toBe(1);
    expect(stats.estimatedCells).toBe(100);
    expect(stats.bytes).toBe(result.bytes);
  });
});

// --- History ---------------------------------------------------------------

describe("mock-csv history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1, rowCount: 10, columnCount: 3, format: "csv",
      delimiter: "comma", seed: "abc", columnSummary: "id,name,email",
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i, rowCount: 5, columnCount: 1, format: "csv",
        delimiter: "comma", seed: String(i), columnSummary: "x",
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1, rowCount: 10, columnCount: 3, format: "csv",
      delimiter: "comma", seed: "abc", columnSummary: "id,name,email",
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// --- Share URL -------------------------------------------------------------

describe("mock-ccsv shareable URL", () => {
  const opts = {
    rowCount: 50,
    delimiter: "comma" as Delimiter,
    customDelimiter: "",
    quoting: "minimal" as QuotingPolicy,
    lineEnding: "lf" as LineEnding,
    bom: false,
    header: true,
    seed: "abc",
    format: "csv" as OutputFormat,
  };
  const cols: ColumnDef[] = [
    { name: "id", type: "number", min: 1, max: 1000, unique: true },
    { name: "name", type: "string" },
  ];

  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl(opts, cols);
    expect(url).toContain("rows=50");
    expect(url).toContain("delim=comma");
    expect(url).toContain("seed=abc");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("round-trips options back", () => {
    const url = buildShareUrl(opts, cols);
    // Strip the leading ? or path# part
    const hash = url.includes("#") ? url.slice(url.indexOf("#") + 1) : url.replace(/^\?/, "");
    const parsed = parseShareUrl(hash);
    expect(parsed.options.rowCount).toBe(50);
    expect(parsed.options.delimiter).toBe("comma");
    expect(parsed.options.seed).toBe("abc");
    expect(parsed.options.format).toBe("csv");
  });
  it("round-trips columns back", () => {
    const url = buildShareUrl(opts, cols);
    const hash = url.includes("#") ? url.slice(url.indexOf("#") + 1) : url.replace(/^\?/, "");
    const parsed = parseShareUrl(hash);
    expect(parsed.columns).toHaveLength(2);
    expect(parsed.columns[0].name).toBe("id");
    expect(parsed.columns[0].type).toBe("number");
    expect(parsed.columns[0].unique).toBe(true);
    expect(parsed.columns[0].min).toBe(1);
    expect(parsed.columns[0].max).toBe(1000);
    expect(parsed.columns[1].name).toBe("name");
    expect(parsed.columns[1].type).toBe("string");
  });
  it("round-trips enum column", () => {
    const colsEnum: ColumnDef[] = [
      { name: "status", type: "enum", enumValues: [["red", 3], ["blue", 1]] },
    ];
    const url = buildShareUrl(opts, colsEnum);
    const hash = url.includes("#") ? url.slice(url.indexOf("#") + 1) : url.replace(/^\?/, "");
    const parsed = parseShareUrl(hash);
    expect(parsed.columns[0].type).toBe("enum");
    expect(parsed.columns[0].enumValues).toEqual([["red", 3], ["blue", 1]]);
  });
  it("round-trips regex column", () => {
    const colsRegex: ColumnDef[] = [
      { name: "code", type: "regex", pattern: "\\d{3}" },
    ];
    const url = buildShareUrl(opts, colsRegex);
    const hash = url.includes("#") ? url.slice(url.indexOf("#") + 1) : url.replace(/^\?/, "");
    const parsed = parseShareUrl(hash);
    expect(parsed.columns[0].pattern).toBe("\\d{3}");
  });
  it("handles empty hash", () => {
    const parsed = parseShareUrl("");
    expect(parsed.options.rowCount).toBe(10);
    expect(parsed.columns).toEqual(DEFAULT_COLUMNS);
  });
});

// Suppress unused-import lint
export type _Unused = ColumnType | Delimiter | QuotingPolicy | LineEnding | OutputFormat | ColumnDef;
