import { describe, it, expect, beforeEach } from "vitest";
import {
  HISTORY_KEY,
  HISTORY_MAX,
  PRODUCT_TYPE_LABELS,
  TEAM_SIZE_LABELS,
  TIMELINE_LABELS,
  SCALE_LABELS,
  BUDGET_LABELS,
  COMPLIANCE_LABELS,
  SKILL_LABELS,
  DEFAULT_WEIGHTS,
  DEFAULT_PROFILE,
  PRODUCT_TYPE_PRESETS,
  clamp,
  parseSkills,
  validateProfile,
  buildScorecard,
  totalScore,
  scoreToStars,
  satisfiesHardRequirements,
  recommend,
  compareStacks,
  renderAdr,
  renderText,
  renderJson,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  renderLlmResult,
  type ProductProfile,
  type ScoreWeights,
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

describe("tech-stack-recommender constants", () => {
  it("exposes 8 product types", () => {
    expect(Object.keys(PRODUCT_TYPE_LABELS)).toHaveLength(8);
    expect(PRODUCT_TYPE_LABELS["saas-web"]).toBe("SaaS web app");
    expect(PRODUCT_TYPE_LABELS["api-only"]).toBe("API / backend service only");
  });

  it("exposes 4 team sizes, 4 timelines, 5 scales, 4 budgets, 5 compliance, 8 skills", () => {
    expect(Object.keys(TEAM_SIZE_LABELS)).toHaveLength(4);
    expect(Object.keys(TIMELINE_LABELS)).toHaveLength(4);
    expect(Object.keys(SCALE_LABELS)).toHaveLength(5);
    expect(Object.keys(BUDGET_LABELS)).toHaveLength(4);
    expect(Object.keys(COMPLIANCE_LABELS)).toHaveLength(5);
    expect(Object.keys(SKILL_LABELS)).toHaveLength(8);
  });

  it("DEFAULT_WEIGHTS sum to ~1.0", () => {
    const sum = DEFAULT_WEIGHTS.hiring + DEFAULT_WEIGHTS.shiptime + DEFAULT_WEIGHTS.scale + DEFAULT_WEIGHTS.cost + DEFAULT_WEIGHTS.ecosystem;
    expect(Math.abs(sum - 1.0)).toBeLessThan(0.001);
  });

  it("DEFAULT_PROFILE is a valid ProductProfile", () => {
    expect(DEFAULT_PROFILE.productType).toBe("saas-web");
    expect(DEFAULT_PROFILE.skills.length).toBeGreaterThan(0);
    expect(DEFAULT_PROFILE.compliance).toBe("none");
    expect(validateProfile(DEFAULT_PROFILE)).toEqual([]);
  });

  it("has 6 product type presets", () => {
    expect(PRODUCT_TYPE_PRESETS).toHaveLength(6);
    for (const p of PRODUCT_TYPE_PRESETS) {
      expect(p.label.length).toBeGreaterThan(0);
      expect(p.profile).toBeDefined();
    }
  });
});

describe("tech-stack-recommender helpers", () => {
  it("clamp keeps values in range", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
    expect(clamp(3.7, 0, 5)).toBe(3.7);
  });

  it("parseSkills extracts valid skills and drops unknown", () => {
    expect(parseSkills("typescript javascript")).toEqual(["typescript", "javascript"]);
    expect(parseSkills("python, rust, cobol")).toEqual(["python", "rust"]);
    expect(parseSkills("")).toEqual([]);
    expect(parseSkills("TS JS")).toEqual([]); // abbreviations are not valid keys
  });

  it("parseSkills dedupes", () => {
    const out = parseSkills("typescript typescript javascript");
    expect(out).toEqual(["typescript", "javascript"]);
  });

  it("validateProfile flags missing fields", () => {
    const errs = validateProfile({ ...DEFAULT_PROFILE, productType: "" as ProductProfile["productType"] });
    expect(errs.length).toBeGreaterThan(0);
    expect(errs.join(" ")).toContain("Product type");
  });

  it("validateProfile flags empty skills", () => {
    const errs = validateProfile({ ...DEFAULT_PROFILE, skills: [] });
    expect(errs.some((e) => e.includes("skill"))).toBe(true);
  });

  it("scoreToStars maps 0–10 → 1–5 in steps of 0.5", () => {
    expect(scoreToStars(10)).toBe(5);
    expect(scoreToStars(0)).toBe(1);
    expect(scoreToStars(5)).toBeGreaterThanOrEqual(2);
    expect(scoreToStars(5)).toBeLessThanOrEqual(3);
    expect([1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5]).toContain(scoreToStars(7.3));
  });

  it("satisfiesHardRequirements filters out non-compliant stacks", () => {
    // Every stack supports "none" — should pass
    const anyStack = {
      supportsCompliance: ["none", "gdpr"] as const,
      offlineOk: false,
      alignsSkills: [], fitsProducts: [], base: { hiring: 1, shiptime: 1, scale: 1, cost: 1, ecosystem: 1 },
      realtimeOk: false, seoOk: false,
      id: "x", name: "x", summary: "x", choices: {} as never,
    };
    const noneProfile = { ...DEFAULT_PROFILE, compliance: "none" as const };
    expect(satisfiesHardRequirements(anyStack as never, noneProfile)).toBe(true);

    const hipaaProfile = { ...DEFAULT_PROFILE, compliance: "hipaa" as const };
    expect(satisfiesHardRequirements(anyStack as never, hipaaProfile)).toBe(false);
  });

  it("satisfiesHardRequirements filters offline-required from non-offline stacks", () => {
    const stack = {
      supportsCompliance: ["none"] as const,
      offlineOk: false,
      alignsSkills: [], fitsProducts: [], base: { hiring: 1, shiptime: 1, scale: 1, cost: 1, ecosystem: 1 },
      realtimeOk: false, seoOk: false,
      id: "x", name: "x", summary: "x", choices: {} as never,
    };
    const offlineProfile = { ...DEFAULT_PROFILE, offline: true };
    expect(satisfiesHardRequirements(stack as never, offlineProfile)).toBe(false);
  });
});

describe("tech-stack-recommender scorecard", () => {
  it("buildScorecard returns 5 axes with weightedScore = raw * weight", () => {
    const raw = { hiring: 8, shiptime: 7, scale: 9, cost: 6, ecosystem: 10 };
    const weights: ScoreWeights = { hiring: 0.2, shiptime: 0.2, scale: 0.2, cost: 0.2, ecosystem: 0.2 };
    const sc = buildScorecard(raw, weights);
    expect(sc).toHaveLength(5);
    expect(sc[0].weightedScore).toBeCloseTo(1.6, 5);
    expect(sc[4].weightedScore).toBeCloseTo(2.0, 5);
  });

  it("totalScore sums weighted scores", () => {
    const raw = { hiring: 8, shiptime: 7, scale: 9, cost: 6, ecosystem: 10 };
    const sc = buildScorecard(raw, DEFAULT_WEIGHTS);
    const t = totalScore(sc);
    expect(t).toBeCloseTo(
      8 * DEFAULT_WEIGHTS.hiring + 7 * DEFAULT_WEIGHTS.shiptime + 9 * DEFAULT_WEIGHTS.scale + 6 * DEFAULT_WEIGHTS.cost + 10 * DEFAULT_WEIGHTS.ecosystem,
      5,
    );
  });

  it("weights are carried into each axis", () => {
    const sc = buildScorecard({ hiring: 5, shiptime: 5, scale: 5, cost: 5, ecosystem: 5 }, DEFAULT_WEIGHTS);
    expect(sc[0].weight).toBe(DEFAULT_WEIGHTS.hiring);
    expect(sc[4].weight).toBe(DEFAULT_WEIGHTS.ecosystem);
  });
});

describe("tech-stack-recommender recommend()", () => {
  it("returns a primary + alternatives + honesty notes", () => {
    const rec = recommend(DEFAULT_PROFILE, DEFAULT_WEIGHTS);
    expect(rec.primary).toBeDefined();
    expect(rec.primary.name.length).toBeGreaterThan(0);
    expect(rec.alternatives.length).toBeGreaterThanOrEqual(2);
    expect(rec.alternatives.length).toBeLessThanOrEqual(3);
    expect(rec.honestyNotes.length).toBeGreaterThanOrEqual(3);
    expect(rec.generatedAt).toBeGreaterThan(0);
  });

  it("primary has higher totalScore than alternatives", () => {
    const rec = recommend(DEFAULT_PROFILE, DEFAULT_WEIGHTS);
    for (const alt of rec.alternatives) {
      expect(rec.primary.totalScore).toBeGreaterThanOrEqual(alt.totalScore);
    }
  });

  it("primary has 5 choices (frontend, backend, database, hosting, auth)", () => {
    const rec = recommend(DEFAULT_PROFILE, DEFAULT_WEIGHTS);
    expect(rec.primary.choices.frontend).toBeDefined();
    expect(rec.primary.choices.backend).toBeDefined();
    expect(rec.primary.choices.database).toBeDefined();
    expect(rec.primary.choices.hosting).toBeDefined();
    expect(rec.primary.choices.auth).toBeDefined();
  });

  it("is deterministic — same inputs → same output", () => {
    const r1 = recommend(DEFAULT_PROFILE, DEFAULT_WEIGHTS);
    const r2 = recommend(DEFAULT_PROFILE, DEFAULT_WEIGHTS);
    expect(r1.primary.id).toBe(r2.primary.id);
    expect(r1.primary.totalScore).toBeCloseTo(r2.primary.totalScore, 5);
    expect(r1.alternatives.map((a) => a.id)).toEqual(r2.alternatives.map((a) => a.id));
  });

  it("HIPAA profile excludes stacks without HIPAA support from primary", () => {
    const hipaaProfile: ProductProfile = {
      ...DEFAULT_PROFILE, compliance: "hipaa", teamSize: "large", budget: "enterprise",
      skills: ["java"], timeline: "year", scale: "large",
    };
    const rec = recommend(hipaaProfile, DEFAULT_WEIGHTS);
    // Stacks that support HIPAA: vue-go-postgres, remix-rust-postgres, angular-spring-mysql
    const hipaaStackIds = ["vue-go-postgres", "remix-rust-postgres", "angular-spring-mysql"];
    expect(hipaaStackIds).toContain(rec.primary.id);
  });

  it("offline profile excludes non-offline stacks", () => {
    const offlineProfile: ProductProfile = {
      ...DEFAULT_PROFILE, offline: true, compliance: "soc2",
      skills: ["java"], teamSize: "medium", timeline: "quarter",
    };
    const rec = recommend(offlineProfile, DEFAULT_WEIGHTS);
    const offlineStackIds = ["vue-go-postgres", "remix-rust-postgres", "angular-spring-mysql"];
    expect(offlineStackIds).toContain(rec.primary.id);
  });

  it("adjustable weights change the winner", () => {
    // Heavy weight on scale should favor high-scale stacks
    const scaleHeavy: ScoreWeights = { hiring: 0.05, shiptime: 0.05, scale: 0.80, cost: 0.05, ecosystem: 0.05 };
    const rec = recommend(DEFAULT_PROFILE, scaleHeavy);
    // Top scale stacks: remix-rust-postgres (10), vue-go-postgres (10), angular-spring-mysql (9)
    expect(["remix-rust-postgres", "vue-go-postgres", "angular-spring-mysql"]).toContain(rec.primary.id);
  });

  it("includes cost estimate and scale ceiling where applicable", () => {
    const rec = recommend(DEFAULT_PROFILE, DEFAULT_WEIGHTS);
    // Every stack has a database choice with costEstimate
    expect(rec.primary.choices.database.costEstimate).toBeDefined();
    // Every stack has a backend choice with scaleCeiling
    expect(rec.primary.choices.backend.scaleCeiling).toBeDefined();
  });

  it("honors realtime requirement (penalizes non-realtime stacks)", () => {
    const realtimeProfile: ProductProfile = {
      ...DEFAULT_PROFILE, productType: "realtime-collab", realtime: true,
      skills: ["typescript"], teamSize: "small",
    };
    const rec = recommend(realtimeProfile, DEFAULT_WEIGHTS);
    // Realtime-capable stacks: next-fastify-postgres, vue-go-postgres, remix-rust-postgres, angular-spring-mysql
    const realtimeStackIds = ["next-fastify-postgres", "vue-go-postgres", "remix-rust-postgres", "angular-spring-mysql"];
    expect(realtimeStackIds).toContain(rec.primary.id);
  });

  it("primary has 1–5 stars", () => {
    const rec = recommend(DEFAULT_PROFILE, DEFAULT_WEIGHTS);
    expect(rec.primary.stars).toBeGreaterThanOrEqual(1);
    expect(rec.primary.stars).toBeLessThanOrEqual(5);
  });
});

describe("tech-stack-recommender compareStacks()", () => {
  it("produces per-axis deltas and an overall winner", () => {
    const rec = recommend(DEFAULT_PROFILE, DEFAULT_WEIGHTS);
    const left = rec.primary;
    const right = rec.alternatives[0];
    const cmp = compareStacks(left, right);
    expect(cmp.deltas).toHaveLength(5);
    expect(["left", "right", "tie"]).toContain(cmp.overallWinner);
  });

  it("tie when scores are identical", () => {
    const rec = recommend(DEFAULT_PROFILE, DEFAULT_WEIGHTS);
    const cmp = compareStacks(rec.primary, rec.primary);
    expect(cmp.overallWinner).toBe("tie");
    expect(cmp.totalDelta).toBeCloseTo(0, 5);
  });

  it("delta sign matches winner", () => {
    const rec = recommend(DEFAULT_PROFILE, DEFAULT_WEIGHTS);
    const cmp = compareStacks(rec.primary, rec.alternatives[0]);
    if (cmp.overallWinner === "left") expect(cmp.totalDelta).toBeGreaterThan(0);
    else if (cmp.overallWinner === "right") expect(cmp.totalDelta).toBeLessThan(0);
  });
});

describe("tech-stack-recommender render", () => {
  it("renderAdr produces Markdown with ADR header + Context + Decision + Scorecard + Alternatives + Honesty + Consequences", () => {
    const rec = recommend(DEFAULT_PROFILE, DEFAULT_WEIGHTS);
    const md = renderAdr(rec);
    expect(md).toContain("# ADR: Tech Stack Selection");
    expect(md).toContain("## Context");
    expect(md).toContain("## Decision");
    expect(md).toContain("## Scorecard");
    expect(md).toContain("## Alternatives considered");
    expect(md).toContain("## Honesty notes");
    expect(md).toContain("## Consequences");
    expect(md).toContain(rec.primary.name);
  });

  it("renderText produces compact text with primary + alternatives + honesty", () => {
    const rec = recommend(DEFAULT_PROFILE, DEFAULT_WEIGHTS);
    const txt = renderText(rec);
    expect(txt).toContain("Tech Stack Recommendation");
    expect(txt).toContain("Layers:");
    expect(txt).toContain("Alternatives:");
    expect(txt).toContain("Honesty notes:");
  });

  it("renderJson produces valid JSON with expected keys", () => {
    const rec = recommend(DEFAULT_PROFILE, DEFAULT_WEIGHTS);
    const json = renderJson(rec);
    const parsed = JSON.parse(json);
    expect(parsed.primary).toBeDefined();
    expect(parsed.primary.id).toBe(rec.primary.id);
    expect(parsed.alternatives).toBeInstanceOf(Array);
    expect(parsed.honestyNotes).toBeInstanceOf(Array);
    expect(parsed.profile).toBeDefined();
  });
});

describe("tech-stack-recommender history", () => {
  it("loadHistory returns [] when empty", () => {
    expect(loadHistory()).toEqual([]);
  });

  it("saveHistory stores entry and limits to HISTORY_MAX", () => {
    for (let i = 0; i < HISTORY_MAX + 5; i++) {
      saveHistory({
        ts: Date.now() + i,
        productType: "saas-web",
        teamSize: "small",
        primaryStackId: "next-fastify-postgres",
        primaryStackName: "Next.js + Node/Fastify + Postgres",
        totalScore: 8.5,
      });
    }
    const hist = loadHistory();
    expect(hist).toHaveLength(HISTORY_MAX);
    expect(hist[0]).toBeDefined();
  });

  it("saveHistory prepends (newest first)", () => {
    saveHistory({ ts: 1000, productType: "saas-web", teamSize: "small", primaryStackId: "a", primaryStackName: "A", totalScore: 7 });
    saveHistory({ ts: 2000, productType: "saas-web", teamSize: "small", primaryStackId: "b", primaryStackName: "B", totalScore: 8 });
    const hist = loadHistory();
    expect(hist[0].primaryStackId).toBe("b");
    expect(hist[1].primaryStackId).toBe("a");
  });

  it("clearHistory removes all entries", () => {
    saveHistory({ ts: 1, productType: "saas-web", teamSize: "small", primaryStackId: "x", primaryStackName: "X", totalScore: 5 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });

  it("uses the correct localStorage key", () => {
    saveHistory({ ts: 1, productType: "saas-web", teamSize: "small", primaryStackId: "x", primaryStackName: "X", totalScore: 5 });
    const raw = localStorage.getItem(HISTORY_KEY);
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw as string).length).toBe(1);
  });
});

describe("tech-stack-recommender share URL", () => {
  it("buildShareUrl encodes profile fields", () => {
    const url = buildShareUrl({ productType: "saas-web", teamSize: "small", skills: ["typescript", "javascript"] });
    expect(url).toContain("productType=saas-web");
    expect(url).toContain("teamSize=small");
    expect(url).toContain("skills=typescript%2Cjavascript");
  });

  it("buildShareUrl encodes weights with w_ prefix", () => {
    const url = buildShareUrl({}, { hiring: 0.5, scale: 0.3 });
    expect(url).toContain("w_hiring=0.5");
    expect(url).toContain("w_scale=0.3");
  });

  it("parseShareUrl round-trips profile + weights", () => {
    const profile: Partial<ProductProfile> = {
      productType: "ecommerce", teamSize: "medium", skills: ["typescript", "python"],
      timeline: "quarter", scale: "large", budget: "comfortable", compliance: "gdpr",
      offline: true, realtime: true, seoCritical: true,
    };
    const weights: Partial<ScoreWeights> = { hiring: 0.3, shiptime: 0.2, scale: 0.2, cost: 0.15, ecosystem: 0.15 };
    const url = buildShareUrl(profile, weights);
    const parsed = parseShareUrl(url);
    expect(parsed.profile.productType).toBe("ecommerce");
    expect(parsed.profile.teamSize).toBe("medium");
    expect(parsed.profile.skills).toEqual(["typescript", "python"]);
    expect(parsed.profile.timeline).toBe("quarter");
    expect(parsed.profile.scale).toBe("large");
    expect(parsed.profile.budget).toBe("comfortable");
    expect(parsed.profile.compliance).toBe("gdpr");
    expect(parsed.profile.offline).toBe(true);
    expect(parsed.profile.realtime).toBe(true);
    expect(parsed.profile.seoCritical).toBe(true);
    expect(parsed.weights.hiring).toBeCloseTo(0.3, 5);
    expect(parsed.weights.ecosystem).toBeCloseTo(0.15, 5);
  });

  it("parseShareUrl rejects invalid enum values", () => {
    const url = "#productType=bogus&teamSize=huge&compliance=none";
    const parsed = parseShareUrl(url);
    expect(parsed.profile.productType).toBeUndefined();
    expect(parsed.profile.teamSize).toBeUndefined();
    // compliance "none" is valid
    expect(parsed.profile.compliance).toBe("none");
  });

  it("parseShareUrl rejects out-of-range weights", () => {
    const url = "#w_hiring=2.5&w_scale=-0.5&w_cost=0.25";
    const parsed = parseShareUrl(url);
    expect(parsed.weights.hiring).toBeUndefined();
    expect(parsed.weights.scale).toBeUndefined();
    expect(parsed.weights.cost).toBeCloseTo(0.25, 5);
  });

  it("parseShareUrl returns empty for empty hash", () => {
    expect(parseShareUrl("")).toEqual({ profile: {}, weights: {} });
    expect(parseShareUrl("#")).toEqual({ profile: {}, weights: {} });
  });
});

describe("tech-stack-recommender LLM prompt", () => {
  it("buildLlmPrompt includes profile + primary stack details", () => {
    const rec = recommend(DEFAULT_PROFILE, DEFAULT_WEIGHTS);
    const p = buildLlmPrompt(DEFAULT_PROFILE, rec.primary);
    expect(p.system.length).toBeGreaterThan(0);
    expect(p.user).toContain(PRODUCT_TYPE_LABELS[DEFAULT_PROFILE.productType]);
    expect(p.user).toContain(rec.primary.name);
    expect(p.user).toContain("Scorecard");
    expect(p.user).toContain("Honest");
  });

  it("renderLlmResult strips markdown fences", () => {
    expect(renderLlmResult("```\ncode\n```")).toBe("code");
    expect(renderLlmResult("```md\n# Title\n```")).toBe("# Title");
    expect(renderLlmResult("plain text")).toBe("plain text");
  });
});
