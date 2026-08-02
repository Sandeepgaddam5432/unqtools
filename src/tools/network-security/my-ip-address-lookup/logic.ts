/**
 * My IP Address Lookup — pure logic.
 * IP parsing, validation, and privacy analysis utilities.
 */

export interface IPInfo {
  ip: string;
  version: 4 | 6 | "unknown";
  isPrivate: boolean;
  isLoopback: boolean;
  isLinkLocal: boolean;
  isMulticast: boolean;
  isReserved: boolean;
  type: string;
  reverseDns?: string;
}

export interface GeoInfo {
  ip: string;
  city?: string;
  region?: string;
  country?: string;
  countryCode?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  isp?: string;
  asn?: string;
  org?: string;
  accuracyRadius?: number;
}

export interface PrivacyAnalysis {
  isProxy: boolean;
  isVpn: boolean;
  isTor: boolean;
  isHosting: boolean;
  riskScore: number; // 0-100
  signals: string[];
}

export function detectIPVersion(ip: string): 4 | 6 | "unknown" {
  if (!ip) return "unknown";
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) return 4;
  if (ip.includes(":")) return 6;
  return "unknown";
}

export function isValidIPv4(ip: string): boolean {
  const parts = ip.split(".");
  if (parts.length !== 4) return false;
  return parts.every((p) => {
    const n = parseInt(p, 10);
    return n >= 0 && n <= 255 && String(n) === p;
  });
}

export function isValidIPv6(ip: string): boolean {
  if (!ip.includes(":")) return false;
  try {
    const expanded = expandIPv6(ip);
    return expanded.split(":").length === 8;
  } catch {
    return false;
  }
}

export function expandIPv6(ip: string): string {
  if (!ip.includes("::")) {
    const parts = ip.split(":");
    if (parts.length !== 8) throw new Error("Invalid IPv6");
    return parts.map((p) => p.padStart(4, "0")).join(":");
  }
  const [head, tail] = ip.split("::");
  const headParts = head ? head.split(":") : [];
  const tailParts = tail ? tail.split(":") : [];
  const missing = 8 - headParts.length - tailParts.length;
  const parts = [...headParts, ...Array(missing).fill("0000"), ...tailParts];
  return parts.map((p) => p.padStart(4, "0")).join(":");
}

export function getIPType(ip: string): string {
  const version = detectIPVersion(ip);
  if (version === 4) {
    const parts = ip.split(".").map(Number);
    const n = (parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3];
    if ((n & 0xff000000) === 0x7f000000) return "loopback";
    if ((n & 0xff000000) === 0x0a000000) return "private";
    if ((n & 0xfff00000) === 0xac100000) return "private";
    if ((n & 0xffff0000) === 0xc0a80000) return "private";
    if ((n & 0xffff0000) === 0xa9fe0000) return "link-local";
    if ((n & 0xf0000000) === 0xe0000000) return "multicast";
    if ((n & 0xf0000000) === 0xf0000000) return "reserved";
    return "public";
  }
  if (version === 6) {
    if (ip === "::1") return "loopback";
    if (ip.startsWith("fe80")) return "link-local";
    if (ip.startsWith("fc") || ip.startsWith("fd")) return "unique-local";
    if (ip.startsWith("ff")) return "multicast";
    return "public";
  }
  return "unknown";
}

export function analyzeIP(ip: string): IPInfo {
  const version = detectIPVersion(ip);
  const type = getIPType(ip);
  return {
    ip,
    version,
    isPrivate: type === "private" || type === "unique-local",
    isLoopback: type === "loopback",
    isLinkLocal: type === "link-local",
    isMulticast: type === "multicast",
    isReserved: type === "reserved",
    type,
  };
}

export function getReverseDns(ip: string): string {
  const version = detectIPVersion(ip);
  if (version === 4) {
    return ip.split(".").reverse().join(".") + ".in-addr.arpa";
  }
  if (version === 6) {
    try {
      const expanded = expandIPv6(ip);
      return expanded.replace(/:/g, "").split("").reverse().join(".") + ".ip6.arpa";
    } catch {
      return "";
    }
  }
  return "";
}

export function analyzePrivacy(ipInfo: IPInfo, geo?: GeoInfo): PrivacyAnalysis {
  const signals: string[] = [];
  let riskScore = 0;
  let isProxy = false, isVpn = false, isTor = false, isHosting = false;

  if (ipInfo.isPrivate) { signals.push("Private IP address"); riskScore += 10; }
  if (ipInfo.isLoopback) { signals.push("Loopback address (localhost)"); riskScore += 5; }

  if (geo?.asn) {
    const asn = geo.asn.toLowerCase();
    if (asn.includes("hosting") || asn.includes("datacenter") || asn.includes("cloud")) {
      isHosting = true;
      signals.push("Hosting/datacenter ASN detected");
      riskScore += 30;
    }
    if (asn.includes("vpn") || asn.includes("proxy")) {
      isVpn = true;
      signals.push("VPN/proxy provider ASN detected");
      riskScore += 40;
    }
    if (asn.includes("tor")) {
      isTor = true;
      signals.push("Tor exit node detected");
      riskScore += 50;
    }
  }

  if (geo?.org) {
    const org = geo.org.toLowerCase();
    if (org.includes("amazon") || org.includes("google") || org.includes("microsoft") || org.includes("digitalocean")) {
      isHosting = true;
      signals.push(`Hosting provider: ${geo.org}`);
      riskScore += 25;
    }
  }

  riskScore = Math.min(100, riskScore);
  return { isProxy, isVpn, isTor, isHosting, riskScore, signals };
}

export function getPrivacyExposure(ipInfo: IPInfo, geo?: GeoInfo): { field: string; value: string; exposure: string }[] {
  const items: { field: string; value: string; exposure: string }[] = [];
  items.push({ field: "IP Address", value: ipInfo.ip, exposure: "Your unique identifier on the internet. Websites use this to track you." });
  if (geo?.city) items.push({ field: "City", value: geo.city, exposure: "Approximate location (within ~50km). Not precise to your address." });
  if (geo?.region) items.push({ field: "Region", value: geo.region, exposure: "State/province level location." });
  if (geo?.country) items.push({ field: "Country", value: geo.country, exposure: "Country-level location — generally accurate." });
  if (geo?.isp) items.push({ field: "ISP", value: geo.isp, exposure: "Your internet service provider. Can be used to identify your subscription." });
  if (geo?.asn) items.push({ field: "ASN", value: geo.asn, exposure: "Autonomous System Number — identifies your network provider." });
  if (geo?.timezone) items.push({ field: "Timezone", value: geo.timezone, exposure: "Your timezone can narrow down your location." });
  return items;
}

export function exportJSON(ipInfo: IPInfo, geo?: GeoInfo, privacy?: PrivacyAnalysis): string {
  return JSON.stringify({ ipInfo, geo, privacy }, null, 2);
}

export function exportCurl(ip: string): string {
  return `curl -s https://ipinfo.io/${ip}/json`;
}

export function getMyIPAddress(): string {
  if (typeof navigator === "undefined") return "";
  // WebRTC can sometimes reveal local IPs, but public IP requires a network request.
  // This is a placeholder — the UI will make a fetch to a privacy-friendly endpoint.
  return "";
}

export function detectWebRTCLeak(): Promise<string[]> {
  return new Promise((resolve) => {
    if (typeof RTCPeerConnection === "undefined") {
      resolve([]);
      return;
    }
    const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
    const ips: string[] = [];
    pc.createDataChannel("");
    pc.onicecandidate = (event) => {
      if (!event.candidate) {
        pc.close();
        resolve([...new Set(ips)]);
        return;
      }
      const ipMatch = event.candidate.candidate.match(/(\d+\.\d+\.\d+\.\d+|[0-9a-f]+:[0-9a-f]+:[0-9a-f]+:[0-9a-f]+)/i);
      if (ipMatch) ips.push(ipMatch[1]);
    };
    pc.createOffer()
      .then((offer) => pc.setLocalDescription(offer))
      .catch(() => resolve([]));
    setTimeout(() => { pc.close(); resolve([...new Set(ips)]); }, 3000);
  });
}

// ============================================================================
// Backward-compat stub exports (added to satisfy UI template imports).
// ============================================================================

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export function getStats(input: string, output: string): {
  inputSize: number;
  outputSize: number;
} {
  return {
    inputSize: new Blob([input]).size,
    outputSize: new Blob([output]).size,
  };
}

export function validate(input: string): string[] {
  const issues: string[] = [];
  if (!input || input.trim().length === 0) {
    issues.push("Input is empty.");
  }
  return issues;
}

export function process(input: string): { output: string; error: string | null } {
  try {
    const result = analyzeIP(input);
    if (typeof result === "string") {
      return { output: result, error: null };
    }
    if (result && typeof result === "object") {
      const r = result as Record<string, unknown>;
      const output =
        (typeof r.output === "string" && r.output) ||
        (typeof r.html === "string" && r.html) ||
        (typeof r.result === "string" && r.result) ||
        (typeof r.text === "string" && r.text) ||
        (typeof r.code === "string" && r.code) ||
        (typeof r.value === "string" && r.value) ||
        JSON.stringify(result, null, 2);
      const error =
        (typeof r.error === "string" && r.error) ||
        (r.ok === false && typeof r.message === "string" && r.message) ||
        null;
      return { output, error };
    }
    return { output: String(result), error: null };
  } catch (e) {
    return { output: "", error: (e as Error).message };
  }
}
