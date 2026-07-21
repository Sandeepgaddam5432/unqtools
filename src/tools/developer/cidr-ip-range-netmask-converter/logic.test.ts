import { describe, it, expect, beforeEach } from "vitest";
import {
  parseIPv4,
  ipv4ToString,
  ipv4MaskValue,
  ipv4WildcardValue,
  parseIPv6,
  ipv6ToString,
  ipv6MaskValue,
  ipv6WildcardValue,
  detectFamily,
  parseAnyIp,
  anyIpToString,
  anyIpToBig,
  bigToAnyIp,
  familyBits,
  familyMax,
  ipv4MaskToCidr,
  ipv6MaskToCidr,
  parseMask,
  parseCidr,
  parseRange,
  ipv4HostCount,
  ipv4TotalForPrefix,
  ipv6TotalForPrefix,
  convertFromIpCidr,
  convertCidr,
  convertMask,
  rangeToCidrList,
  convertRange,
  parseBatch,
  convertBatch,
  buildIpv4MaskTable,
  buildIpv6MaskTable,
  renderConvertCsv,
  renderBatchCsv,
  renderMaskTableCsv,
  renderJson,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type ToolMode,
  type IpFamily,
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

describe("cidr parseIPv4", () => {
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
  });
  it("rejects empty", () => {
    expect(parseIPv4("").ok).toBe(false);
  });
});

describe("cidr ipv4ToString", () => {
  it("formats 32-bit value as dotted decimal", () => {
    expect(ipv4ToString(0)).toBe("0.0.0.0");
    expect(ipv4ToString(0xffffffff >>> 0)).toBe("255.255.255.255");
    expect(ipv4ToString(0xc0a80101 >>> 0)).toBe("192.168.1.1");
  });
});

describe("cidr ipv4 mask helpers", () => {
  it("mask for /0 is 0", () => {
    expect(ipv4MaskValue(0)).toBe(0);
  });
  it("mask for /32 is all ones", () => {
    expect(ipv4MaskValue(32)).toBe(0xffffffff >>> 0);
  });
  it("mask for /24 is 255.255.255.0", () => {
    expect(ipv4ToString(ipv4MaskValue(24))).toBe("255.255.255.0");
  });
  it("wildcard for /24 is 0.0.0.255", () => {
    expect(ipv4ToString(ipv4WildcardValue(24))).toBe("0.0.0.255");
  });
  it("wildcard is bitwise NOT of mask", () => {
    const m = ipv4MaskValue(22);
    const w = ipv4WildcardValue(22);
    expect((m ^ w) >>> 0).toBe(0xffffffff >>> 0);
  });
});

// ---------------------------------------------------------------------------
// IPv6 parsing & formatting
// ---------------------------------------------------------------------------

describe("cidr parseIPv6", () => {
  it("parses full 8-hextet", () => {
    const r = parseIPv6("2001:0db8:0000:0000:0000:0000:0000:0001");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.address.hextets[0]).toBe(0x2001);
  });
  it("parses compressed ::", () => {
    const r = parseIPv6("2001:db8::1");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.address.hextets).toEqual([0x2001, 0x0db8, 0, 0, 0, 0, 0, 1]);
  });
  it("parses embedded IPv4", () => {
    const r = parseIPv6("::ffff:192.0.2.1");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.address.hextets[5]).toBe(0xffff);
      expect(r.address.hextets[7]).toBe((2 << 8) | 1);
    }
  });
  it("rejects multiple ::", () => {
    expect(parseIPv6("2001::db8::1").ok).toBe(false);
  });
});

describe("cidr ipv6ToString", () => {
  it("compresses the longest zero run with ::", () => {
    expect(ipv6ToString(0x20010db8000000000000000000000001n)).toBe("2001:db8::1");
  });
  it("compresses ::1 for value 1", () => {
    expect(ipv6ToString(1n)).toBe("::1");
  });
  it("compresses :: for value 0", () => {
    expect(ipv6ToString(0n)).toBe("::");
  });
});

describe("cidr ipv6 mask helpers", () => {
  it("mask for /0 is 0", () => {
    expect(ipv6MaskValue(0)).toBe(0n);
  });
  it("mask for /128 is all ones", () => {
    expect(ipv6MaskValue(128)).toBe((1n << 128n) - 1n);
  });
  it("wildcard is bitwise NOT of mask", () => {
    const m = ipv6MaskValue(48);
    const w = ipv6WildcardValue(48);
    expect((m | w) & ((1n << 128n) - 1n)).toBe((1n << 128n) - 1n);
  });
});

// ---------------------------------------------------------------------------
// Family detection & parsing
// ---------------------------------------------------------------------------

describe("cidr detectFamily", () => {
  it("detects IPv4", () => {
    expect(detectFamily("192.168.1.1")).toBe("ipv4");
    expect(detectFamily("10.0.0.0/8")).toBe("ipv4");
  });
  it("detects IPv6", () => {
    expect(detectFamily("2001:db8::1")).toBe("ipv6");
    expect(detectFamily("::1")).toBe("ipv6");
  });
});

describe("cidr parseAnyIp + anyIpToString round-trip", () => {
  it("round-trips IPv4", () => {
    const r = parseAnyIp("192.168.1.1");
    if (!r.ok) throw new Error("parse failed");
    expect(anyIpToString(r.value)).toBe("192.168.1.1");
  });
  it("round-trips IPv6 (compressed)", () => {
    const r = parseAnyIp("2001:db8::1");
    if (!r.ok) throw new Error("parse failed");
    expect(anyIpToString(r.value)).toBe("2001:db8::1");
  });
  it("anyIpToBig and bigToAnyIp round-trip", () => {
    const r = parseAnyIp("10.0.0.5");
    if (!r.ok) throw new Error("parse failed");
    const big = anyIpToBig(r.value);
    expect(big).toBe(0x0a000005n);
    const back = bigToAnyIp(big, "ipv4");
    expect(anyIpToString(back)).toBe("10.0.0.5");
  });
});

describe("cidr familyBits and familyMax", () => {
  it("returns correct bit widths", () => {
    expect(familyBits("ipv4")).toBe(32);
    expect(familyBits("ipv6")).toBe(128);
  });
  it("returns correct max values", () => {
    expect(familyMax("ipv4")).toBe(0xffffffffn);
    expect(familyMax("ipv6")).toBe((1n << 128n) - 1n);
  });
});

// ---------------------------------------------------------------------------
// Mask validation
// ---------------------------------------------------------------------------

describe("cidr mask → CIDR conversion", () => {
  it("converts valid IPv4 mask to CIDR", () => {
    expect(ipv4MaskToCidr(0xffffff00 >>> 0)).toBe(24);
    expect(ipv4MaskToCidr(0xffffffff >>> 0)).toBe(32);
    expect(ipv4MaskToCidr(0)).toBe(0);
  });
  it("rejects non-contiguous IPv4 mask", () => {
    expect(ipv4MaskToCidr(0xff00ff00 >>> 0)).toBeNull();
    expect(ipv4MaskToCidr(0xffff00ff >>> 0)).toBeNull();
  });
  it("converts valid IPv6 mask to CIDR", () => {
    expect(ipv6MaskToCidr((1n << 128n) - 1n)).toBe(128);
    expect(ipv6MaskToCidr(0n)).toBe(0);
    expect(ipv6MaskToCidr(ipv6MaskValue(64))).toBe(64);
  });
  it("parseMask accepts dotted-decimal IPv4 mask", () => {
    const r = parseMask("255.255.252.0", "ipv4");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.cidr).toBe(22);
  });
  it("parseMask rejects invalid mask", () => {
    expect(parseMask("255.0.255.0", "ipv4").ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// CIDR / range parsing
// ---------------------------------------------------------------------------

describe("cidr parseCidr", () => {
  it("parses IPv4 CIDR", () => {
    const r = parseCidr("192.168.100.0/22");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.family).toBe("ipv4");
      expect(r.cidr).toBe(22);
    }
  });
  it("parses IPv6 CIDR", () => {
    const r = parseCidr("2001:db8::/32");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.family).toBe("ipv6");
      expect(r.cidr).toBe(32);
    }
  });
  it("treats bare IPv4 as /32", () => {
    const r = parseCidr("10.0.0.1");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.cidr).toBe(32);
  });
  it("rejects out-of-range CIDR", () => {
    expect(parseCidr("10.0.0.0/33").ok).toBe(false);
    expect(parseCidr("2001:db8::/129").ok).toBe(false);
  });
});

describe("cidr parseRange", () => {
  it("parses IPv4 range with dash", () => {
    const r = parseRange("192.168.100.0 - 192.168.103.255");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.start.family).toBe("ipv4");
      expect(r.end.family).toBe("ipv4");
    }
  });
  it("parses IPv4 range with en-dash", () => {
    const r = parseRange("192.168.100.0–192.168.103.255");
    expect(r.ok).toBe(true);
  });
  it("parses IPv4 range with 'to'", () => {
    const r = parseRange("10.0.0.0 to 10.0.0.5");
    expect(r.ok).toBe(true);
  });
  it("rejects mixed families", () => {
    expect(parseRange("192.168.1.1 - 2001:db8::1").ok).toBe(false);
  });
  it("rejects inverted range", () => {
    expect(parseRange("10.0.0.5 - 10.0.0.0").ok).toBe(false);
  });
  it("rejects missing end", () => {
    expect(parseRange("10.0.0.0 -").ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Host count
// ---------------------------------------------------------------------------

describe("cidr hostCount and totalAddresses", () => {
  it("IPv4 /24 has 254 hosts and 256 total", () => {
    expect(ipv4HostCount(24)).toBe(254n);
    expect(ipv4TotalForPrefix(24)).toBe(256n);
  });
  it("IPv4 /31 has 2 hosts (RFC 3021)", () => {
    expect(ipv4HostCount(31)).toBe(2n);
  });
  it("IPv4 /32 has 1 host", () => {
    expect(ipv4HostCount(32)).toBe(1n);
  });
  it("IPv4 /0 has 2^32 - 2 hosts", () => {
    expect(ipv4HostCount(0)).toBe((1n << 32n) - 2n);
  });
  it("IPv6 /128 has 1 total", () => {
    expect(ipv6TotalForPrefix(128)).toBe(1n);
  });
  it("IPv6 /64 has 2^64 total", () => {
    expect(ipv6TotalForPrefix(64)).toBe(1n << 64n);
  });
});

// ---------------------------------------------------------------------------
// convertFromIpCidr / convertCidr
// ---------------------------------------------------------------------------

describe("cidr convertFromIpCidr", () => {
  it("converts IPv4 /22", () => {
    const r = convertFromIpCidr({ family: "ipv4", v4: 0xc0a86400 >>> 0, v6: 0n }, 22);
    expect(r.network).toBe("192.168.100.0");
    expect(r.first).toBe("192.168.100.0");
    expect(r.last).toBe("192.168.103.255");
    expect(r.mask).toBe("255.255.252.0");
    expect(r.wildcard).toBe("0.0.3.255");
    expect(r.hostCount).toBe("1022");
    expect(r.totalAddresses).toBe("1024");
    expect(r.cidr).toBe("192.168.100.0/22");
  });
  it("converts IPv6 /32", () => {
    const r = convertFromIpCidr({ family: "ipv6", v4: 0, v6: 0x20010db8000000000000000000000000n }, 32);
    expect(r.network).toBe("2001:db8::");
    expect(r.last).toBe("2001:db8:ffff:ffff:ffff:ffff:ffff:ffff");
    expect(r.totalAddresses).toBe((1n << 96n).toString());
  });
});

describe("cidr convertCidr (string)", () => {
  it("converts valid CIDR string", () => {
    const r = convertCidr("192.168.1.0/24");
    expect(r.error).toBeUndefined();
    expect(r.network).toBe("192.168.1.0");
    expect(r.mask).toBe("255.255.255.0");
  });
  it("returns error for invalid CIDR", () => {
    const r = convertCidr("not-an-ip/24");
    expect(r.error).toBeDefined();
  });
});

describe("cidr convertMask", () => {
  it("converts valid IPv4 mask", () => {
    const r = convertMask("255.255.252.0", "ipv4");
    expect(r.error).toBeUndefined();
    expect(r.cidrInt).toBe(22);
    expect(r.wildcard).toBe("0.0.3.255");
  });
  it("rejects non-contiguous mask", () => {
    const r = convertMask("255.0.255.0", "ipv4");
    expect(r.error).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// rangeToCidrList
// ---------------------------------------------------------------------------

describe("cidr rangeToCidrList (minimal CIDR set)", () => {
  it("collapses aligned range to a single block", () => {
    const start = parseAnyIp("192.168.100.0");
    const end = parseAnyIp("192.168.103.255");
    expect(start.ok && end.ok).toBe(true);
    if (!start.ok || !end.ok) return;
    const list = rangeToCidrList(start.value, end.value);
    expect(list).toEqual(["192.168.100.0/22"]);
  });
  it("decomposes a non-aligned IPv4 range", () => {
    const start = parseAnyIp("10.0.0.0");
    const end = parseAnyIp("10.0.0.5");
    expect(start.ok && end.ok).toBe(true);
    if (!start.ok || !end.ok) return;
    const list = rangeToCidrList(start.value, end.value);
    expect(list).toEqual(["10.0.0.0/30", "10.0.0.4/31"]);
  });
  it("single IP → /32", () => {
    const start = parseAnyIp("192.168.1.5");
    expect(start.ok).toBe(true);
    if (!start.ok) return;
    const list = rangeToCidrList(start.value, start.value);
    expect(list).toEqual(["192.168.1.5/32"]);
  });
  it("whole IPv4 space → single /0", () => {
    const start = parseAnyIp("0.0.0.0");
    const end = parseAnyIp("255.255.255.255");
    expect(start.ok && end.ok).toBe(true);
    if (!start.ok || !end.ok) return;
    const list = rangeToCidrList(start.value, end.value);
    expect(list).toEqual(["0.0.0.0/0"]);
  });
  it("IPv6 aligned range → single block", () => {
    const start = parseAnyIp("2001:db8::");
    const end = parseAnyIp("2001:db8:ffff:ffff:ffff:ffff:ffff:ffff");
    expect(start.ok && end.ok).toBe(true);
    if (!start.ok || !end.ok) return;
    const list = rangeToCidrList(start.value, end.value);
    expect(list).toEqual(["2001:db8::/32"]);
  });
});

describe("cidr convertRange (string)", () => {
  it("converts valid range string", () => {
    const r = convertRange("192.168.100.0 - 192.168.103.255");
    expect(r.error).toBeUndefined();
    expect(r.results).toHaveLength(1);
    expect(r.results[0].cidr).toBe("192.168.100.0/22");
  });
  it("returns error for invalid range", () => {
    const r = convertRange("not a range");
    expect(r.error).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Batch
// ---------------------------------------------------------------------------

describe("cidr batch", () => {
  it("parseBatch splits on newlines and ignores comments", () => {
    expect(parseBatch("10.0.0.0/8\n# comment\n192.168.0.0/16\n\n")).toEqual([
      "10.0.0.0/8", "192.168.0.0/16",
    ]);
  });
  it("convertBatch handles mixed CIDR and range lines", () => {
    const result = convertBatch([
      "192.168.1.0/24",
      "10.0.0.0 - 10.0.0.5",
      "not-an-ip",
    ]);
    expect(result.okCount).toBeGreaterThanOrEqual(3); // 1 + 2 + 0 = 3
    expect(result.errCount).toBe(1);
    expect(result.cidrList).toContain("192.168.1.0/24");
    expect(result.cidrList).toContain("10.0.0.0/30");
    expect(result.cidrList).toContain("10.0.0.4/31");
  });
  it("convertBatch auto-detects IPv4 vs IPv6", () => {
    const result = convertBatch(["192.168.1.0/24", "2001:db8::/32"]);
    expect(result.okCount).toBe(2);
    expect(result.results[0].result?.family).toBe("ipv4");
    expect(result.results[1].result?.family).toBe("ipv6");
  });
});

// ---------------------------------------------------------------------------
// Reference tables
// ---------------------------------------------------------------------------

describe("cidr reference tables", () => {
  it("builds IPv4 mask table with 33 rows (0–32)", () => {
    const rows = buildIpv4MaskTable();
    expect(rows).toHaveLength(33);
    expect(rows[24].mask).toBe("255.255.255.0");
    expect(rows[24].wildcard).toBe("0.0.0.255");
    expect(rows[24].hostCount).toBe("254");
    expect(rows[24].totalAddresses).toBe("256");
  });
  it("builds IPv6 mask table with 20+ rows", () => {
    const rows = buildIpv6MaskTable();
    expect(rows.length).toBeGreaterThanOrEqual(15);
    expect(rows.some((r) => r.cidr === 64)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// CSV / JSON
// ---------------------------------------------------------------------------

describe("cidr CSV/JSON export", () => {
  it("renderConvertCsv produces header + 1 row", () => {
    const r = convertCidr("192.168.1.0/24");
    const csv = renderConvertCsv(r);
    expect(csv.split("\n")[0]).toContain("cidr,family,network");
    expect(csv).toContain("192.168.1.0/24,ipv4,192.168.1.0");
  });
  it("renderBatchCsv produces header + rows", () => {
    const r = convertBatch(["10.0.0.0/8", "bad"]);
    const csv = renderBatchCsv(r);
    expect(csv.split("\n")[0]).toContain("line_index,input,ok");
    expect(csv.split("\n").length).toBe(3);
  });
  it("renderMaskTableCsv produces header + rows", () => {
    const csv = renderMaskTableCsv(buildIpv4MaskTable());
    expect(csv.split("\n")[0]).toBe("cidr,mask,wildcard,host_count,total_addresses");
    expect(csv.split("\n").length).toBe(34);
  });
  it("renderJson produces pretty JSON", () => {
    const r = convertCidr("192.168.1.0/24");
    const json = renderJson(r);
    expect(JSON.parse(json).cidr).toBe("192.168.1.0/24");
  });
});

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

describe("cidr history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, mode: "convert", input: "192.168.1.0/24", summary: "/24" });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, mode: "convert", input: "::1", summary: `s${i}` });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, mode: "convert", input: "::1", summary: "x" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Shareable URL
// ---------------------------------------------------------------------------

describe("cidr shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("convert", "ipv4", "192.168.1.0/24");
    expect(url).toContain("mode=convert");
    expect(url).toContain("fam=ipv4");
    expect(url).toContain("in=192.168.1.0%2F24");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("mode=range&fam=ipv4&in=192.168.100.0%20-%20192.168.103.255");
    expect(p.mode).toBe("range");
    expect(p.family).toBe("ipv4");
    expect(p.input).toBe("192.168.100.0 - 192.168.103.255");
  });
  it("returns defaults for empty hash", () => {
    const p = parseShareUrl("");
    expect(p.mode).toBe("convert");
    expect(p.family).toBe("ipv4");
  });
});

// Suppress unused-import lint
export type _Unused = ToolMode | IpFamily;
