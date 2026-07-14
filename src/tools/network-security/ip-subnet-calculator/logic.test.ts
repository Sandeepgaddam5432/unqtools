import { describe, it, expect } from "vitest";
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
