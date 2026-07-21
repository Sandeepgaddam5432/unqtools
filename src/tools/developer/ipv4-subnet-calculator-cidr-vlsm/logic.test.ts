import { describe, it, expect, beforeEach } from "vitest";
import {
  parseIPv4,
  ipv4ToString,
  ipv4ToBinary,
  formatBinaryDotted,
  maskToValue,
  maskToDotted,
  wildcardToValue,
  wildcardToDotted,
  maskToBinary,
  wildcardToBinary,
  parseCidrOrMask,
  parseIpCidr,
  detectIpClass,
  isPrivateIp,
  isLoopbackIp,
  isLinkLocalIp,
  isReservedIp,
  computeHostCount,
  requiredPrefixForHosts,
  computeSubnet,
  splitSubnet,
  alignUp,
  allocateVlsm,
  checkContainment,
  parseVlsmRequirements,
  renderVlsmCsv,
  renderSplitCsv,
  renderJson,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type SubnetToolMode,
} from "./logic";

beforeEach(() => {
  const store: Record<string, string> = {};
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; },
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() { return Object.keys(store).length; },
  };
});

// ---------------------------------------------------------------------------
// IPv4 parsing & formatting
// ---------------------------------------------------------------------------

describe("ipv4 parseIPv4", () => {
  it("parses valid dotted-decimal", () => {
    const r = parseIPv4("192.168.1.1");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.address.octets).toEqual([192, 168, 1, 1]);
      expect(r.address.value).toBe(0xc0a80101 >>> 0);
    }
  });
  it("rejects wrong octet count", () => {
    expect(parseIPv4("192.168.1").ok).toBe(false);
    expect(parseIPv4("192.168.1.1.1").ok).toBe(false);
  });
  it("rejects out-of-range octets", () => {
    expect(parseIPv4("256.1.1.1").ok).toBe(false);
    expect(parseIPv4("192.168.1.-1").ok).toBe(false);
  });
  it("rejects non-numeric octets", () => {
    expect(parseIPv4("abc.168.1.1").ok).toBe(false);
    expect(parseIPv4("192.168.1.1a").ok).toBe(false);
  });
  it("rejects empty input", () => {
    expect(parseIPv4("").ok).toBe(false);
    expect(parseIPv4("   ").ok).toBe(false);
  });
});

describe("ipv4 formatting", () => {
  it("ipv4ToString round-trips", () => {
    expect(ipv4ToString(0xc0a80101 >>> 0)).toBe("192.168.1.1");
    expect(ipv4ToString(0)).toBe("0.0.0.0");
    expect(ipv4ToString(0xffffffff >>> 0)).toBe("255.255.255.255");
  });
  it("ipv4ToBinary returns 32-bit MSB-first padded", () => {
    expect(ipv4ToBinary(0)).toBe("0".repeat(32));
    expect(ipv4ToBinary(1)).toBe("0".repeat(31) + "1");
    expect(ipv4ToBinary(0xffffffff >>> 0)).toBe("1".repeat(32));
    expect(ipv4ToBinary(0xc0a80101 >>> 0)).toBe("11000000101010000000000100000001");
  });
  it("formatBinaryDotted splits into 8-bit groups", () => {
    expect(formatBinaryDotted("11111111000000001111111100000000"))
      .toBe("11111111.00000000.11111111.00000000");
  });
});

// ---------------------------------------------------------------------------
// Mask helpers
// ---------------------------------------------------------------------------

describe("ipv4 mask helpers", () => {
  it("maskToValue / maskToDotted for /0, /24, /32", () => {
    expect(maskToValue(0)).toBe(0);
    expect(maskToDotted(0)).toBe("0.0.0.0");
    expect(maskToValue(24)).toBe(0xffffff00 >>> 0);
    expect(maskToDotted(24)).toBe("255.255.255.0");
    expect(maskToValue(32)).toBe(0xffffffff >>> 0);
    expect(maskToDotted(32)).toBe("255.255.255.255");
  });
  it("wildcardToValue / wildcardToDotted for /24", () => {
    expect(wildcardToValue(24)).toBe(0x000000ff >>> 0);
    expect(wildcardToDotted(24)).toBe("0.0.0.255");
    expect(wildcardToValue(0)).toBe(0xffffffff >>> 0);
    expect(wildcardToDotted(32)).toBe("0.0.0.0");
  });
  it("maskToBinary / wildcardToBinary produce 32-bit strings", () => {
    expect(maskToBinary(24)).toBe("1".repeat(24) + "0".repeat(8));
    expect(wildcardToBinary(24)).toBe("0".repeat(24) + "1".repeat(8));
    expect(maskToBinary(0)).toBe("0".repeat(32));
  });
});

// ---------------------------------------------------------------------------
// CIDR / mask parsing
// ---------------------------------------------------------------------------

describe("ipv4 parseCidrOrMask", () => {
  it("accepts /N notation", () => {
    expect(parseCidrOrMask("/24")).toEqual({ ok: true, cidr: 24 });
    expect(parseCidrOrMask("/0")).toEqual({ ok: true, cidr: 0 });
    expect(parseCidrOrMask("/32")).toEqual({ ok: true, cidr: 32 });
  });
  it("accepts bare integer", () => {
    expect(parseCidrOrMask("24")).toEqual({ ok: true, cidr: 24 });
  });
  it("accepts dotted-decimal mask", () => {
    expect(parseCidrOrMask("255.255.255.0")).toEqual({ ok: true, cidr: 24 });
    expect(parseCidrOrMask("255.0.0.0")).toEqual({ ok: true, cidr: 8 });
    expect(parseCidrOrMask("0.0.0.0")).toEqual({ ok: true, cidr: 0 });
  });
  it("accepts inverse / wildcard mask", () => {
    expect(parseCidrOrMask("0.0.0.255")).toEqual({ ok: true, cidr: 24 });
    expect(parseCidrOrMask("0.255.255.255")).toEqual({ ok: true, cidr: 8 });
  });
  it("rejects non-contiguous masks", () => {
    expect(parseCidrOrMask("255.0.255.0").ok).toBe(false);
    expect(parseCidrOrMask("255.255.0.255").ok).toBe(false);
  });
  it("rejects out-of-range CIDR", () => {
    expect(parseCidrOrMask("33").ok).toBe(false);
    expect(parseCidrOrMask("-1").ok).toBe(false);
  });
});

describe("ipv4 parseIpCidr", () => {
  it("parses IP/CIDR", () => {
    expect(parseIpCidr("192.168.1.1/24")).toEqual({ ok: true, ip: "192.168.1.1", cidr: 24 });
  });
  it("parses IP + dotted mask", () => {
    expect(parseIpCidr("192.168.1.1 255.255.255.0"))
      .toEqual({ ok: true, ip: "192.168.1.1", cidr: 24 });
  });
  it("parses IP + inverse mask", () => {
    expect(parseIpCidr("192.168.1.1 0.0.0.255"))
      .toEqual({ ok: true, ip: "192.168.1.1", cidr: 24 });
  });
  it("defaults to /32 for bare IP", () => {
    expect(parseIpCidr("192.168.1.1")).toEqual({ ok: true, ip: "192.168.1.1", cidr: 32 });
  });
  it("rejects invalid IP", () => {
    expect(parseIpCidr("999.1.1.1/24").ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// IP class & special ranges
// ---------------------------------------------------------------------------

describe("ipv4 class & special detection", () => {
  it("detectIpClass classifies first octet", () => {
    expect(detectIpClass(ipv4ToStringToValue("10.0.0.0"))).toBe("A");
    expect(detectIpClass(ipv4ToStringToValue("128.0.0.0"))).toBe("B");
    expect(detectIpClass(ipv4ToStringToValue("192.0.0.0"))).toBe("C");
    expect(detectIpClass(ipv4ToStringToValue("224.0.0.0"))).toBe("D");
    expect(detectIpClass(ipv4ToStringToValue("240.0.0.0"))).toBe("E");
    expect(detectIpClass(0)).toBe("unclassful");
  });
  it("isPrivateIp detects RFC 1918 ranges", () => {
    expect(isPrivateIp(ipv4ToStringToValue("10.0.0.1"))).toBe(true);
    expect(isPrivateIp(ipv4ToStringToValue("172.16.0.1"))).toBe(true);
    expect(isPrivateIp(ipv4ToStringToValue("172.31.255.255"))).toBe(true);
    expect(isPrivateIp(ipv4ToStringToValue("172.32.0.1"))).toBe(false);
    expect(isPrivateIp(ipv4ToStringToValue("192.168.1.1"))).toBe(true);
    expect(isPrivateIp(ipv4ToStringToValue("8.8.8.8"))).toBe(false);
  });
  it("isLoopbackIp detects 127/8", () => {
    expect(isLoopbackIp(ipv4ToStringToValue("127.0.0.1"))).toBe(true);
    expect(isLoopbackIp(ipv4ToStringToValue("127.255.255.255"))).toBe(true);
    expect(isLoopbackIp(ipv4ToStringToValue("126.0.0.1"))).toBe(false);
  });
  it("isLinkLocalIp detects 169.254/16", () => {
    expect(isLinkLocalIp(ipv4ToStringToValue("169.254.0.1"))).toBe(true);
    expect(isLinkLocalIp(ipv4ToStringToValue("169.253.0.1"))).toBe(false);
  });
  it("isReservedIp covers loopback, link-local, 0/8, 224/4, 240/4, broadcast", () => {
    expect(isReservedIp(ipv4ToStringToValue("127.0.0.1"))).toBe(true);
    expect(isReservedIp(ipv4ToStringToValue("169.254.1.1"))).toBe(true);
    expect(isReservedIp(ipv4ToStringToValue("0.0.0.0"))).toBe(true);
    expect(isReservedIp(ipv4ToStringToValue("224.0.0.1"))).toBe(true);
    expect(isReservedIp(ipv4ToStringToValue("240.0.0.1"))).toBe(true);
    expect(isReservedIp(ipv4ToStringToValue("255.255.255.255"))).toBe(true);
    expect(isReservedIp(ipv4ToStringToValue("8.8.8.8"))).toBe(false);
  });
});

// helper for tests: parse "1.2.3.4" → 32-bit value
function ipv4ToStringToValue(s: string): number {
  const r = parseIPv4(s);
  if (!r.ok) throw new Error("bad ip in test");
  return r.address.value;
}

// ---------------------------------------------------------------------------
// Host counting
// ---------------------------------------------------------------------------

describe("ipv4 computeHostCount & requiredPrefixForHosts", () => {
  it("computeHostCount for /24", () => {
    expect(computeHostCount(24)).toEqual({ hosts: 254, total: 256 });
  });
  it("computeHostCount for /30", () => {
    expect(computeHostCount(30)).toEqual({ hosts: 2, total: 4 });
  });
  it("computeHostCount for /31 (RFC 3021)", () => {
    expect(computeHostCount(31)).toEqual({ hosts: 2, total: 2 });
  });
  it("computeHostCount for /32 (host route)", () => {
    expect(computeHostCount(32)).toEqual({ hosts: 1, total: 1 });
  });
  it("computeHostCount for /0 (whole internet)", () => {
    expect(computeHostCount(0)).toEqual({ hosts: 4294967294, total: 4294967296 });
  });
  it("requiredPrefixForHosts maps host counts to prefixes", () => {
    expect(requiredPrefixForHosts(1)).toBe(32);
    expect(requiredPrefixForHosts(2)).toBe(30);
    expect(requiredPrefixForHosts(14)).toBe(28);
    expect(requiredPrefixForHosts(254)).toBe(24);
    expect(requiredPrefixForHosts(255)).toBe(23);
    expect(requiredPrefixForHosts(65534)).toBe(16);
  });
  it("requiredPrefixForHosts caps at /30 minimum", () => {
    expect(requiredPrefixForHosts(2)).toBe(30);
  });
});

// ---------------------------------------------------------------------------
// Subnet computation
// ---------------------------------------------------------------------------

describe("ipv4 computeSubnet", () => {
  it("computes /24 correctly", () => {
    const s = computeSubnet("192.168.1.100", 24);
    expect(s.networkAddress).toBe("192.168.1.0");
    expect(s.broadcastAddress).toBe("192.168.1.255");
    expect(s.firstHost).toBe("192.168.1.1");
    expect(s.lastHost).toBe("192.168.1.254");
    expect(s.subnetMask).toBe("255.255.255.0");
    expect(s.wildcardMask).toBe("0.0.0.255");
    expect(s.hostCount).toBe(254);
    expect(s.totalAddresses).toBe(256);
    expect(s.ipClass).toBe("C");
    expect(s.isPrivate).toBe(true);
  });
  it("computes /8 correctly", () => {
    const s = computeSubnet("10.0.5.23", 8);
    expect(s.networkAddress).toBe("10.0.0.0");
    expect(s.broadcastAddress).toBe("10.255.255.255");
    expect(s.firstHost).toBe("10.0.0.1");
    expect(s.lastHost).toBe("10.255.255.254");
    expect(s.subnetMask).toBe("255.0.0.0");
    expect(s.hostCount).toBe(16777214);
    expect(s.ipClass).toBe("A");
  });
  it("computes /12 (172.16/12 boundary)", () => {
    const s = computeSubnet("172.16.5.10", 12);
    expect(s.networkAddress).toBe("172.16.0.0");
    expect(s.broadcastAddress).toBe("172.31.255.255");
    expect(s.subnetMask).toBe("255.240.0.0");
    expect(s.wildcardMask).toBe("0.15.255.255");
  });
  it("computes /31 (point-to-point)", () => {
    const s = computeSubnet("192.168.1.0", 31);
    expect(s.networkAddress).toBe("192.168.1.0");
    expect(s.broadcastAddress).toBe("192.168.1.1");
    expect(s.firstHost).toBe("192.168.1.0");
    expect(s.lastHost).toBe("192.168.1.1");
    expect(s.hostCount).toBe(2);
  });
  it("computes /32 (single host)", () => {
    const s = computeSubnet("192.168.1.50", 32);
    expect(s.networkAddress).toBe("192.168.1.50");
    expect(s.broadcastAddress).toBe("192.168.1.50");
    expect(s.firstHost).toBe("192.168.1.50");
    expect(s.lastHost).toBe("192.168.1.50");
    expect(s.hostCount).toBe(1);
  });
  it("computes /0 (default route)", () => {
    const s = computeSubnet("192.168.1.1", 0);
    expect(s.networkAddress).toBe("0.0.0.0");
    expect(s.broadcastAddress).toBe("255.255.255.255");
    expect(s.hostCount).toBe(4294967294);
  });
  it("produces 32-bit binary strings", () => {
    const s = computeSubnet("192.168.1.0", 24);
    expect(s.networkBinary).toHaveLength(32);
    expect(s.networkBinary).toBe("11000000101010000000000100000000");
    expect(s.maskBinary).toBe("1".repeat(24) + "0".repeat(8));
  });
  it("throws on invalid IP or CIDR", () => {
    expect(() => computeSubnet("999.1.1.1", 24)).toThrow();
    expect(() => computeSubnet("192.168.1.1", -1)).toThrow();
    expect(() => computeSubnet("192.168.1.1", 33)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Even split
// ---------------------------------------------------------------------------

describe("ipv4 splitSubnet", () => {
  it("splits /24 into 4 equal /26s", () => {
    const r = splitSubnet("192.168.1.0", 24, 4);
    expect(r.newPrefix).toBe(26);
    expect(r.count).toBe(4);
    expect(r.subnets).toHaveLength(4);
    expect(r.subnets[0].networkAddress).toBe("192.168.1.0");
    expect(r.subnets[1].networkAddress).toBe("192.168.1.64");
    expect(r.subnets[2].networkAddress).toBe("192.168.1.128");
    expect(r.subnets[3].networkAddress).toBe("192.168.1.192");
    expect(r.subnets[0].cidr).toBe(26);
    expect(r.subnets[0].hostCount).toBe(62);
  });
  it("splits /8 into 2 equal /9s", () => {
    const r = splitSubnet("10.0.0.0", 8, 2);
    expect(r.newPrefix).toBe(9);
    expect(r.subnets).toHaveLength(2);
    expect(r.subnets[0].networkAddress).toBe("10.0.0.0");
    expect(r.subnets[1].networkAddress).toBe("10.128.0.0");
  });
  it("rounds up count to next power of 2", () => {
    const r = splitSubnet("192.168.1.0", 24, 3);
    expect(r.count).toBe(4);
    expect(r.subnets).toHaveLength(4);
  });
  it("errors when split would exceed /32", () => {
    // /31 split into 4 → needs /33 which is impossible.
    const r = splitSubnet("192.168.1.0", 31, 4);
    expect(r.error).toBeDefined();
    expect(r.subnets).toHaveLength(0);
  });
  it("throws on count < 1", () => {
    expect(() => splitSubnet("192.168.1.0", 24, 0)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// VLSM
// ---------------------------------------------------------------------------

describe("ipv4 alignUp", () => {
  it("aligns address up to block boundary", () => {
    expect(alignUp(0, 256)).toBe(0);
    expect(alignUp(1, 256)).toBe(256);
    expect(alignUp(100, 64)).toBe(128);
    expect(alignUp(128, 64)).toBe(128);
    expect(alignUp(129, 64)).toBe(192);
  });
});

describe("ipv4 allocateVlsm", () => {
  it("allocates subnets best-fit within parent /24", () => {
    const r = allocateVlsm("192.168.1.0", 24, [
      { name: "LAN-A", hosts: 50 },
      { name: "LAN-B", hosts: 25 },
      { name: "MGMT", hosts: 5 },
    ]);
    expect(r.fits).toBe(true);
    expect(r.subnets).toHaveLength(3);
    // Largest first: LAN-A (50 hosts → /26), LAN-B (25 → /27), MGMT (5 → /29)
    const a = r.subnets.find((s) => s.name === "LAN-A");
    const b = r.subnets.find((s) => s.name === "LAN-B");
    const m = r.subnets.find((s) => s.name === "MGMT");
    expect(a?.cidr).toBe(26);
    expect(a?.networkAddress).toBe("192.168.1.0");
    expect(b?.cidr).toBe(27);
    expect(b?.networkAddress).toBe("192.168.1.64");
    expect(m?.cidr).toBe(29);
    expect(m?.networkAddress).toBe("192.168.1.96");
  });
  it("reports waste in each subnet", () => {
    const r = allocateVlsm("192.168.1.0", 24, [{ name: "X", hosts: 50 }]);
    expect(r.subnets[0].cidr).toBe(26);
    expect(r.subnets[0].allocatedHosts).toBe(62);
    expect(r.subnets[0].waste).toBe(12); // 62 − 50
  });
  it("flags overflow when requirements exceed parent", () => {
    const r = allocateVlsm("192.168.1.0", 28, [
      { name: "BIG", hosts: 100 },
    ]);
    expect(r.fits).toBe(false);
    expect(r.subnets.some((s) => s.overflow)).toBe(true);
  });
  it("handles empty requirements", () => {
    const r = allocateVlsm("192.168.1.0", 24, []);
    expect(r.subnets).toEqual([]);
    expect(r.fits).toBe(true);
    expect(r.wastePercent).toBe(100);
  });
  it("wastePercent is between 0 and 100 for fitting allocations", () => {
    const r = allocateVlsm("192.168.1.0", 24, [
      { name: "A", hosts: 100 },
      { name: "B", hosts: 50 },
    ]);
    expect(r.wastePercent).toBeGreaterThanOrEqual(0);
    expect(r.wastePercent).toBeLessThanOrEqual(100);
  });
});

// ---------------------------------------------------------------------------
// Containment / overlap
// ---------------------------------------------------------------------------

describe("ipv4 checkContainment", () => {
  it("block1 contains block2 when block2 is a subnet", () => {
    const r = checkContainment("192.168.1.0", 24, "192.168.1.128", 25);
    expect(r.block1ContainsBlock2).toBe(true);
    expect(r.block2ContainsBlock1).toBe(false);
    expect(r.overlap).toBe(true);
    expect(r.identical).toBe(false);
  });
  it("no overlap between disjoint blocks", () => {
    const r = checkContainment("192.168.1.0", 24, "10.0.0.0", 8);
    expect(r.overlap).toBe(false);
    expect(r.block1ContainsBlock2).toBe(false);
    expect(r.block2ContainsBlock1).toBe(false);
  });
  it("identical blocks report identical and mutual containment", () => {
    const r = checkContainment("192.168.1.0", 24, "192.168.1.50", 24);
    expect(r.identical).toBe(true);
    expect(r.block1ContainsBlock2).toBe(true);
    expect(r.block2ContainsBlock1).toBe(true);
    expect(r.overlap).toBe(true);
  });
  it("overlapping but neither contains", () => {
    // 192.168.0.0/23 covers .0–.255 of 192.168.0 and 192.168.1
    // 192.168.1.0/24 covers .0–.255 of 192.168.1
    // 192.168.0.0/23 contains 192.168.1.0/24 — let's pick a true partial overlap:
    // /23 starting at 192.168.1.0 actually aligns to 192.168.0.0/23.
    // Use 10.0.0.0/24 and 10.0.0.128/25 → containment.
    // For overlap-without-containment we need non-aligned blocks, which isn't
    // possible with CIDR (CIDR blocks are always aligned). So this case is
    // impossible by construction; instead verify two same-prefix disjoint blocks.
    const r = checkContainment("192.168.1.0", 25, "192.168.1.128", 25);
    expect(r.overlap).toBe(false); // adjacent but not overlapping
    expect(r.block1ContainsBlock2).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// VLSM requirements parsing
// ---------------------------------------------------------------------------

describe("ipv4 parseVlsmRequirements", () => {
  it("parses newline-separated requirements", () => {
    const r = parseVlsmRequirements("LAN-A 50\nLAN-B 25\nMGMT 5");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.reqs).toEqual([
        { name: "LAN-A", hosts: 50 },
        { name: "LAN-B", hosts: 25 },
        { name: "MGMT", hosts: 5 },
      ]);
    }
  });
  it("parses comma-separated requirements", () => {
    const r = parseVlsmRequirements("LAN 50, WIFI 25");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.reqs).toHaveLength(2);
  });
  it("accepts colon and pipe separators", () => {
    const r = parseVlsmRequirements("LAN:50|WIFI:25");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.reqs).toHaveLength(2);
  });
  it("rejects invalid host count", () => {
    expect(parseVlsmRequirements("LAN abc").ok).toBe(false);
    expect(parseVlsmRequirements("LAN 0").ok).toBe(false);
    expect(parseVlsmRequirements("LAN -5").ok).toBe(false);
  });
  it("rejects empty input", () => {
    expect(parseVlsmRequirements("").ok).toBe(false);
    expect(parseVlsmRequirements("   \n  ").ok).toBe(false);
  });
  it("rejects missing host count", () => {
    expect(parseVlsmRequirements("LAN").ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// CSV / JSON export
// ---------------------------------------------------------------------------

describe("ipv4 CSV / JSON export", () => {
  it("renderVlsmCsv has headers and rows", () => {
    const r = allocateVlsm("192.168.1.0", 24, [{ name: "X", hosts: 10 }]);
    const csv = renderVlsmCsv(r.subnets);
    expect(csv).toContain("name,required_hosts,cidr");
    expect(csv).toContain("X,10,28");
  });
  it("renderSplitCsv has headers and rows", () => {
    const r = splitSubnet("192.168.1.0", 24, 4);
    const csv = renderSplitCsv(r.subnets);
    expect(csv).toContain("index,cidr,network,broadcast");
    expect(csv).toContain("0,26,192.168.1.0");
  });
  it("renderJson returns valid JSON", () => {
    const r = splitSubnet("192.168.1.0", 24, 2);
    const json = renderJson(r);
    expect(() => JSON.parse(json)).not.toThrow();
    const parsed = JSON.parse(json);
    expect(parsed.count).toBe(2);
  });
  it("renderVlsmCsv escapes commas in names", () => {
    const r = allocateVlsm("192.168.1.0", 24, [{ name: "LAN, A", hosts: 5 }]);
    const csv = renderVlsmCsv(r.subnets);
    expect(csv).toContain('"LAN, A"');
  });
});

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

describe("ipv4 history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads entries", () => {
    saveHistory({ ts: 1, mode: "subnet", input: "192.168.1.1/24", summary: "192.168.1.0/24" });
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0].input).toBe("192.168.1.1/24");
  });
  it("caps at 20 entries", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, mode: "subnet", input: String(i), summary: "x" });
    }
    expect(loadHistory()).toHaveLength(20);
    expect(loadHistory()[0].input).toBe("24"); // most-recent-first
  });
  it("clears history", () => {
    saveHistory({ ts: 1, mode: "subnet", input: "x", summary: "y" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Shareable URL
// ---------------------------------------------------------------------------

describe("ipv4 shareable URL", () => {
  it("builds a share URL when window is unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("vlsm", "10.0.0.0", 24, { count: 4, vlsm: "LAN 50" });
    expect(url).toContain("mode=vlsm");
    expect(url).toContain("ip=10.0.0.0");
    expect(url).toContain("cidr=24");
    expect(url).toContain("count=4");
    expect(url).toContain("vlsm=LAN+50");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parseShareUrl round-trips", () => {
    const p = parseShareUrl("mode=split&ip=192.168.1.0&cidr=24&count=8");
    expect(p.mode).toBe("split");
    expect(p.ip).toBe("192.168.1.0");
    expect(p.cidr).toBe(24);
    expect(p.count).toBe(8);
  });
  it("parseShareUrl returns defaults for empty hash", () => {
    const p = parseShareUrl("");
    expect(p.mode).toBe("subnet");
    expect(p.ip).toBe("192.168.1.1");
    expect(p.cidr).toBe(24);
  });
  it("parseShareUrl coerces invalid values to defaults", () => {
    const p = parseShareUrl("mode=bogus&cidr=99&count=-1");
    expect(p.mode).toBe("subnet");
    expect(p.cidr).toBe(24);
    expect(p.count).toBe(4);
  });
});

// Suppress unused-import lint for re-exported types.
export type _Unused = SubnetToolMode;
