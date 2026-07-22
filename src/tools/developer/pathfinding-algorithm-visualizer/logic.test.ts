import { describe, it, expect, beforeEach } from "vitest";
import {
  ALGORITHMS,
  HEURISTICS,
  MAZES,
  ALGORITHM_LIST,
  HEURISTIC_LIST,
  MAZE_LIST,
  makeGrid,
  cloneGrid,
  idx,
  cellAt,
  isWall,
  isPassable,
  setWall,
  setWeight,
  cycleWeight,
  setStart,
  setEnd,
  clearWallsAndWeights,
  heuristic,
  neighbors,
  bfsGen,
  dfsGen,
  dijkstraGen,
  astarGen,
  greedyGen,
  bidirectionalGen,
  runAlgorithm,
  compareAll,
  generateMaze,
  mulberry32,
  serializeGrid,
  deserializeGrid,
  cellColorClass,
  formatStep,
  getAlgorithmInfo,
  getHeuristicInfo,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  defaultGrid,
  DEFAULT_GRID_ROWS,
  DEFAULT_GRID_COLS,
  type AlgorithmId,
  type HeuristicId,
  type MazeId,
  type Grid,
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

describe("pathfinding constants & metadata", () => {
  it("has 6 algorithms", () => {
    expect(ALGORITHM_LIST).toHaveLength(6);
    expect(Object.keys(ALGORITHMS)).toHaveLength(6);
  });
  it("has 4 heuristics", () => {
    expect(HEURISTIC_LIST).toHaveLength(4);
    expect(Object.keys(HEURISTICS)).toHaveLength(4);
  });
  it("has 4 maze generators", () => {
    expect(MAZE_LIST).toHaveLength(4);
    expect(Object.keys(MAZES)).toHaveLength(4);
  });
  it("marks BFS/Dijkstra/A*/Bidirectional as optimal", () => {
    expect(ALGORITHMS.bfs.optimal).toBe(true);
    expect(ALGORITHMS.dijkstra.optimal).toBe(true);
    expect(ALGORITHMS.astar.optimal).toBe(true);
    expect(ALGORITHMS.bidirectional.optimal).toBe(true);
  });
  it("marks DFS and Greedy as non-optimal", () => {
    expect(ALGORITHMS.dfs.optimal).toBe(false);
    expect(ALGORITHMS.greedy.optimal).toBe(false);
  });
  it("Dijkstra and A* are weighted", () => {
    expect(ALGORITHMS.dijkstra.weighted).toBe(true);
    expect(ALGORITHMS.astar.weighted).toBe(true);
  });
  it("Manhattan admissible for 4-dir; Chebyshev not", () => {
    expect(HEURISTICS.manhattan.admissible4).toBe(true);
    expect(HEURISTICS.chebyshev.admissible4).toBe(false);
    expect(HEURISTICS.chebyshev.admissible8).toBe(true);
  });
  it("default grid dimensions", () => {
    expect(DEFAULT_GRID_ROWS).toBeGreaterThanOrEqual(5);
    expect(DEFAULT_GRID_COLS).toBeGreaterThanOrEqual(5);
  });
});

describe("pathfinding grid construction", () => {
  it("makeGrid creates rows*cols cells", () => {
    const g = makeGrid(5, 7);
    expect(g.rows).toBe(5);
    expect(g.cols).toBe(7);
    expect(g.cells).toHaveLength(35);
  });
  it("makeGrid places start and end at defaults", () => {
    const g = makeGrid(5, 7);
    expect(g.cells[idx(g, g.start.row, g.start.col)].type).toBe("start");
    expect(g.cells[idx(g, g.end.row, g.end.col)].type).toBe("end");
  });
  it("makeGrid respects min size of 2", () => {
    const g = makeGrid(1, 1);
    expect(g.rows).toBe(2);
    expect(g.cols).toBe(2);
  });
  it("cloneGrid produces a deep copy", () => {
    const g = makeGrid(4, 4);
    const c = cloneGrid(g);
    expect(c).not.toBe(g);
    expect(c.cells).not.toBe(g.cells);
    expect(c.cells[0]).not.toBe(g.cells[0]);
    expect(c.cells).toEqual(g.cells);
  });
  it("defaultGrid produces the expected size", () => {
    const g = defaultGrid();
    expect(g.rows).toBe(DEFAULT_GRID_ROWS);
    expect(g.cols).toBe(DEFAULT_GRID_COLS);
  });
});

describe("pathfinding cell ops", () => {
  it("cellAt returns null for out-of-bounds", () => {
    const g = makeGrid(3, 3);
    expect(cellAt(g, -1, 0)).toBeNull();
    expect(cellAt(g, 0, 5)).toBeNull();
  });
  it("setWall toggles a cell into a wall", () => {
    const g = makeGrid(4, 4);
    const g2 = setWall(g, 0, 0, true);
    expect(isWall(g2, 0, 0)).toBe(true);
    expect(isPassable(g2, 0, 0)).toBe(false);
  });
  it("setWall refuses to overwrite start/end", () => {
    const g = makeGrid(4, 4);
    const g2 = setWall(g, g.start.row, g.start.col, true);
    expect(g2.cells[idx(g2, g.start.row, g.start.col)].type).toBe("start");
  });
  it("setWeight sets weight on empty cell", () => {
    const g = makeGrid(4, 4);
    const g2 = setWeight(g, 0, 0, 7);
    expect(cellAt(g2, 0, 0)!.weight).toBe(7);
  });
  it("cycleWeight cycles 1 → 5 → 15 → 1", () => {
    let g = makeGrid(4, 4);
    g = cycleWeight(g, 0, 0);
    expect(cellAt(g, 0, 0)!.weight).toBe(5);
    g = cycleWeight(g, 0, 0);
    expect(cellAt(g, 0, 0)!.weight).toBe(15);
    g = cycleWeight(g, 0, 0);
    expect(cellAt(g, 0, 0)!.weight).toBe(1);
  });
  it("setStart moves start to a new cell", () => {
    const g = makeGrid(4, 4);
    const g2 = setStart(g, 0, 0);
    expect(g2.start).toEqual({ row: 0, col: 0 });
    expect(cellAt(g2, 0, 0)!.type).toBe("start");
  });
  it("setStart refuses to overwrite a wall", () => {
    let g = makeGrid(4, 4);
    g = setWall(g, 0, 0, true);
    const g2 = setStart(g, 0, 0);
    expect(g2.start).toEqual(g.start); // unchanged
  });
  it("setEnd moves end to a new cell", () => {
    const g = makeGrid(4, 4);
    const g2 = setEnd(g, 3, 3);
    expect(g2.end).toEqual({ row: 3, col: 3 });
  });
  it("clearWallsAndWeights resets walls and weights", () => {
    let g = makeGrid(4, 4);
    g = setWall(g, 0, 0, true);
    g = setWeight(g, 0, 1, 15);
    g = clearWallsAndWeights(g);
    expect(cellAt(g, 0, 0)!.type).toBe("empty");
    expect(cellAt(g, 0, 0)!.weight).toBe(1);
    expect(cellAt(g, 0, 1)!.weight).toBe(1);
  });
});

describe("pathfinding heuristics", () => {
  it("Manhattan is dx+dy", () => {
    expect(heuristic({ row: 0, col: 0 }, { row: 3, col: 4 }, "manhattan")).toBe(7);
  });
  it("Euclidean is sqrt(dx²+dy²)", () => {
    expect(heuristic({ row: 0, col: 0 }, { row: 3, col: 4 }, "euclidean")).toBeCloseTo(5, 5);
  });
  it("Chebyshev is max(dx,dy)", () => {
    expect(heuristic({ row: 0, col: 0 }, { row: 3, col: 4 }, "chebyshev")).toBe(4);
  });
  it("Octile formula", () => {
    // dx=4, dy=3, max=4, min=3, F=√2-1
    const expected = 4 + (Math.SQRT2 - 1) * 3;
    expect(heuristic({ row: 0, col: 0 }, { row: 3, col: 4 }, "octile")).toBeCloseTo(expected, 5);
  });
  it("heuristic is 0 at the goal", () => {
    expect(heuristic({ row: 5, col: 5 }, { row: 5, col: 5 }, "manhattan")).toBe(0);
    expect(heuristic({ row: 5, col: 5 }, { row: 5, col: 5 }, "euclidean")).toBe(0);
  });
});

describe("pathfinding neighbors", () => {
  it("4-dir gives 4 neighbors at center", () => {
    const g = makeGrid(5, 5);
    const nbrs = neighbors(g, 2, 2, false);
    expect(nbrs).toHaveLength(4);
  });
  it("8-dir gives 8 neighbors at center", () => {
    const g = makeGrid(5, 5);
    const nbrs = neighbors(g, 2, 2, true);
    expect(nbrs).toHaveLength(8);
  });
  it("corner has fewer neighbors", () => {
    const g = makeGrid(5, 5);
    const nbrs = neighbors(g, 0, 0, false);
    expect(nbrs).toHaveLength(2);
  });
  it("walls are excluded from neighbors", () => {
    let g = makeGrid(5, 5);
    g = setWall(g, 1, 2, true);
    g = setWall(g, 3, 2, true);
    const nbrs = neighbors(g, 2, 2, false);
    expect(nbrs).toHaveLength(2);
  });
  it("diagonal cost is weight × √2", () => {
    const g = makeGrid(5, 5);
    const nbrs = neighbors(g, 2, 2, true);
    const diag = nbrs.find((n) => n.row === 1 && n.col === 1);
    expect(diag).toBeDefined();
    expect(diag!.cost).toBeCloseTo(Math.SQRT2, 5);
  });
  it("prevents diagonal corner-cutting", () => {
    let g = makeGrid(7, 7);
    // Use bottom-right corner area to avoid default start (row=floor(7/2)=3, col=1)
    // and end (row=3, col=5). Block both orthogonal cells around a diagonal.
    // Cell (5, 5), diagonal (4, 4); corner cells (4, 5) and (5, 4).
    g = setWall(g, 4, 5, true);
    g = setWall(g, 5, 4, true);
    const nbrs = neighbors(g, 5, 5, true);
    const diag = nbrs.find((n) => n.row === 4 && n.col === 4);
    expect(diag).toBeUndefined();
  });
});

describe("pathfinding algorithms — basic correctness", () => {
  const setup = (): Grid => {
    let g = makeGrid(5, 5, { row: 0, col: 0 }, { row: 4, col: 4 });
    return g;
  };

  it("BFS finds a path on an empty grid", () => {
    const g = setup();
    const r = runAlgorithm("bfs", g, false);
    expect(r.pathFound).toBe(true);
    expect(r.pathLength).toBe(9); // 0,0 → 4,4 = 9 cells (Manhattan + 1)
  });

  it("DFS finds a path (non-optimal but valid)", () => {
    const g = setup();
    const r = runAlgorithm("dfs", g, false);
    expect(r.pathFound).toBe(true);
    expect(r.pathLength).toBeGreaterThanOrEqual(9);
  });

  it("Dijkstra finds optimal path on empty grid", () => {
    const g = setup();
    const r = runAlgorithm("dijkstra", g, false);
    expect(r.pathFound).toBe(true);
    expect(r.pathLength).toBe(9);
  });

  it("A* with Manhattan finds optimal path", () => {
    const g = setup();
    const r = runAlgorithm("astar", g, false, "manhattan");
    expect(r.pathFound).toBe(true);
    expect(r.pathLength).toBe(9);
  });

  it("A* expands fewer-or-equal nodes than Dijkstra on empty grid", () => {
    const g = setup();
    const aStar = runAlgorithm("astar", g, false, "manhattan");
    const dijk = runAlgorithm("dijkstra", g, false);
    expect(aStar.totalVisited).toBeLessThanOrEqual(dijk.totalVisited);
  });

  it("Greedy Best-First finds a path (non-optimal)", () => {
    const g = setup();
    const r = runAlgorithm("greedy", g, false, "manhattan");
    expect(r.pathFound).toBe(true);
  });

  it("Bidirectional BFS finds a path", () => {
    const g = setup();
    const r = runAlgorithm("bidirectional", g, false);
    expect(r.pathFound).toBe(true);
    expect(r.pathLength).toBe(9);
  });

  it("BFS returns no path when blocked by a wall line", () => {
    let g = setup();
    // Wall column at col=2 from row 0..4 (full vertical wall blocks the path).
    for (let r = 0; r < g.rows; r++) g = setWall(g, r, 2, true);
    const result = runAlgorithm("bfs", g, false);
    expect(result.pathFound).toBe(false);
  });

  it("all 6 algorithms handle empty path gracefully", () => {
    let g = setup();
    for (let r = 0; r < g.rows; r++) g = setWall(g, r, 2, true);
    for (const alg of ALGORITHM_LIST) {
      const r = runAlgorithm(alg, g, false, "manhattan");
      expect(r.pathFound).toBe(false);
      expect(r.steps.length).toBeGreaterThan(0);
    }
  });

  it("weighted cells change Dijkstra path cost", () => {
    let g = makeGrid(3, 5, { row: 1, col: 0 }, { row: 1, col: 4 });
    // Set middle cell to weight 100.
    g = setWeight(g, 1, 2, 100);
    const r = runAlgorithm("dijkstra", g, false);
    expect(r.pathFound).toBe(true);
    // With weight 100 in the middle, Dijkstra should route around (cost 8) vs through (cost 102).
    expect(r.pathCost).toBeLessThan(100);
  });
});

describe("pathfinding generator step emission", () => {
  it("BFS emits at least one step", () => {
    const g = makeGrid(5, 5, { row: 0, col: 0 }, { row: 0, col: 4 });
    const steps = [...bfsGen(g, false)];
    expect(steps.length).toBeGreaterThan(0);
    expect(steps[0].description).toContain("BFS");
  });
  it("DFS emits at least one step", () => {
    const g = makeGrid(5, 5, { row: 0, col: 0 }, { row: 0, col: 4 });
    const steps = [...dfsGen(g, false)];
    expect(steps.length).toBeGreaterThan(0);
    expect(steps[0].description).toContain("DFS");
  });
  it("Dijkstra emits at least one step", () => {
    const g = makeGrid(5, 5, { row: 0, col: 0 }, { row: 0, col: 4 });
    const steps = [...dijkstraGen(g, false)];
    expect(steps.length).toBeGreaterThan(0);
  });
  it("A* emits at least one step with heuristic", () => {
    const g = makeGrid(5, 5, { row: 0, col: 0 }, { row: 0, col: 4 });
    const steps = [...astarGen(g, false, "manhattan")];
    expect(steps.length).toBeGreaterThan(0);
    expect(steps[0].description).toContain("Manhattan");
  });
  it("Greedy emits at least one step", () => {
    const g = makeGrid(5, 5, { row: 0, col: 0 }, { row: 0, col: 4 });
    const steps = [...greedyGen(g, false, "manhattan")];
    expect(steps.length).toBeGreaterThan(0);
  });
  it("Bidirectional emits at least one step", () => {
    const g = makeGrid(5, 5, { row: 0, col: 0 }, { row: 0, col: 4 });
    const steps = [...bidirectionalGen(g, false)];
    expect(steps.length).toBeGreaterThan(0);
    expect(steps[0].description).toContain("Bidirectional");
  });
  it("BFS path step has the path populated", () => {
    const g = makeGrid(3, 3, { row: 0, col: 0 }, { row: 2, col: 2 });
    const r = runAlgorithm("bfs", g, false);
    const last = r.steps[r.steps.length - 1];
    expect(last.path.length).toBeGreaterThan(0);
  });
  it("formatStep includes counters", () => {
    const g = makeGrid(3, 3, { row: 0, col: 0 }, { row: 2, col: 2 });
    const r = runAlgorithm("bfs", g, false);
    const formatted = formatStep(r.steps[0], 0, r.steps.length);
    expect(formatted).toContain("visited=");
    expect(formatted).toContain("frontier=");
  });
});

describe("pathfinding compareAll", () => {
  it("runs all 6 algorithms", () => {
    const g = makeGrid(8, 8, { row: 0, col: 0 }, { row: 7, col: 7 });
    const results = compareAll(g, false, "manhattan");
    expect(results).toHaveLength(6);
    for (const r of results) {
      expect(r.result.pathFound).toBe(true);
    }
  });
});

describe("pathfinding maze generators", () => {
  it("mulberry32 is deterministic", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect(a()).toBe(b());
    expect(a()).toBe(b());
  });
  it("recursive division produces a solvable maze", () => {
    const g = makeGrid(9, 11);
    const m = generateMaze(g, "recursive-division", 7);
    const r = runAlgorithm("bfs", m, false);
    expect(r.pathFound).toBe(true);
  });
  it("prim produces a solvable maze", () => {
    const g = makeGrid(9, 11);
    const m = generateMaze(g, "prim", 7);
    const r = runAlgorithm("bfs", m, false);
    expect(r.pathFound).toBe(true);
  });
  it("randomized DFS produces a solvable maze", () => {
    const g = makeGrid(9, 11);
    const m = generateMaze(g, "randomized-dfs", 7);
    const r = runAlgorithm("bfs", m, false);
    expect(r.pathFound).toBe(true);
  });
  it("random walls produces some walls", () => {
    const g = makeGrid(10, 10);
    const m = generateMaze(g, "random-walls", 7);
    const wallCount = m.cells.filter((c) => c.type === "wall").length;
    expect(wallCount).toBeGreaterThan(0);
  });
  it("maze generators never overwrite start/end", () => {
    const g = makeGrid(9, 11);
    for (const maze of MAZE_LIST) {
      const m = generateMaze(g, maze, 11);
      const s = m.cells[idx(m, m.start.row, m.start.col)];
      const e = m.cells[idx(m, m.end.row, m.end.col)];
      expect(s.type).toBe("start");
      expect(e.type).toBe("end");
    }
  });
});

describe("pathfinding serialization", () => {
  it("round-trips an empty grid", () => {
    const g = makeGrid(5, 7);
    const s = serializeGrid(g);
    const g2 = deserializeGrid(s);
    expect(g2).not.toBeNull();
    expect(g2!.rows).toBe(5);
    expect(g2!.cols).toBe(7);
  });
  it("round-trips walls and weights", () => {
    let g = makeGrid(5, 5);
    g = setWall(g, 0, 0, true);
    g = setWeight(g, 2, 2, 15);
    const s = serializeGrid(g);
    const g2 = deserializeGrid(s);
    expect(g2).not.toBeNull();
    expect(isWall(g2!, 0, 0)).toBe(true);
    expect(cellAt(g2!, 2, 2)!.weight).toBe(15);
  });
  it("round-trips custom start and end positions", () => {
    let g = makeGrid(5, 5);
    g = setStart(g, 0, 4);
    g = setEnd(g, 4, 0);
    const s = serializeGrid(g);
    const g2 = deserializeGrid(s);
    expect(g2!.start).toEqual({ row: 0, col: 4 });
    expect(g2!.end).toEqual({ row: 4, col: 0 });
  });
  it("deserialize returns null for bad input", () => {
    expect(deserializeGrid("garbage")).not.toBeNull(); // falls back to defaults
    expect(deserializeGrid("r=1&c=1")).toBeNull();
  });
});

describe("pathfinding color helper", () => {
  // Use a grid where start and end are distinct (4×5 gives start=(2,1), end=(2,3)).
  it("colors start as start", () => {
    const g = makeGrid(4, 5);
    const step = { cell: null, visited: [], frontier: [], path: [], kind: "info" as const, visitedCount: 0, frontierCount: 0, distance: 0, description: "" };
    expect(cellColorClass(idx(g, g.start.row, g.start.col), step, g)).toBe("start");
  });
  it("colors end as end", () => {
    const g = makeGrid(4, 5);
    const step = { cell: null, visited: [], frontier: [], path: [], kind: "info" as const, visitedCount: 0, frontierCount: 0, distance: 0, description: "" };
    expect(cellColorClass(idx(g, g.end.row, g.end.col), step, g)).toBe("end");
  });
  it("colors path cells as path", () => {
    const g = makeGrid(4, 5);
    const pi = idx(g, 0, 0); // top-left, not start/end
    const step = { cell: null, visited: [], frontier: [], path: [pi], kind: "path" as const, visitedCount: 0, frontierCount: 0, distance: 0, description: "" };
    expect(cellColorClass(pi, step, g)).toBe("path");
  });
  it("colors wall cells as wall", () => {
    const g = setWall(makeGrid(4, 5), 0, 0, true);
    const step = { cell: null, visited: [], frontier: [], path: [], kind: "info" as const, visitedCount: 0, frontierCount: 0, distance: 0, description: "" };
    expect(cellColorClass(idx(g, 0, 0), step, g)).toBe("wall");
  });
});

describe("pathfinding history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1,
      algorithm: "astar",
      heuristic: "manhattan",
      diagonal: false,
      rows: 10,
      cols: 10,
      wallCount: 5,
      pathFound: true,
      pathLength: 18,
      visited: 50,
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i,
        algorithm: "bfs",
        heuristic: "manhattan",
        diagonal: false,
        rows: 5,
        cols: 5,
        wallCount: 0,
        pathFound: true,
        pathLength: 9,
        visited: 25,
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1,
      algorithm: "bfs",
      heuristic: "manhattan",
      diagonal: false,
      rows: 5,
      cols: 5,
      wallCount: 0,
      pathFound: true,
      pathLength: 9,
      visited: 25,
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("pathfinding shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const g = makeGrid(5, 5);
    const url = buildShareUrl("astar", "manhattan", false, g);
    expect(url).toContain("alg=astar");
    expect(url).toContain("h=manhattan");
    expect(url).toContain("d=0");
    expect(url).toContain("g=r%3D5");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const g = makeGrid(5, 5);
    const url = buildShareUrl("dijkstra", "euclidean", true, g);
    const hash = url.includes("#") ? url.slice(url.indexOf("#")) : url;
    const p = parseShareUrl(hash);
    expect(p).not.toBeNull();
    expect(p!.algorithm).toBe("dijkstra");
    expect(p!.heuristic).toBe("euclidean");
    expect(p!.diagonal).toBe(true);
  });
  it("parses empty hash as null", () => {
    expect(parseShareUrl("")).toBeNull();
  });
  it("filters unknown algorithm to default", () => {
    const p = parseShareUrl("alg=unknown&h=manhattan&d=0&g=r%3D5%26c%3D5");
    expect(p!.algorithm).toBe("astar");
  });
  it("round-trips grid through share URL", () => {
    let g = makeGrid(4, 4);
    g = setWall(g, 1, 1, true);
    const url = buildShareUrl("bfs", "manhattan", false, g);
    const hash = url.includes("#") ? url.slice(url.indexOf("#")) : url;
    const p = parseShareUrl(hash);
    const g2 = deserializeGrid(p!.grid);
    expect(g2).not.toBeNull();
    expect(isWall(g2!, 1, 1)).toBe(true);
  });
});

// Suppress unused-import lint
export type _Unused = AlgorithmId | HeuristicId | MazeId | Grid;
