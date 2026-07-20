/**
 * AI .htaccess Redirect Generator — pure logic.
 *
 * Generate Apache .htaccess redirect and rewrite rules from bulk URL pairs
 * or pattern intent. Supports 301/302/307, RedirectMatch, RewriteRule with
 * capture groups, www/non-www canonicalization, HTTP→HTTPS, hotlink
 * protection, custom error pages, IP allow/block. Per-rule explanations,
 * sample-URL tester emulating mod_rewrite, redirect loop detection,
 * history (localStorage), shareable URL, optional BYO-key LLM.
 *
 * Pure functions only — no DOM, no network. The optional LLM call (BYO API
 * key) lives in ui.tsx because it touches the network.
 */

// ---------- Types ----------

export type RedirectStatus = 301 | 302 | 307;

export type RuleType =
  | "redirect-simple"   // Redirect 301 /old /new
  | "redirect-match"    // RedirectMatch 301 ^/old/(.*)$ /new/$1
  | "rewrite-rule"      // RewriteRule ^old$ /new [R=301,L]
  | "canonical-www"     // www → non-www or vice versa
  | "https-redirect"    // HTTP → HTTPS
  | "hotlink"           // hotlink protection
  | "error-page"        // ErrorDocument 404 /404.html
  | "ip-rule";          // allow / deny IP

export interface RedirectPair {
  from: string;
  to: string;
  status: RedirectStatus;
}

export interface RewriteRuleOptions {
  pattern: string;          // regex pattern, e.g. ^/old/(.*)$
  target: string;           // replacement, e.g. /new/$1
  status: RedirectStatus;
  flags: string[];          // e.g. ["R=301", "L", "NC"]
  useRewriteRule: boolean;  // true → RewriteRule, false → RedirectMatch
}

export interface CanonicalOptions {
  enabled: boolean;
  direction: "www-to-nonwww" | "nonwww-to-www";
  domain: string;          // e.g. example.com (without www.)
}

export interface HttpsOptions {
  enabled: boolean;
}

export interface HotlinkOptions {
  enabled: boolean;
  domain: string;
  allowedDomains: string[];
  redirectUrl: string;     // e.g. /hotlink-denied.png
}

export interface ErrorPage {
  code: number;            // 404, 500, ...
  path: string;            // /404.html
}

export interface IpRule {
  ip: string;              // e.g. 192.168.1.5 or 10.0.0.0/24
  action: "allow" | "deny";
}

export interface GeneratedRule {
  type: RuleType;
  directive: string;        // the .htaccess line(s)
  explanation: string;
  status?: RedirectStatus;
  /** For tester: the pattern (regex source) and target template. */
  patternRegex?: string;
  targetTemplate?: string;
}

export interface HtaccessConfig {
  rules: GeneratedRule[];
  warnings: string[];
  rawText: string;
  ruleCount: number;
}

export interface TestResult {
  url: string;
  matched: boolean;
  matchedRuleIdx: number;   // -1 if no match
  redirectTarget: string | null;
  status: number;           // 0 if no match
  explanation: string;
}

export interface LoopWarning {
  level: "ok" | "warn" | "danger";
  message: string;
  ruleIdx: number;
}

export interface HistoryEntry {
  ts: number;
  pairCount: number;
  patternCount: number;
  canonical: boolean;
  https: boolean;
  hotlink: boolean;
  errorPages: number;
  ipRules: number;
  ruleCount: number;
}

export interface ShareState {
  pairs: RedirectPair[];
  rewrite?: RewriteRuleOptions;
  canonical?: CanonicalOptions;
  https?: HttpsOptions;
  hotlink?: HotlinkOptions;
  errorPages?: ErrorPage[];
  ipRules?: IpRule[];
}

export interface LlmPrompt {
  system: string;
  user: string;
}

// ---------- Constants ----------

export const HISTORY_KEY = "unqtools:ai-htaccess-redirect-generator:history";
export const HISTORY_MAX = 20;

export const STATUS_LABELS: Record<RedirectStatus, string> = {
  301: "301 (Permanent)",
  302: "302 (Temporary)",
  307: "307 (Temporary, preserve method)",
};

export const STATUS_DESCRIPTIONS: Record<RedirectStatus, string> = {
  301: "Permanent redirect. Search engines update their index to the new URL. Cacheable.",
  302: "Temporary redirect. Search engines keep the old URL indexed. Not for permanent moves.",
  307: "Temporary redirect that preserves the HTTP method (POST stays POST). HTTP/1.1 successor to 302.",
};

export const RULE_TYPE_LABELS: Record<RuleType, string> = {
  "redirect-simple": "Simple Redirect",
  "redirect-match": "RedirectMatch (regex)",
  "rewrite-rule": "RewriteRule (regex + flags)",
  "canonical-www": "www canonicalization",
  "https-redirect": "HTTP → HTTPS",
  "hotlink": "Hotlink protection",
  "error-page": "Custom error page",
  "ip-rule": "IP allow/deny",
};

export const DEFAULT_DOMAIN = "example.com";

export const DEFAULT_PAIRS: RedirectPair[] = [
  { from: "/old-page", to: "/new-page", status: 301 },
  { from: "/blog/2020/post", to: "/blog/post", status: 301 },
];

export const DEFAULT_REWRITE: RewriteRuleOptions = {
  pattern: "^/old/(.*)$",
  target: "/new/$1",
  status: 301,
  flags: ["L", "R=301"],
  useRewriteRule: true,
};

export const DEFAULT_CANONICAL: CanonicalOptions = {
  enabled: false,
  direction: "www-to-nonwww",
  domain: DEFAULT_DOMAIN,
};

export const DEFAULT_HTTPS: HttpsOptions = { enabled: false };

export const DEFAULT_HOTLINK: HotlinkOptions = {
  enabled: false,
  domain: DEFAULT_DOMAIN,
  allowedDomains: [DEFAULT_DOMAIN, "www." + DEFAULT_DOMAIN],
  redirectUrl: "/hotlink-denied.png",
};

export const DEFAULT_ERROR_PAGES: ErrorPage[] = [
  { code: 404, path: "/404.html" },
];

export const DEFAULT_IP_RULES: IpRule[] = [];

// ---------- Validators ----------

/** Validate a path or URL for use in a redirect. Returns true if safe. */
export function isValidUrl(url: string): boolean {
  if (!url) return false;
  // Allow paths starting with /, full http(s) URLs, and relative paths.
  if (url.startsWith("/")) return !/[;\n\r]/.test(url);
  if (/^https?:\/\//i.test(url)) {
    try {
      // eslint-disable-next-line no-new
      new URL(url);
      return true;
    } catch { return false; }
  }
  // Disallow shell metacharacters and whitespace control chars.
  return !/[;\n\r\t\\]/.test(url) && url.length < 2048;
}

/** Validate a domain (RFC 1035-ish). */
export function isValidDomain(domain: string): boolean {
  if (!domain) return false;
  return /^(?=.{1,253}$)([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/.test(domain);
}

/** Validate an IPv4 address or CIDR. */
export function isValidIp(ip: string): boolean {
  if (!ip) return false;
  // CIDR
  const cidrMatch = ip.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\/(\d{1,2})$/);
  if (cidrMatch) {
    const octets = cidrMatch[1].split(".").map(Number);
    const prefix = parseInt(cidrMatch[2], 10);
    return octets.every((o) => o >= 0 && o <= 255) && prefix >= 0 && prefix <= 32;
  }
  // Plain IPv4
  const octets = ip.split(".").map(Number);
  if (octets.length !== 4) return false;
  return octets.every((o) => o >= 0 && o <= 255);
}

/** Validate an HTTP error code (4xx or 5xx). */
export function isValidErrorCode(code: number): boolean {
  return Number.isInteger(code) && code >= 400 && code <= 599;
}

// ---------- Helpers ----------

/** Normalize a path: ensure leading slash, trim, collapse slashes. */
export function normalizePath(path: string): string {
  let p = (path || "").trim();
  if (!p) return "";
  if (!p.startsWith("/") && !/^https?:\/\//i.test(p)) p = "/" + p;
  // Collapse duplicate slashes (but not in http://)
  if (!/^https?:\/\//i.test(p)) {
    p = p.replace(/\/{2,}/g, "/");
  }
  return p;
}

/**
 * Escape a literal string for use as an Apache RewriteRule pattern.
 * Apache mod_rewrite uses PCRE; we escape regex metacharacters.
 */
export function escapeRegex(literal: string): string {
  return (literal || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Convert an Apache mod_rewrite pattern to a JavaScript regex source string.
 * Apache patterns are anchored at the start by default; we don't anchor end
 * unless the pattern ends with $.
 */
export function apachePatternToJs(pattern: string): string {
  // Apache already uses PCRE-compatible syntax; the main difference is that
  // we need to ensure the JS RegExp can compile it.
  // Replace $1-$9 back-references — those are for the *target*, not the pattern.
  // The pattern uses () capture groups which are PCRE-compatible.
  return pattern || "";
}

/**
 * Convert an Apache RewriteRule target template (e.g. "/new/$1") to a JS
 * replacement string (e.g. "/new/$1" → for regex.replace we use $1 syntax).
 */
export function apacheTargetToJs(target: string): string {
  // Apache uses $1, $2, ... JS String.replace also uses $1, $2 — same syntax.
  return target || "";
}

/** Try to compile a regex pattern; return null if invalid. */
export function tryCompileRegex(pattern: string): RegExp | null {
  try {
    // Anchor start automatically like Apache (the leading ^ is in the pattern).
    return new RegExp(pattern);
  } catch {
    return null;
  }
}

/** Apply a rule's pattern to a URL; return the target if matched, else null. */
export function applyRule(
  patternRegex: string,
  targetTemplate: string,
  url: string,
): string | null {
  const re = tryCompileRegex(patternRegex);
  if (!re) return null;
  // Test against the path portion of the URL.
  let testStr = url;
  try {
    const u = new URL(url, "http://example.com");
    // Apache RewriteRule matches against the path only (query handled via %{QUERY_STRING}).
    testStr = u.pathname;
  } catch { /* keep raw */ }
  const m = re.exec(testStr);
  if (!m) return null;
  // Substitute $1, $2, ...
  let out = targetTemplate;
  for (let i = 1; i < m.length; i++) {
    out = out.split("$" + i).join(m[i] ?? "");
  }
  return out;
}

// ---------- Bulk pair parser ----------

/**
 * Parse a bulk paste of old→new URL pairs.
 * Accepts formats:
 *   /old /new
 *   /old → /new
 *   /old -> /new
 *   /old,/new
 *   /old  /new  301
 * Lines starting with # are ignored.
 */
export function parseBulkPairs(input: string): RedirectPair[] {
  if (!input) return [];
  const out: RedirectPair[] = [];
  const lines = input.split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    // Try arrow separators first
    let parts: string[] = [];
    if (line.includes("→")) {
      parts = line.split("→").map((s) => s.trim());
    } else if (line.includes("->")) {
      parts = line.split("->").map((s) => s.trim());
    } else if (line.includes("\t")) {
      parts = line.split(/\t+/).map((s) => s.trim());
    } else if (line.includes(",")) {
      parts = line.split(",").map((s) => s.trim());
    } else {
      // Whitespace-separated
      parts = line.split(/\s+/).map((s) => s.trim());
    }
    if (parts.length < 2) continue;
    // The 2nd column may contain "target [status]" (e.g. arrow separator + status code).
    // Split it into target + optional status.
    const toParts = parts[1].split(/\s+/).map((s) => s.trim()).filter(Boolean);
    const from = normalizePath(parts[0]);
    const to = normalizePath(toParts[0] ?? "");
    if (!from || !to) continue;
    // Optional status code in 3rd column or trailing in 2nd column.
    let status: RedirectStatus = 301;
    const statusCandidate = parts[2] ?? toParts[1];
    if (statusCandidate) {
      const code = parseInt(statusCandidate, 10);
      if (code === 301 || code === 302 || code === 307) status = code;
    }
    out.push({ from, to, status });
  }
  return out;
}

/** Render bulk pairs back to a text block (for editing). */
export function renderBulkPairs(pairs: RedirectPair[]): string {
  return pairs.map((p) => `${p.from} → ${p.to} ${p.status}`).join("\n");
}

// ---------- Rule builders ----------

/** Build a simple Redirect directive. */
export function buildSimpleRedirect(pair: RedirectPair): GeneratedRule {
  return {
    type: "redirect-simple",
    directive: `Redirect ${pair.status} ${pair.from} ${pair.to}`,
    explanation: `When a request hits ${pair.from}, Apache sends a ${pair.status} redirect to ${pair.to}.`,
    status: pair.status,
    patternRegex: "^" + escapeRegex(pair.from) + "(.*)$",
    targetTemplate: pair.to + "$1",
  };
}

/** Build a RedirectMatch directive (regex). */
export function buildRedirectMatch(opts: RewriteRuleOptions): GeneratedRule {
  const flags = opts.flags.length > 0 ? ` [${opts.flags.join(",")}]` : "";
  return {
    type: "redirect-match",
    directive: `RedirectMatch ${opts.status} ${opts.pattern} ${opts.target}${flags}`,
    explanation: `Matches any URL against the regex ${opts.pattern} and redirects (${opts.status}) to ${opts.target}, substituting captured groups ($1, $2, …).`,
    status: opts.status,
    patternRegex: opts.pattern,
    targetTemplate: opts.target,
  };
}

/** Build a RewriteRule directive (regex + flags). */
export function buildRewriteRule(opts: RewriteRuleOptions): GeneratedRule {
  const flags = opts.flags.length > 0 ? ` [${opts.flags.join(",")}]` : " [R=301,L]";
  return {
    type: "rewrite-rule",
    directive: `RewriteRule ${opts.pattern} ${opts.target}${flags}`,
    explanation: `If the URL matches ${opts.pattern}, internally rewrite or redirect to ${opts.target} with flags: ${opts.flags.join(", ") || "R=301,L"}.`,
    status: opts.status,
    patternRegex: opts.pattern,
    targetTemplate: opts.target,
  };
}

/** Build www → non-www (or vice versa) canonicalization block. */
export function buildCanonical(opts: CanonicalOptions): GeneratedRule {
  if (!opts.enabled) return {
    type: "canonical-www",
    directive: "",
    explanation: "Disabled.",
  };
  const domain = opts.domain || DEFAULT_DOMAIN;
  if (opts.direction === "www-to-nonwww") {
    return {
      type: "canonical-www",
      directive: [
        `RewriteCond %{HTTP_HOST} ^www\\.${escapeRegex(domain)}$ [NC]`,
        `RewriteRule ^(.*)$ https://${domain}/$1 [R=301,L]`,
      ].join("\n"),
      explanation: `If the host is www.${domain}, permanently redirect (301) to https://${domain}, preserving the path.`,
      status: 301,
      patternRegex: `^www\\.${escapeRegex(domain)}$`,
      targetTemplate: `https://${domain}/$1`,
    };
  }
  // non-www → www
  return {
    type: "canonical-www",
    directive: [
      `RewriteCond %{HTTP_HOST} ^${escapeRegex(domain)}$ [NC]`,
      `RewriteRule ^(.*)$ https://www.${domain}/$1 [R=301,L]`,
    ].join("\n"),
    explanation: `If the host is ${domain} (no www), permanently redirect (301) to https://www.${domain}, preserving the path.`,
    status: 301,
    patternRegex: `^${escapeRegex(domain)}$`,
    targetTemplate: `https://www.${domain}/$1`,
  };
}

/** Build HTTP→HTTPS redirect block. */
export function buildHttpsRedirect(opts: HttpsOptions): GeneratedRule {
  if (!opts.enabled) return {
    type: "https-redirect",
    directive: "",
    explanation: "Disabled.",
  };
  return {
    type: "https-redirect",
    directive: [
      `RewriteCond %{HTTPS} off`,
      `RewriteRule ^(.*)$ https://%{HTTP_HOST}/$1 [R=301,L]`,
    ].join("\n"),
    explanation: "If the request came in over HTTP (not HTTPS), redirect (301) to the same URL on HTTPS.",
    status: 301,
    patternRegex: "^(.*)$",
    targetTemplate: "https://%{HTTP_HOST}/$1",
  };
}

/** Build hotlink protection block. */
export function buildHotlink(opts: HotlinkOptions): GeneratedRule {
  if (!opts.enabled) return {
    type: "hotlink",
    directive: "",
    explanation: "Disabled.",
  };
  const domain = opts.domain || DEFAULT_DOMAIN;
  const allowed = opts.allowedDomains.length > 0
    ? opts.allowedDomains
    : [domain, "www." + domain];
  const conditions = allowed.map((d) =>
    `RewriteCond %{HTTP_REFERER} !^https?://(www\\.)?${escapeRegex(d)}/ [NC]`,
  );
  conditions.push("RewriteCond %{HTTP_REFERER} !^$");
  return {
    type: "hotlink",
    directive: [
      ...conditions,
      `RewriteRule \\.(jpg|jpeg|png|gif|webp|svg|mp4|webm)$ ${opts.redirectUrl} [R=301,L,NC]`,
    ].join("\n"),
    explanation: `Block other websites from embedding your images/videos. Requests for media files are 301-redirected to ${opts.redirectUrl} unless the Referer is empty or matches: ${allowed.join(", ")}.`,
    status: 301,
    patternRegex: "\\.(jpg|jpeg|png|gif|webp|svg|mp4|webm)$",
    targetTemplate: opts.redirectUrl,
  };
}

/** Build a custom error page directive. */
export function buildErrorPage(ep: ErrorPage): GeneratedRule {
  return {
    type: "error-page",
    directive: `ErrorDocument ${ep.code} ${ep.path}`,
    explanation: `When Apache returns a ${ep.code} error, serve ${ep.path} instead of the default error page.`,
  };
}

/** Build an IP allow/deny rule (Apache 2.4 Require syntax). */
export function buildIpRule(rule: IpRule): GeneratedRule {
  if (rule.action === "allow") {
    return {
      type: "ip-rule",
      directive: `Require ip ${rule.ip}`,
      explanation: `Allow requests only from IP / CIDR ${rule.ip}. Combine with RequireAll / RequireAny for complex rules.`,
    };
  }
  return {
    type: "ip-rule",
    directive: [
      `<RequireAll>`,
      `    Require all granted`,
      `    Require not ip ${rule.ip}`,
      `</RequireAll>`,
    ].join("\n"),
    explanation: `Block requests from IP / CIDR ${rule.ip} while allowing all others.`,
  };
}

// ---------- Full config generation ----------

export interface GenerateInput {
  pairs: RedirectPair[];
  rewrite?: RewriteRuleOptions;
  canonical?: CanonicalOptions;
  https?: HttpsOptions;
  hotlink?: HotlinkOptions;
  errorPages?: ErrorPage[];
  ipRules?: IpRule[];
}

/** Generate the full .htaccess config from input. */
export function generateConfig(input: GenerateInput): HtaccessConfig {
  const rules: GeneratedRule[] = [];
  const warnings: string[] = [];

  // Validate pairs
  for (const pair of input.pairs) {
    if (!isValidUrl(pair.from)) {
      warnings.push(`Skipping invalid "from" URL: ${pair.from}`);
      continue;
    }
    if (!isValidUrl(pair.to)) {
      warnings.push(`Skipping invalid "to" URL: ${pair.to} (from ${pair.from})`);
      continue;
    }
    rules.push(buildSimpleRedirect(pair));
  }

  // Rewrite rule / RedirectMatch
  if (input.rewrite && input.rewrite.pattern && input.rewrite.target) {
    const re = tryCompileRegex(input.rewrite.pattern);
    if (!re) {
      warnings.push(`Invalid regex pattern: ${input.rewrite.pattern}`);
    } else {
      rules.push(
        input.rewrite.useRewriteRule
          ? buildRewriteRule(input.rewrite)
          : buildRedirectMatch(input.rewrite),
      );
    }
  }

  // Canonical
  if (input.canonical?.enabled) {
    if (!isValidDomain(input.canonical.domain || "")) {
      warnings.push(`Canonical domain invalid: ${input.canonical.domain}`);
    } else {
      rules.push(buildCanonical(input.canonical));
    }
  }

  // HTTPS
  if (input.https?.enabled) {
    rules.push(buildHttpsRedirect(input.https));
  }

  // Hotlink
  if (input.hotlink?.enabled) {
    if (!isValidDomain(input.hotlink.domain || "")) {
      warnings.push(`Hotlink domain invalid: ${input.hotlink.domain}`);
    } else {
      rules.push(buildHotlink(input.hotlink));
    }
  }

  // Error pages
  for (const ep of input.errorPages ?? []) {
    if (!isValidErrorCode(ep.code)) {
      warnings.push(`Invalid error code: ${ep.code}`);
      continue;
    }
    if (!ep.path) {
      warnings.push(`Error page ${ep.code} has empty path`);
      continue;
    }
    rules.push(buildErrorPage(ep));
  }

  // IP rules
  for (const ip of input.ipRules ?? []) {
    if (!isValidIp(ip.ip)) {
      warnings.push(`Invalid IP/CIDR: ${ip.ip}`);
      continue;
    }
    rules.push(buildIpRule(ip));
  }

  // Loop detection
  const loops = detectLoops(rules);
  for (const lw of loops) {
    if (lw.level === "danger") warnings.push(`[Loop] ${lw.message}`);
  }

  const rawText = renderHtaccess(rules);
  return {
    rules,
    warnings,
    rawText,
    ruleCount: rules.length,
  };
}

/** Render the full .htaccess text from rules. */
export function renderHtaccess(rules: GeneratedRule[]): string {
  const lines: string[] = [
    "# Generated by UnQTools — AI .htaccess Redirect Generator",
    "# Always back up your .htaccess and test on staging before deploying.",
    "",
    "RewriteEngine On",
    "",
  ];
  let lastType: RuleType | null = null;
  for (const r of rules) {
    if (!r.directive) continue;
    if (lastType !== r.type) {
      lines.push(`# --- ${RULE_TYPE_LABELS[r.type]} ---`);
      lastType = r.type;
    }
    lines.push(`# ${r.explanation}`);
    lines.push(r.directive);
    lines.push("");
  }
  return lines.join("\n");
}

/** Render rules as CSV (type, directive, explanation, status). */
export function renderCsv(config: HtaccessConfig): string {
  const rows = ["type,status,directive,explanation"];
  for (const r of config.rules) {
    if (!r.directive) continue;
    rows.push([
      r.type,
      r.status ?? "",
      escapeCsv(r.directive.replace(/\n/g, " ")),
      escapeCsv(r.explanation),
    ].join(","));
  }
  return rows.join("\n");
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ---------- Loop detection ----------

/** Detect obvious redirect loops and conflicts. */
export function detectLoops(rules: GeneratedRule[]): LoopWarning[] {
  const out: LoopWarning[] = [];
  for (let i = 0; i < rules.length; i++) {
    const r = rules[i];
    if (!r.patternRegex || !r.targetTemplate) continue;
    // Self-loop: pattern matches its own target.
    const re = tryCompileRegex(r.patternRegex);
    if (!re) continue;
    // Strip $N from target for self-match test
    const targetBase = r.targetTemplate.replace(/\$\d+/g, "x");
    try {
      const u = new URL(targetBase, "http://example.com");
      if (re.test(u.pathname + u.search)) {
        out.push({
          level: "danger",
          message: `Rule #${i + 1} (${RULE_TYPE_LABELS[r.type]}) target "${targetBase}" matches its own pattern "${r.patternRegex}" — likely infinite loop.`,
          ruleIdx: i,
        });
      }
    } catch {
      // Not a URL — try matching the raw string
      if (re.test(targetBase)) {
        out.push({
          level: "danger",
          message: `Rule #${i + 1} target "${targetBase}" matches its own pattern — likely infinite loop.`,
          ruleIdx: i,
        });
      }
    }
  }
  // Pair-wise: A's target matches B's pattern AND B's target matches A's pattern.
  const regexRules = rules
    .map((r, i) => ({ r, i }))
    .filter((x) => x.r.patternRegex && x.r.targetTemplate);
  for (let a = 0; a < regexRules.length; a++) {
    for (let b = a + 1; b < regexRules.length; b++) {
      const ra = regexRules[a].r;
      const rb = regexRules[b].r;
      const rea = tryCompileRegex(ra.patternRegex!);
      const reb = tryCompileRegex(rb.patternRegex!);
      if (!rea || !reb) continue;
      const ta = ra.targetTemplate!.replace(/\$\d+/g, "x");
      const tb = rb.targetTemplate!.replace(/\$\d+/g, "x");
      try {
        const ua = new URL(ta, "http://example.com");
        const ub = new URL(tb, "http://example.com");
        if (reb.test(ua.pathname + ua.search) && rea.test(ub.pathname + ub.search)) {
          out.push({
            level: "danger",
            message: `Rules #${regexRules[a].i + 1} and #${regexRules[b].i + 1} form a circular redirect chain (${ta} → ${tb} → ${ta}).`,
            ruleIdx: regexRules[a].i,
          });
        }
      } catch { /* ignore */ }
    }
  }
  // Duplicate pairs (same from/to).
  const seen = new Map<string, number>();
  for (let i = 0; i < rules.length; i++) {
    const r = rules[i];
    if (r.type !== "redirect-simple") continue;
    // Extract from/to from directive
    const m = r.directive.match(/^Redirect\s+(\d+)\s+(\S+)\s+(\S+)/);
    if (!m) continue;
    const key = `${m[2]}→${m[3]}`;
    if (seen.has(key)) {
      out.push({
        level: "warn",
        message: `Duplicate redirect: ${key} appears in rules #${seen.get(key)! + 1} and #${i + 1}.`,
        ruleIdx: i,
      });
    } else {
      seen.set(key, i);
    }
  }
  return out;
}

// ---------- URL tester ----------

/** Test a URL against all rules; return the first match. */
export function testUrl(rules: GeneratedRule[], url: string): TestResult {
  for (let i = 0; i < rules.length; i++) {
    const r = rules[i];
    if (!r.patternRegex || !r.targetTemplate) continue;
    const target = applyRule(r.patternRegex, r.targetTemplate, url);
    if (target !== null) {
      return {
        url,
        matched: true,
        matchedRuleIdx: i,
        redirectTarget: target,
        status: r.status ?? 0,
        explanation: `Matched ${RULE_TYPE_LABELS[r.type]} (rule #${i + 1}): ${r.explanation} → redirects to ${target}.`,
      };
    }
  }
  return {
    url,
    matched: false,
    matchedRuleIdx: -1,
    redirectTarget: null,
    status: 0,
    explanation: "No rule matched this URL.",
  };
}

/** Test multiple URLs at once. */
export function testUrls(rules: GeneratedRule[], urls: string[]): TestResult[] {
  return urls.map((u) => testUrl(rules, u));
}

// ---------- Import existing .htaccess ----------

export interface ImportedRule {
  type: RuleType;
  directive: string;
  status?: RedirectStatus;
  from?: string;
  to?: string;
  pattern?: string;
  target?: string;
}

/**
 * Parse an existing .htaccess into structured rules.
 * Best-effort — unknown directives are ignored.
 */
export function importHtaccess(text: string): ImportedRule[] {
  if (!text) return [];
  const out: ImportedRule[] = [];
  const lines = text.split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    // Redirect <code> <from> <to>
    let m = line.match(/^Redirect\s+(\d{3})\s+(\S+)\s+(\S+)/i);
    if (m) {
      out.push({
        type: "redirect-simple",
        directive: line,
        status: parseInt(m[1], 10) as RedirectStatus,
        from: m[2],
        to: m[3],
      });
      continue;
    }
    // RedirectMatch <code> <pattern> <target>
    m = line.match(/^RedirectMatch\s+(\d{3})\s+(\S+)\s+(\S+)/i);
    if (m) {
      out.push({
        type: "redirect-match",
        directive: line,
        status: parseInt(m[1], 10) as RedirectStatus,
        pattern: m[2],
        target: m[3],
      });
      continue;
    }
    // RewriteRule <pattern> <target> [flags]
    m = line.match(/^RewriteRule\s+(\S+)\s+(\S+)(?:\s+\[([^\]]+)\])?/i);
    if (m) {
      out.push({
        type: "rewrite-rule",
        directive: line,
        pattern: m[1],
        target: m[2],
      });
      continue;
    }
    // ErrorDocument <code> <path>
    m = line.match(/^ErrorDocument\s+(\d{3})\s+(\S+)/i);
    if (m) {
      out.push({
        type: "error-page",
        directive: line,
        status: parseInt(m[1], 10) as RedirectStatus,
        from: m[1],
        to: m[2],
      });
      continue;
    }
    // Require ip <ip>
    m = line.match(/^Require\s+ip\s+(\S+)/i);
    if (m) {
      out.push({
        type: "ip-rule",
        directive: line,
        from: m[1],
      });
      continue;
    }
  }
  return out;
}

// ---------- History (localStorage) ----------

export function loadHistory(): HistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(arr) ? arr.slice(0, HISTORY_MAX) : [];
  } catch { return []; }
}

export function saveHistory(entry: HistoryEntry): HistoryEntry[] {
  const next = [entry, ...loadHistory()].slice(0, HISTORY_MAX);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch { /* ignore */ }
  }
  return next;
}

export function clearHistory(): void {
  if (typeof localStorage === "undefined") return;
  try { localStorage.removeItem(HISTORY_KEY); } catch { /* ignore */ }
}

// ---------- Shareable URL ----------

export function buildShareUrl(state: ShareState): string {
  const params = new URLSearchParams();
  if (state.pairs.length > 0) {
    params.set("pairs", state.pairs.map((p) => `${p.from}>${p.to}>${p.status}`).join("|"));
  }
  if (state.rewrite) {
    params.set("rp", state.rewrite.pattern);
    params.set("rt", state.rewrite.target);
    params.set("rs", String(state.rewrite.status));
    params.set("rw", state.rewrite.useRewriteRule ? "1" : "0");
  }
  if (state.canonical?.enabled) {
    params.set("ce", "1");
    params.set("cd", state.canonical.direction);
    params.set("cdom", state.canonical.domain);
  }
  if (state.https?.enabled) params.set("he", "1");
  if (state.hotlink?.enabled) {
    params.set("hle", "1");
    params.set("hld", state.hotlink.domain);
  }
  if (state.errorPages && state.errorPages.length > 0) {
    params.set("ep", state.errorPages.map((e) => `${e.code}>${e.path}`).join("|"));
  }
  if (state.ipRules && state.ipRules.length > 0) {
    params.set("ip", state.ipRules.map((r) => `${r.ip}>${r.action}`).join("|"));
  }
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareState {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { pairs: [] };
  const params = new URLSearchParams(clean);
  const state: ShareState = { pairs: [] };

  const pairsStr = params.get("pairs");
  if (pairsStr) {
    state.pairs = pairsStr.split("|").map((s) => {
      const [from, to, status] = s.split(">");
      const st = parseInt(status, 10);
      return {
        from: from || "",
        to: to || "",
        status: (st === 302 || st === 307 ? st : 301) as RedirectStatus,
      };
    }).filter((p) => p.from && p.to);
  }

  const rp = params.get("rp");
  const rt = params.get("rt");
  if (rp && rt) {
    const rs = parseInt(params.get("rs") ?? "301", 10);
    const rw = params.get("rw") === "1";
    state.rewrite = {
      pattern: rp,
      target: rt,
      status: rs === 302 || rs === 307 ? rs : 301,
      flags: rw ? ["L", "R=301"] : ["L"],
      useRewriteRule: rw,
    };
  }

  if (params.get("ce") === "1") {
    const direction = params.get("cd");
    state.canonical = {
      enabled: true,
      direction: direction === "nonwww-to-www" ? "nonwww-to-www" : "www-to-nonwww",
      domain: params.get("cdom") || DEFAULT_DOMAIN,
    };
  }

  if (params.get("he") === "1") state.https = { enabled: true };

  if (params.get("hle") === "1") {
    state.hotlink = {
      enabled: true,
      domain: params.get("hld") || DEFAULT_DOMAIN,
      allowedDomains: [DEFAULT_DOMAIN, "www." + DEFAULT_DOMAIN],
      redirectUrl: "/hotlink-denied.png",
    };
  }

  const epStr = params.get("ep");
  if (epStr) {
    state.errorPages = epStr.split("|").map((s) => {
      const [code, path] = s.split(">");
      return { code: parseInt(code, 10) || 404, path: path || "/404.html" };
    });
  }

  const ipStr = params.get("ip");
  if (ipStr) {
    state.ipRules = ipStr.split("|").map((s) => {
      const [ip, action] = s.split(">");
      return {
        ip: ip || "",
        action: (action === "allow" ? "allow" : "deny") as IpRule["action"],
      };
    }).filter((r) => r.ip);
  }

  return state;
}

// ---------- LLM prompt ----------

export function buildLlmPrompt(state: ShareState): LlmPrompt {
  const pairsText = state.pairs.length > 0
    ? state.pairs.map((p) => `${p.from} → ${p.to} (${p.status})`).join("\n")
    : "(none)";
  return {
    system: `You are an Apache mod_rewrite expert. You translate user intent into correct .htaccess redirect and rewrite rules. Always output plain .htaccess directives with comments explaining each rule. Flag any redirect loops, regex mistakes, or ordering conflicts. Honor Apache 2.4 syntax.`,
    user: `Generate .htaccess rules for the following intent:

Bulk redirects (from → to with status):
${pairsText}

${state.rewrite ? `Regex pattern: ${state.rewrite.pattern} → ${state.rewrite.target} (status ${state.rewrite.status}, ${state.rewrite.useRewriteRule ? "RewriteRule" : "RedirectMatch"})` : ""}

${state.canonical?.enabled ? `Canonical: ${state.canonical.direction} for domain ${state.canonical.domain}` : ""}
${state.https?.enabled ? "HTTP→HTTPS redirect: yes" : ""}
${state.hotlink?.enabled ? `Hotlink protection for ${state.hotlink.domain}` : ""}
${state.errorPages && state.errorPages.length > 0 ? `Error pages: ${state.errorPages.map((e) => e.code + "→" + e.path).join(", ")}` : ""}

Output a single .htaccess block with RewriteEngine On at the top, comments explaining each rule, and a final note about any potential loops or conflicts.`,
  };
}

/** Render an LLM-returned text (just trim). */
export function renderLlmResult(text: string): string {
  return (text || "").trim();
}
