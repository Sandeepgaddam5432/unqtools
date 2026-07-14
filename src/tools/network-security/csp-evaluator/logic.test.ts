import { describe, it, expect } from "vitest";
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
