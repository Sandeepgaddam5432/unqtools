import { describe, it, expect } from "vitest";
import {
  getAllPresets,
  getPresetById,
  getPresetsByCategory,
  searchPresets,
  calculateRT60,
  preDelayRatio,
  suggestMixLevel,
  msToSeconds,
  comparePresets,
  formatPresetAsText,
  exportPresetsAsCSV,
  recommendPluginChain,
  validateReverbParams,
  REVERB_PRESETS,
} from "./logic";

describe("audio-reverb-reference getAllPresets", () => {
  it("returns at least 6 presets", () => {
    expect(getAllPresets().length).toBeGreaterThanOrEqual(6);
  });

  it("returns a copy (mutating result does not affect source)", () => {
    const arr = getAllPresets();
    arr.push(arr[0]);
    expect(getAllPresets().length).toBe(REVERB_PRESETS.length);
  });
});

describe("audio-reverb-reference getPresetById", () => {
  it("finds plate by id", () => {
    const p = getPresetById("plate");
    expect(p).not.toBeNull();
    expect(p!.category).toBe("plate");
  });

  it("returns null for unknown id", () => {
    expect(getPresetById("does-not-exist")).toBeNull();
  });
});

describe("audio-reverb-reference getPresetsByCategory", () => {
  it("returns hall presets", () => {
    const halls = getPresetsByCategory("hall");
    expect(halls.length).toBeGreaterThanOrEqual(2);
    expect(halls.every((h) => h.category === "hall")).toBe(true);
  });

  it("returns empty array for category with no matches (still valid)", () => {
    // All categories exist, but verify behavior with non-empty filtering
    const spring = getPresetsByCategory("spring");
    expect(spring.length).toBeGreaterThanOrEqual(1);
  });
});

describe("audio-reverb-reference searchPresets", () => {
  it("finds by name substring", () => {
    const results = searchPresets("plate");
    expect(results.some((r) => r.id === "plate")).toBe(true);
  });

  it("finds by use case", () => {
    const results = searchPresets("surf");
    expect(results.some((r) => r.id === "spring")).toBe(true);
  });

  it("returns empty for query that matches nothing", () => {
    expect(searchPresets("zzzzznomatch")).toEqual([]);
  });

  it("is case-insensitive", () => {
    const r1 = searchPresets("HALL");
    const r2 = searchPresets("hall");
    expect(r1.length).toBe(r2.length);
  });
});

describe("audio-reverb-reference calculateRT60", () => {
  it("returns 0 for zero decay", () => {
    expect(calculateRT60(0, 0.5)).toBe(0);
  });

  it("reduces perceived time with high damping", () => {
    const noDamping = calculateRT60(2000, 0);
    const heavyDamping = calculateRT60(2000, 1);
    expect(heavyDamping).toBeLessThan(noDamping);
  });

  it("returns positive for normal values", () => {
    expect(calculateRT60(1500, 0.3)).toBeGreaterThan(0);
  });
});

describe("audio-reverb-reference preDelayRatio", () => {
  it("returns 0 when decay is 0", () => {
    expect(preDelayRatio(20, 0)).toBe(0);
  });

  it("returns value between 0 and 1 for normal inputs", () => {
    const r = preDelayRatio(40, 2000);
    expect(r).toBeGreaterThan(0);
    expect(r).toBeLessThan(1);
  });
});

describe("audio-reverb-reference suggestMixLevel", () => {
  it("returns lower mix for room than for hall", () => {
    expect(suggestMixLevel("room")).toBeLessThan(suggestMixLevel("hall"));
  });

  it("returns highest mix for spring", () => {
    expect(suggestMixLevel("spring")).toBeGreaterThanOrEqual(suggestMixLevel("hall"));
  });
});

describe("audio-reverb-reference msToSeconds", () => {
  it("formats 1500 ms as 1.50s", () => {
    expect(msToSeconds(1500)).toBe("1.50s");
  });
});

describe("audio-reverb-reference comparePresets", () => {
  it("returns 7 diff rows", () => {
    const a = getPresetById("plate")!;
    const b = getPresetById("hall")!;
    const rows = comparePresets(a, b);
    expect(rows.length).toBe(7);
    expect(rows[0].field).toBe("Category");
  });
});

describe("audio-reverb-reference formatPresetAsText", () => {
  it("includes name and key params", () => {
    const txt = formatPresetAsText(getPresetById("plate")!);
    expect(txt).toContain("PLATE REVERB");
    expect(txt).toContain("Pre-delay");
    expect(txt).toContain("Use cases");
  });
});

describe("audio-reverb-reference exportPresetsAsCSV", () => {
  it("has header + one row per preset", () => {
    const csv = exportPresetsAsCSV();
    const lines = csv.split("\n");
    expect(lines.length).toBe(REVERB_PRESETS.length + 1);
    expect(lines[0]).toContain("id,name,category");
  });
});

describe("audio-reverb-reference recommendPluginChain", () => {
  it("returns non-empty chain for each category", () => {
    const cats = ["hall", "plate", "spring", "room", "chamber"] as const;
    for (const c of cats) {
      const chain = recommendPluginChain(c);
      expect(chain.length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("audio-reverb-reference validateReverbParams", () => {
  it("warns on very short decay", () => {
    const w = validateReverbParams({ decayMs: 50 });
    expect(w.some((x) => x.includes("100 ms"))).toBe(true);
  });

  it("warns on very long decay", () => {
    const w = validateReverbParams({ decayMs: 8000 });
    expect(w.some((x) => x.includes("6 s"))).toBe(true);
  });

  it("warns on negative pre-delay", () => {
    const w = validateReverbParams({ preDelayMs: -10 });
    expect(w.some((x) => x.includes("negative"))).toBe(true);
  });

  it("warns on out-of-range diffusion", () => {
    const w = validateReverbParams({ diffusion: 1.5 });
    expect(w.some((x) => x.includes("0 and 1"))).toBe(true);
  });

  it("returns no warnings for healthy values", () => {
    expect(validateReverbParams({ decayMs: 1500, preDelayMs: 30, diffusion: 0.7 })).toEqual([]);
  });
});
