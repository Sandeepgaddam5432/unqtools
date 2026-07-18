import { describe, it, expect, beforeEach } from "vitest";
import {
  EXAMPLE_BASE_URL,
  CSV_HEADER,
  SLUG_REGEX,
  SHORTENER_MAX_LEN,
  HISTORY_KEY,
  HISTORY_MAX,
  normalizeBaseUrl,
  splitCsvRow,
  parseCsvLinks,
  validateSlug,
  validateUrl,
  generatePrettyUrl,
  validateLinks,
  generatePhpRedirect,
  generateJsRedirect,
  generateHtmlMetaRefresh,
  generateHtaccessRule,
  generateHtaccessBlock,
  generateNginxRule,
  generateNginxBlock,
  generateRobotsTxt,
  generateSlugFromUrl,
  buildTrackingUrl,
  checkUrlShortenerCompat,
  computeSummaryStats,
  renderTextReport,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type AffiliateLinkRecord,
  type CloakedLink,
  type ValidationIssue,
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

describe("affiliate-link-cloaker constants", () => {
  it("exposes example base url", () => {
    expect(EXAMPLE_BASE_URL).toBe("https://example.com/go/");
  });
  it("exposes csv header", () => {
    expect(CSV_HEADER).toBe("slug,affiliate_url");
  });
  it("slug regex matches lowercase, digits, hyphens", () => {
    expect(SLUG_REGEX.test("awesomeservice")).toBe(true);
    expect(SLUG_REGEX.test("awesome-service")).toBe(true);
    expect(SLUG_REGEX.test("awesome123")).toBe(true);
    expect(SLUG_REGEX.test("Awesome_Service")).toBe(false);
    expect(SLUG_REGEX.test("awesome service")).toBe(false);
    expect(SLUG_REGEX.test("")).toBe(false);
  });
  it("shortener threshold is 30", () => {
    expect(SHORTENER_MAX_LEN).toBe(30);
  });
  it("history key + max", () => {
    expect(HISTORY_KEY).toBe("unqtools:affiliate-link-cloaker:history");
    expect(HISTORY_MAX).toBe(20);
  });
});

describe("affiliate-link-cloaker normalizeBaseUrl", () => {
  it("adds trailing slash when missing", () => {
    expect(normalizeBaseUrl("https://example.com/go")).toBe("https://example.com/go/");
  });
  it("keeps single trailing slash", () => {
    expect(normalizeBaseUrl("https://example.com/go/")).toBe("https://example.com/go/");
  });
  it("trims whitespace", () => {
    expect(normalizeBaseUrl("  https://example.com/go/  ")).toBe("https://example.com/go/");
  });
  it("returns empty for empty input", () => {
    expect(normalizeBaseUrl("")).toBe("");
  });
});

describe("affiliate-link-cloaker splitCsvRow", () => {
  it("splits simple", () => {
    expect(splitCsvRow("a,b,c")).toEqual(["a", "b", "c"]);
  });
  it("handles quoted commas", () => {
    expect(splitCsvRow('"a,b",c')).toEqual(["a,b", "c"]);
  });
  it("handles escaped quotes", () => {
    expect(splitCsvRow('"a""b",c')).toEqual(['a"b', "c"]);
  });
});

describe("affiliate-link-cloaker parseCsvLinks", () => {
  it("parses simple two-column rows", () => {
    const csv = "awesomeservice,https://awesomeservice.com/?ref=123\nhosting,https://hosting.com/?ref=abc";
    const links = parseCsvLinks(csv);
    expect(links).toHaveLength(2);
    expect(links[0]).toEqual({
      slug: "awesomeservice",
      affiliateUrl: "https://awesomeservice.com/?ref=123",
    });
  });
  it("skips header row", () => {
    const csv = "slug,affiliate_url\nfoo,https://example.com";
    expect(parseCsvLinks(csv)).toHaveLength(1);
  });
  it("skips blank lines", () => {
    const csv = "foo,https://example.com\n\nbar,https://example.org";
    expect(parseCsvLinks(csv)).toHaveLength(2);
  });
  it("handles quoted affiliate URLs containing commas", () => {
    const csv = 'foo,"https://example.com/?a=1,2"';
    const links = parseCsvLinks(csv);
    expect(links[0].affiliateUrl).toBe("https://example.com/?a=1,2");
  });
  it("returns empty for empty input", () => {
    expect(parseCsvLinks("")).toEqual([]);
  });
  it("skips rows with fewer than 2 fields", () => {
    expect(parseCsvLinks("onlyslug\nfoo,https://example.com")).toHaveLength(1);
  });
});

describe("affiliate-link-cloaker validateSlug", () => {
  it("accepts valid slug", () => {
    expect(validateSlug("awesomeservice")).toBe(true);
    expect(validateSlug("awesome-service-99")).toBe(true);
  });
  it("rejects uppercase", () => {
    expect(validateSlug("Awesome")).toBe(false);
  });
  it("rejects underscore", () => {
    expect(validateSlug("awesome_service")).toBe(false);
  });
  it("rejects empty", () => {
    expect(validateSlug("")).toBe(false);
  });
});

describe("affiliate-link-cloaker validateUrl", () => {
  it("accepts https", () => {
    expect(validateUrl("https://example.com")).toBe(true);
  });
  it("accepts http", () => {
    expect(validateUrl("http://example.com/?ref=1")).toBe(true);
  });
  it("rejects ftp", () => {
    expect(validateUrl("ftp://example.com")).toBe(false);
  });
  it("rejects malformed", () => {
    expect(validateUrl("not a url")).toBe(false);
    expect(validateUrl("")).toBe(false);
  });
});

describe("affiliate-link-cloaker generatePrettyUrl", () => {
  it("joins base and slug", () => {
    expect(generatePrettyUrl("https://example.com/go/", "foo")).toBe("https://example.com/go/foo");
  });
  it("normalizes missing trailing slash", () => {
    expect(generatePrettyUrl("https://example.com/go", "foo")).toBe("https://example.com/go/foo");
  });
});

describe("affiliate-link-cloaker validateLinks", () => {
  it("marks valid records", () => {
    const records: AffiliateLinkRecord[] = [
      { slug: "foo", affiliateUrl: "https://example.com/?ref=1" },
    ];
    const links = validateLinks("https://example.com/go/", records);
    expect(links[0].valid).toBe(true);
    expect(links[0].issues).toEqual([]);
    expect(links[0].prettyUrl).toBe("https://example.com/go/foo");
  });
  it("flags duplicate slugs", () => {
    const records: AffiliateLinkRecord[] = [
      { slug: "foo", affiliateUrl: "https://example.com/?ref=1" },
      { slug: "foo", affiliateUrl: "https://example.com/?ref=2" },
    ];
    const links = validateLinks("https://example.com/go/", records);
    expect(links[0].valid).toBe(false);
    expect(links[1].valid).toBe(false);
    expect(links[0].issues.some((i) => i.message === "Duplicate slug")).toBe(true);
  });
  it("flags bad slug format", () => {
    const records: AffiliateLinkRecord[] = [
      { slug: "Bad_Slug", affiliateUrl: "https://example.com" },
    ];
    const links = validateLinks("https://example.com/go/", records);
    expect(links[0].valid).toBe(false);
    expect(links[0].issues.some((i) => i.field === "slug")).toBe(true);
  });
  it("flags bad affiliate URL", () => {
    const records: AffiliateLinkRecord[] = [
      { slug: "foo", affiliateUrl: "not-a-url" },
    ];
    const links = validateLinks("https://example.com/go/", records);
    expect(links[0].valid).toBe(false);
    expect(links[0].issues.some((i) => i.field === "affiliateUrl")).toBe(true);
  });
  it("handles empty list", () => {
    expect(validateLinks("https://example.com/go/", [])).toEqual([]);
  });
});

describe("affiliate-link-cloaker redirect generators", () => {
  it("generatePhpRedirect contains header + exit", () => {
    const php = generatePhpRedirect("https://example.com/?ref=1");
    expect(php).toContain("<?php");
    expect(php).toContain('header("Location: https://example.com/?ref=1")');
    expect(php).toContain("exit");
    expect(php).toContain("?>");
  });
  it("generateJsRedirect sets window.location.href", () => {
    const js = generateJsRedirect("https://example.com/?ref=1");
    expect(js).toContain("<script>");
    expect(js).toContain('window.location.href = "https://example.com/?ref=1"');
    expect(js).toContain("</script>");
  });
  it("generateHtmlMetaRefresh emits meta tag with 0 second delay", () => {
    const meta = generateHtmlMetaRefresh("https://example.com/?ref=1");
    expect(meta).toContain('http-equiv="refresh"');
    expect(meta).toContain('content="0; url=https://example.com/?ref=1"');
  });
});

describe("affiliate-link-cloaker htaccess", () => {
  it("generateHtaccessRule uses R=301,L", () => {
    const rule = generateHtaccessRule("foo", "https://example.com");
    expect(rule).toBe("RewriteRule ^foo/?$ https://example.com [R=301,L]");
  });
  it("generateHtaccessBlock emits header + rules", () => {
    const records: CloakedLink[] = [
      { slug: "foo", affiliateUrl: "https://example.com", prettyUrl: "", valid: true, issues: [] },
      { slug: "bar", affiliateUrl: "https://example.org", prettyUrl: "", valid: true, issues: [] },
    ];
    const block = generateHtaccessBlock("https://example.com/go/", records);
    expect(block).toContain("RewriteEngine On");
    expect(block).toContain("RewriteRule ^foo/?$");
    expect(block).toContain("RewriteRule ^bar/?$");
  });
  it("generateHtaccessBlock skips invalid records", () => {
    const records: CloakedLink[] = [
      { slug: "foo", affiliateUrl: "https://example.com", prettyUrl: "", valid: true, issues: [] },
      { slug: "Bad", affiliateUrl: "https://example.org", prettyUrl: "", valid: false, issues: [{ field: "slug", message: "Bad" } as ValidationIssue] },
    ];
    const block = generateHtaccessBlock("https://example.com/go/", records);
    expect(block).toContain("^foo/?$");
    expect(block).not.toContain("^Bad/?$");
  });
});

describe("affiliate-link-cloaker nginx", () => {
  it("generateNginxRule emits location + return 301", () => {
    const rule = generateNginxRule("foo", "https://example.com");
    expect(rule).toBe("location = /go/foo { return 301 https://example.com; }");
  });
  it("generateNginxBlock wraps in location /go/ block", () => {
    const records: CloakedLink[] = [
      { slug: "foo", affiliateUrl: "https://example.com", prettyUrl: "", valid: true, issues: [] },
    ];
    const block = generateNginxBlock("https://example.com/go/", records);
    expect(block).toContain("location /go/ {");
    expect(block).toContain("location = /go/foo");
    expect(block.endsWith("}")).toBe(true);
  });
});

describe("affiliate-link-cloaker robots.txt", () => {
  it("emits Disallow /go/ for default base", () => {
    const r = generateRobotsTxt("https://example.com/go/");
    expect(r).toContain("User-agent: *");
    expect(r).toContain("Disallow: /go/");
  });
  it("uses the path of the base url", () => {
    const r = generateRobotsTxt("https://example.com/recommends/");
    expect(r).toContain("Disallow: /recommends/");
  });
  it("falls back to /go/ on invalid url", () => {
    const r = generateRobotsTxt("not-a-url");
    expect(r).toContain("Disallow: /go/");
  });
});

describe("affiliate-link-cloaker generateSlugFromUrl", () => {
  it("extracts hostname first label", () => {
    expect(generateSlugFromUrl("https://awesomeservice.com/?ref=1")).toBe("awesomeservice");
  });
  it("strips leading www.", () => {
    expect(generateSlugFromUrl("https://www.hosting.com/")).toBe("hosting");
  });
  it("lowercases", () => {
    expect(generateSlugFromUrl("https://AwesomeService.com/")).toBe("awesomeservice");
  });
  it("strips non-slug chars", () => {
    expect(generateSlugFromUrl("https://my-service.io/")).toBe("my-service");
  });
  it("returns empty for invalid url", () => {
    expect(generateSlugFromUrl("not-a-url")).toBe("");
    expect(generateSlugFromUrl("")).toBe("");
  });
});

describe("affiliate-link-cloaker buildTrackingUrl", () => {
  it("appends single param", () => {
    const u = buildTrackingUrl("https://example.com/go/foo", { src: "newsletter" });
    expect(u).toBe("https://example.com/go/foo?src=newsletter");
  });
  it("appends multiple params", () => {
    const u = buildTrackingUrl("https://example.com/go/foo", { src: "newsletter", utm_medium: "email" });
    expect(u).toContain("src=newsletter");
    expect(u).toContain("utm_medium=email");
  });
  it("returns unchanged when no params", () => {
    expect(buildTrackingUrl("https://example.com/go/foo", {})).toBe("https://example.com/go/foo");
  });
  it("uses & separator when pretty url already has query", () => {
    const u = buildTrackingUrl("https://example.com/go/foo?x=1", { src: "nl" });
    expect(u).toBe("https://example.com/go/foo?x=1&src=nl");
  });
});

describe("affiliate-link-cloaker checkUrlShortenerCompat", () => {
  it("marks short URLs compatible", () => {
    const r = checkUrlShortenerCompat("https://ex.com/go/foo");
    expect(r.compatible).toBe(true);
    expect(r.length).toBeLessThanOrEqual(30);
  });
  it("marks long URLs incompatible", () => {
    const r = checkUrlShortenerCompat("https://example.com/go/this-is-a-very-long-slug-name");
    expect(r.compatible).toBe(false);
    expect(r.maxLength).toBe(30);
  });
});

describe("affiliate-link-cloaker computeSummaryStats", () => {
  it("computes valid/invalid counts", () => {
    const records: AffiliateLinkRecord[] = [
      { slug: "foo", affiliateUrl: "https://example.com" },
      { slug: "bar", affiliateUrl: "not-a-url" },
    ];
    const links = validateLinks("https://example.com/go/", records);
    const stats = computeSummaryStats(links);
    expect(stats.total).toBe(2);
    expect(stats.valid).toBe(1);
    expect(stats.invalid).toBe(1);
    expect(stats.urlIssues).toBe(1);
  });
  it("counts distinct slug conflicts", () => {
    const records: AffiliateLinkRecord[] = [
      { slug: "foo", affiliateUrl: "https://example.com" },
      { slug: "foo", affiliateUrl: "https://example.org" },
      { slug: "foo", affiliateUrl: "https://example.net" },
    ];
    const links = validateLinks("https://example.com/go/", records);
    const stats = computeSummaryStats(links);
    expect(stats.slugConflicts).toBe(1); // one distinct slug duplicated
  });
  it("counts slug format issues", () => {
    const records: AffiliateLinkRecord[] = [
      { slug: "Bad_Slug", affiliateUrl: "https://example.com" },
      { slug: "Also Bad", affiliateUrl: "https://example.org" },
    ];
    const links = validateLinks("https://example.com/go/", records);
    const stats = computeSummaryStats(links);
    expect(stats.slugFormatIssues).toBe(2);
  });
  it("handles empty list", () => {
    const stats = computeSummaryStats([]);
    expect(stats.total).toBe(0);
    expect(stats.valid).toBe(0);
    expect(stats.invalid).toBe(0);
  });
});

describe("affiliate-link-cloaker renderTextReport", () => {
  it("includes all section headers", () => {
    const records: AffiliateLinkRecord[] = [
      { slug: "foo", affiliateUrl: "https://example.com" },
    ];
    const links = validateLinks("https://example.com/go/", records);
    const report = renderTextReport("https://example.com/go/", links);
    expect(report).toContain("Pretty URLs");
    expect(report).toContain("PHP redirects");
    expect(report).toContain("JavaScript redirects");
    expect(report).toContain("HTML meta refresh");
    expect(report).toContain(".htaccess");
    expect(report).toContain("nginx");
    expect(report).toContain("robots.txt");
  });
  it("includes pretty url and affiliate url", () => {
    const records: AffiliateLinkRecord[] = [
      { slug: "foo", affiliateUrl: "https://example.com/?ref=1" },
    ];
    const links = validateLinks("https://example.com/go/", records);
    const report = renderTextReport("https://example.com/go/", links);
    expect(report).toContain("https://example.com/go/foo");
    expect(report).toContain("https://example.com/?ref=1");
  });
  it("skips invalid links", () => {
    const records: AffiliateLinkRecord[] = [
      { slug: "foo", affiliateUrl: "https://example.com" },
      { slug: "Bad", affiliateUrl: "https://example.org" },
    ];
    const links = validateLinks("https://example.com/go/", records);
    const report = renderTextReport("https://example.com/go/", links);
    expect(report).toContain("^foo/?$");
    expect(report).not.toContain("^Bad/?$");
  });
});

describe("affiliate-link-cloaker renderCsv", () => {
  it("renders header", () => {
    expect(renderCsv([])).toBe("slug,affiliate_url");
  });
  it("renders link rows", () => {
    const records: AffiliateLinkRecord[] = [
      { slug: "foo", affiliateUrl: "https://example.com" },
    ];
    const links = validateLinks("https://example.com/go/", records);
    const csv = renderCsv(links);
    expect(csv).toContain("foo,https://example.com,https://example.com/go/foo");
  });
  it("escapes commas in URLs", () => {
    const records: AffiliateLinkRecord[] = [
      { slug: "foo", affiliateUrl: "https://example.com/?a=1,2" },
    ];
    const links = validateLinks("https://example.com/go/", records);
    const csv = renderCsv(links);
    expect(csv).toContain('"https://example.com/?a=1,2"');
  });
});

describe("affiliate-link-cloaker history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, baseUrl: "https://example.com/go/", linkCount: 5, validCount: 5 });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, baseUrl: "https://example.com/go/", linkCount: 1, validCount: 1 });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, baseUrl: "https://example.com/go/", linkCount: 1, validCount: 1 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("affiliate-link-cloaker shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("https://example.com/go/", "foo,https://example.com");
    expect(url).toContain("base=");
    expect(url).toContain("links=");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const params = new URLSearchParams();
    params.set("base", "https://example.com/go/");
    params.set("links", "foo,https://example.com");
    const p = parseShareUrl(`#${params.toString()}`);
    expect(p.baseUrl).toBe("https://example.com/go/");
    expect(p.csvText).toBe("foo,https://example.com");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({ baseUrl: "", csvText: "" });
  });
  it("handles hash without leading #", () => {
    const params = new URLSearchParams();
    params.set("base", "https://example.com/go/");
    const p = parseShareUrl(params.toString());
    expect(p.baseUrl).toBe("https://example.com/go/");
  });
});
