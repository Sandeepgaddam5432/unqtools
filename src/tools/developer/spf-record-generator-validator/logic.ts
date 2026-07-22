/**
 * SPF Record Generator & Validator — pure logic.
 *
 * Builds SPF TXT records from a visual form (ip4, ip6, a, mx, include,
 * redirect, all-qualifier), validates any record against RFC 7208,
 * counts the 10 DNS-lookup limit, explains each mechanism in plain
 * English, and generates dig commands. 100% client-side — recursive
 * include resolution requires the network; the lookup counter uses an
 * optional per-include depth map (or a clearly-labeled live mode).
 *
 * Pure functions only — no DOM, no network, no external deps.
 *
 * PRIVACY: The history feature stores only operation metadata
 * (action + count + ts), NEVER the generated record or include list.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Qualifier = "+" | "-" | "~" | "?";

export type MechanismType =
  | "all"
  | "include"
  | "a"
  | "mx"
  | "ptr"
  | "ip4"
  | "ip6"
  | "exists"
  | "redirect";

/** Mechanisms that count against the 10 DNS-lookup limit (RFC 7208 §4.6.4). */
export const LOOKUP_MECHANISMS: ReadonlySet<MechanismType> = new Set([
  "include", "a", "mx", "ptr", "exists", "redirect",
]);

export interface Mechanism {
  type: MechanismType;
  qualifier: Qualifier;
  /** Value (e.g. domain for include, CIDR for ip4). Empty for `all`. */
  value: string;
}

export interface SpfInput {
  ip4: string[];      // list of ip4:CIDR values
  ip6: string[];      // list of ip6:CIDR values
  a: string[];        // list of a-mechanism values ("" for bare "a")
  mx: string[];       // list of mx-mechanism values ("" for bare "mx")
  include: string[];  // list of include:domain values
  redirect?: string;  // redirect=domain
  all: Qualifier | "none"; // qualifier on `all`, or "none" to omit
}

export type IssueLevel = "error" | "warning" | "info";

export interface ValidationIssue {
  level: IssueLevel;
  code: string;
  message: string;
  fix?: string;
}

export interface ValidationResult {
  valid: boolean;
  mechanisms: Mechanism[];
  issues: ValidationIssue[];
  lookupCount: number;
  lookupLimit: number;
  hasAll: boolean;
  hasRedirect: boolean;
}

export interface MechanismExplanation {
  mechanism: string;
  short: string;
  long: string;
  countsAsLookup: boolean;
}

export interface GeneratedCommand {
  tool: "dig" | "nslookup" | "kdig" | "host" | "curl";
  label: string;
  command: string;
  explanation: string;
}

export interface HistoryEntry {
  ts: number;
  action: "generate" | "validate";
  count: number; // mechanism count
}

// ---------------------------------------------------------------------------
// Qualifier reference
// ---------------------------------------------------------------------------

export const QUALIFIER_TABLE: { qualifier: Qualifier; name: string; description: string }[] = [
  { qualifier: "+", name: "Pass", description: "Match — accept the mail. The default qualifier when none is written." },
  { qualifier: "-", name: "Fail", description: "Reject the mail. Recommended for the all mechanism on locked-down domains." },
  { qualifier: "~", name: "SoftFail", description: "Mark as spam but accept. Recommended during SPF rollout." },
  { qualifier: "?", name: "Neutral", description: "No policy assertion — accept. Same effect as having no SPF." },
];

// ---------------------------------------------------------------------------
// Mechanism explanations
// ---------------------------------------------------------------------------

const MECHANISM_EXPLANATIONS: Record<MechanismType, Omit<MechanismExplanation, "mechanism">> = {
  all: {
    short: "Default verdict",
    long: "Matches everything. The qualifier sets the verdict for any sender not matching an earlier mechanism. Must be the last mechanism.",
    countsAsLookup: false,
  },
  include: {
    short: "Include another domain's SPF",
    long: "Evaluates the SPF record of the included domain and merges its Pass results. Counts as 1 DNS lookup. Use for third-party senders (Mailchimp, Google, Microsoft).",
    countsAsLookup: true,
  },
  a: {
    short: "A record of domain",
    long: "Matches if the sender IP is in the A/AAAA records of the specified domain (or the SPF domain if bare). Counts as 1 DNS lookup.",
    countsAsLookup: true,
  },
  mx: {
    short: "MX records of domain",
    long: "Matches if the sender IP is in the A/AAAA records of the MX hosts of the specified domain (or the SPF domain if bare). Counts as 1 DNS lookup.",
    countsAsLookup: true,
  },
  ptr: {
    short: "Reverse DNS (DEPRECATED)",
    long: "Matches if the sender's reverse-DNS name ends with the specified domain. DEPRECATED in RFC 7208 §5.5 — unreliable, expensive, do not use.",
    countsAsLookup: true,
  },
  ip4: {
    short: "IPv4 CIDR match",
    long: "Matches if the sender IP is within the given IPv4 CIDR range (e.g. ip4:192.0.2.0/24). Does NOT count as a DNS lookup — pure IP match.",
    countsAsLookup: false,
  },
  ip6: {
    short: "IPv6 CIDR match",
    long: "Matches if the sender IP is within the given IPv6 CIDR range (e.g. ip6:2001:db8::/32). Does NOT count as a DNS lookup — pure IP match.",
    countsAsLookup: false,
  },
  exists: {
    short: "DNS A exists check",
    long: "Matches if the macro-expanded domain name resolves to any A record. Counts as 1 DNS lookup. Advanced — usually uses macros.",
    countsAsLookup: true,
  },
  redirect: {
    short: "Redirect to another domain's SPF",
    long: "Replaces the current record with the SPF record of the redirected domain. Must be the last mechanism; cannot coexist with all. Counts as 1 DNS lookup.",
    countsAsLookup: true,
  },
};

export function explainMechanism(type: MechanismType): MechanismExplanation {
  const base = MECHANISM_EXPLANATIONS[type];
  return { mechanism: type, ...base };
}

export function explainQualifier(q: Qualifier): string {
  const e = QUALIFIER_TABLE.find((x) => x.qualifier === q);
  return e ? `${e.name} — ${e.description}` : `Unknown qualifier: ${q}`;
}

// ---------------------------------------------------------------------------
// Validator helpers
// ---------------------------------------------------------------------------

const IPV4_CIDR_RE = /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\/(?:3[0-2]|[12]?\d))?$/;
const IPV6_CIDR_RE = /^[0-9a-fA-F:]+(?:\/(?:12[0-8]|1[01]\d|[1-9]?\d))?$/;
const DOMAIN_RE = /^(?=.{1,253}$)([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
const QUALIFIER_SET = new Set<Qualifier>(["+", "-", "~", "?"]);

export function isValidIpv4Cidr(v: string): boolean {
  return IPV4_CIDR_RE.test(v.trim());
}

export function isValidIpv6Cidr(v: string): boolean {
  const s = v.trim();
  if (!s.includes(":")) return false;
  return IPV6_CIDR_RE.test(s);
}

export function isValidDomain(v: string): boolean {
  const s = v.trim().toLowerCase();
  if (!s) return false;
  return DOMAIN_RE.test(s);
}

/** Strip an optional qualifier prefix from a token. */
export function stripQualifier(token: string): { qualifier: Qualifier | null; rest: string } {
  if (!token) return { qualifier: null, rest: "" };
  const first = token[0];
  if (QUALIFIER_SET.has(first as Qualifier)) {
    return { qualifier: first as Qualifier, rest: token.slice(1) };
  }
  return { qualifier: null, rest: token };
}

const MECHANISM_NAMES = new Set<MechanismType | "v" | "spf1" | "exp">([
  "all", "include", "a", "mx", "ptr", "ip4", "ip6", "exists", "redirect",
]);

// ---------------------------------------------------------------------------
// Record generator
// ---------------------------------------------------------------------------

/** Build the SPF TXT record string from structured input. */
export function buildRecord(input: SpfInput): string {
  const parts: string[] = ["v=spf1"];

  // Order: ip4, ip6, a, mx, include, then redirect or all.
  const seen = new Set<string>();
  const add = (qual: Qualifier | null, body: string) => {
    const token = `${qual ?? ""}${body}`;
    if (!seen.has(token)) {
      seen.add(token);
      parts.push(token);
    }
  };

  for (const v of input.ip4) {
    const t = v.trim();
    if (t) add(null, `ip4:${t}`);
  }
  for (const v of input.ip6) {
    const t = v.trim();
    if (t) add(null, `ip6:${t}`);
  }
  for (const v of input.a) {
    const t = v.trim();
    add(null, t ? `a:${t}` : "a");
  }
  for (const v of input.mx) {
    const t = v.trim();
    add(null, t ? `mx:${t}` : "mx");
  }
  for (const v of input.include) {
    const t = v.trim();
    if (t) add(null, `include:${t}`);
  }

  if (input.redirect && input.redirect.trim()) {
    parts.push(`redirect=${input.redirect.trim()}`);
  } else if (input.all !== "none") {
    parts.push(`${input.all}all`);
  }

  return parts.join(" ");
}

// ---------------------------------------------------------------------------
// Record parser
// ---------------------------------------------------------------------------

/**
 * Parse an SPF record string into mechanisms. Supports both single-record
 * and multi-record (invalid) input — pass the array of TXT records.
 */
export function parseRecord(record: string): {
  mechanisms: Mechanism[];
  issues: ValidationIssue[];
  hasRedirect: boolean;
} {
  const issues: ValidationIssue[] = [];
  const mechanisms: Mechanism[] = [];
  const s = record.trim();
  if (!s) {
    issues.push({ level: "error", code: "empty", message: "Empty input." });
    return { mechanisms, issues, hasRedirect: false };
  }
  // Strip surrounding quotes if present.
  const cleaned = s.replace(/^"+|"+$/g, "").trim();
  const tokens = cleaned.split(/\s+/);
  if (tokens.length === 0 || tokens[0].toLowerCase() !== "v=spf1") {
    issues.push({
      level: "error",
      code: "no-version",
      message: 'SPF record must start with "v=spf1".',
      fix: 'Prefix the record with "v=spf1 ".',
    });
    return { mechanisms, issues, hasRedirect: false };
  }

  let hasRedirect = false;
  for (let i = 1; i < tokens.length; i++) {
    const raw = tokens[i];
    if (!raw) continue;
    // Redirect modifier: redirect=domain
    if (raw.toLowerCase().startsWith("redirect=")) {
      const value = raw.slice("redirect=".length);
      if (hasRedirect) {
        issues.push({ level: "error", code: "dup-redirect", message: "Multiple redirect= modifiers — only one is allowed.", fix: "Remove all but one redirect=." });
      }
      hasRedirect = true;
      mechanisms.push({ type: "redirect", qualifier: "+", value });
      continue;
    }
    // Other modifiers (exp=) — informational.
    if (raw.includes("=") && !raw.includes(":") && !raw.startsWith("v=")) {
      // exp= modifier
      const eq = raw.indexOf("=");
      const name = raw.slice(0, eq).toLowerCase();
      if (name === "exp") {
        issues.push({ level: "info", code: "exp-modifier", message: `exp= modifier present (explanation string). Not counted as a lookup. Value: ${raw.slice(eq + 1)}` });
        continue;
      }
      issues.push({ level: "warning", code: "unknown-modifier", message: `Unknown modifier "${raw}". SPF only defines redirect= and exp=.` });
      continue;
    }
    const { qualifier, rest } = stripQualifier(raw);
    const qual: Qualifier = qualifier ?? "+";
    const colon = rest.indexOf(":");
    let mechType: MechanismType | null = null;
    let value = "";
    if (colon < 0) {
      // Bare mechanism (all / a / mx / ptr)
      const lower = rest.toLowerCase();
      if (["all", "a", "mx", "ptr"].includes(lower)) {
        mechType = lower as MechanismType;
      }
    } else {
      const name = rest.slice(0, colon).toLowerCase();
      if (["include", "a", "mx", "ptr", "ip4", "ip6", "exists"].includes(name)) {
        mechType = name as MechanismType;
        value = rest.slice(colon + 1);
      }
    }
    if (!mechType) {
      issues.push({ level: "error", code: "unknown-mechanism", message: `Unknown mechanism: "${raw}".`, fix: "Use one of: all, include, a, mx, ptr, ip4, ip6, exists, redirect." });
      continue;
    }
    mechanisms.push({ type: mechType, qualifier: qual, value });
  }
  return { mechanisms, issues, hasRedirect };
}

// ---------------------------------------------------------------------------
// Validator
// ---------------------------------------------------------------------------

const LOOKUP_LIMIT = 10;

/**
 * Validate an SPF record. Issues returned include RFC 7208 syntax errors,
 * mechanism-order errors, deprecated-mechanism warnings, lookup-limit
 * warnings, and macro warnings. The lookupCount is the static count
 * (1 per include / a / mx / ptr / exists / redirect). For recursive
 * include resolution, pass a depth map (include domain → child count)
 * via the includeDepth option.
 */
export function validateRecord(
  record: string,
  opts: { includeDepth?: Record<string, number> } = {},
): ValidationResult {
  const issues: ValidationIssue[] = [];
  const parsed = parseRecord(record);
  issues.push(...parsed.issues);
  const mechanisms = parsed.mechanisms;
  const hasRedirect = parsed.hasRedirect;
  const hasAll = mechanisms.some((m) => m.type === "all");

  // Per-mechanism validation.
  for (let i = 0; i < mechanisms.length; i++) {
    const m = mechanisms[i];
    // ip4 / ip6 syntax
    if (m.type === "ip4") {
      if (!isValidIpv4Cidr(m.value)) {
        issues.push({ level: "error", code: "bad-ip4", message: `Invalid ip4 value: "${m.value}".`, fix: "Use CIDR notation, e.g. ip4:192.0.2.0/24." });
      }
    } else if (m.type === "ip6") {
      if (!isValidIpv6Cidr(m.value)) {
        issues.push({ level: "error", code: "bad-ip6", message: `Invalid ip6 value: "${m.value}".`, fix: "Use CIDR notation, e.g. ip6:2001:db8::/32." });
      }
    } else if (m.type === "include" || m.type === "a" || m.type === "mx" || m.type === "redirect" || m.type === "exists") {
      // For a/mx, value may be empty (bare "a" or "mx"). For include/redirect/exists, value must be a valid domain.
      if (m.type === "include" || m.type === "redirect" || m.type === "exists") {
        if (!m.value) {
          issues.push({ level: "error", code: "empty-domain", message: `${m.type} requires a domain value.`, fix: `Use ${m.type}:example.com.` });
        } else if (!isValidDomain(m.value)) {
          issues.push({ level: "error", code: "bad-domain", message: `${m.type} value "${m.value}" is not a valid domain.`, fix: "Use a fully-qualified domain name." });
        }
      } else if (m.value && !isValidDomain(m.value)) {
        // a:domain or mx:domain
        issues.push({ level: "error", code: "bad-domain", message: `${m.type} value "${m.value}" is not a valid domain.`, fix: "Use a fully-qualified domain name or leave bare." });
      }
    }
    // Deprecated ptr
    if (m.type === "ptr") {
      issues.push({ level: "warning", code: "deprecated-ptr", message: "ptr mechanism is deprecated (RFC 7208 §5.5). It is unreliable and expensive.", fix: "Remove ptr and use ip4/ip6 or a/mx instead." });
    }
    // Macro detection
    if (m.value && /%\{[^}]+\}/.test(m.value)) {
      issues.push({ level: "info", code: "macro", message: `Mechanism "${m.type}:${m.value}" uses SPF macros. Macros cannot be statically validated — only the receiving MTA can evaluate them.`, fix: "If you use macros, verify them by sending test mail and inspecting the received headers." });
    }
  }

  // Order checks
  const allIndex = mechanisms.findIndex((m) => m.type === "all");
  if (allIndex >= 0 && allIndex !== mechanisms.length - 1) {
    issues.push({ level: "error", code: "all-not-last", message: "all must be the last mechanism.", fix: "Move all to the end of the record." });
  }
  const redirectIndex = mechanisms.findIndex((m) => m.type === "redirect");
  if (redirectIndex >= 0 && redirectIndex !== mechanisms.length - 1) {
    issues.push({ level: "error", code: "redirect-not-last", message: "redirect= must be the last mechanism.", fix: "Move redirect= to the end of the record." });
  }
  if (hasAll && hasRedirect) {
    issues.push({ level: "error", code: "all-and-redirect", message: "all and redirect= cannot coexist (RFC 7208 §6.1).", fix: "Use either all or redirect=, not both." });
  }
  // Duplicate mechanisms
  const seen = new Set<string>();
  for (const m of mechanisms) {
    const key = `${m.type}:${m.value}`;
    if (seen.has(key)) {
      issues.push({ level: "info", code: "duplicate", message: `Duplicate mechanism "${m.type}:${m.value}" detected.`, fix: "Remove the duplicate." });
    }
    seen.add(key);
  }

  // Lookup count (static)
  let lookupCount = 0;
  for (const m of mechanisms) {
    if (LOOKUP_MECHANISMS.has(m.type)) {
      lookupCount += 1;
      // Add recursive depth for includes if provided.
      if (m.type === "include" && opts.includeDepth && m.value) {
        const depth = opts.includeDepth[m.value.toLowerCase()];
        if (typeof depth === "number" && depth > 0) lookupCount += depth;
      }
    }
  }
  if (lookupCount > LOOKUP_LIMIT) {
    issues.push({
      level: "error",
      code: "lookup-limit",
      message: `Record triggers ${lookupCount} DNS lookups — exceeds the RFC 7208 §4.6.4 limit of ${LOOKUP_LIMIT}.`,
      fix: "Flatten nested includes (replace include: with the underlying ip4/ip6 mechanisms) or use SPF flattening service.",
    });
  } else if (lookupCount > 7) {
    issues.push({
      level: "warning",
      code: "lookup-near-limit",
      message: `Record triggers ${lookupCount} DNS lookups — approaching the limit of ${LOOKUP_LIMIT}.`,
      fix: "Consider flattening to leave headroom for future senders.",
    });
  }

  if (!hasAll && !hasRedirect) {
    issues.push({
      level: "warning",
      code: "no-all",
      message: "No all mechanism and no redirect= — the record has no default verdict.",
      fix: "Add -all (fail), ~all (softfail), or redirect=example.com.",
    });
  }

  const valid = !issues.some((i) => i.level === "error");
  return {
    valid,
    mechanisms,
    issues,
    lookupCount,
    lookupLimit: LOOKUP_LIMIT,
    hasAll,
    hasRedirect,
  };
}

/**
 * Validate a list of TXT records for multiple-SPF detection.
 * Pass the array of TXT records returned for a domain (e.g. from dig).
 * Returns an issue if more than one starts with v=spf1.
 */
export function detectMultipleSpfRecords(txtRecords: string[]): ValidationIssue | null {
  const spfRecords = txtRecords.filter((r) => {
    // Strip surrounding quotes (dig +short wraps values in double quotes)
    // and whitespace, then check for the v=spf1 prefix.
    const s = r.trim().replace(/^"+|"+$/g, "").trim().toLowerCase();
    return s.startsWith("v=spf1");
  });
  if (spfRecords.length > 1) {
    return {
      level: "error",
      code: "multiple-spf",
      message: `Found ${spfRecords.length} SPF records. RFC 7208 §3.2 says a domain MUST NOT have multiple SPF records — receivers will return PermError.`,
      fix: "Delete all but one SPF record and merge the mechanisms into a single record.",
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// dig command generator
// ---------------------------------------------------------------------------

/** Generate dig / nslookup / curl commands to look up the SPF record for a domain. */
export function generateCommands(domain: string): GeneratedCommand[] {
  const d = domain.trim().toLowerCase();
  if (!d) return [];
  return [
    {
      tool: "dig",
      label: "dig TXT +short",
      command: `dig +short TXT ${d}`,
      explanation: "List all TXT records for the domain. Look for the one starting with v=spf1.",
    },
    {
      tool: "dig",
      label: "dig TXT (filtered for SPF)",
      command: `dig +short TXT ${d} | grep '^"v=spf1'`,
      explanation: "Filter dig output to show only SPF records. Multiple lines = multiple SPF records (invalid).",
    },
    {
      tool: "dig",
      label: "dig TXT (full)",
      command: `dig +noall +answer TXT ${d}`,
      explanation: "Show the full TXT answer section with TTL.",
    },
    {
      tool: "dig",
      label: "dig @resolver TXT",
      command: `dig +short TXT ${d} @1.1.1.1`,
      explanation: "Query Cloudflare DNS (1.1.1.1) directly — useful for cached-vs-authoritative comparison.",
    },
    {
      tool: "kdig",
      label: "kdig (DNS-over-HTTPS)",
      command: `kdig +https @1.1.1.1 TXT ${d}`,
      explanation: "DNS-over-HTTPS lookup via Cloudflare. Bypasses local DNS / firewall inspection.",
    },
    {
      tool: "nslookup",
      label: "nslookup TXT",
      command: `nslookup -type=TXT ${d}`,
      explanation: "Cross-platform TXT lookup (Windows-friendly).",
    },
    {
      tool: "curl",
      label: "DoH via curl (Cloudflare)",
      command: `curl -s 'https://cloudflare-dns.com/dns-query?name=${d}&type=TXT' -H 'accept: application/dns-json' | jq '.Answer'`,
      explanation: "Fetch the TXT records as JSON via DNS-over-HTTPS. Pipe through jq for pretty output.",
    },
  ];
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:spf-record-generator-validator:history";
const HISTORY_MAX = 20;

export function loadHistory(): HistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(arr) ? arr.slice(0, HISTORY_MAX) : [];
  } catch {
    return [];
  }
}

export function saveHistory(entry: HistoryEntry): HistoryEntry[] {
  const next = [entry, ...loadHistory()].slice(0, HISTORY_MAX);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}

export function clearHistory(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Shareable URL
// ---------------------------------------------------------------------------

export interface ShareState {
  tab?: "generate" | "validate";
  record?: string;
}

export function buildShareUrl(state: ShareState): string {
  const params = new URLSearchParams();
  if (state.tab) params.set("tab", state.tab);
  if (state.record) params.set("r", state.record);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareState {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const tabRaw = params.get("tab") ?? "";
  const tab = tabRaw === "generate" || tabRaw === "validate" ? tabRaw : undefined;
  const record = params.get("r") ?? undefined;
  return { tab, record };
}
