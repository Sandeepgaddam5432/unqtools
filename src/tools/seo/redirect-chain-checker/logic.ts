/**
 * Redirect Chain Checker — pure logic.
 *
 * ⚠️ HONEST DISCLOSURE: Live HTTP redirect checking requires network access
 * and is blocked by CORS for most websites from a browser context. This tool
 * provides:
 *  - URL parsing & validation
 *  - A redirect type reference (301, 302, 307, 308, meta refresh, JS)
 *  - A chain analysis SIMULATION based on user-provided redirect steps
 *  - Stats: hop count, final destination, warnings for long chains & 302s
 *
 * Users can manually inspect redirects using browser DevTools (Network tab →
 * "Preserve log") or `curl -I` from the command line.
 *
 * Pure functions only — no DOM, no network.
 */

export type RedirectType = "301" | "302" | "303" | "307" | "308" | "meta-refresh" | "javascript";

export interface RedirectTypeInfo {
  code: RedirectType;
  name: string;
  permanent: boolean;
  description: string;
  useCase: string;
  seoImpact: string;
}

export const REDIRECT_TYPES: Record<RedirectType, RedirectTypeInfo> = {
  "301": {
    code: "301",
    name: "Moved Permanently",
    permanent: true,
    description: "The URL has permanently moved to a new location.",
    useCase: "Use when a page URL changes permanently — e.g., domain migration, URL restructuring, or content consolidation.",
    seoImpact: "Passes ~100% of link equity (PageRank) to the new URL. The recommended redirect for SEO.",
  },
  "302": {
    code: "302",
    name: "Found (Temporary)",
    permanent: false,
    description: "The URL is temporarily at a different location.",
    useCase: "Use for temporary moves — e.g., A/B testing, maintenance pages, seasonal promotions.",
    seoImpact: "Does NOT pass link equity reliably. Google may treat long-standing 302s as 301s, but it's unpredictable. Avoid for permanent moves.",
  },
  "303": {
    code: "303",
    name: "See Other",
    permanent: false,
    description: "The response to the request is at another URL (always GET).",
    useCase: "Used after POST form submission to redirect to a result page (Post/Redirect/Get pattern).",
    seoImpact: "Rarely used for SEO purposes. Treated similarly to 302.",
  },
  "307": {
    code: "307",
    name: "Temporary Redirect",
    permanent: false,
    description: "HTTP/1.1 successor to 302. Preserves the original HTTP method.",
    useCase: "Temporary redirect that must preserve POST method (302 may downgrade to GET).",
    seoImpact: "Treated like 302 — temporary, doesn't pass link equity reliably.",
  },
  "308": {
    code: "308",
    name: "Permanent Redirect",
    permanent: true,
    description: "HTTP/1.1 successor to 301. Preserves the original HTTP method.",
    useCase: "Permanent redirect that must preserve POST method.",
    seoImpact: "Treated like 301 — passes link equity. Use 308 only when you need method preservation.",
  },
  "meta-refresh": {
    code: "meta-refresh",
    name: "Meta Refresh",
    permanent: false,
    description: "Client-side redirect via <meta http-equiv=\"refresh\" content=\"0; url=...\">.",
    useCase: "Fallback when server redirects aren't available. Sometimes used in SPA routing.",
    seoImpact: "Google treats meta refresh as a soft redirect. Slower than server redirects. Avoid for SEO-critical URLs.",
  },
  javascript: {
    code: "javascript",
    name: "JavaScript Redirect",
    permanent: false,
    description: "Client-side redirect via window.location = '...' or location.replace().",
    useCase: "Conditional redirects in JavaScript apps, A/B testing, geolocation redirects.",
    seoImpact: "Google may execute JS redirects but it's slower and less reliable. Avoid for critical SEO moves.",
  },
};

export const REDIRECT_TYPE_LIST = Object.values(REDIRECT_TYPES);

export interface ParsedUrl {
  protocol: string;
  hostname: string;
  port: string;
  pathname: string;
  search: string;
  hash: string;
  valid: boolean;
  error?: string;
}

/** Parse a URL into its components. */
export function parseUrl(url: string): ParsedUrl {
  if (!url || !url.trim()) {
    return {
      protocol: "", hostname: "", port: "", pathname: "", search: "", hash: "",
      valid: false, error: "URL is empty",
    };
  }
  try {
    const u = new URL(url.trim());
    return {
      protocol: u.protocol,
      hostname: u.hostname,
      port: u.port,
      pathname: u.pathname,
      search: u.search,
      hash: u.hash,
      valid: true,
    };
  } catch (e) {
    return {
      protocol: "", hostname: "", port: "", pathname: "", search: "", hash: "",
      valid: false, error: (e as Error).message,
    };
  }
}

export function isValidUrl(url: string): boolean {
  return parseUrl(url).valid;
}

export interface RedirectHop {
  step: number;
  fromUrl: string;
  toUrl: string;
  redirectType: RedirectType;
  note?: string;
}

export interface ChainStats {
  hopCount: number;
  finalUrl: string;
  hasTemporary: boolean;
  hasMetaRefresh: boolean;
  hasJavascript: boolean;
  allPermanent: boolean;
  isLongChain: boolean;
  warnings: string[];
}

export const LONG_CHAIN_THRESHOLD = 5;

/** Analyze a manually-entered redirect chain. */
export function analyzeChain(hops: RedirectHop[]): ChainStats {
  const warnings: string[] = [];
  if (hops.length === 0) {
    return {
      hopCount: 0,
      finalUrl: "",
      hasTemporary: false,
      hasMetaRefresh: false,
      hasJavascript: false,
      allPermanent: true,
      isLongChain: false,
      warnings: ["No hops provided"],
    };
  }
  const types = hops.map((h) => h.redirectType);
  const hasTemporary = types.some((t) => t === "302" || t === "303" || t === "307");
  const hasMetaRefresh = types.some((t) => t === "meta-refresh");
  const hasJavascript = types.some((t) => t === "javascript");
  const allPermanent = types.every((t) => t === "301" || t === "308");
  const isLongChain = hops.length > LONG_CHAIN_THRESHOLD;
  const finalUrl = hops[hops.length - 1].toUrl;
  if (hasTemporary) {
    warnings.push("Chain contains temporary redirects (302/303/307) — link equity may not pass.");
  }
  if (hasMetaRefresh) {
    warnings.push("Chain contains a meta refresh — slower and less reliable than server redirects.");
  }
  if (hasJavascript) {
    warnings.push("Chain contains a JavaScript redirect — Google may execute it but slower & less reliable.");
  }
  if (isLongChain) {
    warnings.push(`Long redirect chain (${hops.length} hops > ${LONG_CHAIN_THRESHOLD}) — consider consolidating to a single hop.`);
  }
  // Detect loops
  const urls = hops.flatMap((h) => [h.fromUrl, h.toUrl]);
  const seen = new Set<string>();
  for (const u of urls) {
    if (seen.has(u)) {
      warnings.push(`Redirect loop detected — URL "${u}" appears more than once.`);
      break;
    }
    seen.add(u);
  }
  return {
    hopCount: hops.length,
    finalUrl,
    hasTemporary,
    hasMetaRefresh,
    hasJavascript,
    allPermanent,
    isLongChain,
    warnings,
  };
}

/** Render the chain as a visual sequence: URL → [301] → URL → [302] → URL. */
export function renderChainText(hops: RedirectHop[]): string {
  if (hops.length === 0) return "";
  const lines: string[] = [];
  lines.push(`START: ${hops[0].fromUrl}`);
  for (const h of hops) {
    lines.push(`  └─ [${h.redirectType}] → ${h.toUrl}`);
    if (h.note) lines.push(`     note: ${h.note}`);
  }
  lines.push(`END: ${hops[hops.length - 1].toUrl}`);
  return lines.join("\n");
}

/** Render a Markdown report. */
export function renderReport(startUrl: string, hops: RedirectHop[], stats: ChainStats): string {
  const lines: string[] = [];
  lines.push("# Redirect Chain Report");
  lines.push("");
  lines.push(`**Start URL:** ${startUrl}`);
  lines.push(`**Final URL:** ${stats.finalUrl}`);
  lines.push(`**Total hops:** ${stats.hopCount}`);
  lines.push(`**All permanent (301/308):** ${stats.allPermanent ? "Yes" : "No"}`);
  lines.push("");
  lines.push("## Chain");
  lines.push("");
  lines.push("```");
  lines.push(renderChainText(hops));
  lines.push("```");
  lines.push("");
  if (stats.warnings.length > 0) {
    lines.push("## Warnings");
    lines.push("");
    for (const w of stats.warnings) {
      lines.push(`- ⚠️ ${w}`);
    }
    lines.push("");
  }
  lines.push("## How to verify live");
  lines.push("");
  lines.push("- Browser DevTools: Network tab → check 'Preserve log' → reload page → observe 3xx responses.");
  lines.push("- Command line: `curl -I -L <URL>` to follow redirects.");
  lines.push("- Online tools: redirect-checker.com, httpstatus.io.");
  lines.push("");
  lines.push("---");
  lines.push("_Generated with UnQTools Redirect Chain Checker_");
  return lines.join("\n");
}

/** Parse a bulk paste of redirect hops: "from | type | to" one per line. */
export function parseBulkHops(text: string): RedirectHop[] {
  if (!text || !text.trim()) return [];
  const hops: RedirectHop[] = [];
  let step = 1;
  for (const line of text.split(/\n+/).map((l) => l.trim()).filter(Boolean)) {
    const parts = line.split("|").map((s) => s.trim());
    if (parts.length < 3) continue;
    const [fromUrl, type, toUrl] = parts;
    if (!fromUrl || !toUrl) continue;
    const redirectType = (type in REDIRECT_TYPES) ? type as RedirectType : "301";
    hops.push({ step: step++, fromUrl, toUrl, redirectType, note: parts[3] });
  }
  return hops;
}

// ---- History ----

const HISTORY_KEY = "unqtools:redirect-chain-checker:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  startUrl: string;
  hopCount: number;
  warningCount: number;
  snippet: string;
}

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

// ---- Shareable URL ----

export function buildShareUrl(startUrl: string, hops: RedirectHop[]): string {
  const params = new URLSearchParams();
  params.set("url", startUrl);
  params.set("hops", JSON.stringify(hops));
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): { url?: string; hops?: RedirectHop[] } {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const url = params.get("url") || undefined;
  const hopsRaw = params.get("hops");
  let hops: RedirectHop[] | undefined;
  if (hopsRaw) {
    try {
      const parsed = JSON.parse(hopsRaw);
      if (Array.isArray(parsed)) hops = parsed as RedirectHop[];
    } catch {
      // ignore
    }
  }
  return { url, hops };
}
