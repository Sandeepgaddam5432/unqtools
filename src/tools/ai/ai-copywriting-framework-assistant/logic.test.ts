import { describe, it, expect, beforeEach } from "vitest";
import {
  HISTORY_KEY,
  HISTORY_MAX,
  SWIPE_KEY,
  SWIPE_MAX,
  LLM_KEY_STORAGE,
  FRAMEWORKS,
  FRAMEWORK_LABELS,
  FRAMEWORK_STAGES,
  FRAMEWORK_EXPLAINERS,
  TONE_LABELS,
  LENGTH_LABELS,
  CHANNEL_LABELS,
  CHANNEL_CTA_PRESETS,
  HYPE_WORDS,
  VARIANT_COUNT,
  validateInputs,
  detectHype,
  escapeRegex,
  countWords,
  pickChannelCta,
  lengthMultiplier,
  buildStageText,
  generateVariants,
  generateAllFrameworks,
  renderPlain,
  renderLabeled,
  renderMarkdown,
  renderJson,
  renderCsv,
  splitCsvRow,
  loadHistory,
  saveHistory,
  clearHistory,
  loadSwipe,
  saveSwipe,
  removeSwipe,
  clearSwipe,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  renderLlmResult,
  type Framework,
  type Tone,
  type Length,
  type Channel,
  type CopyInputs,
} from "./logic";

const FULL_INPUTS: CopyInputs = {
  product: "Acme Attribution",
  audience: "B2B SaaS marketers at $5–50M ARR",
  benefit: "Cuts reporting time from 8 hours/week to 20 minutes/week",
  pain: "Spending Mondays stitching ad-spend data across five platforms in spreadsheets",
  feature: "live pipeline attribution with no SQL required",
  proof: "Loom cut reporting time from 8 hours to 20 minutes per week",
  cta: "Start your free trial",
};

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

// ---------- Constants ----------

describe("ai-copywriting constants", () => {
  it("exposes 5 frameworks", () => {
    expect(FRAMEWORKS).toHaveLength(5);
    expect(FRAMEWORKS).toEqual(["aida", "pas", "fab", "bab", "4ps"]);
  });
  it("has labels for every framework", () => {
    for (const f of FRAMEWORKS) {
      expect(FRAMEWORK_LABELS[f]).toBeTruthy();
    }
  });
  it("has stage lists for every framework (3 or 4 stages)", () => {
    for (const f of FRAMEWORKS) {
      expect(FRAMEWORK_STAGES[f].length).toBeGreaterThanOrEqual(3);
      expect(FRAMEWORK_STAGES[f].length).toBeLessThanOrEqual(4);
    }
  });
  it("has explainers for every framework with non-empty stages", () => {
    for (const f of FRAMEWORKS) {
      const e = FRAMEWORK_EXPLAINERS[f];
      expect(e.stages.length).toBe(FRAMEWORK_STAGES[f].length);
      expect(e.bestFor).toBeTruthy();
      expect(e.watchOut).toBeTruthy();
      for (const s of e.stages) {
        expect(s.what).toBeTruthy();
        expect(s.why).toBeTruthy();
      }
    }
  });
  it("has 5 tones, 3 lengths, 4 channels", () => {
    expect(Object.keys(TONE_LABELS)).toHaveLength(5);
    expect(Object.keys(LENGTH_LABELS)).toHaveLength(3);
    expect(Object.keys(CHANNEL_LABELS)).toHaveLength(4);
  });
  it("exposes channel CTA presets", () => {
    for (const c of Object.keys(CHANNEL_CTA_PRESETS) as Channel[]) {
      expect(CHANNEL_CTA_PRESETS[c].length).toBeGreaterThanOrEqual(3);
    }
  });
  it("has a hype-words list with at least 15 entries", () => {
    expect(HYPE_WORDS.length).toBeGreaterThanOrEqual(15);
  });
  it("variant count is at least 3 per blueprint", () => {
    expect(VARIANT_COUNT).toBeGreaterThanOrEqual(3);
  });
  it("exposes history/swipe/llm-key storage keys", () => {
    expect(HISTORY_KEY).toContain("ai-copywriting-framework-assistant");
    expect(SWIPE_KEY).toContain("ai-copywriting-framework-assistant");
    expect(LLM_KEY_STORAGE).toContain("ai-copywriting-framework-assistant");
  });
  it("caps history at 20 and swipe at 50", () => {
    expect(HISTORY_MAX).toBe(20);
    expect(SWIPE_MAX).toBe(50);
  });
});

// ---------- Validation ----------

describe("ai-copywriting validateInputs", () => {
  it("returns no warnings for full inputs", () => {
    expect(validateInputs(FULL_INPUTS)).toEqual([]);
  });
  it("flags missing product", () => {
    const w = validateInputs({ ...FULL_INPUTS, product: "" });
    expect(w.some((m) => m.includes("Product name"))).toBe(true);
  });
  it("flags thin audience", () => {
    const w = validateInputs({ ...FULL_INPUTS, audience: "x" });
    expect(w.some((m) => m.includes("Audience"))).toBe(true);
  });
  it("flags thin benefit", () => {
    const w = validateInputs({ ...FULL_INPUTS, benefit: "x" });
    expect(w.some((m) => m.includes("Benefit"))).toBe(true);
  });
  it("flags thin pain", () => {
    const w = validateInputs({ ...FULL_INPUTS, pain: "x" });
    expect(w.some((m) => m.includes("Pain"))).toBe(true);
  });
  it("flags missing CTA", () => {
    const w = validateInputs({ ...FULL_INPUTS, cta: "" });
    expect(w.some((m) => m.includes("CTA"))).toBe(true);
  });
  it("flags hype words in benefit", () => {
    const w = validateInputs({ ...FULL_INPUTS, benefit: "The best world-class solution ever" });
    expect(w.some((m) => m.includes("hype"))).toBe(true);
  });
});

// ---------- Helpers ----------

describe("ai-copywriting helpers", () => {
  it("detectHype matches word-boundary, case-insensitive", () => {
    expect(detectHype("This is the BEST tool")).toContain("best");
    expect(detectHype("This is a robustified widget")).not.toContain("robust");
  });
  it("escapeRegex escapes metacharacters", () => {
    expect(escapeRegex("a.b*c?")).toBe("a\\.b\\*c\\?");
  });
  it("countWords handles empty + multi-space", () => {
    expect(countWords("")).toBe(0);
    expect(countWords("  one   two  three  ")).toBe(3);
  });
  it("pickChannelCta cycles variants", () => {
    expect(pickChannelCta("ad", 0)).toBe(CHANNEL_CTA_PRESETS.ad[0]);
    expect(pickChannelCta("ad", 1)).toBe(CHANNEL_CTA_PRESETS.ad[1]);
    expect(pickChannelCta("ad", 99)).toBe(CHANNEL_CTA_PRESETS.ad[99 % CHANNEL_CTA_PRESETS.ad.length]);
  });
  it("lengthMultiplier is 1 for concise and standard, 2 for expanded", () => {
    expect(lengthMultiplier("concise")).toBe(1);
    expect(lengthMultiplier("standard")).toBe(1);
    expect(lengthMultiplier("expanded")).toBe(2);
  });
});

// ---------- Stage builder ----------

describe("ai-copywriting buildStageText", () => {
  it("builds AIDA attention stage", () => {
    const t = buildStageText("aida", "attention", FULL_INPUTS, "professional", 0, "ad");
    expect(t).toContain("Acme Attribution");
  });
  it("builds AIDA action stage with channel CTA", () => {
    const t = buildStageText("aida", "action", FULL_INPUTS, "professional", 0, "email");
    expect(t).toContain("Start your free trial");
    expect(t).toContain(CHANNEL_CTA_PRESETS.email[0]);
  });
  it("builds PAS problem + agitate + solve", () => {
    expect(buildStageText("pas", "problem", FULL_INPUTS, "professional", 0, "ad")).toContain("spreadsheets");
    expect(buildStageText("pas", "agitate", FULL_INPUTS, "professional", 0, "ad")).toContain("compounds");
    expect(buildStageText("pas", "solve", FULL_INPUTS, "professional", 0, "ad")).toContain("Acme Attribution");
  });
  it("builds FAB feature + advantage + benefit", () => {
    expect(buildStageText("fab", "feature", FULL_INPUTS, "professional", 0, "ad")).toContain("live pipeline");
    expect(buildStageText("fab", "benefit", FULL_INPUTS, "professional", 0, "ad")).toContain("reporting time");
  });
  it("builds BAB before + after + bridge", () => {
    expect(buildStageText("bab", "before", FULL_INPUTS, "professional", 0, "ad")).toContain("marketers");
    expect(buildStageText("bab", "after", FULL_INPUTS, "professional", 0, "ad")).toContain("Imagine");
    expect(buildStageText("bab", "bridge", FULL_INPUTS, "professional", 0, "ad")).toContain("Acme Attribution");
  });
  it("builds 4Ps picture + promise + prove + push", () => {
    expect(buildStageText("4ps", "picture", FULL_INPUTS, "professional", 0, "ad")).toContain("Monday");
    expect(buildStageText("4ps", "promise", FULL_INPUTS, "professional", 0, "ad")).toContain("Acme Attribution");
    // prove stage uses lcFirst() on the proof input — match case-insensitively.
    expect(buildStageText("4ps", "prove", FULL_INPUTS, "professional", 0, "ad").toLowerCase()).toContain("loom");
    expect(buildStageText("4ps", "push", FULL_INPUTS, "professional", 0, "ad")).toContain("Start your free trial");
  });
  it("returns empty string for unknown framework + slug", () => {
    expect(buildStageText("aida", "nope", FULL_INPUTS, "professional", 0, "ad")).toBe("");
  });
  it("rotates variants within a stage", () => {
    const v0 = buildStageText("aida", "attention", FULL_INPUTS, "professional", 0, "ad");
    const v1 = buildStageText("aida", "attention", FULL_INPUTS, "professional", 1, "ad");
    const v2 = buildStageText("aida", "attention", FULL_INPUTS, "professional", 2, "ad");
    expect(new Set([v0, v1, v2]).size).toBeGreaterThanOrEqual(2);
  });
});

// ---------- Variant generation ----------

describe("ai-copywriting generateVariants", () => {
  it("generates 3 variants for AIDA", () => {
    const vs = generateVariants(FULL_INPUTS, "aida", "professional", "standard", "ad");
    expect(vs).toHaveLength(3);
  });
  it("each variant has the correct number of labeled stages", () => {
    const vs = generateVariants(FULL_INPUTS, "aida", "professional", "standard", "ad");
    for (const v of vs) {
      expect(v.stages).toHaveLength(4);
      expect(v.stages.map((s) => s.slug)).toEqual(["attention", "interest", "desire", "action"]);
    }
  });
  it("expanded length produces longer copy than concise", () => {
    const concise = generateVariants(FULL_INPUTS, "aida", "professional", "concise", "ad");
    const expanded = generateVariants(FULL_INPUTS, "aida", "professional", "expanded", "ad");
    expect(expanded[0].wordCount).toBeGreaterThan(concise[0].wordCount);
  });
  it("generates variants for every framework", () => {
    for (const f of FRAMEWORKS) {
      const vs = generateVariants(FULL_INPUTS, f, "professional", "standard", "ad");
      expect(vs).toHaveLength(3);
      expect(vs[0].stages.length).toBe(FRAMEWORK_STAGES[f].length);
    }
  });
  it("sets id and metadata correctly", () => {
    const v = generateVariants(FULL_INPUTS, "pas", "bold", "expanded", "email")[0];
    expect(v.id).toBe("pas-v1");
    expect(v.framework).toBe("pas");
    expect(v.tone).toBe("bold");
    expect(v.length).toBe("expanded");
    expect(v.channel).toBe("email");
    expect(v.variant).toBe(0);
  });
  it("variants are not identical", () => {
    const vs = generateVariants(FULL_INPUTS, "aida", "professional", "standard", "ad");
    const texts = vs.map((v) => v.fullText);
    expect(new Set(texts).size).toBe(texts.length);
  });
});

describe("ai-copywriting generateAllFrameworks", () => {
  it("generates variants for all 5 frameworks", () => {
    const all = generateAllFrameworks(FULL_INPUTS, "professional", "standard", "ad");
    expect(Object.keys(all).sort()).toEqual([...FRAMEWORKS].sort());
    for (const f of FRAMEWORKS) {
      expect(all[f]).toHaveLength(3);
    }
  });
});

// ---------- Render ----------

describe("ai-copywriting renderPlain and renderLabeled", () => {
  it("renderPlain omits stage labels", () => {
    const v = generateVariants(FULL_INPUTS, "aida", "professional", "standard", "ad")[0];
    const plain = renderPlain(v);
    expect(plain).not.toContain("Attention:");
    expect(plain).toContain("Acme Attribution");
  });
  it("renderLabeled includes stage labels", () => {
    const v = generateVariants(FULL_INPUTS, "aida", "professional", "standard", "ad")[0];
    const labeled = renderLabeled(v);
    expect(labeled).toContain("Attention:");
    expect(labeled).toContain("Action:");
  });
});

describe("ai-copywriting renderMarkdown", () => {
  it("renders title + inputs + variants", () => {
    const vs = generateVariants(FULL_INPUTS, "aida", "professional", "standard", "ad");
    const md = renderMarkdown(vs, FULL_INPUTS, "aida", "professional", "standard", "ad");
    expect(md).toContain("# AIDA");
    expect(md).toContain("## Inputs");
    expect(md).toContain("**Product:** Acme Attribution");
    expect(md).toContain("## Variants");
    expect(md).toContain("**Attention**");
  });
});

describe("ai-copywriting renderJson", () => {
  it("renders valid JSON with inputs + variants", () => {
    const vs = generateVariants(FULL_INPUTS, "pas", "friendly", "standard", "email");
    const json = renderJson(vs, FULL_INPUTS, "pas", "friendly", "standard", "email");
    const obj = JSON.parse(json);
    expect(obj.framework).toBe("pas");
    expect(obj.tone).toBe("friendly");
    expect(obj.channel).toBe("email");
    expect(obj.variants).toHaveLength(3);
    expect(obj.inputs.product).toBe("Acme Attribution");
  });
});

describe("ai-copywriting renderCsv", () => {
  it("renders header + one row per variant", () => {
    const vs = generateVariants(FULL_INPUTS, "fab", "bold", "standard", "landing");
    const csv = renderCsv(vs);
    const lines = csv.split("\n");
    expect(lines[0]).toContain("id,framework,tone,length,channel,variant,word_count,full_text");
    expect(lines.length).toBe(4); // header + 3 variants
  });
});

describe("ai-copywriting splitCsvRow", () => {
  it("splits simple", () => { expect(splitCsvRow("a,b,c")).toEqual(["a", "b", "c"]); });
  it("handles quoted commas", () => { expect(splitCsvRow('"a,b",c')).toEqual(["a,b", "c"]); });
});

// ---------- History ----------

describe("ai-copywriting history (localStorage)", () => {
  it("loads empty initially", () => { expect(loadHistory()).toEqual([]); });
  it("saves and loads", () => {
    saveHistory({ ts: 1, product: "Acme", framework: "aida", tone: "professional", variantCount: 3 });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, product: "x", framework: "aida", tone: "professional", variantCount: 3 });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, product: "x", framework: "aida", tone: "professional", variantCount: 3 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ---------- Swipe file ----------

describe("ai-copywriting swipe file (localStorage)", () => {
  it("loads empty initially", () => { expect(loadSwipe()).toEqual([]); });
  it("saves and loads", () => {
    saveSwipe({ ts: 1, framework: "aida", tone: "professional", product: "Acme", excerpt: "Hello" });
    expect(loadSwipe()).toHaveLength(1);
  });
  it("removes by ts", () => {
    saveSwipe({ ts: 1, framework: "aida", tone: "professional", product: "Acme", excerpt: "A" });
    saveSwipe({ ts: 2, framework: "pas", tone: "bold", product: "Beta", excerpt: "B" });
    const after = removeSwipe(1);
    expect(after).toHaveLength(1);
    expect(after[0].ts).toBe(2);
  });
  it("caps at 50", () => {
    for (let i = 0; i < 60; i++) {
      saveSwipe({ ts: i, framework: "aida", tone: "professional", product: "x", excerpt: "y" });
    }
    expect(loadSwipe()).toHaveLength(50);
  });
  it("clears", () => {
    saveSwipe({ ts: 1, framework: "aida", tone: "professional", product: "x", excerpt: "y" });
    clearSwipe();
    expect(loadSwipe()).toEqual([]);
  });
});

// ---------- Share URL ----------

describe("ai-copywriting shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl(FULL_INPUTS, "pas", "bold", "expanded", "email");
    expect(url).toContain("fw=pas");
    expect(url).toContain("t=bold");
    expect(url).toContain("l=expanded");
    expect(url).toContain("ch=email");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("omits tone/length/channel when they are defaults", () => {
    const url = buildShareUrl(FULL_INPUTS, "aida", "professional", "standard", "ad");
    expect(url).toContain("fw=aida");
    expect(url).not.toContain("t=professional");
    expect(url).not.toContain("l=standard");
    expect(url).not.toContain("ch=ad");
  });
  it("parses share URL back into state", () => {
    const url = buildShareUrl(FULL_INPUTS, "pas", "bold", "expanded", "email");
    const hash = url.includes("#") ? url.slice(url.indexOf("#")) : url;
    const state = parseShareUrl(hash);
    expect(state.framework).toBe("pas");
    expect(state.tone).toBe("bold");
    expect(state.length).toBe("expanded");
    expect(state.channel).toBe("email");
    expect(state.inputs.product).toBe("Acme Attribution");
  });
  it("handles empty hash with defaults", () => {
    const state = parseShareUrl("");
    expect(state.framework).toBe("aida");
    expect(state.tone).toBe("professional");
    expect(state.length).toBe("standard");
    expect(state.channel).toBe("ad");
  });
  it("filters unknown framework/tone/length/channel", () => {
    const state = parseShareUrl("fw=bogus&t=bogus&l=bogus&ch=bogus&p=foo");
    expect(state.framework).toBe("aida");
    expect(state.tone).toBe("professional");
    expect(state.length).toBe("standard");
    expect(state.channel).toBe("ad");
    expect(state.inputs.product).toBe("foo");
  });
});

// ---------- LLM prompt + result ----------

describe("ai-copywriting LLM prompt", () => {
  it("includes framework, tone, length, channel + inputs", () => {
    const p = buildLlmPrompt(FULL_INPUTS, "aida", "professional", "standard", "ad");
    expect(p).toContain("AIDA");
    expect(p).toContain("Attention");
    expect(p).toContain("Interest");
    expect(p).toContain("Desire");
    expect(p).toContain("Action");
    expect(p).toContain("Professional");
    expect(p).toContain("Standard");
    expect(p).toContain("Ad");
    expect(p).toContain("Acme Attribution");
    expect(p).toContain("Loom");
  });
});

describe("ai-copywriting renderLlmResult", () => {
  it("parses a valid LLM result", () => {
    const raw = JSON.stringify({
      polishedStages: [
        { label: "Attention", slug: "attention", text: "Hook line." },
        { label: "Action", slug: "action", text: "CTA." },
      ],
      polishedFullText: "Attention: Hook line.\n\nAction: CTA.",
      subjectLines: ["s1", "s2", "s3"],
      suggestions: ["be more specific"],
    });
    const r = renderLlmResult(raw);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.result.polishedStages).toHaveLength(2);
      expect(r.result.polishedStages[0].slug).toBe("attention");
      expect(r.result.polishedFullText).toContain("Attention:");
      expect(r.result.subjectLines).toEqual(["s1", "s2", "s3"]);
      expect(r.result.suggestions).toEqual(["be more specific"]);
    }
  });
  it("strips ```json fences", () => {
    const raw = "```json\n" + JSON.stringify({
      polishedStages: [{ label: "Attention", slug: "attention", text: "x" }],
      polishedFullText: "x",
      subjectLines: [],
      suggestions: [],
    }) + "\n```";
    const r = renderLlmResult(raw);
    expect(r.ok).toBe(true);
  });
  it("returns error on invalid JSON", () => {
    const r = renderLlmResult("not json");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("parse");
  });
  it("returns error on non-object JSON", () => {
    const r = renderLlmResult("[1,2,3]");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("object");
  });
  it("filters polishedStages to only entries with label or text", () => {
    const raw = JSON.stringify({
      polishedStages: [
        { label: "A", slug: "attention", text: "x" },
        { label: "", slug: "", text: "" },
        { label: "B", slug: "interest", text: "y" },
      ],
      polishedFullText: "",
      subjectLines: [],
      suggestions: [],
    });
    const r = renderLlmResult(raw);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.result.polishedStages).toHaveLength(2);
  });
});

// Suppress unused-import lint
export type _Unused =
  | Framework | Tone | Length | Channel;
