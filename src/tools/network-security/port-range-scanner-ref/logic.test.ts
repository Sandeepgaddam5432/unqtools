import { describe, it, expect } from "vitest";
import {
  getAllPorts,
  lookupByPort,
  lookupByService,
  searchPorts,
  filterByProtocol,
  filterEncrypted,
  classifyPort,
  PORT_RANGES,
} from "./logic";

describe("port-range-scanner-ref getAllPorts", () => {
  it("returns 20 well-known ports", () => {
    expect(getAllPorts().length).toBeGreaterThanOrEqual(20);
  });

  it("returns ports sorted by port number", () => {
    const ports = getAllPorts().map((p) => p.port);
    const sorted = [...ports].sort((a, b) => a - b);
    expect(ports).toEqual(sorted);
  });
});

describe("port-range-scanner-ref lookupByPort", () => {
  it("finds port 22 (SSH)", () => {
    const p = lookupByPort(22);
    expect(p).not.toBeNull();
    expect(p!.service).toBe("SSH");
    expect(p!.encrypted).toBe(true);
  });

  it("finds port 443 (HTTPS)", () => {
    const p = lookupByPort(443);
    expect(p).not.toBeNull();
    expect(p!.service).toBe("HTTPS");
  });

  it("returns null for unknown well-known port", () => {
    expect(lookupByPort(1234)).toBeNull();
  });

  it("returns null for out-of-range ports", () => {
    expect(lookupByPort(-1)).toBeNull();
    expect(lookupByPort(70000)).toBeNull();
    expect(lookupByPort(3.5)).toBeNull();
  });
});

describe("port-range-scanner-ref lookupByService", () => {
  it("finds by service name (case-insensitive)", () => {
    const matches = lookupByService("smtp");
    expect(matches.length).toBeGreaterThan(0);
    expect(matches.some((m) => m.port === 25)).toBe(true);
  });

  it("returns empty for blank query", () => {
    expect(lookupByService("   ")).toEqual([]);
  });
});

describe("port-range-scanner-ref searchPorts", () => {
  it("returns all ports for empty query", () => {
    expect(searchPorts("").length).toBeGreaterThanOrEqual(20);
  });

  it("matches by port number as string", () => {
    const matches = searchPorts("443");
    expect(matches.some((m) => m.port === 443)).toBe(true);
  });

  it("matches by description", () => {
    const matches = searchPorts("mail");
    expect(matches.length).toBeGreaterThan(0);
  });
});

describe("port-range-scanner-ref filterByProtocol / filterEncrypted", () => {
  it("filterByProtocol returns ports supporting that protocol", () => {
    const tcp = filterByProtocol("tcp");
    expect(tcp.some((p) => p.port === 80)).toBe(true);
    expect(tcp.some((p) => p.port === 53)).toBe(true); // 'both'
  });

  it("filterEncrypted returns encrypted ports", () => {
    const enc = filterEncrypted(true);
    expect(enc.every((p) => p.encrypted)).toBe(true);
    expect(enc.some((p) => p.port === 443)).toBe(true);
  });
});

describe("port-range-scanner-ref classifyPort", () => {
  it("classifies well-known ports", () => {
    expect(classifyPort(80)?.category).toBe("Well-known");
  });

  it("classifies registered ports", () => {
    expect(classifyPort(3306)?.category).toBe("Registered");
  });

  it("classifies dynamic ports", () => {
    expect(classifyPort(50000)?.category).toBe("Dynamic/Private");
  });

  it("returns null for invalid port", () => {
    expect(classifyPort(-5)).toBeNull();
  });

  it("PORT_RANGES has 3 ranges", () => {
    expect(PORT_RANGES.length).toBe(3);
  });
});
