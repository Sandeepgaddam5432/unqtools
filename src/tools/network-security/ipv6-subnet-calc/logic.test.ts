import { describe, it, expect } from "vitest";
import { expandIpv6, compressIpv6, ipv6ToBigInt, bigIntToIpv6, computeSubnet, reverseDns } from "./logic";

describe("expandIpv6", () => {
  it("expands ::", () => {
    expect(expandIpv6("::")).toBe("0000:0000:0000:0000:0000:0000:0000:0000");
  });
  it("expands ::1", () => {
    expect(expandIpv6("::1")).toBe("0000:0000:0000:0000:0000:0000:0000:0001");
  });
  it("expands 2001:db8::1", () => {
    expect(expandIpv6("2001:db8::1")).toBe("2001:0db8:0000:0000:0000:0000:0000:0001");
  });
  it("returns null for invalid", () => {
    expect(expandIpv6("notanip")).toBeNull();
  });
});

describe("compressIpv6", () => {
  it("compresses zeros with ::", () => {
    expect(compressIpv6("0000:0000:0000:0000:0000:0000:0000:0001")).toBe("::1");
  });
  it("compresses 2001:db8::1", () => {
    expect(compressIpv6("2001:0db8:0000:0000:0000:0000:0000:0001")).toBe("2001:db8::1");
  });
});

describe("ipv6ToBigInt / bigIntToIpv6", () => {
  it("round trip", () => {
    const expanded = "2001:0db8:0000:0000:0000:0000:0000:0001";
    const v = ipv6ToBigInt(expanded);
    expect(bigIntToIpv6(v)).toBe(expanded);
  });
});

describe("computeSubnet", () => {
  it("computes /64 network", () => {
    const r = computeSubnet("2001:db8::/64");
    if ("error" in r) throw new Error("should not error");
    expect(r.network).toBe("2001:db8::");
    expect(r.prefix).toBe(64);
  });
  it("errors on invalid prefix", () => {
    expect(computeSubnet("2001:db8::/300")).toHaveProperty("error");
  });
  it("errors on invalid format", () => {
    expect(computeSubnet("bad")).toHaveProperty("error");
  });
});

describe("reverseDns", () => {
  it("builds ip6.arpa zone", () => {
    const rd = reverseDns("2001:0db8:0000:0000:0000:0000:0000:0000", 32);
    expect(rd).toMatch(/ip6\.arpa$/);
  });
});
