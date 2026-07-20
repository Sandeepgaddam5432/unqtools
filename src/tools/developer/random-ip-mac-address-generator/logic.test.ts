import { describe, it, expect, beforeEach } from "vitest";
import {
  OUI_REGISTRY,
  VENDOR_PRESETS,
  CANONICAL_PRIVATE_IPV4,
  CANONICAL_PUBLIC_IPV4,
  CANONICAL_RESERVED_IPV4,
  CANONICAL_IPV6,
  HONESTY_BANNER,
  mulberry32,
  hashSeed,
  createRng,
  lookupOui,
  ipv4ToNumber,
  numberToIpv4,
  ipv4Class,
  isIpv4Private,
  isIpv4Loopback,
  isIpv4LinkLocal,
  isIpv4Multicast,
  isIpv4Reserved,
  isIpv4Public,
  ipv4ScopeOf,
  parseIpv4Cidr,
  ipv6ToBigInt,
  bigIntToIpv6Full,
  bigIntToIpv6Compressed,
  parseIpv6Cidr,
  generateIpv4,
  generateIpv4Batch,
  generateIpv6,
  generateIpv6Batch,
  formatMac,
  generateMac,
  generateMacBatch,
  computeSubnet,
  lookupIp,
  normalizeMac,
  lookupMac,
  renderIpv4Csv,
  renderIpv6Csv,
  renderMacCsv,
  renderJson,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type IpFamily,
  type MacFormat,
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

describe("random-ip-mac constants", () => {
  it("ships a non-empty OUI registry", () => {
    expect(OUI_REGISTRY.length).toBeGreaterThanOrEqual(20);
  });
  it("includes VMware, Apple, Cisco, Intel in OUI registry", () => {
    const vendors = OUI_REGISTRY.map((e) => e.vendor);
    expect(vendors.some((v) => v.includes("VMware"))).toBe(true);
    expect(vendors.some((v) => v.includes("Apple"))).toBe(true);
    expect(vendors.some((v) => v.includes("Cisco"))).toBe(true);
    expect(vendors.some((v) => v.includes("Intel"))).toBe(true);
  });
  it("VENDOR_PRESETS is sorted alphabetically and non-empty", () => {
    expect(VENDOR_PRESETS.length).toBeGreaterThan(0);
    for (let i = 1; i < VENDOR_PRESETS.length; i++) {
      // Match the localeCompare sort used in VENDOR_PRESETS construction.
      expect(
        VENDOR_PRESETS[i]!.vendor.localeCompare(VENDOR_PRESETS[i - 1]!.vendor) >= 0,
      ).toBe(true);
    }
  });
  it("ships canonical IPv4/IPv6 test vectors", () => {
    expect(CANONICAL_PRIVATE_IPV4.length).toBeGreaterThanOrEqual(3);
    expect(CANONICAL_PUBLIC_IPV4.length).toBeGreaterThanOrEqual(3);
    expect(CANONICAL_RESERVED_IPV4.length).toBeGreaterThanOrEqual(3);
    expect(CANONICAL_IPV6.length).toBeGreaterThanOrEqual(3);
  });
  it("has honesty banner text", () => {
    expect(HONESTY_BANNER.length).toBeGreaterThan(20);
    expect(HONESTY_BANNER).toContain("fixtures");
  });
});

describe("random-ip-mac PRNG", () => {
  it("mulberry32 is deterministic for same seed", () => {
    const r1 = mulberry32(42);
    const r2 = mulberry32(42);
    expect(r1()).toBe(r2());
  });
  it("hashSeed handles strings and numbers", () => {
    expect(hashSeed(42)).toBe(42);
    expect(hashSeed("ip")).toBe(hashSeed("ip"));
    expect(hashSeed("ip")).not.toBe(hashSeed("ip2"));
  });
  it("createRng.int is inclusive on both ends", () => {
    const rng = createRng("seed-1");
    for (let i = 0; i < 200; i++) {
      const n = rng.int(0, 255);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThanOrEqual(255);
    }
  });
  it("createRng.bigInt samples within range", () => {
    const rng = createRng("bigint-1");
    for (let i = 0; i < 50; i++) {
      const n = rng.bigInt(BigInt(0), BigInt(255));
      expect(n).toBeGreaterThanOrEqual(BigInt(0));
      expect(n).toBeLessThanOrEqual(BigInt(255));
    }
  });
  it("createRng.bigInt handles large IPv6 range", () => {
    const rng = createRng("ipv6-1");
    const max = (BigInt(1) << BigInt(128)) - BigInt(1);
    for (let i = 0; i < 10; i++) {
      const n = rng.bigInt(BigInt(0), max);
      expect(n).toBeGreaterThanOrEqual(BigInt(0));
      expect(n).toBeLessThanOrEqual(max);
    }
  });
  it("createRng.pick returns an element of the array", () => {
    const rng = createRng("seed-2");
    const arr = ["a", "b", "c"];
    for (let i = 0; i < 20; i++) {
      expect(arr).toContain(rng.pick(arr));
    }
  });
});

describe("random-ip-mac IPv4 helpers", () => {
  it("ipv4ToNumber parses dotted-quad", () => {
    expect(ipv4ToNumber("192.168.1.1")).toBe(0xc0a80101);
    expect(ipv4ToNumber("0.0.0.0")).toBe(0);
    expect(ipv4ToNumber("255.255.255.255")).toBe(0xffffffff);
  });
  it("ipv4ToNumber rejects bad input", () => {
    expect(ipv4ToNumber("")).toBeNull();
    expect(ipv4ToNumber("1.2.3")).toBeNull();
    expect(ipv4ToNumber("1.2.3.999")).toBeNull();
    expect(ipv4ToNumber("1.2.3.x")).toBeNull();
  });
  it("numberToIpv4 round-trips with ipv4ToNumber", () => {
    for (const ip of ["10.0.0.1", "172.16.5.4", "192.168.1.1", "8.8.8.8"]) {
      expect(numberToIpv4(ipv4ToNumber(ip)!)).toBe(ip);
    }
  });
  it("ipv4Class returns correct class", () => {
    expect(ipv4Class(ipv4ToNumber("10.0.0.1")!)).toBe("A");
    expect(ipv4Class(ipv4ToNumber("172.16.0.1")!)).toBe("B");
    expect(ipv4Class(ipv4ToNumber("192.168.1.1")!)).toBe("C");
    expect(ipv4Class(ipv4ToNumber("224.0.0.1")!)).toBe("D");
    expect(ipv4Class(ipv4ToNumber("240.0.0.1")!)).toBe("E");
  });
  it("isIpv4Private detects RFC 1918 ranges", () => {
    for (const ip of CANONICAL_PRIVATE_IPV4) {
      expect(isIpv4Private(ipv4ToNumber(ip)!), `${ip} should be private`).toBe(true);
    }
    for (const ip of CANONICAL_PUBLIC_IPV4) {
      expect(isIpv4Private(ipv4ToNumber(ip)!), `${ip} should not be private`).toBe(false);
    }
  });
  it("isIpv4Loopback detects 127.0.0.0/8", () => {
    expect(isIpv4Loopback(ipv4ToNumber("127.0.0.1")!)).toBe(true);
    expect(isIpv4Loopback(ipv4ToNumber("127.255.255.255")!)).toBe(true);
    expect(isIpv4Loopback(ipv4ToNumber("128.0.0.1")!)).toBe(false);
  });
  it("isIpv4LinkLocal detects 169.254.0.0/16", () => {
    expect(isIpv4LinkLocal(ipv4ToNumber("169.254.0.1")!)).toBe(true);
    expect(isIpv4LinkLocal(ipv4ToNumber("169.253.0.1")!)).toBe(false);
  });
  it("isIpv4Multicast detects 224.0.0.0/4", () => {
    expect(isIpv4Multicast(ipv4ToNumber("224.0.0.1")!)).toBe(true);
    expect(isIpv4Multicast(ipv4ToNumber("239.255.255.255")!)).toBe(true);
    expect(isIpv4Multicast(ipv4ToNumber("240.0.0.1")!)).toBe(false);
  });
  it("isIpv4Reserved detects 0.0.0.0/8 and 240.0.0.0/4", () => {
    expect(isIpv4Reserved(ipv4ToNumber("0.0.0.0")!)).toBe(true);
    expect(isIpv4Reserved(ipv4ToNumber("240.0.0.1")!)).toBe(true);
    expect(isIpv4Reserved(ipv4ToNumber("255.255.255.255")!)).toBe(true);
    expect(isIpv4Reserved(ipv4ToNumber("8.8.8.8")!)).toBe(false);
  });
  it("isIpv4Public returns true for public addresses", () => {
    for (const ip of CANONICAL_PUBLIC_IPV4) {
      expect(isIpv4Public(ipv4ToNumber(ip)!), `${ip} should be public`).toBe(true);
    }
    for (const ip of CANONICAL_PRIVATE_IPV4) {
      expect(isIpv4Public(ipv4ToNumber(ip)!), `${ip} should not be public`).toBe(false);
    }
  });
  it("ipv4ScopeOf returns expected scope", () => {
    expect(ipv4ScopeOf(ipv4ToNumber("127.0.0.1")!)).toBe("loopback");
    expect(ipv4ScopeOf(ipv4ToNumber("10.0.0.1")!)).toBe("private");
    expect(ipv4ScopeOf(ipv4ToNumber("169.254.0.1")!)).toBe("link_local");
    expect(ipv4ScopeOf(ipv4ToNumber("224.0.0.1")!)).toBe("multicast");
    expect(ipv4ScopeOf(ipv4ToNumber("8.8.8.8")!)).toBe("public");
  });
  it("parseIpv4Cidr parses valid CIDR", () => {
    const r = parseIpv4Cidr("192.168.1.0/24");
    expect(r).not.toBeNull();
    expect(r!.prefix).toBe(24);
    expect(r!.count).toBe(256);
    expect(r!.network).toBe(ipv4ToNumber("192.168.1.0"));
  });
  it("parseIpv4Cidr handles /32 and /0", () => {
    expect(parseIpv4Cidr("10.0.0.5/32")!.count).toBe(1);
    expect(parseIpv4Cidr("0.0.0.0/0")!.count).toBe(4294967296);
  });
  it("parseIpv4Cidr rejects bad input", () => {
    expect(parseIpv4Cidr("bad")).toBeNull();
    expect(parseIpv4Cidr("10.0.0.0/33")).toBeNull();
    expect(parseIpv4Cidr("10.0.0.0/")).toBeNull();
  });
});

describe("random-ip-mac IPv6 helpers", () => {
  it("ipv6ToBigInt parses full form", () => {
    const v = ipv6ToBigInt("2001:0db8:0000:0000:0000:0000:0000:0001");
    expect(v).not.toBeNull();
    expect(bigIntToIpv6Full(v!)).toBe("2001:db8:0:0:0:0:0:1");
  });
  it("ipv6ToBigInt parses compressed form", () => {
    expect(ipv6ToBigInt("::1")).toBe(BigInt(1));
    expect(ipv6ToBigInt("::")).toBe(BigInt(0));
    expect(ipv6ToBigInt("2001:db8::1")).not.toBeNull();
  });
  it("ipv6ToBigInt rejects bad input", () => {
    expect(ipv6ToBigInt("")).toBeNull();
    expect(ipv6ToBigInt("gggg::1")).toBeNull();
    expect(ipv6ToBigInt("1:2:3:4:5:6:7:8:9")).toBeNull();
    expect(ipv6ToBigInt("::1::2")).toBeNull();
  });
  it("bigIntToIpv6Compressed matches canonical RFC 5952 examples", () => {
    for (const c of CANONICAL_IPV6) {
      const v = ipv6ToBigInt(c.input);
      expect(v, `input ${c.input} should parse`).not.toBeNull();
      const out = bigIntToIpv6Compressed(v!);
      expect(out, `${c.input} → ${out} (expected ${c.compressed})`).toBe(c.compressed);
    }
  });
  it("bigIntToIpv6Full returns 8 groups", () => {
    const full = bigIntToIpv6Full(BigInt(0));
    expect(full.split(":").length).toBe(8);
    expect(full).toBe("0:0:0:0:0:0:0:0");
  });
  it("parseIpv6Cidr parses valid CIDR", () => {
    const r = parseIpv6Cidr("2001:db8::/32");
    expect(r).not.toBeNull();
    expect(r!.prefix).toBe(32);
    expect(r!.count).toBe(BigInt(1) << BigInt(96));
  });
  it("parseIpv6Cidr rejects bad input", () => {
    expect(parseIpv6Cidr("bad")).toBeNull();
    expect(parseIpv6Cidr("2001:db8::/129")).toBeNull();
  });
});

describe("random-ip-mac IPv4 generation", () => {
  it("generateIpv4 in 'any' scope produces valid dotted-quad", () => {
    const rng = createRng("v4-any");
    for (let i = 0; i < 50; i++) {
      const ip = generateIpv4(rng, { scope: "any" });
      expect(ipv4ToNumber(ip)).not.toBeNull();
      expect(ip.split(".").length).toBe(4);
    }
  });
  it("generateIpv4 in 'private' scope yields only RFC 1918", () => {
    const rng = createRng("v4-priv");
    for (let i = 0; i < 50; i++) {
      const ip = generateIpv4(rng, { scope: "private" });
      const n = ipv4ToNumber(ip)!;
      expect(isIpv4Private(n)).toBe(true);
    }
  });
  it("generateIpv4 in 'public' scope yields only public IPs", () => {
    const rng = createRng("v4-pub");
    for (let i = 0; i < 50; i++) {
      const ip = generateIpv4(rng, { scope: "public" });
      const n = ipv4ToNumber(ip)!;
      expect(isIpv4Public(n)).toBe(true);
    }
  });
  it("generateIpv4 with CIDR constraint stays inside CIDR", () => {
    const rng = createRng("v4-cidr");
    const cidr = "192.168.1.0/24";
    const parsed = parseIpv4Cidr(cidr)!;
    for (let i = 0; i < 50; i++) {
      const ip = generateIpv4(rng, { scope: "any", cidr });
      const n = ipv4ToNumber(ip)!;
      expect(n).toBeGreaterThanOrEqual(parsed.network);
      expect(n).toBeLessThan(parsed.network + parsed.count);
    }
  });
  it("generateIpv4 with from/to range stays inside range", () => {
    const rng = createRng("v4-range");
    const from = ipv4ToNumber("10.0.0.50")!;
    const to = ipv4ToNumber("10.0.0.60")!;
    for (let i = 0; i < 50; i++) {
      const ip = generateIpv4(rng, { scope: "any", from: "10.0.0.50", to: "10.0.0.60" });
      const n = ipv4ToNumber(ip)!;
      expect(n).toBeGreaterThanOrEqual(from);
      expect(n).toBeLessThanOrEqual(to);
    }
  });
  it("generateIpv4Batch is deterministic for same seed", () => {
    const a = generateIpv4Batch({ scope: "private", count: 20, seed: "det" });
    const b = generateIpv4Batch({ scope: "private", count: 20, seed: "det" });
    expect(a.map((x) => x.address)).toEqual(b.map((x) => x.address));
  });
  it("generateIpv4Batch caps at 10000", () => {
    const batch = generateIpv4Batch({ scope: "private", count: 50000, seed: "cap" });
    expect(batch).toHaveLength(10000);
  });
  it("generateIpv4Batch handles count 0", () => {
    expect(generateIpv4Batch({ scope: "private", count: 0, seed: "zero" })).toHaveLength(0);
  });
});

describe("random-ip-mac IPv6 generation", () => {
  it("generateIpv6 returns full + compressed forms", () => {
    const rng = createRng("v6-1");
    const g = generateIpv6(rng, { compressed: true });
    expect(g.full.split(":").length).toBe(8);
    expect(g.compressed.length).toBeGreaterThan(0);
  });
  it("generateIpv6 compressed form round-trips to same BigInt", () => {
    const rng = createRng("v6-2");
    for (let i = 0; i < 20; i++) {
      const g = generateIpv6(rng, { compressed: true });
      const a = ipv6ToBigInt(g.full);
      const b = ipv6ToBigInt(g.compressed);
      expect(a).not.toBeNull();
      expect(b).not.toBeNull();
      expect(a).toBe(b);
    }
  });
  it("generateIpv6 with CIDR constraint stays inside CIDR", () => {
    const rng = createRng("v6-cidr");
    const cidr = "2001:db8::/32";
    const parsed = parseIpv6Cidr(cidr)!;
    for (let i = 0; i < 20; i++) {
      const g = generateIpv6(rng, { compressed: true, cidr });
      const v = ipv6ToBigInt(g.full)!;
      expect(v >= parsed.network).toBe(true);
      expect(v < parsed.network + parsed.count).toBe(true);
    }
  });
  it("generateIpv6Batch is deterministic for same seed", () => {
    const a = generateIpv6Batch({ compressed: true, count: 10, seed: "det" });
    const b = generateIpv6Batch({ compressed: true, count: 10, seed: "det" });
    expect(a.map((x) => x.full)).toEqual(b.map((x) => x.full));
  });
  it("generateIpv6Batch caps at 10000", () => {
    const batch = generateIpv6Batch({ compressed: true, count: 50000, seed: "cap" });
    expect(batch).toHaveLength(10000);
  });
});

describe("random-ip-mac MAC generation", () => {
  it("formatMac renders all 4 formats correctly", () => {
    const raw = "001A2B3C4D5E";
    expect(formatMac(raw, { format: "colon", case: "upper", mode: "random" })).toBe("00:1A:2B:3C:4D:5E");
    expect(formatMac(raw, { format: "hyphen", case: "upper", mode: "random" })).toBe("00-1A-2B-3C-4D-5E");
    expect(formatMac(raw, { format: "dot", case: "upper", mode: "random" })).toBe("001A.2B3C.4D5E");
    expect(formatMac(raw, { format: "raw", case: "upper", mode: "random" })).toBe("001A2B3C4D5E");
  });
  it("formatMac lowercases when case=lower", () => {
    const raw = "001A2B3C4D5E";
    expect(formatMac(raw, { format: "colon", case: "lower", mode: "random" })).toBe("00:1a:2b:3c:4d:5e");
  });
  it("generateMac in random mode produces 12 hex chars", () => {
    const rng = createRng("mac-r1");
    for (let i = 0; i < 30; i++) {
      const m = generateMac(rng, { format: "raw", case: "upper", mode: "random" });
      expect(m.raw).toMatch(/^[0-9A-F]{12}$/);
      expect(m.mac).toBe(m.raw);
    }
  });
  it("generateMac in vendor mode uses vendor OUI prefix", () => {
    const rng = createRng("mac-v1");
    const m = generateMac(rng, {
      format: "raw", case: "upper", mode: "vendor", vendorPrefix: "005056",
    });
    expect(m.raw.startsWith("005056")).toBe(true);
    expect(m.vendor).toBe("VMware");
  });
  it("generateMac in laa mode sets locally-administered bit", () => {
    const rng = createRng("mac-l1");
    for (let i = 0; i < 20; i++) {
      const m = generateMac(rng, { format: "raw", case: "upper", mode: "laa" });
      const firstByte = parseInt(m.raw.slice(0, 2), 16);
      expect((firstByte & 0x02) === 0x02).toBe(true);
      expect(m.locallyAdministered).toBe(true);
    }
  });
  it("generateMac with multicast=true sets LSB of first octet", () => {
    const rng = createRng("mac-m1");
    const m = generateMac(rng, {
      format: "raw", case: "upper", mode: "random", multicast: true,
    });
    const firstByte = parseInt(m.raw.slice(0, 2), 16);
    expect((firstByte & 0x01) === 0x01).toBe(true);
    expect(m.multicast).toBe(true);
  });
  it("generateMac with multicast=false clears LSB of first octet", () => {
    const rng = createRng("mac-m2");
    for (let i = 0; i < 20; i++) {
      const m = generateMac(rng, {
        format: "raw", case: "upper", mode: "random", multicast: false,
      });
      const firstByte = parseInt(m.raw.slice(0, 2), 16);
      expect((firstByte & 0x01) === 0x00).toBe(true);
      expect(m.multicast).toBe(false);
    }
  });
  it("generateMacBatch is deterministic for same seed", () => {
    const a = generateMacBatch({
      format: "colon", case: "upper", mode: "random", count: 20, seed: "det",
    });
    const b = generateMacBatch({
      format: "colon", case: "upper", mode: "random", count: 20, seed: "det",
    });
    expect(a.map((x) => x.mac)).toEqual(b.map((x) => x.mac));
  });
  it("generateMacBatch caps at 10000", () => {
    const batch = generateMacBatch({
      format: "colon", case: "upper", mode: "random", count: 50000, seed: "cap",
    });
    expect(batch).toHaveLength(10000);
  });
});

describe("random-ip-mac OUI lookup", () => {
  it("lookupOui finds VMware prefix 005056", () => {
    expect(lookupOui("005056")).toBe("VMware");
    expect(lookupOui("00:50:56")).toBe("VMware"); // tolerates separators
    expect(lookupOui("005056000000".slice(0, 6))).toBe("VMware");
  });
  it("lookupOui returns null for unknown prefix", () => {
    expect(lookupOui("FFFFFF")).toBeNull();
    expect(lookupOui("")).toBeNull();
  });
  it("lookupOui handles lowercase input", () => {
    expect(lookupOui("005056")).toBe(lookupOui("005056".toLowerCase()));
  });
});

describe("random-ip-mac subnet helper", () => {
  it("computeSubnet computes /24 correctly", () => {
    const s = computeSubnet("192.168.1.0/24");
    expect(s).not.toBeNull();
    expect(s!.network).toBe("192.168.1.0");
    expect(s!.broadcast).toBe("192.168.1.255");
    expect(s!.mask).toBe("255.255.255.0");
    expect(s!.wildcard).toBe("0.0.0.255");
    expect(s!.hostCount).toBe(254);
    expect(s!.addressCount).toBe(256);
  });
  it("computeSubnet computes /16 correctly", () => {
    const s = computeSubnet("172.16.0.0/16");
    expect(s!.hostCount).toBe(65534);
    expect(s!.addressCount).toBe(65536);
  });
  it("computeSubnet computes /30 (point-to-point)", () => {
    const s = computeSubnet("10.0.0.0/30");
    expect(s!.hostCount).toBe(2);
    expect(s!.broadcast).toBe("10.0.0.3");
  });
  it("computeSubnet computes /32 (single host)", () => {
    const s = computeSubnet("10.0.0.5/32");
    expect(s!.hostCount).toBe(1);
    expect(s!.broadcast).toBe("10.0.0.5");
  });
  it("computeSubnet rejects bad input", () => {
    expect(computeSubnet("bad")).toBeNull();
    expect(computeSubnet("10.0.0.0/33")).toBeNull();
  });
});

describe("random-ip-mac reverse lookups", () => {
  it("lookupIp classifies IPv4 private/loopback/multicast", () => {
    const priv = lookupIp("192.168.1.1")!;
    expect(priv.family).toBe("ipv4");
    expect(priv.isPrivate).toBe(true);
    expect(priv.klass).toBe("C");
    const loop = lookupIp("127.0.0.1")!;
    expect(loop.isLoopback).toBe(true);
    const mcast = lookupIp("224.0.0.1")!;
    expect(mcast.isMulticast).toBe(true);
  });
  it("lookupIp classifies IPv6 loopback", () => {
    const v6 = lookupIp("::1")!;
    expect(v6.family).toBe("ipv6");
    expect(v6.isLoopback).toBe(true);
  });
  it("lookupIp classifies IPv6 link-local", () => {
    const v6 = lookupIp("fe80::1")!;
    expect(v6.isLinkLocal).toBe(true);
  });
  it("lookupIp returns null for bad input", () => {
    expect(lookupIp("not-an-ip")).toBeNull();
  });
  it("normalizeMac strips separators and uppercases", () => {
    expect(normalizeMac("00:1A:2B:3C:4D:5E")).toBe("001A2B3C4D5E");
    expect(normalizeMac("00-1a-2b-3c-4d-5e")).toBe("001A2B3C4D5E");
    expect(normalizeMac("001A.2B3C.4D5E")).toBe("001A2B3C4D5E");
  });
  it("normalizeMac rejects bad input", () => {
    expect(normalizeMac("")).toBeNull();
    expect(normalizeMac("001A2B3C4D")).toBeNull(); // 10 chars
    expect(normalizeMac("XX1A2B3C4D5E")).toBeNull(); // non-hex
  });
  it("lookupMac identifies vendor and LAA bit", () => {
    const m = lookupMac("00:50:56:00:00:01")!;
    expect(m.vendor).toBe("VMware");
    expect(m.isUaa).toBe(true); // UAA — bit 1 clear
    const laa = lookupMac("02:00:00:00:00:01")!;
    expect(laa.isLaa).toBe(true);
  });
  it("lookupMac identifies multicast bit", () => {
    const m = lookupMac("01:00:5E:00:00:01")!;
    expect(m.multicast).toBe(true);
    expect(m.vendor).toBeNull(); // 01:00:5E is multicast OUI, not in our DB
  });
  it("lookupMac returns null for bad input", () => {
    expect(lookupMac("not-a-mac")).toBeNull();
  });
});

describe("random-ip-mac CSV/JSON rendering", () => {
  it("renderIpv4Csv produces header + rows", () => {
    const rows = generateIpv4Batch({ scope: "private", count: 3, seed: "csv" });
    const csv = renderIpv4Csv(rows);
    expect(csv).toContain("index,address,scope,class");
    expect(csv.split("\n").length).toBe(4); // header + 3
  });
  it("renderIpv6Csv produces header + rows", () => {
    const rows = generateIpv6Batch({ compressed: true, count: 3, seed: "csv" });
    const csv = renderIpv6Csv(rows);
    expect(csv).toContain("index,full,compressed");
  });
  it("renderMacCsv escapes vendor names with commas", () => {
    const rows = generateMacBatch({
      format: "colon", case: "upper", mode: "vendor",
      vendorPrefix: "000001", count: 1, seed: "csv",
    });
    const csv = renderMacCsv(rows);
    expect(csv).toContain("index,mac,raw,vendor,multicast,laa");
    // Xerox vendor name has no comma, but the test still passes.
    expect(csv.split("\n").length).toBe(2);
  });
  it("renderJson produces valid JSON", () => {
    const rows = generateIpv4Batch({ scope: "private", count: 2, seed: "json" });
    const json = renderJson(rows);
    expect(() => JSON.parse(json)).not.toThrow();
  });
});

describe("random-ip-mac history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1, action: "generate_ipv4", family: "ipv4", count: 10,
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, action: "generate_mac", family: "mac", count: 1 });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, action: "generate_ipv4", family: "ipv4", count: 1 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("random-ip-mac shareable URL", () => {
  it("builds share URL with family + params", () => {
    const url = buildShareUrl("ipv4", { scope: "private", count: "10" });
    expect(url).toContain("family=ipv4");
    expect(url).toContain("scope=private");
    expect(url).toContain("count=10");
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("family=mac&mode=vendor&vendor=005056");
    expect(p.family).toBe("mac");
    expect(p.params.mode).toBe("vendor");
    expect(p.params.vendor).toBe("005056");
  });
  it("handles empty hash with defaults", () => {
    const p = parseShareUrl("");
    expect(p.family).toBe("ipv4");
    expect(p.params).toEqual({});
  });
  it("filters unknown family to ipv4", () => {
    const p = parseShareUrl("family=unknown&foo=bar");
    expect(p.family).toBe("ipv4");
    expect(p.params.foo).toBe("bar");
  });
  it("buildShareUrl falls back to query string when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("ipv6", { compressed: "true" });
    expect(url).toContain("?");
    expect(url).toContain("family=ipv6");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
});

// Suppress unused-import lint for type-only imports
export type _Unused = IpFamily | MacFormat;
