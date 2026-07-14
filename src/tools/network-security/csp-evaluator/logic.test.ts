import { describe, it, expect, beforeEach } from "vitest";
import {
  parseCsp,
  validateCsp,
  analyzeCsp,
  computeScore,
  analyze,
  scoreLabel,
} from "./logic";

describe("csp-evaluator parseCsp", () => {
  it("parses a simple CSP header", () => {
    const result = parseCsp("default-src 'self'; script-src 'self' cdn.example.com");
    expect(result).toEqual({
      "default-src": ["'self'"],
      "script-src": ["'self'", "cdn.example.com"],
    });
  });

  it("handles extra whitespace and trailing semicolons", () => {
    const result = parseCsp("  default-src   'self'  ;  ;  img-src  *  ");
    expect(result).toEqual({
      "default-src": ["'self'"],
      "img-src": ["*"],
    });
  });

  it("lowercases directive names", () => {
    const result = parseCsp("DEFAULT-SRC 'self'");
    expect(Object.keys(result)).toEqual(["default-src"]);
  });

  it("lowercases source values", () => {
    const result = parseCsp("script-src Example.COM");
    expect(result["script-src"]).toEqual(["example.com"]);
  });

  it("returns empty object for empty input", () => {
    expect(parseCsp("")).toEqual({});
    expect(parseCsp("   ")).toEqual({});
  });
});

describe("csp-evaluator validateCsp", () => {
  it("returns null for valid CSP with fetch directive", () => {
    expect(validateCsp({ "default-src": ["'self'"] })).toBeNull();
    expect(validateCsp({ "script-src": ["'self'"] })).toBeNull();
  });

  it("returns error for empty directives", () => {
    expect(validateCsp({})).toMatch(/empty/i);
  });

  it("returns error for non-fetch directives only", () => {
    expect(validateCsp({ "report-uri": ["/csp"] })).toMatch(/no fetch/);
  });
});

describe("csp-evaluator analyzeCsp", () => {
  it("flags missing default-src", () => {
    const findings = analyzeCsp({ "script-src": ["'self'"] });
    expect(findings.some((f) => f.directive === "default-src" && f.severity === "medium")).toBe(true);
  });

  it("flags unsafe-inline in script-src", () => {
    const findings = analyzeCsp({
      "default-src": ["'none'"],
      "script-src": ["'self'", "'unsafe-inline'"],
    });
    const unsafe = findings.find((f) => f.message.includes("unsafe-inline"));
    expect(unsafe).toBeDefined();
    expect(unsafe?.directive).toBe("script-src");
  });

  it("flags unsafe-eval as high severity in script-src", () => {
    const findings = analyzeCsp({
      "default-src": ["'none'"],
      "script-src": ["'self'", "'unsafe-eval'"],
    });
    const evalFinding = findings.find((f) => f.message.includes("unsafe-eval"));
    expect(evalFinding?.severity).toBe("high");
  });

  it("flags http: scheme in script-src", () => {
    const findings = analyzeCsp({
      "default-src": ["'none'"],
      "script-src": ["'self'", "http:"],
    });
    expect(findings.some((f) => f.directive === "script-src" && f.message.includes("insecure"))).toBe(true);
  });

  it("flags data: URIs in script-src", () => {
    const findings = analyzeCsp({
      "default-src": ["'none'"],
      "script-src": ["'self'", "data:"],
    });
    expect(findings.some((f) => f.message.includes("data:"))).toBe(true);
  });

  it("flags wildcards in script-src", () => {
    const findings = analyzeCsp({
      "default-src": ["'none'"],
      "script-src": ["*.cdn.com"],
    });
    expect(findings.some((f) => f.message.includes("wildcard"))).toBe(true);
  });

  it("flags * in default-src", () => {
    const findings = analyzeCsp({ "default-src": ["*"] });
    expect(findings.some((f) => f.severity === "high" && f.directive === "default-src")).toBe(true);
  });

  it("flags deprecated directives", () => {
    const findings = analyzeCsp({
      "default-src": ["'none'"],
      "child-src": ["'none'"],
      "plugin-types": ["application/pdf"],
    });
    expect(findings.some((f) => f.directive === "child-src" && f.severity === "low")).toBe(true);
    expect(findings.some((f) => f.directive === "plugin-types")).toBe(true);
  });

  it("flags missing base-uri, form-action, frame-ancestors", () => {
    const findings = analyzeCsp({ "default-src": ["'none'"] });
    expect(findings.some((f) => f.directive === "base-uri")).toBe(true);
    expect(findings.some((f) => f.directive === "form-action")).toBe(true);
    expect(findings.some((f) => f.directive === "frame-ancestors")).toBe(true);
  });

  it("does not flag base-uri when present", () => {
    const findings = analyzeCsp({
      "default-src": ["'none'"],
      "base-uri": ["'self'"],
    });
    expect(findings.some((f) => f.directive === "base-uri" && f.message.includes("No base-uri"))).toBe(false);
  });

  it("flags missing report-uri", () => {
    const findings = analyzeCsp({ "default-src": ["'none'"] });
    expect(findings.some((f) => f.directive === "report-uri / report-to")).toBe(true);
  });

  it("does not flag report-uri when present", () => {
    const findings = analyzeCsp({
      "default-src": ["'none'"],
      "report-uri": ["/csp-report"],
    });
    expect(findings.some((f) => f.directive === "report-uri / report-to" && f.severity === "info")).toBe(false);
  });

  it("flags missing upgrade-insecure-requests", () => {
    const findings = analyzeCsp({ "default-src": ["'none'"] });
    expect(findings.some((f) => f.directive === "upgrade-insecure-requests")).toBe(true);
  });

  it("returns no findings for a strict policy", () => {
    const findings = analyzeCsp({
      "default-src": ["'none'"],
      "script-src": ["'self'"],
      "style-src": ["'self'"],
      "img-src": ["'self'"],
      "base-uri": ["'none'"],
      "form-action": ["'none'"],
      "frame-ancestors": ["'none'"],
      "upgrade-insecure-requests": [],
      "report-uri": ["/csp"],
    });
    // Should have no high or medium findings
    const bad = findings.filter((f) => f.severity === "high" || f.severity === "medium");
    expect(bad).toHaveLength(0);
  });
});

describe("csp-evaluator computeScore", () => {
  it("returns 100 for no findings", () => {
    expect(computeScore([])).toBe(100);
  });

  it("deducts 25 per high", () => {
    expect(computeScore([{ severity: "high", directive: "x", message: "", recommendation: "" }])).toBe(75);
  });

  it("deducts 10 per medium", () => {
    expect(computeScore([{ severity: "medium", directive: "x", message: "", recommendation: "" }])).toBe(90);
  });

  it("deducts 3 per low", () => {
    expect(computeScore([{ severity: "low", directive: "x", message: "", recommendation: "" }])).toBe(97);
  });

  it("does not deduct for info", () => {
    expect(computeScore([{ severity: "info", directive: "x", message: "", recommendation: "" }])).toBe(100);
  });

  it("never goes below 0", () => {
    const findings = Array(10).fill({ severity: "high", directive: "x", message: "", recommendation: "" });
    expect(computeScore(findings)).toBe(0);
  });
});

describe("csp-evaluator analyze (integration)", () => {
  it("returns invalid for empty input", () => {
    const r = analyze("");
    expect(r.isValid).toBe(false);
    expect(r.score).toBe(0);
  });

  it("returns valid for a strict policy", () => {
    const r = analyze("default-src 'none'; script-src 'self'");
    expect(r.isValid).toBe(true);
    expect(r.score).toBeGreaterThan(50);
  });
});

describe("csp-evaluator scoreLabel", () => {
  it("returns the right label for each range", () => {
    expect(scoreLabel(100)).toBe("Excellent");
    expect(scoreLabel(90)).toBe("Excellent");
    expect(scoreLabel(89)).toBe("Good");
    expect(scoreLabel(75)).toBe("Good");
    expect(scoreLabel(74)).toBe("Fair");
    expect(scoreLabel(50)).toBe("Fair");
    expect(scoreLabel(49)).toBe("Weak");
    expect(scoreLabel(25)).toBe("Weak");
    expect(scoreLabel(24)).toBe("Critical");
    expect(scoreLabel(0)).toBe("Critical");
  });
});

// ===== v8.1 upgrade tests =====

import {
  detectBypassGadgets,
  suggestStrictCsp,
  suggestHashOrNonce,
  checkReportEndpoint,
  checkDeprecatedHeaders,
  compareCsps,
  loadCspHistory,
  saveCspToHistory,
  clearCspHistory,
  buildCsp,
  CSP_PRESETS,
  explainSource,
  getScoreBreakdown,
  cspToNginx,
  cspToApache,
  cspToMetaTag,
  DIRECTIVE_REFERENCE,
  generateNonce,
  buildCspShareUrl,
  extractCspFromFragment,
  type CspBuilderDirective,
} from "./logic";

describe("csp detectBypassGadgets", () => {
  it("detects Angular CDN gadget", () => {
    const directives = { "script-src": ["ajax.googleapis.com"] };
    const gadgets = detectBypassGadgets(directives);
    expect(gadgets.some((g) => g.type === "angular")).toBe(true);
  });
  it("detects data: URI gadget", () => {
    const directives = { "script-src": ["data:"] };
    const gadgets = detectBypassGadgets(directives);
    expect(gadgets.some((g) => g.type === "script-inject")).toBe(true);
  });
  it("returns empty for clean CSP", () => {
    const directives = { "script-src": ["'self'"] };
    expect(detectBypassGadgets(directives)).toHaveLength(0);
  });
});

describe("csp suggestStrictCsp", () => {
  it("generates SPA preset", () => {
    const r = suggestStrictCsp("spa");
    expect(r.csp).toContain("nonce-{NONCE}");
    expect(r.csp).toContain("default-src 'none'");
  });
  it("generates static preset", () => {
    const r = suggestStrictCsp("static");
    expect(r.csp).toContain("default-src 'none'");
  });
});

describe("csp suggestHashOrNonce", () => {
  it("suggests nonce for unsafe-inline", () => {
    const directives = { "script-src": ["'self'", "'unsafe-inline'"] };
    const r = suggestHashOrNonce(directives);
    expect(r.some((x) => x.type === "inline")).toBe(true);
  });
  it("suggests removing eval", () => {
    const directives = { "script-src": ["'self'", "'unsafe-eval'"] };
    const r = suggestHashOrNonce(directives);
    expect(r.some((x) => x.type === "eval")).toBe(true);
  });
});

describe("csp checkReportEndpoint", () => {
  it("flags missing report-uri", () => {
    const r = checkReportEndpoint({});
    expect(r.hasReportUri).toBe(false);
  });
  it("detects report-uri", () => {
    const r = checkReportEndpoint({ "report-uri": ["/csp-report"] });
    expect(r.hasReportUri).toBe(true);
    expect(r.endpoint).toBe("/csp-report");
  });
});

describe("csp checkDeprecatedHeaders", () => {
  it("returns X-Frame-Options warning", () => {
    const r = checkDeprecatedHeaders();
    expect(r.some((h) => h.header === "X-Frame-Options")).toBe(true);
  });
});

describe("csp compareCsps", () => {
  it("finds differences", () => {
    const diffs = compareCsps(
      "default-src 'self'; script-src 'self'",
      "default-src 'self'; script-src 'self' 'unsafe-inline'",
    );
    const scriptDiff = diffs.find((d) => d.directive === "script-src");
    expect(scriptDiff?.onlyInRight).toContain("'unsafe-inline'");
    expect(scriptDiff?.same).toBe(false);
  });
});

describe("csp history", () => {
  beforeEach(() => {
    const store: Record<string, string> = {};
    (globalThis as any).localStorage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
    };
  });
  it("saves and loads", () => {
    saveCspToHistory("default-src 'self'", 90);
    const h = loadCspHistory();
    expect(h).toHaveLength(1);
    expect(h[0].score).toBe(90);
  });
  it("clears", () => {
    saveCspToHistory("test", 80);
    clearCspHistory();
    expect(loadCspHistory()).toEqual([]);
  });
});

describe("csp buildCsp", () => {
  it("builds CSP from directives", () => {
    const directives: CspBuilderDirective[] = [
      { name: "default-src", sources: ["'self'"], enabled: true },
      { name: "script-src", sources: ["'self'", "'nonce-abc'"], enabled: true },
      { name: "img-src", sources: [], enabled: true }, // should be skipped
    ];
    const csp = buildCsp(directives);
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self' 'nonce-abc'");
    expect(csp).not.toContain("img-src");
  });
});

describe("csp CSP_PRESETS", () => {
  it("has at least 3 presets", () => {
    expect(CSP_PRESETS.length).toBeGreaterThanOrEqual(3);
  });
  it("includes Strict preset", () => {
    expect(CSP_PRESETS.some((p) => p.name === "Strict (recommended)")).toBe(true);
  });
});

describe("csp explainSource", () => {
  it("explains 'self'", () => {
    const e = explainSource("'self'");
    expect(e.meaning).toContain("Same origin");
    expect(e.risk).toBe("safe");
  });
  it("explains unsafe-inline as high risk", () => {
    expect(explainSource("'unsafe-inline'").risk).toBe("high");
  });
});

describe("csp getScoreBreakdown", () => {
  it("computes points per finding", () => {
    const findings = [
      { severity: "high" as const, directive: "x", message: "test", recommendation: "" },
      { severity: "medium" as const, directive: "y", message: "test", recommendation: "" },
    ];
    const breakdown = getScoreBreakdown(findings);
    expect(breakdown[0].points).toBe(-25);
    expect(breakdown[1].points).toBe(-10);
  });
});

describe("csp format exports", () => {
  it("formats as Nginx", () => {
    const nginx = cspToNginx("default-src 'self'");
    expect(nginx).toContain("add_header Content-Security-Policy");
  });
  it("formats as Apache", () => {
    const apache = cspToApache("default-src 'self'");
    expect(apache).toContain("Header always set Content-Security-Policy");
  });
  it("formats as meta tag", () => {
    const meta = cspToMetaTag("default-src 'self'");
    expect(meta).toContain("<meta http-equiv");
  });
});

describe("csp DIRECTIVE_REFERENCE", () => {
  it("includes common directives", () => {
    const names = DIRECTIVE_REFERENCE.map((d) => d.name);
    expect(names).toContain("default-src");
    expect(names).toContain("script-src");
    expect(names).toContain("frame-ancestors");
  });
});

describe("csp generateNonce", () => {
  it("generates a base64 nonce", () => {
    const nonce = generateNonce(16);
    expect(nonce).toBeTruthy();
    expect(nonce.length).toBeGreaterThan(10);
  });
  it("generates unique nonces", () => {
    const n1 = generateNonce(16);
    const n2 = generateNonce(16);
    expect(n1).not.toBe(n2);
  });
});

describe("csp buildCspShareUrl", () => {
  it("builds share URL", () => {
    const origWindow = globalThis.window;
    (globalThis as any).window = {
      location: { origin: "https://x.com", pathname: "/tools/csp-evaluator" },
    };
    const url = buildCspShareUrl("default-src 'self'");
    expect(url).toContain("#csp=");
    (globalThis as any).window = origWindow;
  });
});
