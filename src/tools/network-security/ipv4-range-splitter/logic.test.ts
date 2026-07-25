import { describe, it, expect } from "vitest";
import { splitRange, splitStartEnd, rangeToCidrList, summarizeSplit } from "./logic";

describe("ipv4-range-splitter splitRange", () => {
  it("splits a single /24", () => {
    const r = splitRange("192.168.1.0 192.168.1.255");
    expect(r.isValid).toBe(true);
    expect(r.cidrs).toEqual(["192.168.1.0/24"]);
    expect(r.count).toBe(256);
  });

  it("accepts dash separator", () => {
    const r = splitRange("192.168.1.0 - 192.168.1.255");
    expect(r.isValid).toBe(true);
    expect(r.cidrs).toEqual(["192.168.1.0/24"]);
  });

  it("accepts comma separator", () => {
    const r = splitRange("192.168.1.0,192.168.1.255");
    expect(r.isValid).toBe(true);
    expect(r.cidrs.length).toBe(1);
  });

  it("rejects reversed range", () => {
    const r = splitRange("192.168.1.255 192.168.1.0");
    expect(r.isValid).toBe(false);
    expect(r.error).toMatch(/start/i);
  });

  it("rejects invalid IP", () => {
    const r = splitRange("999.168.1.0 192.168.1.255");
    expect(r.isValid).toBe(false);
  });
});

describe("ipv4-range-splitter splitStartEnd", () => {
  it("splits an unaligned range into multiple CIDRs", () => {
    const r = splitStartEnd("192.168.1.1", "192.168.1.10");
    expect(r.isValid).toBe(true);
    expect(r.cidrs.length).toBeGreaterThan(1);
    expect(r.count).toBe(10);
  });

  it("single IP returns /32", () => {
    const r = splitStartEnd("8.8.8.8", "8.8.8.8");
    expect(r.cidrs).toEqual(["8.8.8.8/32"]);
  });

  it("returns the full range count", () => {
    const r = splitStartEnd("0.0.0.0", "255.255.255.255");
    expect(r.count).toBe(2 ** 32);
  });
});

describe("ipv4-range-splitter rangeToCidrList", () => {
  it("returns a single aligned block", () => {
    expect(rangeToCidrList(0xc0a80100, 0xc0a801ff)).toEqual(["192.168.1.0/24"]);
  });

  it("splits a non-power-of-two range", () => {
    const cidrs = rangeToCidrList(0xc0a80001, 0xc0a80005);
    expect(cidrs.length).toBe(3);
  });
});

describe("ipv4-range-splitter summarizeSplit", () => {
  it("reports min and max prefix", () => {
    const r = splitStartEnd("192.168.1.1", "192.168.1.10");
    const s = summarizeSplit(r);
    expect(s.smallestPrefix).toBeLessThanOrEqual(s.largestPrefix);
    expect(s.totalAddresses).toBe(10);
  });

  it("returns zeros for invalid input", () => {
    const r = splitRange("bad input");
    const s = summarizeSplit(r);
    expect(s.totalAddresses).toBe(0);
  });
});
