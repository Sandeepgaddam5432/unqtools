import { describe, it, expect, beforeEach } from "vitest";
import {
  HISTORY_KEY,
  HISTORY_MAX,
  FLAVOR_LABELS,
  ALL_FLAVORS,
  PATTERN_LIBRARY,
  SAMPLE_DESCRIPTIONS,
  normalizeDescription,
  normalizeFlags,
  scorePatternMatch,
  matchPatterns,
  buildRegex,
  testRegex,
  explainRegex,
  convertFlavor,
  renderPatternForFlavor,
  detectRedos,
  previewReplace,
  buildCodeSnippet,
  renderText,
  renderMarkdown,
  renderJson,
  renderPatternOnly,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  parseLlmResult,
  type Flavor,
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

describe("ai-regex-builder constants", () => {
  it("exposes history key and cap of 20", () => {
    expect(HISTORY_KEY).toContain("ai-regex-builder");
    expect(HISTORY_MAX).toBe(20);
  });
  it("has 4 flavors", () => {
    expect(Object.keys(FLAVOR_LABELS)).toHaveLength(4);
    expect(FLAVOR_LABELS.js).toBe("JavaScript");
    expect(FLAVOR_LABELS.pcre).toContain("PCRE");
  });
  it("ALL_FLAVORS lists 4 flavors", () => {
    expect(ALL_FLAVORS).toHaveLength(4);
    expect(ALL_FLAVORS).toContain("js");
  });
  it("has pattern library with 10+ patterns", () => {
    expect(PATTERN_LIBRARY.length).toBeGreaterThanOrEqual(10);
    const ids = PATTERN_LIBRARY.map((p) => p.id);
    expect(ids).toContain("email");
    expect(ids).toContain("url");
    expect(ids).toContain("ipv4");
    expect(ids).toContain("phone-us");
    expect(ids).toContain("credit-card");
    expect(ids).toContain("date-iso");
    expect(ids).toContain("time-24h");
    expect(ids).toContain("hex-color");
    expect(ids).toContain("zip-us");
    expect(ids).toContain("uuid");
  });
  it("each pattern has keywords, source, and examples", () => {
    for (const p of PATTERN_LIBRARY) {
      expect(p.keywords.length).toBeGreaterThan(0);
      expect(p.pattern.length).toBeGreaterThan(0);
      expect(p.exampleMatches.length).toBeGreaterThan(0);
      expect(p.exampleNonMatches.length).toBeGreaterThan(0);
    }
  });
  it("has sample descriptions", () => {
    expect(SAMPLE_DESCRIPTIONS.length).toBeGreaterThanOrEqual(3);
  });
});

describe("ai-regex-builder normalizeDescription", () => {
  it("collapses whitespace and trims", () => {
    expect(normalizeDescription("  match   emails  ")).toBe("match emails");
  });
  it("handles empty", () => {
    expect(normalizeDescription("")).toBe("");
  });
});

describe("ai-regex-builder normalizeFlags", () => {
  it("keeps valid flags and dedupes", () => {
    expect(normalizeFlags("ggii")).toBe("gi");
  });
  it("drops invalid flags", () => {
    expect(normalizeFlags("gixz")).toBe("gi");
  });
  it("orders flags canonically", () => {
    expect(normalizeFlags("img")).toBe("gim");
  });
  it("handles empty", () => {
    expect(normalizeFlags("")).toBe("");
  });
});

describe("ai-regex-builder scorePatternMatch", () => {
  it("scores email description for email pattern", () => {
    const emailDef = PATTERN_LIBRARY.find((p) => p.id === "email")!;
    expect(scorePatternMatch("match email addresses", emailDef)).toBeGreaterThan(0);
  });
  it("returns 0 for empty description", () => {
    const emailDef = PATTERN_LIBRARY.find((p) => p.id === "email")!;
    expect(scorePatternMatch("", emailDef)).toBe(0);
  });
});

describe("ai-regex-builder matchPatterns", () => {
  it("ranks email pattern first for email description", () => {
    const matches = matchPatterns("match an email address");
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].def.id).toBe("email");
  });
  it("returns ipv4 for ip description", () => {
    const matches = matchPatterns("find ipv4 ip addresses");
    expect(matches[0].def.id).toBe("ipv4");
  });
  it("returns empty for empty description", () => {
    expect(matchPatterns("")).toEqual([]);
  });
  it("returns empty for unmatched description", () => {
    expect(matchPatterns("totally unrelated stuff")).toEqual([]);
  });
});

describe("ai-regex-builder buildRegex", () => {
  it("builds an email regex", () => {
    const r = buildRegex("match email addresses", { sample: "alice@example.com" });
    expect(r.patternId).toBe("email");
    expect(r.pattern.length).toBeGreaterThan(0);
    expect(r.test.ok).toBe(true);
    expect(r.test.matchCount).toBe(1);
  });
  it("returns matches for sample text", () => {
    const r = buildRegex("find ipv4", { sample: "192.168.1.1 and 8.8.8.8" });
    expect(r.test.matchCount).toBe(2);
  });
  it("falls back to literal match when no library match", () => {
    const r = buildRegex("totally unrelated stuff");
    expect(r.patternId).toBeNull();
    expect(r.patternName).toMatch(/literal/i);
  });
  it("uses custom regex when input contains regex metachars", () => {
    const r = buildRegex("[A-Z]+\\d{3}");
    expect(r.patternName).toMatch(/custom/i);
    expect(r.pattern).toBe("[A-Z]+\\d{3}");
  });
  it("populates tokens array", () => {
    const r = buildRegex("match email");
    expect(r.tokens.length).toBeGreaterThan(0);
  });
  it("populates redosWarnings (empty for safe patterns)", () => {
    const r = buildRegex("match email");
    expect(Array.isArray(r.redosWarnings)).toBe(true);
  });
  it("records the chosen flavor", () => {
    const r = buildRegex("match email", { flavor: "python" });
    expect(r.flavor).toBe("python");
  });
  it("returns notes for library matches", () => {
    const r = buildRegex("match email");
    expect(r.notes.length).toBeGreaterThan(0);
  });
});

describe("ai-regex-builder testRegex", () => {
  it("returns ok with matches for valid regex", () => {
    const t = testRegex("\\d+", "g", "abc 123 def 456");
    expect(t.ok).toBe(true);
    expect(t.matchCount).toBe(2);
    expect(t.matches[0].text).toBe("123");
  });
  it("returns error for invalid regex", () => {
    const t = testRegex("(unclosed", "g", "abc");
    expect(t.ok).toBe(false);
    expect(t.error).toBeTruthy();
  });
  it("handles non-global flag", () => {
    const t = testRegex("\\d+", "", "abc 123 def 456");
    expect(t.matchCount).toBe(1);
  });
  it("returns error for empty pattern", () => {
    const t = testRegex("", "g", "abc");
    expect(t.ok).toBe(false);
    expect(t.error).toBeTruthy();
  });
  it("handles zero-width quantifier safely (no infinite loop)", () => {
    const t = testRegex("a*", "g", "abc");
    expect(t.ok).toBe(true);
    // a* matches 'a', '', '', '' — at least one match.
    expect(t.matchCount).toBeGreaterThanOrEqual(1);
  });
  it("captures groups", () => {
    const t = testRegex("(\\d+)-(\\d+)", "g", "12-34 and 56-78");
    expect(t.ok).toBe(true);
    expect(t.matchCount).toBe(2);
    expect(t.groups.length).toBe(2);
    expect(t.groups[0].values).toEqual(["12", "56"]);
    expect(t.groups[1].values).toEqual(["34", "78"]);
  });
});

describe("ai-regex-builder explainRegex", () => {
  it("explains character classes", () => {
    const tokens = explainRegex("\\d+");
    expect(tokens.length).toBe(2);
    expect(tokens[0].type).toBe("class");
    expect(tokens[0].description).toContain("digit");
    expect(tokens[1].type).toBe("quantifier");
  });
  it("explains anchors", () => {
    const tokens = explainRegex("^abc$");
    expect(tokens[0].type).toBe("anchor");
    expect(tokens[0].value).toBe("^");
    expect(tokens[tokens.length - 1].type).toBe("anchor");
  });
  it("explains capture groups", () => {
    const tokens = explainRegex("(abc)");
    const open = tokens.find((t) => t.type === "group-open");
    expect(open).toBeDefined();
    expect(open?.groupIndex).toBe(1);
  });
  it("explains alternation", () => {
    const tokens = explainRegex("a|b");
    expect(tokens.some((t) => t.type === "alternation")).toBe(true);
  });
  it("explains bracketed character class", () => {
    const tokens = explainRegex("[A-Z]+");
    const cls = tokens.find((t) => t.type === "class");
    expect(cls).toBeDefined();
    expect(cls?.description).toContain("Character class");
  });
  it("explains named groups", () => {
    const tokens = explainRegex("(?<year>\\d{4})");
    const named = tokens.find((t) => t.type === "named-group");
    expect(named).toBeDefined();
    expect(named?.groupName).toBe("year");
  });
  it("handles non-capturing groups", () => {
    const tokens = explainRegex("(?:abc)+");
    expect(tokens[0].type).toBe("group-open");
    expect(tokens[0].value).toBe("(?:");
  });
  it("handles lookarounds", () => {
    const tokens = explainRegex("a(?=b)");
    const la = tokens.find((t) => t.type === "lookaround");
    expect(la).toBeDefined();
    expect(la?.description).toContain("Positive lookahead");
  });
});

describe("ai-regex-builder convertFlavor", () => {
  it("converts JS named group to Python (?P<name>)", () => {
    expect(convertFlavor("(?<year>\\d{4})", "js", "python")).toBe("(?P<year>\\d{4})");
  });
  it("converts Python (?P<name>) back to JS (?<name>)", () => {
    expect(convertFlavor("(?P<year>\\d{4})", "python", "js")).toBe("(?<year>\\d{4})");
  });
  it("is a no-op for same flavor", () => {
    expect(convertFlavor("\\d+", "js", "js")).toBe("\\d+");
  });
});

describe("ai-regex-builder renderPatternForFlavor", () => {
  it("renders JS pattern with slashes and flags", () => {
    expect(renderPatternForFlavor("\\d+", "g", "js")).toBe("/\\d+/g");
  });
  it("renders Python pattern as raw string", () => {
    expect(renderPatternForFlavor("\\d+", "g", "python")).toBe('r"\\d+"');
  });
  it("renders Java pattern with doubled backslashes", () => {
    expect(renderPatternForFlavor("\\d+", "g", "java")).toBe('"\\\\d+"');
  });
  it("strips u/y flags from PCRE", () => {
    expect(renderPatternForFlavor("\\d+", "guy", "pcre")).toBe("/\\d+/g");
  });
});

describe("ai-regex-builder detectRedos", () => {
  it("flags nested quantifier (a+)+", () => {
    const w = detectRedos("(a+)+");
    expect(w.length).toBeGreaterThan(0);
    expect(w.some((x) => x.severity === "high")).toBe(true);
  });
  it("flags overlapping alternation with quantifier", () => {
    const w = detectRedos("(a|ab)*");
    expect(w.some((x) => x.severity === "medium")).toBe(true);
  });
  it("returns empty for safe patterns", () => {
    expect(detectRedos("\\d+")).toEqual([]);
    expect(detectRedos("[a-z]+")).toEqual([]);
  });
  it("flags double unbounded dot-quantifiers", () => {
    const w = detectRedos(".*.+");
    expect(w.length).toBeGreaterThan(0);
  });
});

describe("ai-regex-builder previewReplace", () => {
  it("replaces all matches with global flag", () => {
    const r = previewReplace("\\d+", "g", "a1b2c3", "X");
    expect(r.ok).toBe(true);
    expect(r.result).toBe("aXbXcX");
    expect(r.replacements).toBe(3);
  });
  it("returns error for invalid regex", () => {
    const r = previewReplace("(unclosed", "g", "abc", "X");
    expect(r.ok).toBe(false);
    expect(r.error).toBeTruthy();
  });
  it("adds global flag if missing", () => {
    const r = previewReplace("\\d", "", "a1b2", "X");
    expect(r.replacements).toBe(2);
  });
});

describe("ai-regex-builder buildCodeSnippet", () => {
  it("generates JavaScript snippet", () => {
    const s = buildCodeSnippet("\\d+", "g", "js");
    expect(s).toContain("/\\d+/g");
    expect(s).toContain("match(re)");
  });
  it("generates Python snippet", () => {
    const s = buildCodeSnippet("\\d+", "g", "python");
    expect(s).toContain("import re");
    expect(s).toContain('r"\\d+"');
  });
  it("generates Java snippet", () => {
    const s = buildCodeSnippet("\\d+", "g", "java");
    expect(s).toContain("Pattern.compile");
  });
  it("generates PHP/PCRE snippet", () => {
    const s = buildCodeSnippet("\\d+", "g", "pcre");
    expect(s).toContain("preg_match_all");
  });
});

describe("ai-regex-builder renderers", () => {
  const r = buildRegex("match email addresses", { sample: "alice@example.com" });
  it("renderText includes pattern and tokens", () => {
    const text = renderText(r);
    expect(text).toContain("Pattern:");
    expect(text).toContain("Tokens:");
  });
  it("renderMarkdown includes table", () => {
    const md = renderMarkdown(r);
    expect(md).toContain("| Token | Type |");
    expect(md).toContain("## Token explanation");
  });
  it("renderJson is valid JSON", () => {
    const json = renderJson(r);
    const parsed = JSON.parse(json);
    expect(parsed.pattern).toBe(r.pattern);
  });
  it("renderPatternOnly returns the rendered pattern", () => {
    const p = renderPatternOnly(r);
    expect(p).toContain(r.pattern);
    expect(p).toContain(r.flags);
  });
});

describe("ai-regex-builder history (localStorage)", () => {
  it("loads empty initially", () => { expect(loadHistory()).toEqual([]); });
  it("saves and loads", () => {
    saveHistory({ ts: 1, description: "match email", pattern: "\\d+", flags: "g", patternId: "email", matchCount: 1 });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, description: "x", pattern: "x", flags: "g", patternId: null, matchCount: 0 });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, description: "x", pattern: "x", flags: "g", patternId: null, matchCount: 0 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("ai-regex-builder shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("match email", "alice@example.com", "python", "g");
    expect(url).toContain("d=match+email");
    expect(url).toContain("f=python");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("d=match+email&s=alice@example.com&f=python&fl=g");
    expect(p.description).toBe("match email");
    expect(p.sample).toBe("alice@example.com");
    expect(p.flavor).toBe("python");
    expect(p.flags).toBe("g");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({ description: "", sample: "", flavor: "js", flags: "" });
  });
  it("falls back to js for unknown flavor", () => {
    const p = parseShareUrl("f=unknown");
    expect(p.flavor).toBe("js");
  });
});

describe("ai-regex-builder LLM helpers", () => {
  it("buildLlmPrompt includes description and flavor", () => {
    const prompt = buildLlmPrompt("match email", "python");
    expect(prompt).toContain("Python");
    expect(prompt).toContain("match email");
  });
  it("parseLlmResult parses a JSON object", () => {
    const out = parseLlmResult('{"pattern":"\\\\d+","flags":"g","explanation":"digits"}');
    expect(out).not.toBeNull();
    expect(out?.pattern).toBe("\\d+");
    expect(out?.flags).toBe("g");
  });
  it("parseLlmResult returns null for invalid JSON", () => {
    expect(parseLlmResult("not json")).toBeNull();
  });
  it("parseLlmResult returns null for missing pattern", () => {
    expect(parseLlmResult('{"flags":"g"}')).toBeNull();
  });
});

// Suppress unused-import lint
export type _Unused = Flavor;
