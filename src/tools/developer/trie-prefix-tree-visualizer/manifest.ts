/**
 * Trie (Prefix Tree) Visualizer — Tool Manifest.
 * Tool #407 — Category 4 (Developer & Code).
 *
 * Pure-JS trie (map-of-children) with step-by-step animation of insert,
 * search, delete (with node pruning), and autocomplete. End-of-word
 * markers, shared-prefix highlighting, longest-common-prefix display,
 * live node-count / word-count / space-savings metrics, optional
 * compressed (radix / Patricia) trie view, character-edge labels, bulk
 * insert, step / reverse / play / speed controls, shareable state URL.
 * 100% client-side.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "trie-prefix-tree-visualizer",
  name: "Trie (Prefix Tree) Visualizer",
  description:
    "Step-by-step visualization of a Trie (prefix tree) — insert, search, delete (with node pruning), and autocomplete — with animated character path, end-of-word markers, and shared-prefix highlighting. Live node count, word count, and space-savings metrics showing how shared prefixes save memory. Longest-common-prefix display. Optional compressed (radix / Patricia) trie view. Bulk insert from a word list. Step / reverse / play / speed controls and shareable state URLs. 100% client-side.",
  category: "developer",
  keywords: [
    "trie visualizer", "prefix tree visualization", "autocomplete trie",
    "radix tree visualizer", "trie insert search delete", "patricia trie",
    "compressed trie", "prefix matching", "trie node count",
    "trie online tool", "word autocomplete", "trie edge labels",
  ],
  icon: "git-fork",
  requiresNetwork: false,
  seo: {
    title: "Trie (Prefix Tree) Visualizer — Insert, Search, Delete, Autocomplete | UnQTools",
    faq: [
      {
        q: "How does the trie visualizer work?",
        a: "Every operation (insert, search, delete, autocomplete) is implemented as a JavaScript generator function that yields a Step on each character visited. Each step carries a full snapshot of the trie (as a serializable node list with parent / children links), the active node, the character path traversed so far, and the running output — so the UI can step forward and backward without re-running. The play head animates through the steps at your chosen speed, color-coding the active node, the path from root, end-of-word markers, and the autocomplete suggestions.",
      },
      {
        q: "How does delete work and how is node pruning animated?",
        a: "Delete walks down the trie following each character. If the word isn't found, no change is made. If found, the end-of-word marker is cleared first. Then on the way back up, any node that has no remaining children AND is not itself an end-of-word marker is pruned (removed from its parent's children map) — this reclaims the space that was only needed for the deleted word. The visualizer walks the path, highlights each character, clears the end-of-word badge, then animates each prune from leaf back up to the longest shared prefix.",
      },
      {
        q: "What are the space-saving benefits of a trie and how are they shown?",
        a: "A trie shares prefix nodes across words: 'cat', 'car', and 'card' share the c-a-r prefix, so 5 characters of input produce 6 nodes total (c, a, r/t, d) instead of 3+3+4=10 character cells. The metrics panel shows live node count, word count, total characters stored (sum of word lengths), and the savings ratio (1 − nodes / total chars). When two unrelated words share a prefix by accident ('app' + 'apple') you can see the shared branch in the tree — and the compressed (radix / Patricia) view collapses single-child chains into edge labels to show even more savings.",
      },
      {
        q: "What is the difference between the plain trie and the compressed (radix / Patricia) view?",
        a: "A plain trie stores one character per edge — simple but verbose for long single-child chains. A compressed (radix / Patricia) trie collapses any chain of single-child nodes into a single edge labeled with the full substring. The two views are functionally equivalent (same set of words, same lookup complexity) but the radix view uses fewer nodes and edges. The visualizer renders both side-by-side so you can compare node counts and see exactly which chains got compressed.",
      },
      {
        q: "What extra features does this tool have versus other trie visualizers?",
        a: "(1) Insert / search / delete (with node pruning) animated character-by-character. (2) Autocomplete: list every word under a prefix. (3) End-of-word markers and shared-prefix highlighting. (4) Longest-common-prefix display. (5) Compressed (radix / Patricia) trie view side-by-side. (6) Live node count, word count, total characters stored, and space-savings ratio. (7) Bulk insert from a word list (comma / space / newline separated). (8) Case sensitivity toggle and non-ASCII support. (9) Step / play / pause / speed controls with reverse-step fidelity. (10) Word-list presets (fruits, colors, animals). (11) History (localStorage, last 20). (12) Shareable URL encoding the entire word list. (13) Color legend. (14) Export word list as text. 100% client-side — no uploads, no ads.",
      },
    ],
  },
  status: "done",
};
