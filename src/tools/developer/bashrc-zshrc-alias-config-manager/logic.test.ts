import { describe, it, expect, beforeEach } from "vitest";
import {
  CATEGORY_LABELS,
  BUILTIN_COMMANDS,
  COMMON_COMMANDS,
  ALIAS_PRESETS,
  makeId,
  normalizeAliasName,
  validateAliasName,
  needsFunction,
  validateAlias,
  detectShadowing,
  parseAliasLine,
  parseExportLine,
  parseExisting,
  quoteAliasCommand,
  quoteExportValue,
  renderAlias,
  renderFunction,
  renderExport,
  renderPath,
  groupByCategory,
  generateAliasesFile,
  generateBashrcSnippet,
  generateZshrcSnippet,
  generateRcBundle,
  dedupeAliases,
  mergeConfigs,
  computeStats,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  applyPreset,
  emptyConfig,
  type AliasConfig,
  type AliasEntry,
  type AliasCategory,
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

function mkAlias(
  name: string,
  command: string,
  category: AliasCategory = "misc",
  shells: ("bash" | "zsh")[] = [],
): AliasEntry {
  return { id: makeId("a"), name, command, category, shells, enabled: true };
}

describe("bashrc-zshrc-alias-config-manager constants", () => {
  it("has 10 category labels", () => {
    expect(Object.keys(CATEGORY_LABELS)).toHaveLength(10);
  });
  it("builtin list contains cd, export, source", () => {
    expect(BUILTIN_COMMANDS.has("cd")).toBe(true);
    expect(BUILTIN_COMMANDS.has("export")).toBe(true);
    expect(BUILTIN_COMMANDS.has("source")).toBe(true);
  });
  it("common commands list contains git, docker, kubectl, vim", () => {
    expect(COMMON_COMMANDS.has("git")).toBe(true);
    expect(COMMON_COMMANDS.has("docker")).toBe(true);
    expect(COMMON_COMMANDS.has("kubectl")).toBe(true);
    expect(COMMON_COMMANDS.has("vim")).toBe(true);
  });
  it("has 9 starter packs (git, docker, kubectl, nav, safety, ls, dev, devops, ds)", () => {
    expect(ALIAS_PRESETS.length).toBeGreaterThanOrEqual(9);
    expect(ALIAS_PRESETS.some((p) => p.id === "git")).toBe(true);
    expect(ALIAS_PRESETS.some((p) => p.id === "docker")).toBe(true);
    expect(ALIAS_PRESETS.some((p) => p.id === "kubectl")).toBe(true);
    expect(ALIAS_PRESETS.some((p) => p.id === "data-science")).toBe(true);
  });
  it("git preset includes gs (git status)", () => {
    const git = ALIAS_PRESETS.find((p) => p.id === "git")!;
    expect(git.aliases.some((a) => a.name === "gs")).toBe(true);
  });
});

describe("bashrc-zshrc-alias-config-manager makeId", () => {
  it("produces unique ids", () => {
    const a = makeId("x");
    const b = makeId("x");
    expect(a).not.toBe(b);
    expect(a.startsWith("x-")).toBe(true);
  });
});

describe("bashrc-zshrc-alias-config-manager normalizeAliasName", () => {
  it("strips invalid chars", () => {
    expect(normalizeAliasName("ls!@#")).toBe("ls");
  });
  it("trims whitespace", () => {
    expect(normalizeAliasName("  gs  ")).toBe("gs");
  });
});

describe("bashrc-zshrc-alias-config-manager validateAliasName", () => {
  it("accepts valid name", () => {
    expect(validateAliasName("gs").ok).toBe(true);
  });
  it("rejects empty", () => {
    expect(validateAliasName("").ok).toBe(false);
  });
  it("rejects starting with digit", () => {
    expect(validateAliasName("1alias").ok).toBe(false);
  });
  it("accepts dash and underscore", () => {
    expect(validateAliasName("git-log").ok).toBe(true);
    expect(validateAliasName("git_log").ok).toBe(true);
  });
});

describe("bashrc-zshrc-alias-config-manager needsFunction", () => {
  it("detects $1", () => {
    expect(needsFunction("echo $1")).toBe(true);
  });
  it("detects $@", () => {
    expect(needsFunction("echo $@")).toBe(true);
  });
  it("detects $#", () => {
    expect(needsFunction("if [ $# -gt 0 ]")).toBe(true);
  });
  it("returns false for plain command", () => {
    expect(needsFunction("git status")).toBe(false);
  });
});

describe("bashrc-zshrc-alias-config-manager validateAlias", () => {
  it("warns when shadowing a builtin", () => {
    const w = validateAlias(mkAlias("cd", "pushd"));
    expect(w.some((x) => x.code === "shadow-builtin")).toBe(true);
  });
  it("warns when shadowing a common command", () => {
    const w = validateAlias(mkAlias("ls", "ls --color=auto"));
    expect(w.some((x) => x.code === "shadow-common")).toBe(true);
  });
  it("suggests function when command uses $1", () => {
    const w = validateAlias(mkAlias("greet", "echo Hello $1"));
    expect(w.some((x) => x.code === "needs-function")).toBe(true);
  });
  it("flags recursive alias", () => {
    const w = validateAlias(mkAlias("ls", "ls -la"));
    expect(w.some((x) => x.code === "recursive")).toBe(true);
  });
  it("errors on empty command", () => {
    const w = validateAlias(mkAlias("gs", ""));
    expect(w.some((x) => x.code === "empty-command" && x.severity === "error")).toBe(true);
  });
  it("no warnings for safe alias", () => {
    const w = validateAlias(mkAlias("gs", "git status"));
    expect(w.length).toBe(0);
  });
});

describe("bashrc-zshrc-alias-config-manager detectShadowing", () => {
  it("finds duplicate alias names", () => {
    const list = [mkAlias("gs", "git status"), mkAlias("gs", "git stash")];
    const dups = detectShadowing(list);
    expect(dups).toEqual([{ name: "gs", count: 2 }]);
  });
  it("returns empty when no duplicates", () => {
    const list = [mkAlias("gs", "git status"), mkAlias("ga", "git add")];
    expect(detectShadowing(list)).toEqual([]);
  });
});

describe("bashrc-zshrc-alias-config-manager parseAliasLine", () => {
  it("parses single-quoted value", () => {
    expect(parseAliasLine("alias gs='git status'")).toEqual({ name: "gs", command: "git status" });
  });
  it("parses double-quoted value (unescapes)", () => {
    expect(parseAliasLine('alias gs="git status"')).toEqual({ name: "gs", command: "git status" });
  });
  it("parses unquoted value", () => {
    expect(parseAliasLine("alias gs=git")).toEqual({ name: "gs", command: "git" });
  });
  it("returns null for non-alias line", () => {
    expect(parseAliasLine("# comment")).toBeNull();
  });
  it("handles value with single quote via escape", () => {
    // alias x='echo it'\''s' — parsed value should preserve escaped quote
    expect(parseAliasLine("alias x='echo it'\\''s'")).toEqual({ name: "x", command: "echo it's" });
  });
});

describe("bashrc-zshrc-alias-config-manager parseExportLine", () => {
  it("parses with export keyword", () => {
    expect(parseExportLine("export EDITOR='vim'")).toEqual({ key: "EDITOR", value: "vim" });
  });
  it("parses without export keyword", () => {
    expect(parseExportLine("EDITOR=vim")).toEqual({ key: "EDITOR", value: "vim" });
  });
  it("parses double-quoted", () => {
    expect(parseExportLine('export PATH="/usr/bin"')).toEqual({ key: "PATH", value: "/usr/bin" });
  });
  it("returns null for non-export line", () => {
    expect(parseExportLine("alias gs='git status'")).toBeNull();
  });
});

describe("bashrc-zshrc-alias-config-manager parseExisting", () => {
  it("parses aliases with comments", () => {
    const content = [
      "# git status shortcut",
      "alias gs='git status'",
      "",
      "alias ga='git add'",
    ].join("\n");
    const cfg = parseExisting(content);
    expect(cfg.aliases).toHaveLength(2);
    expect(cfg.aliases[0].name).toBe("gs");
    expect(cfg.aliases[0].command).toBe("git status");
    expect(cfg.aliases[0].description).toBe("git status shortcut");
  });
  it("parses exports and PATH", () => {
    const content = [
      "export EDITOR='vim'",
      "export PATH=\"/usr/local/bin:$PATH\"",
    ].join("\n");
    const cfg = parseExisting(content);
    expect(cfg.exports).toHaveLength(1);
    expect(cfg.exports[0].key).toBe("EDITOR");
    expect(cfg.paths).toHaveLength(1);
    expect(cfg.paths[0].path).toBe("/usr/local/bin");
    expect(cfg.paths[0].mode).toBe("prepend");
  });
  it("parses one-line function", () => {
    const content = [
      "mkcd() {",
      "  mkdir -p \"$1\" && cd \"$1\"",
      "}",
    ].join("\n");
    const cfg = parseExisting(content);
    expect(cfg.functions).toHaveLength(1);
    expect(cfg.functions[0].name).toBe("mkcd");
    expect(cfg.functions[0].body).toContain("mkdir -p");
  });
});

describe("bashrc-zshrc-alias-config-manager quoteAliasCommand", () => {
  it("uses single quotes when no single quote present", () => {
    expect(quoteAliasCommand("git status")).toBe("'git status'");
  });
  it("escapes single quotes via '\\''", () => {
    expect(quoteAliasCommand("echo it's")).toBe("'echo it'\\''s'");
  });
});

describe("bashrc-zshrc-alias-config-manager quoteExportValue", () => {
  it("uses single quotes when safe", () => {
    expect(quoteExportValue("vim")).toBe("'vim'");
  });
  it("uses double quotes when value has single quote", () => {
    expect(quoteExportValue("it's")).toBe('"it\'s"');
  });
});

describe("bashrc-zshrc-alias-config-manager render functions", () => {
  it("renderAlias includes description comment", () => {
    const out = renderAlias({ id: "x", name: "gs", command: "git status", description: "git status", category: "git", shells: [], enabled: true });
    expect(out).toContain("# git status");
    expect(out).toContain("alias gs='git status'");
  });
  it("renderAlias marks zsh-only", () => {
    const out = renderAlias({ id: "x", name: "gs", command: "git status", category: "git", shells: ["zsh"], enabled: true });
    expect(out).toContain("# zsh-only");
  });
  it("renderFunction emits block", () => {
    const out = renderFunction({ id: "x", name: "mkcd", body: '  mkdir -p "$1" && cd "$1"', description: "mkdir+cd", enabled: true });
    expect(out).toContain("mkcd() {");
    expect(out).toContain("mkdir -p");
    expect(out.trim().endsWith("}")).toBe(true);
  });
  it("renderExport emits export line", () => {
    const out = renderExport({ id: "x", key: "EDITOR", value: "vim", enabled: true });
    expect(out).toBe("export EDITOR='vim'");
  });
  it("renderPath prepend", () => {
    const out = renderPath({ id: "x", path: "/usr/local/bin", mode: "prepend", enabled: true });
    expect(out).toContain('export PATH="/usr/local/bin:$PATH"');
  });
  it("renderPath append", () => {
    const out = renderPath({ id: "x", path: "/usr/local/bin", mode: "append", enabled: true });
    expect(out).toContain('export PATH="$PATH:/usr/local/bin"');
  });
});

describe("bashrc-zshrc-alias-config-manager groupByCategory", () => {
  it("groups aliases", () => {
    const list = [mkAlias("gs", "git status", "git"), mkAlias("d", "docker", "docker")];
    const g = groupByCategory(list);
    expect(g.git).toHaveLength(1);
    expect(g.docker).toHaveLength(1);
    expect(g.misc).toHaveLength(0);
  });
});

describe("bashrc-zshrc-alias-config-manager generateAliasesFile", () => {
  it("includes header and sourcing hint", () => {
    const out = generateAliasesFile(emptyConfig());
    expect(out).toContain(".aliases — generated");
    expect(out).toContain("if [ -f ~/.aliases ]");
  });
  it("emits aliases grouped by category", () => {
    const cfg: AliasConfig = {
      aliases: [mkAlias("gs", "git status", "git")],
      functions: [], exports: [], paths: [],
    };
    const out = generateAliasesFile(cfg);
    expect(out).toContain("# ─ Git");
    expect(out).toContain("alias gs='git status'");
  });
  it("skips disabled entries", () => {
    const cfg: AliasConfig = {
      aliases: [{ ...mkAlias("gs", "git status", "git"), enabled: false }],
      functions: [], exports: [], paths: [],
    };
    const out = generateAliasesFile(cfg);
    expect(out).not.toContain("alias gs=");
  });
  it("emits exports and functions sections", () => {
    const cfg: AliasConfig = {
      aliases: [],
      functions: [{ id: "f1", name: "mkcd", body: '  mkdir -p "$1" && cd "$1"', enabled: true }],
      exports: [{ id: "x1", key: "EDITOR", value: "vim", enabled: true }],
      paths: [],
    };
    const out = generateAliasesFile(cfg);
    expect(out).toContain("export EDITOR='vim'");
    expect(out).toContain("mkcd() {");
  });
});

describe("bashrc-zshrc-alias-config-manager rc snippets", () => {
  it("bashrc snippet sources .aliases with [ -f ]", () => {
    const s = generateBashrcSnippet();
    expect(s).toContain("if [ -f ~/.aliases ]");
    expect(s).toContain(". ~/.aliases");
  });
  it("zshrc snippet sources .aliases with [[ -r ]]", () => {
    const s = generateZshrcSnippet();
    expect(s).toContain("[[ -r ~/.aliases ]]");
    expect(s).toContain("source ~/.aliases");
  });
  it("generateRcBundle returns all three", () => {
    const bundle = generateRcBundle(emptyConfig());
    expect(bundle.aliases).toContain(".aliases");
    expect(bundle.bashrcSnippet).toContain("~/.aliases");
    expect(bundle.zshrcSnippet).toContain("~/.aliases");
  });
});

describe("bashrc-zshrc-alias-config-manager dedupe & merge", () => {
  it("dedupeAliases keeps first by name", () => {
    const list = [mkAlias("gs", "git status"), mkAlias("gs", "git stash")];
    const out = dedupeAliases(list);
    expect(out).toHaveLength(1);
    expect(out[0].command).toBe("git status");
  });
  it("mergeConfigs overrides base with incoming", () => {
    const base: AliasConfig = {
      aliases: [mkAlias("gs", "git status", "git")],
      functions: [], exports: [], paths: [],
    };
    const incoming: AliasConfig = {
      aliases: [mkAlias("gs", "git stash", "git")],
      functions: [], exports: [], paths: [],
    };
    const merged = mergeConfigs(base, incoming);
    expect(merged.aliases).toHaveLength(1);
    expect(merged.aliases[0].command).toBe("git stash");
  });
});

describe("bashrc-zshrc-alias-config-manager computeStats", () => {
  it("counts entries", () => {
    const cfg: AliasConfig = {
      aliases: [mkAlias("gs", "git status", "git"), mkAlias("ls", "ls --color=auto", "ls")],
      functions: [{ id: "f1", name: "mkcd", body: "  :", enabled: true }],
      exports: [{ id: "x1", key: "EDITOR", value: "vim", enabled: true }],
      paths: [{ id: "p1", path: "/x", mode: "prepend", enabled: true }],
    };
    const s = computeStats(cfg);
    expect(s.totalAliases).toBe(2);
    expect(s.totalFunctions).toBe(1);
    expect(s.totalExports).toBe(1);
    expect(s.totalPaths).toBe(1);
    expect(s.byCategory.git).toBe(1);
    expect(s.byCategory.ls).toBe(1);
    // `ls` aliases a common command → warning
    expect(s.warnings).toBeGreaterThanOrEqual(1);
  });
});

describe("bashrc-zshrc-alias-config-manager applyPreset", () => {
  it("adds git preset aliases", () => {
    const cfg = applyPreset(emptyConfig(), "git");
    expect(cfg.aliases.some((a) => a.name === "gs")).toBe(true);
    expect(cfg.aliases.some((a) => a.name === "glog")).toBe(true);
  });
  it("does not double-apply preset", () => {
    let cfg = applyPreset(emptyConfig(), "git");
    const n = cfg.aliases.length;
    cfg = applyPreset(cfg, "git");
    expect(cfg.aliases.length).toBe(n);
  });
  it("adds navigation preset function mkcd", () => {
    const cfg = applyPreset(emptyConfig(), "navigation");
    expect(cfg.functions.some((f) => f.name === "mkcd")).toBe(true);
  });
});

describe("bashrc-zshrc-alias-config-manager history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, totalAliases: 5, totalFunctions: 1, totalExports: 1, totalPaths: 1 });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, totalAliases: 1, totalFunctions: 0, totalExports: 0, totalPaths: 0 });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, totalAliases: 1, totalFunctions: 0, totalExports: 0, totalPaths: 0 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("bashrc-zshrc-alias-config-manager shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const cfg = applyPreset(emptyConfig(), "git");
    const url = buildShareUrl(cfg);
    expect(url).toContain("c=");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("round-trips config through share URL", () => {
    const cfg = applyPreset(emptyConfig(), "git");
    const url = buildShareUrl(cfg);
    const hash = url.includes("#") ? url.slice(url.indexOf("#")) : url;
    const parsed = parseShareUrl(hash);
    expect(parsed.aliases.some((a) => a.name === "gs")).toBe(true);
    expect(parsed.aliases.some((a) => a.name === "glog")).toBe(true);
  });
  it("parses empty hash to empty config", () => {
    const parsed = parseShareUrl("");
    expect(parsed.aliases).toEqual([]);
    expect(parsed.functions).toEqual([]);
  });
  it("returns empty config for invalid base64", () => {
    const parsed = parseShareUrl("c=!!!not-base64!!!");
    expect(parsed.aliases).toEqual([]);
  });
});

// Suppress unused-import lint
export type _Unused = AliasCategory;
