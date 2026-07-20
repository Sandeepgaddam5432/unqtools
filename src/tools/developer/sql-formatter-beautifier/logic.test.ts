import { describe, it, expect, beforeEach } from "vitest";
import {
  SQL_DIALECTS,
  KEYWORD_CASE_OPTIONS,
  COMMA_STYLE_OPTIONS,
  INDENT_STYLE_OPTIONS,
  DEFAULT_OPTIONS,
  PRESETS,
  KEYWORDS,
  SAMPLE_SQL,
  tokenizeSql,
  isKeyword,
  applyCase,
  formatSql,
  validateSql,
  computeInputStats,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type FormatOptions,
  type SqlDialect,
  type KeywordCase,
  type CommaStyle,
  type IndentStyle,
  type IdentifierCase,
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

describe("sql-formatter constants", () => {
  it("exposes 5 dialects", () => {
    expect(SQL_DIALECTS).toHaveLength(5);
    expect(SQL_DIALECTS.map((d) => d.value)).toEqual(
      expect.arrayContaining(["ansi", "mysql", "postgresql", "sqlite", "sqlserver"]),
    );
  });
  it("exposes 3 keyword-case options", () => {
    expect(KEYWORD_CASE_OPTIONS).toHaveLength(3);
  });
  it("exposes 2 comma-style options", () => {
    expect(COMMA_STYLE_OPTIONS).toHaveLength(2);
  });
  it("exposes 2 indent-style options", () => {
    expect(INDENT_STYLE_OPTIONS).toHaveLength(2);
  });
  it("ships >=5 presets", () => {
    expect(PRESETS.length).toBeGreaterThanOrEqual(5);
    expect(PRESETS.some((p) => p.id === "default")).toBe(true);
  });
  it("DEFAULT_OPTIONS has expected defaults", () => {
    expect(DEFAULT_OPTIONS.dialect).toBe("ansi");
    expect(DEFAULT_OPTIONS.keywordCase).toBe("upper");
    expect(DEFAULT_OPTIONS.commaStyle).toBe("trailing");
    expect(DEFAULT_OPTIONS.indentSize).toBe(2);
  });
  it("KEYWORDS contains core clauses", () => {
    expect(KEYWORDS.has("SELECT")).toBe(true);
    expect(KEYWORDS.has("FROM")).toBe(true);
    expect(KEYWORDS.has("WHERE")).toBe(true);
    expect(KEYWORDS.has("JOIN")).toBe(true);
  });
  it("SAMPLE_SQL is non-empty", () => {
    expect(SAMPLE_SQL.length).toBeGreaterThan(50);
    expect(SAMPLE_SQL.toLowerCase()).toContain("select");
  });
});

describe("sql-formatter isKeyword", () => {
  it("recognizes SELECT", () => { expect(isKeyword("select")).toBe(true); });
  it("recognizes JOIN case-insensitively", () => { expect(isKeyword("Join")).toBe(true); });
  it("rejects non-keywords", () => { expect(isKeyword("mycolumn")).toBe(false); });
  it("handles empty input", () => { expect(isKeyword("")).toBe(false); });
});

describe("sql-formatter applyCase", () => {
  it("uppercases", () => { expect(applyCase("select", "upper")).toBe("SELECT"); });
  it("lowercases", () => { expect(applyCase("SELECT", "lower")).toBe("select"); });
  it("preserves", () => { expect(applyCase("SeLeCt", "preserve")).toBe("SeLeCt"); });
});

describe("sql-formatter tokenizeSql", () => {
  it("tokenizes a simple SELECT", () => {
    const toks = tokenizeSql("select id from users");
    const nonWs = toks.filter((t) => t.type !== "whitespace");
    expect(nonWs.map((t) => t.value)).toEqual(["select", "id", "from", "users"]);
    expect(nonWs[0].type).toBe("keyword");
    expect(nonWs[1].type).toBe("identifier");
    expect(nonWs[2].type).toBe("keyword");
    expect(nonWs[3].type).toBe("identifier");
  });
  it("preserves single-quoted string with escape", () => {
    const toks = tokenizeSql("WHERE name = 'O''Brien'");
    const str = toks.find((t) => t.type === "string");
    expect(str?.value).toBe("'O''Brien'");
  });
  it("tokenizes double-quote as identifier (ansi)", () => {
    const toks = tokenizeSql('select "order" from t', "ansi");
    const id = toks.find((t) => t.type === "identifier" && t.value.startsWith('"'));
    expect(id?.value).toBe('"order"');
  });
  it("tokenizes backtick as identifier (mysql)", () => {
    const toks = tokenizeSql("select `order` from t", "mysql");
    const id = toks.find((t) => t.type === "identifier" && t.value.startsWith("`"));
    expect(id?.value).toBe("`order`");
  });
  it("tokenizes T-SQL [bracket] identifier", () => {
    const toks = tokenizeSql("select [order] from t", "sqlserver");
    const id = toks.find((t) => t.type === "identifier" && t.value.startsWith("["));
    expect(id?.value).toBe("[order]");
  });
  it("tokenizes -- line comment", () => {
    const toks = tokenizeSql("select 1 -- hello\nfrom t");
    const c = toks.find((t) => t.type === "comment" && t.value.includes("hello"));
    expect(c?.value).toBe("-- hello");
  });
  it("tokenizes /* block comment */", () => {
    const toks = tokenizeSql("select /* hi */ 1");
    const c = toks.find((t) => t.type === "comment");
    expect(c?.value).toBe("/* hi */");
  });
  it("tokenizes MySQL # comment", () => {
    const toks = tokenizeSql("select 1 # comment\n", "mysql");
    const c = toks.find((t) => t.type === "comment" && t.value.includes("comment"));
    expect(c?.value).toBe("# comment");
  });
  it("tokenizes numbers", () => {
    const toks = tokenizeSql("where x = 3.14e-2");
    const num = toks.find((t) => t.type === "number");
    expect(num?.value).toBe("3.14e-2");
  });
  it("tokenizes multi-char operators", () => {
    const toks = tokenizeSql("a <> b != c <= d >= e || f :: g");
    const ops = toks.filter((t) => t.type === "operator").map((t) => t.value);
    expect(ops).toEqual(expect.arrayContaining(["<>", "!=", "<=", ">=", "||", "::"]));
  });
  it("emits whitespace tokens between words", () => {
    const toks = tokenizeSql("a b");
    expect(toks.some((t) => t.type === "whitespace")).toBe(true);
  });
});

describe("sql-formatter validateSql", () => {
  it("rejects empty input", () => {
    expect(validateSql("   ").ok).toBe(false);
  });
  it("accepts balanced parens", () => {
    expect(validateSql("select count(*) from t").ok).toBe(true);
  });
  it("rejects unbalanced close paren", () => {
    const r = validateSql("select a) from t");
    expect(r.ok).toBe(false);
  });
  it("rejects unterminated single-quote", () => {
    const r = validateSql("select 'unclosed");
    expect(r.ok).toBe(false);
  });
  it("rejects unterminated block comment", () => {
    const r = validateSql("select 1 /* open");
    expect(r.ok).toBe(false);
  });
  it("accepts escaped quotes as closed", () => {
    expect(validateSql("select 'O''Brien'").ok).toBe(true);
  });
});

describe("sql-formatter formatSql", () => {
  it("formats a simple SELECT with newlines before clauses", () => {
    const r = formatSql("select id from users where x = 1");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const out = r.output;
    expect(out).toContain("SELECT");
    expect(out).toContain("\nFROM");
    expect(out).toContain("\nWHERE");
  });
  it("uppercases keywords when keywordCase=upper", () => {
    const r = formatSql("select id from t", { ...DEFAULT_OPTIONS, keywordCase: "upper" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.output).toContain("SELECT");
    expect(r.output).toContain("FROM");
  });
  it("lowercases keywords when keywordCase=lower", () => {
    const r = formatSql("SELECT id FROM t", { ...DEFAULT_OPTIONS, keywordCase: "lower" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.output).toContain("select");
    expect(r.output).toContain("from");
  });
  it("preserves single-quoted string literals verbatim", () => {
    const r = formatSql("select 'O''Brien' from t");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.output).toContain("'O''Brien'");
  });
  it("preserves comments when preserveComments=true", () => {
    const r = formatSql("select 1 -- hello\nfrom t", { ...DEFAULT_OPTIONS, preserveComments: true });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.output).toContain("-- hello");
  });
  it("strips comments when preserveComments=false", () => {
    const r = formatSql("select 1 -- hello\nfrom t", { ...DEFAULT_OPTIONS, preserveComments: false });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.output).not.toContain("-- hello");
  });
  it("indents subqueries", () => {
    const r = formatSql("select * from (select id from t) sub");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.output).toContain("SELECT");
    expect(r.output).toMatch(/(\s+)SELECT id/); // indented SELECT
  });
  it("formats trailing commas in SELECT list", () => {
    const r = formatSql("select a, b, c from t", { ...DEFAULT_OPTIONS, commaStyle: "trailing" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.output).toMatch(/a,/);
    expect(r.output).toMatch(/b,/);
  });
  it("formats leading commas in SELECT list", () => {
    const r = formatSql("select a, b, c from t", { ...DEFAULT_OPTIONS, commaStyle: "leading" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.output).toMatch(/,\s*b/);
    expect(r.output).toMatch(/,\s*c/);
  });
  it("returns empty output for empty input", () => {
    const r = formatSql("   ");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.output).toBe("");
  });
  it("returns error for unbalanced parens", () => {
    const r = formatSql("select a) from t");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.length).toBeGreaterThan(0);
  });
  it("handles multiple statements", () => {
    const r = formatSql("select 1; select 2;");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.output).toContain(";");
  });
  it("uses tabs when indent=tabs", () => {
    const r = formatSql("select * from (select id from t) sub", { ...DEFAULT_OPTIONS, indent: "tabs" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.output).toContain("\t");
  });
  it("returns stats with non-zero outputBytes", () => {
    const r = formatSql("select id from t");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.stats.inputBytes).toBeGreaterThan(0);
    expect(r.stats.outputBytes).toBeGreaterThan(0);
    expect(r.stats.tokenCount).toBeGreaterThan(0);
  });
  it("preserves schema-qualified identifiers", () => {
    const r = formatSql("select t.id from public.t");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.output).toContain("public.t");
    expect(r.output).toContain("t.id");
  });
  it("preserves quoted identifiers case when identifierCase=preserve", () => {
    const r = formatSql('select "MyCol" from t', { ...DEFAULT_OPTIONS, dialect: "ansi", identifierCase: "preserve" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.output).toContain('"MyCol"');
  });
  it("formats CASE/WHEN without breaking", () => {
    const r = formatSql("select case when x > 0 then 'pos' else 'neg' end from t");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.output).toContain("CASE");
    expect(r.output).toContain("WHEN");
    expect(r.output).toContain("'pos'");
  });
});

describe("sql-formatter computeInputStats", () => {
  it("counts bytes and lines", () => {
    const s = computeInputStats("select 1\nfrom t");
    expect(s.bytes).toBe(15);
    expect(s.lines).toBe(2);
    expect(s.statements).toBe(1);
  });
  it("counts multiple statements by semicolons", () => {
    const s = computeInputStats("select 1; select 2;");
    expect(s.statements).toBe(2);
  });
  it("returns zero for empty", () => {
    const s = computeInputStats("");
    expect(s.bytes).toBe(0);
    expect(s.statements).toBe(0);
  });
});

describe("sql-formatter history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1, dialect: "ansi", keywordCase: "upper", commaStyle: "trailing",
      inputPreview: "sel", outputPreview: "SEL", inputBytes: 3, outputBytes: 3,
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i, dialect: "ansi", keywordCase: "upper", commaStyle: "trailing",
        inputPreview: String(i), outputPreview: String(i), inputBytes: 1, outputBytes: 1,
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1, dialect: "ansi", keywordCase: "upper", commaStyle: "trailing",
      inputPreview: "x", outputPreview: "X", inputBytes: 1, outputBytes: 1,
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
  it("newest entry is first", () => {
    saveHistory({
      ts: 1, dialect: "ansi", keywordCase: "upper", commaStyle: "trailing",
      inputPreview: "first", outputPreview: "F", inputBytes: 1, outputBytes: 1,
    });
    saveHistory({
      ts: 2, dialect: "ansi", keywordCase: "upper", commaStyle: "trailing",
      inputPreview: "second", outputPreview: "S", inputBytes: 1, outputBytes: 1,
    });
    const h = loadHistory();
    expect(h[0].inputPreview).toBe("second");
    expect(h[1].inputPreview).toBe("first");
  });
});

describe("sql-formatter shareable URL", () => {
  it("builds share URL with all options", () => {
    const opts: FormatOptions = {
      ...DEFAULT_OPTIONS,
      dialect: "postgresql",
      keywordCase: "lower",
      commaStyle: "leading",
      indentSize: 4,
    };
    const url = buildShareUrl(opts);
    expect(url).toContain("d=postgresql");
    expect(url).toContain("kc=lower");
    expect(url).toContain("cs=leading");
    expect(url).toContain("is=4");
  });
  it("parses share URL back to options", () => {
    const url = buildShareUrl({ ...DEFAULT_OPTIONS, dialect: "mysql", keywordCase: "lower" });
    const hash = url.includes("#") ? url.slice(url.indexOf("#")) : url;
    const parsed = parseShareUrl(hash);
    expect(parsed.dialect).toBe("mysql");
    expect(parsed.keywordCase).toBe("lower");
  });
  it("ignores unknown enum values when parsing", () => {
    const parsed = parseShareUrl("d=unknown&kc=weird&cs=nope&is=99");
    expect(parsed.dialect).toBe("ansi");
    expect(parsed.keywordCase).toBe("upper");
    expect(parsed.commaStyle).toBe("trailing");
    expect(parsed.indentSize).toBe(2);
  });
  it("returns defaults for empty hash", () => {
    const parsed = parseShareUrl("");
    expect(parsed).toEqual(DEFAULT_OPTIONS);
  });
  it("round-trips booleans", () => {
    const opts: FormatOptions = { ...DEFAULT_OPTIONS, newLineBeforeClause: false, preserveComments: false };
    const url = buildShareUrl(opts);
    const hash = url.includes("#") ? url.slice(url.indexOf("#")) : url;
    const parsed = parseShareUrl(hash);
    expect(parsed.newLineBeforeClause).toBe(false);
    expect(parsed.preserveComments).toBe(false);
  });
});

// Suppress unused-import lint
export type _Unused =
  | SqlDialect | KeywordCase | CommaStyle | IndentStyle | IdentifierCase;
