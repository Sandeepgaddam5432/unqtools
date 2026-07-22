/**
 * Binary Search Tree (BST) Visualizer — pure logic.
 *
 * Generator-based step engine for visualizing BST insert, delete (3
 * cases), search, and four traversals (in / pre / post / level-order).
 * Each operation yields a stream of Step objects — each carrying a full
 * tree snapshot (serializable node list), the active comparison node, and
 * running output — so the UI can step forward and backward without
 * re-running. Pure functions only — no DOM, no network.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BSTNode {
  id: number;
  value: number;
  left: number | null;   // node id
  right: number | null;  // node id
  parent: number | null; // node id
}

export interface BSTree {
  nodes: Map<number, BSTNode>;
  root: number | null;
  nextId: number;
}

export interface PositionedNode {
  node: BSTNode;
  x: number;
  y: number;
  depth: number;
}

export type OpKind =
  | "insert"
  | "delete"
  | "search"
  | "traverse-inorder"
  | "traverse-preorder"
  | "traverse-postorder"
  | "traverse-levelorder";

export type StepKind =
  | "compare"
  | "visit"
  | "insert"
  | "delete"
  | "successor"
  | "info"
  | "found"
  | "not-found";

export interface Step {
  /** Snapshot of the tree AT THIS MOMENT (post any link mutation). */
  tree: BSTree;
  /** Active comparison node id (or null). */
  active: number | null;
  /** Comparison path from root to active node so far (node ids). */
  path: number[];
  /** Highlighted successor / predecessor node (for delete). */
  successor: number | null;
  /** Output sequence so far (for traversals). */
  output: number[];
  /** Step kind for color coding. */
  kind: StepKind;
  /** Running comparison count. */
  comparisons: number;
  /** Human-readable description. */
  description: string;
}

export interface OpResult {
  kind: OpKind;
  steps: Step[];
  totalComparisons: number;
  /** Final output sequence (for traversals / search hit). */
  output: number[];
  found: boolean;
  error?: string;
}

export interface TreeStats {
  nodeCount: number;
  height: number;
  isBalanced: boolean;
  isDegenerate: boolean;
  minDepth: number;
}

// ---------------------------------------------------------------------------
// Tree construction & manipulation (pure)
// ---------------------------------------------------------------------------

export function createTree(): BSTree {
  return { nodes: new Map(), root: null, nextId: 1 };
}

export function cloneTree(tree: BSTree): BSTree {
  const nodes = new Map<number, BSTNode>();
  for (const [k, v] of tree.nodes) {
    nodes.set(k, { ...v });
  }
  return { nodes, root: tree.root, nextId: tree.nextId };
}

export function getNode(tree: BSTree, id: number | null): BSTNode | null {
  if (id === null) return null;
  return tree.nodes.get(id) ?? null;
}

export function find(tree: BSTree, value: number): BSTNode | null {
  let cur = tree.root;
  while (cur !== null) {
    const n = tree.nodes.get(cur)!;
    if (value === n.value) return n;
    cur = value < n.value ? n.left : n.right;
  }
  return null;
}

/** Build a tree from a list of values (skipping duplicates). */
export function fromValues(values: number[]): BSTree {
  const t = createTree();
  for (const v of values) insertPure(t, v);
  return t;
}

/** Insert a value (no steps). Returns true if inserted, false if duplicate. */
export function insertPure(tree: BSTree, value: number): boolean {
  const node: BSTNode = {
    id: tree.nextId++,
    value,
    left: null,
    right: null,
    parent: null,
  };
  if (tree.root === null) {
    tree.root = node.id;
    tree.nodes.set(node.id, node);
    return true;
  }
  let curId = tree.root;
  while (true) {
    const cur = tree.nodes.get(curId)!;
    if (value === cur.value) return false; // duplicate, skip
    if (value < cur.value) {
      if (cur.left === null) {
        cur.left = node.id;
        node.parent = cur.id;
        tree.nodes.set(node.id, node);
        return true;
      }
      curId = cur.left;
    } else {
      if (cur.right === null) {
        cur.right = node.id;
        node.parent = cur.id;
        tree.nodes.set(node.id, node);
        return true;
      }
      curId = cur.right;
    }
  }
}

/** Find the in-order successor (leftmost node of right subtree). */
export function successor(tree: BSTree, id: number): BSTNode | null {
  const node = getNode(tree, id);
  if (!node) return null;
  if (node.right !== null) {
    let curId: number = node.right;
    while (tree.nodes.get(curId)!.left !== null) {
      curId = tree.nodes.get(curId)!.left as number;
    }
    return tree.nodes.get(curId)!;
  }
  // No right subtree — walk up.
  let curId: number | null = id;
  let parent = node.parent;
  while (parent !== null && curId !== null) {
    const p = tree.nodes.get(parent)!;
    if (p.left === curId) return p;
    curId = parent;
    parent = p.parent;
  }
  return null;
}

/** Find the in-order predecessor (rightmost node of left subtree). */
export function predecessor(tree: BSTree, id: number): BSTNode | null {
  const node = getNode(tree, id);
  if (!node) return null;
  if (node.left !== null) {
    let curId: number = node.left;
    while (tree.nodes.get(curId)!.right !== null) {
      curId = tree.nodes.get(curId)!.right as number;
    }
    return tree.nodes.get(curId)!;
  }
  let curId: number | null = id;
  let parent = node.parent;
  while (parent !== null && curId !== null) {
    const p = tree.nodes.get(parent)!;
    if (p.right === curId) return p;
    curId = parent;
    parent = p.parent;
  }
  return null;
}

/** Delete a value (no steps). Returns true if deleted, false if not found. */
export function deletePure(tree: BSTree, value: number): boolean {
  const node = find(tree, value);
  if (!node) return false;
  deleteNodePure(tree, node.id);
  return true;
}

/** Delete a node by id, handling all three cases. */
function deleteNodePure(tree: BSTree, id: number): void {
  const node = getNode(tree, id);
  if (!node) return;
  const parentId = node.parent;
  const isLeft = parentId !== null ? tree.nodes.get(parentId)!.left === id : false;

  // Case 1: leaf node.
  if (node.left === null && node.right === null) {
    if (parentId === null) tree.root = null;
    else if (isLeft) tree.nodes.get(parentId)!.left = null;
    else tree.nodes.get(parentId)!.right = null;
    tree.nodes.delete(id);
    return;
  }

  // Case 2: one child.
  if (node.left === null || node.right === null) {
    const childId = node.left ?? node.right;
    const child = tree.nodes.get(childId!)!;
    child.parent = parentId;
    if (parentId === null) tree.root = childId;
    else if (isLeft) tree.nodes.get(parentId)!.left = childId;
    else tree.nodes.get(parentId)!.right = childId;
    tree.nodes.delete(id);
    return;
  }

  // Case 3: two children — replace value with successor, then delete successor.
  const succ = successor(tree, id)!;
  node.value = succ.value;
  deleteNodePure(tree, succ.id);
}

// ---------------------------------------------------------------------------
// Height / balance / stats
// ---------------------------------------------------------------------------

export function height(tree: BSTree, nodeId: number | null = tree.root): number {
  if (nodeId === null) return -1;
  const n = tree.nodes.get(nodeId)!;
  return 1 + Math.max(height(tree, n.left), height(tree, n.right));
}

export function balanceFactor(tree: BSTree, nodeId: number): number {
  const n = tree.nodes.get(nodeId);
  if (!n) return 0;
  return height(tree, n.left) - height(tree, n.right);
}

export function minDepth(tree: BSTree, nodeId: number | null = tree.root): number {
  if (nodeId === null) return 0;
  const n = tree.nodes.get(nodeId)!;
  if (n.left === null && n.right === null) return 1;
  const l = n.left !== null ? minDepth(tree, n.left) : Infinity;
  const r = n.right !== null ? minDepth(tree, n.right) : Infinity;
  return 1 + Math.min(l, r);
}

export function isBalanced(tree: BSTree): boolean {
  for (const id of tree.nodes.keys()) {
    const bf = balanceFactor(tree, id);
    if (bf < -1 || bf > 1) return false;
  }
  return true;
}

export function isDegenerate(tree: BSTree): boolean {
  if (tree.root === null) return false;
  // Every non-leaf has exactly one child.
  for (const n of tree.nodes.values()) {
    if (n.left !== null && n.right !== null) return false;
  }
  return tree.nodes.size >= 3;
}

export function computeStats(tree: BSTree): TreeStats {
  const nodeCount = tree.nodes.size;
  const h = height(tree);
  return {
    nodeCount,
    height: h,
    isBalanced: isBalanced(tree),
    isDegenerate: isDegenerate(tree),
    minDepth: minDepth(tree),
  };
}

// ---------------------------------------------------------------------------
// Tree layout (Reingold-Tilford-style simplified)
// ---------------------------------------------------------------------------

export function layout(tree: BSTree): PositionedNode[] {
  const positioned: PositionedNode[] = [];
  if (tree.root === null) return positioned;
  let nextX = 0;
  const walk = (id: number, depth: number) => {
    const n = tree.nodes.get(id)!;
    if (n.left !== null) walk(n.left, depth + 1);
    positioned.push({ node: n, x: nextX, y: depth, depth });
    nextX += 1;
    if (n.right !== null) walk(n.right, depth + 1);
  };
  walk(tree.root, 0);
  return positioned;
}

// ---------------------------------------------------------------------------
// Step-based operations (generator)
// ---------------------------------------------------------------------------

export function* insertGen(tree: BSTree, value: number): Generator<Step> {
  const t = cloneTree(tree);
  let comparisons = 0;
  const path: number[] = [];

  if (t.root === null) {
    const newNode: BSTNode = { id: t.nextId++, value, left: null, right: null, parent: null };
    t.root = newNode.id;
    t.nodes.set(newNode.id, newNode);
    yield {
      tree: cloneTree(t),
      active: newNode.id,
      path: [newNode.id],
      successor: null,
      output: [],
      kind: "insert",
      comparisons: 0,
      description: `Inserted ${value} as root.`,
    };
    return;
  }

  let curId: number | null = t.root;
  while (curId !== null) {
    const cur = t.nodes.get(curId)!;
    comparisons++;
    path.push(cur.id);
    yield {
      tree: cloneTree(t),
      active: cur.id,
      path: [...path],
      successor: null,
      output: [],
      kind: "compare",
      comparisons,
      description: `Compare ${value} with ${cur.value}: go ${value < cur.value ? "left" : value > cur.value ? "right" : "duplicate"}.`,
    };
    if (value === cur.value) {
      yield {
        tree: cloneTree(t),
        active: cur.id,
        path: [...path],
        successor: null,
        output: [],
        kind: "info",
        comparisons,
        description: `Duplicate ${value} — skip insert.`,
      };
      return;
    }
    if (value < cur.value) {
      if (cur.left === null) {
        const newNode: BSTNode = { id: t.nextId++, value, left: null, right: null, parent: cur.id };
        cur.left = newNode.id;
        t.nodes.set(newNode.id, newNode);
        yield {
          tree: cloneTree(t),
          active: newNode.id,
          path: [...path, newNode.id],
          successor: null,
          output: [],
          kind: "insert",
          comparisons,
          description: `Inserted ${value} as left child of ${cur.value}.`,
        };
        return;
      }
      curId = cur.left;
    } else {
      if (cur.right === null) {
        const newNode: BSTNode = { id: t.nextId++, value, left: null, right: null, parent: cur.id };
        cur.right = newNode.id;
        t.nodes.set(newNode.id, newNode);
        yield {
          tree: cloneTree(t),
          active: newNode.id,
          path: [...path, newNode.id],
          successor: null,
          output: [],
          kind: "insert",
          comparisons,
          description: `Inserted ${value} as right child of ${cur.value}.`,
        };
        return;
      }
      curId = cur.right;
    }
  }
}

export function* searchGen(tree: BSTree, value: number): Generator<Step> {
  const t = cloneTree(tree);
  let comparisons = 0;
  const path: number[] = [];
  let curId: number | null = t.root;
  while (curId !== null) {
    const cur = t.nodes.get(curId)!;
    comparisons++;
    path.push(cur.id);
    if (value === cur.value) {
      yield {
        tree: cloneTree(t),
        active: cur.id,
        path: [...path],
        successor: null,
        output: [cur.value],
        kind: "found",
        comparisons,
        description: `Found ${value} after ${comparisons} comparison${comparisons === 1 ? "" : "s"}.`,
      };
      return;
    }
    yield {
      tree: cloneTree(t),
      active: cur.id,
      path: [...path],
      successor: null,
      output: [],
      kind: "compare",
      comparisons,
      description: `Compare ${value} with ${cur.value}: go ${value < cur.value ? "left" : "right"}.`,
    };
    curId = value < cur.value ? cur.left : cur.right;
  }
  yield {
    tree: cloneTree(t),
    active: null,
    path: [...path],
    successor: null,
    output: [],
    kind: "not-found",
    comparisons,
    description: `${value} not in tree after ${comparisons} comparison${comparisons === 1 ? "" : "s"}.`,
  };
}

export function* deleteGen(tree: BSTree, value: number): Generator<Step> {
  const t = cloneTree(tree);
  let comparisons = 0;
  const path: number[] = [];

  // Find the node first.
  let curId: number | null = t.root;
  let target: BSTNode | null = null;
  while (curId !== null) {
    const cur = t.nodes.get(curId)!;
    comparisons++;
    path.push(cur.id);
    yield {
      tree: cloneTree(t),
      active: cur.id,
      path: [...path],
      successor: null,
      output: [],
      kind: "compare",
      comparisons,
      description: `Compare ${value} with ${cur.value}.`,
    };
    if (value === cur.value) { target = cur; break; }
    curId = value < cur.value ? cur.left : cur.right;
  }

  if (!target) {
    yield {
      tree: cloneTree(t),
      active: null,
      path: [...path],
      successor: null,
      output: [],
      kind: "not-found",
      comparisons,
      description: `${value} not in tree — nothing to delete.`,
    };
    return;
  }

  yield {
    tree: cloneTree(t),
    active: target.id,
    path: [...path],
    successor: null,
    output: [],
    kind: "visit",
    comparisons,
    description: `Found ${value}. Deleting...`,
  };

  // Case 1: leaf.
  if (target.left === null && target.right === null) {
    yield {
      tree: cloneTree(t),
      active: target.id,
      path: [...path],
      successor: null,
      output: [],
      kind: "info",
      comparisons,
      description: "Case 1: leaf node — simply unlink.",
    };
    unlinkNode(t, target.id);
    yield {
      tree: cloneTree(t),
      active: null,
      path: [],
      successor: null,
      output: [],
      kind: "delete",
      comparisons,
      description: `Deleted leaf ${value}.`,
    };
    return;
  }

  // Case 2: one child.
  if (target.left === null || target.right === null) {
    const childId = target.left ?? target.right;
    yield {
      tree: cloneTree(t),
      active: target.id,
      path: [...path],
      successor: childId,
      output: [],
      kind: "info",
      comparisons,
      description: `Case 2: one child (${t.nodes.get(childId!)!.value}) — splice child up.`,
    };
    spliceChildUp(t, target.id);
    yield {
      tree: cloneTree(t),
      active: null,
      path: [],
      successor: null,
      output: [],
      kind: "delete",
      comparisons,
      description: `Spliced child up; removed ${value}.`,
    };
    return;
  }

  // Case 3: two children — find successor.
  const succ = successor(t, target.id)!;
  yield {
    tree: cloneTree(t),
    active: target.id,
    path: [...path],
    successor: succ.id,
    output: [],
    kind: "successor",
    comparisons,
    description: `Case 3: two children — in-order successor is ${succ.value}.`,
  };
  target.value = succ.value;
  yield {
    tree: cloneTree(t),
    active: target.id,
    path: [...path],
    successor: succ.id,
    output: [],
    kind: "info",
    comparisons,
    description: `Copy successor ${succ.value} into deleted slot; now delete successor.`,
  };
  // Delete the successor (which has at most one child — case 1 or 2).
  deleteNodePure(t, succ.id);
  yield {
    tree: cloneTree(t),
    active: null,
    path: [],
    successor: null,
    output: [],
    kind: "delete",
    comparisons,
    description: `Removed successor; ${succ.value} now in place of ${value}.`,
  };
}

function unlinkNode(t: BSTree, id: number): void {
  const n = t.nodes.get(id)!;
  const p = n.parent;
  if (p === null) t.root = null;
  else {
    const pn = t.nodes.get(p)!;
    if (pn.left === id) pn.left = null;
    else pn.right = null;
  }
  t.nodes.delete(id);
}

function spliceChildUp(t: BSTree, id: number): void {
  const n = t.nodes.get(id)!;
  const childId = n.left ?? n.right;
  const child = t.nodes.get(childId!)!;
  child.parent = n.parent;
  if (n.parent === null) t.root = childId;
  else {
    const p = t.nodes.get(n.parent)!;
    if (p.left === id) p.left = childId;
    else p.right = childId;
  }
  t.nodes.delete(id);
}

// ---------------------------------------------------------------------------
// Traversals (generator-based, with synchronized output)
// ---------------------------------------------------------------------------

export function* inOrderGen(tree: BSTree): Generator<Step> {
  const t = cloneTree(tree);
  const output: number[] = [];
  let comparisons = 0;
  function* walk(id: number | null): Generator<Step> {
    if (id === null) return;
    const n = t.nodes.get(id)!;
    yield* walk(n.left);
    comparisons++;
    output.push(n.value);
    yield {
      tree: cloneTree(t),
      active: n.id,
      path: [],
      successor: null,
      output: [...output],
      kind: "visit",
      comparisons,
      description: `In-order visit ${n.value}.`,
    };
    yield* walk(n.right);
  }
  yield* walk(t.root);
}

export function* preOrderGen(tree: BSTree): Generator<Step> {
  const t = cloneTree(tree);
  const output: number[] = [];
  let comparisons = 0;
  function* walk(id: number | null): Generator<Step> {
    if (id === null) return;
    const n = t.nodes.get(id)!;
    comparisons++;
    output.push(n.value);
    yield {
      tree: cloneTree(t),
      active: n.id,
      path: [],
      successor: null,
      output: [...output],
      kind: "visit",
      comparisons,
      description: `Pre-order visit ${n.value}.`,
    };
    yield* walk(n.left);
    yield* walk(n.right);
  }
  yield* walk(t.root);
}

export function* postOrderGen(tree: BSTree): Generator<Step> {
  const t = cloneTree(tree);
  const output: number[] = [];
  let comparisons = 0;
  function* walk(id: number | null): Generator<Step> {
    if (id === null) return;
    const n = t.nodes.get(id)!;
    yield* walk(n.left);
    yield* walk(n.right);
    comparisons++;
    output.push(n.value);
    yield {
      tree: cloneTree(t),
      active: n.id,
      path: [],
      successor: null,
      output: [...output],
      kind: "visit",
      comparisons,
      description: `Post-order visit ${n.value}.`,
    };
  }
  yield* walk(t.root);
}

export function* levelOrderGen(tree: BSTree): Generator<Step> {
  const t = cloneTree(tree);
  const output: number[] = [];
  let comparisons = 0;
  if (t.root === null) return;
  const queue: number[] = [t.root];
  while (queue.length > 0) {
    const id = queue.shift()!;
    const n = t.nodes.get(id)!;
    comparisons++;
    output.push(n.value);
    yield {
      tree: cloneTree(t),
      active: n.id,
      path: [],
      successor: null,
      output: [...output],
      kind: "visit",
      comparisons,
      description: `Level-order visit ${n.value}.`,
    };
    if (n.left !== null) queue.push(n.left);
    if (n.right !== null) queue.push(n.right);
  }
}

// ---------------------------------------------------------------------------
// Run dispatchers
// ---------------------------------------------------------------------------

export function runInsert(tree: BSTree, value: number): OpResult {
  const steps: Step[] = [];
  for (const s of insertGen(tree, value)) steps.push(s);
  const last = steps[steps.length - 1];
  return {
    kind: "insert",
    steps,
    totalComparisons: last?.comparisons ?? 0,
    output: [],
    found: last?.kind === "insert",
  };
}

export function runDelete(tree: BSTree, value: number): OpResult {
  const steps: Step[] = [];
  for (const s of deleteGen(tree, value)) steps.push(s);
  const last = steps[steps.length - 1];
  return {
    kind: "delete",
    steps,
    totalComparisons: last?.comparisons ?? 0,
    output: [],
    found: last?.kind === "delete",
  };
}

export function runSearch(tree: BSTree, value: number): OpResult {
  const steps: Step[] = [];
  for (const s of searchGen(tree, value)) steps.push(s);
  const last = steps[steps.length - 1];
  return {
    kind: "search",
    steps,
    totalComparisons: last?.comparisons ?? 0,
    output: last?.output ?? [],
    found: last?.kind === "found",
  };
}

export function runTraversal(tree: BSTree, kind: "inorder" | "preorder" | "postorder" | "levelorder"): OpResult {
  let gen: Generator<Step>;
  let opKind: OpKind;
  switch (kind) {
    case "inorder": gen = inOrderGen(tree); opKind = "traverse-inorder"; break;
    case "preorder": gen = preOrderGen(tree); opKind = "traverse-preorder"; break;
    case "postorder": gen = postOrderGen(tree); opKind = "traverse-postorder"; break;
    case "levelorder": gen = levelOrderGen(tree); opKind = "traverse-levelorder"; break;
  }
  const steps: Step[] = [];
  for (const s of gen) steps.push(s);
  const last = steps[steps.length - 1];
  return {
    kind: opKind,
    steps,
    totalComparisons: last?.comparisons ?? 0,
    output: last?.output ?? [],
    found: true,
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

export function serializeTree(tree: BSTree): string {
  if (tree.root === null) return "";
  // Encode as the insertion order that would produce the same tree.
  // We do a level-order walk to capture the structure (BFS), then encode
  // each node's value. To be safe, we use pre-order which fully determines
  // a BST when read back via insertion (since insert order matters for
  // shape but pre-order IS the insertion order that produces this shape).
  const values: number[] = [];
  const walk = (id: number | null) => {
    if (id === null) return;
    const n = tree.nodes.get(id)!;
    values.push(n.value);
    walk(n.left);
    walk(n.right);
  };
  walk(tree.root);
  return values.join(",");
}

export function deserializeTree(s: string): BSTree | null {
  if (!s || !s.trim()) return createTree();
  const tokens = s.split(/[\s,;]+/).filter(Boolean);
  const values: number[] = [];
  for (const tok of tokens) {
    const n = Number.parseInt(tok, 10);
    if (Number.isFinite(n)) values.push(n);
    else return null;
  }
  return fromValues(values);
}

// ---------------------------------------------------------------------------
// Step / color helpers
// ---------------------------------------------------------------------------

export function nodeColorClass(
  nodeId: number,
  step: Step,
): string {
  if (step.successor === nodeId) return "successor";
  if (step.active === nodeId) {
    if (step.kind === "found") return "found";
    if (step.kind === "insert") return "insert";
    if (step.kind === "compare") return "compare";
    return "active";
  }
  if (step.path.includes(nodeId)) return "path";
  return "default";
}

export function formatStep(step: Step, stepIndex: number, total: number): string {
  const out = step.output.length > 0 ? ` output=[${step.output.join(",")}]` : "";
  return `[${stepIndex + 1}/${total}] ${step.description}  (cmp=${step.comparisons}${out})`;
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:binary-search-tree-bst-visualizer:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  op: OpKind;
  value?: number;
  nodeCount: number;
  height: number;
  comparisons: number;
  found: boolean;
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
  tree: string;
}

export function buildShareUrl(tree: BSTree): string {
  const params = new URLSearchParams();
  const s = serializeTree(tree);
  if (s) params.set("t", s);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareParams | null {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return null;
  const params = new URLSearchParams(clean);
  const t = params.get("t");
  if (t === null) return null;
  return { tree: t };
}

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

export function randomTree(count: number, seed: number = 1): BSTree {
  const rand = mulberry32(seed);
  const set = new Set<number>();
  while (set.size < count) {
    set.add(Math.floor(rand() * 100));
  }
  return fromValues([...set]);
}

export function sortedTree(count: number): BSTree {
  const vals: number[] = [];
  for (let i = 1; i <= count; i++) vals.push(i * 2);
  return fromValues(vals);
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
