/**
 * Sorting Algorithm Visualizer — pure logic.
 *
 * Generator-based step engine for visualizing comparison sorts (bubble,
 * selection, insertion, merge, quick, heap, shell, cocktail, gnome) plus
 * non-comparison sorts (counting, radix). Each algorithm yields a stream of
 * SortStep objects (each carrying a full array snapshot, active indices,
 * sorted indices, and running comparison/swap/access counters) so the UI can
 * step forward and backward without re-running. Pure functions only — no
 * DOM, no network.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AlgorithmId =
  | "bubble"
  | "cocktail"
  | "selection"
  | "insertion"
  | "shell"
  | "gnome"
  | "merge"
  | "quick"
  | "heap"
  | "counting"
  | "radix";

export type StepType =
  | "compare"
  | "swap"
  | "set"
  | "sorted"
  | "pivot"
  | "merge"
  | "highlight"
  | "info";

export interface SortStep {
  /** Full array snapshot AFTER this step's action. */
  array: number[];
  /** Indices actively involved in this step (compared / swapped / set). */
  active: number[];
  /** Indices known to be in their final sorted position. */
  sorted: number[];
  /** Pivot index (for quicksort / heap operations). */
  pivot: number | null;
  /** Step type for color coding. */
  type: StepType;
  /** Running comparison count. */
  comparisons: number;
  /** Running swap count. */
  swaps: number;
  /** Running array-access count (reads + writes). */
  accesses: number;
  /** Human-readable description. */
  description: string;
}

export interface AlgorithmInfo {
  id: AlgorithmId;
  name: string;
  category: "comparison" | "distribution";
  timeBest: string;
  timeAvg: string;
  timeWorst: string;
  space: string;
  stable: boolean;
  inPlace: boolean;
  adaptive: boolean;
  description: string;
}

export interface PresetSpec {
  id: "random" | "reversed" | "nearly-sorted" | "few-unique" | "sorted" | "empty" | "single";
  label: string;
  description: string;
}

export type RunResult = {
  algorithm: AlgorithmId;
  steps: SortStep[];
  totalComparisons: number;
  totalSwaps: number;
  totalAccesses: number;
  sorted: boolean;
  error?: string;
};

export type RaceEntry = {
  algorithm: AlgorithmId;
  result: RunResult;
};

// ---------------------------------------------------------------------------
// Algorithm metadata
// ---------------------------------------------------------------------------

export const ALGORITHMS: Record<AlgorithmId, AlgorithmInfo> = {
  bubble: {
    id: "bubble",
    name: "Bubble Sort",
    category: "comparison",
    timeBest: "O(n)",
    timeAvg: "O(n²)",
    timeWorst: "O(n²)",
    space: "O(1)",
    stable: true,
    inPlace: true,
    adaptive: true,
    description: "Repeatedly compares adjacent pairs and swaps them if out of order. The largest unsorted element 'bubbles up' to its final position after each outer pass.",
  },
  cocktail: {
    id: "cocktail",
    name: "Cocktail Shaker Sort",
    category: "comparison",
    timeBest: "O(n)",
    timeAvg: "O(n²)",
    timeWorst: "O(n²)",
    space: "O(1)",
    stable: true,
    inPlace: true,
    adaptive: true,
    description: "Bidirectional bubble sort — each pass bubbles the largest element right, then the smallest element left, narrowing the unsorted window from both ends.",
  },
  selection: {
    id: "selection",
    name: "Selection Sort",
    category: "comparison",
    timeBest: "O(n²)",
    timeAvg: "O(n²)",
    timeWorst: "O(n²)",
    space: "O(1)",
    stable: false,
    inPlace: true,
    adaptive: false,
    description: "Finds the minimum element of the unsorted portion and swaps it into place. Always performs the same number of comparisons regardless of input order.",
  },
  insertion: {
    id: "insertion",
    name: "Insertion Sort",
    category: "comparison",
    timeBest: "O(n)",
    timeAvg: "O(n²)",
    timeWorst: "O(n²)",
    space: "O(1)",
    stable: true,
    inPlace: true,
    adaptive: true,
    description: "Builds the sorted portion one element at a time, inserting each new element into its correct position via repeated swaps. Very efficient on nearly-sorted input.",
  },
  shell: {
    id: "shell",
    name: "Shell Sort",
    category: "comparison",
    timeBest: "O(n log n)",
    timeAvg: "O(n^1.25)",
    timeWorst: "O(n²)",
    space: "O(1)",
    stable: false,
    inPlace: true,
    adaptive: true,
    description: "Generalization of insertion sort that allows exchange of far-apart elements. Uses a gap sequence (here: Hibbard's 2^k-1) to progressively reduce disorder.",
  },
  gnome: {
    id: "gnome",
    name: "Gnome Sort",
    category: "comparison",
    timeBest: "O(n)",
    timeAvg: "O(n²)",
    timeWorst: "O(n²)",
    space: "O(1)",
    stable: true,
    inPlace: true,
    adaptive: true,
    description: "Stupid-sort variant: walk forward when in order, swap and walk backward when out of order. Same asymptotic complexity as insertion sort.",
  },
  merge: {
    id: "merge",
    name: "Merge Sort",
    category: "comparison",
    timeBest: "O(n log n)",
    timeAvg: "O(n log n)",
    timeWorst: "O(n log n)",
    space: "O(n)",
    stable: true,
    inPlace: false,
    adaptive: false,
    description: "Divide-and-conquer: recursively split the array in half, sort each half, then merge the sorted halves. Guaranteed O(n log n) but uses O(n) auxiliary space.",
  },
  quick: {
    id: "quick",
    name: "Quick Sort (Lomuto)",
    category: "comparison",
    timeBest: "O(n log n)",
    timeAvg: "O(n log n)",
    timeWorst: "O(n²)",
    space: "O(log n)",
    stable: false,
    inPlace: true,
    adaptive: false,
    description: "Pick a pivot (here: last element of each subarray), partition so smaller elements go left and larger right, then recurse. Worst case O(n²) on already-sorted input.",
  },
  heap: {
    id: "heap",
    name: "Heap Sort",
    category: "comparison",
    timeBest: "O(n log n)",
    timeAvg: "O(n log n)",
    timeWorst: "O(n log n)",
    space: "O(1)",
    stable: false,
    inPlace: true,
    adaptive: false,
    description: "Build a max-heap, then repeatedly extract the maximum (swap with the last unsorted slot) and sift-down to restore heap order. Guaranteed O(n log n) in-place.",
  },
  counting: {
    id: "counting",
    name: "Counting Sort",
    category: "distribution",
    timeBest: "O(n + k)",
    timeAvg: "O(n + k)",
    timeWorst: "O(n + k)",
    space: "O(n + k)",
    stable: true,
    inPlace: false,
    adaptive: false,
    description: "Non-comparison sort for non-negative integers. Counts occurrences of each value, then writes them back in order. k = range of input values.",
  },
  radix: {
    id: "radix",
    name: "Radix Sort (LSD)",
    category: "distribution",
    timeBest: "O(d·(n + b))",
    timeAvg: "O(d·(n + b))",
    timeWorst: "O(d·(n + b))",
    space: "O(n + b)",
    stable: true,
    inPlace: false,
    adaptive: false,
    description: "Non-comparison sort: stable-sort by each decimal digit (LSD first). d = digit count, b = base (10). Requires non-negative integers.",
  },
};

export const ALGORITHM_LIST: AlgorithmInfo[] = Object.values(ALGORITHMS);

export const PRESETS: PresetSpec[] = [
  { id: "random", label: "Random", description: "Random integers 1-99" },
  { id: "reversed", label: "Reversed", description: "Worst case for many sorts" },
  { id: "nearly-sorted", label: "Nearly sorted", description: "Sorted with a few adjacent swaps" },
  { id: "few-unique", label: "Few unique", description: "Only 3-4 distinct values" },
  { id: "sorted", label: "Sorted", description: "Best case for adaptive sorts" },
  { id: "single", label: "Single element", description: "Edge case: n = 1" },
  { id: "empty", label: "Empty", description: "Edge case: n = 0" },
];

// ---------------------------------------------------------------------------
// Array input parsing & presets
// ---------------------------------------------------------------------------

/** Parse a custom array input (comma, space, or newline separated). */
export function parseArrayInput(input: string): { ok: true; array: number[] } | { ok: false; error: string } {
  const trimmed = input.trim();
  if (!trimmed) return { ok: true, array: [] };
  const tokens = trimmed.split(/[\s,;]+/).filter(Boolean);
  const out: number[] = [];
  for (const t of tokens) {
    const n = Number(t);
    if (!Number.isFinite(n)) return { ok: false, error: "Invalid number: " + JSON.stringify(t) };
    if (!Number.isInteger(n)) return { ok: false, error: "Non-integer not supported: " + JSON.stringify(t) };
    out.push(n);
  }
  return { ok: true, array: out };
}

/** Format an array as a comma-separated string. */
export function formatArray(arr: number[]): string {
  return arr.join(", ");
}

/** Deterministic PRNG (mulberry32) for reproducible presets. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Generate a preset array of the given size. */
export function generatePreset(preset: PresetSpec["id"], size: number, seed = 42): number[] {
  const n = Math.max(0, Math.min(size, 200));
  const rng = mulberry32(seed);
  switch (preset) {
    case "empty":
      return [];
    case "single":
      return [Math.floor(rng() * 99) + 1];
    case "sorted":
      return Array.from({ length: n }, (_, i) => i + 1);
    case "reversed":
      return Array.from({ length: n }, (_, i) => n - i);
    case "nearly-sorted": {
      const arr = Array.from({ length: n }, (_, i) => i + 1);
      const swapCount = Math.max(1, Math.floor(n * 0.05));
      for (let k = 0; k < swapCount; k++) {
        const i = Math.floor(rng() * (n - 1));
        const tmp = arr[i];
        arr[i] = arr[i + 1];
        arr[i + 1] = tmp;
      }
      return arr;
    }
    case "few-unique": {
      const values = [10, 30, 60, 90];
      return Array.from({ length: n }, () => values[Math.floor(rng() * values.length)]);
    }
    case "random":
    default:
      return Array.from({ length: n }, () => Math.floor(rng() * 99) + 1);
  }
}

// ---------------------------------------------------------------------------
// Helpers for building steps
// ---------------------------------------------------------------------------

interface Counter {
  comparisons: number;
  swaps: number;
  accesses: number;
}

function makeStep(
  array: number[],
  active: number[],
  sorted: number[],
  type: StepType,
  counters: Counter,
  description: string,
  pivot: number | null = null,
): SortStep {
  return {
    array: array.slice(),
    active: active.slice(),
    sorted: sorted.slice(),
    pivot,
    type,
    comparisons: counters.comparisons,
    swaps: counters.swaps,
    accesses: counters.accesses,
    description,
  };
}

function readAccess(counters: Counter, n = 1): void {
  counters.accesses += n;
}

function writeAccess(counters: Counter, n = 1): void {
  counters.accesses += n;
}

/** Format "a[i]=v" for descriptions (avoids nested-bracket template issues). */
function fmtElem(idx: number, val: number): string {
  return "a[" + idx + "]=" + val;
}

// ---------------------------------------------------------------------------
// Algorithm generators
// ---------------------------------------------------------------------------

/** Bubble sort — generator. */
export function* bubbleSort(input: number[]): Generator<SortStep> {
  const a = input.slice();
  const n = a.length;
  const sorted: number[] = [];
  const c: Counter = { comparisons: 0, swaps: 0, accesses: 0 };
  if (n === 0) {
    yield makeStep(a, [], sorted, "info", c, "Empty array — already sorted");
    return;
  }
  for (let i = 0; i < n - 1; i++) {
    let swapped = false;
    for (let j = 0; j < n - 1 - i; j++) {
      c.comparisons++;
      readAccess(c, 2);
      yield makeStep(a, [j, j + 1], sorted, "compare", c, "Compare " + fmtElem(j, a[j]) + " and " + fmtElem(j + 1, a[j + 1]));
      if (a[j] > a[j + 1]) {
        const tmp = a[j];
        a[j] = a[j + 1];
        a[j + 1] = tmp;
        c.swaps++;
        readAccess(c, 2);
        writeAccess(c, 2);
        swapped = true;
        yield makeStep(a, [j, j + 1], sorted, "swap", c, "Swap a[" + j + "] and a[" + (j + 1) + "]");
      }
    }
    sorted.unshift(n - 1 - i);
    yield makeStep(a, [], sorted, "sorted", c, "a[" + (n - 1 - i) + "] is in its final position");
    if (!swapped) {
      for (let k = n - 2 - i; k >= 0; k--) {
        if (!sorted.includes(k)) sorted.unshift(k);
      }
      yield makeStep(a, [], sorted, "sorted", c, "No swaps this pass — array is sorted");
      return;
    }
  }
  if (!sorted.includes(0)) sorted.unshift(0);
  yield makeStep(a, [], sorted, "sorted", c, "Sort complete");
}

/** Cocktail shaker sort — bidirectional bubble sort. */
export function* cocktailSort(input: number[]): Generator<SortStep> {
  const a = input.slice();
  const n = a.length;
  const sorted: number[] = [];
  const c: Counter = { comparisons: 0, swaps: 0, accesses: 0 };
  if (n === 0) { yield makeStep(a, [], sorted, "info", c, "Empty array"); return; }
  let lo = 0;
  let hi = n - 1;
  while (lo < hi) {
    let lastSwap = lo;
    for (let i = lo; i < hi; i++) {
      c.comparisons++;
      readAccess(c, 2);
      yield makeStep(a, [i, i + 1], sorted, "compare", c, "Forward compare " + fmtElem(i, a[i]) + ", " + fmtElem(i + 1, a[i + 1]));
      if (a[i] > a[i + 1]) {
        const tmp = a[i];
        a[i] = a[i + 1];
        a[i + 1] = tmp;
        c.swaps++;
        readAccess(c, 2); writeAccess(c, 2);
        lastSwap = i;
        yield makeStep(a, [i, i + 1], sorted, "swap", c, "Swap a[" + i + "] and a[" + (i + 1) + "]");
      }
    }
    sorted.unshift(hi);
    yield makeStep(a, [], sorted, "sorted", c, "a[" + hi + "] in final position");
    hi = lastSwap;
    if (lo >= hi) break;
    lastSwap = hi;
    for (let i = hi; i > lo; i--) {
      c.comparisons++;
      readAccess(c, 2);
      yield makeStep(a, [i - 1, i], sorted, "compare", c, "Backward compare " + fmtElem(i - 1, a[i - 1]) + ", " + fmtElem(i, a[i]));
      if (a[i - 1] > a[i]) {
        const tmp = a[i - 1];
        a[i - 1] = a[i];
        a[i] = tmp;
        c.swaps++;
        readAccess(c, 2); writeAccess(c, 2);
        lastSwap = i;
        yield makeStep(a, [i - 1, i], sorted, "swap", c, "Swap a[" + (i - 1) + "] and a[" + i + "]");
      }
    }
    sorted.push(lo);
    yield makeStep(a, [], sorted, "sorted", c, "a[" + lo + "] in final position");
    lo = lastSwap;
  }
  for (let k = 0; k < n; k++) if (!sorted.includes(k)) sorted.push(k);
  yield makeStep(a, [], sorted, "sorted", c, "Sort complete");
}

/** Selection sort — generator. */
export function* selectionSort(input: number[]): Generator<SortStep> {
  const a = input.slice();
  const n = a.length;
  const sorted: number[] = [];
  const c: Counter = { comparisons: 0, swaps: 0, accesses: 0 };
  if (n === 0) { yield makeStep(a, [], sorted, "info", c, "Empty array"); return; }
  for (let i = 0; i < n - 1; i++) {
    let minIdx = i;
    readAccess(c, 1);
    for (let j = i + 1; j < n; j++) {
      c.comparisons++;
      readAccess(c, 2);
      yield makeStep(a, [minIdx, j], sorted, "compare", c, "Is " + fmtElem(j, a[j]) + " < " + fmtElem(minIdx, a[minIdx]) + "?");
      if (a[j] < a[minIdx]) {
        minIdx = j;
        yield makeStep(a, [minIdx], sorted, "highlight", c, "New minimum: " + fmtElem(minIdx, a[minIdx]));
      }
    }
    if (minIdx !== i) {
      const tmp = a[i];
      a[i] = a[minIdx];
      a[minIdx] = tmp;
      c.swaps++;
      readAccess(c, 2); writeAccess(c, 2);
      yield makeStep(a, [i, minIdx], sorted, "swap", c, "Swap a[" + i + "] and a[" + minIdx + "]");
    }
    sorted.push(i);
    yield makeStep(a, [], sorted, "sorted", c, "a[" + i + "] in final position");
  }
  sorted.push(n - 1);
  yield makeStep(a, [], sorted, "sorted", c, "Sort complete");
}

/** Insertion sort — generator. */
export function* insertionSort(input: number[]): Generator<SortStep> {
  const a = input.slice();
  const n = a.length;
  const sorted: number[] = [];
  const c: Counter = { comparisons: 0, swaps: 0, accesses: 0 };
  if (n === 0) { yield makeStep(a, [], sorted, "info", c, "Empty array"); return; }
  sorted.push(0);
  yield makeStep(a, [0], sorted, "sorted", c, "a[0] starts the sorted portion");
  for (let i = 1; i < n; i++) {
    let j = i;
    readAccess(c, 1);
    yield makeStep(a, [j], sorted, "highlight", c, "Insert " + fmtElem(j, a[j]) + " into sorted portion");
    while (j > 0) {
      c.comparisons++;
      readAccess(c, 2);
      yield makeStep(a, [j - 1, j], sorted, "compare", c, "Compare " + fmtElem(j - 1, a[j - 1]) + " and " + fmtElem(j, a[j]));
      if (a[j - 1] > a[j]) {
        const tmp = a[j - 1];
        a[j - 1] = a[j];
        a[j] = tmp;
        c.swaps++;
        readAccess(c, 2); writeAccess(c, 2);
        yield makeStep(a, [j - 1, j], sorted, "swap", c, "Swap a[" + (j - 1) + "] and a[" + j + "]");
        j--;
      } else {
        break;
      }
    }
    sorted.push(i);
    yield makeStep(a, [], sorted, "sorted", c, "a[" + i + "] inserted");
  }
  yield makeStep(a, [], sorted, "sorted", c, "Sort complete");
}

/** Shell sort — generator (Hibbard gap sequence 2^k - 1). */
export function* shellSort(input: number[]): Generator<SortStep> {
  const a = input.slice();
  const n = a.length;
  const sorted: number[] = [];
  const c: Counter = { comparisons: 0, swaps: 0, accesses: 0 };
  if (n === 0) { yield makeStep(a, [], sorted, "info", c, "Empty array"); return; }
  const gaps: number[] = [];
  let g = 1;
  while (g < n) { gaps.push(g); g = 2 * g + 1; }
  gaps.reverse();
  for (const gap of gaps) {
    yield makeStep(a, [], sorted, "info", c, "Pass with gap=" + gap);
    for (let i = gap; i < n; i++) {
      let j = i;
      readAccess(c, 1);
      while (j >= gap) {
        c.comparisons++;
        readAccess(c, 2);
        yield makeStep(a, [j - gap, j], sorted, "compare", c, "gap=" + gap + ": compare " + fmtElem(j - gap, a[j - gap]) + " and " + fmtElem(j, a[j]));
        if (a[j - gap] > a[j]) {
          const tmp = a[j - gap];
          a[j - gap] = a[j];
          a[j] = tmp;
          c.swaps++;
          readAccess(c, 2); writeAccess(c, 2);
          yield makeStep(a, [j - gap, j], sorted, "swap", c, "Swap a[" + (j - gap) + "] and a[" + j + "]");
          j -= gap;
        } else {
          break;
        }
      }
    }
  }
  for (let k = 0; k < n; k++) if (!sorted.includes(k)) sorted.push(k);
  yield makeStep(a, [], sorted, "sorted", c, "Sort complete");
}

/** Gnome sort — generator. */
export function* gnomeSort(input: number[]): Generator<SortStep> {
  const a = input.slice();
  const n = a.length;
  const sorted: number[] = [];
  const c: Counter = { comparisons: 0, swaps: 0, accesses: 0 };
  if (n === 0) { yield makeStep(a, [], sorted, "info", c, "Empty array"); return; }
  let i = 0;
  while (i < n) {
    if (i === 0) {
      i++;
      continue;
    }
    c.comparisons++;
    readAccess(c, 2);
    yield makeStep(a, [i - 1, i], sorted, "compare", c, "Compare " + fmtElem(i - 1, a[i - 1]) + " and " + fmtElem(i, a[i]));
    if (a[i - 1] <= a[i]) {
      i++;
    } else {
      const tmp = a[i - 1];
      a[i - 1] = a[i];
      a[i] = tmp;
      c.swaps++;
      readAccess(c, 2); writeAccess(c, 2);
      yield makeStep(a, [i - 1, i], sorted, "swap", c, "Swap a[" + (i - 1) + "] and a[" + i + "]");
      i--;
    }
  }
  for (let k = 0; k < n; k++) sorted.push(k);
  yield makeStep(a, [], sorted, "sorted", c, "Sort complete");
}

/** Merge sort — generator (top-down, recursive). */
export function* mergeSort(input: number[]): Generator<SortStep> {
  const a = input.slice();
  const n = a.length;
  const sorted: number[] = [];
  const c: Counter = { comparisons: 0, swaps: 0, accesses: 0 };
  if (n === 0) { yield makeStep(a, [], sorted, "info", c, "Empty array"); return; }
  if (n === 1) { sorted.push(0); yield makeStep(a, [], sorted, "sorted", c, "Single element — sorted"); return; }

  function* mergeSortGen(lo: number, hi: number): Generator<SortStep> {
    if (hi - lo <= 1) return;
    const mid = lo + Math.floor((hi - lo) / 2);
    yield* mergeSortGen(lo, mid);
    yield* mergeSortGen(mid, hi);
    const left = a.slice(lo, mid);
    const right = a.slice(mid, hi);
    readAccess(c, left.length + right.length);
    let i = 0;
    let j = 0;
    let k = lo;
    while (i < left.length && j < right.length) {
      c.comparisons++;
      readAccess(c, 2);
      yield makeStep(a, [lo + i, mid + j], sorted, "compare", c, "Merge: compare " + left[i] + " and " + right[j]);
      if (left[i] <= right[j]) {
        a[k] = left[i];
        writeAccess(c, 1);
        yield makeStep(a, [k], sorted, "set", c, "Write " + left[i] + " to a[" + k + "]");
        i++;
      } else {
        a[k] = right[j];
        c.swaps++;
        writeAccess(c, 1);
        yield makeStep(a, [k], sorted, "set", c, "Write " + right[j] + " to a[" + k + "]");
        j++;
      }
      k++;
    }
    while (i < left.length) {
      a[k] = left[i];
      writeAccess(c, 1);
      yield makeStep(a, [k], sorted, "set", c, "Copy remaining " + left[i] + " to a[" + k + "]");
      i++;
      k++;
    }
    while (j < right.length) {
      a[k] = right[j];
      writeAccess(c, 1);
      yield makeStep(a, [k], sorted, "set", c, "Copy remaining " + right[j] + " to a[" + k + "]");
      j++;
      k++;
    }
    const merged: number[] = [];
    for (let x = 0; x < hi - lo; x++) merged.push(lo + x);
    yield makeStep(a, merged, sorted, "merge", c, "Merged [" + lo + ".." + hi + ")");
  }

  yield* mergeSortGen(0, n);
  for (let k = 0; k < n; k++) if (!sorted.includes(k)) sorted.push(k);
  yield makeStep(a, [], sorted, "sorted", c, "Sort complete");
}

/** Quick sort — generator (Lomuto partition, last-element pivot). */
export function* quickSort(input: number[]): Generator<SortStep> {
  const a = input.slice();
  const n = a.length;
  const sorted: number[] = [];
  const c: Counter = { comparisons: 0, swaps: 0, accesses: 0 };
  if (n === 0) { yield makeStep(a, [], sorted, "info", c, "Empty array"); return; }

  function* qs(lo: number, hi: number): Generator<SortStep> {
    if (lo >= hi) {
      if (lo === hi && !sorted.includes(lo)) {
        sorted.push(lo);
        yield makeStep(a, [], sorted, "sorted", c, "a[" + lo + "] in final position");
      }
      return;
    }
    const pivot = a[hi];
    readAccess(c, 1);
    yield makeStep(a, [hi], sorted, "pivot", c, "Choose pivot a[" + hi + "]=" + pivot, hi);
    let i = lo;
    for (let j = lo; j < hi; j++) {
      c.comparisons++;
      readAccess(c, 2);
      yield makeStep(a, [j, hi], sorted, "compare", c, "Compare " + fmtElem(j, a[j]) + " with pivot " + pivot, hi);
      if (a[j] < pivot) {
        if (i !== j) {
          const tmp = a[i];
          a[i] = a[j];
          a[j] = tmp;
          c.swaps++;
          readAccess(c, 2); writeAccess(c, 2);
          yield makeStep(a, [i, j], sorted, "swap", c, "Swap a[" + i + "] and a[" + j + "]", hi);
        }
        i++;
      }
    }
    if (i !== hi) {
      const tmp = a[i];
      a[i] = a[hi];
      a[hi] = tmp;
      c.swaps++;
      readAccess(c, 2); writeAccess(c, 2);
      yield makeStep(a, [i, hi], sorted, "swap", c, "Move pivot to a[" + i + "]");
    }
    sorted.push(i);
    yield makeStep(a, [], sorted, "sorted", c, "Pivot a[" + i + "] in final position");
    yield* qs(lo, i - 1);
    yield* qs(i + 1, hi);
  }

  yield* qs(0, n - 1);
  yield makeStep(a, [], sorted, "sorted", c, "Sort complete");
}

/** Heap sort — generator. */
export function* heapSort(input: number[]): Generator<SortStep> {
  const a = input.slice();
  const n = a.length;
  const sorted: number[] = [];
  const c: Counter = { comparisons: 0, swaps: 0, accesses: 0 };
  if (n === 0) { yield makeStep(a, [], sorted, "info", c, "Empty array"); return; }

  function* siftDown(start: number, end: number): Generator<SortStep> {
    let root = start;
    while (2 * root + 1 <= end) {
      let child = 2 * root + 1;
      if (child + 1 <= end) {
        c.comparisons++;
        readAccess(c, 2);
        yield makeStep(a, [child, child + 1], sorted, "compare", c, "Compare children " + fmtElem(child, a[child]) + " and " + fmtElem(child + 1, a[child + 1]));
        if (a[child] < a[child + 1]) child++;
      }
      c.comparisons++;
      readAccess(c, 2);
      yield makeStep(a, [root, child], sorted, "compare", c, "Compare parent " + fmtElem(root, a[root]) + " and child " + fmtElem(child, a[child]));
      if (a[root] < a[child]) {
        const tmp = a[root];
        a[root] = a[child];
        a[child] = tmp;
        c.swaps++;
        readAccess(c, 2); writeAccess(c, 2);
        yield makeStep(a, [root, child], sorted, "swap", c, "Swap a[" + root + "] and a[" + child + "]");
        root = child;
      } else {
        return;
      }
    }
  }

  for (let start = Math.floor(n / 2) - 1; start >= 0; start--) {
    yield* siftDown(start, n - 1);
  }
  yield makeStep(a, [], sorted, "info", c, "Max-heap built");
  for (let end = n - 1; end > 0; end--) {
    const tmp = a[0];
    a[0] = a[end];
    a[end] = tmp;
    c.swaps++;
    readAccess(c, 2); writeAccess(c, 2);
    yield makeStep(a, [0, end], sorted, "swap", c, "Swap max (a[0]) to a[" + end + "]");
    sorted.unshift(end);
    yield makeStep(a, [], sorted, "sorted", c, "a[" + end + "] in final position");
    yield* siftDown(0, end - 1);
  }
  sorted.unshift(0);
  yield makeStep(a, [], sorted, "sorted", c, "Sort complete");
}

/** Counting sort — generator (non-negative integers only). */
export function* countingSort(input: number[]): Generator<SortStep> {
  const a = input.slice();
  const n = a.length;
  const sorted: number[] = [];
  const c: Counter = { comparisons: 0, swaps: 0, accesses: 0 };
  if (n === 0) { yield makeStep(a, [], sorted, "info", c, "Empty array"); return; }
  for (let i = 0; i < n; i++) {
    if (a[i] < 0) {
      yield makeStep(a, [], sorted, "info", c, "Error: counting sort requires non-negative integers (a[" + i + "]=" + a[i] + ")");
      return;
    }
  }
  let max = a[0];
  readAccess(c, 1);
  for (let i = 1; i < n; i++) {
    c.comparisons++;
    readAccess(c, 1);
    yield makeStep(a, [i], sorted, "highlight", c, "Find max: " + fmtElem(i, a[i]));
    if (a[i] > max) max = a[i];
  }
  yield makeStep(a, [], sorted, "info", c, "Max value = " + max + ", building count array of size " + (max + 1));
  const count = new Array(max + 1).fill(0);
  for (let i = 0; i < n; i++) {
    count[a[i]]++;
    readAccess(c, 1); writeAccess(c, 1);
    yield makeStep(a, [i], sorted, "highlight", c, "Count " + fmtElem(i, a[i]));
  }
  let idx = 0;
  for (let v = 0; v <= max; v++) {
    while (count[v] > 0) {
      a[idx] = v;
      writeAccess(c, 1);
      c.swaps++;
      yield makeStep(a, [idx], sorted, "set", c, "Write " + v + " to a[" + idx + "]");
      sorted.push(idx);
      idx++;
      count[v]--;
    }
  }
  yield makeStep(a, [], sorted, "sorted", c, "Sort complete");
}

/** Radix sort (LSD, base 10) — generator (non-negative integers only). */
export function* radixSort(input: number[]): Generator<SortStep> {
  const a = input.slice();
  const n = a.length;
  const sorted: number[] = [];
  const c: Counter = { comparisons: 0, swaps: 0, accesses: 0 };
  if (n === 0) { yield makeStep(a, [], sorted, "info", c, "Empty array"); return; }
  for (let i = 0; i < n; i++) {
    if (a[i] < 0) {
      yield makeStep(a, [], sorted, "info", c, "Error: radix sort requires non-negative integers (a[" + i + "]=" + a[i] + ")");
      return;
    }
  }
  let max = a[0];
  readAccess(c, 1);
  for (let i = 1; i < n; i++) {
    c.comparisons++;
    readAccess(c, 1);
    if (a[i] > max) max = a[i];
  }
  const maxDigits = max === 0 ? 1 : Math.floor(Math.log10(max)) + 1;
  for (let d = 0; d < maxDigits; d++) {
    const digit = Math.pow(10, d);
    yield makeStep(a, [], sorted, "info", c, "Sort by digit " + (d + 1) + " (place " + digit + ")");
    const buckets: number[][] = Array.from({ length: 10 }, () => []);
    for (let i = 0; i < n; i++) {
      const bucket = Math.floor(a[i] / digit) % 10;
      buckets[bucket].push(a[i]);
      readAccess(c, 1);
      yield makeStep(a, [i], sorted, "highlight", c, fmtElem(i, a[i]) + " → bucket " + bucket);
    }
    let idx = 0;
    for (let b = 0; b < 10; b++) {
      for (const val of buckets[b]) {
        a[idx] = val;
        writeAccess(c, 1);
        c.swaps++;
        yield makeStep(a, [idx], sorted, "set", c, "Write " + val + " to a[" + idx + "] (bucket " + b + ")");
        idx++;
      }
    }
  }
  for (let k = 0; k < n; k++) sorted.push(k);
  yield makeStep(a, [], sorted, "sorted", c, "Sort complete");
}

// ---------------------------------------------------------------------------
// Algorithm dispatcher
// ---------------------------------------------------------------------------

const ALGORITHM_GENERATORS: Record<AlgorithmId, (input: number[]) => Generator<SortStep>> = {
  bubble: bubbleSort,
  cocktail: cocktailSort,
  selection: selectionSort,
  insertion: insertionSort,
  shell: shellSort,
  gnome: gnomeSort,
  merge: mergeSort,
  quick: quickSort,
  heap: heapSort,
  counting: countingSort,
  radix: radixSort,
};

/** Run an algorithm and collect all steps. */
export function runAlgorithm(algorithm: AlgorithmId, input: number[]): RunResult {
  const gen = ALGORITHM_GENERATORS[algorithm];
  if (!gen) {
    return {
      algorithm,
      steps: [],
      totalComparisons: 0,
      totalSwaps: 0,
      totalAccesses: 0,
      sorted: false,
      error: "Unknown algorithm: " + algorithm,
    };
  }
  const steps: SortStep[] = [];
  for (const step of gen(input)) steps.push(step);
  const last = steps[steps.length - 1];
  const totalComparisons = last ? last.comparisons : 0;
  const totalSwaps = last ? last.swaps : 0;
  const totalAccesses = last ? last.accesses : 0;
  const sorted = last ? isSorted(last.array) : true;
  return { algorithm, steps, totalComparisons, totalSwaps, totalAccesses, sorted };
}

/** Race multiple algorithms on the same input. */
export function race(algorithms: AlgorithmId[], input: number[]): RaceEntry[] {
  return algorithms.map((alg) => ({ algorithm: alg, result: runAlgorithm(alg, input) }));
}

// ---------------------------------------------------------------------------
// Step helpers
// ---------------------------------------------------------------------------

/** Check whether an array is sorted ascending. */
export function isSorted(arr: number[]): boolean {
  for (let i = 1; i < arr.length; i++) {
    if (arr[i - 1] > arr[i]) return false;
  }
  return true;
}

/** Color class for an index given a step (for bar/number rendering). */
export function colorForIndex(index: number, step: SortStep): string {
  if (step.sorted.includes(index)) return "sorted";
  if (step.pivot === index) return "pivot";
  if (step.active.includes(index)) {
    if (step.type === "swap") return "swap";
    if (step.type === "compare") return "compare";
    if (step.type === "set") return "set";
    return "highlight";
  }
  return "default";
}

/** Format a step as a human-readable line. */
export function formatStep(step: SortStep, stepIndex: number, totalSteps: number): string {
  return "[" + (stepIndex + 1) + "/" + totalSteps + "] " + step.description + "  (cmp=" + step.comparisons + " swap=" + step.swaps + " acc=" + step.accesses + ")";
}

/** Get the algorithm info object. */
export function getAlgorithmInfo(id: AlgorithmId): AlgorithmInfo {
  return ALGORITHMS[id];
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:sorting-algorithm-visualizer:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  algorithm: AlgorithmId;
  array: number[];
  steps: number;
  comparisons: number;
  swaps: number;
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

export function buildShareUrl(algorithm: AlgorithmId, array: number[]): string {
  const params = new URLSearchParams();
  params.set("alg", algorithm);
  if (array.length > 0) params.set("a", array.join(","));
  if (typeof window === "undefined") return "?" + params.toString();
  return window.location.origin + window.location.pathname + "#" + params.toString();
}

export interface ShareParams {
  algorithm: AlgorithmId;
  array: number[];
}

export function parseShareUrl(hash: string): ShareParams {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { algorithm: "bubble", array: [] };
  const params = new URLSearchParams(clean);
  const algRaw = params.get("alg") ?? "bubble";
  const algorithm: AlgorithmId =
    (Object.keys(ALGORITHMS) as AlgorithmId[]).includes(algRaw as AlgorithmId)
      ? (algRaw as AlgorithmId)
      : "bubble";
  const aStr = params.get("a") ?? "";
  const array = aStr
    ? aStr.split(",").map((s) => Number.parseInt(s, 10)).filter((n) => Number.isFinite(n))
    : [];
  return { algorithm, array };
}

// ---------------------------------------------------------------------------
// Default sample arrays
// ---------------------------------------------------------------------------

export const DEFAULT_ARRAYS: Record<PresetSpec["id"], number[]> = {
  random: [64, 34, 25, 12, 22, 11, 90, 50, 77, 3],
  reversed: [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
  "nearly-sorted": [1, 2, 4, 3, 5, 6, 8, 7, 9, 10],
  "few-unique": [30, 10, 60, 30, 90, 10, 60, 30, 90, 60],
  sorted: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  single: [42],
  empty: [],
};
