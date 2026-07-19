import { describe, it, expect, beforeEach } from "vitest";
import {
  HISTORY_KEY,
  HISTORY_MAX,
  FRAMEWORK_LABELS,
  TONE_LABELS,
  FIELD_HINTS,
  GENERIC_PHRASES,
  GENERIC_SUGGESTIONS,
  validateInputs,
  escapeRegex,
  detectGenericPhrases,
  sharpenDifferentiator,
  buildMooreStatement,
  buildDunfordStatement,
  buildJtbdStatement,
  buildGeigerStatement,
  buildStatement,
  derivePillars,
  deriveElevatorPitch,
  deriveTaglines,
  generate,
  renderMarkdown,
  renderJson,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  renderLlmResult,
  type BrandInputs,
  type Framework,
  type Tone,
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

const FULL_INPUTS: BrandInputs = {
  brandName: "Acme Analytics",
  category: "product analytics platform",
  audience: "growth-stage SaaS product teams",
  need: "understand feature adoption without writing SQL",
  benefit: "answer product questions in seconds with no-code dashboards",
  differentiator: "ingest events from any source with a visual schema mapper",
  reasonToBelieve: "trusted by 400+ SaaS teams including Notion, Linear, and Vercel",
};

describe("ai-brand-positioning constants & hints", () => {
  it("has 4 frameworks and 3 tones", () => {
    expect(Object.keys(FRAMEWORK_LABELS)).toHaveLength(4);
    expect(Object.keys(TONE_LABELS)).toHaveLength(3);
  });
  it("has hints for all 7 input fields", () => {
    const keys = Object.keys(FIELD_HINTS);
    expect(keys).toEqual(
      expect.arrayContaining([
        "brandName", "category", "audience", "need",
        "benefit", "differentiator", "reasonToBelieve",
      ]),
    );
    expect(keys).toHaveLength(7);
    for (const k of keys) {
      expect(FIELD_HINTS[k as keyof BrandInputs].hint.length).toBeGreaterThan(10);
      expect(FIELD_HINTS[k as keyof BrandInputs].sample.length).toBeGreaterThan(0);
    }
  });
  it("has at least 30 generic phrases and matching suggestions", () => {
    expect(GENERIC_PHRASES.length).toBeGreaterThanOrEqual(30);
    for (const p of GENERIC_PHRASES) {
      expect(GENERIC_SUGGESTIONS[p]).toBeTruthy();
    }
  });
  it("has no duplicate generic phrases", () => {
    const set = new Set(GENERIC_PHRASES.map((p) => p.toLowerCase()));
    expect(set.size).toBe(GENERIC_PHRASES.length);
  });
});

describe("ai-brand-positioning validation", () => {
  it("flags all missing required fields", () => {
    const w = validateInputs({} as BrandInputs);
    expect(w.length).toBeGreaterThanOrEqual(6);
    expect(w.some((x) => x.includes("Brand name"))).toBe(true);
    expect(w.some((x) => x.includes("Category"))).toBe(true);
    expect(w.some((x) => x.includes("Differentiator"))).toBe(true);
  });
  it("passes clean inputs with no warnings", () => {
    const w = validateInputs(FULL_INPUTS);
    expect(w).toEqual([]);
  });
  it("warns on very short benefit", () => {
    const w = validateInputs({ ...FULL_INPUTS, benefit: "fast" });
    expect(w.some((x) => x.includes("Key benefit is very short"))).toBe(true);
  });
  it("warns when audience is 'everyone'", () => {
    const w = validateInputs({ ...FULL_INPUTS, audience: "everyone" });
    expect(w.some((x) => x.includes("'everyone' weakens"))).toBe(true);
  });
  it("warns when differentiator contains generic phrasing", () => {
    const w = validateInputs({ ...FULL_INPUTS, differentiator: "high quality and innovative" });
    expect(w.some((x) => x.includes("generic phrasing"))).toBe(true);
  });
  it("warns on overlong brand name", () => {
    const w = validateInputs({ ...FULL_INPUTS, brandName: "A".repeat(65) });
    expect(w.some((x) => x.includes("Brand name is longer than 60"))).toBe(true);
  });
});

describe("ai-brand-positioning generic-phrase detection & sharpening", () => {
  it("escapeRegex escapes regex metacharacters", () => {
    const re = new RegExp(escapeRegex("high-quality"));
    expect(re.test("high-quality")).toBe(true);
  });
  it("detects a single generic phrase", () => {
    expect(detectGenericPhrases("high quality product")).toEqual(["high quality"]);
  });
  it("detects multiple generic phrases", () => {
    const found = detectGenericPhrases("high quality and innovative, world-class");
    expect(found).toEqual(expect.arrayContaining(["high quality", "innovative", "world-class"]));
    expect(found).toHaveLength(3);
  });
  it("returns empty for clean text", () => {
    expect(detectGenericPhrases("ingest events from any source")).toEqual([]);
  });
  it("handles empty input", () => {
    expect(detectGenericPhrases("")).toEqual([]);
  });
  it("is case-insensitive", () => {
    expect(detectGenericPhrases("HIGH QUALITY")).toEqual(["high quality"]);
  });
  it("prefers multi-word over single-word match (no overlap)", () => {
    // "high quality" should win and "quality" alone isn't in the list anyway,
    // but verify no double-counting for nested phrases.
    expect(detectGenericPhrases("best in class")).toEqual(["best in class"]);
  });
  it("sharpenDifferentiator flags empty input", () => {
    const r = sharpenDifferentiator("");
    expect(r.genericPhrases).toEqual([]);
    expect(r.issues).toContain("Differentiator is empty.");
  });
  it("sharpenDifferentiator returns input unchanged when no generic phrases", () => {
    const r = sharpenDifferentiator("visual schema mapper");
    expect(r.sharpened).toBe("visual schema mapper");
    expect(r.genericPhrases).toEqual([]);
  });
  it("sharpenDifferentiator replaces generic phrases with bracketed prompts", () => {
    const r = sharpenDifferentiator("high quality and reliable");
    expect(r.genericPhrases).toEqual(expect.arrayContaining(["high quality", "reliable"]));
    expect(r.sharpened).toContain("[");
    expect(r.sharpened).toContain("]");
    expect(r.sharpened).not.toContain("high quality");
    expect(r.issues.length).toBeGreaterThanOrEqual(2);
  });
});

describe("ai-brand-positioning framework builders", () => {
  it("buildMooreStatement produces all three tones", () => {
    const concise = buildMooreStatement(FULL_INPUTS, "concise");
    const energetic = buildMooreStatement(FULL_INPUTS, "energetic");
    const formal = buildMooreStatement(FULL_INPUTS, "formal");
    expect(concise).toContain("Acme Analytics");
    expect(concise).toContain(FULL_INPUTS.audience);
    expect(concise).toContain(FULL_INPUTS.benefit);
    expect(energetic).toContain("While other");
    expect(formal).toContain("In contrast to competing");
    expect(concise).not.toBe(energetic);
    expect(energetic).not.toBe(formal);
  });
  it("buildDunfordStatement produces declarative style", () => {
    const s = buildDunfordStatement(FULL_INPUTS, "concise");
    expect(s.startsWith("Acme Analytics is a")).toBe(true);
    expect(s).toContain("Unlike alternatives");
  });
  it("buildJtbdStatement uses 'hire' framing", () => {
    const s = buildJtbdStatement(FULL_INPUTS, "concise");
    expect(s).toContain("they hire Acme Analytics");
  });
  it("buildGeigerStatement is the shortest formula", () => {
    const s = buildGeigerStatement(FULL_INPUTS, "concise");
    expect(s).toContain("helps");
    expect(s).toContain("by ");
    expect(s.startsWith("Acme Analytics helps")).toBe(true);
  });
  it("buildStatement dispatches to the right framework", () => {
    expect(buildStatement(FULL_INPUTS, "moore", "concise")).toBe(buildMooreStatement(FULL_INPUTS, "concise"));
    expect(buildStatement(FULL_INPUTS, "dunford", "concise")).toBe(buildDunfordStatement(FULL_INPUTS, "concise"));
    expect(buildStatement(FULL_INPUTS, "jtbd", "concise")).toBe(buildJtbdStatement(FULL_INPUTS, "concise"));
    expect(buildStatement(FULL_INPUTS, "geiger", "concise")).toBe(buildGeigerStatement(FULL_INPUTS, "concise"));
  });
  it("builders substitute placeholders for missing inputs", () => {
    const empty = {} as BrandInputs;
    const s = buildMooreStatement(empty, "concise");
    expect(s).toContain("[brand]");
    expect(s).toContain("[audience]");
    expect(s).toContain("[benefit]");
  });
});

describe("ai-brand-positioning derived assets", () => {
  it("derivePillars returns exactly 3 pillars with non-empty titles and descriptions", () => {
    const pillars = derivePillars(FULL_INPUTS);
    expect(pillars).toHaveLength(3);
    for (const p of pillars) {
      expect(p.title.length).toBeGreaterThan(0);
      expect(p.description.length).toBeGreaterThan(10);
      expect(p.description).toContain("Acme Analytics");
    }
  });
  it("deriveElevatorPitch includes brand, category, audience, benefit", () => {
    const pitch = deriveElevatorPitch(FULL_INPUTS);
    expect(pitch).toContain("Acme Analytics");
    expect(pitch).toContain("product analytics platform");
    expect(pitch).toContain("growth-stage SaaS product teams");
    expect(pitch).toContain("answer product questions");
  });
  it("deriveElevatorPitch omits reason-to-believe tail when empty", () => {
    const pitch = deriveElevatorPitch({ ...FULL_INPUTS, reasonToBelieve: "" });
    expect(pitch.endsWith(".")).toBe(true);
    expect(pitch).not.toContain("Because");
  });
  it("deriveTaglines returns exactly 5 taglines", () => {
    const tags = deriveTaglines(FULL_INPUTS);
    expect(tags).toHaveLength(5);
    for (const t of tags) {
      expect(t.length).toBeGreaterThan(0);
      expect(t.endsWith(".")).toBe(true);
    }
    expect(tags.some((t) => t.startsWith("Acme Analytics"))).toBe(true);
  });
  it("deriveTaglines strips trailing punctuation before re-adding a single period", () => {
    const tags = deriveTaglines({ ...FULL_INPUTS, benefit: "answer fast." });
    for (const t of tags) {
      expect(t.endsWith("..")).toBe(false);
    }
  });
});

describe("ai-brand-positioning generate", () => {
  it("returns the primary statement + 5 alternates (3 tones + 3 other frameworks)", () => {
    const out = generate(FULL_INPUTS, "moore", "concise");
    const primaries = out.statements.filter((s) => s.primary);
    expect(primaries).toHaveLength(1);
    expect(primaries[0].framework).toBe("moore");
    expect(primaries[0].tone).toBe("concise");
    // 1 primary + 2 alternate tones + 3 other frameworks = 6
    expect(out.statements).toHaveLength(6);
  });
  it("includes pillars, pitch, taglines, warnings, sharpenResult", () => {
    const out = generate(FULL_INPUTS, "dunford", "energetic");
    expect(out.pillars).toHaveLength(3);
    expect(out.elevatorPitch.length).toBeGreaterThan(0);
    expect(out.taglines).toHaveLength(5);
    expect(Array.isArray(out.warnings)).toBe(true);
    expect(out.sharpenResult).not.toBeNull();
  });
  it("sharpenResult is null when differentiator is empty", () => {
    const out = generate({ ...FULL_INPUTS, differentiator: "" }, "moore", "concise");
    expect(out.sharpenResult).toBeNull();
  });
  it("includes generic-phrase warning when differentiator is generic", () => {
    const out = generate({ ...FULL_INPUTS, differentiator: "high quality" }, "moore", "concise");
    expect(out.warnings.some((w) => w.includes("generic phrasing"))).toBe(true);
  });
});

describe("ai-brand-positioning rendering", () => {
  it("renderMarkdown contains brand name and all sections", () => {
    const out = generate(FULL_INPUTS, "moore", "concise");
    const md = renderMarkdown(out, FULL_INPUTS);
    expect(md).toContain("# Acme Analytics — Brand Positioning One-Pager");
    expect(md).toContain("## Inputs");
    expect(md).toContain("## Positioning statement (primary)");
    expect(md).toContain("## Messaging pillars");
    expect(md).toContain("## Elevator pitch");
    expect(md).toContain("## Tagline options");
  });
  it("renderMarkdown includes sharpening section when generic phrases are present", () => {
    const inputs = { ...FULL_INPUTS, differentiator: "high quality and reliable" };
    const out = generate(inputs, "moore", "concise");
    const md = renderMarkdown(out, inputs);
    expect(md).toContain("## Differentiator sharpening");
  });
  it("renderJson produces valid JSON that round-trips", () => {
    const out = generate(FULL_INPUTS, "jtbd", "formal");
    const json = renderJson(out, FULL_INPUTS);
    const parsed = JSON.parse(json);
    expect(parsed.inputs.brandName).toBe("Acme Analytics");
    expect(parsed.output.statements.length).toBe(6);
    expect(parsed.output.pillars.length).toBe(3);
    expect(typeof parsed.generatedAt).toBe("string");
  });
});

describe("ai-brand-positioning history", () => {
  it("starts empty", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads entries", () => {
    const entry: HistoryEntry = {
      ts: Date.now(),
      brandName: "Acme",
      framework: "moore",
      tone: "concise",
      statement: "For teams, Acme is a tool that helps.",
    };
    const next = saveHistory(entry);
    expect(next).toHaveLength(1);
    expect(loadHistory()[0].brandName).toBe("Acme");
  });
  it("caps at HISTORY_MAX (20)", () => {
    for (let i = 0; i < HISTORY_MAX + 5; i++) {
      saveHistory({
        ts: Date.now() + i,
        brandName: `Brand ${i}`,
        framework: "moore",
        tone: "concise",
        statement: `Statement ${i}`,
      });
    }
    expect(loadHistory()).toHaveLength(HISTORY_MAX);
    expect(loadHistory()[0].brandName).toBe("Brand 24"); // most recent first
  });
  it("clearHistory empties the store", () => {
    saveHistory({
      ts: 1, brandName: "X", framework: "moore", tone: "concise", statement: "x",
    });
    expect(loadHistory()).toHaveLength(1);
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
  it("uses the correct localStorage key", () => {
    expect(HISTORY_KEY).toBe("unqtools:ai-brand-positioning-statement-generator:history");
  });
});

describe("ai-brand-positioning share URL", () => {
  it("buildShareUrl encodes all fields when set", () => {
    const url = buildShareUrl(FULL_INPUTS, "dunford", "energetic");
    expect(url).toContain("brand=Acme");
    expect(url).toContain("cat=product");
    expect(url).toContain("fw=dunford");
    expect(url).toContain("tone=energetic");
  });
  it("buildShareUrl omits default framework/tone params", () => {
    const url = buildShareUrl(FULL_INPUTS, "moore", "concise");
    expect(url).not.toContain("fw=");
    expect(url).not.toContain("tone=");
  });
  it("parseShareUrl round-trips inputs", () => {
    const url = buildShareUrl(FULL_INPUTS, "jtbd", "formal");
    // Extract the params portion (after # or ? — in tests, window is undefined
    // so buildShareUrl falls back to a leading ?).
    const idx = url.includes("#") ? url.indexOf("#") : url.indexOf("?");
    const hash = idx >= 0 ? url.slice(idx) : "";
    const parsed = parseShareUrl(hash);
    expect(parsed.inputs.brandName).toBe("Acme Analytics");
    expect(parsed.inputs.audience).toBe("growth-stage SaaS product teams");
    expect(parsed.inputs.differentiator).toBe(FULL_INPUTS.differentiator);
    expect(parsed.framework).toBe("jtbd");
    expect(parsed.tone).toBe("formal");
  });
  it("parseShareUrl returns defaults for empty hash", () => {
    const parsed = parseShareUrl("");
    expect(parsed.inputs).toEqual({});
    expect(parsed.framework).toBe("moore");
    expect(parsed.tone).toBe("concise");
  });
  it("parseShareUrl rejects invalid framework/tone values", () => {
    const parsed = parseShareUrl("#fw=bogus&tone=bogus&brand=Foo");
    expect(parsed.framework).toBe("moore");
    expect(parsed.tone).toBe("concise");
    expect(parsed.inputs.brandName).toBe("Foo");
  });
});

describe("ai-brand-positioning LLM prompt & result", () => {
  it("buildLlmPrompt includes the brand and framework label", () => {
    const p = buildLlmPrompt(FULL_INPUTS, "dunford", "energetic");
    expect(p).toContain("Acme Analytics");
    expect(p).toContain("April Dunford");
    expect(p).toContain("Energetic");
    expect(p).toContain("JSON");
  });
  it("renderLlmResult parses valid JSON", () => {
    const raw = JSON.stringify({
      polishedStatement: "For teams, Acme is the platform.",
      polishedPillars: [
        { title: "Speed", description: "Answer in seconds." },
        { title: "No-code", description: "Visual builder." },
        { title: "Trust", description: "400+ teams." },
      ],
      polishedPitch: "Acme is a platform for teams.",
      polishedTaglines: ["Acme. Fast.", "Acme: no-code.", "Fast. Acme."],
      suggestions: ["Add a number to the differentiator."],
    });
    const r = renderLlmResult(raw);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.result.polishedStatement).toContain("Acme");
      expect(r.result.polishedPillars).toHaveLength(3);
      expect(r.result.polishedTaglines).toHaveLength(3);
      expect(r.result.suggestions).toHaveLength(1);
    }
  });
  it("renderLlmResult strips ```json fences", () => {
    const raw = "```json\n{\"polishedStatement\":\"x\"}\n```";
    const r = renderLlmResult(raw);
    expect(r.ok).toBe(true);
  });
  it("renderLlmResult rejects invalid JSON", () => {
    const r = renderLlmResult("not json");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("Could not parse");
  });
  it("renderLlmResult rejects non-object JSON (arrays)", () => {
    const r = renderLlmResult("[1,2,3]");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("not a JSON object");
  });
  it("renderLlmResult fills defaults for missing fields", () => {
    const r = renderLlmResult("{}");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.result.polishedStatement).toBe("");
      expect(r.result.polishedPillars).toEqual([]);
      expect(r.result.polishedTaglines).toEqual([]);
      expect(r.result.suggestions).toEqual([]);
    }
  });
  it("renderLlmResult filters non-string taglines", () => {
    const r = renderLlmResult(JSON.stringify({
      polishedTaglines: ["ok", 42, null, "also ok"],
    }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.result.polishedTaglines).toEqual(["ok", "also ok"]);
    }
  });
});
