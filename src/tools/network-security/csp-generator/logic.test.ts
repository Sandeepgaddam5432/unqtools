import { describe, it, expect } from "vitest";
import {
  parseCsp,
  validateCsp,
  analyzeCsp,
  scoreLabel,
  detectBypassGadgets,
  suggestStrictCsp,
  buildCsp,
  cspToNginx,
  cspToApache,
  cspToMetaTag,
  generateNonce,
  hashInlineScript,
  encodeToFragment,
  decodeFromFragment,
  parseReportTo,
  DIRECTIVE_DOCS,
} from "./logic";

describe("csp-generator parseCsp", () => {
  it("parses a multi-directive CSP header", () => {
    const d = parseCsp("default-src 'self'; script-src 'self' cdn.example.com");
    expect(d["default-src"]).toEqual(["'self'"]);
    expect(d["script-src"]).toEqual(["'self'", "cdn.example.com"]);
  });

  it("returns empty map for empty input", () => {
    expect(Object.keys(parseCsp("")).length).toBe(0);
  });

  it("handles directives without sources (flags)", () => {
    const d = parseCsp("default-src 'self'; upgrade-insecure-requests");
    expect(d["upgrade-insecure-requests"]).toEqual([]);
  });

  it("lowercases directive names but preserves source case", () => {
    const d = parseCsp("SCRIPT-SRC 'self' CDN.Example.COM");
    expect(d["script-src"]).toEqual(["'self'", "CDN.Example.COM"]);
  });
});

describe("csp-generator validateCsp", () => {
  it("flags empty header", () => {
    expect(validateCsp({})).toMatch(/empty/i);
  });

  it("flags header without fetch directives", () => {
    expect(validateCsp({ "frame-ancestors": ["'none'"] })).toMatch(/fetch/);
  });

  it("accepts header with default-src", () => {
    expect(validateCsp({ "default-src": ["'self'"] })).toBeNull();
  });
});

describe("csp-generator analyzeCsp", () => {
  it("flags unsafe-inline in script-src as high", () => {
    const a = analyzeCsp("default-src 'self'; script-src 'self' 'unsafe-inline'");
    expect(a.findings.some((f) => f.severity === "high" && f.message.includes("unsafe-inline"))).toBe(true);
  });

  it("flags unsafe-eval", () => {
    const a = analyzeCsp("default-src 'self'; script-src 'self' 'unsafe-eval'");
    expect(a.findings.some((f) => f.message.includes("unsafe-eval"))).toBe(true);
  });

  it("flags wildcard * in script-src", () => {
    const a = analyzeCsp("default-src 'self'; script-src *");
    expect(a.findings.some((f) => f.severity === "high" && f.message.includes("Wildcard"))).toBe(true);
  });

  it("warns on missing object-src", () => {
    const a = analyzeCsp("default-src 'self'; script-src 'self'");
    expect(a.findings.some((f) => f.directive === "object-src")).toBe(true);
  });

  it("warns on missing base-uri", () => {
    const a = analyzeCsp("default-src 'self'; script-src 'self'; object-src 'none'");
    expect(a.findings.some((f) => f.directive === "base-uri")).toBe(true);
  });

  it("scores a strict CSP highly", () => {
    const a = analyzeCsp("default-src 'none'; script-src 'nonce-abc' 'strict-dynamic'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'; upgrade-insecure-requests");
    expect(a.score).toBeGreaterThanOrEqual(75);
  });

  it("scores an unsafe CSP poorly", () => {
    const a = analyzeCsp("default-src *; script-src 'unsafe-inline' 'unsafe-eval' *");
    expect(a.score).toBeLessThan(40);
  });

  it("returns invalid for non-CSP input", () => {
    const a = analyzeCsp("");
    expect(a.isValid).toBe(false);
  });
});

describe("csp-generator detectBypassGadgets", () => {
  it("flags Angular on gstatic", () => {
    const d = parseCsp("default-src 'self'; script-src 'self' ajax.googleapis.com/ajax/libs/angularjs/1.6.9/angular.min.js");
    const g = detectBypassGadgets(d);
    expect(g.some((x) => x.type === "angular")).toBe(true);
  });

  it("flags data: in script-src", () => {
    const d = parseCsp("default-src 'self'; script-src 'self' data:");
    const g = detectBypassGadgets(d);
    expect(g.some((x) => x.type === "data-uri")).toBe(true);
  });

  it("returns empty for a clean CSP", () => {
    const d = parseCsp("default-src 'self'; script-src 'self' 'nonce-abc'");
    expect(detectBypassGadgets(d).length).toBe(0);
  });
});

describe("csp-generator scoreLabel", () => {
  it("returns labels for score bands", () => {
    expect(scoreLabel(95)).toBe("Excellent");
    expect(scoreLabel(80)).toBe("Good");
    expect(scoreLabel(55)).toBe("Fair");
    expect(scoreLabel(30)).toBe("Weak");
    expect(scoreLabel(10)).toBe("Critical");
  });
});

describe("csp-generator buildCsp + formats", () => {
  it("buildCsp round-trips a directive map", () => {
    const csp = buildCsp({ "default-src": ["'self'"], "script-src": ["'self'", "'nonce-abc'"] });
    expect(csp).toBe("default-src 'self'; script-src 'self' 'nonce-abc'");
  });

  it("cspToNginx emits add_header directive", () => {
    const out = cspToNginx("default-src 'self'");
    expect(out).toContain("add_header Content-Security-Policy");
    expect(out).toContain("always;");
  });

  it("cspToNginx supports Report-Only", () => {
    expect(cspToNginx("default-src 'self'", true)).toContain("Report-Only");
  });

  it("cspToApache wraps in IfModule", () => {
    const out = cspToApache("default-src 'self'");
    expect(out).toContain("mod_headers.c");
    expect(out).toContain("Header always set");
  });

  it("cspToMetaTag emits http-equiv meta", () => {
    const out = cspToMetaTag("default-src 'self'");
    expect(out).toContain('http-equiv="Content-Security-Policy"');
  });

  it("cspToMetaTag warns about frame-ancestors", () => {
    const out = cspToMetaTag("default-src 'self'; frame-ancestors 'none'");
    expect(out).toContain("Warning");
    expect(out).toContain("frame-ancestors");
  });

  it("cspToMetaTag rejects Report-Only", () => {
    const out = cspToMetaTag("default-src 'self'", true);
    expect(out).toContain("NOT supported");
  });
});

describe("csp-generator suggestStrictCsp", () => {
  it("returns SPA preset with strict-dynamic", () => {
    const p = suggestStrictCsp("spa");
    expect(p.csp).toContain("strict-dynamic");
    expect(p.csp).toContain("nonce-");
  });

  it("returns API preset with all 'none'", () => {
    const p = suggestStrictCsp("api");
    expect(p.csp).toMatch(/default-src 'none'/);
    expect(p.csp).not.toContain("script-src");
  });

  it("returns all four app types", () => {
    expect(["spa", "ssr", "static", "api"].map((t) => suggestStrictCsp(t as "spa").name).length).toBe(4);
  });
});

describe("csp-generator nonce + hash", () => {
  it("generateNonce returns base64 string of expected length", () => {
    const n = generateNonce(16);
    // 16 bytes → ~24 base64 chars
    expect(n.length).toBeGreaterThanOrEqual(22);
    expect(n.length).toBeLessThanOrEqual(24);
  });

  it("generateNonce returns different values", () => {
    expect(generateNonce(16)).not.toBe(generateNonce(16));
  });

  it("hashInlineScript returns sha256- source", async () => {
    const h = await hashInlineScript("alert(1)");
    expect(h).toMatch(/^'sha256-[A-Za-z0-9+/=]+'$/);
  });

  it("hashInlineScript is deterministic", async () => {
    const a = await hashInlineScript("console.log('hi')");
    const b = await hashInlineScript("console.log('hi')");
    expect(a).toBe(b);
  });
});

describe("csp-generator fragment encoding", () => {
  it("encodes and decodes round-trips", () => {
    const frag = encodeToFragment("default-src 'self'", true);
    const decoded = decodeFromFragment(frag);
    expect(decoded).not.toBeNull();
    expect(decoded!.csp).toBe("default-src 'self'");
    expect(decoded!.reportOnly).toBe(true);
  });

  it("returns null for invalid fragment", () => {
    expect(decodeFromFragment("#other=foo")).toBeNull();
    expect(decodeFromFragment("#csp=not-json")).toBeNull();
  });
});

describe("csp-generator parseReportTo", () => {
  it("validates a correct Report-To header", () => {
    const json = JSON.stringify([{ group: "csp-endpoint", max_age: 10886400, endpoints: [{ url: "https://example.com/r" }] }]);
    const r = parseReportTo(json);
    expect(r.ok).toBe(true);
  });

  it("rejects non-array", () => {
    const r = parseReportTo(JSON.stringify({ group: "x" }));
    expect(r.ok).toBe(false);
  });

  it("rejects missing endpoints", () => {
    const r = parseReportTo(JSON.stringify([{ group: "x", max_age: 100 }]));
    expect(r.ok).toBe(false);
  });
});

describe("csp-generator DIRECTIVE_DOCS", () => {
  it("documents all common directives", () => {
    expect(DIRECTIVE_DOCS["default-src"]).toBeDefined();
    expect(DIRECTIVE_DOCS["script-src"]).toBeDefined();
    expect(DIRECTIVE_DOCS["frame-ancestors"]).toBeDefined();
    expect(DIRECTIVE_DOCS["report-to"]).toBeDefined();
  });
});
