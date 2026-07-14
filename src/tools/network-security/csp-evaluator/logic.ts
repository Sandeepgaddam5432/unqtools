/**
 * CSP Evaluator — pure logic.
 *
 * Parses and analyzes Content Security Policy headers. No network access
 * needed; everything is string parsing and pattern matching.
 */

export type Severity = "high" | "medium" | "low" | "info";

export interface CspFinding {
  severity: Severity;
  directive: string;
  message: string;
  recommendation: string;
}

export interface CspAnalysis {
  directives: Record<string, string[]>;
  findings: CspFinding[];
  score: number;            // 0-100, higher is better
  isValid: boolean;
  error?: string;
}

/** Directives that fetch network resources and should not use http: sources. */
const SCRIPT_DIRECTIVES = new Set([
  "script-src",
  "script-src-elem",
  "script-src-attr",
]);

const STYLE_DIRECTIVES = new Set(["style-src", "style-src-elem", "style-src-attr"]);

const FETCH_DIRECTIVES = new Set([
  "default-src",
  "script-src",
  "style-src",
  "img-src",
  "font-src",
  "connect-src",
  "media-src",
  "object-src",
  "frame-src",
  "child-src",
  "worker-src",
  "manifest-src",
  "prefetch-src",
]);

const DEPRECATED_DIRECTIVES = new Set([
  "frame-src",         // replaced by child-src, but came back
  "child-src",         // deprecated in CSP3 in favor of frame-src + worker-src
  "prefetch-src",      // removed from CSP3
  "plugin-types",      // removed
  "reflect-nonce",     // never standardized
]);

/** Parse a CSP header into a directive → sources map. */
export function parseCsp(header: string): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  if (!header || typeof header !== "string") return result;

  // CSP directives are separated by ;
  const parts = header.split(";").map((s) => s.trim()).filter(Boolean);
  for (const part of parts) {
    const tokens = part.split(/\s+/);
    if (tokens.length === 0) continue;
    const name = tokens[0].toLowerCase();
    const sources = tokens.slice(1).map((s) => s.toLowerCase());
    result[name] = sources;
  }
  return result;
}

/** Validate that the header has at least one fetch directive. */
export function validateCsp(directives: Record<string, string[]>): string | null {
  const keys = Object.keys(directives);
  if (keys.length === 0) return "CSP header is empty.";
  const hasFetch = keys.some((k) => FETCH_DIRECTIVES.has(k));
  if (!hasFetch) return "CSP header has no fetch directives (default-src, script-src, etc.).";
  return null;
}

/** Check if a source list contains unsafe-inline / unsafe-eval. */
function hasUnsafe(sources: string[]): ("unsafe-inline" | "unsafe-eval" | "unsafe-hashes")[] {
  const unsafe: ("unsafe-inline" | "unsafe-eval" | "unsafe-hashes")[] = [];
  if (sources.includes("'unsafe-inline'")) unsafe.push("unsafe-inline");
  if (sources.includes("'unsafe-eval'")) unsafe.push("unsafe-eval");
  if (sources.includes("'unsafe-hashes'")) unsafe.push("unsafe-hashes");
  return unsafe;
}

/** Check if a source list contains a wildcard host (*.example.com). */
function hasWildcard(sources: string[]): string[] {
  return sources.filter((s) => s.startsWith("*.") || s === "*");
}

/** Check if a source list contains http: or ftp: schemes (insecure). */
function hasInsecureScheme(sources: string[]): string[] {
  return sources.filter((s) => s.startsWith("http:") || s.startsWith("ftp:"));
}

/** Analyze a parsed CSP and return findings. */
export function analyzeCsp(directives: Record<string, string[]>): CspFinding[] {
  const findings: CspFinding[] = [];

  // Check default-src presence
  if (!directives["default-src"]) {
    findings.push({
      severity: "medium",
      directive: "default-src",
      message: "No default-src directive. Every fetch type must be explicitly allowed.",
      recommendation: "Add 'default-src \\'none\\'' as a strict baseline, then allow specific directives as needed.",
    });
  } else {
    // default-src present — check its sources
    const def = directives["default-src"];
    if (def.includes("*")) {
      findings.push({
        severity: "high",
        directive: "default-src",
        message: "default-src contains '*' which allows resources from any origin.",
        recommendation: "Replace '*' with explicit origins. 'self' is usually the right starting point.",
      });
    }
    const insecure = hasInsecureScheme(def);
    if (insecure.length > 0) {
      findings.push({
        severity: "high",
        directive: "default-src",
        message: `default-src allows insecure schemes: ${insecure.join(", ")}`,
        recommendation: "Remove http: and ftp: from default-src. Use https: origins only.",
      });
    }
  }

  // Check each fetch directive
  for (const [name, sources] of Object.entries(directives)) {
    if (!FETCH_DIRECTIVES.has(name)) continue;

    // unsafe-inline / unsafe-eval in script-src / style-src
    if (SCRIPT_DIRECTIVES.has(name) || STYLE_DIRECTIVES.has(name)) {
      const unsafe = hasUnsafe(sources);
      for (const u of unsafe) {
        const sev = u === "unsafe-eval" && SCRIPT_DIRECTIVES.has(name) ? "high" : "medium";
        findings.push({
          severity: sev,
          directive: name,
          message: `${name} contains '${u}'.`,
          recommendation:
            u === "unsafe-inline"
              ? "Use nonces ('nonce-XXX') or hashes ('sha256-...') instead of unsafe-inline."
              : u === "unsafe-eval"
                ? "Avoid unsafe-eval. Refactor code to remove eval(), new Function(), setTimeout(string)."
                : "unsafe-hashes should be replaced with nonces or explicit hashes for full protection.",
        });
      }
    }

    // Wildcards
    const wildcards = hasWildcard(sources);
    if (wildcards.length > 0 && SCRIPT_DIRECTIVES.has(name)) {
      findings.push({
        severity: "high",
        directive: name,
        message: `${name} allows wildcards: ${wildcards.join(", ")}. Any subdomain can serve scripts.`,
        recommendation: "Replace wildcards with explicit origins. *.cdn.com can be bypassed if cdn.com has a subdomain takeover.",
      });
    }

    // http: in script directives
    if (SCRIPT_DIRECTIVES.has(name)) {
      const insecure = hasInsecureScheme(sources);
      if (insecure.length > 0) {
        findings.push({
          severity: "high",
          directive: name,
          message: `${name} allows insecure schemes: ${insecure.join(", ")}. MITM attacks can inject scripts.`,
          recommendation: "Remove http: and ftp:. Use https: origins only.",
        });
      }
    }

    // data: in script-src
    if (SCRIPT_DIRECTIVES.has(name) && sources.includes("data:")) {
      findings.push({
        severity: "high",
        directive: name,
        message: `${name} allows data: URIs. These can be used to bypass CSP for script injection.`,
        recommendation: "Remove data: from script-src. If needed for testing, remove before production.",
      });
    }
  }

  // Check deprecated directives
  for (const name of Object.keys(directives)) {
    if (DEPRECATED_DIRECTIVES.has(name)) {
      findings.push({
        severity: "low",
        directive: name,
        message: `${name} is deprecated or removed in CSP Level 3.`,
        recommendation:
          name === "frame-src"
            ? "frame-src is now valid again in CSP3; if you use child-src too, prefer frame-src + worker-src separately."
            : name === "child-src"
              ? "Use frame-src and worker-src separately in CSP Level 3."
              : `Remove ${name} — it's no longer supported by browsers.`,
      });
    }
  }

  // Check for missing upgrade-insecure-requests
  if (!directives["upgrade-insecure-requests"]) {
    findings.push({
      severity: "info",
      directive: "upgrade-insecure-requests",
      message: "No upgrade-insecure-requests directive. Insecure http: subresources will not be auto-upgraded.",
      recommendation: "Add 'upgrade-insecure-requests' to auto-upgrade http: to https: for legacy content.",
    });
  }

  // Check for missing reporting
  if (!directives["report-uri"] && !directives["report-to"]) {
    findings.push({
      severity: "info",
      directive: "report-uri / report-to",
      message: "No reporting directive. CSP violations will not be visible to you.",
      recommendation: "Add 'report-uri /csp-report' or use the Reporting API with 'report-to'.",
    });
  }

  // Check for missing base-uri
  if (!directives["base-uri"]) {
    findings.push({
      severity: "medium",
      directive: "base-uri",
      message: "No base-uri directive. <base> tag injection can redirect relative URLs.",
      recommendation: "Add 'base-uri \\'self\\'' to prevent <base> tag injection attacks.",
    });
  }

  // Check for missing form-action
  if (!directives["form-action"]) {
    findings.push({
      severity: "medium",
      directive: "form-action",
      message: "No form-action directive. Forms can submit to any origin.",
      recommendation: "Add 'form-action \\'self\\'' to prevent form data exfiltration.",
    });
  }

  // Check for missing frame-ancestors
  if (!directives["frame-ancestors"]) {
    findings.push({
      severity: "low",
      directive: "frame-ancestors",
      message: "No frame-ancestors directive. Site can be framed (clickjacking risk).",
      recommendation: "Add 'frame-ancestors \\'none\\'' to prevent clickjacking. (X-Frame-Options is obsolete.)",
    });
  }

  return findings;
}

/** Compute an overall security score (0-100). */
export function computeScore(findings: CspFinding[]): number {
  let score = 100;
  for (const f of findings) {
    if (f.severity === "high") score -= 25;
    else if (f.severity === "medium") score -= 10;
    else if (f.severity === "low") score -= 3;
    // info: no penalty
  }
  return Math.max(0, score);
}

/** Top-level analysis function. */
export function analyze(header: string): CspAnalysis {
  const directives = parseCsp(header);
  const validationError = validateCsp(directives);
  if (validationError) {
    return {
      directives,
      findings: [],
      score: 0,
      isValid: false,
      error: validationError,
    };
  }
  const findings = analyzeCsp(directives);
  const score = computeScore(findings);
  return {
    directives,
    findings,
    score,
    isValid: true,
  };
}

/** Score → human label. */
export function scoreLabel(score: number): string {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Good";
  if (score >= 50) return "Fair";
  if (score >= 25) return "Weak";
  return "Critical";
}
