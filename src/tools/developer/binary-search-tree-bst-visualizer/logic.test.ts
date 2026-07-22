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
  predecessor,
  height,
  balanceFactor,
  minDepth,
  isBalanced,
  isDegenerate,
  computeStats,
  layout,
  insertGen,
  deleteGen,
  searchGen,
  inOrderGen,
  preOrderGen,
  postOrderGen,
  levelOrderGen,
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
  type BSTree,
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

describe("bst construction", () => {
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
  it("fromValues builds a tree with correct root", () => {
    const t = fromValues([5, 3, 7, 1, 4]);
    expect(t.root).not.toBeNull();
    expect(getNode(t, t.root)!.value).toBe(5);
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

describe("bst invariants", () => {
  it("smaller values go left, larger go right", () => {
    const t = fromValues([10, 5, 15, 3, 7]);
    const root = getNode(t, t.root!)!;
    expect(root.value).toBe(10);
    expect(getNode(t, root.left)!.value).toBe(5);
    expect(getNode(t, root.right)!.value).toBe(15);
    expect(getNode(t, getNode(t, root.left)!.left)!.value).toBe(3);
    expect(getNode(t, getNode(t, root.left)!.right)!.value).toBe(7);
  });
  it("BST property holds: in-order yields sorted sequence", () => {
    const t = fromValues([10, 5, 15, 3, 7, 12, 20]);
    const out: number[] = [];
    const walk = (id: number | null) => {
      if (id === null) return;
      const n = getNode(t, id)!;
      walk(n.left);
      out.push(n.value);
      walk(n.right);
    };
    walk(t.root);
    expect(out).toEqual([3, 5, 7, 10, 12, 15, 20]);
  });
});

describe("bst successor / predecessor", () => {
  it("successor is leftmost of right subtree", () => {
    const t = fromValues([10, 5, 15, 12, 17, 11]);
    const root = getNode(t, t.root!)!;
    const succ = successor(t, root.id);
    expect(succ).not.toBeNull();
    expect(succ!.value).toBe(11);
  });
  it("successor returns null for the max node", () => {
    const t = fromValues([10, 5, 15, 12, 17]);
    const max = find(t, 17)!;
    expect(successor(t, max.id)).toBeNull();
  });
  it("predecessor is rightmost of left subtree", () => {
    const t = fromValues([10, 5, 15, 3, 7, 6, 8]);
    const root = getNode(t, t.root!)!;
    const pred = predecessor(t, root.id);
    expect(pred).not.toBeNull();
    expect(pred!.value).toBe(8);
  });
});

describe("bst delete — all 3 cases", () => {
  it("case 1: delete a leaf", () => {
    const t = fromValues([10, 5, 15]);
    expect(deletePure(t, 5)).toBe(true);
    expect(find(t, 5)).toBeNull();
    expect(getNode(t, t.root!)!.left).toBeNull();
    expect(t.nodes.size).toBe(2);
  });
  it("case 2: delete a node with one child", () => {
    const t = fromValues([10, 5, 15, 12]);
    // Delete 15 — has one child (12).
    expect(deletePure(t, 15)).toBe(true);
    expect(find(t, 15)).toBeNull();
    expect(getNode(t, t.root!)!.right).not.toBeNull();
    expect(getNode(t, getNode(t, t.root!)!.right)!.value).toBe(12);
  });
  it("case 3: delete a node with two children (replace with successor)", () => {
    const t = fromValues([10, 5, 15, 12, 17, 11]);
    expect(deletePure(t, 15)).toBe(true);
    // 15 had two children; in-order successor was 17 (leftmost of right subtree
    // {17}). 17's value was copied into 15's slot, then the original 17 node
    // was unlinked as a leaf.
    expect(find(t, 15)).toBeNull();
    expect(find(t, 17)).not.toBeNull();
    const right = getNode(t, getNode(t, t.root!)!.right)!;
    expect(right.value).toBe(17);
    // The left subtree of the deleted node (rooted at 12) is preserved.
    expect(getNode(t, right.left)!.value).toBe(12);
  });
  it("delete root with two children", () => {
    const t = fromValues([10, 5, 15]);
    expect(deletePure(t, 10)).toBe(true);
    expect(t.nodes.size).toBe(2);
    // Successor of 10 is 15 (leftmost of right subtree, which is 15 itself).
    expect(getNode(t, t.root!)!.value).toBe(15);
  });
  it("delete root that is a leaf", () => {
    const t = fromValues([42]);
    expect(deletePure(t, 42)).toBe(true);
    expect(t.root).toBeNull();
    expect(t.nodes.size).toBe(0);
  });
  it("delete returns false for missing value", () => {
    const t = fromValues([10, 5]);
    expect(deletePure(t, 99)).toBe(false);
  });
  it("BST property holds after multiple deletes", () => {
    const t = fromValues([20, 10, 30, 5, 15, 25, 35, 23, 27]);
    deletePure(t, 20); // root, two children
    deletePure(t, 10); // two children
    deletePure(t, 25); // two children
    // Verify in-order is still sorted.
    const out: number[] = [];
    const walk = (id: number | null) => {
      if (id === null) return;
      const n = getNode(t, id)!;
      walk(n.left);
      out.push(n.value);
      walk(n.right);
    };
    walk(t.root);
    const sorted = [...out].sort((a, b) => a - b);
    expect(out).toEqual(sorted);
  });
});

describe("bst height / balance / stats", () => {
  it("empty tree has height -1", () => {
    expect(height(createTree())).toBe(-1);
  });
  it("single node has height 0", () => {
    const t = fromValues([5]);
    expect(height(t)).toBe(0);
  });
  it("balanced tree has correct height", () => {
    const t = fromValues([10, 5, 15, 3, 7]);
    //        10
    //       /  \
    //      5    15
    //     / \
    //    3   7
    expect(height(t)).toBe(2);
  });
  it("degenerate (sorted) tree has height n-1", () => {
    const t = sortedTree(5); // 2,4,6,8,10
    expect(height(t)).toBe(4);
  });
  it("balance factor of balanced root is 0", () => {
    const t = fromValues([10, 5, 15]);
    expect(balanceFactor(t, t.root!)).toBe(0);
  });
  it("balance factor of skewed root is positive", () => {
    const t = fromValues([10, 5, 3]);
    // 10 -> 5 (left) -> 3 (left)
    // height(left)=1, height(right)=-1, bf=2
    expect(balanceFactor(t, t.root!)).toBe(2);
  });
  it("isBalanced true for balanced tree", () => {
    expect(isBalanced(fromValues([10, 5, 15, 3, 7]))).toBe(true);
  });
  it("isBalanced false for skewed tree", () => {
    expect(isBalanced(sortedTree(5))).toBe(false);
  });
  it("isDegenerate true for sorted input ≥ 3 nodes", () => {
    expect(isDegenerate(sortedTree(5))).toBe(true);
  });
  it("isDegenerate false for balanced tree", () => {
    expect(isDegenerate(fromValues([10, 5, 15]))).toBe(false);
  });
  it("computeStats returns correct shape", () => {
    const t = fromValues([10, 5, 15, 3, 7]);
    const s = computeStats(t);
    expect(s.nodeCount).toBe(5);
    expect(s.height).toBe(2);
    expect(s.isBalanced).toBe(true);
    expect(s.isDegenerate).toBe(false);
    expect(s.minDepth).toBe(2);
  });
  it("minDepth of single-sided tree counts nodes along shortest path to a leaf", () => {
    // Tree: 5 → 3 (left). Shortest path to a leaf is 5 → 3 (2 nodes).
    const t = fromValues([5, 3]);
    expect(minDepth(t)).toBe(2);
  });
});

describe("bst layout", () => {
  it("layout assigns increasing x in in-order", () => {
    const t = fromValues([10, 5, 15, 3, 7]);
    const pos = layout(t);
    expect(pos).toHaveLength(5);
    const xs = pos.map((p) => p.x);
    for (let i = 1; i < xs.length; i++) {
      expect(xs[i]).toBeGreaterThan(xs[i - 1]);
    }
  });
  it("layout returns empty for empty tree", () => {
    expect(layout(createTree())).toEqual([]);
  });
  it("layout assigns root to depth 0", () => {
    const t = fromValues([10, 5, 15]);
    const pos = layout(t);
    const root = pos.find((p) => p.node.id === t.root);
    expect(root).toBeDefined();
    expect(root!.depth).toBe(0);
  });
});

describe("bst generator — insert", () => {
  it("insert emits compare steps and final insert step", () => {
    const t = fromValues([10, 5, 15]);
    const steps = [...insertGen(t, 12)];
    expect(steps.length).toBeGreaterThan(0);
    const last = steps[steps.length - 1];
    expect(last.kind).toBe("insert");
    expect(last.description).toContain("12");
  });
  it("insert into empty tree emits single insert step", () => {
    const steps = [...insertGen(createTree(), 42)];
    expect(steps).toHaveLength(1);
    expect(steps[0].kind).toBe("insert");
    expect(steps[0].description).toContain("root");
  });
  it("insert duplicate emits info step", () => {
    const t = fromValues([10, 5, 15]);
    const steps = [...insertGen(t, 10)];
    const last = steps[steps.length - 1];
    expect(last.kind).toBe("info");
    expect(last.description).toContain("Duplicate");
  });
});

describe("bst generator — search", () => {
  it("search hit emits found step", () => {
    const t = fromValues([10, 5, 15, 3, 7]);
    const steps = [...searchGen(t, 7)];
    const last = steps[steps.length - 1];
    expect(last.kind).toBe("found");
    expect(last.output).toEqual([7]);
  });
  it("search miss emits not-found step", () => {
    const t = fromValues([10, 5, 15]);
    const steps = [...searchGen(t, 99)];
    const last = steps[steps.length - 1];
    expect(last.kind).toBe("not-found");
  });
  it("search records comparison count", () => {
    const t = fromValues([10, 5, 15, 3, 7]);
    const steps = [...searchGen(t, 3)];
    // Root(10) → 5 → 3 = 3 comparisons
    const last = steps[steps.length - 1];
    expect(last.comparisons).toBe(3);
  });
});

describe("bst generator — delete", () => {
  it("delete leaf emits case 1 + delete", () => {
    const t = fromValues([10, 5, 15]);
    const steps = [...deleteGen(t, 5)];
    expect(steps.some((s) => s.description.includes("Case 1"))).toBe(true);
    expect(steps[steps.length - 1].kind).toBe("delete");
  });
  it("delete one-child node emits case 2", () => {
    const t = fromValues([10, 5, 15, 12]);
    const steps = [...deleteGen(t, 15)];
    expect(steps.some((s) => s.description.includes("Case 2"))).toBe(true);
  });
  it("delete two-child node emits case 3 + successor highlight", () => {
    const t = fromValues([10, 5, 15, 12, 17, 11]);
    const steps = [...deleteGen(t, 15)];
    expect(steps.some((s) => s.kind === "successor")).toBe(true);
    expect(steps.some((s) => s.description.includes("Case 3"))).toBe(true);
  });
  it("delete missing value emits not-found", () => {
    const t = fromValues([10, 5, 15]);
    const steps = [...deleteGen(t, 99)];
    expect(steps[steps.length - 1].kind).toBe("not-found");
  });
});

describe("bst traversals — output correctness", () => {
  const t = fromValues([10, 5, 15, 3, 7, 12, 20]);
  //        10
  //       /  \
  //      5    15
  //     / \  / \
  //    3  7 12 20

  it("in-order yields sorted sequence", () => {
    const r = runTraversal(t, "inorder");
    expect(r.output).toEqual([3, 5, 7, 10, 12, 15, 20]);
  });
  it("pre-order yields root-first sequence", () => {
    const r = runTraversal(t, "preorder");
    expect(r.output).toEqual([10, 5, 3, 7, 15, 12, 20]);
  });
  it("post-order yields root-last sequence", () => {
    const r = runTraversal(t, "postorder");
    expect(r.output).toEqual([3, 7, 5, 12, 20, 15, 10]);
  });
  it("level-order yields BFS sequence", () => {
    const r = runTraversal(t, "levelorder");
    expect(r.output).toEqual([10, 5, 15, 3, 7, 12, 20]);
  });
  it("traversal step output grows incrementally", () => {
    const r = runTraversal(t, "inorder");
    for (let i = 1; i < r.steps.length; i++) {
      expect(r.steps[i].output.length).toBeGreaterThanOrEqual(r.steps[i - 1].output.length);
    }
  });
  it("empty tree traversals yield no steps with empty output", () => {
    const r = runTraversal(createTree(), "inorder");
    expect(r.steps).toHaveLength(0);
    expect(r.output).toEqual([]);
  });
});

describe("bst parseValues", () => {
  it("parses comma-separated", () => {
    expect(parseValues("1, 2, 3")).toEqual({ ok: [1, 2, 3], skipped: [] });
  });
  it("parses space-separated", () => {
    expect(parseValues("4 5 6")).toEqual({ ok: [4, 5, 6], skipped: [] });
  });
  it("parses newline-separated", () => {
    expect(parseValues("7\n8\n9")).toEqual({ ok: [7, 8, 9], skipped: [] });
  });
  it("skips invalid tokens", () => {
    const r = parseValues("1, foo, 3, bar");
    expect(r.ok).toEqual([1, 3]);
    expect(r.skipped).toEqual(["foo", "bar"]);
  });
  it("empty input returns empty", () => {
    expect(parseValues("")).toEqual({ ok: [], skipped: [] });
  });
  it("handles negative numbers", () => {
    expect(parseValues("-5, -10, 7").ok).toEqual([-5, -10, 7]);
  });
});

describe("bst serialization", () => {
  it("round-trips a balanced tree", () => {
    const t = fromValues([10, 5, 15, 3, 7]);
    const s = serializeTree(t);
    const t2 = deserializeTree(s);
    expect(t2).not.toBeNull();
    expect(t2!.nodes.size).toBe(t.nodes.size);
    // Same values via in-order walk.
    const walk = (tree: BSTree): number[] => {
      const out: number[] = [];
      const go = (id: number | null) => {
        if (id === null) return;
        const n = getNode(tree, id)!;
        go(n.left); out.push(n.value); go(n.right);
      };
      go(tree.root);
      return out;
    };
    expect(walk(t2!)).toEqual(walk(t));
  });
  it("empty tree serializes to empty string", () => {
    expect(serializeTree(createTree())).toBe("");
  });
  it("empty string deserializes to empty tree", () => {
    expect(deserializeTree("")).not.toBeNull();
    expect(deserializeTree("")!.nodes.size).toBe(0);
  });
  it("invalid input returns null", () => {
    expect(deserializeTree("1, foo, 3")).toBeNull();
  });
  it("round-trip preserves shape via pre-order", () => {
    const t = fromValues([50, 30, 70, 20, 40, 60, 80]);
    const s = serializeTree(t);
    const t2 = deserializeTree(s);
    // Both trees should have the same structure (same pre-order).
    const pre = (tree: BSTree): number[] => {
      const out: number[] = [];
      const go = (id: number | null) => {
        if (id === null) return;
        const n = getNode(tree, id)!;
        out.push(n.value); go(n.left); go(n.right);
      };
      go(tree.root);
      return out;
    };
    expect(pre(t2!)).toEqual(pre(t));
  });
});

describe("bst step helpers", () => {
  it("nodeColorClass returns 'successor' for successor node", () => {
    const t = fromValues([10, 5, 15, 12, 17, 11]);
    const steps = [...deleteGen(t, 15)];
    const succStep = steps.find((s) => s.kind === "successor")!;
    const succId = succStep.successor!;
    expect(nodeColorClass(succId, succStep)).toBe("successor");
  });
  it("nodeColorClass returns 'found' for found node", () => {
    const t = fromValues([10, 5, 15]);
    const steps = [...searchGen(t, 10)];
    const last = steps[steps.length - 1];
    expect(nodeColorClass(t.root!, last)).toBe("found");
  });
  it("formatStep includes comparisons and output", () => {
    const t = fromValues([10, 5, 15, 3, 7]);
    const steps = [...inOrderGen(t)];
    const formatted = formatStep(steps[0], 0, steps.length);
    expect(formatted).toContain("cmp=");
    expect(formatted).toContain("output=");
  });
});

describe("bst runInsert / runDelete / runSearch", () => {
  it("runInsert returns OpResult with steps", () => {
    const t = fromValues([10, 5, 15]);
    const r = runInsert(t, 12);
    expect(r.kind).toBe("insert");
    expect(r.steps.length).toBeGreaterThan(0);
    expect(r.found).toBe(true);
  });
  it("runDelete returns OpResult", () => {
    const t = fromValues([10, 5, 15]);
    const r = runDelete(t, 5);
    expect(r.kind).toBe("delete");
    expect(r.found).toBe(true);
  });
  it("runSearch returns OpResult with found flag", () => {
    const t = fromValues([10, 5, 15]);
    const hit = runSearch(t, 10);
    expect(hit.found).toBe(true);
    const miss = runSearch(t, 99);
    expect(miss.found).toBe(false);
  });
});

describe("bst presets", () => {
  it("randomTree produces a tree with the requested node count", () => {
    const t = randomTree(10, 42);
    expect(t.nodes.size).toBe(10);
  });
  it("randomTree is deterministic given a seed", () => {
    const a = randomTree(8, 7);
    const b = randomTree(8, 7);
    const sa = serializeTree(a);
    const sb = serializeTree(b);
    expect(sa).toBe(sb);
  });
  it("sortedTree produces a degenerate tree", () => {
    const t = sortedTree(6);
    expect(isDegenerate(t)).toBe(true);
  });
  it("mulberry32 is deterministic", () => {
    const a = mulberry32(99);
    const b = mulberry32(99);
    expect(a()).toBe(b());
    expect(a()).toBe(b());
  });
});

describe("bst history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1, op: "insert", value: 5,
      nodeCount: 3, height: 1, comparisons: 2, found: true,
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i, op: "insert", value: i,
        nodeCount: 1, height: 0, comparisons: 1, found: true,
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1, op: "insert", value: 5,
      nodeCount: 3, height: 1, comparisons: 2, found: true,
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("bst shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const t = fromValues([10, 5, 15]);
    const url = buildShareUrl(t);
    expect(url).toContain("t=10%2C5%2C15");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const t = fromValues([10, 5, 15, 3, 7]);
    const url = buildShareUrl(t);
    const hash = url.includes("#") ? url.slice(url.indexOf("#")) : url;
    const p = parseShareUrl(hash);
    expect(p).not.toBeNull();
    expect(p!.tree).toBe("10,5,3,7,15");
  });
  it("parses empty hash as null", () => {
    expect(parseShareUrl("")).toBeNull();
  });
  it("round-trips through deserializeTree", () => {
    const t = fromValues([50, 30, 70, 20, 40, 60, 80]);
    const url = buildShareUrl(t);
    const hash = url.includes("#") ? url.slice(url.indexOf("#")) : url;
    const p = parseShareUrl(hash);
    const t2 = deserializeTree(p!.tree);
    expect(t2).not.toBeNull();
    expect(t2!.nodes.size).toBe(t.nodes.size);
  });
  it("empty tree produces empty share param", () => {
    const t = createTree();
    const url = buildShareUrl(t);
    // Should produce an empty `?` URL without `t=`.
    expect(url).not.toContain("t=");
  });
});

// Suppress unused-import lint
export type _Unused = OpKind;
