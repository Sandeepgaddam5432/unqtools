/**
 * Public IP & Geolocation Lookup — pure logic.
 *
 * Generate curl/wget/httpie/fetch commands for "what is my IP" and
 * "geolocate this IP" against ipinfo.io, ip-api.com, ipgeolocation.io,
 * ipapi.co, KeyCDN, HackerTarget. Parse pasted JSON responses into a
 * unified structured card. Detect private/reserved IPs. Generate reverse
 * DNS commands. Honest accuracy caveats.
 *
 * Pure functions only — no DOM, no network, no external deps.
 *
 * PRIVACY: The history feature stores only operation metadata (target +
 * action + provider + ts), NEVER any pasted JSON or ISP/location data.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ProviderId =
  | "ipinfo"
  | "ip-api"
  | "ipgeolocation"
  | "ipapi"
  | "keycdn"
  | "hackertarget";

export type IpFamily = "ipv4" | "ipv6" | "invalid";

export type TargetType = "ipv4" | "ipv6" | "domain" | "private" | "invalid";

export type CommandTool = "curl" | "wget" | "httpie" | "fetch" | "dig" | "nslookup";

export type CommandKind = "my-ip" | "geolocate" | "reverse-dns";

export interface ProviderPreset {
  id: ProviderId;
  label: string;
  /** URL for "what is my IP" — no target needed. */
  myIpUrl: string;
  /** URL template for geolocating a specific IP. Use {ip} placeholder. */
  geolocateUrlTemplate: string;
  /** URL for geolocating a domain (some providers accept domain, others need IP first). */
  supportsDomain: boolean;
  /** Optional token/key query param, e.g. "?token=YOUR_TOKEN". */
  tokenParam?: string;
  /** Free tier is HTTP-only (ip-api). */
  httpOnly?: boolean;
  /** Notes about rate limits or CORS. */
  notes: string;
}

export interface GeneratedCommand {
  tool: CommandTool;
  kind: CommandKind;
  label: string;
  command: string;
  explanation: string;
}

export interface CommandOptions {
  provider: ProviderId;
  /** API token/key for providers that require one. */
  token?: string;
  /** For ip-api, request specific fields. */
  fields?: string;
}

export interface UnifiedGeolocation {
  provider: ProviderId;
  ip?: string;
  hostname?: string;
  city?: string;
  region?: string;
  country?: string;
  countryCode?: string;
  postal?: string;
  lat?: number;
  lon?: number;
  accuracyRadiusKm?: number;
  timezone?: string;
  utcOffset?: string;
  isp?: string;
  org?: string;
  as?: string;
  asn?: string;
  isProxy?: boolean;
  isVpn?: boolean;
  isHosting?: boolean;
  isMobile?: boolean;
  raw: Record<string, unknown>;
  notes: string[];
}

export interface HistoryEntry {
  ts: number;
  target: string;
  type: TargetType;
  action: "generate" | "parse" | "bulk";
  provider: ProviderId;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const PROVIDERS: ProviderPreset[] = [
  {
    id: "ipinfo",
    label: "ipinfo.io",
    myIpUrl: "https://ipinfo.io/json",
    geolocateUrlTemplate: "https://ipinfo.io/{ip}/json",
    supportsDomain: true,
    tokenParam: "?token=",
    notes: "Free 50k/month. JSON. CORS-enabled. Token in URL.",
  },
  {
    id: "ip-api",
    label: "ip-api.com",
    myIpUrl: "http://ip-api.com/json/",
    geolocateUrlTemplate: "http://ip-api.com/json/{ip}",
    supportsDomain: true,
    httpOnly: true,
    notes: "Free 45/min, HTTP-only on free tier. JSON. CORS-enabled. HTTPS requires paid plan.",
  },
  {
    id: "ipgeolocation",
    label: "ipgeolocation.io",
    myIpUrl: "https://api.ipgeolocation.io/getip",
    geolocateUrlTemplate: "https://api.ipgeolocation.io/ipgeo?ip={ip}",
    supportsDomain: false,
    tokenParam: "&apiKey=",
    notes: "Free 30k/month. API key required for geolocate endpoint. CORS-enabled.",
  },
  {
    id: "ipapi",
    label: "ipapi.co",
    myIpUrl: "https://ipapi.co/json/",
    geolocateUrlTemplate: "https://ipapi.co/{ip}/json/",
    supportsDomain: false,
    notes: "Free 30k/month. JSON. CORS-enabled. HTTPS available.",
  },
  {
    id: "keycdn",
    label: "KeyCDN",
    myIpUrl: "https://tools.keycdn.com/geo.json?host=",
    geolocateUrlTemplate: "https://tools.keycdn.com/geo.json?host={ip}",
    supportsDomain: false,
    tokenParam: "",
    notes: "Free demo endpoint. CORS may block browser fetches — curl recommended.",
  },
  {
    id: "hackertarget",
    label: "HackerTarget",
    myIpUrl: "https://api.hackertarget.com/geojson/?q=",
    geolocateUrlTemplate: "https://api.hackertarget.com/geojson/?q={ip}",
    supportsDomain: false,
    notes: "Free 50/day anonymous. JSON. Rate-limited. No token needed.",
  },
];

export const PROVIDER_LABELS: Record<ProviderId, string> = {
  ipinfo: "ipinfo.io",
  "ip-api": "ip-api.com",
  ipgeolocation: "ipgeolocation.io",
  ipapi: "ipapi.co",
  keycdn: "KeyCDN",
  hackertarget: "HackerTarget",
};

/** Reserved/private IPv4 ranges (RFC 1918 + special-use). */
export const PRIVATE_IPV4_PREFIXES: string[] = [
  "10.",          // RFC 1918
  "172.16.", "172.17.", "172.18.", "172.19.", "172.20.", "172.21.", "172.22.", "172.23.",
  "172.24.", "172.25.", "172.26.", "172.27.", "172.28.", "172.29.", "172.30.", "172.31.",
  "192.168.",     // RFC 1918
  "127.",         // loopback
  "169.254.",     // link-local
  "0.",           // "this network"
  "100.64.", "100.65.", "100.66.", "100.67.", "100.68.", "100.69.", "100.70.", // CGNAT
  "100.71.", "100.72.", "100.73.", "100.74.", "100.75.", "100.76.", "100.77.", "100.78.",
  "100.79.", "100.80.", "100.81.", "100.82.", "100.83.", "100.84.", "100.85.", "100.86.",
  "100.87.", "100.88.", "100.89.", "100.90.", "100.91.", "100.92.", "100.93.", "100.94.",
  "100.95.", "100.96.", "100.97.", "100.98.", "100.99.", "100.100.", "100.101.", "100.102.",
  "100.103.", "100.104.", "100.105.", "100.106.", "100.107.", "100.108.", "100.109.", "100.110.",
  "100.111.", "100.112.", "100.113.", "100.114.", "100.115.", "100.116.", "100.117.", "100.118.",
  "100.119.", "100.120.", "100.121.", "100.122.", "100.123.", "100.124.", "100.125.", "100.126.",
  "100.127.",     // RFC 6598 CGNAT
  "192.0.2.",     // TEST-NET-1 documentation
  "198.51.100.",  // TEST-NET-2
  "203.0.113.",   // TEST-NET-3
  "240.", "241.", "242.", "243.", "244.", "245.", "246.", "247.", "248.", "249.",
  "250.", "251.", "252.", "253.", "254.", "255.", // reserved
];

/** Reserved IPv6 prefixes. */
export const PRIVATE_IPV6_PREFIXES: string[] = [
  "::1",          // loopback
  "fc", "fd",     // ULA fc00::/7
  "fe80", "fe81", "fe82", "fe83", "fe84", "fe85", "fe86", "fe87",
  "fe88", "fe89", "fe8a", "fe8b", "fe8c", "fe8d", "fe8e", "fe8f", // link-local fe80::/10
  "ff",           // multicast ff00::/8
  "2001:db8",     // documentation 2001:db8::/32
  "::",           // unspecified
];

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const IPV4_OCTET = "(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)";
const IPV4_RE = new RegExp(`^${IPV4_OCTET}\\.${IPV4_OCTET}\\.${IPV4_OCTET}\\.${IPV4_OCTET}$`);

const DOMAIN_RE = /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;

/** Detect the IP family (IPv4, IPv6, or invalid) of a string. */
export function detectIpFamily(s: string): IpFamily {
  const v = (s || "").trim();
  if (!v) return "invalid";
  if (IPV4_RE.test(v)) return "ipv4";
  // naive IPv6 check: contains "::" or has 5+ colons
  if (/^[0-9a-f:]+$/i.test(v) && (v.includes("::") || (v.match(/:/g)?.length ?? 0) >= 2)) {
    return "ipv6";
  }
  return "invalid";
}

/** Validate an IPv4 address (strict). */
export function validateIpv4(s: string): boolean {
  return IPV4_RE.test((s || "").trim());
}

/** Validate an IPv6 address (loose — accepts short forms). */
export function validateIpv6(s: string): boolean {
  const v = (s || "").trim().toLowerCase();
  if (!v || /[^0-9a-f:]/.test(v)) return false;
  // empty
  if (v === "::") return true;
  // cannot have more than one "::"
  if ((v.match(/::/g) ?? []).length > 1) return false;
  // expand ::
  const parts = v.split("::");
  let left: string[] = [];
  let right: string[] = [];
  if (parts.length === 2) {
    left = parts[0] ? parts[0].split(":") : [];
    right = parts[1] ? parts[1].split(":") : [];
  } else {
    left = v.split(":");
  }
  const all = [...left, ...right];
  if (all.some((g) => g.length === 0 || g.length > 4)) return false;
  if (parts.length === 1 && all.length !== 8) return false;
  if (parts.length === 2 && all.length > 7) return false;
  return all.every((g) => /^[0-9a-f]{1,4}$/.test(g));
}

/** Validate a domain name. */
export function validateDomain(s: string): boolean {
  return DOMAIN_RE.test((s || "").trim());
}

/** Detect the target type for an arbitrary input. */
export function detectTargetType(s: string): TargetType {
  const v = (s || "").trim();
  if (!v) return "invalid";
  const fam = detectIpFamily(v);
  if (fam === "ipv4") return isPrivateIpv4(v) ? "private" : "ipv4";
  if (fam === "ipv6") return isPrivateIpv6(v) ? "private" : "ipv6";
  if (validateDomain(v)) return "domain";
  return "invalid";
}

/** Normalize a target string (trim, lowercase domains and IPv6). */
export function normalizeTarget(s: string): string {
  const v = (s || "").trim();
  if (!v) return "";
  // IPv4 has no case — return as-is.
  if (validateIpv4(v)) return v;
  // IPv6 hex digits can be A-F or a-f — lowercase for canonical form.
  if (validateIpv6(v)) return v.toLowerCase();
  // Domains are case-insensitive — lowercase.
  return v.toLowerCase();
}

/** Check if an IPv4 address is private/reserved. */
export function isPrivateIpv4(s: string): boolean {
  const v = (s || "").trim();
  if (!validateIpv4(v)) return false;
  return PRIVATE_IPV4_PREFIXES.some((p) => v.startsWith(p));
}

/** Check if an IPv6 address is private/reserved (loopback, ULA, link-local, multicast, doc). */
export function isPrivateIpv6(s: string): boolean {
  const v = (s || "").trim().toLowerCase();
  if (!validateIpv6(v)) return false;
  if (v === "::" || v === "::1") return true;
  if (v.startsWith("fc") || v.startsWith("fd")) return true;
  if (v.startsWith("fe8") || v.startsWith("fe9") || v.startsWith("fea") || v.startsWith("feb")) return true;
  if (v.startsWith("ff")) return true;
  if (v.startsWith("2001:db8")) return true;
  return false;
}

/** Is the target a private/reserved IP (any family)? */
export function isPrivateTarget(s: string): boolean {
  const v = (s || "").trim();
  return (validateIpv4(v) && isPrivateIpv4(v)) || (validateIpv6(v) && isPrivateIpv6(v));
}

// ---------------------------------------------------------------------------
// URL building
// ---------------------------------------------------------------------------

function getProvider(id: ProviderId): ProviderPreset {
  const p = PROVIDERS.find((x) => x.id === id);
  if (!p) throw new Error(`Unknown provider: ${id}`);
  return p;
}

/** Append token to a URL if the provider uses one and a token is supplied. */
function applyToken(url: string, preset: ProviderPreset, token?: string): string {
  if (!token || !preset.tokenParam) return url;
  const sep = preset.tokenParam.startsWith("?") || preset.tokenParam.startsWith("&")
    ? ""
    : (url.includes("?") ? "" : "?");
  // tokenParam itself may be "?token=" or "&apiKey="; normalize
  const param = preset.tokenParam.replace(/^[?&]/, "");
  const join = url.includes("?") ? "&" : "?";
  // If tokenParam already starts with "?" assume it replaces nothing
  if (preset.tokenParam.startsWith("?") && !url.includes("?")) {
    return `${url}?${param}${encodeURIComponent(token)}`;
  }
  return `${url}${join}${param}${encodeURIComponent(token)}`;
}

/** Build the "what is my IP" URL for a provider. */
export function buildMyIpUrl(provider: ProviderId, token?: string): string {
  const p = getProvider(provider);
  return applyToken(p.myIpUrl, p, token);
}

/** Build the "geolocate this IP" URL for a provider. */
export function buildGeolocateUrl(target: string, provider: ProviderId, token?: string): string {
  const p = getProvider(provider);
  const t = normalizeTarget(target);
  if (!t) return "";
  if (!p.supportsDomain && detectTargetType(t) === "domain") {
    // Provider needs an IP — note this in caller
    return "";
  }
  const url = p.geolocateUrlTemplate.replace("{ip}", encodeURIComponent(t));
  return applyToken(url, p, token);
}

// ---------------------------------------------------------------------------
// Command generation
// ---------------------------------------------------------------------------

/** Generate curl command for a URL. */
export function curlCommand(url: string, opts?: { includeHeaders?: boolean }): string {
  const lines = ["curl", "-sS"];
  if (opts?.includeHeaders) lines.push("-H 'Accept: application/json'");
  lines.push(`'${url}'`);
  return lines.join(" \\\n  ");
}

/** Generate wget command for a URL. */
export function wgetCommand(url: string): string {
  return `wget -qO- '${url}'`;
}

/** Generate httpie command for a URL. */
export function httpieCommand(url: string): string {
  return `http '${url}' Accept:application/json`;
}

/** Generate fetch() JS snippet for a URL. */
export function fetchCommand(url: string): string {
  return [
    `fetch('${url}', { headers: { 'Accept': 'application/json' } })`,
    `  .then(r => r.json())`,
    `  .then(data => console.log(data))`,
    `  .catch(err => console.error(err));`,
  ].join("\n");
}

/** Generate reverse-DNS commands (dig +short +ptr or nslookup). */
export function reverseDnsCommands(ip: string): GeneratedCommand[] {
  const t = (ip || "").trim();
  if (!t) return [];
  const fam = detectIpFamily(t);
  if (fam === "invalid") return [];
  const ptr = buildPtrName(t);
  if (!ptr) return [];
  return [
    {
      tool: "dig",
      kind: "reverse-dns",
      label: `dig reverse DNS for ${t}`,
      command: `dig +short -x ${t}`,
      explanation: `Queries the in-addr.arpa (IPv4) or ip6.arpa (IPv6) PTR record for ${t}. Use +short for the hostname only; drop +short for full output including TTL.`,
    },
    {
      tool: "nslookup",
      kind: "reverse-dns",
      label: `nslookup reverse DNS for ${t}`,
      command: `nslookup ${t}`,
      explanation: `Equally resolves the PTR record. nslookup is available on Windows by default; dig is the modern choice on Linux/macOS.`,
    },
    {
      tool: "dig",
      kind: "reverse-dns",
      label: `Direct PTR query (${ptr})`,
      command: `dig +short ${ptr} PTR`,
      explanation: `Queries the PTR record directly by name (${ptr}). Useful when verifying what an authoritative server returns.`,
    },
  ];
}

/** Build the in-addr.arpa or ip6.arpa name for an IP. Returns "" for invalid. */
export function buildPtrName(ip: string): string {
  const t = (ip || "").trim();
  const fam = detectIpFamily(t);
  if (fam === "invalid") return "";
  if (fam === "ipv4") {
    const octets = t.split(".");
    return `${octets[3]}.${octets[2]}.${octets[1]}.${octets[0]}.in-addr.arpa`;
  }
  // IPv6: expand and reverse nibbles
  const expanded = expandIpv6(t);
  if (!expanded) return "";
  const nibbles = expanded.replace(/:/g, "").split("").reverse().join(".");
  return `${nibbles}.ip6.arpa`;
}

/** Expand an IPv6 address to full 8-group form. Returns "" if invalid. */
export function expandIpv6(s: string): string {
  const v = (s || "").trim().toLowerCase();
  if (!validateIpv6(v)) return "";
  if (v === "::") return "0000:0000:0000:0000:0000:0000:0000:0000";
  let left: string[];
  let right: string[];
  if (v.includes("::")) {
    const parts = v.split("::");
    left = parts[0] ? parts[0].split(":") : [];
    right = parts[1] ? parts[1].split(":") : [];
  } else {
    left = v.split(":");
    right = [];
  }
  const missing = 8 - (left.length + right.length);
  const groups = [...left, ...Array(missing).fill("0"), ...right];
  return groups.map((g) => g.padStart(4, "0")).join(":");
}

/** Generate all "what is my IP" commands for a provider. */
export function generateMyIpCommands(
  provider: ProviderId,
  token?: string,
): GeneratedCommand[] {
  const url = buildMyIpUrl(provider, token);
  const label = PROVIDER_LABELS[provider];
  const p = getProvider(provider);
  const note = p.httpOnly ? " (note: free tier is HTTP-only — use curl in terminal)" : "";
  return [
    {
      tool: "curl",
      kind: "my-ip",
      label: `curl — my IP via ${label}`,
      command: curlCommand(url, { includeHeaders: true }),
      explanation: `Returns your current public IP as JSON from ${label}.${note} Run in your terminal — the request leaves your machine and reaches ${label}'s server.`,
    },
    {
      tool: "wget",
      kind: "my-ip",
      label: `wget — my IP via ${label}`,
      command: wgetCommand(url),
      explanation: `wget equivalent. Useful on systems without curl. Output is the raw JSON response body.`,
    },
    {
      tool: "httpie",
      kind: "my-ip",
      label: `httpie — my IP via ${label}`,
      command: httpieCommand(url),
      explanation: `httpie prints the response with syntax-highlighted JSON. Install with: pip install httpie.`,
    },
    {
      tool: "fetch",
      kind: "my-ip",
      label: `fetch() — my IP via ${label}`,
      command: fetchCommand(url),
      explanation: `Browser fetch() snippet.${note} Paste into the browser console — note some providers may block CORS from arbitrary origins.`,
    },
  ];
}

/** Generate all "geolocate this IP" commands for a provider. */
export function generateGeolocateCommands(
  target: string,
  provider: ProviderId,
  token?: string,
): GeneratedCommand[] {
  const t = normalizeTarget(target);
  if (!t) return [];
  const type = detectTargetType(t);
  if (type === "private") {
    return [{
      tool: "curl",
      kind: "geolocate",
      label: "Private/reserved IP — no geolocation",
      command: `# ${t} is a private or reserved address — no GeoIP data exists for it.`,
      explanation: `${t} is in a private (RFC 1918), loopback, link-local, CGNAT, documentation, or reserved range. Geolocation APIs return no data for these addresses. If you saw this address in a network config, it is internal to a private network and has no public location.`,
    }];
  }
  if (type === "invalid") {
    return [{
      tool: "curl",
      kind: "geolocate",
      label: "Invalid target",
      command: `# '${t}' is not a valid IPv4, IPv6, or domain.`,
      explanation: `Enter a valid IPv4 (e.g. 8.8.8.8), IPv6 (e.g. 2606:4700:4700::1111), or domain (e.g. cloudflare.com).`,
    }];
  }
  const url = buildGeolocateUrl(t, provider, token);
  if (!url) {
    return [{
      tool: "curl",
      kind: "geolocate",
      label: `${PROVIDER_LABELS[provider]} does not accept domains`,
      command: `# ${PROVIDER_LABELS[provider]} requires an IP. Resolve ${t} first: dig +short ${t} A`,
      explanation: `${PROVIDER_LABELS[provider]} does not accept domain names on its geolocation endpoint. First resolve ${t} to an IP with \`dig +short ${t} A\` or \`nslookup ${t}\`, then geolocate the resulting IP.`,
    }];
  }
  const label = PROVIDER_LABELS[provider];
  const p = getProvider(provider);
  const note = p.httpOnly ? " (note: free tier is HTTP-only)" : "";
  return [
    {
      tool: "curl",
      kind: "geolocate",
      label: `curl — geolocate ${t} via ${label}`,
      command: curlCommand(url, { includeHeaders: true }),
      explanation: `Returns the geolocation JSON for ${t} from ${label}.${note} Paste the response back into the parser to get a unified card.`,
    },
    {
      tool: "wget",
      kind: "geolocate",
      label: `wget — geolocate ${t} via ${label}`,
      command: wgetCommand(url),
      explanation: `wget equivalent. Useful on systems without curl.`,
    },
    {
      tool: "httpie",
      kind: "geolocate",
      label: `httpie — geolocate ${t} via ${label}`,
      command: httpieCommand(url),
      explanation: `httpie prints the response with syntax-highlighted JSON.`,
    },
    {
      tool: "fetch",
      kind: "geolocate",
      label: `fetch() — geolocate ${t} via ${label}`,
      command: fetchCommand(url),
      explanation: `Browser fetch() snippet. Note some providers (e.g. KeyCDN) may block CORS from arbitrary origins; in that case use curl in a terminal.`,
    },
  ];
}

/** Generate provider comparison — geolocate URL for every provider. */
export function generateProviderComparison(target: string, token?: string): GeneratedCommand[] {
  const t = normalizeTarget(target);
  if (!t) return [];
  const type = detectTargetType(t);
  if (type === "invalid") return [];
  const out: GeneratedCommand[] = [];
  for (const p of PROVIDERS) {
    const url = buildGeolocateUrl(t, p.id, token);
    if (!url) continue;
    out.push({
      tool: "curl",
      kind: "geolocate",
      label: `${p.label}`,
      command: curlCommand(url, { includeHeaders: true }),
      explanation: p.notes,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Response parsing
// ---------------------------------------------------------------------------

function get(obj: Record<string, unknown>, ...keys: string[]): unknown {
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== "") return obj[k];
  }
  return undefined;
}

function str(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined;
  const s = String(v).trim();
  return s || undefined;
}

function num(v: unknown): number | undefined {
  if (v === undefined || v === null) return undefined;
  const n = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : undefined;
}

function bool(v: unknown): boolean | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v === "boolean") return v;
  const s = String(v).toLowerCase().trim();
  if (s === "true" || s === "1" || s === "yes") return true;
  if (s === "false" || s === "0" || s === "no") return false;
  return undefined;
}

/** Parse a "loc" string like "37.7749,-122.4194" into lat/lon. */
function parseLoc(loc: string): { lat?: number; lon?: number } {
  const m = String(loc).split(",").map((x) => parseFloat(x.trim()));
  if (m.length === 2 && Number.isFinite(m[0]) && Number.isFinite(m[1])) {
    return { lat: m[0], lon: m[1] };
  }
  return {};
}

/** Detect the provider from a JSON response. */
export function detectProviderFromResponse(json: Record<string, unknown>): ProviderId | null {
  if ("ipinfo.io" in json || ("ip" in json && "city" in json && "region" in json && "postal" in json && "org" in json && "hostname" in json)) {
    return "ipinfo";
  }
  if ("status" in json && "query" in json && ("countryCode" in json || "country" in json) && "as" in json) {
    return "ip-api";
  }
  if ("ip" in json && "country_code2" in json) return "ipgeolocation";
  if ("ip" in json && "country_code" in json && "region" in json && "latitude" in json && "longitude" in json) {
    return "ipapi";
  }
  if ("status" in json && "data" in json && "geo" in (json.data as Record<string, unknown> | undefined ?? {})) {
    return "keycdn";
  }
  if (json.geo && typeof json.geo === "object") return "hackertarget";
  return null;
}

/** Parse a geolocation JSON response from any supported provider into a unified card. */
export function parseGeolocationResponse(
  raw: string,
  hint?: ProviderId,
): UnifiedGeolocation {
  let json: Record<string, unknown>;
  try {
    json = JSON.parse(raw);
  } catch {
    return {
      provider: hint ?? "ipinfo",
      raw: {},
      notes: ["Invalid JSON — could not parse the response. Make sure you copied the full JSON body."],
    };
  }
  if (typeof json !== "object" || json === null || Array.isArray(json)) {
    return {
      provider: hint ?? "ipinfo",
      raw: {},
      notes: ["Response is not a JSON object. Expected a geolocation JSON object."],
    };
  }
  const provider = hint ?? detectProviderFromResponse(json) ?? "ipinfo";
  const base: UnifiedGeolocation = { provider, raw: json, notes: [] };

  if (provider === "ipinfo") return parseIpinfo(json, base);
  if (provider === "ip-api") return parseIpApi(json, base);
  if (provider === "ipgeolocation") return parseIpgeolocation(json, base);
  if (provider === "ipapi") return parseIpapi(json, base);
  if (provider === "keycdn") return parseKeycdn(json, base);
  if (provider === "hackertarget") return parseHackertarget(json, base);
  return base;
}

function parseIpinfo(json: Record<string, unknown>, base: UnifiedGeolocation): UnifiedGeolocation {
  const loc = parseLoc(String(get(json, "loc") ?? ""));
  return {
    ...base,
    ip: str(get(json, "ip")),
    hostname: str(get(json, "hostname")),
    city: str(get(json, "city")),
    region: str(get(json, "region")),
    country: str(get(json, "country")),
    countryCode: str(get(json, "country")),
    postal: str(get(json, "postal")),
    lat: loc.lat,
    lon: loc.lon,
    timezone: str(get(json, "timezone")),
    org: str(get(json, "org")),
    // ipinfo "org" looks like "AS15169 Google LLC"
    asn: extractAsnFromOrg(str(get(json, "org"))),
    isp: extractIspFromOrg(str(get(json, "org"))),
  };
}

function parseIpApi(json: Record<string, unknown>, base: UnifiedGeolocation): UnifiedGeolocation {
  return {
    ...base,
    ip: str(get(json, "query")),
    city: str(get(json, "city")),
    region: str(get(json, "regionName")),
    country: str(get(json, "country")),
    countryCode: str(get(json, "countryCode")),
    postal: str(get(json, "zip")),
    lat: num(get(json, "lat")),
    lon: num(get(json, "lon")),
    timezone: str(get(json, "timezone")),
    isp: str(get(json, "isp")),
    org: str(get(json, "org")),
    as: str(get(json, "as")),
    asn: extractAsnFromOrg(str(get(json, "as"))),
    isProxy: bool(get(json, "proxy")),
    isHosting: bool(get(json, "hosting")),
    isMobile: bool(get(json, "mobile")),
  };
}

function parseIpgeolocation(json: Record<string, unknown>, base: UnifiedGeolocation): UnifiedGeolocation {
  return {
    ...base,
    ip: str(get(json, "ip")),
    city: str(get(json, "city")),
    region: str(get(json, "state_prov")),
    country: str(get(json, "country_name")),
    countryCode: str(get(json, "country_code2", "country_code")),
    postal: str(get(json, "zipcode")),
    lat: num(get(json, "latitude")),
    lon: num(get(json, "longitude")),
    accuracyRadiusKm: num(get(json, "radius")),
    timezone: str(get(json, "time_zone", "timezone")),
    isp: str(get(json, "isp")),
    org: str(get(json, "organization")),
    asn: str(get(json, "asn")),
    isVpn: bool(get(json, "is_vpn")),
    isProxy: bool(get(json, "is_proxy")),
  };
}

function parseIpapi(json: Record<string, unknown>, base: UnifiedGeolocation): UnifiedGeolocation {
  return {
    ...base,
    ip: str(get(json, "ip")),
    city: str(get(json, "city")),
    region: str(get(json, "region")),
    country: str(get(json, "country_name")),
    countryCode: str(get(json, "country_code")),
    postal: str(get(json, "postal")),
    lat: num(get(json, "latitude")),
    lon: num(get(json, "longitude")),
    timezone: str(get(json, "timezone")),
    utcOffset: str(get(json, "utc_offset")),
    org: str(get(json, "org")),
    asn: str(get(json, "asn")),
    isp: str(get(json, "asn_org")),
  };
}

function parseKeycdn(json: Record<string, unknown>, base: UnifiedGeolocation): UnifiedGeolocation {
  const data = (json.data as Record<string, unknown> | undefined) ?? {};
  const geo = (data.geo as Record<string, unknown> | undefined) ?? {};
  return {
    ...base,
    ip: str(get(data, "ip")),
    city: str(get(geo, "city")),
    region: str(get(geo, "region")),
    country: str(get(geo, "country_name")),
    countryCode: str(get(geo, "country_code")),
    postal: str(get(geo, "postal_code")),
    lat: num(get(geo, "latitude")),
    lon: num(get(geo, "longitude")),
    timezone: str(get(geo, "timezone")),
    isp: str(get(geo, "isp")),
    asn: str(get(geo, "asn")),
    org: str(get(geo, "organization")),
  };
}

function parseHackertarget(json: Record<string, unknown>, base: UnifiedGeolocation): UnifiedGeolocation {
  // HackerTarget returns a GeoJSON FeatureCollection — extract from features[0].properties
  const features = (json.features as unknown[] | undefined) ?? [];
  if (features.length === 0) {
    base.notes.push("No features in response — IP may be invalid or rate limit hit.");
    return base;
  }
  const f = features[0] as Record<string, unknown>;
  const props = (f.properties as Record<string, unknown> | undefined) ?? {};
  const geom = (f.geometry as Record<string, unknown> | undefined) ?? {};
  const coords = (geom.coordinates as number[] | undefined) ?? [];
  return {
    ...base,
    ip: str(get(props, "ip", "query")),
    city: str(get(props, "city")),
    region: str(get(props, "region")),
    country: str(get(props, "country_name", "country")),
    countryCode: str(get(props, "country_code")),
    lat: coords.length >= 2 ? coords[1] : num(get(props, "latitude")),
    lon: coords.length >= 2 ? coords[0] : num(get(props, "longitude")),
    isp: str(get(props, "isp")),
    asn: str(get(props, "asn")),
  };
}

/** Extract an ASN like "AS15169" from an org string like "AS15169 Google LLC". */
export function extractAsnFromOrg(org: string | undefined): string | undefined {
  if (!org) return undefined;
  const m = org.match(/AS\d+/);
  return m ? m[0] : undefined;
}

/** Extract an ISP name from an org string like "AS15169 Google LLC". */
export function extractIspFromOrg(org: string | undefined): string | undefined {
  if (!org) return undefined;
  return org.replace(/^AS\d+\s+/, "").trim() || undefined;
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

/** Format a coordinates pair as a Google Maps URL. */
export function formatGoogleMapsUrl(lat?: number, lon?: number): string {
  if (lat === undefined || lon === undefined) return "";
  return `https://www.google.com/maps?q=${lat},${lon}`;
}

/** Format a coordinates pair as an OpenStreetMap URL. */
export function formatOsmUrl(lat?: number, lon?: number): string {
  if (lat === undefined || lon === undefined) return "";
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=10/${lat}/${lon}`;
}

/** Render the unified geolocation as a markdown table. */
export function renderMarkdown(g: UnifiedGeolocation): string {
  const lines: string[] = [];
  lines.push(`| Field | Value |`);
  lines.push(`| --- | --- |`);
  if (g.ip) lines.push(`| IP | ${g.ip} |`);
  if (g.hostname) lines.push(`| Hostname | ${g.hostname} |`);
  if (g.country) lines.push(`| Country | ${g.country} (${g.countryCode ?? ""}) |`);
  if (g.region) lines.push(`| Region | ${g.region} |`);
  if (g.city) lines.push(`| City | ${g.city} |`);
  if (g.postal) lines.push(`| Postal | ${g.postal} |`);
  if (g.lat !== undefined && g.lon !== undefined) lines.push(`| Coordinates | ${g.lat}, ${g.lon} |`);
  if (g.accuracyRadiusKm !== undefined) lines.push(`| Accuracy radius | ~${g.accuracyRadiusKm} km |`);
  if (g.timezone) lines.push(`| Timezone | ${g.timezone} |`);
  if (g.utcOffset) lines.push(`| UTC offset | ${g.utcOffset} |`);
  if (g.isp) lines.push(`| ISP | ${g.isp} |`);
  if (g.org) lines.push(`| Organization | ${g.org} |`);
  if (g.asn) lines.push(`| ASN | ${g.asn} |`);
  if (g.as) lines.push(`| AS | ${g.as} |`);
  if (g.isProxy) lines.push(`| Proxy | yes |`);
  if (g.isVpn) lines.push(`| VPN | yes |`);
  if (g.isHosting) lines.push(`| Hosting/datacenter | yes |`);
  if (g.isMobile) lines.push(`| Mobile | yes |`);
  return lines.join("\n");
}

/** Render the unified geolocation as CSV. */
export function renderCsv(g: UnifiedGeolocation): string {
  const header = "ip,hostname,country,country_code,region,city,postal,lat,lon,accuracy_km,timezone,isp,org,asn,is_proxy,is_vpn,is_hosting,is_mobile";
  const row = [
    g.ip ?? "",
    g.hostname ?? "",
    g.country ?? "",
    g.countryCode ?? "",
    g.region ?? "",
    g.city ?? "",
    g.postal ?? "",
    g.lat ?? "",
    g.lon ?? "",
    g.accuracyRadiusKm ?? "",
    g.timezone ?? "",
    g.isp ?? "",
    g.org ?? "",
    g.asn ?? "",
    g.isProxy ? "yes" : "no",
    g.isVpn ? "yes" : "no",
    g.isHosting ? "yes" : "no",
    g.isMobile ? "yes" : "no",
  ].map((v) => escapeCsv(String(v))).join(",");
  return `${header}\n${row}`;
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Build a unified "accuracy caveat" notice for display. */
export function accuracyCaveat(g: UnifiedGeolocation): string {
  if (g.accuracyRadiusKm !== undefined) {
    return `IP geolocation is approximate — the API reports an accuracy radius of ~${g.accuracyRadiusKm} km. Do not treat this as a street-level pin.`;
  }
  return `IP geolocation is approximate — typically only country/region/city accurate. CGNAT, mobile carriers, VPNs, proxies, and anycast IPs can place an IP far from the actual user. Treat the coordinates as a city centroid hint, not a precise location.`;
}

// ---------------------------------------------------------------------------
// Bulk lookup
// ---------------------------------------------------------------------------

/** Parse a bulk input string into a list of normalized targets. */
export function parseBulk(input: string): string[] {
  return (input || "")
    .split(/[\s,;]+/)
    .map((s) => normalizeTarget(s))
    .filter(Boolean);
}

/** Generate a "geolocate each IP" curl script for a list of targets. */
export function generateBulkCurl(targets: string[], provider: ProviderId, token?: string): string {
  const lines = ["#!/usr/bin/env bash", `# Bulk IP geolocation via ${PROVIDER_LABELS[provider]}`, ""];
  for (const t of targets) {
    const url = buildGeolocateUrl(t, provider, token);
    if (!url) {
      lines.push(`# Skipping ${t} — ${PROVIDER_LABELS[provider]} does not accept this target.`);
      continue;
    }
    lines.push(`echo '=== ${t} ==='`);
    lines.push(`curl -sS -H 'Accept: application/json' '${url}'`);
    lines.push("");
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:public-ip-geolocation-lookup:history";
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

export function buildShareUrl(
  target: string,
  provider: ProviderId,
  tab: "commands" | "parse" | "bulk",
  token: string,
): string {
  const params = new URLSearchParams();
  if (target) params.set("target", target);
  if (provider) params.set("provider", provider);
  if (tab) params.set("tab", tab);
  if (token) params.set("token", token);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): {
  target: string;
  provider: ProviderId;
  tab: "commands" | "parse" | "bulk";
  token: string;
} {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  const fallback: { target: string; provider: ProviderId; tab: "commands" | "parse" | "bulk"; token: string } = {
    target: "",
    provider: "ipinfo",
    tab: "commands",
    token: "",
  };
  if (!clean) return fallback;
  const params = new URLSearchParams(clean);
  const providerRaw = params.get("provider") ?? "ipinfo";
  const provider = (PROVIDERS.find((p) => p.id === providerRaw)?.id ?? "ipinfo") as ProviderId;
  const tabRaw = params.get("tab") ?? "commands";
  const tab = tabRaw === "parse" || tabRaw === "bulk" ? tabRaw : "commands";
  return {
    target: params.get("target") ?? "",
    provider,
    tab,
    token: params.get("token") ?? "",
  };
}
