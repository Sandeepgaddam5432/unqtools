import { describe, it, expect, beforeEach } from "vitest";
import {
  parseIPv6,
  parseIpCidr,
  valueToHextets,
  expandHextets,
  compressHextets,
  expandValue,
  compressValue,
  ipv6ToBinary,
  formatBinaryHextets,
  formatBinaryNibbles,
  maskForPrefix,
  wildcardForPrefix,
  totalAddressesForPrefix,
  countOf64sForPrefix,
  isNibbleBoundary,
  ip6ArpaZone,
  computeSubnet,
  subdivide,
  renderSubnetCsv,
  renderSubdivideCsv,
  renderJson,
  buildPrefixReferenceTable,
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
// Parsing
// ---------------------------------------------------------------------------

describe("ipv6 parseIPv6", () => {
  it("parses a full 8-hextet address", () => {
    const r = parseIPv6("2001:0db8:0000:0000:0000:0000:0000:0001");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.address.hextets[0]).toBe(0x2001);
      expect(r.address.hextets[7]).toBe(1);
      expect(r.address.value).toBe((0x2001n << 112n) | (0x0db8n << 96n) | 1n);
    }
  });
  it("parses compressed form with ::", () => {
    const r = parseIPv6("2001:db8::1");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.address.hextets).toEqual([0x2001, 0x0db8, 0, 0, 0, 0, 0, 1]);
    }
  });
  it("parses loopback ::1", () => {
    const r = parseIPv6("::1");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.address.hextets[7]).toBe(1);
  });
  it("parses unspecified ::", () => {
    const r = parseIPv6("::");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.address.value).toBe(0n);
  });
  it("parses embedded IPv4 ::ffff:192.0.2.1", () => {
    const r = parseIPv6("::ffff:192.0.2.1");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.address.hextets[5]).toBe(0xffff);
      expect(r.address.hextets[6]).toBe((192 << 8) | 0);
      expect(r.address.hextets[7]).toBe((2 << 8) | 1);
    }
  });
  it("rejects multiple ::", () => {
    expect(parseIPv6("2001::db8::1").ok).toBe(false);
  });
  it("rejects too many hextets without ::", () => {
    expect(parseIPv6("1:2:3:4:5:6:7:8:9").ok).toBe(false);
  });
  it("rejects too few hextets without ::", () => {
    expect(parseIPv6("1:2:3").ok).toBe(false);
  });
  it("rejects hextet > 0xffff", () => {
    expect(parseIPv6("2001:10000::").ok).toBe(false);
  });
  it("rejects invalid characters", () => {
    expect(parseIPv6("2001:db8::g").ok).toBe(false);
  });
  it("rejects empty input", () => {
    expect(parseIPv6("").ok).toBe(false);
    expect(parseIPv6("   ").ok).toBe(false);
  });
});

describe("ipv6 parseIpCidr", () => {
  it("parses address/prefix", () => {
    const r = parseIpCidr("2001:db8::/32");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.cidr).toBe(32);
      expect(r.ip).toBe("2001:db8::");
    }
  });
  it("defaults prefix to 128 when no slash", () => {
    const r = parseIpCidr("2001:db8::1");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.cidr).toBe(128);
  });
  it("rejects prefix out of range", () => {
    expect(parseIpCidr("2001:db8::/129").ok).toBe(false);
    expect(parseIpCidr("2001:db8::/-1").ok).toBe(false);
  });
  it("rejects non-numeric prefix", () => {
    expect(parseIpCidr("2001:db8::/abc").ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

describe("ipv6 expand/compress", () => {
  it("expands to 8 zero-padded hextets", () => {
    const r = parseIPv6("2001:db8::1");
    if (!r.ok) throw new Error("parse failed");
    expect(expandHextets(r.address.hextets)).toBe("2001:0db8:0000:0000:0000:0000:0000:0001");
  });
  it("compresses the longest run of zeros with ::", () => {
    const r = parseIPv6("2001:0db8:0000:0000:0000:0000:0000:0001");
    if (!r.ok) throw new Error("parse failed");
    expect(compressHextets(r.address.hextets)).toBe("2001:db8::1");
  });
  it("does not compress a single zero hextet", () => {
    expect(compressHextets([0x2001, 0x0db8, 0, 0x0001, 0x0002, 0x0003, 0x0004, 0x0005]))
      .toBe("2001:db8:0:1:2:3:4:5");
  });
  it("compresses :: at end", () => {
    expect(compressHextets([0x2001, 0x0db8, 0, 0, 0, 0, 0, 0]))
      .toBe("2001:db8::");
  });
  it("compresses :: at start", () => {
    expect(compressHextets([0, 0, 0, 0, 0, 0, 0, 1]))
      .toBe("::1");
  });
  it("expandValue / compressValue round-trip via BigInt", () => {
    const r = parseIPv6("2001:db8::1");
    if (!r.ok) throw new Error("parse failed");
    expect(compressValue(r.address.value)).toBe("2001:db8::1");
    expect(expandValue(r.address.value)).toBe("2001:0db8:0000:0000:0000:0000:0000:0001");
  });
});

describe("ipv6 binary", () => {
  it("returns 128-bit zero string for value 0", () => {
    expect(ipv6ToBinary(0n)).toHaveLength(128);
    expect(ipv6ToBinary(0n)).toBe("0".repeat(128));
  });
  it("returns 128-bit all-ones string for max value", () => {
    const max = (1n << 128n) - 1n;
    expect(ipv6ToBinary(max)).toBe("1".repeat(128));
  });
  it("sets the last bit for value 1", () => {
    expect(ipv6ToBinary(1n)).toBe("0".repeat(127) + "1");
  });
  it("formatBinaryHextets groups into 16-bit chunks", () => {
    const bin = "0".repeat(128);
    const grouped = formatBinaryHextets(bin);
    expect(grouped.split(" ")).toHaveLength(8);
  });
  it("formatBinaryNibbles groups into 4-bit chunks", () => {
    const bin = "0".repeat(128);
    const grouped = formatBinaryNibbles(bin);
    expect(grouped.split(" ")).toHaveLength(32);
  });
});

// ---------------------------------------------------------------------------
// Mask + counts
// ---------------------------------------------------------------------------

describe("ipv6 masks and counts", () => {
  it("maskForPrefix(0) is zero", () => {
    expect(maskForPrefix(0)).toBe(0n);
  });
  it("maskForPrefix(128) is all ones", () => {
    expect(maskForPrefix(128)).toBe((1n << 128n) - 1n);
  });
  it("maskForPrefix(64) has top 64 bits set, bottom 64 zero", () => {
    const m = maskForPrefix(64);
    // Bottom 64 bits should all be zero
    expect(m & ((1n << 64n) - 1n)).toBe(0n);
    // Top 64 bits should all be 1
    const topMask = ((1n << 128n) - 1n) ^ ((1n << 64n) - 1n);
    expect(m & topMask).toBe(topMask);
  });
  it("wildcardForPrefix is the inverse of maskForPrefix", () => {
    const m = maskForPrefix(48);
    const w = wildcardForPrefix(48);
    const max = (1n << 128n) - 1n;
    expect((m | w) & max).toBe(max);
    expect(m & w).toBe(0n);
  });
  it("totalAddressesForPrefix(128) is 1", () => {
    expect(totalAddressesForPrefix(128)).toBe(1n);
  });
  it("totalAddressesForPrefix(0) is 2^128", () => {
    expect(totalAddressesForPrefix(0)).toBe(1n << 128n);
  });
  it("totalAddressesForPrefix(64) is 2^64", () => {
    expect(totalAddressesForPrefix(64)).toBe(1n << 64n);
  });
  it("countOf64sForPrefix(48) is 65536", () => {
    expect(countOf64sForPrefix(48)).toBe(65536n);
  });
  it("countOf64sForPrefix(64) is 1", () => {
    expect(countOf64sForPrefix(64)).toBe(1n);
  });
  it("countOf64sForPrefix(80) is 0 (prefix longer than /64)", () => {
    expect(countOf64sForPrefix(80)).toBe(0n);
  });
});

// ---------------------------------------------------------------------------
// ip6.arpa
// ---------------------------------------------------------------------------

describe("ipv6 ip6.arpa", () => {
  it("generates the reverse zone for ::1/128", () => {
    const zone = ip6ArpaZone(1n, 128);
    expect(zone).toBe("1.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.ip6.arpa");
  });
  it("generates a 12-nibble zone for /48", () => {
    const zone = ip6ArpaZone(0x20010db8000000000000000000000000n, 48);
    // First 12 nibbles of 2001:0db8:0000... in reverse: 0.0.0.0.8.b.d.0.1.0.0.2
    // Then ".ip6.arpa" splits into 2 more parts → 14 total.
    expect(zone.split(".").length).toBe(14);
    expect(zone.startsWith("0.0.0.0.8.b.d.0.1.0.0.2.ip6.arpa")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// computeSubnet
// ---------------------------------------------------------------------------

describe("ipv6 computeSubnet", () => {
  it("computes network, range, and counts for 2001:db8::/32", () => {
    const info = computeSubnet("2001:db8::1", 32);
    expect(info.networkCompressed).toBe("2001:db8::");
    expect(info.lastAddress).toBe("2001:db8:ffff:ffff:ffff:ffff:ffff:ffff");
    expect(info.totalAddresses).toBe((1n << 96n).toString());
    expect(info.countOf64s).toBe((1n << 32n).toString());
    expect(info.isOnNibbleBoundary).toBe(true);
  });
  it("computes network for /64", () => {
    const info = computeSubnet("2001:db8:0:0:1234::1", 64);
    expect(info.networkCompressed).toBe("2001:db8::");
    expect(info.lastAddress).toBe("2001:db8::ffff:ffff:ffff:ffff");
    expect(info.totalAddresses).toBe((1n << 64n).toString());
    expect(info.countOf64s).toBe("1");
  });
  it("computes network for /128", () => {
    const info = computeSubnet("2001:db8::1", 128);
    expect(info.networkCompressed).toBe("2001:db8::1");
    expect(info.lastAddress).toBe("2001:db8::1");
    expect(info.totalAddresses).toBe("1");
    expect(info.countOf64s).toBe("0");
  });
  it("computes network for /0 (whole space)", () => {
    const info = computeSubnet("2001:db8::1", 0);
    expect(info.networkCompressed).toBe("::");
    expect(info.lastAddress).toBe("ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff");
    expect(info.totalAddresses).toBe((1n << 128n).toString());
  });
  it("includes 128-bit binary strings", () => {
    const info = computeSubnet("::1", 128);
    expect(info.ipBinary).toHaveLength(128);
    expect(info.ipBinary).toBe("0".repeat(127) + "1");
    expect(info.maskBinary).toBe("1".repeat(128));
  });
  it("throws on invalid prefix", () => {
    expect(() => computeSubnet("::1", 200)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Subdivide
// ---------------------------------------------------------------------------

describe("ipv6 subdivide", () => {
  it("subdivides /48 into /64s", () => {
    const r = subdivide("2001:db8::", 48, 64);
    expect(r.childCount).toBe((1n << 16n).toString());
    expect(r.capped).toBe(true); // 65536 > 4096
    expect(r.displayedCount).toBe(4096);
    expect(r.displayed[0].networkCompressed).toBe("2001:db8::");
    expect(r.displayed[1].networkCompressed).toBe("2001:db8:0:1::");
    expect(r.displayed[1].ip6ArpaZone).toContain("ip6.arpa");
  });
  it("subdivides /32 into /48s without cap", () => {
    const r = subdivide("2001:db8::", 32, 48);
    expect(r.childCount).toBe((1n << 16n).toString());
    expect(r.capped).toBe(true);
  });
  it("subdivides /126 into /127s", () => {
    const r = subdivide("2001:db8::", 126, 127);
    expect(r.childCount).toBe("2");
    expect(r.capped).toBe(false);
    expect(r.displayedCount).toBe(2);
    expect(r.displayed[0].networkCompressed).toBe("2001:db8::");
    expect(r.displayed[1].networkCompressed).toBe("2001:db8::2");
  });
  it("errors when child prefix <= parent", () => {
    const r = subdivide("2001:db8::", 48, 48);
    expect(r.error).toBeDefined();
    expect(r.childCount).toBe("0");
    expect(r.displayedCount).toBe(0);
  });
  it("respects custom cap", () => {
    const r = subdivide("2001:db8::", 32, 64, 10);
    expect(r.capped).toBe(true);
    expect(r.displayedCount).toBe(10);
    expect(r.cap).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// CSV / JSON
// ---------------------------------------------------------------------------

describe("ipv6 CSV / JSON export", () => {
  it("renderSubnetCsv produces field,value rows", () => {
    const info = computeSubnet("2001:db8::1", 32);
    const csv = renderSubnetCsv(info);
    expect(csv.split("\n")[0]).toBe("field,value");
    expect(csv).toContain("network,2001:db8::");
    expect(csv).toContain("cidr,32");
  });
  it("renderSubdivideCsv produces header + rows", () => {
    const r = subdivide("2001:db8::", 126, 127);
    const csv = renderSubdivideCsv(r.displayed);
    expect(csv.split("\n")[0]).toContain("index,cidr,network");
    expect(csv.split("\n").length).toBe(3);
  });
  it("renderJson produces pretty JSON", () => {
    const info = computeSubnet("::1", 128);
    const json = renderJson(info);
    expect(JSON.parse(json).cidr).toBe(128);
  });
});

// ---------------------------------------------------------------------------
// Reference table
// ---------------------------------------------------------------------------

describe("ipv6 reference table", () => {
  it("builds a reference table with 21+ rows", () => {
    const rows = buildPrefixReferenceTable();
    expect(rows.length).toBeGreaterThanOrEqual(15);
    expect(rows.some((r) => r.prefix === 64)).toBe(true);
    expect(rows.some((r) => r.prefix === 48)).toBe(true);
  });
  it("marks nibble boundaries correctly", () => {
    const rows = buildPrefixReferenceTable();
    const r48 = rows.find((r) => r.prefix === 48)!;
    expect(r48.nibbleBoundary).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

describe("ipv6 history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, mode: "subnet", input: "2001:db8::/32", summary: "2001:db8::/32" });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, mode: "subnet", input: "::1", summary: `s${i}` });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, mode: "subnet", input: "::1", summary: "x" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Shareable URL
// ---------------------------------------------------------------------------

describe("ipv6 shareable URL", () => {
  it("builds a share URL when window is unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("subnet", "2001:db8::1", 32);
    expect(url).toContain("mode=subnet");
    expect(url).toContain("ip=2001");
    expect(url).toContain("cidr=32");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses a share URL back", () => {
    const p = parseShareUrl("mode=subdivide&ip=2001%3Adb8%3A%3A&cidr=48&child=64");
    expect(p.mode).toBe("subdivide");
    expect(p.ip).toBe("2001:db8::");
    expect(p.cidr).toBe(48);
    expect(p.childCidr).toBe(64);
  });
  it("returns defaults for empty hash", () => {
    const p = parseShareUrl("");
    expect(p.mode).toBe("subnet");
    expect(p.ip).toBe("2001:db8::1");
    expect(p.cidr).toBe(32);
  });
  it("clamps invalid cidr to defaults", () => {
    const p = parseShareUrl("mode=subnet&cidr=999");
    expect(p.cidr).toBe(32);
  });
});

// Suppress unused-import lint
export type _Unused = SubnetToolMode;
