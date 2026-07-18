import { describe, it, expect, beforeEach } from "vitest";
import {
  AUDIENCE_PRESETS,
  SUBTOPIC_TEMPLATES,
  AUDIENCE_TEMPLATE_SELECTION,
  normalizeTopic,
  titleCase,
  parsePillarAndClusters,
  parseTargetKeywords,
  generateClusterTitle,
  generateSubtopics,
  getWordCountForAudience,
  generateContentBrief,
  generateInternalLinks,
  buildInternalLinkMatrix,
  buildClusterMap,
  buildContentBriefs,
  computeSummaryStats,
  filterByCluster,
  renderText,
  renderCsv,
  splitCsvRow,
  renderClusterMapJson,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type AudienceLevel,
  type ClusterInputs,
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

describe("topic-cluster-builder constants", () => {
  it("has 3 audience presets", () => {
    expect(AUDIENCE_PRESETS).toHaveLength(3);
    expect(AUDIENCE_PRESETS.map((a) => a.value)).toEqual([
      "beginner", "intermediate", "advanced",
    ]);
  });
  it("has correct word counts per audience", () => {
    expect(getWordCountForAudience("beginner")).toBe(800);
    expect(getWordCountForAudience("intermediate")).toBe(1500);
    expect(getWordCountForAudience("advanced")).toBe(2500);
  });
  it("has 6 subtopic templates", () => {
    expect(SUBTOPIC_TEMPLATES).toHaveLength(6);
    expect(SUBTOPIC_TEMPLATES[0]).toBe("What is <cluster>");
    expect(SUBTOPIC_TEMPLATES[5]).toBe("Common <cluster> mistakes");
  });
  it("selects 4 templates per audience", () => {
    expect(AUDIENCE_TEMPLATE_SELECTION.beginner).toHaveLength(4);
    expect(AUDIENCE_TEMPLATE_SELECTION.intermediate).toHaveLength(4);
    expect(AUDIENCE_TEMPLATE_SELECTION.advanced).toHaveLength(4);
  });
  it("beginner selection includes What is + How to + Examples + Mistakes", () => {
    expect(AUDIENCE_TEMPLATE_SELECTION.beginner).toEqual([0, 1, 4, 5]);
  });
  it("intermediate selection includes How to + Best practices + Tools + Mistakes", () => {
    expect(AUDIENCE_TEMPLATE_SELECTION.intermediate).toEqual([1, 2, 3, 5]);
  });
  it("advanced selection includes Best practices + Tools + Examples + Mistakes", () => {
    expect(AUDIENCE_TEMPLATE_SELECTION.advanced).toEqual([2, 3, 4, 5]);
  });
});

describe("topic-cluster-builder normalizeTopic / titleCase", () => {
  it("normalizes whitespace", () => {
    expect(normalizeTopic("  SEO   Basics  ")).toBe("SEO Basics");
  });
  it("handles empty", () => { expect(normalizeTopic("")).toBe(""); });
  it("title-cases a topic", () => {
    expect(titleCase("seo basics")).toBe("Seo Basics");
    expect(titleCase("KEYWORD RESEARCH")).toBe("Keyword Research");
  });
  it("titleCase returns empty for empty", () => {
    expect(titleCase("")).toBe("");
  });
});

describe("topic-cluster-builder parsePillarAndClusters", () => {
  it("parses pillar and newline-separated clusters", () => {
    const { pillar, clusters } = parsePillarAndClusters("SEO", "keyword research\non-page SEO\ntechnical SEO");
    expect(pillar).toBe("SEO");
    expect(clusters).toEqual(["keyword research", "on-page SEO", "technical SEO"]);
  });
  it("parses comma-separated clusters too", () => {
    const { clusters } = parsePillarAndClusters("SEO", "keyword research, on-page SEO, technical SEO");
    expect(clusters).toEqual(["keyword research", "on-page SEO", "technical SEO"]);
  });
  it("trims and skips blanks", () => {
    const { pillar, clusters } = parsePillarAndClusters("  SEO  ", "\n  keyword research  \n\n\n");
    expect(pillar).toBe("SEO");
    expect(clusters).toEqual(["keyword research"]);
  });
  it("returns empty pillar for empty input", () => {
    const { pillar, clusters } = parsePillarAndClusters("", "");
    expect(pillar).toBe("");
    expect(clusters).toEqual([]);
  });
});

describe("topic-cluster-builder parseTargetKeywords", () => {
  it("parses cluster,keyword pairs", () => {
    const map = parseTargetKeywords("keyword research,best SEO tools\non-page SEO,on page optimization");
    expect(map.get("keyword research")).toBe("best SEO tools");
    expect(map.get("on-page seo")).toBe("on page optimization");
  });
  it("returns empty map for empty input", () => {
    expect(parseTargetKeywords("").size).toBe(0);
  });
  it("skips lines without comma", () => {
    const map = parseTargetKeywords("no comma here\nkeyword research,best SEO tools");
    expect(map.size).toBe(1);
    expect(map.get("keyword research")).toBe("best SEO tools");
  });
  it("skips blank keyword values", () => {
    const map = parseTargetKeywords("keyword research,");
    expect(map.size).toBe(0);
  });
});

describe("topic-cluster-builder generateClusterTitle", () => {
  it("formats as 'Pillar: Cluster Guide'", () => {
    expect(generateClusterTitle("SEO", "keyword research")).toBe("Seo: Keyword Research Guide");
  });
  it("handles case where pillar is already title-cased", () => {
    expect(generateClusterTitle("SEO", "Link Building")).toBe("Seo: Link Building Guide");
  });
  it("returns empty for empty inputs", () => {
    expect(generateClusterTitle("", "x")).toBe("");
    expect(generateClusterTitle("x", "")).toBe("");
  });
});

describe("topic-cluster-builder generateSubtopics", () => {
  it("generates 4 beginner subtopics", () => {
    const subs = generateSubtopics("keyword research", "beginner");
    expect(subs).toHaveLength(4);
    expect(subs.map((s) => s.title)).toEqual([
      "What is keyword research",
      "How to do keyword research",
      "keyword research examples",
      "Common keyword research mistakes",
    ]);
  });
  it("generates 4 intermediate subtopics", () => {
    const subs = generateSubtopics("link building", "intermediate");
    expect(subs.map((s) => s.title)).toEqual([
      "How to do link building",
      "link building best practices",
      "link building tools",
      "Common link building mistakes",
    ]);
  });
  it("generates 4 advanced subtopics", () => {
    const subs = generateSubtopics("technical SEO", "advanced");
    expect(subs.map((s) => s.title)).toEqual([
      "technical SEO best practices",
      "technical SEO tools",
      "technical SEO examples",
      "Common technical SEO mistakes",
    ]);
  });
  it("returns empty for empty cluster", () => {
    expect(generateSubtopics("", "beginner")).toEqual([]);
  });
  it("preserves template name in subtopic object", () => {
    const subs = generateSubtopics("X", "beginner");
    expect(subs[0].template).toBe("What is <cluster>");
  });
});

describe("topic-cluster-builder generateContentBrief", () => {
  it("generates brief with title, keyword, word count, headers", () => {
    const brief = generateContentBrief("SEO", "keyword research", "best SEO tools", "beginner");
    expect(brief.cluster).toBe("keyword research");
    expect(brief.title).toBe("Seo: Keyword Research Guide");
    expect(brief.keyword).toBe("best SEO tools");
    expect(brief.wordCount).toBe(800);
    expect(brief.headers.length).toBe(7); // H1 + Intro + 4 subtopics + Conclusion
    expect(brief.headers[0]).toEqual({ level: 1, text: "Seo: Keyword Research Guide" });
    expect(brief.headers[1]).toEqual({ level: 2, text: "Introduction" });
    expect(brief.headers[brief.headers.length - 1]).toEqual({ level: 2, text: "Conclusion" });
  });
  it("uses advanced word count for advanced audience", () => {
    const brief = generateContentBrief("SEO", "link building", "", "advanced");
    expect(brief.wordCount).toBe(2500);
  });
});

describe("topic-cluster-builder generateInternalLinks", () => {
  it("generates pillar <-> cluster links", () => {
    const links = generateInternalLinks("SEO", ["keyword research", "link building"]);
    expect(links.filter((l) => l.type === "pillar-to-cluster")).toHaveLength(2);
    expect(links.filter((l) => l.type === "cluster-to-pillar")).toHaveLength(2);
    expect(links.filter((l) => l.type === "cluster-to-cluster")).toHaveLength(2);
    expect(links.some((l) => l.from === "SEO" && l.to === "keyword research" && l.type === "pillar-to-cluster")).toBe(true);
    expect(links.some((l) => l.from === "keyword research" && l.to === "SEO" && l.type === "cluster-to-pillar")).toBe(true);
  });
  it("generates cluster <-> cluster bidirectional links for adjacent pairs", () => {
    const links = generateInternalLinks("SEO", ["A", "B", "C"]);
    const ccLinks = links.filter((l) => l.type === "cluster-to-cluster");
    // A <-> B and B <-> C → 4 links
    expect(ccLinks).toHaveLength(4);
    expect(ccLinks.some((l) => l.from === "A" && l.to === "B")).toBe(true);
    expect(ccLinks.some((l) => l.from === "B" && l.to === "A")).toBe(true);
    expect(ccLinks.some((l) => l.from === "B" && l.to === "C")).toBe(true);
    expect(ccLinks.some((l) => l.from === "C" && l.to === "B")).toBe(true);
    // A and C should NOT be directly linked (not adjacent)
    expect(ccLinks.some((l) => (l.from === "A" && l.to === "C") || (l.from === "C" && l.to === "A"))).toBe(false);
  });
  it("returns empty for empty pillar and clusters", () => {
    expect(generateInternalLinks("", [])).toEqual([]);
  });
  it("skips empty cluster entries", () => {
    const links = generateInternalLinks("SEO", ["", "A", ""]);
    expect(links.filter((l) => l.type === "pillar-to-cluster")).toHaveLength(1);
  });
});

describe("topic-cluster-builder buildInternalLinkMatrix", () => {
  it("builds symmetric matrix for adjacent clusters", () => {
    const { nodes, matrix } = buildInternalLinkMatrix(["A", "B", "C"]);
    expect(nodes).toEqual(["A", "B", "C"]);
    expect(matrix).toHaveLength(3);
    expect(matrix[0][1]).toBe(true); // A -> B
    expect(matrix[1][0]).toBe(true); // B -> A
    expect(matrix[1][2]).toBe(true); // B -> C
    expect(matrix[2][1]).toBe(true); // C -> B
    expect(matrix[0][2]).toBe(false); // A not directly linked to C
    expect(matrix[0][0]).toBe(false); // No self-link
  });
  it("returns empty for empty input", () => {
    const { nodes, matrix } = buildInternalLinkMatrix([]);
    expect(nodes).toEqual([]);
    expect(matrix).toEqual([]);
  });
});

describe("topic-cluster-builder buildClusterMap", () => {
  const inputs: ClusterInputs = {
    pillarTopic: "SEO",
    clusters: ["keyword research", "link building", "technical SEO"],
    targetKeywords: new Map([["keyword research", "best SEO tools"]]),
    audienceLevel: "beginner",
  };

  it("builds map with pillar + clusters + links", () => {
    const map = buildClusterMap(inputs);
    expect(map.pillar).toBe("SEO");
    expect(map.clusters).toHaveLength(3);
    expect(map.clusters[0].topic).toBe("keyword research");
    expect(map.clusters[0].title).toBe("Seo: Keyword Research Guide");
    expect(map.clusters[0].keyword).toBe("best SEO tools");
    expect(map.clusters[0].wordCount).toBe(800);
    expect(map.clusters[0].subtopics).toHaveLength(4);
    // Pillar-to-cluster (3) + cluster-to-pillar (3) + cluster-to-cluster (4) = 10
    expect(map.internalLinks).toHaveLength(10);
  });
  it("preserves keyword lookup case-insensitively", () => {
    const map = buildClusterMap(inputs);
    // "keyword research" matched by lowercased key
    expect(map.clusters[0].keyword).toBe("best SEO tools");
    // "link building" has no keyword
    expect(map.clusters[1].keyword).toBe("");
  });
  it("uses audience-appropriate word count", () => {
    const advancedInputs: ClusterInputs = { ...inputs, audienceLevel: "advanced" };
    const map = buildClusterMap(advancedInputs);
    expect(map.clusters[0].wordCount).toBe(2500);
  });
  it("filters out empty clusters", () => {
    const map = buildClusterMap({ ...inputs, clusters: ["A", "", "B"] });
    expect(map.clusters).toHaveLength(2);
  });
});

describe("topic-cluster-builder buildContentBriefs", () => {
  const inputs: ClusterInputs = {
    pillarTopic: "SEO",
    clusters: ["keyword research", "link building"],
    targetKeywords: new Map(),
    audienceLevel: "intermediate",
  };

  it("builds brief per cluster", () => {
    const briefs = buildContentBriefs(inputs);
    expect(briefs).toHaveLength(2);
    expect(briefs[0].cluster).toBe("keyword research");
    expect(briefs[0].wordCount).toBe(1500);
    expect(briefs[0].headers[0].text).toBe("Seo: Keyword Research Guide");
  });
  it("filters out empty clusters", () => {
    const briefs = buildContentBriefs({ ...inputs, clusters: ["A", "", "B"] });
    expect(briefs).toHaveLength(2);
  });
});

describe("topic-cluster-builder computeSummaryStats", () => {
  it("computes totals for map and briefs", () => {
    const inputs: ClusterInputs = {
      pillarTopic: "SEO",
      clusters: ["A", "B", "C"],
      targetKeywords: new Map(),
      audienceLevel: "intermediate",
    };
    const map = buildClusterMap(inputs);
    const briefs = buildContentBriefs(inputs);
    const stats = computeSummaryStats(map, briefs, "intermediate");
    expect(stats.totalClusters).toBe(3);
    expect(stats.totalSubtopics).toBe(12); // 4 subtopics × 3 clusters
    // pillar-cluster (3) + cluster-pillar (3) + cluster-cluster (4) = 10
    expect(stats.totalInternalLinks).toBe(10);
    expect(stats.totalWordCount).toBe(4500); // 1500 × 3
    expect(stats.audience).toBe("intermediate");
  });
  it("returns zeros for empty map", () => {
    const emptyMap = { pillar: "", clusters: [], internalLinks: [] };
    const stats = computeSummaryStats(emptyMap, [], "beginner");
    expect(stats.totalClusters).toBe(0);
    expect(stats.totalSubtopics).toBe(0);
    expect(stats.totalInternalLinks).toBe(0);
    expect(stats.totalWordCount).toBe(0);
  });
});

describe("topic-cluster-builder filterByCluster", () => {
  const inputs: ClusterInputs = {
    pillarTopic: "SEO",
    clusters: ["A", "B", "C"],
    targetKeywords: new Map(),
    audienceLevel: "beginner",
  };
  const map = buildClusterMap(inputs);

  it("returns full map for empty filter", () => {
    expect(filterByCluster(map, "").clusters).toHaveLength(3);
  });
  it("filters to single cluster", () => {
    const filtered = filterByCluster(map, "A");
    expect(filtered.clusters).toHaveLength(1);
    expect(filtered.clusters[0].topic).toBe("A");
  });
  it("filters internal links to those involving that cluster", () => {
    const filtered = filterByCluster(map, "A");
    // A links: pillar->A, A->pillar, A->B, B->A = 4 links
    expect(filtered.internalLinks).toHaveLength(4);
    expect(filtered.internalLinks.every((l) => l.from === "A" || l.to === "A")).toBe(true);
  });
  it("is case-insensitive", () => {
    const filtered = filterByCluster(map, "a");
    expect(filtered.clusters).toHaveLength(1);
  });
});

describe("topic-cluster-builder renderText", () => {
  it("renders pillar, clusters, links, briefs", () => {
    const inputs: ClusterInputs = {
      pillarTopic: "SEO",
      clusters: ["keyword research"],
      targetKeywords: new Map(),
      audienceLevel: "beginner",
    };
    const map = buildClusterMap(inputs);
    const briefs = buildContentBriefs(inputs);
    const text = renderText(map, briefs);
    expect(text).toContain("PILLAR PAGE: Seo");
    expect(text).toContain("CLUSTERS:");
    expect(text).toContain("Seo: Keyword Research Guide");
    expect(text).toContain("INTERNAL LINKS:");
    expect(text).toContain("CONTENT BRIEFS:");
    expect(text).toContain("H1: Seo: Keyword Research Guide");
    expect(text).toContain("H2: Introduction");
  });
  it("returns empty for empty input", () => {
    expect(renderText({ pillar: "", clusters: [], internalLinks: [] }, [])).toBe("");
  });
});

describe("topic-cluster-builder renderCsv", () => {
  it("renders header", () => {
    expect(renderCsv({ pillar: "", clusters: [], internalLinks: [] })).toBe(
      "cluster,subtopic,title,keyword,word_count",
    );
  });
  it("renders one row per subtopic", () => {
    const inputs: ClusterInputs = {
      pillarTopic: "SEO",
      clusters: ["keyword research"],
      targetKeywords: new Map(),
      audienceLevel: "beginner",
    };
    const map = buildClusterMap(inputs);
    const csv = renderCsv(map);
    const lines = csv.split("\n");
    expect(lines).toHaveLength(5); // header + 4 subtopics
    expect(lines[1]).toContain("keyword research");
    expect(lines[1]).toContain("What is keyword research");
  });
  it("escapes commas in subtopic", () => {
    const map: ReturnType<typeof buildClusterMap> = {
      pillar: "Pillar",
      clusters: [{
        topic: "cluster, with comma",
        title: "Cluster, With Comma Guide",
        keyword: "",
        wordCount: 800,
        subtopics: [{ title: "What is cluster, with comma", template: "What is <cluster>" }],
      }],
      internalLinks: [],
    };
    const csv = renderCsv(map);
    expect(csv).toContain('"cluster, with comma"');
    expect(csv).toContain('"What is cluster, with comma"');
  });
});

describe("topic-cluster-builder splitCsvRow", () => {
  it("splits simple", () => { expect(splitCsvRow("a,b,c")).toEqual(["a", "b", "c"]); });
  it("handles quoted commas", () => { expect(splitCsvRow('"a,b",c')).toEqual(["a,b", "c"]); });
  it("handles escaped quotes", () => {
    expect(splitCsvRow('"a""b",c')).toEqual(['a"b', "c"]);
  });
});

describe("topic-cluster-builder renderClusterMapJson", () => {
  it("renders valid JSON with pillar, clusters, internalLinks", () => {
    const inputs: ClusterInputs = {
      pillarTopic: "SEO",
      clusters: ["keyword research"],
      targetKeywords: new Map([["keyword research", "best SEO tools"]]),
      audienceLevel: "intermediate",
    };
    const map = buildClusterMap(inputs);
    const json = renderClusterMapJson(map);
    const parsed = JSON.parse(json);
    expect(parsed.pillar).toBe("SEO");
    expect(parsed.clusters).toHaveLength(1);
    expect(parsed.clusters[0].title).toBe("Seo: Keyword Research Guide");
    expect(parsed.clusters[0].keyword).toBe("best SEO tools");
    expect(parsed.clusters[0].subtopics).toHaveLength(4);
    expect(parsed.internalLinks.length).toBeGreaterThan(0);
  });
});

describe("topic-cluster-builder history (localStorage)", () => {
  it("loads empty initially", () => { expect(loadHistory()).toEqual([]); });
  it("saves and loads", () => {
    saveHistory({ ts: 1, pillar: "SEO", clusterCount: 3, audience: "beginner" });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, pillar: "X", clusterCount: 1, audience: "beginner" });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, pillar: "X", clusterCount: 1, audience: "beginner" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("topic-cluster-builder shareable URL", () => {
  const shareInputs = {
    pillar: "SEO",
    clusters: "keyword research\nlink building",
    keywords: "keyword research,best SEO tools",
    audience: "beginner" as AudienceLevel,
  };

  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl(shareInputs);
    expect(url).toContain("pillar=SEO");
    expect(url).toContain("aud=beginner");
    expect(url).toContain("keyword+research");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("round-trips through parseShareUrl", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl(shareInputs);
    const hash = url.startsWith("?") ? url.slice(1) : url;
    const parsed = parseShareUrl(hash);
    expect(parsed.pillar).toBe("SEO");
    expect(parsed.audience).toBe("beginner");
    expect(parsed.clusters).toContain("keyword research");
    expect(parsed.keywords).toContain("best SEO tools");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("handles empty hash with defaults", () => {
    const parsed = parseShareUrl("");
    expect(parsed.pillar).toBe("");
    expect(parsed.audience).toBe("intermediate");
  });
  it("falls back to intermediate for invalid audience", () => {
    const parsed = parseShareUrl("pillar=SEO&aud=invalid");
    expect(parsed.audience).toBe("intermediate");
  });
});

// Suppress unused-import lint
export type _Unused = AudienceLevel | ClusterInputs;
