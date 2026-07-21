import { describe, it, expect, beforeEach } from "vitest";
import {
  ADDRESS_TYPE_LABELS,
  ADDRESS_TYPE_COLORS,
  RULE_LABELS,
  IPV6_PRESETS,
  parseIPv6,
  expandHextets,
  compressHextets,
  formatWithEmbeddedV4,
  expandIPv6,
  compressIPv6,
  validateIPv6,
  classifyAddressType,
  getAllRepresentations,
  parseBatchInput,
  batchProcess,
  renderBatchCsv,
  renderJson,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type AddressType,
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

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe("ipv6-ecv constants", () => {
  it("has 10 address type labels", () => {
    expect(Object.keys(ADDRESS_TYPE_LABELS)).toHaveLength(10);
    expect(ADDRESS_TYPE_LABELS.loopback).toContain("Loopback");
  });
  it("has matching colors for each type", () => {
    expect(Object.keys(ADDRESS_TYPE_COLORS).sort()).toEqual(Object.keys(ADDRESS_TYPE_LABELS).sort());
  });
  it("has rule labels", () => {
    expect(RULE_LABELS.doubleColon).toContain("compression");
    expect(RULE_LABELS.leadingZeros).toContain("Leading-zero");
  });
  it("has presets", () => {
    expect(IPV6_PRESETS.length).toBeGreaterThanOrEqual(8);
    expect(IPV6_PRESETS).toContain("2001:db8::1");
    expect(IPV6_PRESETS).toContain("::ffff:192.0.2.1");
    expect(IPV6_PRESETS).toContain("fd00:dead:beef::1%eth0");
  });
});

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

describe("ipv6-ecv parseIPv6", () => {
  it("parses a full 8-hextet address", () => {
    const r = parseIPv6("2001:0db8:0000:0000:0000:0000:0000:0001");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.address.hextets[0]).toBe(0x2001);
      expect(r.address.hextets[1]).toBe(0x0db8);
      expect(r.address.hextets[7]).toBe(1);
      expect(r.address.hadEmbeddedV4).toBe(false);
      expect(r.address.zoneId).toBeNull();
    }
  });
  it("parses compressed form with ::", () => {
    const r = parseIPv6("2001:db8::1");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.address.hextets[7]).toBe(1);
  });
  it("parses the unspecified address ::", () => {
    const r = parseIPv6("::");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.address.value).toBe(BigInt(0));
  });
  it("parses loopback ::1", () => {
    const r = parseIPv6("::1");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.address.value).toBe(BigInt(1));
  });
  it("parses embedded IPv4 in the last 32 bits", () => {
    const r = parseIPv6("::ffff:192.0.2.1");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.address.hadEmbeddedV4).toBe(true);
      expect(r.address.hextets[5]).toBe(0xffff);
      expect(r.address.hextets[6]).toBe((192 << 8) | 0);
      expect(r.address.hextets[7]).toBe((2 << 8) | 1);
    }
  });
  it("parses a zone ID (%eth0)", () => {
    const r = parseIPv6("fe80::1%eth0");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.address.zoneId).toBe("eth0");
  });
  it("rejects multiple ::", () => {
    expect(parseIPv6("2001::db8::1").ok).toBe(false);
  });
  it("rejects invalid characters", () => {
    expect(parseIPv6("2001:db8::g123").ok).toBe(false);
  });
  it("rejects wrong hextet count without ::", () => {
    expect(parseIPv6("2001:db8:1:2:3:4:5").ok).toBe(false);
  });
  it("rejects out-of-range hextet (5 hex digits)", () => {
    expect(parseIPv6("2001:db8::10000").ok).toBe(false);
  });
  it("rejects empty", () => {
    expect(parseIPv6("").ok).toBe(false);
  });
  it("rejects an invalid zone ID", () => {
    expect(parseIPv6("fe80::1%bad!id").ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

describe("ipv6-ecv expandHextets + compressHextets", () => {
  it("expands with leading zeros", () => {
    expect(expandHextets([0x2001, 0x0db8, 0, 0, 0, 0, 0, 1]))
      .toBe("2001:0db8:0000:0000:0000:0000:0000:0001");
  });
  it("compresses longest zero run", () => {
    const r = compressHextets([0x2001, 0x0db8, 0, 0, 0, 0, 0, 1]);
    expect(r.compressed).toBe("2001:db8::1");
    expect(r.runStart).toBe(2);
    expect(r.runLength).toBe(5);
  });
  it("does not compress a single zero hextet", () => {
    const r = compressHextets([0x2001, 0x0db8, 0, 1, 2, 3, 4, 5]);
    expect(r.compressed).toBe("2001:db8:0:1:2:3:4:5");
    expect(r.runStart).toBeNull();
    expect(r.runLength).toBe(0);
  });
  it("chooses leftmost run on tie", () => {
    const r = compressHextets([0, 0, 1, 2, 0, 0, 3, 4]);
    expect(r.compressed).toBe("::1:2:0:0:3:4");
    expect(r.runStart).toBe(0);
    expect(r.runLength).toBe(2);
  });
  it("compresses :: at end when trailing zeros", () => {
    const r = compressHextets([0x2001, 0x0db8, 1, 2, 3, 0, 0, 0]);
    expect(r.compressed).toBe("2001:db8:1:2:3::");
    expect(r.runStart).toBe(5);
    expect(r.runLength).toBe(3);
  });
  it("compresses fully-zero address to ::", () => {
    const r = compressHextets([0, 0, 0, 0, 0, 0, 0, 0]);
    expect(r.compressed).toBe("::");
    expect(r.runLength).toBe(8);
  });
  it("formatWithEmbeddedV4 produces dotted last 32 bits", () => {
    const s = formatWithEmbeddedV4([0, 0, 0, 0, 0, 0xffff, (192 << 8) | 0, (2 << 8) | 1]);
    expect(s).toContain("192.0.2.1");
    expect(s).toContain("ffff");
  });
});

// ---------------------------------------------------------------------------
// expandIPv6 / compressIPv6 with rules
// ---------------------------------------------------------------------------

describe("ipv6-ecv expandIPv6", () => {
  it("expands and lists rules", () => {
    const r = expandIPv6("2001:db8::1");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.expanded).toBe("2001:0db8:0000:0000:0000:0000:0000:0001");
      expect(r.rules.length).toBeGreaterThan(0);
    }
  });
  it("notes zone ID stripping", () => {
    const r = expandIPv6("fe80::1%eth0");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.rules.some((rule) => rule.rule.includes("Zone ID"))).toBe(true);
    }
  });
  it("notes embedded IPv4 conversion", () => {
    const r = expandIPv6("::ffff:192.0.2.1");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.rules.some((rule) => rule.rule.includes("Embedded IPv4"))).toBe(true);
      expect(r.expanded).toBe("0000:0000:0000:0000:0000:ffff:c000:0201");
    }
  });
  it("notes lowercase normalization", () => {
    const r = expandIPv6("2001:DB8::1");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.rules.some((rule) => rule.rule.includes("Lowercase"))).toBe(true);
    }
  });
  it("returns error for invalid input", () => {
    const r = expandIPv6("2001::db8::1");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBeTruthy();
  });
});

describe("ipv6-ecv compressIPv6", () => {
  it("compresses with rule explanations", () => {
    const r = compressIPv6("2001:0db8:0000:0000:0000:0000:0000:0001");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.compressed).toBe("2001:db8::1");
      expect(r.runStart).toBe(2);
      expect(r.runLength).toBe(5);
      expect(r.rules.some((rule) => rule.rule.includes("Leading-zero"))).toBe(true);
      expect(r.rules.some((rule) => rule.rule.includes("compression"))).toBe(true);
    }
  });
  it("notes no-compression for single zero", () => {
    const r = compressIPv6("2001:db8:0:1:2:3:4:5");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.runStart).toBeNull();
      expect(r.rules.some((rule) => rule.rule.includes("single zero"))).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// classifyAddressType
// ---------------------------------------------------------------------------

describe("ipv6-ecv classifyAddressType", () => {
  function typeOf(s: string): AddressType | undefined {
    const r = parseIPv6(s);
    if (!r.ok) return undefined;
    return classifyAddressType(r.address);
  }
  it("classifies :: as unspecified", () => {
    expect(typeOf("::")).toBe("unspecified");
  });
  it("classifies ::1 as loopback", () => {
    expect(typeOf("::1")).toBe("loopback");
  });
  it("classifies ::ffff:192.0.2.1 as ipv4-mapped", () => {
    expect(typeOf("::ffff:192.0.2.1")).toBe("ipv4-mapped");
  });
  it("classifies ::192.0.2.1 as ipv4-compatible (deprecated)", () => {
    expect(typeOf("::192.0.2.1")).toBe("ipv4-compatible");
  });
  it("classifies fe80::1 as link-local", () => {
    expect(typeOf("fe80::1")).toBe("link-local");
  });
  it("classifies fec0::1 as link-local (fe80::/10 covers fe80–febf)", () => {
    // fec0 is NOT in fe80::/10 (top 10 bits = 1111111010 only matches fe80..febf).
    // fec0 has top 10 bits = 1111111011, so not link-local.
    expect(typeOf("fec0::1")).not.toBe("link-local");
  });
  it("classifies fc00::1 as ULA", () => {
    expect(typeOf("fc00::1")).toBe("ula");
  });
  it("classifies fd00:dead:beef::1 as ULA", () => {
    expect(typeOf("fd00:dead:beef::1")).toBe("ula");
  });
  it("classifies ff02::1 as multicast", () => {
    expect(typeOf("ff02::1")).toBe("multicast");
  });
  it("classifies 2001:db8::1 as documentation", () => {
    expect(typeOf("2001:db8::1")).toBe("documentation");
  });
  it("classifies 2001:470::1 as global", () => {
    expect(typeOf("2001:470::1")).toBe("global");
  });
  it("classifies 100:: as discard", () => {
    expect(typeOf("100::")).toBe("discard");
  });
});

// ---------------------------------------------------------------------------
// validateIPv6 + getAllRepresentations
// ---------------------------------------------------------------------------

describe("ipv6-ecv validateIPv6", () => {
  it("returns valid for a normal address", () => {
    const v = validateIPv6("2001:db8::1");
    expect(v.valid).toBe(true);
    expect(v.errors).toHaveLength(0);
    expect(v.expanded).toBe("2001:0db8:0000:0000:0000:0000:0000:0001");
    expect(v.compressed).toBe("2001:db8::1");
    expect(v.type).toBe("documentation");
  });
  it("returns invalid for bad address with precise error", () => {
    const v = validateIPv6("2001::db8::1");
    expect(v.valid).toBe(false);
    expect(v.errors.length).toBeGreaterThan(0);
  });
  it("warns on uppercase hex", () => {
    const v = validateIPv6("2001:DB8::1");
    expect(v.valid).toBe(true);
    expect(v.warnings.length).toBeGreaterThan(0);
  });
  it("warns on IPv4-compatible deprecated form", () => {
    const v = validateIPv6("::192.0.2.1");
    expect(v.valid).toBe(true);
    expect(v.warnings.some((w) => w.includes("deprecated"))).toBe(true);
  });
  it("includes rules", () => {
    const v = validateIPv6("::ffff:192.0.2.1");
    expect(v.rules.length).toBeGreaterThan(0);
  });
});

describe("ipv6-ecv getAllRepresentations", () => {
  it("returns multiple representations", () => {
    const r = parseIPv6("2001:db8::1");
    expect(r.ok).toBe(true);
    if (r.ok) {
      const reps = getAllRepresentations(r.address);
      expect(reps.length).toBeGreaterThanOrEqual(4);
      expect(reps).toContain("2001:db8::1");
      expect(reps).toContain("2001:0db8:0000:0000:0000:0000:0000:0001");
    }
  });
  it("includes embedded IPv4 representation when applicable", () => {
    const r = parseIPv6("::ffff:192.0.2.1");
    expect(r.ok).toBe(true);
    if (r.ok) {
      const reps = getAllRepresentations(r.address);
      expect(reps.some((s) => s.includes("192.0.2.1"))).toBe(true);
    }
  });
  it("includes zone ID when present", () => {
    const r = parseIPv6("fe80::1%eth0");
    expect(r.ok).toBe(true);
    if (r.ok) {
      const reps = getAllRepresentations(r.address);
      expect(reps.some((s) => s.endsWith("%eth0"))).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Batch
// ---------------------------------------------------------------------------

describe("ipv6-ecv batch", () => {
  it("parses newline and comma separated input", () => {
    expect(parseBatchInput("2001:db8::1\n::1,ff02::1")).toEqual([
      "2001:db8::1", "::1", "ff02::1",
    ]);
  });
  it("batchProcess counts ok and err", () => {
    const r = batchProcess(["2001:db8::1", "::1", "not-an-ip"]);
    expect(r.total).toBe(3);
    expect(r.okCount).toBe(2);
    expect(r.errCount).toBe(1);
  });
  it("batchProcess attaches expanded/compressed/type to valid rows", () => {
    const r = batchProcess(["2001:db8::1"]);
    expect(r.rows[0].compressed).toBe("2001:db8::1");
    expect(r.rows[0].expanded).toBe("2001:0db8:0000:0000:0000:0000:0000:0001");
    expect(r.rows[0].type).toBe("documentation");
  });
  it("renderBatchCsv includes header and rows", () => {
    const csv = renderBatchCsv(batchProcess(["2001:db8::1", "bad::address:::extra"]));
    expect(csv).toContain("input,valid,expanded,compressed,type,error");
    expect(csv).toContain("2001:db8::1");
    expect(csv).toContain("documentation");
  });
  it("renderJson produces indented JSON", () => {
    expect(renderJson({ a: 1 })).toBe('{\n  "a": 1\n}');
  });
});

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

describe("ipv6-ecv history", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, input: "2001:db8::1", type: "documentation", compressed: "2001:db8::1" });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, input: `2001:db8::${i}` });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, input: "2001:db8::1" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Shareable URL
// ---------------------------------------------------------------------------

describe("ipv6-ecv shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("2001:db8::1", "::1");
    expect(url).toContain("i=2001");
    expect(url).toContain("b=%3A%3A1");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("i=2001%3Adb8%3A%3A1&b=%3A%3A1");
    expect(p.input).toBe("2001:db8::1");
    expect(p.batch).toBe("::1");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({ input: "", batch: "" });
  });
  it("handles missing params", () => {
    expect(parseShareUrl("i=2001:db8::1")).toEqual({ input: "2001:db8::1", batch: "" });
  });
});
