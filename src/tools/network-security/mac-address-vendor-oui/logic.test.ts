import { describe, it, expect } from "vitest";
import { normalizeMac, formatMac, extractOui, isLocallyAdministered, isMulticast, lookupMac, isValidMac, generateRandomMac, getAllVendors } from "./logic";

describe("MAC Address Vendor Lookup", () => {
  it("normalizes MAC addresses", () => {
    expect(normalizeMac("AA:BB:CC:DD:EE:FF")).toBe("AABBCCDDEEFF");
    expect(normalizeMac("aa-bb-cc-dd-ee-ff")).toBe("AABBCCDDEEFF");
  });
  it("formats MAC in colon style", () => {
    expect(formatMac("aabbccddeeff", "colon")).toBe("AA:BB:CC:DD:EE:FF");
  });
  it("extracts OUI prefix", () => {
    expect(extractOui("00:1B:44:00:00:00")).toBe("00:1B:44");
  });
  it("detects locally administered bit", () => {
    expect(isLocallyAdministered("02:00:00:00:00:00")).toBe(true);
    expect(isLocallyAdministered("00:00:00:00:00:00")).toBe(false);
  });
  it("detects multicast bit", () => {
    expect(isMulticast("01:00:00:00:00:00")).toBe(true);
    expect(isMulticast("00:00:00:00:00:00")).toBe(false);
  });
  it("looks up Apple OUI", () => {
    const r = lookupMac("00:1B:44:00:00:00");
    expect(r.found).toBe(true);
    expect(r.vendor).toBe("Apple, Inc.");
  });
  it("returns Unknown for unregistered OUI", () => {
    const r = lookupMac("FF:FF:FF:00:00:00");
    expect(r.found).toBe(false);
  });
  it("validates MAC address", () => {
    expect(isValidMac("AA:BB:CC:DD:EE:FF")).toBe(true);
    expect(isValidMac("AA:BB:CC")).toBe(false);
  });
  it("generates random MAC", () => {
    expect(isValidMac(generateRandomMac())).toBe(true);
  });
  it("lists all vendors", () => {
    expect(getAllVendors().length).toBeGreaterThan(5);
  });
});
