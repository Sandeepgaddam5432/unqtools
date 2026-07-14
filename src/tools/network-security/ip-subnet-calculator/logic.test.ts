import { describe, it, expect, beforeEach } from "vitest";
import {
  ipToInt,
  intToIp,
  isValidIp,
  prefixToMask,
  prefixToMaskInt,
  maskToPrefix,
  isValidPrefix,
  getIpClass,
  isPrivateIp,
  parseInput,
  calculateSubnet,
  formatHosts,
} from "./logic";

describe("ip-subnet ipToInt / intToIp", () => {
  it("converts dotted-decimal to integer", () => {
    expect(ipToInt("0.0.0.0")).toBe(0);
    expect(ipToInt("192.168.1.1")).toBe(0xc0a80101);
    expect(ipToInt("255.255.255.255")).toBe(0xffffffff);
  });

  it("converts integer to dotted-decimal", () => {
    expect(intToIp(0)).toBe("0.0.0.0");
    expect(intToIp(0xc0a80101)).toBe("192.168.1.1");
    expect(intToIp(0xffffffff)).toBe("255.255.255.255");
  });

  it("round-trips through both functions", () => {
    const ips = ["10.0.0.1", "172.16.5.100", "192.168.0.42", "8.8.8.8"];
    for (const ip of ips) {
      expect(intToIp(ipToInt(ip))).toBe(ip);
    }
  });
});

describe("ip-subnet isValidIp", () => {
  it("accepts valid IPs", () => {
    expect(isValidIp("0.0.0.0")).toBe(true);
    expect(isValidIp("255.255.255.255")).toBe(true);
    expect(isValidIp("192.168.1.1")).toBe(true);
  });

  it("rejects invalid IPs", () => {
    expect(isValidIp("256.0.0.0")).toBe(false);
    expect(isValidIp("192.168.1")).toBe(false);
    expect(isValidIp("192.168.1.1.1")).toBe(false);
    expect(isValidIp("abc.def.ghi.jkl")).toBe(false);
    expect(isValidIp("192.168.1.-1")).toBe(false);
    expect(isValidIp("")).toBe(false);
  });
});

describe("ip-subnet prefixToMask / maskToPrefix", () => {
  it("converts prefix to mask", () => {
    expect(prefixToMask(0)).toBe("0.0.0.0");
    expect(prefixToMask(8)).toBe("255.0.0.0");
    expect(prefixToMask(16)).toBe("255.255.0.0");
    expect(prefixToMask(24)).toBe("255.255.255.0");
    expect(prefixToMask(25)).toBe("255.255.255.128");
    expect(prefixToMask(32)).toBe("255.255.255.255");
  });

  it("converts mask back to prefix", () => {
    expect(maskToPrefix("0.0.0.0")).toBe(0);
    expect(maskToPrefix("255.0.0.0")).toBe(8);
    expect(maskToPrefix("255.255.255.0")).toBe(24);
    expect(maskToPrefix("255.255.255.128")).toBe(25);
    expect(maskToPrefix("255.255.255.255")).toBe(32);
  });

  it("rejects non-contiguous masks", () => {
    expect(maskToPrefix("255.0.255.0")).toBe(-1);
    expect(maskToPrefix("255.255.0.255")).toBe(-1);
  });

  it("prefixToMaskInt returns -1 for out-of-range", () => {
    expect(prefixToMaskInt(-1)).toBe(-1);
    expect(prefixToMaskInt(33)).toBe(-1);
  });
});

describe("ip-subnet isValidPrefix", () => {
  it("accepts 0-32", () => {
    for (let i = 0; i <= 32; i++) {
      expect(isValidPrefix(i)).toBe(true);
    }
  });

  it("rejects out-of-range", () => {
    expect(isValidPrefix(-1)).toBe(false);
    expect(isValidPrefix(33)).toBe(false);
    expect(isValidPrefix(1.5)).toBe(false);
  });
});

describe("ip-subnet getIpClass", () => {
  it("classifies A, B, C correctly", () => {
    expect(getIpClass(10)).toBe("A");
    expect(getIpClass(127)).toBe("Loopback");
    expect(getIpClass(172)).toBe("B");
    expect(getIpClass(192)).toBe("C");
  });

  it("classifies D and E", () => {
    expect(getIpClass(224)).toBe("D (multicast)");
    expect(getIpClass(240)).toBe("E (reserved)");
  });
});

describe("ip-subnet isPrivateIp", () => {
  it("detects 10.0.0.0/8", () => {
    expect(isPrivateIp("10.0.0.1")).toBe(true);
    expect(isPrivateIp("10.255.255.255")).toBe(true);
  });

  it("detects 172.16.0.0/12", () => {
    expect(isPrivateIp("172.16.0.1")).toBe(true);
    expect(isPrivateIp("172.31.255.255")).toBe(true);
    expect(isPrivateIp("172.15.0.1")).toBe(false);
    expect(isPrivateIp("172.32.0.1")).toBe(false);
  });

  it("detects 192.168.0.0/16", () => {
    expect(isPrivateIp("192.168.0.1")).toBe(true);
    expect(isPrivateIp("192.168.1.100")).toBe(true);
  });

  it("returns false for public IPs", () => {
    expect(isPrivateIp("8.8.8.8")).toBe(false);
    expect(isPrivateIp("1.1.1.1")).toBe(false);
  });
});

describe("ip-subnet parseInput", () => {
  it("parses CIDR notation", () => {
    expect(parseInput("192.168.1.0/24")).toEqual({ ip: "192.168.1.0", prefix: 24 });
  });

  it("parses IP + mask notation", () => {
    expect(parseInput("192.168.1.0 255.255.255.0")).toEqual({ ip: "192.168.1.0", prefix: 24 });
  });

  it("returns error for empty input", () => {
    expect(parseInput("").error).toBeDefined();
    expect(parseInput("   ").error).toBeDefined();
  });

  it("returns error for invalid IP", () => {
    expect(parseInput("999.0.0.0/24").error).toMatch(/Invalid IP/);
  });

  it("returns error for invalid prefix", () => {
    expect(parseInput("192.168.1.0/33").error).toMatch(/prefix/);
  });

  it("returns error for malformed input", () => {
    expect(parseInput("just text").error).toBeDefined();
  });
});

describe("ip-subnet calculateSubnet", () => {
  it("calculates /24 correctly", () => {
    const r = calculateSubnet("192.168.1.0/24");
    expect(r.isValid).toBe(true);
    expect(r.network).toBe("192.168.1.0");
    expect(r.broadcast).toBe("192.168.1.255");
    expect(r.firstHost).toBe("192.168.1.1");
    expect(r.lastHost).toBe("192.168.1.254");
    expect(r.totalHosts).toBe(256);
    expect(r.usableHosts).toBe(254);
    expect(r.mask).toBe("255.255.255.0");
    expect(r.wildcard).toBe("0.0.0.255");
    expect(r.isPrivate).toBe(true);
  });

  it("calculates /16 correctly", () => {
    const r = calculateSubnet("172.16.0.0/16");
    expect(r.network).toBe("172.16.0.0");
    expect(r.broadcast).toBe("172.16.255.255");
    expect(r.firstHost).toBe("172.16.0.1");
    expect(r.lastHost).toBe("172.16.255.254");
    expect(r.totalHosts).toBe(65536);
    expect(r.usableHosts).toBe(65534);
  });

  it("calculates /8 correctly", () => {
    const r = calculateSubnet("10.0.0.0/8");
    expect(r.network).toBe("10.0.0.0");
    expect(r.broadcast).toBe("10.255.255.255");
    expect(r.totalHosts).toBe(16777216);
    expect(r.usableHosts).toBe(16777214);
  });

  it("calculates /30 (point-to-point) correctly", () => {
    const r = calculateSubnet("192.168.1.0/30");
    expect(r.network).toBe("192.168.1.0");
    expect(r.broadcast).toBe("192.168.1.3");
    expect(r.firstHost).toBe("192.168.1.1");
    expect(r.lastHost).toBe("192.168.1.2");
    expect(r.totalHosts).toBe(4);
    expect(r.usableHosts).toBe(2);
  });

  it("calculates /31 (RFC 3021) correctly", () => {
    const r = calculateSubnet("192.168.1.0/31");
    expect(r.network).toBe("192.168.1.0");
    expect(r.firstHost).toBe("192.168.1.0");
    expect(r.lastHost).toBe("192.168.1.1");
    expect(r.totalHosts).toBe(2);
    expect(r.usableHosts).toBe(2);
  });

  it("calculates /32 (single host) correctly", () => {
    const r = calculateSubnet("192.168.1.5/32");
    expect(r.network).toBe("192.168.1.5");
    expect(r.firstHost).toBe("192.168.1.5");
    expect(r.lastHost).toBe("192.168.1.5");
    expect(r.totalHosts).toBe(1);
    expect(r.usableHosts).toBe(1);
  });

  it("handles host-bit-set input by masking to network", () => {
    const r = calculateSubnet("192.168.1.100/24");
    expect(r.network).toBe("192.168.1.0");
    expect(r.broadcast).toBe("192.168.1.255");
  });

  it("accepts mask notation as input", () => {
    const r = calculateSubnet("192.168.1.0 255.255.255.0");
    expect(r.isValid).toBe(true);
    expect(r.network).toBe("192.168.1.0");
  });

  it("returns invalid for bad input", () => {
    expect(calculateSubnet("not a subnet").isValid).toBe(false);
    expect(calculateSubnet("").isValid).toBe(false);
  });

  it("returns invalid for non-contiguous mask", () => {
    expect(calculateSubnet("192.168.1.0 255.0.255.0").isValid).toBe(false);
  });
});

describe("ip-subnet formatHosts", () => {
  it("formats with thousands separators", () => {
    expect(formatHosts(254)).toBe("254");
    expect(formatHosts(65534)).toBe("65,534");
    expect(formatHosts(16777214)).toBe("16,777,214");
  });
});

// ===== IPv6 + extras tests =====

import {
  ipv6ToBigInt,
  bigIntToIpv6,
  isValidIpv6,
  calculateIpv6Subnet,
  vlsmSplit,
  maskToWildcard,
  ipv4ToPtr,
  ipv6ToPtr,
  whoisUrl,
  ripeStatUrl,
  cidrToRange,
  rangeToCidr,
  mergeCidrs,
  cidrContains,
  ipv4ToBinary,
  maskToBinary,
  subnetToCsv,
  subnetToJson,
  loadSubnetHistory,
  saveSubnetToHistory,
  clearSubnetHistory,
} from "./logic";

describe("ipv6 ipv6ToBigInt / bigIntToIpv6", () => {
  it("parses a full IPv6 address", () => {
    expect(ipv6ToBigInt("2001:0db8:0000:0000:0000:0000:0000:0001")).toBe(0x20010db8000000000000000000000001n);
  });
  it("parses :: shorthand", () => {
    expect(ipv6ToBigInt("::1")).toBe(1n);
    expect(ipv6ToBigInt("2001:db8::1")).toBe(0x20010db8000000000000000000000001n);
  });
  it("round-trips through compression", () => {
    const n = ipv6ToBigInt("2001:db8::1");
    expect(bigIntToIpv6(n!)).toBe("2001:db8::1");
  });
  it("returns -1n for invalid", () => {
    expect(ipv6ToBigInt("not-an-ip")).toBe(-1n);
    expect(ipv6ToBigInt("")).toBe(-1n);
    expect(ipv6ToBigInt(":::")).toBe(-1n);
  });
});

describe("ipv6 isValidIpv6", () => {
  it("accepts valid IPv6", () => {
    expect(isValidIpv6("::1")).toBe(true);
    expect(isValidIpv6("2001:db8::")).toBe(true);
    expect(isValidIpv6("fe80::1")).toBe(true);
  });
  it("rejects invalid", () => {
    expect(isValidIpv6("not-an-ip")).toBe(false);
    expect(isValidIpv6("192.168.1.1")).toBe(false);
  });
});

describe("ipv6 calculateIpv6Subnet", () => {
  it("calculates a /64 subnet", () => {
    const r = calculateIpv6Subnet("2001:db8::/64");
    expect(r.isValid).toBe(true);
    expect(r.prefix).toBe(64);
    expect(r.network).toBe("2001:db8::");
    expect(r.totalHosts).toBe("18446744073709551616"); // 2^64
  });
  it("detects loopback", () => {
    const r = calculateIpv6Subnet("::1/128");
    expect(r.isLoopback).toBe(true);
  });
  it("detects link-local", () => {
    const r = calculateIpv6Subnet("fe80::/10");
    expect(r.isLinkLocal).toBe(true);
  });
  it("detects unique local", () => {
    const r = calculateIpv6Subnet("fd00::/8");
    expect(r.isUniqueLocal).toBe(true);
  });
  it("detects multicast", () => {
    const r = calculateIpv6Subnet("ff02::1/16");
    expect(r.isMulticast).toBe(true);
  });
  it("rejects invalid prefix", () => {
    expect(calculateIpv6Subnet("::1/129").isValid).toBe(false);
  });
  it("rejects invalid IPv6", () => {
    expect(calculateIpv6Subnet("not-an-ip/64").isValid).toBe(false);
  });
});

describe("ipv6 vlsmSplit", () => {
  it("splits a /24 into smaller subnets", () => {
    const entries = vlsmSplit("192.168.1.0/24", [50, 25, 10]);
    expect(entries).toHaveLength(3);
    // Largest first
    expect(entries[0].hostCount).toBe(50);
    expect(entries[0].prefix).toBe(26); // 62 usable
    expect(entries[1].hostCount).toBe(25);
    expect(entries[1].prefix).toBe(27); // 30 usable
  });
  it("throws if hosts won't fit", () => {
    expect(() => vlsmSplit("192.168.1.0/30", [10])).toThrow();
  });
});

describe("ipv6 maskToWildcard", () => {
  it("inverts a subnet mask", () => {
    expect(maskToWildcard("255.255.255.0")).toBe("0.0.0.255");
    expect(maskToWildcard("255.255.0.0")).toBe("0.0.255.255");
    expect(maskToWildcard("255.0.0.0")).toBe("0.255.255.255");
  });
});

describe("ipv6 ipv4ToPtr", () => {
  it("generates PTR record name", () => {
    expect(ipv4ToPtr("192.168.1.10")).toBe("10.1.168.192.in-addr.arpa");
  });
});

describe("ipv6 ipv6ToPtr", () => {
  it("generates IPv6 PTR record name", () => {
    const ptr = ipv6ToPtr("2001:db8::1");
    expect(ptr).toMatch(/\.ip6\.arpa$/);
    expect(ptr).toContain("1.0.0.0");
  });
});

describe("ipv6 whoisUrl / ripeStatUrl", () => {
  it("builds whois URL", () => {
    expect(whoisUrl("8.8.8.8")).toBe("https://whois.com/whois/8.8.8.8");
  });
  it("builds RIPEstat URL", () => {
    expect(ripeStatUrl("8.8.8.8")).toBe("https://stat.ripe.net/8.8.8.8");
  });
});

describe("ipv6 cidrToRange", () => {
  it("converts CIDR to range", () => {
    const r = cidrToRange("192.168.1.0/24");
    expect(r?.start).toBe("192.168.1.0");
    expect(r?.end).toBe("192.168.1.255");
    expect(r?.count).toBe(256);
  });
});

describe("ipv6 rangeToCidr", () => {
  it("converts a range to CIDRs", () => {
    const cidrs = rangeToCidr("192.168.1.0", "192.168.1.255");
    expect(cidrs).toEqual(["192.168.1.0/24"]);
  });
  it("converts a partial range to multiple CIDRs", () => {
    const cidrs = rangeToCidr("10.0.0.1", "10.0.0.6");
    expect(cidrs.length).toBeGreaterThan(1);
  });
});

describe("ipv6 mergeCidrs", () => {
  it("merges adjacent CIDRs", () => {
    const merged = mergeCidrs(["10.0.0.0/25", "10.0.0.128/25"]);
    expect(merged).toEqual(["10.0.0.0/24"]);
  });
});

describe("ipv6 cidrContains", () => {
  it("detects containment", () => {
    const r = cidrContains("10.0.0.0/24", "10.0.0.0/25");
    expect(r.contains).toBe(true);
  });
  it("detects non-containment", () => {
    const r = cidrContains("10.0.0.0/24", "10.0.1.0/24");
    expect(r.contains).toBe(false);
  });
});

describe("ipv6 ipv4ToBinary", () => {
  it("returns 32-bit binary string", () => {
    expect(ipv4ToBinary("192.168.1.1")).toBe("11000000101010000000000100000001");
    expect(ipv4ToBinary("0.0.0.0")).toBe("00000000000000000000000000000000");
    expect(ipv4ToBinary("255.255.255.255")).toBe("11111111111111111111111111111111");
  });
});

describe("ipv6 subnetToCsv / subnetToJson", () => {
  it("formats as CSV", () => {
    const r = calculateSubnet("192.168.1.0/24");
    const csv = subnetToCsv(r);
    expect(csv).toContain("field,value");
    expect(csv).toContain("cidr,192.168.1.0/24");
  });
  it("formats as JSON", () => {
    const r = calculateSubnet("192.168.1.0/24");
    const json = JSON.parse(subnetToJson(r));
    expect(json.cidr).toBe("192.168.1.0/24");
  });
});

describe("ipv6 subnet history", () => {
  beforeEach(() => {
    const store: Record<string, string> = {};
    (globalThis as any).localStorage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
    };
  });
  it("saves and loads", () => {
    saveSubnetToHistory("192.168.1.0/24", "ipv4");
    const h = loadSubnetHistory();
    expect(h).toHaveLength(1);
    expect(h[0].input).toBe("192.168.1.0/24");
  });
  it("clears", () => {
    saveSubnetToHistory("10.0.0.0/8", "ipv4");
    clearSubnetHistory();
    expect(loadSubnetHistory()).toEqual([]);
  });
});
