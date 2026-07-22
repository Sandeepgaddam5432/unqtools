import { describe, it, expect, beforeEach } from "vitest";
import {
  ALGORITHMS,
  ALGORITHM_LIST,
  PRESETS,
  DEFAULT_ARRAYS,
  parseArrayInput,
  formatArray,
  mulberry32,
  generatePreset,
  bubbleSort,
  cocktailSort,
  selectionSort,
  insertionSort,
  shellSort,
  gnomeSort,
  mergeSort,
  quickSort,
  heapSort,
  countingSort,
  radixSort,
  runAlgorithm,
  race,
  isSorted,
  colorForIndex,
  formatStep,
  getAlgorithmInfo,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type AlgorithmId,
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

// ---- Constants ----

describe("sorting-visualizer constants", () => {
  it("has 11 algorithms", () => {
    expect(Object.keys(ALGORITHMS)).toHaveLength(11);
  });
  it("ALGORITHM_LIST matches ALGORITHMS", () => {
    expect(ALGORITHM_LIST.length).toBe(Object.keys(ALGORITHMS).length);
  });
  it("has bubble, selection, insertion, merge, quick, heap (core 6)", () => {
    const ids = Object.keys(ALGORITHMS) as AlgorithmId[];
    for (const required of ["bubble", "selection", "insertion", "merge", "quick", "heap"] as AlgorithmId[]) {
      expect(ids).toContain(required);
    }
  });
  it("has 7 presets", () => {
    expect(PRESETS).toHaveLength(7);
  });
  it("DEFAULT_ARRAYS has all preset ids", () => {
    for (const p of PRESETS) {
      expect(DEFAULT_ARRAYS[p.id]).toBeDefined();
    }
  });
  it("each algorithm has full metadata", () => {
    for (const info of ALGORITHM_LIST) {
      expect(info.name).toBeTruthy();
      expect(info.timeBest).toBeTruthy();
      expect(info.timeAvg).toBeTruthy();
      expect(info.timeWorst).toBeTruthy();
      expect(info.space).toBeTruthy();
      expect(typeof info.stable).toBe("boolean");
      expect(typeof info.inPlace).toBe("boolean");
      expect(typeof info.adaptive).toBe("boolean");
      expect(info.description.length).toBeGreaterThan(20);
    }
  });
});

// ---- parseArrayInput ----

describe("sorting-visualizer parseArrayInput", () => {
  it("parses comma-separated", () => {
    const r = parseArrayInput("5,3,8,1");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.array).toEqual([5, 3, 8, 1]);
  });
  it("parses space-separated", () => {
    const r = parseArrayInput("5 3 8 1");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.array).toEqual([5, 3, 8, 1]);
  });
  it("parses mixed separators", () => {
    const r = parseArrayInput("5, 3; 8\n1");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.array).toEqual([5, 3, 8, 1]);
  });
  it("returns empty array for empty input", () => {
    const r = parseArrayInput("");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.array).toEqual([]);
  });
  it("rejects non-numeric", () => {
    expect(parseArrayInput("1,2,abc").ok).toBe(false);
  });
  it("rejects non-integer", () => {
    expect(parseArrayInput("1,2,3.5").ok).toBe(false);
  });
});

describe("sorting-visualizer formatArray", () => {
  it("formats with commas", () => {
    expect(formatArray([1, 2, 3])).toBe("1, 2, 3");
  });
  it("empty array", () => {
    expect(formatArray([])).toBe("");
  });
});

// ---- Preset generation ----

describe("sorting-visualizer mulberry32", () => {
  it("is deterministic for a given seed", () => {
    const r1 = mulberry32(42);
    const r2 = mulberry32(42);
    for (let i = 0; i < 5; i++) {
      expect(r1()).toBe(r2());
    }
  });
  it("produces values in [0,1)", () => {
    const r = mulberry32(1);
    for (let i = 0; i < 20; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("sorting-visualizer generatePreset", () => {
  it("random returns n values in 1..99", () => {
    const a = generatePreset("random", 20);
    expect(a).toHaveLength(20);
    for (const v of a) {
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(99);
    }
  });
  it("reversed returns descending", () => {
    const a = generatePreset("reversed", 10);
    expect(a).toEqual([10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
  });
  it("sorted returns ascending", () => {
    const a = generatePreset("sorted", 5);
    expect(a).toEqual([1, 2, 3, 4, 5]);
  });
  it("nearly-sorted has small perturbations", () => {
    const a = generatePreset("nearly-sorted", 10);
    expect(a).toHaveLength(10);
    // Should be close to sorted: at most ~10% out of place.
    let inversions = 0;
    for (let i = 0; i < a.length; i++) {
      for (let j = i + 1; j < a.length; j++) {
        if (a[i] > a[j]) inversions++;
      }
    }
    expect(inversions).toBeLessThan(a.length);
  });
  it("few-unique has only 4 distinct values", () => {
    const a = generatePreset("few-unique", 30);
    const unique = new Set(a);
    expect(unique.size).toBeLessThanOrEqual(4);
  });
  it("single returns one element", () => {
    expect(generatePreset("single", 1)).toHaveLength(1);
  });
  it("empty returns []", () => {
    expect(generatePreset("empty", 10)).toEqual([]);
  });
  it("clamps size to 200", () => {
    const a = generatePreset("random", 500);
    expect(a.length).toBeLessThanOrEqual(200);
  });
  it("is deterministic for fixed seed", () => {
    const a1 = generatePreset("random", 10, 7);
    const a2 = generatePreset("random", 10, 7);
    expect(a1).toEqual(a2);
  });
});

// ---- isSorted ----

describe("sorting-visualizer isSorted", () => {
  it("returns true for sorted", () => {
    expect(isSorted([1, 2, 3, 4, 5])).toBe(true);
  });
  it("returns false for unsorted", () => {
    expect(isSorted([5, 3, 1])).toBe(false);
  });
  it("returns true for empty", () => {
    expect(isSorted([])).toBe(true);
  });
  it("returns true for single element", () => {
    expect(isSorted([42])).toBe(true);
  });
  it("returns true for duplicates", () => {
    expect(isSorted([1, 1, 1, 1])).toBe(true);
  });
});

// ---- Each algorithm sorts correctly ----

const UNSORTED = [64, 34, 25, 12, 22, 11, 90];
const SORTED_ASC = [11, 12, 22, 25, 34, 64, 90];

function expectAlgorithmSorts(name: AlgorithmId, fn: (input: number[]) => Generator<import("./logic").SortStep>, extra?: (steps: number[]) => void) {
  describe(`sorting-visualizer ${name}`, () => {
    it("sorts ascending", () => {
      const steps = [...fn(UNSORTED)];
      const last = steps[steps.length - 1];
      expect(last.array).toEqual(SORTED_ASC);
    });
    it("produces at least one step", () => {
      const steps = [...fn(UNSORTED)];
      expect(steps.length).toBeGreaterThan(0);
    });
    it("handles empty input", () => {
      const steps = [...fn([])];
      expect(steps.length).toBeGreaterThan(0);
      expect(steps[steps.length - 1].array).toEqual([]);
    });
    it("handles single element", () => {
      const steps = [...fn([42])];
      const last = steps[steps.length - 1];
      expect(last.array).toEqual([42]);
    });
    it("handles already-sorted input", () => {
      const steps = [...fn([1, 2, 3, 4, 5])];
      const last = steps[steps.length - 1];
      expect(last.array).toEqual([1, 2, 3, 4, 5]);
    });
    it("handles duplicates", () => {
      const steps = [...fn([3, 1, 3, 1, 2])];
      const last = steps[steps.length - 1];
      expect(last.array).toEqual([1, 1, 2, 3, 3]);
    });
    it("counters are monotonic non-decreasing", () => {
      const steps = [...fn(UNSORTED)];
      for (let i = 1; i < steps.length; i++) {
        expect(steps[i].comparisons).toBeGreaterThanOrEqual(steps[i - 1].comparisons);
        expect(steps[i].swaps).toBeGreaterThanOrEqual(steps[i - 1].swaps);
        expect(steps[i].accesses).toBeGreaterThanOrEqual(steps[i - 1].accesses);
      }
    });
    if (extra) {
      it("extra checks", () => {
        const steps = [...fn(UNSORTED)];
        const counters = steps.map((s) => s.comparisons);
        extra(counters);
      });
    }
  });
}

expectAlgorithmSorts("bubble", bubbleSort);
expectAlgorithmSorts("cocktail", cocktailSort);
expectAlgorithmSorts("selection", selectionSort);
expectAlgorithmSorts("insertion", insertionSort);
expectAlgorithmSorts("shell", shellSort);
expectAlgorithmSorts("gnome", gnomeSort);
expectAlgorithmSorts("merge", mergeSort);
expectAlgorithmSorts("quick", quickSort);
expectAlgorithmSorts("heap", heapSort);

describe("sorting-visualizer countingSort", () => {
  it("sorts ascending", () => {
    const steps = [...countingSort([5, 3, 8, 1, 9, 2])];
    expect(steps[steps.length - 1].array).toEqual([1, 2, 3, 5, 8, 9]);
  });
  it("rejects negative input gracefully", () => {
    const steps = [...countingSort([1, -2, 3])];
    const last = steps[steps.length - 1];
    expect(last.description).toContain("Error");
  });
  it("handles empty", () => {
    const steps = [...countingSort([])];
    expect(steps[steps.length - 1].array).toEqual([]);
  });
});

describe("sorting-visualizer radixSort", () => {
  it("sorts ascending", () => {
    const steps = [...radixSort([170, 45, 75, 90, 802, 24, 2, 66])];
    expect(steps[steps.length - 1].array).toEqual([2, 24, 45, 66, 75, 90, 170, 802]);
  });
  it("rejects negative input gracefully", () => {
    const steps = [...radixSort([1, -2, 3])];
    const last = steps[steps.length - 1];
    expect(last.description).toContain("Error");
  });
  it("handles 0", () => {
    const steps = [...radixSort([0, 5, 0, 3])];
    expect(steps[steps.length - 1].array).toEqual([0, 0, 3, 5]);
  });
});

// ---- Bubble sort: specific step checks ----

describe("sorting-visualizer bubbleSort detailed", () => {
  it("emits compare and swap steps", () => {
    const steps = [...bubbleSort([3, 1, 2])];
    const types = steps.map((s) => s.type);
    expect(types).toContain("compare");
    expect(types).toContain("swap");
    expect(types).toContain("sorted");
  });
  it("early-exits on already-sorted input", () => {
    const steps = [...bubbleSort([1, 2, 3])];
    // Should be very few steps for sorted input.
    expect(steps.length).toBeLessThan(15);
    const last = steps[steps.length - 1];
    expect(last.array).toEqual([1, 2, 3]);
  });
});

// ---- Quick sort: pivot steps ----

describe("sorting-visualizer quickSort detailed", () => {
  it("emits pivot steps", () => {
    const steps = [...quickSort([3, 1, 4, 1, 5, 9, 2, 6])];
    const pivotSteps = steps.filter((s) => s.type === "pivot");
    expect(pivotSteps.length).toBeGreaterThan(0);
    for (const s of pivotSteps) {
      expect(s.pivot).not.toBeNull();
    }
  });
});

// ---- Heap sort: builds a heap ----

describe("sorting-visualizer heapSort detailed", () => {
  it("includes a 'max-heap built' info step", () => {
    const steps = [...heapSort([3, 1, 4, 1, 5, 9, 2, 6])];
    const infoSteps = steps.filter((s) => s.type === "info" && s.description.includes("Max-heap"));
    expect(infoSteps.length).toBeGreaterThan(0);
  });
});

// ---- runAlgorithm ----

describe("sorting-visualizer runAlgorithm", () => {
  it("runs bubble and returns correct totals", () => {
    const result = runAlgorithm("bubble", [3, 1, 2]);
    expect(result.steps.length).toBeGreaterThan(0);
    expect(result.sorted).toBe(true);
    expect(result.totalComparisons).toBeGreaterThan(0);
    expect(result.error).toBeUndefined();
  });
  it("returns error for unknown algorithm", () => {
    const result = runAlgorithm("bogus" as AlgorithmId, [1, 2]);
    expect(result.error).toBeDefined();
    expect(result.steps).toEqual([]);
  });
  it("handles empty input", () => {
    const result = runAlgorithm("quick", []);
    expect(result.sorted).toBe(true);
    expect(result.steps.length).toBeGreaterThan(0);
  });
  it("every algorithm sorts correctly via runAlgorithm", () => {
    const ids = Object.keys(ALGORITHMS) as AlgorithmId[];
    for (const id of ids) {
      const result = runAlgorithm(id, UNSORTED);
      expect(result.sorted).toBe(true);
      expect(result.steps[result.steps.length - 1].array).toEqual(SORTED_ASC);
    }
  });
});

// ---- race ----

describe("sorting-visualizer race", () => {
  it("runs multiple algorithms on same input", () => {
    const entries = race(["bubble", "quick", "merge"], [3, 1, 4, 1, 5, 9, 2, 6]);
    expect(entries).toHaveLength(3);
    for (const e of entries) {
      expect(e.result.sorted).toBe(true);
      expect(e.result.steps[e.result.steps.length - 1].array).toEqual([1, 1, 2, 3, 4, 5, 6, 9]);
    }
  });
  it("all race entries sort to the same final array", () => {
    const entries = race(["bubble", "selection", "insertion", "merge", "quick", "heap"], [5, 2, 8, 1, 9, 3]);
    const finals = entries.map((e) => JSON.stringify(e.result.steps[e.result.steps.length - 1].array));
    const unique = new Set(finals);
    expect(unique.size).toBe(1);
  });
});

// ---- Step helpers ----

describe("sorting-visualizer colorForIndex", () => {
  it("returns sorted for sorted indices", () => {
    const step = { array: [1, 2], active: [], sorted: [0, 1], pivot: null, type: "sorted" as const, comparisons: 0, swaps: 0, accesses: 0, description: "" };
    expect(colorForIndex(0, step)).toBe("sorted");
    expect(colorForIndex(1, step)).toBe("sorted");
  });
  it("returns pivot for pivot index", () => {
    const step = { array: [1, 2, 3], active: [], sorted: [], pivot: 1, type: "pivot" as const, comparisons: 0, swaps: 0, accesses: 0, description: "" };
    expect(colorForIndex(1, step)).toBe("pivot");
  });
  it("returns swap for active swap index", () => {
    const step = { array: [1, 2], active: [0, 1], sorted: [], pivot: null, type: "swap" as const, comparisons: 0, swaps: 0, accesses: 0, description: "" };
    expect(colorForIndex(0, step)).toBe("swap");
  });
  it("returns compare for active compare index", () => {
    const step = { array: [1, 2], active: [0, 1], sorted: [], pivot: null, type: "compare" as const, comparisons: 0, swaps: 0, accesses: 0, description: "" };
    expect(colorForIndex(0, step)).toBe("compare");
  });
  it("returns default for non-active non-sorted indices", () => {
    const step = { array: [1, 2, 3], active: [0], sorted: [], pivot: null, type: "highlight" as const, comparisons: 0, swaps: 0, accesses: 0, description: "" };
    expect(colorForIndex(2, step)).toBe("default");
  });
});

describe("sorting-visualizer formatStep", () => {
  it("formats a step with counters", () => {
    const step = { array: [1, 2], active: [], sorted: [0, 1], pivot: null, type: "sorted" as const, comparisons: 5, swaps: 3, accesses: 12, description: "Done" };
    const s = formatStep(step, 0, 10);
    expect(s).toContain("[1/10]");
    expect(s).toContain("Done");
    expect(s).toContain("cmp=5");
    expect(s).toContain("swap=3");
  });
});

describe("sorting-visualizer getAlgorithmInfo", () => {
  it("returns info for bubble", () => {
    const info = getAlgorithmInfo("bubble");
    expect(info.id).toBe("bubble");
    expect(info.name).toBe("Bubble Sort");
    expect(info.stable).toBe(true);
  });
  it("returns info for radix", () => {
    const info = getAlgorithmInfo("radix");
    expect(info.category).toBe("distribution");
  });
});

// ---- Reverse step fidelity ----

describe("sorting-visualizer reverse-step fidelity", () => {
  it("each step's array snapshot matches a re-run at the same index", () => {
    const steps = [...quickSort([5, 3, 8, 1, 9, 2])];
    // Re-run and verify each step's array is the snapshot at that index.
    const steps2 = [...quickSort([5, 3, 8, 1, 9, 2])];
    expect(steps.length).toBe(steps2.length);
    for (let i = 0; i < steps.length; i++) {
      expect(steps[i].array).toEqual(steps2[i].array);
    }
  });
  it("final step is sorted for every algorithm", () => {
    for (const id of Object.keys(ALGORITHMS) as AlgorithmId[]) {
      const steps = [...runAlgorithm(id, [5, 1, 4, 2, 3]).steps];
      expect(isSorted(steps[steps.length - 1].array)).toBe(true);
    }
  });
});

// ---- History ----

describe("sorting-visualizer history", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, algorithm: "bubble", array: [3, 1, 2], steps: 10, comparisons: 3, swaps: 2 });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, algorithm: "bubble", array: [i], steps: 1, comparisons: 0, swaps: 0 });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, algorithm: "bubble", array: [1], steps: 1, comparisons: 0, swaps: 0 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ---- Share URL ----

describe("sorting-visualizer share URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("quick", [3, 1, 2]);
    expect(url).toContain("alg=quick");
    expect(url).toContain("a=3%2C1%2C2");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("alg=quick&a=3%2C1%2C2");
    expect(p.algorithm).toBe("quick");
    expect(p.array).toEqual([3, 1, 2]);
  });
  it("defaults to bubble when missing", () => {
    const p = parseShareUrl("");
    expect(p.algorithm).toBe("bubble");
    expect(p.array).toEqual([]);
  });
  it("filters unknown algorithms", () => {
    const p = parseShareUrl("alg=bogus&a=1,2");
    expect(p.algorithm).toBe("bubble");
  });
  it("skips non-numeric array tokens", () => {
    const p = parseShareUrl("alg=bubble&a=1,foo,3");
    expect(p.array).toEqual([1, 3]);
  });
});

// Suppress unused-import lint
export type _Unused = AlgorithmId;
