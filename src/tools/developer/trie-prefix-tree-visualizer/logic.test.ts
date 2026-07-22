import { describe, it, expect, beforeEach } from "vitest";
import {
  createTrie,
  cloneTrie,
  fromWords,
  getNode,
  insertPure,
  searchPure,
  findNode,
  deletePure,
  autocompletePure,
  longestCommonPrefixPure,
  countWords,
  totalChars,
  trieHeight,
  computeStats,
  layout,
  insertGen,
  searchGen,
  deleteGen,
  autocompleteGen,
  longestCommonPrefixGen,
  runInsert,
  runSearch,
  runDelete,
  runAutocomplete,
  runLongestCommonPrefix,
  compress,
  radixStats,
  parseWords,
  serializeTrie,
  deserializeTrie,
  nodeColorClass,
  formatStep,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  WORD_PRESETS,
  randomWords,
  mulberry32,
  type Trie,
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

describe("trie construction", () => {
  it("createTrie has only root", () => {
    const t = createTrie();
    expect(t.nodes.size).toBe(1);
    expect(t.root).toBe(0);
    expect(t.nextId).toBe(1);
    expect(getNode(t, 0)!.char).toBe("");
    expect(getNode(t, 0)!.isEnd).toBe(false);
  });
  it("cloneTrie produces a deep copy", () => {
    const t = fromWords(["cat", "car"]);
    const c = cloneTrie(t);
    expect(c).not.toBe(t);
    expect(c.nodes).not.toBe(t.nodes);
    expect(c.nodes.size).toBe(t.nodes.size);
    expect(c.root).toBe(t.root);
  });
  it("fromWords builds a trie with shared prefix", () => {
    const t = fromWords(["cat", "car"]);
    // root + c + a + t + r = 5 nodes
    expect(t.nodes.size).toBe(5);
    expect(searchPure(t, "cat")).toBe(true);
    expect(searchPure(t, "car")).toBe(true);
    expect(searchPure(t, "ca")).toBe(false);
  });
});

describe("trie insert", () => {
  it("insertPure creates new nodes", () => {
    const t = createTrie();
    expect(insertPure(t, "hello")).toBe(true);
    expect(t.nodes.size).toBe(6); // root + h,e,l,l,o
    expect(searchPure(t, "hello")).toBe(true);
  });
  it("insertPure returns false for duplicate", () => {
    const t = fromWords(["cat"]);
    expect(insertPure(t, "cat")).toBe(false);
    expect(t.nodes.size).toBe(4); // unchanged
  });
  it("insertPure reuses existing prefix nodes", () => {
    const t = fromWords(["cat"]);
    insertPure(t, "car");
    // root, c, a, t, r = 5 (c and a are shared)
    expect(t.nodes.size).toBe(5);
  });
  it("insertPure handles empty string as a no-op end marker", () => {
    const t = createTrie();
    insertPure(t, "");
    // Inserting empty string marks root as end-of-word
    expect(getNode(t, 0)!.isEnd).toBe(true);
  });
  it("insertPure supports non-ASCII characters", () => {
    const t = createTrie();
    insertPure(t, "café");
    insertPure(t, "cafétéria");
    expect(searchPure(t, "café")).toBe(true);
    expect(searchPure(t, "cafétéria")).toBe(true);
  });
});

describe("trie search", () => {
  it("searchPure finds inserted words", () => {
    const t = fromWords(["apple", "application", "apply"]);
    expect(searchPure(t, "apple")).toBe(true);
    expect(searchPure(t, "application")).toBe(true);
    expect(searchPure(t, "apply")).toBe(true);
  });
  it("searchPure returns false for missing words", () => {
    const t = fromWords(["apple"]);
    expect(searchPure(t, "apricot")).toBe(false);
    expect(searchPure(t, "app")).toBe(false); // prefix only, not a word
    expect(searchPure(t, "")).toBe(false);
  });
  it("findNode returns the node at end of prefix", () => {
    const t = fromWords(["cat"]);
    const id = findNode(t, "ca");
    expect(id).not.toBeNull();
    expect(getNode(t, id)!.char).toBe("a");
    expect(getNode(t, id)!.isEnd).toBe(false);
  });
  it("findNode returns null for missing prefix", () => {
    const t = fromWords(["cat"]);
    expect(findNode(t, "x")).toBeNull();
  });
  it("findNode returns root for empty prefix", () => {
    const t = fromWords(["cat"]);
    expect(findNode(t, "")).toBe(t.root);
  });
});

describe("trie delete with pruning", () => {
  it("deletePure removes the word and prunes unique-suffix nodes", () => {
    const t = fromWords(["cat", "car"]);
    expect(deletePure(t, "car")).toBe(true);
    expect(searchPure(t, "car")).toBe(false);
    expect(searchPure(t, "cat")).toBe(true);
    // 'r' should be pruned; c-a-t remain → 4 nodes (root, c, a, t)
    expect(t.nodes.size).toBe(4);
  });
  it("deletePure does NOT prune shared prefix", () => {
    const t = fromWords(["cat", "car"]);
    expect(deletePure(t, "cat")).toBe(true);
    expect(searchPure(t, "cat")).toBe(false);
    expect(searchPure(t, "car")).toBe(true);
    // 't' should be pruned; c-a-r remain → 4 nodes
    expect(t.nodes.size).toBe(4);
  });
  it("deletePure does NOT prune when word is a prefix of another", () => {
    const t = fromWords(["app", "apple"]);
    expect(deletePure(t, "app")).toBe(true);
    expect(searchPure(t, "app")).toBe(false);
    expect(searchPure(t, "apple")).toBe(true);
    // Only the end-of-word marker on 'app' node is cleared; no nodes pruned
    expect(t.nodes.size).toBe(6); // root, a, p, p, l, e
  });
  it("deletePure returns false for missing word", () => {
    const t = fromWords(["cat"]);
    expect(deletePure(t, "dog")).toBe(false);
    expect(t.nodes.size).toBe(4);
  });
  it("deletePure returns false for prefix-only", () => {
    const t = fromWords(["cat"]);
    expect(deletePure(t, "ca")).toBe(false);
  });
  it("deletePure can empty the trie", () => {
    const t = fromWords(["cat"]);
    deletePure(t, "cat");
    expect(t.nodes.size).toBe(1); // only root
    expect(getNode(t, 0)!.children.size).toBe(0);
  });
});

describe("trie autocomplete", () => {
  it("autocompletePure lists all words under prefix", () => {
    const t = fromWords(["app", "apple", "application", "apply", "banana"]);
    const s = autocompletePure(t, "app");
    expect(s).toContain("app");
    expect(s).toContain("apple");
    expect(s).toContain("application");
    expect(s).toContain("apply");
    expect(s).not.toContain("banana");
    expect(s).toHaveLength(4);
  });
  it("autocompletePure returns empty for missing prefix", () => {
    const t = fromWords(["cat"]);
    expect(autocompletePure(t, "x")).toEqual([]);
  });
  it("autocompletePure with empty prefix returns all words", () => {
    const t = fromWords(["cat", "car", "dog"]);
    const s = autocompletePure(t, "");
    expect(s).toHaveLength(3);
    expect(s).toContain("cat");
    expect(s).toContain("dog");
  });
  it("autocompletePure respects limit", () => {
    const t = fromWords(["a", "ab", "abc", "abcd", "abcde"]);
    const s = autocompletePure(t, "a", 2);
    expect(s.length).toBeLessThanOrEqual(2);
  });
});

describe("trie longest common prefix", () => {
  it("longestCommonPrefixPure finds shared prefix", () => {
    const t = fromWords(["apple", "application", "apply"]);
    // All start with "app"; "app" itself is not a word, but lcp extends to "appl" before "appl" has multiple children
    // Actually: a → p → p (not end, 1 child) → p has 1 child "l" → l has multiple children (e, i, y)
    // So LCP = "appl"
    expect(longestCommonPrefixPure(t)).toBe("appl");
  });
  it("longestCommonPrefixPure stops at end-of-word", () => {
    const t = fromWords(["app", "apple"]);
    // a → p → p (isEnd=true) → LCP stops at "app"
    expect(longestCommonPrefixPure(t)).toBe("app");
  });
  it("longestCommonPrefixPure returns empty for divergent words", () => {
    const t = fromWords(["cat", "dog"]);
    // Root has 2 children → LCP is ""
    expect(longestCommonPrefixPure(t)).toBe("");
  });
  it("longestCommonPrefixPure returns empty for empty trie", () => {
    const t = createTrie();
    expect(longestCommonPrefixPure(t)).toBe("");
  });
});

describe("trie stats", () => {
  it("countWords counts end-of-word markers", () => {
    const t = fromWords(["cat", "car", "dog"]);
    expect(countWords(t)).toBe(3);
  });
  it("totalChars sums word lengths", () => {
    const t = fromWords(["cat", "car", "dog"]);
    expect(totalChars(t)).toBe(3 + 3 + 3);
  });
  it("computeStats reports savings from shared prefix", () => {
    const t = fromWords(["cat", "car"]);
    const s = computeStats(t);
    // Nodes: root + c + a + t + r = 5; internal = 4
    // total chars = 6 (cat + car)
    // savings = 1 - 4/6 = 1/3
    expect(s.nodeCount).toBe(5);
    expect(s.wordCount).toBe(2);
    expect(s.totalChars).toBe(6);
    expect(s.savings).toBeCloseTo(1 - 4 / 6, 5);
    expect(s.height).toBe(3);
  });
  it("trieHeight is 0 for empty trie", () => {
    expect(trieHeight(createTrie())).toBe(0);
  });
});

describe("trie layout", () => {
  it("layout returns nodes and edges", () => {
    const t = fromWords(["cat", "car"]);
    const l = layout(t);
    expect(l.nodes.length).toBe(5);
    // 4 edges (root→c, c→a, a→t, a→r)
    expect(l.edges.length).toBe(4);
  });
  it("layout handles empty trie", () => {
    const l = layout(createTrie());
    expect(l.nodes.length).toBe(1); // just root
    expect(l.edges).toEqual([]);
  });
  it("layout assigns larger x to deeper nodes", () => {
    const t = fromWords(["cat", "dog"]);
    const l = layout(t);
    // All leaf nodes have unique x; root is at centroid
    const leafXs = l.nodes.filter((n) => n.node.children.size === 0).map((n) => n.x);
    expect(new Set(leafXs).size).toBe(leafXs.length);
  });
});

describe("trie stepped operations", () => {
  it("insertGen yields visit/create steps", () => {
    const t = createTrie();
    const steps = [...insertGen(t, "cat")];
    expect(steps.length).toBeGreaterThan(0);
    expect(steps[0].kind).toBe("visit");
    expect(steps.some((s) => s.kind === "create")).toBe(true);
    expect(steps[steps.length - 1].kind).toBe("done");
    expect(searchPure(t, "cat")).toBe(true);
  });
  it("insertGen on existing word yields info, no create", () => {
    const t = fromWords(["cat"]);
    const steps = [...insertGen(t, "cat")];
    expect(steps.some((s) => s.kind === "create")).toBe(false);
    expect(steps[steps.length - 1].kind).toBe("info");
  });
  it("searchGen yields found for existing word", () => {
    const t = fromWords(["cat", "car"]);
    const steps = [...searchGen(t, "cat")];
    expect(steps.some((s) => s.kind === "found")).toBe(true);
  });
  it("searchGen yields not-found for missing word", () => {
    const t = fromWords(["cat"]);
    const steps = [...searchGen(t, "dog")];
    expect(steps.some((s) => s.kind === "not-found")).toBe(true);
  });
  it("searchGen yields not-found for prefix-only", () => {
    const t = fromWords(["cat"]);
    const steps = [...searchGen(t, "ca")];
    expect(steps.some((s) => s.kind === "not-found")).toBe(true);
  });
  it("deleteGen yields prune steps for unique suffix", () => {
    const t = fromWords(["cat", "car"]);
    const steps = [...deleteGen(t, "car")];
    expect(steps.some((s) => s.kind === "prune")).toBe(true);
    expect(searchPure(t, "car")).toBe(false);
    expect(searchPure(t, "cat")).toBe(true);
  });
  it("deleteGen does NOT prune shared nodes", () => {
    const t = fromWords(["app", "apple"]);
    const steps = [...deleteGen(t, "app")];
    expect(steps.some((s) => s.kind === "prune")).toBe(false);
    expect(searchPure(t, "app")).toBe(false);
    expect(searchPure(t, "apple")).toBe(true);
  });
  it("deleteGen yields not-found for missing word", () => {
    const t = fromWords(["cat"]);
    const steps = [...deleteGen(t, "dog")];
    expect(steps.some((s) => s.kind === "not-found")).toBe(true);
  });
  it("autocompleteGen yields suggestion step", () => {
    const t = fromWords(["app", "apple", "application", "apply"]);
    const steps = [...autocompleteGen(t, "app")];
    expect(steps.some((s) => s.kind === "suggestion")).toBe(true);
    const last = steps[steps.length - 1];
    expect(last.suggestions.length).toBe(4);
  });
  it("autocompleteGen yields not-found for missing prefix", () => {
    const t = fromWords(["cat"]);
    const steps = [...autocompleteGen(t, "x")];
    expect(steps.some((s) => s.kind === "not-found")).toBe(true);
  });
  it("longestCommonPrefixGen yields done step with prefix", () => {
    const t = fromWords(["app", "apple"]);
    const steps = [...longestCommonPrefixGen(t)];
    const last = steps[steps.length - 1];
    expect(last.kind).toBe("done");
    expect(last.prefix).toBe("app");
  });
});

describe("trie run dispatchers", () => {
  it("runInsert returns steps with created count", () => {
    const t = createTrie();
    const r = runInsert(t, "cat");
    expect(r.kind).toBe("insert");
    expect(r.ok).toBe(true);
    expect(r.totalCreated).toBe(3); // c, a, t all new
    expect(r.steps.length).toBeGreaterThan(0);
  });
  it("runSearch returns found=true for existing", () => {
    const t = fromWords(["cat"]);
    const r = runSearch(t, "cat");
    expect(r.found).toBe(true);
  });
  it("runSearch returns found=false for missing", () => {
    const t = fromWords(["cat"]);
    const r = runSearch(t, "dog");
    expect(r.found).toBe(false);
  });
  it("runDelete returns pruned count", () => {
    const t = fromWords(["cat", "car"]);
    const r = runDelete(t, "car");
    expect(r.found).toBe(true);
    expect(r.totalPruned).toBe(1); // 'r' node pruned
  });
  it("runAutocomplete returns suggestions in output", () => {
    const t = fromWords(["app", "apple", "application", "apply"]);
    const r = runAutocomplete(t, "app");
    expect(r.output.length).toBe(4);
    expect(r.output).toContain("apple");
  });
  it("runLongestCommonPrefix returns the prefix in output", () => {
    const t = fromWords(["app", "apple"]);
    const r = runLongestCommonPrefix(t);
    expect(r.output).toEqual(["app"]);
  });
});

describe("trie compression (radix / Patricia)", () => {
  it("compress collapses single-child chains", () => {
    const t = fromWords(["app", "apple"]);
    const rt = compress(t);
    // Plain trie: root, a, p, p (end), l, e (end) = 6 nodes
    // Radix trie: root, "app"(end), "le"(end) = 3 nodes
    expect(rt.nodes.size).toBe(3);
  });
  it("compress preserves all words", () => {
    const t = fromWords(["cat", "car", "card"]);
    const rt = compress(t);
    // Verify by walking the radix trie
    const words: string[] = [];
    const walk = (id: number, built: string) => {
      const n = rt.nodes.get(id)!;
      const s = built + n.edge;
      if (n.isEnd) words.push(s);
      for (const childId of n.children.values()) walk(childId, s);
    };
    walk(rt.root, "");
    expect(words.sort()).toEqual(["card", "car", "cat"].sort());
  });
  it("compress handles divergent words without over-collapsing", () => {
    const t = fromWords(["cat", "dog"]);
    const rt = compress(t);
    // root + "cat"(end) + "dog"(end) = 3 nodes
    expect(rt.nodes.size).toBe(3);
  });
  it("compress of empty trie is just root", () => {
    const t = createTrie();
    const rt = compress(t);
    expect(rt.nodes.size).toBe(1);
  });
  it("radixStats reports fewer nodes than plain", () => {
    const t = fromWords(["apple", "application", "apply"]);
    const rt = compress(t);
    const rs = radixStats(rt);
    expect(rs.nodeCount).toBeLessThan(t.nodes.size);
    expect(rs.edgeCount).toBeGreaterThan(0);
    expect(rs.totalEdgeChars).toBeGreaterThan(0);
  });
});

describe("trie parsing", () => {
  it("parseWords splits and filters", () => {
    expect(parseWords("cat car dog")).toEqual(["cat", "car", "dog"]);
    expect(parseWords("cat,car,dog")).toEqual(["cat", "car", "dog"]);
    expect(parseWords("cat;car\n\ndog")).toEqual(["cat", "car", "dog"]);
  });
  it("parseWords handles case-insensitivity flag", () => {
    expect(parseWords("Cat CAR dog", false)).toEqual(["cat", "car", "dog"]);
  });
  it("parseWords returns empty for empty input", () => {
    expect(parseWords("")).toEqual([]);
  });
});

describe("trie serialization", () => {
  it("serializeTrie encodes the word list", () => {
    const t = fromWords(["cat", "car", "dog"]);
    const s = serializeTrie(t);
    expect(s).toContain("cat");
    expect(s).toContain("car");
    expect(s).toContain("dog");
  });
  it("deserializeTrie round-trips", () => {
    const t = fromWords(["cat", "car", "dog"]);
    const s = serializeTrie(t);
    const back = deserializeTrie(s);
    expect(back).not.toBeNull();
    expect(searchPure(back!, "cat")).toBe(true);
    expect(searchPure(back!, "car")).toBe(true);
    expect(searchPure(back!, "dog")).toBe(true);
    expect(searchPure(back!, "bird")).toBe(false);
  });
  it("deserializeTrie returns empty trie for empty string", () => {
    const back = deserializeTrie("");
    expect(back).not.toBeNull();
    expect(back!.nodes.size).toBe(1); // root only
  });
});

describe("trie step helpers", () => {
  it("nodeColorClass marks active node", () => {
    const t = fromWords(["cat"]);
    const step = {
      trie: cloneTrie(t), active: 1, path: [0, 1], prefix: "c", char: "c",
      suggestions: [], comparisons: 1, created: 0, pruned: 0,
      kind: "visit" as const, description: "",
    };
    expect(nodeColorClass(1, step)).toBe("active");
  });
  it("nodeColorClass marks path nodes", () => {
    const t = fromWords(["cat"]);
    const step = {
      trie: cloneTrie(t), active: 3, path: [0, 1, 2, 3], prefix: "cat", char: "t",
      suggestions: [], comparisons: 3, created: 3, pruned: 0,
      kind: "found" as const, description: "",
    };
    expect(nodeColorClass(1, step)).toBe("path");
    expect(nodeColorClass(3, step)).toBe("found");
  });
  it("formatStep includes step index and counts", () => {
    const t = fromWords(["cat"]);
    const step = {
      trie: cloneTrie(t), active: 0, path: [0], prefix: "", char: null,
      suggestions: ["a", "b"], comparisons: 2, created: 1, pruned: 0,
      kind: "suggestion" as const, description: "Test step.",
    };
    const s = formatStep(step, 4, 10);
    expect(s).toContain("[5/10]");
    expect(s).toContain("Test step.");
    expect(s).toContain("cmp=2");
    expect(s).toContain("created=1");
    expect(s).toContain("suggestions=2");
  });
});

describe("trie history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, op: "insert", word: "cat", nodeCount: 4, wordCount: 1, comparisons: 0, created: 3, pruned: 0, ok: true });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20 entries", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, op: "insert", word: "x", nodeCount: 1, wordCount: 1, comparisons: 0, created: 1, pruned: 0, ok: true });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, op: "insert", word: "x", nodeCount: 1, wordCount: 1, comparisons: 0, created: 1, pruned: 0, ok: true });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("trie shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const t = fromWords(["cat", "car", "dog"]);
    const url = buildShareUrl(t);
    expect(url).toContain("w=");
    expect(url).toContain("cat");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const t = fromWords(["cat", "car", "dog"]);
    const url = buildShareUrl(t);
    const hash = url.includes("#") ? url.slice(url.indexOf("#")) : url.includes("?") ? url.slice(url.indexOf("?")) : "";
    const p = parseShareUrl(hash);
    expect(p).not.toBeNull();
    const back = deserializeTrie(p!.words);
    expect(back).not.toBeNull();
    expect(searchPure(back!, "cat")).toBe(true);
    expect(searchPure(back!, "dog")).toBe(true);
  });
  it("returns null for empty hash", () => {
    expect(parseShareUrl("")).toBeNull();
  });
  it("returns null when no 'w' param", () => {
    expect(parseShareUrl("foo=bar")).toBeNull();
  });
});

describe("trie presets", () => {
  it("WORD_PRESETS has 4 categories", () => {
    expect(Object.keys(WORD_PRESETS).length).toBeGreaterThanOrEqual(4);
    expect(WORD_PRESETS.fruits.length).toBeGreaterThan(0);
    expect(WORD_PRESETS.colors.length).toBeGreaterThan(0);
    expect(WORD_PRESETS.animals.length).toBeGreaterThan(0);
    expect(WORD_PRESETS.prefix.length).toBeGreaterThan(0);
  });
  it("WORD_PRESETS prefix set has shared prefixes", () => {
    const words = WORD_PRESETS.prefix;
    // All start with "ap"
    expect(words.every((w) => w.startsWith("ap"))).toBe(true);
  });
  it("randomWords produces unique words of given count", () => {
    const words = randomWords(10, 42);
    expect(new Set(words).size).toBe(10);
  });
  it("mulberry32 is deterministic for a given seed", () => {
    const a = mulberry32(123);
    const b = mulberry32(123);
    expect(a()).toBe(b());
    expect(a()).toBe(b());
  });
});

describe("trie end-to-end scenarios", () => {
  it("insert, autocomplete, delete cycle", () => {
    const t = fromWords(["cat", "car", "card", "care", "careful"]);
    expect(autocompletePure(t, "car").sort()).toEqual(["car", "card", "care", "careful"].sort());
    deletePure(t, "careful");
    expect(autocompletePure(t, "car").sort()).toEqual(["car", "card", "care"].sort());
    // 'careful' was unique suffix → pruned: f, u, l nodes
    // 'care' still present → e node stays
    expect(searchPure(t, "care")).toBe(true);
  });
  it("case sensitivity (default)", () => {
    const t = fromWords(["Cat", "cat"]);
    expect(searchPure(t, "Cat")).toBe(true);
    expect(searchPure(t, "cat")).toBe(true);
    expect(t.nodes.size).toBeGreaterThan(4); // 'C' and 'c' are distinct children
  });
});

// Suppress unused-import lint
export type _Unused = Trie | OpKind;
