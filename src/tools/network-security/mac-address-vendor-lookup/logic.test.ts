import { describe, it, expect } from "vitest";
import {
  normalizeMac, formatMac, extractOui, isLocallyAdministered, isMulticast,
  isUniversal, lookupMac, bulkLookup, reverseLookup, generateRandomMac,
  isValidMac, getAllVendors,
} from "./logic";

describe("MAC Address Vendor Lookup", () => {
  it("normalizes MAC addresses (strip separators)", () => {
    expect(normalizeMac("AA:BB:CC:DD:EE:FF")).toBe("AABBCCDDEEFF");
    expect(normalizeMac("aa-bb-cc-dd-ee-ff")).toBe("AABBCCDDEEFF");
    expect(normalizeMac("aabb.ccdd.eeff")).toBe("AABBCCDDEEFF");
    expect(normalizeMac("aabbccddeeff")).toBe("AABBCCDDEEFF");
  });

  it("formats MAC in colon style", () => {
    expect(formatMac("aabbccddeeff", "colon")).toBe("AA:BB:CC:DD:EE:FF");
  });

  it("formats MAC in dash style", () => {
    expect(formatMac("aabbccddeeff", "dash")).toBe("AA-BB-CC-DD-EE-FF");
  });

  it("formats MAC in dot (Cisco) style", () => {
    expect(formatMac("aabbccddeeff", "dot")).toBe("AABB.CCDD.EEFF");
  });

  it("formats MAC in none style", () => {
    expect(formatMac("aabbccddeeff", "none")).toBe("AABBCCDDEEFF");
  });

  it("extracts OUI prefix", () => {
    expect(extractOui("AA:BB:CC:DD:EE:FF")).toBe("AA:BB:CC");
    expect(extractOui("aabbccddeeff")).toBe("AA:BB:CC");
  });

  it("detects locally-administered bit", () => {
    // 02:00:00:00:00:00 — locally administered
    expect(isLocallyAdministered("02:00:00:00:00:00")).toBe(true);
    // 00:00:00:00:00:00 — universal
    expect(isLocallyAdministered("00:00:00:00:00:00")).toBe(false);
  });

  it("detects multicast bit", () => {
    // 01:00:00:00:00:00 — multicast
    expect(isMulticast("01:00:00:00:00:00")).toBe(true);
    // 00:00:00:00:00:00 — unicast
    expect(isMulticast("00:00:00:00:00:00")).toBe(false);
  });

  it("isUniversal is opposite of locally-administered", () => {
    expect(isUniversal("00:00:00:00:00:00")).toBe(true);
    expect(isUniversal("02:00:00:00:00:00")).toBe(false);
  });

  it("looks up Apple OUI", () => {
    const result = lookupMac("00:1B:44:00:00:00");
    expect(result.found).toBe(true);
    expect(result.vendor).toBe("Apple, Inc.");
    expect(result.country).toBe("US");
  });

  it("looks up Dell OUI", () => {
    const result = lookupMac("00:1A:11:00:00:00");
    expect(result.found).toBe(true);
    expect(result.vendor).toBe("Dell Inc.");
  });

  it("returns Unknown for unregistered OUI", () => {
    const result = lookupMac("FF:FF:FF:00:00:00");
    expect(result.found).toBe(false);
    expect(result.vendor).toBe("Unknown");
  });

  it("bulk looks up multiple MACs", () => {
    const results = bulkLookup("00:1B:44:00:00:00\n00:1A:11:00:00:00\ninvalid");
    expect(results).toHaveLength(3);
    expect(results[0].vendor).toBe("Apple, Inc.");
    expect(results[1].vendor).toBe("Dell Inc.");
  });

  it("reverse lookup finds OUI for vendor name", () => {
    const ouis = reverseLookup("Apple");
    expect(ouis.length).toBeGreaterThan(5);
    expect(ouis).toContain("00:1B:44");
  });

  it("generates a random MAC", () => {
    const mac = generateRandomMac();
    expect(isValidMac(mac)).toBe(true);
  });

  it("generates an Apple-prefixed MAC", () => {
    const mac = generateRandomMac({ vendor: "Apple" });
    const oui = extractOui(mac);
    const lookup = lookupMac(mac);
    expect(lookup.vendor).toBe("Apple, Inc.");
  });

  it("generates a locally-administered MAC", () => {
    const mac = generateRandomMac({ locallyAdministered: true });
    expect(isLocallyAdministered(mac)).toBe(true);
  });

  it("validates MAC address", () => {
    expect(isValidMac("AA:BB:CC:DD:EE:FF")).toBe(true);
    expect(isValidMac("AA:BB:CC:DD:EE")).toBe(false);
    expect(isValidMac("ZZBBCCDDEEFF")).toBe(false);
  });

  it("lists all known vendors", () => {
    const vendors = getAllVendors();
    expect(vendors.length).toBeGreaterThan(10);
    expect(vendors.some((v) => v.name === "Apple, Inc.")).toBe(true);
  });
});
