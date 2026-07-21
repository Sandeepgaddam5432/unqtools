import { describe, it, expect, beforeEach } from "vitest";
import {
  SEARCH_FIELDS,
  ZONE_ENTRIES,
  RECENTLY_CHANGED_ZONES,
  formatOffset,
  parseOffset,
  getOffsetMinutes,
  getStandardAndDstOffsets,
  enrichZone,
  search,
  disambiguate,
  allAbbreviations,
  allIanaZones,
  allRegions,
  ambiguousAbbreviations,
  nowInZone,
  formatZoneTime,
  formatZoneDate,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
} from "./logic";

// Fixed reference dates — avoid flakiness from environment tz database changes.
// Both are well into the middle of years so northern/southern hemisphere
// DST detection works.
const WINTER_2025 = new Date(Date.UTC(2025, 0, 15, 12, 0, 0)); // Jan 15 2025 12:00 UTC
const SUMMER_2025 = new Date(Date.UTC(2025, 6, 15, 12, 0, 0)); // Jul 15 2025 12:00 UTC

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

describe("tz-abbr-reference constants", () => {
  it("exposes 6 search field options", () => {
    expect(SEARCH_FIELDS.length).toBe(6);
    expect(SEARCH_FIELDS.map((f) => f.value)).toContain("any");
    expect(SEARCH_FIELDS.map((f) => f.value)).toContain("offset");
  });
  it("has 200+ zone entries", () => {
    expect(ZONE_ENTRIES.length).toBeGreaterThanOrEqual(200);
  });
  it("exposes recently-changed zones list with 5+ entries", () => {
    expect(RECENTLY_CHANGED_ZONES.length).toBeGreaterThanOrEqual(5);
  });
  it("all entries have required fields populated", () => {
    for (const e of ZONE_ENTRIES) {
      expect(e.abbr).toBeTruthy();
      expect(e.fullName).toBeTruthy();
      expect(e.ianaZone).toMatch(/\//);
      expect(e.region).toBeTruthy();
      expect(e.exampleCity).toBeTruthy();
    }
  });
});

describe("tz-abbr-reference formatOffset", () => {
  it("formats positive whole-hour offset", () => {
    expect(formatOffset(60)).toBe("+01:00");
    expect(formatOffset(540)).toBe("+09:00");
  });
  it("formats negative whole-hour offset", () => {
    expect(formatOffset(-180)).toBe("-03:00");
    expect(formatOffset(-600)).toBe("-10:00");
  });
  it("formats half-hour offset", () => {
    expect(formatOffset(330)).toBe("+05:30");
    expect(formatOffset(-210)).toBe("-03:30");
  });
  it("formats 45-minute offset", () => {
    expect(formatOffset(345)).toBe("+05:45");
    expect(formatOffset(825)).toBe("+13:45");
  });
  it("formats zero offset", () => {
    expect(formatOffset(0)).toBe("+00:00");
  });
});

describe("tz-abbr-reference parseOffset", () => {
  it("parses +HH:MM", () => {
    expect(parseOffset("+05:30")).toBe(330);
    expect(parseOffset("-03:00")).toBe(-180);
  });
  it("parses +H:MM without leading zero", () => {
    expect(parseOffset("+5:30")).toBe(330);
    expect(parseOffset("-3:00")).toBe(-180);
  });
  it("parses plain integer hours", () => {
    expect(parseOffset("+9")).toBe(540);
    expect(parseOffset("-5")).toBe(-300);
  });
  it("strips UTC / GMT prefix", () => {
    expect(parseOffset("UTC+5:30")).toBe(330);
    expect(parseOffset("GMT-7")).toBe(-420);
  });
  it("treats Z / UTC as 0", () => {
    expect(parseOffset("Z")).toBe(0);
    expect(parseOffset("UTC")).toBe(0);
    expect(parseOffset("")).toBe(0);
  });
  it("returns null for invalid", () => {
    expect(parseOffset("abc")).toBeNull();
    expect(parseOffset("+99:99")).toBeNull();
    expect(parseOffset("+15:00")).toBeNull(); // max valid UTC offset is +14
  });
});

describe("tz-abbr-reference getOffsetMinutes", () => {
  it("returns 0 for Etc/UTC", () => {
    expect(getOffsetMinutes("Etc/UTC", WINTER_2025)).toBe(0);
  });
  it("returns +330 (5:30) for Asia/Kolkata", () => {
    expect(getOffsetMinutes("Asia/Kolkata", WINTER_2025)).toBe(330);
    expect(getOffsetMinutes("Asia/Kolkata", SUMMER_2025)).toBe(330); // India has no DST
  });
  it("returns -300 (winter) / -240 (summer) for America/New_York", () => {
    expect(getOffsetMinutes("America/New_York", WINTER_2025)).toBe(-300);
    expect(getOffsetMinutes("America/New_York", SUMMER_2025)).toBe(-240);
  });
  it("returns +600 (winter) / +660 (summer) for Australia/Sydney (Southern Hemisphere DST)", () => {
    // Jan is southern summer (DST on); Jul is southern winter (DST off).
    expect(getOffsetMinutes("Australia/Sydney", WINTER_2025)).toBe(660);
    expect(getOffsetMinutes("Australia/Sydney", SUMMER_2025)).toBe(600);
  });
  it("returns +345 (5:45) for Asia/Kathmandu", () => {
    expect(getOffsetMinutes("Asia/Kathmandu", WINTER_2025)).toBe(345);
  });
  it("returns -210 (3:30) for America/St_Johns (Newfoundland)", () => {
    expect(getOffsetMinutes("America/St_Johns", WINTER_2025)).toBe(-210);
  });
  it("returns -600 for Pacific/Honolulu (no DST)", () => {
    expect(getOffsetMinutes("Pacific/Honolulu", WINTER_2025)).toBe(-600);
    expect(getOffsetMinutes("Pacific/Honolulu", SUMMER_2025)).toBe(-600);
  });
});

describe("tz-abbr-reference getStandardAndDstOffsets", () => {
  it("reports DST for America/New_York", () => {
    const r = getStandardAndDstOffsets("America/New_York", WINTER_2025);
    expect(r.standardOffsetMinutes).toBe(-300);
    expect(r.dstOffsetMinutes).toBe(-240);
    expect(r.observesDst).toBe(true);
  });
  it("reports no DST for Asia/Kolkata", () => {
    const r = getStandardAndDstOffsets("Asia/Kolkata", WINTER_2025);
    expect(r.standardOffsetMinutes).toBe(330);
    expect(r.dstOffsetMinutes).toBe(330);
    expect(r.observesDst).toBe(false);
  });
  it("reports DST for Australia/Sydney (Southern Hemisphere)", () => {
    const r = getStandardAndDstOffsets("Australia/Sydney", WINTER_2025);
    expect(r.standardOffsetMinutes).toBe(600);
    expect(r.dstOffsetMinutes).toBe(660);
    expect(r.observesDst).toBe(true);
  });
  it("reports DST for Europe/London", () => {
    const r = getStandardAndDstOffsets("Europe/London", WINTER_2025);
    expect(r.standardOffsetMinutes).toBe(0);
    expect(r.dstOffsetMinutes).toBe(60);
    expect(r.observesDst).toBe(true);
  });
  it("returns equal std/dst for Etc/UTC", () => {
    const r = getStandardAndDstOffsets("Etc/UTC", WINTER_2025);
    expect(r.standardOffsetMinutes).toBe(0);
    expect(r.dstOffsetMinutes).toBe(0);
    expect(r.observesDst).toBe(false);
  });
});

describe("tz-abbr-reference enrichZone", () => {
  it("returns all enriched fields for an entry", () => {
    const entry = ZONE_ENTRIES.find((e) => e.ianaZone === "Asia/Kolkata")!;
    const r = enrichZone(entry, WINTER_2025);
    expect(r.abbr).toBe("IST");
    expect(r.standardOffsetMinutes).toBe(330);
    expect(r.dstOffsetMinutes).toBe(330);
    expect(r.observesDst).toBe(false);
    expect(r.dstActive).toBe(false);
    expect(r.currentOffsetMinutes).toBe(330);
    expect(r.standardOffsetStr).toBe("+05:30");
    expect(r.dstOffsetStr).toBe("+05:30");
    expect(r.currentOffsetStr).toBe("+05:30");
    expect(r.currentTimeStr).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    expect(r.currentDateStr).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it("marks DST active in northern summer for America/New_York", () => {
    const entry = ZONE_ENTRIES.find((e) => e.ianaZone === "America/New_York")!;
    const r = enrichZone(entry, SUMMER_2025);
    expect(r.dstActive).toBe(true);
    expect(r.currentOffsetMinutes).toBe(-240);
  });
  it("marks DST inactive in northern winter for America/New_York", () => {
    const entry = ZONE_ENTRIES.find((e) => e.ianaZone === "America/New_York")!;
    const r = enrichZone(entry, WINTER_2025);
    expect(r.dstActive).toBe(false);
    expect(r.currentOffsetMinutes).toBe(-300);
  });
});

describe("tz-abbr-reference search by abbreviation", () => {
  it("searches 'CST' and returns multiple disambiguation candidates", () => {
    const r = search({ query: "CST" }, WINTER_2025);
    expect(r.total).toBeGreaterThanOrEqual(3);
    const zones = r.rows.map((x) => x.ianaZone);
    expect(zones).toContain("America/Chicago");
    expect(zones).toContain("Asia/Shanghai");
    expect(zones).toContain("America/Havana");
    expect(r.ambiguous).toBe(true);
  });
  it("searches 'JST' returns Asia/Tokyo", () => {
    const r = search({ query: "JST" }, WINTER_2025);
    expect(r.total).toBeGreaterThanOrEqual(1);
    expect(r.rows.some((x) => x.ianaZone === "Asia/Tokyo")).toBe(true);
    expect(r.ambiguous).toBe(false);
  });
  it("searches 'GMT' returns at least Etc/GMT", () => {
    const r = search({ query: "GMT" }, WINTER_2025);
    expect(r.rows.some((x) => x.ianaZone === "Etc/GMT")).toBe(true);
  });
  it("returns empty for unknown abbreviation", () => {
    const r = search({ query: "ZZZQ" }, WINTER_2025);
    expect(r.total).toBe(0);
  });
  it("is case-insensitive for abbr search", () => {
    const upper = search({ query: "EST" }, WINTER_2025);
    const lower = search({ query: "est" }, WINTER_2025);
    expect(upper.total).toBe(lower.total);
    expect(upper.total).toBeGreaterThan(0);
  });
});

describe("tz-abbr-reference search by other fields", () => {
  it("searches by full name", () => {
    const r = search({ query: "Eastern Standard", field: "fullName" }, WINTER_2025);
    expect(r.total).toBeGreaterThanOrEqual(1);
    expect(r.rows.some((x) => x.ianaZone === "America/New_York")).toBe(true);
  });
  it("searches by IANA id", () => {
    const r = search({ query: "America/Chicago", field: "ianaZone" }, WINTER_2025);
    expect(r.total).toBeGreaterThanOrEqual(1);
    expect(r.rows[0].ianaZone).toBe("America/Chicago");
  });
  it("searches by city", () => {
    const r = search({ query: "Tokyo", field: "exampleCity" }, WINTER_2025);
    expect(r.rows.some((x) => x.ianaZone === "Asia/Tokyo")).toBe(true);
  });
  it("searches by offset '+5:30' returns India/Nepal etc.", () => {
    const r = search({ query: "+5:30", field: "offset" }, WINTER_2025);
    expect(r.total).toBeGreaterThanOrEqual(1);
    expect(r.rows.some((x) => x.ianaZone === "Asia/Kolkata")).toBe(true);
  });
  it("searches by offset '-10:00' returns Pacific/Honolulu", () => {
    const r = search({ query: "-10:00", field: "offset" }, WINTER_2025);
    expect(r.rows.some((x) => x.ianaZone === "Pacific/Honolulu")).toBe(true);
  });
});

describe("tz-abbr-reference disambiguate", () => {
  it("disambiguates CST into 3+ candidates", () => {
    const info = disambiguate("CST");
    expect(info).not.toBeNull();
    expect(info!.candidates.length).toBeGreaterThanOrEqual(3);
    expect(info!.regions).toContain("North America");
    expect(info!.regions).toContain("Asia");
  });
  it("disambiguates IST into 3 candidates", () => {
    const info = disambiguate("IST");
    expect(info).not.toBeNull();
    expect(info!.candidates.length).toBeGreaterThanOrEqual(3);
  });
  it("disambiguates BST into 3 candidates", () => {
    const info = disambiguate("BST");
    expect(info).not.toBeNull();
    expect(info!.candidates.length).toBeGreaterThanOrEqual(3);
  });
  it("disambiguates AMT into 2+ candidates", () => {
    const info = disambiguate("AMT");
    expect(info).not.toBeNull();
    expect(info!.candidates.length).toBeGreaterThanOrEqual(2);
  });
  it("returns null for unknown abbreviation", () => {
    expect(disambiguate("ZZZQ")).toBeNull();
  });
});

describe("tz-abbr-reference catalogs", () => {
  it("allAbbreviations returns 100+ distinct abbreviations", () => {
    const abbrs = allAbbreviations();
    expect(abbrs.length).toBeGreaterThanOrEqual(100);
    expect(abbrs).toContain("CST");
    expect(abbrs).toContain("JST");
    // Check sorted
    for (let i = 1; i < abbrs.length; i++) {
      expect(abbrs[i] >= abbrs[i - 1]).toBe(true);
    }
  });
  it("allIanaZones returns 100+ distinct zones", () => {
    const zones = allIanaZones();
    expect(zones.length).toBeGreaterThanOrEqual(100);
    expect(zones).toContain("America/New_York");
    expect(zones).toContain("Asia/Tokyo");
  });
  it("allRegions returns 5+ distinct regions", () => {
    const regions = allRegions();
    expect(regions.length).toBeGreaterThanOrEqual(5);
    expect(regions).toContain("North America");
    expect(regions).toContain("Asia");
  });
  it("ambiguousAbbreviations lists CST/IST/BST as ambiguous", () => {
    const amb = ambiguousAbbreviations();
    const abbrs = amb.map((a) => a.abbr);
    expect(abbrs).toContain("CST");
    expect(abbrs).toContain("IST");
    expect(abbrs).toContain("BST");
  });
});

describe("tz-abbr-reference nowInZone", () => {
  it("returns populated NowInZone for a known IANA zone", () => {
    const n = nowInZone("Asia/Tokyo", WINTER_2025);
    expect(n).not.toBeNull();
    expect(n!.ianaZone).toBe("Asia/Tokyo");
    expect(n!.offsetStr).toBe("+09:00");
    expect(n!.dstActive).toBe(false);
    expect(n!.timeStr).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });
  it("detects DST active in northern summer for America/New_York", () => {
    const n = nowInZone("America/New_York", SUMMER_2025);
    expect(n!.dstActive).toBe(true);
    expect(n!.offsetStr).toBe("-04:00");
  });
  it("returns null for unknown IANA zone in lookup (but still computes)", () => {
    const n = nowInZone("Etc/UTC", WINTER_2025);
    expect(n).not.toBeNull();
    expect(n!.offsetStr).toBe("+00:00");
  });
});

describe("tz-abbr-reference formatZoneTime / formatZoneDate", () => {
  it("formats Tokyo time on Jan 15 2025 12:00 UTC as 21:00:00", () => {
    const s = formatZoneTime("Asia/Tokyo", WINTER_2025);
    expect(s).toBe("2025-01-15 21:00:00");
  });
  it("formats New York date on Jan 15 2025 12:00 UTC as 2025-01-15", () => {
    const s = formatZoneDate("America/New_York", WINTER_2025);
    expect(s).toBe("2025-01-15");
  });
  it("formats Kolkata time on Jan 15 2025 12:00 UTC as 17:30:00", () => {
    const s = formatZoneTime("Asia/Kolkata", WINTER_2025);
    expect(s).toBe("2025-01-15 17:30:00");
  });
});

describe("tz-abbr-reference history", () => {
  it("loadHistory returns empty when none stored", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saveHistory appends and caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, query: `q-${i}`, field: "any", matchCount: i });
    }
    const h = loadHistory();
    expect(h.length).toBe(20);
    expect(h[0].query).toBe("q-24");
  });
  it("clearHistory empties storage", () => {
    saveHistory({ ts: 1, query: "CST", field: "abbr", matchCount: 3 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("tz-abbr-reference share URL", () => {
  it("buildShareUrl encodes query and field", () => {
    const url = buildShareUrl("CST", "abbr", null);
    expect(url).toMatch(/q=CST/);
    expect(url).toMatch(/f=abbr/);
  });
  it("buildShareUrl includes offset only when non-null", () => {
    const url1 = buildShareUrl("+5:30", "offset", null);
    expect(url1).not.toMatch(/off=/);
    const url2 = buildShareUrl("+5:30", "offset", 330);
    expect(url2).toMatch(/off=330/);
  });
  it("parseShareUrl round-trips", () => {
    const params = parseShareUrl("#q=CST&f=abbr&off=-300");
    expect(params.query).toBe("CST");
    expect(params.field).toBe("abbr");
    expect(params.offsetMinutes).toBe(-300);
  });
  it("parseShareUrl returns defaults for empty", () => {
    const params = parseShareUrl("");
    expect(params.query).toBe("");
    expect(params.field).toBe("any");
    expect(params.offsetMinutes).toBeNull();
  });
});
