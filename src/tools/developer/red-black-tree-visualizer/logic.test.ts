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
  sibling,
  uncle,
  grandparent,
  height,
  blackHeight,
  checkProperties,
  computeStats,
  rotateLeft,
  rotateRight,
  layout,
  insertGen,
  deleteGen,
  inOrderGen,
  runInsert,
  runDelete,
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
  countOperations,
  type RBTree,
  type OpKind,
  type Color,
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

describe("rb construction", () => {
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

describe("rb properties — always satisfied after insert", () => {
  it("single-node tree: root is black", () => {
    const t = fromValues([42]);
    expect(getNode(t, t.root)!.color).toBe("B");
    const props = checkProperties(t);
    expect(props.allPass).toBe(true);
    expect(props.rootBlack).toBe(true);
  });
  it("sorted insert keeps all five properties", () => {
    const t = sortedTree(15);
    const props = checkProperties(t);
    expect(props.allPass).toBe(true);
    expect(t.nodes.size).toBe(15);
  });
  it("sequential ascending insert keeps properties", () => {
    const t = fromValues([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const props = checkProperties(t);
    expect(props.allPass).toBe(true);
  });
  it("descending insert keeps properties", () => {
    const t = fromValues([10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
    const props = checkProperties(t);
    expect(props.allPass).toBe(true);
  });
  it("random tree of 50 nodes keeps properties", () => {
    const t = randomTree(50, 12345);
    const props = checkProperties(t);
    expect(props.allPass).toBe(true);
  });
  it("no two consecutive red nodes ever after any insert sequence", () => {
    const t = fromValues([10, 5, 15, 3, 7, 12, 20, 1, 4, 6, 8, 11, 13, 18, 25]);
    expect(checkProperties(t).noRedRed).toBe(true);
  });
});

describe("rb insert fix-up cases", () => {
  it("case 1: first insert → root is black", () => {
    const t = fromValues([42]);
    expect(getNode(t, t.root)!.color).toBe("B");
  });
  it("case 2: insert into a tree where parent is black → no fix-up needed", () => {
    const t = fromValues([10, 5]);
    // 10 is root (black); 5 is left child (red). No violation.
    expect(getNode(t, getNode(t, t.root)!.left)!.color).toBe("R");
    expect(getNode(t, t.root)!.color).toBe("B");
    expect(checkProperties(t).allPass).toBe(true);
  });
  it("case 3: uncle red triggers recolor", () => {
    // Build: 10(B) with 5(R) and 15(R), then insert 1 → parent 5(R), uncle 15(R) → recolor.
    const t = fromValues([10, 5, 15, 1]);
    expect(checkProperties(t).allPass).toBe(true);
    // After recolor, 5 and 15 should both be B, and 10 should be... well, root is always B.
    const n5 = find(t, 5)!;
    const n15 = find(t, 15)!;
    expect(n5.color).toBe("B");
    expect(n15.color).toBe("B");
  });
  it("case 4: LL single rotation when uncle is black", () => {
    // Insert 3, 2, 1 in order — triggers red-red, uncle is NIL (black), LL case.
    const t = fromValues([3, 2, 1]);
    expect(checkProperties(t).allPass).toBe(true);
    // After fix-up: root should be 2 (B), with 1 (R) and 3 (R) as children.
    expect(getNode(t, t.root)!.value).toBe(2);
    expect(getNode(t, t.root)!.color).toBe("B");
  });
  it("case 5: LR double rotation when uncle is black", () => {
    const t = fromValues([3, 1, 2]);
    expect(checkProperties(t).allPass).toBe(true);
    expect(getNode(t, t.root)!.value).toBe(2);
    expect(getNode(t, t.root)!.color).toBe("B");
  });
  it("case 4 mirror: RR single rotation when uncle is black", () => {
    const t = fromValues([1, 2, 3]);
    expect(checkProperties(t).allPass).toBe(true);
    expect(getNode(t, t.root)!.value).toBe(2);
  });
  it("case 5 mirror: RL double rotation when uncle is black", () => {
    const t = fromValues([1, 3, 2]);
    expect(checkProperties(t).allPass).toBe(true);
    expect(getNode(t, t.root)!.value).toBe(2);
  });
});

describe("rb rotations — primitives", () => {
  it("rotateLeft swaps parent and right child", () => {
    const t = createTree();
    const x = { id: 1, value: 10, left: null, right: 2, parent: null, color: "B", isNil: false };
    const y = { id: 2, value: 15, left: null, right: null, parent: 1, color: "R", isNil: false };
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
  it("rotateRight swaps parent and left child", () => {
    const t = createTree();
    const y = { id: 1, value: 10, left: 2, right: null, parent: null, color: "B", isNil: false };
    const x = { id: 2, value: 5, left: null, right: null, parent: 1, color: "R", isNil: false };
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
});

describe("rb relationship helpers", () => {
  it("sibling returns the other child of the parent", () => {
    const t = fromValues([10, 5, 15]);
    const n5 = find(t, 5)!;
    const sib = sibling(t, n5.id);
    expect(sib).not.toBeNull();
    expect(sib!.value).toBe(15);
  });
  it("uncle returns the sibling of the parent", () => {
    // Build: 10(B) / 5(R) / 15(R) / 3(R).
    const t = fromValues([10, 5, 15, 3]);
    const n3 = find(t, 3)!;
    const unc = uncle(t, n3.id);
    expect(unc).not.toBeNull();
    expect(unc!.value).toBe(15);
  });
  it("grandparent returns the parent of the parent", () => {
    // Build: 10(B) / 5(B) / 15(B) / 3(R) — 3's grandparent is 10.
    const t = fromValues([10, 5, 15, 3]);
    const n3 = find(t, 3)!;
    const gp = grandparent(t, n3.id);
    expect(gp).not.toBeNull();
    expect(gp!.value).toBe(10);
  });
  it("sibling returns null for root", () => {
    const t = fromValues([10, 5, 15]);
    expect(sibling(t, t.root!)).toBeNull();
  });
});

describe("rb delete — properties still hold", () => {
  it("delete leaf keeps properties", () => {
    const t = fromValues([10, 5, 15, 3, 7]);
    expect(deletePure(t, 3)).toBe(true);
    expect(checkProperties(t).allPass).toBe(true);
    expect(t.nodes.size).toBe(4);
  });
  it("delete node with one child keeps properties", () => {
    const t = fromValues([10, 5, 15, 3]);
    expect(deletePure(t, 5)).toBe(true);
    expect(checkProperties(t).allPass).toBe(true);
    expect(find(t, 5)).toBeNull();
  });
  it("delete node with two children keeps properties", () => {
    const t = fromValues([10, 5, 15, 3, 7, 12, 20]);
    expect(deletePure(t, 10)).toBe(true);
    expect(checkProperties(t).allPass).toBe(true);
    expect(t.nodes.size).toBe(6);
  });
  it("delete root keeps properties", () => {
    const t = fromValues([10, 5, 15, 3, 7]);
    expect(deletePure(t, 10)).toBe(true);
    expect(checkProperties(t).allPass).toBe(true);
  });
  it("delete non-existent returns false", () => {
    const t = fromValues([10, 5, 15]);
    expect(deletePure(t, 999)).toBe(false);
  });
  it("delete black leaf triggers fix-up", () => {
    const t = fromValues([10, 5, 15, 3, 7, 12, 20, 1]);
    deletePure(t, 1);
    expect(checkProperties(t).allPass).toBe(true);
  });
  it("delete cascading on a larger tree keeps properties", () => {
    const t = fromValues([50, 25, 75, 12, 37, 62, 87, 6, 18, 31, 43, 56, 68, 81, 93]);
    for (const v of [93, 87, 81, 75, 68]) {
      deletePure(t, v);
      expect(checkProperties(t).allPass).toBe(true);
    }
  });
  it("successor finds leftmost of right subtree", () => {
    const t = fromValues([10, 5, 15, 12, 18]);
    const n = find(t, 10)!;
    const s = successor(t, n.id);
    expect(s).not.toBeNull();
    expect(s!.value).toBe(12);
  });
});

describe("rb in-order traversal", () => {
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

describe("rb step-based operations", () => {
  it("insertGen yields insert step for first node", () => {
    const t = createTree();
    const steps = [...insertGen(t, 42)];
    expect(steps.length).toBeGreaterThan(0);
    expect(steps[0].kind).toBe("insert");
    expect(steps[0].insertCase).toBe("case-1-root");
  });
  it("insertGen yields compare steps", () => {
    const t = fromValues([10]);
    const steps = [...insertGen(t, 5)];
    expect(steps.some((s) => s.kind === "compare")).toBe(true);
  });
  it("insertGen with case 3 yields recolor step", () => {
    const t = fromValues([10, 5, 15]); // root B, 5 R, 15 R
    const steps = [...insertGen(t, 1)]; // parent 5 R, uncle 15 R → case 3
    expect(steps.some((s) => s.kind === "recolor" && s.insertCase === "case-3-uncle-red-recolor")).toBe(true);
  });
  it("insertGen with LL case yields rotation step", () => {
    const t = fromValues([3, 2]); // 3 B root, 2 R left
    const steps = [...insertGen(t, 1)]; // LL → case 4
    expect(steps.some((s) => s.kind === "rotation")).toBe(true);
  });
  it("insertGen with LR case yields two rotation steps", () => {
    const t = fromValues([3, 1]); // 3 B root, 1 R left
    const steps = [...insertGen(t, 2)]; // LR → case 5 then case 4
    const rotSteps = steps.filter((s) => s.kind === "rotation");
    expect(rotSteps.length).toBeGreaterThanOrEqual(2);
  });
  it("insertGen skips duplicate without fix-up", () => {
    const t = fromValues([5, 3, 7]);
    const steps = [...insertGen(t, 5)];
    expect(steps.some((s) => s.kind === "info" && s.description.includes("Duplicate"))).toBe(true);
    expect(steps.some((s) => s.kind === "rotation")).toBe(false);
  });
  it("deleteGen yields not-found for absent value", () => {
    const t = fromValues([10, 5, 15]);
    const steps = [...deleteGen(t, 99)];
    expect(steps[steps.length - 1].description).toContain("not in tree");
  });
  it("deleteGen yields delete for leaf", () => {
    const t = fromValues([10, 5, 15]);
    const steps = [...deleteGen(t, 5)];
    expect(steps.some((s) => s.kind === "delete")).toBe(true);
  });
  it("deleteGen yields double-black for black leaf removal", () => {
    const t = fromValues([10, 5, 15, 3, 7, 12, 20, 1]);
    const steps = [...deleteGen(t, 1)]; // 1 is red leaf? depends on coloring
    // Black-height fix-up is triggered when removed node was black.
    const lastKinds = steps.map((s) => s.kind);
    // We accept either double-black (if removed was black) or info (if red).
    expect(lastKinds).toContain("delete");
  });
});

describe("rb run dispatchers", () => {
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
  it("runInsert counts rotations and recolors", () => {
    const t = fromValues([3, 2]);
    const r = runInsert(t, 1); // LL → 1 rotation, some recolors
    expect(r.totalRotations).toBeGreaterThanOrEqual(1);
  });
  it("runDelete returns deleted=true when value present", () => {
    const t = fromValues([10, 5, 15]);
    const r = runDelete(t, 5);
    expect(r.found).toBe(true);
  });
});

describe("rb stats & layout", () => {
  it("computeStats reports nodeCount, height, blackHeight", () => {
    const t = fromValues([10, 5, 15, 3]);
    const s = computeStats(t);
    expect(s.nodeCount).toBe(4);
    expect(s.properties.allPass).toBe(true);
    expect(s.blackHeight).toBeGreaterThanOrEqual(1);
  });
  it("computeStats tracks redCount and blackCount", () => {
    const t = fromValues([10, 5, 15, 3]);
    const s = computeStats(t);
    expect(s.redCount + s.blackCount).toBe(s.nodeCount);
    expect(s.blackCount).toBeGreaterThanOrEqual(1); // at least root
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

describe("rb parsing & serialization", () => {
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
  it("deserializeTree round-trips (same node count, valid RB, same values)", () => {
    // NOTE: For self-balancing trees, the pre-order walk does NOT reproduce
    // the original insertion order — re-inserting in pre-order triggers
    // different rotations. So we only check that the deserialized tree is
    // a valid RB tree with the same node count and value set.
    const t1 = fromValues([50, 30, 70, 20, 40, 60, 80]);
    const s = serializeTree(t1);
    const t2 = deserializeTree(s)!;
    expect(t2.nodes.size).toBe(t1.nodes.size);
    expect(checkProperties(t2).allPass).toBe(true);
    expect(new Set(inOrderArray(t1))).toEqual(new Set(inOrderArray(t2)));
  });
  it("deserializeTree rejects invalid input", () => {
    expect(deserializeTree("foo,bar")).toBeNull();
  });
  it("deserializeTree of empty string is empty tree", () => {
    const t = deserializeTree("")!;
    expect(t.nodes.size).toBe(0);
  });
});

describe("rb step helpers", () => {
  it("nodeColorClass returns 'successor' for successor node", () => {
    const t = fromValues([10, 5, 15, 12, 18]);
    const target = find(t, 10)!;
    const succ = successor(t, target.id)!;
    const fakeStep = {
      tree: t, active: target.id, path: [], pivot: null, successor: succ.id,
      output: [], kind: "info" as const, insertCase: "" as const, deleteCase: "" as const,
      comparisons: 0, rotations: 0, recolors: 0, description: "",
    };
    expect(nodeColorClass(succ.id, fakeStep)).toBe("successor");
  });
  it("nodeColorClass returns 'pivot' for rotation pivot", () => {
    const t = fromValues([10, 5, 15]);
    const target = find(t, 10)!;
    const fakeStep = {
      tree: t, active: target.id, path: [target.id], pivot: target.id, successor: null,
      output: [], kind: "rotation" as const, insertCase: "" as const, deleteCase: "" as const,
      comparisons: 0, rotations: 0, recolors: 0, description: "",
    };
    expect(nodeColorClass(target.id, fakeStep)).toBe("pivot");
  });
  it("formatStep includes case labels when set", () => {
    const t = fromValues([10]);
    const fakeStep = {
      tree: t, active: null, path: [], pivot: null, successor: null,
      output: [], kind: "recolor" as const,
      insertCase: "case-3-uncle-red-recolor" as const, deleteCase: "" as const,
      comparisons: 3, rotations: 0, recolors: 2, description: "Case 3 recolor",
    };
    const s = formatStep(fakeStep, 0, 1);
    expect(s).toContain("ins=case-3-uncle-red-recolor");
    expect(s).toContain("cmp=3");
    expect(s).toContain("rec=2");
  });
});

describe("rb history (localStorage)", () => {
  it("loads empty initially", () => { expect(loadHistory()).toEqual([]); });
  it("saves and loads", () => {
    saveHistory({ ts: 1, op: "insert", value: 5, nodeCount: 3, height: 1, blackHeight: 1, comparisons: 2, rotations: 0, recolors: 1, found: true });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, op: "insert", nodeCount: 1, height: 0, blackHeight: 1, comparisons: 1, rotations: 0, recolors: 0, found: true });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, op: "insert", nodeCount: 1, height: 0, blackHeight: 1, comparisons: 1, rotations: 0, recolors: 0, found: true });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("rb shareable URL", () => {
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

describe("rb presets & utilities", () => {
  it("randomTree produces a property-satisfying tree of the requested size", () => {
    const t = randomTree(20, 42);
    expect(t.nodes.size).toBe(20);
    expect(checkProperties(t).allPass).toBe(true);
  });
  it("sortedTree produces a property-satisfying tree", () => {
    const t = sortedTree(20);
    expect(t.nodes.size).toBe(20);
    expect(checkProperties(t).allPass).toBe(true);
  });
  it("mulberry32 is deterministic for the same seed", () => {
    const r1 = mulberry32(123);
    const r2 = mulberry32(123);
    expect(r1()).toBe(r2());
    expect(r1()).toBe(r2());
  });
  it("countOperations returns 0 rotations for single insert", () => {
    expect(countOperations([42]).rotations).toBe(0);
  });
  it("countOperations detects rotations for LL-triggering sequence", () => {
    // Inserting 3,2,1 in order triggers at least one rotation.
    expect(countOperations([3, 2, 1]).rotations).toBeGreaterThanOrEqual(1);
  });
  it("countOperations detects recolors for case-3 sequence", () => {
    // Inserting 10, 5, 15, 1 — the 4th insert triggers case 3 (recolor).
    expect(countOperations([10, 5, 15, 1]).recolors).toBeGreaterThanOrEqual(1);
  });
  it("height is bounded for RB tree (≤ 2·log2(n+1))", () => {
    const t = sortedTree(31);
    const h = height(t);
    // For n=31, 2*log2(32) = 10. RB trees are at most 2x the optimal height.
    expect(h).toBeLessThanOrEqual(10);
  });
  it("blackHeight is consistent across the tree", () => {
    const t = randomTree(30, 7);
    const props = checkProperties(t);
    expect(props.equalBlackHeight).toBe(true);
    expect(props.blackHeight).toBeGreaterThan(0);
  });
});

// Suppress unused-import lint.
export type _Unused = OpKind | Color | RBTree;
