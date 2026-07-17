import { describe, it, expect, beforeEach } from "vitest";
import {
  STOP_WORDS,
  INTENT_SIGNALS,
  parseKeywords,
  dedupKeywords,
  findHeadTerm,
  classifyIntent,
  groupByCommonWord,
  groupByIntent,
  group,
  renderCsv,
  renderJson,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
} from "./logic";

beforeEach(() => {
  const store: Record<string, string> = {};
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => {
      store[k] = v;
    },
    removeItem: (k: string) => {
      delete store[k];
    },
    clear: () => {
      for (const k of Object.keys(store)) delete store[k];
    },
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() {
      return Object.keys(store).length;
    },
  };
});

describe("keyword-grouping-tool parseKeywords", () => {
  it("parses newline-separated", () => {
    expect(parseKeywords("SEO\nMarketing")).toEqual(["seo", "marketing"]);
  });
  it("parses comma-separated", () => {
    expect(parseKeywords("SEO, Marketing")).toEqual(["seo", "marketing"]);
  });
  it("lowercases", () => {
    expect(parseKeywords("SEO Tools")).toEqual(["seo tools"]);
  });
  it("skips blanks", () => {
    expect(parseKeywords("a\n\nb")).toEqual(["a", "b"]);
  });
  it("returns empty for empty", () => {
    expect(parseKeywords("")).toEqual([]);
  });
});

describe("keyword-grouping-tool dedupKeywords", () => {
  it("removes dups case-insensitive", () => {
    const { unique, removed } = dedupKeywords(["SEO", "seo", "Marketing"]);
    expect(unique).toEqual(["seo", "marketing"]);
    expect(removed).toBe(1);
  });
  it("collapses whitespace", () => {
    const { unique } = dedupKeywords(["seo  tools", "seo tools"]);
    expect(unique).toHaveLength(1);
  });
});

describe("keyword-grouping-tool findHeadTerm", () => {
  it("returns first non-stop word", () => {
    expect(findHeadTerm("the best seo tools", true)).toBe("seo");
  });
  it("returns first word when stop words off", () => {
    expect(findHeadTerm("the best seo tools", false)).toBe("the");
  });
  it("returns first word if all stop words", () => {
    expect(findHeadTerm("the of a", true)).toBe("the");
  });
  it("returns empty for empty input", () => {
    expect(findHeadTerm("", true)).toBe("");
  });
});

describe("keyword-grouping-tool classifyIntent", () => {
  it("classifies informational", () => {
    expect(classifyIntent("how to do seo")).toBe("informational");
    expect(classifyIntent("what is seo")).toBe("informational");
  });
  it("classifies transactional", () => {
    expect(classifyIntent("best seo tools")).toBe("transactional");
    expect(classifyIntent("buy seo tools")).toBe("transactional");
  });
  it("classifies navigational", () => {
    expect(classifyIntent("ahrefs login")).toBe("navigational");
  });
  it("classifies other when no signals", () => {
    expect(classifyIntent("seo")).toBe("other");
  });
  it("returns other for empty", () => {
    expect(classifyIntent("")).toBe("other");
  });
});

describe("keyword-grouping-tool groupByCommonWord", () => {
  it("groups by head term", () => {
    const clusters = groupByCommonWord(
      ["seo tools", "seo guide", "seo tips", "marketing strategy"],
      { minClusterSize: 2, removeStopWords: true },
    );
    const seo = clusters.find((c) => c.name === "seo");
    expect(seo).toBeDefined();
    expect(seo!.count).toBe(3);
  });
  it("respects minClusterSize", () => {
    const clusters = groupByCommonWord(
      ["x a", "x b", "y c"],
      { minClusterSize: 2, removeStopWords: true },
    );
    // "x" cluster has 2 entries; "y" has 1 (filtered out)
    expect(clusters).toHaveLength(1);
    expect(clusters[0].name).toBe("x");
  });
  it("sorts by count desc", () => {
    const clusters = groupByCommonWord(
      ["a", "a", "a", "b", "b"],
      { minClusterSize: 1, removeStopWords: true },
    );
    expect(clusters[0].count).toBeGreaterThanOrEqual(clusters[1].count);
  });
  it("assigns dominant intent", () => {
    const clusters = groupByCommonWord(
      ["seo how", "seo buy", "seo"],
      { minClusterSize: 1, removeStopWords: true },
    );
    expect(clusters[0].intent).toBeTruthy();
  });
});

describe("keyword-grouping-tool groupByIntent", () => {
  it("groups into intent buckets", () => {
    const clusters = groupByIntent(["how to seo", "buy seo", "ahrefs login"]);
    const intents = clusters.map((c) => c.intent);
    expect(intents).toContain("informational");
    expect(intents).toContain("transactional");
    expect(intents).toContain("navigational");
  });
  it("sorts by count desc", () => {
    const clusters = groupByIntent(["how to x", "what is y", "buy z"]);
    // informational should be largest (2)
    expect(clusters[0].intent).toBe("informational");
  });
});

describe("keyword-grouping-tool group", () => {
  it("runs common-word strategy by default", () => {
    const r = group(
      ["seo tools", "seo guide", "seo tips", "marketing"],
      { strategy: "common-word", minClusterSize: 2, removeStopWords: true },
    );
    expect(r.clusters.length).toBeGreaterThan(0);
    expect(r.totalKeywords).toBe(4);
  });
  it("runs intent strategy", () => {
    const r = group(
      ["how to seo", "buy seo"],
      { strategy: "intent", minClusterSize: 1, removeStopWords: true },
    );
    expect(r.clusters.some((c) => c.intent === "informational")).toBe(true);
    expect(r.clusters.some((c) => c.intent === "transactional")).toBe(true);
  });
  it("dedups before grouping", () => {
    const r = group(
      ["seo", "SEO", "marketing"],
      { strategy: "common-word", minClusterSize: 1, removeStopWords: true },
    );
    expect(r.duplicatesRemoved).toBe(1);
    expect(r.totalKeywords).toBe(2);
  });
  it("computes intentCounts", () => {
    const r = group(
      ["how to seo", "buy seo", "ahrefs login"],
      { strategy: "common-word", minClusterSize: 1, removeStopWords: true },
    );
    expect(r.intentCounts.informational).toBe(1);
    expect(r.intentCounts.transactional).toBe(1);
    expect(r.intentCounts.navigational).toBe(1);
  });
});

describe("keyword-grouping-tool renderCsv", () => {
  it("renders CSV header", () => {
    const csv = renderCsv(group(["seo"], { strategy: "common-word", minClusterSize: 1, removeStopWords: true }));
    expect(csv).toContain("cluster,intent,keyword");
  });
  it("escapes commas in keywords", () => {
    const csv = renderCsv(group(["a,b"], { strategy: "common-word", minClusterSize: 1, removeStopWords: true }));
    expect(csv).toContain('"a,b"');
  });
});

describe("keyword-grouping-tool renderJson", () => {
  it("renders valid JSON", () => {
    const json = renderJson(group(["seo"], { strategy: "common-word", minClusterSize: 1, removeStopWords: true }));
    const parsed = JSON.parse(json);
    expect(parsed.totalKeywords).toBe(1);
    expect(Array.isArray(parsed.clusters)).toBe(true);
  });
  it("includes intentCounts", () => {
    const json = renderJson(group(["how to seo"], { strategy: "common-word", minClusterSize: 1, removeStopWords: true }));
    const parsed = JSON.parse(json);
    expect(parsed.intentCounts.informational).toBe(1);
  });
});

describe("keyword-grouping-tool history", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, totalKeywords: 10, clusterCount: 3, strategy: "common-word" });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, totalKeywords: 1, clusterCount: 1, strategy: "intent" });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, totalKeywords: 1, clusterCount: 1, strategy: "intent" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("keyword-grouping-tool shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      keywords: "seo\nmarketing",
      options: { strategy: "common-word", minClusterSize: 2, removeStopWords: true },
    });
    expect(url).toContain("keywords=");
    expect(url).toContain("strategy=common-word");
    expect(url).toContain("minClusterSize=2");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("keywords=seo%2Cmarketing&strategy=intent&minClusterSize=3&removeStopWords=0");
    expect(p.keywords).toBe("seo,marketing");
    expect(p.options.strategy).toBe("intent");
    expect(p.options.minClusterSize).toBe(3);
    expect(p.options.removeStopWords).toBe(false);
  });
  it("handles empty hash with defaults", () => {
    const p = parseShareUrl("");
    expect(p.keywords).toBe("");
    expect(p.options.strategy).toBe("common-word");
    expect(p.options.minClusterSize).toBe(2);
    expect(p.options.removeStopWords).toBe(true);
  });
  it("omits empty keywords", () => {
    const url = buildShareUrl({
      keywords: "",
      options: { strategy: "common-word", minClusterSize: 2, removeStopWords: true },
    });
    expect(url).not.toContain("keywords=");
  });
});

describe("keyword-grouping-tool constants", () => {
  it("STOP_WORDS contains common words", () => {
    expect(STOP_WORDS.has("the")).toBe(true);
    expect(STOP_WORDS.has("a")).toBe(true);
  });
  it("INTENT_SIGNALS has all four intents", () => {
    expect(INTENT_SIGNALS.informational).toBeDefined();
    expect(INTENT_SIGNALS.transactional).toBeDefined();
    expect(INTENT_SIGNALS.navigational).toBeDefined();
    expect(INTENT_SIGNALS.other).toEqual([]);
  });
});
