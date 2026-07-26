/**
 * CIDR IP Calculator — pure logic.
 * IPv4 + IPv6 CIDR calculations.
 */

export interface CidrResult {
  input: string;
  version: 4 | 6;
  network: string;
  broadcast: string;
  firstHost: string;
  lastHost: string;
  hostCount: number;
  prefix: number;
  subnetMask?: string; // IPv4 only
  wildcard?: string; // IPv4 only
  ipType: string; // private, loopback, multicast, reserved, link-local, public
  isPrivate: boolean;
  isLoopback: boolean;
  isMulticast: boolean;
  isLinkLocal: boolean;
  isReserved: boolean;
  ptr?: string; // reverse DNS
  error?: string;
}

// === IPv4 helpers ===
function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let result = 0;
  for (const part of parts) {
    const n = parseInt(part, 10);
    if (isNaN(n) || n < 0 || n > 255) return null;
    result = (result << 8) | n;
  }
  return result >>> 0; // force unsigned
}

function intToIpv4(n: number): string {
  return [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff].join(".");
}

function ipv4PrefixToMask(prefix: number): number {
  if (prefix === 0) return 0;
  return (0xffffffff << (32 - prefix)) >>> 0;
}

function getIpType(ip: string): string {
  const n = ipv4ToInt(ip);
  if (n === null) return "unknown";
  // Use unsigned comparisons via >>> 0 on each mask
  // Loopback 127.0.0.0/8
  if ((n & 0xff000000) >>> 0 === 0x7f000000) return "loopback";
  // Private 10.0.0.0/8
  if ((n & 0xff000000) >>> 0 === 0x0a000000) return "private";
  // Private 172.16.0.0/12
  if ((n & 0xfff00000) >>> 0 === 0xac100000) return "private";
  // Private 192.168.0.0/16
  if ((n & 0xffff0000) >>> 0 === 0xc0a80000) return "private";
  // Link-local 169.254.0.0/16
  if ((n & 0xffff0000) >>> 0 === 0xa9fe0000) return "link-local";
  // Multicast 224.0.0.0/4
  if ((n & 0xf0000000) >>> 0 === 0xe0000000) return "multicast";
  // Reserved 240.0.0.0/4
  if ((n & 0xf0000000) >>> 0 === 0xf0000000) return "reserved";
  // 0.0.0.0/8
  if ((n & 0xff000000) >>> 0 === 0) return "reserved";
  return "public";
}

export function getPtr(ip: string, version: 4 | 6): string {
  if (version === 4) {
    const parts = ip.split(".").reverse();
    return `${parts.join(".")}.in-addr.arpa`;
  }
  // IPv6
  const hex = ip.replace(/:/g, "").padStart(32, "0");
  return hex.split("").reverse().join(".") + ".ip6.arpa";
}

// === IPv6 helpers ===
function expandIpv6(ip: string): string | null {
  if (!ip.includes(":")) return null;
  // Handle :: expansion
  let parts: string[];
  if (ip.includes("::")) {
    const [head, tail] = ip.split("::");
    const headParts = head ? head.split(":") : [];
    const tailParts = tail ? tail.split(":") : [];
    const missing = 8 - headParts.length - tailParts.length;
    parts = [...headParts, ...Array(missing).fill("0"), ...tailParts];
  } else {
    parts = ip.split(":");
  }
  if (parts.length !== 8) return null;
  return parts.map((p) => p.padStart(4, "0").toLowerCase()).join(":");
}

function ipv6ToBigInt(ip: string): bigint | null {
  const expanded = expandIpv6(ip);
  if (!expanded) return null;
  const hex = expanded.replace(/:/g, "");
  try {
    return BigInt("0x" + hex);
  } catch {
    return null;
  }
}

function bigIntToIpv6(n: bigint): string {
  const hex = n.toString(16).padStart(32, "0");
  const parts: string[] = [];
  for (let i = 0; i < 32; i += 4) {
    parts.push(hex.slice(i, i + 4));
  }
  return parts.join(":");
}

function compressIpv6(ip: string): string {
  // Find longest run of zero groups
  const parts = ip.split(":");
  let bestStart = -1;
  let bestLen = 0;
  let curStart = -1;
  let curLen = 0;
  for (let i = 0; i < parts.length; i++) {
    if (parts[i] === "0000") {
      if (curStart === -1) curStart = i;
      curLen++;
      if (curLen > bestLen) {
        bestLen = curLen;
        bestStart = curStart;
      }
    } else {
      curStart = -1;
      curLen = 0;
    }
  }
  // Strip leading zeros from each part
  const stripped = parts.map((p) => p.replace(/^0+/, "") || "0");
  if (bestLen < 2) {
    return stripped.join(":");
  }
  const before = stripped.slice(0, bestStart);
  const after = stripped.slice(bestStart + bestLen);
  // Special case: all-zero groups go to the end → trailing ::
  if (after.length === 0) {
    return before.length > 0 ? before.join(":") + "::" : "::";
  }
  // Special case: all-zero groups at the start → leading ::
  if (before.length === 0) {
    return "::" + after.join(":");
  }
  return before.join(":") + "::" + after.join(":");
}

function ipv6PrefixToBigIntMask(prefix: number): bigint {
  if (prefix === 0) return 0n;
  const allOnes = (1n << 128n) - 1n;
  return allOnes << BigInt(128 - prefix) & allOnes;
}

function getIpv6Type(ip: string): string {
  const expanded = expandIpv6(ip);
  if (!expanded) return "unknown";
  if (expanded === "0000:0000:0000:0000:0000:0000:0000:0001") return "loopback";
  if (/^fe80:/.test(expanded)) return "link-local";
  if (/^fc00:/.test(expanded) || /^fd00:/.test(expanded)) return "unique-local";
  if (/^ff00:/.test(expanded)) return "multicast";
  // 2001:db8::/32 — documentation prefix (expanded form has 2001:0db8:)
  if (/^2001:0?db8:/.test(expanded)) return "documentation";
  if (/^0000:0000:0000:0000:0000:ffff:/.test(expanded)) return "ipv4-mapped";
  return "public";
}

// === Main CIDR calculation ===
export function calculateCidr(input: string): CidrResult {
  const trimmed = input.trim();
  const [ip, prefixStr] = trimmed.split("/");

  if (!ip || !prefixStr) {
    return { input: trimmed, version: 4, network: "", broadcast: "", firstHost: "", lastHost: "", hostCount: 0, prefix: 0, ipType: "invalid", isPrivate: false, isLoopback: false, isMulticast: false, isLinkLocal: false, isReserved: true, error: "Invalid CIDR format. Use IP/prefix e.g. 192.168.1.0/24" };
  }

  const prefix = parseInt(prefixStr, 10);

  // Detect IPv4 vs IPv6
  const isIpv6 = ip.includes(":");

  if (isIpv6) {
    return calculateIpv6Cidr(ip, prefix);
  }
  return calculateIpv4Cidr(ip, prefix);
}

function calculateIpv4Cidr(ip: string, prefix: number): CidrResult {
  if (prefix < 0 || prefix > 32) {
    return { input: `${ip}/${prefix}`, version: 4, network: "", broadcast: "", firstHost: "", lastHost: "", hostCount: 0, prefix, ipType: "invalid", isPrivate: false, isLoopback: false, isMulticast: false, isLinkLocal: false, isReserved: true, error: `Invalid prefix /${prefix}. IPv4 prefix must be 0-32.` };
  }

  const ipInt = ipv4ToInt(ip);
  if (ipInt === null) {
    return { input: `${ip}/${prefix}`, version: 4, network: "", broadcast: "", firstHost: "", lastHost: "", hostCount: 0, prefix, ipType: "invalid", isPrivate: false, isLoopback: false, isMulticast: false, isLinkLocal: false, isReserved: true, error: "Invalid IPv4 address." };
  }

  const mask = ipv4PrefixToMask(prefix);
  const network = ipInt & mask;
  const broadcast = network | (~mask >>> 0);
  const firstHost = prefix === 32 ? network : prefix === 31 ? network : network + 1;
  const lastHost = prefix === 32 ? network : prefix === 31 ? broadcast : broadcast - 1;
  const hostCount = prefix >= 31 ? (prefix === 32 ? 1 : 2) : Math.pow(2, 32 - prefix) - 2;

  const ipType = getIpType(ip);
  const subnetMaskStr = intToIpv4(mask);
  const wildcardStr = intToIpv4(~mask >>> 0);

  return {
    input: `${ip}/${prefix}`,
    version: 4,
    network: intToIpv4(network),
    broadcast: intToIpv4(broadcast),
    firstHost: intToIpv4(firstHost),
    lastHost: intToIpv4(lastHost),
    hostCount,
    prefix,
    subnetMask: subnetMaskStr,
    wildcard: wildcardStr,
    ipType,
    isPrivate: ipType === "private",
    isLoopback: ipType === "loopback",
    isMulticast: ipType === "multicast",
    isLinkLocal: ipType === "link-local",
    isReserved: ipType === "reserved",
    ptr: getPtr(intToIpv4(network), 4),
  };
}

function calculateIpv6Cidr(ip: string, prefix: number): CidrResult {
  if (prefix < 0 || prefix > 128) {
    return { input: `${ip}/${prefix}`, version: 6, network: "", broadcast: "", firstHost: "", lastHost: "", hostCount: 0, prefix, ipType: "invalid", isPrivate: false, isLoopback: false, isMulticast: false, isLinkLocal: false, isReserved: true, error: `Invalid prefix /${prefix}. IPv6 prefix must be 0-128.` };
  }

  const ipBig = ipv6ToBigInt(ip);
  if (ipBig === null) {
    return { input: `${ip}/${prefix}`, version: 6, network: "", broadcast: "", firstHost: "", lastHost: "", hostCount: 0, prefix, ipType: "invalid", isPrivate: false, isLoopback: false, isMulticast: false, isLinkLocal: false, isReserved: true, error: "Invalid IPv6 address." };
  }

  const mask = ipv6PrefixToBigIntMask(prefix);
  const network = ipBig & mask;
  const ipType = getIpv6Type(ip);
  // IPv6 has no broadcast; first host = network, last = network | ~mask
  const lastHost = network | (~mask & ((1n << 128n) - 1n));
  // Host count: 2^(128-prefix), but if prefix >= 127, special case
  let hostCount: number;
  if (prefix >= 127) {
    hostCount = prefix === 128 ? 1 : 2;
  } else {
    const bits = 128 - prefix;
    hostCount = bits > 53 ? Number.MAX_SAFE_INTEGER : Math.pow(2, bits);
  }

  return {
    input: `${ip}/${prefix}`,
    version: 6,
    network: compressIpv6(bigIntToIpv6(network)),
    broadcast: "(none for IPv6)",
    firstHost: compressIpv6(bigIntToIpv6(network)),
    lastHost: compressIpv6(bigIntToIpv6(lastHost)),
    hostCount,
    prefix,
    ipType,
    isPrivate: ipType === "unique-local",
    isLoopback: ipType === "loopback",
    isMulticast: ipType === "multicast",
    isLinkLocal: ipType === "link-local",
    isReserved: ipType === "documentation",
    ptr: getPtr(compressIpv6(bigIntToIpv6(network)), 6),
  };
}

export function splitSubnet(input: string, newPrefix: number): CidrResult[] {
  const parent = calculateCidr(input);
  if (parent.error) return [];
  if (newPrefix <= parent.prefix) return [];

  const results: CidrResult[] = [];
  if (parent.version === 4) {
    const netInt = ipv4ToInt(parent.network);
    if (netInt === null) return [];
    const count = Math.pow(2, newPrefix - parent.prefix);
    const step = Math.pow(2, 32 - newPrefix);
    for (let i = 0; i < count && i < 1000; i++) {
      results.push(calculateIpv4Cidr(intToIpv4(netInt + i * step), newPrefix));
    }
  } else {
    const netBig = ipv6ToBigInt(parent.network);
    if (netBig === null) return [];
    const count = 1 << (newPrefix - parent.prefix);
    const step = 1n << BigInt(128 - newPrefix);
    for (let i = 0; i < count && i < 1000; i++) {
      results.push(calculateIpv6Cidr(compressIpv6(bigIntToIpv6(netBig + BigInt(i) * step)), newPrefix));
    }
  }
  return results;
}

export function isValidCidr(input: string): boolean {
  return !calculateCidr(input).error;
}
