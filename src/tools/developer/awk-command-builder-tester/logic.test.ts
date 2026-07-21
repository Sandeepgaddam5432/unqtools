import { describe, it, expect, beforeEach } from "vitest";
import {
  SAMPLE_DATA,
  FS_PRESETS,
  RECIPE_LIBRARY,
  DEFAULT_CONFIG,
  normalizeInput,
  decodeEscapes,
  shellQuote,
  buildAwkProgram,
  buildAwkCommand,
  explainConfig,
  buildAwk,
  presetPrintColumns,
  presetFilter,
  presetAggregate,
  explainProgram,
  tokenize,
  awkSprintf,
  runAwk,
  validateProgram,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type AwkConfig,
  type AwkVariable,
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

describe("awk constants", () => {
  it("has 5 sample datasets", () => {
    expect(SAMPLE_DATA).toHaveLength(5);
    expect(SAMPLE_DATA.some((d) => d.label === "CSV sales")).toBe(true);
  });
  it("has 8+ FS presets", () => {
    expect(FS_PRESETS.length).toBeGreaterThanOrEqual(8);
  });
  it("has 10 recipes", () => {
    expect(RECIPE_LIBRARY).toHaveLength(10);
    expect(RECIPE_LIBRARY[0].label).toBe("Print first column");
  });
  it("default config has CSV FS and a print action", () => {
    expect(DEFAULT_CONFIG.fieldSeparator).toBe(",");
    expect(DEFAULT_CONFIG.action).toContain("print");
  });
});

// ----------------------------------------------------------------------------
// normalizeInput / decodeEscapes
// ----------------------------------------------------------------------------

describe("awk normalizeInput", () => {
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

describe("awk decodeEscapes", () => {
  it("decodes \\t", () => {
    expect(decodeEscapes("\\t")).toBe("\t");
  });
  it("decodes \\n", () => {
    expect(decodeEscapes("\\n")).toBe("\n");
  });
  it("decodes \\\\", () => {
    expect(decodeEscapes("\\\\")).toBe("\\");
  });
});

// ----------------------------------------------------------------------------
// shellQuote
// ----------------------------------------------------------------------------

describe("awk shellQuote", () => {
  it("wraps a plain string in single quotes", () => {
    expect(shellQuote("hello")).toBe("'hello'");
  });
  it("returns '' for empty string", () => {
    expect(shellQuote("")).toBe("''");
  });
  it("escapes embedded single quotes", () => {
    expect(shellQuote("it's")).toBe("'it'\\''s'");
  });
});

// ----------------------------------------------------------------------------
// buildAwkProgram / buildAwkCommand
// ----------------------------------------------------------------------------

describe("awk buildAwkProgram", () => {
  it("emits BEGIN block", () => {
    const cfg: AwkConfig = { ...DEFAULT_CONFIG, action: "", beginBlock: "print \"hi\"" };
    const prog = buildAwkProgram(cfg);
    expect(prog).toContain("BEGIN { print \"hi\" }");
  });
  it("emits END block", () => {
    const cfg: AwkConfig = { ...DEFAULT_CONFIG, action: "", endBlock: "print NR" };
    const prog = buildAwkProgram(cfg);
    expect(prog).toContain("END { print NR }");
  });
  it("emits main rule with pattern + action", () => {
    const cfg: AwkConfig = { ...DEFAULT_CONFIG, pattern: "$2 > 5", action: "print $1" };
    const prog = buildAwkProgram(cfg);
    expect(prog).toContain("$2 > 5 { print $1 }");
  });
  it("emits default print when pattern without action", () => {
    const cfg: AwkConfig = { ...DEFAULT_CONFIG, pattern: "/err/", action: "" };
    const prog = buildAwkProgram(cfg);
    expect(prog).toContain("/err/");
    expect(prog).toContain("{ print }");
  });
  it("combines BEGIN + main + END in order", () => {
    const cfg: AwkConfig = {
      ...DEFAULT_CONFIG,
      beginBlock: "FS=\",\"",
      pattern: "",
      action: "print $1",
      endBlock: "print NR",
    };
    const prog = buildAwkProgram(cfg);
    const beginIdx = prog.indexOf("BEGIN");
    const mainIdx = prog.indexOf("{ print $1 }");
    const endIdx = prog.indexOf("END");
    expect(beginIdx).toBeLessThan(mainIdx);
    expect(mainIdx).toBeLessThan(endIdx);
  });
});

describe("awk buildAwkCommand", () => {
  it("includes -F flag when FS set", () => {
    const cmd = buildAwkCommand({ ...DEFAULT_CONFIG, fieldSeparator: "," });
    expect(cmd).toContain("-F ','");
    expect(cmd).toContain("awk ");
    expect(cmd).toContain(" file");
  });
  it("omits -F when FS is empty (default whitespace)", () => {
    const cmd = buildAwkCommand({ ...DEFAULT_CONFIG, fieldSeparator: "" });
    expect(cmd).not.toContain("-F");
  });
  it("includes -v variables", () => {
    const vars: AwkVariable[] = [{ name: "x", value: "10" }];
    const cmd = buildAwkCommand({ ...DEFAULT_CONFIG, variables: vars });
    expect(cmd).toContain("-v x='10'");
  });
  it("rejects invalid variable names", () => {
    const vars: AwkVariable[] = [{ name: "1bad", value: "x" }];
    const cmd = buildAwkCommand({ ...DEFAULT_CONFIG, variables: vars });
    expect(cmd).not.toContain("1bad");
  });
});

// ----------------------------------------------------------------------------
// explainConfig
// ----------------------------------------------------------------------------

describe("awk explainConfig", () => {
  it("explains -F when FS is set", () => {
    const items = explainConfig({ ...DEFAULT_CONFIG, fieldSeparator: "," });
    expect(items.some((i) => i.option.startsWith("-F"))).toBe(true);
  });
  it("explains default FS when FS is empty", () => {
    const items = explainConfig({ ...DEFAULT_CONFIG, fieldSeparator: "" });
    expect(items.some((i) => i.option === "(default FS)")).toBe(true);
  });
  it("explains OFS when set", () => {
    const items = explainConfig({ ...DEFAULT_CONFIG, outputSeparator: "|" });
    expect(items.some((i) => i.option.startsWith("OFS"))).toBe(true);
  });
  it("explains BEGIN block", () => {
    const items = explainConfig({ ...DEFAULT_CONFIG, beginBlock: "print \"hdr\"" });
    expect(items.some((i) => i.option === "BEGIN { … }")).toBe(true);
  });
  it("explains END block", () => {
    const items = explainConfig({ ...DEFAULT_CONFIG, action: "", endBlock: "print NR" });
    expect(items.some((i) => i.option === "END { … }")).toBe(true);
  });
  it("explains -v variables", () => {
    const items = explainConfig({
      ...DEFAULT_CONFIG,
      variables: [{ name: "v", value: "5" }],
    });
    expect(items.some((i) => i.option.startsWith("-v v="))).toBe(true);
  });
});

describe("awk buildAwk", () => {
  it("returns program, command, explanations", () => {
    const r = buildAwk(DEFAULT_CONFIG);
    expect(typeof r.program).toBe("string");
    expect(typeof r.command).toBe("string");
    expect(Array.isArray(r.explanations)).toBe(true);
    expect(r.explanations.length).toBeGreaterThan(0);
  });
});

// ----------------------------------------------------------------------------
// Builder presets
// ----------------------------------------------------------------------------

describe("awk presetPrintColumns", () => {
  it("prints the chosen columns", () => {
    const cfg = presetPrintColumns([1, 3], ",");
    expect(cfg.action).toBe("print $1, $3");
    expect(cfg.fieldSeparator).toBe(",");
  });
  it("ignores non-positive columns", () => {
    const cfg = presetPrintColumns([0, 2]);
    expect(cfg.action).toBe("print $2");
  });
});

describe("awk presetFilter", () => {
  it("generates a numeric comparison", () => {
    const cfg = presetFilter(2, ">", 100, ",");
    expect(cfg.pattern).toBe("$2 > 100");
  });
  it("generates a string comparison for non-numeric", () => {
    const cfg = presetFilter(1, "==", "alice");
    expect(cfg.pattern).toContain('"alice"');
  });
});

describe("awk presetAggregate", () => {
  it("sums a column", () => {
    const cfg = presetAggregate("sum", 2, ",");
    expect(cfg.action).toBe("s += $2");
    expect(cfg.endBlock).toBe("print s");
  });
  it("averages a column with printf", () => {
    const cfg = presetAggregate("avg", 2);
    expect(cfg.action).toContain("s += $2");
    expect(cfg.endBlock).toContain("printf");
    expect(cfg.endBlock).toContain("s/NR");
  });
  it("counts records in END", () => {
    const cfg = presetAggregate("count", 1);
    expect(cfg.endBlock).toBe("print NR");
  });
});

// ----------------------------------------------------------------------------
// Reverse program explainer
// ----------------------------------------------------------------------------

describe("awk explainProgram", () => {
  it("annotates $1 and $2", () => {
    const ann = explainProgram("{ print $1, $2 }");
    const tokens = ann.map((a) => a.token);
    expect(tokens).toContain("$1");
    expect(tokens).toContain("$2");
  });
  it("annotates NR and NF", () => {
    const ann = explainProgram("END { print NR, NF }");
    const tokens = ann.map((a) => a.token);
    expect(tokens).toContain("NR");
    expect(tokens).toContain("NF");
  });
  it("annotates BEGIN and END blocks", () => {
    const ann = explainProgram("BEGIN { x=0 } END { print x }");
    const tokens = ann.map((a) => a.token);
    expect(tokens).toContain("BEGIN { … }");
    expect(tokens).toContain("END { … }");
  });
  it("annotates built-in functions", () => {
    const ann = explainProgram("{ print tolower($1), length($0) }");
    const tokens = ann.map((a) => a.token);
    expect(tokens.some((t) => t.startsWith("tolower"))).toBe(true);
    expect(tokens.some((t) => t.startsWith("length"))).toBe(true);
  });
  it("returns empty for empty input", () => {
    expect(explainProgram("")).toEqual([]);
    expect(explainProgram("   ")).toEqual([]);
  });
});

// ----------------------------------------------------------------------------
// Tokenizer
// ----------------------------------------------------------------------------

describe("awk tokenize", () => {
  it("tokenizes a simple print statement", () => {
    const tokens = tokenize("{ print $1 }");
    const types = tokens.map((t) => t.type);
    expect(types).toContain("OP");
    expect(types).toContain("KEYWORD");
    expect(types).toContain("FIELD");
  });
  it("tokenizes a string literal", () => {
    const tokens = tokenize('BEGIN { x = "hello" }');
    const strs = tokens.filter((t) => t.type === "STRING");
    expect(strs).toHaveLength(1);
    expect(strs[0].value).toBe("hello");
  });
  it("tokenizes a number", () => {
    const tokens = tokenize("{ x = 3.14 }");
    const nums = tokens.filter((t) => t.type === "NUMBER");
    expect(nums).toHaveLength(1);
  });
  it("tokenizes a regex literal in pattern position", () => {
    const tokens = tokenize("/error/ { print }");
    const regs = tokens.filter((t) => t.type === "REGEX");
    expect(regs).toHaveLength(1);
  });
  it("throws on unterminated string", () => {
    expect(() => tokenize('BEGIN { x = "unterminated }')).toThrow();
  });
});

// ----------------------------------------------------------------------------
// awkSprintf
// ----------------------------------------------------------------------------

describe("awk awkSprintf", () => {
  it("formats %d", () => {
    expect(awkSprintf("%d", [42])).toBe("42");
  });
  it("formats %s", () => {
    expect(awkSprintf("%s", ["hi"])).toBe("hi");
  });
  it("formats %f with 6 decimals by default", () => {
    expect(awkSprintf("%f", [3.14159])).toBe("3.141590");
  });
  it("formats %.2f", () => {
    expect(awkSprintf("%.2f", [3.14159])).toBe("3.14");
  });
  it("applies width", () => {
    expect(awkSprintf("%5d", [42])).toBe("   42");
  });
  it("left-justifies with %-", () => {
    expect(awkSprintf("%-5d|", [42])).toBe("42   |");
  });
  it("passes through %%", () => {
    expect(awkSprintf("100%%", [])).toBe("100%");
  });
  it("formats %x", () => {
    expect(awkSprintf("%x", [255])).toBe("ff");
  });
});

// ----------------------------------------------------------------------------
// runAwk — the pure-JS interpreter
// ----------------------------------------------------------------------------

describe("awk runAwk basics", () => {
  it("prints $1 from CSV input", () => {
    const r = runAwk("{ print $1 }", "a,1\nb,2\nc,3", { fs: "," });
    expect(r.error).toBeNull();
    expect(r.output).toBe("a\nb\nc\n");
  });
  it("prints $0 when no args", () => {
    const r = runAwk("{ print }", "hello\nworld", { fs: "" });
    expect(r.output).toBe("hello\nworld\n");
  });
  it("NR counts records", () => {
    const r = runAwk("END { print NR }", "a\nb\nc", { fs: "" });
    expect(r.output).toBe("3\n");
  });
  it("NF counts fields", () => {
    const r = runAwk("{ print NF }", "a b c\nd e", { fs: "" });
    expect(r.output).toBe("3\n2\n");
  });
  it("$NF is the last field", () => {
    const r = runAwk("{ print $NF }", "a:b:c\nd:e", { fs: ":" });
    expect(r.output).toBe("c\ne\n");
  });
});

describe("awk runAwk patterns", () => {
  it("filters by numeric comparison", () => {
    const r = runAwk("$2 > 5 { print $1 }", "a,1\nb,10\nc,3\nd,8", { fs: "," });
    expect(r.output).toBe("b\nd\n");
  });
  it("filters by regex pattern", () => {
    const r = runAwk("/err/ { print }", "info\nerror here\nwarn\nerror 2", { fs: "" });
    expect(r.output).toBe("error here\nerror 2\n");
  });
  it("case-insensitive via tolower", () => {
    const r = runAwk('tolower($0) ~ /error/ { print }', "INFO\nError here\nok", { fs: "" });
    expect(r.output).toBe("Error here\n");
  });
});

describe("awk runAwk BEGIN / END", () => {
  it("BEGIN runs before input", () => {
    const r = runAwk('BEGIN { print "start" } { print }', "a\nb", { fs: "" });
    expect(r.output).toBe("start\na\nb\n");
  });
  it("END runs after input with accumulated sums", () => {
    const r = runAwk("{ s += $1 } END { print s }", "1\n2\n3\n4", { fs: "" });
    expect(r.output).toBe("10\n");
  });
  it("END prints average via printf", () => {
    const r = runAwk("{ s += $2 } END { printf \"%.1f\\n\", s/NR }", "a,10\nb,20\nc,30", { fs: "," });
    expect(r.output).toBe("20.0\n");
  });
});

describe("awk runAwk control flow", () => {
  it("if/else inside action", () => {
    const r = runAwk('{ if ($1 > 5) print "big"; else print "small" }', "1\n10\n3\n8", { fs: "" });
    expect(r.output).toBe("small\nbig\nsmall\nbig\n");
  });
  it("for loop in BEGIN", () => {
    const r = runAwk('BEGIN { for (i=1; i<=3; i++) print i }', "", { fs: "" });
    expect(r.output).toBe("1\n2\n3\n");
  });
  it("while loop in BEGIN", () => {
    const r = runAwk('BEGIN { i=0; while (i<3) { print i; i++ } }', "", { fs: "" });
    expect(r.output).toBe("0\n1\n2\n");
  });
});

describe("awk runAwk functions", () => {
  it("length of a field", () => {
    const r = runAwk("{ print length($1) }", "abc\nde", { fs: "" });
    expect(r.output).toBe("3\n2\n");
  });
  it("tolower / toupper", () => {
    const r = runAwk('{ print tolower($1), toupper($1) }', "AbC", { fs: "" });
    expect(r.output).toBe("abc ABC\n");
  });
  it("substr", () => {
    const r = runAwk('BEGIN { print substr("hello world", 7, 5) }', "", { fs: "" });
    expect(r.output).toBe("world\n");
  });
  it("split", () => {
    const r = runAwk('BEGIN { n = split("a,b,c", arr, ","); print n, arr[2] }', "", { fs: "" });
    expect(r.output).toBe("3 b\n");
  });
});

describe("awk runAwk special separators", () => {
  it("tab FS works", () => {
    const r = runAwk("{ print $2 }", "a\tb\tc\nd\te", { fs: "\\t" });
    expect(r.output).toBe("b\ne\n");
  });
  it("colon FS works (/etc/passwd style)", () => {
    const r = runAwk("{ print $1 }", "root:x:0:0\nubuntu:x:1000:1000", { fs: ":" });
    expect(r.output).toBe("root\nubuntu\n");
  });
  it("regex FS [,:] splits on either", () => {
    const r = runAwk("{ print $2 }", "a,b:c\nd,e", { fs: "[,:]" });
    expect(r.output).toBe("b\ne\n");
  });
});

describe("awk runAwk errors", () => {
  it("reports a parse error", () => {
    const r = runAwk("{ print $1 ", "a,b", { fs: "," });
    expect(r.error).not.toBeNull();
    expect(r.exitStatus).toBe(1);
  });
  it("reports unterminated string", () => {
    const r = runAwk('BEGIN { print "oops }', "", { fs: "" });
    expect(r.error).not.toBeNull();
  });
  it("empty input with END still runs END", () => {
    const r = runAwk("END { print NR }", "", { fs: "" });
    expect(r.output).toBe("0\n");
  });
});

describe("awk validateProgram", () => {
  it("returns null for valid program", () => {
    expect(validateProgram("{ print $1 }")).toBeNull();
  });
  it("returns message for invalid program", () => {
    expect(validateProgram("{ print $1 ")).not.toBeNull();
  });
});

// ----------------------------------------------------------------------------
// History (localStorage)
// ----------------------------------------------------------------------------

describe("awk history", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, program: "{ print }", inputPreview: "abc", command: "awk ..." });
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0].program).toBe("{ print }");
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, program: `{ print ${i} }`, inputPreview: "", command: "" });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, program: "x", inputPreview: "", command: "" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ----------------------------------------------------------------------------
// Shareable URL
// ----------------------------------------------------------------------------

describe("awk shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("{ print $1 }", "a,b", ",");
    expect(url).toContain("p=");
    expect(url).toContain("i=");
    expect(url).toContain("f=");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const params = new URLSearchParams();
    params.set("p", "{ print $1 }");
    params.set("i", "a,b");
    params.set("f", ",");
    const parsed = parseShareUrl(params.toString());
    expect(parsed.program).toBe("{ print $1 }");
    expect(parsed.input).toBe("a,b");
    expect(parsed.fs).toBe(",");
  });
  it("returns empty params for empty hash", () => {
    expect(parseShareUrl("")).toEqual({ program: "", input: "", fs: "" });
  });
});
