import { describe, it, expect, beforeEach } from "vitest";
import {
  createTree,
  cloneTree,
  fromValues,
  getNode,
  find,
  insertPure,
  deletePure,
  successor,
  nodeHeight,
  updateHeight,
  balanceFactor,
  height,
  isBalanced,
  balanceRange,
  computeStats,
  rotateLeft,
  rotateRight,
  identifyRotation,
  layout,
  insertGen,
  deleteGen,
  searchGen,
  inOrderGen,
  runInsert,
  runDelete,
  runSearch,
  runTraversal,
  parseValues,
  serializeTree,
  deserializeTree,
  nodeColorClass,
  formatStep,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  randomTree,
  sortedTree,
  mulberry32,
  inOrderArray,
  countRotations,
  type AVLTree,
  type OpKind,
  type RotationKind,
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

describe("avl construction", () => {
  it("createTree is empty", () => {
    const t = createTree();
    expect(t.nodes.size).toBe(0);
    expect(t.root).toBeNull();
    expect(t.nextId).toBe(1);
  });
  it("cloneTree produces a deep copy", () => {
    const t = fromValues([5, 3, 7]);
    const c = cloneTree(t);
    expect(c).not.toBe(t);
    expect(c.nodes).not.toBe(t.nodes);
    expect(c.nodes.size).toBe(t.nodes.size);
    expect(c.root).toBe(t.root);
  });
  it("fromValues builds a tree", () => {
    const t = fromValues([5, 3, 7, 1, 4]);
    expect(t.root).not.toBeNull();
    expect(t.nodes.size).toBe(5);
  });
  it("insertPure skips duplicates", () => {
    const t = fromValues([5, 5, 5]);
    expect(t.nodes.size).toBe(1);
    expect(insertPure(t, 5)).toBe(false);
  });
  it("find returns the correct node", () => {
    const t = fromValues([5, 3, 7]);
    const n = find(t, 3);
    expect(n).not.toBeNull();
    expect(n!.value).toBe(3);
    expect(find(t, 99)).toBeNull();
  });
});

describe("avl invariant — always balanced after insert", () => {
  it("single-node tree is balanced", () => {
    const t = fromValues([42]);
    expect(isBalanced(t)).toBe(true);
    expect(height(t)).toBe(0);
  });
  it("sorted insert (degenerate for plain BST) stays balanced", () => {
    const t = sortedTree(15); // 2,4,6,...,30
    expect(isBalanced(t)).toBe(true);
    // AVL bound: height ≤ 1.44 * log2(n+2) - 0.328 ≈ 5.1 for n=15.
    expect(height(t)).toBeLessThanOrEqual(5);
    expect(t.nodes.size).toBe(15);
  });
  it("sequential ascending insert keeps |bf| ≤ 1 on every node", () => {
    const t = fromValues([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(isBalanced(t)).toBe(true);
    const { min, max } = balanceRange(t);
    expect(min).toBeGreaterThanOrEqual(-1);
    expect(max).toBeLessThanOrEqual(1);
  });
  it("descending insert keeps |bf| ≤ 1 on every node", () => {
    const t = fromValues([10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
    expect(isBalanced(t)).toBe(true);
  });
});

describe("avl rotations — correct rotation type chosen", () => {
  it("LL case: right rotation around pivot", () => {
    // Insert 3, 2, 1 in order triggers LL at root.
    const t = fromValues([3, 2, 1]);
    expect(getNode(t, t.root)!.value).toBe(2);
    expect(getNode(t, getNode(t, t.root)!.left)!.value).toBe(1);
    expect(getNode(t, getNode(t, t.root)!.right)!.value).toBe(3);
    expect(isBalanced(t)).toBe(true);
  });
  it("RR case: left rotation around pivot", () => {
    const t = fromValues([1, 2, 3]);
    expect(getNode(t, t.root)!.value).toBe(2);
    expect(getNode(t, getNode(t, t.root)!.left)!.value).toBe(1);
    expect(getNode(t, getNode(t, t.root)!.right)!.value).toBe(3);
    expect(isBalanced(t)).toBe(true);
  });
  it("LR case: double rotation (left then right)", () => {
    const t = fromValues([3, 1, 2]);
    expect(getNode(t, t.root)!.value).toBe(2);
    expect(isBalanced(t)).toBe(true);
  });
  it("RL case: double rotation (right then left)", () => {
    const t = fromValues([1, 3, 2]);
    expect(getNode(t, t.root)!.value).toBe(2);
    expect(isBalanced(t)).toBe(true);
  });
  it("identifyRotation returns the right label", () => {
    const t = createTree();
    expect(identifyRotation(t, 0, true, true)).toBe("LL");
    expect(identifyRotation(t, 0, true, false)).toBe("LR");
    expect(identifyRotation(t, 0, false, false)).toBe("RR");
    expect(identifyRotation(t, 0, false, true)).toBe("RL");
  });
});

describe("avl rotations — primitives", () => {
  it("rotateRight swaps parent and left child", () => {
    const t = fromValues([3, 2]); // Not balanced yet, but AVL would balance.
    // Build a tiny tree manually: root=10, left=5, left.left=1
    const tt = createTree();
    insertPure(tt, 10);
    insertPure(tt, 5);
    insertPure(tt, 1); // LL → right rotation → root=5
    expect(getNode(tt, tt.root)!.value).toBe(5);
  });
  it("rotateLeft swaps parent and right child", () => {
    const tt = createTree();
    insertPure(tt, 1);
    insertPure(tt, 3);
    insertPure(tt, 5); // RR → left rotation → root=3
    expect(getNode(tt, tt.root)!.value).toBe(3);
  });
  it("manual rotateRight produces the right shape", () => {
    // Root y=10, x=5 (left), t2=null. After right-rotate, x=5 is root, y=10 is its right child.
    const t = createTree();
    const y = { id: 1, value: 10, left: 2, right: null, parent: null, height: 1 };
    const x = { id: 2, value: 5, left: null, right: null, parent: 1, height: 0 };
    t.nodes.set(1, y);
    t.nodes.set(2, x);
    t.root = 1;
    t.nextId = 3;
    rotateRight(t, 1);
    expect(t.root).toBe(2);
    expect(getNode(t, t.root)!.right).toBe(1);
    expect(getNode(t, 1)!.parent).toBe(2);
    expect(getNode(t, 1)!.left).toBeNull();
  });
  it("manual rotateLeft produces the right shape", () => {
    const t = createTree();
    const x = { id: 1, value: 10, left: null, right: 2, parent: null, height: 1 };
    const y = { id: 2, value: 15, left: null, right: null, parent: 1, height: 0 };
    t.nodes.set(1, x);
    t.nodes.set(2, y);
    t.root = 1;
    t.nextId = 3;
    rotateLeft(t, 1);
    expect(t.root).toBe(2);
    expect(getNode(t, t.root)!.left).toBe(1);
    expect(getNode(t, 1)!.parent).toBe(2);
    expect(getNode(t, 1)!.right).toBeNull();
  });
});

describe("avl balance factors and heights", () => {
  it("nodeHeight returns -1 for null, 0 for leaf", () => {
    const t = fromValues([5]);
    expect(nodeHeight(t, null)).toBe(-1);
    expect(nodeHeight(t, t.root)).toBe(0);
  });
  it("balanceFactor is in {-1,0,1} after every insert", () => {
    const t = fromValues([10, 5, 15, 3, 7, 12, 20]);
    for (const id of t.nodes.keys()) {
      const bf = balanceFactor(t, id);
      expect(Math.abs(bf)).toBeLessThanOrEqual(1);
    }
  });
  it("balanceRange returns min and max across all nodes", () => {
    const t = fromValues([10, 5, 15]);
    const { min, max } = balanceRange(t);
    expect(min).toBeGreaterThanOrEqual(-1);
    expect(max).toBeLessThanOrEqual(1);
  });
  it("updateHeight recomputes a node's height", () => {
    const t = fromValues([10, 5, 15, 3]);
    const root = getNode(t, t.root)!;
    root.height = 999; // corrupt
    updateHeight(t, root.id);
    expect(root.height).toBe(2);
  });
});

describe("avl delete — still balanced", () => {
  it("delete leaf keeps balance", () => {
    const t = fromValues([10, 5, 15, 3, 7]);
    expect(deletePure(t, 3)).toBe(true);
    expect(isBalanced(t)).toBe(true);
    expect(t.nodes.size).toBe(4);
  });
  it("delete node with one child keeps balance", () => {
    const t = fromValues([10, 5, 15, 3]);
    expect(deletePure(t, 5)).toBe(true);
    expect(isBalanced(t)).toBe(true);
    expect(find(t, 5)).toBeNull();
  });
  it("delete node with two children keeps balance", () => {
    const t = fromValues([10, 5, 15, 3, 7, 12, 20]);
    expect(deletePure(t, 10)).toBe(true);
    expect(isBalanced(t)).toBe(true);
    expect(t.nodes.size).toBe(6);
  });
  it("delete root keeps balance", () => {
    const t = fromValues([10, 5, 15, 3, 7]);
    expect(deletePure(t, 10)).toBe(true);
    expect(isBalanced(t)).toBe(true);
  });
  it("delete non-existent returns false", () => {
    const t = fromValues([10, 5, 15]);
    expect(deletePure(t, 999)).toBe(false);
  });
  it("cascading rotations on delete rebalance correctly", () => {
    // Build a tree that, when a specific leaf is deleted, triggers cascading rotations.
    const t = fromValues([50, 25, 75, 12, 37, 62, 87, 6, 18, 31, 43]);
    deletePure(t, 87);
    expect(isBalanced(t)).toBe(true);
    deletePure(t, 75);
    expect(isBalanced(t)).toBe(true);
  });
  it("successor finds leftmost of right subtree", () => {
    const t = fromValues([10, 5, 15, 12, 18]);
    const n = find(t, 10)!;
    const s = successor(t, n.id);
    expect(s).not.toBeNull();
    expect(s!.value).toBe(12);
  });
});

describe("avl in-order traversal", () => {
  it("inOrderArray returns sorted values", () => {
    const t = fromValues([50, 30, 70, 20, 40, 60, 80]);
    expect(inOrderArray(t)).toEqual([20, 30, 40, 50, 60, 70, 80]);
  });
  it("inOrderGen yields visit steps in order", () => {
    const t = fromValues([2, 1, 3]);
    const steps = [...inOrderGen(t)];
    const visits = steps.filter((s) => s.kind === "visit");
    expect(visits).toHaveLength(3);
    expect(visits[0].output).toEqual([1]);
    expect(visits[1].output).toEqual([1, 2]);
    expect(visits[2].output).toEqual([1, 2, 3]);
  });
  it("runTraversal produces final output", () => {
    const t = fromValues([5, 3, 7, 1]);
    const r = runTraversal(t);
    expect(r.output).toEqual([1, 3, 5, 7]);
  });
});

describe("avl step-based operations", () => {
  it("insertGen yields compare and rotation steps for LL", () => {
    const t = createTree();
    const steps = [...insertGen(t, 3)];
    // First insert: just an "insert" step.
    expect(steps.length).toBeGreaterThan(0);
    expect(steps[0].kind).toBe("insert");
  });
  it("insertGen with LL rotation yields imbalance + rotation steps", () => {
    const t = fromValues([3, 2]); // Pre-positioned so next insert (1) triggers LL.
    const steps = [...insertGen(t, 1)];
    const kinds = steps.map((s) => s.kind);
    expect(kinds).toContain("imbalance");
    expect(kinds).toContain("rotation");
    const rotStep = steps.find((s) => s.kind === "rotation");
    expect(rotStep!.rotation).toBe("LL");
  });
  it("insertGen with LR rotation yields two rotation phases", () => {
    const t = fromValues([3, 1]); // Next insert (2) triggers LR.
    const steps = [...insertGen(t, 2)];
    const rotSteps = steps.filter((s) => s.kind === "rotation");
    expect(rotSteps.length).toBe(2);
    expect(rotSteps.every((s) => s.rotation === "LR")).toBe(true);
  });
  it("insertGen with RR rotation yields RR rotation step", () => {
    const t = fromValues([1, 2]); // Next insert (3) triggers RR.
    const steps = [...insertGen(t, 3)];
    const rotStep = steps.find((s) => s.kind === "rotation");
    expect(rotStep).toBeDefined();
    expect(rotStep!.rotation).toBe("RR");
  });
  it("insertGen with RL rotation yields two rotation phases", () => {
    const t = fromValues([1, 3]); // Next insert (2) triggers RL.
    const steps = [...insertGen(t, 2)];
    const rotSteps = steps.filter((s) => s.kind === "rotation");
    expect(rotSteps.length).toBe(2);
    expect(rotSteps.every((s) => s.rotation === "RL")).toBe(true);
  });
  it("insertGen skips duplicate without rotation", () => {
    const t = fromValues([5, 3, 7]);
    const steps = [...insertGen(t, 5)];
    expect(steps.some((s) => s.kind === "info" && s.description.includes("Duplicate"))).toBe(true);
    expect(steps.some((s) => s.kind === "rotation")).toBe(false);
  });
  it("searchGen yields found for present value", () => {
    const t = fromValues([10, 5, 15]);
    const steps = [...searchGen(t, 5)];
    expect(steps[steps.length - 1].kind).toBe("found");
  });
  it("searchGen yields not-found for absent value", () => {
    const t = fromValues([10, 5, 15]);
    const steps = [...searchGen(t, 99)];
    expect(steps[steps.length - 1].kind).toBe("not-found");
  });
  it("deleteGen yields not-found for absent value", () => {
    const t = fromValues([10, 5, 15]);
    const steps = [...deleteGen(t, 99)];
    expect(steps[steps.length - 1].kind).toBe("not-found");
  });
  it("deleteGen yields delete for leaf", () => {
    const t = fromValues([10, 5, 15]);
    const steps = [...deleteGen(t, 5)];
    expect(steps.some((s) => s.kind === "delete")).toBe(true);
  });
});

describe("avl run dispatchers", () => {
  it("runInsert returns steps + finalTree", () => {
    const t = createTree();
    const r = runInsert(t, 42);
    expect(r.kind).toBe("insert");
    expect(r.steps.length).toBeGreaterThan(0);
    expect(r.finalTree.nodes.size).toBe(1);
    expect(r.found).toBe(true);
  });
  it("runDelete on empty tree returns not-found", () => {
    const t = createTree();
    const r = runDelete(t, 42);
    expect(r.found).toBe(false);
  });
  it("runSearch returns found for present value", () => {
    const t = fromValues([10, 5, 15]);
    const r = runSearch(t, 15);
    expect(r.found).toBe(true);
    expect(r.output).toEqual([15]);
  });
  it("runInsert increments rotation count for LL trigger", () => {
    const t = fromValues([3, 2]);
    const r = runInsert(t, 1);
    expect(r.totalRotations).toBeGreaterThanOrEqual(1);
  });
  it("runInsert increments rotation count by 2 for LR trigger", () => {
    const t = fromValues([3, 1]);
    const r = runInsert(t, 2);
    expect(r.totalRotations).toBe(2);
  });
});

describe("avl stats & layout", () => {
  it("computeStats reports nodeCount, height, isBalanced", () => {
    const t = fromValues([10, 5, 15, 3]);
    const s = computeStats(t);
    expect(s.nodeCount).toBe(4);
    expect(s.isBalanced).toBe(true);
    expect(s.height).toBeGreaterThan(0);
  });
  it("layout assigns increasing x in in-order", () => {
    const t = fromValues([10, 5, 15]);
    const p = layout(t);
    expect(p).toHaveLength(3);
    const xs = p.map((n) => n.x);
    expect(xs).toEqual([0, 1, 2]);
  });
  it("layout assigns correct depths", () => {
    const t = fromValues([10, 5, 15, 3]);
    const p = layout(t);
    const root = p.find((n) => n.node.value === 10)!;
    expect(root.depth).toBe(0);
  });
});

describe("avl parsing & serialization", () => {
  it("parseValues extracts integers and flags invalid tokens", () => {
    const r = parseValues("1, 2, foo, 4");
    expect(r.ok).toEqual([1, 2, 4]);
    expect(r.skipped).toEqual(["foo"]);
  });
  it("parseValues handles newlines and semicolons", () => {
    expect(parseValues("1\n2;3 4").ok).toEqual([1, 2, 3, 4]);
  });
  it("serializeTree produces comma-separated values", () => {
    const t = fromValues([10, 5, 15]);
    expect(serializeTree(t)).toBe("10,5,15");
  });
  it("deserializeTree round-trips", () => {
    const t1 = fromValues([50, 30, 70, 20, 40, 60, 80]);
    const s = serializeTree(t1);
    const t2 = deserializeTree(s)!;
    expect(serializeTree(t2)).toBe(s);
    expect(t2.nodes.size).toBe(t1.nodes.size);
  });
  it("deserializeTree rejects invalid input", () => {
    expect(deserializeTree("foo,bar")).toBeNull();
  });
  it("deserializeTree of empty string is empty tree", () => {
    const t = deserializeTree("")!;
    expect(t.nodes.size).toBe(0);
  });
});

describe("avl step helpers", () => {
  it("nodeColorClass returns 'successor' for successor node", () => {
    const t = fromValues([10, 5, 15, 12, 18]);
    const target = find(t, 10)!;
    const succ = successor(t, target.id)!;
    const fakeStep = {
      tree: t, active: target.id, path: [], pivot: null, successor: succ.id,
      output: [], kind: "info" as const, rotation: "NONE" as const,
      comparisons: 0, rotations: 0, description: "",
    };
    expect(nodeColorClass(succ.id, fakeStep)).toBe("successor");
  });
  it("nodeColorClass returns 'pivot' for imbalance pivot", () => {
    const t = fromValues([10, 5, 15]);
    const target = find(t, 10)!;
    const fakeStep = {
      tree: t, active: target.id, path: [target.id], pivot: target.id, successor: null,
      output: [], kind: "imbalance" as const, rotation: "LL" as const,
      comparisons: 0, rotations: 0, description: "",
    };
    expect(nodeColorClass(target.id, fakeStep)).toBe("pivot");
  });
  it("formatStep includes rotation type when set", () => {
    const t = fromValues([10]);
    const fakeStep = {
      tree: t, active: null, path: [], pivot: null, successor: null,
      output: [], kind: "rotation" as const, rotation: "LL" as const,
      comparisons: 3, rotations: 1, description: "LL rotation",
    };
    const s = formatStep(fakeStep, 0, 1);
    expect(s).toContain("rot=LL");
    expect(s).toContain("cmp=3");
    expect(s).toContain("rot=1");
  });
});

describe("avl history (localStorage)", () => {
  it("loads empty initially", () => { expect(loadHistory()).toEqual([]); });
  it("saves and loads", () => {
    saveHistory({ ts: 1, op: "insert", value: 5, nodeCount: 3, height: 1, comparisons: 2, rotations: 0, found: true });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, op: "insert", nodeCount: 1, height: 0, comparisons: 1, rotations: 0, found: true });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, op: "insert", nodeCount: 1, height: 0, comparisons: 1, rotations: 0, found: true });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("avl shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const t = fromValues([50, 30, 70]);
    const url = buildShareUrl(t);
    expect(url).toContain("t=50%2C30%2C70");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("t=50%2C30%2C70");
    expect(p).not.toBeNull();
    expect(p!.tree).toBe("50,30,70");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toBeNull();
  });
  it("returns null when 't' parameter missing", () => {
    expect(parseShareUrl("foo=bar")).toBeNull();
  });
});

describe("avl presets & utilities", () => {
  it("randomTree produces a balanced tree of the requested size", () => {
    const t = randomTree(20, 42);
    expect(t.nodes.size).toBe(20);
    expect(isBalanced(t)).toBe(true);
  });
  it("sortedTree produces a balanced tree (AVL absorbs sorted input)", () => {
    const t = sortedTree(20);
    expect(t.nodes.size).toBe(20);
    expect(isBalanced(t)).toBe(true);
  });
  it("mulberry32 is deterministic for the same seed", () => {
    const r1 = mulberry32(123);
    const r2 = mulberry32(123);
    expect(r1()).toBe(r2());
    expect(r1()).toBe(r2());
  });
  it("countRotations returns 0 for first insert", () => {
    expect(countRotations([42])).toBe(0);
  });
  it("countRotations detects LL trigger", () => {
    // Inserting 3,2,1 in order triggers exactly one LL rotation.
    expect(countRotations([3, 2, 1])).toBe(1);
  });
  it("countRotations detects LR trigger (2 phases)", () => {
    expect(countRotations([3, 1, 2])).toBe(2);
  });
});

// Suppress unused-import lint.
export type _Unused = OpKind | RotationKind | AVLTree;
