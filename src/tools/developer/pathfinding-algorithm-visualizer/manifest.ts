/**
 * Pathfinding Algorithm Visualizer — Tool Manifest.
 * Tool #402 — Category 4 (Developer & Code).
 *
 * Step-by-step visualization of 6 grid pathfinding algorithms (BFS, DFS,
 * Dijkstra, A*, Greedy Best-First, Bidirectional BFS) with selectable
 * heuristics (Manhattan, Euclidean, Chebyshev, Octile), walls + weighted
 * cells, maze generators (recursive division, Prim, randomized DFS),
 * diagonal-movement toggle, custom grid input, play/pause/step controls,
 * visited/path/length counters, and shareable grid URLs. 100% client-side.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "pathfinding-algorithm-visualizer",
  name: "Pathfinding Algorithm Visualizer",
  description:
    "Step-by-step visualization of 6 grid pathfinding algorithms (BFS, DFS, Dijkstra, A*, Greedy Best-First, Bidirectional BFS) with selectable heuristics (Manhattan, Euclidean, Chebyshev, Octile), paintable walls and weighted cells, maze generators (recursive division, Prim, randomized DFS), diagonal-movement toggle, custom grid input (rows, cols, walls, weights), play / pause / step-forward / step-back controls, visited / path / distance counters, and shareable grid URLs. 100% client-side.",
  category: "developer",
  keywords: [
    "pathfinding visualizer", "a star algorithm visualizer", "dijkstra visualizer",
    "maze solver online", "bfs dfs grid", "greedy best first search",
    "bidirectional bfs", "a* pathfinding", "grid pathfinding",
    "manhattan heuristic", "euclidean heuristic", "maze generator",
  ],
  icon: "navigation",
  requiresNetwork: false,
  seo: {
    title: "Pathfinding Algorithm Visualizer — A*, Dijkstra, BFS, DFS Grid | UnQTools",
    faq: [
      {
        q: "How does the pathfinding visualizer work?",
        a: "Each algorithm (BFS, DFS, Dijkstra, A*, Greedy Best-First, Bidirectional BFS) is implemented as a JavaScript generator function that yields a Step object on every node visit, frontier push, and path reconstruction. Each step carries the full grid snapshot plus running visited / frontier / path counters, so the UI can step forward and backward without re-running. The play head animates through the steps at your chosen speed, color-coding visited cells, the active frontier, the final path, and start / end markers.",
      },
      {
        q: "Which algorithms are supported and which are optimal?",
        a: "Six algorithms: BFS (optimal on unweighted grids), Dijkstra (optimal on weighted grids), A* (optimal with an admissible heuristic), Greedy Best-First (fast but NOT optimal), DFS (NOT optimal — included for contrast), and Bidirectional BFS (optimal on unweighted grids, often faster than BFS). Each algorithm has a metadata card showing whether it is optimal, complete, weighted, and its time / space complexity. Greedy and DFS are clearly marked non-optimal in the UI.",
      },
      {
        q: "Can I draw walls and weighted cells?",
        a: "Yes. Click a cell to toggle a wall (impassable). Shift-click (or use the weight tool) to cycle cell weight between 1 (default), 5, and 15. Weighted cells visibly change Dijkstra vs A* behavior — try a weight wall between start and end and watch Dijkstra route around it while Greedy may plow straight through. You can also drag the start and end markers to any open cell.",
      },
      {
        q: "What heuristics are available for A* and Greedy?",
        a: "Four heuristics: Manhattan (|dx|+|dy|, admissible for 4-direction movement), Euclidean (straight-line, admissible), Chebyshev (max(|dx|,|dy|), admissible for 8-direction movement), and Octile (admissible for 8-direction grid movement). For 4-direction grids, Manhattan is the tightest admissible heuristic; using Euclidean with 4-direction movement makes A* expand more nodes than necessary. An overestimating heuristic breaks optimality — the tool flags this in the info panel.",
      },
      {
        q: "What extra features does this tool have versus other pathfinding visualizers?",
        a: "(1) 6 algorithms including bidirectional BFS. (2) Generator-based step engine with full grid snapshots — true reverse-step fidelity. (3) 4 selectable heuristics for A* / Greedy with admissibility notes. (4) Paintable walls + 3 weight tiers. (5) Draggable start / end. (6) 3 maze generators (recursive division, Prim, randomized DFS). (7) 4-direction and 8-direction (diagonal) movement toggle. (8) Custom grid input (rows, cols, walls list, weights list). (9) Play / pause / step-forward / step-back / speed controls. (10) Visited / frontier / path / distance counters. (11) Binary-heap priority queue for Dijkstra / A* performance. (12) Side-by-side algorithm comparison table. (13) Color legend. (14) History (localStorage, last 20). (15) Shareable URL encoding grid + algorithm + heuristic. 100% client-side — no uploads, no ads.",
      },
    ],
  },
  status: "done",
};
