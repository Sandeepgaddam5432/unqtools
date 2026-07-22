/**
 * Heap & Priority Queue Visualizer — pure logic.
 *
 * Array-backed binary heap (min or max) with a generator-based step
 * engine that yields a Step on every comparison or swap. Each step
 * carries a full array snapshot, the active indices (parent / child),
 * the comparison direction, and a human-readable description — so the
 * UI can step forward and backward without re-running. Pure functions
 * only — no DOM, no network.
 *
 * Key invariants (0-indexed):
 *   parent(i) = (i - 1) >> 1     // floor((i-1)/2)
 *   left(i)   = 2 * i + 1
 *   right(i)  = 2 * i + 2
 * Heap property:
 *   min-heap:  a[parent(i)] <= a[i]   for all i > 0
 *   max-heap:  a[parent(i)] >= a[i]   for all i > 0
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type HeapKind = "min" | "max";

export type OpKind =
  | "insert"
  | "extract"
  | "build"
  | "change-priority"
  | "heapsort"
  | "peek"
  | "clear";

export type StepKind =
  | "compare"
  | "swap"
  | "insert"
  | "extract"
  | "info"
  | "sorted"
  | "done"
  | "visit";

export interface Step {
  /** Array snapshot at this moment (post any swap). */
  arr: number[];
  /** Heap size (active region) at this moment — used by heapsort to mark sorted suffix. */
  heapSize: number;
  /** Index of the active node currently being compared / moved. */
  active: number | null;
  /** Index of the parent node (for sift-up/down highlighting). */
  parent: number | null;
  /** Index of the child node (for sift-down highlighting). */
  child: number | null;
  /** Indices that have been swapped so far in this operation. */
  swapped: [number, number][];
  /** Indices that are part of the sorted suffix (heapsort). */
  sortedSuffix: number[];
  /** Visited / traversed indices (path). */
  path: number[];
  /** Human-readable description. */
  description: string;
  /** Step kind. */
  kind: StepKind;
  /** Cumulative comparison count. */
  comparisons: number;
  /** Cumulative swap count. */
  swaps: number;
}

export interface OpResult {
  kind: OpKind;
  steps: Step[];
  totalComparisons: number;
  totalSwaps: number;
  /** Value extracted (for extract) or null. */
  extracted: number | null;
  /** Whether the operation succeeded. */
  ok: boolean;
  /** Optional message. */
  message?: string;
}

export interface HeapStats {
  size: number;
  height: number;
  isValid: boolean;
  kind: HeapKind;
}

export interface HeapState {
  arr: number[];
  kind: HeapKind;
}

// ---------------------------------------------------------------------------
// Core helpers
// ---------------------------------------------------------------------------

export function parent(i: number): number {
  return (i - 1) >> 1;
}

export function left(i: number): number {
  return 2 * i + 1;
}

export function right(i: number): number {
  return 2 * i + 2;
}

/** Returns true if a is in correct order relative to b given the heap kind. */
export function inOrder(a: number, b: number, kind: HeapKind): boolean {
  return kind === "min" ? a <= b : a >= b;
}

/** Returns true if a should be above b (i.e., a violates heap property if a > b in min-heap). */
export function violates(a: number, b: number, kind: HeapKind): boolean {
  return kind === "min" ? a > b : a < b;
}

export function createHeap(kind: HeapKind = "min"): HeapState {
  return { arr: [], kind };
}

export function cloneHeap(h: HeapState): HeapState {
  return { arr: [...h.arr], kind: h.kind };
}

/** Peek at the root (highest priority). Returns null if empty. */
export function peek(h: HeapState): number | null {
  return h.arr.length > 0 ? h.arr[0] : null;
}

export function size(h: HeapState): number {
  return h.arr.length;
}

export function height(h: HeapState): number {
  const n = h.arr.length;
  if (n === 0) return -1;
  return Math.floor(Math.log2(n));
}

/** Validate the heap property over the full array. */
export function isValid(h: HeapState): boolean {
  for (let i = 1; i < h.arr.length; i++) {
    const p = parent(i);
    if (violates(h.arr[p], h.arr[i], h.kind)) return false;
  }
  return true;
}

export function computeStats(h: HeapState): HeapStats {
  return {
    size: h.arr.length,
    height: height(h),
    isValid: isValid(h),
    kind: h.kind,
  };
}

// ---------------------------------------------------------------------------
// Pure (non-stepped) operations
// ---------------------------------------------------------------------------

/** Sift up index i (no steps). Returns final index. */
export function siftUpPure(h: HeapState, i: number): number {
  while (i > 0) {
    const p = parent(i);
    if (violates(h.arr[p], h.arr[i], h.kind)) {
      [h.arr[p], h.arr[i]] = [h.arr[i], h.arr[p]];
      i = p;
    } else break;
  }
  return i;
}

/** Sift down index i within heapSize (no steps). Returns final index. */
export function siftDownPure(h: HeapState, i: number, heapSize: number = h.arr.length): number {
  while (true) {
    const l = left(i);
    const r = right(i);
    let best = i;
    if (l < heapSize && violates(h.arr[best], h.arr[l], h.kind)) best = l;
    if (r < heapSize && violates(h.arr[best], h.arr[r], h.kind)) best = r;
    if (best === i) break;
    [h.arr[best], h.arr[i]] = [h.arr[i], h.arr[best]];
    i = best;
  }
  return i;
}

/** Insert a value (no steps). Returns true. */
export function insertPure(h: HeapState, value: number): boolean {
  h.arr.push(value);
  siftUpPure(h, h.arr.length - 1);
  return true;
}

/** Extract the root (no steps). Returns the value or null if empty. */
export function extractPure(h: HeapState): number | null {
  if (h.arr.length === 0) return null;
  const root = h.arr[0];
  const last = h.arr.pop()!;
  if (h.arr.length > 0) {
    h.arr[0] = last;
    siftDownPure(h, 0);
  }
  return root;
}

/** Build-heap in O(n) using Floyd's bottom-up sift-down. Mutates h. */
export function buildHeapPure(h: HeapState): void {
  // Start at last internal node = parent(last index)
  for (let i = parent(h.arr.length - 1); i >= 0; i--) {
    siftDownPure(h, i);
  }
}

/** Change the priority of the element at index i. Mutates h. */
export function changePriorityPure(h: HeapState, i: number, newValue: number): void {
  if (i < 0 || i >= h.arr.length) return;
  const old = h.arr[i];
  h.arr[i] = newValue;
  // For min-heap: if newValue > old (worse), sift DOWN; if < old (better), sift UP.
  // For max-heap: if newValue < old (worse), sift DOWN; if > old (better), sift UP.
  // violates(a, b, kind) means "a above b violates heap" → for min-heap, a > b.
  // So violates(newValue, old, min-heap) = newValue > old = "newValue is worse" → sift down.
  if (violates(newValue, old, h.kind)) {
    siftDownPure(h, i);
  } else if (newValue !== old) {
    siftUpPure(h, i);
  }
}

/** Find the first index of a value (linear scan). Returns -1 if not found. */
export function indexOf(h: HeapState, value: number): number {
  return h.arr.indexOf(value);
}

/** Heapsort (no steps). Returns sorted array (ascending for max-heap, descending for min-heap). */
export function heapsortPure(h: HeapState): number[] {
  const sorted: number[] = [];
  const copy = cloneHeap(h);
  while (copy.arr.length > 0) {
    sorted.push(extractPure(copy)!);
  }
  return sorted;
}

/** Build a heap from an array of values, choosing the kind. */
export function fromArray(values: number[], kind: HeapKind = "min"): HeapState {
  const h = createHeap(kind);
  h.arr = [...values];
  buildHeapPure(h);
  return h;
}

/** Switch heap kind and rebuild. Mutates h. */
export function switchKind(h: HeapState, kind: HeapKind): void {
  h.kind = kind;
  buildHeapPure(h);
}

// ---------------------------------------------------------------------------
// Tree layout (for SVG rendering)
// ---------------------------------------------------------------------------

export interface PositionedNode {
  value: number;
  index: number;
  x: number;
  y: number;
  depth: number;
}

export interface TreeEdge {
  from: number; // index
  to: number;   // index
}

export interface TreeLayout {
  nodes: PositionedNode[];
  edges: TreeEdge[];
  width: number;
  height: number;
  depth: number;
}

/** Layout the heap as a binary tree. Returns nodes (with x/y coords) and edges. */
export function layout(h: HeapState): TreeLayout {
  const nodes: PositionedNode[] = [];
  const edges: TreeEdge[] = [];
  const n = h.arr.length;
  if (n === 0) return { nodes, edges, width: 0, height: 0, depth: -1 };
  const depth = height(h);
  // Use in-order x assignment so subtrees don't overlap.
  let nextX = 0;
  const walk = (i: number, d: number) => {
    if (i >= n) return;
    walk(left(i), d + 1);
    nodes.push({ value: h.arr[i], index: i, x: nextX, y: d, depth: d });
    nextX += 1;
    if (parent(i) >= 0 && i > 0) edges.push({ from: parent(i), to: i });
    walk(right(i), d + 1);
  };
  walk(0, 0);
  return { nodes, edges, width: nextX, height: depth + 1, depth };
}

// ---------------------------------------------------------------------------
// Stepped operations (generators)
// ---------------------------------------------------------------------------

/** Sift up index i, yielding steps. */
export function* siftUpGen(h: HeapState, start: number): Generator<Step> {
  let i = start;
  let comparisons = 0;
  let swaps = 0;
  const path: number[] = [i];
  while (i > 0) {
    const p = parent(i);
    comparisons++;
    yield {
      arr: [...h.arr],
      heapSize: h.arr.length,
      active: i,
      parent: p,
      child: i,
      swapped: [],
      sortedSuffix: [],
      path: [...path],
      description: `Compare a[${i}]=${h.arr[i]} with parent a[${p}]=${h.arr[p]} (${h.kind === "min" ? "min-heap: parent must be ≤ child" : "max-heap: parent must be ≥ child"}).`,
      kind: "compare",
      comparisons,
      swaps,
    };
    if (violates(h.arr[p], h.arr[i], h.kind)) {
      [h.arr[p], h.arr[i]] = [h.arr[i], h.arr[p]];
      swaps++;
      yield {
        arr: [...h.arr],
        heapSize: h.arr.length,
        active: p,
        parent: p,
        child: i,
        swapped: [[p, i]],
        sortedSuffix: [],
        path: [...path],
        description: `Swap a[${p}] ↔ a[${i}] (sift-up).`,
        kind: "swap",
        comparisons,
        swaps,
      };
      i = p;
      path.push(i);
    } else {
      yield {
        arr: [...h.arr],
        heapSize: h.arr.length,
        active: i,
        parent: p,
        child: i,
        swapped: [],
        sortedSuffix: [],
        path: [...path],
        description: `Heap property holds at index ${i} — stop sift-up.`,
        kind: "info",
        comparisons,
        swaps,
      };
      return;
    }
  }
  yield {
    arr: [...h.arr],
    heapSize: h.arr.length,
    active: i,
    parent: null,
    child: null,
    swapped: [],
    sortedSuffix: [],
    path: [...path],
    description: `Reached root — sift-up complete.`,
    kind: "done",
    comparisons,
    swaps,
  };
}

/** Sift down index i (within heapSize), yielding steps. */
export function* siftDownGen(h: HeapState, start: number, heapSize: number = h.arr.length): Generator<Step> {
  let i = start;
  let comparisons = 0;
  let swaps = 0;
  const path: number[] = [i];
  while (true) {
    const l = left(i);
    const r = right(i);
    let best = i;
    if (l < heapSize) {
      comparisons++;
      yield {
        arr: [...h.arr],
        heapSize,
        active: i,
        parent: i,
        child: l,
        swapped: [],
        sortedSuffix: [],
        path: [...path],
        description: `Compare a[${i}]=${h.arr[i]} with left child a[${l}]=${h.arr[l]}.`,
        kind: "compare",
        comparisons,
        swaps,
      };
      if (violates(h.arr[best], h.arr[l], h.kind)) best = l;
    }
    if (r < heapSize) {
      comparisons++;
      yield {
        arr: [...h.arr],
        heapSize,
        active: best,
        parent: i,
        child: r,
        swapped: [],
        sortedSuffix: [],
        path: [...path],
        description: `Compare a[${best}]=${h.arr[best]} with right child a[${r}]=${h.arr[r]}.`,
        kind: "compare",
        comparisons,
        swaps,
      };
      if (violates(h.arr[best], h.arr[r], h.kind)) best = r;
    }
    if (best === i) {
      yield {
        arr: [...h.arr],
        heapSize,
        active: i,
        parent: i,
        child: null,
        swapped: [],
        sortedSuffix: [],
        path: [...path],
        description: `a[${i}] is already the ${h.kind === "min" ? "smallest" : "largest"} among parent+children — stop sift-down.`,
        kind: "info",
        comparisons,
        swaps,
      };
      return;
    }
    [h.arr[best], h.arr[i]] = [h.arr[i], h.arr[best]];
    swaps++;
    yield {
      arr: [...h.arr],
      heapSize,
      active: best,
      parent: i,
      child: best,
      swapped: [[i, best]],
      sortedSuffix: [],
      path: [...path],
      description: `Swap a[${i}] ↔ a[${best}] (sift-down).`,
      kind: "swap",
      comparisons,
      swaps,
    };
    i = best;
    path.push(i);
  }
}

/** Insert with steps. */
export function* insertGen(h: HeapState, value: number): Generator<Step> {
  h.arr.push(value);
  const idx = h.arr.length - 1;
  yield {
    arr: [...h.arr],
    heapSize: h.arr.length,
    active: idx,
    parent: null,
    child: null,
    swapped: [],
    sortedSuffix: [],
    path: [idx],
    description: `Append ${value} at index ${idx} (end of array). Now sift up.`,
    kind: "insert",
    comparisons: 0,
    swaps: 0,
  };
  yield* siftUpGen(h, idx);
}

/** Extract with steps. */
export function* extractGen(h: HeapState): Generator<Step> {
  if (h.arr.length === 0) {
    yield {
      arr: [],
      heapSize: 0,
      active: null,
      parent: null,
      child: null,
      swapped: [],
      sortedSuffix: [],
      path: [],
      description: `Heap is empty — nothing to extract.`,
      kind: "info",
      comparisons: 0,
      swaps: 0,
    };
    return;
  }
  const root = h.arr[0];
  yield {
    arr: [...h.arr],
    heapSize: h.arr.length,
    active: 0,
    parent: null,
    child: null,
    swapped: [],
    sortedSuffix: [],
    path: [0],
    description: `Extract root a[0]=${root} (highest priority in ${h.kind}-heap).`,
    kind: "extract",
    comparisons: 0,
    swaps: 0,
  };
  const last = h.arr.pop()!;
  if (h.arr.length === 0) {
    yield {
      arr: [],
      heapSize: 0,
      active: null,
      parent: null,
      child: null,
      swapped: [],
      sortedSuffix: [],
      path: [],
      description: `Heap had only one element — extracted ${root}, heap is now empty.`,
      kind: "done",
      comparisons: 0,
      swaps: 0,
    };
    return;
  }
  h.arr[0] = last;
  yield {
    arr: [...h.arr],
    heapSize: h.arr.length,
    active: 0,
    parent: null,
    child: null,
    swapped: [[0, h.arr.length]],
    sortedSuffix: [],
    path: [0],
    description: `Move last element ${last} to root (index 0). Now sift down.`,
    kind: "swap",
    comparisons: 0,
    swaps: 1,
  };
  yield* siftDownGen(h, 0);
  yield {
    arr: [...h.arr],
    heapSize: h.arr.length,
    active: null,
    parent: null,
    child: null,
    swapped: [],
    sortedSuffix: [],
    path: [],
    description: `Extracted ${root}. Heap property restored.`,
    kind: "done",
    comparisons: 0,
    swaps: 0,
  };
}

/** Build-heap (Floyd) with steps. */
export function* buildHeapGen(h: HeapState): Generator<Step> {
  const n = h.arr.length;
  let comparisons = 0;
  let swaps = 0;
  if (n <= 1) {
    yield {
      arr: [...h.arr],
      heapSize: n,
      active: null,
      parent: null,
      child: null,
      swapped: [],
      sortedSuffix: [],
      path: [],
      description: `Array has ≤ 1 element — already a heap.`,
      kind: "done",
      comparisons: 0,
      swaps: 0,
    };
    return;
  }
  yield {
    arr: [...h.arr],
    heapSize: n,
    active: null,
    parent: null,
    child: null,
    swapped: [],
    sortedSuffix: [],
    path: [],
    description: `Build-heap (Floyd): sift down every internal node from index ${parent(n - 1)} down to 0.`,
    kind: "info",
    comparisons: 0,
    swaps: 0,
  };
  for (let i = parent(n - 1); i >= 0; i--) {
    yield {
      arr: [...h.arr],
      heapSize: n,
      active: i,
      parent: null,
      child: null,
      swapped: [],
      sortedSuffix: [],
      path: [i],
      description: `Sift down a[${i}]=${h.arr[i]}.`,
      kind: "visit",
      comparisons,
      swaps,
    };
    // The inner generator resets its own counts each call (1, 2, 3...).
    // We offset each yielded step by the running total so the displayed
    // counts are cumulative across all internal nodes processed so far.
    let lastInnerCmp = 0;
    let lastInnerSwap = 0;
    for (const s of siftDownGen(h, i, n)) {
      // s.comparisons is cumulative within this single sift-down call;
      // convert to the delta from the previous step in this call.
      const deltaCmp = s.comparisons - lastInnerCmp;
      const deltaSwap = s.swaps - lastInnerSwap;
      lastInnerCmp = s.comparisons;
      lastInnerSwap = s.swaps;
      comparisons += deltaCmp;
      swaps += deltaSwap;
      yield { ...s, comparisons, swaps };
    }
  }
  yield {
    arr: [...h.arr],
    heapSize: n,
    active: null,
    parent: null,
    child: null,
    swapped: [],
    sortedSuffix: [],
    path: [],
    description: `Build-heap complete in O(n) — heap property holds across all internal nodes.`,
    kind: "done",
    comparisons,
    swaps,
  };
}

/** Change priority of index i to newValue, with steps. */
export function* changePriorityGen(h: HeapState, i: number, newValue: number): Generator<Step> {
  if (i < 0 || i >= h.arr.length) {
    yield {
      arr: [...h.arr],
      heapSize: h.arr.length,
      active: null,
      parent: null,
      child: null,
      swapped: [],
      sortedSuffix: [],
      path: [],
      description: `Index ${i} is out of bounds.`,
      kind: "info",
      comparisons: 0,
      swaps: 0,
    };
    return;
  }
  const old = h.arr[i];
  h.arr[i] = newValue;
  yield {
    arr: [...h.arr],
    heapSize: h.arr.length,
    active: i,
    parent: null,
    child: null,
    swapped: [],
    sortedSuffix: [],
    path: [i],
    description: `Change a[${i}] from ${old} → ${newValue}.`,
    kind: "insert",
    comparisons: 0,
    swaps: 0,
  };
  // For min-heap: newValue > old → worse → sift down; newValue < old → better → sift up.
  // For max-heap: opposite. violates(newValue, old, kind) is true when newValue is "worse".
  if (violates(newValue, old, h.kind)) {
    yield* siftDownGen(h, i);
  } else if (old !== newValue) {
    yield* siftUpGen(h, i);
  } else {
    yield {
      arr: [...h.arr],
      heapSize: h.arr.length,
      active: i,
      parent: null,
      child: null,
      swapped: [],
      sortedSuffix: [],
      path: [i],
      description: `New value equals old — no sifting needed.`,
      kind: "info",
      comparisons: 0,
      swaps: 0,
    };
  }
}

/** Heapsort with steps. */
export function* heapsortGen(h: HeapState): Generator<Step> {
  const n = h.arr.length;
  let comparisons = 0;
  let swaps = 0;
  if (n <= 1) {
    yield {
      arr: [...h.arr],
      heapSize: n,
      active: null,
      parent: null,
      child: null,
      swapped: [],
      sortedSuffix: n === 1 ? [0] : [],
      path: [],
      description: `Array has ≤ 1 element — already sorted.`,
      kind: "done",
      comparisons: 0,
      swaps: 0,
    };
    return;
  }
  yield {
    arr: [...h.arr],
    heapSize: n,
    active: null,
    parent: null,
    child: null,
    swapped: [],
    sortedSuffix: [],
    path: [],
    description: `Heapsort phase 1: build a ${h.kind}-heap.`,
    kind: "info",
    comparisons: 0,
    swaps: 0,
  };
  {
    let lastInnerCmp = 0;
    let lastInnerSwap = 0;
    for (const s of buildHeapGen(h)) {
      const deltaCmp = s.comparisons - lastInnerCmp;
      const deltaSwap = s.swaps - lastInnerSwap;
      lastInnerCmp = s.comparisons;
      lastInnerSwap = s.swaps;
      comparisons += deltaCmp;
      swaps += deltaSwap;
      yield { ...s, comparisons, swaps };
    }
  }
  yield {
    arr: [...h.arr],
    heapSize: n,
    active: null,
    parent: null,
    child: null,
    swapped: [],
    sortedSuffix: [],
    path: [],
    description: `Heapsort phase 2: repeatedly swap root with last unsorted index, shrink heap, sift down.`,
    kind: "info",
    comparisons,
    swaps,
  };
  const sortedSuffix: number[] = [];
  for (let end = n - 1; end > 0; end--) {
    [h.arr[0], h.arr[end]] = [h.arr[end], h.arr[0]];
    swaps++;
    sortedSuffix.push(end);
    yield {
      arr: [...h.arr],
      heapSize: end,
      active: end,
      parent: null,
      child: null,
      swapped: [[0, end]],
      sortedSuffix: [...sortedSuffix],
      path: [0, end],
      description: `Swap root a[0] with a[${end}] — fix ${h.arr[end]} at sorted position ${end}.`,
      kind: "sorted",
      comparisons,
      swaps,
    };
    let lastInnerCmp = 0;
    let lastInnerSwap = 0;
    for (const s of siftDownGen(h, 0, end)) {
      const deltaCmp = s.comparisons - lastInnerCmp;
      const deltaSwap = s.swaps - lastInnerSwap;
      lastInnerCmp = s.comparisons;
      lastInnerSwap = s.swaps;
      comparisons += deltaCmp;
      swaps += deltaSwap;
      yield { ...s, sortedSuffix: [...sortedSuffix], comparisons, swaps };
    }
  }
  sortedSuffix.push(0);
  yield {
    arr: [...h.arr],
    heapSize: 0,
    active: null,
    parent: null,
    child: null,
    swapped: [],
    sortedSuffix: [...sortedSuffix],
    path: [],
    description: `Heapsort complete — array is now sorted (${h.kind === "max" ? "ascending (max-heap root → end)" : "descending (min-heap root → end)"}).`,
    kind: "done",
    comparisons,
    swaps,
  };
}

// ---------------------------------------------------------------------------
// Run dispatchers
// ---------------------------------------------------------------------------

function collect(gen: Generator<Step>): Step[] {
  const out: Step[] = [];
  for (const s of gen) out.push(s);
  return out;
}

export function runInsert(h: HeapState, value: number): OpResult {
  const work = cloneHeap(h);
  const steps = collect(insertGen(work, value));
  const last = steps[steps.length - 1];
  return {
    kind: "insert",
    steps,
    totalComparisons: last?.comparisons ?? 0,
    totalSwaps: last?.swaps ?? 0,
    extracted: null,
    ok: true,
  };
}

export function runExtract(h: HeapState): OpResult {
  if (h.arr.length === 0) {
    return {
      kind: "extract",
      steps: [],
      totalComparisons: 0,
      totalSwaps: 0,
      extracted: null,
      ok: false,
      message: "Heap is empty",
    };
  }
  const work = cloneHeap(h);
  const root = work.arr[0];
  const steps = collect(extractGen(work));
  const last = steps[steps.length - 1];
  return {
    kind: "extract",
    steps,
    totalComparisons: last?.comparisons ?? 0,
    totalSwaps: last?.swaps ?? 0,
    extracted: root,
    ok: true,
  };
}

export function runBuild(h: HeapState): OpResult {
  const work = cloneHeap(h);
  const steps = collect(buildHeapGen(work));
  const last = steps[steps.length - 1];
  return {
    kind: "build",
    steps,
    totalComparisons: last?.comparisons ?? 0,
    totalSwaps: last?.swaps ?? 0,
    extracted: null,
    ok: true,
  };
}

export function runChangePriority(h: HeapState, i: number, newValue: number): OpResult {
  if (i < 0 || i >= h.arr.length) {
    return {
      kind: "change-priority",
      steps: [],
      totalComparisons: 0,
      totalSwaps: 0,
      extracted: null,
      ok: false,
      message: "Index out of bounds",
    };
  }
  const work = cloneHeap(h);
  const steps = collect(changePriorityGen(work, i, newValue));
  const last = steps[steps.length - 1];
  return {
    kind: "change-priority",
    steps,
    totalComparisons: last?.comparisons ?? 0,
    totalSwaps: last?.swaps ?? 0,
    extracted: null,
    ok: true,
  };
}

export function runHeapsort(h: HeapState): OpResult {
  const work = cloneHeap(h);
  const steps = collect(heapsortGen(work));
  const last = steps[steps.length - 1];
  return {
    kind: "heapsort",
    steps,
    totalComparisons: last?.comparisons ?? 0,
    totalSwaps: last?.swaps ?? 0,
    extracted: null,
    ok: true,
  };
}

/** Build-heap vs n-inserts comparison. Returns both step-count and big-O. */
export function compareBuildVsInsert(values: number[], kind: HeapKind): {
  buildSteps: OpResult;
  insertSteps: OpResult;
  buildComparisons: number;
  insertComparisons: number;
  buildSwaps: number;
  insertSwaps: number;
} {
  const buildH = createHeap(kind);
  buildH.arr = [...values];
  const buildSteps = runBuild(buildH);
  // For n-inserts, we use the pure (non-stepped) insert to actually modify
  // the heap — runInsert clones the heap so we wouldn't accumulate state.
  // To capture step counts we run stepped inserts on a separate work heap
  // that mirrors the growing insertH after each pure insert.
  const insertH = createHeap(kind);
  let insertComparisons = 0;
  let insertSwaps = 0;
  const allInsertSteps: Step[] = [];
  for (const v of values) {
    // Run stepped insert on a clone to capture step counts, then apply the
    // pure insert to actually grow insertH so subsequent inserts see the
    // accumulated heap state.
    const stepped = runInsert(insertH, v);
    insertComparisons += stepped.totalComparisons;
    insertSwaps += stepped.totalSwaps;
    allInsertSteps.push(...stepped.steps);
    insertPure(insertH, v);
  }
  return {
    buildSteps,
    insertSteps: {
      kind: "insert",
      steps: allInsertSteps,
      totalComparisons: insertComparisons,
      totalSwaps: insertSwaps,
      extracted: null,
      ok: true,
    },
    buildComparisons: buildSteps.totalComparisons,
    insertComparisons,
    buildSwaps: buildSteps.totalSwaps,
    insertSwaps,
  };
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

export function parseValues(input: string): { ok: number[]; skipped: string[] } {
  const ok: number[] = [];
  const skipped: string[] = [];
  if (!input) return { ok, skipped };
  const tokens = input.split(/[\s,;]+/).filter(Boolean);
  for (const tok of tokens) {
    const n = Number.parseInt(tok, 10);
    if (Number.isFinite(n)) ok.push(n);
    else skipped.push(tok);
  }
  return { ok, skipped };
}

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

export function serializeHeap(h: HeapState): string {
  if (h.arr.length === 0) return "";
  return `${h.kind}:${h.arr.join(",")}`;
}

export function deserializeHeap(s: string): HeapState | null {
  if (!s || !s.trim()) return createHeap("min");
  const m = s.match(/^(min|max):(.*)$/);
  if (!m) return null;
  const kind = m[1] as HeapKind;
  const tokens = m[2].split(/[\s,;]+/).filter(Boolean);
  const arr: number[] = [];
  for (const tok of tokens) {
    const n = Number.parseInt(tok, 10);
    if (!Number.isFinite(n)) return null;
    arr.push(n);
  }
  // Note: we serialize the CURRENT array state, not necessarily a valid heap,
  // because heapsort leaves the array in a non-heap order. We re-heapify on load.
  return { arr, kind };
}

// ---------------------------------------------------------------------------
// Step / color helpers
// ---------------------------------------------------------------------------

export function nodeColorClass(
  index: number,
  step: Step,
): string {
  if (step.sortedSuffix.includes(index)) return "sorted";
  if (step.active === index) {
    if (step.kind === "swap") return "swap";
    if (step.kind === "insert") return "insert";
    if (step.kind === "extract") return "extract";
    if (step.kind === "compare") return "compare";
    return "active";
  }
  if (step.parent === index || step.child === index) return "edge";
  if (step.path.includes(index)) return "path";
  return "default";
}

export function formatStep(step: Step, stepIndex: number, total: number): string {
  return `[${stepIndex + 1}/${total}] ${step.description}  (cmp=${step.comparisons}, swap=${step.swaps})`;
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:heap-priority-queue-visualizer:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  op: OpKind;
  value?: number;
  size: number;
  comparisons: number;
  swaps: number;
  ok: boolean;
}

export function loadHistory(): HistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(arr) ? arr.slice(0, HISTORY_MAX) : [];
  } catch {
    return [];
  }
}

export function saveHistory(entry: HistoryEntry): HistoryEntry[] {
  const next = [entry, ...loadHistory()].slice(0, HISTORY_MAX);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch { /* ignore */ }
  }
  return next;
}

export function clearHistory(): void {
  if (typeof localStorage === "undefined") return;
  try { localStorage.removeItem(HISTORY_KEY); } catch { /* ignore */ }
}

// ---------------------------------------------------------------------------
// Shareable URL
// ---------------------------------------------------------------------------

export interface ShareParams {
  heap: string;
}

export function buildShareUrl(h: HeapState): string {
  const params = new URLSearchParams();
  const s = serializeHeap(h);
  if (s) params.set("h", s);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareParams | null {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return null;
  const params = new URLSearchParams(clean);
  const h = params.get("h");
  if (h === null) return null;
  return { heap: h };
}

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

export function randomHeap(count: number, seed: number = 1, kind: HeapKind = "min"): HeapState {
  const rand = mulberry32(seed);
  const set = new Set<number>();
  while (set.size < count) {
    set.add(Math.floor(rand() * 100));
  }
  return fromArray([...set], kind);
}

export function randomArray(count: number, seed: number = 1): number[] {
  const rand = mulberry32(seed);
  const set = new Set<number>();
  while (set.size < count) {
    set.add(Math.floor(rand() * 100));
  }
  return [...set];
}

export function sortedArray(count: number): number[] {
  const out: number[] = [];
  for (let i = 1; i <= count; i++) out.push(i * 2);
  return out;
}

export function reverseSortedArray(count: number): number[] {
  const out: number[] = [];
  for (let i = count; i >= 1; i--) out.push(i * 2);
  return out;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
