import { describe, it, expect, beforeEach } from "vitest";
import {
  SAMPLE_TEXTS,
  RECIPE_LIBRARY,
  DEFAULT_CONFIG,
  DELIMITER_CANDIDATES,
  normalizeInput,
  shellQuote,
  pickDelimiter,
  breToJsRegex,
  buildSubstitute,
  buildDelete,
  buildPrint,
  buildInsert,
  buildAppend,
  buildChange,
  buildNext,
  buildQuit,
  buildLineNumber,
  formatAddress,
  parseScript,
  explainCommand,
  explainConfig,
  buildScript,
  buildSedCommand,
  buildSed,
  explainProgram,
  expandReplacement,
  runSed,
  runSedConfig,
  validateScript,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type SedConfig,
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

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------

describe("sed constants", () => {
  it("has 5 sample texts", () => {
    expect(SAMPLE_TEXTS).toHaveLength(5);
    expect(SAMPLE_TEXTS.some((t) => t.label === "CSV sales")).toBe(true);
  });
  it("has 12 recipes", () => {
    expect(RECIPE_LIBRARY).toHaveLength(12);
  });
  it("default config has no flags and no commands", () => {
    expect(DEFAULT_CONFIG.suppressAutoPrint).toBe(false);
    expect(DEFAULT_CONFIG.extendedRegex).toBe(false);
    expect(DEFAULT_CONFIG.commands).toEqual([]);
  });
  it("has 10+ delimiter candidates", () => {
    expect(DELIMITER_CANDIDATES.length).toBeGreaterThanOrEqual(10);
    expect(DELIMITER_CANDIDATES).toContain("/");
    expect(DELIMITER_CANDIDATES).toContain("|");
  });
});

// ----------------------------------------------------------------------------
// normalizeInput / shellQuote
// ----------------------------------------------------------------------------

describe("sed normalizeInput", () => {
  it("converts CRLF to LF", () => {
    expect(normalizeInput("a\r\nb\r\nc")).toBe("a\nb\nc");
  });
  it("trims trailing newlines", () => {
    expect(normalizeInput("a\nb\n\n\n")).toBe("a\nb");
  });
  it("returns empty for empty", () => {
    expect(normalizeInput("")).toBe("");
  });
});

describe("sed shellQuote", () => {
  it("wraps a plain string in single quotes", () => {
    expect(shellQuote("hello")).toBe("'hello'");
  });
  it("returns '' for empty", () => {
    expect(shellQuote("")).toBe("''");
  });
  it("escapes embedded single quotes", () => {
    expect(shellQuote("it's")).toBe("'it'\\''s'");
  });
});

// ----------------------------------------------------------------------------
// pickDelimiter
// ----------------------------------------------------------------------------

describe("sed pickDelimiter", () => {
  it("returns / when search has no slash", () => {
    expect(pickDelimiter("foo", "bar", "/")).toBe("/");
  });
  it("switches to | when search has a slash", () => {
    expect(pickDelimiter("/usr/bin", "/opt/bin", "/")).toBe("|");
  });
  it("switches from / to | to # as / and | are used in the strings", () => {
    expect(pickDelimiter("/a|b", "/c|d", "/")).toBe("#");
  });
  it("falls back through candidates", () => {
    // All delimiters except the last appear in the strings
    const search = DELIMITER_CANDIDATES.slice(0, -1).join("");
    const d = pickDelimiter(search, "");
    expect(d).toBe(DELIMITER_CANDIDATES[DELIMITER_CANDIDATES.length - 1]);
  });
});

// ----------------------------------------------------------------------------
// breToJsRegex
// ----------------------------------------------------------------------------

describe("sed breToJsRegex", () => {
  it("passes through ERE unchanged", () => {
    expect(breToJsRegex("a(b|c)+", true)).toBe("a(b|c)+");
  });
  it("escapes unescaped metacharacters in BRE", () => {
    expect(breToJsRegex("a(b|c)+", false)).toBe("a\\(b\\|c\\)\\+");
  });
  it("unescapes \\( \\) in BRE", () => {
    expect(breToJsRegex("a\\(b\\|c\\)\\+", false)).toBe("a(b|c)+");
  });
  it("preserves backreferences", () => {
    expect(breToJsRegex("\\(.*\\)\\1", false)).toBe("(.*)\\1");
  });
});

// ----------------------------------------------------------------------------
// Builder constructors
// ----------------------------------------------------------------------------

describe("sed buildSubstitute", () => {
  it("builds a basic s/// command", () => {
    const cmd = buildSubstitute("foo", "bar", "g");
    expect(cmd.source).toBe("s/foo/bar/g");
    expect(cmd.type).toBe("substitute");
    expect(cmd.delimiter).toBe("/");
  });
  it("switches delimiter when search contains /", () => {
    const cmd = buildSubstitute("/usr/bin", "/opt/bin", "g");
    expect(cmd.source).toBe("s|/usr/bin|/opt/bin|g");
    expect(cmd.delimiter).toBe("|");
  });
  it("escapes delimiter if no safe choice exists", () => {
    const cmd = buildSubstitute("a/b", "c/d", "");
    // Both / is in strings; the picker will choose a non-/ delimiter
    expect(cmd.delimiter).not.toBe("/");
  });
});

describe("sed buildDelete", () => {
  it("builds an unconditional delete", () => {
    const cmd = buildDelete({ type: "none" });
    expect(cmd.source).toBe("d");
  });
  it("builds a regex-addressed delete", () => {
    const cmd = buildDelete({ type: "regex", regex: "404" });
    expect(cmd.source).toBe("/404/d");
  });
  it("builds a line-range delete", () => {
    const cmd = buildDelete({ type: "range", start: { type: "line", line: 2 }, end: { type: "line", line: 4 } });
    expect(cmd.source).toBe("2,4d");
  });
});

describe("sed buildPrint", () => {
  it("builds an unconditional print", () => {
    expect(buildPrint({ type: "none" }).source).toBe("p");
  });
  it("builds a last-line print", () => {
    expect(buildPrint({ type: "last" }).source).toBe("$p");
  });
});

describe("sed buildInsert / buildAppend / buildChange", () => {
  it("buildInsert produces 1i\\text", () => {
    expect(buildInsert({ type: "line", line: 1 }, "hdr").source).toBe("1i\\hdr");
  });
  it("buildAppend produces $a\\text", () => {
    expect(buildAppend({ type: "last" }, "end").source).toBe("$a\\end");
  });
  it("buildChange produces /re/c\\text", () => {
    expect(buildChange({ type: "regex", regex: "500" }, "ERR").source).toBe("/500/c\\ERR");
  });
});

describe("sed buildNext / buildQuit / buildLineNumber", () => {
  it("buildNext", () => { expect(buildNext({ type: "none" }).source).toBe("n"); });
  it("buildQuit", () => { expect(buildQuit({ type: "line", line: 5 }).source).toBe("5q"); });
  it("buildLineNumber", () => { expect(buildLineNumber({ type: "last" }).source).toBe("$="); });
});

// ----------------------------------------------------------------------------
// formatAddress
// ----------------------------------------------------------------------------

describe("sed formatAddress", () => {
  it("returns empty for none", () => {
    expect(formatAddress({ type: "none" })).toBe("");
  });
  it("formats line number", () => {
    expect(formatAddress({ type: "line", line: 3 })).toBe("3");
  });
  it("formats $", () => {
    expect(formatAddress({ type: "last" })).toBe("$");
  });
  it("formats regex", () => {
    expect(formatAddress({ type: "regex", regex: "err" })).toBe("/err/");
  });
  it("formats regex with i flag", () => {
    expect(formatAddress({ type: "regex", regex: "err", caseInsensitive: true })).toBe("/err/i");
  });
  it("formats range", () => {
    const a = formatAddress({ type: "range", start: { type: "line", line: 2 }, end: { type: "line", line: 5 } });
    expect(a).toBe("2,5");
  });
  it("formats mixed range", () => {
    const a = formatAddress({ type: "range", start: { type: "line", line: 1 }, end: { type: "regex", regex: "stop" } });
    expect(a).toBe("1,/stop/");
  });
});

// ----------------------------------------------------------------------------
// parseScript
// ----------------------------------------------------------------------------

describe("sed parseScript", () => {
  it("parses a simple s/// command", () => {
    const cmds = parseScript("s/foo/bar/g", false);
    expect(cmds).toHaveLength(1);
    expect(cmds[0].type).toBe("substitute");
    expect(cmds[0].search).toBe("foo");
    expect(cmds[0].replace).toBe("bar");
    expect(cmds[0].flags).toBe("g");
  });
  it("parses a delete with regex address", () => {
    const cmds = parseScript("/404/d", false);
    expect(cmds).toHaveLength(1);
    expect(cmds[0].type).toBe("delete");
    expect(cmds[0].address.type).toBe("regex");
    expect(cmds[0].address.regex).toBe("404");
  });
  it("parses a range delete", () => {
    const cmds = parseScript("2,4d", false);
    expect(cmds[0].address.type).toBe("range");
    expect(cmds[0].address.start?.type).toBe("line");
    expect(cmds[0].address.end?.line).toBe(4);
  });
  it("parses a print with last-line address", () => {
    const cmds = parseScript("$p", false);
    expect(cmds[0].type).toBe("print");
    expect(cmds[0].address.type).toBe("last");
  });
  it("parses multiple commands separated by ;", () => {
    const cmds = parseScript("s/a/b/; s/c/d/g", false);
    expect(cmds).toHaveLength(2);
  });
  it("parses insert with backslash text", () => {
    const cmds = parseScript("1i\\header line", false);
    expect(cmds[0].type).toBe("insert");
    expect(cmds[0].text).toBe("header line");
  });
  it("throws on unknown command", () => {
    expect(() => parseScript("Z", false)).toThrow();
  });
  it("skips comments", () => {
    const cmds = parseScript("# comment\ns/a/b/", false);
    expect(cmds).toHaveLength(1);
  });
  it("uses alternate delimiter", () => {
    const cmds = parseScript("s|/usr|/opt|g", false);
    expect(cmds[0].delimiter).toBe("|");
    expect(cmds[0].search).toBe("/usr");
  });
});

// ----------------------------------------------------------------------------
// explainCommand / explainConfig
// ----------------------------------------------------------------------------

describe("sed explainCommand", () => {
  it("explains the g flag", () => {
    const cmd = buildSubstitute("foo", "bar", "g");
    const expl = explainCommand(cmd, false);
    expect(expl).toContain("replace ALL");
    expect(expl).toContain("g flag");
  });
  it("explains the i flag", () => {
    const cmd = buildSubstitute("foo", "bar", "gi");
    const expl = explainCommand(cmd, false);
    expect(expl).toMatch(/case-insensitive/i);
  });
  it("explains delete", () => {
    const cmd = buildDelete({ type: "regex", regex: "404" });
    expect(explainCommand(cmd, false)).toContain("Delete");
  });
  it("explains non-default delimiter", () => {
    const cmd = buildSubstitute("/usr", "/opt", "g");
    const expl = explainCommand(cmd, false);
    expect(expl).toContain("delimiter");
  });
  it("mentions backreferences when & is in replacement", () => {
    const cmd = buildSubstitute("foo", "[&]", "g");
    expect(explainCommand(cmd, false)).toContain("&");
  });
});

describe("sed explainConfig", () => {
  it("explains every command in the config", () => {
    const cfg: SedConfig = {
      ...DEFAULT_CONFIG,
      commands: [buildSubstitute("a", "b", "g"), buildDelete({ type: "line", line: 1 })],
    };
    const items = explainConfig(cfg);
    expect(items).toHaveLength(2);
    expect(items[0].command).toBe("s/a/b/g");
    expect(items[1].command).toBe("1d");
  });
});

// ----------------------------------------------------------------------------
// buildScript / buildSedCommand / buildSed
// ----------------------------------------------------------------------------

describe("sed buildScript", () => {
  it("joins commands with ; ", () => {
    const cfg: SedConfig = {
      ...DEFAULT_CONFIG,
      commands: [buildSubstitute("a", "b", ""), buildDelete({ type: "line", line: 1 })],
    };
    expect(buildScript(cfg)).toBe("s/a/b/; 1d");
  });
  it("returns empty for no commands", () => {
    expect(buildScript(DEFAULT_CONFIG)).toBe("");
  });
});

describe("sed buildSedCommand", () => {
  it("includes -n when suppressAutoPrint", () => {
    const cfg: SedConfig = {
      ...DEFAULT_CONFIG,
      suppressAutoPrint: true,
      commands: [buildPrint({ type: "regex", regex: "foo" })],
    };
    expect(buildSedCommand(cfg)).toContain("-n");
  });
  it("includes -E when extendedRegex", () => {
    const cfg: SedConfig = {
      ...DEFAULT_CONFIG,
      extendedRegex: true,
      commands: [buildSubstitute("a", "b", "")],
    };
    expect(buildSedCommand(cfg)).toContain("-E");
  });
  it("includes -i (GNU) when inPlace", () => {
    const cfg: SedConfig = {
      ...DEFAULT_CONFIG,
      inPlace: true,
      gnuMode: true,
      commands: [buildSubstitute("a", "b", "")],
    };
    expect(buildSedCommand(cfg)).toContain("-i ");
  });
  it("includes -i '' (BSD) when inPlace and not gnuMode", () => {
    const cfg: SedConfig = {
      ...DEFAULT_CONFIG,
      inPlace: true,
      gnuMode: false,
      commands: [buildSubstitute("a", "b", "")],
    };
    expect(buildSedCommand(cfg)).toContain("-i ''");
  });
  it("includes -i.bak when suffix set", () => {
    const cfg: SedConfig = {
      ...DEFAULT_CONFIG,
      inPlace: true,
      inPlaceSuffix: ".bak",
      gnuMode: true,
      commands: [buildSubstitute("a", "b", "")],
    };
    expect(buildSedCommand(cfg)).toContain("-i.bak");
  });
});

describe("sed buildSed", () => {
  it("returns script, command, explanations", () => {
    const r = buildSed({
      ...DEFAULT_CONFIG,
      commands: [buildSubstitute("a", "b", "g")],
    });
    expect(r.script).toBe("s/a/b/g");
    expect(r.command).toContain("sed ");
    expect(r.explanations).toHaveLength(1);
  });
});

// ----------------------------------------------------------------------------
// explainProgram (reverse explainer)
// ----------------------------------------------------------------------------

describe("sed explainProgram", () => {
  it("annotates s/// with g flag", () => {
    const ann = explainProgram("s/foo/bar/g");
    const tokens = ann.map((a) => a.token);
    expect(tokens).toContain("s/foo/bar/g");
  });
  it("does not falsely annotate -n (flags are config-level)", () => {
    const ann = explainProgram("s/a/b/");
    expect(ann.some((a) => a.token === "-n")).toBe(false);
  });
  it("annotates backreferences", () => {
    const ann = explainProgram("s/\\(.*\\)/\\1/", false);
    expect(ann.some((a) => a.token === "\\1..\\9")).toBe(true);
  });
  it("annotates & in replacement", () => {
    const ann = explainProgram("s/foo/[&]/");
    expect(ann.some((a) => a.token === "&")).toBe(true);
  });
  it("returns empty for empty input", () => {
    expect(explainProgram("")).toEqual([]);
  });
});

// ----------------------------------------------------------------------------
// expandReplacement
// ----------------------------------------------------------------------------

describe("sed expandReplacement", () => {
  it("expands & to the full match", () => {
    const m = "foo".match(/foo/)!;
    expect(expandReplacement("[&]", m)).toBe("[foo]");
  });
  it("expands \\1 to capture group 1", () => {
    const m = "abc".match(/a(b)c/)!;
    expect(expandReplacement("\\1", m)).toBe("b");
  });
  it("treats \\& as a literal &", () => {
    const m = "foo".match(/foo/)!;
    expect(expandReplacement("\\&", m)).toBe("&");
  });
  it("expands \\n to a newline", () => {
    const m = "foo".match(/foo/)!;
    expect(expandReplacement("a\\nb", m)).toBe("a\nb");
  });
});

// ----------------------------------------------------------------------------
// runSed — the interpreter
// ----------------------------------------------------------------------------

describe("sed runSed basics", () => {
  it("replaces first match only without g", () => {
    const r = runSed("s/foo/bar/", "foo foo foo");
    expect(r.output).toBe("bar foo foo\n");
  });
  it("replaces all matches with g", () => {
    const r = runSed("s/foo/bar/g", "foo foo foo");
    expect(r.output).toBe("bar bar bar\n");
  });
  it("case-insensitive with i flag", () => {
    const r = runSed("s/error/WARN/gi", "Error ERROR error");
    expect(r.output).toBe("WARN WARN WARN\n");
  });
  it("auto-prints unchanged lines", () => {
    const r = runSed("s/foo/bar/", "abc\ndef");
    expect(r.output).toBe("abc\ndef\n");
  });
  it("handles empty input", () => {
    const r = runSed("s/a/b/", "");
    expect(r.output).toBe("");
    expect(r.lineCount).toBe(0);
  });
});

describe("sed runSed addressing", () => {
  it("deletes lines matching regex", () => {
    const r = runSed("/404/d", "200 OK\n404 NF\n500 ERR\n200 OK");
    expect(r.output).toBe("200 OK\n500 ERR\n200 OK\n");
  });
  it("deletes a line range", () => {
    const r = runSed("2,3d", "a\nb\nc\nd");
    expect(r.output).toBe("a\nd\n");
  });
  it("prints only matching lines with -n", () => {
    const r = runSed("/GET/p", "GET /\nPOST /x\nGET /y", { suppressAutoPrint: true });
    expect(r.output).toBe("GET /\nGET /y\n");
  });
  it("prints the last line with -n", () => {
    const r = runSed("$p", "a\nb\nc", { suppressAutoPrint: true });
    expect(r.output).toBe("c\n");
  });
  it("prints a line range with -n", () => {
    const r = runSed("2,3p", "a\nb\nc\nd", { suppressAutoPrint: true });
    expect(r.output).toBe("b\nc\n");
  });
});

describe("sed runSed insert / append / change", () => {
  it("inserts text before line 1", () => {
    const r = runSed("1i\\HEADER", "a\nb");
    expect(r.output).toBe("HEADER\na\nb\n");
  });
  it("appends text after the last line", () => {
    const r = runSed("$a\\FOOTER", "a\nb");
    expect(r.output).toBe("a\nb\nFOOTER\n");
  });
  it("changes a matched line", () => {
    const r = runSed("/500/c\\ERR", "200\n500\n200");
    expect(r.output).toBe("200\nERR\n200\n");
  });
});

describe("sed runSed ERE", () => {
  it("uses unescaped () in ERE", () => {
    const r = runSed("s/^([^,]*),([^,]*)/\\2,\\1/", "alice,30\nbob,25", { extendedRegex: true });
    expect(r.output).toBe("30,alice\n25,bob\n");
  });
  it("BRE treats () as literal", () => {
    const r = runSed("s/(a)/b/", "(a)");
    // In BRE, ( and ) are literal — so the regex matches the string "(a)".
    // Replacing "(a)" with "b" in input "(a)" gives "b".
    expect(r.output).toBe("b\n");
  });
});

describe("sed runSed BRE escapes", () => {
  it("uses \\( \\) for capture in BRE", () => {
    const r = runSed("s/\\(.*\\),\\(.*\\)/\\2,\\1/", "alice,30");
    expect(r.output).toBe("30,alice\n");
  });
});

describe("sed runSed backreference and &", () => {
  it("expands & to full match", () => {
    const r = runSed("s/[0-9]+/[&]/g", "abc 123 def 456", { extendedRegex: true });
    expect(r.output).toBe("abc [123] def [456]\n");
  });
  it("expands \\1 to capture group 1", () => {
    // BRE uses \( \) for grouping and * (not +) for zero-or-more.
    const r = runSed("s/\\([a-z]*\\)\\([0-9]*\\)/\\2\\1/", "abc123");
    expect(r.output).toBe("123abc\n");
  });
});

describe("sed runSed errors", () => {
  it("reports unknown command", () => {
    const r = runSed("Z", "abc");
    expect(r.error).not.toBeNull();
    expect(r.exitStatus).toBe(1);
  });
  it("reports unterminated s command", () => {
    const r = runSed("s/foo", "abc");
    expect(r.error).not.toBeNull();
  });
  it("reports invalid regex", () => {
    const r = runSed("s/[/", "abc");
    // Unterminated — should error
    expect(r.error).not.toBeNull();
  });
});

describe("sed runSedConfig", () => {
  it("runs a config with -n and a print command", () => {
    const cfg: SedConfig = {
      ...DEFAULT_CONFIG,
      suppressAutoPrint: true,
      commands: [buildPrint({ type: "line", line: 2 })],
    };
    const r = runSedConfig(cfg, "a\nb\nc");
    expect(r.output).toBe("b\n");
  });
});

describe("sed validateScript", () => {
  it("returns null for valid script", () => {
    expect(validateScript("s/a/b/g")).toBeNull();
  });
  it("returns message for invalid script", () => {
    expect(validateScript("Z")).not.toBeNull();
  });
});

// ----------------------------------------------------------------------------
// History (localStorage)
// ----------------------------------------------------------------------------

describe("sed history", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, script: "s/a/b/", inputPreview: "abc", command: "sed ..." });
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0].script).toBe("s/a/b/");
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, script: `s/${i}/x/`, inputPreview: "", command: "" });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, script: "x", inputPreview: "", command: "" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ----------------------------------------------------------------------------
// Shareable URL
// ----------------------------------------------------------------------------

describe("sed shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("s/a/b/", "abc", true, false);
    expect(url).toContain("s=");
    expect(url).toContain("i=");
    expect(url).toContain("n=1");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const params = new URLSearchParams();
    params.set("s", "s/a/b/");
    params.set("i", "abc");
    params.set("n", "1");
    params.set("e", "1");
    const parsed = parseShareUrl(params.toString());
    expect(parsed.script).toBe("s/a/b/");
    expect(parsed.input).toBe("abc");
    expect(parsed.nFlag).toBe(true);
    expect(parsed.eFlag).toBe(true);
  });
  it("returns empty params for empty hash", () => {
    expect(parseShareUrl("")).toEqual({ script: "", input: "", nFlag: false, eFlag: false });
  });
});
