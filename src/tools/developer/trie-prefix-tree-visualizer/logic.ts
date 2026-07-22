/**
 * Trie (Prefix Tree) Visualizer — pure logic.
 *
 * Generator-based step engine for visualizing trie insert, search,
 * delete (with node pruning), and autocomplete. Each operation yields
 * a stream of Step objects — each carrying a full trie snapshot
 * (serializable node list with parent / children links), the active
 * node, the character path traversed so far, and running output — so
 * the UI can step forward and backward without re-running. Pure
 * functions only — no DOM, no network.
 *
 * Trie structure: each node has a map of children keyed by character
 * and an `isEnd` flag marking the end of a complete word. The root
 * node represents the empty string.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TrieNode {
  id: number;
  /** Character on the EDGE from parent to this node. Root has "". */
  char: string;
  /** True if a complete word ends at this node. */
  isEnd: boolean;
  /** Parent node id (null for root). */
  parent: number | null;
  /** Children: char → node id. */
  children: Map<string, number>;
}

export interface Trie {
  nodes: Map<number, TrieNode>;
  root: number;
  nextId: number;
}

export interface PositionedNode {
  node: TrieNode;
  x: number;
  y: number;
  depth: number;
}

export interface TrieEdge {
  from: number;
  to: number;
  char: string;
}

export interface TrieLayout {
  nodes: PositionedNode[];
  edges: TrieEdge[];
  width: number;
  height: number;
  depth: number;
}

export type OpKind =
  | "insert"
  | "search"
  | "delete"
  | "autocomplete"
  | "longest-common-prefix";

export type StepKind =
  | "visit"
  | "compare"
  | "create"
  | "found"
  | "not-found"
  | "prune"
  | "info"
  | "done"
  | "suggestion";

export interface Step {
  /** Snapshot of the trie AT THIS MOMENT (post any mutation). */
  trie: Trie;
  /** Active node id (or null). */
  active: number | null;
  /** Path from root to active node (node ids). */
  path: number[];
  /** Characters traversed so far (the built-up prefix). */
  prefix: string;
  /** The character being compared / traversed at this step. */
  char: string | null;
  /** Suggestion list (for autocomplete). */
  suggestions: string[];
  /** Cumulative comparison count. */
  comparisons: number;
  /** Cumulative node-create count. */
  created: number;
  /** Cumulative prune count. */
  pruned: number;
  /** Step kind. */
  kind: StepKind;
  /** Human-readable description. */
  description: string;
}

export interface OpResult {
  kind: OpKind;
  steps: Step[];
  totalComparisons: number;
  totalCreated: number;
  totalPruned: number;
  /** Final output: suggestions (autocomplete), found (search), etc. */
  output: string[];
  found: boolean;
  ok: boolean;
  message?: string;
}

export interface TrieStats {
  nodeCount: number;
  wordCount: number;
  totalChars: number;
  /** Savings ratio = 1 - (nodeCount - 1) / totalChars. -1 because root has no char. */
  savings: number;
  height: number;
}

// ---------------------------------------------------------------------------
// Construction
// ---------------------------------------------------------------------------

export function createTrie(): Trie {
  const root: TrieNode = {
    id: 0,
    char: "",
    isEnd: false,
    parent: null,
    children: new Map(),
  };
  const nodes = new Map<number, TrieNode>();
  nodes.set(0, root);
  return { nodes, root: 0, nextId: 1 };
}

export function cloneTrie(t: Trie): Trie {
  const nodes = new Map<number, TrieNode>();
  for (const [id, n] of t.nodes) {
    nodes.set(id, {
      id: n.id,
      char: n.char,
      isEnd: n.isEnd,
      parent: n.parent,
      children: new Map(n.children),
    });
  }
  return { nodes, root: t.root, nextId: t.nextId };
}

export function getNode(t: Trie, id: number | null): TrieNode | null {
  if (id === null) return null;
  return t.nodes.get(id) ?? null;
}

export function fromWords(words: string[]): Trie {
  const t = createTrie();
  for (const w of words) insertPure(t, w);
  return t;
}

// ---------------------------------------------------------------------------
// Pure (non-stepped) operations
// ---------------------------------------------------------------------------

/** Insert a word. Returns true if newly inserted, false if already present. */
export function insertPure(t: Trie, word: string): boolean {
  let curId = t.root;
  for (const ch of word) {
    const cur = t.nodes.get(curId)!;
    let nextId = cur.children.get(ch);
    if (nextId === undefined) {
      nextId = t.nextId++;
      const child: TrieNode = {
        id: nextId,
        char: ch,
        isEnd: false,
        parent: curId,
        children: new Map(),
      };
      t.nodes.set(nextId, child);
      cur.children.set(ch, nextId);
    }
    curId = nextId;
  }
  const endNode = t.nodes.get(curId)!;
  if (endNode.isEnd) return false;
  endNode.isEnd = true;
  return true;
}

/** Search for a complete word. Returns true if present. */
export function searchPure(t: Trie, word: string): boolean {
  const endId = findNode(t, word);
  if (endId === null) return false;
  return t.nodes.get(endId)!.isEnd;
}

/** Find the node at the end of the given prefix (or null if not present). */
export function findNode(t: Trie, prefix: string): number | null {
  let curId: number | null = t.root;
  for (const ch of prefix) {
    const cur = t.nodes.get(curId!)!;
    const nextId = cur.children.get(ch);
    if (nextId === undefined) return null;
    curId = nextId;
  }
  return curId;
}

/** Delete a word. Returns true if deleted, false if not found. */
export function deletePure(t: Trie, word: string): boolean {
  const endId = findNode(t, word);
  if (endId === null) return false;
  const endNode = t.nodes.get(endId)!;
  if (!endNode.isEnd) return false;
  endNode.isEnd = false;
  // Prune: walk up, removing nodes with no children and not end-of-word.
  let curId: number | null = endId;
  while (curId !== null && curId !== t.root) {
    const n = t.nodes.get(curId)!;
    if (n.children.size > 0 || n.isEnd) break;
    const parentId = n.parent;
    if (parentId !== null) {
      const parent = t.nodes.get(parentId)!;
      parent.children.delete(n.char);
      t.nodes.delete(curId);
    }
    curId = parentId;
  }
  return true;
}

/** Autocomplete: list all words under a prefix. */
export function autocompletePure(t: Trie, prefix: string, limit: number = 100): string[] {
  const startId = findNode(t, prefix);
  if (startId === null) return [];
  const out: string[] = [];
  const walk = (id: number, built: string) => {
    if (out.length >= limit) return;
    const n = t.nodes.get(id)!;
    if (n.isEnd) out.push(built);
    // Sort children by char for deterministic order
    const chars = [...n.children.keys()].sort();
    for (const ch of chars) {
      const childId = n.children.get(ch)!;
      walk(childId, built + ch);
    }
  };
  walk(startId, prefix);
  return out;
}

/** Compute the longest common prefix of all words in the trie. */
export function longestCommonPrefixPure(t: Trie): string {
  if (t.nodes.size <= 1) return "";
  let curId: number | null = t.root;
  let prefix = "";
  while (curId !== null) {
    const n = t.nodes.get(curId)!;
    // Stop if this node ends a word or has more than one child.
    if (n.isEnd || n.children.size !== 1) break;
    const [onlyChar] = n.children.keys();
    prefix += onlyChar;
    curId = n.children.get(onlyChar)!;
  }
  return prefix;
}

/** Count words (nodes with isEnd=true). */
export function countWords(t: Trie): number {
  let count = 0;
  for (const n of t.nodes.values()) {
    if (n.isEnd) count++;
  }
  return count;
}

/** Total characters stored (sum of all word lengths). */
export function totalChars(t: Trie): number {
  let sum = 0;
  for (const n of t.nodes.values()) {
    if (n.isEnd) {
      // Walk up to root counting edges
      let curId: number | null = n.id;
      let len = 0;
      while (curId !== null && curId !== t.root) {
        len++;
        curId = t.nodes.get(curId)!.parent;
      }
      sum += len;
    }
  }
  return sum;
}

/** Height of trie (max depth, root = 0). */
export function trieHeight(t: Trie): number {
  let max = 0;
  const walk = (id: number, depth: number) => {
    max = Math.max(max, depth);
    const n = t.nodes.get(id)!;
    for (const childId of n.children.values()) {
      walk(childId, depth + 1);
    }
  };
  walk(t.root, 0);
  return max;
}

export function computeStats(t: Trie): TrieStats {
  const nodeCount = t.nodes.size;
  const wordCount = countWords(t);
  const chars = totalChars(t);
  // Internal nodes (excluding root) = nodeCount - 1
  const internal = nodeCount - 1;
  const savings = chars > 0 ? 1 - internal / chars : 0;
  return {
    nodeCount,
    wordCount,
    totalChars: chars,
    savings,
    height: trieHeight(t),
  };
}

// ---------------------------------------------------------------------------
// Tree layout
// ---------------------------------------------------------------------------

export function layout(t: Trie): TrieLayout {
  const nodes: PositionedNode[] = [];
  const edges: TrieEdge[] = [];
  let nextX = 0;
  const maxDepth = [0];
  const walk = (id: number, depth: number) => {
    const n = t.nodes.get(id)!;
    const childIds = [...n.children.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    if (childIds.length === 0) {
      nodes.push({ node: n, x: nextX, y: depth, depth });
      nextX += 1;
    } else {
      for (const [ch, childId] of childIds) {
        walk(childId, depth + 1);
        edges.push({ from: id, to: childId, char: ch });
      }
      // Position this node at the centroid of its children
      const childPositions = nodes.filter((p) => p.node.parent === id);
      if (childPositions.length > 0) {
        const avgX = childPositions.reduce((s, p) => s + p.x, 0) / childPositions.length;
        nodes.push({ node: n, x: avgX, y: depth, depth });
      }
    }
    maxDepth[0] = Math.max(maxDepth[0], depth);
  };
  walk(t.root, 0);
  // Sort nodes by depth then x for consistent rendering
  nodes.sort((a, b) => a.depth - b.depth || a.x - b.x);
  const width = nextX;
  const height = maxDepth[0] + 1;
  return { nodes, edges, width, height, depth: maxDepth[0] };
}

// ---------------------------------------------------------------------------
// Stepped operations (generators)
// ---------------------------------------------------------------------------

export function* insertGen(t: Trie, word: string): Generator<Step> {
  let curId = t.root;
  let prefix = "";
  let comparisons = 0;
  let created = 0;
  let pruned = 0;
  const path: number[] = [t.root];

  yield {
    trie: cloneTrie(t),
    active: curId,
    path: [...path],
    prefix,
    char: null,
    suggestions: [],
    comparisons,
    created,
    pruned,
    kind: "visit",
    description: `Start insert of "${word}" at root.`,
  };

  for (const ch of word) {
    const cur = t.nodes.get(curId)!;
    comparisons++;
    const existing = cur.children.get(ch);
    if (existing === undefined) {
      // Create new node
      const newId = t.nextId++;
      const child: TrieNode = {
        id: newId,
        char: ch,
        isEnd: false,
        parent: curId,
        children: new Map(),
      };
      t.nodes.set(newId, child);
      cur.children.set(ch, newId);
      created++;
      curId = newId;
      prefix += ch;
      path.push(curId);
      yield {
        trie: cloneTrie(t),
        active: curId,
        path: [...path],
        prefix,
        char: ch,
        suggestions: [],
        comparisons,
        created,
        pruned,
        kind: "create",
        description: `No existing child for '${ch}' — create new node (id=${newId}).`,
      };
    } else {
      curId = existing;
      prefix += ch;
      path.push(curId);
      yield {
        trie: cloneTrie(t),
        active: curId,
        path: [...path],
        prefix,
        char: ch,
        suggestions: [],
        comparisons,
        created,
        pruned,
        kind: "visit",
        description: `Follow existing edge '${ch}' to shared node (id=${existing}).`,
      };
    }
  }

  const endNode = t.nodes.get(curId)!;
  if (endNode.isEnd) {
    yield {
      trie: cloneTrie(t),
      active: curId,
      path: [...path],
      prefix,
      char: null,
      suggestions: [],
      comparisons,
      created,
      pruned,
      kind: "info",
      description: `"${word}" was already in the trie — no change.`,
    };
    return;
  }
  endNode.isEnd = true;
  yield {
    trie: cloneTrie(t),
    active: curId,
    path: [...path],
    prefix,
    char: null,
    suggestions: [],
    comparisons,
    created,
    pruned,
    kind: "done",
    description: `Mark node ${curId} as end-of-word — "${word}" inserted.`,
  };
}

export function* searchGen(t: Trie, word: string): Generator<Step> {
  let curId: number = t.root;
  let prefix = "";
  let comparisons = 0;
  let created = 0;
  let pruned = 0;
  const path: number[] = [t.root];

  yield {
    trie: cloneTrie(t),
    active: curId,
    path: [...path],
    prefix,
    char: null,
    suggestions: [],
    comparisons,
    created,
    pruned,
    kind: "visit",
    description: `Start search for "${word}" at root.`,
  };

  for (const ch of word) {
    const cur = t.nodes.get(curId!)!;
    comparisons++;
    const nextId = cur.children.get(ch);
    yield {
      trie: cloneTrie(t),
      active: curId,
      path: [...path],
      prefix,
      char: ch,
      suggestions: [],
      comparisons,
      created,
      pruned,
      kind: "compare",
      description: `Look for child '${ch}' from node ${curId}.`,
    };
    if (nextId === undefined) {
      yield {
        trie: cloneTrie(t),
        active: curId,
        path: [...path],
        prefix,
        char: ch,
        suggestions: [],
        comparisons,
        created,
        pruned,
        kind: "not-found",
        description: `No edge labeled '${ch}' — "${word}" is not in the trie.`,
      };
      return;
    }
    curId = nextId;
    prefix += ch;
    path.push(curId);
    yield {
      trie: cloneTrie(t),
      active: curId,
      path: [...path],
      prefix,
      char: ch,
      suggestions: [],
      comparisons,
      created,
      pruned,
      kind: "visit",
      description: `Follow edge '${ch}' to node ${curId}.`,
    };
  }

  const endNode = t.nodes.get(curId!)!;
  if (endNode.isEnd) {
    yield {
      trie: cloneTrie(t),
      active: curId,
      path: [...path],
      prefix,
      char: null,
      suggestions: [],
      comparisons,
      created,
      pruned,
      kind: "found",
      description: `Found end-of-word marker at node ${curId} — "${word}" is in the trie.`,
    };
  } else {
    yield {
      trie: cloneTrie(t),
      active: curId,
      path: [...path],
      prefix,
      char: null,
      suggestions: [],
      comparisons,
      created,
      pruned,
      kind: "not-found",
      description: `Reached node ${curId} but no end-of-word marker — "${word}" is only a prefix, not a stored word.`,
    };
  }
}

export function* deleteGen(t: Trie, word: string): Generator<Step> {
  let curId: number = t.root;
  let prefix = "";
  let comparisons = 0;
  let created = 0;
  let pruned = 0;
  const path: number[] = [t.root];

  yield {
    trie: cloneTrie(t),
    active: curId,
    path: [...path],
    prefix,
    char: null,
    suggestions: [],
    comparisons,
    created,
    pruned,
    kind: "visit",
    description: `Start delete of "${word}" at root.`,
  };

  // Walk down to the end-of-word node.
  for (const ch of word) {
    const cur = t.nodes.get(curId!)!;
    comparisons++;
    const nextId = cur.children.get(ch);
    yield {
      trie: cloneTrie(t),
      active: curId,
      path: [...path],
      prefix,
      char: ch,
      suggestions: [],
      comparisons,
      created,
      pruned,
      kind: "compare",
      description: `Look for child '${ch}' from node ${curId}.`,
    };
    if (nextId === undefined) {
      yield {
        trie: cloneTrie(t),
        active: curId,
        path: [...path],
        prefix,
        char: ch,
        suggestions: [],
        comparisons,
        created,
        pruned,
        kind: "not-found",
        description: `"${word}" is not in the trie — nothing to delete.`,
      };
      return;
    }
    curId = nextId;
    prefix += ch;
    path.push(curId);
  }

  const endNode = t.nodes.get(curId!)!;
  if (!endNode.isEnd) {
    yield {
      trie: cloneTrie(t),
      active: curId,
      path: [...path],
      prefix,
      char: null,
      suggestions: [],
      comparisons,
      created,
      pruned,
      kind: "not-found",
      description: `Node ${curId} exists but is not marked end-of-word — "${word}" is not a stored word.`,
    };
    return;
  }

  // Clear the end-of-word marker.
  endNode.isEnd = false;
  yield {
    trie: cloneTrie(t),
    active: curId,
    path: [...path],
    prefix,
    char: null,
    suggestions: [],
    comparisons,
    created,
    pruned,
    kind: "info",
    description: `Clear end-of-word marker on node ${curId}.`,
  };

  // Prune: walk back up, removing childless non-end nodes.
  let pruneId: number | null = curId;
  while (pruneId !== null && pruneId !== t.root) {
    const n = t.nodes.get(pruneId)!;
    if (n.children.size > 0 || n.isEnd) break;
    const parentId = n.parent;
    if (parentId !== null) {
      const parent = t.nodes.get(parentId)!;
      parent.children.delete(n.char);
      t.nodes.delete(pruneId);
      pruned++;
      path.pop();
      const newActive = path.length > 0 ? path[path.length - 1] : t.root;
      yield {
        trie: cloneTrie(t),
        active: newActive,
        path: [...path],
        prefix: prefix.slice(0, -1),
        char: n.char,
        suggestions: [],
        comparisons,
        created,
        pruned,
        kind: "prune",
        description: `Prune leaf node ${pruneId} (char '${n.char}') — no children, not end-of-word.`,
      };
      prefix = prefix.slice(0, -1);
    }
    pruneId = parentId;
  }

  yield {
    trie: cloneTrie(t),
    active: path.length > 0 ? path[path.length - 1] : t.root,
    path: [...path],
    prefix,
    char: null,
    suggestions: [],
    comparisons,
    created,
    pruned,
    kind: "done",
    description: `Deleted "${word}" — pruned ${pruned} node(s).`,
  };
}

export function* autocompleteGen(t: Trie, prefix: string, limit: number = 100): Generator<Step> {
  let curId: number = t.root;
  let built = "";
  let comparisons = 0;
  let created = 0;
  let pruned = 0;
  const path: number[] = [t.root];

  yield {
    trie: cloneTrie(t),
    active: curId,
    path: [...path],
    prefix: built,
    char: null,
    suggestions: [],
    comparisons,
    created,
    pruned,
    kind: "visit",
    description: `Start autocomplete for prefix "${prefix}".`,
  };

  // Walk down to the prefix node.
  for (const ch of prefix) {
    const cur = t.nodes.get(curId!)!;
    comparisons++;
    const nextId = cur.children.get(ch);
    yield {
      trie: cloneTrie(t),
      active: curId,
      path: [...path],
      prefix: built,
      char: ch,
      suggestions: [],
      comparisons,
      created,
      pruned,
      kind: "compare",
      description: `Look for child '${ch}' from node ${curId}.`,
    };
    if (nextId === undefined) {
      yield {
        trie: cloneTrie(t),
        active: curId,
        path: [...path],
        prefix: built,
        char: ch,
        suggestions: [],
        comparisons,
        created,
        pruned,
        kind: "not-found",
        description: `Prefix "${prefix}" is not in the trie — no suggestions.`,
      };
      return;
    }
    curId = nextId;
    built += ch;
    path.push(curId);
    yield {
      trie: cloneTrie(t),
      active: curId,
      path: [...path],
      prefix: built,
      char: ch,
      suggestions: [],
      comparisons,
      created,
      pruned,
      kind: "visit",
      description: `Follow edge '${ch}' to node ${curId}.`,
    };
  }

  // Collect suggestions
  const suggestions: string[] = [];
  const walk = (id: number, s: string) => {
    if (suggestions.length >= limit) return;
    const n = t.nodes.get(id)!;
    if (n.isEnd) suggestions.push(s);
    const chars = [...n.children.keys()].sort();
    for (const ch of chars) {
      const childId = n.children.get(ch)!;
      walk(childId, s + ch);
    }
  };
  walk(curId!, built);
  yield {
    trie: cloneTrie(t),
    active: curId,
    path: [...path],
    prefix: built,
    char: null,
    suggestions: [...suggestions],
    comparisons,
    created,
    pruned,
    kind: "suggestion",
    description: `Found ${suggestions.length} suggestion(s) under prefix "${prefix}".`,
  };
  yield {
    trie: cloneTrie(t),
    active: curId,
    path: [...path],
    prefix: built,
    char: null,
    suggestions: [...suggestions],
    comparisons,
    created,
    pruned,
    kind: "done",
    description: `Autocomplete complete for "${prefix}": ${suggestions.length} word(s).`,
  };
}

export function* longestCommonPrefixGen(t: Trie): Generator<Step> {
  let curId: number | null = t.root;
  let prefix = "";
  let comparisons = 0;
  let created = 0;
  let pruned = 0;
  const path: number[] = [t.root];

  yield {
    trie: cloneTrie(t),
    active: curId,
    path: [...path],
    prefix,
    char: null,
    suggestions: [],
    comparisons,
    created,
    pruned,
    kind: "visit",
    description: `Start longest-common-prefix walk from root.`,
  };

  while (curId !== null) {
    const n = t.nodes.get(curId!)!;
    if (n.isEnd) {
      yield {
        trie: cloneTrie(t),
        active: curId,
        path: [...path],
        prefix,
        char: null,
        suggestions: [],
        comparisons,
        created,
        pruned,
        kind: "info",
        description: `Node ${curId} is end-of-word — LCP stops here at "${prefix}".`,
      };
      break;
    }
    if (n.children.size !== 1) {
      yield {
        trie: cloneTrie(t),
        active: curId,
        path: [...path],
        prefix,
        char: null,
        suggestions: [],
        comparisons,
        created,
        pruned,
        kind: "info",
        description: `Node ${curId} has ${n.children.size} child(ren) — LCP stops here at "${prefix}".`,
      };
      break;
    }
    comparisons++;
    const [onlyChar] = n.children.keys();
    const childId = n.children.get(onlyChar)!;
    prefix += onlyChar;
    path.push(childId);
    yield {
      trie: cloneTrie(t),
      active: childId,
      path: [...path],
      prefix,
      char: onlyChar,
      suggestions: [],
      comparisons,
      created,
      pruned,
      kind: "visit",
      description: `Single child '${onlyChar}' — extend LCP to "${prefix}".`,
    };
    curId = childId;
  }

  yield {
    trie: cloneTrie(t),
    active: curId,
    path: [...path],
    prefix,
    char: null,
    suggestions: [],
    comparisons,
    created,
    pruned,
    kind: "done",
    description: `Longest common prefix: "${prefix}".`,
  };
}

// ---------------------------------------------------------------------------
// Run dispatchers
// ---------------------------------------------------------------------------

function collect(gen: Generator<Step>): Step[] {
  const out: Step[] = [];
  for (const s of gen) out.push(s);
  return out;
}

export function runInsert(t: Trie, word: string): OpResult {
  const work = cloneTrie(t);
  const steps = collect(insertGen(work, word));
  const last = steps[steps.length - 1];
  return {
    kind: "insert",
    steps,
    totalComparisons: last?.comparisons ?? 0,
    totalCreated: last?.created ?? 0,
    totalPruned: last?.pruned ?? 0,
    output: [],
    found: last?.kind === "done",
    ok: true,
  };
}

export function runSearch(t: Trie, word: string): OpResult {
  const work = cloneTrie(t);
  const steps = collect(searchGen(work, word));
  const last = steps[steps.length - 1];
  return {
    kind: "search",
    steps,
    totalComparisons: last?.comparisons ?? 0,
    totalCreated: 0,
    totalPruned: 0,
    output: [],
    found: last?.kind === "found",
    ok: true,
  };
}

export function runDelete(t: Trie, word: string): OpResult {
  const work = cloneTrie(t);
  const steps = collect(deleteGen(work, word));
  const last = steps[steps.length - 1];
  return {
    kind: "delete",
    steps,
    totalComparisons: last?.comparisons ?? 0,
    totalCreated: 0,
    totalPruned: last?.pruned ?? 0,
    output: [],
    found: last?.kind === "done",
    ok: true,
  };
}

export function runAutocomplete(t: Trie, prefix: string, limit: number = 100): OpResult {
  const work = cloneTrie(t);
  const steps = collect(autocompleteGen(work, prefix, limit));
  const last = steps[steps.length - 1];
  return {
    kind: "autocomplete",
    steps,
    totalComparisons: last?.comparisons ?? 0,
    totalCreated: 0,
    totalPruned: 0,
    output: last?.suggestions ?? [],
    found: true,
    ok: true,
  };
}

export function runLongestCommonPrefix(t: Trie): OpResult {
  const work = cloneTrie(t);
  const steps = collect(longestCommonPrefixGen(work));
  const last = steps[steps.length - 1];
  return {
    kind: "longest-common-prefix",
    steps,
    totalComparisons: last?.comparisons ?? 0,
    totalCreated: 0,
    totalPruned: 0,
    output: last?.prefix ? [last.prefix] : [],
    found: true,
    ok: true,
  };
}

// ---------------------------------------------------------------------------
// Compressed (radix / Patricia) trie
// ---------------------------------------------------------------------------

export interface RadixNode {
  id: number;
  /** Substring on the edge from parent to this node. */
  edge: string;
  isEnd: boolean;
  parent: number | null;
  /** Children keyed by their edge substring → node id. */
  children: Map<string, number>;
}

export interface RadixTrie {
  nodes: Map<number, RadixNode>;
  root: number;
  nextId: number;
}

/** Build a compressed (radix / Patricia) trie from a plain trie. */
export function compress(t: Trie): RadixTrie {
  const rt: RadixTrie = {
    nodes: new Map(),
    root: 0,
    nextId: 1,
  };
  const root: RadixNode = {
    id: 0,
    edge: "",
    isEnd: t.nodes.get(t.root)!.isEnd,
    parent: null,
    children: new Map(),
  };
  rt.nodes.set(0, root);

  const build = (plainId: number, radixParentId: number | null, edgeSoFar: string) => {
    const plainNode = t.nodes.get(plainId)!;
    // Collapse single-child non-end chains into a single radix edge.
    let curId = plainId;
    let edge = edgeSoFar;
    while (true) {
      const cur = t.nodes.get(curId)!;
      if (cur.isEnd || cur.children.size !== 1) break;
      const [onlyChar] = cur.children.keys();
      const onlyChildId = cur.children.get(onlyChar)!;
      // Check if the only child also has 0 or 2+ children, or is end-of-word —
      // if so, the chain breaks here.
      edge += onlyChar;
      curId = onlyChildId;
      const onlyChild = t.nodes.get(curId)!;
      if (onlyChild.isEnd || onlyChild.children.size !== 1) break;
    }
    // Create a radix node for `curId` with the accumulated edge.
    const radixId = rt.nextId++;
    const radixNode: RadixNode = {
      id: radixId,
      edge,
      isEnd: t.nodes.get(curId)!.isEnd,
      parent: radixParentId,
      children: new Map(),
    };
    rt.nodes.set(radixId, radixNode);
    if (radixParentId !== null) {
      rt.nodes.get(radixParentId)!.children.set(edge, radixId);
    }
    // Recurse into the plain trie's children of curId.
    const cur = t.nodes.get(curId)!;
    for (const [ch, childId] of cur.children.entries()) {
      build(childId, radixId, ch);
    }
  };

  // For the root, we don't collapse — just walk into its children.
  for (const [ch, childId] of t.nodes.get(t.root)!.children.entries()) {
    build(childId, 0, ch);
  }
  return rt;
}

export interface RadixStats {
  nodeCount: number;
  edgeCount: number;
  totalEdgeChars: number;
}

export function radixStats(rt: RadixTrie): RadixStats {
  let edgeCount = 0;
  let totalEdgeChars = 0;
  for (const n of rt.nodes.values()) {
    if (n.parent !== null) {
      edgeCount++;
      totalEdgeChars += n.edge.length;
    }
  }
  return { nodeCount: rt.nodes.size, edgeCount, totalEdgeChars };
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

export function parseWords(input: string, caseSensitive: boolean = true): string[] {
  if (!input) return [];
  const tokens = input.split(/[\s,;]+/).filter(Boolean);
  return caseSensitive ? tokens : tokens.map((w) => w.toLowerCase());
}

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

export function serializeTrie(t: Trie): string {
  const words: string[] = [];
  const walk = (id: number, prefix: string) => {
    const n = t.nodes.get(id)!;
    if (n.isEnd) words.push(prefix);
    for (const [ch, childId] of n.children.entries()) {
      walk(childId, prefix + ch);
    }
  };
  walk(t.root, "");
  return words.join(",");
}

export function deserializeTrie(s: string): Trie | null {
  if (!s || !s.trim()) return createTrie();
  const words = s.split(/[\s,;]+/).filter(Boolean);
  return fromWords(words);
}

// ---------------------------------------------------------------------------
// Step / color helpers
// ---------------------------------------------------------------------------

export function nodeColorClass(
  nodeId: number,
  step: Step,
): string {
  if (step.active === nodeId) {
    if (step.kind === "create") return "create";
    if (step.kind === "found") return "found";
    if (step.kind === "not-found") return "not-found";
    if (step.kind === "prune") return "prune";
    if (step.kind === "compare") return "compare";
    if (step.kind === "suggestion") return "suggestion";
    return "active";
  }
  if (step.path.includes(nodeId)) return "path";
  return "default";
}

export function formatStep(step: Step, stepIndex: number, total: number): string {
  const sug = step.suggestions.length > 0 ? ` suggestions=${step.suggestions.length}` : "";
  return `[${stepIndex + 1}/${total}] ${step.description}  (cmp=${step.comparisons}, created=${step.created}, pruned=${step.pruned}${sug})`;
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:trie-prefix-tree-visualizer:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  op: OpKind;
  word: string;
  nodeCount: number;
  wordCount: number;
  comparisons: number;
  created: number;
  pruned: number;
  ok: boolean;
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
  words: string;
}

export function buildShareUrl(t: Trie): string {
  const params = new URLSearchParams();
  const s = serializeTrie(t);
  if (s) params.set("w", s);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareParams | null {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return null;
  const params = new URLSearchParams(clean);
  const w = params.get("w");
  if (w === null) return null;
  return { words: w };
}

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

export const WORD_PRESETS: Record<string, string[]> = {
  fruits: ["apple", "apricot", "avocado", "banana", "blackberry", "blueberry", "cherry", "grape", "kiwi", "mango", "peach", "pear", "plum"],
  colors: ["red", "orange", "yellow", "green", "blue", "purple", "pink", "brown", "black", "white", "gray", "cyan", "magenta"],
  animals: ["cat", "caribou", "camel", "dog", "deer", "dolphin", "elephant", "emu", "frog", "fox", "fish", "giraffe", "goat"],
  prefix: ["app", "apple", "application", "apply", "applicant", "appetite", "apricot", "apex"],
};

export function randomWords(count: number, seed: number = 1): string[] {
  const rand = mulberry32(seed);
  const alphabet = "abcdefghijklmnopqrstuvwxyz";
  const out = new Set<string>();
  while (out.size < count) {
    const len = 3 + Math.floor(rand() * 5);
    let w = "";
    for (let i = 0; i < len; i++) w += alphabet[Math.floor(rand() * alphabet.length)];
    out.add(w);
  }
  return [...out];
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
