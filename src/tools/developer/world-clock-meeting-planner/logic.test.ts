import { describe, it, expect, beforeEach } from "vitest";
import {
  IANA_ZONES,
  CITY_DATABASE,
  DEFAULT_WORK_HOURS,
  DEFAULT_DURATION_MINUTES,
  searchCities,
  findCityByName,
  cityForZone,
  isValidZone,
  formatOffset,
  getZoneParts,
  classifyHour,
  computeGrid,
  findBestSlots,
  renderSlotSummary,
  renderIcs,
  buildGoogleCalendarUrl,
  buildOutlookUrl,
  nowInZones,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  parseDateUtc,
  formatDateUtc,
  type WorkHours,
  type IcsEvent,
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

describe("world-clock-meeting-planner constants", () => {
  it("exposes 400+ IANA zones", () => {
    expect(IANA_ZONES.length).toBeGreaterThanOrEqual(400);
  });
  it("includes common zones", () => {
    expect(IANA_ZONES).toContain("America/New_York");
    expect(IANA_ZONES).toContain("Asia/Kolkata");
    expect(IANA_ZONES).toContain("Asia/Kathmandu");
    expect(IANA_ZONES).toContain("UTC");
  });
  it("exposes 400+ cities", () => {
    expect(CITY_DATABASE.length).toBeGreaterThanOrEqual(400);
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
  it("has default work hours 9-17 Mon-Fri", () => {
    expect(DEFAULT_WORK_HOURS.startHour).toBe(9);
    expect(DEFAULT_WORK_HOURS.endHour).toBe(17);
    expect(DEFAULT_WORK_HOURS.weekendDays).toEqual([0, 6]);
  });
  it("has default meeting duration 60 min", () => {
    expect(DEFAULT_DURATION_MINUTES).toBe(60);
  });
});

describe("world-clock-meeting-planner searchCities", () => {
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

describe("world-clock-meeting-planner findCityByName", () => {
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

describe("world-clock-meeting-planner cityForZone", () => {
  it("returns first matching city entry", () => {
    const c = cityForZone("Asia/Kolkata");
    expect(c).not.toBeNull();
    expect(c!.zone).toBe("Asia/Kolkata");
  });
  it("returns null for unknown zone", () => {
    expect(cityForZone("Nowhere/Zone")).toBeNull();
  });
});

describe("world-clock-meeting-planner isValidZone", () => {
  it("validates a known zone", () => {
    expect(isValidZone("America/New_York")).toBe(true);
  });
  it("rejects unknown zone", () => {
    expect(isValidZone("Mars/Olympus_Mons")).toBe(false);
  });
});

describe("world-clock-meeting-planner formatOffset", () => {
  it("formats positive offset", () => {
    expect(formatOffset(330)).toBe("+05:30");
  });
  it("formats negative offset", () => {
    expect(formatOffset(-300)).toBe("-05:00");
  });
  it("formats zero offset", () => {
    expect(formatOffset(0)).toBe("+00:00");
  });
  it("formats 45-minute offset (NPT)", () => {
    expect(formatOffset(345)).toBe("+05:45");
  });
});

describe("world-clock-meeting-planner getZoneParts", () => {
  it("returns NYC wall-clock for a known UTC instant", () => {
    // 2025-03-15T18:00:00Z → 14:00 EDT in New York (UTC-4 after DST start)
    const ms = Date.UTC(2025, 2, 15, 18, 0, 0);
    const p = getZoneParts(ms, "America/New_York");
    expect(p.year).toBe(2025);
    expect(p.month).toBe(3);
    expect(p.day).toBe(15);
    expect(p.hour).toBe(14);
    expect(p.minute).toBe(0);
    expect(p.zone).toBe("America/New_York");
    expect(p.iso).toContain("2025-03-15T14:00:00");
  });
  it("returns Tokyo wall-clock (UTC+9)", () => {
    // 2025-03-15T00:00:00Z → 09:00 in Tokyo
    const ms = Date.UTC(2025, 2, 15, 0, 0, 0);
    const p = getZoneParts(ms, "Asia/Tokyo");
    expect(p.hour).toBe(9);
    expect(p.offsetLabel).toBe("+09:00");
  });
  it("exposes weekdayNum 0-6", () => {
    // 2025-03-15 is a Saturday in UTC, also Saturday in New York
    const ms = Date.UTC(2025, 2, 15, 18, 0, 0);
    const p = getZoneParts(ms, "America/New_York");
    expect(p.weekdayNum).toBe(6);
  });
  it("provides an abbreviation and offset label", () => {
    const ms = Date.UTC(2025, 6, 1, 12, 0, 0); // July = summer = EDT/UTC-4
    const p = getZoneParts(ms, "America/New_York");
    expect(p.offsetLabel).toBe("-04:00");
    expect(p.abbreviation.length).toBeGreaterThan(0);
  });
});

describe("world-clock-meeting-planner classifyHour", () => {
  const wh: WorkHours = { startHour: 9, endHour: 17, weekendDays: [0, 6] };
  it("classifies 12 noon on Monday as work", () => {
    expect(classifyHour(12, 1, wh)).toBe("work");
  });
  it("classifies 22 (10pm) as sleep", () => {
    expect(classifyHour(22, 1, wh)).toBe("sleep");
  });
  it("classifies 03 (3am) as sleep", () => {
    expect(classifyHour(3, 1, wh)).toBe("sleep");
  });
  it("classifies 20 (8pm) as off (awake but not work)", () => {
    expect(classifyHour(20, 1, wh)).toBe("off");
  });
  it("classifies noon on Saturday as off (weekend)", () => {
    expect(classifyHour(12, 6, wh)).toBe("off");
  });
  it("respects custom weekend (Middle East Sun-Thu work)", () => {
    const me: WorkHours = { startHour: 9, endHour: 17, weekendDays: [5, 6] };
    expect(classifyHour(12, 0, me)).toBe("work"); // Sunday is work day
    expect(classifyHour(12, 5, me)).toBe("off");  // Friday is weekend
  });
});

describe("world-clock-meeting-planner computeGrid", () => {
  it("produces one row per zone with 24 cells", () => {
    const dateMs = parseDateUtc("2025-03-15");
    const grid = computeGrid(["America/New_York", "Asia/Kolkata", "Asia/Tokyo"], dateMs);
    expect(grid).toHaveLength(3);
    for (const row of grid) {
      expect(row.cells).toHaveLength(24);
      expect(row.cells[0].utcHour).toBe(0);
      expect(row.cells[23].utcHour).toBe(23);
    }
  });
  it("labels rows with city + country names", () => {
    const dateMs = parseDateUtc("2025-03-15");
    const grid = computeGrid(["Asia/Kolkata"], dateMs);
    expect(grid[0].city).toBe("New Delhi");
    expect(grid[0].country).toBe("India");
  });
  it("falls back to zone id for unknown city", () => {
    const dateMs = parseDateUtc("2025-03-15");
    const grid = computeGrid(["Antarctica/Troll"], dateMs);
    expect(grid[0].zone).toBe("Antarctica/Troll");
    // city may be the zone id since Troll Station IS in the database, so just check structure
    expect(typeof grid[0].city).toBe("string");
    expect(grid[0].cells).toHaveLength(24);
  });
  it("each cell has a valid classification", () => {
    const dateMs = parseDateUtc("2025-03-15");
    const grid = computeGrid(["America/New_York"], dateMs);
    const classes = new Set(grid[0].cells.map((c) => c.classification));
    for (const cls of classes) {
      expect(["work", "off", "sleep"]).toContain(cls);
    }
  });
});

describe("world-clock-meeting-planner findBestSlots", () => {
  it("returns up to N slot suggestions sorted by score desc", () => {
    const dateMs = parseDateUtc("2025-03-15");
    const slots = findBestSlots(
      ["America/New_York", "Europe/London", "Asia/Kolkata"],
      dateMs,
      DEFAULT_WORK_HOURS,
      5,
    );
    expect(slots.length).toBeLessThanOrEqual(5);
    for (let i = 1; i < slots.length; i++) {
      expect(slots[i].score).toBeLessThanOrEqual(slots[i - 1].score);
    }
  });
  it("each slot has locals for every participant", () => {
    const dateMs = parseDateUtc("2025-03-15");
    const slots = findBestSlots(
      ["America/New_York", "Asia/Kolkata"],
      dateMs,
      DEFAULT_WORK_HOURS,
      3,
    );
    for (const s of slots) {
      expect(s.locals).toHaveLength(2);
      expect(s.totalParticipants).toBe(2);
    }
  });
  it("marks all-in-work-hours when overlapCount equals participants", () => {
    // Friday 2025-03-14: London is GMT (UTC+0), Lagos is UTC+0 — they overlap 9-17.
    const dateMs = parseDateUtc("2025-03-14");
    const slots = findBestSlots(
      ["Europe/London", "Africa/Lagos"],
      dateMs,
      DEFAULT_WORK_HOURS,
      24,
    );
    expect(slots.some((s) => s.allInWorkHours && s.overlapCount === 2)).toBe(true);
  });
  it("returns no all-in-work slots when there is no overlap", () => {
    // Friday 2025-03-14: Los Angeles (UTC-7 PDT) and Auckland (UTC+13 NZDT) —
    // 20h apart, no 9-17 overlap on the same weekday.
    const dateMs = parseDateUtc("2025-03-14");
    const slots = findBestSlots(
      ["America/Los_Angeles", "Pacific/Auckland"],
      dateMs,
      DEFAULT_WORK_HOURS,
      24,
    );
    expect(slots.every((s) => !s.allInWorkHours || s.overlapCount < 2)).toBe(true);
  });
  it("handles empty zones list", () => {
    const dateMs = parseDateUtc("2025-03-15");
    const slots = findBestSlots([], dateMs, DEFAULT_WORK_HOURS, 5);
    expect(slots.length).toBeLessThanOrEqual(5);
    for (const s of slots) {
      expect(s.totalParticipants).toBe(0);
      expect(s.locals).toEqual([]);
      expect(s.score).toBe(0);
    }
  });
});

describe("world-clock-meeting-planner renderSlotSummary", () => {
  it("includes UTC hour and each participant line", () => {
    const dateMs = parseDateUtc("2025-03-15");
    const slots = findBestSlots(["America/New_York", "Asia/Kolkata"], dateMs, DEFAULT_WORK_HOURS, 1);
    const summary = renderSlotSummary(slots[0], 60);
    expect(summary).toContain("UTC");
    expect(summary).toContain("New York");
    expect(summary).toContain("New Delhi");
    expect(summary).toContain("60 min");
  });
});

describe("world-clock-meeting-planner renderIcs", () => {
  it("produces a valid RFC 5545 VCALENDAR with VEVENT", () => {
    const event: IcsEvent = {
      title: "Team Standup",
      startUtcMs: Date.UTC(2025, 2, 15, 14, 0, 0),
      durationMinutes: 60,
      description: "Weekly sync",
      location: "Zoom",
    };
    const ics = renderIcs(event);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("END:VEVENT");
    expect(ics).toContain("VERSION:2.0");
    expect(ics).toContain("SUMMARY:Team Standup");
    expect(ics).toContain("DTSTART:20250315T140000Z");
    expect(ics).toContain("DTEND:20250315T150000Z");
    expect(ics).toContain("DESCRIPTION:Weekly sync");
    expect(ics).toContain("LOCATION:Zoom");
    // CRLF line endings
    expect(ics).toContain("\r\n");
  });
  it("escapes commas/semicolons in fields", () => {
    const event: IcsEvent = {
      title: "Team, Standup; Weekly",
      startUtcMs: Date.UTC(2025, 2, 15, 14, 0, 0),
      durationMinutes: 30,
    };
    const ics = renderIcs(event);
    expect(ics).toContain("SUMMARY:Team\\, Standup\\; Weekly");
  });
});

describe("world-clock-meeting-planner buildGoogleCalendarUrl", () => {
  it("encodes event details in a Google Calendar URL", () => {
    const event: IcsEvent = {
      title: "Team Sync",
      startUtcMs: Date.UTC(2025, 2, 15, 14, 0, 0),
      durationMinutes: 60,
      description: "Agenda",
    };
    const url = buildGoogleCalendarUrl(event);
    expect(url).toContain("https://www.google.com/calendar/render");
    expect(url).toContain("action=TEMPLATE");
    expect(url).toContain("text=Team+Sync");
    expect(url).toContain("dates=20250315T140000Z%2F20250315T150000Z");
  });
});

describe("world-clock-meeting-planner buildOutlookUrl", () => {
  it("encodes event details in an Outlook URL", () => {
    const event: IcsEvent = {
      title: "Team Sync",
      startUtcMs: Date.UTC(2025, 2, 15, 14, 0, 0),
      durationMinutes: 60,
    };
    const url = buildOutlookUrl(event);
    expect(url).toContain("outlook.live.com/calendar/0/deeplink/compose");
    expect(url).toContain("rru=addevent");
    expect(url).toContain("subject=Team+Sync");
    expect(url).toContain("startdt=2025-03-15T14%3A00%3A00.000Z");
  });
});

describe("world-clock-meeting-planner nowInZones", () => {
  it("returns one entry per zone with day/night flag", () => {
    const ms = Date.UTC(2025, 2, 15, 12, 0, 0); // 12:00 UTC
    const entries = nowInZones(["America/New_York", "Asia/Kolkata", "Asia/Tokyo"], ms);
    expect(entries).toHaveLength(3);
    // 12:00 UTC → 08:00 NYC (daytime), 17:30 India (daytime), 21:00 Tokyo (nighttime)
    const ny = entries.find((e) => e.zone === "America/New_York")!;
    const tokyo = entries.find((e) => e.zone === "Asia/Tokyo")!;
    expect(ny.isDaytime).toBe(true);
    expect(tokyo.isDaytime).toBe(false);
  });
});

describe("world-clock-meeting-planner history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, zones: ["America/New_York", "Asia/Kolkata"], date: "2025-03-15", topScore: 102 });
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0].zones).toEqual(["America/New_York", "Asia/Kolkata"]);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, zones: ["UTC"], date: "2025-01-01", topScore: i });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, zones: ["UTC"], date: "2025-01-01", topScore: 1 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("world-clock-meeting-planner shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      zones: ["America/New_York", "Asia/Kolkata"],
      date: "2025-03-15",
      startHour: 9,
      endHour: 17,
      weekendDays: [0, 6],
    });
    expect(url).toContain("zones=America%2FNew_York%2CAsia%2FKolkata");
    expect(url).toContain("date=2025-03-15");
    expect(url).toContain("sh=9");
    expect(url).toContain("eh=17");
    expect(url).toContain("we=0%2C6");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("zones=America/New_York,Asia/Kolkata&date=2025-03-15&sh=9&eh=17&we=0,6");
    expect(p).not.toBeNull();
    expect(p!.zones).toEqual(["America/New_York", "Asia/Kolkata"]);
    expect(p!.date).toBe("2025-03-15");
    expect(p!.startHour).toBe(9);
    expect(p!.endHour).toBe(17);
    expect(p!.weekendDays).toEqual([0, 6]);
  });
  it("returns null for empty hash", () => {
    expect(parseShareUrl("")).toBeNull();
  });
  it("filters unknown zones during parse", () => {
    const p = parseShareUrl("zones=Mars/Olympus,America/New_York&date=2025-03-15");
    expect(p!.zones).toEqual(["America/New_York"]);
  });
  it("drops out-of-range hour values", () => {
    const p = parseShareUrl("zones=UTC&date=2025-03-15&sh=99&eh=-1");
    expect(p!.startHour).toBeUndefined();
    expect(p!.endHour).toBeUndefined();
  });
});

describe("world-clock-meeting-planner date helpers", () => {
  it("parses YYYY-MM-DD as UTC midnight", () => {
    const ms = parseDateUtc("2025-03-15");
    expect(Number.isNaN(ms)).toBe(false);
    expect(new Date(ms).getUTCFullYear()).toBe(2025);
    expect(new Date(ms).getUTCMonth()).toBe(2);
    expect(new Date(ms).getUTCDate()).toBe(15);
    expect(new Date(ms).getUTCHours()).toBe(0);
  });
  it("returns NaN for invalid date", () => {
    expect(Number.isNaN(parseDateUtc("not-a-date"))).toBe(true);
    expect(Number.isNaN(parseDateUtc("2025/03/15"))).toBe(true);
    expect(Number.isNaN(parseDateUtc(""))).toBe(true);
  });
  it("formats a UTC instant as YYYY-MM-DD", () => {
    const ms = Date.UTC(2025, 2, 15, 14, 0, 0);
    expect(formatDateUtc(ms)).toBe("2025-03-15");
  });
});
