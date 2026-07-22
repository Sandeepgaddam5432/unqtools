import { describe, it, expect, beforeEach } from "vitest";
import {
  parseIPv4,
  parseIPv6,
  ipv4ToString,
  ipv6ToString,
  detectFamily,
  familyBits,
  maskValue,
  wildcardValue,
  cidrAddressCount,
  cidrToString,
  trailingZeros,
  floorLog2,
  parseCidr,
  parseRange,
  parseLine,
  parseInput,
  cidrToInterval,
  intervalToCidrs,
  mergeIntervals,
  subtractIntervals,
  sumIntervalAddresses,
  intervalsToCidrs,
  aggregate,
  renderCidrList,
  renderRangeList,
  renderCiscoAcl,
  renderPfSenseAlias,
  renderNginxAllow,
  renderExport,
  allCidrs,
  formatBig,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  SAMPLE_INPUTS,
  type ExportFormat,
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

// ---- IPv4 / IPv6 parsing ----

describe("cidr-aggregator parseIPv4", () => {
  it("parses dotted-decimal", () => {
    const r = parseIPv4("192.168.1.1");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(BigInt(0xc0a80101));
  });
  it("rejects out-of-range octets", () => {
    expect(parseIPv4("256.1.1.1").ok).toBe(false);
    expect(parseIPv4("1.2.3.-1").ok).toBe(false);
  });
  it("rejects wrong octet count", () => {
    expect(parseIPv4("192.168.1").ok).toBe(false);
    expect(parseIPv4("1.2.3.4.5").ok).toBe(false);
  });
  it("rejects empty", () => {
    expect(parseIPv4("").ok).toBe(false);
  });
});

describe("cidr-aggregator ipv4ToString", () => {
  it("formats a 32-bit value", () => {
    expect(ipv4ToString(BigInt(0xc0a80101))).toBe("192.168.1.1");
    expect(ipv4ToString(BigInt(0))).toBe("0.0.0.0");
    expect(ipv4ToString(BigInt(0xffffffff))).toBe("255.255.255.255");
  });
});

describe("cidr-aggregator parseIPv6", () => {
  it("parses full address", () => {
    const r = parseIPv6("2001:0db8:0000:0000:0000:0000:0000:0001");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(BigInt("0x20010db8000000000000000000000001"));
  });
  it("parses :: compression", () => {
    expect(parseIPv6("::1").ok).toBe(true);
    expect(parseIPv6("::").ok).toBe(true);
    expect(parseIPv6("2001:db8::1").ok).toBe(true);
  });
  it("rejects multiple ::", () => {
    expect(parseIPv6("1::2::3").ok).toBe(false);
  });
  it("rejects invalid chars", () => {
    expect(parseIPv6("2001:db8::gg").ok).toBe(false);
  });
  it("parses embedded IPv4", () => {
    const r = parseIPv6("::ffff:192.168.1.1");
    expect(r.ok).toBe(true);
  });
});

describe("cidr-aggregator ipv6ToString", () => {
  it("compresses longest zero run", () => {
    expect(ipv6ToString(BigInt(0))).toBe("::");
    expect(ipv6ToString(BigInt(1))).toBe("::1");
    expect(ipv6ToString(BigInt(0x20010db8) << BigInt(96))).toBe("2001:db8::");
  });
  it("no compression when no zero run >= 2", () => {
    expect(ipv6ToString(BigInt("0x20010db8000000000000000000000001"))).toBe("2001:db8::1");
  });
});

// ---- Family detection & mask helpers ----

describe("cidr-aggregator detectFamily", () => {
  it("detects IPv4", () => {
    expect(detectFamily("192.168.1.1")).toBe("ipv4");
  });
  it("detects IPv6", () => {
    expect(detectFamily("2001:db8::1")).toBe("ipv6");
  });
});

describe("cidr-aggregator mask / wildcard / count", () => {
  it("IPv4 mask /24", () => {
    expect(maskValue(24, "ipv4")).toBe(BigInt(0xffffff00));
    expect(wildcardValue(24, "ipv4")).toBe(BigInt(0xff));
  });
  it("IPv4 mask /0 and /32", () => {
    expect(maskValue(0, "ipv4")).toBe(BigInt(0));
    expect(maskValue(32, "ipv4")).toBe(BigInt(0xffffffff));
  });
  it("IPv6 mask /64", () => {
    expect(maskValue(64, "ipv6")).toBe(BigInt("0xffffffffffffffff0000000000000000"));
  });
  it("cidrAddressCount /24 = 256", () => {
    expect(cidrAddressCount(24, "ipv4")).toBe(BigInt(256));
  });
  it("cidrAddressCount /0 = 2^32", () => {
    expect(cidrAddressCount(0, "ipv4")).toBe(BigInt(4294967296));
  });
  it("cidrAddressCount ::/0 = 2^128", () => {
    expect(cidrAddressCount(0, "ipv6")).toBe(BigInt(1) << BigInt(128));
  });
  it("familyBits returns correct bit width", () => {
    expect(familyBits("ipv4")).toBe(32);
    expect(familyBits("ipv6")).toBe(128);
  });
});

// ---- Bit-twiddling helpers ----

describe("cidr-aggregator trailingZeros", () => {
  it("counts trailing zeros", () => {
    expect(trailingZeros(BigInt(0b10100), 32)).toBe(2);
    expect(trailingZeros(BigInt(0b10101), 32)).toBe(0);
    expect(trailingZeros(BigInt(0), 32)).toBe(32);
  });
});

describe("cidr-aggregator floorLog2", () => {
  it("floors log2", () => {
    expect(floorLog2(BigInt(1))).toBe(0);
    expect(floorLog2(BigInt(2))).toBe(1);
    expect(floorLog2(BigInt(7))).toBe(2);
    expect(floorLog2(BigInt(8))).toBe(3);
    expect(floorLog2(BigInt(256))).toBe(8);
    expect(floorLog2(BigInt(0))).toBe(-1);
  });
});

// ---- CIDR & range parsing ----

describe("cidr-aggregator parseCidr", () => {
  it("parses IPv4 CIDR", () => {
    const r = parseCidr("192.168.1.0/24");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.block.family).toBe("ipv4");
      expect(r.block.network).toBe(BigInt(0xc0a80100));
      expect(r.block.prefix).toBe(24);
    }
  });
  it("network-aligns non-aligned CIDR", () => {
    const r = parseCidr("192.168.1.50/24");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.block.network).toBe(BigInt(0xc0a80100));
  });
  it("parses IPv6 CIDR", () => {
    const r = parseCidr("2001:db8::/32");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.block.prefix).toBe(32);
  });
  it("rejects out-of-range prefix", () => {
    expect(parseCidr("1.2.3.4/33").ok).toBe(false);
    expect(parseCidr("2001:db8::/129").ok).toBe(false);
  });
  it("rejects missing slash", () => {
    expect(parseCidr("192.168.1.0").ok).toBe(false);
  });
});

describe("cidr-aggregator parseRange", () => {
  it("parses IPv4 range", () => {
    const r = parseRange("10.0.0.5-10.0.0.10");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.interval.start).toBe(BigInt(0x0a000005));
      expect(r.interval.end).toBe(BigInt(0x0a00000a));
    }
  });
  it("rejects reversed range", () => {
    expect(parseRange("10.0.0.10-10.0.0.5").ok).toBe(false);
  });
  it("rejects mixed-family endpoints", () => {
    expect(parseRange("10.0.0.0-2001:db8::1").ok).toBe(false);
  });
  it("supports en-dash separator", () => {
    const r = parseRange("10.0.0.5–10.0.0.10");
    expect(r.ok).toBe(true);
  });
});

describe("cidr-aggregator parseLine", () => {
  it("parses a bare IP", () => {
    const r = parseLine("192.168.1.1", 1);
    expect(r.ok).toBe(true);
    if (r.ok && r.interval) {
      expect(r.interval.start).toBe(r.interval.end);
      expect(r.interval.start).toBe(BigInt(0xc0a80101));
    }
  });
  it("parses a CIDR", () => {
    const r = parseLine("10.0.0.0/24", 1);
    expect(r.ok).toBe(true);
    if (r.ok && r.interval) expect(r.interval.end - r.interval.start + BigInt(1)).toBe(BigInt(256));
  });
  it("parses a range", () => {
    const r = parseLine("10.0.0.5-10.0.0.7", 1);
    expect(r.ok).toBe(true);
    if (r.ok && r.interval) expect(r.interval.end - r.interval.start + BigInt(1)).toBe(BigInt(3));
  });
  it("skips empty lines", () => {
    expect(parseLine("", 1).ok).toBe(false);
    expect(parseLine("   ", 1).ok).toBe(false);
  });
  it("skips comments", () => {
    expect(parseLine("# comment", 1).ok).toBe(false);
    expect(parseLine("; comment", 1).ok).toBe(false);
  });
  it("records errors for invalid lines", () => {
    const r = parseLine("not-an-ip", 1);
    expect(r.ok).toBe(false);
    expect(r.error).toBeDefined();
  });
});

describe("cidr-aggregator parseInput", () => {
  it("parses multi-line input", () => {
    const r = parseInput("10.0.0.0/24\n10.0.1.0/24\n# comment\n\nbad-line");
    expect(r.intervals).toHaveLength(2);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0].index).toBe(5);
  });
});

// ---- CIDR ↔ interval conversion ----

describe("cidr-aggregator cidrToInterval", () => {
  it("computes interval for /24", () => {
    const iv = cidrToInterval({ family: "ipv4", network: BigInt(0xc0a80100), prefix: 24 });
    expect(iv.start).toBe(BigInt(0xc0a80100));
    expect(iv.end).toBe(BigInt(0xc0a801ff));
  });
  it("computes interval for /0", () => {
    const iv = cidrToInterval({ family: "ipv4", network: BigInt(0), prefix: 0 });
    expect(iv.start).toBe(BigInt(0));
    expect(iv.end).toBe(BigInt(0xffffffff));
  });
});

describe("cidr-aggregator intervalToCidrs", () => {
  it("decomposes a /24 range to a single /24", () => {
    const cidrs = intervalToCidrs({ family: "ipv4", start: BigInt(0xc0a80100), end: BigInt(0xc0a801ff) });
    expect(cidrs).toHaveLength(1);
    expect(cidrs[0].prefix).toBe(24);
  });
  it("decomposes an unaligned range", () => {
    // 10.0.0.5 - 10.0.0.10 = /29 + /30 + 2 singles? Let's verify count and coverage.
    const cidrs = intervalToCidrs({ family: "ipv4", start: BigInt(0x0a000005), end: BigInt(0x0a00000a) });
    // Reconstruct interval and check equality.
    let start = BigInt(0x0a000005);
    const end = BigInt(0x0a00000a);
    for (const c of cidrs) {
      expect(c.network).toBe(start);
      const size = cidrAddressCount(c.prefix, "ipv4");
      start += size;
    }
    expect(start - BigInt(1)).toBe(end);
  });
  it("decomposes 0.0.0.0 - 255.255.255.255 to a single /0", () => {
    const cidrs = intervalToCidrs({ family: "ipv4", start: BigInt(0), end: BigInt(0xffffffff) });
    expect(cidrs).toHaveLength(1);
    expect(cidrs[0].prefix).toBe(0);
  });
});

describe("cidr-aggregator mergeIntervals", () => {
  it("merges overlapping", () => {
    const merged = mergeIntervals([
      { family: "ipv4", start: BigInt(0), end: BigInt(99) },
      { family: "ipv4", start: BigInt(50), end: BigInt(150) },
    ]);
    expect(merged).toEqual([{ family: "ipv4", start: BigInt(0), end: BigInt(150) }]);
  });
  it("merges adjacent", () => {
    const merged = mergeIntervals([
      { family: "ipv4", start: BigInt(0), end: BigInt(99) },
      { family: "ipv4", start: BigInt(100), end: BigInt(199) },
    ]);
    expect(merged).toEqual([{ family: "ipv4", start: BigInt(0), end: BigInt(199) }]);
  });
  it("keeps non-adjacent separate", () => {
    const merged = mergeIntervals([
      { family: "ipv4", start: BigInt(0), end: BigInt(99) },
      { family: "ipv4", start: BigInt(200), end: BigInt(299) },
    ]);
    expect(merged).toHaveLength(2);
  });
  it("dedupes identical", () => {
    const merged = mergeIntervals([
      { family: "ipv4", start: BigInt(0), end: BigInt(99) },
      { family: "ipv4", start: BigInt(0), end: BigInt(99) },
    ]);
    expect(merged).toHaveLength(1);
  });
  it("handles empty list", () => {
    expect(mergeIntervals([])).toEqual([]);
  });
});

describe("cidr-aggregator subtractIntervals", () => {
  it("subtracts a middle hole (splits interval)", () => {
    const result = subtractIntervals(
      [{ family: "ipv4", start: BigInt(0), end: BigInt(99) }],
      [{ family: "ipv4", start: BigInt(30), end: BigInt(60) }],
    );
    expect(result).toEqual([
      { family: "ipv4", start: BigInt(0), end: BigInt(29) },
      { family: "ipv4", start: BigInt(61), end: BigInt(99) },
    ]);
  });
  it("subtracts a prefix", () => {
    const result = subtractIntervals(
      [{ family: "ipv4", start: BigInt(0), end: BigInt(99) }],
      [{ family: "ipv4", start: BigInt(0), end: BigInt(30) }],
    );
    expect(result).toEqual([{ family: "ipv4", start: BigInt(31), end: BigInt(99) }]);
  });
  it("subtracts a suffix", () => {
    const result = subtractIntervals(
      [{ family: "ipv4", start: BigInt(0), end: BigInt(99) }],
      [{ family: "ipv4", start: BigInt(70), end: BigInt(99) }],
    );
    expect(result).toEqual([{ family: "ipv4", start: BigInt(0), end: BigInt(69) }]);
  });
  it("no-op when no overlap", () => {
    const result = subtractIntervals(
      [{ family: "ipv4", start: BigInt(0), end: BigInt(99) }],
      [{ family: "ipv4", start: BigInt(200), end: BigInt(300) }],
    );
    expect(result).toHaveLength(1);
    expect(result[0].start).toBe(BigInt(0));
  });
  it("empties interval when fully covered", () => {
    const result = subtractIntervals(
      [{ family: "ipv4", start: BigInt(50), end: BigInt(60) }],
      [{ family: "ipv4", start: BigInt(0), end: BigInt(99) }],
    );
    expect(result).toEqual([]);
  });
});

describe("cidr-aggregator sumIntervalAddresses", () => {
  it("sums addresses", () => {
    expect(sumIntervalAddresses([
      { family: "ipv4", start: BigInt(0), end: BigInt(99) },
      { family: "ipv4", start: BigInt(200), end: BigInt(299) },
    ])).toBe(BigInt(200));
  });
});

// ---- Aggregate function ----

describe("cidr-aggregator aggregate", () => {
  it("merges two /24s into a /23", () => {
    const result = aggregate("192.168.0.0/24\n192.168.1.0/24");
    expect(result.ipv4).not.toBeNull();
    expect(result.ipv4!.cidrs).toHaveLength(1);
    expect(result.ipv4!.cidrs[0].prefix).toBe(23);
    expect(result.ipv4!.cidrs[0].network).toBe(BigInt(0xc0a80000));
  });
  it("dedupes overlapping CIDRs", () => {
    const result = aggregate("10.0.0.0/24\n10.0.0.0/25\n10.0.0.50");
    expect(result.ipv4!.cidrs).toHaveLength(1);
    expect(result.ipv4!.cidrs[0].prefix).toBe(24);
  });
  it("merges 4 /24s into a /22", () => {
    const result = aggregate("172.16.0.0/24\n172.16.1.0/24\n172.16.2.0/24\n172.16.3.0/24");
    expect(result.ipv4!.cidrs).toHaveLength(1);
    expect(result.ipv4!.cidrs[0].prefix).toBe(22);
  });
  it("handles exclusion splitting a /24 around a /28", () => {
    const result = aggregate("192.168.10.0/24", "192.168.10.16/28");
    // 0-15 (/28) + 32-255 = /28 + /27 + /28
    // 192.168.10.0/28 (0-15), 192.168.10.32/27 (32-63), 192.168.10.64/26 (64-127), 192.168.10.128/25 (128-255)
    expect(result.ipv4!.cidrs.length).toBeGreaterThan(1);
    // Verify total coverage = 256 - 16 = 240.
    expect(result.ipv4!.outputAddresses).toBe(BigInt(240));
  });
  it("handles IPv6 input", () => {
    const result = aggregate("2001:db8::/64\n2001:db8:0:1::/64");
    expect(result.ipv6).not.toBeNull();
    expect(result.ipv6!.cidrs).toHaveLength(1);
    expect(result.ipv6!.cidrs[0].prefix).toBe(63);
  });
  it("handles mixed IPv4 + IPv6 in one paste", () => {
    const result = aggregate("10.0.0.0/24\n2001:db8::/32");
    expect(result.ipv4).not.toBeNull();
    expect(result.ipv6).not.toBeNull();
  });
  it("handles 0.0.0.0/0", () => {
    const result = aggregate("0.0.0.0/0");
    expect(result.ipv4!.cidrs).toHaveLength(1);
    expect(result.ipv4!.cidrs[0].prefix).toBe(0);
    expect(result.ipv4!.inputAddresses).toBe(BigInt(4294967296));
  });
  it("collects parse errors", () => {
    const result = aggregate("10.0.0.0/24\nnot-an-ip");
    expect(result.errors.length).toBeGreaterThan(0);
  });
  it("computes addresses saved correctly", () => {
    const result = aggregate("192.168.0.0/24\n192.168.1.0/24");
    // Both inputs cover 512 addresses; output /23 covers 512 addresses. saved = 0.
    expect(result.addressesSaved).toBe(BigInt(0));
    expect(result.totalOutput).toBe(1);
  });
});

// ---- Export renderers ----

describe("cidr-aggregator renderCidrList", () => {
  it("renders one CIDR per line", () => {
    const out = renderCidrList([
      { family: "ipv4", network: BigInt(0xc0a80000), prefix: 23 },
    ]);
    expect(out).toBe("192.168.0.0/23");
  });
});

describe("cidr-aggregator renderRangeList", () => {
  it("renders start-end per line", () => {
    const out = renderRangeList([
      { family: "ipv4", network: BigInt(0xc0a80000), prefix: 24 },
    ]);
    expect(out).toBe("192.168.0.0 - 192.168.0.255");
  });
});

describe("cidr-aggregator renderCiscoAcl", () => {
  it("renders IPv4 ACL with wildcard mask", () => {
    const out = renderCiscoAcl([{ family: "ipv4", network: BigInt(0xc0a80000), prefix: 24 }]);
    expect(out).toContain("access-list");
    expect(out).toContain("permit ip 192.168.0.0 0.0.0.255 any");
  });
  it("renders IPv6 ACL with prefix length", () => {
    const out = renderCiscoAcl([{ family: "ipv6", network: BigInt(0x20010db8) << BigInt(96), prefix: 32 }]);
    expect(out).toContain("ipv6 access-list");
    expect(out).toContain("permit ipv6 2001:db8::/32 any");
  });
});

describe("cidr-aggregator renderPfSenseAlias", () => {
  it("renders a pfSense network alias XML", () => {
    const out = renderPfSenseAlias([{ family: "ipv4", network: BigInt(0xc0a80000), prefix: 24 }]);
    expect(out).toContain("<name>unqtools_net</name>");
    expect(out).toContain("<type>network</type>");
    expect(out).toContain("192.168.0.0/24");
  });
});

describe("cidr-aggregator renderNginxAllow", () => {
  it("renders nginx allow directives", () => {
    const out = renderNginxAllow([{ family: "ipv4", network: BigInt(0xc0a80000), prefix: 24 }]);
    expect(out).toBe("allow 192.168.0.0/24;");
  });
});

describe("cidr-aggregator renderExport router", () => {
  it("routes cidr format", () => {
    expect(renderExport([{ family: "ipv4", network: BigInt(0), prefix: 0 }], "cidr")).toBe("0.0.0.0/0");
  });
  it("routes nginx format", () => {
    expect(renderExport([{ family: "ipv4", network: BigInt(0), prefix: 0 }], "nginx")).toBe("allow 0.0.0.0/0;");
  });
});

describe("cidr-aggregator allCidrs + formatBig", () => {
  it("combines IPv4 + IPv6 CIDRs from result", () => {
    const result = aggregate("10.0.0.0/24\n2001:db8::/32");
    const all = allCidrs(result);
    expect(all.length).toBe(2);
  });
  it("formats BigInt with commas", () => {
    expect(formatBig(BigInt(0))).toBe("0");
    expect(formatBig(BigInt(4294967296))).toBe("4,294,967,296");
    expect(formatBig(BigInt(1000))).toBe("1,000");
  });
});

// ---- History ----

describe("cidr-aggregator history", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, input: "10.0.0.0/24", exclusions: "", totalInput: 1, totalOutput: 1, addressesSaved: "0" });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, input: `${i}.0.0.0/24`, exclusions: "", totalInput: 1, totalOutput: 1, addressesSaved: "0" });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, input: "x", exclusions: "", totalInput: 1, totalOutput: 1, addressesSaved: "0" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ---- Share URL ----

describe("cidr-aggregator share URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("10.0.0.0/24", "", "cidr");
    expect(url).toContain("i=10.0.0.0");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("includes format when non-default", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("10.0.0.0/24", "", "nginx");
    expect(url).toContain("f=nginx");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("i=10.0.0.0%2F24&f=nginx");
    expect(p.input).toBe("10.0.0.0/24");
    expect(p.format).toBe("nginx");
  });
  it("defaults format to cidr when missing", () => {
    const p = parseShareUrl("i=10.0.0.0/24");
    expect(p.format).toBe("cidr");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({ input: "", exclusions: "", format: "cidr" });
  });
  it("filters unknown formats to cidr", () => {
    const p = parseShareUrl("i=x&f=bogus");
    expect(p.format).toBe("cidr");
  });
});

// ---- Samples ----

describe("cidr-aggregator SAMPLE_INPUTS", () => {
  it("has at least 5 presets", () => {
    expect(SAMPLE_INPUTS.length).toBeGreaterThanOrEqual(5);
  });
  it("each sample aggregates without throwing", () => {
    for (const s of SAMPLE_INPUTS) {
      const result = aggregate(s.value, s.exclusions ?? "");
      expect(result).toBeDefined();
    }
  });
});

// Suppress unused-import lint
export type _Unused = ExportFormat;
