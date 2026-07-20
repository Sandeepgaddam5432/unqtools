import { describe, it, expect, beforeEach } from "vitest";
import {
  HISTORY_KEY,
  HISTORY_MAX,
  STATUS_LABELS,
  STATUS_DESCRIPTIONS,
  RULE_TYPE_LABELS,
  DEFAULT_DOMAIN,
  DEFAULT_PAIRS,
  DEFAULT_REWRITE,
  DEFAULT_CANONICAL,
  DEFAULT_HTTPS,
  DEFAULT_HOTLINK,
  DEFAULT_ERROR_PAGES,
  isValidUrl,
  isValidDomain,
  isValidIp,
  isValidErrorCode,
  normalizePath,
  escapeRegex,
  apachePatternToJs,
  apacheTargetToJs,
  tryCompileRegex,
  applyRule,
  parseBulkPairs,
  renderBulkPairs,
  buildSimpleRedirect,
  buildRedirectMatch,
  buildRewriteRule,
  buildCanonical,
  buildHttpsRedirect,
  buildHotlink,
  buildErrorPage,
  buildIpRule,
  generateConfig,
  renderHtaccess,
  renderCsv,
  detectLoops,
  testUrl,
  testUrls,
  importHtaccess,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  renderLlmResult,
  type RedirectStatus,
  type RedirectPair,
  type RuleType,
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

describe("ai-htaccess constants", () => {
  it("has 3 status codes", () => {
    expect(Object.keys(STATUS_LABELS)).toHaveLength(3);
    expect(STATUS_LABELS[301]).toContain("Permanent");
    expect(STATUS_LABELS[302]).toContain("Temporary");
    expect(STATUS_LABELS[307]).toContain("preserve method");
  });
  it("has descriptions for each status", () => {
    expect(Object.keys(STATUS_DESCRIPTIONS)).toHaveLength(3);
  });
  it("has labels for each rule type", () => {
    expect(Object.keys(RULE_TYPE_LABELS).length).toBe(8);
  });
  it("has a default domain", () => {
    expect(DEFAULT_DOMAIN).toBe("example.com");
  });
  it("has default pairs", () => {
    expect(DEFAULT_PAIRS.length).toBeGreaterThan(0);
  });
  it("has default rewrite options with a valid pattern", () => {
    expect(DEFAULT_REWRITE.pattern).toContain("^");
  });
  it("history key contains tool id", () => {
    expect(HISTORY_KEY).toContain("ai-htaccess-redirect-generator");
  });
  it("HISTORY_MAX is 20", () => {
    expect(HISTORY_MAX).toBe(20);
  });
});

describe("ai-htaccess validators", () => {
  it("isValidUrl accepts paths", () => {
    expect(isValidUrl("/old-page")).toBe(true);
  });
  it("isValidUrl accepts full URLs", () => {
    expect(isValidUrl("https://example.com/new")).toBe(true);
  });
  it("isValidUrl rejects shell metachars", () => {
    expect(isValidUrl("/old;rm -rf /")).toBe(false);
    expect(isValidUrl("/page\nmalicious")).toBe(false);
  });
  it("isValidUrl rejects empty", () => {
    expect(isValidUrl("")).toBe(false);
  });
  it("isValidDomain accepts example.com", () => {
    expect(isValidDomain("example.com")).toBe(true);
    expect(isValidDomain("www.example.com")).toBe(true);
  });
  it("isValidDomain rejects bad", () => {
    expect(isValidDomain("not a domain")).toBe(false);
    expect(isValidDomain("")).toBe(false);
  });
  it("isValidIp accepts plain IPv4", () => {
    expect(isValidIp("192.168.1.5")).toBe(true);
  });
  it("isValidIp accepts CIDR", () => {
    expect(isValidIp("10.0.0.0/24")).toBe(true);
  });
  it("isValidIp rejects bad", () => {
    expect(isValidIp("999.999.999.999")).toBe(false);
    expect(isValidIp("not an ip")).toBe(false);
  });
  it("isValidErrorCode accepts 4xx and 5xx", () => {
    expect(isValidErrorCode(404)).toBe(true);
    expect(isValidErrorCode(500)).toBe(true);
  });
  it("isValidErrorCode rejects 200, 301, etc", () => {
    expect(isValidErrorCode(200)).toBe(false);
    expect(isValidErrorCode(301)).toBe(false);
  });
});

describe("ai-htaccess normalizePath", () => {
  it("adds leading slash", () => {
    expect(normalizePath("old")).toBe("/old");
  });
  it("preserves full URL", () => {
    expect(normalizePath("https://example.com/x")).toBe("https://example.com/x");
  });
  it("collapses duplicate slashes (path only)", () => {
    expect(normalizePath("//old///page")).toBe("/old/page");
  });
  it("returns empty for empty", () => {
    expect(normalizePath("")).toBe("");
  });
});

describe("ai-htaccess escapeRegex", () => {
  it("escapes metacharacters", () => {
    expect(escapeRegex("/path.with*dots")).toBe("/path\\.with\\*dots");
  });
  it("escapes parens", () => {
    expect(escapeRegex("(test)")).toBe("\\(test\\)");
  });
});

describe("ai-htaccess tryCompileRegex", () => {
  it("compiles valid regex", () => {
    expect(tryCompileRegex("^/old/(.*)$")).not.toBeNull();
  });
  it("returns null for invalid regex", () => {
    expect(tryCompileRegex("^(unclosed")).toBeNull();
  });
});

describe("ai-htaccess applyRule", () => {
  it("applies simple pattern with capture group", () => {
    const target = applyRule("^/old/(.*)$", "/new/$1", "/old/page");
    expect(target).toBe("/new/page");
  });
  it("applies to URL with query string", () => {
    const target = applyRule("^/old$", "/new", "/old?x=1");
    expect(target).toBe("/new");
  });
  it("returns null when no match", () => {
    expect(applyRule("^/old$", "/new", "/other")).toBeNull();
  });
  it("handles multiple capture groups", () => {
    const target = applyRule("^/(\\d{4})/(\\d{2})/(.+)$", "/archive/$1/$2/$3", "/2024/01/post");
    expect(target).toBe("/archive/2024/01/post");
  });
});

describe("ai-htaccess parseBulkPairs", () => {
  it("parses arrow-separated", () => {
    const pairs = parseBulkPairs("/old → /new\n/a → /b");
    expect(pairs).toHaveLength(2);
    expect(pairs[0].from).toBe("/old");
    expect(pairs[0].to).toBe("/new");
  });
  it("parses tab-separated", () => {
    const pairs = parseBulkPairs("/old\t/new");
    expect(pairs).toHaveLength(1);
    expect(pairs[0].from).toBe("/old");
  });
  it("parses comma-separated", () => {
    const pairs = parseBulkPairs("/old,/new");
    expect(pairs).toHaveLength(1);
  });
  it("parses whitespace-separated", () => {
    const pairs = parseBulkPairs("/old /new");
    expect(pairs).toHaveLength(1);
  });
  it("parses optional status code", () => {
    const pairs = parseBulkPairs("/old → /new 302");
    expect(pairs[0].status).toBe(302);
  });
  it("ignores comments and blanks", () => {
    const pairs = parseBulkPairs("# comment\n\n/old → /new");
    expect(pairs).toHaveLength(1);
  });
  it("returns empty for empty input", () => {
    expect(parseBulkPairs("")).toEqual([]);
  });
  it("skips lines without 2 parts", () => {
    const pairs = parseBulkPairs("/only\n/a /b");
    expect(pairs).toHaveLength(1);
  });
});

describe("ai-htaccess renderBulkPairs", () => {
  it("renders pairs back to text", () => {
    const text = renderBulkPairs([
      { from: "/old", to: "/new", status: 301 },
      { from: "/a", to: "/b", status: 302 },
    ]);
    expect(text).toContain("/old → /new 301");
    expect(text).toContain("/a → /b 302");
  });
});

describe("ai-htaccess buildSimpleRedirect", () => {
  it("builds Redirect directive", () => {
    const r = buildSimpleRedirect({ from: "/old", to: "/new", status: 301 });
    expect(r.directive).toBe("Redirect 301 /old /new");
    expect(r.explanation).toContain("/old");
    expect(r.explanation).toContain("/new");
    expect(r.status).toBe(301);
  });
  it("escapes from-URL for regex matching", () => {
    const r = buildSimpleRedirect({ from: "/old.page", to: "/new", status: 301 });
    expect(r.patternRegex).toContain("\\.");
  });
});

describe("ai-htaccess buildRedirectMatch", () => {
  it("builds RedirectMatch directive", () => {
    const r = buildRedirectMatch({
      pattern: "^/old/(.*)$", target: "/new/$1", status: 301, flags: ["NC"], useRewriteRule: false,
    });
    expect(r.directive).toContain("RedirectMatch 301");
    expect(r.directive).toContain("[NC]");
  });
});

describe("ai-htaccess buildRewriteRule", () => {
  it("builds RewriteRule with flags", () => {
    const r = buildRewriteRule({
      pattern: "^/old$", target: "/new", status: 301, flags: ["R=301", "L"], useRewriteRule: true,
    });
    expect(r.directive).toContain("RewriteRule");
    expect(r.directive).toContain("[R=301,L]");
  });
  it("defaults to R=301,L when no flags", () => {
    const r = buildRewriteRule({
      pattern: "^/old$", target: "/new", status: 301, flags: [], useRewriteRule: true,
    });
    expect(r.directive).toContain("[R=301,L]");
  });
});

describe("ai-htaccess buildCanonical", () => {
  it("builds www→non-www rule", () => {
    const r = buildCanonical({ enabled: true, direction: "www-to-nonwww", domain: "example.com" });
    expect(r.directive).toContain("RewriteCond %{HTTP_HOST} ^www\\.example\\.com");
    expect(r.directive).toContain("RewriteRule ^(.*)$ https://example.com/$1");
    expect(r.status).toBe(301);
  });
  it("builds non-www→www rule", () => {
    const r = buildCanonical({ enabled: true, direction: "nonwww-to-www", domain: "example.com" });
    expect(r.directive).toContain("RewriteRule ^(.*)$ https://www.example.com/$1");
  });
  it("disabled returns empty directive", () => {
    const r = buildCanonical({ enabled: false, direction: "www-to-nonwww", domain: "example.com" });
    expect(r.directive).toBe("");
  });
});

describe("ai-htaccess buildHttpsRedirect", () => {
  it("builds HTTPS redirect when enabled", () => {
    const r = buildHttpsRedirect({ enabled: true });
    expect(r.directive).toContain("RewriteCond %{HTTPS} off");
    expect(r.directive).toContain("RewriteRule");
    expect(r.status).toBe(301);
  });
  it("disabled returns empty", () => {
    expect(buildHttpsRedirect({ enabled: false }).directive).toBe("");
  });
});

describe("ai-htaccess buildHotlink", () => {
  it("builds hotlink protection block", () => {
    const r = buildHotlink({
      enabled: true, domain: "example.com",
      allowedDomains: ["example.com", "www.example.com"],
      redirectUrl: "/denied.png",
    });
    expect(r.directive).toContain("RewriteCond %{HTTP_REFERER}");
    expect(r.directive).toContain("RewriteRule");
    expect(r.directive).toContain("/denied.png");
  });
  it("disabled returns empty", () => {
    expect(buildHotlink({
      enabled: false, domain: "example.com", allowedDomains: [], redirectUrl: "",
    }).directive).toBe("");
  });
});

describe("ai-htaccess buildErrorPage", () => {
  it("builds ErrorDocument directive", () => {
    const r = buildErrorPage({ code: 404, path: "/404.html" });
    expect(r.directive).toBe("ErrorDocument 404 /404.html");
    expect(r.explanation).toContain("404");
  });
});

describe("ai-htaccess buildIpRule", () => {
  it("builds allow rule", () => {
    const r = buildIpRule({ ip: "192.168.1.5", action: "allow" });
    expect(r.directive).toBe("Require ip 192.168.1.5");
  });
  it("builds deny rule with RequireAll block", () => {
    const r = buildIpRule({ ip: "10.0.0.0/8", action: "deny" });
    expect(r.directive).toContain("Require not ip 10.0.0.0/8");
    expect(r.directive).toContain("<RequireAll>");
  });
});

describe("ai-htaccess generateConfig", () => {
  it("generates a config with simple redirects", () => {
    const cfg = generateConfig({ pairs: DEFAULT_PAIRS });
    expect(cfg.ruleCount).toBeGreaterThanOrEqual(2);
    expect(cfg.rawText).toContain("RewriteEngine On");
    expect(cfg.rawText).toContain("Redirect 301 /old-page /new-page");
  });
  it("warns on invalid URL", () => {
    const cfg = generateConfig({ pairs: [{ from: "/old;bad", to: "/new", status: 301 }] });
    expect(cfg.warnings.some((w) => w.includes("invalid"))).toBe(true);
  });
  it("includes rewrite rule when provided", () => {
    const cfg = generateConfig({
      pairs: [],
      rewrite: { ...DEFAULT_REWRITE, useRewriteRule: true },
    });
    expect(cfg.rawText).toContain("RewriteRule");
  });
  it("includes canonical block when enabled", () => {
    const cfg = generateConfig({
      pairs: [],
      canonical: { enabled: true, direction: "www-to-nonwww", domain: "example.com" },
    });
    expect(cfg.rawText).toContain("www\\.example\\.com");
  });
  it("includes HTTPS redirect when enabled", () => {
    const cfg = generateConfig({ pairs: [], https: { enabled: true } });
    expect(cfg.rawText).toContain("%{HTTPS} off");
  });
  it("includes hotlink when enabled", () => {
    const cfg = generateConfig({
      pairs: [],
      hotlink: { enabled: true, domain: "example.com", allowedDomains: ["example.com"], redirectUrl: "/x.png" },
    });
    expect(cfg.rawText).toContain("%{HTTP_REFERER}");
  });
  it("includes error pages", () => {
    const cfg = generateConfig({ pairs: [], errorPages: DEFAULT_ERROR_PAGES });
    expect(cfg.rawText).toContain("ErrorDocument 404");
  });
  it("includes IP rules", () => {
    const cfg = generateConfig({ pairs: [], ipRules: [{ ip: "192.168.1.5", action: "allow" }] });
    expect(cfg.rawText).toContain("Require ip 192.168.1.5");
  });
  it("warns on invalid regex", () => {
    const cfg = generateConfig({
      pairs: [],
      rewrite: { pattern: "^(unclosed", target: "/new", status: 301, flags: [], useRewriteRule: true },
    });
    expect(cfg.warnings.some((w) => w.includes("regex"))).toBe(true);
  });
  it("handles all-empty input gracefully", () => {
    const cfg = generateConfig({ pairs: [] });
    expect(cfg.ruleCount).toBe(0);
    expect(cfg.rawText).toContain("RewriteEngine On");
  });
});

describe("ai-htaccess renderHtaccess", () => {
  it("includes header comment", () => {
    const text = renderHtaccess([]);
    expect(text).toContain("UnQTools");
    expect(text).toContain("RewriteEngine On");
  });
  it("includes section headers per rule type", () => {
    const r = buildSimpleRedirect({ from: "/old", to: "/new", status: 301 });
    const text = renderHtaccess([r]);
    expect(text).toContain("--- Simple Redirect ---");
  });
});

describe("ai-htaccess renderCsv", () => {
  it("has header row", () => {
    const cfg = generateConfig({ pairs: [] });
    expect(renderCsv(cfg)).toContain("type,status,directive,explanation");
  });
  it("has rows for each rule", () => {
    const cfg = generateConfig({ pairs: DEFAULT_PAIRS });
    const csv = renderCsv(cfg);
    const lines = csv.split("\n");
    expect(lines.length).toBeGreaterThan(1);
  });
});

describe("ai-htaccess detectLoops", () => {
  it("detects self-loop when target matches own pattern", () => {
    const rules = [
      {
        type: "redirect-match" as RuleType,
        directive: "RedirectMatch 301 ^/old/(.*)$ /old/$1",
        explanation: "test",
        status: 301 as RedirectStatus,
        patternRegex: "^/old/(.*)$",
        targetTemplate: "/old/$1",
      },
    ];
    const loops = detectLoops(rules);
    expect(loops.some((l) => l.level === "danger")).toBe(true);
  });
  it("detects circular chain A→B→A", () => {
    const rules = [
      {
        type: "redirect-match" as RuleType,
        directive: "RedirectMatch 301 ^/a$ /b",
        explanation: "a",
        status: 301 as RedirectStatus,
        patternRegex: "^/a$",
        targetTemplate: "/b",
      },
      {
        type: "redirect-match" as RuleType,
        directive: "RedirectMatch 301 ^/b$ /a",
        explanation: "b",
        status: 301 as RedirectStatus,
        patternRegex: "^/b$",
        targetTemplate: "/a",
      },
    ];
    const loops = detectLoops(rules);
    expect(loops.some((l) => l.level === "danger")).toBe(true);
  });
  it("warns on duplicate simple redirects", () => {
    const r1 = buildSimpleRedirect({ from: "/old", to: "/new", status: 301 });
    const r2 = buildSimpleRedirect({ from: "/old", to: "/new", status: 301 });
    const loops = detectLoops([r1, r2]);
    expect(loops.some((l) => l.level === "warn")).toBe(true);
  });
  it("returns empty for safe rules", () => {
    const r = buildSimpleRedirect({ from: "/old", to: "/new", status: 301 });
    const loops = detectLoops([r]);
    // Simple redirect: pattern ^/old(.*)$, target /new$1 — /new doesn't match /old so no loop.
    const danger = loops.filter((l) => l.level === "danger");
    expect(danger).toHaveLength(0);
  });
});

describe("ai-htaccess testUrl", () => {
  it("matches a simple redirect rule", () => {
    const r = buildSimpleRedirect({ from: "/old", to: "/new", status: 301 });
    const result = testUrl([r], "/old");
    expect(result.matched).toBe(true);
    expect(result.redirectTarget).toBe("/new");
    expect(result.status).toBe(301);
  });
  it("matches RedirectMatch with capture group", () => {
    const r = buildRedirectMatch({
      pattern: "^/old/(.*)$", target: "/new/$1", status: 301, flags: [], useRewriteRule: false,
    });
    const result = testUrl([r], "/old/page");
    expect(result.redirectTarget).toBe("/new/page");
  });
  it("returns no-match for non-matching URL", () => {
    const r = buildSimpleRedirect({ from: "/old", to: "/new", status: 301 });
    const result = testUrl([r], "/other");
    expect(result.matched).toBe(false);
    expect(result.matchedRuleIdx).toBe(-1);
    expect(result.redirectTarget).toBeNull();
  });
  it("returns first match when multiple rules apply", () => {
    const r1 = buildSimpleRedirect({ from: "/old", to: "/new1", status: 301 });
    const r2 = buildSimpleRedirect({ from: "/old", to: "/new2", status: 301 });
    const result = testUrl([r1, r2], "/old");
    expect(result.matchedRuleIdx).toBe(0);
    expect(result.redirectTarget).toBe("/new1");
  });
});

describe("ai-htaccess testUrls", () => {
  it("tests multiple URLs at once", () => {
    const r = buildSimpleRedirect({ from: "/old", to: "/new", status: 301 });
    const results = testUrls([r], ["/old", "/other"]);
    expect(results).toHaveLength(2);
    expect(results[0].matched).toBe(true);
    expect(results[1].matched).toBe(false);
  });
});

describe("ai-htaccess importHtaccess", () => {
  it("imports simple Redirect lines", () => {
    const rules = importHtaccess("Redirect 301 /old /new\nRedirect 302 /a /b");
    expect(rules).toHaveLength(2);
    expect(rules[0].from).toBe("/old");
    expect(rules[0].status).toBe(301);
  });
  it("imports RedirectMatch", () => {
    const rules = importHtaccess("RedirectMatch 301 ^/old/(.*)$ /new/$1");
    expect(rules).toHaveLength(1);
    expect(rules[0].pattern).toBe("^/old/(.*)$");
  });
  it("imports RewriteRule", () => {
    const rules = importHtaccess("RewriteRule ^/old$ /new [R=301,L]");
    expect(rules).toHaveLength(1);
    expect(rules[0].pattern).toBe("^/old$");
  });
  it("imports ErrorDocument", () => {
    const rules = importHtaccess("ErrorDocument 404 /404.html");
    expect(rules).toHaveLength(1);
  });
  it("imports Require ip", () => {
    const rules = importHtaccess("Require ip 192.168.1.5");
    expect(rules).toHaveLength(1);
  });
  it("ignores comments and blanks", () => {
    const rules = importHtaccess("# comment\n\nRedirect 301 /old /new");
    expect(rules).toHaveLength(1);
  });
  it("returns empty for empty input", () => {
    expect(importHtaccess("")).toEqual([]);
  });
});

describe("ai-htaccess history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1, pairCount: 5, patternCount: 1, canonical: true, https: true,
      hotlink: false, errorPages: 1, ipRules: 0, ruleCount: 8,
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at HISTORY_MAX", () => {
    for (let i = 0; i < HISTORY_MAX + 5; i++) {
      saveHistory({
        ts: i, pairCount: 1, patternCount: 0, canonical: false, https: false,
        hotlink: false, errorPages: 0, ipRules: 0, ruleCount: 1,
      });
    }
    expect(loadHistory()).toHaveLength(HISTORY_MAX);
  });
  it("clears", () => {
    saveHistory({
      ts: 1, pairCount: 1, patternCount: 0, canonical: false, https: false,
      hotlink: false, errorPages: 0, ipRules: 0, ruleCount: 1,
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("ai-htaccess shareable URL", () => {
  it("builds share URL with pairs when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      pairs: [{ from: "/old", to: "/new", status: 301 }],
      canonical: { enabled: true, direction: "www-to-nonwww", domain: "example.com" },
      https: { enabled: true },
    });
    expect(url).toContain("pairs=%2Fold%3E%2Fnew%3E301");
    expect(url).toContain("ce=1");
    expect(url).toContain("he=1");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back to state", () => {
    const hash = "pairs=%2Fold%3E%2Fnew%3E301%7C%2Fa%3E%2Fb%3E302&ce=1&cd=www-to-nonwww&cdom=example.com&he=1";
    const state = parseShareUrl(hash);
    expect(state.pairs).toHaveLength(2);
    expect(state.pairs[0].from).toBe("/old");
    expect(state.pairs[0].to).toBe("/new");
    expect(state.pairs[0].status).toBe(301);
    expect(state.pairs[1].status).toBe(302);
    expect(state.canonical?.enabled).toBe(true);
    expect(state.canonical?.direction).toBe("www-to-nonwww");
    expect(state.https?.enabled).toBe(true);
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({ pairs: [] });
  });
  it("handles rewrite options round-trip", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      pairs: [],
      rewrite: { pattern: "^/old/(.*)$", target: "/new/$1", status: 301, flags: ["L"], useRewriteRule: true },
    });
    (globalThis as Record<string, unknown>).window = origWindow;
    // Extract hash
    const hash = url.substring(url.indexOf("?") + 1);
    const state = parseShareUrl(hash);
    expect(state.rewrite?.pattern).toBe("^/old/(.*)$");
    expect(state.rewrite?.target).toBe("/new/$1");
    expect(state.rewrite?.useRewriteRule).toBe(true);
  });
  it("handles error pages and IP rules round-trip", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      pairs: [],
      errorPages: [{ code: 404, path: "/404.html" }],
      ipRules: [{ ip: "192.168.1.5", action: "deny" }],
    });
    (globalThis as Record<string, unknown>).window = origWindow;
    const hash = url.substring(url.indexOf("?") + 1);
    const state = parseShareUrl(hash);
    expect(state.errorPages).toHaveLength(1);
    expect(state.errorPages![0].code).toBe(404);
    expect(state.ipRules).toHaveLength(1);
    expect(state.ipRules![0].ip).toBe("192.168.1.5");
    expect(state.ipRules![0].action).toBe("deny");
  });
});

describe("ai-htaccess LLM prompt", () => {
  it("builds prompt with system + user", () => {
    const prompt = buildLlmPrompt({
      pairs: [{ from: "/old", to: "/new", status: 301 }],
      https: { enabled: true },
    });
    expect(prompt.system.length).toBeGreaterThan(20);
    expect(prompt.user).toContain("/old");
    expect(prompt.user).toContain("HTTP→HTTPS");
  });
  it("handles empty pairs", () => {
    const prompt = buildLlmPrompt({ pairs: [] });
    expect(prompt.user).toContain("(none)");
  });
  it("renderLlmResult trims", () => {
    expect(renderLlmResult("  hello  ")).toBe("hello");
    expect(renderLlmResult("")).toBe("");
  });
});

// Suppress unused-import lint
export type _Unused =
  | RedirectStatus | RedirectPair | RuleType
  | typeof apachePatternToJs | typeof apacheTargetToJs;
