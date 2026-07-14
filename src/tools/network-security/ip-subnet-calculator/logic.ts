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
