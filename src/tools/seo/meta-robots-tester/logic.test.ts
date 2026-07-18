import { describe, it, expect, beforeEach } from "vitest";
import {
  DIRECTIVE_REFERENCE,
  extractMetaRobots,
  parseDirectives,
  detectConflicts,
  generateRecommendations,
  generateFixedTag,
  testInput,
  renderReport,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
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

describe("meta-robots-tester DIRECTIVE_REFERENCE", () => {
  it("includes all standard directives", () => {
    const names = DIRECTIVE_REFERENCE.map((d) => d.name);
    expect(names).toContain("index");
    expect(names).toContain("noindex");
    expect(names).toContain("follow");
    expect(names).toContain("nofollow");
    expect(names).toContain("noarchive");
    expect(names).toContain("nosnippet");
    expect(names).toContain("unavailable_after");
    expect(names).toContain("all");
    expect(names).toContain("none");
  });
});

describe("meta-robots-tester extractMetaRobots", () => {
  it("extracts content from a meta tag", () => {
    const html = `<head><meta name="robots" content="noindex, nofollow"></head>`;
    const { content, tag } = extractMetaRobots(html);
    expect(content).toBe("noindex, nofollow");
    expect(tag).toContain("<meta");
  });
  it("handles single quotes", () => {
    const html = `<meta name='robots' content='index, follow'>`;
    const { content } = extractMetaRobots(html);
    expect(content).toBe("index, follow");
  });
  it("returns null when no meta robots tag", () => {
    const html = `<meta name="description" content="hello">`;
    const { content } = extractMetaRobots(html);
    expect(content).toBeNull();
  });
  it("returns null for empty input", () => {
    expect(extractMetaRobots("").content).toBeNull();
  });
});

describe("meta-robots-tester parseDirectives", () => {
  it("parses index, follow", () => {
    const p = parseDirectives("index, follow");
    expect(p.hasIndex).toBe(true);
    expect(p.hasFollow).toBe(true);
    expect(p.hasNoindex).toBe(false);
  });
  it("parses noindex, nofollow", () => {
    const p = parseDirectives("noindex, nofollow");
    expect(p.hasNoindex).toBe(true);
    expect(p.hasNofollow).toBe(true);
  });
  it("parses none as equivalent to noindex, nofollow", () => {
    const p = parseDirectives("none");
    expect(p.hasNone).toBe(true);
  });
  it("parses all", () => {
    const p = parseDirectives("all");
    expect(p.hasAll).toBe(true);
  });
  it("parses noarchive, nosnippet", () => {
    const p = parseDirectives("noarchive, nosnippet");
    expect(p.hasNoarchive).toBe(true);
    expect(p.hasNosnippet).toBe(true);
  });
  it("parses unavailable_after with value", () => {
    const p = parseDirectives("unavailable_after: 25 Jun 2025 00:00:00 PST");
    expect(p.unavailableAfter).toBe("25 Jun 2025 00:00:00 PST");
  });
  it("parses max-snippet as number", () => {
    const p = parseDirectives("max-snippet: 50");
    expect(p.maxSnippet).toBe(50);
  });
  it("parses max-image-preview as string", () => {
    const p = parseDirectives("max-image-preview: large");
    expect(p.maxImagePreview).toBe("large");
  });
  it("returns empty for empty input", () => {
    const p = parseDirectives("");
    expect(p.hasIndex).toBe(false);
    expect(Object.keys(p.directives)).toHaveLength(0);
  });
});

describe("meta-robots-tester detectConflicts", () => {
  it("flags index + noindex", () => {
    const p = parseDirectives("index, noindex");
    const c = detectConflicts(p);
    expect(c.some((x) => x.type === "error" && /index and noindex/.test(x.message))).toBe(true);
  });
  it("flags follow + nofollow", () => {
    const p = parseDirectives("follow, nofollow");
    const c = detectConflicts(p);
    expect(c.some((x) => x.type === "error" && /follow and nofollow/.test(x.message))).toBe(true);
  });
  it("flags all + none", () => {
    const p = parseDirectives("all, none");
    const c = detectConflicts(p);
    expect(c.some((x) => x.type === "error" && /all and none/.test(x.message))).toBe(true);
  });
  it("flags all + noindex as redundant", () => {
    const p = parseDirectives("all, noindex");
    const c = detectConflicts(p);
    expect(c.some((x) => x.type === "warning" && /redundant/.test(x.message))).toBe(true);
  });
  it("flags none + index", () => {
    const p = parseDirectives("none, index");
    const c = detectConflicts(p);
    expect(c.some((x) => x.type === "error" && /none/.test(x.message))).toBe(true);
  });
  it("flags invalid max-image-preview value", () => {
    const p = parseDirectives("max-image-preview: huge");
    const c = detectConflicts(p);
    expect(c.some((x) => x.type === "error" && /max-image-preview/.test(x.message))).toBe(true);
  });
  it("passes valid directives without conflicts", () => {
    const p = parseDirectives("noindex, nofollow");
    const c = detectConflicts(p);
    expect(c).toHaveLength(0);
  });
});

describe("meta-robots-tester generateRecommendations", () => {
  it("recommends removing 'all'", () => {
    const p = parseDirectives("all");
    const r = generateRecommendations(p);
    expect(r.some((x) => /redundant/.test(x))).toBe(true);
  });
  it("explains 'none' equivalence", () => {
    const p = parseDirectives("none");
    const r = generateRecommendations(p);
    expect(r.some((x) => /none/.test(x))).toBe(true);
  });
  it("notes noindex without nofollow", () => {
    const p = parseDirectives("noindex");
    const r = generateRecommendations(p);
    expect(r.some((x) => /nofollow/.test(x))).toBe(true);
  });
  it("notes default state when no directives", () => {
    const p = parseDirectives("");
    const r = generateRecommendations(p);
    expect(r.some((x) => /defaults to 'index'/.test(x))).toBe(true);
  });
});

describe("meta-robots-tester generateFixedTag", () => {
  it("resolves index+noindex to noindex", () => {
    const p = parseDirectives("index, noindex");
    const tag = generateFixedTag(p);
    expect(tag).toContain("noindex");
    expect(tag).not.toContain(", index");
  });
  it("resolves follow+nofollow to nofollow", () => {
    const p = parseDirectives("follow, nofollow");
    const tag = generateFixedTag(p);
    expect(tag).toContain("nofollow");
  });
  it("defaults to index, follow when empty", () => {
    const p = parseDirectives("");
    const tag = generateFixedTag(p);
    expect(tag).toContain("index, follow");
  });
  it("includes noarchive when set", () => {
    const p = parseDirectives("noindex, noarchive");
    const tag = generateFixedTag(p);
    expect(tag).toContain("noarchive");
  });
  it("handles none directive", () => {
    const p = parseDirectives("none");
    const tag = generateFixedTag(p);
    expect(tag).toContain("noindex");
    expect(tag).toContain("nofollow");
  });
});

describe("meta-robots-tester testInput", () => {
  it("detects HTML meta tag as source", () => {
    const r = testInput(`<meta name="robots" content="noindex, nofollow">`);
    expect(r.source).toBe("meta");
    expect(r.parsed.hasNoindex).toBe(true);
    expect(r.parsed.hasNofollow).toBe(true);
    expect(r.valid).toBe(true);
  });
  it("detects X-Robots-Tag header as source", () => {
    const r = testInput(`X-Robots-Tag: noindex, nofollow`);
    expect(r.source).toBe("header");
    expect(r.parsed.hasNoindex).toBe(true);
  });
  it("treats plain string as source string", () => {
    const r = testInput("noindex, nofollow");
    expect(r.source).toBe("string");
    expect(r.parsed.hasNoindex).toBe(true);
  });
  it("flags invalid input as not valid", () => {
    const r = testInput("index, noindex");
    expect(r.valid).toBe(false);
  });
  it("returns valid result for clean directives", () => {
    const r = testInput("noindex, nofollow");
    expect(r.valid).toBe(true);
  });
  it("handles empty input", () => {
    const r = testInput("");
    expect(r.valid).toBe(false);
  });
});

describe("meta-robots-tester renderReport", () => {
  it("produces human-readable report", () => {
    const r = testInput("noindex, nofollow");
    const report = renderReport(r);
    expect(report).toContain("Meta Robots Test Report");
    expect(report).toContain("noindex");
  });
});

describe("meta-robots-tester history", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, source: "meta", valid: true, conflictCount: 0, fixedTag: "<meta>" });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, source: "string", valid: true, conflictCount: 0, fixedTag: "" });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, source: "x", valid: true, conflictCount: 0, fixedTag: "" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("meta-robots-tester shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("noindex, nofollow");
    expect(url).toContain("data=");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const parsed = parseShareUrl("data=noindex");
    expect(parsed.data).toBe("noindex");
  });
  it("returns empty for empty hash", () => {
    expect(parseShareUrl("")).toEqual({ data: "" });
  });
});
