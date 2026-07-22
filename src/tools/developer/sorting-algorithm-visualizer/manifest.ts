/**
 * Sorting Algorithm Visualizer — Tool Manifest.
 * Tool #401 — Category 4 (Developer & Code).
 *
 * Step-by-step visualization of 11 sorting algorithms (bubble, cocktail,
 * selection, insertion, shell, gnome, merge, quick, heap, counting, radix)
 * with live comparison/swap/access counters, custom array input, presets,
 * play/pause/step controls, race mode, per-algorithm complexity cards, and
 * shareable URLs. 100% client-side.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "sorting-algorithm-visualizer",
  name: "Sorting Algorithm Visualizer",
  description:
    "Step-by-step visualization of 11 sorting algorithms (bubble, cocktail, selection, insertion, shell, gnome, merge, quick, heap, counting, radix) with live comparison / swap / array-access counters, custom array input, presets (random, reversed, nearly-sorted, few-unique), play / pause / step-forward / step-back controls, side-by-side race mode, per-algorithm complexity + stability cards, and shareable URLs. 100% client-side.",
  category: "developer",
  keywords: [
    "sorting algorithm visualizer", "sorting visualization", "bubble sort animation",
    "quicksort visualizer", "compare sorting algorithms", "merge sort visualization",
    "heap sort animation", "insertion sort visualizer", "selection sort visualizer",
    "radix sort visualizer", "counting sort visualizer",
  ],
  icon: "bar-chart-3",
  requiresNetwork: false,
  seo: {
    title: "Sorting Algorithm Visualizer — Bubble, Merge, Quick, Heap & More | UnQTools",
    faq: [
      {
        q: "How does the sorting visualizer work?",
        a: "Each algorithm is implemented as a JavaScript generator function that yields a SortStep object on every comparison, swap, or write. Each step carries a full array snapshot plus running comparison / swap / array-access counters, so the UI can step forward and backward without re-running. The play head animates through the steps at your chosen speed, color-coding the active indices, pivot, and known-sorted positions.",
      },
      {
        q: "Which algorithms are supported?",
        a: "11 algorithms total: comparison sorts (Bubble, Cocktail Shaker, Selection, Insertion, Shell, Gnome, Merge, Quick with Lomuto partition, and Heap) plus non-comparison distribution sorts (Counting and LSD Radix). Each has a metadata card showing best / average / worst time complexity, space complexity, and whether it's stable, in-place, and adaptive.",
      },
      {
        q: "Can I race multiple algorithms side by side?",
        a: "Yes — pick two or more algorithms and they'll run on the same input simultaneously, with synchronized step counters and per-algorithm comparison / swap totals displayed in real time. This makes it easy to see, for example, how merge sort's O(n log n) shape differs from bubble sort's O(n²) on the same data.",
      },
      {
        q: "How are the comparison and swap counters computed?",
        a: "Every algorithm increments a counter on each compare (two array reads that drive a branch) and on each swap (two reads + two writes that exchange two positions). For merge sort and counting / radix sort, writes that aren't swaps of in-place elements are counted as swaps too (since they represent data movement). The array-access counter sums all reads and writes. Counter values are monotonic non-decreasing across steps and match the algorithm's actual operations.",
      },
      {
        q: "What extra features does this tool have versus other sort visualizers?",
        a: "(1) 11 algorithms including both comparison and distribution sorts. (2) Generator-based step engine with full array snapshots — true reverse-step fidelity. (3) Live comparison / swap / array-access counters per algorithm. (4) Custom array input (comma / space / newline separated) plus 7 presets (random, reversed, nearly-sorted, few-unique, sorted, single, empty). (5) Deterministic seeded PRNG (mulberry32) so presets are reproducible. (6) Play / pause / step-forward / step-back / speed controls. (7) Side-by-side race mode on identical input. (8) Per-algorithm complexity + stability / in-place / adaptive card. (9) Color legend (compare / swap / set / pivot / sorted). (10) Bar + number display modes. (11) History (localStorage, last 20). (12) Shareable URL encoding algorithm + array. 100% client-side — no uploads, no ads.",
      },
    ],
  },
  status: "done",
};
