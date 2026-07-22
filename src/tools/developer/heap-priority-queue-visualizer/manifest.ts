/**
 * Heap & Priority Queue Visualizer — Tool Manifest.
 * Tool #406 — Category 4 (Developer & Code).
 *
 * Pure-JS binary heap (min/max) with synchronized tree + array views.
 * Insert (sift-up), extract (sift-down), heapify (build-heap in O(n)),
 * peek / size / height, priority-queue operations (change-priority /
 * decrease-key / increase-key), heapsort demo, build-heap vs n-inserts
 * comparison, step-by-step animation with reverse-step fidelity, live
 * index math (parent = (i-1)/2, children = 2i+1 / 2i+2), shareable
 * state URL. 100% client-side.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "heap-priority-queue-visualizer",
  name: "Heap & Priority Queue Visualizer",
  description:
    "Step-by-step visualization of a binary heap (min or max) with synchronized tree + array views and live index math (parent=(i-1)/2, children=2i+1/2i+2). Insert with sift-up, extract with sift-down, build-heap (heapify) in O(n), peek / size / height, priority-queue operations (change-priority, decrease-key, increase-key), one-click heapsort demo, build-heap vs n-inserts comparison, step / reverse / play / speed controls, and shareable state URLs. 100% client-side.",
  category: "developer",
  keywords: [
    "heap visualizer", "binary heap visualization", "priority queue visualizer",
    "min heap max heap", "heapify animation", "sift up sift down",
    "heapsort visualizer", "binary heap array", "priority queue online",
    "heap tree array", "decrease key heap", "build heap",
  ],
  icon: "layers",
  requiresNetwork: false,
  seo: {
    title: "Heap & Priority Queue Visualizer — Sift Up/Down, Heapify, Heapsort | UnQTools",
    faq: [
      {
        q: "How does the heap visualizer work?",
        a: "Every operation (insert, extract, build-heap, change-priority, heapsort) is implemented as a JavaScript generator that yields a Step on each comparison or swap. Each step carries the full array snapshot, the active indices (parent + child), the swap history, and a description — so the UI can step forward and backward without re-running. The tree and the array stay in perfect sync, and every node displays its index so you can verify the parent=(i-1)/2, children=2i+1/2i+2 math.",
      },
      {
        q: "What is the difference between build-heap (heapify) and n inserts?",
        a: "Repeated insert is O(n log n) — each of the n elements sifts up at most O(log n) levels. Build-heap (Floyd's heapify) starts from the last internal node and sifts each down only once; the bottom-heavy structure of a heap means most nodes barely move, giving O(n) total. The comparison panel runs both side-by-side and shows the swap count and big-O estimate so the asymptotic win is visible even on small inputs.",
      },
      {
        q: "How do priority-queue operations like decrease-key work?",
        a: "Decrease-key lowers a node's value and sifts it UP toward the root (in a min-heap) to restore the heap property. Increase-key raises a node's value and sifts it DOWN toward the leaves. Change-priority does whichever direction the new value dictates. The visualizer highlights the changed node, the sift path, and each comparison along the way — so you can see exactly why a single key change only costs O(log n) instead of rebuilding the whole heap.",
      },
      {
        q: "How does heapsort work and how is it animated?",
        a: "Heapsort is two phases: (1) build-heap on the entire array (O(n)), then (2) repeatedly swap the root (max/min element) with the last unsorted index, shrink the heap by one, and sift-down the new root to restore the heap property. Phase 2 runs n-1 times at O(log n) each — total O(n log n). The visualizer highlights the sorted suffix in a distinct color so you can watch the sorted region grow from the right, and shows the comparison/swap counts at the end.",
      },
      {
        q: "What extra features does this tool have versus other heap visualizers?",
        a: "(1) Min/max heap toggle with full rebuild. (2) Synchronized tree + array views with index labels and parent/child math. (3) Insert (sift-up), extract (sift-down), build-heap (Floyd O(n)), peek / size / height. (4) Priority-queue mode: change-priority, decrease-key, increase-key. (5) Heapsort demo with sorted-suffix highlight. (6) Build-heap vs n-inserts comparison panel. (7) Step / reverse / play / pause / speed controls. (8) Bulk insert from a list. (9) Duplicate-priority handling and tie-breaking. (10) Random and sorted-array presets. (11) History (localStorage, last 20). (12) Shareable URL encoding the entire heap state. (13) Color legend. (14) Export operation trace as text. 100% client-side — no uploads, no ads.",
      },
    ],
  },
  status: "done",
};
