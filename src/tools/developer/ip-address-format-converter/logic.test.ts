import { describe, it, expect, beforeEach } from "vitest";
import {
  FORMAT_LABELS,
  FAMILY_LABELS,
  IP_PRESETS,
  MAX_UINT32,
  octetToHex,
  octetToBinary,
  octetToOctal,
  buildOctetBreakdown,
  formatIPv4All,
  integerToIPv4,
  hexToIPv4,
  octalToIPv4,
  binaryToIPv4,
  dottedDecimalToIPv4,
  dottedHexToIPv4,
  dottedOctalToIPv4,
  dottedBinaryToIPv4,
  parseIPv4Auto,
  convertIPv4,
  parseIPv6,
  valueToHextets,
  expandHextets,
  compressHextets,
  ipv6ToBinary,
  formatIPv6All,
  convertIPv6,
  convertAny,
  parseBatchInput,
  batchConvert,
  renderBatchCsv,
  renderJson,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type IPv4Format,
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

describe("ip-format-converter constants", () => {
  it("has 8 format labels", () => {
    expect(Object.keys(FORMAT_LABELS)).toHaveLength(8);
  });
  it("has 2 family labels", () => {
    expect(Object.keys(FAMILY_LABELS)).toHaveLength(2);
    expect(FAMILY_LABELS.ipv4).toBe("IPv4");
    expect(FAMILY_LABELS.ipv6).toBe("IPv6");
  });
  it("has presets including dotted-decimal and IPv6", () => {
    expect(IP_PRESETS.length).toBeGreaterThanOrEqual(8);
    expect(IP_PRESETS).toContain("192.168.0.1");
    expect(IP_PRESETS).toContain("2001:db8::1");
    expect(IP_PRESETS).toContain("0xC0A80001");
  });
  it("max uint32 is 4294967295", () => {
    expect(MAX_UINT32).toBe(4294967295);
  });
});

// ---------------------------------------------------------------------------
// Octet helpers
// ---------------------------------------------------------------------------

describe("ip-format-converter octet helpers", () => {
  it("formats hex/binary/octal for an octet", () => {
    expect(octetToHex(192)).toBe("c0");
    expect(octetToBinary(192)).toBe("11000000");
    expect(octetToOctal(192)).toBe("300");
  });
  it("pads to 2 hex / 8 binary / 3 octal digits", () => {
    expect(octetToHex(0)).toBe("00");
    expect(octetToBinary(0)).toBe("00000000");
    expect(octetToOctal(0)).toBe("000");
    expect(octetToHex(255)).toBe("ff");
    expect(octetToBinary(255)).toBe("11111111");
    expect(octetToOctal(255)).toBe("377");
  });
  it("throws on out-of-range octet", () => {
    expect(() => octetToHex(-1)).toThrow();
    expect(() => octetToHex(256)).toThrow();
  });
  it("builds a 4-row octet breakdown", () => {
    const bd = buildOctetBreakdown([192, 168, 0, 1]);
    expect(bd).toHaveLength(4);
    expect(bd[0]).toEqual({ index: 0, decimal: 192, hex: "c0", binary: "11000000", octal: "300" });
    expect(bd[3].decimal).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// IPv4 single-integer parsers
// ---------------------------------------------------------------------------

describe("ip-format-converter single-integer parsers", () => {
  it("integerToIPv4 splits 32-bit int into octets", () => {
    expect(integerToIPv4(3232235521)).toEqual([192, 168, 0, 1]);
    expect(integerToIPv4(0)).toEqual([0, 0, 0, 0]);
    expect(integerToIPv4(MAX_UINT32)).toEqual([255, 255, 255, 255]);
  });
  it("integerToIPv4 rejects out-of-range", () => {
    expect(() => integerToIPv4(-1)).toThrow();
    expect(() => integerToIPv4(MAX_UINT32 + 1)).toThrow();
  });
  it("hexToIPv4 accepts 0x and bare hex", () => {
    expect(hexToIPv4("0xC0A80001")).toEqual([192, 168, 0, 1]);
    expect(hexToIPv4("C0A80001")).toEqual([192, 168, 0, 1]);
    expect(hexToIPv4("0x00000000")).toEqual([0, 0, 0, 0]);
  });
  it("hexToIPv4 rejects bad hex", () => {
    expect(() => hexToIPv4("0xGHIJ")).toThrow();
    expect(() => hexToIPv4("0x100000000")).toThrow();
  });
  it("octalToIPv4 accepts leading-0 octal", () => {
    expect(octalToIPv4("030052000001")).toEqual([192, 168, 0, 1]);
    expect(octalToIPv4("037777777777")).toEqual([255, 255, 255, 255]);
  });
  it("octalToIPv4 rejects non-octal digits", () => {
    expect(() => octalToIPv4("088")).toThrow();
  });
  it("binaryToIPv4 accepts 0b and bare binary", () => {
    expect(binaryToIPv4("0b11000000101010000000000000000001")).toEqual([192, 168, 0, 1]);
    expect(binaryToIPv4("11000000101010000000000000000001")).toEqual([192, 168, 0, 1]);
  });
  it("binaryToIPv4 rejects too-long binary", () => {
    expect(() => binaryToIPv4("0b" + "1".repeat(33))).toThrow();
  });
});

// ---------------------------------------------------------------------------
// IPv4 dotted parsers
// ---------------------------------------------------------------------------

describe("ip-format-converter dotted parsers", () => {
  it("dottedDecimalToIPv4 parses standard form", () => {
    expect(dottedDecimalToIPv4("192.168.0.1")).toEqual([192, 168, 0, 1]);
  });
  it("dottedDecimalToIPv4 rejects out-of-range octet", () => {
    expect(() => dottedDecimalToIPv4("192.168.0.256")).toThrow();
  });
  it("dottedHexToIPv4 parses with 0x prefix", () => {
    expect(dottedHexToIPv4("0xC0.0xA8.0x00.0x01")).toEqual([192, 168, 0, 1]);
  });
  it("dottedHexToIPv4 parses mixed (some with 0x, some without)", () => {
    expect(dottedHexToIPv4("0xC0.0xA8.0.1")).toEqual([192, 168, 0, 1]);
  });
  it("dottedOctalToIPv4 parses leading-0 octal octets", () => {
    expect(dottedOctalToIPv4("0300.0250.0.01")).toEqual([192, 168, 0, 1]);
  });
  it("dottedBinaryToIPv4 parses 8-bit-per-octet", () => {
    expect(dottedBinaryToIPv4("11000000.10101000.00000000.00000001")).toEqual([192, 168, 0, 1]);
  });
});

// ---------------------------------------------------------------------------
// IPv4 auto-detect
// ---------------------------------------------------------------------------

describe("ip-format-converter parseIPv4Auto", () => {
  it("detects dotted-decimal", () => {
    const r = parseIPv4Auto("192.168.0.1");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.octets).toEqual([192, 168, 0, 1]);
      expect(r.format).toBe("dotted-decimal");
    }
  });
  it("detects single decimal integer", () => {
    const r = parseIPv4Auto("3232235521");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.format).toBe("decimal");
  });
  it("detects hex with 0x prefix", () => {
    const r = parseIPv4Auto("0xC0A80001");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.format).toBe("hex");
  });
  it("detects binary with 0b prefix", () => {
    const r = parseIPv4Auto("0b11000000101010000000000000000001");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.format).toBe("binary");
  });
  it("detects octal with leading 0", () => {
    const r = parseIPv4Auto("030052000001");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.format).toBe("octal");
  });
  it("detects dotted-hex with mixed prefix", () => {
    const r = parseIPv4Auto("0xC0.0xA8.0.1");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.format).toBe("dotted-hex");
  });
  it("detects dotted-octal", () => {
    const r = parseIPv4Auto("0300.0250.0.01");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.format).toBe("dotted-octal");
  });
  it("detects dotted-binary", () => {
    const r = parseIPv4Auto("11000000.10101000.00000000.00000001");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.format).toBe("dotted-binary");
  });
  it("rejects empty input", () => {
    expect(parseIPv4Auto("").ok).toBe(false);
  });
  it("rejects octet > 255", () => {
    const r = parseIPv4Auto("192.168.0.256");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/range/i);
  });
  it("rejects integer > 2^32−1", () => {
    const r = parseIPv4Auto(String(MAX_UINT32 + 1));
    expect(r.ok).toBe(false);
  });
  it("rejects wrong octet count", () => {
    const r = parseIPv4Auto("192.168.0");
    expect(r.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// IPv4 all-formats output
// ---------------------------------------------------------------------------

describe("ip-format-converter formatIPv4All + convertIPv4", () => {
  it("produces all 8 representations for 192.168.0.1", () => {
    const all = formatIPv4All([192, 168, 0, 1]);
    expect(all.dottedDecimal).toBe("192.168.0.1");
    expect(all.decimal).toBe("3232235521");
    expect(all.hex).toBe("0xC0A80001");
    expect(all.hexNoPrefix).toBe("C0A80001");
    expect(all.octal).toBe("030052000001");
    expect(all.binary.startsWith("0b")).toBe(true);
    expect(all.binary).toBe("0b11000000101010000000000000000001");
    expect(all.dottedHex).toBe("0xC0.0xA8.0x00.0x01");
    expect(all.dottedOctal).toBe("0300.0250.0000.0001");
    expect(all.dottedBinary).toBe("11000000.10101000.00000000.00000001");
    expect(all.octets).toHaveLength(4);
  });
  it("round-trips every format through convertIPv4", () => {
    const inputs = [
      "192.168.0.1",
      "3232235521",
      "0xC0A80001",
      "C0A80001",
      "030052000001",
      "0b11000000101010000000000000000001",
      "0xC0.0xA8.0x00.0x01",
      "0xC0.0xA8.0.1",
      "0300.0250.0.01",
      "11000000.10101000.00000000.00000001",
    ];
    for (const inp of inputs) {
      const r = convertIPv4(inp);
      expect(r.ok).toBe(true);
      if (r.ok && r.all) {
        expect(r.all.dottedDecimal).toBe("192.168.0.1");
        expect(r.all.decimal).toBe("3232235521");
      }
    }
  });
  it("handles 0.0.0.0 and 255.255.255.255", () => {
    expect(formatIPv4All([0, 0, 0, 0]).decimal).toBe("0");
    expect(formatIPv4All([255, 255, 255, 255]).decimal).toBe(String(MAX_UINT32));
    expect(formatIPv4All([255, 255, 255, 255]).hex).toBe("0xFFFFFFFF");
  });
});

// ---------------------------------------------------------------------------
// IPv6
// ---------------------------------------------------------------------------

describe("ip-format-converter parseIPv6", () => {
  it("parses a full 8-hextet address", () => {
    const r = parseIPv6("2001:0db8:0000:0000:0000:0000:0000:0001");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.hextets[0]).toBe(0x2001);
      expect(r.hextets[7]).toBe(1);
    }
  });
  it("parses compressed form with ::", () => {
    const r = parseIPv6("2001:db8::1");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.hextets[7]).toBe(1);
  });
  it("parses embedded IPv4", () => {
    const r = parseIPv6("::ffff:192.0.2.1");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.hextets[5]).toBe(0xffff);
      expect(r.hextets[6]).toBe((192 << 8) | 0);
      expect(r.hextets[7]).toBe((2 << 8) | 1);
    }
  });
  it("rejects multiple ::", () => {
    expect(parseIPv6("2001::db8::1").ok).toBe(false);
  });
  it("rejects empty hextet", () => {
    expect(parseIPv6("2001:db8:::1").ok).toBe(false);
  });
  it("rejects invalid characters", () => {
    expect(parseIPv6("2001:db8::g1").ok).toBe(false);
  });
});

describe("ip-format-converter IPv6 formatting", () => {
  it("expands hextets with leading zeros", () => {
    expect(expandHextets([0x2001, 0x0db8, 0, 0, 0, 0, 0, 1]))
      .toBe("2001:0db8:0000:0000:0000:0000:0000:0001");
  });
  it("compresses longest zero run with ::", () => {
    expect(compressHextets([0x2001, 0x0db8, 0, 0, 0, 0, 0, 1]))
      .toBe("2001:db8::1");
  });
  it("does not compress a single zero hextet", () => {
    expect(compressHextets([0x2001, 0x0db8, 0, 1, 2, 3, 4, 5]))
      .toBe("2001:db8:0:1:2:3:4:5");
  });
  it("chooses leftmost run on tie", () => {
    // Two runs of 2 zeros — leftmost wins.
    expect(compressHextets([0, 0, 1, 2, 0, 0, 3, 4])).toBe("::1:2:0:0:3:4");
  });
  it("valueToHextets round-trips a BigInt", () => {
    const v = (BigInt(0x2001) << BigInt(112)) | (BigInt(0x0db8) << BigInt(96)) | BigInt(1);
    const h = valueToHextets(v);
    expect(h[0]).toBe(0x2001);
    expect(h[1]).toBe(0x0db8);
    expect(h[7]).toBe(1);
  });
  it("ipv6ToBinary produces 128 chars", () => {
    expect(ipv6ToBinary(BigInt(0)).length).toBe(128);
    expect(ipv6ToBinary(BigInt(0))).toBe("0".repeat(128));
  });
});

describe("ip-format-converter formatIPv6All + convertIPv6", () => {
  it("produces all IPv6 representations", () => {
    const r = convertIPv6("2001:db8::1");
    expect(r.ok).toBe(true);
    if (r.ok && r.all) {
      expect(r.all.compressed).toBe("2001:db8::1");
      expect(r.all.expanded).toBe("2001:0db8:0000:0000:0000:0000:0000:0001");
      expect(r.all.hex).toHaveLength(32);
      expect(r.all.hex).toBe("20010db8000000000000000000000001");
      expect(r.all.decimal).toBe(((BigInt(0x2001) << BigInt(112)) | (BigInt(0x0db8) << BigInt(96)) | BigInt(1)).toString(10));
    }
  });
  it("BigInt is exact for ::ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff", () => {
    const r = convertIPv6("ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff");
    expect(r.ok).toBe(true);
    if (r.ok && r.all) {
      expect(r.all.decimal).toBe("340282366920938463463374607431768211455");
    }
  });
});

// ---------------------------------------------------------------------------
// Dispatch + batch
// ---------------------------------------------------------------------------

describe("ip-format-converter convertAny dispatch", () => {
  it("dispatches IPv4 (no colon)", () => {
    const r = convertAny("192.168.0.1");
    expect(r.ok).toBe(true);
    expect(r.family).toBe("ipv4");
    expect(r.ipv4?.dottedDecimal).toBe("192.168.0.1");
  });
  it("dispatches IPv6 (colon)", () => {
    const r = convertAny("2001:db8::1");
    expect(r.ok).toBe(true);
    expect(r.family).toBe("ipv6");
    expect(r.ipv6?.compressed).toBe("2001:db8::1");
  });
  it("returns error for empty", () => {
    expect(convertAny("").ok).toBe(false);
  });
});

describe("ip-format-converter batch", () => {
  it("parses newline and comma separated input", () => {
    expect(parseBatchInput("192.168.0.1\n10.0.0.1,8.8.8.8")).toEqual([
      "192.168.0.1", "10.0.0.1", "8.8.8.8",
    ]);
  });
  it("batchConvert counts ok and err", () => {
    const r = batchConvert(["192.168.0.1", "2001:db8::1", "not-an-ip"]);
    expect(r.total).toBe(3);
    expect(r.okCount).toBe(2);
    expect(r.errCount).toBe(1);
  });
  it("renderBatchCsv includes header", () => {
    const csv = renderBatchCsv(batchConvert([]));
    expect(csv).toContain("input,family,format");
  });
  it("renderBatchCsv contains row data", () => {
    const csv = renderBatchCsv(batchConvert(["192.168.0.1"]));
    expect(csv).toContain("192.168.0.1");
    expect(csv).toContain("ipv4");
    expect(csv).toContain("3232235521");
  });
  it("renderJson produces indented JSON", () => {
    expect(renderJson({ a: 1 })).toBe('{\n  "a": 1\n}');
  });
});

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

describe("ip-format-converter history", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, input: "192.168.0.1", family: "ipv4", summary: "dotted-decimal" });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, input: `${i}.0.0.0`, family: "ipv4", summary: "" });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, input: "192.168.0.1", family: "ipv4", summary: "" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Shareable URL
// ---------------------------------------------------------------------------

describe("ip-format-converter shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("192.168.0.1", "10.0.0.1");
    expect(url).toContain("i=192.168.0.1");
    expect(url).toContain("b=10.0.0.1");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("i=192.168.0.1&b=10.0.0.1");
    expect(p.input).toBe("192.168.0.1");
    expect(p.batch).toBe("10.0.0.1");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({ input: "", batch: "" });
  });
  it("handles missing params", () => {
    expect(parseShareUrl("i=192.168.0.1")).toEqual({ input: "192.168.0.1", batch: "" });
  });
});

// Suppress unused-import lint
export type _Unused = IPv4Format;
