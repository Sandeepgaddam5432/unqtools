import { describe, it, expect, beforeEach } from "vitest";
import {
  HISTORY_MAX,
  DEFAULT_OPTIONS,
  AI_CRAWLER_PRESETS,
  SEARCH_CRAWLER_PRESETS,
  genId,
  normalizeAgent,
  validatePath,
  validateSitemap,
  validateAgent,
  extractPathFromUrl,
  compilePattern,
  matchPath,
  selectGroup,
  testUrl,
  groupRules,
  generateRobots,
  countWarnings,
  parseIntent,
  parseRobotsText,
  renderRule,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
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

describe("robots-txt constants", () => {
  it("HISTORY_MAX is 20", () => { expect(HISTORY_MAX).toBe(20); });
  it("DEFAULT_OPTIONS has empty rules", () => { expect(DEFAULT_OPTIONS.rules).toEqual([]); });
  it("has AI crawler presets", () => { expect(AI_CRAWLER_PRESETS.length).toBeGreaterThan(3); });
  it("has search crawler presets", () => { expect(SEARCH_CRAWLER_PRESETS.length).toBeGreaterThan(3); });
});

describe("robots-txt genId", () => {
  it("returns unique IDs", () => {
    const a = genId();
    const b = genId();
    expect(a).not.toBe(b);
  });
});

describe("robots-txt normalizeAgent", () => {
  it("returns * for empty", () => { expect(normalizeAgent("")).toBe("*"); });
  it("trims whitespace", () => { expect(normalizeAgent("  GPTBot  ")).toBe("GPTBot"); });
  it("returns * for *", () => { expect(normalizeAgent("*")).toBe("*"); });
});

describe("robots-txt validatePath", () => {
  it("accepts root path", () => {
    const r = validatePath("/");
    expect(r.ok).toBe(true);
  });
  it("accepts /admin", () => {
    const r = validatePath("/admin");
    expect(r.ok).toBe(true);
  });
  it("accepts wildcard path", () => {
    const r = validatePath("/private/*");
    expect(r.ok).toBe(true);
  });
  it("accepts empty as allow-all", () => {
    const r = validatePath("");
    expect(r.ok).toBe(true);
  });
});

describe("robots-txt validateSitemap", () => {
  it("accepts valid URL", () => {
    const r = validateSitemap("https://example.com/sitemap.xml");
    expect(r.ok).toBe(true);
  });
  it("rejects empty", () => {
    const r = validateSitemap("");
    expect(r.ok).toBe(false);
  });
  it("rejects non-URL", () => {
    const r = validateSitemap("not-a-url");
    expect(r.ok).toBe(false);
  });
});

describe("robots-txt validateAgent", () => {
  it("accepts GPTBot", () => {
    const r = validateAgent("GPTBot");
    expect(r.ok).toBe(true);
  });
  it("accepts *", () => {
    const r = validateAgent("*");
    expect(r.ok).toBe(true);
  });
  it("accepts empty as *", () => {
    const r = validateAgent("");
    expect(r.ok).toBe(true);
  });
});

describe("robots-txt extractPathFromUrl", () => {
  it("extracts path from URL", () => {
    const r = extractPathFromUrl("https://example.com/admin/page");
    expect(r.ok).toBe(true);
    expect(r.path).toBe("/admin/page");
  });
  it("extracts root path", () => {
    const r = extractPathFromUrl("https://example.com/");
    expect(r.ok).toBe(true);
    expect(r.path).toBe("/");
  });
  it("rejects invalid URL", () => {
    const r = extractPathFromUrl("not-a-url");
    expect(r.ok).toBe(false);
  });
});

describe("robots-txt compilePattern", () => {
  it("compiles wildcard pattern", () => {
    const re = compilePattern("/admin/*");
    expect(re.test("/admin/page")).toBe(true);
    expect(re.test("/admin/")).toBe(true);
  });
  it("compiles exact pattern with $", () => {
    const re = compilePattern("/private$");
    expect(re.test("/private")).toBe(true);
    expect(re.test("/private/page")).toBe(false);
  });
  it("compiles root pattern", () => {
    const re = compilePattern("/");
    expect(re.test("/")).toBe(true);
  });
});

describe("robots-txt matchPath", () => {
  it("returns positive match for matching path", () => {
    expect(matchPath("/admin/*", "/admin/page")).toBeGreaterThan(0);
  });
  it("returns 0 for non-matching", () => {
    expect(matchPath("/admin/*", "/public/page")).toBe(0);
  });
  it("longer match wins", () => {
    const short = matchPath("/", "/admin/page");
    const long = matchPath("/admin/*", "/admin/page");
    expect(long).toBeGreaterThan(short);
  });
});

describe("robots-txt selectGroup", () => {
  it("returns exact agent match", () => {
    expect(selectGroup(["*", "GPTBot"], "GPTBot")).toBe("GPTBot");
  });
  it("falls back to *", () => {
    expect(selectGroup(["*", "GPTBot"], "UnknownBot")).toBe("*");
  });
  it("returns * when only * available", () => {
    expect(selectGroup(["*"], "Anything")).toBe("*");
  });
});

describe("robots-txt testUrl", () => {
  it("blocks disallowed URL", () => {
    const opts: typeof DEFAULT_OPTIONS = {
      ...DEFAULT_OPTIONS,
      rules: [{ id: "1", userAgent: "*", type: "disallow", path: "/admin" }],
    };
    const r = testUrl(opts, "https://example.com/admin", "*");
    expect(r.allowed).toBe(false);
  });
  it("allows non-blocked URL", () => {
    const opts: typeof DEFAULT_OPTIONS = {
      ...DEFAULT_OPTIONS,
      rules: [{ id: "1", userAgent: "*", type: "disallow", path: "/admin" }],
    };
    const r = testUrl(opts, "https://example.com/public", "*");
    expect(r.allowed).toBe(true);
  });
  it("allow wins over disallow (longer match)", () => {
    const opts: typeof DEFAULT_OPTIONS = {
      ...DEFAULT_OPTIONS,
      rules: [
        { id: "1", userAgent: "*", type: "disallow", path: "/admin" },
        { id: "2", userAgent: "*", type: "allow", path: "/admin/public" },
      ],
    };
    const r = testUrl(opts, "https://example.com/admin/public", "*");
    expect(r.allowed).toBe(true);
  });
});

describe("robots-txt groupRules", () => {
  it("groups by user-agent", () => {
    const rules = [
      { id: "1", userAgent: "*", type: "disallow" as const, path: "/admin" },
      { id: "2", userAgent: "GPTBot", type: "disallow" as const, path: "/" },
    ];
    const grouped = groupRules(rules);
    expect(grouped.get("*")?.length).toBe(1);
    expect(grouped.get("GPTBot")?.length).toBe(1);
  });
});

describe("robots-txt generateRobots", () => {
  it("generates text with rules", () => {
    const opts: typeof DEFAULT_OPTIONS = {
      ...DEFAULT_OPTIONS,
      rules: [{ id: "1", userAgent: "*", type: "disallow", path: "/admin" }],
      sitemaps: ["https://example.com/sitemap.xml"],
    };
    const r = generateRobots(opts);
    expect(r.text).toContain("User-agent: *");
    expect(r.text).toContain("Disallow: /admin");
    expect(r.text).toContain("Sitemap: https://example.com/sitemap.xml");
  });
  it("includes warnings array", () => {
    const r = generateRobots(DEFAULT_OPTIONS);
    expect(Array.isArray(r.warnings)).toBe(true);
  });
  it("includes explanations", () => {
    const opts: typeof DEFAULT_OPTIONS = {
      ...DEFAULT_OPTIONS,
      rules: [{ id: "1", userAgent: "*", type: "disallow", path: "/admin" }],
    };
    const r = generateRobots(opts);
    expect(r.explanations.length).toBeGreaterThan(0);
  });
});

describe("robots-txt countWarnings", () => {
  it("counts by level", () => {
    const warnings = [
      { level: "ok" as const, message: "a" },
      { level: "warn" as const, message: "b" },
      { level: "warn" as const, message: "c" },
      { level: "danger" as const, message: "d" },
    ];
    const c = countWarnings(warnings);
    expect(c.ok).toBe(1);
    expect(c.warn).toBe(2);
    expect(c.danger).toBe(1);
  });
});

describe("robots-txt parseIntent", () => {
  it("parses 'block GPTBot'", () => {
    const r = parseIntent("block GPTBot");
    expect(r.options).toBeDefined();
    expect(r.notes).toBeDefined();
  });
  it("parses 'allow all'", () => {
    const r = parseIntent("allow all");
    expect(r.options).toBeDefined();
    expect(r.notes).toBeDefined();
  });
});

describe("robots-txt parseRobotsText", () => {
  it("parses valid robots.txt", () => {
    const text = "User-agent: *\nDisallow: /admin\n";
    const r = parseRobotsText(text);
    expect(r.options).toBeDefined();
    expect(r.options.rules.length).toBeGreaterThan(0);
  });
  it("parses with sitemap", () => {
    const text = "User-agent: *\nDisallow: /admin\nSitemap: https://example.com/sitemap.xml\n";
    const r = parseRobotsText(text);
    expect(r.options.sitemaps.length).toBeGreaterThan(0);
  });
});

describe("robots-txt renderRule", () => {
  it("renders disallow rule", () => {
    const rule = { id: "1", userAgent: "*", type: "disallow" as const, path: "/admin" };
    expect(renderRule(rule)).toContain("Disallow");
    expect(renderRule(rule)).toContain("/admin");
  });
  it("renders allow rule", () => {
    const rule = { id: "1", userAgent: "*", type: "allow" as const, path: "/public" };
    expect(renderRule(rule)).toContain("Allow");
    expect(renderRule(rule)).toContain("/public");
  });
});

describe("robots-txt history", () => {
  it("loads empty initially", () => { expect(loadHistory()).toEqual([]); });
  it("saves and loads", () => {
    saveHistory({ ts: 1, summary: "test", ruleCount: 3 });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) saveHistory({ ts: i, summary: `x${i}`, ruleCount: 1 });
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, summary: "x", ruleCount: 1 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("robots-txt share URL", () => {
  it("builds URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({ rules: [{ id: "1", userAgent: "*", type: "disallow", path: "/admin" }] });
    expect(url).toContain("rules=");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses empty hash", () => {
    const p = parseShareUrl("");
    expect(p.options).toBeDefined();
  });
});

describe("robots-txt buildLlmPrompt", () => {
  it("builds prompt with rules", () => {
    const opts: typeof DEFAULT_OPTIONS = {
      ...DEFAULT_OPTIONS,
      rules: [{ id: "1", userAgent: "*", type: "disallow", path: "/admin" }],
    };
    const p = buildLlmPrompt(opts);
    expect(p.system || p.user).toBeTruthy();
  });
});
