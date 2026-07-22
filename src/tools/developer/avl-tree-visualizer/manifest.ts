/**
 * AVL Tree Visualizer — Tool Manifest.
 * Tool #404 — Category 4 (Developer & Code).
 *
 * Step-by-step visualization of self-balancing AVL tree operations —
 * insert, delete, search, and in-order traversal — with live per-node
 * balance factor badges, automatic imbalance detection, and the four
 * rotations (LL, RR, LR, RL) animated as labeled steps. Double rotations
 * (LR / RL) are split into their two single-rotation phases. Side-by-side
 * height comparison vs plain BST on identical input. Rotation-count
 * statistics. Shareable tree-state URL. 100% client-side.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "avl-tree-visualizer",
  name: "AVL Tree Visualizer",
  description:
    "Step-by-step visualization of self-balancing AVL tree operations — insert, delete, search, and in-order traversal — with live per-node balance factor badges, automatic imbalance detection, and the four rotations (LL, RR, LR, RL) animated as labeled steps. Double rotations (LR / RL) are split into their two single-rotation phases so you can follow each move. Side-by-side height comparison vs a plain BST on identical input, rotation-count statistics, cascading deletion rebalance, bulk insert, and shareable tree-state URLs. 100% client-side.",
  category: "developer",
  keywords: [
    "avl tree visualizer", "avl rotations", "self balancing tree",
    "avl insert delete", "balance factor visualization", "ll rr lr rl rotations",
    "avl tree animation", "avl tree online", "height balanced tree",
    "avl vs bst", "cascading rotations", "avl deletion",
  ],
  icon: "git-fork",
  requiresNetwork: false,
  seo: {
    title: "AVL Tree Visualizer — Insert, Delete, Rotate (LL/RR/LR/RL) | UnQTools",
    faq: [
      {
        q: "How does the AVL tree visualizer work?",
        a: "Every operation (insert, delete, search, traversal) is a JavaScript generator that yields a Step object on each comparison, height update, imbalance detection, or rotation. Each step carries a full snapshot of the tree, the active pivot node, balance factors for every node, the rotation type label (LL / RR / LR / RL), and running comparison + rotation counts — so the UI can step forward and backward without re-running. The play head animates through the steps at your chosen speed, color-coding the comparison path, the imbalance pivot, and the rotation phases.",
      },
      {
        q: "What are the four AVL rotation cases and how are they animated?",
        a: "(1) LL — left-heavy with left-heavy child: one right rotation around the pivot. (2) RR — right-heavy with right-heavy child: one left rotation. (3) LR — left-heavy with right-heavy child: left-rotate the child first, then right-rotate the pivot (split into 2 phases). (4) RL — right-heavy with left-heavy child: right-rotate the child first, then left-rotate the pivot (split into 2 phases). The visualizer labels each phase so you can follow double rotations as two single rotations, just like in a textbook.",
      },
      {
        q: "How is balance factor computed and what does it tell me?",
        a: "Balance factor = height(left subtree) − height(right subtree). An AVL tree requires every node's balance factor to be in {−1, 0, +1}. When an insert or delete pushes a node's factor to ±2, the tree is imbalanced and the visualizer flags the pivot in red, shows its current factor, then applies the matching rotation. Every node displays its factor live so you can watch the imbalance propagate up the tree during cascading deletions.",
      },
      {
        q: "How does AVL compare to a plain BST and to Red-Black trees?",
        a: "On sorted input (1, 2, 3, 4, 5…), a plain BST degenerates into a linked list — O(n) height and O(n) lookup. AVL keeps the tree strictly balanced (|bf| ≤ 1), guaranteeing O(log n) operations. AVL is more rigidly balanced than Red-Black (which only guarantees no path is more than twice as long as another), so AVL does slightly more rotations on insert but offers faster lookups; RB does fewer rotations and is preferred for write-heavy workloads. The visualizer's sorted-input preset lets you watch AVL absorb a degenerate sequence cleanly.",
      },
      {
        q: "What extra features does this tool have versus other AVL visualizers?",
        a: "(1) Insert / delete / search / in-order traversal with animated comparison path. (2) All four rotations (LL / RR / LR / RL) animated and labeled, with double rotations split into their two phases. (3) Live per-node balance factor badges. (4) Imbalance detection with pivot highlighted in red. (5) Cascading deletion rebalance (walks up to root). (6) Rotation-count statistics per operation. (7) Bulk insert from a list. (8) Random-tree and sorted-input presets. (9) Reingold-Tilford-style SVG layout. (10) Step / play / pause / speed controls with reverse-step fidelity. (11) Side-by-side comparison vs plain BST (height / node count). (12) History (localStorage, last 20). (13) Shareable URL encoding the entire tree state. (14) Color legend. (15) Export step log as text. 100% client-side — no uploads, no ads.",
      },
    ],
  },
  status: "done",
};
