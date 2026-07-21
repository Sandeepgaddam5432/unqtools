import { describe, it, expect, beforeEach } from "vitest";
import {
  OUI_REGISTRY,
  DB_VERSION,
  FORMAT_LABELS,
  BLOCK_LABELS,
  MODE_LABELS,
  normalizeHex,
  detectFormat,
  validateMac,
  eui64ToEui48,
  eui48ToEui64,
  firstOctet,
  isLocallyAdministered,
  isMulticast,
  isBroadcast,
  isNull,
  lookupVendor,
  formatAll,
  formatOne,
  resolveMac,
  reverseSearch,
  formatOuiPrefix,
  generateRandomMacs,
  batchLookup,
  renderCsv,
  renderJson,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  mulberry32,
  hashSeed,
  createRng,
  type MacFormat,
  type MacCase,
  type BlockType,
  type RandomMacOptions,
  type HistoryEntry,
} from "./logic";

beforeEach(() => {
  const store: Record<string, string> = {};
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; },
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() { return Object.keys(store).length; },
  };
});

describe("mac-oui constants & registry", () => {
  it("has a DB version string", () => {
    expect(DB_VERSION).toMatch(/\d{4}/);
  });
  it("has 200+ OUI registry entries", () => {
    expect(OUI_REGISTRY.length).toBeGreaterThanOrEqual(200);
  });
  it("has 5 format labels", () => {
    expect(Object.keys(FORMAT_LABELS)).toHaveLength(5);
  });
  it("has 4 block labels", () => {
    expect(Object.keys(BLOCK_LABELS)).toHaveLength(4);
  });
  it("has 4 mode labels", () => {
    expect(Object.keys(MODE_LABELS)).toHaveLength(4);
  });
  it("includes MA-M 28-bit entries (7 hex chars)", () => {
    expect(OUI_REGISTRY.some((e) => e.prefix.length === 7)).toBe(true);
  });
  it("includes MA-S/IAB 36-bit entries (9 hex chars)", () => {
    expect(OUI_REGISTRY.some((e) => e.prefix.length === 9)).toBe(true);
  });
  it("includes common vendors Apple, Cisco, VMware, Intel, Dell", () => {
    const vendors = OUI_REGISTRY.map((e) => e.vendor).join("|");
    expect(vendors).toMatch(/Apple/);
    expect(vendors).toMatch(/Cisco/);
    expect(vendors).toMatch(/VMware/);
    expect(vendors).toMatch(/Intel/);
    expect(vendors).toMatch(/Dell/);
  });
});

describe("mac-oui normalizeHex", () => {
  it("strips non-hex and uppercases", () => {
    expect(normalizeHex("00:1a:2b-3c.4d5e")).toBe("001A2B3C4D5E");
  });
  it("handles empty", () => {
    expect(normalizeHex("")).toBe("");
  });
});

describe("mac-oui detectFormat", () => {
  it("detects colon EUI-48", () => {
    expect(detectFormat("00:1A:2B:3C:4D:5E")).toBe("colon");
  });
  it("detects hyphen EUI-48", () => {
    expect(detectFormat("00-1A-2B-3C-4D-5E")).toBe("hyphen");
  });
  it("detects Cisco dot EUI-48", () => {
    expect(detectFormat("001A.2B3C.4D5E")).toBe("dot");
  });
  it("detects bare hex EUI-48", () => {
    expect(detectFormat("001A2B3C4D5E")).toBe("bare");
  });
  it("detects EUI-64 with colons", () => {
    expect(detectFormat("00:1A:2B:FF:FE:3C:4D:5E")).toBe("eui64");
  });
  it("returns unknown for junk", () => {
    expect(detectFormat("hello world")).toBe("unknown");
  });
});

describe("mac-oui validateMac", () => {
  it("accepts colon EUI-48", () => {
    const v = validateMac("00:1A:2B:3C:4D:5E");
    expect(v.valid).toBe(true);
    expect(v.normalized).toBe("001A2B3C4D5E");
  });
  it("accepts hyphen EUI-48", () => {
    const v = validateMac("00-1A-2B-3C-4D-5E");
    expect(v.valid).toBe(true);
    expect(v.normalized).toBe("001A2B3C4D5E");
  });
  it("accepts Cisco dot EUI-48", () => {
    const v = validateMac("001A.2B3C.4D5E");
    expect(v.valid).toBe(true);
    expect(v.normalized).toBe("001A2B3C4D5E");
  });
  it("accepts bare hex EUI-48", () => {
    const v = validateMac("001A2B3C4D5E");
    expect(v.valid).toBe(true);
    expect(v.normalized).toBe("001A2B3C4D5E");
  });
  it("accepts EUI-64 with FF:FE insert and collapses to EUI-48", () => {
    const v = validateMac("00:1A:2B:FF:FE:3C:4D:5E");
    expect(v.valid).toBe(true);
    expect(v.normalized).toBe("001A2B3C4D5E");
  });
  it("rejects empty input", () => {
    expect(validateMac("").valid).toBe(false);
  });
  it("rejects unknown format", () => {
    expect(validateMac("hello").valid).toBe(false);
  });
  it("rejects wrong-length hex", () => {
    expect(validateMac("00112233").valid).toBe(false);
  });
});

describe("mac-oui EUI-64 conversion", () => {
  it("expands EUI-48 to EUI-64 with FF:FE insert", () => {
    expect(eui48ToEui64("001A2B3C4D5E")).toBe("001A2BFFFE3C4D5E");
  });
  it("collapses EUI-64 with FF:FE to EUI-48", () => {
    expect(eui64ToEui48("001A2BFFFE3C4D5E")).toBe("001A2B3C4D5E");
  });
  it("returns null for EUI-64 without FF:FE insert", () => {
    expect(eui64ToEui48("001A2B3C4D5E6F70")).toBeNull();
  });
  it("returns null for wrong-length input to eui48ToEui64", () => {
    expect(eui48ToEui64("001A2B3C4D")).toBeNull();
  });
});

describe("mac-oui bit decoding", () => {
  it("firstOctet returns 0..255", () => {
    expect(firstOctet("001A2B3C4D5E")).toBe(0x00);
    expect(firstOctet("FF1A2B3C4D5E")).toBe(0xFF);
  });
  it("isLocallyAdministered detects LAA bit", () => {
    expect(isLocallyAdministered("001A2B3C4D5E")).toBe(false); // 0x00
    expect(isLocallyAdministered("021A2B3C4D5E")).toBe(true);  // 0x02 (bit 1 set)
    expect(isLocallyAdministered("061A2B3C4D5E")).toBe(true);  // 0x06 (bit 1+2 set)
  });
  it("isMulticast detects I/G bit", () => {
    expect(isMulticast("001A2B3C4D5E")).toBe(false);
    expect(isMulticast("011A2B3C4D5E")).toBe(true);  // 0x01 (LSB set)
    expect(isMulticast("031A2B3C4D5E")).toBe(true);  // 0x03
  });
  it("isBroadcast detects FF:FF:FF:FF:FF:FF", () => {
    expect(isBroadcast("FFFFFFFFFFFF")).toBe(true);
    expect(isBroadcast("001A2B3C4D5E")).toBe(false);
  });
  it("isNull detects 00:00:00:00:00:00", () => {
    expect(isNull("000000000000")).toBe(true);
    expect(isNull("001A2B3C4D5E")).toBe(false);
  });
});

describe("mac-oui lookupVendor", () => {
  it("returns null for locally-administered MAC", () => {
    expect(lookupVendor("021A2B3C4D5E").vendor).toBeNull();
  });
  it("resolves a known MA-L prefix (VMware 00:50:56)", () => {
    const r = lookupVendor("005056ABCDEF");
    expect(r.vendor).toMatch(/VMware/);
    expect(r.block).toBe("MA-L");
    expect(r.prefixBits).toBe(24);
  });
  it("resolves a known Cisco prefix (00:00:0C)", () => {
    const r = lookupVendor("00000CABCDEF");
    expect(r.vendor).toMatch(/Cisco/);
  });
  it("resolves an MA-M 28-bit prefix when present (70:B3:D5:1X)", () => {
    const r = lookupVendor("70B3D51ABCDEF");
    expect(r.vendor).toMatch(/MA-M/);
    expect(r.block).toBe("MA-M");
    expect(r.prefixBits).toBe(28);
  });
  it("resolves an MA-S/IAB 36-bit prefix when present (5C:1D:D9:00:0X)", () => {
    const r = lookupVendor("5C1DD9000ABCDEF");
    expect(r.vendor).toMatch(/MA-S block 5C1DD9000/);
    expect(r.block).toBe("MA-S/IAB");
    expect(r.prefixBits).toBe(36);
  });
  it("returns null for unknown OUI", () => {
    expect(lookupVendor("FFFFFFFFFFFF").vendor).toBeNull(); // broadcast (no LAA bit set but no OUI match)
  });
});

describe("mac-oui formatAll & formatOne", () => {
  it("formatAll produces colon, hyphen, dot, bare, eui64, invertedColon", () => {
    const f = formatAll("001A2B3C4D5E");
    expect(f.colon).toBe("00:1A:2B:3C:4D:5E");
    expect(f.hyphen).toBe("00-1A-2B-3C-4D-5E");
    expect(f.dot).toBe("001A.2B3C.4D5E");
    expect(f.bare).toBe("001A2B3C4D5E");
    expect(f.eui64).toBe("00:1A:2B:FF:FE:3C:4D:5E");
    expect(f.invertedColon.length).toBe(17);
  });
  it("formatAll respects lower-case", () => {
    const f = formatAll("001A2B3C4D5E", "lower");
    expect(f.colon).toBe("00:1a:2b:3c:4d:5e");
    expect(f.bare).toBe("001a2b3c4d5e");
  });
  it("formatOne returns the requested format", () => {
    expect(formatOne("001A2B3C4D5E", "colon")).toBe("00:1A:2B:3C:4D:5E");
    expect(formatOne("001A2B3C4D5E", "hyphen")).toBe("00-1A-2B-3C-4D-5E");
    expect(formatOne("001A2B3C4D5E", "dot")).toBe("001A.2B3C.4D5E");
    expect(formatOne("001A2B3C4D5E", "bare")).toBe("001A2B3C4D5E");
    expect(formatOne("001A2B3C4D5E", "eui64")).toBe("00:1A:2B:FF:FE:3C:4D:5E");
  });
});

describe("mac-oui resolveMac (full info)", () => {
  it("resolves a known VMware MAC", () => {
    const info = resolveMac("00:50:56:AB:CD:EF");
    expect(info).not.toBeNull();
    expect(info!.vendor).toMatch(/VMware/);
    expect(info!.block).toBe("MA-L");
    expect(info!.locallyAdministered).toBe(false);
    expect(info!.multicast).toBe(false);
  });
  it("flags a locally-administered MAC", () => {
    const info = resolveMac("02:50:56:AB:CD:EF");
    expect(info).not.toBeNull();
    expect(info!.locallyAdministered).toBe(true);
    expect(info!.vendor).toBeNull();
    expect(info!.notes.some((n) => n.includes("Locally-administered"))).toBe(true);
  });
  it("flags a multicast MAC", () => {
    const info = resolveMac("01:50:56:AB:CD:EF");
    expect(info).not.toBeNull();
    expect(info!.multicast).toBe(true);
  });
  it("flags broadcast FF:FF:FF:FF:FF:FF", () => {
    const info = resolveMac("FF:FF:FF:FF:FF:FF");
    expect(info!.isBroadcast).toBe(true);
    expect(info!.multicast).toBe(true);
  });
  it("returns null for invalid input", () => {
    expect(resolveMac("not-a-mac")).toBeNull();
  });
});

describe("mac-oui reverseSearch", () => {
  it("finds prefixes by vendor substring (Cisco)", () => {
    const results = reverseSearch("Cisco");
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.vendor.includes("Cisco"))).toBe(true);
    const cisco = results.find((r) => r.vendor.includes("Cisco"))!;
    expect(cisco.prefixes.length).toBeGreaterThan(0);
  });
  it("returns empty for empty query", () => {
    expect(reverseSearch("")).toEqual([]);
  });
  it("returns empty for unknown vendor", () => {
    expect(reverseSearch("NoSuchVendorXYZ123")).toEqual([]);
  });
});

describe("mac-oui formatOuiPrefix", () => {
  it("formats 6-hex MA-L as 3-octet colon", () => {
    expect(formatOuiPrefix("005056")).toBe("00:50:56");
  });
  it("formats 7-hex MA-M", () => {
    expect(formatOuiPrefix("70B3D51")).toBe("70:B3:D5:1");
  });
  it("formats 9-hex MA-S/IAB", () => {
    expect(formatOuiPrefix("5C1DD9000")).toBe("5C:1D:D9:00:0");
  });
});

describe("mac-oui PRNG", () => {
  it("mulberry32 is deterministic for same seed", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect(a()).toBe(b());
    expect(a()).toBe(b());
  });
  it("hashSeed produces stable unsigned int", () => {
    expect(hashSeed("hello")).toBe(hashSeed("hello"));
    expect(hashSeed(42)).toBe(42);
  });
  it("createRng produces hex of requested length", () => {
    const rng = createRng("seed");
    expect(rng.hex(6).length).toBe(6);
    expect(rng.hex(12)).toMatch(/^[0-9A-F]{12}$/);
  });
});

describe("mac-oui generateRandomMacs", () => {
  it("generates the requested count", () => {
    const out = generateRandomMacs({ format: "colon", case: "upper", mode: "random", seed: "s1" }, 5);
    expect(out).toHaveLength(5);
    expect(out[0].mac).toMatch(/^([0-9A-F]{2}:){5}[0-9A-F]{2}$/);
  });
  it("random mode sets LAA bit and clears multicast", () => {
    const out = generateRandomMacs({ format: "bare", case: "upper", mode: "random", seed: "s2" }, 3);
    for (const m of out) {
      expect(m.locallyAdministered).toBe(true);
      expect(m.multicast).toBe(false);
    }
  });
  it("vendor mode uses the requested prefix", () => {
    const out = generateRandomMacs({ format: "bare", case: "upper", mode: "vendor", vendorPrefix: "005056", seed: "s3" }, 3);
    for (const m of out) {
      expect(m.raw.startsWith("005056")).toBe(true);
      expect(m.vendor).toMatch(/VMware/);
    }
  });
  it("laa mode sets LAA bit", () => {
    const out = generateRandomMacs({ format: "bare", case: "upper", mode: "laa", seed: "s4" }, 2);
    for (const m of out) {
      expect(m.locallyAdministered).toBe(true);
    }
  });
  it("multicast mode sets I/G bit", () => {
    const out = generateRandomMacs({ format: "bare", case: "upper", mode: "multicast", seed: "s5" }, 2);
    for (const m of out) {
      expect(m.multicast).toBe(true);
    }
  });
  it("deterministic with same seed", () => {
    const a = generateRandomMacs({ format: "bare", case: "upper", mode: "random", seed: "fixed" }, 3);
    const b = generateRandomMacs({ format: "bare", case: "upper", mode: "random", seed: "fixed" }, 3);
    expect(a.map((m) => m.raw)).toEqual(b.map((m) => m.raw));
  });
  it("throws on vendor mode without prefix", () => {
    expect(() => generateRandomMacs({ format: "bare", case: "upper", mode: "vendor" }, 1)).toThrow();
  });
  it("returns empty for count <= 0", () => {
    expect(generateRandomMacs({ format: "bare", case: "upper", mode: "random" }, 0)).toEqual([]);
  });
  it("caps count at 1000", () => {
    const out = generateRandomMacs({ format: "bare", case: "upper", mode: "random", seed: "big" }, 5000);
    expect(out.length).toBe(1000);
  });
});

describe("mac-oui batchLookup", () => {
  it("resolves valid and flags invalid in a batch", () => {
    const input = [
      "00:50:56:AB:CD:EF", // valid VMware
      "not-a-mac",
      "00-1A-2B-3C-4D-5E", // valid (not in DB)
    ].join("\n");
    const r = batchLookup(input);
    expect(r.total).toBe(3);
    expect(r.ok.length).toBe(2);
    expect(r.invalid.length).toBe(1);
    expect(r.invalid[0].input).toBe("not-a-mac");
  });
  it("handles comma-separated input", () => {
    const r = batchLookup("00:50:56:AB:CD:EF,02:1A:2B:3C:4D:5E");
    expect(r.ok.length).toBe(2);
  });
  it("returns empty for empty input", () => {
    const r = batchLookup("");
    expect(r.total).toBe(0);
    expect(r.ok).toEqual([]);
  });
});

describe("mac-oui renderCsv & renderJson", () => {
  it("renderCsv includes header", () => {
    const csv = renderCsv([]);
    expect(csv).toContain("mac,vendor,block");
  });
  it("renderCsv formats valid rows", () => {
    const info = resolveMac("00:50:56:AB:CD:EF")!;
    const csv = renderCsv([info]);
    expect(csv).toContain("00:50:56:AB:CD:EF");
    expect(csv).toContain("VMware");
    expect(csv).toContain("MA-L");
  });
  it("renderJson produces valid JSON", () => {
    const info = resolveMac("00:50:56:AB:CD:EF")!;
    const json = renderJson([info]);
    const parsed = JSON.parse(json) as Array<Record<string, unknown>>;
    expect(parsed).toHaveLength(1);
    expect(parsed[0].mac).toBe("00:50:56:AB:CD:EF");
    expect(parsed[0].vendor).toBe(info.vendor);
  });
});

describe("mac-oui history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, action: "lookup", count: 1 });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, action: "lookup", count: 1 });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, action: "lookup", count: 1 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("mac-oui shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({ mac: "00:50:56:AB:CD:EF", fmt: "colon" });
    expect(url).toContain("mac=00%3A50%3A56");
    expect(url).toContain("fmt=colon");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("mac=00%3A50%3A56%3AAB%3ACD%3AEF&fmt=colon");
    expect(p.mac).toBe("00:50:56:AB:CD:EF");
    expect(p.fmt).toBe("colon");
  });
  it("returns empty object for empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("handles leading # in hash", () => {
    const p = parseShareUrl("#mac=001A2B3C4D5E");
    expect(p.mac).toBe("001A2B3C4D5E");
  });
});

// Suppress unused-import lint for type-only imports used in casts.
export type _Unused =
  | MacFormat | MacCase | BlockType | RandomMacOptions | HistoryEntry;
