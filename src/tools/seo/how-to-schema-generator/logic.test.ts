import { describe, it, expect, beforeEach } from "vitest";
import {
  validateStep,
  validateInput,
  parseBulkSteps,
  parseList,
  buildJsonLd,
  buildScriptTag,
  generateHowToSchema,
  minutesToIsoDuration,
  isoDurationToMinutes,
  calculateTotalTime,
  moveStep,
  moveStepUp,
  moveStepDown,
  isValidUrl,
  buildGoogleRichResultsLink,
  buildSchemaDocsLink,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  STEP_NAME_MAX,
  STEP_TEXT_MAX,
  type HowToInput,
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

const validInput: HowToInput = {
  name: "How to Bake a Cake",
  description: "A simple cake recipe.",
  steps: [
    { name: "Mix dry ingredients", text: "Combine flour, sugar, baking powder." },
    { name: "Bake", text: "Pour into pan and bake for 30 minutes." },
  ],
};

describe("how-to-schema-generator isValidUrl", () => {
  it("accepts http(s) URLs", () => {
    expect(isValidUrl("https://example.com")).toBe(true);
  });
  it("rejects malformed URLs", () => {
    expect(isValidUrl("not-a-url")).toBe(false);
    expect(isValidUrl("")).toBe(false);
  });
});

describe("how-to-schema-generator minutesToIsoDuration", () => {
  it("converts minutes only", () => {
    expect(minutesToIsoDuration(30)).toBe("PT30M");
  });
  it("converts hours only", () => {
    expect(minutesToIsoDuration(120)).toBe("PT2H");
  });
  it("converts hours and minutes", () => {
    expect(minutesToIsoDuration(90)).toBe("PT1H30M");
  });
  it("returns empty for invalid", () => {
    expect(minutesToIsoDuration(0)).toBe("");
    expect(minutesToIsoDuration(-5)).toBe("");
    expect(minutesToIsoDuration(NaN)).toBe("");
  });
});

describe("how-to-schema-generator isoDurationToMinutes", () => {
  it("parses PT30M", () => {
    expect(isoDurationToMinutes("PT30M")).toBe(30);
  });
  it("parses PT1H30M", () => {
    expect(isoDurationToMinutes("PT1H30M")).toBe(90);
  });
  it("parses PT1H", () => {
    expect(isoDurationToMinutes("PT1H")).toBe(60);
  });
  it("returns 0 for invalid", () => {
    expect(isoDurationToMinutes("")).toBe(0);
    expect(isoDurationToMinutes("not-an-iso")).toBe(0);
  });
});

describe("how-to-schema-generator calculateTotalTime", () => {
  it("sums [time:PTnM] markers in step text", () => {
    const steps = [
      { name: "A", text: "Do something [time:PT10M]" },
      { name: "B", text: "Do more [time:PT20M]" },
    ];
    expect(calculateTotalTime(steps)).toBe(30);
  });
  it("returns 0 when no markers", () => {
    expect(calculateTotalTime([{ name: "A", text: "no marker" }])).toBe(0);
  });
});

describe("how-to-schema-generator validateStep", () => {
  it("errors on empty name", () => {
    const r = validateStep({ name: "", text: "x" }, 0);
    expect(r.errors.some((e) => /name/i.test(e))).toBe(true);
  });
  it("errors on empty text", () => {
    const r = validateStep({ name: "X", text: "" }, 0);
    expect(r.errors.some((e) => /text/i.test(e))).toBe(true);
  });
  it("warns on long name", () => {
    const r = validateStep({ name: "x".repeat(STEP_NAME_MAX + 5), text: "ok" }, 0);
    expect(r.warnings.some((w) => /long/i.test(w))).toBe(true);
  });
  it("warns on long text", () => {
    const r = validateStep({ name: "X", text: "x".repeat(STEP_TEXT_MAX + 100) }, 0);
    expect(r.warnings.some((w) => /long/i.test(w))).toBe(true);
  });
  it("warns on invalid image URL", () => {
    const r = validateStep({ name: "X", text: "y", image: "not-a-url" }, 0);
    expect(r.warnings.some((w) => /image/i.test(w))).toBe(true);
  });
  it("passes for valid step", () => {
    const r = validateStep({ name: "Mix", text: "Combine ingredients." }, 0);
    expect(r.errors).toHaveLength(0);
  });
});

describe("how-to-schema-generator validateInput", () => {
  it("errors on missing title", () => {
    const r = validateInput({ ...validInput, name: "" });
    expect(r.errors.some((e) => /title/i.test(e))).toBe(true);
  });
  it("errors on no steps", () => {
    const r = validateInput({ ...validInput, steps: [] });
    expect(r.errors.some((e) => /step/i.test(e))).toBe(true);
  });
  it("errors on negative total time", () => {
    const r = validateInput({ ...validInput, totalTimeMinutes: -5 });
    expect(r.errors.some((e) => /negative/i.test(e))).toBe(true);
  });
  it("warns on fewer than min steps", () => {
    const r = validateInput({
      name: "X",
      steps: [{ name: "Only", text: "One step" }],
    });
    expect(r.warnings.some((w) => /steps/i.test(w))).toBe(true);
  });
  it("passes for valid input", () => {
    expect(validateInput(validInput).ok).toBe(true);
  });
});

describe("how-to-schema-generator parseBulkSteps", () => {
  it("parses pipe-separated", () => {
    const out = parseBulkSteps("Mix | Combine ingredients\nBake | Cook for 30 min");
    expect(out).toHaveLength(2);
    expect(out[0].name).toBe("Mix");
    expect(out[0].text).toBe("Combine ingredients");
  });
  it("parses colon-separated", () => {
    const out = parseBulkSteps("Mix: Combine ingredients");
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe("Mix");
    expect(out[0].text).toBe("Combine ingredients");
  });
  it("falls back to first 50 chars as name", () => {
    const out = parseBulkSteps("This is a very long step description that should be truncated for the name");
    expect(out).toHaveLength(1);
    expect(out[0].name).toMatch(/…$/);
  });
  it("returns empty for empty input", () => {
    expect(parseBulkSteps("")).toEqual([]);
    expect(parseBulkSteps("   ")).toEqual([]);
  });
});

describe("how-to-schema-generator parseList", () => {
  it("parses comma-separated", () => {
    expect(parseList("flour, sugar, eggs")).toEqual(["flour", "sugar", "eggs"]);
  });
  it("parses newline-separated", () => {
    expect(parseList("flour\nsugar\neggs")).toEqual(["flour", "sugar", "eggs"]);
  });
  it("returns empty for empty input", () => {
    expect(parseList("")).toEqual([]);
  });
});

describe("how-to-schema-generator buildJsonLd", () => {
  it("produces HowTo with @context and @type", () => {
    const out = buildJsonLd(validInput) as Record<string, unknown>;
    expect(out["@context"]).toBe("https://schema.org");
    expect(out["@type"]).toBe("HowTo");
  });
  it("includes description when provided", () => {
    const out = buildJsonLd(validInput) as Record<string, unknown>;
    expect(out.description).toBeDefined();
  });
  it("includes totalTime as ISO 8601", () => {
    const out = buildJsonLd({ ...validInput, totalTimeMinutes: 45 }) as Record<string, unknown>;
    expect(out.totalTime).toBe("PT45M");
  });
  it("includes estimatedCost as MonetaryAmount when numeric", () => {
    const out = buildJsonLd({ ...validInput, estimatedCost: "$10 USD" }) as Record<string, unknown>;
    expect(out.estimatedCost).toBeDefined();
    const cost = out.estimatedCost as Record<string, unknown>;
    expect(cost["@type"]).toBe("MonetaryAmount");
    expect(cost.value).toBe(10);
  });
  it("includes supplies and tools", () => {
    const out = buildJsonLd({
      ...validInput,
      supplies: ["flour", "sugar"],
      tools: ["mixer", "oven"],
    }) as Record<string, unknown>;
    expect(out.supply).toBeDefined();
    expect(out.tool).toBeDefined();
    expect((out.supply as unknown[]).length).toBe(2);
  });
  it("includes step image when valid URL", () => {
    const out = buildJsonLd({
      ...validInput,
      steps: [{ name: "Mix", text: "Combine.", image: "https://example.com/mix.jpg" }],
    }) as { step: Array<Record<string, unknown>> };
    expect(out.step[0].image).toBe("https://example.com/mix.jpg");
  });
  it("throws on invalid input", () => {
    expect(() => buildJsonLd({ ...validInput, name: "" })).toThrow();
    expect(() => buildJsonLd({ ...validInput, steps: [] })).toThrow();
  });
});

describe("how-to-schema-generator buildScriptTag", () => {
  it("wraps JSON in script tag", () => {
    const tag = buildScriptTag({ "@type": "HowTo" });
    expect(tag.startsWith('<script type="application/ld+json">')).toBe(true);
    expect(tag.endsWith("</script>")).toBe(true);
  });
});

describe("how-to-schema-generator generateHowToSchema", () => {
  it("returns complete script tag string", () => {
    const out = generateHowToSchema(validInput);
    expect(out).toContain("HowTo");
    expect(out).toContain("How to Bake a Cake");
  });
});

describe("how-to-schema-generator reorder", () => {
  const steps = [
    { name: "A", text: "a" },
    { name: "B", text: "b" },
    { name: "C", text: "c" },
  ];
  it("moves step up", () => {
    expect(moveStepUp(steps, 1)[0].name).toBe("B");
  });
  it("moves step down", () => {
    expect(moveStepDown(steps, 0)[0].name).toBe("B");
  });
  it("no-op at boundaries", () => {
    expect(moveStepUp(steps, 0)[0].name).toBe("A");
    expect(moveStepDown(steps, 2)[2].name).toBe("C");
  });
  it("no-op for invalid indexes", () => {
    expect(moveStep(steps, -1, 0)).toEqual(steps);
  });
});

describe("how-to-schema-generator links", () => {
  it("builds Google Rich Results link", () => {
    expect(buildGoogleRichResultsLink("https://example.com")).toContain("rich-results");
  });
  it("builds Schema.org docs link", () => {
    expect(buildSchemaDocsLink()).toContain("schema.org/HowTo");
  });
});

describe("how-to-schema-generator history", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, title: "A", stepCount: 3, snippet: "x" });
    saveHistory({ ts: 2, title: "B", stepCount: 5, snippet: "y" });
    expect(loadHistory()).toHaveLength(2);
    expect(loadHistory()[0].title).toBe("B");
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, title: "X", stepCount: 1, snippet: "x" });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, title: "A", stepCount: 1, snippet: "x" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("how-to-schema-generator shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl(validInput);
    expect(url).toContain("name=");
    expect(url).toContain("steps=");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back to input", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl(validInput);
    const hash = url.replace(/^\?/, "#");
    const parsed = parseShareUrl(hash) as HowToInput;
    expect(parsed.name).toBe("How to Bake a Cake");
    expect(parsed.steps).toHaveLength(2);
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("returns empty for empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("returns empty for malformed steps JSON", () => {
    expect(parseShareUrl("name=Test&steps=notjson")).toEqual({ name: "Test" });
  });
});
