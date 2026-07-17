import { describe, it, expect, beforeEach } from "vitest";
import {
  HTACCESS_HEADER,
  parseBulk,
  isValidUrlOrPath,
  escapeHtml,
  escapeRegex,
  buildRedirectDirective,
  buildRewriteRule,
  buildRedirectRules,
  buildWwwToNonWww,
  buildNonWwwToWww,
  buildHttpToHttps,
  buildEnforceTrailingSlash,
  buildStripTrailingSlash,
  buildStripQueryString,
  buildCommonRedirects,
  buildHtaccess,
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
    setItem: (k: string, v: string) => {
      store[k] = v;
    },
    removeItem: (k: string) => {
      delete store[k];
    },
    clear: () => {
      for (const k of Object.keys(store)) delete store[k];
    },
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() {
      return Object.keys(store).length;
    },
  };
});

describe("redirect-htaccess-generator parseBulk", () => {
  it("parses arrow-separated", () => {
    const r = parseBulk("/old -> /new");
    expect(r).toHaveLength(1);
    expect(r[0].from).toBe("/old");
    expect(r[0].to).toBe("/new");
  });
  it("parses comma-separated", () => {
    const r = parseBulk("/old, /new");
    expect(r[0]).toEqual({ from: "/old", to: "/new" });
  });
  it("parses space-separated", () => {
    const r = parseBulk("/old /new");
    expect(r[0]).toEqual({ from: "/old", to: "/new" });
  });
  it("parses fat-arrow", () => {
    const r = parseBulk("/old => /new");
    expect(r[0]).toEqual({ from: "/old", to: "/new" });
  });
  it("skips blank lines", () => {
    expect(parseBulk("a -> b\n\nc -> d")).toHaveLength(2);
  });
  it("returns empty for empty", () => {
    expect(parseBulk("")).toEqual([]);
  });
});

describe("redirect-htaccess-generator isValidUrlOrPath", () => {
  it("accepts https URLs", () => {
    expect(isValidUrlOrPath("https://example.com/x")).toBe(true);
  });
  it("accepts relative paths", () => {
    expect(isValidUrlOrPath("/old-path")).toBe(true);
  });
  it("accepts regex patterns", () => {
    expect(isValidUrlOrPath("^/old/(.*)$")).toBe(true);
  });
  it("rejects empty", () => {
    expect(isValidUrlOrPath("")).toBe(false);
  });
});

describe("redirect-htaccess-generator escapeHtml", () => {
  it("escapes special chars", () => {
    expect(escapeHtml(`<a>"&'</a>`)).toBe("&lt;a&gt;&quot;&amp;&#39;&lt;/a&gt;");
  });
});

describe("redirect-htaccess-generator escapeRegex", () => {
  it("escapes regex metacharacters", () => {
    expect(escapeRegex("/path.")).toBe("/path\\.");
    expect(escapeRegex("a*b+c?")).toBe("a\\*b\\+c\\?");
  });
});

describe("redirect-htaccess-generator buildRedirectDirective", () => {
  it("builds 301 directive", () => {
    const out = buildRedirectDirective({ from: "/old", to: "/new" }, "301");
    expect(out).toBe("Redirect 301 /old /new");
  });
  it("builds 302 directive", () => {
    const out = buildRedirectDirective({ from: "/old", to: "/new" }, "302");
    expect(out).toBe("Redirect 302 /old /new");
  });
});

describe("redirect-htaccess-generator buildRewriteRule", () => {
  it("builds 301 RewriteRule", () => {
    const out = buildRewriteRule({ from: "/old", to: "/new" }, "301", false);
    expect(out).toContain("RewriteRule");
    expect(out).toContain("R=301,L");
  });
  it("uses regex when useRegex=true", () => {
    const out = buildRewriteRule({ from: "^/old/(.*)$", to: "/new/$1" }, "301", true);
    expect(out).toContain("^/old/(.*)$");
  });
  it("escapes literal when useRegex=false", () => {
    const out = buildRewriteRule({ from: "/old.path", to: "/new" }, "301", false);
    expect(out).toContain("/old\\.path");
  });
  it("uses correct flag for 308", () => {
    const out = buildRewriteRule({ from: "/old", to: "/new" }, "308", false);
    expect(out).toContain("R=308,L");
  });
});

describe("redirect-htaccess-generator buildRedirectRules", () => {
  it("builds RewriteRule block", () => {
    const out = buildRedirectRules(
      [{ from: "/old", to: "/new" }],
      { type: "301", style: "RewriteRule", useRegex: false },
    );
    expect(out).toContain("RewriteEngine On");
    expect(out).toContain("RewriteRule");
  });
  it("builds Redirect block", () => {
    const out = buildRedirectRules(
      [{ from: "/old", to: "/new" }],
      { type: "301", style: "Redirect", useRegex: false },
    );
    expect(out).toContain("Redirect 301 /old /new");
  });
  it("skips invalid entries", () => {
    const out = buildRedirectRules(
      [{ from: "", to: "/new" }],
      { type: "301", style: "Redirect", useRegex: false },
    );
    expect(out).not.toContain("Redirect 301");
  });
});

describe("redirect-htaccess-generator www/non-www rules", () => {
  it("builds www → non-www", () => {
    const out = buildWwwToNonWww("example.com");
    expect(out).toContain("RewriteCond %{HTTP_HOST}");
    expect(out).toContain("https://example.com");
  });
  it("builds non-www → www", () => {
    const out = buildNonWwwToWww("example.com");
    expect(out).toContain("RewriteCond");
    expect(out).toContain("https://www.example.com");
  });
  it("returns empty for empty domain", () => {
    expect(buildWwwToNonWww("")).toBe("");
    expect(buildNonWwwToWww("")).toBe("");
  });
  it("strips protocol from domain", () => {
    const out = buildWwwToNonWww("https://example.com");
    expect(out).toContain("example.com");
    expect(out).not.toContain("https://example.com\n");
  });
});

describe("redirect-htaccess-generator common rules", () => {
  it("builds HTTP → HTTPS", () => {
    expect(buildHttpToHttps()).toContain("RewriteCond %{HTTPS} off");
  });
  it("builds enforce trailing slash", () => {
    expect(buildEnforceTrailingSlash()).toContain("RewriteRule");
  });
  it("builds strip trailing slash", () => {
    expect(buildStripTrailingSlash()).toContain("RewriteCond %{REQUEST_FILENAME} !-d");
  });
  it("builds strip query string", () => {
    expect(buildStripQueryString()).toContain("RewriteCond %{QUERY_STRING}");
  });
});

describe("redirect-htaccess-generator buildCommonRedirects", () => {
  it("includes header", () => {
    const out = buildCommonRedirects({
      domain: "example.com",
      wwwToNonWww: false,
      nonWwwToWww: false,
      httpToHttps: true,
      enforceTrailingSlash: false,
      stripTrailingSlash: false,
      stripQueryString: false,
    });
    expect(out).toContain("RewriteEngine On");
    expect(out).toContain("Force HTTPS");
  });
  it("combines multiple options", () => {
    const out = buildCommonRedirects({
      domain: "example.com",
      wwwToNonWww: true,
      nonWwwToWww: false,
      httpToHttps: true,
      enforceTrailingSlash: true,
      stripTrailingSlash: false,
      stripQueryString: true,
    });
    expect(out).toContain("www → non-www");
    expect(out).toContain("Force HTTPS");
    expect(out).toContain("Enforce trailing slash");
    expect(out).toContain("Strip query string");
  });
  it("returns header only when no options", () => {
    const out = buildCommonRedirects({
      domain: "",
      wwwToNonWww: false,
      nonWwwToWww: false,
      httpToHttps: false,
      enforceTrailingSlash: false,
      stripTrailingSlash: false,
      stripQueryString: false,
    });
    expect(out).toContain("RewriteEngine On");
  });
});

describe("redirect-htaccess-generator buildHtaccess", () => {
  it("combines common + bulk", () => {
    const out = buildHtaccess(
      [{ from: "/old", to: "/new" }],
      { type: "301", style: "Redirect", useRegex: false },
      {
        domain: "example.com",
        wwwToNonWww: true,
        nonWwwToWww: false,
        httpToHttps: true,
        enforceTrailingSlash: false,
        stripTrailingSlash: false,
        stripQueryString: false,
      },
    );
    expect(out).toContain("RewriteEngine On");
    expect(out).toContain("Force HTTPS");
    expect(out).toContain("Redirect 301 /old /new");
  });
  it("has trailing newline", () => {
    const out = buildHtaccess([], { type: "301", style: "Redirect", useRegex: false }, {
      domain: "",
      wwwToNonWww: false,
      nonWwwToWww: false,
      httpToHttps: false,
      enforceTrailingSlash: false,
      stripTrailingSlash: false,
      stripQueryString: false,
    });
    expect(out.endsWith("\n")).toBe(true);
  });
});

describe("redirect-htaccess-generator history", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, ruleCount: 5, type: "301", style: "Redirect" });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, ruleCount: 1, type: "301", style: "Redirect" });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, ruleCount: 1, type: "301", style: "Redirect" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("redirect-htaccess-generator shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      bulk: "/old -> /new",
      redirectOpts: { type: "301", style: "Redirect", useRegex: false },
      commonOpts: {
        domain: "example.com",
        wwwToNonWww: true,
        nonWwwToWww: false,
        httpToHttps: true,
        enforceTrailingSlash: false,
        stripTrailingSlash: false,
        stripQueryString: false,
      },
    });
    expect(url).toContain("bulk=");
    expect(url).toContain("type=301");
    expect(url).toContain("wwwToNonWww=1");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("bulk=%2Fold+%2Fnew&type=302&style=Redirect&useRegex=1&domain=example.com&httpToHttps=1");
    expect(p.bulk).toBe("/old /new");
    expect(p.redirectOpts.type).toBe("302");
    expect(p.redirectOpts.style).toBe("Redirect");
    expect(p.redirectOpts.useRegex).toBe(true);
    expect(p.commonOpts.domain).toBe("example.com");
    expect(p.commonOpts.httpToHttps).toBe(true);
  });
  it("handles empty hash with defaults", () => {
    const p = parseShareUrl("");
    expect(p.bulk).toBe("");
    expect(p.redirectOpts.type).toBe("301");
    expect(p.redirectOpts.style).toBe("RewriteRule");
    expect(p.commonOpts.httpToHttps).toBe(false);
  });
  it("omits empty bulk", () => {
    const url = buildShareUrl({
      bulk: "",
      redirectOpts: { type: "301", style: "Redirect", useRegex: false },
      commonOpts: {
        domain: "",
        wwwToNonWww: false,
        nonWwwToWww: false,
        httpToHttps: false,
        enforceTrailingSlash: false,
        stripTrailingSlash: false,
        stripQueryString: false,
      },
    });
    expect(url).not.toContain("bulk=");
  });
});

describe("redirect-htaccess-generator HTACCESS_HEADER", () => {
  it("includes RewriteEngine On", () => {
    expect(HTACCESS_HEADER).toContain("RewriteEngine On");
  });
});
