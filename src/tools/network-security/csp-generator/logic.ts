/**
 * CSP Generator — pure logic.
 *
 * Builds a Content-Security-Policy header directive-by-directive and runs
 * Google-CSP-Evaluator-style heuristics to flag XSS bypasses (unsafe-inline,
 * wildcards, missing object-src/base-uri, bypass gadgets). 100% client-side,
 * no network access, no React.
 */

export type Severity = "high" | "medium" | "low" | "info";

export interface CspFinding {
  severity: Severity;
  directive: string;
  message: string;
  recommendation: string;
}

export interface CspBypassGadget {
  source: string;
  type: "angular" | "prototype" | "jsonp" | "data-uri" | "wildcard-scheme";
  severity: Severity;
  message: string;
  recommendation: string;
}

export interface CspAnalysis {
  directives: Record<string, string[]>;
  findings: CspFinding[];
  gadgets: CspBypassGadget[];
  score: number; // 0-100, higher is better
  isValid: boolean;
  error?: string;
}

/** Directives that fetch network resources. */
export const FETCH_DIRECTIVES = new Set([
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

export const DIRECTIVE_DOCS: Record<string, { title: string; desc: string; csp3?: boolean }> = {
  "default-src": { title: "Default source", desc: "Fallback for any fetch directive not explicitly set. Always define this first." },
  "script-src": { title: "Scripts", desc: "Where JavaScript may load from. Most XSS-relevant directive." },
  "style-src": { title: "Stylesheets", desc: "Where CSS may load from." },
  "img-src": { title: "Images", desc: "Where images may load from." },
  "font-src": { title: "Fonts", desc: "Where @font-face may load from." },
  "connect-src": { title: "Fetch / XHR / WS", desc: "Where fetch(), XHR, WebSocket, EventSource may connect." },
  "media-src": { title: "Media", desc: "Where <audio>/<video> may load from." },
  "object-src": { title: "Plugins", desc: "Where <object>/<embed>/<applet> may load from. Set to 'none' if unused." },
  "frame-src": { title: "Frames", desc: "Where iframes may load from." },
  "child-src": { title: "Workers + frames", desc: "CSP3 unified source for workers and frames; deprecated, prefer frame-src + worker-src." },
  "worker-src": { title: "Workers", desc: "Where Worker/SharedWorker may load from (CSP3)." },
  "manifest-src": { title: "Manifest", desc: "Where the Web App Manifest may load from (CSP3)." },
  "frame-ancestors": { title: "Frame ancestors", desc: "Who may embed THIS page (anti-clickjacking). Not valid in meta tag." },
  "base-uri": { title: "Base URI", desc: "What <base href> may be set to. Restricts base-tag hijacking." },
  "form-action": { title: "Form action", desc: "Where forms may submit to. Restricts form-action hijacking." },
  "sandbox": { title: "Sandbox", desc: "Applies sandbox restrictions to the page." },
  "upgrade-insecure-requests": { title: "Upgrade HTTP", desc: "Auto-upgrade http: to https: before fetching." },
  "require-trusted-types-for": { title: "Require Trusted Types", desc: "Force Trusted Types for sinks (e.g. 'script'). CSP3." },
  "trusted-types": { title: "Trusted Types policy", desc: "Allowlist of Trusted Types policy names." },
  "report-uri": { title: "Report endpoint (legacy)", desc: "Where browsers POST violation reports. Superseded by report-to." },
  "report-to": { title: "Report endpoint (CSP3)", desc: "Group name configured via the Report-To HTTP header." },
  "strict-dynamic": { title: "Strict dynamic", desc: "Trust scripts loaded by already-trusted scripts. CSP3.", csp3: true },
  "unsafe-hashes": { title: "Unsafe hashes", desc: "Allow inline event handlers via hash. CSP3.", csp3: true },
};

const KNOWN_GADGETS: { pattern: RegExp; type: CspBypassGadget["type"]; message: string; recommendation: string }[] = [
  { pattern: /(angular[^/]*\.(gstatic|googleapis)\.com|googleapis\.com\/ajax\/libs\/angular)/i, type: "angular", message: "Angular on a CDN allows CSP bypass via $eval / $interpolate.", recommendation: "Self-host Angular or remove from script-src; use nonce + strict-dynamic." },
  { pattern: /(ajax\.googleapis\.com\/.*\/prototype|prototypejs\.org)/i, type: "prototype", message: "Prototype.js on CDN allows arbitrary JS via String#evalJSON.", recommendation: "Self-host Prototype or remove from script-src." },
  { pattern: /(cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|ajax\.googleapis\.com\/ajax\/libs(?!\/angular))/i, type: "jsonp", message: "CDN hosts JSONP endpoints — any allowed path becomes a script-injection gadget.", recommendation: "Use self-hosted copies, or pin exact paths + nonce + strict-dynamic." },
  { pattern: /^data:/i, type: "data-uri", message: "data: URIs in script-src allow inline-script bypass via data:text/javascript.", recommendation: "Remove data: from script-src; allow only specific script hashes." },
  { pattern: /^(https?:|\*)/i, type: "wildcard-scheme", message: "Wildcard or scheme-based source allows any host.", recommendation: "Replace with explicit hostnames or use nonce + strict-dynamic." },
];

/** Parse a CSP header into a directive → sources map. */
export function parseCsp(header: string): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  if (!header || typeof header !== "string") return result;
  const parts = header.split(";").map((s) => s.trim()).filter(Boolean);
  for (const part of parts) {
    const tokens = part.split(/\s+/).filter(Boolean);
    if (tokens.length === 0) continue;
    const name = tokens[0]!.toLowerCase();
    const sources = tokens.slice(1).map((s) => s);
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

/** Detect known bypass gadgets in script-src / default-src. */
export function detectBypassGadgets(directives: Record<string, string[]>): CspBypassGadget[] {
  const out: CspBypassGadget[] = [];
  const checkDirectives = ["script-src", "default-src"];
  for (const d of checkDirectives) {
    const srcs = directives[d];
    if (!srcs) continue;
    for (const s of srcs) {
      for (const g of KNOWN_GADGETS) {
        if (g.pattern.test(s)) {
          out.push({
            source: s,
            type: g.type,
            severity: g.type === "wildcard-scheme" || g.type === "data-uri" ? "high" : "medium",
            message: g.message,
            recommendation: g.recommendation,
          });
        }
      }
    }
  }
  return out;
}

/** Run evaluator heuristics on parsed directives. */
export function analyzeCsp(header: string): CspAnalysis {
  const directives = parseCsp(header);
  const err = validateCsp(directives);
  if (err) {
    return { directives, findings: [], gadgets: [], score: 0, isValid: false, error: err };
  }
  const findings: CspFinding[] = [];
  const has = (d: string) => Boolean(directives[d]);
  const sourcesOf = (d: string) => directives[d] ?? [];

  // unsafe-inline in script-src / default-src
  for (const d of ["script-src", "default-src"]) {
    if (sourcesOf(d).includes("'unsafe-inline'")) {
      findings.push({
        severity: "high",
        directive: d,
        message: "'unsafe-inline' allows inline <script> and event handlers, defeating CSP's XSS protection.",
        recommendation: "Use 'nonce-XXX' or 'sha256-...' for inline scripts; pair with 'strict-dynamic'.",
      });
    }
  }
  // unsafe-eval
  for (const d of ["script-src", "default-src"]) {
    if (sourcesOf(d).includes("'unsafe-eval'")) {
      findings.push({
        severity: "high",
        directive: d,
        message: "'unsafe-eval' allows eval(), new Function() — major XSS risk.",
        recommendation: "Refactor code to avoid eval; use strict mode + nonce-based CSP.",
      });
    }
  }
  // wildcards
  for (const d of FETCH_DIRECTIVES) {
    for (const s of sourcesOf(d)) {
      if (s === "*" || s === "https:" || s === "http:") {
        findings.push({
          severity: d === "script-src" || d === "default-src" ? "high" : "medium",
          directive: d,
          message: `Wildcard source '${s}' allows any host.`,
          recommendation: "List explicit hosts, or use 'self' + nonce + strict-dynamic.",
        });
      }
    }
  }
  // missing object-src
  if (!has("object-src") && !has("plugin-types")) {
    findings.push({
      severity: "medium",
      directive: "object-src",
      message: "object-src not set — falls back to default-src, which may allow Flash/plugin-based bypasses.",
      recommendation: "Set object-src 'none' unless you actually use <object>/<embed>.",
    });
  }
  // missing base-uri
  if (!has("base-uri")) {
    findings.push({
      severity: "medium",
      directive: "base-uri",
      message: "base-uri not set — a <base href> injection can redirect relative script URLs to attacker host.",
      recommendation: "Set base-uri 'self' or 'none'.",
    });
  }
  // missing frame-ancestors
  if (!has("frame-ancestors")) {
    findings.push({
      severity: "low",
      directive: "frame-ancestors",
      message: "frame-ancestors not set — page can be framed (clickjacking risk).",
      recommendation: "Set frame-ancestors 'none' or 'self'.",
    });
  }
  // missing form-action
  if (!has("form-action")) {
    findings.push({
      severity: "low",
      directive: "form-action",
      message: "form-action not set — forms can be redirected to attacker-controlled URLs.",
      recommendation: "Set form-action 'self' or explicit allowlist.",
    });
  }
  // http: in script-src
  for (const d of ["script-src", "default-src"]) {
    for (const s of sourcesOf(d)) {
      if (s.startsWith("http://")) {
        findings.push({
          severity: "medium",
          directive: d,
          message: `http: source '${s}' in script directive — MITM risk and mixed-content downgrade.`,
          recommendation: "Use https: only; add upgrade-insecure-requests.",
        });
      }
    }
  }
  // missing upgrade-insecure-requests
  if (!has("upgrade-insecure-requests")) {
    findings.push({
      severity: "info",
      directive: "upgrade-insecure-requests",
      message: "upgrade-insecure-requests not set — older http: links remain http:.",
      recommendation: "Add upgrade-insecure-requests; for new sites.",
    });
  }
  // report-uri / report-to
  if (!has("report-uri") && !has("report-to")) {
    findings.push({
      severity: "info",
      directive: "report-to",
      message: "No reporting endpoint configured — violations are invisible in production.",
      recommendation: "Add report-to / report-uri (or use Report-Only mode while rolling out).",
    });
  }
  // strict-dynamic without nonce/hash warning
  if (sourcesOf("script-src").includes("'strict-dynamic'") && !sourcesOf("script-src").some((s) => s.startsWith("'nonce-") || s.startsWith("'sha"))) {
    findings.push({
      severity: "low",
      directive: "script-src",
      message: "'strict-dynamic' is set but no nonce or hash anchors it — no script will be trusted.",
      recommendation: "Add a 'nonce-XXX' or 'sha256-...' source alongside strict-dynamic.",
    });
  }

  const gadgets = detectBypassGadgets(directives);

  // Score: start 100, subtract per finding by severity
  let score = 100;
  for (const f of findings) {
    score -= f.severity === "high" ? 18 : f.severity === "medium" ? 10 : f.severity === "low" ? 5 : 1;
  }
  for (const g of gadgets) {
    score -= g.severity === "high" ? 15 : 8;
  }
  score = Math.max(0, Math.min(100, score));

  return { directives, findings, gadgets, score, isValid: true };
}

/** Score label from numeric score. */
export function scoreLabel(score: number): "Excellent" | "Good" | "Fair" | "Weak" | "Critical" {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Good";
  if (score >= 50) return "Fair";
  if (score >= 25) return "Weak";
  return "Critical";
}

/** Generate a cryptographically-secure base64 nonce (default 128 bits / 16 bytes). */
export function generateNonce(byteLen = 16): string {
  const bytes = new Uint8Array(byteLen);
  crypto.getRandomValues(bytes);
  // base64 encode
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

/** Compute SHA-256 hash of an inline script, return as 'sha256-<base64>' CSP source. */
export async function hashInlineScript(scriptText: string): Promise<string> {
  const enc = new TextEncoder();
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(scriptText));
  const bytes = new Uint8Array(digest);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return `'sha256-${btoa(bin)}'`;
}

/** Build a CSP string from a directive → sources map (round-trip / from preset). */
export function buildCsp(directives: Record<string, string[]>): string {
  return Object.entries(directives)
    .filter(([, srcs]) => srcs.length > 0)
    .map(([name, srcs]) => `${name} ${srcs.join(" ")}`.trim())
    .join("; ");
}

/** Convert a CSP header value to Nginx config directive. */
export function cspToNginx(csp: string, reportOnly = false): string {
  const name = reportOnly ? "Content-Security-Policy-Report-Only" : "Content-Security-Policy";
  return `add_header ${name} "${csp.replace(/"/g, '\\"')}" always;`;
}

/** Convert a CSP header value to Apache config directive. */
export function cspToApache(csp: string, reportOnly = false): string {
  const name = reportOnly ? "Content-Security-Policy-Report-Only" : "Content-Security-Policy";
  return `<IfModule mod_headers.c>\n  Header always set ${name} "${csp.replace(/"/g, '\\"')}"\n</IfModule>`;
}

/** Convert a CSP header value to an HTML meta tag. Note: frame-ancestors/sandbox/report-uri are ignored in meta. */
export function cspToMetaTag(csp: string, reportOnly = false): string {
  if (reportOnly) {
    return `<!-- Note: Report-Only mode is NOT supported via meta tag. Use an HTTP header instead. -->\n<meta http-equiv="Content-Security-Policy" content="${csp.replace(/"/g, "&quot;")}">`;
  }
  const metaUnsupported = ["frame-ancestors", "sandbox", "report-uri", "report-to"];
  const present = metaUnsupported.filter((d) => new RegExp(`\\b${d}\\b`, "i").test(csp));
  const note = present.length
    ? `<!-- Warning: ${present.join(", ")} ${present.length === 1 ? "is" : "are"} ignored in meta tags. Use an HTTP header. -->\n`
    : "";
  return `${note}<meta http-equiv="Content-Security-Policy" content="${csp.replace(/"/g, "&quot;")}">`;
}

/** Strict CSP presets per app type (Google recommendation). */
export function suggestStrictCsp(appType: "spa" | "ssr" | "static" | "api"): { name: string; csp: string; description: string } {
  const nonce = "nonce-${NONCE}";
  switch (appType) {
    case "spa":
      return {
        name: "SPA (React/Vue/Angular)",
        csp: `default-src 'none'; script-src ${nonce} 'strict-dynamic'; style-src ${nonce} 'self'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' https:; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests; report-to csp-endpoint`,
        description: "Strict CSP for single-page apps. Nonce-per-request + strict-dynamic; https: for connect-src allows API calls.",
      };
    case "ssr":
      return {
        name: "SSR (Next.js/Nuxt)",
        csp: `default-src 'self'; script-src ${nonce} 'strict-dynamic'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests; report-to csp-endpoint`,
        description: "Server-rendered app. 'unsafe-inline' on style-src tolerates inline critical CSS; nonce anchors scripts.",
      };
    case "static":
      return {
        name: "Static site",
        csp: `default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; upgrade-insecure-requests; report-to csp-endpoint`,
        description: "Tightest CSP — only same-origin resources. Ideal for static marketing/docs sites.",
      };
    case "api":
      return {
        name: "API / JSON endpoint",
        csp: `default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'`,
        description: "API responses shouldn't render as HTML. 'none' everywhere; prevents JSON-as-HTML XSS.",
      };
  }
}

/** Encode a policy config into a URL fragment for sharing (no secrets — CSP is public). */
export function encodeToFragment(csp: string, reportOnly: boolean): string {
  const obj = { csp, r: reportOnly ? 1 : 0 };
  return `#csp=${encodeURIComponent(JSON.stringify(obj))}`;
}

/** Decode a policy config from a URL fragment. */
export function decodeFromFragment(fragment: string): { csp: string; reportOnly: boolean } | null {
  const m = /#csp=(.+)$/.exec(fragment);
  if (!m) return null;
  try {
    const obj = JSON.parse(decodeURIComponent(m[1]!));
    if (typeof obj.csp !== "string") return null;
    return { csp: obj.csp, reportOnly: Boolean(obj.r) };
  } catch {
    return null;
  }
}

/** Parse a Report-To header JSON value, validating fields per the Reporting API spec. */
export function parseReportTo(json: string): { ok: true; groups: unknown } | { ok: false; error: string } {
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return { ok: false, error: "Report-To must be a JSON array of group objects." };
    for (const g of parsed) {
      if (typeof g.group !== "string") return { ok: false, error: "Each group must have a 'group' string." };
      if (!Array.isArray(g.endpoints) || g.endpoints.length === 0) return { ok: false, error: `Group '${g.group}' needs at least one endpoint.` };
      for (const e of g.endpoints) {
        if (typeof e.url !== "string") return { ok: false, error: "Each endpoint needs a 'url' string." };
      }
      if (typeof g.max_age !== "number") return { ok: false, error: `Group '${g.group}' needs numeric 'max_age'.` };
    }
    return { ok: true, groups: parsed };
  } catch (e) {
    return { ok: false, error: `Invalid JSON: ${(e as Error).message}` };
  }
}
