import { describe, it, expect, beforeEach } from "vitest";
import {
  SQL_DIALECTS,
  NEWLINE_MODES,
  DEFAULT_OPTIONS,
  KEYWORDS,
  SAMPLE_SQL,
  isKeyword,
  tokenizeSql,
  validateSql,
  minifySql,
  computeSavings,
  escapeForJs,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type MinifyOptions,
  type SqlDialect,
  type NewlineMode,
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

describe("sql-minifier constants", () => {
  it("exposes 5 dialects", () => {
    expect(SQL_DIALECTS).toHaveLength(5);
    expect(SQL_DIALECTS.map((d) => d.value)).toEqual(
      expect.arrayContaining(["ansi", "mysql", "postgresql", "sqlite", "sqlserver"]),
    );
  });
  it("exposes 2 newline modes", () => {
    expect(NEWLINE_MODES).toHaveLength(2);
  });
  it("DEFAULT_OPTIONS has expected defaults", () => {
    expect(DEFAULT_OPTIONS.dialect).toBe("ansi");
    expect(DEFAULT_OPTIONS.removeComments).toBe(true);
    expect(DEFAULT_OPTIONS.newlines).toBe("single");
    expect(DEFAULT_OPTIONS.normalizeSemicolons).toBe(true);
    expect(DEFAULT_OPTIONS.asJsString).toBe(false);
  });
  it("KEYWORDS contains core clauses", () => {
    expect(KEYWORDS.has("SELECT")).toBe(true);
    expect(KEYWORDS.has("INSERT")).toBe(true);
    expect(KEYWORDS.has("DELETE")).toBe(true);
  });
  it("SAMPLE_SQL is non-empty and multi-line", () => {
    expect(SAMPLE_SQL.length).toBeGreaterThan(50);
    expect(SAMPLE_SQL.split("\n").length).toBeGreaterThan(3);
  });
});

describe("sql-minifier isKeyword", () => {
  it("recognizes SELECT", () => { expect(isKeyword("select")).toBe(true); });
  it("recognizes WHERE case-insensitively", () => { expect(isKeyword("Where")).toBe(true); });
  it("rejects non-keywords", () => { expect(isKeyword("mycolumn")).toBe(false); });
});

describe("sql-minifier tokenizeSql", () => {
  it("tokenizes a simple statement", () => {
    const toks = tokenizeSql("select id from users");
    const nonWs = toks.filter((t) => t.type !== "whitespace");
    expect(nonWs.map((t) => t.value)).toEqual(["select", "id", "from", "users"]);
  });
  it("preserves single-quoted strings with escape", () => {
    const toks = tokenizeSql("where name = 'O''Brien'");
    const str = toks.find((t) => t.type === "string");
    expect(str?.value).toBe("'O''Brien'");
  });
  it("tokenizes -- line comment", () => {
    const toks = tokenizeSql("select 1 -- hi\n");
    const c = toks.find((t) => t.type === "comment");
    expect(c?.value).toBe("-- hi");
  });
  it("tokenizes /* block comment */", () => {
    const toks = tokenizeSql("select /* hi */ 1");
    const c = toks.find((t) => t.type === "comment");
    expect(c?.value).toBe("/* hi */");
  });
  it("tokenizes MySQL # comment", () => {
    const toks = tokenizeSql("select 1 # hi\n", "mysql");
    const c = toks.find((t) => t.type === "comment");
    expect(c?.value).toBe("# hi");
  });
  it("tokenizes backtick identifier", () => {
    const toks = tokenizeSql("select `order` from t", "mysql");
    const id = toks.find((t) => t.type === "identifier" && t.value.startsWith("`"));
    expect(id?.value).toBe("`order`");
  });
  it("tokenizes T-SQL [bracket] identifier", () => {
    const toks = tokenizeSql("select [order] from t", "sqlserver");
    const id = toks.find((t) => t.type === "identifier" && t.value.startsWith("["));
    expect(id?.value).toBe("[order]");
  });
  it("handles nested block comments (postgresql)", () => {
    const toks = tokenizeSql("select /* outer /* inner */ still */ 1", "postgresql");
    const c = toks.find((t) => t.type === "comment");
    expect(c?.value).toBe("/* outer /* inner */ still */");
  });
});

describe("sql-minifier validateSql", () => {
  it("rejects empty input", () => {
    expect(validateSql("   ").ok).toBe(false);
  });
  it("accepts valid SQL", () => {
    expect(validateSql("select 1").ok).toBe(true);
  });
  it("rejects unterminated string", () => {
    expect(validateSql("select 'unclosed").ok).toBe(false);
  });
  it("rejects unbalanced parens", () => {
    expect(validateSql("select a) from t").ok).toBe(false);
  });
  it("accepts escaped quotes", () => {
    expect(validateSql("select 'O''Brien'").ok).toBe(true);
  });
});

describe("sql-minifier minifySql", () => {
  it("collapses whitespace into a single line", () => {
    const r = minifySql("select    id\n\n  from\n  users");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.output).toBe("select id from users");
    expect(r.output.includes("\n")).toBe(false);
  });
  it("removes -- line comments by default", () => {
    const r = minifySql("select 1 -- hello\nfrom t");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.output).not.toContain("-- hello");
    expect(r.output).toBe("select 1 from t");
  });
  it("removes /* block comments */ by default", () => {
    const r = minifySql("select /* hi */ 1");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.output).not.toContain("/* hi */");
    expect(r.output).toBe("select 1");
  });
  it("preserves comments when removeComments=false", () => {
    const r = minifySql("select /* hi */ 1", { ...DEFAULT_OPTIONS, removeComments: false });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.output).toContain("/* hi */");
  });
  it("preserves single-quoted string literals verbatim", () => {
    const r = minifySql("select 'O''Brien -- not a comment' from t");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.output).toContain("'O''Brien -- not a comment'");
    expect(r.output).not.toContain("'O''Brien --not a comment'"); // space inside string preserved
  });
  it("preserves quoted identifiers verbatim", () => {
    const r = minifySql('select "order" from t', { ...DEFAULT_OPTIONS, dialect: "ansi" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.output).toContain('"order"');
  });
  it("preserves backtick identifiers verbatim", () => {
    const r = minifySql("select `order` from t", { ...DEFAULT_OPTIONS, dialect: "mysql" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.output).toContain("`order`");
  });
  it("preserves T-SQL [bracket] identifiers verbatim", () => {
    const r = minifySql("select [order] from t", { ...DEFAULT_OPTIONS, dialect: "sqlserver" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.output).toContain("[order]");
  });
  it("normalizes consecutive semicolons", () => {
    const r = minifySql("select 1;;;; select 2;", { ...DEFAULT_OPTIONS, newlines: "betweenStatements" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.output).toBe("select 1;\nselect 2;");
  });
  it("keeps newlines between statements when newlines=betweenStatements", () => {
    const r = minifySql("select 1; select 2;", { ...DEFAULT_OPTIONS, newlines: "betweenStatements" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.output).toBe("select 1;\nselect 2;");
  });
  it("escapes as JS string when asJsString=true", () => {
    const r = minifySql("select 'hi' from t", { ...DEFAULT_OPTIONS, asJsString: true });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.output.startsWith('"')).toBe(true);
    expect(r.output.endsWith('"')).toBe(true);
    expect(r.output).toContain("'hi'");
  });
  it("returns empty output for empty input", () => {
    const r = minifySql("   ");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.output).toBe("");
  });
  it("returns error for unbalanced parens", () => {
    const r = minifySql("select a) from t");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.length).toBeGreaterThan(0);
  });
  it("reports savings stats", () => {
    const input = "select    1    from    t   ";
    const r = minifySql(input);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.stats.inputBytes).toBe(input.length);
    expect(r.stats.outputBytes).toBeLessThan(input.length);
    expect(r.stats.savedBytes).toBeGreaterThan(0);
    expect(r.stats.savedPercent).toBeGreaterThan(0);
    expect(r.stats.statementCount).toBe(1);
  });
  it("counts multiple statements", () => {
    const r = minifySql("select 1; select 2; select 3;");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.stats.statementCount).toBe(3);
  });
  it("does not mangle function-call parens", () => {
    const r = minifySql("select count(*) from t where f(a, b) > 0");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.output).toContain("count(*)");
    expect(r.output).toContain("f(a,b)");
    // space must be kept between `)` and `from`
    expect(r.output).toContain("*) from");
  });
  it("keeps space between keyword and open-paren", () => {
    const r = minifySql("select * from t where id in (1, 2, 3)");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.output).toContain("in (1,2,3)");
  });
  it("keeps space around binary operators", () => {
    const r = minifySql("select a + b - c from t");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.output).toContain("a + b - c");
  });
  it("preserves schema-qualified identifiers", () => {
    const r = minifySql("select t.id from public.t");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.output).toContain("t.id");
    expect(r.output).toContain("public.t");
  });
  it("round-trips the sample SQL without semantic loss", () => {
    const r = minifySql(SAMPLE_SQL);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.stats.outputBytes).toBeLessThan(r.stats.inputBytes);
    expect(r.output.toLowerCase()).toContain("select");
    expect(r.output.toLowerCase()).toContain("from");
  });
});

describe("sql-minifier computeSavings", () => {
  it("computes bytes and percent saved", () => {
    const s = computeSavings(1000, 250);
    expect(s.savedBytes).toBe(750);
    expect(s.savedPercent).toBe(75);
  });
  it("handles zero input", () => {
    const s = computeSavings(0, 0);
    expect(s.savedBytes).toBe(0);
    expect(s.savedPercent).toBe(0);
  });
  it("clamps negative savings to zero", () => {
    const s = computeSavings(100, 200);
    expect(s.savedBytes).toBe(0);
    expect(s.savedPercent).toBe(0);
  });
  it("rounds to one decimal", () => {
    const s = computeSavings(300, 100);
    // 200/300 = 66.666... → 66.7
    expect(s.savedPercent).toBe(66.7);
  });
});

describe("sql-minifier escapeForJs", () => {
  it("wraps in double quotes", () => {
    expect(escapeForJs("select 1").startsWith('"')).toBe(true);
    expect(escapeForJs("select 1").endsWith('"')).toBe(true);
  });
  it("escapes double quotes inside", () => {
    expect(escapeForJs('a"b')).toBe('"a\\"b"');
  });
  it("escapes backslashes", () => {
    expect(escapeForJs("a\\b")).toBe('"a\\\\b"');
  });
  it("escapes newlines", () => {
    expect(escapeForJs("a\nb")).toBe('"a\\nb"');
  });
});

describe("sql-minifier history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1, dialect: "ansi", removeComments: true,
      inputPreview: "sel", outputPreview: "sel", inputBytes: 3, outputBytes: 3, savedPercent: 0,
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i, dialect: "ansi", removeComments: true,
        inputPreview: String(i), outputPreview: String(i), inputBytes: 1, outputBytes: 1, savedPercent: 0,
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1, dialect: "ansi", removeComments: true,
      inputPreview: "x", outputPreview: "x", inputBytes: 1, outputBytes: 1, savedPercent: 0,
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
  it("newest entry is first", () => {
    saveHistory({
      ts: 1, dialect: "ansi", removeComments: true,
      inputPreview: "first", outputPreview: "f", inputBytes: 1, outputBytes: 1, savedPercent: 0,
    });
    saveHistory({
      ts: 2, dialect: "ansi", removeComments: true,
      inputPreview: "second", outputPreview: "s", inputBytes: 1, outputBytes: 1, savedPercent: 0,
    });
    const h = loadHistory();
    expect(h[0].inputPreview).toBe("second");
  });
});

describe("sql-minifier shareable URL", () => {
  it("builds share URL with all options", () => {
    const opts: MinifyOptions = {
      ...DEFAULT_OPTIONS,
      dialect: "mysql",
      removeComments: false,
      newlines: "betweenStatements",
      asJsString: true,
    };
    const url = buildShareUrl(opts);
    expect(url).toContain("d=mysql");
    expect(url).toContain("rc=0");
    expect(url).toContain("nl=betweenStatements");
    expect(url).toContain("js=1");
  });
  it("parses share URL back", () => {
    const url = buildShareUrl({ ...DEFAULT_OPTIONS, dialect: "postgresql", newlines: "betweenStatements" });
    const hash = url.includes("#") ? url.slice(url.indexOf("#")) : url;
    const parsed = parseShareUrl(hash);
    expect(parsed.dialect).toBe("postgresql");
    expect(parsed.newlines).toBe("betweenStatements");
  });
  it("ignores unknown enum values when parsing", () => {
    const parsed = parseShareUrl("d=unknown&nl=weird&rc=maybe");
    expect(parsed.dialect).toBe("ansi");
    expect(parsed.newlines).toBe("single");
    expect(parsed.removeComments).toBe(true);
  });
  it("returns defaults for empty hash", () => {
    const parsed = parseShareUrl("");
    expect(parsed).toEqual(DEFAULT_OPTIONS);
  });
  it("round-trips booleans", () => {
    const opts: MinifyOptions = { ...DEFAULT_OPTIONS, removeComments: false, normalizeSemicolons: false, asJsString: true };
    const url = buildShareUrl(opts);
    const hash = url.includes("#") ? url.slice(url.indexOf("#")) : url;
    const parsed = parseShareUrl(hash);
    expect(parsed.removeComments).toBe(false);
    expect(parsed.normalizeSemicolons).toBe(false);
    expect(parsed.asJsString).toBe(true);
  });
});

// Suppress unused-import lint
export type _Unused = SqlDialect | NewlineMode;
