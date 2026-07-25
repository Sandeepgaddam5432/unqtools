/**
 * IPv6 Subnet Calculator — IPv6 address math, CIDR, range, reverse DNS.
 */
export interface Ipv6SubnetInfo {
  network: string;        // compressed network address
  networkExpanded: string; // full form
  prefix: number;
  totalAddresses: string;  // as string (BigInt-safe)
  firstHost: string;
  lastHost: string;
  reverseDns: string;
}

const HEX = "0123456789abcdef";

/** Expand a compressed IPv6 address to full 8-group form. Returns null on invalid. */
export function expandIpv6(addr: string): string | null {
  let s = addr.trim().toLowerCase();
  // Handle IPv4-embedded form minimally (not supported deeply)
  if (s.includes(":") === false) return null;
  // Handle :: expansion
  const parts = s.split(":");
  // Empty leading or trailing indicates leading/trailing ::
  let emptyIdx = parts.indexOf("");
  let hasDoubleColon = s.includes("::");
  if (hasDoubleColon) {
    // Find the position of the "::"
    const firstEmpty = parts.indexOf("");
    // Replace first empty + subsequent empties with zero groups
    const before = parts.slice(0, firstEmpty);
    const after = parts.slice(parts.lastIndexOf("") + 1);
    const missing = 8 - (before.length + after.length);
    if (missing < 0) return null;
    const expanded = [...before, ...Array(missing).fill("0"), ...after];
    parts.length = 0;
    parts.push(...expanded);
  }
  if (parts.length !== 8) return null;
  for (const p of parts) {
    if (!/^[0-9a-f]{1,4}$/.test(p)) return null;
  }
  return parts.map((p) => p.padStart(4, "0")).join(":");
}

/** Compress an expanded IPv6 address by removing leading zeros and using :: for longest zero run. */
export function compressIpv6(expanded: string): string {
  const groups = expanded.split(":");
  // Strip leading zeros per group
  const stripped = groups.map((g) => g.replace(/^0+/, "") || "0");
  // Find longest run of "0" groups
  let bestStart = -1, bestLen = 0, curStart = -1, curLen = 0;
  for (let i = 0; i < stripped.length; i++) {
    if (stripped[i] === "0") {
      if (curStart === -1) curStart = i;
      curLen++;
      if (curLen > bestLen) { bestLen = curLen; bestStart = curStart; }
    } else {
      curStart = -1; curLen = 0;
    }
  }
  if (bestLen >= 2) {
    const before = stripped.slice(0, bestStart);
    const after = stripped.slice(bestStart + bestLen);
    const beforeStr = before.length ? before.join(":") : "";
    const afterStr = after.length ? after.join(":") : "";
    return `${beforeStr}::${afterStr}`;
  }
  return stripped.join(":");
}

/** Convert expanded IPv6 to BigInt (128-bit). */
export function ipv6ToBigInt(expanded: string): bigint {
  const groups = expanded.split(":");
  let v = 0n;
  for (const g of groups) {
    v = (v << 16n) | BigInt(parseInt(g, 16));
  }
  return v;
}

/** Convert BigInt (128-bit) to expanded IPv6. */
export function bigIntToIpv6(v: bigint): string {
  const groups: string[] = [];
  for (let i = 0; i < 8; i++) {
    groups.unshift(((v >> BigInt(i * 16)) & 0xffffn).toString(16).padStart(4, "0"));
  }
  return groups.join(":");
}

/** Compute subnet info from "addr/prefix". */
export function computeSubnet(cidr: string): Ipv6SubnetInfo | { error: string } {
  const [addr, prefixStr] = cidr.trim().split("/");
  if (!addr || !prefixStr) return { error: "Use format: addr/prefix" };
  const prefix = Number(prefixStr);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 128) return { error: "Prefix must be 0-128" };
  const expanded = expandIpv6(addr);
  if (!expanded) return { error: "Invalid IPv6 address" };
  const addrBig = ipv6ToBigInt(expanded);
  const mask = prefix === 0 ? 0n : ((0xffffffffffffffffffffffffffffffffn << BigInt(128 - prefix)) & 0xffffffffffffffffffffffffffffffffn);
  const networkBig = addrBig & mask;
  const totalAddresses = prefix === 128 ? 1n : (1n << BigInt(128 - prefix));
  const firstBig = networkBig;
  const lastBig = networkBig + totalAddresses - 1n;
  const networkExpanded = bigIntToIpv6(networkBig);
  return {
    network: compressIpv6(networkExpanded),
    networkExpanded,
    prefix,
    totalAddresses: totalAddresses.toString(),
    firstHost: compressIpv6(bigIntToIpv6(firstBig)),
    lastHost: compressIpv6(bigIntToIpv6(lastBig)),
    reverseDns: reverseDns(networkExpanded, prefix),
  };
}

/** Build the reverse DNS (ip6.arpa) zone for the network. */
export function reverseDns(networkExpanded: string, prefix: number): string {
  // Each nibble represents 4 bits. Reverse nibble order for the network portion.
  const nibbles = networkExpanded.replace(/:/g, "").split("");
  const nibblesUsed = Math.ceil(prefix / 4);
  const relevant = nibbles.slice(0, nibblesUsed).reverse().join(".");
  return `${relevant}.ip6.arpa`;
}

void HEX; // (unused export guard)
