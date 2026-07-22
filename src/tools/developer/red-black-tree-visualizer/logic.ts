/**
 * Red-Black Tree Visualizer — pure logic.
 *
 * Generator-based step engine for visualizing CLRS-style Red-Black tree
 * insert and delete with full fix-up (recoloring + rotations), each case
 * labeled (insert: uncle-red, LL/RR/LR/RL with black uncle; delete:
 * sibling-red, sibling-black with nieces, double-black propagation).
 *
 * Pure functions only — no DOM, no network.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Color = "R" | "B";

export interface RBNode {
  id: number;
  value: number;
  left: number | null;   // node id
  right: number | null;  // node id
  parent: number | null; // node id
  color: Color;
  /** True if this is the implicit NIL sentinel (for visualization only). */
  isNil: boolean;
}

export interface RBTree {
  nodes: Map<number, RBNode>;
  root: number | null;
  nextId: number;
}

export interface PositionedNode {
  node: RBNode;
  x: number;
  y: number;
  depth: number;
}

export type OpKind =
  | "insert"
  | "delete"
  | "traverse-inorder";

export type InsertCase =
  | "case-1-root"
  | "case-2-parent-black"
  | "case-3-uncle-red-recolor"
  | "case-4-uncle-black-LL-RR"
  | "case-5-uncle-black-LR-RL";

export type DeleteCase =
  | "case-1-root"
  | "case-2-sibling-red"
  | "case-3-sibling-black-nieces-black"
  | "case-4-sibling-black-red-near"
  | "case-5-sibling-black-red-far"
  | "case-6-splice";

export type StepKind =
  | "compare"
  | "visit"
  | "insert"
  | "delete"
  | "info"
  | "rotation"
  | "recolor"
  | "double-black";

export interface Step {
  /** Snapshot of the tree AT THIS MOMENT (post any link mutation). */
  tree: RBTree;
  /** Active comparison / pivot node id (or null). */
  active: number | null;
  /** Comparison path from root to active node so far (node ids). */
  path: number[];
  /** Pivot node id when a rotation is happening (else null). */
  pivot: number | null;
  /** Highlighted successor / predecessor node (for delete). */
  successor: number | null;
  /** Output sequence so far (for traversals). */
  output: number[];
  /** Step kind for color coding. */
  kind: StepKind;
  /** Insert fix-up case label (or empty string). */
  insertCase: InsertCase | "";
  /** Delete fix-up case label (or empty string). */
  deleteCase: DeleteCase | "";
  /** Running comparison count. */
  comparisons: number;
  /** Running rotation count. */
  rotations: number;
  /** Running recolor count. */
  recolors: number;
  /** Human-readable description. */
  description: string;
}

export interface OpResult {
  kind: OpKind;
  steps: Step[];
  totalComparisons: number;
  totalRotations: number;
  totalRecolors: number;
  output: number[];
  found: boolean;
  finalTree: RBTree;
  error?: string;
}

export interface RBPropertyCheck {
  /** (1) Root is black. */
  rootBlack: boolean;
  /** (2) Every red node has black parent (no two consecutive reds). */
  noRedRed: boolean;
  /** (3) All leaves (NIL) are black. */
  nilBlack: boolean;
  /** (4) Every path from a node to a NIL descendant has the same black-height. */
  equalBlackHeight: boolean;
  /** (5) A node is either red or black. */
  colorsValid: boolean;
  /** All five properties hold. */
  allPass: boolean;
  /** Black-height of the root (number of black nodes from root to any NIL, excluding root). */
  blackHeight: number;
}

export interface TreeStats {
  nodeCount: number;
  height: number;
  blackHeight: number;
  redCount: number;
  blackCount: number;
  properties: RBPropertyCheck;
}

// ---------------------------------------------------------------------------
// Tree construction & manipulation (pure)
// ---------------------------------------------------------------------------

export function createTree(): RBTree {
  return { nodes: new Map(), root: null, nextId: 1 };
}

export function cloneTree(tree: RBTree): RBTree {
  const nodes = new Map<number, RBNode>();
  for (const [k, v] of tree.nodes) {
    nodes.set(k, { ...v });
  }
  return { nodes, root: tree.root, nextId: tree.nextId };
}

export function getNode(tree: RBTree, id: number | null): RBNode | null {
  if (id === null) return null;
  return tree.nodes.get(id) ?? null;
}

export function find(tree: RBTree, value: number): RBNode | null {
  let cur = tree.root;
  while (cur !== null) {
    const n = tree.nodes.get(cur)!;
    if (n.isNil) return null;
    if (value === n.value) return n;
    cur = value < n.value ? n.left : n.right;
  }
  return null;
}

/** Build a tree from a list of values (skipping duplicates). */
export function fromValues(values: number[]): RBTree {
  const t = createTree();
  for (const v of values) insertPure(t, v);
  return t;
}

// ---------------------------------------------------------------------------
// Heights, colors, property checks
// ---------------------------------------------------------------------------

export function height(tree: RBTree, id: number | null = tree.root): number {
  if (id === null) return -1;
  const n = tree.nodes.get(id);
  if (!n || n.isNil) return -1;
  const lh = n.left !== null ? height(tree, n.left) : -1;
  const rh = n.right !== null ? height(tree, n.right) : -1;
  return 1 + Math.max(lh, rh);
}

/** Black-height of a node = number of black nodes on any path to a NIL leaf (excluding the node itself). */
export function blackHeight(tree: RBTree, id: number | null): number {
  if (id === null) return 0;
  const n = tree.nodes.get(id);
  if (!n || n.isNil) return 0;
  const childId = n.left ?? n.right;
  const childBh = blackHeight(tree, childId);
  return childBh + (n.color === "B" ? 1 : 0);
}

/** Sibling of a node (or null if none). */
export function sibling(tree: RBTree, id: number): RBNode | null {
  const n = tree.nodes.get(id);
  if (!n || n.parent === null) return null;
  const p = tree.nodes.get(n.parent)!;
  const sibId = p.left === id ? p.right : p.left;
  return sibId !== null ? tree.nodes.get(sibId) ?? null : null;
}

/** Uncle of a node (sibling of parent). */
export function uncle(tree: RBTree, id: number): RBNode | null {
  const n = tree.nodes.get(id);
  if (!n || n.parent === null) return null;
  return sibling(tree, n.parent);
}

/** Grandparent of a node. */
export function grandparent(tree: RBTree, id: number): RBNode | null {
  const n = tree.nodes.get(id);
  if (!n || n.parent === null) return null;
  const p = tree.nodes.get(n.parent)!;
  return p.parent !== null ? tree.nodes.get(p.parent) ?? null : null;
}

/** Verify all five RB properties and return the checklist. */
export function checkProperties(tree: RBTree): RBPropertyCheck {
  const rootBlack = tree.root === null || tree.nodes.get(tree.root)!.color === "B";

  let noRedRed = true;
  let nilBlack = true;
  let colorsValid = true;
  let equalBlackHeight = true;

  for (const n of tree.nodes.values()) {
    if (n.color !== "R" && n.color !== "B") colorsValid = false;
    if (n.isNil && n.color !== "B") nilBlack = false;
    if (n.color === "R" && !n.isNil) {
      if (n.left !== null) {
        const l = tree.nodes.get(n.left)!;
        if (l.color === "R") noRedRed = false;
      }
      if (n.right !== null) {
        const r = tree.nodes.get(n.right)!;
        if (r.color === "R") noRedRed = false;
      }
    }
  }

  // Compute black-height of every subtree and check left == right at each
  // internal node. A "null" child counts as a black NIL of bh 0.
  // Returns -1 if the subtree has inconsistent bh (violation).
  const bhOf = (id: number | null): number => {
    if (id === null) return 0; // virtual NIL
    const n = tree.nodes.get(id);
    if (!n || n.isNil) return 0;
    const lbh = bhOf(n.left);
    const rbh = bhOf(n.right);
    if (lbh === -1 || rbh === -1 || lbh !== rbh) {
      equalBlackHeight = false;
      return -1;
    }
    return lbh + (n.color === "B" ? 1 : 0);
  };
  const rootBh = bhOf(tree.root);

  return {
    rootBlack,
    noRedRed,
    nilBlack,
    equalBlackHeight,
    colorsValid,
    allPass: rootBlack && noRedRed && nilBlack && equalBlackHeight && colorsValid,
    blackHeight: rootBh < 0 ? 0 : rootBh,
  };
}

export function computeStats(tree: RBTree): TreeStats {
  let redCount = 0;
  let blackCount = 0;
  for (const n of tree.nodes.values()) {
    if (n.isNil) continue;
    if (n.color === "R") redCount++;
    else blackCount++;
  }
  return {
    nodeCount: tree.root === null ? 0 : [...tree.nodes.values()].filter((n) => !n.isNil).length,
    height: height(tree),
    blackHeight: blackHeight(tree, tree.root),
    redCount,
    blackCount,
    properties: checkProperties(tree),
  };
}

// ---------------------------------------------------------------------------
// Rotations (pure, in-place)
// ---------------------------------------------------------------------------

export function rotateLeft(tree: RBTree, xId: number): void {
  const x = tree.nodes.get(xId)!;
  const yId = x.right;
  if (yId === null) return;
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
}

export function rotateRight(tree: RBTree, yId: number): void {
  const y = tree.nodes.get(yId)!;
  const xId = y.left;
  if (xId === null) return;
  const x = tree.nodes.get(xId)!;
  const t2 = x.right;
  x.right = yId;
  y.left = t2;
  x.parent = y.parent;
  y.parent = xId;
  if (t2 !== null) {
    tree.nodes.get(t2)!.parent = yId;
  }
  if (x.parent === null) {
    tree.root = xId;
  } else {
    const p = tree.nodes.get(x.parent)!;
    if (p.left === yId) p.left = xId;
    else p.right = xId;
  }
}

// ---------------------------------------------------------------------------
// Pure insert / delete (no steps) — useful for bulk & test helpers.
// ---------------------------------------------------------------------------

export function insertPure(tree: RBTree, value: number): boolean {
  // Standard BST insert (red node), then fix-up.
  const node: RBNode = {
    id: tree.nextId++,
    value,
    left: null,
    right: null,
    parent: null,
    color: "R",
    isNil: false,
  };
  if (tree.root === null) {
    node.color = "B"; // root must be black.
    tree.root = node.id;
    tree.nodes.set(node.id, node);
    return true;
  }
  let curId: number | null = tree.root;
  while (curId !== null) {
    const cur = tree.nodes.get(curId)!;
    if (value === cur.value) return false; // duplicate
    if (value < cur.value) {
      if (cur.left === null) {
        cur.left = node.id;
        node.parent = cur.id;
        tree.nodes.set(node.id, node);
        break;
      }
      curId = cur.left;
    } else {
      if (cur.right === null) {
        cur.right = node.id;
        node.parent = cur.id;
        tree.nodes.set(node.id, node);
        break;
      }
      curId = cur.right;
    }
  }
  insertFixup(tree, node.id);
  return true;
}

/** CLRS RB-INSERT-FIXUP. Mutates tree in place. */
function insertFixup(tree: RBTree, zId: number): void {
  let z = tree.nodes.get(zId)!;
  while (z.parent !== null && tree.nodes.get(z.parent)!.color === "R") {
    const gp = grandparent(tree, z.id);
    if (gp === null) break;
    const parentId = z.parent;
    const parent = tree.nodes.get(parentId)!;
    if (parentId === gp.left) {
      const uncleId = gp.right;
      const uncleNode = uncleId !== null ? tree.nodes.get(uncleId) ?? null : null;
      if (uncleNode !== null && uncleNode.color === "R") {
        // Case 3: uncle red → recolor.
        parent.color = "B";
        uncleNode.color = "B";
        gp.color = "R";
        z = gp;
        continue;
      }
      if (z.id === parent.right) {
        // Case 5: LR → left-rotate parent, then fall through to case 4.
        z = parent;
        rotateLeft(tree, z.id);
      }
      // Case 4: LL → recolor + right-rotate grandparent.
      const newParent = tree.nodes.get(z.parent ?? 0)!;
      const newGp = tree.nodes.get(newParent.parent ?? 0)!;
      newParent.color = "B";
      newGp.color = "R";
      rotateRight(tree, newGp.id);
    } else {
      // Mirror image.
      const uncleId = gp.left;
      const uncleNode = uncleId !== null ? tree.nodes.get(uncleId) ?? null : null;
      if (uncleNode !== null && uncleNode.color === "R") {
        parent.color = "B";
        uncleNode.color = "B";
        gp.color = "R";
        z = gp;
        continue;
      }
      if (z.id === parent.left) {
        z = parent;
        rotateRight(tree, z.id);
      }
      const newParent2 = tree.nodes.get(z.parent ?? 0)!;
      const newGp2 = tree.nodes.get(newParent2.parent ?? 0)!;
      newParent2.color = "B";
      newGp2.color = "R";
      rotateLeft(tree, newGp2.id);
    }
  }
  // Always force root black at the end.
  if (tree.root !== null) tree.nodes.get(tree.root)!.color = "B";
}

/** In-order successor (leftmost of right subtree). */
export function successor(tree: RBTree, id: number): RBNode | null {
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

/** Transplant subtree rooted at v in place of u (CLRS RB-TRANSPLANT). */
function transplant(tree: RBTree, uId: number, vId: number | null): void {
  const u = tree.nodes.get(uId)!;
  if (u.parent === null) {
    tree.root = vId;
  } else {
    const p = tree.nodes.get(u.parent)!;
    if (p.left === uId) p.left = vId;
    else p.right = vId;
  }
  if (vId !== null) {
    tree.nodes.get(vId)!.parent = u.parent;
  }
}

/** Minimum node of a subtree. */
function minimum(tree: RBTree, id: number): number {
  let cur = id;
  while (tree.nodes.get(cur)!.left !== null) {
    cur = tree.nodes.get(cur)!.left as number;
  }
  return cur;
}

export function deletePure(tree: RBTree, value: number): boolean {
  const node = find(tree, value);
  if (!node) return false;
  deleteInternal(tree, node.id);
  return true;
}

/** CLRS RB-DELETE. Simplified — we ignore the y-original-color tracking
 *  because we always have a real replacement node (not the NIL sentinel).
 *  When the spliced child is "missing" (null), we treat it as a virtual
 *  black NIL and run delete-fixup on the parent. */
function deleteInternal(tree: RBTree, zId: number): void {
  const z = tree.nodes.get(zId)!;
  const yId = z.id;
  const yOriginalColor = z.color;
  let fixupNodeId: number | null = null;
  let fixupParentId: number | null = null;

  if (z.left === null) {
    fixupParentId = z.parent;
    fixupNodeId = z.right;
    transplant(tree, z.id, z.right);
  } else if (z.right === null) {
    fixupParentId = z.parent;
    fixupNodeId = z.left;
    transplant(tree, z.id, z.left);
  } else {
    // Two children: y = successor of z.
    const ySuccId = minimum(tree, z.right);
    const ySucc = tree.nodes.get(ySuccId)!;
    const yOrigColor = ySucc.color;
    fixupNodeId = ySucc.right;
    fixupParentId = ySucc.parent === z.id ? ySuccId : ySucc.parent;
    if (ySucc.parent === z.id) {
      // y is direct right child of z.
      if (fixupNodeId !== null) {
        tree.nodes.get(fixupNodeId)!.parent = ySuccId;
      }
    } else {
      transplant(tree, ySuccId, ySucc.right);
      ySucc.right = z.right;
      tree.nodes.get(z.right)!.parent = ySuccId;
    }
    transplant(tree, z.id, ySuccId);
    ySucc.left = z.left;
    tree.nodes.get(z.left)!.parent = ySuccId;
    ySucc.color = z.color;
    void yOriginalColor;
    if (yOrigColor === "B") {
      deleteFixup(tree, fixupNodeId, fixupParentId);
    }
    tree.nodes.delete(z.id);
    return;
  }
  tree.nodes.delete(z.id);
  if (yOriginalColor === "B") {
    deleteFixup(tree, fixupNodeId, fixupParentId);
  }
}

/** CLRS RB-DELETE-FIXUP. xId may be null (representing a virtual NIL);
 *  in that case xParentId must be set so we can compute the sibling. */
function deleteFixup(tree: RBTree, xId: number | null, xParentId: number | null): void {
  let x = xId;
  let xParent = xParentId;
  while (x !== tree.root && (x === null || tree.nodes.get(x)!.color === "B")) {
    if (xParent === null) break;
    const p = tree.nodes.get(xParent)!;
    if (p.left === x) {
      let wId = p.right;
      let w = wId !== null ? tree.nodes.get(wId)! : null;
      if (w !== null && w.color === "R") {
        // Case 2: sibling red → recolor + rotate parent.
        w.color = "B";
        p.color = "R";
        rotateLeft(tree, p.id);
        wId = p.right;
        w = wId !== null ? tree.nodes.get(wId)! : null;
      }
      const wLeft = w !== null && w.left !== null ? tree.nodes.get(w.left)! : null;
      const wRight = w !== null && w.right !== null ? tree.nodes.get(w.right)! : null;
      if (w !== null && (wLeft === null || wLeft.color === "B") && (wRight === null || wRight.color === "B")) {
        // Case 3: sibling black, both nieces black → recolor sibling red, move up.
        w.color = "R";
        x = xParent;
        xParent = tree.nodes.get(x)!.parent;
      } else {
        if (w !== null && (wRight === null || wRight.color === "B")) {
          // Case 4: sibling black, near niece red, far niece black → rotate sibling, swap colors.
          if (wLeft !== null) wLeft.color = "B";
          w.color = "R";
          rotateRight(tree, w.id);
          wId = p.right;
          w = wId !== null ? tree.nodes.get(wId)! : null;
        }
        // Case 5: sibling black, far niece red → recolor + rotate parent.
        if (w !== null) {
          w.color = p.color;
          p.color = "B";
          const wRightNow = w.right !== null ? tree.nodes.get(w.right)! : null;
          if (wRightNow !== null) wRightNow.color = "B";
          rotateLeft(tree, p.id);
        }
        x = tree.root;
        xParent = null;
      }
    } else {
      // Mirror image.
      let wId = p.left;
      let w = wId !== null ? tree.nodes.get(wId)! : null;
      if (w !== null && w.color === "R") {
        w.color = "B";
        p.color = "R";
        rotateRight(tree, p.id);
        wId = p.left;
        w = wId !== null ? tree.nodes.get(wId)! : null;
      }
      const wLeft = w !== null && w.left !== null ? tree.nodes.get(w.left)! : null;
      const wRight = w !== null && w.right !== null ? tree.nodes.get(w.right)! : null;
      if (w !== null && (wLeft === null || wLeft.color === "B") && (wRight === null || wRight.color === "B")) {
        w.color = "R";
        x = xParent;
        xParent = tree.nodes.get(x)!.parent;
      } else {
        if (w !== null && (wLeft === null || wLeft.color === "B")) {
          if (wRight !== null) wRight.color = "B";
          w.color = "R";
          rotateLeft(tree, w.id);
          wId = p.left;
          w = wId !== null ? tree.nodes.get(wId)! : null;
        }
        if (w !== null) {
          w.color = p.color;
          p.color = "B";
          const wLeftNow = w.left !== null ? tree.nodes.get(w.left)! : null;
          if (wLeftNow !== null) wLeftNow.color = "B";
          rotateRight(tree, p.id);
        }
        x = tree.root;
        xParent = null;
      }
    }
  }
  if (x !== null) tree.nodes.get(x)!.color = "B";
}

// ---------------------------------------------------------------------------
// Tree layout (in-order x assignment)
// ---------------------------------------------------------------------------

export function layout(tree: RBTree): PositionedNode[] {
  const positioned: PositionedNode[] = [];
  if (tree.root === null) return positioned;
  let nextX = 0;
  const walk = (id: number, depth: number) => {
    const n = tree.nodes.get(id)!;
    if (n.isNil) return;
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

function snapshot(t: RBTree, partial: Omit<Step, "tree">): Step {
  return { tree: cloneTree(t), ...partial };
}

export function* insertGen(tree: RBTree, value: number): Generator<Step> {
  const t = cloneTree(tree);
  let comparisons = 0;
  let rotations = 0;
  let recolors = 0;
  const path: number[] = [];

  // BST insert.
  const node: RBNode = {
    id: t.nextId++, value, left: null, right: null, parent: null, color: "R", isNil: false,
  };
  if (t.root === null) {
    node.color = "B";
    t.root = node.id;
    t.nodes.set(node.id, node);
    yield snapshot(t, {
      active: node.id, path: [node.id], pivot: null, successor: null,
      output: [], kind: "insert", insertCase: "case-1-root", deleteCase: "",
      comparisons, rotations, recolors,
      description: `Inserted ${value} as root — root must be black (case 1).`,
    });
    return;
  }
  let curId: number | null = t.root;
  while (curId !== null) {
    const cur = t.nodes.get(curId)!;
    comparisons++;
    path.push(cur.id);
    yield snapshot(t, {
      active: cur.id, path: [...path], pivot: null, successor: null,
      output: [], kind: "compare", insertCase: "", deleteCase: "",
      comparisons, rotations, recolors,
      description: `Compare ${value} with ${cur.value}: go ${value < cur.value ? "left" : value > cur.value ? "right" : "duplicate"}.`,
    });
    if (value === cur.value) {
      yield snapshot(t, {
        active: cur.id, path: [...path], pivot: null, successor: null,
        output: [], kind: "info", insertCase: "", deleteCase: "",
        comparisons, rotations, recolors,
        description: `Duplicate ${value} — skip insert.`,
      });
      return;
    }
    if (value < cur.value) {
      if (cur.left === null) {
        cur.left = node.id;
        node.parent = cur.id;
        t.nodes.set(node.id, node);
        break;
      }
      curId = cur.left;
    } else {
      if (cur.right === null) {
        cur.right = node.id;
        node.parent = cur.id;
        t.nodes.set(node.id, node);
        break;
      }
      curId = cur.right;
    }
  }

  yield snapshot(t, {
    active: node.id, path: [...path, node.id], pivot: null, successor: null,
    output: [], kind: "insert", insertCase: "", deleteCase: "",
    comparisons, rotations, recolors,
    description: `Inserted ${value} as red node. Now run insert fix-up.`,
  });

  // Insert fix-up.
  let zId: number | null = node.id;
  while (zId !== null) {
    const z = t.nodes.get(zId)!;
    if (z.parent === null) {
      // Case 1: z is root — must be black.
      if (z.color === "R") {
        z.color = "B";
        recolors++;
        yield snapshot(t, {
          active: z.id, path: [], pivot: null, successor: null,
          output: [], kind: "recolor", insertCase: "case-1-root", deleteCase: "",
          comparisons, rotations, recolors,
          description: `Case 1: z is root — recolor black.`,
        });
      }
      break;
    }
    const parent = t.nodes.get(z.parent)!;
    if (parent.color === "B") {
      // Case 2: parent black — done.
      yield snapshot(t, {
        active: z.id, path: [], pivot: null, successor: null,
        output: [], kind: "info", insertCase: "case-2-parent-black", deleteCase: "",
        comparisons, rotations, recolors,
        description: `Case 2: parent is black — no violation, done.`,
      });
      break;
    }
    // Parent is red → violation (red-red). Look at uncle.
    const gp = grandparent(t, z.id);
    if (gp === null) break;
    const uncleNode = uncle(t, z.id);
    if (uncleNode !== null && uncleNode.color === "R") {
      // Case 3: uncle red → recolor parent, uncle, grandparent.
      parent.color = "B";
      uncleNode.color = "B";
      gp.color = "R";
      recolors += 3;
      yield snapshot(t, {
        active: z.id, path: [], pivot: null, successor: null,
        output: [], kind: "recolor", insertCase: "case-3-uncle-red-recolor", deleteCase: "",
        comparisons, rotations, recolors,
        description: `Case 3: uncle ${uncleNode.value} is red — recolor parent ${parent.value}→B, uncle→B, grandparent ${gp.value}→R. Move z up to grandparent.`,
      });
      zId = gp.id;
      continue;
    }
    // Uncle is black (or null). Determine LL/LR/RR/RL.
    const zIsRightChild = z.id === parent.right;
    const parentIsRightChild = parent.id === gp.right;
    if (zIsRightChild === parentIsRightChild) {
      // LL or RR → single rotation (case 4).
      const caseLabel: InsertCase = parentIsRightChild ? "case-4-uncle-black-LL-RR" : "case-4-uncle-black-LL-RR";
      yield snapshot(t, {
        active: z.id, path: [], pivot: parent.id, successor: null,
        output: [], kind: "rotation", insertCase: caseLabel, deleteCase: "",
        comparisons, rotations, recolors,
        description: `Case 4 (${parentIsRightChild ? "RR" : "LL"}): uncle black, z is ${zIsRightChild ? "right" : "left"} child of parent which is ${parentIsRightChild ? "right" : "left"} child of grandparent — recolor parent B, grandparent R, then ${parentIsRightChild ? "left" : "right"}-rotate grandparent.`,
      });
      parent.color = "B";
      gp.color = "R";
      recolors += 2;
      if (parentIsRightChild) rotateLeft(t, gp.id);
      else rotateRight(t, gp.id);
      rotations++;
      yield snapshot(t, {
        active: parent.id, path: [], pivot: parent.id, successor: null,
        output: [], kind: "rotation", insertCase: caseLabel, deleteCase: "",
        comparisons, rotations, recolors,
        description: `Rotation applied — tree is now a valid RB tree.`,
      });
      break;
    } else {
      // LR or RL → case 5 (rotate parent) then case 4 (rotate grandparent).
      const caseLabel: InsertCase = "case-5-uncle-black-LR-RL";
      yield snapshot(t, {
        active: z.id, path: [], pivot: parent.id, successor: null,
        output: [], kind: "rotation", insertCase: caseLabel, deleteCase: "",
        comparisons, rotations, recolors,
        description: `Case 5 (${parentIsRightChild ? "RL" : "LR"}): uncle black, z is ${zIsRightChild ? "right" : "left"} child but parent is ${parentIsRightChild ? "right" : "left"} child — ${zIsRightChild ? "left" : "right"}-rotate parent to reduce to case 4.`,
      });
      // Case 5: rotate parent. After this rotation, the OLD parent becomes a
      // child of z, and z moves up to take parent's slot. Apply case 4 next.
      const oldParentId = parent.id;
      if (zIsRightChild) rotateLeft(t, oldParentId);
      else rotateRight(t, oldParentId);
      rotations++;
      // Now the OLD parent is in z's old slot, with z as its parent.
      // Apply case 4: recolor z (new parent) B, grandparent R, rotate grandparent.
      const newZ = t.nodes.get(oldParentId)!; // old parent, now child of original z
      const newParent = newZ.parent !== null ? t.nodes.get(newZ.parent)! : null; // original z
      const newGp = newParent !== null && newParent.parent !== null ? t.nodes.get(newParent.parent)! : null; // grandparent
      if (newParent && newGp) {
        yield snapshot(t, {
          active: newZ.id, path: [], pivot: newParent.id, successor: null,
          output: [], kind: "rotation", insertCase: "case-4-uncle-black-LL-RR", deleteCase: "",
          comparisons, rotations, recolors,
          description: `Now in case 4 (${newParent.id === newGp.right ? "RR" : "LL"}): recolor new parent ${newParent.value}→B, grandparent ${newGp.value}→R, ${newParent.id === newGp.right ? "left" : "right"}-rotate grandparent.`,
        });
        newParent.color = "B";
        newGp.color = "R";
        recolors += 2;
        if (newParent.id === newGp.right) rotateLeft(t, newGp.id);
        else rotateRight(t, newGp.id);
        rotations++;
      }
      break;
    }
  }
  // Force root black.
  if (t.root !== null) {
    const root = t.nodes.get(t.root)!;
    if (root.color !== "B") {
      root.color = "B";
      recolors++;
      yield snapshot(t, {
        active: t.root, path: [], pivot: null, successor: null,
        output: [], kind: "recolor", insertCase: "case-1-root", deleteCase: "",
        comparisons, rotations, recolors,
        description: `Ensure root is black (case 1 final).`,
      });
    }
  }
  yield snapshot(t, {
    active: null, path: [], pivot: null, successor: null,
    output: [], kind: "info", insertCase: "", deleteCase: "",
    comparisons, rotations, recolors,
    description: `Insert of ${value} complete. ${rotations} rotation${rotations === 1 ? "" : "s"}, ${recolors} recolor${recolors === 1 ? "" : "s"}.`,
  });
}

export function* deleteGen(tree: RBTree, value: number): Generator<Step> {
  const t = cloneTree(tree);
  let comparisons = 0;
  let rotations = 0;
  let recolors = 0;
  const path: number[] = [];

  // Find the node.
  let curId: number | null = t.root;
  let target: RBNode | null = null;
  while (curId !== null) {
    const cur = t.nodes.get(curId)!;
    comparisons++;
    path.push(cur.id);
    yield snapshot(t, {
      active: cur.id, path: [...path], pivot: null, successor: null,
      output: [], kind: "compare", insertCase: "", deleteCase: "",
      comparisons, rotations, recolors,
      description: `Compare ${value} with ${cur.value}.`,
    });
    if (value === cur.value) { target = cur; break; }
    curId = value < cur.value ? cur.left : cur.right;
  }
  if (!target) {
    yield snapshot(t, {
      active: null, path: [...path], pivot: null, successor: null,
      output: [], kind: "info", insertCase: "", deleteCase: "",
      comparisons, rotations, recolors,
      description: `${value} not in tree — nothing to delete.`,
    });
    return;
  }
  yield snapshot(t, {
    active: target.id, path: [...path], pivot: null, successor: null,
    output: [], kind: "visit", insertCase: "", deleteCase: "",
    comparisons, rotations, recolors,
    description: `Found ${value}. Deleting...`,
  });

  // Two children — find successor, copy value, then delete successor.
  if (target.left !== null && target.right !== null) {
    const succ = successor(t, target.id)!;
    yield snapshot(t, {
      active: target.id, path: [...path], pivot: null, successor: succ.id,
      output: [], kind: "info", insertCase: "", deleteCase: "",
      comparisons, rotations, recolors,
      description: `Two children — in-order successor is ${succ.value}. Copy up & delete successor.`,
    });
    target.value = succ.value;
    // Delete successor (at most a right child).
    yield* deleteNodeGen(t, succ.id, comparisons, rotations, recolors, (c, r, rc) => {
      comparisons = c; rotations = r; recolors = rc;
    });
  } else {
    yield* deleteNodeGen(t, target.id, comparisons, rotations, recolors, (c, r, rc) => {
      comparisons = c; rotations = r; recolors = rc;
    });
  }

  yield snapshot(t, {
    active: null, path: [], pivot: null, successor: null,
    output: [], kind: "info", insertCase: "", deleteCase: "",
    comparisons, rotations, recolors,
    description: `Delete of ${value} complete. ${rotations} rotation${rotations === 1 ? "" : "s"}, ${recolors} recolor${recolors === 1 ? "" : "s"}.`,
  });
}

function* deleteNodeGen(
  t: RBTree,
  zId: number,
  comparisonsIn: number,
  rotationsIn: number,
  recolorsIn: number,
  setCounters: (c: number, r: number, rc: number) => void,
): Generator<Step> {
  let comparisons = comparisonsIn;
  let rotations = rotationsIn;
  let recolors = recolorsIn;
  const z = t.nodes.get(zId)!;
  const yOriginalColor = z.color;
  let fixupNodeId: number | null = null;
  let fixupParentId: number | null = null;

  if (z.left === null && z.right === null) {
    // Leaf — splice out (no children).
    fixupParentId = z.parent;
    fixupNodeId = null;
    yield snapshot(t, {
      active: z.id, path: [], pivot: null, successor: null,
      output: [], kind: "info", insertCase: "", deleteCase: "case-6-splice",
      comparisons, rotations, recolors,
      description: `Leaf — unlink. Original color: ${yOriginalColor}.`,
    });
    transplant(t, z.id, null);
    t.nodes.delete(z.id);
    yield snapshot(t, {
      active: null, path: [], pivot: null, successor: null,
      output: [], kind: "delete", insertCase: "", deleteCase: "",
      comparisons, rotations, recolors,
      description: `Removed ${z.value}.`,
    });
  } else if (z.left === null || z.right === null) {
    // One child — splice child up.
    const childId = z.left ?? z.right;
    fixupParentId = z.parent;
    fixupNodeId = childId;
    yield snapshot(t, {
      active: z.id, path: [], pivot: null, successor: childId,
      output: [], kind: "info", insertCase: "", deleteCase: "case-6-splice",
      comparisons, rotations, recolors,
      description: `One child (${t.nodes.get(childId!)!.value}) — splice up. Original color: ${yOriginalColor}.`,
    });
    transplant(t, z.id, childId);
    t.nodes.delete(z.id);
    yield snapshot(t, {
      active: childId, path: [], pivot: null, successor: null,
      output: [], kind: "delete", insertCase: "", deleteCase: "",
      comparisons, rotations, recolors,
      description: `Spliced child up; removed ${z.value}.`,
    });
  } else {
    // Two children — should never reach here (handled by caller).
    void comparisons;
    void rotations;
    void recolors;
    setCounters(comparisons, rotations, recolors);
    return;
  }

  if (yOriginalColor === "B") {
    yield snapshot(t, {
      active: fixupNodeId, path: [], pivot: null, successor: null,
      output: [], kind: "double-black", insertCase: "", deleteCase: "",
      comparisons, rotations, recolors,
      description: `Removed node was black — black-height violation. Run delete fix-up.`,
    });
    yield* deleteFixupGen(t, fixupNodeId, fixupParentId, comparisons, rotations, recolors, (c, r, rc) => {
      comparisons = c; rotations = r; recolors = rc;
    });
  } else {
    yield snapshot(t, {
      active: null, path: [], pivot: null, successor: null,
      output: [], kind: "info", insertCase: "", deleteCase: "",
      comparisons, rotations, recolors,
      description: `Removed node was red — no black-height violation, done.`,
    });
  }
  setCounters(comparisons, rotations, recolors);
}

function* deleteFixupGen(
  t: RBTree,
  xIdIn: number | null,
  xParentIdIn: number | null,
  comparisonsIn: number,
  rotationsIn: number,
  recolorsIn: number,
  setCounters: (c: number, r: number, rc: number) => void,
): Generator<Step> {
  let comparisons = comparisonsIn;
  let rotations = rotationsIn;
  let recolors = recolorsIn;
  let x: number | null = xIdIn;
  let xParent: number | null = xParentIdIn;

  while (x !== t.root && (x === null || t.nodes.get(x)!.color === "B")) {
    if (xParent === null) break;
    const p = t.nodes.get(xParent)!;
    if (p.left === x) {
      let wId = p.right;
      let w = wId !== null ? t.nodes.get(wId)! : null;
      if (w !== null && w.color === "R") {
        // Case 2: sibling red.
        yield snapshot(t, {
          active: p.id, path: [], pivot: p.id, successor: wId,
          output: [], kind: "rotation", insertCase: "", deleteCase: "case-2-sibling-red",
          comparisons, rotations, recolors,
          description: `Case 2: sibling ${w.value} is red — recolor sibling B, parent R, left-rotate parent.`,
        });
        w.color = "B";
        p.color = "R";
        recolors += 2;
        rotateLeft(t, p.id);
        rotations++;
        wId = p.right;
        w = wId !== null ? t.nodes.get(wId)! : null;
      }
      const wLeft = w !== null && w.left !== null ? t.nodes.get(w.left)! : null;
      const wRight = w !== null && w.right !== null ? t.nodes.get(w.right)! : null;
      if (w !== null && (wLeft === null || wLeft.color === "B") && (wRight === null || wRight.color === "B")) {
        // Case 3: sibling black, both nieces black.
        yield snapshot(t, {
          active: w.id, path: [], pivot: null, successor: null,
          output: [], kind: "recolor", insertCase: "", deleteCase: "case-3-sibling-black-nieces-black",
          comparisons, rotations, recolors,
          description: `Case 3: sibling ${w.value} black with both nieces black — recolor sibling red, move up.`,
        });
        w.color = "R";
        recolors++;
        x = xParent;
        xParent = t.nodes.get(x)!.parent;
        continue;
      } else {
        if (w !== null && (wRight === null || wRight.color === "B")) {
          // Case 4: near niece red, far niece black.
          yield snapshot(t, {
            active: w.id, path: [], pivot: w.id, successor: w.left,
            output: [], kind: "rotation", insertCase: "", deleteCase: "case-4-sibling-black-red-near",
            comparisons, rotations, recolors,
            description: `Case 4: near niece red, far niece black — recolor near niece B, sibling R, right-rotate sibling.`,
          });
          if (wLeft !== null) wLeft.color = "B";
          w.color = "R";
          recolors += 2;
          rotateRight(t, w.id);
          rotations++;
          wId = p.right;
          w = wId !== null ? treeGet(t, wId) : null;
        }
        // Case 5: far niece red.
        const wRightNow = w !== null && w.right !== null ? t.nodes.get(w.right)! : null;
        yield snapshot(t, {
          active: p.id, path: [], pivot: p.id, successor: wId,
          output: [], kind: "rotation", insertCase: "", deleteCase: "case-5-sibling-black-red-far",
          comparisons, rotations, recolors,
          description: `Case 5: far niece red — sibling takes parent's color, parent B, far niece B, left-rotate parent.`,
        });
        if (w !== null) {
          w.color = p.color;
          p.color = "B";
          recolors += 2;
          if (wRightNow !== null) {
            wRightNow.color = "B";
            recolors++;
          }
          rotateLeft(t, p.id);
          rotations++;
        }
        x = t.root;
        xParent = null;
      }
    } else {
      // Mirror image.
      let wId = p.left;
      let w = wId !== null ? t.nodes.get(wId)! : null;
      if (w !== null && w.color === "R") {
        yield snapshot(t, {
          active: p.id, path: [], pivot: p.id, successor: wId,
          output: [], kind: "rotation", insertCase: "", deleteCase: "case-2-sibling-red",
          comparisons, rotations, recolors,
          description: `Case 2 (mirror): sibling ${w.value} red — recolor sibling B, parent R, right-rotate parent.`,
        });
        w.color = "B";
        p.color = "R";
        recolors += 2;
        rotateRight(t, p.id);
        rotations++;
        wId = p.left;
        w = wId !== null ? t.nodes.get(wId)! : null;
      }
      const wLeft = w !== null && w.left !== null ? t.nodes.get(w.left)! : null;
      const wRight = w !== null && w.right !== null ? t.nodes.get(w.right)! : null;
      if (w !== null && (wLeft === null || wLeft.color === "B") && (wRight === null || wRight.color === "B")) {
        yield snapshot(t, {
          active: w.id, path: [], pivot: null, successor: null,
          output: [], kind: "recolor", insertCase: "", deleteCase: "case-3-sibling-black-nieces-black",
          comparisons, rotations, recolors,
          description: `Case 3 (mirror): sibling ${w.value} black with both nieces black — recolor sibling red, move up.`,
        });
        w.color = "R";
        recolors++;
        x = xParent;
        xParent = t.nodes.get(x)!.parent;
        continue;
      } else {
        if (w !== null && (wLeft === null || wLeft.color === "B")) {
          yield snapshot(t, {
            active: w.id, path: [], pivot: w.id, successor: w.right,
            output: [], kind: "rotation", insertCase: "", deleteCase: "case-4-sibling-black-red-near",
            comparisons, rotations, recolors,
            description: `Case 4 (mirror): near niece red, far niece black — recolor, left-rotate sibling.`,
          });
          if (wRight !== null) wRight.color = "B";
          w.color = "R";
          recolors += 2;
          rotateLeft(t, w.id);
          rotations++;
          wId = p.left;
          w = wId !== null ? treeGet(t, wId) : null;
        }
        const wLeftNow = w !== null && w.left !== null ? t.nodes.get(w.left)! : null;
        yield snapshot(t, {
          active: p.id, path: [], pivot: p.id, successor: wId,
          output: [], kind: "rotation", insertCase: "", deleteCase: "case-5-sibling-black-red-far",
          comparisons, rotations, recolors,
          description: `Case 5 (mirror): far niece red — recolor, right-rotate parent.`,
        });
        if (w !== null) {
          w.color = p.color;
          p.color = "B";
          recolors += 2;
          if (wLeftNow !== null) {
            wLeftNow.color = "B";
            recolors++;
          }
          rotateRight(t, p.id);
          rotations++;
        }
        x = t.root;
        xParent = null;
      }
    }
  }
  if (x !== null && t.nodes.get(x)!.color !== "B") {
    t.nodes.get(x)!.color = "B";
    recolors++;
    yield snapshot(t, {
      active: x, path: [], pivot: null, successor: null,
      output: [], kind: "recolor", insertCase: "", deleteCase: "case-1-root",
      comparisons, rotations, recolors,
      description: `Recolor final node black to restore black-height.`,
    });
  }
  void comparisons;
  setCounters(comparisons, rotations, recolors);
}

/** Safe node fetch (returns null if id is null or missing). */
function treeGet(t: RBTree, id: number | null): RBNode | null {
  if (id === null) return null;
  return t.nodes.get(id) ?? null;
}

export function* inOrderGen(tree: RBTree): Generator<Step> {
  const t = cloneTree(tree);
  const output: number[] = [];
  let comparisons = 0;
  const rotations = 0;
  const recolors = 0;
  function* walk(id: number | null): Generator<Step> {
    if (id === null) return;
    const n = t.nodes.get(id)!;
    if (n.isNil) return;
    yield* walk(n.left);
    comparisons++;
    output.push(n.value);
    yield snapshot(t, {
      active: n.id, path: [], pivot: null, successor: null,
      output: [...output], kind: "visit", insertCase: "", deleteCase: "",
      comparisons, rotations, recolors,
      description: `In-order visit ${n.value} (${n.color}).`,
    });
    yield* walk(n.right);
  }
  yield* walk(t.root);
}

// ---------------------------------------------------------------------------
// Run dispatchers
// ---------------------------------------------------------------------------

export function runInsert(tree: RBTree, value: number): OpResult {
  const steps: Step[] = [];
  for (const s of insertGen(tree, value)) steps.push(s);
  const last = steps[steps.length - 1];
  const finalTree = cloneTree(tree);
  const inserted = insertPure(finalTree, value);
  return {
    kind: "insert",
    steps,
    totalComparisons: last?.comparisons ?? 0,
    totalRotations: last?.rotations ?? 0,
    totalRecolors: last?.recolors ?? 0,
    output: [],
    found: inserted,
    finalTree,
  };
}

export function runDelete(tree: RBTree, value: number): OpResult {
  const steps: Step[] = [];
  for (const s of deleteGen(tree, value)) steps.push(s);
  const last = steps[steps.length - 1];
  const finalTree = cloneTree(tree);
  const deleted = deletePure(finalTree, value);
  return {
    kind: "delete",
    steps,
    totalComparisons: last?.comparisons ?? 0,
    totalRotations: last?.rotations ?? 0,
    totalRecolors: last?.recolors ?? 0,
    output: [],
    found: deleted,
    finalTree,
  };
}

export function runTraversal(tree: RBTree): OpResult {
  const steps: Step[] = [];
  for (const s of inOrderGen(tree)) steps.push(s);
  const last = steps[steps.length - 1];
  return {
    kind: "traverse-inorder",
    steps,
    totalComparisons: last?.comparisons ?? 0,
    totalRotations: 0,
    totalRecolors: 0,
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
// Serialization (insertion order)
// ---------------------------------------------------------------------------

export function serializeTree(tree: RBTree): string {
  if (tree.root === null) return "";
  const values: number[] = [];
  const walk = (id: number | null) => {
    if (id === null) return;
    const n = tree.nodes.get(id)!;
    if (n.isNil) return;
    values.push(n.value);
    walk(n.left);
    walk(n.right);
  };
  walk(tree.root);
  return values.join(",");
}

export function deserializeTree(s: string): RBTree | null {
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
  if (step.pivot === nodeId && (step.kind === "rotation")) return "pivot";
  if (step.active === nodeId) {
    if (step.kind === "recolor") return "recolor";
    if (step.kind === "rotation") return "rotation";
    if (step.kind === "double-black") return "double-black";
    if (step.kind === "insert") return "insert";
    if (step.kind === "compare") return "compare";
    return "active";
  }
  if (step.path.includes(nodeId)) return "path";
  return "default";
}

export function formatStep(step: Step, stepIndex: number, total: number): string {
  const ins = step.insertCase ? ` ins=${step.insertCase}` : "";
  const del = step.deleteCase ? ` del=${step.deleteCase}` : "";
  const out = step.output.length > 0 ? ` output=[${step.output.join(",")}]` : "";
  return `[${stepIndex + 1}/${total}] ${step.description}  (cmp=${step.comparisons} rot=${step.rotations} rec=${step.recolors}${ins}${del}${out})`;
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:red-black-tree-visualizer:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  op: OpKind;
  value?: number;
  nodeCount: number;
  height: number;
  blackHeight: number;
  comparisons: number;
  rotations: number;
  recolors: number;
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

export function buildShareUrl(tree: RBTree): string {
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

export function randomTree(count: number, seed: number = 1): RBTree {
  const rand = mulberry32(seed);
  const set = new Set<number>();
  while (set.size < count) {
    set.add(Math.floor(rand() * 100));
  }
  return fromValues([...set]);
}

export function sortedTree(count: number): RBTree {
  const vals: number[] = [];
  for (let i = 1; i <= count; i++) vals.push(i * 2);
  return fromValues(vals);
}

/** In-order traversal as a plain array (no steps). */
export function inOrderArray(tree: RBTree): number[] {
  const out: number[] = [];
  const walk = (id: number | null) => {
    if (id === null) return;
    const n = tree.nodes.get(id)!;
    if (n.isNil) return;
    walk(n.left);
    out.push(n.value);
    walk(n.right);
  };
  walk(tree.root);
  return out;
}

/** Count rotations + recolors that would occur inserting `values` in order. */
export function countOperations(values: number[]): { rotations: number; recolors: number } {
  let rotations = 0;
  let recolors = 0;
  const t = createTree();
  for (const v of values) {
    let prevRec = 0;
    for (const s of insertGen(t, v)) {
      if (s.kind === "rotation") rotations++;
      if (s.recolors > prevRec) {
        recolors += s.recolors - prevRec;
        prevRec = s.recolors;
      }
    }
    insertPure(t, v);
  }
  return { rotations, recolors };
}
