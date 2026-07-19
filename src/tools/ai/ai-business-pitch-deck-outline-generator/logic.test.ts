import { describe, it, expect, beforeEach } from "vitest";
import {
  HISTORY_KEY,
  HISTORY_MAX,
  LLM_KEY_STORAGE,
  STAGE_LABELS,
  FIELD_HINTS,
  SLIDE_SEQUENCE,
  SLIDE_TITLES,
  validateInputs,
  capitalize,
  lcFirst,
  escapeRegex,
  parseRaise,
  formatRaise,
  buildSlide,
  checkNarrativeArc,
  deriveUseOfFunds,
  deriveMilestones,
  generate,
  renderMarkdown,
  renderSpeakerNotes,
  renderJson,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  renderLlmResult,
  type PitchInputs,
  type Stage,
  type SlideId,
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

const FULL_INPUTS: PitchInputs = {
  companyName: "Ledgerloop",
  oneLiner: "Honest accounting software for indie creators.",
  industry: "fintech",
  stage: "seed",
  targetRaise: "$1.5M",
  problem: "Indie creators spend 6+ hours per month on bookkeeping with tools built for SMBs.",
  solution: "Auto-categorize Stripe/PayPal income, auto-match receipts, file Schedule C in one click.",
  audience: "US-based indie creators earning $50k–$500k per year",
  whyNow: "1099 worker growth since 2020, Stripe/PayPal API maturity, and IRS e-file modernization.",
  teamCredibility: "Founder was CPA at a top-50 firm; CTO built the tax engine at TurboTax for 5 years.",
  traction: "1,200 paid users, $18k MRR, 12% MoM growth, 4 published case studies.",
};

// ---------- Constants & hints ----------

describe("ai-pitch-deck constants & hints", () => {
  it("has 4 stages", () => {
    expect(Object.keys(STAGE_LABELS)).toHaveLength(4);
  });
  it("has slide sequences for all 4 stages", () => {
    for (const s of Object.keys(STAGE_LABELS) as Stage[]) {
      expect(SLIDE_SEQUENCE[s].length).toBeGreaterThanOrEqual(10);
    }
  });
  it("seed and series-a include all canonical fundraising slides", () => {
    const seedSlides = SLIDE_SEQUENCE.seed;
    for (const required of ["problem", "solution", "market", "product", "traction", "business-model", "team", "ask"] as SlideId[]) {
      expect(seedSlides).toContain(required);
    }
    const seriesASlides = SLIDE_SEQUENCE["series-a"];
    for (const required of ["problem", "solution", "market", "product", "traction", "business-model", "gtm", "competition", "team", "ask"] as SlideId[]) {
      expect(seriesASlides).toContain(required);
    }
  });
  it("sales deck reorders to lead with customer value and swaps Financials → Pricing", () => {
    const sales = SLIDE_SEQUENCE.sales;
    expect(sales).toContain("pricing");
    expect(sales).not.toContain("financials");
    expect(sales).toContain("closing");
    // Sales deck should not include Ask (fundraising slide)
    expect(sales).not.toContain("ask");
  });
  it("pre-seed deck is lean (10 slides)", () => {
    expect(SLIDE_SEQUENCE["pre-seed"].length).toBe(10);
  });
  it("series-a deck is the most comprehensive (12 slides)", () => {
    expect(SLIDE_SEQUENCE["series-a"].length).toBe(12);
  });
  it("has titles for all known slide ids", () => {
    const allIds: SlideId[] = [
      "title", "problem", "solution", "market", "product", "traction",
      "business-model", "gtm", "competition", "team", "financials",
      "pricing", "ask", "why-now", "closing",
    ];
    for (const id of allIds) {
      expect(SLIDE_TITLES[id]).toBeTruthy();
    }
  });
  it("has hints for all 11 input fields", () => {
    const keys = Object.keys(FIELD_HINTS);
    expect(keys).toEqual(
      expect.arrayContaining([
        "companyName", "oneLiner", "industry", "stage", "targetRaise",
        "problem", "solution", "audience", "whyNow", "teamCredibility", "traction",
      ]),
    );
    expect(keys).toHaveLength(11);
    for (const k of keys) {
      expect(FIELD_HINTS[k as keyof PitchInputs].hint.length).toBeGreaterThan(10);
      expect(FIELD_HINTS[k as keyof PitchInputs].sample.length).toBeGreaterThan(0);
    }
  });
  it("respects standard history limit", () => {
    expect(HISTORY_MAX).toBe(20);
  });
});

// ---------- Helpers ----------

describe("ai-pitch-deck helpers", () => {
  it("capitalizes first char only", () => {
    expect(capitalize("hello")).toBe("Hello");
    expect(capitalize("Hello")).toBe("Hello");
    expect(capitalize("")).toBe("");
  });
  it("lowercases first char only", () => {
    expect(lcFirst("Hello")).toBe("hello");
    expect(lcFirst("hello")).toBe("hello");
    expect(lcFirst("")).toBe("");
  });
  it("escapes regex special chars", () => {
    expect(escapeRegex("a.b*c")).toBe("a\\.b\\*c");
  });
  it("parses raise strings with $ and suffixes", () => {
    expect(parseRaise("$1.5M")).toBe(1_500_000);
    expect(parseRaise("$500K")).toBe(500_000);
    expect(parseRaise("$2B")).toBe(2_000_000_000);
    expect(parseRaise("1500000")).toBe(1_500_000);
    expect(parseRaise("$1,500,000")).toBe(1_500_000);
  });
  it("returns NaN for invalid raise strings", () => {
    expect(parseRaise("")).toBe(NaN);
    expect(parseRaise("abc")).toBe(NaN);
    expect(parseRaise("$")).toBe(NaN);
  });
  it("formats numbers as USD with K/M/B suffixes", () => {
    expect(formatRaise(1_500_000)).toBe("$1.5M");
    expect(formatRaise(500_000)).toBe("$500K");
    expect(formatRaise(2_000_000_000)).toBe("$2B");
    expect(formatRaise(750)).toBe("$750");
  });
  it("returns empty string for non-finite numbers", () => {
    expect(formatRaise(NaN)).toBe("");
  });
});

// ---------- Validation ----------

describe("ai-pitch-deck validation", () => {
  it("flags missing required fields", () => {
    const w = validateInputs({} as PitchInputs);
    expect(w.length).toBeGreaterThanOrEqual(6);
    expect(w.some((x) => x.includes("Company name"))).toBe(true);
    expect(w.some((x) => x.includes("Problem"))).toBe(true);
    expect(w.some((x) => x.includes("Solution"))).toBe(true);
  });
  it("passes clean inputs with no warnings", () => {
    const w = validateInputs(FULL_INPUTS);
    expect(w).toEqual([]);
  });
  it("warns when target raise is missing for fundraising stages", () => {
    const w = validateInputs({ ...FULL_INPUTS, targetRaise: "" });
    expect(w.some((x) => x.includes("Target raise"))).toBe(true);
  });
  it("does not warn about target raise for sales decks", () => {
    const w = validateInputs({ ...FULL_INPUTS, stage: "sales", targetRaise: "" });
    expect(w.some((x) => x.includes("Target raise"))).toBe(false);
  });
  it("warns when whyNow is missing", () => {
    const w = validateInputs({ ...FULL_INPUTS, whyNow: "" });
    expect(w.some((x) => x.includes("'Why now'"))).toBe(true);
  });
  it("warns when team credibility is missing", () => {
    const w = validateInputs({ ...FULL_INPUTS, teamCredibility: "" });
    expect(w.some((x) => x.includes("Team credibility"))).toBe(true);
  });
  it("warns when problem is too short", () => {
    const w = validateInputs({ ...FULL_INPUTS, problem: "It's hard" });
    expect(w.some((x) => x.includes("Problem is very short"))).toBe(true);
  });
  it("warns when one-liner is overlong", () => {
    const w = validateInputs({ ...FULL_INPUTS, oneLiner: "x".repeat(250) });
    expect(w.some((x) => x.includes("One-liner is over 200"))).toBe(true);
  });
});

// ---------- Slide builders ----------

describe("ai-pitch-deck buildSlide", () => {
  it("builds each slide with all required fields", () => {
    const allIds: SlideId[] = [
      "title", "problem", "solution", "why-now", "market", "product",
      "traction", "business-model", "gtm", "competition", "team",
      "financials", "pricing", "ask", "closing",
    ];
    for (const id of allIds) {
      const s = buildSlide(id, FULL_INPUTS);
      expect(s.id).toBe(id);
      expect(s.title).toBeTruthy();
      expect(s.purpose.length).toBeGreaterThan(10);
      expect(Array.isArray(s.talkingPoints)).toBe(true);
      expect(Array.isArray(s.investorExpectations)).toBe(true);
      expect(Array.isArray(s.pitfalls)).toBe(true);
      expect(typeof s.speakerNotes).toBe("string");
    }
  });
  it("title slide includes the company name and one-liner", () => {
    const s = buildSlide("title", FULL_INPUTS);
    expect(s.talkingPoints.some((t) => t.includes("Ledgerloop"))).toBe(true);
    expect(s.talkingPoints.some((t) => t.includes("Honest accounting"))).toBe(true);
  });
  it("problem slide mentions the audience", () => {
    const s = buildSlide("problem", FULL_INPUTS);
    expect(s.talkingPoints.some((t) => t.includes("indie creators"))).toBe(true);
  });
  it("ask slide includes the target raise amount", () => {
    const s = buildSlide("ask", FULL_INPUTS);
    expect(s.talkingPoints.some((t) => t.includes("$1.5M"))).toBe(true);
  });
  it("why-now slide includes the user's whyNow input", () => {
    const s = buildSlide("why-now", FULL_INPUTS);
    expect(s.talkingPoints.some((t) => t.includes("1099 worker"))).toBe(true);
  });
  it("team slide includes the team credibility input", () => {
    const s = buildSlide("team", FULL_INPUTS);
    expect(s.talkingPoints.some((t) => t.includes("CPA"))).toBe(true);
  });
  it("each slide has at least 3 talking points", () => {
    for (const id of SLIDE_SEQUENCE.seed) {
      const s = buildSlide(id, FULL_INPUTS);
      expect(s.talkingPoints.length).toBeGreaterThanOrEqual(3);
    }
  });
  it("each slide has at least 2 investor expectations", () => {
    for (const id of SLIDE_SEQUENCE.seed) {
      const s = buildSlide(id, FULL_INPUTS);
      expect(s.investorExpectations.length).toBeGreaterThanOrEqual(2);
    }
  });
  it("each slide has at least 2 pitfalls", () => {
    for (const id of SLIDE_SEQUENCE.seed) {
      const s = buildSlide(id, FULL_INPUTS);
      expect(s.pitfalls.length).toBeGreaterThanOrEqual(2);
    }
  });
  it("speaker notes are non-empty and substantive", () => {
    for (const id of SLIDE_SEQUENCE.seed) {
      const s = buildSlide(id, FULL_INPUTS);
      expect(s.speakerNotes.length).toBeGreaterThan(30);
    }
  });
});

// ---------- Narrative arc ----------

describe("ai-pitch-deck narrative arc check", () => {
  it("returns ok=true for strong inputs", () => {
    const n = checkNarrativeArc(FULL_INPUTS);
    expect(n.ok).toBe(true);
    expect(n.checks).toHaveLength(4);
    expect(n.checks.every((c) => c.status === "ok")).toBe(true);
  });
  it("flags missing problem", () => {
    const n = checkNarrativeArc({ ...FULL_INPUTS, problem: "" });
    const problemCheck = n.checks.find((c) => c.name === "problem");
    expect(problemCheck?.status).toBe("missing");
    expect(n.ok).toBe(false);
  });
  it("flags weak problem (no number)", () => {
    const n = checkNarrativeArc({ ...FULL_INPUTS, problem: "Indie creators struggle with bookkeeping." });
    const problemCheck = n.checks.find((c) => c.name === "problem");
    expect(problemCheck?.status).toBe("weak");
  });
  it("flags missing solution", () => {
    const n = checkNarrativeArc({ ...FULL_INPUTS, solution: "" });
    expect(n.checks.find((c) => c.name === "solution")?.status).toBe("missing");
  });
  it("flags missing whyNow", () => {
    const n = checkNarrativeArc({ ...FULL_INPUTS, whyNow: "" });
    expect(n.checks.find((c) => c.name === "why-now")?.status).toBe("missing");
  });
  it("flags weak whyNow (no shift keyword)", () => {
    const n = checkNarrativeArc({ ...FULL_INPUTS, whyNow: "It's a good time for this." });
    expect(n.checks.find((c) => c.name === "why-now")?.status).toBe("weak");
  });
  it("flags missing team credibility", () => {
    const n = checkNarrativeArc({ ...FULL_INPUTS, teamCredibility: "" });
    expect(n.checks.find((c) => c.name === "why-you")?.status).toBe("missing");
  });
  it("flags weak team (no specific role/outcome)", () => {
    const n = checkNarrativeArc({ ...FULL_INPUTS, teamCredibility: "We're a great team." });
    expect(n.checks.find((c) => c.name === "why-you")?.status).toBe("weak");
  });
  it("summary mentions missing count when something is missing", () => {
    const n = checkNarrativeArc({ ...FULL_INPUTS, problem: "" });
    expect(n.summary).toContain("missing");
  });
  it("summary says solid when all ok", () => {
    const n = checkNarrativeArc(FULL_INPUTS);
    expect(n.summary.toLowerCase()).toContain("solid");
  });
});

// ---------- Use of funds ----------

describe("ai-pitch-deck use of funds", () => {
  it("returns 4 categories for fundraising stages", () => {
    for (const stage of ["pre-seed", "seed", "series-a"] as Stage[]) {
      const u = deriveUseOfFunds({ ...FULL_INPUTS, stage });
      expect(u.length).toBe(4);
    }
  });
  it("returns empty for sales decks", () => {
    const u = deriveUseOfFunds({ ...FULL_INPUTS, stage: "sales" });
    expect(u).toEqual([]);
  });
  it("percentages sum to 100", () => {
    for (const stage of ["pre-seed", "seed", "series-a"] as Stage[]) {
      const u = deriveUseOfFunds({ ...FULL_INPUTS, stage });
      const sum = u.reduce((acc, x) => acc + x.percentage, 0);
      expect(sum).toBe(100);
    }
  });
  it("each item has a non-empty rationale", () => {
    const u = deriveUseOfFunds(FULL_INPUTS);
    for (const x of u) {
      expect(x.category.length).toBeGreaterThan(0);
      expect(x.rationale.length).toBeGreaterThan(10);
    }
  });
  it("pre-seed biases toward engineering", () => {
    const u = deriveUseOfFunds({ ...FULL_INPUTS, stage: "pre-seed" });
    const eng = u.find((x) => x.category.toLowerCase().includes("engineering"));
    expect(eng?.percentage).toBeGreaterThanOrEqual(50);
  });
  it("series-a biases toward go-to-market", () => {
    const u = deriveUseOfFunds({ ...FULL_INPUTS, stage: "series-a" });
    const gtm = u.find((x) => x.category.toLowerCase().includes("go-to-market"));
    expect(gtm?.percentage).toBeGreaterThanOrEqual(40);
  });
});

// ---------- Milestones ----------

describe("ai-pitch-deck milestones", () => {
  it("returns 3 milestones for fundraising stages", () => {
    for (const stage of ["pre-seed", "seed", "series-a"] as Stage[]) {
      const m = deriveMilestones({ ...FULL_INPUTS, stage });
      expect(m.length).toBe(3);
    }
  });
  it("returns empty for sales decks", () => {
    const m = deriveMilestones({ ...FULL_INPUTS, stage: "sales" });
    expect(m).toEqual([]);
  });
  it("each milestone has timeframe, goal, and metric", () => {
    const m = deriveMilestones(FULL_INPUTS);
    for (const x of m) {
      expect(x.timeframe.length).toBeGreaterThan(0);
      expect(x.goal.length).toBeGreaterThan(0);
      expect(x.metric.length).toBeGreaterThan(0);
    }
  });
  it("milestone timeframes include a runway number", () => {
    const m = deriveMilestones(FULL_INPUTS);
    expect(m[0].timeframe).toMatch(/\d+\s*months/);
  });
});

// ---------- Generate ----------

describe("ai-pitch-deck generate", () => {
  it("produces the correct slide count per stage", () => {
    for (const stage of Object.keys(STAGE_LABELS) as Stage[]) {
      const out = generate({ ...FULL_INPUTS, stage });
      expect(out.slideCount).toBe(SLIDE_SEQUENCE[stage].length);
      expect(out.slides.length).toBe(SLIDE_SEQUENCE[stage].length);
    }
  });
  it("includes narrative check in output", () => {
    const out = generate(FULL_INPUTS);
    expect(out.narrative.checks).toHaveLength(4);
  });
  it("includes use of funds in output for fundraising stages", () => {
    const out = generate(FULL_INPUTS);
    expect(out.useOfFunds.length).toBe(4);
  });
  it("includes milestones in output for fundraising stages", () => {
    const out = generate(FULL_INPUTS);
    expect(out.milestones.length).toBe(3);
  });
  it("includes warnings in output", () => {
    const out = generate({ ...FULL_INPUTS, problem: "" });
    expect(out.warnings.some((x) => x.includes("Problem"))).toBe(true);
  });
  it("sales deck does not include use-of-funds or milestones", () => {
    const out = generate({ ...FULL_INPUTS, stage: "sales" });
    expect(out.useOfFunds).toEqual([]);
    expect(out.milestones).toEqual([]);
  });
});

// ---------- Render ----------

describe("ai-pitch-deck render", () => {
  const out = generate(FULL_INPUTS);
  it("renders Markdown with title and slide-by-slide outline", () => {
    const md = renderMarkdown(out, FULL_INPUTS);
    expect(md).toContain("# Ledgerloop");
    expect(md).toContain("Narrative arc");
    expect(md).toContain("Slide-by-slide outline");
    expect(md).toContain("Use of funds");
    expect(md).toContain("Milestones for this raise");
    expect(md).toContain("Honesty");
  });
  it("renders speaker notes with all slides", () => {
    const sn = renderSpeakerNotes(out);
    expect(sn).toContain("Speaker notes");
    for (const s of out.slides) {
      expect(sn).toContain(s.title);
    }
  });
  it("renders JSON that round-trips", () => {
    const json = renderJson(out, FULL_INPUTS);
    const parsed = JSON.parse(json);
    expect(parsed.inputs).toEqual(FULL_INPUTS);
    expect(parsed.output.slides.length).toBe(out.slides.length);
    expect(parsed.generatedAt).toBeTruthy();
  });
});

// ---------- History ----------

describe("ai-pitch-deck history", () => {
  it("starts empty", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads history entries", () => {
    const entry: HistoryEntry = {
      ts: Date.now(),
      companyName: "Ledgerloop",
      industry: "fintech",
      stage: "seed",
      targetRaise: "$1.5M",
      slideCount: 11,
    };
    saveHistory(entry);
    const loaded = loadHistory();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].companyName).toBe("Ledgerloop");
  });
  it("caps history at HISTORY_MAX", () => {
    for (let i = 0; i < HISTORY_MAX + 5; i++) {
      saveHistory({
        ts: i, companyName: `c${i}`, industry: "x",
        stage: "seed", targetRaise: "$1M", slideCount: 11,
      });
    }
    expect(loadHistory().length).toBe(HISTORY_MAX);
  });
  it("clears history", () => {
    saveHistory({
      ts: 1, companyName: "x", industry: "x", stage: "seed", targetRaise: "$1M", slideCount: 11,
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
  it("does not throw when localStorage is unavailable", () => {
    (globalThis as Record<string, unknown>).localStorage = undefined;
    expect(() => loadHistory()).not.toThrow();
    expect(() => clearHistory()).not.toThrow();
  });
});

// ---------- Share URL ----------

describe("ai-pitch-deck share URL", () => {
  it("builds a URL with encoded inputs", () => {
    const url = buildShareUrl(FULL_INPUTS);
    expect(url).toContain("co=Ledgerloop");
    expect(url).toContain("ind=fintech");
    expect(url).toContain("raise=");
  });
  it("omits default stage (seed) from URL", () => {
    const url = buildShareUrl(FULL_INPUTS); // stage is seed
    expect(url).not.toContain("stage=");
  });
  it("includes non-default stage in URL", () => {
    const url = buildShareUrl({ ...FULL_INPUTS, stage: "series-a" });
    expect(url).toContain("stage=series-a");
  });
  it("parses a share URL back into inputs", () => {
    const url = buildShareUrl({ ...FULL_INPUTS, stage: "series-a" });
    const state = parseShareUrl(url);
    expect(state.inputs.companyName).toBe("Ledgerloop");
    expect(state.inputs.industry).toBe("fintech");
    expect(state.inputs.stage).toBe("series-a");
    expect(state.inputs.targetRaise).toBe("$1.5M");
  });
  it("returns empty state for empty hash", () => {
    const state = parseShareUrl("");
    expect(state.inputs).toEqual({});
  });
  it("ignores invalid stage in share URL", () => {
    const url = buildShareUrl(FULL_INPUTS).replace("seed", "xyz");
    const state = parseShareUrl(url);
    // stage falls back to default (seed) since xyz is invalid
    expect(state.inputs.stage ?? "seed").toBe("seed");
  });
});

// ---------- LLM ----------

describe("ai-pitch-deck LLM", () => {
  it("builds a prompt mentioning inputs and slide sequence", () => {
    const slideTitles = ["Title", "Problem", "Solution"];
    const prompt = buildLlmPrompt(FULL_INPUTS, slideTitles);
    expect(prompt).toContain("Inputs:");
    expect(prompt).toContain("Ledgerloop");
    expect(prompt).toContain("fintech");
    expect(prompt).toContain("Title");
    expect(prompt).toContain("JSON");
  });
  it("parses a valid LLM JSON response", () => {
    const raw = JSON.stringify({
      refinedSlides: [
        { id: "Problem", title: "Problem", refinedTalkingPoints: [" Indie creators lose 6+ hours/month to SMB bookkeeping tools."] },
      ],
      narrativeSuggestions: ["Tighten the problem by adding the dollar cost."],
      openQuestions: ["What's your CAC?"],
    });
    const r = renderLlmResult(raw);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.result.refinedSlides).toHaveLength(1);
      expect(r.result.refinedSlides[0].title).toBe("Problem");
      expect(r.result.narrativeSuggestions).toHaveLength(1);
      expect(r.result.openQuestions).toHaveLength(1);
    }
  });
  it("rejects invalid JSON", () => {
    const r = renderLlmResult("not json");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("JSON");
  });
  it("rejects non-object JSON", () => {
    const r = renderLlmResult("[1,2,3]");
    expect(r.ok).toBe(false);
  });
  it("strips markdown code fences", () => {
    const raw = "```json\n" + JSON.stringify({ refinedSlides: [], narrativeSuggestions: [], openQuestions: [] }) + "\n```";
    const r = renderLlmResult(raw);
    expect(r.ok).toBe(true);
  });
  it("tolerates missing fields", () => {
    const r = renderLlmResult(JSON.stringify({}));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.result.refinedSlides).toEqual([]);
      expect(r.result.narrativeSuggestions).toEqual([]);
      expect(r.result.openQuestions).toEqual([]);
    }
  });
});
