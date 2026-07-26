/**
 * Free Proxy Verifier — pure logic.
 *
 * Validates the *format* and *metadata* of proxy strings, infers the
 * protocol, and classifies the likely anonymity level. This module
 * does NOT make network requests — verifying connectivity requires
 * the user's browser to attempt a fetch through the proxy, which is
 * a runtime concern (and often blocked by CORS). What we can do
 * locally:
 *
 *   • Parse `host:port` (and optional `user:pass@host:port`)
 *   • Validate IPv4 / IPv6 host formats
 *   • Validate port range (1-65535)
 *   • Infer protocol from the port (3128 → HTTP, 1080 → SOCKS5, etc.)
 *   • Classify likely anonymity based on headers a proxy would leak
 *     (returned as a heuristic checklist, not a network test)
 */

export type ProxyProtocol = "http" | "https" | "socks4" | "socks5" | "unknown";

export type AnonymityLevel = "transparent" | "anonymous" | "elite" | "unknown";

export interface ProxyVerification {
  raw: string;
  valid: boolean;
  host: string;
  port: number | null;
  username?: string;
  password?: string;
  protocol: ProxyProtocol;
  inferredProtocol: ProxyProtocol;
  anonymity: AnonymityLevel;
  hostType: "ipv4" | "ipv6" | "hostname" | "invalid";
  warnings: string[];
  notes: string[];
}

const PORT_PROTOCOL_HINTS: Record<number, ProxyProtocol> = {
  80: "http",
  443: "https",
  8080: "http",
  8000: "http",
  3128: "http",
  8888: "http",
  1080: "socks5",
  1081: "socks5",
  9050: "socks5", // Tor
  4145: "socks4",
};

const IP_V4 = /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)$/;
const IPV6_BRACKETED = /^\[[0-9a-fA-F:]+\]$/;
const HOSTNAME = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

export function classifyHost(host: string): "ipv4" | "ipv6" | "hostname" | "invalid" {
  if (IP_V4.test(host)) return "ipv4";
  if (IPV6_BRACKETED.test(host)) return "ipv6";
  if (HOSTNAME.test(host)) return "hostname";
  return "invalid";
}

export function inferProtocol(port: number | null, explicit?: ProxyProtocol): ProxyProtocol {
  if (explicit && explicit !== "unknown") return explicit;
  if (port === null) return "unknown";
  return PORT_PROTOCOL_HINTS[port] ?? "unknown";
}

/** Parse a single proxy string in the forms:
 *   - host:port
 *   - scheme://host:port
 *   - scheme://user:pass@host:port
 *   - [::1]:8080  (IPv6)
 */
export function parseProxy(raw: string): ProxyVerification {
  const warnings: string[] = [];
  const notes: string[] = [];
  const trimmed = (raw ?? "").trim();
  if (!trimmed) {
    return emptyVerification("", false, ["Empty proxy string."]);
  }

  let protocol: ProxyProtocol = "unknown";
  let rest = trimmed;
  const schemeMatch = trimmed.match(/^([a-z0-9]+):\/\/(.+)$/i);
  if (schemeMatch) {
    const scheme = schemeMatch[1]!.toLowerCase();
    if (scheme === "http" || scheme === "https" || scheme === "socks4" || scheme === "socks5") {
      protocol = scheme;
    } else {
      warnings.push(`Unrecognised scheme "${scheme}" — treating as unknown.`);
    }
    rest = schemeMatch[2]!;
  }

  // Optional user:pass@
  let username: string | undefined;
  let password: string | undefined;
  const atIdx = rest.lastIndexOf("@");
  if (atIdx >= 0) {
    const creds = rest.slice(0, atIdx);
    rest = rest.slice(atIdx + 1);
    const colonIdx = creds.indexOf(":");
    if (colonIdx >= 0) {
      username = creds.slice(0, colonIdx);
      password = creds.slice(colonIdx + 1);
    } else {
      username = creds;
    }
    notes.push("Credentials detected — verify the proxy is reachable over an encrypted channel.");
  }

  // Now rest is host:port (host may be [::1])
  let host = "";
  let portStr = "";
  if (rest.startsWith("[")) {
    const close = rest.indexOf("]");
    if (close < 0) return emptyVerification(raw, false, ["Malformed IPv6 literal — missing closing bracket."]);
    host = rest.slice(0, close + 1);
    portStr = rest.slice(close + 1);
  } else {
    const colonIdx = rest.lastIndexOf(":");
    if (colonIdx < 0) return emptyVerification(raw, false, ["Missing port (expected host:port)."]);
    host = rest.slice(0, colonIdx);
    portStr = rest.slice(colonIdx + 1);
  }

  if (portStr.startsWith(":")) portStr = portStr.slice(1);
  if (!/^\d+$/.test(portStr)) return emptyVerification(raw, false, ["Port must be numeric."]);
  const port = Number(portStr);
  if (port < 1 || port > 65535) return emptyVerification(raw, false, [`Port ${port} is out of range (1-65535).`]);

  const hostType = classifyHost(host);
  if (hostType === "invalid") warnings.push(`Host "${host}" does not look like a valid IPv4, IPv6, or hostname.`);

  const inferredProtocol = inferProtocol(port, protocol);
  const finalProtocol = protocol !== "unknown" ? protocol : inferredProtocol;
  if (finalProtocol === "unknown") {
    notes.push("Protocol unknown — specify scheme (http://, https://, socks4://, socks5://) or use a well-known port.");
  }

  const anonymity = inferAnonymity(finalProtocol, !!username);
  if (anonymity === "transparent") notes.push("HTTP proxies without auth on common ports often forward X-Forwarded-For — likely transparent.");
  if (anonymity === "elite") notes.push("SOCKS5 + credentials typically gives elite anonymity (no IP leakage).");

  return {
    raw,
    valid: hostType !== "invalid",
    host,
    port,
    username,
    password,
    protocol: finalProtocol,
    inferredProtocol,
    anonymity,
    hostType,
    warnings,
    notes,
  };
}

function inferAnonymity(protocol: ProxyProtocol, hasCreds: boolean): AnonymityLevel {
  if (protocol === "socks5") return hasCreds ? "elite" : "anonymous";
  if (protocol === "socks4") return "anonymous";
  if (protocol === "https") return hasCreds ? "elite" : "anonymous";
  if (protocol === "http") return hasCreds ? "anonymous" : "transparent";
  return "unknown";
}

function emptyVerification(raw: string, valid: boolean, warnings: string[]): ProxyVerification {
  return {
    raw,
    valid,
    host: "",
    port: null,
    protocol: "unknown",
    inferredProtocol: "unknown",
    anonymity: "unknown",
    hostType: "invalid",
    warnings,
    notes: [],
  };
}

/** Parse a multi-line list of proxies. */
export function parseBatch(input: string): ProxyVerification[] {
  return (input ?? "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map(parseProxy);
}

/** Provide a checklist the UI can render for runtime anonymity testing. */
export function anonymityChecklist(): { label: string; description: string }[] {
  return [
    { label: "X-Forwarded-For absent", description: "Make a request through the proxy to https://httpbin.org/headers and confirm 'X-Forwarded-For' is missing." },
    { label: "Via header absent", description: "Same test — the 'Via' header should also be absent for elite proxies." },
    { label: "Remote IP matches proxy", description: "Visit https://httpbin.org/ip — the returned origin should be the proxy's IP, not yours." },
    { label: "DNS leaks", description: "Use https://dnsleaktest.com through the proxy to ensure DNS queries do not leak via your real network." },
    { label: "WebRTC leaks", description: "Disable WebRTC in your browser or use an extension — proxies do not cover WebRTC." },
    { label: "HTTPS supported", description: "Confirm the proxy can tunnel CONNECT for HTTPS — transparent HTTP proxies cannot." },
  ];
}

/** Convert a verification to a CSV row. */
export function verificationToCsv(results: ProxyVerification[]): string {
  const lines = ["proxy,valid,host,port,protocol,anonymity,hostType"];
  for (const r of results) {
    lines.push(`"${r.raw.replace(/"/g, '""')}",${r.valid},${r.host},${r.port ?? ""},${r.protocol},${r.anonymity},${r.hostType}`);
  }
  return lines.join("\n");
}
