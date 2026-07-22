/**
 * Binary Search Tree (BST) Visualizer — Tool Manifest.
 * Tool #403 — Category 4 (Developer & Code).
 *
 * Step-by-step visualization of BST insert, delete (3 cases), and search
 * with animated comparison path. In-order, pre-order, post-order, and
 * level-order traversals with synchronized highlighting. Live height, node
 * count, and per-node balance factor. Bulk insert. Degenerate-tree
 * warning. Successor/predecessor highlighting. Shareable tree-state URL.
 * 100% client-side.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "binary-search-tree-bst-visualizer",
  name: "Binary Search Tree (BST) Visualizer",
  description:
    "Step-by-step visualization of Binary Search Tree operations — insert, delete (all 3 cases: leaf, one child, two children + successor), and search — with animated comparison path. All four traversals (in-order, pre-order, post-order, level-order) with synchronized node highlighting and output. Live height, node count, balance factor per node, degenerate-tree warning for sorted input, successor / predecessor highlighting, bulk insert from a list, and shareable tree-state URLs. 100% client-side.",
  category: "developer",
  keywords: [
    "binary search tree visualizer", "bst visualization", "bst insert delete",
    "tree traversal visualizer", "bst online tool", "in-order traversal",
    "pre-order traversal", "post-order traversal", "level-order traversal",
    "bst successor", "balance factor", "degenerate tree",
  ],
  icon: "git-fork",
  requiresNetwork: false,
  seo: {
    title: "Binary Search Tree (BST) Visualizer — Insert, Delete, Traverse | UnQTools",
    faq: [
      {
        q: "How does the BST visualizer work?",
        a: "Every operation (insert, delete, search, traversal) is implemented as a JavaScript generator function that yields a Step object on each comparison, link update, or visit. Each step carries a full snapshot of the tree structure (as a serializable node list with parent / left / right links), the active comparison node, and the running output sequence — so the UI can step forward and backward without re-running. The play head animates through the steps at your chosen speed, color-coding the active comparison path, successor / predecessor nodes, and traversal order.",
      },
      {
        q: "What are the three deletion cases and how are they animated?",
        a: "(1) Leaf node — simply unlink from its parent. (2) One child — splice the child up into the deleted node's slot, preserving the BST property. (3) Two children — find the in-order successor (leftmost node of the right subtree), copy its value into the deleted node's slot, then recursively delete the successor (which falls into case 1 or 2). The visualizer walks the comparison path down, highlights the successor in amber, then animates the splice / copy / unlink.",
      },
      {
        q: "How is balance factor computed and why does it matter?",
        a: "Balance factor = height(left subtree) − height(right subtree). A BST is balanced when every node's balance factor is in {-1, 0, 1}. When you insert sorted input (1, 2, 3, 4, 5…), each new node lands on the right spine and the tree degenerates into a linked list — O(n) height, O(n) lookup. The visualizer flags a degenerate tree with a warning banner, and every node displays its balance factor so you can see exactly where the imbalance lives. This motivates self-balancing trees like AVL and Red-Black.",
      },
      {
        q: "Can I bulk-insert values and what about duplicates?",
        a: "Yes — paste a comma / space / newline separated list into the bulk-insert box and click Insert. The tool parses integers, ignores invalid tokens, and animates each insert in sequence. Duplicate keys are silently skipped (standard BST policy) and the info panel reports how many were skipped. You can also randomize a fresh tree (10 / 25 / 50 nodes) or load a sorted-input preset to see degeneration.",
      },
      {
        q: "What extra features does this tool have versus other BST visualizers?",
        a: "(1) Insert / delete / search with animated comparison path. (2) All 3 deletion cases animated with successor highlighting. (3) All 4 traversals (in / pre / post / level-order) with synchronized node highlighting and output sequence. (4) Live height, node count, and per-node balance factor. (5) Degenerate-tree warning for sorted input. (6) Bulk insert from a list. (7) Reingold-Tilford-style tree layout (proper x / y coordinates). (8) SVG rendering with comparison-path and successor highlights. (9) Step / play / pause / speed controls with reverse-step fidelity. (10) Random-tree and sorted-tree presets. (11) History (localStorage, last 20). (12) Shareable URL encoding the entire tree state. (13) Color legend. (14) Export traversal output as text. 100% client-side — no uploads, no ads.",
      },
    ],
  },
  status: "done",
};
