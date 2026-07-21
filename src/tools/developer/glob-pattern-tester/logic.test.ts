import { describe, it, expect, beforeEach } from "vitest";
import {
  FLAVORS,
  DEFAULT_OPTIONS,
  SAMPLE_PATHS,
  PRESET_PATTERNS,
  normalizePath,
  parsePathList,
  globToRegex,
  matchGlob,
  matchPaths,
  matchMultiPatterns,
  explainPattern,
  describeRegex,
  highlightMatch,
  buildTree,
  computeStats,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  makePatternEntry,
  type ConvertOptions,
  type PatternEntry,
  type HistoryEntry,
  type GlobFlavor,
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
// Constants
// ---------------------------------------------------------------------------

describe("glob constants", () => {
  it("has 4 flavors", () => {
    expect(FLAVORS).toHaveLength(4);
    expect(FLAVORS.map((f) => f.id)).toEqual(["shell", "gitignore", "minimatch", "tsconfig"]);
  });
  it("has default options", () => {
    expect(DEFAULT_OPTIONS.flavor).toBe("shell");
    expect(DEFAULT_OPTIONS.caseSensitive).toBe(false);
    expect(DEFAULT_OPTIONS.dot).toBe(false);
    expect(DEFAULT_OPTIONS.globstar).toBe(true);
  });
  it("has 20+ sample paths", () => {
    expect(SAMPLE_PATHS.length).toBeGreaterThanOrEqual(20);
  });
  it("has 6+ preset patterns", () => {
    expect(PRESET_PATTERNS.length).toBeGreaterThanOrEqual(6);
  });
});

// ---------------------------------------------------------------------------
// Path normalization
// ---------------------------------------------------------------------------

describe("glob normalizePath", () => {
  it("converts backslashes to forward slashes", () => {
    expect(normalizePath("src\\utils\\helpers.ts")).toBe("src/utils/helpers.ts");
  });
  it("trims whitespace", () => {
    expect(normalizePath("  src/index.ts  ")).toBe("src/index.ts");
  });
  it("handles empty", () => {
    expect(normalizePath("")).toBe("");
  });
});

describe("glob parsePathList", () => {
  it("parses newline-separated", () => {
    expect(parsePathList("src/a.ts\nsrc/b.ts")).toEqual(["src/a.ts", "src/b.ts"]);
  });
  it("parses comma-separated", () => {
    expect(parsePathList("src/a.ts, src/b.ts")).toEqual(["src/a.ts", "src/b.ts"]);
  });
  it("skips blank entries", () => {
    expect(parsePathList("src/a.ts\n\nsrc/b.ts")).toEqual(["src/a.ts", "src/b.ts"]);
  });
  it("normalizes backslashes", () => {
    expect(parsePathList("src\\a.ts\nsrc/b.ts")).toEqual(["src/a.ts", "src/b.ts"]);
  });
  it("returns empty for empty input", () => {
    expect(parsePathList("")).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// globToRegex
// ---------------------------------------------------------------------------

describe("glob globToRegex — basic", () => {
  it("converts literal pattern", () => {
    const r = globToRegex("README.md", DEFAULT_OPTIONS);
    expect(r.source).toBe("^README\\.md$");
    expect(r.regex.test("README.md")).toBe(true);
    expect(r.regex.test("README.txt")).toBe(false);
  });
  it("escapes regex special chars", () => {
    const r = globToRegex("file.txt", DEFAULT_OPTIONS);
    expect(r.source).toContain("file\\.txt");
  });
  it("anchors with ^ and $", () => {
    const r = globToRegex("*.ts", DEFAULT_OPTIONS);
    expect(r.source.startsWith("^")).toBe(true);
    expect(r.source.endsWith("$")).toBe(true);
  });
});

describe("glob globToRegex — star", () => {
  it("converts * to [^/]*", () => {
    const r = globToRegex("*.ts", DEFAULT_OPTIONS);
    expect(r.source).toContain("[^/]*");
    expect(r.regex.test("foo.ts")).toBe(true);
    expect(r.regex.test("foo.txt")).toBe(false);
    expect(r.regex.test("dir/foo.ts")).toBe(false); // * doesn't cross /
  });
  it("star does not match leading dot when dot=false", () => {
    const r = globToRegex("*.ts", DEFAULT_OPTIONS);
    expect(r.regex.test(".hidden.ts")).toBe(false);
  });
  it("star matches leading dot when dot=true", () => {
    const r = globToRegex("*.ts", { ...DEFAULT_OPTIONS, dot: true });
    expect(r.regex.test(".hidden.ts")).toBe(true);
  });
});

describe("glob globToRegex — globstar", () => {
  it("**/ matches zero or more dirs", () => {
    const r = globToRegex("**/*.ts", DEFAULT_OPTIONS);
    expect(r.regex.test("foo.ts")).toBe(true);
    expect(r.regex.test("dir/foo.ts")).toBe(true);
    expect(r.regex.test("a/b/c/foo.ts")).toBe(true);
  });
  it("** at end matches anything", () => {
    const r = globToRegex("src/**", DEFAULT_OPTIONS);
    expect(r.regex.test("src/foo")).toBe(true);
    expect(r.regex.test("src/a/b/c")).toBe(true);
  });
  it("globstar disabled treats ** as two single stars", () => {
    const r = globToRegex("**/*.ts", { ...DEFAULT_OPTIONS, globstar: false });
    // Without globstar, ** is two single stars — they don't cross /,
    // so the literal / between them requires at least one directory.
    expect(r.regex.test("foo.ts")).toBe(false);       // no / at all
    expect(r.regex.test("dir/foo.ts")).toBe(true);    // exactly one /
    expect(r.regex.test("a/b/c/foo.ts")).toBe(false); // multiple / — not matched
  });
});

describe("glob globToRegex — question", () => {
  it("? matches single char", () => {
    const r = globToRegex("?.ts", DEFAULT_OPTIONS);
    expect(r.regex.test("a.ts")).toBe(true);
    expect(r.regex.test("ab.ts")).toBe(false);
  });
  it("? does not cross /", () => {
    const r = globToRegex("?.ts", DEFAULT_OPTIONS);
    expect(r.regex.test("/.ts")).toBe(false);
  });
});

describe("glob globToRegex — char class", () => {
  it("[abc] matches any of a, b, c", () => {
    const r = globToRegex("[abc].ts", DEFAULT_OPTIONS);
    expect(r.regex.test("a.ts")).toBe(true);
    expect(r.regex.test("b.ts")).toBe(true);
    expect(r.regex.test("c.ts")).toBe(true);
    expect(r.regex.test("d.ts")).toBe(false);
  });
  it("[a-z] matches range", () => {
    const r = globToRegex("[a-z].ts", DEFAULT_OPTIONS);
    expect(r.regex.test("a.ts")).toBe(true);
    expect(r.regex.test("z.ts")).toBe(true);
    expect(r.regex.test("A.ts")).toBe(true); // case-insensitive by default
  });
  it("[!abc] negates", () => {
    const r = globToRegex("[!abc].ts", DEFAULT_OPTIONS);
    expect(r.regex.test("a.ts")).toBe(false);
    expect(r.regex.test("d.ts")).toBe(true);
  });
  it("[^abc] negates (caret style)", () => {
    const r = globToRegex("[^abc].ts", DEFAULT_OPTIONS);
    expect(r.regex.test("a.ts")).toBe(false);
    expect(r.regex.test("d.ts")).toBe(true);
  });
});

describe("glob globToRegex — brace", () => {
  it("{a,b,c} matches alternatives", () => {
    const r = globToRegex("*.{ts,tsx,js}", DEFAULT_OPTIONS);
    expect(r.regex.test("foo.ts")).toBe(true);
    expect(r.regex.test("foo.tsx")).toBe(true);
    expect(r.regex.test("foo.js")).toBe(true);
    expect(r.regex.test("foo.json")).toBe(false);
  });
  it("brace with longer alternatives", () => {
    const r = globToRegex("{readme,license}.md", DEFAULT_OPTIONS);
    expect(r.regex.test("readme.md")).toBe(true);
    expect(r.regex.test("license.md")).toBe(true);
    expect(r.regex.test("foo.md")).toBe(false);
  });
});

describe("glob globToRegex — case sensitivity", () => {
  it("case-insensitive by default", () => {
    const r = globToRegex("*.ts", DEFAULT_OPTIONS);
    expect(r.regex.test("FOO.TS")).toBe(true);
  });
  it("case-sensitive when set", () => {
    const r = globToRegex("*.ts", { ...DEFAULT_OPTIONS, caseSensitive: true });
    expect(r.regex.test("foo.ts")).toBe(true);
    expect(r.regex.test("FOO.TS")).toBe(false);
  });
});

describe("glob globToRegex — gitignore flavor", () => {
  it("trailing / matches directory", () => {
    const r = globToRegex("node_modules/", { ...DEFAULT_OPTIONS, flavor: "gitignore" });
    expect(r.dirOnly).toBe(true);
    expect(r.regex.test("node_modules")).toBe(true);
    expect(r.regex.test("node_modules/react")).toBe(true);
  });
  it("leading / anchors to root", () => {
    const r = globToRegex("/dist", { ...DEFAULT_OPTIONS, flavor: "gitignore" });
    expect(r.anchored).toBe(true);
    expect(r.regex.test("dist")).toBe(true);
    expect(r.regex.test("src/dist")).toBe(false);
  });
  it("no leading / matches at any depth", () => {
    const r = globToRegex("dist", { ...DEFAULT_OPTIONS, flavor: "gitignore" });
    expect(r.regex.test("dist")).toBe(true);
    expect(r.regex.test("src/dist")).toBe(true);
  });
  it("! prefix sets negated flag", () => {
    const r = globToRegex("!*.ts", { ...DEFAULT_OPTIONS, flavor: "gitignore" });
    expect(r.negated).toBe(true);
  });
});

describe("glob globToRegex — tokens", () => {
  it("produces tokens with explanations", () => {
    const r = globToRegex("**/*.ts", DEFAULT_OPTIONS);
    expect(r.tokens.length).toBeGreaterThan(0);
    const globstarToken = r.tokens.find((t) => t.kind === "globstar");
    expect(globstarToken).toBeDefined();
    expect(globstarToken?.explanation).toContain("Globstar");
  });
  it("explains brace expansion", () => {
    const r = globToRegex("{a,b}.ts", DEFAULT_OPTIONS);
    const brace = r.tokens.find((t) => t.kind === "brace");
    expect(brace).toBeDefined();
    expect(brace?.explanation).toContain("Brace");
  });
});

// ---------------------------------------------------------------------------
// matchGlob
// ---------------------------------------------------------------------------

describe("glob matchGlob", () => {
  it("matches simple pattern", () => {
    expect(matchGlob("*.ts", "foo.ts")).toBe(true);
    expect(matchGlob("*.ts", "foo.txt")).toBe(false);
  });
  it("matches globstar recursively", () => {
    expect(matchGlob("**/*.ts", "a/b/c.ts")).toBe(true);
  });
  it("respects caseSensitivity", () => {
    expect(matchGlob("*.ts", "FOO.TS", { ...DEFAULT_OPTIONS, caseSensitive: true })).toBe(false);
    expect(matchGlob("*.ts", "FOO.TS", { ...DEFAULT_OPTIONS, caseSensitive: false })).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// matchPaths / matchMultiPatterns
// ---------------------------------------------------------------------------

describe("glob matchPaths", () => {
  it("returns matched and unmatched", () => {
    const paths = ["a.ts", "b.txt", "c.ts"];
    const set = matchPaths("*.ts", paths);
    expect(set.matched).toEqual(["a.ts", "c.ts"]);
    expect(set.unmatched).toEqual(["b.txt"]);
  });
  it("results array has per-path detail", () => {
    const set = matchPaths("*.ts", ["a.ts", "b.txt"]);
    expect(set.results).toHaveLength(2);
    expect(set.results[0].matched).toBe(true);
    expect(set.results[1].matched).toBe(false);
  });
});

describe("glob matchMultiPatterns", () => {
  it("include + exclude", () => {
    const patterns: PatternEntry[] = [
      makePatternEntry("src/**", false),
      makePatternEntry("**/*.test.*", true),
    ];
    const paths = ["src/a.ts", "src/a.test.ts", "test/b.ts"];
    const set = matchMultiPatterns(patterns, paths, { ...DEFAULT_OPTIONS, flavor: "minimatch" });
    expect(set.matched).toContain("src/a.ts");
    expect(set.matched).not.toContain("src/a.test.ts");
    expect(set.matched).not.toContain("test/b.ts");
  });
  it("no includes = match all (then excludes filter)", () => {
    const patterns: PatternEntry[] = [
      makePatternEntry("**/*.test.*", true),
    ];
    const paths = ["a.ts", "a.test.ts", "b.ts"];
    const set = matchMultiPatterns(patterns, paths);
    expect(set.matched).toContain("a.ts");
    expect(set.matched).toContain("b.ts");
    expect(set.matched).not.toContain("a.test.ts");
  });
});

// ---------------------------------------------------------------------------
// explainPattern / describeRegex
// ---------------------------------------------------------------------------

describe("glob explainPattern", () => {
  it("returns tokens", () => {
    const tokens = explainPattern("**/*.ts");
    expect(tokens.length).toBeGreaterThan(0);
  });
  it("explains each token", () => {
    const tokens = explainPattern("[a-z]?.ts");
    expect(tokens.some((t) => t.kind === "char-class")).toBe(true);
    expect(tokens.some((t) => t.kind === "question")).toBe(true);
  });
});

describe("glob describeRegex", () => {
  it("describes full-match", () => {
    const s = describeRegex("^foo$");
    expect(s).toContain("Full-match");
  });
  it("describes start-anchored", () => {
    const s = describeRegex("^foo");
    expect(s).toContain("Start-anchored");
  });
});

// ---------------------------------------------------------------------------
// highlightMatch
// ---------------------------------------------------------------------------

describe("glob highlightMatch", () => {
  it("returns segments", () => {
    const segs = highlightMatch("*.ts", "foo.ts");
    expect(segs.length).toBeGreaterThan(0);
    expect(segs.some((s) => s.matched)).toBe(true);
  });
  it("returns unmatched for non-match", () => {
    const segs = highlightMatch("*.ts", "foo.txt");
    expect(segs.every((s) => !s.matched)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// buildTree
// ---------------------------------------------------------------------------

describe("glob buildTree", () => {
  it("builds tree from paths", () => {
    const paths = ["src/a.ts", "src/b.ts", "test/c.ts"];
    const set = matchPaths("*.ts", paths);
    const tree = buildTree(paths, set);
    expect(tree.children.length).toBeGreaterThan(0);
    // Top-level should have src/ and test/
    const srcNode = tree.children.find((c) => c.name === "src");
    expect(srcNode).toBeDefined();
    expect(srcNode?.isDir).toBe(true);
  });
  it("marks matched files", () => {
    const paths = ["a.ts", "b.txt"];
    const set = matchPaths("*.ts", paths);
    const tree = buildTree(paths, set);
    const aNode = tree.children.find((c) => c.name === "a.ts");
    expect(aNode?.matched).toBe(true);
    const bNode = tree.children.find((c) => c.name === "b.txt");
    expect(bNode?.matched).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// computeStats
// ---------------------------------------------------------------------------

describe("glob computeStats", () => {
  it("computes stats", () => {
    const patterns: PatternEntry[] = [makePatternEntry("*.ts", false)];
    const paths = ["a.ts", "b.txt", "c.ts"];
    const set = matchMultiPatterns(patterns, paths);
    const stats = computeStats(patterns, paths, set, DEFAULT_OPTIONS);
    expect(stats.total).toBe(3);
    expect(stats.matched).toBe(2);
    expect(stats.unmatched).toBe(1);
    expect(stats.byFlavor.shell).toBe(1);
    expect(stats.byFlavor.gitignore).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

describe("glob history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    const entry: HistoryEntry = { ts: 1, flavor: "shell", patternCount: 2, pathCount: 5, matchCount: 3 };
    saveHistory(entry);
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0].flavor).toBe("shell");
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, flavor: "shell", patternCount: 1, pathCount: 1, matchCount: 1 });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, flavor: "shell", patternCount: 1, pathCount: 1, matchCount: 1 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Share URL
// ---------------------------------------------------------------------------

describe("glob shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const patterns: PatternEntry[] = [makePatternEntry("*.ts", false)];
    const url = buildShareUrl(patterns, "a.ts\nb.txt", DEFAULT_OPTIONS);
    expect(url).toContain("flavor=shell");
    expect(url).toContain("case=false");
    expect(url).toContain("dot=false");
    expect(url).toContain("globstar=true");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const patterns: PatternEntry[] = [
      makePatternEntry("*.ts", false),
      makePatternEntry("**/*.test.*", true),
    ];
    const url = buildShareUrl(patterns, "a.ts\nb.txt", { ...DEFAULT_OPTIONS, flavor: "minimatch" });
    (globalThis as Record<string, unknown>).window = origWindow;
    const hash = url.split("#")[1] ?? url.slice(1);
    const parsed = parseShareUrl(hash);
    expect(parsed.options.flavor).toBe("minimatch");
    expect(parsed.paths).toBe("a.ts\nb.txt");
    expect(parsed.patterns).toHaveLength(2);
    expect(parsed.patterns.some((p) => p.exclude)).toBe(true);
  });
  it("handles empty hash", () => {
    const p = parseShareUrl("");
    expect(p.patterns).toEqual([]);
    expect(p.paths).toBe("");
    expect(p.options.flavor).toBe("shell");
  });
  it("parses case sensitive flag", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl([], "", { ...DEFAULT_OPTIONS, caseSensitive: true });
    (globalThis as Record<string, unknown>).window = origWindow;
    const hash = url.split("#")[1] ?? url.slice(1);
    const parsed = parseShareUrl(hash);
    expect(parsed.options.caseSensitive).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// makePatternEntry
// ---------------------------------------------------------------------------

describe("glob makePatternEntry", () => {
  it("creates include entry", () => {
    const p = makePatternEntry("*.ts", false);
    expect(p.pattern).toBe("*.ts");
    expect(p.exclude).toBe(false);
    expect(p.id).toBeDefined();
  });
  it("creates exclude entry", () => {
    const p = makePatternEntry("*.test.*", true);
    expect(p.exclude).toBe(true);
  });
  it("creates unique IDs", () => {
    const a = makePatternEntry("*.ts", false);
    const b = makePatternEntry("*.ts", false);
    expect(a.id).not.toBe(b.id);
  });
});

// ---------------------------------------------------------------------------
// Preset patterns
// ---------------------------------------------------------------------------

describe("glob preset patterns work", () => {
  it("all-ts matches .ts and .tsx files", () => {
    const preset = PRESET_PATTERNS.find((p) => p.id === "all-ts")!;
    expect(matchGlob(preset.pattern, "src/index.ts", { ...DEFAULT_OPTIONS, flavor: preset.flavor })).toBe(true);
    expect(matchGlob(preset.pattern, "src/Button.tsx", { ...DEFAULT_OPTIONS, flavor: preset.flavor })).toBe(true);
    expect(matchGlob(preset.pattern, "README.md", { ...DEFAULT_OPTIONS, flavor: preset.flavor })).toBe(false);
  });
  it("gitignore-node matches node_modules dir", () => {
    const preset = PRESET_PATTERNS.find((p) => p.id === "gitignore-node")!;
    expect(matchGlob(preset.pattern, "node_modules", { ...DEFAULT_OPTIONS, flavor: preset.flavor })).toBe(true);
    expect(matchGlob(preset.pattern, "node_modules/react", { ...DEFAULT_OPTIONS, flavor: preset.flavor })).toBe(true);
  });
  it("images matches png and svg", () => {
    const preset = PRESET_PATTERNS.find((p) => p.id === "images")!;
    expect(matchGlob(preset.pattern, "logo.png", { ...DEFAULT_OPTIONS, flavor: preset.flavor })).toBe(true);
    expect(matchGlob(preset.pattern, "icon.svg", { ...DEFAULT_OPTIONS, flavor: preset.flavor })).toBe(true);
  });
});

// Suppress unused-import lint
export type _Unused = GlobFlavor | ConvertOptions;
