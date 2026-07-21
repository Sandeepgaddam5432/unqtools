import { describe, it, expect, beforeEach } from "vitest";
import {
  COMMANDS,
  PLATFORMS,
  PLATFORM_LABELS,
  CATEGORY_LABELS,
  COMMAND_CATEGORIES,
  MAN_BASE_URL,
  CORPUS_SNAPSHOT_DATE,
  getAllCommands,
  getByName,
  filterByCategory,
  filterByPlatform,
  search,
  searchByTask,
  getManUrl,
  getFavorites,
  isFavorite,
  toggleFavorite,
  clearFavorites,
  groupCommands,
  computeStats,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  lookupWithFallback,
  type Platform,
  type CommandCategory,
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

describe("man-page-tldr constants", () => {
  it("bundles 60+ commands", () => {
    expect(COMMANDS.length).toBeGreaterThanOrEqual(60);
  });
  it("includes ls, grep, find, tar, ssh", () => {
    const names = COMMANDS.map((c) => c.name);
    expect(names).toContain("ls");
    expect(names).toContain("grep");
    expect(names).toContain("find");
    expect(names).toContain("tar");
    expect(names).toContain("ssh");
  });
  it("has 5 platforms", () => {
    expect(PLATFORMS).toEqual(["common", "linux", "osx", "windows", "sunos"]);
  });
  it("has labels for every platform and category", () => {
    expect(Object.keys(PLATFORM_LABELS)).toHaveLength(5);
    expect(Object.keys(CATEGORY_LABELS)).toHaveLength(COMMAND_CATEGORIES.length);
  });
  it("exposes a corpus snapshot date", () => {
    expect(CORPUS_SNAPSHOT_DATE).toMatch(/^\d{4}-\d{2}$/);
  });
  it("every command has a name, oneLine, category, examples, seeAlso, keywords", () => {
    for (const c of COMMANDS) {
      expect(c.name.length).toBeGreaterThan(0);
      expect(c.oneLine.length).toBeGreaterThan(0);
      expect(COMMAND_CATEGORIES).toContain(c.category);
      expect(c.examples.length).toBeGreaterThan(0);
      expect(Array.isArray(c.seeAlso)).toBe(true);
      expect(Array.isArray(c.keywords)).toBe(true);
      expect(c.platforms.length).toBeGreaterThan(0);
    }
  });
  it("every command name is unique", () => {
    const names = COMMANDS.map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe("man-page-tldr getByName", () => {
  it("finds by exact name", () => {
    const c = getByName("tar");
    expect(c?.name).toBe("tar");
  });
  it("is case-insensitive and trims", () => {
    const c = getByName("  TAR  ");
    expect(c?.name).toBe("tar");
  });
  it("returns undefined for unknown", () => {
    expect(getByName("nonexistent-cmd-xyz")).toBeUndefined();
  });
});

describe("man-page-tldr filterByCategory", () => {
  it("returns commands for a category", () => {
    const list = filterByCategory("archive");
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((c) => c.category === "archive")).toBe(true);
  });
  it("archive category includes tar", () => {
    const list = filterByCategory("archive");
    expect(list.some((c) => c.name === "tar")).toBe(true);
  });
});

describe("man-page-tldr filterByPlatform", () => {
  it("common returns all commands", () => {
    const list = filterByPlatform("common");
    expect(list.length).toBe(COMMANDS.length);
  });
  it("linux includes linux-only commands like apt and ip", () => {
    const list = filterByPlatform("linux" as Platform);
    const names = list.map((c) => c.name);
    expect(names).toContain("apt");
    expect(names).toContain("ip");
  });
  it("osx includes brew", () => {
    const list = filterByPlatform("osx" as Platform);
    expect(list.some((c) => c.name === "brew")).toBe(true);
  });
});

describe("man-page-tldr search", () => {
  it("empty query returns all (subject to filters)", () => {
    const all = search("");
    expect(all.length).toBe(COMMANDS.length);
  });
  it("exact name returns first", () => {
    const results = search("tar");
    expect(results[0].name).toBe("tar");
  });
  it("partial name matches", () => {
    const results = search("gre");
    expect(results.some((c) => c.name === "grep")).toBe(true);
  });
  it("matches by oneLine description", () => {
    const results = search("archive");
    expect(results.some((c) => c.name === "tar" || c.name === "zip")).toBe(true);
  });
  it("respects limit", () => {
    const results = search("", { limit: 5 });
    expect(results.length).toBe(5);
  });
  it("respects category filter", () => {
    const results = search("", { category: "git" as CommandCategory });
    expect(results.every((c) => c.category === "git")).toBe(true);
  });
  it("respects platform filter", () => {
    const results = search("", { platform: "osx" as Platform });
    // apt is linux-only, should NOT be in osx results
    expect(results.some((c) => c.name === "apt")).toBe(false);
    expect(results.some((c) => c.name === "brew")).toBe(true);
  });
});

describe("man-page-tldr searchByTask", () => {
  it("'compress a folder' returns tar/zip/gzip", () => {
    const results = searchByTask("compress a folder");
    const names = results.map((c) => c.name);
    expect(names).toContain("tar");
    expect(names).toContain("zip");
    expect(names).toContain("gzip");
  });
  it("'find a file' returns find", () => {
    const results = searchByTask("find a file");
    expect(results[0].name).toBe("find");
  });
  it("'download a url' returns curl and wget", () => {
    const results = searchByTask("download a url");
    const names = results.map((c) => c.name);
    expect(names).toContain("curl");
    expect(names).toContain("wget");
  });
  it("empty task returns empty", () => {
    expect(searchByTask("")).toEqual([]);
  });
});

describe("man-page-tldr getManUrl", () => {
  it("builds man1 URL by default", () => {
    const url = getManUrl("ls");
    expect(url).toBe(`${MAN_BASE_URL}/ls.1.html`);
  });
  it("uses man8 for ip", () => {
    const url = getManUrl("ip");
    expect(url).toContain("ip.8.html");
  });
  it("handles empty name", () => {
    expect(getManUrl("")).toBe(MAN_BASE_URL);
  });
});

describe("man-page-tldr favorites", () => {
  it("starts empty", () => {
    expect(getFavorites()).toEqual([]);
    expect(isFavorite("tar")).toBe(false);
  });
  it("toggleFavorite adds and returns next list", () => {
    const next = toggleFavorite("tar");
    expect(next).toContain("tar");
    expect(isFavorite("tar")).toBe(true);
  });
  it("toggleFavorite removes on second call", () => {
    toggleFavorite("tar");
    const next = toggleFavorite("tar");
    expect(next).not.toContain("tar");
    expect(isFavorite("tar")).toBe(false);
  });
  it("clearFavorites resets", () => {
    toggleFavorite("tar");
    clearFavorites();
    expect(getFavorites()).toEqual([]);
  });
});

describe("man-page-tldr groupCommands / computeStats", () => {
  it("groupCommands groups by category, skipping empty groups", () => {
    const groups = groupCommands(filterByCategory("archive"));
    expect(groups).toHaveLength(1);
    expect(groups[0].category).toBe("archive");
  });
  it("computeStats reports totals", () => {
    const stats = computeStats();
    expect(stats.totalCommands).toBe(COMMANDS.length);
    expect(stats.totalExamples).toBeGreaterThan(0);
    expect(Object.keys(stats.byCategory)).toHaveLength(COMMAND_CATEGORIES.length);
  });
});

describe("man-page-tldr history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, command: "tar" });
    expect(loadHistory()).toHaveLength(1);
  });
  it("dedupes by command name (most recent wins)", () => {
    saveHistory({ ts: 1, command: "tar" });
    saveHistory({ ts: 2, command: "grep" });
    saveHistory({ ts: 3, command: "tar" });
    const h = loadHistory();
    expect(h).toHaveLength(2);
    expect(h[0].command).toBe("tar");
    expect(h[0].ts).toBe(3);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, command: `cmd${i}` });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, command: "x" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("man-page-tldr shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("tar");
    expect(url).toContain("cmd=tar");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back to command name", () => {
    const parsed = parseShareUrl("cmd=tar");
    expect(parsed.commandName).toBe("tar");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({ commandName: "" });
  });
  it("lowercases and trims the command name", () => {
    const url = buildShareUrl("  TAR  ");
    expect(url).toContain("cmd=tar");
  });
});

describe("man-page-tldr lookupWithFallback", () => {
  it("returns found command for known name", () => {
    const r = lookupWithFallback("tar");
    expect(r.found).toBe(true);
    expect(r.command?.name).toBe("tar");
    expect(r.manUrl).toContain("tar.1.html");
  });
  it("returns manUrl and note for unknown name", () => {
    const r = lookupWithFallback("nonexistent-xyz");
    expect(r.found).toBe(false);
    expect(r.command).toBeUndefined();
    expect(r.manUrl).toContain("nonexistent-xyz.1.html");
    expect(r.note).toContain("No bundled TLDR");
  });
});
