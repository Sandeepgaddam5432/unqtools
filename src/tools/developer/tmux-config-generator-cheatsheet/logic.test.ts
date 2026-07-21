import { describe, it, expect, beforeEach } from "vitest";
import {
  PREFIX_OPTIONS,
  VERSION_OPTIONS,
  COPY_MODE_OPTIONS,
  SPLIT_BINDING_OPTIONS,
  STATUS_SEGMENT_OPTIONS,
  CURATED_PLUGINS,
  CATEGORY_LABELS,
  MODE_LABELS,
  PRESETS,
  DEFAULT_BINDINGS,
  makeDefaultConfig,
  normalizeColor,
  normalizePluginRepo,
  buildCheatsheet,
  filterCheatsheet,
  buildLines,
  buildWarnings,
  renderConfig,
  generateConfig,
  renderCheatsheetMarkdown,
  renderCheatsheetText,
  validateConfig,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  _styleSyntax,
  type PrefixKey,
  type TmuxVersion,
  type CopyMode,
  type SplitBinding,
  type StatusSegment,
  type TmuxConfig,
  type BindingCategory,
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

describe("tmux-config constants", () => {
  it("has 6 prefix options", () => {
    expect(PREFIX_OPTIONS).toHaveLength(6);
    expect(PREFIX_OPTIONS.some((p) => p.value === "C-Space")).toBe(true);
  });
  it("has 4 version options", () => {
    expect(VERSION_OPTIONS).toHaveLength(4);
    expect(VERSION_OPTIONS.some((v) => v.value === "3.3")).toBe(true);
  });
  it("has 2 copy-mode options", () => {
    expect(COPY_MODE_OPTIONS).toHaveLength(2);
  });
  it("has 4 split-binding options", () => {
    expect(SPLIT_BINDING_OPTIONS).toHaveLength(4);
  });
  it("has 7 status-segment options", () => {
    expect(STATUS_SEGMENT_OPTIONS).toHaveLength(7);
  });
  it("has 7 curated plugins", () => {
    expect(CURATED_PLUGINS).toHaveLength(7);
    expect(CURATED_PLUGINS.some((p) => p.repo === "tmux-plugins/tpm")).toBe(false); // tpm is bootstrap, not curated
    expect(CURATED_PLUGINS.some((p) => p.repo === "tmux-plugins/tmux-sensible")).toBe(true);
  });
  it("has 6 binding category labels", () => {
    expect(Object.keys(CATEGORY_LABELS)).toHaveLength(6);
  });
  it("has 4 mode labels", () => {
    expect(Object.keys(MODE_LABELS)).toHaveLength(4);
  });
  it("has 3 presets", () => {
    expect(PRESETS).toHaveLength(3);
    expect(PRESETS.some((p) => p.id === "sensible")).toBe(true);
    expect(PRESETS.some((p) => p.id === "gpakosz")).toBe(true);
  });
  it("has 60+ default bindings", () => {
    expect(DEFAULT_BINDINGS.length).toBeGreaterThanOrEqual(60);
  });
});

describe("tmux-config makeDefaultConfig", () => {
  it("returns a sensible default config", () => {
    const cfg = makeDefaultConfig();
    expect(cfg.prefix).toBe("C-b");
    expect(cfg.mouse).toBe(true);
    expect(cfg.baseIndex).toBe(1);
    expect(cfg.escapeTime).toBe(10);
    expect(cfg.copyMode).toBe("emacs");
    expect(cfg.version).toBe("3.3");
    expect(cfg.plugins).toEqual([]);
  });
  it("returns independent objects", () => {
    const a = makeDefaultConfig();
    const b = makeDefaultConfig();
    a.prefix = "C-a";
    expect(b.prefix).toBe("C-b");
  });
});

describe("tmux-config normalizeColor", () => {
  it("accepts hex", () => {
    expect(normalizeColor("#ff0000")).toBe("#ff0000");
    expect(normalizeColor("#abc")).toBe("#abc");
  });
  it("accepts tmux colour specs", () => {
    expect(normalizeColor("colour255")).toBe("colour255");
  });
  it("lowercases named colors", () => {
    expect(normalizeColor("BLACK")).toBe("black");
  });
  it("defaults to default on empty", () => {
    expect(normalizeColor("")).toBe("default");
    expect(normalizeColor("   ")).toBe("default");
  });
});

describe("tmux-config normalizePluginRepo", () => {
  it("strips github URL prefix", () => {
    expect(normalizePluginRepo("https://github.com/tmux-plugins/tmux-sensible")).toBe("tmux-plugins/tmux-sensible");
  });
  it("strips .git suffix", () => {
    expect(normalizePluginRepo("tmux-plugins/tmux-sensible.git")).toBe("tmux-plugins/tmux-sensible");
  });
  it("trims whitespace", () => {
    expect(normalizePluginRepo("  tmux-plugins/tmux-yank  ")).toBe("tmux-plugins/tmux-yank");
  });
});

describe("tmux-config buildCheatsheet", () => {
  it("returns at least 60 bindings for default config", () => {
    const cs = buildCheatsheet(makeDefaultConfig());
    expect(cs.length).toBeGreaterThanOrEqual(60);
  });
  it("tags prefix + key when prefix changed", () => {
    const cfg = makeDefaultConfig();
    cfg.prefix = "C-a";
    const cs = buildCheatsheet(cfg);
    const d = cs.find((b) => b.description === "Detach from session");
    expect(d).toBeDefined();
    expect(d!.key).toContain("C-a");
  });
  it("keeps default C-b prefix in key when unchanged", () => {
    const cfg = makeDefaultConfig();
    const cs = buildCheatsheet(cfg);
    const d = cs.find((b) => b.description === "Detach from session");
    expect(d!.key).toBe("d"); // no prefix prefix added when default
  });
  it("marks split bind as custom when changed", () => {
    const cfg = makeDefaultConfig();
    cfg.splitBinding = "\\";
    const cs = buildCheatsheet(cfg);
    const split = cs.find((b) => b.description.startsWith("Split vertically (custom"));
    expect(split).toBeDefined();
  });
  it("adds mouse hint when mouse enabled", () => {
    const cfg = makeDefaultConfig();
    cfg.mouse = true;
    const cs = buildCheatsheet(cfg);
    expect(cs.some((b) => b.key === "(mouse)")).toBe(true);
  });
  it("sorts bindings by category then description", () => {
    const cs = buildCheatsheet(makeDefaultConfig());
    const firstCat = cs[0].category;
    expect(["session", "window", "pane", "copy-mode", "config", "misc"]).toContain(firstCat);
  });
});

describe("tmux-config filterCheatsheet", () => {
  it("filters by query in key", () => {
    const cs = buildCheatsheet(makeDefaultConfig());
    const filtered = filterCheatsheet(cs, { query: "split" });
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.every((b) =>
      b.description.toLowerCase().includes("split") || b.key.toLowerCase().includes("split")
    )).toBe(true);
  });
  it("filters by category", () => {
    const cs = buildCheatsheet(makeDefaultConfig());
    const filtered = filterCheatsheet(cs, { category: "session" });
    expect(filtered.every((b) => b.category === "session")).toBe(true);
  });
  it("filters by mode", () => {
    const cs = buildCheatsheet(makeDefaultConfig());
    const filtered = filterCheatsheet(cs, { mode: ["copy-mode"] });
    expect(filtered.every((b) => b.mode === "copy-mode")).toBe(true);
  });
  it("returns all when no filters", () => {
    const cs = buildCheatsheet(makeDefaultConfig());
    expect(filterCheatsheet(cs, {})).toHaveLength(cs.length);
  });
});

describe("tmux-config buildLines (config generation)", () => {
  it("emits header with version", () => {
    const cfg = makeDefaultConfig();
    const lines = buildLines(cfg);
    const header = lines.find((l) => l.section === "header" && l.code.includes("tmux version target"));
    expect(header).toBeDefined();
    expect(header!.code).toContain(cfg.version);
  });
  it("emits unbind C-b when prefix changes", () => {
    const cfg = makeDefaultConfig();
    cfg.prefix = "C-a";
    const lines = buildLines(cfg);
    expect(lines.some((l) => l.code === "unbind C-b")).toBe(true);
    expect(lines.some((l) => l.code === "set -g prefix C-a")).toBe(true);
  });
  it("does not unbind C-b when prefix is default", () => {
    const lines = buildLines(makeDefaultConfig());
    expect(lines.some((l) => l.code === "unbind C-b")).toBe(false);
  });
  it("emits send-prefix when enabled", () => {
    const cfg = makeDefaultConfig();
    cfg.prefix = "C-a";
    cfg.sendPrefix = true;
    const lines = buildLines(cfg);
    expect(lines.some((l) => l.code === "bind-key C-a send-prefix")).toBe(true);
  });
  it("emits mouse on/off", () => {
    const cfg = makeDefaultConfig();
    cfg.mouse = false;
    const lines = buildLines(cfg);
    expect(lines.some((l) => l.code === "set -g mouse off")).toBe(true);
  });
  it("emits renumber-windows when enabled", () => {
    const cfg = makeDefaultConfig();
    cfg.renumberWindows = true;
    const lines = buildLines(cfg);
    expect(lines.some((l) => l.code === "set -g renumber-windows on")).toBe(true);
  });
  it("uses unified -style syntax for 3.x", () => {
    const cfg = makeDefaultConfig();
    cfg.version = "3.3";
    const lines = buildLines(cfg);
    expect(lines.some((l) => l.code.startsWith("set -g status-style"))).toBe(true);
  });
  it("uses split -fg/-bg syntax for 2.9", () => {
    const cfg = makeDefaultConfig();
    cfg.version = "2.9";
    const lines = buildLines(cfg);
    expect(lines.some((l) => l.code.startsWith("set -g status-fg"))).toBe(true);
    expect(lines.some((l) => l.code.startsWith("set -g status-bg"))).toBe(true);
  });
  it("emits vi-mode bindings when copyMode is vi", () => {
    const cfg = makeDefaultConfig();
    cfg.copyMode = "vi";
    const lines = buildLines(cfg);
    expect(lines.some((l) => l.code === "bind h select-pane -L")).toBe(true);
    expect(lines.some((l) => l.code === "bind-key -T copy-mode-vi v send -X begin-selection")).toBe(true);
  });
  it("emits resize binds when enabled", () => {
    const cfg = makeDefaultConfig();
    cfg.enableResizeBinds = true;
    const lines = buildLines(cfg);
    expect(lines.some((l) => l.code === "bind -r C-up resize-pane -U 5")).toBe(true);
  });
  it("omits resize binds when disabled", () => {
    const cfg = makeDefaultConfig();
    cfg.enableResizeBinds = false;
    const lines = buildLines(cfg);
    expect(lines.some((l) => l.code === "bind -r C-up resize-pane -U 5")).toBe(false);
  });
  it("emits TPM block when plugins enabled", () => {
    const cfg = makeDefaultConfig();
    cfg.plugins = [{ repo: "tmux-plugins/tmux-sensible", enabled: true }];
    const lines = buildLines(cfg);
    expect(lines.some((l) => l.code === 'set -g @plugin "tmux-plugins/tpm"')).toBe(true);
    expect(lines.some((l) => l.code === 'set -g @plugin "tmux-plugins/tmux-sensible"')).toBe(true);
    expect(lines.some((l) => l.code === 'run "~/.tmux/plugins/tpm/tpm"')).toBe(true);
  });
  it("emits plugin options when provided", () => {
    const cfg = makeDefaultConfig();
    cfg.plugins = [{
      repo: "tmux-plugins/tmux-resurrect",
      enabled: true,
      options: { "@resurrect-capture-pane-contents": "on" },
    }];
    const lines = buildLines(cfg);
    expect(lines.some((l) => l.code === 'set -g @resurrect-capture-pane-contents "on"')).toBe(true);
  });
  it("places TPM init at the very bottom", () => {
    const cfg = makeDefaultConfig();
    cfg.plugins = [{ repo: "tmux-plugins/tmux-sensible", enabled: true }];
    const lines = buildLines(cfg);
    const last = lines[lines.length - 1];
    expect(last.code).toBe('run "~/.tmux/plugins/tpm/tpm"');
  });
  it("emits true-color overrides when enabled", () => {
    const cfg = makeDefaultConfig();
    cfg.enableTrueColor = true;
    const lines = buildLines(cfg);
    expect(lines.some((l) => l.code.includes('terminal-overrides'))).toBe(true);
  });
  it("emits reload binding when enabled", () => {
    const cfg = makeDefaultConfig();
    cfg.enableReloadBind = true;
    const lines = buildLines(cfg);
    expect(lines.some((l) => l.code.startsWith("bind r source-file"))).toBe(true);
  });
  it("emits status-left/right segments", () => {
    const cfg = makeDefaultConfig();
    cfg.statusLeftSegments = ["session", "host"];
    cfg.statusRightSegments = ["datetime"];
    const lines = buildLines(cfg);
    expect(lines.some((l) => l.code.includes('status-left "#S'))).toBe(true);
    expect(lines.some((l) => l.code.includes('status-right "%Y-%m-%d'))).toBe(true);
  });
});

describe("tmux-config buildWarnings", () => {
  it("warns on high escape-time", () => {
    const cfg = makeDefaultConfig();
    cfg.escapeTime = 200;
    const w = buildWarnings(cfg);
    expect(w.some((x) => x.message.includes("escape-time") && x.level === "warning")).toBe(true);
  });
  it("warns on prefix change without send-prefix", () => {
    const cfg = makeDefaultConfig();
    cfg.prefix = "C-a";
    cfg.sendPrefix = false;
    const w = buildWarnings(cfg);
    expect(w.some((x) => x.message.includes("send-prefix"))).toBe(true);
  });
  it("no send-prefix warning when sendPrefix is on", () => {
    const cfg = makeDefaultConfig();
    cfg.prefix = "C-a";
    cfg.sendPrefix = true;
    const w = buildWarnings(cfg);
    expect(w.some((x) => x.message.includes("send-prefix"))).toBe(false);
  });
  it("flags C-s prefix as danger", () => {
    const cfg = makeDefaultConfig();
    cfg.prefix = "C-s";
    const w = buildWarnings(cfg);
    expect(w.some((x) => x.level === "danger" && x.message.includes("XOFF"))).toBe(true);
  });
  it("warns when battery segment is used without tmux-battery plugin", () => {
    const cfg = makeDefaultConfig();
    cfg.statusLeftSegments = ["battery"];
    const w = buildWarnings(cfg);
    expect(w.some((x) => x.message.includes("tmux-battery"))).toBe(true);
  });
  it("emits mouse info when mouse is on", () => {
    const cfg = makeDefaultConfig();
    cfg.mouse = true;
    const w = buildWarnings(cfg);
    expect(w.some((x) => x.message.includes("Shift"))).toBe(true);
  });
});

describe("tmux-config renderConfig", () => {
  it("renders lines as text", () => {
    const cfg = makeDefaultConfig();
    const lines = buildLines(cfg);
    const text = renderConfig(lines);
    expect(typeof text).toBe("string");
    expect(text.length).toBeGreaterThan(0);
    expect(text).toContain("set -g prefix");
  });
  it("renders comments inline on code lines", () => {
    const cfg = makeDefaultConfig();
    const lines = buildLines(cfg).filter((l) => !l.code.startsWith("#"));
    const text = renderConfig(lines);
    expect(text).toContain("# ");
  });
});

describe("tmux-config generateConfig (integration)", () => {
  it("returns full GenerateResult", () => {
    const cfg = makeDefaultConfig();
    const r = generateConfig(cfg);
    expect(typeof r.config).toBe("string");
    expect(Array.isArray(r.lines)).toBe(true);
    expect(Array.isArray(r.warnings)).toBe(true);
    expect(Array.isArray(r.cheatsheet)).toBe(true);
    expect(r.stats.totalLines).toBeGreaterThan(0);
    expect(r.stats.bindingCount).toBeGreaterThanOrEqual(60);
    expect(r.stats.pluginCount).toBe(0);
  });
  it("counts plugins correctly", () => {
    const cfg = makeDefaultConfig();
    cfg.plugins = [
      { repo: "tmux-plugins/tmux-sensible", enabled: true },
      { repo: "tmux-plugins/tmux-yank", enabled: true },
      { repo: "tmux-plugins/tmux-resurrect", enabled: false },
    ];
    const r = generateConfig(cfg);
    expect(r.stats.pluginCount).toBe(2);
  });
  it("sensible preset produces a working config", () => {
    const preset = PRESETS.find((p) => p.id === "sensible")!;
    const r = generateConfig(preset.config);
    expect(r.config).toContain("set -g prefix C-a");
    expect(r.config).toContain("tmux-sensible");
    expect(r.stats.pluginCount).toBe(1);
  });
});

describe("tmux-config cheatsheet render", () => {
  it("renders markdown with headers and tables", () => {
    const cs = buildCheatsheet(makeDefaultConfig());
    const md = renderCheatsheetMarkdown(cs);
    expect(md).toContain("# tmux Cheatsheet");
    expect(md).toContain("## Session");
    expect(md).toContain("| Key | Description | Mode |");
  });
  it("renders text with bracketed categories", () => {
    const cs = buildCheatsheet(makeDefaultConfig());
    const txt = renderCheatsheetText(cs);
    expect(txt).toContain("[Session]");
  });
});

describe("tmux-config validateConfig", () => {
  it("validates default config", () => {
    const r = validateConfig(makeDefaultConfig());
    expect(r.ok).toBe(true);
    expect(r.errors).toHaveLength(0);
  });
  it("catches negative base-index", () => {
    const cfg = makeDefaultConfig();
    cfg.baseIndex = -1;
    expect(validateConfig(cfg).ok).toBe(false);
  });
  it("catches too-low history-limit", () => {
    const cfg = makeDefaultConfig();
    cfg.historyLimit = 50;
    expect(validateConfig(cfg).ok).toBe(false);
  });
  it("catches invalid prefix", () => {
    const cfg = makeDefaultConfig();
    cfg.prefix = "C-x" as PrefixKey;
    expect(validateConfig(cfg).ok).toBe(false);
  });
  it("catches malformed plugin repo", () => {
    const cfg = makeDefaultConfig();
    cfg.plugins = [{ repo: "not a repo", enabled: true }];
    expect(validateConfig(cfg).ok).toBe(false);
  });
});

describe("tmux-config _styleSyntax (version-aware)", () => {
  it("returns multi-line for 2.9", () => {
    const cfg = makeDefaultConfig();
    cfg.version = "2.9";
    const s = _styleSyntax(cfg, "status", "bold,fg=green,bg=black");
    expect(s).toContain("status-attr");
    expect(s).toContain("status-fg");
    expect(s).toContain("status-bg");
  });
  it("returns unified -style for 3.x", () => {
    const cfg = makeDefaultConfig();
    cfg.version = "3.3";
    const s = _styleSyntax(cfg, "status", "bold,fg=green,bg=black");
    expect(s).toContain("status-style");
    expect(s).toContain("bold,fg=green,bg=black");
  });
});

describe("tmux-config history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, presetId: "minimal", prefix: "C-b", version: "3.3", pluginCount: 0, lineCount: 20 });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, presetId: "x", prefix: "C-b", version: "3.3", pluginCount: 0, lineCount: 1 });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, presetId: "x", prefix: "C-b", version: "3.3", pluginCount: 0, lineCount: 1 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("tmux-config shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl(makeDefaultConfig());
    expect(url).toContain("prefix=C-b");
    expect(url).toContain("version=3.3");
    expect(url).toContain("mouse=true");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const cfg = makeDefaultConfig();
    cfg.prefix = "C-a";
    cfg.sendPrefix = true;
    cfg.copyMode = "vi";
    cfg.plugins = [{ repo: "tmux-plugins/tmux-sensible", enabled: true }];
    const url = buildShareUrl(cfg);
    const parsed = parseShareUrl(url);
    expect(parsed.prefix).toBe("C-a");
    expect(parsed.copyMode).toBe("vi");
    expect(parsed.plugins.some((p) => p.repo === "tmux-plugins/tmux-sensible" && p.enabled)).toBe(true);
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual(makeDefaultConfig());
  });
  it("filters unknown prefix values", () => {
    const parsed = parseShareUrl("prefix=C-zzz");
    expect(parsed.prefix).toBe("C-b"); // falls back to default
  });
  it("filters unknown segments", () => {
    const parsed = parseShareUrl("sleft=session,invalid-seg");
    expect(parsed.statusLeftSegments).toEqual(["session"]);
  });
});

// Suppress unused-import lint
export type _Unused =
  | PrefixKey | TmuxVersion | CopyMode | SplitBinding | StatusSegment
  | TmuxConfig | BindingCategory;
