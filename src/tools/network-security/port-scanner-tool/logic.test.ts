import { describe, it, expect } from "vitest";
import { lookupPort, lookupService, getPortCategory, parsePortRange, getPortRisk, getCommonPorts } from "./logic";

describe("Port Scanner", () => {
  it("looks up port 80", () => {
    const p = lookupPort(80);
    expect(p?.service).toBe("HTTP");
  });
  it("looks up port 443", () => {
    const p = lookupPort(443);
    expect(p?.service).toBe("HTTPS");
  });
  it("returns null for unknown port", () => {
    expect(lookupPort(99999)).toBeNull();
  });
  it("looks up service by name", () => {
    const results = lookupService("SQL");
    expect(results.length).toBeGreaterThan(0);
  });
  it("gets port category", () => {
    expect(getPortCategory(80)).toBe("Well-known");
    expect(getPortCategory(8080)).toBe("Registered");
    expect(getPortCategory(50000)).toBe("Dynamic/Private");
  });
  it("parses port ranges", () => {
    expect(parsePortRange("80,443,8080")).toEqual([80, 443, 8080]);
    expect(parsePortRange("100-103")).toEqual([100, 101, 102, 103]);
  });
  it("gets port risk level", () => {
    expect(getPortRisk(23)).toBe("high");
    expect(getPortRisk(443)).toBe("low");
  });
  it("lists common ports", () => {
    expect(getCommonPorts().length).toBeGreaterThan(10);
  });
});
