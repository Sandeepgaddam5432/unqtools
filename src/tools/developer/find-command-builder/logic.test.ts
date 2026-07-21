import { describe, it, expect, beforeEach } from "vitest";
import {
  DEFAULT_CONFIG,
  PLATFORM_LABELS,
  FILE_TYPE_LABELS,
  SIZE_UNIT_LABELS,
  TIME_KIND_LABELS,
  ACTION_LABELS,
  PRINTF_TOKENS,
  REGEX_TYPES,
  COMMON_RECIPES,
  shellQuote,
  renderPredicate,
  composePredicates,
  renderAction,
  buildFindCommand,
  explainIntent,
  explainOptions,
  describePredicate,
  validateConfig,
  renderRecipesText,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type BuilderConfig,
  type Predicate,
  type Platform,
  type ActionKind,
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

const baseConfig = (): BuilderConfig => ({
  ...DEFAULT_CONFIG,
  predicates: [],
  paths: ["."],
  action: "print",
  noDefaultPrint: true,
});

describe("find-command-builder constants", () => {
  it("has 2 platforms", () => {
    expect(Object.keys(PLATFORM_LABELS)).toHaveLength(2);
  });
  it("has 7 file types", () => {
    expect(Object.keys(FILE_TYPE_LABELS)).toHaveLength(7);
  });
  it("has 4 size units", () => {
    expect(Object.keys(SIZE_UNIT_LABELS)).toHaveLength(4);
  });
  it("has 6 time kinds", () => {
    expect(Object.keys(TIME_KIND_LABELS)).toHaveLength(6);
  });
  it("has 8 actions", () => {
    expect(Object.keys(ACTION_LABELS)).toHaveLength(8);
  });
  it("has printf tokens", () => {
    expect(PRINTF_TOKENS.length).toBeGreaterThanOrEqual(10);
  });
  it("has regex type options", () => {
    expect(REGEX_TYPES.length).toBeGreaterThanOrEqual(7);
  });
  it("has 12 recipes", () => {
    expect(COMMON_RECIPES).toHaveLength(12);
  });
  it("default config has 2 predicates", () => {
    expect(DEFAULT_CONFIG.predicates).toHaveLength(2);
  });
});

describe("find-command-builder shellQuote", () => {
  it("leaves safe strings unquoted", () => {
    expect(shellQuote(".")).toBe(".");
    expect(shellQuote("/tmp/old")).toBe("/tmp/old");
  });
  it("quotes empty string", () => {
    expect(shellQuote("")).toBe("''");
  });
  it("quotes strings with spaces", () => {
    expect(shellQuote("my file.txt")).toBe("'my file.txt'");
  });
  it("escapes embedded single quotes", () => {
    expect(shellQuote("foo'bar")).toBe("'foo'\\''bar'");
  });
});

describe("find-command-builder renderPredicate", () => {
  it("renders name", () => {
    expect(renderPredicate({ id: "1", kind: "name", value: "*.log", op: "and" }, "gnu")).toBe("-name '*.log'");
  });
  it("renders iname case-insensitive", () => {
    expect(renderPredicate({ id: "1", kind: "iname", value: "*.JPG", op: "and" }, "gnu")).toBe("-iname '*.JPG'");
  });
  it("renders type", () => {
    expect(renderPredicate({ id: "1", kind: "type", value: "f", op: "and" }, "gnu")).toBe("-type f");
  });
  it("renders size with +", () => {
    // +100M is shell-safe (only + digits and M) so left unquoted
    expect(renderPredicate({ id: "1", kind: "size", value: "+100M", op: "and" }, "gnu")).toBe("-size +100M");
  });
  it("renders size with space (needs quoting)", () => {
    expect(renderPredicate({ id: "1", kind: "size", value: "+ 100M", op: "and" }, "gnu")).toBe("-size '+ 100M'");
  });
  it("renders time with kind", () => {
    const p: Predicate = { id: "1", kind: "time", value: "-7", extra: "mtime", op: "and" };
    // -7 is shell-safe so unquoted
    expect(renderPredicate(p, "gnu")).toBe("-mtime -7");
  });
  it("renders time stripping duplicate kind prefix", () => {
    const p: Predicate = { id: "1", kind: "time", value: "-mtime -7", extra: "mtime", op: "and" };
    expect(renderPredicate(p, "gnu")).toBe("-mtime -7");
  });
  it("renders newer", () => {
    // ref.txt is shell-safe so unquoted
    expect(renderPredicate({ id: "1", kind: "newer", value: "ref.txt", op: "and" }, "gnu")).toBe("-newer ref.txt");
  });
  it("renders newer with space (quoted)", () => {
    expect(renderPredicate({ id: "1", kind: "newer", value: "my ref.txt", op: "and" }, "gnu")).toBe("-newer 'my ref.txt'");
  });
  it("renders perm", () => {
    // -o+w is shell-safe so unquoted
    expect(renderPredicate({ id: "1", kind: "perm", value: "-o+w", op: "and" }, "gnu")).toBe("-perm -o+w");
  });
  it("renders perm with space (quoted)", () => {
    expect(renderPredicate({ id: "1", kind: "perm", value: "o w", op: "and" }, "gnu")).toBe("-perm 'o w'");
  });
  it("renders user", () => {
    expect(renderPredicate({ id: "1", kind: "user", value: "alice", op: "and" }, "gnu")).toBe("-user alice");
  });
  it("renders group", () => {
    expect(renderPredicate({ id: "1", kind: "group", value: "staff", op: "and" }, "gnu")).toBe("-group staff");
  });
  it("renders empty (no value)", () => {
    expect(renderPredicate({ id: "1", kind: "empty", value: "", op: "and" }, "gnu")).toBe("-empty");
  });
  it("renders regex", () => {
    expect(renderPredicate({ id: "1", kind: "regex", value: ".*\\.py$", op: "and" }, "gnu")).toBe("-regex '.*\\.py$'");
  });
  it("renders depth as empty (handled separately)", () => {
    expect(renderPredicate({ id: "1", kind: "depth", value: "", op: "and" }, "gnu")).toBe("");
  });
});

describe("find-command-builder composePredicates", () => {
  it("empty predicates returns empty expr", () => {
    const r = composePredicates([], "gnu");
    expect(r.expr).toBe("");
  });
  it("single predicate has no parens", () => {
    const r = composePredicates(
      [{ id: "1", kind: "name", value: "*.log", op: "and" }],
      "gnu",
    );
    expect(r.expr).toBe("-name '*.log'");
  });
  it("multiple ANDs have no parens", () => {
    const r = composePredicates(
      [
        { id: "1", kind: "name", value: "*.log", op: "and" },
        { id: "2", kind: "type", value: "f", op: "and" },
      ],
      "gnu",
    );
    expect(r.expr).toBe("-name '*.log' -a -type f");
  });
  it("OR wraps in escaped parens", () => {
    const r = composePredicates(
      [
        { id: "1", kind: "name", value: "*.log", op: "and" },
        { id: "2", kind: "name", value: "*.txt", op: "or" },
      ],
      "gnu",
    );
    expect(r.expr).toBe("\\( -name '*.log' -o -name '*.txt' \\)");
  });
  it("NOT uses -not", () => {
    const r = composePredicates(
      [
        { id: "1", kind: "name", value: "*.log", op: "and" },
        { id: "2", kind: "name", value: "*.gz", op: "not" },
      ],
      "gnu",
    );
    expect(r.expr).toContain("-not");
    expect(r.expr).toContain("\\(");
    expect(r.expr).toContain("\\)");
  });
  it("skips depth predicates", () => {
    const r = composePredicates(
      [
        { id: "1", kind: "depth", value: "", op: "and" },
        { id: "2", kind: "name", value: "*.log", op: "and" },
      ],
      "gnu",
    );
    expect(r.expr).toBe("-name '*.log'");
  });
});

describe("find-command-builder renderAction", () => {
  it("print action with noDefaultPrint returns empty", () => {
    const r = renderAction({ ...baseConfig(), action: "print", noDefaultPrint: true });
    expect(r.expr).toBe("");
    expect(r.destructive).toBe(false);
  });
  it("print action without noDefaultPrint returns -print", () => {
    const r = renderAction({ ...baseConfig(), action: "print", noDefaultPrint: false });
    expect(r.expr).toBe("-print");
  });
  it("print0 action returns -print0", () => {
    const r = renderAction({ ...baseConfig(), action: "print0" });
    expect(r.expr).toBe("-print0");
  });
  it("ls action returns -ls", () => {
    const r = renderAction({ ...baseConfig(), action: "ls" });
    expect(r.expr).toBe("-ls");
  });
  it("printf action returns -printf with format", () => {
    const r = renderAction({ ...baseConfig(), action: "printf", printfFormat: "%p\\n" });
    expect(r.expr).toBe("-printf '%p\\n'");
  });
  it("exec action returns -exec with semicolon", () => {
    const r = renderAction({ ...baseConfig(), action: "exec", execCommand: "grep TODO", execArgs: "{}" });
    expect(r.expr).toBe("-exec grep TODO {} \\;");
  });
  it("execPlus action returns -exec with plus", () => {
    const r = renderAction({ ...baseConfig(), action: "execPlus", execCommand: "wc -l", execArgs: "{}" });
    expect(r.expr).toBe("-exec wc -l {} +");
  });
  it("xargs action returns -print0 | xargs -0", () => {
    const r = renderAction({ ...baseConfig(), action: "xargs", execCommand: "convert -resize 50%" });
    expect(r.expr).toBe("-print0 | xargs -0 convert -resize 50%");
  });
  it("delete action is destructive", () => {
    const r = renderAction({ ...baseConfig(), action: "delete" });
    expect(r.expr).toBe("-delete");
    expect(r.destructive).toBe(true);
  });
  it("exec rm is destructive", () => {
    const r = renderAction({ ...baseConfig(), action: "exec", execCommand: "rm -f", execArgs: "{}" });
    expect(r.destructive).toBe(true);
  });
});

describe("find-command-builder buildFindCommand", () => {
  it("builds minimal find with paths", () => {
    const r = buildFindCommand({ ...baseConfig() });
    expect(r.command).toContain("find");
    expect(r.command).toContain(".");
  });
  it("includes predicates", () => {
    const r = buildFindCommand({
      ...baseConfig(),
      predicates: [{ id: "1", kind: "name", value: "*.log", op: "and" }],
    });
    expect(r.command).toContain("-name '*.log'");
  });
  it("includes maxdepth", () => {
    const r = buildFindCommand({ ...baseConfig(), maxdepth: 3 });
    expect(r.command).toContain("-maxdepth 3");
  });
  it("includes mindepth", () => {
    const r = buildFindCommand({ ...baseConfig(), mindepth: 1 });
    expect(r.command).toContain("-mindepth 1");
  });
  it("includes -L for follow symlinks", () => {
    const r = buildFindCommand({ ...baseConfig(), followSymlinks: true });
    expect(r.command).toContain(" -L");
  });
  it("uses -mount on GNU when mountOnly", () => {
    const r = buildFindCommand({ ...baseConfig(), platform: "gnu", mountOnly: true });
    expect(r.command).toContain("-mount");
  });
  it("uses -xdev on BSD when mountOnly", () => {
    const r = buildFindCommand({ ...baseConfig(), platform: "bsd", mountOnly: true });
    expect(r.command).toContain("-xdev");
  });
  it("uses -E on BSD when useRegexE", () => {
    const r = buildFindCommand({ ...baseConfig(), platform: "bsd", useRegexE: true });
    expect(r.command).toContain(" -E");
  });
  it("uses -regextype on GNU", () => {
    const r = buildFindCommand({ ...baseConfig(), platform: "gnu", regexType: "posix-extended" });
    expect(r.command).toContain("-regextype posix-extended");
  });
  it("adds warning for printf on BSD", () => {
    const r = buildFindCommand({ ...baseConfig(), platform: "bsd", action: "printf", printfFormat: "%p\\n" });
    expect(r.warnings.some((w) => w.includes("GNU-only"))).toBe(true);
  });
  it("adds warning for -regextype on BSD", () => {
    const r = buildFindCommand({ ...baseConfig(), platform: "bsd", regexType: "posix-extended" });
    expect(r.warnings.some((w) => w.includes("GNU-only"))).toBe(true);
  });
  it("marks delete as destructive", () => {
    const r = buildFindCommand({
      ...baseConfig(),
      predicates: [{ id: "1", kind: "type", value: "d", op: "and" }, { id: "2", kind: "empty", value: "", op: "and" }],
      action: "delete",
    });
    expect(r.destructive).toBe(true);
    expect(r.warnings.some((w) => w.includes("Destructive"))).toBe(true);
  });
  it("warns when action with no predicates", () => {
    const r = buildFindCommand({ ...baseConfig(), action: "exec", execCommand: "rm -f", execArgs: "{}" });
    expect(r.warnings.some((w) => w.includes("No predicates"))).toBe(true);
  });
  it("adds default path when none specified", () => {
    const r = buildFindCommand({ ...baseConfig(), paths: [] });
    expect(r.warnings.some((w) => w.includes("No paths"))).toBe(true);
    // Command should start with `find .` when no paths were given
    expect(r.command.startsWith("find .")).toBe(true);
  });
  it("composes exec with action last", () => {
    const r = buildFindCommand({
      ...baseConfig(),
      predicates: [{ id: "1", kind: "name", value: "*.py", op: "and" }],
      action: "exec",
      execCommand: "grep TODO",
      execArgs: "{}",
    });
    // Predicate should come before -exec
    expect(r.command.indexOf("-name '*.py'")).toBeLessThan(r.command.indexOf("-exec"));
  });
});

describe("find-command-builder explainIntent", () => {
  it("describes the command intent", () => {
    const s = explainIntent(DEFAULT_CONFIG);
    expect(s).toContain("Search");
    expect(s).toContain(".log");
    expect(s).toContain("regular file");
  });
  it("mentions delete when action is delete", () => {
    const s = explainIntent({
      ...baseConfig(),
      predicates: [{ id: "1", kind: "type", value: "d", op: "and" }],
      action: "delete",
    });
    expect(s).toContain("DELETE");
  });
  it("mentions depth when set", () => {
    const s = explainIntent({ ...baseConfig(), maxdepth: 2 });
    expect(s).toContain("2 levels deep");
  });
});

describe("find-command-builder describePredicate", () => {
  it("describes name", () => {
    expect(describePredicate({ id: "1", kind: "name", value: "*.log", op: "and" })).toContain("*.log");
  });
  it("describes type", () => {
    expect(describePredicate({ id: "1", kind: "type", value: "d", op: "and" })).toContain("directory");
  });
  it("describes empty", () => {
    expect(describePredicate({ id: "1", kind: "empty", value: "", op: "and" })).toContain("empty");
  });
  it("describes perm", () => {
    expect(describePredicate({ id: "1", kind: "perm", value: "-o+w", op: "and" })).toContain("o+w");
  });
});

describe("find-command-builder explainOptions", () => {
  it("returns option list for default config", () => {
    const opts = explainOptions(DEFAULT_CONFIG);
    expect(opts.length).toBeGreaterThan(0);
  });
  it("includes maxdepth when set", () => {
    const opts = explainOptions({ ...baseConfig(), maxdepth: 5 });
    expect(opts.some((o) => o.option.includes("-maxdepth 5"))).toBe(true);
  });
  it("includes delete warning in explanation", () => {
    const opts = explainOptions({
      ...baseConfig(),
      predicates: [{ id: "1", kind: "type", value: "d", op: "and" }],
      action: "delete",
    });
    expect(opts.some((o) => o.explanation.includes("DESTRUCTIVE"))).toBe(true);
  });
});

describe("find-command-builder validateConfig", () => {
  it("errors on no paths", () => {
    const r = validateConfig({ ...baseConfig(), paths: [] });
    expect(r.errors.some((e) => e.includes("path"))).toBe(true);
  });
  it("errors on exec without command", () => {
    const r = validateConfig({ ...baseConfig(), action: "exec", execCommand: "" });
    expect(r.errors.some((e) => e.includes("command"))).toBe(true);
  });
  it("warns on printf with BSD", () => {
    const r = validateConfig({ ...baseConfig(), platform: "bsd", action: "printf", printfFormat: "%p\\n" });
    expect(r.warnings.some((w) => w.includes("GNU-only"))).toBe(true);
  });
  it("warns on delete with no predicates", () => {
    const r = validateConfig({ ...baseConfig(), action: "delete" });
    expect(r.warnings.some((w) => w.includes("No predicates") || w.includes("dangerous"))).toBe(true);
  });
  it("errors on empty name pattern", () => {
    const r = validateConfig({
      ...baseConfig(),
      predicates: [{ id: "1", kind: "name", value: "", op: "and" }],
    });
    expect(r.errors.some((e) => e.includes("empty"))).toBe(true);
  });
  it("no errors on valid config", () => {
    const r = validateConfig(DEFAULT_CONFIG);
    expect(r.errors).toHaveLength(0);
  });
});

describe("find-command-builder renderRecipesText", () => {
  it("renders all recipes", () => {
    const text = renderRecipesText();
    expect(text).toContain("Find all .log files");
    expect(text.split("\n\n").length).toBeGreaterThanOrEqual(10);
  });
});

describe("find-command-builder history (localStorage)", () => {
  it("loads empty initially", () => { expect(loadHistory()).toEqual([]); });
  it("saves and loads", () => {
    saveHistory({ ts: 1, command: "find . -name '*.log'", platform: "gnu", destructive: false });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, command: `find . -name '${i}'`, platform: "gnu", destructive: false });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, command: "find .", platform: "gnu", destructive: false });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
  it("newest entry first", () => {
    saveHistory({ ts: 1, command: "first", platform: "gnu", destructive: false });
    saveHistory({ ts: 2, command: "second", platform: "gnu", destructive: false });
    expect(loadHistory()[0].command).toBe("second");
  });
});

describe("find-command-builder shareable URL", () => {
  it("builds share URL with config", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      ...baseConfig(),
      platform: "bsd",
      paths: ["/tmp", "/var"],
      maxdepth: 3,
      action: "exec",
      execCommand: "grep TODO",
      predicates: [{ id: "p1", kind: "name", value: "*.py", op: "and" }],
    });
    expect(url).toContain("plat=bsd");
    expect(url).toContain("paths=%2Ftmp%2C%2Fvar");
    expect(url).toContain("maxd=3");
    expect(url).toContain("act=exec");
    expect(url).toContain("cmd=grep+TODO");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const { config } = parseShareUrl("plat=bsd&paths=%2Ftmp&maxd=3&act=delete");
    expect(config.platform).toBe("bsd");
    expect(config.paths).toEqual(["/tmp"]);
    expect(config.maxdepth).toBe(3);
    expect(config.action).toBe("delete");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({ config: {} });
  });
  it("filters invalid platform", () => {
    const { config } = parseShareUrl("plat=invalid");
    expect(config.platform).toBeUndefined();
  });
  it("round-trips predicates", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const cfg: BuilderConfig = {
      ...baseConfig(),
      predicates: [
        { id: "p1", kind: "name", value: "*.py", op: "and" },
        { id: "p2", kind: "type", value: "f", op: "or" },
      ],
    };
    const url = buildShareUrl(cfg);
    const { config: parsed } = parseShareUrl(url.replace(/^[^#]*#/, ""));
    expect(parsed.predicates).toEqual(cfg.predicates);
    (globalThis as Record<string, unknown>).window = origWindow;
  });
});

// Suppress unused-import lint
export type _Unused = BuilderConfig | Predicate | Platform | ActionKind;
