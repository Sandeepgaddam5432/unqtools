import { describe, it, expect, beforeEach } from "vitest";
import {
  createHeap,
  cloneHeap,
  fromArray,
  parent,
  left,
  right,
  inOrder,
  violates,
  peek,
  size,
  height,
  isValid,
  computeStats,
  siftUpPure,
  siftDownPure,
  insertPure,
  extractPure,
  buildHeapPure,
  changePriorityPure,
  indexOf,
  heapsortPure,
  switchKind,
  layout,
  siftUpGen,
  siftDownGen,
  insertGen,
  extractGen,
  buildHeapGen,
  changePriorityGen,
  heapsortGen,
  runInsert,
  runExtract,
  runBuild,
  runChangePriority,
  runHeapsort,
  compareBuildVsInsert,
  parseValues,
  serializeHeap,
  deserializeHeap,
  nodeColorClass,
  formatStep,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  randomHeap,
  randomArray,
  sortedArray,
  reverseSortedArray,
  mulberry32,
  type HeapState,
  type HeapKind,
  type OpKind,
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

describe("heap index math", () => {
  it("parent(i) = floor((i-1)/2)", () => {
    expect(parent(1)).toBe(0);
    expect(parent(2)).toBe(0);
    expect(parent(3)).toBe(1);
    expect(parent(4)).toBe(1);
    expect(parent(5)).toBe(2);
    expect(parent(6)).toBe(2);
  });
  it("left(i) = 2i+1 and right(i) = 2i+2", () => {
    expect(left(0)).toBe(1);
    expect(right(0)).toBe(2);
    expect(left(1)).toBe(3);
    expect(right(1)).toBe(4);
    expect(left(2)).toBe(5);
    expect(right(2)).toBe(6);
  });
  it("inOrder and violates respect heap kind", () => {
    expect(inOrder(1, 5, "min")).toBe(true);
    expect(violates(5, 1, "min")).toBe(true);
    expect(inOrder(5, 1, "max")).toBe(true);
    expect(violates(1, 5, "max")).toBe(true);
  });
});

describe("heap construction", () => {
  it("createHeap is empty", () => {
    const h = createHeap("min");
    expect(h.arr).toEqual([]);
    expect(h.kind).toBe("min");
  });
  it("cloneHeap produces a deep copy", () => {
    const h = fromArray([3, 1, 2], "min");
    const c = cloneHeap(h);
    expect(c).not.toBe(h);
    expect(c.arr).not.toBe(h.arr);
    expect(c.arr).toEqual(h.arr);
    expect(c.kind).toBe(h.kind);
  });
  it("fromArray builds a valid min-heap", () => {
    const h = fromArray([9, 5, 2, 7, 1, 3], "min");
    expect(isValid(h)).toBe(true);
    expect(peek(h)).toBe(1);
  });
  it("fromArray builds a valid max-heap", () => {
    const h = fromArray([9, 5, 2, 7, 1, 3], "max");
    expect(isValid(h)).toBe(true);
    expect(peek(h)).toBe(9);
  });
  it("peek returns null on empty", () => {
    expect(peek(createHeap("min"))).toBeNull();
  });
  it("size and height are computed correctly", () => {
    const h = fromArray([5, 3, 8, 1, 2, 7, 9, 4], "min");
    expect(size(h)).toBe(8);
    // 8 nodes → depth 3 (floor(log2(7)) = 2... wait, log2(8)=3, floor=3)
    // For an 8-element array, last index is 7, depth = floor(log2(7+1)) = 3
    expect(height(h)).toBe(3);
  });
  it("height of empty heap is -1", () => {
    expect(height(createHeap("min"))).toBe(-1);
  });
  it("isValid detects a broken heap", () => {
    const h: HeapState = { arr: [5, 3, 8, 1], kind: "min" };
    // 5 > 3 → violates min-heap property at index 0/1
    expect(isValid(h)).toBe(false);
  });
});

describe("heap pure operations", () => {
  it("insertPure preserves heap property", () => {
    const h = createHeap("min");
    for (const v of [5, 3, 8, 1, 9, 2, 7]) insertPure(h, v);
    expect(isValid(h)).toBe(true);
    expect(peek(h)).toBe(1);
    expect(h.arr).toHaveLength(7);
  });
  it("extractPure returns root and preserves heap property", () => {
    const h = fromArray([5, 3, 8, 1, 9, 2, 7], "min");
    const root = extractPure(h);
    expect(root).toBe(1);
    expect(isValid(h)).toBe(true);
    expect(h.arr).toHaveLength(6);
    expect(peek(h)).toBe(2);
  });
  it("extractPure on empty returns null", () => {
    expect(extractPure(createHeap("min"))).toBeNull();
  });
  it("extractPure on single-element heap empties it", () => {
    const h = fromArray([42], "min");
    expect(extractPure(h)).toBe(42);
    expect(h.arr).toEqual([]);
  });
  it("buildHeapPure produces a valid heap from random input", () => {
    const h: HeapState = { arr: [9, 8, 7, 6, 5, 4, 3, 2, 1], kind: "min" };
    buildHeapPure(h);
    expect(isValid(h)).toBe(true);
    expect(peek(h)).toBe(1);
  });
  it("changePriorityPure decreases a key (min-heap → sift up)", () => {
    const h = fromArray([5, 10, 7, 15, 20], "min");
    const idx = indexOf(h, 20);
    expect(idx).toBeGreaterThanOrEqual(0);
    changePriorityPure(h, idx, 1);
    expect(isValid(h)).toBe(true);
    expect(peek(h)).toBe(1);
  });
  it("changePriorityPure increases a key (min-heap → sift down)", () => {
    const h = fromArray([1, 5, 3, 8, 9, 4], "min");
    const idx = indexOf(h, 1);
    changePriorityPure(h, idx, 100);
    expect(isValid(h)).toBe(true);
    expect(peek(h)).not.toBe(100);
  });
  it("switchKind rebuilds correctly", () => {
    const h = fromArray([1, 5, 3, 8, 9, 4], "min");
    expect(peek(h)).toBe(1);
    switchKind(h, "max");
    expect(h.kind).toBe("max");
    expect(isValid(h)).toBe(true);
    expect(peek(h)).toBe(9);
  });
  it("heapsortPure returns sorted array", () => {
    const h = fromArray([5, 3, 8, 1, 9, 2, 7], "min");
    const sorted = heapsortPure(h);
    // Min-heap extract gives ascending order
    expect(sorted).toEqual([1, 2, 3, 5, 7, 8, 9]);
  });
});

describe("heap layout", () => {
  it("layout returns nodes and edges", () => {
    const h = fromArray([1, 3, 2, 7, 4, 8, 5], "min");
    const l = layout(h);
    expect(l.nodes).toHaveLength(7);
    // For n=7, internal nodes 0,1,2 → 6 edges (n-1)
    expect(l.edges).toHaveLength(6);
    expect(l.depth).toBe(2);
  });
  it("layout handles empty heap", () => {
    const l = layout(createHeap("min"));
    expect(l.nodes).toEqual([]);
    expect(l.edges).toEqual([]);
    expect(l.depth).toBe(-1);
  });
  it("layout assigns increasing x in in-order", () => {
    const h = fromArray([1, 3, 2, 7, 4, 8, 5], "min");
    const l = layout(h);
    // In-order traversal: leftmost node has smallest x
    const xs = l.nodes.map((n) => n.x);
    for (let i = 1; i < xs.length; i++) {
      expect(xs[i]).toBeGreaterThan(xs[i - 1]);
    }
  });
});

describe("heap stepped operations", () => {
  it("siftUpGen yields compare + swap steps", () => {
    const h: HeapState = { arr: [1, 3, 2, 0], kind: "min" };
    // Insert 0 at index 3 → must sift up past 3 and 1
    const steps = [...siftUpGen(h, 3)];
    expect(steps.length).toBeGreaterThan(0);
    expect(steps.some((s) => s.kind === "compare")).toBe(true);
    expect(steps.some((s) => s.kind === "swap")).toBe(true);
    expect(h.arr[0]).toBe(0);
    expect(isValid(h)).toBe(true);
  });
  it("siftDownGen yields compare + swap steps", () => {
    const h: HeapState = { arr: [10, 1, 2, 3, 4, 5, 6], kind: "min" };
    // Root 10 violates → sifts down
    const steps = [...siftDownGen(h, 0)];
    expect(steps.length).toBeGreaterThan(0);
    expect(steps.some((s) => s.kind === "compare")).toBe(true);
    expect(steps.some((s) => s.kind === "swap")).toBe(true);
    expect(h.arr[0]).toBe(1);
    expect(isValid(h)).toBe(true);
  });
  it("insertGen yields an insert step then sift-up", () => {
    const h = fromArray([1, 3, 2, 7, 4, 8, 5], "min");
    const steps = [...insertGen(h, 0)];
    expect(steps[0].kind).toBe("insert");
    expect(steps[0].arr[7]).toBe(0);
    expect(isValid(h)).toBe(true);
    expect(peek(h)).toBe(0);
  });
  it("extractGen yields extract step and restores heap", () => {
    const h = fromArray([1, 3, 2, 7, 4, 8, 5], "min");
    const steps = [...extractGen(h)];
    expect(steps[0].kind).toBe("extract");
    expect(steps[0].active).toBe(0);
    expect(isValid(h)).toBe(true);
    expect(h.arr).toHaveLength(6);
  });
  it("extractGen on empty yields info", () => {
    const h = createHeap("min");
    const steps = [...extractGen(h)];
    expect(steps).toHaveLength(1);
    expect(steps[0].kind).toBe("info");
  });
  it("buildHeapGen yields steps and produces valid heap", () => {
    const h: HeapState = { arr: [9, 8, 7, 6, 5, 4, 3, 2, 1], kind: "min" };
    const steps = [...buildHeapGen(h)];
    expect(steps.length).toBeGreaterThan(0);
    expect(isValid(h)).toBe(true);
    expect(peek(h)).toBe(1);
  });
  it("changePriorityGen decreases a key with sift-up", () => {
    const h = fromArray([5, 10, 7, 15, 20], "min");
    const idx = indexOf(h, 20);
    const steps = [...changePriorityGen(h, idx, 1)];
    expect(steps[0].kind).toBe("insert");
    expect(isValid(h)).toBe(true);
    expect(peek(h)).toBe(1);
  });
  it("heapsortGen produces sorted array (descending for min-heap)", () => {
    const h: HeapState = { arr: [5, 3, 8, 1, 9, 2, 7], kind: "min" };
    const steps = [...heapsortGen(h)];
    expect(steps.length).toBeGreaterThan(0);
    // Min-heap heapsort places the smallest root at the END first → descending.
    // (Ascending output requires a max-heap; see the next test.)
    const last = steps[steps.length - 1];
    expect(last.kind).toBe("done");
    expect(last.arr).toEqual([9, 8, 7, 5, 3, 2, 1]);
  });
  it("heapsortGen produces ascending output for max-heap", () => {
    const h: HeapState = { arr: [5, 3, 8, 1, 9, 2, 7], kind: "max" };
    const steps = [...heapsortGen(h)];
    const last = steps[steps.length - 1];
    expect(last.kind).toBe("done");
    expect(last.arr).toEqual([1, 2, 3, 5, 7, 8, 9]);
  });
  it("heapsortGen on single element is trivially sorted", () => {
    const h: HeapState = { arr: [42], kind: "min" };
    const steps = [...heapsortGen(h)];
    expect(steps).toHaveLength(1);
    expect(steps[0].kind).toBe("done");
  });
});

describe("heap run dispatchers", () => {
  it("runInsert returns steps and final state", () => {
    const h = fromArray([1, 3, 2], "min");
    const r = runInsert(h, 0);
    expect(r.kind).toBe("insert");
    expect(r.ok).toBe(true);
    expect(r.steps.length).toBeGreaterThan(0);
    // The result's last step's array should have 4 elements with 0 at root
    const last = r.steps[r.steps.length - 1];
    expect(last.arr).toHaveLength(4);
    expect(last.arr[0]).toBe(0);
  });
  it("runExtract on empty returns ok=false", () => {
    const r = runExtract(createHeap("min"));
    expect(r.ok).toBe(false);
    expect(r.extracted).toBeNull();
    expect(r.steps).toEqual([]);
  });
  it("runExtract returns the root value", () => {
    const h = fromArray([1, 3, 2, 7], "min");
    const r = runExtract(h);
    expect(r.ok).toBe(true);
    expect(r.extracted).toBe(1);
    expect(r.steps.length).toBeGreaterThan(0);
  });
  it("runBuild produces valid heap", () => {
    const h: HeapState = { arr: [9, 8, 7, 6, 5, 4, 3, 2, 1], kind: "min" };
    const r = runBuild(h);
    expect(r.ok).toBe(true);
    const last = r.steps[r.steps.length - 1];
    expect(last.arr[0]).toBe(1);
  });
  it("runChangePriority with out-of-bounds index returns ok=false", () => {
    const h = fromArray([1, 3, 2], "min");
    const r = runChangePriority(h, 99, 0);
    expect(r.ok).toBe(false);
  });
  it("runHeapsort returns the sorted array in the last step (descending for min-heap)", () => {
    const h: HeapState = { arr: [5, 3, 8, 1, 9, 2, 7], kind: "min" };
    const r = runHeapsort(h);
    expect(r.ok).toBe(true);
    const last = r.steps[r.steps.length - 1];
    // Min-heap → root (smallest) swaps to end each iteration → descending.
    expect(last.arr).toEqual([9, 8, 7, 5, 3, 2, 1]);
  });
});

describe("heap build-vs-insert comparison", () => {
  it("build uses fewer or equal comparisons than n inserts", () => {
    const values = [9, 8, 7, 6, 5, 4, 3, 2, 1];
    const cmp = compareBuildVsInsert(values, "min");
    expect(cmp.buildComparisons).toBeLessThanOrEqual(cmp.insertComparisons);
    // Build is O(n) and should generally be much cheaper
    expect(cmp.buildComparisons).toBeLessThan(cmp.insertComparisons);
  });
  it("both methods produce valid heaps", () => {
    const values = [5, 3, 8, 1, 9, 2, 7];
    const cmp = compareBuildVsInsert(values, "min");
    const buildLast = cmp.buildSteps.steps[cmp.buildSteps.steps.length - 1];
    const insertLast = cmp.insertSteps.steps[cmp.insertSteps.steps.length - 1];
    // Re-verify by building the heap-state objects
    const buildH: HeapState = { arr: [...buildLast.arr], kind: "min" };
    const insertH: HeapState = { arr: [...insertLast.arr], kind: "min" };
    expect(isValid(buildH)).toBe(true);
    expect(isValid(insertH)).toBe(true);
  });
});

describe("heap parsing", () => {
  it("parseValues splits and validates", () => {
    const r = parseValues("5 3 8 foo 1 -2");
    expect(r.ok).toEqual([5, 3, 8, 1, -2]);
    expect(r.skipped).toEqual(["foo"]);
  });
  it("parseValues handles empty input", () => {
    const r = parseValues("");
    expect(r.ok).toEqual([]);
    expect(r.skipped).toEqual([]);
  });
});

describe("heap serialization", () => {
  it("serializeHeap encodes kind and array", () => {
    const h = fromArray([1, 3, 2], "min");
    const s = serializeHeap(h);
    expect(s.startsWith("min:")).toBe(true);
    expect(s).toContain("1");
    expect(s).toContain("3");
  });
  it("deserializeHeap round-trips", () => {
    const h = fromArray([5, 3, 8, 1, 9, 2, 7], "min");
    const s = serializeHeap(h);
    const back = deserializeHeap(s);
    expect(back).not.toBeNull();
    expect(back!.kind).toBe("min");
    expect(back!.arr).toEqual(h.arr);
  });
  it("deserializeHeap returns null for invalid input", () => {
    expect(deserializeHeap("notvalid")).toBeNull();
  });
  it("deserializeHeap of empty returns empty min heap", () => {
    const back = deserializeHeap("");
    expect(back).not.toBeNull();
    expect(back!.arr).toEqual([]);
  });
});

describe("heap step helpers", () => {
  it("nodeColorClass marks sorted suffix", () => {
    const step = {
      arr: [1, 2, 3], heapSize: 1, active: 0, parent: null, child: null,
      swapped: [], sortedSuffix: [2, 1], path: [], description: "",
      kind: "sorted" as const, comparisons: 0, swaps: 0,
    };
    expect(nodeColorClass(1, step)).toBe("sorted");
    expect(nodeColorClass(2, step)).toBe("sorted");
    expect(nodeColorClass(0, step)).not.toBe("sorted");
  });
  it("nodeColorClass marks active swap node", () => {
    const step = {
      arr: [1, 2], heapSize: 2, active: 0, parent: 0, child: 1,
      swapped: [[0, 1]] as [number, number][], sortedSuffix: [], path: [0, 1],
      description: "", kind: "swap" as const, comparisons: 1, swaps: 1,
    };
    expect(nodeColorClass(0, step)).toBe("swap");
  });
  it("formatStep includes step index and counts", () => {
    const step = {
      arr: [1], heapSize: 1, active: 0, parent: null, child: null,
      swapped: [], sortedSuffix: [], path: [], description: "Test step.",
      kind: "info" as const, comparisons: 3, swaps: 1,
    };
    const s = formatStep(step, 2, 10);
    expect(s).toContain("[3/10]");
    expect(s).toContain("Test step.");
    expect(s).toContain("cmp=3");
    expect(s).toContain("swap=1");
  });
});

describe("heap history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, op: "insert", value: 5, size: 5, comparisons: 3, swaps: 1, ok: true });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20 entries", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, op: "insert", size: 1, comparisons: 0, swaps: 0, ok: true });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, op: "insert", size: 1, comparisons: 0, swaps: 0, ok: true });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("heap shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const h = fromArray([1, 3, 2], "min");
    const url = buildShareUrl(h);
    expect(url).toContain("h=min%3A");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const h = fromArray([5, 3, 8, 1, 9, 2, 7], "min");
    const url = buildShareUrl(h);
    // In a node test env, window is undefined → URL is `?h=...` (no #).
    // Extract either the hash fragment or the query string.
    const hash = url.includes("#") ? url.slice(url.indexOf("#")) : url.includes("?") ? url.slice(url.indexOf("?")) : "";
    const p = parseShareUrl(hash);
    expect(p).not.toBeNull();
    const back = deserializeHeap(p!.heap);
    expect(back).not.toBeNull();
    expect(back!.kind).toBe("min");
    expect(back!.arr).toEqual(h.arr);
  });
  it("returns null for empty hash", () => {
    expect(parseShareUrl("")).toBeNull();
  });
  it("returns null when no 'h' param", () => {
    expect(parseShareUrl("foo=bar")).toBeNull();
  });
});

describe("heap presets", () => {
  it("randomHeap produces a valid heap of given size", () => {
    const h = randomHeap(10, 42, "min");
    expect(isValid(h)).toBe(true);
    expect(size(h)).toBe(10);
  });
  it("randomArray produces distinct values", () => {
    const arr = randomArray(15, 7);
    expect(new Set(arr).size).toBe(15);
  });
  it("sortedArray is ascending", () => {
    const arr = sortedArray(5);
    for (let i = 1; i < arr.length; i++) {
      expect(arr[i]).toBeGreaterThan(arr[i - 1]);
    }
  });
  it("reverseSortedArray is descending", () => {
    const arr = reverseSortedArray(5);
    for (let i = 1; i < arr.length; i++) {
      expect(arr[i]).toBeLessThan(arr[i - 1]);
    }
  });
  it("mulberry32 is deterministic for a given seed", () => {
    const a = mulberry32(123);
    const b = mulberry32(123);
    expect(a()).toBe(b());
    expect(a()).toBe(b());
  });
});

// Suppress unused-import lint
export type _Unused = HeapKind | OpKind;
