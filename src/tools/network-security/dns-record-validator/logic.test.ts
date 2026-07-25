import { describe, it, expect } from "vitest";
import { isValidIpv4, isValidIpv6, isValidHostname, isValidEmail, validateRecord } from "./logic";

describe("isValidIpv4", () => {
  it("accepts valid IPv4", () => {
    expect(isValidIpv4("192.168.1.1")).toBe(true);
    expect(isValidIpv4("0.0.0.0")).toBe(true);
    expect(isValidIpv4("255.255.255.255")).toBe(true);
  });
  it("rejects invalid IPv4", () => {
    expect(isValidIpv4("256.1.1.1")).toBe(false);
    expect(isValidIpv4("1.2.3")).toBe(false);
    expect(isValidIpv4("abc")).toBe(false);
  });
});

describe("isValidIpv6", () => {
  it("accepts full IPv6", () => {
    expect(isValidIpv6("2001:0db8:0000:0000:0000:0000:0000:0001")).toBe(true);
  });
  it("accepts loopback", () => {
    expect(isValidIpv6("::1")).toBe(true);
  });
  it("rejects invalid", () => {
    expect(isValidIpv6("not-an-ip")).toBe(false);
  });
});

describe("isValidHostname", () => {
  it("accepts valid hostname", () => {
    expect(isValidHostname("example.com")).toBe(true);
    expect(isValidHostname("sub.example.com")).toBe(true);
  });
  it("rejects invalid hostname", () => {
    expect(isValidHostname("-bad")).toBe(false);
    expect(isValidHostname("nohost")).toBe(false);
  });
});

describe("isValidEmail", () => {
  it("accepts valid email", () => {
    expect(isValidEmail("user@example.com")).toBe(true);
  });
  it("rejects invalid email", () => {
    expect(isValidEmail("no-at-sign")).toBe(false);
  });
});

describe("validateRecord", () => {
  it("validates A record", () => {
    expect(validateRecord({ type: "A", value: "1.2.3.4" })).toEqual({ ok: true });
    expect(validateRecord({ type: "A", value: "bad" })).toHaveProperty("error");
  });
  it("validates AAAA record", () => {
    expect(validateRecord({ type: "AAAA", value: "::1" })).toEqual({ ok: true });
  });
  it("validates MX record", () => {
    expect(validateRecord({ type: "MX", value: "mail.example.com", priority: 10 })).toEqual({ ok: true });
    expect(validateRecord({ type: "MX", value: "mail.example.com" })).toHaveProperty("error");
  });
  it("validates TXT record", () => {
    expect(validateRecord({ type: "TXT", value: "v=spf1 -all" })).toEqual({ ok: true });
    expect(validateRecord({ type: "TXT", value: "" })).toHaveProperty("error");
  });
  it("validates SRV record", () => {
    expect(validateRecord({ type: "SRV", value: "", priority: 10, weight: 20, port: 443, target: "sip.example.com" })).toEqual({ ok: true });
  });
  it("validates CAA record", () => {
    expect(validateRecord({ type: "CAA", value: '0 issue "letsencrypt.org"' })).toEqual({ ok: true });
  });
});
