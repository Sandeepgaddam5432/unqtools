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

// ===== Bypass gadget detection (blueprint feature) =====

export interface BypassGadget {
  source: string;           // e.g. "cdn.jsdelivr.net"
  type: "jsonp" | "angular" | "prototype" | "script-inject";
  severity: "high" | "medium" | "low";
  message: string;
  recommendation: string;
}

/** Known JSONP/callback endpoints and script-injection gadgets in popular CDNs. */
const KNOWN_GADGETS: Array<{ source: string; type: BypassGadget["type"]; severity: BypassGadget["severity"]; message: string }> = [
  { source: "cdn.jsdelivr.net", type: "jsonp", severity: "medium", message: "jsdelivr allows arbitrary paths — can be used as a JSONP gadget for CSP bypass." },
  { source: "cdnjs.cloudflare.com", type: "jsonp", severity: "medium", message: "CDNJS hosts Angular and other libraries with JSONP-like gadgets." },
  { source: "ajax.googleapis.com", type: "jsonp", severity: "medium", message: "Google Hosted Libraries — Angular and Prototype available, both are CSP bypass gadgets." },
  { source: "cdn.jsdelivr.net", type: "angular", severity: "high", message: "Angular on jsdelivr can be used for CSP bypass via ng-csp + $eval." },
  { source: "ajax.googleapis.com", type: "angular", severity: "high", message: "Angular on Google CDN — classic CSP bypass via $eval." },
  { source: "ajax.googleapis.com", type: "prototype", severity: "medium", message: "Prototype.js — can be used for prototype pollution + CSP bypass." },
  { source: "*", type: "script-inject", severity: "high", message: "Wildcard source — any CDN can serve attacker-controlled scripts." },
  { source: "data:", type: "script-inject", severity: "high", message: "data: URIs in script-src — can be used to inject arbitrary scripts." },
];

/** Detect known bypass gadgets in a CSP. */
export function detectBypassGadgets(directives: Record<string, string[]>): BypassGadget[] {
  const findings: BypassGadget[] = [];
  const scriptSources = [
    ...(directives["script-src"] ?? []),
    ...(directives["default-src"] ?? []),
  ];
  for (const source of scriptSources) {
    for (const gadget of KNOWN_GADGETS) {
      if (source.includes(gadget.source) || source === gadget.source) {
        const rec = gadget.type === "angular"
          ? "Remove Angular from CDN, or use a hash/nonce to restrict inline Angular templates."
          : gadget.type === "jsonp"
            ? "Remove this CDN from script-src, or use a stricter path (e.g. cdn.jsdelivr.net/npm/specific-package@version/)."
            : gadget.type === "prototype"
              ? "Remove Prototype.js — use modern frameworks instead."
              : "Remove this source entirely. Use 'self' + explicit nonces/hashes.";
        findings.push({
          source,
          type: gadget.type,
          severity: gadget.severity,
          message: gadget.message,
          recommendation: rec,
        });
      }
    }
  }
  return findings;
}

// ===== Auto-suggest strict CSP (blueprint feature) =====

export interface SuggestedCsp {
  csp: string;
  explanation: string;
}

/** Generate a suggested strict CSP for a given app type. */
export function suggestStrictCsp(appType: "spa" | "ssr" | "static" | "api" = "spa"): SuggestedCsp {
  switch (appType) {
    case "spa":
      return {
        csp: "default-src 'none'; script-src 'self' 'nonce-{NONCE}'; style-src 'self' 'nonce-{NONCE}'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' https://api.example.com; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; upgrade-insecure-requests; report-uri /csp-report",
        explanation: "Strict CSP for a single-page app. Uses nonces for scripts/styles, allows images from self/data/https, restricts API calls to your backend. Replace {NONCE} with a per-request random value, and update api.example.com to your API URL.",
      };
    case "ssr":
      return {
        csp: "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests; report-uri /csp-report",
        explanation: "Strict CSP for server-side rendered app. No nonces needed since all scripts are from 'self'. Tighter than SPA — all resources from same origin.",
      };
    case "static":
      return {
        csp: "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; upgrade-insecure-requests",
        explanation: "Strict CSP for a static site (no backend). All resources from self, no external CDNs.",
      };
    case "api":
      return {
        csp: "default-src 'none'; frame-ancestors 'none'",
        explanation: "Minimal CSP for an API endpoint — no content should be rendered, no framing allowed.",
      };
  }
}

// ===== Hash/nonce injection suggestion (blueprint feature) =====

export interface InlineScriptInfo {
  type: "inline" | "eval" | "inline-event";
  recommendation: string;
  hash?: string;       // SHA-256 hash if inline script detected
}

/** Suggest hash/nonce for inline scripts detected in the CSP. */
export function suggestHashOrNonce(directives: Record<string, string[]>): InlineScriptInfo[] {
  const findings: InlineScriptInfo[] = [];
  const scriptSources = directives["script-src"] ?? directives["default-src"] ?? [];
  if (scriptSources.includes("'unsafe-inline'")) {
    findings.push({
      type: "inline",
      recommendation: "Replace 'unsafe-inline' with a per-request nonce: 'nonce-{NONCE}' (base64, 16+ chars, regenerated each request). Or use a hash: 'sha256-{HASH}' for static inline scripts.",
    });
  }
  if (scriptSources.includes("'unsafe-eval'")) {
    findings.push({
      type: "eval",
      recommendation: "Remove 'unsafe-eval'. Refactor: replace eval() with Function(), new Function() with explicit function definitions, setTimeout(string) with setTimeout(function).",
    });
  }
  // Check for inline event handlers (onclick="...")
  const styleSources = directives["style-src"] ?? directives["default-src"] ?? [];
  if (styleSources.includes("'unsafe-inline'")) {
    findings.push({
      type: "inline-event",
      recommendation: "Replace inline style attributes with class-based styling. Use nonces for <style> tags.",
    });
  }
  return findings;
}

// ===== Report-endpoint test (blueprint feature — heuristic) =====

export interface ReportEndpointInfo {
  hasReportUri: boolean;
  hasReportTo: boolean;
  endpoint?: string;
  recommendation: string;
}

/** Check if CSP has a report endpoint configured. */
export function checkReportEndpoint(directives: Record<string, string[]>): ReportEndpointInfo {
  const reportUri = directives["report-uri"]?.[0];
  const reportTo = directives["report-to"]?.[0];
  const hasReportUri = !!reportUri;
  const hasReportTo = !!reportTo;
  let recommendation: string;
  if (!hasReportUri && !hasReportTo) {
    recommendation = "Add 'report-uri /csp-report' or use the Reporting API with 'report-to'. Without reporting, CSP violations are invisible to you.";
  } else {
    recommendation = "Reporting is configured. Set up a /csp-report endpoint that accepts POST with Content-Type: application/csp-report and logs violations.";
  }
  return {
    hasReportUri,
    hasReportTo,
    endpoint: reportUri || reportTo,
    recommendation,
  };
}

// ===== Deprecated header warnings (blueprint feature) =====

export interface DeprecatedHeader {
  header: string;
  supersededBy: string;
  recommendation: string;
}

/** Check for deprecated security headers that CSP supersedes. */
export function checkDeprecatedHeaders(): DeprecatedHeader[] {
  return [
    {
      header: "X-Frame-Options",
      supersededBy: "frame-ancestors in CSP",
      recommendation: "Remove X-Frame-Options. Use 'frame-ancestors \\'none\\'' in CSP instead — it's more flexible (supports lists of origins).",
    },
    {
      header: "X-Content-Type-Options: nosniff",
      supersededBy: "(not superseded — still recommended)",
      recommendation: "Keep X-Content-Type-Options: nosniff. It's not part of CSP but complements it — prevents MIME-type sniffing.",
    },
  ];
}

// ===== Comparison mode (blueprint feature) =====

export interface CspDiff {
  directive: string;
  leftSources: string[];
  rightSources: string[];
  onlyInLeft: string[];
  onlyInRight: string[];
  same: boolean;
}

/** Compare two CSPs directive-by-directive. */
export function compareCsps(left: string, right: string): CspDiff[] {
  const leftDir = parseCsp(left);
  const rightDir = parseCsp(right);
  const allDirectives = new Set([...Object.keys(leftDir), ...Object.keys(rightDir)]);
  const diffs: CspDiff[] = [];
  for (const dir of allDirectives) {
    const leftSources = leftDir[dir] ?? [];
    const rightSources = rightDir[dir] ?? [];
    const onlyInLeft = leftSources.filter((s) => !rightSources.includes(s));
    const onlyInRight = rightSources.filter((s) => !leftSources.includes(s));
    diffs.push({
      directive: dir,
      leftSources,
      rightSources,
      onlyInLeft,
      onlyInRight,
      same: onlyInLeft.length === 0 && onlyInRight.length === 0,
    });
  }
  return diffs.sort((a, b) => a.directive.localeCompare(b.directive));
}

// ===== Extra #1: CSP history =====

const CSP_HISTORY_KEY = "unqtools-csp-history";
const MAX_CSP_HISTORY = 20;

export interface CspHistoryEntry {
  csp: string;
  score: number;
  analyzedAt: string;
}

export function loadCspHistory(): CspHistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(CSP_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, MAX_CSP_HISTORY);
  } catch {
    return [];
  }
}

export function saveCspToHistory(csp: string, score: number): CspHistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  const entry: CspHistoryEntry = { csp, score, analyzedAt: new Date().toISOString() };
  const current = loadCspHistory().filter((e) => e.csp !== csp);
  const updated = [entry, ...current].slice(0, MAX_CSP_HISTORY);
  try { localStorage.setItem(CSP_HISTORY_KEY, JSON.stringify(updated)); } catch {}
  return updated;
}

export function clearCspHistory(): void {
  if (typeof localStorage === "undefined") return;
  try { localStorage.removeItem(CSP_HISTORY_KEY); } catch {}
}

// ===== Extra #2: CSP builder =====

export interface CspBuilderDirective {
  name: string;
  sources: string[];
  enabled: boolean;
}

/** Build a CSP string from builder directives. */
export function buildCsp(directives: CspBuilderDirective[]): string {
  return directives
    .filter((d) => d.enabled && d.sources.length > 0)
    .map((d) => `${d.name} ${d.sources.join(" ")}`)
    .join("; ");
}

// ===== Extra #3: CSP preset templates =====

export interface CspPreset {
  name: string;
  description: string;
  csp: string;
}

export const CSP_PRESETS: CspPreset[] = [
  {
    name: "Strict (recommended)",
    description: "Maximum security — all resources from self, nonces for scripts/styles.",
    csp: "default-src 'none'; script-src 'self' 'nonce-{NONCE}'; style-src 'self' 'nonce-{NONCE}'; img-src 'self' data:; font-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; upgrade-insecure-requests",
  },
  {
    name: "Permissive (legacy)",
    description: "Allows inline scripts/styles — for legacy apps. Not recommended.",
    csp: "default-src * 'unsafe-inline' 'unsafe-eval'; img-src * data:; font-src *",
  },
  {
    name: "Report-only",
    description: "Reports violations without blocking — good for testing.",
    csp: "default-src 'self'; script-src 'self'; report-uri /csp-report",
  },
  {
    name: "WordPress",
    description: "CSP tuned for WordPress sites (allows common WP CDNs).",
    csp: "default-src 'self'; script-src 'self' 'unsafe-inline' cdn.jsdelivr.net ajax.googleapis.com; style-src 'self' 'unsafe-inline' fonts.googleapis.com; font-src 'self' fonts.gstatic.com; img-src 'self' data: https:; upgrade-insecure-requests",
  },
  {
    name: "Next.js",
    description: "CSP for Next.js apps (allows webpack chunks + eval in dev).",
    csp: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; upgrade-insecure-requests",
  },
];

// ===== Extra #4: Source explanation =====

export interface SourceExplanation {
  source: string;
  meaning: string;
  risk: "safe" | "low" | "medium" | "high";
}

const SOURCE_EXPLANATIONS: Record<string, SourceExplanation> = {
  "'self'": { source: "'self'", meaning: "Same origin as the page (scheme + host + port).", risk: "safe" },
  "'none'": { source: "'none'", meaning: "No sources allowed at all (most strict).", risk: "safe" },
  "'unsafe-inline'": { source: "'unsafe-inline'", meaning: "Allows inline <script> and <style> tags, and inline event handlers.", risk: "high" },
  "'unsafe-eval'": { source: "'unsafe-eval'", meaning: "Allows eval(), new Function(), setTimeout(string).", risk: "high" },
  "'unsafe-hashes'": { source: "'unsafe-hashes'", meaning: "Allows specific inline event handlers via hash.", risk: "medium" },
  "data:": { source: "data:", meaning: "Allows data: URIs (inline base64-encoded content).", risk: "medium" },
  "blob:": { source: "blob:", meaning: "Allows blob: URIs (in-memory objects via URL.createObjectURL).", risk: "medium" },
  "*": { source: "*", meaning: "Wildcard — allows any origin.", risk: "high" },
  "http:": { source: "http:", meaning: "Allows any HTTP origin (insecure).", risk: "high" },
  "https:": { source: "https:", meaning: "Allows any HTTPS origin.", risk: "medium" },
};

export function explainSource(source: string): SourceExplanation {
  return SOURCE_EXPLANATIONS[source] ?? {
    source,
    meaning: `Specific origin: ${source}`,
    risk: source.startsWith("https://") ? "low" : source.startsWith("http://") ? "medium" : "low",
  };
}

// ===== Extra #5: CSP score breakdown =====

export interface ScoreBreakdown {
  finding: string;
  severity: Severity;
  points: number;
}

/** Get a detailed breakdown of how the score was computed. */
export function getScoreBreakdown(findings: CspFinding[]): ScoreBreakdown[] {
  return findings.map((f) => ({
    finding: `${f.directive}: ${f.message.slice(0, 60)}${f.message.length > 60 ? "..." : ""}`,
    severity: f.severity,
    points: f.severity === "high" ? -25 : f.severity === "medium" ? -10 : f.severity === "low" ? -3 : 0,
  }));
}

// ===== Extra #6: Copy as different formats =====

/** Format a CSP as an Nginx add_header directive. */
export function cspToNginx(csp: string): string {
  return `add_header Content-Security-Policy "${csp.replace(/"/g, '\\"')}" always;`;
}

/** Format a CSP as an Apache Header directive. */
export function cspToApache(csp: string): string {
  return `Header always set Content-Security-Policy "${csp.replace(/"/g, '\\"')}"`;
}

/** Format a CSP as a meta tag. */
export function cspToMetaTag(csp: string): string {
  return `<meta http-equiv="Content-Security-Policy" content="${csp.replace(/"/g, '&quot;')}">`;
}

// ===== Extra #7: Directive reference =====

export interface DirectiveInfo {
  name: string;
  description: string;
  fallback: string | null;   // which directive falls back to this
  example: string;
}

export const DIRECTIVE_REFERENCE: DirectiveInfo[] = [
  { name: "default-src", description: "Fallback for all fetch directives.", fallback: null, example: "default-src 'self'" },
  { name: "script-src", description: "Restricts JavaScript sources.", fallback: "default-src", example: "script-src 'self' 'nonce-abc'" },
  { name: "style-src", description: "Restricts CSS sources.", fallback: "default-src", example: "style-src 'self' 'nonce-abc'" },
  { name: "img-src", description: "Restricts image sources.", fallback: "default-src", example: "img-src 'self' data: https:" },
  { name: "font-src", description: "Restricts font sources.", fallback: "default-src", example: "font-src 'self' fonts.gstatic.com" },
  { name: "connect-src", description: "Restricts fetch/XHR/WebSocket connections.", fallback: "default-src", example: "connect-src 'self' https://api.example.com" },
  { name: "media-src", description: "Restricts audio/video sources.", fallback: "default-src", example: "media-src 'self'" },
  { name: "object-src", description: "Restricts <object>/<embed>/<applet>.", fallback: "default-src", example: "object-src 'none'" },
  { name: "frame-src", description: "Restricts <frame>/<iframe> sources.", fallback: "default-src", example: "frame-src 'self'" },
  { name: "frame-ancestors", description: "Restricts who can frame this page (clickjacking).", fallback: null, example: "frame-ancestors 'none'" },
  { name: "base-uri", description: "Restricts <base> tag URL.", fallback: null, example: "base-uri 'self'" },
  { name: "form-action", description: "Restricts form submission URLs.", fallback: null, example: "form-action 'self'" },
  { name: "upgrade-insecure-requests", description: "Auto-upgrade http: to https:.", fallback: null, example: "upgrade-insecure-requests" },
  { name: "report-uri", description: "URL to POST violation reports to (deprecated).", fallback: null, example: "report-uri /csp-report" },
  { name: "report-to", description: "Reporting API endpoint name (modern).", fallback: null, example: "report-to csp-endpoint" },
];

// ===== Extra #8: Nonce generator =====

/** Generate a cryptographically secure nonce for CSP. */
export function generateNonce(byteLength: number = 16): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

// ===== Extra #9: Shareable URL =====

export function buildCspShareUrl(csp: string): string {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}${window.location.pathname}#csp=${encodeURIComponent(csp)}`;
}

export function extractCspFromFragment(): string | null {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash;
  if (!hash) return null;
  const match = hash.match(/[#&]csp=([^&]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

// ===== Extra #10: CSP report parser =====
// (UI-side — parses the JSON body of a CSP violation report)
