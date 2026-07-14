/**
 * IP Subnet Calculator — pure logic (IPv4 only).
 *
 * All functions are pure and side-effect-free. Uses 32-bit unsigned math
 * via bitwise operators (works in JS because operands are coerced to Int32,
 * but we use >>> 0 to get back to Uint32).
 */

export interface SubnetResult {
  cidr: string;            // e.g. "192.168.1.0/24"
  ip: string;              // input IP, normalized
  prefix: number;          // 0-32
  mask: string;            // dotted-decimal subnet mask
  wildcard: string;        // inverted mask (host portion)
  network: string;         // network address
  broadcast: string;       // broadcast address
  firstHost: string;       // first usable host
  lastHost: string;        // last usable host
  totalHosts: number;      // 2^(32-prefix)
  usableHosts: number;     // totalHosts - 2 (or special /31, /32)
  ipClass: string;         // "A" | "B" | "C" | "Private" | "Loopback" etc.
  isPrivate: boolean;
  isValid: boolean;
  error?: string;
}

/** Convert dotted-decimal IP string to a 32-bit unsigned integer. Returns -1 on invalid. */
export function ipToInt(ip: string): number {
  if (typeof ip !== "string") return -1;
  const parts = ip.trim().split(".");
  if (parts.length !== 4) return -1;
  let result = 0;
  for (const part of parts) {
    if (!/^\d+$/.test(part)) return -1;
    const n = parseInt(part, 10);
    if (n < 0 || n > 255) return -1;
    result = (result * 256) + n;
  }
  // Convert to unsigned 32-bit
  return result >>> 0;
}

/** Convert a 32-bit unsigned integer to dotted-decimal string. */
export function intToIp(n: number): string {
  n = n >>> 0;
  return [
    (n >>> 24) & 0xff,
    (n >>> 16) & 0xff,
    (n >>> 8) & 0xff,
    n & 0xff,
  ].join(".");
}

/** Validate an IPv4 dotted-decimal string. */
export function isValidIp(ip: string): boolean {
  return ipToInt(ip) !== -1;
}

/** Convert a prefix length (0-32) to a 32-bit mask integer. */
export function prefixToMaskInt(prefix: number): number {
  if (prefix < 0 || prefix > 32) return -1;
  if (prefix === 0) return 0;
  // left-shift 1s into the top `prefix` bits
  return (0xffffffff << (32 - prefix)) >>> 0;
}

/** Convert a prefix length to dotted-decimal mask string. */
export function prefixToMask(prefix: number): string {
  const m = prefixToMaskInt(prefix);
  if (m === -1) return "";
  return intToIp(m);
}

/** Convert a dotted-decimal mask string to a prefix length. Returns -1 if invalid. */
export function maskToPrefix(mask: string): number {
  const m = ipToInt(mask);
  if (m === -1) return -1;
  // Valid masks are contiguous 1s followed by contiguous 0s
  // (0xffffffff - m + 1) should be a power of 2 for contiguous 1s
  // Actually: a valid mask has no zero bit followed by a one bit.
  // Trick: ~m + 1 (two's complement) AND ~m should equal itself for valid mask
  const inverted = (~m) >>> 0;
  // Check that inverted + 1 is a power of 2 (or inverted is 0 for /32)
  if (inverted === 0) return 32;
  const plus1 = (inverted + 1) >>> 0;
  if ((plus1 & inverted) !== 0) return -1; // not contiguous
  // popcount of m
  let count = 0;
  let x = m;
  while (x) {
    count += x & 1;
    x = x >>> 1;
  }
  return count;
}

/** Validate a prefix length (0-32). */
export function isValidPrefix(prefix: number): boolean {
  return Number.isInteger(prefix) && prefix >= 0 && prefix <= 32;
}

/** Detect the IP class (legacy A/B/C/D/E) for educational purposes. */
export function getIpClass(firstOctet: number): string {
  if (firstOctet >= 1 && firstOctet <= 126) return "A";
  if (firstOctet === 127) return "Loopback";
  if (firstOctet >= 128 && firstOctet <= 191) return "B";
  if (firstOctet >= 192 && firstOctet <= 223) return "C";
  if (firstOctet >= 224 && firstOctet <= 239) return "D (multicast)";
  if (firstOctet >= 240 && firstOctet <= 255) return "E (reserved)";
  return "Reserved";
}

/** Check if an IP is in a private range per RFC 1918. */
export function isPrivateIp(ip: string): boolean {
  const n = ipToInt(ip);
  if (n === -1) return false;
  // 10.0.0.0/8
  const range10 = (n >>> 24) === 10;
  // 172.16.0.0/12
  const range172 = (n >>> 24) === 172 && ((n >>> 16) & 0xff) >= 16 && ((n >>> 16) & 0xff) <= 31;
  // 192.168.0.0/16
  const range192 = (n >>> 24) === 192 && ((n >>> 16) & 0xff) === 168;
  return range10 || range172 || range192;
}

/** Parse input as either "ip/prefix" or "ip mask". Returns { ip, prefix } or { error }. */
export function parseInput(input: string): { ip?: string; prefix?: number; error?: string } {
  if (!input || typeof input !== "string") {
    return { error: "Input is empty." };
  }
  const trimmed = input.trim();

  // CIDR notation: ip/prefix
  if (trimmed.includes("/")) {
    const [ipPart, prefixPart] = trimmed.split("/");
    if (!ipPart || !prefixPart) return { error: "Invalid CIDR notation. Use ip/prefix (e.g. 192.168.1.0/24)." };
    if (!isValidIp(ipPart)) return { error: `Invalid IP address: "${ipPart}".` };
    const prefix = parseInt(prefixPart, 10);
    if (!isValidPrefix(prefix)) return { error: `Invalid prefix length: "${prefixPart}". Must be 0-32.` };
    return { ip: ipPart, prefix };
  }

  // Mask notation: ip mask (space-separated)
  const parts = trimmed.split(/\s+/);
  if (parts.length === 2) {
    const [ipPart, maskPart] = parts;
    if (!isValidIp(ipPart)) return { error: `Invalid IP address: "${ipPart}".` };
    if (!isValidIp(maskPart)) return { error: `Invalid subnet mask: "${maskPart}".` };
    const prefix = maskToPrefix(maskPart);
    if (prefix === -1) return { error: `Invalid subnet mask (not contiguous): "${maskPart}".` };
    return { ip: ipPart, prefix };
  }

  return { error: "Use format: 192.168.1.0/24 or 192.168.1.0 255.255.255.0" };
}

/** Calculate subnet details. Returns SubnetResult with isValid flag. */
export function calculateSubnet(input: string): SubnetResult {
  const parsed = parseInput(input);
  if (parsed.error || parsed.ip === undefined || parsed.prefix === undefined) {
    return {
      cidr: input,
      ip: input,
      prefix: -1,
      mask: "",
      wildcard: "",
      network: "",
      broadcast: "",
      firstHost: "",
      lastHost: "",
      totalHosts: 0,
      usableHosts: 0,
      ipClass: "",
      isPrivate: false,
      isValid: false,
      error: parsed.error ?? "Invalid input.",
    };
  }

  const ipInt = ipToInt(parsed.ip);
  const prefix = parsed.prefix;
  const maskInt = prefixToMaskInt(prefix);
  const wildcardInt = (~maskInt) >>> 0;
  const networkInt = (ipInt & maskInt) >>> 0;
  const broadcastInt = (networkInt | wildcardInt) >>> 0;

  const totalHosts = Math.pow(2, 32 - prefix);
  let usableHosts: number;
  let firstHost: string;
  let lastHost: string;
  if (prefix === 32) {
    usableHosts = 1;
    firstHost = intToIp(networkInt);
    lastHost = intToIp(networkInt);
  } else if (prefix === 31) {
    // RFC 3021 — point-to-point links, no broadcast
    usableHosts = 2;
    firstHost = intToIp(networkInt);
    lastHost = intToIp(broadcastInt);
  } else {
    usableHosts = totalHosts - 2;
    firstHost = intToIp(networkInt + 1);
    lastHost = intToIp(broadcastInt - 1);
  }

  const firstOctet = (ipInt >>> 24) & 0xff;

  return {
    cidr: `${intToIp(networkInt)}/${prefix}`,
    ip: intToIp(ipInt),
    prefix,
    mask: intToIp(maskInt),
    wildcard: intToIp(wildcardInt),
    network: intToIp(networkInt),
    broadcast: intToIp(broadcastInt),
    firstHost,
    lastHost,
    totalHosts,
    usableHosts,
    ipClass: getIpClass(firstOctet),
    isPrivate: isPrivateIp(parsed.ip),
    isValid: true,
  };
}

/** Format a host count with thousands separators. */
export function formatHosts(n: number): string {
  return n.toLocaleString("en-US");
}

// ===== IPv6 support (blueprint feature) =====

/** Convert IPv6 string to BigInt. Returns -1n on invalid. */
export function ipv6ToBigInt(ip: string): bigint {
  if (typeof ip !== "string") return -1n;
  const trimmed = ip.trim();
  if (!trimmed) return -1n;
  // Handle :: shorthand expansion
  let parts: string[];
  if (trimmed.includes("::")) {
    const [left, right] = trimmed.split("::");
    const leftParts = left ? left.split(":") : [];
    const rightParts = right ? right.split(":") : [];
    const missing = 8 - leftParts.length - rightParts.length;
    if (missing < 1) return -1n; // :: with no missing groups = invalid
    parts = [...leftParts, ...Array(missing).fill("0"), ...rightParts];
  } else {
    parts = trimmed.split(":");
  }
  if (parts.length !== 8) return -1n;
  let result = 0n;
  for (const part of parts) {
    if (!/^[0-9a-fA-F]{1,4}$/.test(part)) return -1n;
    result = (result << 16n) | BigInt(parseInt(part, 16));
  }
  return result;
}

/** Convert BigInt to IPv6 string (compressed form with ::). */
export function bigIntToIpv6(n: bigint): string {
  const parts: string[] = [];
  for (let i = 7; i >= 0; i--) {
    const shift = BigInt(i * 16);
    const part = Number((n >> shift) & 0xffffn);
    parts.push(part.toString(16));
  }
  // Find longest run of zeros for :: compression
  let bestStart = -1, bestLen = 0;
  let curStart = -1, curLen = 0;
  for (let i = 0; i < parts.length; i++) {
    if (parts[i] === "0") {
      if (curStart === -1) curStart = i;
      curLen++;
      if (curLen > bestLen) { bestLen = curLen; bestStart = curStart; }
    } else {
      curStart = -1; curLen = 0;
    }
  }
  if (bestLen >= 2) {
    const before = parts.slice(0, bestStart).join(":");
    const after = parts.slice(bestStart + bestLen).join(":");
    return `${before}::${after}`;
  }
  return parts.join(":");
}

/** Validate an IPv6 address string. */
export function isValidIpv6(ip: string): boolean {
  return ipv6ToBigInt(ip) !== -1n;
}

/** Calculate IPv6 subnet details. */
export interface Ipv6SubnetResult {
  cidr: string;
  ip: string;
  prefix: number;
  network: string;
  firstHost: string;
  lastHost: string;
  totalHosts: string;       // as string (BigInt can't be JSON-serialized well)
  usableHosts: string;
  isLinkLocal: boolean;     // fe80::/10
  isUniqueLocal: boolean;   // fc00::/7
  isLoopback: boolean;      // ::1
  isMulticast: boolean;     // ff00::/8
  isValid: boolean;
  error?: string;
}

export function calculateIpv6Subnet(input: string): Ipv6SubnetResult {
  const trimmed = input.trim();
  if (!trimmed.includes("/")) {
    return { cidr: trimmed, ip: trimmed, prefix: -1, network: "", firstHost: "", lastHost: "", totalHosts: "0", usableHosts: "0", isLinkLocal: false, isUniqueLocal: false, isLoopback: false, isMulticast: false, isValid: false, error: "Missing /prefix in IPv6 notation." };
  }
  const [ipPart, prefixPart] = trimmed.split("/");
  const prefix = parseInt(prefixPart, 10);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 128) {
    return { cidr: trimmed, ip: trimmed, prefix: -1, network: "", firstHost: "", lastHost: "", totalHosts: "0", usableHosts: "0", isLinkLocal: false, isUniqueLocal: false, isLoopback: false, isMulticast: false, isValid: false, error: "Prefix must be 0-128." };
  }
  const ipInt = ipv6ToBigInt(ipPart);
  if (ipInt === -1n) {
    return { cidr: trimmed, ip: trimmed, prefix, network: "", firstHost: "", lastHost: "", totalHosts: "0", usableHosts: "0", isLinkLocal: false, isUniqueLocal: false, isLoopback: false, isMulticast: false, isValid: false, error: "Invalid IPv6 address." };
  }
  // Compute network address
  const mask = prefix === 0 ? 0n : ((1n << 128n) - 1n) ^ ((1n << BigInt(128 - prefix)) - 1n);
  const networkInt = ipInt & mask;
  const totalHosts = prefix >= 128 ? 1n : 1n << BigInt(128 - prefix);
  // For /127 and /128, special handling; /64 is typical subnet
  const usableHosts = prefix >= 127 ? totalHosts : totalHosts - 2n; // RFC 6164
  const firstHost = prefix >= 127 ? bigIntToIpv6(networkInt) : bigIntToIpv6(networkInt + 1n);
  const lastHost = prefix >= 127 ? bigIntToIpv6(networkInt + totalHosts - 1n) : bigIntToIpv6(networkInt + totalHosts - 2n);
  // Detect special ranges
  // fe80::/10 — first 10 bits = 1111111010
  // fc00::/7  — first 7 bits = 1111110
  // ff00::/8  — first 8 bits = 11111111
  const topByte = Number((networkInt >> 120n) & 0xffn); // first 8 bits
  const top10Bits = Number((networkInt >> 118n) & 0x3ffn); // first 10 bits
  const isLoopback = networkInt === 1n;
  const isLinkLocal = top10Bits === 0x3fa; // 1111111010 = fe80::/10
  const isUniqueLocal = (topByte & 0xfe) === 0xfc; // fc00::/7
  const isMulticast = topByte === 0xff; // ff00::/8
  return {
    cidr: `${bigIntToIpv6(networkInt)}/${prefix}`,
    ip: bigIntToIpv6(ipInt),
    prefix,
    network: bigIntToIpv6(networkInt),
    firstHost,
    lastHost,
    totalHosts: totalHosts.toString(),
    usableHosts: usableHosts.toString(),
    isLinkLocal,
    isUniqueLocal,
    isLoopback,
    isMulticast,
    isValid: true,
  };
}

// ===== VLSM subnetting (blueprint feature) =====

export interface VlsmEntry {
  name: string;
  hostCount: number;        // requested hosts
  prefix: number;           // assigned prefix
  network: string;          // network address
  firstHost: string;
  lastHost: string;
  broadcast: string;
  actualHosts: number;      // usable hosts for this prefix
}

/** Split a network into smaller subnets using VLSM. */
export function vlsmSplit(baseNetwork: string, hostCounts: number[]): VlsmEntry[] {
  const base = calculateSubnet(baseNetwork);
  if (!base.isValid) throw new Error("Invalid base network");
  const baseNetworkInt = ipToInt(base.network);
  const entries: VlsmEntry[] = [];
  let current = baseNetworkInt;
  // Sort by host count descending (largest subnets first)
  const sorted = [...hostCounts].sort((a, b) => b - a);
  for (const hosts of sorted) {
    // Find smallest prefix that fits hosts + 2 (network + broadcast)
    let prefix = 30;
    while (prefix > 0 && Math.pow(2, 32 - prefix) - 2 < hosts) prefix--;
    if (prefix < base.prefix) throw new Error(`Cannot fit ${hosts} hosts in base /${base.prefix}`);
    const subnetSize = Math.pow(2, 32 - prefix);
    const network = current;
    const broadcast = network + subnetSize - 1;
    entries.push({
      name: `Subnet ${entries.length + 1}`,
      hostCount: hosts,
      prefix,
      network: intToIp(network),
      firstHost: intToIp(network + 1),
      lastHost: intToIp(broadcast - 1),
      broadcast: intToIp(broadcast),
      actualHosts: subnetSize - 2,
    });
    current = broadcast + 1;
  }
  return entries;
}

// ===== Extra #1: Wildcard mask in ACL format =====

/** Convert a subnet mask to Cisco ACL wildcard format (inverted). */
export function maskToWildcard(mask: string): string {
  const m = ipToInt(mask);
  if (m === -1) return "";
  const wildcard = (~m) >>> 0;
  return intToIp(wildcard);
}

// ===== Extra #2: Reverse DNS (PTR) lookup name =====

/** Generate the reverse DNS (PTR record) lookup name for an IPv4 address. */
export function ipv4ToPtr(ip: string): string {
  const parts = ip.trim().split(".");
  if (parts.length !== 4) return "";
  return `${parts[3]}.${parts[2]}.${parts[1]}.${parts[0]}.in-addr.arpa`;
}

/** Generate the reverse DNS (PTR record) lookup name for an IPv6 address. */
export function ipv6ToPtr(ip: string): string {
  const n = ipv6ToBigInt(ip);
  if (n === -1n) return "";
  const nibbles: string[] = [];
  for (let i = 0; i < 32; i++) {
    const shift = BigInt(i * 4);
    const nibble = Number((n >> shift) & 0xfn);
    nibbles.push(nibble.toString(16));
  }
  return `${nibbles.join(".")}.ip6.arpa`;
}

// ===== Extra #3: ASN whois URL =====

/** Build a whois lookup URL for an IP address. */
export function whoisUrl(ip: string): string {
  return `https://whois.com/whois/${encodeURIComponent(ip)}`;
}

/** Build an RIPEstat lookup URL for an IP. */
export function ripeStatUrl(ip: string): string {
  return `https://stat.ripe.net/${encodeURIComponent(ip)}`;
}

// ===== Extra #4: CIDR to range and range to CIDR =====

export interface IpRange {
  start: string;
  end: string;
  count: number;
}

/** Convert a CIDR to an IP range. */
export function cidrToRange(cidr: string): IpRange | null {
  const r = calculateSubnet(cidr);
  if (!r.isValid) return null;
  return {
    start: r.network,
    end: r.broadcast,
    count: r.totalHosts,
  };
}

/** Convert an IP range to a list of CIDRs (range to CIDR aggregation). */
export function rangeToCidr(startIp: string, endIp: string): string[] {
  let start = ipToInt(startIp);
  let end = ipToInt(endIp);
  if (start === -1 || end === -1 || start > end) return [];
  const cidrs: string[] = [];
  while (start <= end) {
    // Find the largest CIDR block that fits
    let prefix = 32;
    while (prefix > 0) {
      const mask = prefixToMaskInt(prefix);
      const masked = (start & mask) >>> 0;
      if (masked !== start) break;
      const blockSize = Math.pow(2, 32 - prefix);
      if (start + blockSize - 1 > end) break;
      prefix--;
    }
    prefix++; // back off one
    const blockSize = Math.pow(2, 32 - prefix);
    cidrs.push(`${intToIp(start)}/${prefix}`);
    start = start + blockSize;
  }
  return cidrs;
}

// ===== Extra #5: Subnet history (localStorage) =====

const SUBNET_HISTORY_KEY = "unqtools-subnet-history";
const MAX_SUBNET_HISTORY = 20;

export interface SubnetHistoryEntry {
  input: string;
  type: "ipv4" | "ipv6" | "vlsm";
  computedAt: string;
}

export function loadSubnetHistory(): SubnetHistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(SUBNET_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, MAX_SUBNET_HISTORY);
  } catch {
    return [];
  }
}

export function saveSubnetToHistory(input: string, type: "ipv4" | "ipv6" | "vlsm"): SubnetHistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  const entry: SubnetHistoryEntry = { input, type, computedAt: new Date().toISOString() };
  const current = loadSubnetHistory().filter((e) => e.input !== input);
  const updated = [entry, ...current].slice(0, MAX_SUBNET_HISTORY);
  try { localStorage.setItem(SUBNET_HISTORY_KEY, JSON.stringify(updated)); } catch {}
  return updated;
}

export function clearSubnetHistory(): void {
  if (typeof localStorage === "undefined") return;
  try { localStorage.removeItem(SUBNET_HISTORY_KEY); } catch {}
}

// ===== Extra #6: CIDR merge/aggregate =====

/** Merge multiple CIDRs into the minimal set of covering CIDRs. */
export function mergeCidrs(cidrs: string[]): string[] {
  // Convert all CIDRs to ranges, find min start and max end, then convert back
  const ranges: Array<{ start: number; end: number }> = [];
  for (const cidr of cidrs) {
    const r = cidrToRange(cidr);
    if (r) ranges.push({ start: ipToInt(r.start), end: ipToInt(r.end) });
  }
  if (ranges.length === 0) return [];
  // Sort by start
  ranges.sort((a, b) => a.start - b.start);
  // Merge overlapping/adjacent ranges
  const merged: Array<{ start: number; end: number }> = [ranges[0]];
  for (let i = 1; i < ranges.length; i++) {
    const last = merged[merged.length - 1];
    if (ranges[i].start <= last.end + 1) {
      last.end = Math.max(last.end, ranges[i].end);
    } else {
      merged.push(ranges[i]);
    }
  }
  // Convert merged ranges back to CIDRs
  const result: string[] = [];
  for (const r of merged) {
    result.push(...rangeToCidr(intToIp(r.start), intToIp(r.end)));
  }
  return result;
}

// ===== Extra #7: Subnet comparison =====

export interface SubnetContainment {
  contains: boolean;       // does parent contain child?
  parentCidr: string;
  childCidr: string;
  message: string;
}

/** Check if one CIDR contains another. */
export function cidrContains(parentCidr: string, childCidr: string): SubnetContainment {
  const parent = calculateSubnet(parentCidr);
  const child = calculateSubnet(childCidr);
  if (!parent.isValid || !child.isValid) {
    return { contains: false, parentCidr, childCidr, message: "Invalid input" };
  }
  const parentNet = ipToInt(parent.network);
  const parentBroadcast = ipToInt(parent.broadcast);
  const childNet = ipToInt(child.network);
  const childBroadcast = ipToInt(child.broadcast);
  const contains = childNet >= parentNet && childBroadcast <= parentBroadcast;
  return {
    contains,
    parentCidr,
    childCidr,
    message: contains
      ? `${parentCidr} contains ${childCidr}`
      : `${parentCidr} does NOT contain ${childCidr}`,
  };
}

// ===== Extra #8: Binary view of IPv4 =====

/** Show the binary representation of an IPv4 address. */
export function ipv4ToBinary(ip: string): string {
  const n = ipToInt(ip);
  if (n === -1) return "";
  return Array.from({ length: 32 }, (_, i) => (n >>> (31 - i)) & 1).join("");
}

/** Show the binary representation of a subnet mask. */
export function maskToBinary(mask: string): string {
  return ipv4ToBinary(mask);
}

// ===== Extra #9: Copy as different formats =====

/** Format a subnet result as CSV. */
export function subnetToCsv(r: SubnetResult): string {
  return `field,value\ncidr,${r.cidr}\nnetwork,${r.network}\nbroadcast,${r.broadcast}\nmask,${r.mask}\nfirstHost,${r.firstHost}\nlastHost,${r.lastHost}\ntotalHosts,${r.totalHosts}\nusableHosts,${r.usableHosts}\nclass,${r.ipClass}`;
}

/** Format a subnet result as JSON. */
export function subnetToJson(r: SubnetResult): string {
  return JSON.stringify(r, null, 2);
}

// ===== Extra #10: Shareable URL =====

export function buildSubnetShareUrl(input: string): string {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}${window.location.pathname}#subnet=${encodeURIComponent(input)}`;
}

export function extractSubnetFromFragment(): string | null {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash;
  if (!hash) return null;
  const match = hash.match(/[#&]subnet=([^&]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}
