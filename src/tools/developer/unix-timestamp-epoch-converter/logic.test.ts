import { describe, it, expect, beforeEach } from "vitest";
import {
  UNITS,
  EPOCH_KINDS,
  UNIT_LABELS,
  CODE_SNIPPETS,
  detectUnit,
  parseBigInt,
  toUnixNs,
  fromUnixNs,
  fileTimeToUnixNs,
  unixNsToFileTime,
  ldapToUnixNs,
  unixNsToLdap,
  ntpToUnixNs,
  unixNsToNtp,
  cocoaToUnixNs,
  unixNsToCocoa,
  excelSerialToUnixNs,
  unixMsToExcelSerial,
  mongoObjectIdToUnixSeconds,
  formatRfc2822,
  formatIso,
  formatRelative,
  check2038Overflow,
  convert,
  dateToUnixNs,
  startOfDayMs,
  endOfDayMs,
  startOfMonthMs,
  endOfMonthMs,
  startOfYearMs,
  endOfYearMs,
  parseBatchInput,
  batchConvert,
  renderBatchCsv,
  renderBatchJson,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
} from "./logic";

// Helpers — avoid BigInt literals which TS rejects under ES2017 target.
const B = (v: string | number): bigint => BigInt(v);
const NS_PER_S = B(1_000_000_000);
const NS_PER_MS = B(1_000_000);

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

describe("unix-timestamp-epoch-converter constants", () => {
  it("exposes 4 units (s/ms/us/ns)", () => {
    expect(UNITS).toHaveLength(4);
    expect(UNITS.map((u) => u.unit)).toEqual(["s", "ms", "us", "ns"]);
  });
  it("exposes 7 epoch kinds", () => {
    expect(EPOCH_KINDS.length).toBe(7);
    expect(EPOCH_KINDS.map((e) => e.value)).toContain("filetime");
    expect(EPOCH_KINDS.map((e) => e.value)).toContain("mongo");
  });
  it("has unit labels for every unit", () => {
    expect(UNIT_LABELS.s).toBe("Seconds");
    expect(UNIT_LABELS.ms).toBe("Milliseconds");
    expect(UNIT_LABELS.us).toBe("Microseconds");
    expect(UNIT_LABELS.ns).toBe("Nanoseconds");
  });
  it("exposes 15+ code snippets", () => {
    expect(CODE_SNIPPETS.length).toBeGreaterThanOrEqual(15);
    const langs = CODE_SNIPPETS.map((s) => s.language);
    expect(langs).toContain("JavaScript");
    expect(langs).toContain("Python");
    expect(langs).toContain("Go");
    expect(langs).toContain("Rust");
  });
});

describe("unix-timestamp-epoch-converter detectUnit", () => {
  it("detects 10-digit input as seconds", () => {
    expect(detectUnit("1736943900")).toBe("s");
  });
  it("detects 13-digit input as milliseconds", () => {
    expect(detectUnit("1736943900000")).toBe("ms");
  });
  it("detects 16-digit input as microseconds", () => {
    expect(detectUnit("1736943900000000")).toBe("us");
  });
  it("detects 19-digit input as nanoseconds", () => {
    expect(detectUnit("1736943900000000000")).toBe("ns");
  });
  it("handles negative (pre-1970) input", () => {
    expect(detectUnit("-1000000000")).toBe("s");
  });
  it("handles decimal input", () => {
    expect(detectUnit("1736943900.5")).toBe("s");
  });
});

describe("unix-timestamp-epoch-converter parseBigInt", () => {
  it("parses plain integer", () => {
    expect(parseBigInt("12345")).toBe(B(12345));
  });
  it("parses negative integer", () => {
    expect(parseBigInt("-100")).toBe(B(-100));
  });
  it("truncates decimal to integer part", () => {
    expect(parseBigInt("1736943900.5")).toBe(B(1736943900));
  });
  it("returns null for empty", () => {
    expect(parseBigInt("")).toBeNull();
  });
  it("returns null for non-numeric", () => {
    expect(parseBigInt("abc")).toBeNull();
  });
});

describe("unix-timestamp-epoch-converter unit conversion", () => {
  it("converts seconds → ns", () => {
    expect(toUnixNs(B(1), "s")).toBe(B(1_000_000_000));
  });
  it("converts ms → ns", () => {
    expect(toUnixNs(B(1), "ms")).toBe(B(1_000_000));
  });
  it("converts us → ns", () => {
    expect(toUnixNs(B(1), "us")).toBe(B(1_000));
  });
  it("converts ns → ns (identity)", () => {
    expect(toUnixNs(B(1), "ns")).toBe(B(1));
  });
  it("fromUnixNs round-trips seconds", () => {
    expect(fromUnixNs(B(1_000_000_000), "s")).toBe(B(1));
  });
  it("fromUnixNs round-trips ms", () => {
    expect(fromUnixNs(B(1_000_000), "ms")).toBe(B(1));
  });
  it("fromUnixNs round-trips us", () => {
    expect(fromUnixNs(B(1_000), "us")).toBe(B(1));
  });
});

describe("unix-timestamp-epoch-converter multi-epoch", () => {
  it("FILETIME 0 → 1601-01-01 (Unix ns negative)", () => {
    expect(fileTimeToUnixNs(B(0))).toBe(B("-11644473600000000000"));
  });
  it("FILETIME round-trips", () => {
    const ns = B("1700000000000000000");
    expect(unixNsToFileTime(fileTimeToUnixNs(ns))).toBe(ns);
  });
  it("LDAP behaves same as FILETIME", () => {
    expect(ldapToUnixNs(B(0))).toBe(fileTimeToUnixNs(B(0)));
    expect(unixNsToLdap(B(123))).toBe(unixNsToFileTime(B(123)));
  });
  it("NTP 0 → 1900-01-01 (Unix ns negative)", () => {
    expect(ntpToUnixNs(B(0))).toBe(B("-2208988800000000000"));
  });
  it("NTP round-trips", () => {
    const ntp = B(3_908_988_800);
    expect(unixNsToNtp(ntpToUnixNs(ntp))).toBe(ntp);
  });
  it("Cocoa 0 → 2001-01-01 (Unix ns positive)", () => {
    expect(cocoaToUnixNs(B(0))).toBe(B(978_307_200) * NS_PER_S);
  });
  it("Cocoa round-trips", () => {
    const cocoa = B(721_692_800);
    expect(unixNsToCocoa(cocoaToUnixNs(cocoa))).toBe(cocoa);
  });
  it("Excel serial 25569 → Unix 0 (epoch)", () => {
    expect(excelSerialToUnixNs(25569)).toBe(B(0));
  });
  it("Excel serial 25569.5 → Unix noon 1970-01-01", () => {
    // 0.5 day * 86400000 ms/day = 43200000 ms → × 1e6 = 43200000000000 ns
    expect(excelSerialToUnixNs(25569.5)).toBe(B(43_200_000) * NS_PER_MS);
  });
  it("Excel serial round-trips via ms", () => {
    const ms = 1_700_000_000_000;
    const serial = unixMsToExcelSerial(ms);
    expect(Math.round(serial * 86_400_000 - 25569 * 86_400_000)).toBe(ms);
  });
  it("Mongo ObjectId parses first 4 bytes as Unix seconds", () => {
    // 5f5e8c2a → 1600031786 seconds = ~Sep 2020
    expect(mongoObjectIdToUnixSeconds("5f5e8c2a0000000000000000")).toBe(B("0x5f5e8c2a"));
  });
  it("Mongo ObjectId rejects non-hex / wrong length", () => {
    expect(mongoObjectIdToUnixSeconds("not-a-valid-objectid")).toBeNull();
    expect(mongoObjectIdToUnixSeconds("5f5e8c2a")).toBeNull();
    expect(mongoObjectIdToUnixSeconds("5f5e8c2a00000000000000")).toBeNull(); // 23 chars
  });
});

describe("unix-timestamp-epoch-converter formatting", () => {
  it("formatIso for Unix 0 → 1970-01-01T00:00:00.000Z", () => {
    expect(formatIso(new Date(0))).toBe("1970-01-01T00:00:00.000Z");
  });
  it("formatRfc2822 for Unix 0", () => {
    expect(formatRfc2822(new Date(0))).toBe("Thu, 01 Jan 1970 00:00:00 +0000");
  });
  it("formatRfc2822 for Jan 15 2025 13:45 UTC", () => {
    const d = new Date(Date.UTC(2025, 0, 15, 13, 45, 0));
    expect(formatRfc2822(d)).toBe("Wed, 15 Jan 2025 13:45:00 +0000");
  });
  it("formatRelative: 0 ns vs now shows past (ago)", () => {
    const out = formatRelative(B(0), B(Date.now()) * NS_PER_MS);
    expect(out).toMatch(/ago$/);
  });
  it("formatRelative: future 1 hour", () => {
    const nowNs = B("1700000000000000000");
    const futureNs = nowNs + B(3_600) * NS_PER_S;
    expect(formatRelative(futureNs, nowNs)).toBe("in 1 hour");
  });
  it("formatRelative: past 1 day", () => {
    const nowNs = B("1700000000000000000");
    const pastNs = nowNs - B(86_400) * NS_PER_S;
    expect(formatRelative(pastNs, nowNs)).toBe("1 day ago");
  });
});

describe("unix-timestamp-epoch-converter 2038 overflow", () => {
  it("flags overflow above 2147483647 seconds", () => {
    expect(check2038Overflow(B(2_147_483_648)).overflow).toBe(true);
  });
  it("does not flag at the exact boundary", () => {
    expect(check2038Overflow(B(2_147_483_647)).overflow).toBe(false);
  });
  it("provides a message only when overflow", () => {
    expect(check2038Overflow(B(2_000_000_000)).message).toBeNull();
    expect(check2038Overflow(B(3_000_000_000)).message).toMatch(/overflow/i);
  });
});

describe("unix-timestamp-epoch-converter convert", () => {
  it("converts Unix seconds 0 → 1970-01-01 ISO", () => {
    const r = convert("0", "auto", "unix");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.iso).toBe("1970-01-01T00:00:00.000Z");
      expect(r.seconds).toBe(B(0));
      expect(r.unit).toBe("s");
    }
  });
  it("converts Unix milliseconds 0 → 1970-01-01", () => {
    const r = convert("0", "ms", "unix");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.unit).toBe("ms");
  });
  it("auto-detects 13-digit as ms", () => {
    const r = convert("1609459200000", "auto", "unix"); // 2021-01-01 UTC
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.unit).toBe("ms");
      expect(r.iso).toContain("2021-01-01");
    }
  });
  it("auto-detects 19-digit as ns and preserves precision", () => {
    const r = convert("1609459200000000000", "auto", "unix"); // 2021-01-01 UTC ns
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.unit).toBe("ns");
      expect(r.nanos).toBe(B("1609459200000000000"));
      expect(r.iso).toContain("2021-01-01");
    }
  });
  it("handles pre-1970 negative seconds", () => {
    const r = convert("-1", "auto", "unix");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.seconds).toBe(B(-1));
      expect(r.iso).toContain("1969-12-31");
    }
  });
  it("converts FILETIME 0 → 1601-01-01", () => {
    const r = convert("0", "auto", "filetime");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.iso).toContain("1601-01-01");
  });
  it("converts Cocoa 0 → 2001-01-01", () => {
    const r = convert("0", "auto", "cocoa");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.iso).toContain("2001-01-01");
  });
  it("converts NTP 0 → 1900-01-01", () => {
    const r = convert("0", "auto", "ntp");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.iso).toContain("1900-01-01");
  });
  it("converts Excel 25569 → 1970-01-01", () => {
    const r = convert("25569", "auto", "excel");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.iso).toBe("1970-01-01T00:00:00.000Z");
  });
  it("converts Mongo ObjectId → ISO date", () => {
    const r = convert("5f5e8c2a0000000000000000", "auto", "mongo");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.iso).toContain("2020-09"); // 0x5f5e8c2a ~ Sep 2020
  });
  it("flags 2038 overflow for far-future input", () => {
    const r = convert("3000000000", "auto", "unix"); // ~2065
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.overflow2038).toBe(true);
  });
  it("returns error for empty input", () => {
    const r = convert("", "auto", "unix");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/empty/i);
  });
  it("returns error for non-numeric", () => {
    const r = convert("not-a-number", "auto", "unix");
    expect(r.ok).toBe(false);
  });
});

describe("unix-timestamp-epoch-converter dateToUnixNs", () => {
  it("converts 1970-01-01 UTC → 0 ns", () => {
    expect(dateToUnixNs({ year: 1970, month: 1, day: 1 })).toBe(B(0));
  });
  it("converts 2021-01-01 00:00 UTC → 1609459200 s", () => {
    expect(dateToUnixNs({ year: 2021, month: 1, day: 1 }) / NS_PER_S).toBe(B(1_609_459_200));
  });
});

describe("unix-timestamp-epoch-converter start/end helpers", () => {
  it("startOfDayMs floors to UTC midnight", () => {
    const midday = Date.UTC(2025, 0, 15, 12, 30, 45);
    expect(startOfDayMs(midday)).toBe(Date.UTC(2025, 0, 15));
  });
  it("endOfDayMs is one ms before next midnight", () => {
    const midday = Date.UTC(2025, 0, 15, 12, 30, 45);
    expect(endOfDayMs(midday)).toBe(Date.UTC(2025, 0, 16) - 1);
  });
  it("startOfMonthMs is first day at midnight", () => {
    const midMonth = Date.UTC(2025, 5, 15, 12);
    expect(startOfMonthMs(midMonth)).toBe(Date.UTC(2025, 5, 1));
  });
  it("endOfMonthMs is last ms of month (Feb in leap year)", () => {
    const midFeb = Date.UTC(2024, 1, 15);
    expect(endOfMonthMs(midFeb)).toBe(Date.UTC(2024, 2, 1) - 1);
  });
  it("startOfYearMs is Jan 1 midnight", () => {
    const midYear = Date.UTC(2025, 5, 15);
    expect(startOfYearMs(midYear)).toBe(Date.UTC(2025, 0, 1));
  });
  it("endOfYearMs is last ms of Dec 31", () => {
    const midYear = Date.UTC(2025, 5, 15);
    expect(endOfYearMs(midYear)).toBe(Date.UTC(2026, 0, 1) - 1);
  });
});

describe("unix-timestamp-epoch-converter batch", () => {
  it("parseBatchInput splits on newlines, commas, tabs, semicolons", () => {
    expect(parseBatchInput("0\n1,2\t3;4")).toEqual(["0", "1", "2", "3", "4"]);
  });
  it("parseBatchInput dedupes", () => {
    expect(parseBatchInput("0\n0\n1")).toEqual(["0", "1"]);
  });
  it("parseBatchInput skips empty lines", () => {
    expect(parseBatchInput("\n0\n\n1\n")).toEqual(["0", "1"]);
  });
  it("batchConvert returns ok/error per row", () => {
    const r = batchConvert(["0", "1", "abc"], "auto", "unix");
    expect(r.total).toBe(3);
    expect(r.valid).toBe(2);
    expect(r.invalid).toBe(1);
    expect(r.rows[2].ok).toBe(false);
  });
  it("renderBatchCsv has header row", () => {
    const r = batchConvert(["0"], "auto", "unix");
    const csv = renderBatchCsv(r);
    expect(csv.split("\n")[0]).toBe("input,unit,iso,utc,weekday,relative");
  });
  it("renderBatchCsv escapes commas in ISO", () => {
    const r = batchConvert(["0"], "auto", "unix");
    const csv = renderBatchCsv(r);
    expect(csv).toContain("1970-01-01T00:00:00.000Z");
  });
  it("renderBatchJson is valid JSON", () => {
    const r = batchConvert(["0"], "auto", "unix");
    const json = renderBatchJson(r);
    const parsed = JSON.parse(json);
    expect(parsed.total).toBe(1);
    expect(parsed.valid).toBe(1);
  });
});

describe("unix-timestamp-epoch-converter history", () => {
  it("loadHistory returns empty by default", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saveHistory appends and caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: Date.now(),
        unit: "s",
        epoch: "unix",
        inputPreview: String(i),
        iso: "1970-01-01T00:00:00.000Z",
      });
    }
    const list = loadHistory();
    expect(list).toHaveLength(20);
    // newest first
    expect(list[0].inputPreview).toBe("24");
  });
  it("clearHistory empties the store", () => {
    saveHistory({ ts: 1, unit: "s", epoch: "unix", inputPreview: "x", iso: "x" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("unix-timestamp-epoch-converter share URL", () => {
  it("buildShareUrl encodes input + unit + epoch", () => {
    const url = buildShareUrl("1609459200", "s", "unix");
    expect(url).toContain("ts=1609459200");
    expect(url).toContain("unit=s");
  });
  it("buildShareUrl omits auto unit", () => {
    const url = buildShareUrl("0", "auto", "unix");
    expect(url).not.toContain("unit=");
  });
  it("buildShareUrl omits unix epoch", () => {
    const url = buildShareUrl("0", "auto", "unix");
    expect(url).not.toContain("epoch=");
  });
  it("parseShareUrl round-trips", () => {
    const url = buildShareUrl("1609459200", "ms", "cocoa");
    const parsed = parseShareUrl(url);
    expect(parsed.input).toBe("1609459200");
    expect(parsed.unit).toBe("ms");
    expect(parsed.epoch).toBe("cocoa");
  });
  it("parseShareUrl rejects invalid unit", () => {
    const parsed = parseShareUrl("ts=0&unit=foo");
    expect(parsed.unit).toBe("auto");
  });
  it("parseShareUrl rejects invalid epoch", () => {
    const parsed = parseShareUrl("ts=0&epoch=foo");
    expect(parsed.epoch).toBe("unix");
  });
  it("parseShareUrl empty hash returns defaults", () => {
    const parsed = parseShareUrl("");
    expect(parsed.input).toBe("");
    expect(parsed.unit).toBe("auto");
    expect(parsed.epoch).toBe("unix");
  });
});
