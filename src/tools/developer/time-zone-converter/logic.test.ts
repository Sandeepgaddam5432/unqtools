import { describe, it, expect, beforeEach } from "vitest";
import {
  IANA_ZONES,
  CITY_DATABASE,
  searchCities,
  findCityByName,
  searchZones,
  isValidZone,
  formatOffset,
  getZoneParts,
  resolveLocalTime,
  formatDifference,
  convertTime,
  nowInZone,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type ConvertInput,
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

describe("time-zone-converter constants", () => {
  it("exposes 400+ IANA zones", () => {
    expect(IANA_ZONES.length).toBeGreaterThanOrEqual(400);
  });
  it("includes common zones", () => {
    expect(IANA_ZONES).toContain("America/New_York");
    expect(IANA_ZONES).toContain("Asia/Kolkata");
    expect(IANA_ZONES).toContain("Asia/Kathmandu");
    expect(IANA_ZONES).toContain("Pacific/Chatham");
    expect(IANA_ZONES).toContain("UTC");
  });
  it("exposes 200+ cities", () => {
    expect(CITY_DATABASE.length).toBeGreaterThanOrEqual(200);
  });
  it("maps New York → America/New_York", () => {
    const ny = findCityByName("New York");
    expect(ny).not.toBeNull();
    expect(ny!.zone).toBe("America/New_York");
  });
  it("maps Mumbai → Asia/Kolkata", () => {
    const mumbai = findCityByName("Mumbai");
    expect(mumbai).not.toBeNull();
    expect(mumbai!.zone).toBe("Asia/Kolkata");
  });
});

describe("time-zone-converter searchCities", () => {
  it("finds cities by prefix (case-insensitive)", () => {
    const r = searchCities("new");
    expect(r.length).toBeGreaterThan(0);
    expect(r.some((c) => c.city === "New York")).toBe(true);
  });
  it("returns empty for empty query", () => {
    expect(searchCities("")).toEqual([]);
  });
  it("respects limit", () => {
    expect(searchCities("a", 5).length).toBeLessThanOrEqual(5);
  });
  it("matches by country name as fallback", () => {
    const r = searchCities("germany");
    expect(r.length).toBeGreaterThan(0);
    expect(r.some((c) => c.country === "Germany")).toBe(true);
  });
});

describe("time-zone-converter findCityByName", () => {
  it("exact match (case-insensitive)", () => {
    expect(findCityByName("TOKYO")?.zone).toBe("Asia/Tokyo");
  });
  it("returns null for unknown city", () => {
    expect(findCityByName("Nowhere City")).toBeNull();
  });
  it("returns null for empty", () => {
    expect(findCityByName("")).toBeNull();
  });
});

describe("time-zone-converter searchZones", () => {
  it("finds zones by substring", () => {
    const r = searchZones("Asia/");
    expect(r.length).toBeGreaterThan(10);
    // The default limit is 50, so test a more specific search to guarantee Tokyo
    expect(searchZones("Asia/To")).toContain("Asia/Tokyo");
  });
  it("respects limit", () => {
    expect(searchZones("America/", 5).length).toBeLessThanOrEqual(5);
  });
  it("case-insensitive", () => {
    const r = searchZones("asia/kol");
    expect(r).toContain("Asia/Kolkata");
  });
});

describe("time-zone-converter isValidZone", () => {
  it("accepts valid IANA zones", () => {
    expect(isValidZone("America/New_York")).toBe(true);
    expect(isValidZone("UTC")).toBe(true);
  });
  it("rejects unknown zones", () => {
    expect(isValidZone("Foo/Bar")).toBe(false);
    expect(isValidZone("")).toBe(false);
  });
});

describe("time-zone-converter formatOffset", () => {
  it("formats positive offset with 30-min", () => {
    expect(formatOffset(330)).toBe("+05:30"); // IST
  });
  it("formats negative offset", () => {
    expect(formatOffset(-300)).toBe("-05:00"); // EST
  });
  it("formats 45-min offset", () => {
    expect(formatOffset(345)).toBe("+05:45"); // NPT
  });
  it("formats zero", () => {
    expect(formatOffset(0)).toBe("+00:00");
  });
  it("formats negative 45-min offset (Chatham)", () => {
    expect(formatOffset(-765)).toBe("-12:45");
  });
});

describe("time-zone-converter getZoneParts", () => {
  it("returns UTC parts for Unix 0", () => {
    const p = getZoneParts(0, "UTC");
    expect(p.year).toBe(1970);
    expect(p.month).toBe(1);
    expect(p.day).toBe(1);
    expect(p.hour).toBe(0);
    expect(p.minute).toBe(0);
    expect(p.offsetMinutes).toBe(0);
    expect(p.offsetLabel).toBe("+00:00");
  });
  it("returns NY parts for Unix 0 (winter → EST -05:00)", () => {
    const p = getZoneParts(0, "America/New_York");
    expect(p.year).toBe(1969);
    expect(p.month).toBe(12);
    expect(p.day).toBe(31);
    expect(p.hour).toBe(19);
    expect(p.offsetMinutes).toBe(-300);
    expect(p.dstActive).toBe(false);
  });
  it("returns Kolkata parts for Unix 0 (IST +05:30)", () => {
    const p = getZoneParts(0, "Asia/Kolkata");
    expect(p.year).toBe(1970);
    expect(p.month).toBe(1);
    expect(p.day).toBe(1);
    expect(p.hour).toBe(5);
    expect(p.minute).toBe(30);
    expect(p.offsetMinutes).toBe(330);
  });
  it("returns Kathmandu parts (NPT +05:45)", () => {
    // Use a post-1986 date when Nepal adopted +5:45 (Unix 0 was still +5:30)
    const instant = Date.UTC(2024, 0, 1, 0, 0, 0);
    const p = getZoneParts(instant, "Asia/Kathmandu");
    expect(p.minute).toBe(45);
    expect(p.offsetMinutes).toBe(345);
  });
  it("detects DST active in NY summer", () => {
    // 2024-07-15 12:00 UTC = 2024-07-15 08:00 EDT (DST)
    const instant = Date.UTC(2024, 6, 15, 12, 0, 0);
    const p = getZoneParts(instant, "America/New_York");
    expect(p.dstActive).toBe(true);
    expect(p.offsetMinutes).toBe(-240); // EDT
  });
  it("detects DST inactive in NY winter", () => {
    // 2024-01-15 12:00 UTC = 2024-01-15 07:00 EST
    const instant = Date.UTC(2024, 0, 15, 12, 0, 0);
    const p = getZoneParts(instant, "America/New_York");
    expect(p.dstActive).toBe(false);
    expect(p.offsetMinutes).toBe(-300); // EST
  });
  it("iso includes offset label", () => {
    const p = getZoneParts(0, "Asia/Kolkata");
    expect(p.iso).toMatch(/\+05:30$/);
  });
});

describe("time-zone-converter resolveLocalTime", () => {
  it("resolves unambiguous time in NY", () => {
    // 2024-07-15 12:00 NY (EDT) → 16:00 UTC
    const r = resolveLocalTime("America/New_York", 2024, 7, 15, 12, 0, 0);
    expect(r.ambiguity).toBe("unique");
    expect(r.instantMs).toBe(Date.UTC(2024, 6, 15, 16, 0, 0));
    expect(r.message).toBeNull();
  });
  it("detects spring-forward gap in NY (2024-03-10 02:30)", () => {
    // NY springs forward 2024-03-10 02:00 → 03:00 (EST→EDT)
    const r = resolveLocalTime("America/New_York", 2024, 3, 10, 2, 30, 0);
    expect(r.ambiguity).toBe("gap");
    expect(r.message).toMatch(/do not exist|does not exist/i);
  });
  it("detects fall-back overlap in NY (2024-11-03 01:30)", () => {
    // NY falls back 2024-11-03 02:00 → 01:00 (EDT→EST)
    const r = resolveLocalTime("America/New_York", 2024, 11, 3, 1, 30, 0);
    expect(r.ambiguity).toBe("overlap");
    expect(r.message).toMatch(/occurs twice|fall-back/i);
  });
  it("uses DST (earlier) interpretation for overlap", () => {
    // 2024-11-03 01:30 EDT = 05:30 UTC; 01:30 EST = 06:30 UTC
    const r = resolveLocalTime("America/New_York", 2024, 11, 3, 1, 30, 0);
    expect(r.instantMs).toBe(Date.UTC(2024, 10, 3, 5, 30, 0));
    expect(r.offsetMinutes).toBe(-240); // EDT (DST)
  });
  it("resolves winter time in Kolkata (no DST)", () => {
    const r = resolveLocalTime("Asia/Kolkata", 2024, 1, 15, 12, 0, 0);
    expect(r.ambiguity).toBe("unique");
    expect(r.instantMs).toBe(Date.UTC(2024, 0, 15, 6, 30, 0)); // IST = UTC+5:30
  });
});

describe("time-zone-converter formatDifference", () => {
  it("formats ahead 9h 30m", () => {
    expect(formatDifference(570)).toBe("9h 30m ahead");
  });
  it("formats behind 3h", () => {
    expect(formatDifference(-180)).toBe("3h behind");
  });
  it("formats same time", () => {
    expect(formatDifference(0)).toBe("same time");
  });
  it("formats ahead 30m", () => {
    expect(formatDifference(30)).toBe("30m ahead");
  });
  it("formats behind 45m", () => {
    expect(formatDifference(-45)).toBe("45m behind");
  });
});

describe("time-zone-converter convertTime", () => {
  it("converts NY summer 12:00 → LA 09:00 (3h behind)", () => {
    const input: ConvertInput = {
      sourceZone: "America/New_York",
      year: 2024, month: 7, day: 15, hour: 12, minute: 0, second: 0,
      targetZones: ["America/Los_Angeles"],
    };
    const r = convertTime(input);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.targets[0].hour).toBe(9);
      expect(r.targets[0].offsetMinutes).toBe(-420); // PDT UTC-7
      expect(r.differences[0].diffMinutes).toBe(-180); // LA is 3h behind NY (both DST)
    }
  });
  it("converts NY winter 12:00 → LA 09:00 (3h behind)", () => {
    const input: ConvertInput = {
      sourceZone: "America/New_York",
      year: 2024, month: 1, day: 15, hour: 12, minute: 0, second: 0,
      targetZones: ["America/Los_Angeles"],
    };
    const r = convertTime(input);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.targets[0].hour).toBe(9);
      expect(r.targets[0].offsetMinutes).toBe(-480); // PST UTC-8
      expect(r.differences[0].diffMinutes).toBe(-180); // LA is 3h behind NY (both standard)
    }
  });
  it("converts NY → Kolkata (summer: 9h30 ahead)", () => {
    const input: ConvertInput = {
      sourceZone: "America/New_York",
      year: 2024, month: 7, day: 15, hour: 12, minute: 0, second: 0,
      targetZones: ["Asia/Kolkata"],
    };
    const r = convertTime(input);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.differences[0].diffMinutes).toBe(570); // 9h30 ahead
      expect(r.differences[0].label).toBe("9h 30m ahead");
    }
  });
  it("converts NY → Kolkata (winter: 10h30 ahead)", () => {
    const input: ConvertInput = {
      sourceZone: "America/New_York",
      year: 2024, month: 1, day: 15, hour: 12, minute: 0, second: 0,
      targetZones: ["Asia/Kolkata"],
    };
    const r = convertTime(input);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.differences[0].diffMinutes).toBe(630); // 10h30 ahead
      expect(r.differences[0].label).toBe("10h 30m ahead");
    }
  });
  it("handles multiple target zones", () => {
    const input: ConvertInput = {
      sourceZone: "UTC",
      year: 2024, month: 7, day: 15, hour: 12, minute: 0, second: 0,
      targetZones: ["America/New_York", "Europe/London", "Asia/Tokyo", "Australia/Sydney"],
    };
    const r = convertTime(input);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.targets).toHaveLength(4);
      expect(r.differences).toHaveLength(4);
    }
  });
  it("reports gap ambiguity in source zone", () => {
    const input: ConvertInput = {
      sourceZone: "America/New_York",
      year: 2024, month: 3, day: 10, hour: 2, minute: 30, second: 0,
      targetZones: ["UTC"],
    };
    const r = convertTime(input);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.ambiguity).toBe("gap");
      expect(r.ambiguityMessage).not.toBeNull();
    }
  });
  it("reports overlap ambiguity in source zone", () => {
    const input: ConvertInput = {
      sourceZone: "America/New_York",
      year: 2024, month: 11, day: 3, hour: 1, minute: 30, second: 0,
      targetZones: ["UTC"],
    };
    const r = convertTime(input);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.ambiguity).toBe("overlap");
      expect(r.ambiguityMessage).not.toBeNull();
    }
  });
  it("returns error for unknown source zone", () => {
    const input: ConvertInput = {
      sourceZone: "Foo/Bar",
      year: 2024, month: 1, day: 1, hour: 0, minute: 0, second: 0,
      targetZones: [],
    };
    const r = convertTime(input);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/unknown/i);
  });
  it("returns error for unknown target zone", () => {
    const input: ConvertInput = {
      sourceZone: "UTC",
      year: 2024, month: 1, day: 1, hour: 0, minute: 0, second: 0,
      targetZones: ["Not/AZone"],
    };
    const r = convertTime(input);
    expect(r.ok).toBe(false);
  });
});

describe("time-zone-converter nowInZone", () => {
  it("returns current snapshot with valid parts", () => {
    const snap = nowInZone("UTC");
    expect(snap.instantMs).toBeGreaterThan(0);
    expect(snap.zone).toBe("UTC");
    expect(snap.parts.zone).toBe("UTC");
    expect(snap.iso).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
  it("returns valid parts for Kolkata", () => {
    const snap = nowInZone("Asia/Kolkata");
    expect(snap.parts.offsetMinutes).toBe(330);
  });
});

describe("time-zone-converter history", () => {
  it("loadHistory returns empty by default", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saveHistory appends and caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: Date.now(),
        sourceZone: "UTC",
        targetZones: ["Asia/Kolkata"],
        instantMs: Date.now(),
        iso: new Date().toISOString(),
      });
    }
    const list = loadHistory();
    expect(list).toHaveLength(20);
  });
  it("clearHistory empties the store", () => {
    saveHistory({
      ts: 1, sourceZone: "UTC", targetZones: [],
      instantMs: 1, iso: "1970-01-01T00:00:00.000Z",
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("time-zone-converter share URL", () => {
  const sampleInput: ConvertInput = {
    sourceZone: "America/New_York",
    year: 2024, month: 7, day: 15, hour: 12, minute: 0, second: 0,
    targetZones: ["Asia/Kolkata", "Europe/London"],
  };
  it("buildShareUrl encodes source + datetime + targets", () => {
    const url = buildShareUrl(sampleInput);
    expect(url).toContain("src=America");
    expect(url).toContain("dt=2024-07-15T12");
    expect(url).toContain("targets=Asia");
  });
  it("parseShareUrl round-trips", () => {
    const url = buildShareUrl(sampleInput);
    const parsed = parseShareUrl(url);
    expect(parsed).not.toBeNull();
    if (parsed) {
      expect(parsed.sourceZone).toBe("America/New_York");
      expect(parsed.year).toBe(2024);
      expect(parsed.month).toBe(7);
      expect(parsed.day).toBe(15);
      expect(parsed.hour).toBe(12);
      expect(parsed.minute).toBe(0);
      expect(parsed.second).toBe(0);
      expect(parsed.targetZones).toEqual(["Asia/Kolkata", "Europe/London"]);
    }
  });
  it("parseShareUrl returns null for empty hash", () => {
    expect(parseShareUrl("")).toBeNull();
  });
  it("parseShareUrl returns null for missing src", () => {
    expect(parseShareUrl("dt=2024-07-15T12:00:00")).toBeNull();
  });
  it("parseShareUrl returns null for invalid src zone", () => {
    expect(parseShareUrl("src=Foo/Bar&dt=2024-07-15T12:00:00")).toBeNull();
  });
  it("parseShareUrl returns null for malformed datetime", () => {
    expect(parseShareUrl("src=UTC&dt=not-a-date")).toBeNull();
  });
  it("parseShareUrl filters invalid target zones", () => {
    const parsed = parseShareUrl("src=UTC&dt=2024-07-15T12:00:00&targets=Asia/Kolkata,Invalid/Zone");
    expect(parsed).not.toBeNull();
    if (parsed) {
      expect(parsed.targetZones).toEqual(["Asia/Kolkata"]);
    }
  });
});
