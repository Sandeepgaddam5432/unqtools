import { describe, it, expect, beforeEach } from "vitest";
import {
  CATEGORY_LABELS,
  MODE_LABELS,
  CATEGORY_ORDER,
  VIM_COMMANDS,
  OPERATORS,
  MOTIONS,
  TEXT_OBJECTS,
  KEYBOARD_MAP,
  COLORSCHEME_OPTIONS,
  MOUSE_OPTIONS,
  normalizeQuery,
  searchCommands,
  intentLookup,
  composeCommand,
  composeAll,
  makeDefaultVimrc,
  buildVimrc,
  renderCheatsheetMarkdown,
  renderCheatsheetText,
  computeStats,
  lookupKey,
  validateVimrc,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type VimCategory,
  type VimMode,
  type Operator,
  type Motion,
  type TextObject,
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

describe("vim-cheatsheet constants", () => {
  it("has 10 category labels", () => {
    expect(Object.keys(CATEGORY_LABELS)).toHaveLength(10);
    expect(CATEGORY_LABELS.movement).toBe("Movement");
    expect(CATEGORY_LABELS.exiting).toBe("Saving & Exiting");
  });
  it("has 5 mode labels", () => {
    expect(Object.keys(MODE_LABELS)).toHaveLength(5);
  });
  it("has 10 categories in order", () => {
    expect(CATEGORY_ORDER).toHaveLength(10);
    expect(CATEGORY_ORDER[0]).toBe("movement");
    expect(CATEGORY_ORDER[CATEGORY_ORDER.length - 1]).toBe("exiting");
  });
  it("has 100+ commands", () => {
    expect(VIM_COMMANDS.length).toBeGreaterThanOrEqual(100);
  });
  it("has commands in every category", () => {
    for (const cat of CATEGORY_ORDER) {
      expect(VIM_COMMANDS.some((c) => c.category === cat)).toBe(true);
    }
  });
  it("has 10 operators", () => {
    expect(OPERATORS).toHaveLength(10);
    expect(OPERATORS.some((o) => o.value === "d")).toBe(true);
    expect(OPERATORS.some((o) => o.value === "c")).toBe(true);
  });
  it("has 20+ motions", () => {
    expect(MOTIONS.length).toBeGreaterThanOrEqual(20);
  });
  it("has 20+ text objects", () => {
    expect(TEXT_OBJECTS.length).toBeGreaterThanOrEqual(20);
    expect(TEXT_OBJECTS.some((t) => t.value === "iw")).toBe(true);
    expect(TEXT_OBJECTS.some((t) => t.value === "i(")).toBe(true);
  });
  it("has 40+ keyboard-map entries", () => {
    expect(KEYBOARD_MAP.length).toBeGreaterThanOrEqual(40);
  });
  it("has colorscheme options", () => {
    expect(COLORSCHEME_OPTIONS.length).toBeGreaterThanOrEqual(15);
    expect(COLORSCHEME_OPTIONS).toContain("default");
    expect(COLORSCHEME_OPTIONS).toContain("desert");
  });
  it("has mouse options", () => {
    expect(MOUSE_OPTIONS).toHaveLength(6);
    expect(MOUSE_OPTIONS.some((m) => m.value === "a")).toBe(true);
    expect(MOUSE_OPTIONS.some((m) => m.value === "")).toBe(true);
  });
});

describe("vim-cheatsheet makeDefaultVimrc", () => {
  it("returns sensible defaults", () => {
    const v = makeDefaultVimrc();
    expect(v.lineNumber).toBe(true);
    expect(v.expandtab).toBe(true);
    expect(v.shiftwidth).toBe(2);
    expect(v.tabstop).toBe(2);
    expect(v.mouse).toBe("a");
    expect(v.colorscheme).toBe("default");
    expect(v.leader).toBe(",");
  });
  it("returns independent objects", () => {
    const a = makeDefaultVimrc();
    const b = makeDefaultVimrc();
    a.shiftwidth = 4;
    expect(b.shiftwidth).toBe(2);
  });
});

describe("vim-cheatsheet normalizeQuery", () => {
  it("lowercases and trims", () => {
    expect(normalizeQuery("  Delete  WORD  ")).toBe("delete word");
  });
  it("handles empty", () => {
    expect(normalizeQuery("")).toBe("");
    expect(normalizeQuery("   ")).toBe("");
  });
});

describe("vim-cheatsheet searchCommands", () => {
  it("returns all when no filters", () => {
    expect(searchCommands({})).toHaveLength(VIM_COMMANDS.length);
  });
  it("filters by query in keys", () => {
    const r = searchCommands({ query: "dd" });
    expect(r.some((c) => c.keys === "dd")).toBe(true);
  });
  it("filters by query in description", () => {
    const r = searchCommands({ query: "yank" });
    expect(r.every((c) =>
      c.description.toLowerCase().includes("yank") ||
      c.keys.toLowerCase().includes("yank")
    )).toBe(true);
    expect(r.length).toBeGreaterThan(0);
  });
  it("filters by category", () => {
    const r = searchCommands({ category: "movement" });
    expect(r.every((c) => c.category === "movement")).toBe(true);
    expect(r.length).toBeGreaterThan(0);
  });
  it("filters by mode", () => {
    const r = searchCommands({ modes: ["insert"] });
    expect(r.every((c) => c.modes.includes("insert"))).toBe(true);
  });
  it("combines category + query", () => {
    const r = searchCommands({ category: "editing", query: "delete" });
    expect(r.every((c) => c.category === "editing")).toBe(true);
    expect(r.length).toBeGreaterThan(0);
  });
  it("matches by example", () => {
    const r = searchCommands({ query: "foo" });
    expect(r.some((c) => c.example?.includes("foo"))).toBe(true);
  });
  it("matches by count", () => {
    const r = searchCommands({ query: "3dd" });
    expect(r.length).toBeGreaterThan(0);
  });
});

describe("vim-cheatsheet intentLookup (reverse lookup)", () => {
  it("finds :wq and ZZ for 'save and quit'", () => {
    const r = intentLookup("save and quit");
    expect(r.length).toBeGreaterThan(0);
    const keys = r.map((m) => m.command.keys);
    expect(keys).toContain(":wq");
    expect(keys).toContain("ZZ");
  });
  it("finds :q! / ZQ for 'force quit'", () => {
    const r = intentLookup("force quit");
    const keys = r.map((m) => m.command.keys);
    expect(keys).toContain(":q!");
    expect(keys).toContain("ZQ");
  });
  it("finds di\" for 'delete inside quotes'", () => {
    const r = intentLookup("delete inside quotes");
    expect(r.length).toBeGreaterThan(0);
    expect(r[0].command.keys).toBe('di"');
  });
  it("finds di( for 'delete inside parens'", () => {
    const r = intentLookup("delete inside parens");
    expect(r[0].command.keys).toBe("di(");
  });
  it("finds cw for 'change word'", () => {
    const r = intentLookup("change word");
    const keys = r.map((m) => m.command.keys);
    expect(keys).toContain("cw");
  });
  it("returns empty for gibberish", () => {
    expect(intentLookup("zzzzz12345")).toEqual([]);
  });
  it("returns empty for empty intent", () => {
    expect(intentLookup("")).toEqual([]);
  });
  it("ranks intent matches highest", () => {
    const r = intentLookup("delete inside quotes");
    expect(r[0].matchedOn).toBe("intent");
    expect(r[0].score).toBeGreaterThanOrEqual(200);
  });
});

describe("vim-cheatsheet composeCommand (grammar)", () => {
  it("composes d + w → dw", () => {
    const c = composeCommand("d", "w");
    expect(c.command).toBe("dw");
    expect(c.description.toLowerCase()).toContain("delete");
    expect(c.description.toLowerCase()).toContain("word");
  });
  it("composes c + iw → ciw (wait — c+iw = ciw)", () => {
    const c = composeCommand("c", "iw");
    expect(c.command).toBe("ciw");
    expect(c.description.toLowerCase()).toContain("change");
    expect(c.description.toLowerCase()).toContain("word");
  });
  it("composes y + $ → y$", () => {
    const c = composeCommand("y", "$");
    expect(c.command).toBe("y$");
    expect(c.description.toLowerCase()).toContain("yank");
  });
  it("applies count prefix", () => {
    const c = composeCommand("d", "w", 3);
    expect(c.command).toBe("3dw");
    expect(c.countExample).toContain("3");
  });
  it("composes gu + iw → guiw (lowercase word)", () => {
    const c = composeCommand("gu", "iw");
    expect(c.command).toBe("guiw");
    expect(c.description.toLowerCase()).toContain("lowercase");
  });
  it("composes gU + i( → gUi(", () => {
    const c = composeCommand("gU", "i(");
    expect(c.command).toBe("gUi(");
    expect(c.description.toLowerCase()).toContain("uppercase");
  });
  it("composes gq + ip → gqip (reformat paragraph)", () => {
    const c = composeCommand("gq", "ip");
    expect(c.command).toBe("gqip");
    expect(c.description.toLowerCase()).toContain("wrap");
  });
});

describe("vim-cheatsheet composeAll", () => {
  it("returns operators × (motions + text-objects) combinations", () => {
    const all = composeAll();
    const expected = OPERATORS.length * (MOTIONS.length + TEXT_OBJECTS.length);
    expect(all).toHaveLength(expected);
  });
  it("contains dw and ciw", () => {
    const all = composeAll();
    expect(all.some((c) => c.command === "dw")).toBe(true);
    expect(all.some((c) => c.command === "ciw")).toBe(true);
  });
});

describe("vim-cheatsheet buildVimrc", () => {
  it("emits at least 10 lines for defaults", () => {
    const r = buildVimrc(makeDefaultVimrc());
    expect(r.lines.length).toBeGreaterThanOrEqual(10);
  });
  it("emits set number when lineNumber is on", () => {
    const r = buildVimrc(makeDefaultVimrc());
    expect(r.lines.some((l) => l.code === "set number")).toBe(true);
  });
  it("omits set number when lineNumber is off", () => {
    const cfg = makeDefaultVimrc();
    cfg.lineNumber = false;
    const r = buildVimrc(cfg);
    expect(r.lines.some((l) => l.code === "set number")).toBe(false);
  });
  it("emits expandtab with warning when off", () => {
    const cfg = makeDefaultVimrc();
    cfg.expandtab = false;
    const r = buildVimrc(cfg);
    expect(r.lines.some((l) => l.code === "set expandtab")).toBe(false);
    expect(r.warnings.some((w) => w.includes("expandtab"))).toBe(true);
  });
  it("emits colorscheme when not default", () => {
    const cfg = makeDefaultVimrc();
    cfg.colorscheme = "desert";
    const r = buildVimrc(cfg);
    expect(r.lines.some((l) => l.code === "colorscheme desert")).toBe(true);
  });
  it("emits leader key mapping", () => {
    const cfg = makeDefaultVimrc();
    cfg.leader = "\\";
    const r = buildVimrc(cfg);
    expect(r.lines.some((l) => l.code === 'let mapleader = "\\"')).toBe(true);
  });
  it("emits jk escape remap when enabled", () => {
    const cfg = makeDefaultVimrc();
    cfg.remapEscape = true;
    const r = buildVimrc(cfg);
    expect(r.lines.some((l) => l.code === "inoremap jk <Esc>")).toBe(true);
  });
  it("emits undofile with undodir setup", () => {
    const cfg = makeDefaultVimrc();
    cfg.undofile = true;
    const r = buildVimrc(cfg);
    expect(r.lines.some((l) => l.code === "set undofile")).toBe(true);
    expect(r.lines.some((l) => l.code === "set undodir=~/.vim/undodir")).toBe(true);
  });
  it("joins lines with comments in text output", () => {
    const r = buildVimrc(makeDefaultVimrc());
    expect(r.text).toContain("\" ");
    expect(r.text).toContain("set number");
  });
  it("warns when shiftwidth differs from tabstop", () => {
    const cfg = makeDefaultVimrc();
    cfg.shiftwidth = 4;
    cfg.tabstop = 2;
    const r = buildVimrc(cfg);
    expect(r.warnings.some((w) => w.includes("shiftwidth"))).toBe(true);
  });
});

describe("vim-cheatsheet renderCheatsheet", () => {
  it("renders markdown with category headers and tables", () => {
    const md = renderCheatsheetMarkdown(VIM_COMMANDS as unknown as Parameters<typeof renderCheatsheetMarkdown>[0]);
    expect(md).toContain("# Vim Cheatsheet");
    expect(md).toContain("## Movement");
    expect(md).toContain("| Keys | Description | Modes | Count |");
  });
  it("renders text with bracketed categories", () => {
    const txt = renderCheatsheetText(VIM_COMMANDS as unknown as Parameters<typeof renderCheatsheetText>[0]);
    expect(txt).toContain("[Movement]");
  });
});

describe("vim-cheatsheet computeStats", () => {
  it("counts total commands", () => {
    const s = computeStats();
    expect(s.total).toBe(VIM_COMMANDS.length);
  });
  it("counts by category", () => {
    const s = computeStats();
    expect(s.byCategory.movement).toBeGreaterThan(0);
    expect(s.byCategory.exiting).toBeGreaterThan(0);
  });
  it("counts by mode", () => {
    const s = computeStats();
    expect(s.byMode.normal).toBeGreaterThan(0);
  });
  it("sum of byCategory equals total", () => {
    const s = computeStats();
    const sum = Object.values(s.byCategory).reduce((a, b) => a + b, 0);
    expect(sum).toBe(s.total);
  });
});

describe("vim-cheatsheet lookupKey", () => {
  it("looks up by lowercase key", () => {
    const e = lookupKey("H");
    expect(e).toBeDefined();
    expect(e!.normal).toBe("left");
  });
  it("looks up by lowercase key (case-insensitive)", () => {
    const e = lookupKey("d");
    expect(e).toBeDefined();
    expect(e!.normal?.toLowerCase()).toContain("delete");
  });
  it("returns undefined for unknown key", () => {
    expect(lookupKey("Z9")).toBeUndefined();
  });
});

describe("vim-cheatsheet validateVimrc", () => {
  it("validates default config", () => {
    const r = validateVimrc(makeDefaultVimrc());
    expect(r.ok).toBe(true);
    expect(r.errors).toHaveLength(0);
  });
  it("catches invalid shiftwidth", () => {
    const cfg = makeDefaultVimrc();
    cfg.shiftwidth = 50;
    expect(validateVimrc(cfg).ok).toBe(false);
  });
  it("catches unknown colorscheme", () => {
    const cfg = makeDefaultVimrc();
    cfg.colorscheme = "nonexistent";
    expect(validateVimrc(cfg).ok).toBe(false);
  });
  it("catches smartcase without ignorecase", () => {
    const cfg = makeDefaultVimrc();
    cfg.ignorecase = false;
    cfg.smartcase = true;
    expect(validateVimrc(cfg).ok).toBe(false);
  });
  it("catches invalid leader", () => {
    const cfg = makeDefaultVimrc();
    cfg.leader = "abc";
    expect(validateVimrc(cfg).ok).toBe(false);
  });
});

describe("vim-cheatsheet history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, action: "search", detail: "delete" });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, action: "search", detail: `q${i}` });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, action: "search", detail: "x" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("vim-cheatsheet shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({ search: "delete", category: "editing" });
    expect(url).toContain("q=delete");
    expect(url).toContain("cat=editing");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("q=yank&cat=search");
    expect(p.search).toBe("yank");
    expect(p.category).toBe("search");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({ search: "", category: "", intent: "" });
  });
  it("filters unknown category", () => {
    const p = parseShareUrl("q=x&cat=unknown-cat");
    expect(p.category).toBe("");
  });
  it("preserves intent param", () => {
    const url = buildShareUrl({ intent: "delete inside quotes" });
    const p = parseShareUrl(url.replace(/^[^#]*#/, ""));
    expect(p.intent).toBe("delete inside quotes");
  });
});

// Suppress unused-import lint
export type _Unused =
  | VimCategory | VimMode | Operator | Motion | TextObject;
