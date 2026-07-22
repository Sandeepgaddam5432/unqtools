/**
 * Traceroute Visualizer — pure logic.
 *
 * Generates traceroute / tracert / mtr commands for Windows / Linux /
 * macOS, parses pasted output from any of those formats into a
 * structured hop list, computes per-hop stats and a path analysis,
 * detects private/IPv6/timeout hops, and renders the result as a text
 * table, ASCII latency graph, CSV or JSON. Pure functions only — no
 * DOM, no network.
 */

// ---- OS + options ----

export type OS = "windows" | "linux" | "macos";

export interface TracerouteOptions {
  /** Maximum number of hops. */
  maxHops: number;
  /** Per-probe timeout, in milliseconds. */
  timeoutMs: number;
  /** Number of probes per hop. */
  queriesPerHop: number;
  /** Resolve IPs to hostnames (default true). Set false for -n / -d. */
  resolveHostnames: boolean;
  /** Force IPv4. */
  ipv4: boolean;
  /** Force IPv6. */
  ipv6: boolean;
}

export const DEFAULT_OPTIONS: TracerouteOptions = {
  maxHops: 30,
  timeoutMs: 3000,
  queriesPerHop: 3,
  resolveHostnames: true,
  ipv4: false,
  ipv6: false,
};

export const OS_LABELS: Record<OS, string> = {
  windows: "Windows (tracert.exe)",
  linux: "Linux (traceroute / tracepath)",
  macos: "macOS (traceroute)",
};

// ---- Command generator ----

/**
 * Generate a traceroute command for the given OS.
 * - Windows: `tracert -d -h <max> -w <ms> -4 / -6 <host>`
 * - Linux/macOS: `traceroute -n -m <max> -w <sec> -q <n> -4 / -6 <host>`
 */
export function generateTracerouteCommand(
  host: string,
  os: OS,
  options: TracerouteOptions = DEFAULT_OPTIONS,
): string {
  const h = (host || "").trim();
  if (!h) return "";
  const o = { ...DEFAULT_OPTIONS, ...options };
  if (os === "windows") {
    const parts: string[] = ["tracert"];
    parts.push("-h", String(Math.max(1, Math.floor(o.maxHops))));
    parts.push("-w", String(Math.max(1, Math.floor(o.timeoutMs))));
    if (!o.resolveHostnames) parts.push("-d");
    if (o.ipv4) parts.push("-4");
    if (o.ipv6) parts.push("-6");
    parts.push(h);
    return parts.join(" ");
  }
  // Linux + macOS share the same flag set; -w is seconds on both.
  const parts: string[] = ["traceroute"];
  parts.push("-m", String(Math.max(1, Math.floor(o.maxHops))));
  parts.push("-w", String(Math.max(1, Math.ceil(o.timeoutMs / 1000))));
  parts.push("-q", String(Math.max(1, Math.floor(o.queriesPerHop))));
  if (!o.resolveHostnames) parts.push("-n");
  if (o.ipv4) parts.push("-4");
  if (o.ipv6) parts.push("-6");
  parts.push(h);
  return parts.join(" ");
}

/** Generate traceroute commands for all three OSes. */
export function generateTracerouteCommands(
  host: string,
  options: TracerouteOptions = DEFAULT_OPTIONS,
): Record<OS, string> {
  return {
    windows: generateTracerouteCommand(host, "windows", options),
    linux: generateTracerouteCommand(host, "linux", options),
    macos: generateTracerouteCommand(host, "macos", options),
  };
}

/**
 * Generate an `mtr` command. mtr combines traceroute + ping in real time.
 * Flags: `-n` no-resolve, `-c <count>` report count, `-r` report mode,
 * `-w` wide, `-4` / `-6` IP version.
 */
export function generateMtrCommand(
  host: string,
  options: { count?: number; resolveHostnames?: boolean; ipv4?: boolean; ipv6?: boolean; wide?: boolean } = {},
): string {
  const h = (host || "").trim();
  if (!h) return "";
  const o = { count: 10, resolveHostnames: true, wide: true, ...options };
  const parts: string[] = ["mtr"];
  parts.push("--report");
  parts.push("--report-cycles", String(Math.max(1, Math.floor(o.count))));
  if (o.wide) parts.push("--wide");
  if (!o.resolveHostnames) parts.push("--no-dns");
  if (o.ipv4) parts.push("-4");
  if (o.ipv6) parts.push("-6");
  parts.push(h);
  return parts.join(" ");
}

// ---- Hop model ----

export interface Hop {
  /** Hop number, 1-indexed. */
  hop: number;
  /** IP address, or empty string for a timeout hop. */
  ip: string;
  /** Hostname (resolved), or empty string if not resolved. */
  hostname: string;
  /** Per-probe RTTs in milliseconds. `null` means timeout for that probe. */
  rtts: (number | null)[];
  /** True if every probe timed out (* * *). */
  timeout: boolean;
  /** Optional AS info (e.g. "AS15169") if present in the source. */
  asInfo?: string;
  /** Optional MPLS labels if present in the source. */
  mpls?: string[];
}

export interface TracerouteResult {
  /** Parsed hops. */
  hops: Hop[];
  /** Source format that was detected. */
  format: TraceFormat;
  /** Target host (best-effort extraction from header line). */
  host: string;
  /** Raw input (trimmed). */
  raw: string;
}

export type TraceFormat = "windows" | "linux" | "mtr" | "unknown";

// ---- Format detection ----

export function detectFormat(text: string): TraceFormat {
  const t = (text || "").trim();
  if (!t) return "unknown";
  // MTR header: "HOST: hostname" or "Start: ..." or contains "Loss%" + "Snt"
  if (/HOST:\s/i.test(t) && /Loss%/i.test(t)) return "mtr";
  if (/^Start:\s/m.test(t) && /Loss%/i.test(t)) return "mtr";
  // Windows tracert header: "Tracing route to host [ip]" or "over a maximum of N hops"
  if (/Tracing route to/i.test(t) || /over a maximum of \d+ hops/i.test(t)) return "windows";
  if (/^\s*\d+\s+[<\d]/m.test(t) && /\[/m.test(t) && /ms\s+\[/m.test(t)) return "windows";
  // Linux/macOS traceroute header: "traceroute to host (ip), 30 hops max"
  if (/^traceroute to\s/im.test(t)) return "linux";
  // Heuristic: a line that starts with a number and has `(ip)` parens → linux
  if (/^\s*\d+\s+\S+\s+\(\S+\)\s+[\d*.]+\s*ms/m.test(t)) return "linux";
  // Windows-style line: "1    <1 ms    <1 ms    <1 ms  host [ip]"
  if (/^\s*\d+\s+<\d+\s*ms/m.test(t)) return "windows";
  if (/^\s*\d+\s+\d+\s*ms\s+\d+\s*ms\s+\d+\s*ms/m.test(t)) return "windows";
  // Final fallback: try a numeric-prefix line with `ms` → linux
  if (/^\s*\d+\s+.*ms/m.test(t)) return "linux";
  return "unknown";
}

// ---- Parsers ----

const IPV4_RE = /\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/;
const IPV6_RE = /\b([0-9a-fA-F]{1,4}(?::[0-9a-fA-F]{1,4}){2,7}(?::\/\d+)?)\b/;
const RTT_RE = /(\d+(?:\.\d+)?)\s*ms/i;
const LT_MS_RE = /<\s*(\d+)\s*ms/i;

/** Parse Windows `tracert` output. */
export function parseWindowsTracert(text: string): TracerouteResult {
  const hops: Hop[] = [];
  const lines = (text || "").split(/\r?\n/);
  let host = "";
  // Extract target host from "Tracing route to <host> [ip]" header.
  const header = lines.find((l) => /Tracing route to/i.test(l));
  if (header) {
    const m = header.match(/Tracing route to\s+(\S+)/i);
    if (m) host = m[1];
  }
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    // Match hop line: starts with a number.
    const m = trimmed.match(/^(\d+)\s+(.*)$/);
    if (!m) continue;
    const hopNum = Number.parseInt(m[1], 10);
    if (Number.isNaN(hopNum)) continue;
    const rest = m[2];

    // Extract all RTTs left-to-right: `<N ms`, `N ms`, or `*`.
    const rtts: (number | null)[] = [];
    let cursor = 0;
    while (cursor < rest.length) {
      const ltM = rest.slice(cursor).match(LT_MS_RE);
      const rttM = rest.slice(cursor).match(RTT_RE);
      const starIdx = rest.indexOf("*", cursor);
      const ltIdx = ltM ? (ltM.index ?? -1) : -1;
      const rttIdx = rttM ? (rttM.index ?? -1) : -1;
      if (ltM && (rttM === null || ltIdx <= rttIdx)) {
        rtts.push(0); // <1 ms → treat as 0
        cursor += ltIdx + ltM[0].length;
      } else if (rttM) {
        rtts.push(Number.parseFloat(rttM[1]));
        cursor += rttIdx + rttM[0].length;
      } else if (starIdx >= 0) {
        rtts.push(null);
        cursor = starIdx + 1;
      } else {
        break;
      }
      if (rtts.length > 16) break; // sanity
    }

    // Strip all RTT tokens from `rest` to get the host info tail.
    let hostInfo = rest
      .replace(/<\s*\d+\s*ms/gi, "")
      .replace(/\d+(?:\.\d+)?\s*ms/gi, "")
      .replace(/\*/g, "")
      .trim();

    let ip = "";
    let hostname = "";
    // Timeout line: "Request timed out." or empty after strip.
    if (/timed out/i.test(hostInfo) || hostInfo === "") {
      // timeout hop.
    } else {
      // Bracketed form: "hostname [ip]".
      const ipBracket = hostInfo.match(/\[(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}|[0-9a-fA-F:]+)\]/);
      if (ipBracket) {
        ip = ipBracket[1];
        hostname = hostInfo.replace(/\s*\[[^\]]+\]\s*$/, "").trim();
      } else {
        // Bare IP or hostname. If it parses as IPv4/IPv6, treat as IP.
        const v4 = hostInfo.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
        if (v4) {
          ip = v4[1];
        } else if (/^[0-9a-fA-F:]+$/.test(hostInfo) && hostInfo.includes(":")) {
          ip = hostInfo;
        } else {
          hostname = hostInfo;
        }
      }
    }

    const timeout = rtts.length === 0 || rtts.every((r) => r === null);
    if (rtts.length === 0) {
      // Could be "Request timed out." with no stars.
      rtts.push(null, null, null);
    }
    hops.push({ hop: hopNum, ip, hostname, rtts, timeout });
  }
  return { hops, format: "windows", host, raw: (text || "").trim() };
}

/** Parse Linux/macOS `traceroute` output. */
export function parseLinuxTraceroute(text: string): TracerouteResult {
  const hops: Hop[] = [];
  const lines = (text || "").split(/\r?\n/);
  let host = "";
  const header = lines.find((l) => /^traceroute to\s/i.test(l));
  if (header) {
    const m = header.match(/^traceroute to\s+(\S+)/i);
    if (m) host = m[1];
  }
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/^traceroute to/i.test(trimmed)) continue;
    const m = trimmed.match(/^(\d+)\s+(.*)$/);
    if (!m) continue;
    const hopNum = Number.parseInt(m[1], 10);
    if (Number.isNaN(hopNum)) continue;
    const rest = m[2];
    // Handle the multi-path form: each "ip (hostname) rtt" group is a probe.
    // Handle the simple form: "hostname (ip) rtt rtt rtt" or "ip rtt rtt rtt".
    // Handle the timeout form: "* * *".
    // Tokenize by whitespace.
    const tokens = rest.split(/\s+/).filter(Boolean);

    // Pre-scan for an `[AS####]` annotation anywhere in the line.
    let asInfo: string | undefined;
    for (const tok of tokens) {
      const asM = tok.match(/^\[AS(\d+)\]$/i);
      if (asM) {
        asInfo = `AS${asM[1]}`;
        break;
      }
    }

    let ip = "";
    let hostname = "";
    const rtts: (number | null)[] = [];
    let i = 0;
    // Skip leading "*" tokens → timeouts.
    while (i < tokens.length && tokens[i] === "*") {
      rtts.push(null);
      i++;
    }
    if (i < tokens.length) {
      // First non-* token is hostname or IP (skip a leading [AS####] if present).
      if (/^\[AS\d+\]$/i.test(tokens[i])) i++;
      if (i < tokens.length) {
        const maybeHost = tokens[i];
        // If next token is `(ip)`, then maybeHost is hostname.
        if (i + 1 < tokens.length && /^\(/.test(tokens[i + 1])) {
          hostname = maybeHost;
          const ipM = tokens[i + 1].match(/^\(([^)]+)\)$/);
          if (ipM) ip = ipM[1];
          i += 2;
        } else {
          // maybeHost is an IP (with -n flag).
          ip = maybeHost;
          i++;
        }
      }
    }
    // Rest of the tokens are RTTs (number ms) or "*" or "(asn)" multi-path.
    let lastWasIp = false;
    while (i < tokens.length) {
      const tok = tokens[i];
      if (tok === "*") {
        rtts.push(null);
        lastWasIp = false;
        i++;
        continue;
      }
      const rttM = tok.match(/^(\d+(?:\.\d+)?)$/);
      if (rttM && i + 1 < tokens.length && tokens[i + 1] === "ms") {
        rtts.push(Number.parseFloat(rttM[1]));
        i += 2;
        lastWasIp = false;
        continue;
      }
      // Multi-path: a second hostname (ip) group embedded mid-line.
      if (/^\(/.test(tok) && lastWasIp) {
        i++;
        continue;
      }
      // Mid-line hostname (no parens) — set as multi-path IP-less hop.
      if (/^[\d.]+$/.test(tok) || /^[0-9a-fA-F:]+$/.test(tok)) {
        // Looks like another IP — multi-path probe.
        lastWasIp = true;
        i++;
        continue;
      }
      // Skip "ms" tokens we somehow didn't pair.
      if (tok === "ms") { i++; continue; }
      // Skip MPLS labels: "MPLS" or "L=..."
      if (/^MPLS\b/i.test(tok) || /^L=\d+/.test(tok)) {
        i++;
        continue;
      }
      // Unknown token — skip.
      i++;
    }
    const timeout = rtts.length === 0 || rtts.every((r) => r === null);
    if (rtts.length === 0) rtts.push(null, null, null);
    hops.push({ hop: hopNum, ip, hostname, rtts, timeout, asInfo });
  }
  return { hops, format: "linux", host, raw: (text || "").trim() };
}

/** Parse `mtr --report` text-table output. */
export function parseMtr(text: string): TracerouteResult {
  const hops: Hop[] = [];
  const lines = (text || "").split(/\r?\n/);
  let host = "";
  // MTR report header may contain "HOST: <hostname>" or a target line.
  const targetLine = lines.find((l) => /HOST:\s/i.test(l) || /^Start:/i.test(l));
  if (targetLine) {
    // Best-effort: not always present in older mtr.
    host = "";
  }
  // Columns: Hop | Hostname | Loss% | Snt | Last | Avg | Best | Wrst | StDev
  // Or wide form: Hop | Hostname (ip) | Loss% | ...
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    // Skip header lines.
    if (/^Hop\s/i.test(trimmed) || /^HOST:/i.test(trimmed) || /^Start:/i.test(trimmed)) continue;
    // Match: starts with a number, then hostname (possibly with IP).
    const m = trimmed.match(/^(\d+)[.\s]+(.+)$/);
    if (!m) continue;
    const hopNum = Number.parseInt(m[1], 10);
    if (Number.isNaN(hopNum)) continue;
    let rest = m[2];
    // Extract `hostname (ip)` or `???`.
    let ip = "";
    let hostname = "";
    if (/^\?\?\?/.test(rest)) {
      // Timeout hop.
      hostname = "???";
    } else {
      const hMatch = rest.match(/^([^\s(]+(?:\s*\([^)]+\))?)/);
      if (hMatch) {
        const h2 = hMatch[1].trim();
        const ipP = h2.match(/\(([^)]+)\)$/);
        if (ipP) {
          ip = ipP[1];
          hostname = h2.replace(/\s*\([^)]+\)\s*$/, "").trim();
        } else {
          hostname = h2;
        }
      }
    }
    // After hostname: "Loss% Snt Last Avg Best Wrst StDev" (7 numeric fields).
    rest = rest.replace(/^[^\s(]+(?:\s*\([^)]+\))?/, "").trim();
    const nums = rest.split(/\s+/).filter(Boolean).map(Number.parseFloat);
    const [lossPct, snt, last, avg, best, wrst, stdev] = nums;
    void snt; void best; void wrst; void stdev;
    const rtts: (number | null)[] = [];
    if (!Number.isNaN(avg)) rtts.push(avg);
    else if (!Number.isNaN(last)) rtts.push(last);
    const timeout = !Number.isNaN(lossPct) && lossPct >= 100;
    hops.push({
      hop: hopNum,
      ip,
      hostname,
      rtts: rtts.length > 0 ? rtts : (timeout ? [null, null, null] : [null]),
      timeout,
    });
  }
  return { hops, format: "mtr", host, raw: (text || "").trim() };
}

/** Auto-detect format and parse. */
export function parseAuto(text: string): TracerouteResult {
  const fmt = detectFormat(text);
  if (fmt === "windows") return parseWindowsTracert(text);
  if (fmt === "linux") return parseLinuxTraceroute(text);
  if (fmt === "mtr") return parseMtr(text);
  return { hops: [], format: "unknown", host: "", raw: (text || "").trim() };
}

// ---- Per-hop stats ----

export interface HopStats {
  hop: number;
  ip: string;
  hostname: string;
  /** Probes sent. */
  sent: number;
  /** Probes received (non-null). */
  recv: number;
  /** Loss percentage, 0–100. */
  lossPct: number;
  /** Min RTT in ms (null if no successful probes). */
  minMs: number | null;
  /** Max RTT in ms (null if no successful probes). */
  maxMs: number | null;
  /** Average RTT in ms (null if no successful probes). */
  avgMs: number | null;
  /** Standard deviation in ms (null if <2 successful probes). */
  stddevMs: number | null;
  /** True if every probe timed out. */
  timeout: boolean;
  /** True if the IP is RFC1918 / loopback / link-local / ULA. */
  isPrivate: boolean;
  /** True if the IP is IPv6. */
  isIpv6: boolean;
}

export function computeHopStats(hop: Hop): HopStats {
  const sent = hop.rtts.length;
  const received = hop.rtts.filter((r) => r !== null) as number[];
  const recv = received.length;
  const lossPct = sent === 0 ? 100 : ((sent - recv) / sent) * 100;
  if (recv === 0) {
    return {
      hop: hop.hop, ip: hop.ip, hostname: hop.hostname,
      sent, recv, lossPct, minMs: null, maxMs: null, avgMs: null, stddevMs: null,
      timeout: true, isPrivate: isPrivateIp(hop.ip), isIpv6: isIpv6(hop.ip),
    };
  }
  let min = received[0];
  let max = received[0];
  let sum = 0;
  for (const v of received) {
    if (v < min) min = v;
    if (v > max) max = v;
    sum += v;
  }
  const avg = sum / recv;
  let stddev = 0;
  if (recv >= 2) {
    let sq = 0;
    for (const v of received) sq += (v - avg) * (v - avg);
    stddev = Math.sqrt(sq / recv);
  }
  return {
    hop: hop.hop, ip: hop.ip, hostname: hop.hostname,
    sent, recv, lossPct, minMs: min, maxMs: max, avgMs: avg,
    stddevMs: recv >= 2 ? stddev : null,
    timeout: false,
    isPrivate: isPrivateIp(hop.ip),
    isIpv6: isIpv6(hop.ip),
  };
}

// ---- Path analysis ----

export interface PathAnalysis {
  /** Total number of hops. */
  hopCount: number;
  /** Hop number with the highest avg RTT. */
  slowestHop: number | null;
  /** Highest avg RTT across all hops, ms. */
  slowestRtt: number | null;
  /** Hop number where the biggest latency jump occurred (the hop, not the source). */
  biggestJumpHop: number | null;
  /** Biggest inter-hop latency jump, ms (positive number). */
  biggestJumpMs: number | null;
  /** Number of timeout hops. */
  timeouts: number;
  /** Percentage of timeout hops, 0–100. */
  timeoutPct: number;
  /** End-to-end latency = final-hop avg RTT, ms (null if no final hop). */
  endToEndMs: number | null;
}

export function analyzePath(hops: Hop[]): PathAnalysis {
  const hopCount = hops.length;
  if (hopCount === 0) {
    return {
      hopCount: 0, slowestHop: null, slowestRtt: null,
      biggestJumpHop: null, biggestJumpMs: null, timeouts: 0, timeoutPct: 0,
      endToEndMs: null,
    };
  }
  const stats = hops.map(computeHopStats);
  let timeouts = 0;
  let slowestHop: number | null = null;
  let slowestRtt: number = -Infinity;
  for (const s of stats) {
    if (s.timeout) timeouts++;
    if (s.avgMs !== null && s.avgMs > slowestRtt) {
      slowestRtt = s.avgMs;
      slowestHop = s.hop;
    }
  }
  // Biggest jump: max(avgMs[i] - avgMs[i-1]) for consecutive hops with avgMs.
  let biggestJumpHop: number | null = null;
  let biggestJumpMs: number = 0;
  let prevAvg: number | null = null;
  let prevHop: number | null = null;
  for (const s of stats) {
    if (s.avgMs !== null) {
      if (prevAvg !== null && prevHop !== null) {
        const jump = s.avgMs - prevAvg;
        if (jump > biggestJumpMs) {
          biggestJumpMs = jump;
          biggestJumpHop = s.hop;
        }
      }
      prevAvg = s.avgMs;
      prevHop = s.hop;
    }
  }
  // End-to-end: final hop with a non-null avg.
  let endToEndMs: number | null = null;
  for (let i = stats.length - 1; i >= 0; i--) {
    if (stats[i].avgMs !== null) {
      endToEndMs = stats[i].avgMs;
      break;
    }
  }
  return {
    hopCount,
    slowestHop: slowestRtt === -Infinity ? null : slowestHop,
    slowestRtt: slowestRtt === -Infinity ? null : slowestRtt,
    biggestJumpHop: biggestJumpMs > 0 ? biggestJumpHop : null,
    biggestJumpMs: biggestJumpMs > 0 ? biggestJumpMs : null,
    timeouts,
    timeoutPct: (timeouts / hopCount) * 100,
    endToEndMs,
  };
}

// ---- IP classification ----

export type IpClass =
  | "private"
  | "loopback"
  | "link-local"
  | "multicast"
  | "ipv6-ula"
  | "ipv6-link-local"
  | "ipv6-loopback"
  | "ipv6-multicast"
  | "public"
  | "ipv6-public"
  | "invalid"
  | "empty";

export function classifyIp(ip: string): IpClass {
  const s = (ip || "").trim();
  if (!s) return "empty";
  // IPv6?
  if (s.includes(":")) {
    const lower = s.toLowerCase();
    if (lower === "::1") return "ipv6-loopback";
    if (lower.startsWith("fe80:")) return "ipv6-link-local";
    if (lower.startsWith("ff00:") || lower.startsWith("ff02:") || lower.startsWith("ff0")) return "ipv6-multicast";
    if (lower.startsWith("fc") || lower.startsWith("fd")) return "ipv6-ula";
    if (isIpv6(s)) return "ipv6-public";
    return "invalid";
  }
  // IPv4 dotted-decimal.
  const m = s.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return "invalid";
  const oct = [m[1], m[2], m[3], m[4]].map(Number);
  if (oct.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return "invalid";
  const [a, b] = oct;
  if (a === 127) return "loopback";
  if (a === 10) return "private";
  if (a === 172 && b >= 16 && b <= 31) return "private";
  if (a === 192 && b === 168) return "private";
  if (a === 169 && b === 254) return "link-local";
  if (a >= 224 && a <= 239) return "multicast";
  return "public";
}

export function isPrivateIp(ip: string): boolean {
  const c = classifyIp(ip);
  return c === "private" || c === "loopback" || c === "link-local" || c === "ipv6-ula" || c === "ipv6-loopback" || c === "ipv6-link-local";
}

export function isIpv6(ip: string): boolean {
  const s = (ip || "").trim();
  if (!s) return false;
  // Naive but effective: at least two colons and at least one hex group.
  return /:/.test(s) && /^[0-9a-fA-F:]+$/.test(s.replace(/\/\d+$/, "")) && (s.match(/:/g) || []).length >= 2;
}

export function isTimeoutHop(hop: Hop): boolean {
  return hop.timeout || hop.rtts.every((r) => r === null);
}

// ---- Host validation ----

export function validateHost(host: string): { ok: boolean; error?: string } {
  const h = (host || "").trim();
  if (!h) return { ok: false, error: "Host is empty" };
  // Reject anything with spaces (hostnames/IPv4/IPv6 don't have spaces).
  if (/\s/.test(h)) return { ok: false, error: "Host cannot contain spaces" };
  // IPv6 must be valid hex+colons.
  if (h.includes(":")) {
    if (!isIpv6(h)) return { ok: false, error: "Invalid IPv6 address" };
    return { ok: true };
  }
  // IPv4 must parse to 4 octets 0-255.
  const ipM = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipM) {
    const octs = [ipM[1], ipM[2], ipM[3], ipM[4]].map(Number);
    if (octs.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
      return { ok: false, error: "Invalid IPv4 octet" };
    }
    return { ok: true };
  }
  // Hostname: letters, digits, dots, hyphens. Allow trailing dot.
  if (!/^[a-zA-Z0-9]([a-zA-Z0-9.\-]*[a-zA-Z0-9])?\.?$/.test(h)) {
    return { ok: false, error: "Invalid hostname" };
  }
  return { ok: true };
}

export function normalizeHost(host: string): string {
  return (host || "").trim().toLowerCase();
}

// ---- Rendering ----

export function formatRtt(rtt: number | null): string {
  if (rtt === null) return "*";
  if (rtt < 1) return `${rtt.toFixed(3)}ms`;
  if (rtt < 100) return `${rtt.toFixed(2)}ms`;
  return `${Math.round(rtt)}ms`;
}

/** Render hops as a fixed-width text table. */
export function renderTable(hops: Hop[]): string {
  if (hops.length === 0) return "";
  const lines: string[] = [];
  lines.push("HOP  HOSTNAME                          IP                   RTTs");
  lines.push("───  ───────────────────────────────  ──────────────────  ─────────────");
  for (const h of hops) {
    const hop = String(h.hop).padStart(3);
    const hostname = (h.hostname || (h.timeout ? "* * *" : "")).slice(0, 33).padEnd(33);
    const ip = (h.ip || "").slice(0, 18).padEnd(18);
    const rtts = h.rtts.map((r) => r === null ? "*" : r < 1 ? r.toFixed(3) : r.toFixed(2)).join("  ");
    lines.push(`${hop}  ${hostname}  ${ip}  ${rtts}`);
  }
  return lines.join("\n");
}

/** Render a simple ASCII latency graph: hop number + bar scaled by avg RTT. */
export function renderGraph(hops: Hop[]): string {
  if (hops.length === 0) return "";
  const stats = hops.map(computeHopStats);
  const maxAvg = Math.max(1, ...stats.map((s) => s.avgMs ?? 0));
  const lines: string[] = [];
  lines.push("Hop  Avg RTT  Graph");
  lines.push("───  ───────  ──────────────────────────────────────");
  for (const s of stats) {
    const hop = String(s.hop).padStart(3);
    const avg = (s.avgMs === null ? "  *  " : `${s.avgMs.toFixed(1)}ms`.padStart(6)).padEnd(7);
    const bar = s.avgMs === null
      ? "✗"
      : "█".repeat(Math.max(1, Math.round((s.avgMs / maxAvg) * 40)));
    const flag = s.isPrivate ? " [private]" : s.isIpv6 ? " [ipv6]" : s.timeout ? " [timeout]" : "";
    lines.push(`${hop}  ${avg}  ${bar}${flag}`);
  }
  return lines.join("\n");
}

/** Render hops as CSV. */
export function renderCsv(hops: Hop[]): string {
  const lines = ["hop,ip,hostname,timeout,rtt1_ms,rtt2_ms,rtt3_ms,avg_ms,min_ms,max_ms,stddev_ms,is_private,is_ipv6"];
  for (const h of hops) {
    const s = computeHopStats(h);
    const rtts = [0, 1, 2].map((i) => h.rtts[i] === undefined || h.rtts[i] === null ? "" : h.rtts[i]);
    lines.push([
      h.hop,
      csvField(h.ip),
      csvField(h.hostname),
      h.timeout ? "1" : "0",
      rtts[0],
      rtts[1],
      rtts[2],
      s.avgMs?.toFixed(3) ?? "",
      s.minMs?.toFixed(3) ?? "",
      s.maxMs?.toFixed(3) ?? "",
      s.stddevMs?.toFixed(3) ?? "",
      s.isPrivate ? "1" : "0",
      s.isIpv6 ? "1" : "0",
    ].join(","));
  }
  return lines.join("\n");
}

function csvField(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Render hops as JSON. */
export function renderJson(hops: Hop[]): string {
  const out = hops.map((h) => {
    const s = computeHopStats(h);
    return {
      hop: h.hop,
      ip: h.ip,
      hostname: h.hostname,
      timeout: h.timeout,
      rtts: h.rtts,
      stats: {
        sent: s.sent, recv: s.recv, lossPct: Number(s.lossPct.toFixed(2)),
        minMs: s.minMs, maxMs: s.maxMs, avgMs: s.avgMs, stddevMs: s.stddevMs,
      },
      isPrivate: s.isPrivate, isIpv6: s.isIpv6,
      asInfo: h.asInfo ?? null,
    };
  });
  return JSON.stringify(out, null, 2);
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:traceroute-visualizer:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  host: string;
  format: TraceFormat;
  hopCount: number;
  slowestRtt: number | null;
  endToEndMs: number | null;
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

export interface ShareConfig {
  host: string;
  output: string;
}

export function buildShareUrl(cfg: ShareConfig): string {
  const params = new URLSearchParams();
  if (cfg.host) params.set("host", cfg.host);
  if (cfg.output) params.set("output", cfg.output);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareConfig {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { host: "", output: "" };
  const params = new URLSearchParams(clean);
  return {
    host: params.get("host") ?? "",
    output: params.get("output") ?? "",
  };
}

/** Make a stable id for new entries. */
export function makeId(): string {
  return `tr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
