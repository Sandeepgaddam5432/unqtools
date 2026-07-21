import { describe, it, expect, beforeEach } from "vitest";
import {
  UNIT_INFO,
  DEV_UNIT_INFO,
  MONTH_DEFINITIONS,
  YEAR_DEFINITIONS,
  DEFAULT_CONFIG,
  monthToNs,
  yearToNs,
  unitToNsFactor,
  convertBigInt,
  toNsBigInt,
  unitToNsNumber,
  convertNumber,
  convertAll,
  findRow,
  formatValueForDisplay,
  formatScientific,
  humanizeDuration,
  parseHumanDuration,
  generateCodeSnippet,
  validateValue,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type Config,
  type AnyUnit,
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

const cfg: Config = { ...DEFAULT_CONFIG };

describe("time-unit-converter constants", () => {
  it("has 12 base units", () => {
    expect(UNIT_INFO).toHaveLength(12);
    const ids = UNIT_INFO.map((u) => u.id);
    expect(ids).toContain("ns");
    expect(ids).toContain("century");
  });

  it("has 3 dev units", () => {
    expect(DEV_UNIT_INFO).toHaveLength(3);
    const ids = DEV_UNIT_INFO.map((u) => u.id);
    expect(ids).toEqual(expect.arrayContaining(["ticks", "jiffies", "frames"]));
  });

  it("has 4 month definitions", () => {
    expect(MONTH_DEFINITIONS).toHaveLength(4);
    expect(MONTH_DEFINITIONS.map((m) => m.id)).toEqual(
      expect.arrayContaining(["28", "30", "30.44", "31"]),
    );
  });

  it("has 3 year definitions", () => {
    expect(YEAR_DEFINITIONS).toHaveLength(3);
    expect(YEAR_DEFINITIONS.map((y) => y.id)).toEqual(
      expect.arrayContaining(["365", "365.25", "366"]),
    );
  });

  it("default config uses averaged month & year", () => {
    expect(DEFAULT_CONFIG.month).toBe("30.44");
    expect(DEFAULT_CONFIG.year).toBe("365.25");
    expect(DEFAULT_CONFIG.fps).toBe(60);
    expect(DEFAULT_CONFIG.hz).toBe(100);
  });
});

describe("time-unit-converter monthToNs / yearToNs (BigInt)", () => {
  it("28-day month = 28 days in ns", () => {
    expect(monthToNs("28")).toBe(BigInt(28) * BigInt(86_400) * BigInt(1_000_000_000));
  });

  it("30-day month = 30 days in ns", () => {
    expect(monthToNs("30")).toBe(BigInt(30) * BigInt(86_400) * BigInt(1_000_000_000));
  });

  it("30.44-day month = 365.25/12 days in ns", () => {
    // 365.25 * 86400 / 12 = 2_629_800 seconds = 2_629_800_000_000_000 ns
    expect(monthToNs("30.44")).toBe(BigInt("2629800000000000"));
  });

  it("31-day month = 31 days in ns", () => {
    expect(monthToNs("31")).toBe(BigInt(31) * BigInt(86_400) * BigInt(1_000_000_000));
  });

  it("365-day year = 365 days in ns", () => {
    expect(yearToNs("365")).toBe(BigInt(365) * BigInt(86_400) * BigInt(1_000_000_000));
  });

  it("365.25-day year = 31_557_600 seconds in ns", () => {
    expect(yearToNs("365.25")).toBe(BigInt("31557600000000000"));
  });

  it("366-day year = 366 days in ns", () => {
    expect(yearToNs("366")).toBe(BigInt(366) * BigInt(86_400) * BigInt(1_000_000_000));
  });
});

describe("time-unit-converter unitToNsFactor", () => {
  it("1 second = 1e9 ns", () => {
    expect(unitToNsFactor("s", cfg)).toBe(BigInt(1_000_000_000));
  });

  it("1 hour = 3.6e12 ns", () => {
    expect(unitToNsFactor("h", cfg)).toBe(BigInt(3_600_000_000_000));
  });

  it("1 day = 8.64e13 ns", () => {
    expect(unitToNsFactor("d", cfg)).toBe(BigInt(86_400_000_000_000));
  });

  it("1 week = 7 days in ns", () => {
    expect(unitToNsFactor("w", cfg)).toBe(BigInt(7) * unitToNsFactor("d", cfg));
  });

  it("1 month respects config (30.44)", () => {
    expect(unitToNsFactor("mo", cfg)).toBe(monthToNs("30.44"));
    const cfg2: Config = { ...cfg, month: "28" };
    expect(unitToNsFactor("mo", cfg2)).toBe(monthToNs("28"));
  });

  it("1 year respects config (365.25)", () => {
    expect(unitToNsFactor("y", cfg)).toBe(yearToNs("365.25"));
  });

  it("1 decade = 10 years in ns", () => {
    expect(unitToNsFactor("decade", cfg)).toBe(BigInt(10) * yearToNs("365.25"));
  });

  it("1 century = 100 years in ns", () => {
    expect(unitToNsFactor("century", cfg)).toBe(BigInt(100) * yearToNs("365.25"));
  });
});

describe("time-unit-converter convertBigInt (exact integer math)", () => {
  it("1 hour = 3600 seconds", () => {
    expect(convertBigInt(BigInt(1), "h", "s", cfg)).toBe(BigInt(3600));
  });

  it("1 day = 24 hours", () => {
    expect(convertBigInt(BigInt(1), "d", "h", cfg)).toBe(BigInt(24));
  });

  it("1 week = 7 days", () => {
    expect(convertBigInt(BigInt(1), "w", "d", cfg)).toBe(BigInt(7));
  });

  it("1 minute = 60 seconds", () => {
    expect(convertBigInt(BigInt(1), "m", "s", cfg)).toBe(BigInt(60));
  });

  it("1 second = 1_000_000_000 ns", () => {
    expect(convertBigInt(BigInt(1), "s", "ns", cfg)).toBe(BigInt(1_000_000_000));
  });

  it("1 year (365.25) = 31_557_600 seconds", () => {
    expect(convertBigInt(BigInt(1), "y", "s", cfg)).toBe(BigInt(31_557_600));
  });

  it("1 century (365.25) = 100 years", () => {
    expect(convertBigInt(BigInt(1), "century", "y", cfg)).toBe(BigInt(100));
  });

  it("1 century = 3_155_760_000 seconds (exact, beyond MAX_SAFE_INTEGER)", () => {
    expect(convertBigInt(BigInt(1), "century", "s", cfg)).toBe(BigInt(3_155_760_000));
  });

  it("toNsBigInt: 2 hours = 7.2e15 ns (exact)", () => {
    expect(toNsBigInt(BigInt(2), "h", cfg)).toBe(BigInt(7_200_000_000_000));
  });

  it("floors fractional results: 1 second = 0 minutes (BigInt floor)", () => {
    expect(convertBigInt(BigInt(1), "s", "m", cfg)).toBe(BigInt(0));
  });

  it("90 seconds = 1 minute (floor)", () => {
    expect(convertBigInt(BigInt(90), "s", "m", cfg)).toBe(BigInt(1));
  });
});

describe("time-unit-converter unitToNsNumber / convertNumber", () => {
  it("1 second = 1e9 ns (Number)", () => {
    expect(unitToNsNumber("s", cfg)).toBe(1_000_000_000);
  });

  it("1 tick = 100 ns", () => {
    expect(unitToNsNumber("ticks", cfg)).toBe(100);
  });

  it("1 jiffy (HZ=100) = 10 ms = 10_000_000 ns", () => {
    expect(unitToNsNumber("jiffies", cfg)).toBe(10_000_000);
  });

  it("1 frame (fps=60) ≈ 16_666_666.67 ns", () => {
    expect(unitToNsNumber("frames", cfg)).toBeCloseTo(16_666_666.667, -1);
  });

  it("convertNumber: 1 hour = 3600 seconds", () => {
    expect(convertNumber(1, "h", "s", cfg)).toBe(3600);
  });

  it("convertNumber: 1 hour = 3_600_000 ms", () => {
    expect(convertNumber(1, "h", "ms", cfg)).toBe(3_600_000);
  });

  it("convertNumber: 60 frames = 1 second (at 60fps)", () => {
    expect(convertNumber(60, "frames", "s", cfg)).toBeCloseTo(1, 6);
  });

  it("convertNumber: 100 jiffies = 1 second (at HZ=100)", () => {
    expect(convertNumber(100, "jiffies", "s", cfg)).toBeCloseTo(1, 6);
  });

  it("convertNumber: 1 tick = 100 ns", () => {
    expect(convertNumber(1, "ticks", "ns", cfg)).toBe(100);
  });

  it("convertNumber: 1 second = 10_000_000 ns (via ticks)", () => {
    expect(convertNumber(1, "s", "ticks", cfg)).toBe(10_000_000);
  });

  it("convertNumber: fractional 1.5 hours = 5400 seconds", () => {
    expect(convertNumber(1.5, "h", "s", cfg)).toBe(5400);
  });

  it("convertNumber: respects fps config", () => {
    const cfg30: Config = { ...cfg, fps: 30 };
    expect(convertNumber(30, "frames", "s", cfg30)).toBeCloseTo(1, 6);
  });

  it("convertNumber: respects hz config", () => {
    const cfg250: Config = { ...cfg, hz: 250 };
    expect(convertNumber(250, "jiffies", "s", cfg250)).toBeCloseTo(1, 6);
  });
});

describe("time-unit-converter convertAll (batch table)", () => {
  it("produces 15 rows (12 base + 3 dev)", () => {
    const rows = convertAll(1, "s", cfg);
    expect(rows).toHaveLength(15);
    expect(rows.filter((r) => r.kind === "base")).toHaveLength(12);
    expect(rows.filter((r) => r.kind === "dev")).toHaveLength(3);
  });

  it("1 second -> 1_000_000_000 ns in batch", () => {
    const rows = convertAll(1, "s", cfg);
    const nsRow = findRow(rows, "ns");
    expect(nsRow).toBeDefined();
    expect(nsRow!.value).toBe(1_000_000_000);
  });

  it("1 second -> 1000 ms in batch", () => {
    const rows = convertAll(1, "s", cfg);
    const msRow = findRow(rows, "ms");
    expect(msRow!.value).toBe(1000);
  });

  it("1 second -> 60 frames (at 60fps) in batch", () => {
    const rows = convertAll(1, "s", cfg);
    const fRow = findRow(rows, "frames");
    expect(fRow!.value).toBeCloseTo(60, 6);
  });

  it("displays non-empty string for each row", () => {
    const rows = convertAll(60, "s", cfg);
    expect(rows.every((r) => r.display.length > 0)).toBe(true);
  });

  it("handles 0 input cleanly", () => {
    const rows = convertAll(0, "s", cfg);
    expect(rows.every((r) => r.value === 0)).toBe(true);
    expect(rows[0].display).toBe("0");
  });
});

describe("time-unit-converter formatValueForDisplay", () => {
  it("handles zero", () => {
    expect(formatValueForDisplay(0)).toBe("0");
  });

  it("handles integers with locale separators", () => {
    expect(formatValueForDisplay(1_000_000)).toBe("1,000,000");
  });

  it("handles tiny values with scientific notation", () => {
    expect(formatValueForDisplay(1e-10)).toMatch(/e-/);
  });

  it("handles huge values with scientific notation", () => {
    expect(formatValueForDisplay(1e20)).toMatch(/e\+/);
  });

  it("handles fractional values by trimming zeros", () => {
    const s = formatValueForDisplay(1.5);
    expect(s).toBe("1.5");
  });

  it("returns dash for non-finite", () => {
    expect(formatValueForDisplay(NaN)).toBe("—");
    expect(formatValueForDisplay(Infinity)).toBe("—");
  });
});

describe("time-unit-converter formatScientific", () => {
  it("formats 0 as 0", () => {
    expect(formatScientific(0)).toBe("0");
  });

  it("formats large numbers in exponential", () => {
    expect(formatScientific(123456789)).toMatch(/e\+/);
  });

  it("returns dash for non-finite", () => {
    expect(formatScientific(NaN)).toBe("—");
  });
});

describe("time-unit-converter humanizeDuration", () => {
  it("humanizes 90061 seconds as 1d 1h 1m 1s", () => {
    expect(humanizeDuration(90061)).toBe("1d 1h 1m 1s");
  });

  it("humanizes 0 as 0s", () => {
    expect(humanizeDuration(0)).toBe("0s");
  });

  it("humanizes 90 seconds as 1m 30s", () => {
    expect(humanizeDuration(90)).toBe("1m 30s");
  });

  it("humanizes 3600 seconds as 1h", () => {
    expect(humanizeDuration(3600)).toBe("1h");
  });

  it("respects maxUnits option", () => {
    const s = humanizeDuration(90061, { maxUnits: 2 });
    expect(s).toBe("1d 1h");
  });

  it("handles negative durations", () => {
    expect(humanizeDuration(-90)).toBe("-1m 30s");
  });

  it("shows ms only when no other units", () => {
    expect(humanizeDuration(0.5)).toBe("500ms");
  });

  it("respects delimiter", () => {
    expect(humanizeDuration(90061, { delimiter: ", " })).toBe("1d, 1h, 1m, 1s");
  });
});

describe("time-unit-converter parseHumanDuration", () => {
  it("parses '1d 1h 1m 1s' as 90061 seconds", () => {
    expect(parseHumanDuration("1d 1h 1m 1s").seconds).toBe(90061);
  });

  it("parses '1h30m' as 5400 seconds", () => {
    expect(parseHumanDuration("1h30m").seconds).toBe(5400);
  });

  it("parses bare integer as seconds", () => {
    expect(parseHumanDuration("60").seconds).toBe(60);
  });

  it("parses decimal seconds", () => {
    expect(parseHumanDuration("1.5").seconds).toBe(1.5);
  });

  it("parses '1y' as 365.25 days in seconds", () => {
    expect(parseHumanDuration("1y").seconds).toBe(365.25 * 86400);
  });

  it("parses '1w' as 7 days in seconds", () => {
    expect(parseHumanDuration("1w").seconds).toBe(7 * 86400);
  });

  it("rejects empty", () => {
    expect(parseHumanDuration("").ok).toBe(false);
  });

  it("rejects garbage", () => {
    expect(parseHumanDuration("abc").ok).toBe(false);
  });

  it("round-trips with humanizeDuration (60s)", () => {
    const h = humanizeDuration(60);
    const parsed = parseHumanDuration(h);
    expect(parsed.ok).toBe(true);
    expect(parsed.seconds).toBe(60);
  });
});

describe("time-unit-converter generateCodeSnippet", () => {
  it("generates JS snippet", () => {
    const s = generateCodeSnippet(1, "h", "s", cfg, "js");
    expect(s).toContain("// Convert 1 h -> s");
    expect(s).toContain("const value = 1");
    expect(s).toContain("nsPerH");
    expect(s).toContain("nsPerS");
    expect(s).toContain("result");
  });

  it("generates Python snippet", () => {
    const s = generateCodeSnippet(1, "h", "s", cfg, "py");
    expect(s).toContain("# Convert 1 h -> s");
    expect(s).toContain("value = 1");
    expect(s).toContain("ns_per_h");
    expect(s).toContain("ns_per_s");
    expect(s).toContain("print(");
  });

  it("includes config in comments", () => {
    const s = generateCodeSnippet(1, "h", "s", cfg, "js");
    expect(s).toContain("month=30.44");
    expect(s).toContain("year=365.25");
  });

  it("supports dev units", () => {
    const s = generateCodeSnippet(60, "frames", "s", cfg, "js");
    expect(s).toContain("frames");
    expect(s).toContain("nsPerFrames");
  });
});

describe("time-unit-converter validateValue", () => {
  it("accepts integers", () => {
    expect(validateValue("3600")).toEqual({ ok: true, value: 3600 });
  });

  it("accepts decimals", () => {
    expect(validateValue("1.5")).toEqual({ ok: true, value: 1.5 });
  });

  it("accepts scientific notation", () => {
    expect(validateValue("1e9").ok).toBe(true);
    expect(validateValue("1e9").value).toBe(1e9);
  });

  it("accepts negative", () => {
    expect(validateValue("-60").ok).toBe(true);
    expect(validateValue("-60").value).toBe(-60);
  });

  it("rejects empty", () => {
    expect(validateValue("").ok).toBe(false);
  });

  it("rejects non-numeric", () => {
    expect(validateValue("abc").ok).toBe(false);
  });
});

describe("time-unit-converter history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });

  it("saves and loads", () => {
    saveHistory({
      ts: 1, value: 1, from: "h", to: "s",
      month: "30.44", year: "365.25",
    });
    const h = loadHistory();
    expect(h).toHaveLength(1);
    expect(h[0].value).toBe(1);
    expect(h[0].from).toBe("h");
  });

  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i, value: i, from: "s", to: "ms",
        month: "30.44", year: "365.25",
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });

  it("clears", () => {
    saveHistory({
      ts: 1, value: 1, from: "h", to: "s",
      month: "30.44", year: "365.25",
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("time-unit-converter shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    try {
      const url = buildShareUrl(3600, "s", cfg);
      expect(url).toContain("v=3600");
      expect(url).toContain("u=s");
      expect(url).toContain("mo=30.44");
      expect(url).toContain("y=365.25");
    } finally {
      (globalThis as Record<string, unknown>).window = origWindow;
    }
  });

  it("includes fps only when non-default", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    try {
      const urlDefault = buildShareUrl(60, "frames", cfg);
      expect(urlDefault).not.toContain("fps=");
      const cfg30: Config = { ...cfg, fps: 30 };
      const url30 = buildShareUrl(60, "frames", cfg30);
      expect(url30).toContain("fps=30");
    } finally {
      (globalThis as Record<string, unknown>).window = origWindow;
    }
  });

  it("parses share URL back", () => {
    const p = parseShareUrl("v=3600&u=s&mo=30.44&y=365.25");
    expect(p).not.toBeNull();
    expect(p!.value).toBe(3600);
    expect(p!.from).toBe("s");
    expect(p!.config.month).toBe("30.44");
    expect(p!.config.year).toBe("365.25");
  });

  it("parses dev unit (frames)", () => {
    const p = parseShareUrl("v=60&u=frames&mo=30.44&y=365.25&fps=30");
    expect(p).not.toBeNull();
    expect(p!.from).toBe("frames");
    expect(p!.config.fps).toBe(30);
  });

  it("returns null for empty hash", () => {
    expect(parseShareUrl("")).toBeNull();
  });

  it("returns null for unknown unit", () => {
    expect(parseShareUrl("v=1&u=unknown")).toBeNull();
  });

  it("falls back to defaults for unknown month/year", () => {
    const p = parseShareUrl("v=1&u=s&mo=99&y=99");
    expect(p).not.toBeNull();
    expect(p!.config.month).toBe("30.44");
    expect(p!.config.year).toBe("365.25");
  });

  it("round-trips a value via build + parse", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    try {
      const url = buildShareUrl(5400, "s", { ...cfg, fps: 30, hz: 250 });
      const hash = url.substring(url.indexOf("?") + 1);
      const p = parseShareUrl(hash);
      expect(p!.value).toBe(5400);
      expect(p!.from).toBe("s");
      expect(p!.config.fps).toBe(30);
      expect(p!.config.hz).toBe(250);
    } finally {
      (globalThis as Record<string, unknown>).window = origWindow;
    }
  });
});

// Suppress unused-import lint
export type _Unused = AnyUnit;
