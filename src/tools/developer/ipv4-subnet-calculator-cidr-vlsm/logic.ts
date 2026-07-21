/**
 * IPv4 Subnet Calculator (CIDR / VLSM) — pure logic.
 *
 * Compute network / broadcast / host range / wildcard / class from an IPv4
 * address + CIDR (or dotted / inverse mask), split a block evenly into N
 * subnets, plan VLSM allocations from a list of host requirements with
 * best-fit / least-waste, and check overlap / containment between two
 * blocks. Includes binary visualization and CSV / JSON export. Pure
 * functions only — no DOM, no network.
 *
 *   IPv4 values are 32-bit unsigned integers (>>> 0 keeps them unsigned).
 *   Host-count rules: /0–/30 → 2^(32−c) − 2 usable, /31 → 2 (RFC 3021),
 *   /32 → 1 (host route).
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type IpClass = "A" | "B" | "C" | "D" | "E" | "unclassful";

export interface IPv4Address {
  octets: [number, number, number, number];
  value: number;
}

export interface SubnetInfo {
  ip: string;
  cidr: number;
  networkAddress: string;
  broadcastAddress: string;
  firstHost: string;
  lastHost: string;
  subnetMask: string;
  wildcardMask: string;
  hostCount: number;
  totalAddresses: number;
  ipClass: IpClass;
  isPrivate: boolean;
  isReserved: boolean;
  isLoopback: boolean;
  isLinkLocal: boolean;
  networkBinary: string;
  ipBinary: string;
  maskBinary: string;
  wildcardBinary: string;
  /** Internal 32-bit unsigned values for VLSM / split math. */
  ipValue: number;
  networkValue: number;
  broadcastValue: number;
  maskValue: number;
  wildcardValue: number;
}

export interface VlsmRequirement {
  name: string;
  hosts: number;
}

export interface VlsmSubnet {
  name: string;
  requiredHosts: number;
  allocatedHosts: number;
  cidr: number;
  networkAddress: string;
  broadcastAddress: string;
  firstHost: string;
  lastHost: string;
  subnetMask: string;
  hostCount: number;
  totalAddresses: number;
  waste: number;
  overflow: boolean;
}

export interface VlsmResult {
  parent: SubnetInfo;
  subnets: VlsmSubnet[];
  fits: boolean;
  totalUsed: number;
  totalAvailable: number;
  wastePercent: number;
  error?: string;
}

export interface SplitSubnet {
  cidr: number;
  networkAddress: string;
  broadcastAddress: string;
  subnetMask: string;
  hostCount: number;
  totalAddresses: number;
}

export interface SplitResult {
  parent: SubnetInfo;
  count: number;
  newPrefix: number;
  subnets: SplitSubnet[];
  error?: string;
}

export interface ContainmentResult {
  block1: { network: string; cidr: number };
  block2: { network: string; cidr: number };
  overlap: boolean;
  block1ContainsBlock2: boolean;
  block2ContainsBlock1: boolean;
  identical: boolean;
}

// ---------------------------------------------------------------------------
// IPv4 parsing & formatting
// ---------------------------------------------------------------------------

/** Parse a dotted-decimal IPv4 string into octets + 32-bit value. */
export function parseIPv4(input: string): { ok: true; address: IPv4Address } | { ok: false; error: string } {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, error: "Empty IP" };
  const parts = trimmed.split(".");
  if (parts.length !== 4) {
    return { ok: false, error: "Expected 4 octets separated by dots" };
  }
  const octets: [number, number, number, number] = [0, 0, 0, 0];
  for (let i = 0; i < 4; i++) {
    const p = parts[i];
    if (!/^\d+$/.test(p)) {
      return { ok: false, error: `Invalid octet "${p}"` };
    }
    const n = Number.parseInt(p, 10);
    if (n < 0 || n > 255) {
      return { ok: false, error: `Octet ${n} out of range (0–255)` };
    }
    octets[i] = n;
  }
  const value = (((octets[0] << 24) | (octets[1] << 16) | (octets[2] << 8) | octets[3]) >>> 0);
  return { ok: true, address: { octets, value } };
}

/** Format a 32-bit unsigned integer as dotted-decimal. */
export function ipv4ToString(value: number): string {
  const v = value >>> 0;
  const a = (v >>> 24) & 0xff;
  const b = (v >>> 16) & 0xff;
  const c = (v >>> 8) & 0xff;
  const d = v & 0xff;
  return `${a}.${b}.${c}.${d}`;
}

/** Format a 32-bit unsigned integer as a 32-bit binary string (MSB first). */
export function ipv4ToBinary(value: number): string {
  const v = value >>> 0;
  return v.toString(2).padStart(32, "0");
}

/** Format a binary string with dotted separators every 8 bits. */
export function formatBinaryDotted(binary: string): string {
  return binary.match(/.{1,8}/g)?.join(".") ?? binary;
}

// ---------------------------------------------------------------------------
// Mask helpers
// ---------------------------------------------------------------------------

/** Convert a CIDR prefix length (0–32) to a 32-bit mask value. */
export function maskToValue(cidr: number): number {
  if (cidr <= 0) return 0;
  if (cidr >= 32) return 0xffffffff >>> 0;
  return ((0xffffffff << (32 - cidr)) >>> 0);
}

/** Convert a CIDR to a dotted-decimal mask. */
export function maskToDotted(cidr: number): string {
  return ipv4ToString(maskToValue(cidr));
}

/** Convert a CIDR to a 32-bit wildcard (inverse mask) value. */
export function wildcardToValue(cidr: number): number {
  return (~maskToValue(cidr)) >>> 0;
}

/** Convert a CIDR to a dotted-decimal wildcard. */
export function wildcardToDotted(cidr: number): string {
  return ipv4ToString(wildcardToValue(cidr));
}

/** Convert a CIDR to a 32-bit binary mask string. */
export function maskToBinary(cidr: number): string {
  return ipv4ToBinary(maskToValue(cidr));
}

/** Convert a CIDR to a 32-bit binary wildcard string. */
export function wildcardToBinary(cidr: number): string {
  return ipv4ToBinary(wildcardToValue(cidr));
}

// ---------------------------------------------------------------------------
// CIDR / mask parsing
// ---------------------------------------------------------------------------

/** Parse a CIDR prefix, dotted mask, or inverse mask into a prefix length. */
export function parseCidrOrMask(input: string): { ok: true; cidr: number } | { ok: false; error: string } {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, error: "Empty mask" };
  // Integer (with optional leading /)
  const slashStr = trimmed.startsWith("/") ? trimmed.slice(1) : trimmed;
  if (/^\d+$/.test(slashStr)) {
    const n = Number.parseInt(slashStr, 10);
    if (n < 0 || n > 32) return { ok: false, error: "CIDR must be 0–32" };
    return { ok: true, cidr: n };
  }
  // Dotted-decimal mask or inverse mask
  const parsed = parseIPv4(trimmed);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const value = parsed.address.value;
  for (let c = 0; c <= 32; c++) {
    if (maskToValue(c) === value) return { ok: true, cidr: c };
  }
  for (let c = 0; c <= 32; c++) {
    if (wildcardToValue(c) === value) return { ok: true, cidr: c };
  }
  return { ok: false, error: "Not a valid contiguous subnet mask or wildcard" };
}

/** Parse a combined "IP/CIDR", "IP mask", or bare "IP" input. */
export function parseIpCidr(input: string):
  | { ok: true; ip: string; cidr: number }
  | { ok: false; error: string } {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, error: "Empty input" };
  let ipPart: string;
  let restPart: string;
  if (trimmed.includes("/")) {
    const slashIdx = trimmed.indexOf("/");
    ipPart = trimmed.slice(0, slashIdx);
    restPart = trimmed.slice(slashIdx + 1);
  } else {
    const parts = trimmed.split(/\s+/);
    if (parts.length === 1) {
      ipPart = parts[0];
      restPart = "";
    } else if (parts.length === 2) {
      ipPart = parts[0];
      restPart = parts[1];
    } else {
      return { ok: false, error: "Expected 'IP/CIDR' or 'IP mask'" };
    }
  }
  const ipParsed = parseIPv4(ipPart);
  if (!ipParsed.ok) return { ok: false, error: ipParsed.error };
  if (!restPart) return { ok: true, ip: ipPart.trim(), cidr: 32 };
  const cidrParsed = parseCidrOrMask(restPart);
  if (!cidrParsed.ok) return { ok: false, error: cidrParsed.error };
  return { ok: true, ip: ipPart.trim(), cidr: cidrParsed.cidr };
}

// ---------------------------------------------------------------------------
// IP class & special ranges
// ---------------------------------------------------------------------------

/** Detect the classful IP class (A/B/C/D/E) from the first octet. */
export function detectIpClass(value: number): IpClass {
  const first = (value >>> 24) & 0xff;
  if (first === 0) return "unclassful";
  if (first >= 1 && first <= 126) return "A";
  if (first >= 128 && first <= 191) return "B";
  if (first >= 192 && first <= 223) return "C";
  if (first >= 224 && first <= 239) return "D";
  return "E"; // 240–255
}

/** True for RFC 1918 private ranges (10/8, 172.16/12, 192.168/16). */
export function isPrivateIp(value: number): boolean {
  const first = (value >>> 24) & 0xff;
  const second = (value >>> 16) & 0xff;
  if (first === 10) return true;
  if (first === 172 && second >= 16 && second <= 31) return true;
  if (first === 192 && second === 168) return true;
  return false;
}

/** True for 127.0.0.0/8 loopback. */
export function isLoopbackIp(value: number): boolean {
  return ((value >>> 24) & 0xff) === 127;
}

/** True for 169.254.0.0/16 link-local. */
export function isLinkLocalIp(value: number): boolean {
  const first = (value >>> 24) & 0xff;
  const second = (value >>> 16) & 0xff;
  return first === 169 && second === 254;
}

/** True for any reserved/special-use range (loopback, link-local, 0/8, 224/4, 240/4, 255.255.255.255). */
export function isReservedIp(value: number): boolean {
  if (isLoopbackIp(value)) return true;
  if (isLinkLocalIp(value)) return true;
  const first = (value >>> 24) & 0xff;
  if (first === 0) return true; // 0.0.0.0/8 "this" network
  if (first >= 224 && first <= 239) return true; // 224.0.0.0/4 multicast
  if (first >= 240) return true; // 240.0.0.0/4 reserved
  if (value === 0xffffffff) return true; // limited broadcast
  return false;
}

// ---------------------------------------------------------------------------
// Host counting
// ---------------------------------------------------------------------------

/** Compute usable host count and total addresses for a prefix length. */
export function computeHostCount(cidr: number): { hosts: number; total: number } {
  if (cidr < 0 || cidr > 32) throw new Error("CIDR must be 0–32");
  if (cidr === 32) return { hosts: 1, total: 1 };
  if (cidr === 31) return { hosts: 2, total: 2 }; // RFC 3021 point-to-point
  const total = Math.pow(2, 32 - cidr);
  return { hosts: total - 2, total };
}

/** Smallest prefix length that fits `hosts` usable hosts (cidr ≤ 30). */
export function requiredPrefixForHosts(hosts: number): number {
  if (hosts < 1) return 32;
  if (hosts === 1) return 32;
  let bits = 0;
  const needed = hosts + 2;
  while ((1 << bits) < needed) bits++;
  if (bits > 32) bits = 32;
  const cidr = 32 - bits;
  return Math.max(0, Math.min(30, cidr));
}

// ---------------------------------------------------------------------------
// Subnet computation
// ---------------------------------------------------------------------------

/** Compute the full SubnetInfo for an IP + CIDR. */
export function computeSubnet(ipInput: string, cidr: number): SubnetInfo {
  const ipParsed = parseIPv4(ipInput);
  if (!ipParsed.ok) throw new Error(ipParsed.error);
  if (cidr < 0 || cidr > 32) throw new Error("CIDR must be 0–32");
  const ipValue = ipParsed.address.value;
  const maskValue = maskToValue(cidr);
  const wildcardValue = wildcardToValue(cidr);
  const networkValue = (ipValue & maskValue) >>> 0;
  const broadcastValue = (networkValue | wildcardValue) >>> 0;
  const { hosts: hostCount, total: totalAddresses } = computeHostCount(cidr);
  let firstHostValue: number;
  let lastHostValue: number;
  if (cidr === 32) {
    firstHostValue = networkValue;
    lastHostValue = networkValue;
  } else if (cidr === 31) {
    firstHostValue = networkValue;
    lastHostValue = broadcastValue;
  } else {
    firstHostValue = (networkValue + 1) >>> 0;
    lastHostValue = (broadcastValue - 1) >>> 0;
  }
  return {
    ip: ipv4ToString(ipValue),
    cidr,
    networkAddress: ipv4ToString(networkValue),
    broadcastAddress: ipv4ToString(broadcastValue),
    firstHost: ipv4ToString(firstHostValue),
    lastHost: ipv4ToString(lastHostValue),
    subnetMask: ipv4ToString(maskValue),
    wildcardMask: ipv4ToString(wildcardValue),
    hostCount,
    totalAddresses,
    ipClass: detectIpClass(ipValue),
    isPrivate: isPrivateIp(ipValue),
    isReserved: isReservedIp(ipValue),
    isLoopback: isLoopbackIp(ipValue),
    isLinkLocal: isLinkLocalIp(ipValue),
    networkBinary: ipv4ToBinary(networkValue),
    ipBinary: ipv4ToBinary(ipValue),
    maskBinary: ipv4ToBinary(maskValue),
    wildcardBinary: ipv4ToBinary(wildcardValue),
    ipValue,
    networkValue,
    broadcastValue,
    maskValue,
    wildcardValue,
  };
}

// ---------------------------------------------------------------------------
// Even split
// ---------------------------------------------------------------------------

/** Split a parent block evenly into at least `count` subnets. */
export function splitSubnet(parentIp: string, parentCidr: number, count: number): SplitResult {
  if (count < 1) throw new Error("Count must be ≥ 1");
  const parent = computeSubnet(parentIp, parentCidr);
  let extraBits = 0;
  while ((1 << extraBits) < count) extraBits++;
  const newPrefix = parentCidr + extraBits;
  if (newPrefix > 32) {
    return {
      parent,
      count,
      newPrefix,
      subnets: [],
      error: `Cannot split /${parentCidr} into ${count} subnets (would need /${newPrefix} > /32)`,
    };
  }
  const blockSize = Math.pow(2, 32 - newPrefix);
  const actualCount = 1 << extraBits;
  const subnets: SplitSubnet[] = [];
  for (let i = 0; i < actualCount; i++) {
    const netAddr = (parent.networkValue + i * blockSize) >>> 0;
    const info = computeSubnet(ipv4ToString(netAddr), newPrefix);
    subnets.push({
      cidr: newPrefix,
      networkAddress: info.networkAddress,
      broadcastAddress: info.broadcastAddress,
      subnetMask: info.subnetMask,
      hostCount: info.hostCount,
      totalAddresses: info.totalAddresses,
    });
  }
  return { parent, count: actualCount, newPrefix, subnets };
}

// ---------------------------------------------------------------------------
// VLSM allocation (best-fit, least-waste)
// ---------------------------------------------------------------------------

/** Align `address` UP to the next multiple of `blockSize`. */
export function alignUp(address: number, blockSize: number): number {
  const rem = address % blockSize;
  if (rem === 0) return address;
  return address + (blockSize - rem);
}

/** Allocate VLSM subnets from a parent block using best-fit (largest-first). */
export function allocateVlsm(
  parentIp: string,
  parentCidr: number,
  requirements: VlsmRequirement[],
): VlsmResult {
  const parent = computeSubnet(parentIp, parentCidr);
  if (requirements.length === 0) {
    return {
      parent,
      subnets: [],
      fits: true,
      totalUsed: 0,
      totalAvailable: parent.totalAddresses,
      wastePercent: 100,
    };
  }
  // Sort by hosts descending (largest blocks first → best-fit).
  const sorted = requirements
    .map((r, i) => ({ ...r, originalIndex: i }))
    .sort((a, b) => b.hosts - a.hosts);
  const subnets: VlsmSubnet[] = [];
  let cursor = parent.networkValue;
  let overflow = false;
  for (const req of sorted) {
    const cidr = requiredPrefixForHosts(req.hosts);
    const blockSize = Math.pow(2, 32 - cidr);
    const netAddr = alignUp(cursor, blockSize);
    const bcast = (netAddr + blockSize - 1) >>> 0;
    if (bcast > parent.broadcastValue) {
      overflow = true;
      subnets.push({
        name: req.name,
        requiredHosts: req.hosts,
        allocatedHosts: 0,
        cidr,
        networkAddress: ipv4ToString(netAddr),
        broadcastAddress: ipv4ToString(bcast),
        firstHost: "—",
        lastHost: "—",
        subnetMask: maskToDotted(cidr),
        hostCount: 0,
        totalAddresses: blockSize,
        waste: 0,
        overflow: true,
      });
      cursor = (bcast + 1) >>> 0;
      continue;
    }
    const info = computeSubnet(ipv4ToString(netAddr), cidr);
    subnets.push({
      name: req.name,
      requiredHosts: req.hosts,
      allocatedHosts: info.hostCount,
      cidr,
      networkAddress: info.networkAddress,
      broadcastAddress: info.broadcastAddress,
      firstHost: info.firstHost,
      lastHost: info.lastHost,
      subnetMask: info.subnetMask,
      hostCount: info.hostCount,
      totalAddresses: info.totalAddresses,
      waste: info.hostCount - req.hosts,
      overflow: false,
    });
    cursor = (netAddr + blockSize) >>> 0;
  }
  // Restore original order for display.
  subnets.sort((a, b) => {
    const ai = sorted.findIndex((s) => s.name === a.name);
    const bi = sorted.findIndex((s) => s.name === b.name);
    return ai - bi;
  });
  const totalUsed = subnets
    .filter((s) => !s.overflow)
    .reduce((sum, s) => sum + s.totalAddresses, 0);
  const totalAvailable = parent.totalAddresses;
  const wastePercent =
    totalAvailable > 0
      ? ((totalAvailable - totalUsed) / totalAvailable) * 100
      : 0;
  return {
    parent,
    subnets,
    fits: !overflow,
    totalUsed,
    totalAvailable,
    wastePercent,
  };
}

// ---------------------------------------------------------------------------
// Containment / overlap
// ---------------------------------------------------------------------------

/** Check overlap and containment between two CIDR blocks. */
export function checkContainment(
  ip1: string,
  cidr1: number,
  ip2: string,
  cidr2: number,
): ContainmentResult {
  const s1 = computeSubnet(ip1, cidr1);
  const s2 = computeSubnet(ip2, cidr2);
  const block1ContainsBlock2 =
    s1.networkValue <= s2.networkValue && s2.broadcastValue <= s1.broadcastValue;
  const block2ContainsBlock1 =
    s2.networkValue <= s1.networkValue && s1.broadcastValue <= s2.broadcastValue;
  const overlap = !(
    s1.broadcastValue < s2.networkValue || s2.broadcastValue < s1.networkValue
  );
  const identical =
    s1.networkValue === s2.networkValue && s1.broadcastValue === s2.broadcastValue;
  return {
    block1: { network: s1.networkAddress, cidr: cidr1 },
    block2: { network: s2.networkAddress, cidr: cidr2 },
    overlap,
    block1ContainsBlock2,
    block2ContainsBlock1,
    identical,
  };
}

// ---------------------------------------------------------------------------
// VLSM requirements parsing
// ---------------------------------------------------------------------------

/** Parse a list of "name hosts" requirements (newline / comma separated). */
export function parseVlsmRequirements(input: string):
  | { ok: true; reqs: VlsmRequirement[] }
  | { ok: false; error: string } {
  const lines = input
    .split(/[\n,;|]+/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return { ok: false, error: "No requirements" };
  const reqs: VlsmRequirement[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const parts = line.split(/[\s,:|]+/);
    if (parts.length < 2) {
      return { ok: false, error: `Line ${i + 1}: expected "name hosts"` };
    }
    const name = parts.slice(0, -1).join(" ");
    const hostsStr = parts[parts.length - 1];
    if (!/^\d+$/.test(hostsStr)) {
      return { ok: false, error: `Line ${i + 1}: invalid host count "${hostsStr}"` };
    }
    const hosts = Number.parseInt(hostsStr, 10);
    if (hosts < 1) {
      return { ok: false, error: `Line ${i + 1}: hosts must be ≥ 1` };
    }
    reqs.push({ name, hosts });
  }
  return { ok: true, reqs };
}

// ---------------------------------------------------------------------------
// CSV / JSON export
// ---------------------------------------------------------------------------

/** Render VLSM subnets as CSV. */
export function renderVlsmCsv(subnets: VlsmSubnet[]): string {
  const headers = [
    "name", "required_hosts", "cidr", "network", "broadcast",
    "first_host", "last_host", "mask", "usable_hosts",
    "total_addresses", "waste", "overflow",
  ];
  const lines = [headers.join(",")];
  for (const s of subnets) {
    lines.push([
      escapeCsv(s.name),
      s.requiredHosts,
      s.cidr,
      s.networkAddress,
      s.broadcastAddress,
      s.firstHost,
      s.lastHost,
      s.subnetMask,
      s.hostCount,
      s.totalAddresses,
      s.waste,
      s.overflow ? "yes" : "no",
    ].join(","));
  }
  return lines.join("\n");
}

/** Render split subnets as CSV. */
export function renderSplitCsv(subnets: SplitSubnet[]): string {
  const headers = ["index", "cidr", "network", "broadcast", "mask", "usable_hosts", "total_addresses"];
  const lines = [headers.join(",")];
  subnets.forEach((s, i) => {
    lines.push([
      i, s.cidr, s.networkAddress, s.broadcastAddress,
      s.subnetMask, s.hostCount, s.totalAddresses,
    ].join(","));
  });
  return lines.join("\n");
}

/** Render any result as pretty JSON. */
export function renderJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:ipv4-subnet-calculator-cidr-vlsm:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  mode: "subnet" | "split" | "vlsm" | "containment";
  input: string;
  summary: string;
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

// ---------------------------------------------------------------------------
// Shareable URL
// ---------------------------------------------------------------------------

export type SubnetToolMode = "subnet" | "split" | "vlsm" | "containment";

export function buildShareUrl(
  mode: SubnetToolMode,
  ip: string,
  cidr: number,
  extra: { count?: number; vlsm?: string; ip2?: string; cidr2?: number } = {},
): string {
  const params = new URLSearchParams();
  params.set("mode", mode);
  if (ip) params.set("ip", ip);
  params.set("cidr", String(cidr));
  if (extra.count !== undefined) params.set("count", String(extra.count));
  if (extra.vlsm !== undefined) params.set("vlsm", extra.vlsm);
  if (extra.ip2 !== undefined) params.set("ip2", extra.ip2);
  if (extra.cidr2 !== undefined) params.set("cidr2", String(extra.cidr2));
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export interface ShareParams {
  mode: SubnetToolMode;
  ip: string;
  cidr: number;
  count: number;
  vlsm: string;
  ip2: string;
  cidr2: number;
}

export function parseShareUrl(hash: string): ShareParams {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) {
    return {
      mode: "subnet",
      ip: "192.168.1.1",
      cidr: 24,
      count: 4,
      vlsm: "",
      ip2: "192.168.1.128",
      cidr2: 25,
    };
  }
  const params = new URLSearchParams(clean);
  const m = params.get("mode") ?? "subnet";
  const mode: SubnetToolMode =
    m === "split" || m === "vlsm" || m === "containment" ? m : "subnet";
  const ip = params.get("ip") ?? "192.168.1.1";
  const cidrRaw = Number.parseInt(params.get("cidr") ?? "24", 10);
  const cidr = Number.isFinite(cidrRaw) && cidrRaw >= 0 && cidrRaw <= 32 ? cidrRaw : 24;
  const countRaw = Number.parseInt(params.get("count") ?? "4", 10);
  const count = Number.isFinite(countRaw) && countRaw > 0 ? countRaw : 4;
  const vlsm = params.get("vlsm") ?? "";
  const ip2 = params.get("ip2") ?? "192.168.1.128";
  const cidr2Raw = Number.parseInt(params.get("cidr2") ?? "25", 10);
  const cidr2 = Number.isFinite(cidr2Raw) && cidr2Raw >= 0 && cidr2Raw <= 32 ? cidr2Raw : 25;
  return { mode, ip, cidr, count, vlsm, ip2, cidr2 };
}
