import { describe, it, expect, beforeEach } from "vitest";
import {
  splitCsvRow,
  parseContentItems,
  normalizeUrl,
  extractKeywordSlug,
  trafficScore,
  backlinkScore,
  ageScore,
  wordCountScore,
  computePruningScore,
  getThresholds,
  findMergeCandidate,
  findRedirectTarget,
  decideAction,
  auditItems,
  summarizeAudit,
  renderTextTable,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  PRESET_THRESHOLDS,
  HISTORY_KEY,
  HISTORY_MAX,
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

describe("content-pruning-auditor constants", () => {
  it("exposes 3 preset thresholds", () => {
    expect(PRESET_THRESHOLDS.conservative).toBeDefined();
    expect(PRESET_THRESHOLDS.balanced).toBeDefined();
    expect(PRESET_THRESHOLDS.aggressive).toBeDefined();
  });
  it("aggressive preset prunes more aggressively", () => {
    expect(PRESET_THRESHOLDS.aggressive.deleteAgeMonths).toBeLessThan(
      PRESET_THRESHOLDS.conservative.deleteAgeMonths,
    );
    expect(PRESET_THRESHOLDS.aggressive.deleteWordCount).toBeGreaterThan(
      PRESET_THRESHOLDS.conservative.deleteWordCount,
    );
  });
  it("history key & max are stable", () => {
    expect(HISTORY_KEY).toContain("content-pruning-auditor");
    expect(HISTORY_MAX).toBe(20);
  });
});

describe("content-pruning-auditor splitCsvRow", () => {
  it("splits simple row", () => {
    expect(splitCsvRow("a,b,c")).toEqual(["a", "b", "c"]);
  });
  it("handles quoted commas", () => {
    expect(splitCsvRow('"hello, world",b')).toEqual(["hello, world", "b"]);
  });
  it("handles escaped quotes", () => {
    expect(splitCsvRow('"she said ""hi""",b')).toEqual(['she said "hi"', "b"]);
  });
  it("trims fields", () => {
    expect(splitCsvRow("a , b , c")).toEqual(["a", "b", "c"]);
  });
});

describe("content-pruning-auditor parseContentItems", () => {
  it("parses a full row", () => {
    const items = parseContentItems("https://x.com/a,500,5,800,12,2");
    expect(items).toHaveLength(1);
    expect(items[0]).toEqual({
      url: "https://x.com/a",
      traffic: 500,
      backlinks: 5,
      wordCount: 800,
      ageMonths: 12,
      lastUpdatedMonthsAgo: 2,
    });
  });
  it("fills defaults for missing fields", () => {
    const items = parseContentItems("https://x.com/a,100");
    expect(items[0].backlinks).toBe(0);
    expect(items[0].wordCount).toBe(500);
  });
  it("skips header row", () => {
    const items = parseContentItems("url,traffic,backlinks\nhttps://x.com/a,500,5");
    expect(items).toHaveLength(1);
    expect(items[0].url).toBe("https://x.com/a");
  });
  it("skips blank lines", () => {
    expect(parseContentItems("https://x.com/a,1\n\nhttps://x.com/b,2")).toHaveLength(2);
  });
  it("ignores invalid numbers", () => {
    const items = parseContentItems("https://x.com/a,abc,5");
    expect(items[0].traffic).toBe(0);
    expect(items[0].backlinks).toBe(5);
  });
  it("returns empty for empty input", () => {
    expect(parseContentItems("")).toEqual([]);
  });
});

describe("content-pruning-auditor normalizeUrl & extractKeywordSlug", () => {
  it("strips trailing slash", () => {
    expect(normalizeUrl("https://Example.com/Page/")).toBe("https://example.com/Page");
  });
  it("lowercases host", () => {
    expect(normalizeUrl("https://EXAMPLE.com/x")).toContain("example.com");
  });
  it("extracts slug from path", () => {
    expect(extractKeywordSlug("https://x.com/blog/seo-tips")).toBe("seo-tips");
  });
  it("ignores paging segments", () => {
    expect(extractKeywordSlug("https://x.com/blog/page/2")).toBe("blog");
  });
  it("strips html extension", () => {
    expect(extractKeywordSlug("https://x.com/seo-tips.html")).toBe("seo-tips");
  });
  it("returns empty for root URL", () => {
    expect(extractKeywordSlug("https://x.com/")).toBe("");
  });
});

describe("content-pruning-auditor scoring", () => {
  it("trafficScore: 0 → 100, 1000+ → 0", () => {
    expect(trafficScore(0)).toBe(100);
    expect(trafficScore(1000)).toBe(0);
    expect(trafficScore(500)).toBeCloseTo(50, 1);
  });
  it("backlinkScore: 0 → 100, 50+ → 0", () => {
    expect(backlinkScore(0)).toBe(100);
    expect(backlinkScore(50)).toBe(0);
  });
  it("ageScore: 0 → 0, 48+ → 100", () => {
    expect(ageScore(0)).toBe(0);
    expect(ageScore(48)).toBe(100);
  });
  it("wordCountScore: <=100 → 100, 2000+ → 0", () => {
    expect(wordCountScore(50)).toBe(100);
    expect(wordCountScore(2000)).toBe(0);
  });
  it("computePruningScore is weighted sum", () => {
    const score = computePruningScore({
      url: "https://x.com/a",
      traffic: 0,
      backlinks: 0,
      wordCount: 100,
      ageMonths: 48,
      lastUpdatedMonthsAgo: 48,
    });
    // traffic 100*0.4 + backlinks 100*0.3 + age 100*0.15 + words 100*0.15 = 100
    expect(score).toBe(100);
  });
  it("a strong page scores low", () => {
    const score = computePruningScore({
      url: "https://x.com/a",
      traffic: 1000,
      backlinks: 50,
      wordCount: 2000,
      ageMonths: 0,
      lastUpdatedMonthsAgo: 0,
    });
    expect(score).toBe(0);
  });
});

describe("content-pruning-auditor decideAction", () => {
  const t = getThresholds("balanced");
  it("delete for thin old zero-traffic page", () => {
    const item = {
      url: "https://x.com/a",
      traffic: 0,
      backlinks: 0,
      wordCount: 100,
      ageMonths: 30,
      lastUpdatedMonthsAgo: 30,
    };
    expect(decideAction(item, [item], t).decision).toBe("delete");
  });
  it("redirect for old low-traffic page", () => {
    const item = {
      url: "https://x.com/old",
      traffic: 10,
      backlinks: 1,
      wordCount: 800,
      ageMonths: 30,
      lastUpdatedMonthsAgo: 30,
    };
    expect(decideAction(item, [item], t).decision).toBe("redirect");
  });
  it("keep for high-traffic page", () => {
    const item = {
      url: "https://x.com/a",
      traffic: 600,
      backlinks: 0,
      wordCount: 500,
      ageMonths: 6,
      lastUpdatedMonthsAgo: 1,
    };
    expect(decideAction(item, [item], t).decision).toBe("keep");
  });
  it("improve for medium-traffic thin page", () => {
    const item = {
      url: "https://x.com/a",
      traffic: 200,
      backlinks: 0,
      wordCount: 200,
      ageMonths: 6,
      lastUpdatedMonthsAgo: 1,
    };
    expect(decideAction(item, [item], t).decision).toBe("improve");
  });
  it("merge for low-traffic page with strong sibling", () => {
    const a = {
      url: "https://x.com/seo-guide",
      traffic: 10,
      backlinks: 0,
      wordCount: 800,
      ageMonths: 6,
      lastUpdatedMonthsAgo: 1,
    };
    const b = {
      url: "https://x.com/seo-guide-v2",
      traffic: 600,
      backlinks: 12,
      wordCount: 1500,
      ageMonths: 6,
      lastUpdatedMonthsAgo: 1,
    };
    expect(decideAction(a, [a, b], t).decision).toBe("merge");
  });
  it("includes a reason", () => {
    const item = {
      url: "https://x.com/a",
      traffic: 1000,
      backlinks: 50,
      wordCount: 2000,
      ageMonths: 0,
      lastUpdatedMonthsAgo: 0,
    };
    expect(decideAction(item, [item], t).reason.length).toBeGreaterThan(5);
  });
});

describe("content-pruning-auditor findMergeCandidate & findRedirectTarget", () => {
  it("finds merge candidate by slug", () => {
    const a = { url: "https://x.com/seo-guide", traffic: 10, backlinks: 0, wordCount: 500, ageMonths: 6, lastUpdatedMonthsAgo: 1 };
    const b = { url: "https://x.com/seo-guide-v2", traffic: 600, backlinks: 12, wordCount: 1500, ageMonths: 6, lastUpdatedMonthsAgo: 1 };
    const cand = findMergeCandidate(a, [a, b], getThresholds("balanced"));
    expect(cand).toBeDefined();
    expect(cand!.url).toBe(b.url);
  });
  it("returns undefined when no similar slug", () => {
    const a = { url: "https://x.com/seo-guide", traffic: 10, backlinks: 0, wordCount: 500, ageMonths: 6, lastUpdatedMonthsAgo: 1 };
    const b = { url: "https://x.com/marketing-tips", traffic: 600, backlinks: 12, wordCount: 1500, ageMonths: 6, lastUpdatedMonthsAgo: 1 };
    expect(findMergeCandidate(a, [a, b], getThresholds("balanced"))).toBeUndefined();
  });
  it("findRedirectTarget prefers same-host keep page", () => {
    const items = parseContentItems("https://x.com/old,10,0,800,30,1\nhttps://x.com/hub,800,15,2000,12,1");
    const audited = auditItems(items, "balanced");
    const old = audited.find((a) => a.url.includes("old"));
    expect(old).toBeDefined();
    const target = findRedirectTarget(old!, audited);
    expect(target).toBeDefined();
    expect(target!.url).toContain("hub");
  });
});

describe("content-pruning-auditor auditItems", () => {
  it("sorts delete first, keep last", () => {
    const items = parseContentItems(
      "https://x.com/hub,800,15,2000,12,1\nhttps://x.com/dead,0,0,100,30,1\nhttps://x.com/thin,200,0,200,6,1",
    );
    const audited = auditItems(items, "balanced");
    expect(audited[0].decision).toBe("delete");
    expect(audited[audited.length - 1].decision).toBe("keep");
  });
  it("populates redirectTo on redirect decisions", () => {
    const items = parseContentItems(
      "https://x.com/hub,800,15,2000,12,1\nhttps://x.com/old,10,0,800,30,1",
    );
    const audited = auditItems(items, "balanced");
    const old = audited.find((a) => a.url.includes("old"));
    expect(old).toBeDefined();
    expect(old!.decision).toBe("redirect");
    expect(old!.redirectTo).toContain("hub");
  });
  it("populates mergeWith on merge decisions", () => {
    const items = parseContentItems(
      "https://x.com/seo-guide,10,0,800,6,1\nhttps://x.com/seo-guide-v2,600,12,1500,6,1",
    );
    const audited = auditItems(items, "balanced");
    const merge = audited.find((a) => a.decision === "merge");
    expect(merge).toBeDefined();
    expect(merge!.mergeWith).toContain("seo-guide-v2");
  });
  it("applies preset (aggressive prunes more)", () => {
    const items = parseContentItems(
      "https://x.com/medium,300,2,500,20,5",
    );
    const conservative = auditItems(items, "conservative");
    const aggressive = auditItems(items, "aggressive");
    // aggressive: traffic 300 in [100,700], wordCount 500 < 700 → improve
    expect(aggressive[0].decision).toBe("improve");
    // conservative: traffic 300 in [50,500], wordCount 500 > 400 → not improve → keep
    expect(conservative[0].decision).toBe("keep");
  });
  it("respects threshold overrides", () => {
    const items = parseContentItems("https://x.com/a,100,0,500,6,1");
    const audited = auditItems(items, "balanced", { improveWordCount: 999 });
    expect(audited[0].decision).toBe("improve");
  });
});

describe("content-pruning-auditor summarizeAudit", () => {
  it("sums per decision", () => {
    const items = parseContentItems(
      "https://x.com/hub,800,15,2000,12,1\nhttps://x.com/dead,0,0,100,30,1",
    );
    const audited = auditItems(items, "balanced");
    const sum = summarizeAudit(audited);
    expect(sum.total).toBe(2);
    expect(sum.delete).toBe(1);
    expect(sum.keep).toBe(1);
    expect(sum.totalTraffic).toBe(800);
    expect(sum.totalBacklinks).toBe(15);
  });
  it("computes avg pruning score", () => {
    const items = parseContentItems("https://x.com/hub,800,15,2000,12,1");
    const audited = auditItems(items, "balanced");
    const sum = summarizeAudit(audited);
    expect(sum.avgPruningScore).toBeGreaterThanOrEqual(0);
    expect(sum.avgPruningScore).toBeLessThanOrEqual(100);
  });
  it("handles empty input", () => {
    const sum = summarizeAudit([]);
    expect(sum.total).toBe(0);
    expect(sum.avgPruningScore).toBe(0);
  });
});

describe("content-pruning-auditor renderTextTable & renderCsv", () => {
  const items = parseContentItems(
    "https://x.com/hub,800,15,2000,12,1\nhttps://x.com/dead,0,0,100,30,1",
  );
  const audited = auditItems(items, "balanced");
  it("renders text table with header", () => {
    const txt = renderTextTable(audited);
    expect(txt).toContain("URL");
    expect(txt).toContain("DECISION");
    expect(txt).toContain("https://x.com/hub");
    expect(txt).toContain("DELETE");
  });
  it("renders CSV with header row", () => {
    const csv = renderCsv(audited);
    expect(csv).toContain("url,traffic,backlinks,word_count,age_months,pruning_score,decision,redirect_to,merge_with,reason");
    expect(csv).toContain("https://x.com/hub");
  });
  it("escapes commas in reason field", () => {
    const csv = renderCsv(audited);
    expect(csv).toContain('"');
  });
  it("returns placeholder for empty", () => {
    expect(renderTextTable([])).toBe("No items.");
  });
});

describe("content-pruning-auditor history", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1,
      total: 5,
      keep: 1,
      improve: 1,
      merge: 1,
      redirect: 1,
      delete: 1,
      avgScore: 50,
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at HISTORY_MAX (20)", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, total: 1, keep: 1, improve: 0, merge: 0, redirect: 0, delete: 0, avgScore: 0 });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears history", () => {
    saveHistory({ ts: 1, total: 1, keep: 1, improve: 0, merge: 0, redirect: 0, delete: 0, avgScore: 0 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("content-pruning-auditor shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("https://x.com/a,100", "balanced");
    expect(url).toContain("input=");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("omits preset when balanced (default)", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("https://x.com/a,100", "balanced");
    expect(url).not.toContain("preset=");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("includes preset when aggressive", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("https://x.com/a,100", "aggressive");
    expect(url).toContain("preset=aggressive");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back to input + preset", () => {
    const p = parseShareUrl("input=https%3A%2F%2Fx.com%2Ca&preset=aggressive");
    expect(p.input).toBe("https://x.com,a");
    expect(p.preset).toBe("aggressive");
  });
  it("defaults preset to balanced", () => {
    const p = parseShareUrl("input=foo");
    expect(p.preset).toBe("balanced");
  });
  it("handles empty hash", () => {
    const p = parseShareUrl("");
    expect(p.input).toBe("");
    expect(p.preset).toBe("balanced");
  });
});
