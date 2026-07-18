import { describe, it, expect, beforeEach } from "vitest";
import {
  extractAnchorTags,
  extractHref,
  extractLinkText,
  extractRel,
  hasTargetBlank,
  extractDomain,
  classifyLink,
  resolveUrl,
  detectIssues,
  parseAnchor,
  parseAll,
  analyze,
  renderCsv,
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

describe("broken-link-checker extractAnchorTags", () => {
  it("extracts <a> tags", () => {
    const html = `<a href="x">1</a><a href="y">2</a>`;
    expect(extractAnchorTags(html)).toHaveLength(2);
  });
  it("returns empty for no matches", () => {
    expect(extractAnchorTags("<div>nothing</div>")).toEqual([]);
  });
  it("handles case-insensitive", () => {
    expect(extractAnchorTags("<A HREF='x'>y</A>")).toHaveLength(1);
  });
});

describe("broken-link-checker extractHref", () => {
  it("extracts double-quoted href", () => {
    expect(extractHref(`<a href="https://example.com">x</a>`)).toBe("https://example.com");
  });
  it("extracts single-quoted href", () => {
    expect(extractHref(`<a href='https://example.com'>x</a>`)).toBe("https://example.com");
  });
  it("extracts unquoted href", () => {
    expect(extractHref(`<a href=https://example.com>x</a>`)).toBe("https://example.com");
  });
  it("returns null when no href", () => {
    expect(extractHref(`<a name="anchor">x</a>`)).toBeNull();
  });
});

describe("broken-link-checker extractLinkText", () => {
  it("extracts text from anchor pair", () => {
    const html = `<a href="x">Click here</a>`;
    const anchor = `<a href="x">`;
    expect(extractLinkText(html, anchor)).toBe("Click here");
  });
  it("strips nested tags", () => {
    const html = `<a href="x"><strong>Bold</strong> link</a>`;
    const anchor = `<a href="x">`;
    expect(extractLinkText(html, anchor)).toBe("Bold link");
  });
  it("returns empty when no closing tag", () => {
    expect(extractLinkText("<a href='x'>", "<a href='x'>")).toBe("");
  });
});

describe("broken-link-checker extractRel / hasTargetBlank", () => {
  it("extracts rel values", () => {
    expect(extractRel(`<a rel="nofollow sponsored">x</a>`)).toEqual(["nofollow", "sponsored"]);
  });
  it("returns empty when no rel", () => {
    expect(extractRel(`<a href="x">y</a>`)).toEqual([]);
  });
  it("detects target=_blank", () => {
    expect(hasTargetBlank(`<a target="_blank" href="x">y</a>`)).toBe(true);
    expect(hasTargetBlank(`<a href="x">y</a>`)).toBe(false);
  });
});

describe("broken-link-checker extractDomain", () => {
  it("strips protocol and www", () => {
    expect(extractDomain("https://www.example.com/path")).toBe("example.com");
  });
  it("handles bare domain", () => {
    expect(extractDomain("example.com")).toBe("example.com");
  });
});

describe("broken-link-checker classifyLink", () => {
  it("classifies empty", () => {
    expect(classifyLink("")).toBe("empty");
    expect(classifyLink("   ")).toBe("empty");
  });
  it("classifies javascript", () => {
    expect(classifyLink("javascript:void(0)")).toBe("javascript");
  });
  it("classifies mailto", () => {
    expect(classifyLink("mailto:test@example.com")).toBe("mailto");
  });
  it("classifies tel", () => {
    expect(classifyLink("tel:+15551234567")).toBe("tel");
  });
  it("classifies anchor", () => {
    expect(classifyLink("#section")).toBe("anchor");
  });
  it("classifies external with base", () => {
    expect(classifyLink("https://other.com/x", "https://my.com")).toBe("external");
  });
  it("classifies internal with base", () => {
    expect(classifyLink("https://my.com/x", "https://my.com")).toBe("internal");
  });
  it("classifies external without base", () => {
    expect(classifyLink("https://other.com/x")).toBe("external");
  });
  it("classifies relative-no-base without base", () => {
    expect(classifyLink("/about")).toBe("relative-no-base");
    expect(classifyLink("page.html")).toBe("relative-no-base");
  });
  it("classifies relative as internal with base", () => {
    expect(classifyLink("/about", "https://my.com")).toBe("internal");
  });
});

describe("broken-link-checker resolveUrl", () => {
  it("resolves relative to absolute", () => {
    expect(resolveUrl("/about", "https://example.com")).toBe("https://example.com/about");
  });
  it("returns undefined for missing base", () => {
    expect(resolveUrl("/about")).toBeUndefined();
  });
  it("returns undefined for invalid URL", () => {
    expect(resolveUrl("%%", "https://example.com")).toBeUndefined();
  });
});

describe("broken-link-checker detectIssues", () => {
  it("flags empty href", () => {
    const issues = detectIssues("", "empty");
    expect(issues.some((i) => i.type === "empty-href")).toBe(true);
  });
  it("flags javascript: as warning", () => {
    const issues = detectIssues("javascript:void(0)", "javascript");
    expect(issues.some((i) => i.type === "javascript-only" && i.severity === "warning")).toBe(true);
  });
  it("flags anchor-only as warning", () => {
    const issues = detectIssues("#section", "anchor");
    expect(issues.some((i) => i.type === "anchor-only")).toBe(true);
  });
  it("flags relative-no-base as warning", () => {
    const issues = detectIssues("/about", "relative-no-base");
    expect(issues.some((i) => i.type === "relative-no-base")).toBe(true);
  });
  it("flags external without protocol", () => {
    const issues = detectIssues("example.com/x", "external");
    expect(issues.some((i) => i.type === "missing-protocol")).toBe(true);
  });
  it("passes clean external", () => {
    const issues = detectIssues("https://example.com/x", "external");
    expect(issues).toHaveLength(0);
  });
});

describe("broken-link-checker parseAnchor", () => {
  it("parses a full anchor", () => {
    const html = `<a href="https://example.com" target="_blank" rel="nofollow">Example</a>`;
    const anchor = `<a href="https://example.com" target="_blank" rel="nofollow">`;
    const info = parseAnchor(anchor, html);
    expect(info.href).toBe("https://example.com");
    expect(info.text).toBe("Example");
    expect(info.type).toBe("external");
    expect(info.targetBlank).toBe(true);
    expect(info.relAttributes).toContain("nofollow");
  });
});

describe("broken-link-checker parseAll", () => {
  it("parses all anchors", () => {
    const html = `<a href="/internal">Int</a><a href="https://ext.com">Ext</a><a href="#">Anchor</a>`;
    const links = parseAll(html, "https://my.com");
    expect(links).toHaveLength(3);
    expect(links[0].type).toBe("internal");
    expect(links[1].type).toBe("external");
    expect(links[2].type).toBe("anchor");
  });
});

describe("broken-link-checker analyze", () => {
  it("computes summary stats", () => {
    const html = `<a href="/a">1</a><a href="/b">2</a><a href="https://ext.com/x">3</a><a href="">4</a><a href="#">5</a>`;
    const r = analyze(html, "https://my.com");
    expect(r.total).toBe(5);
    expect(r.byType.internal).toBe(2);
    expect(r.byType.external).toBe(1);
    expect(r.byType.empty).toBe(1);
    expect(r.byType.anchor).toBe(1);
    expect(r.linksWithIssues).toBeGreaterThan(0);
  });
  it("computes unique external domains", () => {
    const html = `<a href="https://a.com/x">1</a><a href="https://a.com/y">2</a><a href="https://b.com/z">3</a>`;
    const r = analyze(html);
    expect(r.uniqueDomains).toBe(2);
    expect(r.topExternalDomains[0].domain).toBe("a.com");
    expect(r.topExternalDomains[0].count).toBe(2);
  });
  it("handles empty input", () => {
    const r = analyze("");
    expect(r.total).toBe(0);
  });
});

describe("broken-link-checker renderCsv", () => {
  it("produces CSV with summary + links", () => {
    const r = analyze(`<a href="/x">1</a>`, "https://my.com");
    const csv = renderCsv(r);
    expect(csv).toContain("total,1");
    expect(csv).toContain("/x");
  });
});

describe("broken-link-checker renderReport", () => {
  it("produces human-readable report", () => {
    const r = analyze(`<a href="/x">1</a>`, "https://my.com");
    const report = renderReport(r);
    expect(report).toContain("Broken Link Checker Report");
    expect(report).toContain("Total links:");
  });
});

describe("broken-link-checker history", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, total: 10, internal: 5, external: 5, issuesCount: 2, linksWithIssues: 2 });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, total: 1, internal: 1, external: 0, issuesCount: 0, linksWithIssues: 0 });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, total: 1, internal: 1, external: 0, issuesCount: 0, linksWithIssues: 0 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("broken-link-checker shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("<html></html>", "https://my.com");
    expect(url).toContain("data=");
    expect(url).toContain("base=");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const parsed = parseShareUrl("data=%3Chtml%3E&base=https%3A%2F%2Fmy.com");
    expect(parsed.data).toBe("<html>");
    expect(parsed.base).toBe("https://my.com");
  });
  it("returns empty for empty hash", () => {
    expect(parseShareUrl("")).toEqual({ data: "", base: "" });
  });
});
