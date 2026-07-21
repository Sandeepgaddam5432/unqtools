import { describe, it, expect, beforeEach } from "vitest";
import {
  RULES,
  RULE_COUNT,
  DEFAULT_CONFIG,
  PRETTIER_PRESET,
  reconciledPreset,
  SAMPLE_DOC,
  lint,
  autoFix,
  format,
  disableComment,
  enableComment,
  diffLines,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  isRuleId,
  ruleMeta,
  type LintConfig,
  type RuleId,
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

describe("markdown-linter constants", () => {
  it("has 25+ rules", () => {
    expect(RULE_COUNT).toBeGreaterThanOrEqual(25);
  });
  it("every rule has stable ID, name, description, severity, fixable flag", () => {
    for (const r of RULES) {
      expect(r.id).toMatch(/^MD\d{3}$/);
      expect(typeof r.name).toBe("string");
      expect(r.name.length).toBeGreaterThan(0);
      expect(typeof r.description).toBe("string");
      expect(["error", "warning", "info"]).toContain(r.severity);
      expect(typeof r.fixable).toBe("boolean");
    }
  });
  it("default config has every rule key", () => {
    for (const r of RULES) {
      const key = r.id.toLowerCase();
      expect(DEFAULT_CONFIG).toHaveProperty(key);
    }
  });
  it("Prettier preset disables MD013, MD033, MD034", () => {
    expect(PRETTIER_PRESET.md013).toBe(false);
    expect(PRETTIER_PRESET.md033).toBe(false);
    expect(PRETTIER_PRESET.md034).toBe(false);
  });
  it("reconciledPreset returns a config object", () => {
    const c = reconciledPreset();
    expect(c).toBeDefined();
    expect(c.md001).toBe(true);
  });
});

describe("markdown-linter lint basic rules", () => {
  it("MD018 detects missing space after #", () => {
    const r = lint("#My Heading\n");
    expect(r.violations.some((v) => v.rule === "MD018")).toBe(true);
  });
  it("MD019 detects multiple spaces after #", () => {
    const r = lint("#  My Heading\n");
    expect(r.violations.some((v) => v.rule === "MD019")).toBe(true);
  });
  it("MD004 detects mixed list markers", () => {
    const r = lint("- a\n* b\n+ c\n");
    expect(r.violations.some((v) => v.rule === "MD004")).toBe(true);
  });
  it("MD029 detects ordered list not starting at 1", () => {
    const r = lint("3. a\n4. b\n5. c\n");
    expect(r.violations.some((v) => v.rule === "MD029")).toBe(true);
  });
  it("MD009 detects trailing spaces", () => {
    const r = lint("hello   \n");
    expect(r.violations.some((v) => v.rule === "MD009")).toBe(true);
  });
  it("MD010 detects hard tabs", () => {
    const r = lint("\tindented\n");
    expect(r.violations.some((v) => v.rule === "MD010")).toBe(true);
  });
  it("MD013 detects long lines", () => {
    const longLine = "a".repeat(120);
    const r = lint(longLine + "\n");
    expect(r.violations.some((v) => v.rule === "MD013")).toBe(true);
  });
  it("MD025 detects multiple H1s", () => {
    const r = lint("# One\n\n# Two\n");
    expect(r.violations.some((v) => v.rule === "MD025")).toBe(true);
  });
  it("MD001 detects heading level jumps", () => {
    const r = lint("# H1\n\n### H3\n");
    expect(r.violations.some((v) => v.rule === "MD001")).toBe(true);
  });
  it("MD041 detects first line not a top heading", () => {
    const r = lint("Hello world.\n\n## Heading\n");
    expect(r.violations.some((v) => v.rule === "MD041")).toBe(true);
  });
  it("MD047 detects missing trailing newline", () => {
    const r = lint("# Heading\nbody");
    expect(r.violations.some((v) => v.rule === "MD047")).toBe(true);
  });
  it("MD040 detects fenced code without language", () => {
    const r = lint("```\ncode\n```\n");
    expect(r.violations.some((v) => v.rule === "MD040")).toBe(true);
  });
  it("MD034 detects bare URLs", () => {
    const r = lint("Visit https://example.com today.\n");
    expect(r.violations.some((v) => v.rule === "MD034")).toBe(true);
  });
  it("MD033 detects inline HTML (when enabled)", () => {
    const cfg: LintConfig = { ...DEFAULT_CONFIG, md033: true, noInlineHtmlTags: "" };
    const r = lint("<div>html</div>\n", cfg);
    expect(r.violations.some((v) => v.rule === "MD033")).toBe(true);
  });
  it("MD012 detects multiple consecutive blanks", () => {
    const r = lint("a\n\n\n\nb\n");
    expect(r.violations.some((v) => v.rule === "MD012")).toBe(true);
  });
  it("MD022 detects missing blanks around headings", () => {
    const r = lint("paragraph\n## Heading\n");
    expect(r.violations.some((v) => v.rule === "MD022")).toBe(true);
  });
  it("MD035 detects inconsistent hr style", () => {
    const cfg: LintConfig = { ...DEFAULT_CONFIG, hrStyle: "---" };
    const r = lint("text\n***\n", cfg);
    expect(r.violations.some((v) => v.rule === "MD035")).toBe(true);
  });
  it("MD026 detects trailing punctuation in heading", () => {
    const r = lint("## Heading.\n");
    expect(r.violations.some((v) => v.rule === "MD026")).toBe(true);
  });
  it("returns empty for empty source", () => {
    const r = lint("");
    expect(r.total).toBe(0);
  });
  it("computes summary correctly", () => {
    const r = lint("#  Bad heading.\n");
    expect(r.total).toBeGreaterThan(0);
    expect(r.errors + r.warnings).toBeGreaterThan(0);
    expect(r.byRule["MD019"]).toBeGreaterThanOrEqual(1);
  });
});

describe("markdown-linter lint sample doc", () => {
  it("finds violations in the sample doc", () => {
    const r = lint(SAMPLE_DOC);
    expect(r.total).toBeGreaterThan(5);
  });
  it("sample doc has at least one fixable violation", () => {
    const r = lint(SAMPLE_DOC);
    expect(r.fixable).toBeGreaterThan(0);
  });
});

describe("markdown-linter autoFix", () => {
  it("removes trailing spaces", () => {
    const r = autoFix("hello   \n");
    expect(r.output).toBe("hello\n");
    expect(r.fixesApplied).toBeGreaterThan(0);
  });
  it("converts hard tabs to spaces", () => {
    const r = autoFix("\tindented\n");
    expect(r.output).toBe("    indented\n");
  });
  it("normalizes atx heading spaces", () => {
    const r = autoFix("#  Heading\n");
    expect(r.output).toBe("# Heading\n");
  });
  it("converts setext headings to atx", () => {
    const r = autoFix("Heading\n======\n");
    expect(r.output).toContain("# Heading");
  });
  it("normalizes unordered list marker to dash", () => {
    const r = autoFix("* item\n");
    expect(r.output).toBe("- item\n");
  });
  it("renumbers ordered lists to 1, 2, 3", () => {
    const r = autoFix("3. a\n3. b\n3. c\n");
    expect(r.output).toContain("1. a");
    expect(r.output).toContain("2. b");
    expect(r.output).toContain("3. c");
  });
  it("collapses multiple blank lines", () => {
    const r = autoFix("a\n\n\n\nb\n");
    expect(r.output).toBe("a\n\nb\n");
  });
  it("adds default language to fenced code", () => {
    const r = autoFix("```\ncode\n```\n");
    expect(r.output).toContain("```text");
  });
  it("ensures single trailing newline", () => {
    const r = autoFix("# Heading");
    expect(r.output.endsWith("\n")).toBe(true);
  });
  it("removes trailing punctuation from headings", () => {
    const r = autoFix("## Heading.\n");
    expect(r.output).toBe("## Heading\n");
  });
  it("normalizes horizontal rule style", () => {
    const cfg: LintConfig = { ...DEFAULT_CONFIG, hrStyle: "---" };
    const r = autoFix("***\n", cfg);
    expect(r.output).toContain("---");
  });
  it("reduces violation count after fix", () => {
    const before = lint(SAMPLE_DOC);
    const after = autoFix(SAMPLE_DOC);
    expect(after.remainingViolations.total).toBeLessThan(before.total);
  });
});

describe("markdown-linter format", () => {
  it("uses Prettier-reconciled preset", () => {
    const r = format("long " + "a".repeat(120) + " line\n", DEFAULT_CONFIG);
    expect(r.configUsed.md013).toBe(false);
    // Should not flag the long line because MD013 is disabled
    expect(r.remainingViolations.byRule["MD013"]).toBeUndefined();
  });
  it("produces clean output", () => {
    const r = format("#  Hello.\n\n\n\nworld\n");
    expect(r.output).toContain("# Hello");
    expect(r.output).toContain("world\n");
  });
});

describe("markdown-linter disable/enable comments", () => {
  it("generates all-disable comment", () => {
    const c = disableComment("all");
    expect(c).toBe("<!-- markdownlint-disable -->");
  });
  it("generates rule-specific disable comment", () => {
    const c = disableComment(["MD001", "MD013"]);
    expect(c).toBe("<!-- markdownlint-disable MD001 MD013 -->");
  });
  it("generates enable comment", () => {
    const c = enableComment(["MD001"]);
    expect(c).toBe("<!-- markdownlint-enable MD001 -->");
  });
});

describe("markdown-linter diffLines", () => {
  it("detects added lines", () => {
    const d = diffLines("a\n", "a\nb\n");
    expect(d.some((l) => l.type === "added")).toBe(true);
  });
  it("detects removed lines", () => {
    const d = diffLines("a\nb\n", "a\n");
    expect(d.some((l) => l.type === "removed")).toBe(true);
  });
  it("marks unchanged as context", () => {
    const d = diffLines("a\nb\n", "a\nb\n");
    expect(d.every((l) => l.type === "context")).toBe(true);
  });
});

describe("markdown-linter history", () => {
  it("loads empty initially", () => { expect(loadHistory()).toEqual([]); });
  it("saves and loads", () => {
    saveHistory({ ts: 1, total: 5, fixable: 3, errors: 2, warnings: 3, preview: "..." });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, total: 1, fixable: 0, errors: 0, warnings: 1, preview: "..." });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, total: 1, fixable: 0, errors: 0, warnings: 1, preview: "..." });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("markdown-linter shareable URL", () => {
  it("builds share URL without window", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl(DEFAULT_CONFIG);
    // Default config — no rules param (since all enabled)
    expect(url).toContain("?");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("encodes non-default line length", () => {
    const cfg: LintConfig = { ...DEFAULT_CONFIG, lineLength: 120 };
    const url = buildShareUrl(cfg);
    expect(url).toContain("ll=120");
  });
  it("encodes disabled rules", () => {
    const cfg: LintConfig = { ...DEFAULT_CONFIG, md013: false };
    const url = buildShareUrl(cfg);
    expect(url).toContain("rules=");
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("ll=120&hs=setext&um=*");
    expect(p.lineLength).toBe(120);
    expect(p.headingStyle).toBe("setext");
    expect(p.ulMarker).toBe("*");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("filters unknown rule ids", () => {
    const p = parseShareUrl("rules=MD001,MD999");
    expect(p.md001).toBe(true);
  });
});

describe("markdown-linter isRuleId + ruleMeta", () => {
  it("validates rule ids", () => {
    expect(isRuleId("MD001")).toBe(true);
    expect(isRuleId("md001")).toBe(false);
    expect(isRuleId("MD999")).toBe(false);
  });
  it("returns metadata for a rule", () => {
    const m = ruleMeta("MD013");
    expect(m.id).toBe("MD013");
    expect(m.name).toBe("line-length");
  });
});

// Suppress unused-import lint
export type _Unused = RuleId | LintConfig;
