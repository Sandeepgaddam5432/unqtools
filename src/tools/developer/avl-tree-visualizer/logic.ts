/**
 * AVL Tree Visualizer — pure logic.
 *
 * Generator-based step engine for visualizing self-balancing AVL tree
 * insert, delete, search, and in-order traversal. Every operation yields
 * a stream of Step objects — each carrying a full tree snapshot
 * (serializable node list), the active comparison / pivot node, balance
 * factors for every node, and a labeled rotation step (LL / RR / LR / RL)
 * including double rotations split into their two single-rotation phases.
 *
 * Pure functions only — no DOM, no network.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AVLNode {
  id: number;
  value: number;
  left: number | null;   // node id
  right: number | null;  // node id
  parent: number | null; // node id
  height: number;        // cached subtree height (leaf = 0)
}

export interface AVLTree {
  nodes: Map<number, AVLNode>;
  root: number | null;
  nextId: number;
}

export interface PositionedNode {
  node: AVLNode;
  x: number;
  y: number;
  depth: number;
}

export type OpKind =
  | "insert"
  | "delete"
  | "search"
  | "traverse-inorder";

export type RotationKind =
  | "LL"
  | "RR"
  | "LR"
  | "RL"
  | "NONE";

export type StepKind =
  | "compare"
  | "visit"
  | "insert"
  | "delete"
  | "info"
  | "rotation"
  | "found"
  | "not-found"
  | "imbalance";

export interface Step {
  /** Snapshot of the tree AT THIS MOMENT (post any link mutation). */
  tree: AVLTree;
  /** Active comparison / pivot node id (or null). */
  active: number | null;
  /** Comparison path from root to active node so far (node ids). */
  path: number[];
  /** Pivot node id when a rotation is happening (else null). */
  pivot: number | null;
  /** Highlighted successor / predecessor node (for delete). */
  successor: number | null;
  /** Output sequence so far (for traversals / search hit). */
  output: number[];
  /** Step kind for color coding. */
  kind: StepKind;
  /** Rotation type label (LL / RR / LR / RL / NONE). */
  rotation: RotationKind;
  /** Running comparison count. */
  comparisons: number;
  /** Running rotation count. */
  rotations: number;
  /** Human-readable description. */
  description: string;
}

export interface OpResult {
  kind: OpKind;
  steps: Step[];
  totalComparisons: number;
  totalRotations: number;
  output: number[];
  found: boolean;
  /** Final tree state after the operation committed. */
  finalTree: AVLTree;
  error?: string;
}

export interface TreeStats {
  nodeCount: number;
  height: number;
  isBalanced: boolean;
  minBalanceFactor: number;
  maxBalanceFactor: number;
}

// ---------------------------------------------------------------------------
// Tree construction & manipulation (pure)
// ---------------------------------------------------------------------------

export function createTree(): AVLTree {
  return { nodes: new Map(), root: null, nextId: 1 };
}

export function cloneTree(tree: AVLTree): AVLTree {
  const nodes = new Map<number, AVLNode>();
  for (const [k, v] of tree.nodes) {
    nodes.set(k, { ...v });
  }
  return { nodes, root: tree.root, nextId: tree.nextId };
}

export function getNode(tree: AVLTree, id: number | null): AVLNode | null {
  if (id === null) return null;
  return tree.nodes.get(id) ?? null;
}

export function find(tree: AVLTree, value: number): AVLNode | null {
  let cur = tree.root;
  while (cur !== null) {
    const n = tree.nodes.get(cur)!;
    if (value === n.value) return n;
    cur = value < n.value ? n.left : n.right;
  }
  return null;
}

/** Build a tree from a list of values (skipping duplicates). */
export function fromValues(values: number[]): AVLTree {
  const t = createTree();
  for (const v of values) insertPure(t, v);
  return t;
}

// ---------------------------------------------------------------------------
// Heights & balance factors
// ---------------------------------------------------------------------------

export function nodeHeight(tree: AVLTree, id: number | null): number {
  if (id === null) return -1;
  const n = tree.nodes.get(id);
  if (!n) return -1;
  return n.height;
}

/** Recompute a node's height from its children (caller must guarantee child heights are correct). */
export function updateHeight(tree: AVLTree, id: number): void {
  const n = tree.nodes.get(id);
  if (!n) return;
  n.height = 1 + Math.max(nodeHeight(tree, n.left), nodeHeight(tree, n.right));
}

/** Balance factor of a node = h(left) − h(right). */
export function balanceFactor(tree: AVLTree, id: number): number {
  const n = tree.nodes.get(id);
  if (!n) return 0;
  return nodeHeight(tree, n.left) - nodeHeight(tree, n.right);
}

/** Height of the entire tree (root subtree). */
export function height(tree: AVLTree, id: number | null = tree.root): number {
  if (id === null) return -1;
  return nodeHeight(tree, id);
}

/** Is the AVL invariant (|bf| ≤ 1) satisfied for every node? */
export function isBalanced(tree: AVLTree): boolean {
  for (const id of tree.nodes.keys()) {
    const bf = balanceFactor(tree, id);
    if (bf < -1 || bf > 1) return false;
  }
  return true;
}

/** Min and max balance factor across all nodes (for stat display). */
export function balanceRange(tree: AVLTree): { min: number; max: number } {
  let min = 0;
  let max = 0;
  for (const id of tree.nodes.keys()) {
    const bf = balanceFactor(tree, id);
    if (bf < min) min = bf;
    if (bf > max) max = bf;
  }
  return { min, max };
}

export function computeStats(tree: AVLTree): TreeStats {
  const { min, max } = balanceRange(tree);
  return {
    nodeCount: tree.nodes.size,
    height: height(tree),
    isBalanced: isBalanced(tree),
    minBalanceFactor: min,
    maxBalanceFactor: max,
  };
}

// ---------------------------------------------------------------------------
// Rotations (pure, in-place)
// ---------------------------------------------------------------------------

/** Right rotation around pivot `y`. Returns the new subtree root id. */
export function rotateRight(tree: AVLTree, yId: number): number {
  const y = tree.nodes.get(yId)!;
  const xId = y.left;
  if (xId === null) return yId; // defensive — shouldn't happen
  const x = tree.nodes.get(xId)!;
  const t2 = x.right;

  // Perform rotation.
  x.right = yId;
  y.left = t2;

  // Fix parents.
  x.parent = y.parent;
  y.parent = xId;
  if (t2 !== null) {
    tree.nodes.get(t2)!.parent = yId;
  }

  // Re-link parent's child pointer (or root).
  if (x.parent === null) {
    tree.root = xId;
  } else {
    const p = tree.nodes.get(x.parent)!;
    if (p.left === yId) p.left = xId;
    else p.right = xId;
  }

  // Update heights (y first because x depends on y).
  updateHeight(tree, yId);
  updateHeight(tree, xId);

  return xId;
}

/** Left rotation around pivot `x`. Returns the new subtree root id. */
export function rotateLeft(tree: AVLTree, xId: number): number {
  const x = tree.nodes.get(xId)!;
  const yId = x.right;
  if (yId === null) return xId;
  const y = tree.nodes.get(yId)!;
  const t2 = y.left;

  y.left = xId;
  x.right = t2;

  y.parent = x.parent;
  x.parent = yId;
  if (t2 !== null) {
    tree.nodes.get(t2)!.parent = xId;
  }

  if (y.parent === null) {
    tree.root = yId;
  } else {
    const p = tree.nodes.get(y.parent)!;
    if (p.left === xId) p.left = yId;
    else p.right = yId;
  }

  updateHeight(tree, xId);
  updateHeight(tree, yId);

  return yId;
}

/** Determine rotation type given the unbalanced node and the path taken. */
export function identifyRotation(
  tree: AVLTree,
  zId: number,
  cameFromLeft: boolean,
  childCameFromLeft: boolean,
): RotationKind {
  // bf(z) > 1 → left-heavy (LL or LR).
  // bf(z) < -1 → right-heavy (RR or RL).
  if (cameFromLeft) {
    return childCameFromLeft ? "LL" : "LR";
  }
  return childCameFromLeft ? "RL" : "RR";
}

// ---------------------------------------------------------------------------
// Pure insert / delete (no steps) — useful for bulk & test helpers.
// ---------------------------------------------------------------------------

export function insertPure(tree: AVLTree, value: number): boolean {
  return insertInternal(tree, value);
}

function insertInternal(tree: AVLTree, value: number): boolean {
  // Standard BST insert + walk back up rebalancing.
  const path: number[] = [];
  if (tree.root === null) {
    const node: AVLNode = {
      id: tree.nextId++,
      value,
      left: null,
      right: null,
      parent: null,
      height: 0,
    };
    tree.root = node.id;
    tree.nodes.set(node.id, node);
    return true;
  }
  let curId: number | null = tree.root;
  while (curId !== null) {
    const cur = tree.nodes.get(curId)!;
    if (value === cur.value) return false; // duplicate
    path.push(curId);
    if (value < cur.value) {
      if (cur.left === null) {
        const node: AVLNode = {
          id: tree.nextId++,
          value,
          left: null,
          right: null,
          parent: curId,
          height: 0,
        };
        cur.left = node.id;
        tree.nodes.set(node.id, node);
        break;
      }
      curId = cur.left;
    } else {
      if (cur.right === null) {
        const node: AVLNode = {
          id: tree.nextId++,
          value,
          left: null,
          right: null,
          parent: curId,
          height: 0,
        };
        cur.right = node.id;
        tree.nodes.set(node.id, node);
        break;
      }
      curId = cur.right;
    }
  }
  // Walk back up, update heights, rebalance.
  rebalancePath(tree, path);
  return true;
}

/** Rebalance every node along the path (bottom-up). Mutates tree in place. */
function rebalancePath(tree: AVLTree, path: number[]): number {
  let rotations = 0;
  for (let i = path.length - 1; i >= 0; i--) {
    const id = path[i];
    updateHeight(tree, id);
    const bf = balanceFactor(tree, id);
    if (bf > 1) {
      const n = tree.nodes.get(id)!;
      const leftChild = n.left !== null ? tree.nodes.get(n.left)! : null;
      const childCameFromLeft = leftChild !== null
        ? balanceFactor(tree, leftChild.id) >= 0
        : true;
      rotations += applyRotation(tree, id, true, childCameFromLeft);
    } else if (bf < -1) {
      const n = tree.nodes.get(id)!;
      const rightChild = n.right !== null ? tree.nodes.get(n.right)! : null;
      const childCameFromLeft = rightChild !== null
        ? balanceFactor(tree, rightChild.id) > 0
        : false;
      rotations += applyRotation(tree, id, false, childCameFromLeft);
    }
  }
  return rotations;
}

/** Apply the appropriate rotation and return 1 (single) or 2 (double). */
function applyRotation(
  tree: AVLTree,
  zId: number,
  cameFromLeft: boolean,
  childCameFromLeft: boolean,
): number {
  const type = identifyRotation(tree, zId, cameFromLeft, childCameFromLeft);
  switch (type) {
    case "LL":
      rotateRight(tree, zId);
      return 1;
    case "RR":
      rotateLeft(tree, zId);
      return 1;
    case "LR": {
      const z = tree.nodes.get(zId)!;
      rotateLeft(tree, z.left!);
      rotateRight(tree, zId);
      return 2;
    }
    case "RL": {
      const z = tree.nodes.get(zId)!;
      rotateRight(tree, z.right!);
      rotateLeft(tree, zId);
      return 2;
    }
    default:
      return 0;
  }
}

/** In-order successor (leftmost node of right subtree). */
export function successor(tree: AVLTree, id: number): AVLNode | null {
  const node = getNode(tree, id);
  if (!node) return null;
  if (node.right !== null) {
    let curId: number = node.right;
    while (tree.nodes.get(curId)!.left !== null) {
      curId = tree.nodes.get(curId)!.left as number;
    }
    return tree.nodes.get(curId)!;
  }
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

export function deletePure(tree: AVLTree, value: number): boolean {
  const node = find(tree, value);
  if (!node) return false;
  deleteInternal(tree, node.id);
  return true;
}

function deleteInternal(tree: AVLTree, id: number): void {
  const node = getNode(tree, id);
  if (!node) return;
  // Case 3: two children → replace value with successor, delete successor.
  if (node.left !== null && node.right !== null) {
    const succ = successor(tree, id)!;
    node.value = succ.value;
    deleteInternal(tree, succ.id);
    return;
  }
  // Case 1 / 2: at most one child — splice up.
  const childId = node.left ?? node.right;
  const parentId = node.parent;
  if (childId !== null) {
    tree.nodes.get(childId)!.parent = parentId;
  }
  if (parentId === null) {
    tree.root = childId;
  } else {
    const p = tree.nodes.get(parentId)!;
    if (p.left === id) p.left = childId;
    else p.right = childId;
  }
  tree.nodes.delete(id);

  // Walk back up from parent, rebalancing.
  if (parentId !== null) {
    const path: number[] = [];
    let cur: number | null = parentId;
    while (cur !== null) {
      path.push(cur);
      cur = tree.nodes.get(cur)!.parent;
    }
    rebalancePath(tree, path);
  }
}

// ---------------------------------------------------------------------------
// Tree layout (in-order x assignment)
// ---------------------------------------------------------------------------

export function layout(tree: AVLTree): PositionedNode[] {
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

function snapshot(
  t: AVLTree,
  partial: Omit<Step, "tree">,
): Step {
  return { tree: cloneTree(t), ...partial };
}

export function* insertGen(tree: AVLTree, value: number): Generator<Step> {
  const t = cloneTree(tree);
  let comparisons = 0;
  let rotations = 0;
  const path: number[] = [];

  if (t.root === null) {
    const newNode: AVLNode = {
      id: t.nextId++, value, left: null, right: null, parent: null, height: 0,
    };
    t.root = newNode.id;
    t.nodes.set(newNode.id, newNode);
    yield snapshot(t, {
      active: newNode.id, path: [newNode.id], pivot: null, successor: null,
      output: [], kind: "insert", rotation: "NONE", comparisons, rotations,
      description: `Inserted ${value} as root.`,
    });
    return;
  }

  // BST insert phase.
  let curId: number | null = t.root;
  let insertedId: number | null = null;
  while (curId !== null) {
    const cur = t.nodes.get(curId)!;
    comparisons++;
    path.push(cur.id);
    yield snapshot(t, {
      active: cur.id, path: [...path], pivot: null, successor: null,
      output: [], kind: "compare", rotation: "NONE", comparisons, rotations,
      description: `Compare ${value} with ${cur.value}: go ${value < cur.value ? "left" : value > cur.value ? "right" : "duplicate"}.`,
    });
    if (value === cur.value) {
      yield snapshot(t, {
        active: cur.id, path: [...path], pivot: null, successor: null,
        output: [], kind: "info", rotation: "NONE", comparisons, rotations,
        description: `Duplicate ${value} — skip insert.`,
      });
      return;
    }
    if (value < cur.value) {
      if (cur.left === null) {
        const newNode: AVLNode = {
          id: t.nextId++, value, left: null, right: null, parent: cur.id, height: 0,
        };
        cur.left = newNode.id;
        t.nodes.set(newNode.id, newNode);
        insertedId = newNode.id;
        break;
      }
      curId = cur.left;
    } else {
      if (cur.right === null) {
        const newNode: AVLNode = {
          id: t.nextId++, value, left: null, right: null, parent: cur.id, height: 0,
        };
        cur.right = newNode.id;
        t.nodes.set(newNode.id, newNode);
        insertedId = newNode.id;
        break;
      }
      curId = cur.right;
    }
  }

  if (insertedId !== null) {
    yield snapshot(t, {
      active: insertedId, path: [...path, insertedId], pivot: null, successor: null,
      output: [], kind: "insert", rotation: "NONE", comparisons, rotations,
      description: `Inserted ${value}. Now walk up, updating heights and rebalancing.`,
    });
  }

  // Walk up, update heights, detect imbalance, apply rotations.
  for (let i = path.length - 1; i >= 0; i--) {
    const id = path[i];
    updateHeight(t, id);
    const bf = balanceFactor(t, id);
    yield snapshot(t, {
      active: id, path: path.slice(i), pivot: null, successor: null,
      output: [], kind: "info", rotation: "NONE", comparisons, rotations,
      description: `Node ${t.nodes.get(id)!.value}: bf=${bf} (h=${nodeHeight(t, id)}).`,
    });
    if (bf > 1 || bf < -1) {
      const cameFromLeft = bf > 1;
      const n = t.nodes.get(id)!;
      let childId: number | null;
      if (cameFromLeft) childId = n.left; else childId = n.right;
      const childBf = childId !== null ? balanceFactor(t, childId) : 0;
      const childCameFromLeft = childBf >= 0;
      const type = identifyRotation(t, id, cameFromLeft, childCameFromLeft);
      yield snapshot(t, {
        active: id, path: path.slice(i), pivot: id, successor: childId,
        output: [], kind: "imbalance", rotation: type, comparisons, rotations,
        description: `Imbalance at ${t.nodes.get(id)!.value} (bf=${bf}). Rotation type: ${type}.`,
      });
      const before = rotations;
      yield* applyRotationStep(t, id, cameFromLeft, childCameFromLeft, comparisons, rotations);
      rotations = before + (type === "LR" || type === "RL" ? 2 : 1);
    }
  }

  yield snapshot(t, {
    active: null, path: [], pivot: null, successor: null,
    output: [], kind: "info", rotation: "NONE", comparisons, rotations,
    description: `Insert of ${value} complete. ${rotations} rotation${rotations === 1 ? "" : "s"}.`,
  });
}

function* applyRotationStep(
  t: AVLTree,
  zId: number,
  cameFromLeft: boolean,
  childCameFromLeft: boolean,
  comparisons: number,
  rotationsIn: number,
): Generator<Step> {
  let rotations = rotationsIn;
  const type = identifyRotation(t, zId, cameFromLeft, childCameFromLeft);
  const z = t.nodes.get(zId)!;
  if (type === "LL") {
    yield snapshot(t, {
      active: zId, path: [], pivot: zId, successor: z.left,
      output: [], kind: "rotation", rotation: "LL", comparisons, rotations,
      description: `LL case: right-rotate around ${z.value}.`,
    });
    rotateRight(t, zId);
    rotations++;
  } else if (type === "RR") {
    yield snapshot(t, {
      active: zId, path: [], pivot: zId, successor: z.right,
      output: [], kind: "rotation", rotation: "RR", comparisons, rotations,
      description: `RR case: left-rotate around ${z.value}.`,
    });
    rotateLeft(t, zId);
    rotations++;
  } else if (type === "LR") {
    const yId = z.left!;
    yield snapshot(t, {
      active: yId, path: [], pivot: yId, successor: zId,
      output: [], kind: "rotation", rotation: "LR", comparisons, rotations,
      description: `LR case (phase 1 of 2): left-rotate around left child ${t.nodes.get(yId)!.value}.`,
    });
    rotateLeft(t, yId);
    rotations++;
    // After phase 1, z's left changed — re-fetch.
    const z2 = t.nodes.get(zId)!;
    yield snapshot(t, {
      active: zId, path: [], pivot: zId, successor: z2.left,
      output: [], kind: "rotation", rotation: "LR", comparisons, rotations,
      description: `LR case (phase 2 of 2): right-rotate around ${z2.value}.`,
    });
    rotateRight(t, zId);
    rotations++;
  } else if (type === "RL") {
    const yId = z.right!;
    yield snapshot(t, {
      active: yId, path: [], pivot: yId, successor: zId,
      output: [], kind: "rotation", rotation: "RL", comparisons, rotations,
      description: `RL case (phase 1 of 2): right-rotate around right child ${t.nodes.get(yId)!.value}.`,
    });
    rotateRight(t, yId);
    rotations++;
    const z2 = t.nodes.get(zId)!;
    yield snapshot(t, {
      active: zId, path: [], pivot: zId, successor: z2.right,
      output: [], kind: "rotation", rotation: "RL", comparisons, rotations,
      description: `RL case (phase 2 of 2): left-rotate around ${z2.value}.`,
    });
    rotateLeft(t, zId);
    rotations++;
  }
}

export function* searchGen(tree: AVLTree, value: number): Generator<Step> {
  const t = cloneTree(tree);
  let comparisons = 0;
  const rotations = 0;
  const path: number[] = [];
  let curId: number | null = t.root;
  while (curId !== null) {
    const cur = t.nodes.get(curId)!;
    comparisons++;
    path.push(cur.id);
    if (value === cur.value) {
      yield snapshot(t, {
        active: cur.id, path: [...path], pivot: null, successor: null,
        output: [cur.value], kind: "found", rotation: "NONE", comparisons, rotations,
        description: `Found ${value} after ${comparisons} comparison${comparisons === 1 ? "" : "s"}.`,
      });
      return;
    }
    yield snapshot(t, {
      active: cur.id, path: [...path], pivot: null, successor: null,
      output: [], kind: "compare", rotation: "NONE", comparisons, rotations,
      description: `Compare ${value} with ${cur.value}: go ${value < cur.value ? "left" : "right"}.`,
    });
    curId = value < cur.value ? cur.left : cur.right;
  }
  yield snapshot(t, {
    active: null, path: [...path], pivot: null, successor: null,
    output: [], kind: "not-found", rotation: "NONE", comparisons, rotations,
    description: `${value} not in tree after ${comparisons} comparison${comparisons === 1 ? "" : "s"}.`,
  });
}

export function* deleteGen(tree: AVLTree, value: number): Generator<Step> {
  const t = cloneTree(tree);
  let comparisons = 0;
  let rotations = 0;
  const path: number[] = [];

  // Find the node.
  let curId: number | null = t.root;
  let target: AVLNode | null = null;
  while (curId !== null) {
    const cur = t.nodes.get(curId)!;
    comparisons++;
    path.push(cur.id);
    yield snapshot(t, {
      active: cur.id, path: [...path], pivot: null, successor: null,
      output: [], kind: "compare", rotation: "NONE", comparisons, rotations,
      description: `Compare ${value} with ${cur.value}.`,
    });
    if (value === cur.value) { target = cur; break; }
    curId = value < cur.value ? cur.left : cur.right;
  }
  if (!target) {
    yield snapshot(t, {
      active: null, path: [...path], pivot: null, successor: null,
      output: [], kind: "not-found", rotation: "NONE", comparisons, rotations,
      description: `${value} not in tree — nothing to delete.`,
    });
    return;
  }
  yield snapshot(t, {
    active: target.id, path: [...path], pivot: null, successor: null,
    output: [], kind: "visit", rotation: "NONE", comparisons, rotations,
    description: `Found ${value}. Deleting...`,
  });

  // Two children — replace with successor.
  if (target.left !== null && target.right !== null) {
    const succ = successor(t, target.id)!;
    yield snapshot(t, {
      active: target.id, path: [...path], pivot: null, successor: succ.id,
      output: [], kind: "info", rotation: "NONE", comparisons, rotations,
      description: `Two children — in-order successor is ${succ.value}. Copy up & delete successor.`,
    });
    target.value = succ.value;
    // Build path from target down to successor for rebalancing.
    const subPath: number[] = [target.id];
    let walkId: number | null = target.right;
    while (walkId !== null && walkId !== succ.id) {
      subPath.push(walkId);
      walkId = t.nodes.get(walkId)!.left;
    }
    subPath.push(succ.id);
    // Delete successor (it has at most a right child).
    deleteInternal(t, succ.id);
    yield snapshot(t, {
      active: null, path: [], pivot: null, successor: null,
      output: [], kind: "delete", rotation: "NONE", comparisons, rotations,
      description: `Removed successor ${succ.value}; its value now occupies the deleted slot.`,
    });
    // Rebalance along the path from target.parent up to root (target itself
    // is at the same id; its ancestors may need rebalancing).
    const upPath: number[] = [];
    let cur: number | null = target.id;
    while (cur !== null) {
      upPath.push(cur);
      cur = t.nodes.get(cur)!.parent;
    }
    yield* rebalanceYield(t, upPath, comparisons, rotations, (r) => { rotations = r; });
    yield snapshot(t, {
      active: null, path: [], pivot: null, successor: null,
      output: [], kind: "info", rotation: "NONE", comparisons, rotations,
      description: `Delete of ${value} complete. ${rotations} rotation${rotations === 1 ? "" : "s"}.`,
    });
    return;
  }

  // At most one child — splice up.
  const childId = target.left ?? target.right;
  if (childId !== null) {
    yield snapshot(t, {
      active: target.id, path: [...path], pivot: null, successor: childId,
      output: [], kind: "info", rotation: "NONE", comparisons, rotations,
      description: `One child (${t.nodes.get(childId)!.value}) — splice up.`,
    });
  } else {
    yield snapshot(t, {
      active: target.id, path: [...path], pivot: null, successor: null,
      output: [], kind: "info", rotation: "NONE", comparisons, rotations,
      description: `Leaf — unlink.`,
    });
  }
  const parentId = target.parent;
  if (childId !== null) {
    t.nodes.get(childId)!.parent = parentId;
  }
  if (parentId === null) {
    t.root = childId;
  } else {
    const p = t.nodes.get(parentId)!;
    if (p.left === target.id) p.left = childId;
    else p.right = childId;
  }
  t.nodes.delete(target.id);
  yield snapshot(t, {
    active: null, path: [], pivot: null, successor: null,
    output: [], kind: "delete", rotation: "NONE", comparisons, rotations,
    description: `Removed ${value}.`,
  });

  // Walk up from parent, rebalancing.
  if (parentId !== null) {
    const upPath: number[] = [];
    let cur: number | null = parentId;
    while (cur !== null) {
      upPath.push(cur);
      cur = t.nodes.get(cur)!.parent;
    }
    yield* rebalanceYield(t, upPath, comparisons, rotations, (r) => { rotations = r; });
  }
  yield snapshot(t, {
    active: null, path: [], pivot: null, successor: null,
    output: [], kind: "info", rotation: "NONE", comparisons, rotations,
    description: `Delete of ${value} complete. ${rotations} rotation${rotations === 1 ? "" : "s"}.`,
  });
}

/** Walk a path bottom-up, yielding height-update and rotation steps. */
function* rebalanceYield(
  t: AVLTree,
  path: number[],
  comparisons: number,
  rotationsIn: number,
  setRotations: (r: number) => void,
): Generator<Step> {
  let rotations = rotationsIn;
  for (let i = path.length - 1; i >= 0; i--) {
    const id = path[i];
    updateHeight(t, id);
    const bf = balanceFactor(t, id);
    yield snapshot(t, {
      active: id, path: path.slice(i), pivot: null, successor: null,
      output: [], kind: "info", rotation: "NONE", comparisons, rotations,
      description: `Node ${t.nodes.get(id)!.value}: bf=${bf} (h=${nodeHeight(t, id)}).`,
    });
    if (bf > 1 || bf < -1) {
      const cameFromLeft = bf > 1;
      const n = t.nodes.get(id)!;
      const childId = cameFromLeft ? n.left : n.right;
      const childBf = childId !== null ? balanceFactor(t, childId) : 0;
      const childCameFromLeft = childBf >= 0;
      const type = identifyRotation(t, id, cameFromLeft, childCameFromLeft);
      yield snapshot(t, {
        active: id, path: path.slice(i), pivot: id, successor: childId,
        output: [], kind: "imbalance", rotation: type, comparisons, rotations,
        description: `Imbalance at ${t.nodes.get(id)!.value} (bf=${bf}). Rotation: ${type}.`,
      });
      const before = rotations;
      yield* applyRotationStep(t, id, cameFromLeft, childCameFromLeft, comparisons, rotations);
      // applyRotationStep performs 1 (single) or 2 (double) rotations.
      rotations = before + (type === "LR" || type === "RL" ? 2 : 1);
    }
  }
  setRotations(rotations);
}

export function* inOrderGen(tree: AVLTree): Generator<Step> {
  const t = cloneTree(tree);
  const output: number[] = [];
  let comparisons = 0;
  const rotations = 0;
  function* walk(id: number | null): Generator<Step> {
    if (id === null) return;
    const n = t.nodes.get(id)!;
    yield* walk(n.left);
    comparisons++;
    output.push(n.value);
    yield snapshot(t, {
      active: n.id, path: [], pivot: null, successor: null,
      output: [...output], kind: "visit", rotation: "NONE", comparisons, rotations,
      description: `In-order visit ${n.value}.`,
    });
    yield* walk(n.right);
  }
  yield* walk(t.root);
}

// ---------------------------------------------------------------------------
// Run dispatchers
// ---------------------------------------------------------------------------

export function runInsert(tree: AVLTree, value: number): OpResult {
  const steps: Step[] = [];
  for (const s of insertGen(tree, value)) steps.push(s);
  const last = steps[steps.length - 1];
  // Commit to a fresh tree.
  const finalTree = cloneTree(tree);
  const inserted = insertPure(finalTree, value);
  return {
    kind: "insert",
    steps,
    totalComparisons: last?.comparisons ?? 0,
    totalRotations: last?.rotations ?? 0,
    output: [],
    found: inserted,
    finalTree,
  };
}

export function runDelete(tree: AVLTree, value: number): OpResult {
  const steps: Step[] = [];
  for (const s of deleteGen(tree, value)) steps.push(s);
  const last = steps[steps.length - 1];
  const finalTree = cloneTree(tree);
  deletePure(finalTree, value);
  return {
    kind: "delete",
    steps,
    totalComparisons: last?.comparisons ?? 0,
    totalRotations: last?.rotations ?? 0,
    output: [],
    found: last?.kind !== "not-found",
    finalTree,
  };
}

export function runSearch(tree: AVLTree, value: number): OpResult {
  const steps: Step[] = [];
  for (const s of searchGen(tree, value)) steps.push(s);
  const last = steps[steps.length - 1];
  return {
    kind: "search",
    steps,
    totalComparisons: last?.comparisons ?? 0,
    totalRotations: 0,
    output: last?.output ?? [],
    found: last?.kind === "found",
    finalTree: cloneTree(tree),
  };
}

export function runTraversal(tree: AVLTree): OpResult {
  const steps: Step[] = [];
  for (const s of inOrderGen(tree)) steps.push(s);
  const last = steps[steps.length - 1];
  return {
    kind: "traverse-inorder",
    steps,
    totalComparisons: last?.comparisons ?? 0,
    totalRotations: 0,
    output: last?.output ?? [],
    found: true,
    finalTree: cloneTree(tree),
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
// Serialization (insertion order — fully determines AVL shape)
// ---------------------------------------------------------------------------

export function serializeTree(tree: AVLTree): string {
  if (tree.root === null) return "";
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

export function deserializeTree(s: string): AVLTree | null {
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

export function nodeColorClass(nodeId: number, step: Step): string {
  if (step.successor === nodeId) return "successor";
  if (step.pivot === nodeId && (step.kind === "imbalance" || step.kind === "rotation")) return "pivot";
  if (step.active === nodeId) {
    if (step.kind === "found") return "found";
    if (step.kind === "insert") return "insert";
    if (step.kind === "compare") return "compare";
    if (step.kind === "rotation") return "rotation";
    return "active";
  }
  if (step.path.includes(nodeId)) return "path";
  return "default";
}

export function formatStep(step: Step, stepIndex: number, total: number): string {
  const rot = step.rotation !== "NONE" ? ` rot=${step.rotation}` : "";
  const out = step.output.length > 0 ? ` output=[${step.output.join(",")}]` : "";
  return `[${stepIndex + 1}/${total}] ${step.description}  (cmp=${step.comparisons} rot=${step.rotations}${rot}${out})`;
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:avl-tree-visualizer:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  op: OpKind;
  value?: number;
  nodeCount: number;
  height: number;
  comparisons: number;
  rotations: number;
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

export function buildShareUrl(tree: AVLTree): string {
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
// Presets / utilities
// ---------------------------------------------------------------------------

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

export function randomTree(count: number, seed: number = 1): AVLTree {
  const rand = mulberry32(seed);
  const set = new Set<number>();
  while (set.size < count) {
    set.add(Math.floor(rand() * 100));
  }
  return fromValues([...set]);
}

/** Sorted insertion sequence — the case where AVL shines vs plain BST. */
export function sortedTree(count: number): AVLTree {
  const vals: number[] = [];
  for (let i = 1; i <= count; i++) vals.push(i * 2);
  return fromValues(vals);
}

/** In-order traversal as a plain array (no steps). */
export function inOrderArray(tree: AVLTree): number[] {
  const out: number[] = [];
  const walk = (id: number | null) => {
    if (id === null) return;
    const n = tree.nodes.get(id)!;
    walk(n.left);
    out.push(n.value);
    walk(n.right);
  };
  walk(tree.root);
  return out;
}

/** Count rotations that would occur inserting `values` in order. */
export function countRotations(values: number[]): number {
  let total = 0;
  let t = createTree();
  for (const v of values) {
    for (const s of insertGen(t, v)) {
      if (s.kind === "rotation") total++;
    }
    // Commit the insert so the next iteration sees the updated tree.
    insertPure(t, v);
  }
  return total;
}
