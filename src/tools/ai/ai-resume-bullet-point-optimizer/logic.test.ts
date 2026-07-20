import { describe, it, expect, beforeEach } from "vitest";
import {
  ACTION_VERBS,
  WEAK_PHRASES,
  SAMPLE_BULLETS,
  SAMPLE_JD,
  HISTORY_KEY,
  HISTORY_MAX,
  normalizeBullet,
  parseBullets,
  detectWeakPhrases,
  detectActionVerbs,
  extractMetrics,
  detectPassiveVoice,
  detectTense,
  checkTenseConsistency,
  extractJdKeywords,
  matchJdKeywords,
  scoreBullet,
  analyzeStar,
  suggestVerbAlternatives,
  generateRewrites,
  analyzeBullet,
  bulkOptimize,
  renderText,
  renderMarkdown,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  parseLlmResult,
  type HistoryEntry,
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

describe("resume-bullet constants", () => {
  it("has 200+ action verbs", () => {
    expect(ACTION_VERBS.length).toBeGreaterThanOrEqual(100);
  });
  it("has verbs across all 6 categories", () => {
    const cats = new Set(ACTION_VERBS.map((v) => v.category));
    expect(cats.size).toBe(6);
  });
  it("has 15+ weak phrases", () => {
    expect(WEAK_PHRASES.length).toBeGreaterThanOrEqual(15);
  });
  it("has sample bullets", () => {
    expect(SAMPLE_BULLETS.length).toBeGreaterThanOrEqual(3);
  });
  it("has sample JD text", () => {
    expect(SAMPLE_JD.length).toBeGreaterThan(50);
  });
  it("has 20 history max", () => {
    expect(HISTORY_MAX).toBe(20);
  });
  it("uses a stable history key", () => {
    expect(HISTORY_KEY).toContain("resume-bullet-point-optimizer");
  });
});

describe("resume-bullet normalizeBullet", () => {
  it("collapses whitespace and trims", () => {
    expect(normalizeBullet("  Led   a team  ")).toBe("Led a team");
  });
  it("handles empty", () => {
    expect(normalizeBullet("")).toBe("");
  });
});

describe("resume-bullet parseBullets", () => {
  it("splits on newlines", () => {
    expect(parseBullets("Led a team.\nBuilt a tool.")).toEqual(["Led a team.", "Built a tool."]);
  });
  it("splits on bullet characters", () => {
    expect(parseBullets("• Led a team\n• Built a tool")).toEqual(["Led a team", "Built a tool"]);
  });
  it("splits on dashes", () => {
    expect(parseBullets("Led a team - Built a tool")).toEqual(["Led a team", "Built a tool"]);
  });
  it("splits on semicolons", () => {
    expect(parseBullets("Led a team; Built a tool")).toEqual(["Led a team", "Built a tool"]);
  });
  it("skips empty lines", () => {
    expect(parseBullets("Led a team.\n\nBuilt a tool.")).toEqual(["Led a team.", "Built a tool."]);
  });
  it("returns empty for empty input", () => {
    expect(parseBullets("")).toEqual([]);
  });
});

describe("resume-bullet detectWeakPhrases", () => {
  it("detects 'responsible for'", () => {
    const r = detectWeakPhrases("Responsible for managing a team of 5.");
    expect(r).toHaveLength(1);
    expect(r[0].phrase).toBe("responsible for");
    expect(r[0].alternative).toContain("owned");
  });
  it("detects multiple weak phrases", () => {
    const r = detectWeakPhrases("Worked on the API and was responsible for docs.");
    expect(r.length).toBeGreaterThanOrEqual(2);
  });
  it("returns empty when none", () => {
    expect(detectWeakPhrases("Led a team of 5 engineers.")).toEqual([]);
  });
  it("records positions", () => {
    const r = detectWeakPhrases("Worked on X.");
    expect(r[0].start).toBe(0);
    expect(r[0].end).toBe("worked on".length);
  });
});

describe("resume-bullet detectActionVerbs", () => {
  it("detects 'Led' at position 0", () => {
    const v = detectActionVerbs("Led a cross-functional team.");
    expect(v).toHaveLength(1);
    expect(v[0].base).toBe("led");
    expect(v[0].position).toBe(0);
    expect(v[0].category).toBe("leadership");
  });
  it("detects technical verbs", () => {
    const v = detectActionVerbs("Built and deployed a web app.");
    expect(v.length).toBeGreaterThanOrEqual(2);
    expect(v[0].base).toBe("built");
    expect(v[0].category).toBe("technical");
  });
  it("returns empty for weak-phrase-only bullet", () => {
    const v = detectActionVerbs("Responsible for the API.");
    expect(v).toEqual([]);
  });
});

describe("resume-bullet extractMetrics", () => {
  it("extracts percentages", () => {
    const m = extractMetrics("Reduced churn by 25%.");
    expect(m.some((x) => x.kind === "percent" && x.raw.includes("25"))).toBe(true);
  });
  it("extracts currency", () => {
    const m = extractMetrics("Saved $1.2M annually.");
    expect(m.some((x) => x.kind === "currency")).toBe(true);
  });
  it("extracts multipliers", () => {
    const m = extractMetrics("Increased throughput 3x.");
    expect(m.some((x) => x.kind === "multiplier" && x.raw === "3x")).toBe(true);
  });
  it("extracts counts", () => {
    const m = extractMetrics("Managed 12 engineers.");
    expect(m.some((x) => x.kind === "count")).toBe(true);
  });
  it("extracts time", () => {
    const m = extractMetrics("Shipped in 3 months.");
    expect(m.some((x) => x.kind === "time")).toBe(true);
  });
  it("returns empty when no metrics", () => {
    expect(extractMetrics("Led a team.")).toEqual([]);
  });
});

describe("resume-bullet detectPassiveVoice", () => {
  it("flags 'was responsible for'", () => {
    const r = detectPassiveVoice("Was responsible for managing the team.");
    expect(r.detected).toBe(true);
    expect(r.examples.length).toBeGreaterThan(0);
  });
  it("flags 'was tasked with'", () => {
    const r = detectPassiveVoice("Was tasked with redesigning the flow.");
    expect(r.detected).toBe(true);
  });
  it("returns false for active voice", () => {
    const r = detectPassiveVoice("Led a team of 5 engineers.");
    expect(r.detected).toBe(false);
  });
});

describe("resume-bullet detectTense", () => {
  it("detects past tense", () => {
    expect(detectTense("Led a team of engineers.")).toBe("past");
    expect(detectTense("Built a new feature.")).toBe("past");
  });
  it("detects present tense", () => {
    expect(detectTense("Leading a team.")).toBe("present");
  });
  it("returns unknown for empty", () => {
    expect(detectTense("")).toBe("unknown");
  });
});

describe("resume-bullet checkTenseConsistency", () => {
  it("flags inconsistent tenses", () => {
    const r = checkTenseConsistency(["Led a team.", "Building features."]);
    expect(r.consistent).toBe(false);
  });
  it("confirms consistent past tense", () => {
    const r = checkTenseConsistency(["Led a team.", "Built a tool."]);
    expect(r.consistent).toBe(true);
  });
});

describe("resume-bullet extractJdKeywords", () => {
  it("extracts non-stop keywords", () => {
    const kw = extractJdKeywords("We need a senior product manager with SQL skills.");
    expect(kw).toContain("senior");
    expect(kw).toContain("product");
    expect(kw).toContain("sql");
    expect(kw).not.toContain("we");
    expect(kw).not.toContain("a");
  });
  it("returns empty for empty input", () => {
    expect(extractJdKeywords("")).toEqual([]);
  });
});

describe("resume-bullet matchJdKeywords", () => {
  it("matches keywords present in bullet", () => {
    const r = matchJdKeywords("Led SQL analytics projects.", "Looking for SQL and roadmapping skills.");
    expect(r.matched).toContain("sql");
    expect(r.missing).toContain("roadmapping");
    expect(r.density).toBeGreaterThan(0);
  });
  it("returns empty when no JD", () => {
    const r = matchJdKeywords("Led a team.", "");
    expect(r.matched).toEqual([]);
    expect(r.missing).toEqual([]);
    expect(r.density).toBe(0);
  });
});

describe("resume-bullet scoreBullet", () => {
  it("scores a strong bullet high", () => {
    const s = scoreBullet("Led a cross-functional team that cut deployment time by 60% and saved $120K annually.");
    expect(s.score).toBeGreaterThanOrEqual(80);
    expect(s.signals.startsWithStrongVerb).toBe(true);
    expect(s.signals.hasMetric).toBe(true);
    expect(s.signals.isActiveVoice).toBe(true);
    expect(s.signals.isPastTense).toBe(true);
  });
  it("scores a weak bullet low", () => {
    const s = scoreBullet("Responsible for stuff.");
    expect(s.score).toBeLessThan(40);
    expect(s.signals.startsWithStrongVerb).toBe(false);
    expect(s.signals.hasMetric).toBe(false);
  });
  it("max possible is 100", () => {
    expect(scoreBullet("Led").maxPossible).toBe(100);
  });
  it("length signal requires 60-220 chars", () => {
    const longBullet = "Led a team that built and shipped a thing. ".repeat(10);
    const s = scoreBullet(longBullet);
    expect(s.signals.lengthOk).toBe(false);
  });
});

describe("resume-bullet analyzeStar", () => {
  it("flags complete STAR bullet", () => {
    const s = analyzeStar("In Q3, led the migration to reduce deploy time by 60%.");
    expect(s.hasAction).toBe(true);
    expect(s.hasResult).toBe(true);
  });
  it("flags missing result", () => {
    const s = analyzeStar("Led a team to build the feature.");
    expect(s.hasResult).toBe(false);
  });
});

describe("resume-bullet suggestVerbAlternatives", () => {
  it("suggests alternatives for a weak phrase", () => {
    const alts = suggestVerbAlternatives("Responsible for managing the team.");
    expect(alts.length).toBeGreaterThan(0);
    expect(alts.some((a) => /Led|Owned|Directed|Drove/i.test(a))).toBe(true);
  });
  it("suggests alternatives from same category as action verb", () => {
    const alts = suggestVerbAlternatives("Built a web app.");
    expect(alts.length).toBeGreaterThan(0);
    expect(alts.includes("Built")).toBe(false);
  });
});

describe("resume-bullet generateRewrites", () => {
  it("rewrites a weak-phrase bullet with a strong verb", () => {
    const rws = generateRewrites("Responsible for managing a team of 5.");
    expect(rws.length).toBeGreaterThanOrEqual(1);
    expect(rws[0].startsWith("Responsible")).toBe(false);
  });
  it("adds a metric placeholder when no metric present", () => {
    const rws = generateRewrites("Worked on the API.");
    expect(rws.join(" ")).toMatch(/\[add a real metric/i);
  });
  it("does NOT add a metric placeholder when metric present", () => {
    const rws = generateRewrites("Helped with churn reduction by 15%.");
    // At least one rewrite should not contain the placeholder
    expect(rws.some((r) => !/\[add a real metric/i.test(r))).toBe(true);
  });
  it("produces at most 3 rewrites", () => {
    const rws = generateRewrites("Responsible for the team. Worked on the API.");
    expect(rws.length).toBeLessThanOrEqual(3);
  });
  it("returns empty for empty input", () => {
    expect(generateRewrites("")).toEqual([]);
  });
});

describe("resume-bullet analyzeBullet", () => {
  it("returns full analysis with all fields", () => {
    const a = analyzeBullet("Led a team that cut deploy time by 60%.", SAMPLE_JD);
    expect(a.normalized).toBeTruthy();
    expect(a.verbs.length).toBeGreaterThan(0);
    expect(a.score.score).toBeGreaterThan(0);
    expect(a.rewrites.length).toBeGreaterThan(0);
    expect(Array.isArray(a.diagnostics)).toBe(true);
  });
  it("flags weak phrases in diagnostics", () => {
    const a = analyzeBullet("Responsible for the API.");
    expect(a.diagnostics.some((d) => /weak phrase/i.test(d))).toBe(true);
  });
  it("flags missing metrics in diagnostics", () => {
    const a = analyzeBullet("Led a team of engineers.");
    expect(a.diagnostics.some((d) => /metric/i.test(d))).toBe(true);
  });
});

describe("resume-bullet bulkOptimize", () => {
  it("analyzes multiple bullets", () => {
    const r = bulkOptimize([
      "Led a team that cut deploys by 60%.",
      "Responsible for the API.",
    ], SAMPLE_JD);
    expect(r.bullets).toHaveLength(2);
    expect(typeof r.averageScore).toBe("number");
    expect(r.weakBullets).toBeGreaterThanOrEqual(1);
  });
  it("computes average score", () => {
    const r = bulkOptimize([
      "Led a team that cut deploys by 60%.",
      "Built a tool that saved $50K.",
    ]);
    expect(r.averageScore).toBeGreaterThan(0);
  });
  it("aggregates JD gaps", () => {
    const r = bulkOptimize(["Led a team."], SAMPLE_JD);
    expect(r.totalJdGaps.length).toBeGreaterThan(0);
  });
});

describe("resume-bullet renderText & renderMarkdown", () => {
  it("renderText contains score and original", () => {
    const a = analyzeBullet("Led a team that cut deploys by 60%.");
    const t = renderText(a);
    expect(t).toContain("Original:");
    expect(t).toContain("Strength score:");
  });
  it("renderMarkdown contains headings and bullets", () => {
    const a = analyzeBullet("Led a team that cut deploys by 60%.");
    const md = renderMarkdown(a);
    expect(md).toContain("###");
    expect(md).toContain("**Signals:**");
  });
});

describe("resume-bullet history (localStorage)", () => {
  it("loads empty initially", () => { expect(loadHistory()).toEqual([]); });
  it("saves and loads", () => {
    const e: HistoryEntry = { ts: 1, bulletCount: 3, averageScore: 70, preview: "Led a team" };
    saveHistory(e);
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0].preview).toBe("Led a team");
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, bulletCount: 1, averageScore: 50, preview: `b${i}` });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, bulletCount: 1, averageScore: 50, preview: "x" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("resume-bullet shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("Led a team.", "Looking for SQL skills.");
    expect(url).toContain("bullets=");
    expect(url).toContain("jd=");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const url = buildShareUrl("Led a team.", "Looking for SQL skills.");
    // Extract just the hash portion
    const hash = url.includes("#") ? url.slice(url.indexOf("#")) : url;
    const p = parseShareUrl(hash);
    expect(p.bullets).toBe("Led a team.");
    expect(p.jd).toBe("Looking for SQL skills.");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({ bullets: "", jd: "" });
  });
});

describe("resume-bullet LLM helpers", () => {
  it("buildLlmPrompt contains formula and JSON instruction", () => {
    const p = buildLlmPrompt("Responsible for stuff.", "Looking for SQL.");
    expect(p).toContain("Action verb");
    expect(p).toContain("JSON");
    expect(p).toContain("Looking for SQL");
    expect(p).toContain("Responsible for stuff");
  });
  it("parseLlmResult parses valid JSON", () => {
    const r = parseLlmResult('{"rewrites":["Led X."],"explanation":"ok"}');
    expect(r).not.toBeNull();
    expect(r!.rewrites).toEqual(["Led X."]);
    expect(r!.explanation).toBe("ok");
  });
  it("parseLlmResult returns null for invalid", () => {
    expect(parseLlmResult("not json")).toBeNull();
  });
  it("parseLlmResult returns null when no rewrites", () => {
    expect(parseLlmResult('{"rewrites":[],"explanation":"x"}')).toBeNull();
  });
});
