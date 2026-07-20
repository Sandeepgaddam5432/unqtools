import { describe, it, expect, beforeEach } from "vitest";
import {
  SYSTEM_LABELS,
  TOKEN_TABLE,
  ALL_SYSTEMS,
  tokenize,
  formatBySystem,
  convertPattern,
  lintPattern,
  explainPattern,
  listTokens,
  countAllTokens,
  detectFormat,
  codeSnippets,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type FormatSystem,
  type TokenConcept,
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

// Reference date: 2026-01-15 13:45:30.123 UTC (Thursday)
const REF = new Date(Date.UTC(2026, 0, 15, 13, 45, 30, 123));

describe("strftime constants", () => {
  it("has labels for all 7 systems", () => {
    expect(Object.keys(SYSTEM_LABELS)).toHaveLength(7);
    expect(SYSTEM_LABELS.strftime).toContain("strftime");
    expect(SYSTEM_LABELS.moment).toContain("Moment");
  });
  it("has 50+ tokens total across systems", () => {
    const total = countAllTokens();
    expect(total).toBeGreaterThanOrEqual(50);
  });
  it("has 30+ strftime tokens", () => {
    expect(TOKEN_TABLE.strftime.length).toBeGreaterThanOrEqual(30);
  });
  it("ALL_SYSTEMS lists 7 systems", () => {
    expect(ALL_SYSTEMS).toHaveLength(7);
    expect(ALL_SYSTEMS).toContain("strftime");
    expect(ALL_SYSTEMS).toContain("ldml");
  });
});

describe("strftime tokenize", () => {
  it("tokenizes strftime pattern", () => {
    const tokens = tokenize("%Y-%m-%d", "strftime");
    expect(tokens).toHaveLength(5);
    expect(tokens[0]).toMatchObject({ type: "token", raw: "%Y" });
    expect(tokens[1]).toMatchObject({ type: "literal", text: "-" });
    expect(tokens[2]).toMatchObject({ type: "token", raw: "%m" });
    expect(tokens[4]).toMatchObject({ type: "token", raw: "%d" });
  });
  it("tokenizes %% as percent token", () => {
    const tokens = tokenize("100%%", "strftime");
    expect(tokens[0]).toMatchObject({ type: "literal", text: "100" });
    expect(tokens[1]).toMatchObject({ type: "token", raw: "%%", concept: "percent" });
  });
  it("tokenizes moment pattern with brackets", () => {
    const tokens = tokenize("[foo]YYYY", "moment");
    expect(tokens[0]).toMatchObject({ type: "literal", text: "foo" });
    expect(tokens[1]).toMatchObject({ type: "token", raw: "YYYY", concept: "year4" });
  });
  it("tokenizes moment multi-char token (DDDD)", () => {
    const tokens = tokenize("DDDD", "moment");
    expect(tokens[0]).toMatchObject({ type: "token", raw: "DDDD", concept: "day_of_year3" });
  });
  it("tokenizes date-fns pattern with single quotes", () => {
    const tokens = tokenize("'foo'yyyy", "date-fns");
    expect(tokens[0]).toMatchObject({ type: "literal", text: "foo" });
    expect(tokens[1]).toMatchObject({ type: "token", raw: "yyyy", concept: "year4" });
  });
  it("tokenizes Java single-quote escape ('')", () => {
    const tokens = tokenize("''yyyy", "java");
    expect(tokens[0]).toMatchObject({ type: "literal", text: "'" });
    expect(tokens[1]).toMatchObject({ type: "token", raw: "yyyy", concept: "year4" });
  });
  it("handles empty pattern", () => {
    expect(tokenize("", "strftime")).toEqual([]);
  });
  it("handles unknown tokens as literal", () => {
    const tokens = tokenize("QQ", "moment");
    // Q isn't a moment token in our table — should be literal
    expect(tokens.some((t) => t.type === "literal")).toBe(true);
  });
});

describe("strftime formatBySystem (UTC)", () => {
  it("formats strftime date", () => {
    expect(formatBySystem(REF, "%Y-%m-%d", "strftime", { utc: true })).toBe("2026-01-15");
  });
  it("formats strftime time", () => {
    expect(formatBySystem(REF, "%H:%M:%S", "strftime", { utc: true })).toBe("13:45:30");
  });
  it("formats strftime datetime with milliseconds", () => {
    expect(formatBySystem(REF, "%H:%M:%S.%L", "strftime", { utc: true })).toBe("13:45:30.123");
  });
  it("formats strftime month and weekday names", () => {
    expect(formatBySystem(REF, "%B %A", "strftime", { utc: true })).toBe("January Thursday");
  });
  it("formats strftime abbreviated month and weekday", () => {
    expect(formatBySystem(REF, "%b %a", "strftime", { utc: true })).toBe("Jan Thu");
  });
  it("formats strftime day of year", () => {
    expect(formatBySystem(REF, "%j", "strftime", { utc: true })).toBe("015");
  });
  it("formats strftime 12-hour time with AM/PM", () => {
    expect(formatBySystem(REF, "%I:%M:%S %p", "strftime", { utc: true })).toBe("01:45:30 PM");
  });
  it("formats strftime 2-digit year and century", () => {
    expect(formatBySystem(REF, "%y %C", "strftime", { utc: true })).toBe("26 20");
  });
  it("formats strftime ISO date and time shortcuts", () => {
    expect(formatBySystem(REF, "%F %T", "strftime", { utc: true })).toBe("2026-01-15 13:45:30");
  });
  it("formats strftime literal percent", () => {
    expect(formatBySystem(REF, "100%%", "strftime", { utc: true })).toBe("100%");
  });
  it("formats moment YYYY-MM-DD", () => {
    expect(formatBySystem(REF, "YYYY-MM-DD", "moment", { utc: true })).toBe("2026-01-15");
  });
  it("formats moment HH:mm:ss", () => {
    expect(formatBySystem(REF, "HH:mm:ss", "moment", { utc: true })).toBe("13:45:30");
  });
  it("formats moment with milliseconds", () => {
    expect(formatBySystem(REF, "HH:mm:ss.SSS", "moment", { utc: true })).toBe("13:45:30.123");
  });
  it("formats moment 12h with AM", () => {
    expect(formatBySystem(REF, "hh:mm:ss A", "moment", { utc: true })).toBe("01:45:30 PM");
  });
  it("formats date-fns yyyy-MM-dd", () => {
    expect(formatBySystem(REF, "yyyy-MM-dd", "date-fns", { utc: true })).toBe("2026-01-15");
  });
  it("formats date-fns weekday name", () => {
    expect(formatBySystem(REF, "EEEE", "date-fns", { utc: true })).toBe("Thursday");
  });
  it("formats Java yyyy-MM-dd", () => {
    expect(formatBySystem(REF, "yyyy-MM-dd", "java", { utc: true })).toBe("2026-01-15");
  });
  it("formats .NET yyyy-MM-dd", () => {
    expect(formatBySystem(REF, "yyyy-MM-dd", "dotnet", { utc: true })).toBe("2026-01-15");
  });
  it("formats LDML yyyy-MM-dd", () => {
    expect(formatBySystem(REF, "yyyy-MM-dd", "ldml", { utc: true })).toBe("2026-01-15");
  });
  it("formats .NET fff for ms", () => {
    expect(formatBySystem(REF, "ss.fff", "dotnet", { utc: true })).toBe("30.123");
  });
  it("formats unix timestamp", () => {
    const expected = Math.floor(REF.getTime() / 1000);
    expect(formatBySystem(REF, "%s", "strftime", { utc: true })).toBe(String(expected));
    expect(formatBySystem(REF, "X", "moment", { utc: true })).toBe(String(expected));
  });
});

describe("strftime convertPattern", () => {
  it("converts strftime %Y-%m-%d to moment", () => {
    expect(convertPattern("%Y-%m-%d", "strftime", "moment")).toBe("YYYY-MM-DD");
  });
  it("converts strftime %Y-%m-%d to date-fns", () => {
    expect(convertPattern("%Y-%m-%d", "strftime", "date-fns")).toBe("yyyy-MM-dd");
  });
  it("converts moment YYYY-MM-DD to strftime", () => {
    expect(convertPattern("YYYY-MM-DD", "moment", "strftime")).toBe("%Y-%m-%d");
  });
  it("converts moment YYYY-MM-DD to Java (yyyy not YYYY)", () => {
    // moment YYYY is calendar year → Java yyyy (NOT YYYY which is week year)
    expect(convertPattern("YYYY-MM-DD", "moment", "java")).toBe("yyyy-MM-dd");
  });
  it("converts date-fns yyyy-MM-dd to moment", () => {
    expect(convertPattern("yyyy-MM-dd", "date-fns", "moment")).toBe("YYYY-MM-DD");
  });
  it("preserves literal text (strftime → moment uses brackets)", () => {
    expect(convertPattern("Y%Y-m%m", "strftime", "moment")).toContain("[");
  });
  it("preserves literal text (moment → java uses single quotes)", () => {
    const out = convertPattern("[foo]YYYY", "moment", "java");
    expect(out).toContain("'foo'");
    expect(out).toContain("yyyy");
  });
  it("no-op when from === to", () => {
    expect(convertPattern("%Y-%m-%d", "strftime", "strftime")).toBe("%Y-%m-%d");
  });
  it("falls back to literal escape for missing concepts", () => {
    // %Q (unix_ms) has no equivalent in Java SimpleDateFormat
    const out = convertPattern("%Q", "strftime", "java");
    expect(out).toContain("[");
  });
});

describe("strftime lintPattern", () => {
  it("flags YYYY in Java as week-year footgun", () => {
    const issues = lintPattern("YYYY-MM-dd", "java");
    expect(issues.length).toBeGreaterThan(0);
    const y = issues.find((i) => i.token === "YYYY");
    expect(y).toBeDefined();
    expect(y!.severity).toBe("warning");
    expect(y!.message).toMatch(/week year/i);
  });
  it("flags YYYY in LDML as week-year footgun", () => {
    const issues = lintPattern("YYYY-MM-dd", "ldml");
    const y = issues.find((i) => i.token === "YYYY");
    expect(y).toBeDefined();
    expect(y!.severity).toBe("warning");
  });
  it("flags YYYY in date-fns as week-year footgun", () => {
    const issues = lintPattern("YYYY-MM-dd", "date-fns");
    const y = issues.find((i) => i.token === "YYYY");
    expect(y).toBeDefined();
    expect(y!.severity).toBe("warning");
  });
  it("does NOT flag yyyy in date-fns", () => {
    const issues = lintPattern("yyyy-MM-dd", "date-fns");
    expect(issues.find((i) => i.token === "yyyy")).toBeUndefined();
  });
  it("flags DD in date-fns as day-of-year footgun", () => {
    const issues = lintPattern("DD-MM-yyyy", "date-fns");
    const d = issues.find((i) => i.token === "DD");
    expect(d).toBeDefined();
    expect(d!.severity).toBe("warning");
    expect(d!.message).toMatch(/day of the YEAR/i);
  });
  it("flags hh as 12-hour info in moment", () => {
    const issues = lintPattern("hh:mm:ss", "moment");
    const h = issues.find((i) => i.token === "hh");
    expect(h).toBeDefined();
    expect(h!.severity).toBe("info");
  });
  it("flags mm (lowercase) as minute info", () => {
    const issues = lintPattern("MM/mm", "moment");
    const m = issues.find((i) => i.token === "mm");
    expect(m).toBeDefined();
  });
  it("returns no issues for safe patterns", () => {
    const issues = lintPattern("yyyy-MM-dd", "date-fns");
    expect(issues.length).toBe(0);
  });
});

describe("strftime explainPattern", () => {
  it("explains each token", () => {
    const items = explainPattern("%Y-%m-%d", "strftime", REF);
    expect(items).toHaveLength(5);
    expect(items[0].raw).toBe("%Y");
    expect(items[0].concept).toBe("year4");
    expect(items[0].desc).toMatch(/year/i);
    expect(items[0].example).toBe("2026");
    expect(items[2].example).toBe("01");
    expect(items[4].example).toBe("15");
  });
  it("explains literal text", () => {
    const items = explainPattern("T%H", "strftime", REF);
    const lit = items.find((i) => i.concept === "literal_text");
    expect(lit).toBeDefined();
    expect(lit!.example).toBe("T");
  });
  it("uses default ref date when omitted", () => {
    const items = explainPattern("%Y", "strftime");
    expect(items).toHaveLength(1);
    expect(items[0].example).toMatch(/^\d{4}$/);
  });
});

describe("strftime listTokens", () => {
  it("lists tokens for a system", () => {
    const list = listTokens("strftime");
    expect(list.length).toBeGreaterThanOrEqual(30);
    expect(list.some((t) => t.token === "%Y")).toBe(true);
    expect(list.some((t) => t.token === "%m")).toBe(true);
  });
  it("listTokens for moment includes YYYY and HH", () => {
    const list = listTokens("moment");
    expect(list.some((t) => t.token === "YYYY")).toBe(true);
    expect(list.some((t) => t.token === "HH")).toBe(true);
  });
});

describe("strftime detectFormat", () => {
  it("detects ISO 8601 datetime", () => {
    const r = detectFormat("2026-01-15T13:45:30Z");
    expect(r).not.toBeNull();
    expect(r!.confidence).toBeGreaterThan(0.9);
  });
  it("detects ISO date", () => {
    const r = detectFormat("2026-01-15");
    expect(r).not.toBeNull();
    expect(r!.pattern).toBe("%Y-%m-%d");
  });
  it("detects YYYYMMDD", () => {
    const r = detectFormat("20260115");
    expect(r).not.toBeNull();
    expect(r!.pattern).toBe("%Y%m%d");
  });
  it("detects HH:MM:SS", () => {
    const r = detectFormat("13:45:30");
    expect(r).not.toBeNull();
    expect(r!.pattern).toBe("%H:%M:%S");
  });
  it("returns null for unrecognised", () => {
    expect(detectFormat("not-a-date")).toBeNull();
  });
  it("returns null for empty", () => {
    expect(detectFormat("")).toBeNull();
  });
});

describe("strftime codeSnippets", () => {
  it("returns snippet for each library", () => {
    const s = codeSnippets(REF, "%Y-%m-%d", "strftime");
    expect(s.strftime).toContain("Python");
    expect(s.strftime).toContain("strftime");
    expect(s.moment).toContain("moment");
    expect(s.dayjs).toContain("dayjs");
    expect(s.luxon).toContain("Luxon");
    expect(s.dateFns).toContain("date-fns");
    expect(s.java).toContain("Java");
    expect(s.dotnet).toContain(".NET");
  });
  it("includes the converted pattern", () => {
    const s = codeSnippets(REF, "%Y-%m-%d", "strftime");
    expect(s.moment).toContain("YYYY-MM-DD");
    expect(s.dateFns).toContain("yyyy-MM-dd");
  });
});

describe("strftime history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, pattern: "%Y-%m-%d", system: "strftime", preview: "2026-01-15" });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, pattern: `p${i}`, system: "strftime", preview: `v${i}` });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, pattern: "p", system: "strftime", preview: "v" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("strftime shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("%Y-%m-%d", "strftime", true);
    expect(url).toContain("p=");
    expect(url).toContain("s=strftime");
    expect(url).toContain("utc=1");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("p=%25Y-%25m-%25d&s=strftime&utc=1");
    expect(p.pattern).toBe("%Y-%m-%d");
    expect(p.system).toBe("strftime");
    expect(p.utc).toBe(true);
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({ pattern: "", system: "strftime", utc: false });
  });
  it("filters unknown systems", () => {
    const p = parseShareUrl("p=foo&s=unknown-system");
    expect(p.system).toBe("strftime");
  });
  it("round-trips", () => {
    const url = buildShareUrl("yyyy-MM-dd", "date-fns", false);
    const p = parseShareUrl(url.startsWith("?") ? url.slice(1) : url.split("#")[1] ?? "");
    expect(p.pattern).toBe("yyyy-MM-dd");
    expect(p.system).toBe("date-fns");
    expect(p.utc).toBe(false);
  });
});

describe("strftime cross-system acceptance (blueprint)", () => {
  it("output matches between strftime and moment for common pattern", () => {
    const a = formatBySystem(REF, "%Y-%m-%d %H:%M:%S", "strftime", { utc: true });
    const b = formatBySystem(REF, "YYYY-MM-DD HH:mm:ss", "moment", { utc: true });
    expect(a).toBe(b);
  });
  it("output matches between moment and date-fns", () => {
    const a = formatBySystem(REF, "YYYY-MM-DD HH:mm:ss", "moment", { utc: true });
    const b = formatBySystem(REF, "yyyy-MM-dd HH:mm:ss", "date-fns", { utc: true });
    expect(a).toBe(b);
  });
  it("output matches between Java and .NET for yyyy-MM-dd", () => {
    const a = formatBySystem(REF, "yyyy-MM-dd", "java", { utc: true });
    const b = formatBySystem(REF, "yyyy-MM-dd", "dotnet", { utc: true });
    expect(a).toBe(b);
  });
  it("cross-translates strftime → moment → strftime round-trip", () => {
    const orig = "%Y-%m-%dT%H:%M:%SZ";
    const momentPat = convertPattern(orig, "strftime", "moment");
    const back = convertPattern(momentPat, "moment", "strftime");
    expect(back).toBe(orig);
  });
});

// Suppress unused-import lint
export type _Unused = FormatSystem | TokenConcept;
