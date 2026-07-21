import { describe, it, expect, beforeEach } from "vitest";
import {
  DEFAULT_CONFIG,
  FLAVOR_LABELS,
  FLAVOR_HINTS,
  SAMPLE_TEXTS,
  RECIPES,
  TRANSLATION_TABLE,
  shellQuote,
  breToJsSource,
  ereToJsSource,
  pcreToJsSource,
  rustToJsSource,
  flavorToJsSource,
  buildTestRegex,
  runMatch,
  highlightRanges,
  buildGrepCommand,
  buildRgCommand,
  buildCommands,
  explainIntent,
  explainFlags,
  validateConfig,
  formatTranslationTable,
  renderRecipesText,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type BuilderConfig,
  type RegexFlavor,
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

describe("grep-ripgrep constants", () => {
  it("has 4 flavors", () => {
    expect(Object.keys(FLAVOR_LABELS)).toHaveLength(4);
    expect(Object.keys(FLAVOR_HINTS)).toHaveLength(4);
  });
  it("has 4 sample texts", () => {
    expect(SAMPLE_TEXTS).toHaveLength(4);
    expect(SAMPLE_TEXTS.some((s) => s.id === "log")).toBe(true);
  });
  it("has 10 recipes", () => {
    expect(RECIPES).toHaveLength(10);
  });
  it("has translation table with 19+ entries", () => {
    expect(TRANSLATION_TABLE.length).toBeGreaterThanOrEqual(19);
  });
  it("default config has sensible values", () => {
    expect(DEFAULT_CONFIG.flavor).toBe("ere");
    expect(DEFAULT_CONFIG.recursive).toBe(true);
    expect(DEFAULT_CONFIG.lineNumbers).toBe(true);
    expect(DEFAULT_CONFIG.paths).toEqual(["."]);
  });
});

describe("grep-ripgrep shellQuote", () => {
  it("leaves safe strings unquoted", () => {
    expect(shellQuote("foo")).toBe("foo");
    expect(shellQuote("foo_bar-1.txt")).toBe("foo_bar-1.txt");
  });
  it("quotes empty string", () => {
    expect(shellQuote("")).toBe("''");
  });
  it("single-quotes strings with spaces", () => {
    expect(shellQuote("foo bar")).toBe("'foo bar'");
  });
  it("escapes embedded single quotes", () => {
    // 'foo'\''bar' is the safe embedding of foo'bar
    expect(shellQuote("foo'bar")).toBe("'foo'\\''bar'");
  });
});

describe("grep-ripgrep flavor conversion", () => {
  it("BRE unescapes metacharacters", () => {
    expect(breToJsSource("a\\+b")).toBe("a+b");
    expect(breToJsSource("\\(group\\)")).toBe("(group)");
    expect(breToJsSource("a\\{2,3\\}")).toBe("a{2,3}");
  });
  it("BRE escapes unescaped metacharacters to literals", () => {
    expect(breToJsSource("a+b")).toBe("a\\+b");
    expect(breToJsSource("(group)")).toBe("\\(group\\)");
  });
  it("ERE is pass-through", () => {
    expect(ereToJsSource("a+b?")).toBe("a+b?");
  });
  it("PCRE is pass-through", () => {
    expect(pcreToJsSource("\\d+")).toBe("\\d+");
  });
  it("Rust regex is pass-through", () => {
    expect(rustToJsSource("[a-z]+")).toBe("[a-z]+");
  });
  it("flavorToJsSource dispatches", () => {
    expect(flavorToJsSource("a\\+b", "bre")).toBe("a+b");
    expect(flavorToJsSource("a+b", "ere")).toBe("a+b");
  });
});

describe("grep-ripgrep buildTestRegex", () => {
  it("returns null for empty pattern", () => {
    expect(buildTestRegex("", "ere")).toBeNull();
  });
  it("returns null for invalid pattern", () => {
    expect(buildTestRegex("(unclosed", "ere")).toBeNull();
  });
  it("applies ignoreCase flag", () => {
    const re = buildTestRegex("foo", "ere", { ignoreCase: true })!;
    expect(re.flags).toContain("i");
  });
  it("applies wholeWord by wrapping with \\b", () => {
    const re = buildTestRegex("err", "ere", { wholeWord: true })!;
    expect(re.source).toContain("\\b");
  });
  it("fixedString escapes all metacharacters", () => {
    const re = buildTestRegex("1.2+3", "ere", { fixedString: true })!;
    expect(re.test("1.2+3")).toBe(true);
    expect(re.test("1x2y3")).toBe(false);
  });
  it("multiline adds dotall flag", () => {
    const re = buildTestRegex("a.b", "rust", { multiline: true })!;
    expect(re.flags).toContain("s");
  });
});

describe("grep-ripgrep runMatch", () => {
  it("matches per-line by default", () => {
    const r = runMatch("ERROR", SAMPLE_TEXTS[0].text, { flavor: "ere" });
    expect(r.ok).toBe(true);
    expect(r.count).toBe(2);
    expect(r.matches).toHaveLength(2);
    expect(r.matches[0].line).toBe(3);
  });
  it("case-insensitive", () => {
    // ERROR appears on lines 3 and 5 of the log sample
    const r = runMatch("error", SAMPLE_TEXTS[0].text, { flavor: "ere", ignoreCase: true });
    expect(r.count).toBe(2);
  });
  it("count mode returns count only", () => {
    const r = runMatch("ERROR", SAMPLE_TEXTS[0].text, { flavor: "ere", count: true });
    expect(r.matches).toEqual([]);
    expect(r.count).toBe(2);
  });
  it("invert mode returns non-matching lines", () => {
    const r = runMatch("ERROR", SAMPLE_TEXTS[0].text, { flavor: "ere", invert: true });
    expect(r.ok).toBe(true);
    // 7 total lines, 2 match ERROR, so 5 don't match.
    expect(r.matches).toHaveLength(5);
  });
  it("whole-word does not match substring", () => {
    const r1 = runMatch("error", "errors and error", { flavor: "ere", wholeWord: true });
    expect(r1.count).toBe(1);
    const r2 = runMatch("error", "errors and error", { flavor: "ere", wholeWord: false });
    expect(r2.count).toBe(2);
  });
  it("onlyMatching is reflected in ranges (not just line count)", () => {
    const r = runMatch("\\d+", "lines 12 and 348 contain", { flavor: "pcre" });
    expect(r.matches[0].ranges).toHaveLength(2);
  });
  it("returns error for invalid pattern", () => {
    const r = runMatch("(unclosed", "text", { flavor: "ere" });
    expect(r.ok).toBe(false);
    expect(r.error).toContain("Invalid");
  });
  it("empty pattern returns no matches", () => {
    const r = runMatch("", "text", { flavor: "ere" });
    expect(r.matches).toEqual([]);
    expect(r.count).toBe(0);
  });
  it("multiline mode spans across lines", () => {
    const text = "start\nmiddle\nend";
    const r = runMatch("start[\\s\\S]*?end", text, { flavor: "rust", multiline: true });
    expect(r.count).toBe(1);
  });
});

describe("grep-ripgrep highlightRanges", () => {
  it("returns single non-match segment when no ranges", () => {
    const segs = highlightRanges("hello", []);
    expect(segs).toEqual([{ text: "hello", match: false }]);
  });
  it("splits into segments around ranges", () => {
    const segs = highlightRanges("hello world", [[6, 11]]);
    expect(segs).toEqual([
      { text: "hello ", match: false },
      { text: "world", match: true },
    ]);
  });
  it("handles multiple ranges", () => {
    const segs = highlightRanges("a1b2c", [[1, 2], [3, 4]]);
    expect(segs.map((s) => s.text)).toEqual(["a", "1", "b", "2", "c"]);
    expect(segs.map((s) => s.match)).toEqual([false, true, false, true, false]);
  });
});

describe("grep-ripgrep buildGrepCommand", () => {
  it("builds minimal grep command", () => {
    const r = buildGrepCommand({ ...DEFAULT_CONFIG, pattern: "TODO", recursive: false, lineNumbers: false, paths: ["file.txt"] });
    expect(r.command).toContain("grep");
    // 'TODO' is shell-safe so left unquoted
    expect(r.command).toContain(" TODO");
    expect(r.command).toContain("file.txt");
    expect(r.command).toContain("-E"); // default flavor is ERE so grep adds -E
  });
  it("adds -E for ERE flavor", () => {
    const r = buildGrepCommand({ ...DEFAULT_CONFIG, flavor: "ere", recursive: false, lineNumbers: false, paths: ["f.txt"] });
    expect(r.command).toContain(" -E ");
  });
  it("adds -P for PCRE flavor and a note", () => {
    const r = buildGrepCommand({ ...DEFAULT_CONFIG, flavor: "pcre", recursive: false, lineNumbers: false, paths: ["f.txt"] });
    expect(r.command).toContain(" -P ");
    expect(r.notes.some((n) => n.includes("GNU"))).toBe(true);
  });
  it("adds flags for each toggle", () => {
    const r = buildGrepCommand({
      ...DEFAULT_CONFIG,
      pattern: "x", recursive: false, lineNumbers: false, paths: ["f"],
      ignoreCase: true, wholeWord: true, invert: true, count: true, onlyMatching: true,
    });
    expect(r.command).toContain(" -i ");
    expect(r.command).toContain(" -w ");
    expect(r.command).toContain(" -v ");
    expect(r.command).toContain(" -c ");
    expect(r.command).toContain(" -o ");
  });
  it("adds -F for fixed string", () => {
    const r = buildGrepCommand({ ...DEFAULT_CONFIG, pattern: "1.2.3.4", flavor: "ere", fixedString: true, recursive: false, lineNumbers: false, paths: ["f"] });
    expect(r.command).toContain(" -F ");
  });
  it("adds --include and --exclude", () => {
    const r = buildGrepCommand({ ...DEFAULT_CONFIG, pattern: "x", recursive: true, lineNumbers: false, paths: ["."], includes: ["*.py"], excludes: ["*.log"] });
    // *.py / *.log contain shell-unsafe *, so they're single-quoted
    expect(r.command).toContain("--include='*.py'");
    expect(r.command).toContain("--exclude='*.log'");
  });
  it("adds --exclude-dir", () => {
    const r = buildGrepCommand({ ...DEFAULT_CONFIG, pattern: "x", recursive: true, lineNumbers: false, paths: ["."], excludeDirs: ["node_modules"] });
    expect(r.command).toContain("--exclude-dir=node_modules");
  });
  it("adds -C context", () => {
    const r = buildGrepCommand({ ...DEFAULT_CONFIG, pattern: "x", recursive: false, lineNumbers: false, paths: ["f"], contextBoth: 3 });
    expect(r.command).toContain(" -C 3");
  });
  it("adds -A and -B context separately", () => {
    const r = buildGrepCommand({ ...DEFAULT_CONFIG, pattern: "x", recursive: false, lineNumbers: false, paths: ["f"], contextBefore: 2, contextAfter: 4 });
    expect(r.command).toContain(" -B 2");
    expect(r.command).toContain(" -A 4");
  });
  it("suggests sed for replace", () => {
    const r = buildGrepCommand({ ...DEFAULT_CONFIG, pattern: "x", recursive: false, lineNumbers: false, paths: ["f"], replace: "y" });
    expect(r.notes.some((n) => n.includes("sed"))).toBe(true);
  });
  it("shell-quotes pattern with single quote", () => {
    const r = buildGrepCommand({ ...DEFAULT_CONFIG, pattern: "foo'bar", recursive: false, lineNumbers: false, paths: ["f"] });
    expect(r.command).toContain("'foo'\\''bar'");
  });
});

describe("grep-ripgrep buildRgCommand", () => {
  it("builds minimal rg command", () => {
    const r = buildRgCommand({ ...DEFAULT_CONFIG, pattern: "TODO", recursive: true, lineNumbers: true, paths: ["."] });
    expect(r.command).toContain("rg");
    // 'TODO' is shell-safe so unquoted
    expect(r.command).toContain(" TODO");
  });
  it("does not add -r for recursive (default)", () => {
    const r = buildRgCommand({ ...DEFAULT_CONFIG, pattern: "x", recursive: true, lineNumbers: false, paths: ["."] });
    expect(r.command).not.toContain(" -r ");
  });
  it("uses --max-depth 0 when not recursive", () => {
    const r = buildRgCommand({ ...DEFAULT_CONFIG, pattern: "x", recursive: false, lineNumbers: false, paths: ["f"] });
    expect(r.command).toContain("--max-depth 0");
  });
  it("adds -uuu for no filtering", () => {
    const r = buildRgCommand({ ...DEFAULT_CONFIG, pattern: "x", recursive: true, lineNumbers: false, paths: ["."], noFiltering: true });
    expect(r.command).toContain("-uuu");
  });
  it("adds -U for multiline", () => {
    const r = buildRgCommand({ ...DEFAULT_CONFIG, pattern: "x", recursive: true, lineNumbers: false, paths: ["."], multiline: true });
    expect(r.command).toContain(" -U");
  });
  it("uses -g with leading ! for excludes", () => {
    const r = buildRgCommand({ ...DEFAULT_CONFIG, pattern: "x", recursive: true, lineNumbers: false, paths: ["."], excludes: ["*.log"] });
    expect(r.command).toContain("-g '!*.log'");
  });
  it("uses -g for includes", () => {
    const r = buildRgCommand({ ...DEFAULT_CONFIG, pattern: "x", recursive: true, lineNumbers: false, paths: ["."], includes: ["*.py"] });
    expect(r.command).toContain("-g '*.py'");
  });
  it("uses -t for rg type", () => {
    const r = buildRgCommand({ ...DEFAULT_CONFIG, pattern: "x", recursive: true, lineNumbers: false, paths: ["."], rgType: "py" });
    expect(r.command).toContain(" -t py");
  });
  it("uses -r for replace preview", () => {
    const r = buildRgCommand({ ...DEFAULT_CONFIG, pattern: "x", recursive: true, lineNumbers: false, paths: ["."], replace: "y" });
    // 'y' is shell-safe so unquoted
    expect(r.command).toContain("-r y");
  });
  it("adds -P for PCRE flavor", () => {
    const r = buildRgCommand({ ...DEFAULT_CONFIG, flavor: "pcre", pattern: "x", recursive: true, lineNumbers: false, paths: ["."] });
    expect(r.command).toContain(" -P");
  });
  it("notes BRE incompatibility", () => {
    const r = buildRgCommand({ ...DEFAULT_CONFIG, flavor: "bre", pattern: "a\\+b", recursive: true, lineNumbers: false, paths: ["."] });
    expect(r.notes.some((n) => n.includes("BRE"))).toBe(true);
  });
});

describe("grep-ripgrep buildCommands", () => {
  it("returns both grep and rg", () => {
    const r = buildCommands(DEFAULT_CONFIG);
    expect(r.grep.command).toContain("grep");
    expect(r.rg.command).toContain("rg");
  });
});

describe("grep-ripgrep explainIntent", () => {
  it("describes the command intent", () => {
    const s = explainIntent(DEFAULT_CONFIG);
    expect(s).toContain("TODO");
    expect(s).toContain("ERE");
    expect(s).toContain("recursive");
  });
  it("mentions replace preview", () => {
    const s = explainIntent({ ...DEFAULT_CONFIG, replace: "FIXME" });
    expect(s).toContain("replacing");
    expect(s).toContain("FIXME");
  });
});

describe("grep-ripgrep explainFlags", () => {
  it("returns flags for default config", () => {
    const flags = explainFlags(DEFAULT_CONFIG);
    expect(flags.length).toBeGreaterThan(0);
    expect(flags.some((f) => f.flag.includes("-E"))).toBe(true);
  });
  it("includes context flag when set", () => {
    const flags = explainFlags({ ...DEFAULT_CONFIG, contextBoth: 3 });
    expect(flags.some((f) => f.flag === "-C 3")).toBe(true);
  });
  it("includes include glob explanation", () => {
    const flags = explainFlags({ ...DEFAULT_CONFIG, includes: ["*.py"] });
    expect(flags.some((f) => f.flag.includes("--include="))).toBe(true);
  });
});

describe("grep-ripgrep validateConfig", () => {
  it("errors on empty pattern", () => {
    const r = validateConfig({ ...DEFAULT_CONFIG, pattern: "" });
    expect(r.errors.some((e) => e.includes("empty"))).toBe(true);
  });
  it("errors on invalid pattern", () => {
    const r = validateConfig({ ...DEFAULT_CONFIG, pattern: "(unclosed" });
    expect(r.errors.some((e) => e.includes("not a valid"))).toBe(true);
  });
  it("warns on PCRE flavor (GNU-only)", () => {
    const r = validateConfig({ ...DEFAULT_CONFIG, flavor: "pcre" });
    expect(r.warnings.some((w) => w.includes("GNU"))).toBe(true);
  });
  it("warns when no paths", () => {
    const r = validateConfig({ ...DEFAULT_CONFIG, paths: [] });
    expect(r.warnings.some((w) => w.includes("stdin"))).toBe(true);
  });
  it("no errors on valid config", () => {
    const r = validateConfig(DEFAULT_CONFIG);
    expect(r.errors).toHaveLength(0);
  });
});

describe("grep-ripgrep formatTranslationTable", () => {
  it("has header and entries", () => {
    const text = formatTranslationTable();
    expect(text).toContain("Intent | grep | rg | Notes");
    expect(text.split("\n").length).toBeGreaterThan(5);
  });
});

describe("grep-ripgrep renderRecipesText", () => {
  it("renders all recipes", () => {
    const text = renderRecipesText();
    expect(text).toContain("Find TODO");
    expect(text.split("\n\n").length).toBeGreaterThanOrEqual(10);
  });
});

describe("grep-ripgrep history (localStorage)", () => {
  it("loads empty initially", () => { expect(loadHistory()).toEqual([]); });
  it("saves and loads", () => {
    saveHistory({ ts: 1, pattern: "TODO", flavor: "ere", matchCount: 3 });
    const h = loadHistory();
    expect(h).toHaveLength(1);
    expect(h[0].pattern).toBe("TODO");
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, pattern: `p${i}`, flavor: "ere", matchCount: i });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, pattern: "x", flavor: "ere", matchCount: 0 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
  it("newest entry first", () => {
    saveHistory({ ts: 1, pattern: "first", flavor: "ere", matchCount: 1 });
    saveHistory({ ts: 2, pattern: "second", flavor: "ere", matchCount: 2 });
    const h = loadHistory();
    expect(h[0].pattern).toBe("second");
  });
});

describe("grep-ripgrep shareable URL", () => {
  it("builds share URL with all flags", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl(
      { ...DEFAULT_CONFIG, ignoreCase: true, wholeWord: true, includes: ["*.py"], paths: ["src"] },
      "sample",
    );
    expect(url).toContain("p=TODO");
    expect(url).toContain("f=ere");
    expect(url).toContain("x=iw"); // ignore-case + whole-word
    expect(url).toContain("inc=*.py");
    expect(url).toContain("paths=src");
    expect(url).toContain("s=sample");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const { config, sample } = parseShareUrl("p=ERROR&f=pcre&x=icn&inc=*.py&paths=src&s=log");
    expect(config.pattern).toBe("ERROR");
    expect(config.flavor).toBe("pcre");
    expect(config.ignoreCase).toBe(true);
    expect(config.count).toBe(true);
    expect(config.lineNumbers).toBe(true);
    expect(config.includes).toEqual(["*.py"]);
    expect(config.paths).toEqual(["src"]);
    expect(sample).toBe("log");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({ config: {}, sample: "" });
  });
  it("filters invalid flavor", () => {
    const { config } = parseShareUrl("p=x&f=invalid");
    expect(config.flavor).toBeUndefined();
  });
});

// Suppress unused-import lint
export type _Unused = BuilderConfig | RegexFlavor;
