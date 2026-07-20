import { describe, it, expect, beforeEach } from "vitest";
import {
  TRIP_TYPE_LABELS,
  PACE_LABELS,
  BUDGET_LABELS,
  INTEREST_LABELS,
  SAMPLE_DESTINATIONS,
  normalizeDestination,
  clampDays,
  normalizeTravelers,
  normalizeInterests,
  parseInterestText,
  parseCities,
  timeToMinutes,
  minutesToTime,
  addMinutes,
  addDays,
  estimateTravelGap,
  estimateCost,
  paceDurationFactor,
  maxStopsPerDay,
  filterActivities,
  pickMeal,
  seedFromInput,
  buildDay,
  buildTransitStop,
  generateItinerary,
  computeStats,
  buildLocalTips,
  regenerateDay,
  adjustPace,
  buildDayMapUrl,
  renderItineraryText,
  renderItineraryMarkdown,
  renderItineraryJson,
  buildIcsExport,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildLlmRequestBody,
  extractLlmItinerary,
  type TripType,
  type Pace,
  type Budget,
  type Interest,
  type ItineraryInput,
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

const baseInput: ItineraryInput = {
  destination: "Paris",
  days: 3,
  pace: "balanced",
  budget: "mid-range",
  tripType: "city-break",
  interests: ["history", "art"],
  travelers: 2,
  startDate: "2025-06-01",
};

describe("itinerary constants", () => {
  it("has 5 trip type labels", () => {
    expect(Object.keys(TRIP_TYPE_LABELS)).toHaveLength(5);
    expect(TRIP_TYPE_LABELS["city-break"]).toBe("City Break");
  });
  it("has 3 pace labels", () => {
    expect(Object.keys(PACE_LABELS)).toHaveLength(3);
  });
  it("has 3 budget labels", () => {
    expect(Object.keys(BUDGET_LABELS)).toHaveLength(3);
  });
  it("has 10 interest labels", () => {
    expect(Object.keys(INTEREST_LABELS)).toHaveLength(10);
  });
  it("has 12 sample destinations", () => {
    expect(SAMPLE_DESTINATIONS).toHaveLength(12);
    expect(SAMPLE_DESTINATIONS[0].length).toBeGreaterThan(0);
  });
});

describe("itinerary normalizeDestination", () => {
  it("trims and caps length", () => {
    expect(normalizeDestination("  Paris  ")).toBe("Paris");
    expect(normalizeDestination("a".repeat(200))).toHaveLength(120);
  });
  it("handles empty", () => {
    expect(normalizeDestination("")).toBe("");
  });
});

describe("itinerary clampDays", () => {
  it("clamps to 1-30", () => {
    expect(clampDays(0)).toBe(1);
    expect(clampDays(5)).toBe(5);
    expect(clampDays(100)).toBe(30);
    expect(clampDays(NaN)).toBe(3);
  });
});

describe("itinerary normalizeTravelers", () => {
  it("clamps to 1-20 and floors", () => {
    expect(normalizeTravelers(0)).toBe(1);
    expect(normalizeTravelers(2.5)).toBe(2);
    expect(normalizeTravelers(50)).toBe(20);
    expect(normalizeTravelers(NaN)).toBe(1);
  });
});

describe("itinerary normalizeInterests", () => {
  it("filters to valid interests", () => {
    expect(normalizeInterests(["history", "bogus", "art"])).toEqual(["history", "art"]);
  });
  it("dedupes", () => {
    expect(normalizeInterests(["history", "history"])).toEqual(["history"]);
  });
  it("handles non-array", () => {
    expect(normalizeInterests("history")).toEqual([]);
    expect(normalizeInterests(null)).toEqual([]);
  });
});

describe("itinerary parseInterestText", () => {
  it("extracts interests from free text", () => {
    const r = parseInterestText("I love history and art, also nature");
    expect(r).toContain("history");
    expect(r).toContain("art");
    expect(r).toContain("nature");
  });
});

describe("itinerary parseCities", () => {
  it("single city", () => {
    expect(parseCities("Paris")).toEqual(["Paris"]);
  });
  it("multi-city with ->", () => {
    expect(parseCities("Paris -> Lyon")).toEqual(["Paris", "Lyon"]);
  });
  it("multi-city with 'to'", () => {
    expect(parseCities("Paris to Lyon")).toEqual(["Paris", "Lyon"]);
  });
  it("dedupes case-insensitive", () => {
    expect(parseCities("Paris -> paris")).toEqual(["Paris"]);
  });
  it("empty returns empty", () => {
    expect(parseCities("")).toEqual([]);
  });
});

describe("itinerary time helpers", () => {
  it("timeToMinutes + minutesToTime round-trip", () => {
    expect(timeToMinutes("09:30")).toBe(570);
    expect(minutesToTime(570)).toBe("09:30");
    expect(minutesToTime(0)).toBe("00:00");
  });
  it("addMinutes wraps across midnight", () => {
    expect(addMinutes("23:30", 60)).toBe("00:30");
  });
  it("addDays adds correctly", () => {
    expect(addDays("2025-06-01", 3)).toBe("2025-06-04");
    expect(addDays("2025-01-31", 1)).toBe("2025-02-01");
  });
});

describe("itinerary heuristics", () => {
  it("estimateTravelGap scales with pace", () => {
    const r = estimateTravelGap("relaxed");
    const p = estimateTravelGap("packed");
    const b = estimateTravelGap("balanced");
    expect(r).toBeGreaterThan(p);
    expect(b).toBeGreaterThan(p);
    expect(r).toBeGreaterThan(b);
  });
  it("estimateCost scales with budget", () => {
    expect(estimateCost("meal", 20, "budget")).toBeLessThan(estimateCost("meal", 20, "mid-range"));
    expect(estimateCost("meal", 20, "luxury")).toBeGreaterThan(estimateCost("meal", 20, "mid-range"));
    expect(estimateCost("transit", 0, "luxury")).toBe(0);
  });
  it("paceDurationFactor matches", () => {
    expect(paceDurationFactor("packed")).toBeLessThan(paceDurationFactor("relaxed"));
    expect(paceDurationFactor("balanced")).toBe(1);
  });
  it("maxStopsPerDay ranks packed > balanced > relaxed", () => {
    expect(maxStopsPerDay("packed")).toBeGreaterThan(maxStopsPerDay("balanced"));
    expect(maxStopsPerDay("balanced")).toBeGreaterThan(maxStopsPerDay("relaxed"));
  });
});

describe("itinerary filterActivities + pickMeal", () => {
  it("filters by trip type", () => {
    const cityBreak = filterActivities("city-break", []);
    const foodie = filterActivities("foodie", []);
    expect(cityBreak.length).toBeGreaterThan(0);
    expect(foodie.length).toBeGreaterThan(0);
    expect(cityBreak.every((a) => a.tripTypes.includes("city-break"))).toBe(true);
  });
  it("excludes ids", () => {
    const pool = filterActivities("city-break", []);
    const firstId = pool[0].id;
    const filtered = filterActivities("city-break", [], [firstId]);
    expect(filtered.find((a) => a.id === firstId)).toBeUndefined();
  });
  it("preferentially orders by interest", () => {
    const pool = filterActivities("city-break", ["art"]);
    const first = pool[0];
    expect(first.interests?.includes("art")).toBe(true);
  });
  it("pickMeal returns a meal template", () => {
    const m = pickMeal("breakfast", "city-break");
    expect(m.slot).toBe("breakfast");
  });
});

describe("itinerary generateItinerary", () => {
  it("produces a 3-day plan with stops", () => {
    const r = generateItinerary(baseInput);
    expect(r.days).toHaveLength(3);
    expect(r.cities).toEqual(["Paris"]);
    expect(r.stats.totalStops).toBeGreaterThan(0);
    expect(r.stats.totalActivities).toBeGreaterThan(0);
    expect(r.stats.totalMeals).toBeGreaterThanOrEqual(9); // 3 meals/day * 3 days
    expect(r.localTips.length).toBeGreaterThan(0);
    expect(r.verifyNote.length).toBeGreaterThan(0);
  });
  it("each day has breakfast, lunch, dinner", () => {
    const r = generateItinerary(baseInput);
    for (const day of r.days) {
      const meals = day.stops.filter((s) => s.kind === "meal");
      expect(meals.length).toBeGreaterThanOrEqual(3);
    }
  });
  it("times are monotonic within a day", () => {
    const r = generateItinerary(baseInput);
    for (const day of r.days) {
      let prev = 0;
      for (const s of day.stops) {
        const t = timeToMinutes(s.startTime);
        expect(t).toBeGreaterThanOrEqual(prev);
        prev = timeToMinutes(s.endTime);
      }
    }
  });
  it("multi-city: emits transit stops when city changes", () => {
    const r = generateItinerary({ ...baseInput, destination: "Paris -> Lyon", days: 4 });
    expect(r.cities).toEqual(["Paris", "Lyon"]);
    const transitStops = r.days.flatMap((d) => d.stops.filter((s) => s.kind === "transit"));
    expect(transitStops.length).toBeGreaterThan(0);
  });
  it("deterministic: same input yields same itinerary id", () => {
    const a = generateItinerary(baseInput);
    const b = generateItinerary(baseInput);
    expect(a.id).toBe(b.id);
  });
  it("throws on empty destination", () => {
    expect(() => generateItinerary({ ...baseInput, destination: "   " })).toThrow();
  });
});

describe("itinerary stats", () => {
  it("computeStats aggregates", () => {
    const r = generateItinerary(baseInput);
    const total = r.days.reduce((s, d) => s + d.stops.length, 0);
    expect(r.stats.totalStops).toBe(total);
    expect(r.stats.avgStopsPerDay).toBeGreaterThan(0);
  });
});

describe("itinerary regenerateDay + adjustPace", () => {
  it("regenerateDay changes stop ids", () => {
    const r = generateItinerary(baseInput);
    const before = r.days[0].stops.map((s) => s.id).join(",");
    const r2 = regenerateDay(r, 1);
    const after = r2.days[0].stops.map((s) => s.id).join(",");
    expect(after).not.toBe(before);
    expect(r2.days).toHaveLength(r.days.length);
  });
  it("regenerateDay ignores out-of-range day index", () => {
    const r = generateItinerary(baseInput);
    const r2 = regenerateDay(r, 999);
    expect(r2).toBe(r);
  });
  it("adjustPace rebuilds days with new pace", () => {
    const r = generateItinerary(baseInput);
    const r2 = adjustPace(r, "packed");
    expect(r2.input.pace).toBe("packed");
    // Packed pace should produce >= stops than relaxed (per-day avg)
    const rRelaxed = adjustPace(r, "relaxed");
    expect(r2.stats.avgStopsPerDay).toBeGreaterThanOrEqual(rRelaxed.stats.avgStopsPerDay);
  });
  it("adjustPace to same pace is a no-op", () => {
    const r = generateItinerary(baseInput);
    const r2 = adjustPace(r, "balanced");
    expect(r2).toBe(r);
  });
});

describe("itinerary map url", () => {
  it("buildDayMapUrl produces a Google Maps directions link", () => {
    const r = generateItinerary(baseInput);
    const url = buildDayMapUrl(r.days[0]);
    expect(url).toContain("https://www.google.com/maps/dir/");
    expect(url).toContain(encodeURIComponent("Paris"));
  });
  it("buildDayMapUrl empty on transit-only day", () => {
    const day = { dayIndex: 1, city: "X", stops: [], totalCostEstimate: 0, paceNote: "", walkingDistanceKm: 0 };
    expect(buildDayMapUrl(day)).toBe("");
  });
});

describe("itinerary rendering", () => {
  it("renderItineraryText contains header + day labels", () => {
    const r = generateItinerary(baseInput);
    const txt = renderItineraryText(r);
    expect(txt).toContain("Itinerary: Paris");
    expect(txt).toContain("=== Day 1");
    expect(txt).toContain("Local tips");
  });
  it("renderItineraryMarkdown contains H1 + table", () => {
    const r = generateItinerary(baseInput);
    const md = renderItineraryMarkdown(r);
    expect(md).toContain("# Itinerary: Paris");
    expect(md).toContain("| Time | Type |");
    expect(md).toContain("google.com/maps/dir/");
  });
  it("renderItineraryJson is valid JSON", () => {
    const r = generateItinerary(baseInput);
    const j = renderItineraryJson(r);
    const parsed = JSON.parse(j);
    expect(parsed.id).toBe(r.id);
    expect(parsed.days).toHaveLength(3);
  });
});

describe("itinerary .ics export", () => {
  it("buildIcsExport produces VCALENDAR with VEVENTs", () => {
    const r = generateItinerary(baseInput);
    const ics = buildIcsExport(r);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("20250601T090000");
  });
  it("buildIcsExport skips days without a date", () => {
    const r = generateItinerary({ ...baseInput, startDate: undefined });
    const ics = buildIcsExport(r);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).not.toContain("BEGIN:VEVENT");
  });
});

describe("itinerary history", () => {
  it("loadHistory empty by default", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saveHistory persists and caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: Date.now() + i,
        destination: `City${i}`,
        days: 3,
        tripType: "city-break",
        pace: "balanced",
        budget: "mid-range",
        stopCount: 5,
      });
    }
    const h = loadHistory();
    expect(h).toHaveLength(20);
    expect(h[0].destination).toBe("City24");
  });
  it("clearHistory empties storage", () => {
    saveHistory({
      ts: 1, destination: "X", days: 1, tripType: "city-break",
      pace: "balanced", budget: "mid-range", stopCount: 1,
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("itinerary share url", () => {
  it("buildShareUrl + parseShareUrl round-trip", () => {
    const state = {
      destination: "Tokyo",
      days: 5,
      pace: "packed" as Pace,
      budget: "luxury" as Budget,
      tripType: "foodie" as TripType,
      interests: ["foodie" as never, "history"] as Interest[],
      startDate: "2025-07-15",
      travelers: 4,
    };
    const url = buildShareUrl(state);
    expect(url).toContain("dest=Tokyo");
    expect(url).toContain("pace=packed");
    expect(url).toContain("budget=luxury");
    expect(url).toContain("type=foodie");
    expect(url).toContain("start=2025-07-15");
    const parsed = parseShareUrl(url);
    expect(parsed.destination).toBe("Tokyo");
    expect(parsed.pace).toBe("packed");
    expect(parsed.budget).toBe("luxury");
    expect(parsed.tripType).toBe("foodie");
    expect(parsed.interests).toContain("history");
    expect(parsed.startDate).toBe("2025-07-15");
    expect(parsed.travelers).toBe(4);
  });
  it("parseShareUrl empty returns defaults", () => {
    const p = parseShareUrl("");
    expect(p.destination).toBe("");
    expect(p.pace).toBe("balanced");
    expect(p.tripType).toBe("city-break");
  });
  it("parseShareUrl invalid values fall back to defaults", () => {
    const p = parseShareUrl("#pace=invalid&type=invalid&budget=invalid");
    expect(p.pace).toBe("balanced");
    expect(p.tripType).toBe("city-break");
    expect(p.budget).toBe("mid-range");
  });
});

describe("itinerary llm body", () => {
  it("buildLlmRequestBody includes trip type + pace", () => {
    const body = buildLlmRequestBody(baseInput);
    expect(body.model).toBe("gpt-4o-mini");
    expect(body.messages[0].content).toContain("City Break");
    expect(body.messages[0].content).toContain("Balanced");
    expect(body.messages[1].content).toBe("Paris");
  });
  it("extractLlmItinerary returns content string", () => {
    const out = extractLlmItinerary({
      choices: [{ message: { content: "Day 1 — Paris\n09:00-12:00 [activity] Louvre" } }],
    });
    expect(out).toContain("Day 1");
  });
  it("extractLlmItinerary handles bad input", () => {
    expect(extractLlmItinerary(null)).toBe("");
    expect(extractLlmItinerary({})).toBe("");
    expect(extractLlmItinerary({ choices: [] })).toBe("");
  });
});

describe("itinerary buildLocalTips", () => {
  it("returns at least 2 tips for any destination", () => {
    const tips = buildLocalTips("Anywhere", "city-break");
    expect(tips.length).toBeGreaterThanOrEqual(2);
  });
  it("foodie trip type adds a food-specific tip", () => {
    const tips = buildLocalTips("Bangkok", "foodie");
    expect(tips.some((t) => /locals eat|menu/i.test(t))).toBe(true);
  });
});
