import { describe, it, expect, beforeEach } from "vitest";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  PRESETS,
  DEFAULT_INPUT,
  getCategory,
  getUnit,
  listUnitIds,
  defaultUnitId,
  roundTo,
  formatNumber,
  convertTemperature,
  formulaReference,
  convert,
  swapUnits,
  filterUnits,
  renderText,
  renderCsv,
  computeSummary,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type Category,
  type ConverterInput,
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

describe("unit-converter constants", () => {
  it("has 10 categories", () => {
    expect(CATEGORIES).toHaveLength(10);
    expect(Object.keys(CATEGORY_LABELS)).toHaveLength(10);
  });
  it("length has 9 units", () => {
    const cat = getCategory("length");
    expect(cat?.units).toHaveLength(9);
  });
  it("mass has 7 units", () => {
    const cat = getCategory("mass");
    expect(cat?.units).toHaveLength(7);
  });
  it("temperature has 3 units and special flag", () => {
    const cat = getCategory("temperature");
    expect(cat?.units).toHaveLength(3);
    expect(cat?.special).toBe("temperature");
  });
  it("time has 7 units", () => {
    expect(getCategory("time")?.units.length).toBe(7);
  });
  it("area has 6 units", () => {
    expect(getCategory("area")?.units.length).toBe(6);
  });
  it("volume has 7 units", () => {
    expect(getCategory("volume")?.units.length).toBe(7);
  });
  it("speed has 4 units", () => {
    expect(getCategory("speed")?.units.length).toBe(4);
  });
  it("digital-storage has 7 units", () => {
    expect(getCategory("digital-storage")?.units.length).toBe(7);
  });
  it("energy has 4 units", () => {
    expect(getCategory("energy")?.units.length).toBe(4);
  });
  it("pressure has 5 units", () => {
    expect(getCategory("pressure")?.units.length).toBe(5);
  });
  it("total units across categories is 59", () => {
    const total = CATEGORIES.reduce((sum, c) => sum + c.units.length, 0);
    expect(total).toBe(59);
  });
  it("has 6 presets", () => {
    expect(PRESETS).toHaveLength(6);
  });
  it("default input is length, mile→km", () => {
    expect(DEFAULT_INPUT.category).toBe("length");
    expect(DEFAULT_INPUT.fromUnitId).toBe("mile");
    expect(DEFAULT_INPUT.toUnitId).toBe("kilometer");
    expect(DEFAULT_INPUT.showSteps).toBe(true);
    expect(DEFAULT_INPUT.precision).toBe(4);
  });
});

describe("unit-converter getCategory/getUnit", () => {
  it("finds category by id", () => {
    expect(getCategory("mass")?.label).toBe("Mass");
  });
  it("returns undefined for unknown category", () => {
    expect(getCategory("nope" as unknown as Category)).toBeUndefined();
  });
  it("finds unit by id", () => {
    expect(getUnit("length", "mile")?.symbol).toBe("mi");
  });
  it("returns undefined for unknown unit", () => {
    expect(getUnit("length", "nope")).toBeUndefined();
  });
});

describe("unit-converter listUnitIds/defaultUnitId", () => {
  it("lists all unit ids", () => {
    const ids = listUnitIds("mass");
    expect(ids).toContain("kilogram");
    expect(ids).toContain("gram");
    expect(ids.length).toBe(7);
  });
  it("returns empty list for unknown category", () => {
    expect(listUnitIds("nope" as unknown as Category)).toEqual([]);
  });
  it("defaultUnitId returns first unit", () => {
    expect(defaultUnitId("length")).toBe("meter");
  });
  it("defaultUnitId prefers fallback when valid", () => {
    expect(defaultUnitId("mass", "pound")).toBe("pound");
  });
  it("defaultUnitId returns first when fallback invalid", () => {
    expect(defaultUnitId("mass", "mile")).toBe("kilogram");
  });
});

describe("unit-converter roundTo/formatNumber", () => {
  it("rounds to specified decimals", () => {
    expect(roundTo(3.14159, 2)).toBe(3.14);
  });
  it("rounds to 0 decimals", () => {
    expect(roundTo(3.7, 0)).toBe(4);
  });
  it("clamps precision above 10", () => {
    expect(roundTo(1.123456789012345, 20)).toBeCloseTo(1.1234567890, 10);
  });
  it("handles NaN", () => {
    expect(Number.isNaN(roundTo(NaN, 2))).toBe(true);
  });
  it("formats number with fixed precision", () => {
    expect(formatNumber(3.14159, 2)).toBe("3.14");
  });
  it("formats Infinity as string", () => {
    expect(formatNumber(Infinity, 2)).toBe("Infinity");
  });
  it("formats NaN as string", () => {
    expect(formatNumber(NaN, 2)).toBe("NaN");
  });
});

describe("unit-converter convertTemperature", () => {
  it("converts C to F", () => {
    const r = convertTemperature(100, "celsius", "fahrenheit");
    expect(r.result).toBeCloseTo(212, 5);
    expect(r.formula).toContain("9/5");
  });
  it("converts C to K", () => {
    const r = convertTemperature(0, "celsius", "kelvin");
    expect(r.result).toBeCloseTo(273.15, 5);
  });
  it("converts F to C", () => {
    const r = convertTemperature(32, "fahrenheit", "celsius");
    expect(r.result).toBeCloseTo(0, 5);
  });
  it("converts F to K", () => {
    const r = convertTemperature(212, "fahrenheit", "kelvin");
    expect(r.result).toBeCloseTo(373.15, 5);
  });
  it("converts K to C", () => {
    const r = convertTemperature(300, "kelvin", "celsius");
    expect(r.result).toBeCloseTo(26.85, 2);
  });
  it("converts K to F", () => {
    const r = convertTemperature(273.15, "kelvin", "fahrenheit");
    expect(r.result).toBeCloseTo(32, 5);
  });
  it("same unit returns same value", () => {
    const r = convertTemperature(50, "celsius", "celsius");
    expect(r.result).toBe(50);
  });
  it("handles unknown from", () => {
    const r = convertTemperature(50, "nope", "celsius");
    expect(Number.isNaN(r.result)).toBe(true);
  });
  it("handles unknown to", () => {
    const r = convertTemperature(50, "celsius", "nope");
    expect(Number.isNaN(r.result)).toBe(true);
  });
});

describe("unit-converter formulaReference", () => {
  it("returns temperature formulas", () => {
    const ref = formulaReference("temperature");
    expect(ref).toContain("9/5");
    expect(ref).toContain("273.15");
  });
  it("returns multiplicative formula for length", () => {
    const ref = formulaReference("length");
    expect(ref).toContain("factor_from / factor_to");
    expect(ref).toContain("m");
  });
  it("returns empty string for unknown category", () => {
    expect(formulaReference("nope" as unknown as Category)).toBe("");
  });
});

describe("unit-converter convert (multiplicative)", () => {
  it("converts 1 mile to km", () => {
    const r = convert({ ...DEFAULT_INPUT });
    expect(r.result).toBeCloseTo(1.6093, 3);
    expect(r.steps.length).toBeGreaterThan(0);
  });
  it("includes formula step", () => {
    const r = convert({ ...DEFAULT_INPUT });
    expect(r.steps.some((s) => s.label === "Formula")).toBe(true);
  });
  it("includes result step", () => {
    const r = convert({ ...DEFAULT_INPUT });
    expect(r.steps.some((s) => s.label === "Result")).toBe(true);
  });
  it("respects precision", () => {
    const r = convert({ ...DEFAULT_INPUT, precision: 2 });
    expect(r.steps[r.steps.length - 1].expression).toContain("1.61");
  });
  it("hides intermediate steps when showSteps=false", () => {
    const r = convert({ ...DEFAULT_INPUT, showSteps: false });
    expect(r.steps).toHaveLength(1);
    expect(r.steps[0].label).toBe("Result");
  });
  it("converts kg to lb", () => {
    const r = convert({
      category: "mass",
      fromUnitId: "kilogram",
      toUnitId: "pound",
      value: 1,
      showSteps: true,
      precision: 4,
    });
    expect(r.result).toBeCloseTo(2.2046, 3);
  });
  it("converts hour to second", () => {
    const r = convert({
      category: "time",
      fromUnitId: "hour",
      toUnitId: "second",
      value: 1,
      showSteps: true,
      precision: 0,
    });
    expect(r.result).toBe(3600);
  });
  it("handles same-unit conversion", () => {
    const r = convert({
      category: "length",
      fromUnitId: "meter",
      toUnitId: "meter",
      value: 5,
      showSteps: true,
      precision: 2,
    });
    expect(r.result).toBe(5);
  });
  it("handles NaN value", () => {
    const r = convert({ ...DEFAULT_INPUT, value: NaN });
    expect(Number.isNaN(r.result)).toBe(true);
  });
  it("handles unknown from unit gracefully", () => {
    const r = convert({ ...DEFAULT_INPUT, fromUnitId: "nope" });
    expect(Number.isNaN(r.result)).toBe(true);
  });
});

describe("unit-converter convert (temperature)", () => {
  it("converts 100 °C to °F", () => {
    const r = convert({
      category: "temperature",
      fromUnitId: "celsius",
      toUnitId: "fahrenheit",
      value: 100,
      showSteps: true,
      precision: 2,
    });
    expect(r.result).toBeCloseTo(212, 5);
    expect(r.steps.length).toBeGreaterThan(1);
  });
  it("has formula reference for temperature", () => {
    const r = convert({
      category: "temperature",
      fromUnitId: "celsius",
      toUnitId: "kelvin",
      value: 0,
      showSteps: true,
      precision: 2,
    });
    expect(r.formulaReference).toContain("273.15");
  });
});

describe("unit-converter swapUnits", () => {
  it("swaps from and to", () => {
    const r = swapUnits({ ...DEFAULT_INPUT, fromUnitId: "mile", toUnitId: "kilometer" });
    expect(r.fromUnitId).toBe("kilometer");
    expect(r.toUnitId).toBe("mile");
  });
  it("preserves other fields", () => {
    const r = swapUnits({ ...DEFAULT_INPUT, value: 5, precision: 2 });
    expect(r.value).toBe(5);
    expect(r.precision).toBe(2);
  });
});

describe("unit-converter filterUnits", () => {
  it("returns all units when query is empty", () => {
    expect(filterUnits("length", "")).toHaveLength(9);
  });
  it("filters by symbol", () => {
    const r = filterUnits("length", "m");
    expect(r.some((u) => u.id === "meter")).toBe(true);
    expect(r.some((u) => u.id === "mile")).toBe(true);
    expect(r.some((u) => u.id === "millimeter")).toBe(true);
  });
  it("filters by name case-insensitive", () => {
    const r = filterUnits("length", "KILO");
    expect(r.some((u) => u.id === "kilometer")).toBe(true);
  });
  it("filters by id", () => {
    const r = filterUnits("length", "nautical");
    expect(r).toHaveLength(1);
    expect(r[0].id).toBe("nautical-mile");
  });
  it("returns empty for no match", () => {
    expect(filterUnits("length", "zzz")).toEqual([]);
  });
  it("returns empty for unknown category", () => {
    expect(filterUnits("nope" as unknown as Category, "m")).toEqual([]);
  });
});

describe("unit-converter renderText", () => {
  it("renders a text report", () => {
    const r = convert({ ...DEFAULT_INPUT });
    const text = renderText(r);
    expect(text).toContain("Unit Conversion Report");
    expect(text).toContain("Category: Length");
    expect(text).toContain("Steps:");
    expect(text).toContain("Result:");
  });
  it("includes from/to symbols", () => {
    const r = convert({ ...DEFAULT_INPUT });
    const text = renderText(r);
    expect(text).toContain("mi");
    expect(text).toContain("km");
  });
  it("includes formula reference", () => {
    const r = convert({ ...DEFAULT_INPUT });
    const text = renderText(r);
    expect(text).toContain("Formula reference:");
  });
});

describe("unit-converter renderCsv", () => {
  it("renders header", () => {
    const r = convert({ ...DEFAULT_INPUT });
    const csv = renderCsv(r);
    expect(csv).toContain("from_unit,from_symbol,to_unit,to_symbol,value,result,formula");
  });
  it("renders row", () => {
    const r = convert({ ...DEFAULT_INPUT });
    const csv = renderCsv(r);
    expect(csv).toContain("Mile");
    expect(csv).toContain("Kilometer");
  });
});

describe("unit-converter computeSummary", () => {
  it("computes by-category counts", () => {
    const entries = [
      { ts: 1, category: "length" as Category, fromUnitId: "mile", toUnitId: "kilometer", value: 1, result: 1.6 },
      { ts: 2, category: "length" as Category, fromUnitId: "meter", toUnitId: "foot", value: 1, result: 3.28 },
      { ts: 3, category: "mass" as Category, fromUnitId: "kilogram", toUnitId: "pound", value: 1, result: 2.2 },
    ];
    const s = computeSummary(entries);
    expect(s.total).toBe(3);
    expect(s.byCategory.length).toBe(2);
    expect(s.byCategory.mass).toBe(1);
  });
  it("returns zero for empty", () => {
    const s = computeSummary([]);
    expect(s.total).toBe(0);
  });
});

describe("unit-converter history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1,
      category: "length",
      fromUnitId: "mile",
      toUnitId: "kilometer",
      value: 1,
      result: 1.6,
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i,
        category: "length",
        fromUnitId: "mile",
        toUnitId: "kilometer",
        value: 1,
        result: 1.6,
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1,
      category: "length",
      fromUnitId: "mile",
      toUnitId: "kilometer",
      value: 1,
      result: 1.6,
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("unit-converter shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({ ...DEFAULT_INPUT });
    expect(url).toContain("cat=length");
    expect(url).toContain("from=mile");
    expect(url).toContain("to=kilometer");
    expect(url).toContain("v=1");
    expect(url).toContain("p=4");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const input: ConverterInput = {
      category: "temperature",
      fromUnitId: "celsius",
      toUnitId: "fahrenheit",
      value: 100,
      showSteps: false,
      precision: 2,
    };
    const url = buildShareUrl(input);
    const hash = url.includes("#") ? url.slice(url.indexOf("#")) : url;
    const parsed = parseShareUrl(hash);
    expect(parsed.category).toBe("temperature");
    expect(parsed.fromUnitId).toBe("celsius");
    expect(parsed.toUnitId).toBe("fahrenheit");
    expect(parsed.value).toBe(100);
    expect(parsed.precision).toBe(2);
    expect(parsed.showSteps).toBe(false);
  });
  it("handles empty hash with defaults", () => {
    const parsed = parseShareUrl("");
    expect(parsed.category).toBe("length");
    expect(parsed.fromUnitId).toBe("mile");
    expect(parsed.toUnitId).toBe("kilometer");
  });
  it("filters unknown category", () => {
    const parsed = parseShareUrl("cat=bogus&from=mile");
    expect(parsed.category).toBe("length");
  });
  it("falls back when unit doesn't exist in category", () => {
    const parsed = parseShareUrl("cat=mass&from=mile&to=gram");
    expect(parsed.fromUnitId).toBe("kilogram"); // fallback to first
    expect(parsed.toUnitId).toBe("gram");
  });
});

// Suppress unused-import lint
export type _Unused = Category | ConverterInput;
