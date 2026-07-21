import { describe, it, expect, beforeEach } from "vitest";
import {
  DEFAULT_CONFIG,
  PRESETS,
  SHEBANGS,
  SHEBANG_LABELS,
  validateConfig,
  escapeSingleQuote,
  escapeDoubleQuote,
  repeat,
  indent,
  wrapText,
  flagVarName,
  posVarName,
  generateHeader,
  generateShebang,
  generateStrictMode,
  generateConstants,
  generateColorHelpers,
  generateLoggingHelpers,
  generateUsage,
  generateTraps,
  generateDependencyCheck,
  generateRootCheck,
  generateOsDetect,
  generateDefaultValues,
  generateArgParser,
  generateRequiredCheck,
  generatePositionalCheck,
  generateMainBody,
  generateScript,
  countLines,
  computeStats,
  getPreset,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type ScriptConfig,
  type Flag,
  type Positional,
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

// ---------------------------------------------------------------------------
// Constants & presets
// ---------------------------------------------------------------------------

describe("bash-script-generator constants", () => {
  it("has 2 shebang options", () => {
    expect(Object.keys(SHEBANGS)).toHaveLength(2);
    expect(SHEBANGS.env).toBe("#!/usr/bin/env bash");
    expect(SHEBANGS.bin).toBe("#!/bin/bash");
  });
  it("has matching labels", () => {
    expect(Object.keys(SHEBANG_LABELS)).toHaveLength(2);
  });
  it("DEFAULT_CONFIG has sensible defaults", () => {
    expect(DEFAULT_CONFIG.shebang).toBe("env");
    expect(DEFAULT_CONFIG.strictMode).toBe(true);
    expect(DEFAULT_CONFIG.traps).toBe(true);
    expect(DEFAULT_CONFIG.logging).toBe(true);
    expect(DEFAULT_CONFIG.flags).toEqual([]);
    expect(DEFAULT_CONFIG.positionals).toEqual([]);
  });
  it("PRESETS has 5 entries", () => {
    expect(PRESETS).toHaveLength(5);
  });
  it("PRESETS cover file-ops, system-info, backup, deployment, monitoring", () => {
    const ids = PRESETS.map((p) => p.id);
    expect(ids).toContain("file-ops");
    expect(ids).toContain("system-info");
    expect(ids).toContain("backup");
    expect(ids).toContain("deployment");
    expect(ids).toContain("monitoring");
  });
  it("getPreset returns matching preset and undefined for unknown", () => {
    expect(getPreset("backup")?.id).toBe("backup");
    expect(getPreset("nope")).toBeUndefined();
  });
  it("each preset config is valid (no errors)", () => {
    for (const p of PRESETS) {
      const v = validateConfig(p.config);
      expect(v.errors, `preset ${p.id} errors: ${v.errors.join("; ")}`).toEqual([]);
    }
  });
});

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

describe("bash-script-generator validateConfig", () => {
  it("flags duplicate short flags as errors", () => {
    const c: ScriptConfig = {
      ...DEFAULT_CONFIG,
      flags: [
        { short: "f", long: "foo", description: "Foo", takesValue: false, required: false },
        { short: "f", long: "bar", description: "Bar", takesValue: false, required: false },
      ],
    };
    expect(validateConfig(c).errors).toContain('Duplicate short flag "f".');
  });
  it("flags duplicate long flags as errors", () => {
    const c: ScriptConfig = {
      ...DEFAULT_CONFIG,
      flags: [
        { short: "a", long: "dup", description: "A", takesValue: false, required: false },
        { short: "b", long: "dup", description: "B", takesValue: false, required: false },
      ],
    };
    expect(validateConfig(c).errors).toContain('Duplicate long flag "dup".');
  });
  it("warns when a flag clashes with auto-added --verbose", () => {
    const c: ScriptConfig = {
      ...DEFAULT_CONFIG,
      verboseQuiet: true,
      flags: [
        { short: "v", long: "verbose", description: "x", takesValue: false, required: false },
      ],
    };
    expect(validateConfig(c).warnings.join(" ")).toMatch(/--verbose/);
  });
  it("flags bad short flag length", () => {
    const c: ScriptConfig = {
      ...DEFAULT_CONFIG,
      flags: [
        { short: "xx", long: "ok", description: "x", takesValue: false, required: false },
      ],
    };
    expect(validateConfig(c).errors.length).toBeGreaterThan(0);
  });
  it("flags duplicate positional", () => {
    const c: ScriptConfig = {
      ...DEFAULT_CONFIG,
      positionals: [
        { name: "file", description: "a", required: true },
        { name: "file", description: "b", required: false },
      ],
    };
    expect(validateConfig(c).errors).toContain('Duplicate positional "file".');
  });
  it("flags bad dependency name", () => {
    const c: ScriptConfig = {
      ...DEFAULT_CONFIG,
      dependencyCheck: ["rm -rf"],
    };
    expect(validateConfig(c).errors.length).toBeGreaterThan(0);
  });
  it("passes for a minimal valid config", () => {
    expect(validateConfig(DEFAULT_CONFIG).errors).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// String helpers
// ---------------------------------------------------------------------------

describe("bash-script-generator string helpers", () => {
  it("escapeSingleQuote wraps and escapes", () => {
    expect(escapeSingleQuote("hello")).toBe("'hello'");
    expect(escapeSingleQuote("it's")).toBe("'it'\\''s'");
  });
  it("escapeDoubleQuote escapes special chars", () => {
    expect(escapeDoubleQuote('a$b"c`\\d')).toBe('a\\$b\\"c\\`\\\\d');
  });
  it("repeat works", () => {
    expect(repeat(" ", 4)).toBe("    ");
    expect(repeat("x", 0)).toBe("");
    expect(repeat("ab", 3)).toBe("ababab");
  });
  it("indent indents non-empty lines and preserves empty lines", () => {
    expect(indent("a\n\nb", 2)).toBe("  a\n\n  b");
  });
  it("wrapText wraps long lines", () => {
    const out = wrapText("alpha beta gamma delta", 10);
    expect(out.length).toBeGreaterThan(1);
    for (const line of out) expect(line.length).toBeLessThanOrEqual(10);
  });
  it("wrapText preserves blank lines", () => {
    const out = wrapText("a\n\nb", 80);
    expect(out).toEqual(["a", "", "b"]);
  });
});

// ---------------------------------------------------------------------------
// Variable name helpers
// ---------------------------------------------------------------------------

describe("bash-script-generator var-name helpers", () => {
  it("flagVarName uppercases and replaces dashes", () => {
    expect(flagVarName("dry-run")).toBe("DRY_RUN");
    expect(flagVarName("output")).toBe("OUTPUT");
  });
  it("posVarName uppercases", () => {
    expect(posVarName("input_file")).toBe("INPUT_FILE");
  });
});

// ---------------------------------------------------------------------------
// Section generators
// ---------------------------------------------------------------------------

describe("bash-script-generator section generators", () => {
  it("generateHeader contains name, description, version", () => {
    const h = generateHeader(DEFAULT_CONFIG);
    expect(h).toContain("my-script");
    expect(h).toContain("A short description");
    expect(h).toContain("Version: 1.0.0");
  });
  it("generateShebang picks env or bin", () => {
    expect(generateShebang({ ...DEFAULT_CONFIG, shebang: "env" })).toBe("#!/usr/bin/env bash");
    expect(generateShebang({ ...DEFAULT_CONFIG, shebang: "bin" })).toBe("#!/bin/bash");
  });
  it("generateStrictMode sets pipefail + IFS", () => {
    const s = generateStrictMode(DEFAULT_CONFIG);
    expect(s).toContain("set -euo pipefail");
    expect(s).toContain("IFS=$'\\n\\t'");
  });
  it("generateConstants emits SCRIPT_NAME + SCRIPT_DESC", () => {
    const s = generateConstants(DEFAULT_CONFIG);
    expect(s).toContain('readonly SCRIPT_NAME="my-script"');
    expect(s).toContain('readonly SCRIPT_VERSION="1.0.0"');
    expect(s).toContain('readonly SCRIPT_DESC="');
  });
  it("generateColorHelpers emits TTY check and color codes", () => {
    const s = generateColorHelpers(DEFAULT_CONFIG);
    expect(s).toContain("[[ -t 2 ]]");
    expect(s).toContain("CLR_RED");
    expect(s).toContain("CLR_RST");
  });
  it("generateLoggingHelpers emits all log levels", () => {
    const s = generateLoggingHelpers(DEFAULT_CONFIG);
    expect(s).toContain("log_info()");
    expect(s).toContain("log_warn()");
    expect(s).toContain("log_error()");
    expect(s).toContain("log_debug()");
    expect(s).toContain("die()");
    expect(s).toContain(">&2");
  });
  it("generateLoggingHelpers emits plain tags when colors off", () => {
    const s = generateLoggingHelpers({ ...DEFAULT_CONFIG, colors: false });
    expect(s).toContain('"[INFO]"');
    expect(s).not.toContain("CLR_BLU");
  });
  it("generateUsage emits -h, --help and declared flags", () => {
    const c: ScriptConfig = {
      ...DEFAULT_CONFIG,
      flags: [
        { short: "f", long: "file", description: "Input file", takesValue: true, required: true },
      ],
      positionals: [{ name: "out", description: "Output", required: false }],
    };
    const u = generateUsage(c);
    expect(u).toContain("-h, --help");
    expect(u).toContain("--file=<value>");
    expect(u).toContain("Input file");
    expect(u).toContain("Output");
    expect(u).toContain("(required)");
  });
  it("generateUsage omits verbose/quiet when verboseQuiet is false", () => {
    const u = generateUsage({ ...DEFAULT_CONFIG, verboseQuiet: false });
    expect(u).not.toContain("--verbose");
  });
  it("generateTraps returns empty when traps disabled", () => {
    expect(generateTraps({ ...DEFAULT_CONFIG, traps: false })).toBe("");
  });
  it("generateTraps emits mktemp + traps when enabled", () => {
    const t = generateTraps(DEFAULT_CONFIG);
    expect(t).toContain("mktemp -d");
    expect(t).toContain("trap 'cleanup' EXIT");
    expect(t).toContain("trap 'cleanup' INT");
    expect(t).toContain("trap 'on_err ${LINENO}' ERR");
  });
  it("generateDependencyCheck returns empty when no deps", () => {
    expect(generateDependencyCheck({ ...DEFAULT_CONFIG, dependencyCheck: [] })).toBe("");
  });
  it("generateDependencyCheck emits command -v guards", () => {
    const d = generateDependencyCheck({ ...DEFAULT_CONFIG, dependencyCheck: ["curl", "jq"] });
    expect(d).toContain('command -v "curl"');
    expect(d).toContain('command -v "jq"');
    expect(d).toContain('Missing required command: curl');
  });
  it("generateRootCheck emits EUID check", () => {
    const r = generateRootCheck(DEFAULT_CONFIG);
    expect(r).toContain("EUID");
    expect(r).toContain("root");
  });
  it("generateOsDetect emits uname + case", () => {
    const o = generateOsDetect(DEFAULT_CONFIG);
    expect(o).toContain("uname -s");
    expect(o).toContain("Linux*");
    expect(o).toContain("Darwin*");
    expect(o).toContain("OS_FAMILY");
  });
  it("generateDefaultValues emits VERBOSE/QUIET/DRY_RUN and flag defaults", () => {
    const c: ScriptConfig = {
      ...DEFAULT_CONFIG,
      verboseQuiet: true,
      dryRun: true,
      flags: [
        { short: "k", long: "keep", description: "Keep", takesValue: true, required: false, default: "7" },
        { short: "v", long: "verbose", description: "V", takesValue: false, required: false },
      ],
    };
    const d = generateDefaultValues(c);
    expect(d).toContain("VERBOSE=0");
    expect(d).toContain("QUIET=0");
    expect(d).toContain("DRY_RUN=0");
    expect(d).toContain('KEEP="7"');
    expect(d).toContain("VERBOSE=0");
  });
  it("generateArgParser emits -h|--help branch and -- terminator", () => {
    const a = generateArgParser(DEFAULT_CONFIG);
    expect(a).toContain("-h|--help)");
    expect(a).toContain("usage; exit 0");
    expect(a).toContain("--)");
    expect(a).toContain("shift; break");
  });
  it("generateArgParser handles value flags with short, long, --long=value, -sVALUE forms", () => {
    const c: ScriptConfig = {
      ...DEFAULT_CONFIG,
      flags: [
        { short: "f", long: "file", description: "F", takesValue: true, required: false },
      ],
    };
    const a = generateArgParser(c);
    expect(a).toContain("-f|--file)");
    expect(a).toContain('FILE="$2"; shift 2');
    expect(a).toContain("-f=*|--file=*)");
    expect(a).toContain('${1#*=}');
    expect(a).toContain("-f*)");
    expect(a).toContain('${1#-f}');
  });
  it("generateArgParser handles long-only value flags", () => {
    const c: ScriptConfig = {
      ...DEFAULT_CONFIG,
      flags: [
        { short: "", long: "input", description: "I", takesValue: true, required: false },
      ],
    };
    const a = generateArgParser(c);
    expect(a).toContain("--input)");
    expect(a).toContain("--input=*)");
    expect(a).not.toContain("-|");
  });
  it("generateArgParser handles boolean flags", () => {
    const c: ScriptConfig = {
      ...DEFAULT_CONFIG,
      flags: [
        { short: "v", long: "verbose", description: "V", takesValue: false, required: false },
      ],
    };
    const a = generateArgParser(c);
    expect(a).toContain("-v|--verbose)");
    expect(a).toContain("VERBOSE=1; shift");
  });
  it("generateRequiredCheck emits validation for required flags", () => {
    const c: ScriptConfig = {
      ...DEFAULT_CONFIG,
      flags: [
        { short: "s", long: "source", description: "S", takesValue: true, required: true },
      ],
    };
    const r = generateRequiredCheck(c);
    expect(r).toContain("SOURCE");
    expect(r).toContain("Missing required flag: --source");
    expect(r).toContain("exit 2");
  });
  it("generateRequiredCheck short-circuits when no required flags", () => {
    const r = generateRequiredCheck(DEFAULT_CONFIG);
    expect(r).toContain("No required flags");
  });
  it("generatePositionalCheck validates required positionals", () => {
    const c: ScriptConfig = {
      ...DEFAULT_CONFIG,
      positionals: [{ name: "input", description: "I", required: true }],
    };
    const p = generatePositionalCheck(c);
    expect(p).toContain('INPUT="${POSITIONAL[0]:-}"');
    expect(p).toContain("Missing required argument: input");
  });
  it("generatePositionalCheck warns on extra positionals", () => {
    const c: ScriptConfig = {
      ...DEFAULT_CONFIG,
      positionals: [{ name: "a", description: "A", required: false }],
    };
    const p = generatePositionalCheck(c);
    expect(p).toContain("${#POSITIONAL[@]}");
    expect(p).toContain("Extra positional arguments ignored");
  });
  it("generatePositionalCheck emits set -- when no positionals declared", () => {
    const p = generatePositionalCheck(DEFAULT_CONFIG);
    expect(p).toContain('set -- "${POSITIONAL[@]}"');
  });
  it("generateMainBody emits main function + main call", () => {
    const m = generateMainBody(DEFAULT_CONFIG);
    expect(m).toContain("main()");
    expect(m).toContain('main "$@"');
    expect(m).toContain("TODO");
  });
  it("generateMainBody emits dry-run block when enabled", () => {
    const m = generateMainBody({ ...DEFAULT_CONFIG, dryRun: true });
    expect(m).toContain("DRY_RUN");
    expect(m).toContain("Dry-run mode");
  });
});

// ---------------------------------------------------------------------------
// Top-level generator
// ---------------------------------------------------------------------------

describe("bash-script-generator generateScript", () => {
  it("emits shebang near top", () => {
    const s = generateScript(DEFAULT_CONFIG);
    // Shebang should appear within the first 12 lines (after header comment).
    expect(s.split("\n").slice(0, 12).join("\n")).toContain("#!/usr/bin/env bash");
  });
  it("includes all enabled sections", () => {
    const s = generateScript(DEFAULT_CONFIG);
    expect(s).toContain("set -euo pipefail");
    expect(s).toContain("readonly SCRIPT_NAME");
    expect(s).toContain("log_info()");
    expect(s).toContain("usage()");
    expect(s).toContain("mktemp -d");
    expect(s).toContain("while [[ $# -gt 0 ]]");
    expect(s).toContain("main()");
    expect(s).toContain("exit 0");
  });
  it("ends with exit 0", () => {
    const s = generateScript(DEFAULT_CONFIG);
    const trimmed = s.trimEnd();
    expect(trimmed.endsWith("exit 0")).toBe(true);
  });
  it("generates valid script for backup preset", () => {
    const preset = getPreset("backup")!;
    const s = generateScript(preset.config);
    expect(s).toContain("--source");
    expect(s).toContain("--output");
    expect(s).toContain("--keep");
    expect(s).toContain("--dry-run");
    expect(s).toContain("command -v \"tar\"");
    expect(s).toContain("command -v \"gzip\"");
  });
  it("generates valid script for monitoring preset", () => {
    const preset = getPreset("monitoring")!;
    const s = generateScript(preset.config);
    expect(s).toContain("--url");
    expect(s).toContain("--interval");
    expect(s).toContain("--retries");
    expect(s).toContain("--webhook");
  });
  it("omits strict mode when disabled", () => {
    const s = generateScript({ ...DEFAULT_CONFIG, strictMode: false });
    expect(s).not.toContain("set -euo pipefail");
  });
  it("omits traps when disabled", () => {
    const s = generateScript({ ...DEFAULT_CONFIG, traps: false });
    expect(s).not.toContain("mktemp -d");
  });
  it("countLines matches split", () => {
    const s = generateScript(DEFAULT_CONFIG);
    expect(countLines(s)).toBe(s.split("\n").length);
    expect(countLines("")).toBe(0);
  });
  it("computeStats sums toggles and counts", () => {
    const c: ScriptConfig = {
      ...DEFAULT_CONFIG,
      flags: [
        { short: "a", long: "alpha", description: "A", takesValue: false, required: false },
      ],
      positionals: [{ name: "p", description: "P", required: true }],
      dependencyCheck: ["curl"],
    };
    const s = computeStats(c);
    expect(s.flagCount).toBe(1);
    expect(s.positionalCount).toBe(1);
    expect(s.dependencyCount).toBe(1);
    expect(s.togglesOn).toBeGreaterThanOrEqual(5);
  });
});

// ---------------------------------------------------------------------------
// History (localStorage) — max 20
// ---------------------------------------------------------------------------

describe("bash-script-generator history", () => {
  it("starts empty", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saveHistory prepends and persists", () => {
    saveHistory({ ts: 1, name: "a", flagCount: 1, positionalCount: 0, lineCount: 50 });
    const h = loadHistory();
    expect(h).toHaveLength(1);
    expect(h[0].name).toBe("a");
  });
  it("caps at 20 entries (newest first)", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, name: `script-${i}`, flagCount: i, positionalCount: 0, lineCount: 50 });
    }
    const h = loadHistory();
    expect(h).toHaveLength(20);
    expect(h[0].name).toBe("script-24");
  });
  it("clearHistory empties the store", () => {
    saveHistory({ ts: 1, name: "a", flagCount: 0, positionalCount: 0, lineCount: 1 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Shareable URL
// ---------------------------------------------------------------------------

describe("bash-script-generator share URL", () => {
  it("buildShareUrl encodes the config in the hash", () => {
    const url = buildShareUrl(DEFAULT_CONFIG);
    // Without window, returns "?c=..."; with window, returns "...#c=...".
    expect(url).toMatch(/[?#]/);
    expect(url).toContain("c=");
  });
  it("parseShareUrl round-trips the config", () => {
    const c: ScriptConfig = {
      ...DEFAULT_CONFIG,
      name: "round-trip",
      description: "test",
      flags: [
        { short: "x", long: "xyz", description: "X", takesValue: true, required: false, default: "abc" },
      ],
    };
    const url = buildShareUrl(c);
    // Extract the encoded part (after ? or #).
    const idx = Math.max(url.indexOf("?"), url.indexOf("#"));
    const hash = idx >= 0 ? url.substring(idx) : "";
    const parsed = parseShareUrl(hash);
    expect(parsed).not.toBeNull();
    expect(parsed!.name).toBe("round-trip");
    expect(parsed!.flags).toHaveLength(1);
    expect(parsed!.flags[0].long).toBe("xyz");
    expect(parsed!.flags[0].default).toBe("abc");
  });
  it("parseShareUrl returns null for empty hash", () => {
    expect(parseShareUrl("")).toBeNull();
    expect(parseShareUrl("#")).toBeNull();
  });
  it("parseShareUrl returns null for malformed JSON", () => {
    expect(parseShareUrl("#c=not-json")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Smoke: 10+ exports available (this test guards the public API surface)
// ---------------------------------------------------------------------------

describe("bash-script-generator public API", () => {
  it("exposes the expected functions and constants", () => {
    // The fact that we imported them all above means they exist; this test
    // just makes that explicit so future refactors don't drop an export.
    expect(typeof generateScript).toBe("function");
    expect(typeof validateConfig).toBe("function");
    expect(typeof generateUsage).toBe("function");
    expect(typeof generateArgParser).toBe("function");
    expect(typeof generateTraps).toBe("function");
    expect(typeof loadHistory).toBe("function");
    expect(typeof saveHistory).toBe("function");
    expect(typeof clearHistory).toBe("function");
    expect(typeof buildShareUrl).toBe("function");
    expect(typeof parseShareUrl).toBe("function");
    expect(Array.isArray(PRESETS)).toBe(true);
    expect(DEFAULT_CONFIG).toBeDefined();
  });
});
