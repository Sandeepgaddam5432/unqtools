/**
 * Pathfinding Algorithm Visualizer — pure logic.
 *
 * Generator-based step engine for visualizing grid pathfinding algorithms
 * (BFS, DFS, Dijkstra, A*, Greedy Best-First, Bidirectional BFS). Each
 * algorithm yields a stream of Step objects — each carrying a full grid
 * snapshot, the visited set, the frontier, and running counters — so the UI
 * can step forward and backward without re-running. Pure functions only —
 * no DOM, no network.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AlgorithmId =
  | "bfs"
  | "dfs"
  | "dijkstra"
  | "astar"
  | "greedy"
  | "bidirectional";

export type HeuristicId =
  | "manhattan"
  | "euclidean"
  | "chebyshev"
  | "octile";

export type MazeId =
  | "recursive-division"
  | "prim"
  | "randomized-dfs"
  | "random-walls";

export type CellType = "empty" | "wall" | "start" | "end";

/** A grid cell. `weight` is the traversal cost (>=1); walls have weight 0. */
export interface Cell {
  row: number;
  col: number;
  type: CellType;
  weight: number;
}

export interface Grid {
  rows: number;
  cols: number;
  /** Flattened cells: index = row * cols + col. */
  cells: Cell[];
  start: { row: number; col: number };
  end: { row: number; col: number };
}

export type StepKind =
  | "visit"
  | "frontier"
  | "path"
  | "info"
  | "meet";

export interface Step {
  /** Newly visited cell this step (or null for info-only steps). */
  cell: { row: number; col: number } | null;
  /** All visited cells so far (flattened indices). */
  visited: number[];
  /** Current frontier (flattened indices). */
  frontier: number[];
  /** Final path so far (flattened indices) — populated on path reconstruction. */
  path: number[];
  /** Step kind for color coding. */
  kind: StepKind;
  /** Running visited-node count. */
  visitedCount: number;
  /** Running frontier size. */
  frontierCount: number;
  /** Current shortest known distance to the active cell (Infinity if unknown). */
  distance: number;
  /** Human-readable description. */
  description: string;
}

export interface AlgorithmInfo {
  id: AlgorithmId;
  name: string;
  weighted: boolean;
  optimal: boolean;
  complete: boolean;
  time: string;
  space: string;
  description: string;
}

export interface HeuristicInfo {
  id: HeuristicId;
  name: string;
  formula: string;
  admissible4: boolean;
  admissible8: boolean;
  description: string;
}

export interface MazeInfo {
  id: MazeId;
  name: string;
  description: string;
}

export interface RunResult {
  algorithm: AlgorithmId;
  steps: Step[];
  totalVisited: number;
  pathFound: boolean;
  pathLength: number;
  pathCost: number;
  error?: string;
}

// ---------------------------------------------------------------------------
// Algorithm metadata
// ---------------------------------------------------------------------------

export const ALGORITHMS: Record<AlgorithmId, AlgorithmInfo> = {
  bfs: {
    id: "bfs",
    name: "Breadth-First Search (BFS)",
    weighted: false,
    optimal: true,
    complete: true,
    time: "O(V + E)",
    space: "O(V)",
    description:
      "Explores cells in concentric rings outward from the start. Optimal on unweighted grids (every edge cost = 1). Ignores cell weights.",
  },
  dfs: {
    id: "dfs",
    name: "Depth-First Search (DFS)",
    weighted: false,
    optimal: false,
    complete: true,
    time: "O(V + E)",
    space: "O(V)",
    description:
      "Dives as deep as possible before backtracking. NOT optimal — finds a path, but rarely the shortest. Included for contrast.",
  },
  dijkstra: {
    id: "dijkstra",
    name: "Dijkstra",
    weighted: true,
    optimal: true,
    complete: true,
    time: "O((V + E) log V)",
    space: "O(V)",
    description:
      "Priority-queue (binary-heap) search that always expands the cheapest-known node. Optimal on weighted grids with non-negative weights.",
  },
  astar: {
    id: "astar",
    name: "A* Search",
    weighted: true,
    optimal: true,
    complete: true,
    time: "O((V + E) log V)",
    space: "O(V)",
    description:
      "Dijkstra + admissible heuristic. Expands f(n) = g(n) + h(n) where g is cost-so-far and h is estimated cost-to-go. Optimal when h never overestimates.",
  },
  greedy: {
    id: "greedy",
    name: "Greedy Best-First",
    weighted: false,
    optimal: false,
    complete: true,
    time: "O((V + E) log V)",
    space: "O(V)",
    description:
      "Expands the frontier node with lowest h(n) only. Fast on average but NOT optimal — can be lured into a dead end by the heuristic.",
  },
  bidirectional: {
    id: "bidirectional",
    name: "Bidirectional BFS",
    weighted: false,
    optimal: true,
    complete: true,
    time: "O(b^(d/2))",
    space: "O(b^(d/2))",
    description:
      "Two BFS fronts — one from start, one from end — meeting in the middle. Optimal on unweighted grids and typically explores far fewer nodes than vanilla BFS.",
  },
};

export const HEURISTICS: Record<HeuristicId, HeuristicInfo> = {
  manhattan: {
    id: "manhattan",
    name: "Manhattan",
    formula: "|dx| + |dy|",
    admissible4: true,
    admissible8: true,
    description:
      "Grid distance with 4-direction movement. Tightest admissible heuristic for 4-dir grids; loose for 8-dir.",
  },
  euclidean: {
    id: "euclidean",
    name: "Euclidean",
    formula: "sqrt(dx² + dy²)",
    admissible4: true,
    admissible8: true,
    description:
      "Straight-line distance. Always admissible but loose on 4-dir grids (expands more nodes than Manhattan).",
  },
  chebyshev: {
    id: "chebyshev",
    name: "Chebyshev",
    formula: "max(|dx|, |dy|)",
    admissible4: false,
    admissible8: true,
    description:
      "King-move distance. Overestimates on 4-dir grids (breaks optimality), tight for 8-dir uniform-cost grids.",
  },
  octile: {
    id: "octile",
    name: "Octile",
    formula: "max(|dx|,|dy|) + (√2 − 1)·min(|dx|,|dy|)",
    admissible4: false,
    admissible8: true,
    description:
      "Octile distance — exact for 8-direction movement with diagonal cost √2. Overestimates on 4-dir grids.",
  },
};

export const MAZES: Record<MazeId, MazeInfo> = {
  "recursive-division": {
    id: "recursive-division",
    name: "Recursive Division",
    description:
      "Starts with an empty grid and recursively adds walls with a single gap, halving the chamber each step. Produces long straight corridors.",
  },
  prim: {
    id: "prim",
    name: "Randomized Prim",
    description:
      "Grows a maze from a random seed by adding walls between frontier cells with Prim's algorithm. Produces dense, branching mazes.",
  },
  "randomized-dfs": {
    id: "randomized-dfs",
    name: "Randomized DFS",
    description:
      "Iterative DFS that carves passages by choosing random unvisited neighbors. Produces long winding corridors with few branches.",
  },
  "random-walls": {
    id: "random-walls",
    name: "Random Walls",
    description:
      "Randomly marks ~28% of non-start, non-end cells as walls. Useful for stress-testing algorithm behavior on noise.",
  },
};

export const ALGORITHM_LIST = Object.keys(ALGORITHMS) as AlgorithmId[];
export const HEURISTIC_LIST = Object.keys(HEURISTICS) as HeuristicId[];
export const MAZE_LIST = Object.keys(MAZES) as MazeId[];

// ---------------------------------------------------------------------------
// Grid construction
// ---------------------------------------------------------------------------

export function makeGrid(rows: number, cols: number, start?: { row: number; col: number }, end?: { row: number; col: number }): Grid {
  const r = Math.max(2, Math.floor(rows));
  const c = Math.max(2, Math.floor(cols));
  const s = start ?? { row: Math.floor(r / 2), col: 1 };
  const e = end ?? { row: Math.floor(r / 2), col: c - 2 };
  const cells: Cell[] = [];
  for (let row = 0; row < r; row++) {
    for (let col = 0; col < c; col++) {
      let type: CellType = "empty";
      if (row === s.row && col === s.col) type = "start";
      else if (row === e.row && col === e.col) type = "end";
      cells.push({ row, col, type, weight: 1 });
    }
  }
  return { rows: r, cols: c, cells, start: s, end: e };
}

export function cloneGrid(grid: Grid): Grid {
  return {
    rows: grid.rows,
    cols: grid.cols,
    start: { ...grid.start },
    end: { ...grid.end },
    cells: grid.cells.map((cell) => ({ ...cell })),
  };
}

export function idx(grid: Grid, row: number, col: number): number {
  return row * grid.cols + col;
}

export function cellAt(grid: Grid, row: number, col: number): Cell | null {
  if (row < 0 || row >= grid.rows || col < 0 || col >= grid.cols) return null;
  return grid.cells[idx(grid, row, col)];
}

export function isWall(grid: Grid, row: number, col: number): boolean {
  const c = cellAt(grid, row, col);
  return c === null || c.type === "wall";
}

export function isPassable(grid: Grid, row: number, col: number): boolean {
  return !isWall(grid, row, col);
}

export function setWall(grid: Grid, row: number, col: number, isWallFlag: boolean): Grid {
  const next = cloneGrid(grid);
  const c = cellAt(next, row, col);
  if (!c) return next;
  if (c.type === "start" || c.type === "end") return next;
  c.type = isWallFlag ? "wall" : "empty";
  if (isWallFlag) c.weight = 0;
  else c.weight = 1;
  return next;
}

export function setWeight(grid: Grid, row: number, col: number, weight: number): Grid {
  const next = cloneGrid(grid);
  const c = cellAt(next, row, col);
  if (!c) return next;
  if (c.type === "start" || c.type === "end" || c.type === "wall") return next;
  c.weight = Math.max(1, Math.floor(weight));
  return next;
}

export function cycleWeight(grid: Grid, row: number, col: number): Grid {
  const c = cellAt(grid, row, col);
  if (!c || c.type === "start" || c.type === "end" || c.type === "wall") return grid;
  const tiers = [1, 5, 15];
  const i = tiers.indexOf(c.weight);
  const nextWeight = tiers[(i + 1) % tiers.length];
  return setWeight(grid, row, col, nextWeight);
}

export function setStart(grid: Grid, row: number, col: number): Grid {
  const c = cellAt(grid, row, col);
  if (!c || c.type === "wall" || c.type === "end") return grid;
  const next = cloneGrid(grid);
  // Clear old start
  const old = next.cells[idx(next, next.start.row, next.start.col)];
  if (old && old.type === "start") old.type = "empty";
  next.start = { row, col };
  next.cells[idx(next, row, col)].type = "start";
  return next;
}

export function setEnd(grid: Grid, row: number, col: number): Grid {
  const c = cellAt(grid, row, col);
  if (!c || c.type === "wall" || c.type === "start") return grid;
  const next = cloneGrid(grid);
  const old = next.cells[idx(next, next.end.row, next.end.col)];
  if (old && old.type === "end") old.type = "empty";
  next.end = { row, col };
  next.cells[idx(next, row, col)].type = "end";
  return next;
}

export function clearWallsAndWeights(grid: Grid): Grid {
  const next = cloneGrid(grid);
  for (const c of next.cells) {
    if (c.type === "wall" || c.type === "empty") {
      c.type = "empty";
      c.weight = 1;
    }
  }
  return next;
}

// ---------------------------------------------------------------------------
// Heuristics
// ---------------------------------------------------------------------------

export function heuristic(
  a: { row: number; col: number },
  b: { row: number; col: number },
  id: HeuristicId,
): number {
  const dx = Math.abs(a.col - b.col);
  const dy = Math.abs(a.row - b.row);
  switch (id) {
    case "manhattan":
      return dx + dy;
    case "euclidean":
      return Math.sqrt(dx * dx + dy * dy);
    case "chebyshev":
      return Math.max(dx, dy);
    case "octile": {
      const F = Math.SQRT2 - 1;
      return dx > dy ? F * dy + dx : F * dx + dy;
    }
  }
}

// ---------------------------------------------------------------------------
// Neighbors
// ---------------------------------------------------------------------------

const DIRS4 = [
  { dr: -1, dc: 0 },
  { dr: 1, dc: 0 },
  { dr: 0, dc: -1 },
  { dr: 0, dc: 1 },
];

const DIRS8 = [
  ...DIRS4,
  { dr: -1, dc: -1 },
  { dr: -1, dc: 1 },
  { dr: 1, dc: -1 },
  { dr: 1, dc: 1 },
];

export function neighbors(
  grid: Grid,
  row: number,
  col: number,
  diagonal: boolean,
): { row: number; col: number; cost: number }[] {
  const dirs = diagonal ? DIRS8 : DIRS4;
  const out: { row: number; col: number; cost: number }[] = [];
  for (const d of dirs) {
    const nr = row + d.dr;
    const nc = col + d.dc;
    const c = cellAt(grid, nr, nc);
    if (!c || c.type === "wall") continue;
    if (diagonal && d.dr !== 0 && d.dc !== 0) {
      // Prevent diagonal corner-cutting through walls.
      if (isWall(grid, row + d.dr, col) && isWall(grid, row, col + d.dc)) continue;
      out.push({ row: nr, col: nc, cost: c.weight * Math.SQRT2 });
    } else {
      out.push({ row: nr, col: nc, cost: c.weight });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Binary min-heap priority queue (for Dijkstra / A* / Greedy)
// ---------------------------------------------------------------------------

interface HeapItem {
  key: number;
  node: number;
}

class MinHeap {
  private items: HeapItem[] = [];

  get size(): number { return this.items.length; }

  push(key: number, node: number): void {
    this.items.push({ key, node });
    this.bubbleUp(this.items.length - 1);
  }

  pop(): HeapItem | undefined {
    if (this.items.length === 0) return undefined;
    const top = this.items[0];
    const last = this.items.pop()!;
    if (this.items.length > 0) {
      this.items[0] = last;
      this.sinkDown(0);
    }
    return top;
  }

  private bubbleUp(i: number): void {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.items[parent].key <= this.items[i].key) break;
      [this.items[parent], this.items[i]] = [this.items[i], this.items[parent]];
      i = parent;
    }
  }

  private sinkDown(i: number): void {
    const n = this.items.length;
    for (;;) {
      const l = 2 * i + 1;
      const r = 2 * i + 2;
      let smallest = i;
      if (l < n && this.items[l].key < this.items[smallest].key) smallest = l;
      if (r < n && this.items[r].key < this.items[smallest].key) smallest = r;
      if (smallest === i) break;
      [this.items[smallest], this.items[i]] = [this.items[i], this.items[smallest]];
      i = smallest;
    }
  }
}

// ---------------------------------------------------------------------------
// Step helpers
// ---------------------------------------------------------------------------

function reconstructPath(
  cameFrom: Map<number, number>,
  end: number,
): number[] {
  const path: number[] = [];
  let cur: number | undefined = end;
  while (cur !== undefined) {
    path.push(cur);
    cur = cameFrom.get(cur);
  }
  path.reverse();
  return path;
}

// ---------------------------------------------------------------------------
// Algorithms (generator-based)
// ---------------------------------------------------------------------------

/** BFS — optimal on unweighted grids. */
export function* bfsGen(grid: Grid, diagonal: boolean): Generator<Step> {
  const startI = idx(grid, grid.start.row, grid.start.col);
  const endI = idx(grid, grid.end.row, grid.end.col);
  const visited = new Set<number>([startI]);
  const cameFrom = new Map<number, number>();
  const queue: number[] = [startI];

  yield {
    cell: { row: grid.start.row, col: grid.start.col },
    visited: [startI],
    frontier: [startI],
    path: [],
    kind: "visit",
    visitedCount: 1,
    frontierCount: 1,
    distance: 0,
    description: "Start BFS — enqueue start node.",
  };

  while (queue.length > 0) {
    const cur = queue.shift()!;
    const curCell = grid.cells[cur];
    if (cur === endI) {
      const path = reconstructPath(cameFrom, endI);
      for (let i = 0; i < path.length; i++) {
        const pc = grid.cells[path[i]];
        yield {
          cell: { row: pc.row, col: pc.col },
          visited: [...visited],
          frontier: [],
          path: path.slice(0, i + 1),
          kind: "path",
          visitedCount: visited.size,
          frontierCount: queue.length,
          distance: i,
          description: `Reconstruct path step ${i + 1}/${path.length}.`,
        };
      }
      return;
    }
    const nbrs = neighbors(grid, curCell.row, curCell.col, diagonal);
    for (const n of nbrs) {
      const ni = idx(grid, n.row, n.col);
      if (visited.has(ni)) continue;
      visited.add(ni);
      cameFrom.set(ni, cur);
      queue.push(ni);
      yield {
        cell: { row: n.row, col: n.col },
        visited: [...visited],
        frontier: [...queue],
        path: [],
        kind: "visit",
        visitedCount: visited.size,
        frontierCount: queue.length,
        distance: 0,
        description: `Visit (${n.row},${n.col}) from (${curCell.row},${curCell.col}).`,
      };
    }
  }

  yield {
    cell: null,
    visited: [...visited],
    frontier: [],
    path: [],
    kind: "info",
    visitedCount: visited.size,
    frontierCount: 0,
    distance: Infinity,
    description: "No path found.",
  };
}

/** DFS — NOT optimal, included for contrast. */
export function* dfsGen(grid: Grid, diagonal: boolean): Generator<Step> {
  const startI = idx(grid, grid.start.row, grid.start.col);
  const endI = idx(grid, grid.end.row, grid.end.col);
  const visited = new Set<number>();
  const cameFrom = new Map<number, number>();
  const stack: number[] = [startI];

  yield {
    cell: { row: grid.start.row, col: grid.start.col },
    visited: [],
    frontier: [startI],
    path: [],
    kind: "visit",
    visitedCount: 0,
    frontierCount: 1,
    distance: 0,
    description: "Start DFS — push start node onto stack.",
  };

  while (stack.length > 0) {
    const cur = stack.pop()!;
    if (visited.has(cur)) continue;
    visited.add(cur);
    const curCell = grid.cells[cur];
    yield {
      cell: { row: curCell.row, col: curCell.col },
      visited: [...visited],
      frontier: [...stack],
      path: [],
      kind: "visit",
      visitedCount: visited.size,
      frontierCount: stack.length,
      distance: 0,
      description: `Pop and visit (${curCell.row},${curCell.col}).`,
    };
    if (cur === endI) {
      const path = reconstructPath(cameFrom, endI);
      for (let i = 0; i < path.length; i++) {
        const pc = grid.cells[path[i]];
        yield {
          cell: { row: pc.row, col: pc.col },
          visited: [...visited],
          frontier: [],
          path: path.slice(0, i + 1),
          kind: "path",
          visitedCount: visited.size,
          frontierCount: 0,
          distance: i,
          description: `Reconstruct path step ${i + 1}/${path.length}.`,
        };
      }
      return;
    }
    const nbrs = neighbors(grid, curCell.row, curCell.col, diagonal);
    // Reverse so the first neighbor is popped first (more natural order).
    for (let i = nbrs.length - 1; i >= 0; i--) {
      const n = nbrs[i];
      const ni = idx(grid, n.row, n.col);
      if (visited.has(ni)) continue;
      if (!cameFrom.has(ni)) cameFrom.set(ni, cur);
      stack.push(ni);
    }
  }

  yield {
    cell: null,
    visited: [...visited],
    frontier: [],
    path: [],
    kind: "info",
    visitedCount: visited.size,
    frontierCount: 0,
    distance: Infinity,
    description: "No path found.",
  };
}

/** Dijkstra — optimal on weighted grids. */
export function* dijkstraGen(grid: Grid, diagonal: boolean): Generator<Step> {
  const startI = idx(grid, grid.start.row, grid.start.col);
  const endI = idx(grid, grid.end.row, grid.end.col);
  const dist = new Map<number, number>([[startI, 0]]);
  const cameFrom = new Map<number, number>();
  const visited = new Set<number>();
  const heap = new MinHeap();
  heap.push(0, startI);
  const inFrontier = new Set<number>([startI]);

  yield {
    cell: { row: grid.start.row, col: grid.start.col },
    visited: [],
    frontier: [startI],
    path: [],
    kind: "visit",
    visitedCount: 0,
    frontierCount: 1,
    distance: 0,
    description: "Start Dijkstra — push start with distance 0.",
  };

  while (heap.size > 0) {
    const top = heap.pop()!;
    const cur = top.node;
    if (visited.has(cur)) continue;
    visited.add(cur);
    inFrontier.delete(cur);
    const curCell = grid.cells[cur];
    const curDist = dist.get(cur) ?? Infinity;
    yield {
      cell: { row: curCell.row, col: curCell.col },
      visited: [...visited],
      frontier: [...inFrontier],
      path: [],
      kind: "visit",
      visitedCount: visited.size,
      frontierCount: inFrontier.size,
      distance: curDist,
      description: `Pop (${curCell.row},${curCell.col}) with g=${curDist.toFixed(2)}.`,
    };
    if (cur === endI) {
      const path = reconstructPath(cameFrom, endI);
      for (let i = 0; i < path.length; i++) {
        const pc = grid.cells[path[i]];
        yield {
          cell: { row: pc.row, col: pc.col },
          visited: [...visited],
          frontier: [],
          path: path.slice(0, i + 1),
          kind: "path",
          visitedCount: visited.size,
          frontierCount: 0,
          distance: curDist,
          description: `Reconstruct path step ${i + 1}/${path.length}.`,
        };
      }
      return;
    }
    const nbrs = neighbors(grid, curCell.row, curCell.col, diagonal);
    for (const n of nbrs) {
      const ni = idx(grid, n.row, n.col);
      if (visited.has(ni)) continue;
      const nd = curDist + n.cost;
      if (nd < (dist.get(ni) ?? Infinity)) {
        dist.set(ni, nd);
        cameFrom.set(ni, cur);
        heap.push(nd, ni);
        inFrontier.add(ni);
        yield {
          cell: { row: n.row, col: n.col },
          visited: [...visited],
          frontier: [...inFrontier],
          path: [],
          kind: "frontier",
          visitedCount: visited.size,
          frontierCount: inFrontier.size,
          distance: nd,
          description: `Relax (${n.row},${n.col}) → g=${nd.toFixed(2)}.`,
        };
      }
    }
  }

  yield {
    cell: null,
    visited: [...visited],
    frontier: [],
    path: [],
    kind: "info",
    visitedCount: visited.size,
    frontierCount: 0,
    distance: Infinity,
    description: "No path found.",
  };
}

/** A* — optimal with admissible heuristic. */
export function* astarGen(grid: Grid, diagonal: boolean, heuristicId: HeuristicId): Generator<Step> {
  const startI = idx(grid, grid.start.row, grid.start.col);
  const endI = idx(grid, grid.end.row, grid.end.col);
  const g = new Map<number, number>([[startI, 0]]);
  const cameFrom = new Map<number, number>();
  const visited = new Set<number>();
  const heap = new MinHeap();
  const h0 = heuristic(grid.start, grid.end, heuristicId);
  heap.push(h0, startI);
  const inFrontier = new Set<number>([startI]);

  yield {
    cell: { row: grid.start.row, col: grid.start.col },
    visited: [],
    frontier: [startI],
    path: [],
    kind: "visit",
    visitedCount: 0,
    frontierCount: 1,
    distance: 0,
    description: `Start A* with ${HEURISTICS[heuristicId].name} heuristic. f(start)=${h0.toFixed(2)}.`,
  };

  while (heap.size > 0) {
    const top = heap.pop()!;
    const cur = top.node;
    if (visited.has(cur)) continue;
    visited.add(cur);
    inFrontier.delete(cur);
    const curCell = grid.cells[cur];
    const curG = g.get(cur) ?? Infinity;
    yield {
      cell: { row: curCell.row, col: curCell.col },
      visited: [...visited],
      frontier: [...inFrontier],
      path: [],
      kind: "visit",
      visitedCount: visited.size,
      frontierCount: inFrontier.size,
      distance: curG,
      description: `Pop (${curCell.row},${curCell.col}) g=${curG.toFixed(2)}.`,
    };
    if (cur === endI) {
      const path = reconstructPath(cameFrom, endI);
      for (let i = 0; i < path.length; i++) {
        const pc = grid.cells[path[i]];
        yield {
          cell: { row: pc.row, col: pc.col },
          visited: [...visited],
          frontier: [],
          path: path.slice(0, i + 1),
          kind: "path",
          visitedCount: visited.size,
          frontierCount: 0,
          distance: curG,
          description: `Reconstruct path step ${i + 1}/${path.length}.`,
        };
      }
      return;
    }
    const nbrs = neighbors(grid, curCell.row, curCell.col, diagonal);
    for (const n of nbrs) {
      const ni = idx(grid, n.row, n.col);
      if (visited.has(ni)) continue;
      const ng = curG + n.cost;
      if (ng < (g.get(ni) ?? Infinity)) {
        g.set(ni, ng);
        cameFrom.set(ni, cur);
        const h = heuristic({ row: n.row, col: n.col }, grid.end, heuristicId);
        const f = ng + h;
        heap.push(f, ni);
        inFrontier.add(ni);
        yield {
          cell: { row: n.row, col: n.col },
          visited: [...visited],
          frontier: [...inFrontier],
          path: [],
          kind: "frontier",
          visitedCount: visited.size,
          frontierCount: inFrontier.size,
          distance: ng,
          description: `Relax (${n.row},${n.col}) g=${ng.toFixed(2)} h=${h.toFixed(2)} f=${f.toFixed(2)}.`,
        };
      }
    }
  }

  yield {
    cell: null,
    visited: [...visited],
    frontier: [],
    path: [],
    kind: "info",
    visitedCount: visited.size,
    frontierCount: 0,
    distance: Infinity,
    description: "No path found.",
  };
}

/** Greedy Best-First — fast but NOT optimal. */
export function* greedyGen(grid: Grid, diagonal: boolean, heuristicId: HeuristicId): Generator<Step> {
  const startI = idx(grid, grid.start.row, grid.start.col);
  const endI = idx(grid, grid.end.row, grid.end.col);
  const cameFrom = new Map<number, number>();
  const visited = new Set<number>();
  const heap = new MinHeap();
  const h0 = heuristic(grid.start, grid.end, heuristicId);
  heap.push(h0, startI);
  const inFrontier = new Set<number>([startI]);

  yield {
    cell: { row: grid.start.row, col: grid.start.col },
    visited: [],
    frontier: [startI],
    path: [],
    kind: "visit",
    visitedCount: 0,
    frontierCount: 1,
    distance: 0,
    description: `Start Greedy Best-First with ${HEURISTICS[heuristicId].name} heuristic. h(start)=${h0.toFixed(2)}.`,
  };

  while (heap.size > 0) {
    const top = heap.pop()!;
    const cur = top.node;
    if (visited.has(cur)) continue;
    visited.add(cur);
    inFrontier.delete(cur);
    const curCell = grid.cells[cur];
    yield {
      cell: { row: curCell.row, col: curCell.col },
      visited: [...visited],
      frontier: [...inFrontier],
      path: [],
      kind: "visit",
      visitedCount: visited.size,
      frontierCount: inFrontier.size,
      distance: 0,
      description: `Pop (${curCell.row},${curCell.col}) by lowest h.`,
    };
    if (cur === endI) {
      const path = reconstructPath(cameFrom, endI);
      for (let i = 0; i < path.length; i++) {
        const pc = grid.cells[path[i]];
        yield {
          cell: { row: pc.row, col: pc.col },
          visited: [...visited],
          frontier: [],
          path: path.slice(0, i + 1),
          kind: "path",
          visitedCount: visited.size,
          frontierCount: 0,
          distance: i,
          description: `Reconstruct path step ${i + 1}/${path.length}.`,
        };
      }
      return;
    }
    const nbrs = neighbors(grid, curCell.row, curCell.col, diagonal);
    for (const n of nbrs) {
      const ni = idx(grid, n.row, n.col);
      if (visited.has(ni) || inFrontier.has(ni)) continue;
      cameFrom.set(ni, cur);
      const h = heuristic({ row: n.row, col: n.col }, grid.end, heuristicId);
      heap.push(h, ni);
      inFrontier.add(ni);
      yield {
        cell: { row: n.row, col: n.col },
        visited: [...visited],
        frontier: [...inFrontier],
        path: [],
        kind: "frontier",
        visitedCount: visited.size,
        frontierCount: inFrontier.size,
        distance: 0,
        description: `Push (${n.row},${n.col}) h=${h.toFixed(2)}.`,
      };
    }
  }

  yield {
    cell: null,
    visited: [...visited],
    frontier: [],
    path: [],
    kind: "info",
    visitedCount: visited.size,
    frontierCount: 0,
    distance: Infinity,
    description: "No path found.",
  };
}

/** Bidirectional BFS — optimal on unweighted grids. */
export function* bidirectionalGen(grid: Grid, diagonal: boolean): Generator<Step> {
  const startI = idx(grid, grid.start.row, grid.start.col);
  const endI = idx(grid, grid.end.row, grid.end.col);
  const visitedF = new Set<number>([startI]);
  const visitedB = new Set<number>([endI]);
  const cameF = new Map<number, number>();
  const cameB = new Map<number, number>();
  const queueF: number[] = [startI];
  const queueB: number[] = [endI];

  yield {
    cell: { row: grid.start.row, col: grid.start.col },
    visited: [startI],
    frontier: [startI, endI],
    path: [],
    kind: "visit",
    visitedCount: 1,
    frontierCount: 2,
    distance: 0,
    description: "Start Bidirectional BFS — forward and backward fronts.",
  };

  while (queueF.length > 0 && queueB.length > 0) {
    // Forward step.
    const curF = queueF.shift()!;
    const cellF = grid.cells[curF];
    const nbrsF = neighbors(grid, cellF.row, cellF.col, diagonal);
    for (const n of nbrsF) {
      const ni = idx(grid, n.row, n.col);
      if (visitedF.has(ni)) continue;
      visitedF.add(ni);
      cameF.set(ni, curF);
      queueF.push(ni);
      yield {
        cell: { row: n.row, col: n.col },
        visited: [...visitedF, ...visitedB],
        frontier: [...queueF, ...queueB],
        path: [],
        kind: "visit",
        visitedCount: visitedF.size + visitedB.size,
        frontierCount: queueF.length + queueB.length,
        distance: 0,
        description: `Forward visit (${n.row},${n.col}).`,
      };
      if (visitedB.has(ni)) {
        // Meeting point — reconstruct path.
        const pathF = reconstructPath(cameF, ni);
        const pathB = reconstructPath(cameB, ni);
        pathB.reverse();
        pathB.shift(); // remove duplicate meeting node
        const full = [...pathF, ...pathB];
        for (let i = 0; i < full.length; i++) {
          const pc = grid.cells[full[i]];
          yield {
            cell: { row: pc.row, col: pc.col },
            visited: [...visitedF, ...visitedB],
            frontier: [],
            path: full.slice(0, i + 1),
            kind: "path",
            visitedCount: visitedF.size + visitedB.size,
            frontierCount: 0,
            distance: i,
            description: `Path reconstructed (${i + 1}/${full.length}).`,
          };
        }
        return;
      }
    }

    // Backward step.
    const curB = queueB.shift()!;
    const cellB = grid.cells[curB];
    const nbrsB = neighbors(grid, cellB.row, cellB.col, diagonal);
    for (const n of nbrsB) {
      const ni = idx(grid, n.row, n.col);
      if (visitedB.has(ni)) continue;
      visitedB.add(ni);
      cameB.set(ni, curB);
      queueB.push(ni);
      yield {
        cell: { row: n.row, col: n.col },
        visited: [...visitedF, ...visitedB],
        frontier: [...queueF, ...queueB],
        path: [],
        kind: "visit",
        visitedCount: visitedF.size + visitedB.size,
        frontierCount: queueF.length + queueB.length,
        distance: 0,
        description: `Backward visit (${n.row},${n.col}).`,
      };
      if (visitedF.has(ni)) {
        const pathF = reconstructPath(cameF, ni);
        const pathB = reconstructPath(cameB, ni);
        pathB.reverse();
        pathB.shift();
        const full = [...pathF, ...pathB];
        for (let i = 0; i < full.length; i++) {
          const pc = grid.cells[full[i]];
          yield {
            cell: { row: pc.row, col: pc.col },
            visited: [...visitedF, ...visitedB],
            frontier: [],
            path: full.slice(0, i + 1),
            kind: "path",
            visitedCount: visitedF.size + visitedB.size,
            frontierCount: 0,
            distance: i,
            description: `Path reconstructed (${i + 1}/${full.length}).`,
          };
        }
        return;
      }
    }
  }

  yield {
    cell: null,
    visited: [...visitedF, ...visitedB],
    frontier: [],
    path: [],
    kind: "info",
    visitedCount: visitedF.size + visitedB.size,
    frontierCount: 0,
    distance: Infinity,
    description: "No path found.",
  };
}

// ---------------------------------------------------------------------------
// Run dispatcher
// ---------------------------------------------------------------------------

export function runAlgorithm(
  algorithm: AlgorithmId,
  grid: Grid,
  diagonal: boolean,
  heuristicId: HeuristicId = "manhattan",
): RunResult {
  let gen: Generator<Step>;
  switch (algorithm) {
    case "bfs": gen = bfsGen(grid, diagonal); break;
    case "dfs": gen = dfsGen(grid, diagonal); break;
    case "dijkstra": gen = dijkstraGen(grid, diagonal); break;
    case "astar": gen = astarGen(grid, diagonal, heuristicId); break;
    case "greedy": gen = greedyGen(grid, diagonal, heuristicId); break;
    case "bidirectional": gen = bidirectionalGen(grid, diagonal); break;
  }
  const steps: Step[] = [];
  for (const s of gen) steps.push(s);
  const last = steps[steps.length - 1];
  const pathFound = last ? last.kind === "path" || last.path.length > 0 : false;
  const pathLength = pathFound && last ? last.path.length : 0;
  // Path cost — only meaningful for weighted algorithms. We compute by
  // summing cell weights along the final path.
  let pathCost = 0;
  if (pathFound && last) {
    for (const i of last.path) {
      pathCost += grid.cells[i].weight;
    }
  }
  // Count unique visited cells (more accurate than last.visitedCount which
  // may double-count in bidirectional).
  const totalVisited = last ? new Set(last.visited).size : 0;
  return {
    algorithm,
    steps,
    totalVisited,
    pathFound,
    pathLength,
    pathCost,
  };
}

/** Run all algorithms on the same grid for side-by-side comparison. */
export function compareAll(
  grid: Grid,
  diagonal: boolean,
  heuristicId: HeuristicId = "manhattan",
): { algorithm: AlgorithmId; result: RunResult }[] {
  return ALGORITHM_LIST.map((alg) => ({
    algorithm: alg,
    result: runAlgorithm(alg, grid, diagonal, heuristicId),
  }));
}

// ---------------------------------------------------------------------------
// Maze generators
// ---------------------------------------------------------------------------

/** Deterministic seeded PRNG (mulberry32) — reproducible mazes. */
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

export function generateMaze(grid: Grid, maze: MazeId, seed: number = 1): Grid {
  switch (maze) {
    case "recursive-division": return recursiveDivisionMaze(grid, seed);
    case "prim": return primMaze(grid, seed);
    case "randomized-dfs": return randomizedDfsMaze(grid, seed);
    case "random-walls": return randomWallsMaze(grid, seed);
  }
}

function recursiveDivisionMaze(grid: Grid, seed: number): Grid {
  const next = cloneGrid(grid);
  const rand = mulberry32(seed);
  const startI = idx(next, next.start.row, next.start.col);
  const endI = idx(next, next.end.row, next.end.col);

  function divide(r1: number, r2: number, c1: number, c2: number) {
    if (r2 - r1 < 2 || c2 - c1 < 2) return;
    const horizontal = r2 - r1 > c2 - c1 ? true : (c2 - c1 > r2 - r1 ? false : rand() < 0.5);
    if (horizontal) {
      const wallRow = r1 + 1 + Math.floor(rand() * (r2 - r1 - 1));
      const gapCol = c1 + Math.floor(rand() * (c2 - c1 + 1));
      for (let c = c1; c <= c2; c++) {
        const i = wallRow * next.cols + c;
        if (i === startI || i === endI) continue;
        next.cells[i].type = "wall";
        next.cells[i].weight = 0;
      }
      const gapI = wallRow * next.cols + gapCol;
      if (next.cells[gapI].type === "wall") {
        next.cells[gapI].type = "empty";
        next.cells[gapI].weight = 1;
      }
      divide(r1, wallRow - 1, c1, c2);
      divide(wallRow + 1, r2, c1, c2);
    } else {
      const wallCol = c1 + 1 + Math.floor(rand() * (c2 - c1 - 1));
      const gapRow = r1 + Math.floor(rand() * (r2 - r1 + 1));
      for (let r = r1; r <= r2; r++) {
        const i = r * next.cols + wallCol;
        if (i === startI || i === endI) continue;
        next.cells[i].type = "wall";
        next.cells[i].weight = 0;
      }
      const gapI = gapRow * next.cols + wallCol;
      if (next.cells[gapI].type === "wall") {
        next.cells[gapI].type = "empty";
        next.cells[gapI].weight = 1;
      }
      divide(r1, r2, c1, wallCol - 1);
      divide(r1, r2, wallCol + 1, c2);
    }
  }

  divide(0, next.rows - 1, 0, next.cols - 1);
  return next;
}

function primMaze(grid: Grid, seed: number): Grid {
  // Start with all walls, then carve passages.
  const next = cloneGrid(grid);
  const rand = mulberry32(seed);
  const startI = idx(next, next.start.row, next.start.col);
  const endI = idx(next, next.end.row, next.end.col);
  for (const c of next.cells) {
    if (c.type === "start" || c.type === "end") continue;
    c.type = "wall";
    c.weight = 0;
  }
  const visited = new Set<number>();
  const frontier: number[] = [];
  const seedCell = startI;
  visited.add(seedCell);
  next.cells[seedCell].type = "start";
  next.cells[seedCell].weight = 1;
  const addFrontier = (i: number) => {
    const cell = next.cells[i];
    for (const d of DIRS4) {
      const nr = cell.row + d.dr;
      const nc = cell.col + d.dc;
      if (nr < 0 || nr >= next.rows || nc < 0 || nc >= next.cols) continue;
      const ni = nr * next.cols + nc;
      if (!visited.has(ni) && !frontier.includes(ni)) frontier.push(ni);
    }
  };
  addFrontier(seedCell);
  while (frontier.length > 0) {
    const pick = Math.floor(rand() * frontier.length);
    const ci = frontier.splice(pick, 1)[0];
    if (visited.has(ci)) continue;
    // Find a visited neighbor to connect to.
    const cell = next.cells[ci];
    const visitedNbrs: number[] = [];
    for (const d of DIRS4) {
      const nr = cell.row + d.dr;
      const nc = cell.col + d.dc;
      if (nr < 0 || nr >= next.rows || nc < 0 || nc >= next.cols) continue;
      const ni = nr * next.cols + nc;
      if (visited.has(ni)) visitedNbrs.push(ni);
    }
    if (visitedNbrs.length === 0) continue;
    if (ci !== endI) {
      next.cells[ci].type = "empty";
      next.cells[ci].weight = 1;
    }
    visited.add(ci);
    addFrontier(ci);
  }
  // Ensure end is open.
  next.cells[endI].type = "end";
  next.cells[endI].weight = 1;
  return next;
}

function randomizedDfsMaze(grid: Grid, seed: number): Grid {
  const next = cloneGrid(grid);
  const rand = mulberry32(seed);
  const startI = idx(next, next.start.row, next.start.col);
  const endI = idx(next, next.end.row, next.end.col);
  for (const c of next.cells) {
    if (c.type === "start" || c.type === "end") continue;
    c.type = "wall";
    c.weight = 0;
  }
  const visited = new Set<number>([startI]);
  const stack: number[] = [startI];
  while (stack.length > 0) {
    const cur = stack[stack.length - 1];
    const cell = next.cells[cur];
    const candidates: number[] = [];
    // Step 2 cells at a time so walls separate corridors.
    for (const d of DIRS4) {
      const nr = cell.row + d.dr * 2;
      const nc = cell.col + d.dc * 2;
      if (nr < 0 || nr >= next.rows || nc < 0 || nc >= next.cols) continue;
      const ni = nr * next.cols + nc;
      if (!visited.has(ni)) candidates.push(ni);
    }
    if (candidates.length === 0) {
      stack.pop();
      continue;
    }
    const pick = candidates[Math.floor(rand() * candidates.length)];
    // Carve wall between cur and pick.
    const pickCell = next.cells[pick];
    const wallR = (cell.row + pickCell.row) / 2;
    const wallC = (cell.col + pickCell.col) / 2;
    const wallI = wallR * next.cols + wallC;
    if (wallI !== startI && wallI !== endI) {
      next.cells[wallI].type = "empty";
      next.cells[wallI].weight = 1;
    }
    if (pick !== endI) {
      next.cells[pick].type = "empty";
      next.cells[pick].weight = 1;
    }
    visited.add(pick);
    stack.push(pick);
  }
  // Ensure end is reachable: open one of its 4-neighbors.
  const endCell = next.cells[endI];
  let opened = false;
  for (const d of DIRS4) {
    const nr = endCell.row + d.dr;
    const nc = endCell.col + d.dc;
    if (nr < 0 || nr >= next.rows || nc < 0 || nc >= next.cols) continue;
    const ni = nr * next.cols + nc;
    if (next.cells[ni].type !== "wall") { opened = true; break; }
  }
  if (!opened) {
    for (const d of DIRS4) {
      const nr = endCell.row + d.dr;
      const nc = endCell.col + d.dc;
      if (nr < 0 || nr >= next.rows || nc < 0 || nc >= next.cols) continue;
      const ni = nr * next.cols + nc;
      if (ni !== startI) {
        next.cells[ni].type = "empty";
        next.cells[ni].weight = 1;
        break;
      }
    }
  }
  next.cells[endI].type = "end";
  next.cells[endI].weight = 1;
  return next;
}

function randomWallsMaze(grid: Grid, seed: number): Grid {
  const next = cloneGrid(grid);
  const rand = mulberry32(seed);
  const startI = idx(next, next.start.row, next.start.col);
  const endI = idx(next, next.end.row, next.end.col);
  for (let i = 0; i < next.cells.length; i++) {
    if (i === startI || i === endI) continue;
    if (rand() < 0.28) {
      next.cells[i].type = "wall";
      next.cells[i].weight = 0;
    } else {
      next.cells[i].type = "empty";
      next.cells[i].weight = 1;
    }
  }
  return next;
}

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

export function serializeGrid(grid: Grid): string {
  const walls: number[] = [];
  const weights: { i: number; w: number }[] = [];
  for (let i = 0; i < grid.cells.length; i++) {
    const c = grid.cells[i];
    if (c.type === "wall") walls.push(i);
    else if (c.type === "empty" && c.weight !== 1) weights.push({ i, w: c.weight });
  }
  return [
    `r=${grid.rows}`,
    `c=${grid.cols}`,
    `s=${grid.start.row},${grid.start.col}`,
    `e=${grid.end.row},${grid.end.col}`,
    `w=${walls.join(".")}`,
    `wt=${weights.map((x) => `${x.i}.${x.w}`).join("-")}`,
  ].join("&");
}

export function deserializeGrid(s: string): Grid | null {
  try {
    const parts = s.split("&");
    const map: Record<string, string> = {};
    for (const p of parts) {
      const eq = p.indexOf("=");
      if (eq < 0) continue;
      map[p.slice(0, eq)] = p.slice(eq + 1);
    }
    const rows = parseInt(map.r ?? "10", 10);
    const cols = parseInt(map.c ?? "15", 10);
    if (!Number.isFinite(rows) || !Number.isFinite(cols) || rows < 2 || cols < 2) return null;
    const [sr, sc] = (map.s ?? "0,0").split(",").map((n) => parseInt(n, 10));
    const [er, ec] = (map.e ?? "0,0").split(",").map((n) => parseInt(n, 10));
    const grid = makeGrid(rows, cols, { row: sr, col: sc }, { row: er, col: ec });
    const wallsStr = map.w ?? "";
    if (wallsStr) {
      for (const tok of wallsStr.split(".")) {
        const i = parseInt(tok, 10);
        if (Number.isFinite(i) && i >= 0 && i < grid.cells.length) {
          const c = grid.cells[i];
          if (c.type === "empty") {
            c.type = "wall";
            c.weight = 0;
          }
        }
      }
    }
    const wtStr = map.wt ?? "";
    if (wtStr) {
      for (const tok of wtStr.split("-")) {
        const [iTok, wTok] = tok.split(".");
        const i = parseInt(iTok ?? "", 10);
        const w = parseInt(wTok ?? "", 10);
        if (Number.isFinite(i) && Number.isFinite(w) && i >= 0 && i < grid.cells.length) {
          const c = grid.cells[i];
          if (c.type === "empty") c.weight = w;
        }
      }
    }
    return grid;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Step formatting / color helpers
// ---------------------------------------------------------------------------

export function cellColorClass(
  cellIndex: number,
  step: Step,
  grid: Grid,
): string {
  const c = grid.cells[cellIndex];
  if (c.type === "start") return "start";
  if (c.type === "end") return "end";
  if (c.type === "wall") return "wall";
  if (step.path.includes(cellIndex)) return "path";
  if (step.cell && step.cell.row === c.row && step.cell.col === c.col && step.kind === "visit") return "current";
  if (step.frontier.includes(cellIndex)) return "frontier";
  if (step.visited.includes(cellIndex)) return "visited";
  return c.weight > 1 ? `weight-${c.weight}` : "empty";
}

export function formatStep(step: Step, stepIndex: number, total: number): string {
  return `[${stepIndex + 1}/${total}] ${step.description}  (visited=${step.visitedCount} frontier=${step.frontierCount} dist=${Number.isFinite(step.distance) ? step.distance.toFixed(2) : "∞"})`;
}

export function getAlgorithmInfo(id: AlgorithmId): AlgorithmInfo {
  return ALGORITHMS[id];
}

export function getHeuristicInfo(id: HeuristicId): HeuristicInfo {
  return HEURISTICS[id];
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:pathfinding-algorithm-visualizer:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  algorithm: AlgorithmId;
  heuristic: HeuristicId;
  diagonal: boolean;
  rows: number;
  cols: number;
  wallCount: number;
  pathFound: boolean;
  pathLength: number;
  visited: number;
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
  algorithm: AlgorithmId;
  heuristic: HeuristicId;
  diagonal: boolean;
  grid: string;
}

export function buildShareUrl(algorithm: AlgorithmId, heuristic: HeuristicId, diagonal: boolean, grid: Grid): string {
  const params = new URLSearchParams();
  params.set("alg", algorithm);
  params.set("h", heuristic);
  params.set("d", diagonal ? "1" : "0");
  params.set("g", serializeGrid(grid));
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareParams | null {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return null;
  const params = new URLSearchParams(clean);
  const algRaw = params.get("alg") ?? "astar";
  const algorithm: AlgorithmId = ALGORITHM_LIST.includes(algRaw as AlgorithmId)
    ? (algRaw as AlgorithmId)
    : "astar";
  const hRaw = params.get("h") ?? "manhattan";
  const heuristic: HeuristicId = HEURISTIC_LIST.includes(hRaw as HeuristicId)
    ? (hRaw as HeuristicId)
    : "manhattan";
  const diagonal = params.get("d") === "1";
  const grid = params.get("g") ?? "";
  return { algorithm, heuristic, diagonal, grid };
}

// ---------------------------------------------------------------------------
// Default presets
// ---------------------------------------------------------------------------

export const DEFAULT_GRID_ROWS = 15;
export const DEFAULT_GRID_COLS = 25;

export function defaultGrid(): Grid {
  return makeGrid(DEFAULT_GRID_ROWS, DEFAULT_GRID_COLS);
}
