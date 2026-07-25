/**
 * Subnet Mask Validator — unit tests.
 */
import { describe, it, expect } from "vitest";
import { validateMask, parseDottedQuad, toDottedQuad, cidrToMask, maskToCidr } from "./logic";

describe("subnet-mask parseDottedQuad", () => {
  it("parses 255.255.255.0", () => {
    expect(parseDottedQuad("255.255.255.0")).toBe(0xffffff00);
  });
  it("parses 0.0.0.0", () => {
    expect(parseDottedQuad("0.0.0.0")).toBe(0);
  });
  it("rejects invalid octet > 255", () => {
    expect(parseDottedQuad("256.1.1.1")).toBeNull();
  });
  it("rejects too few octets", () => {
    expect(parseDottedQuad("255.255.255")).toBeNull();
  });
});

describe("subnet-mask toDottedQuad", () => {
  it("converts 0xffffff00 to 255.255.255.0", () => {
    expect(toDottedQuad(0xffffff00)).toBe("255.255.255.0");
  });
});

describe("subnet-mask cidrToMask", () => {
  it("converts /24", () => {
    expect(cidrToMask(24)).toBe(0xffffff00);
  });
  it("converts /0", () => {
    expect(cidrToMask(0)).toBe(0);
  });
  it("converts /32", () => {
    expect(cidrToMask(32)).toBe(0xffffffff);
  });
  it("returns null for invalid CIDR", () => {
    expect(cidrToMask(-1)).toBeNull();
    expect(cidrToMask(33)).toBeNull();
    expect(cidrToMask(24.5)).toBeNull();
  });
});

describe("subnet-mask maskToCidr", () => {
  it("converts 255.255.255.0 to 24", () => {
    expect(maskToCidr(0xffffff00)).toBe(24);
  });
  it("converts 255.255.0.0 to 16", () => {
    expect(maskToCidr(0xffff0000)).toBe(16);
  });
  it("returns null for non-contiguous mask", () => {
    expect(maskToCidr(0xff00ff00)).toBeNull();
  });
});

describe("subnet-mask validateMask", () => {
  it("validates CIDR input '24'", () => {
    const r = validateMask("24");
    expect(r.isValid).toBe(true);
    expect(r.cidr).toBe(24);
    expect(r.dotted).toBe("255.255.255.0");
    expect(r.wildcard).toBe("0.0.0.255");
    expect(r.usableHosts).toBe(254);
  });
  it("validates dotted input '255.255.255.0'", () => {
    const r = validateMask("255.255.255.0");
    expect(r.isValid).toBe(true);
    expect(r.cidr).toBe(24);
  });
  it("flags non-contiguous mask", () => {
    const r = validateMask("255.0.255.0");
    expect(r.isValid).toBe(false);
    expect(r.errors.length).toBeGreaterThan(0);
  });
  it("rejects out-of-range CIDR", () => {
    const r = validateMask("64");
    expect(r.isValid).toBe(false);
  });
  it("handles /32", () => {
    const r = validateMask("32");
    expect(r.isValid).toBe(true);
    expect(r.dotted).toBe("255.255.255.255");
    expect(r.totalHosts).toBe(1);
    expect(r.usableHosts).toBe(0);
  });
  it("handles empty input", () => {
    const r = validateMask("");
    expect(r.isValid).toBe(false);
  });
});
