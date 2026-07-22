/**
 * Red-Black Tree Visualizer — Tool Manifest.
 * Tool #405 — Category 4 (Developer & Code).
 *
 * Step-by-step visualization of CLRS-style Red-Black tree insert and
 * delete with full fix-up — every recolor and rotation labeled by case
 * (insert: case 1 root, case 2 parent black, case 3 uncle red, case 4
 * uncle black LL/RR, case 5 uncle black LR/RL; delete: case 1 root,
 * case 2 sibling red, case 3 sibling black both-nieces-black, case 4
 * sibling black near-niece red, case 5 sibling black far-niece red,
 * case 6 splice). Live five-property checklist with pass/fail, per-node
 * red/black coloring, black-height display, and shareable tree-state
 * URL. 100% client-side.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "red-black-tree-visualizer",
  name: "Red-Black Tree Visualizer",
  description:
    "Step-by-step visualization of CLRS-style Red-Black tree insert and delete with full fix-up — every recolor and rotation labeled by case (insert cases 1-5, delete cases 1-6). Live five-property checklist with pass/fail (root black, no red-red, NIL black, equal black-height, valid colors), per-node red/black coloring, black-height display, in-order traversal, bulk insert, and shareable tree-state URLs. 100% client-side.",
  category: "developer",
  keywords: [
    "red black tree visualizer", "red black tree insertion deletion",
    "rb tree rotations", "red black tree properties", "self-balancing bst",
    "red black tree fix-up", "rb tree animation", "red black tree online",
    "clrs red black tree", "double black deletion", "rb tree vs avl",
  ],
  icon: "git-fork",
  requiresNetwork: false,
  seo: {
    title: "Red-Black Tree Visualizer — Insert, Delete, Fix-up Cases | UnQTools",
    faq: [
      {
        q: "How does the Red-Black tree visualizer work?",
        a: "Every operation (insert, delete, traversal) is a JavaScript generator that yields a Step object on each comparison, recolor, or rotation. Each step carries a full snapshot of the tree, the active pivot node, the recolor count, the rotation count, and the labeled fix-up case (insert cases 1-5, delete cases 1-6) — so the UI can step forward and backward without re-running. The play head animates through the steps at your chosen speed, color-coding the comparison path, the recolor target, and the rotation pivot. A live five-property checklist shows pass/fail after every step.",
      },
      {
        q: "What are the five Red-Black tree properties and how are they checked?",
        a: "(1) The root is black. (2) Every red node has a black parent (no two consecutive reds on any path). (3) Every leaf (NIL sentinel) is black. (4) Every path from a node to a NIL descendant passes through the same number of black nodes (equal black-height). (5) Every node is either red or black. The visualizer checks all five after every step and lights up a green check or red ✗ next to each. The black-height of the root is also displayed.",
      },
      {
        q: "What are the insert fix-up cases and how are they animated?",
        a: "Case 1: z is the root — recolor black. Case 2: parent is black — no violation, done. Case 3: parent and uncle are both red — recolor parent B, uncle B, grandparent R, then move z up to grandparent and repeat. Case 4: uncle is black and z is the same-side child as parent (LL or RR) — recolor parent B, grandparent R, single-rotate grandparent. Case 5: uncle is black and z is the opposite-side child (LR or RL) — rotate parent first to reduce to case 4, then apply case 4. Each step is labeled with the case so you can follow the textbook.",
      },
      {
        q: "What are the delete fix-up cases (the notoriously hard part)?",
        a: "When a black node is removed, the black-height of one subtree drops by 1 — a 'double-black' violation. Six cases resolve it: (1) x is root — done. (2) Sibling is red — recolor sibling B, parent R, rotate parent, then fall through. (3) Sibling is black with both nieces black — recolor sibling red, move up. (4) Sibling is black, near niece red, far niece black — recolor near niece B, sibling R, rotate sibling to reduce to case 5. (5) Sibling is black, far niece red — sibling takes parent's color, parent B, far niece B, rotate parent. (6) Simple splice for at-most-one-child nodes. Each case is labeled and animated so the double-black resolution becomes visible.",
      },
      {
        q: "What extra features does this tool have versus other RB tree visualizers?",
        a: "(1) Insert / delete with full CLRS fix-up — every recolor and rotation animated and labeled by case. (2) Insert cases 1-5 (root, parent-black, uncle-red, uncle-black LL/RR, uncle-black LR/RL). (3) Delete cases 1-6 (root, sibling-red, sibling-black-both-nieces, sibling-black-near-niece, sibling-black-far-niece, splice). (4) Live five-property checklist with pass/fail after every step. (5) Per-node red/black coloring. (6) Black-height display. (7) In-order traversal with synchronized highlighting. (8) Bulk insert from a list. (9) Random-tree and sorted-input presets. (10) Reingold-Tilford-style SVG layout. (11) Step / play / pause / speed controls with reverse-step fidelity. (12) Rotation + recolor statistics per operation. (13) History (localStorage, last 20). (14) Shareable URL encoding the entire tree state. (15) Color legend. 100% client-side — no uploads, no ads.",
      },
    ],
  },
  status: "done",
};
