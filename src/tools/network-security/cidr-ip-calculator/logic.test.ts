import { describe, it, expect } from "vitest";
import { calculateCidr, splitSubnet, isValidCidr, getPtr } from "./logic";

describe("CIDR IP Calculator", () => {
  it("calculates IPv4 /24 network", () => {
    const r = calculateCidr("192.168.1.10/24");
    expect(r.version).toBe(4);
    expect(r.network).toBe("192.168.1.0");
    expect(r.broadcast).toBe("192.168.1.255");
    expect(r.firstHost).toBe("192.168.1.1");
    expect(r.lastHost).toBe("192.168.1.254");
    expect(r.hostCount).toBe(254);
    expect(r.subnetMask).toBe("255.255.255.0");
    expect(r.wildcard).toBe("0.0.0.255");
  });

  it("calculates IPv4 /30 network (point-to-point)", () => {
    const r = calculateCidr("10.0.0.0/30");
    expect(r.network).toBe("10.0.0.0");
    expect(r.broadcast).toBe("10.0.0.3");
    expect(r.firstHost).toBe("10.0.0.1");
    expect(r.lastHost).toBe("10.0.0.2");
    expect(r.hostCount).toBe(2);
  });

  it("calculates IPv4 /32 (single host)", () => {
    const r = calculateCidr("192.168.1.5/32");
    expect(r.hostCount).toBe(1);
    expect(r.firstHost).toBe("192.168.1.5");
  });

  it("calculates IPv4 /16 network", () => {
    const r = calculateCidr("172.16.5.10/16");
    expect(r.network).toBe("172.16.0.0");
    expect(r.broadcast).toBe("172.16.255.255");
    expect(r.hostCount).toBe(65534);
  });

  it("detects private IPv4 addresses", () => {
    expect(calculateCidr("10.0.0.0/8").isPrivate).toBe(true);
    expect(calculateCidr("172.16.0.0/12").isPrivate).toBe(true);
    expect(calculateCidr("192.168.1.0/24").isPrivate).toBe(true);
    expect(calculateCidr("8.8.8.0/24").isPrivate).toBe(false);
  });

  it("detects loopback address", () => {
    expect(calculateCidr("127.0.0.1/8").isLoopback).toBe(true);
  });

  it("detects multicast address", () => {
    expect(calculateCidr("224.0.0.1/4").isMulticast).toBe(true);
  });

  it("detects link-local address", () => {
    expect(calculateCidr("169.254.1.1/16").isLinkLocal).toBe(true);
  });

  it("generates PTR record for IPv4", () => {
    expect(getPtr("192.168.1.1", 4)).toBe("1.1.168.192.in-addr.arpa");
  });

  it("calculates IPv6 /64 network", () => {
    const r = calculateCidr("2001:db8::1/64");
    expect(r.version).toBe(6);
    expect(r.network).toBe("2001:db8::");
    expect(r.ipType).toBe("documentation");
  });

  it("calculates IPv6 loopback", () => {
    const r = calculateCidr("::1/128");
    expect(r.isLoopback).toBe(true);
    expect(r.hostCount).toBe(1);
  });

  it("detects IPv6 link-local", () => {
    const r = calculateCidr("fe80::1/10");
    expect(r.isLinkLocal).toBe(true);
  });

  it("detects IPv6 unique-local (fc00::/7)", () => {
    const r = calculateCidr("fd00::1/8");
    expect(r.isPrivate).toBe(true);
  });

  it("rejects invalid prefix", () => {
    const r = calculateCidr("192.168.1.0/33");
    expect(r.error).toBeDefined();
  });

  it("rejects invalid IPv6 prefix", () => {
    const r = calculateCidr("::1/129");
    expect(r.error).toBeDefined();
  });

  it("rejects invalid IPv4", () => {
    const r = calculateCidr("999.999.999.999/24");
    expect(r.error).toBeDefined();
  });

  it("rejects malformed input", () => {
    expect(isValidCidr("not-a-cidr")).toBe(false);
    expect(isValidCidr("192.168.1.0/24")).toBe(true);
  });

  it("splits /24 into two /25 subnets", () => {
    const subnets = splitSubnet("192.168.1.0/24", 25);
    expect(subnets).toHaveLength(2);
    expect(subnets[0].network).toBe("192.168.1.0");
    expect(subnets[1].network).toBe("192.168.1.128");
  });

  it("splits /16 into four /18 subnets", () => {
    const subnets = splitSubnet("10.0.0.0/16", 18);
    expect(subnets).toHaveLength(4);
    expect(subnets[0].network).toBe("10.0.0.0");
    expect(subnets[3].network).toBe("10.0.192.0");
  });
});
