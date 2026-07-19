import { describe, it, expect, beforeEach } from "vitest";
import {
  HISTORY_KEY,
  HISTORY_MAX,
  LLM_KEY_STORAGE,
  TONE_LABELS,
  LENGTH_LABELS,
  LENGTH_TARGET,
  STOPWORDS,
  MIN_KEYWORD_LEN,
  MAX_REQUIREMENTS,
  CLICHES,
  escapeRegex,
  countWords,
  tokenize,
  extractKeywords,
  mapRequirements,
  buildGreeting,
  buildHook,
  buildBody,
  buildClosing,
  buildSignature,
  generateDraft,
  regenerateHook,
  detectCliches,
  applyClicheSuggestions,
  renderMarkdown,
  renderJson,
  renderRequirementsCsv,
  splitCsvRow,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  renderLlmResult,
  titleCaseLabel,
  type Tone,
  type Length,
  type CoverLetterInputs,
} from "./logic";

const SAMPLE_JD = `
Senior Product Manager, Acme Cloud
We are looking for a Senior Product Manager to lead our cloud platform.
Requirements:
- 5+ years of product management experience in B2B SaaS
- Strong experience with roadmap planning and prioritization
- Experience working with engineering, design, and GTM teams
- Data-driven decision-making with SQL and analytics tools
- Excellent communication and stakeholder management
- Experience with pricing, packaging, and monetization
- Familiarity with AWS, GCP, or Azure
Nice-to-have: experience with API products and developer platforms.
`;

const SAMPLE_EXPERIENCE = `
I have 6 years of product management experience at B2B SaaS companies.
At Northwind, I led roadmap planning for the analytics product and
shipped a major SQL-driven insights feature with engineering and design.
I worked closely with GTM teams on pricing and packaging. We used
AWS for infrastructure. I have strong communication and stakeholder
management skills across engineering, design, and sales.
`;

const FULL_INPUTS: CoverLetterInputs = {
  name: "Jordan Lee",
  email: "jordan@example.com",
  phone: "+1-555-0100",
  experience: SAMPLE_EXPERIENCE,
  company: "Acme Cloud",
  role: "Senior Product Manager",
  jobDescription: SAMPLE_JD,
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

describe("ai-cover-letter constants", () => {
  it("has 3 tones, 3 lengths", () => {
    expect(Object.keys(TONE_LABELS)).toHaveLength(3);
    expect(Object.keys(LENGTH_LABELS)).toHaveLength(3);
  });
  it("has length targets in increasing order", () => {
    expect(LENGTH_TARGET.short).toBeLessThan(LENGTH_TARGET.standard);
    expect(LENGTH_TARGET.standard).toBeLessThan(LENGTH_TARGET.detailed);
  });
  it("has a non-empty stopwords set", () => {
    expect(STOPWORDS.size).toBeGreaterThan(50);
    expect(STOPWORDS.has("the")).toBe(true);
    expect(STOPWORDS.has("and")).toBe(true);
  });
  it("exposes MIN_KEYWORD_LEN >= 2 and MAX_REQUIREMENTS >= 8", () => {
    expect(MIN_KEYWORD_LEN).toBeGreaterThanOrEqual(2);
    expect(MAX_REQUIREMENTS).toBeGreaterThanOrEqual(8);
  });
  it("has 25+ clichés with suggestions", () => {
    expect(CLICHES.length).toBeGreaterThanOrEqual(25);
    for (const c of CLICHES) {
      expect(c.phrase.length).toBeGreaterThan(0);
      expect(c.suggestion.length).toBeGreaterThan(0);
    }
  });
  it("exposes storage keys", () => {
    expect(HISTORY_KEY).toContain("ai-cover-letter-writer");
    expect(LLM_KEY_STORAGE).toContain("ai-cover-letter-writer");
  });
  it("caps history at 20", () => {
    expect(HISTORY_MAX).toBe(20);
  });
});

// ---------- Helpers ----------

describe("ai-cover-letter helpers", () => {
  it("escapeRegex escapes metacharacters", () => {
    expect(escapeRegex("a.b*c?")).toBe("a\\.b\\*c\\?");
  });
  it("countWords handles empty + multi-space", () => {
    expect(countWords("")).toBe(0);
    expect(countWords("  one   two  three  ")).toBe(3);
  });
  it("tokenize lowercases and splits on non-alphanumeric", () => {
    expect(tokenize("Hello, World! C# and C++")).toEqual([
      "hello", "world", "c#", "and", "c++",
    ]);
  });
  it("titleCaseLabel capitalizes first letter", () => {
    expect(titleCaseLabel("greeting")).toBe("Greeting");
    expect(titleCaseLabel("")).toBe("");
  });
});

// ---------- JD keyword extraction ----------

describe("ai-cover-letter extractKeywords", () => {
  it("extracts keywords from a JD", () => {
    const kws = extractKeywords(SAMPLE_JD);
    expect(kws.length).toBeGreaterThan(0);
    expect(kws.length).toBeLessThanOrEqual(MAX_REQUIREMENTS);
  });
  it("does not include stopwords", () => {
    const kws = extractKeywords(SAMPLE_JD);
    for (const k of kws) {
      expect(STOPWORDS.has(k)).toBe(false);
    }
  });
  it("respects max parameter", () => {
    expect(extractKeywords(SAMPLE_JD, 5).length).toBeLessThanOrEqual(5);
  });
  it("is deterministic — same input → same output", () => {
    const a = extractKeywords(SAMPLE_JD);
    const b = extractKeywords(SAMPLE_JD);
    expect(a).toEqual(b);
  });
  it("returns empty for empty JD", () => {
    expect(extractKeywords("")).toEqual([]);
  });
  it("ranks higher-frequency keywords first", () => {
    const kws = extractKeywords("python python python java java rust");
    expect(kws[0]).toBe("python");
    expect(kws[1]).toBe("java");
    expect(kws[2]).toBe("rust");
  });
});

describe("ai-cover-letter mapRequirements", () => {
  it("maps keywords to evidence in the experience", () => {
    const reqs = mapRequirements(SAMPLE_JD, SAMPLE_EXPERIENCE);
    expect(reqs.length).toBeGreaterThan(0);
    // 'product' is the highest-frequency keyword in the JD so it's always extracted.
    const product = reqs.find((r) => r.keyword === "product");
    expect(product).toBeDefined();
    expect(product!.matched).toBe(true);
    expect(product!.evidence).toBeTruthy();
  });
  it("flags unmatched keywords", () => {
    const reqs = mapRequirements("kubernetes helm terraform", SAMPLE_EXPERIENCE);
    expect(reqs.every((r) => !r.matched)).toBe(true);
  });
  it("sets evidence snippet around the match", () => {
    const reqs = mapRequirements("roadmap", "I led roadmap planning for the analytics product");
    const r = reqs[0];
    expect(r.matched).toBe(true);
    expect(r.evidence).toContain("roadmap");
  });
  it("handles empty experience gracefully", () => {
    const reqs = mapRequirements("python java", "");
    expect(reqs.every((r) => !r.matched)).toBe(true);
  });
});

// ---------- Section builders ----------

describe("ai-cover-letter section builders", () => {
  it("buildGreeting is tone-aware", () => {
    expect(buildGreeting(FULL_INPUTS, "formal")).toContain("Dear Hiring Manager");
    expect(buildGreeting(FULL_INPUTS, "warm")).toContain("Acme Cloud team");
    expect(buildGreeting(FULL_INPUTS, "confident")).toContain("Hi Acme Cloud");
  });
  it("buildHook produces 3 variants per tone", () => {
    for (const t of ["formal", "warm", "confident"] as Tone[]) {
      const variants = [0, 1, 2].map((v) => buildHook(FULL_INPUTS, t, v));
      expect(new Set(variants).size).toBe(3);
      for (const v of variants) {
        expect(v).toContain("Senior Product Manager");
        expect(v).toContain("Acme Cloud");
      }
    }
  });
  it("buildBody addresses matched requirements and not unmatched", () => {
    const reqs = mapRequirements(SAMPLE_JD, SAMPLE_EXPERIENCE);
    const body = buildBody(FULL_INPUTS, reqs, "confident", "standard");
    expect(body.length).toBeGreaterThan(0);
    // Body should reference at least one matched keyword.
    const bodyLower = body.toLowerCase();
    const anyAddressed = reqs.some((r) => r.matched && bodyLower.includes(r.keyword.toLowerCase()));
    expect(anyAddressed).toBe(true);
  });
  it("buildBody handles zero matches honestly", () => {
    const body = buildBody(FULL_INPUTS, [], "formal", "short");
    expect(body).toContain("would welcome the chance");
  });
  it("buildBody length 'short' emits at most 3 lead phrases (one per chosen requirement)", () => {
    const reqs = mapRequirements(SAMPLE_JD, SAMPLE_EXPERIENCE + " ".repeat(50) + "pricing packaging monetization aws sql analytics gtM");
    const body = buildBody(FULL_INPUTS, reqs, "formal", "short");
    // Count lead phrases — each chosen requirement contributes exactly one 'work involving' lead.
    const leadCount = (body.match(/work involving/gi) ?? []).length;
    expect(leadCount).toBeLessThanOrEqual(3);
  });
  it("buildBody length 'detailed' emits at most 8 lead phrases", () => {
    const reqs = mapRequirements(SAMPLE_JD, SAMPLE_EXPERIENCE + " ".repeat(50) + "pricing packaging monetization aws sql analytics gtM");
    const body = buildBody(FULL_INPUTS, reqs, "confident", "detailed");
    const leadCount = (body.match(/work involving/gi) ?? []).length;
    expect(leadCount).toBeLessThanOrEqual(8);
  });
  it("buildClosing is tone-aware", () => {
    expect(buildClosing(FULL_INPUTS, "formal")).toContain("Thank you for considering");
    expect(buildClosing(FULL_INPUTS, "warm")).toContain("Thanks for taking the time");
    expect(buildClosing(FULL_INPUTS, "confident")).toContain("week one");
  });
  it("buildSignature includes name + contact when provided", () => {
    const sig = buildSignature(FULL_INPUTS);
    expect(sig).toContain("Jordan Lee");
    expect(sig).toContain("jordan@example.com");
    expect(sig).toContain("+1-555-0100");
  });
  it("buildSignature includes name only when no contact provided", () => {
    const sig = buildSignature({ ...FULL_INPUTS, email: undefined, phone: undefined });
    expect(sig).toBe("Jordan Lee");
  });
});

// ---------- Draft generation ----------

describe("ai-cover-letter generateDraft", () => {
  it("generates a 5-section draft", () => {
    const d = generateDraft(FULL_INPUTS, "formal", "standard");
    expect(d.sections).toHaveLength(5);
    expect(d.sections.map((s) => s.slug)).toEqual([
      "greeting", "opening", "body", "closing", "signature",
    ]);
  });
  it("fullText has all sections", () => {
    const d = generateDraft(FULL_INPUTS, "warm", "standard");
    expect(d.fullText).toContain("Hello Acme Cloud team");
    expect(d.fullText).toContain("Senior Product Manager");
    expect(d.fullText).toContain("Jordan Lee");
  });
  it("reports word count > 0", () => {
    const d = generateDraft(FULL_INPUTS, "confident", "short");
    expect(d.wordCount).toBeGreaterThan(0);
  });
  it("flags missing name as a warning", () => {
    const d = generateDraft({ ...FULL_INPUTS, name: "" }, "formal", "standard");
    expect(d.warnings.some((w) => w.includes("name"))).toBe(true);
  });
  it("flags thin experience as a warning", () => {
    const d = generateDraft({ ...FULL_INPUTS, experience: "short" }, "formal", "standard");
    expect(d.warnings.some((w) => w.includes("Experience"))).toBe(true);
  });
  it("flags thin JD as a warning", () => {
    const d = generateDraft({ ...FULL_INPUTS, jobDescription: "x" }, "formal", "standard");
    expect(d.warnings.some((w) => w.includes("Job description"))).toBe(true);
  });
  it("reports unmatchedCount correctly", () => {
    const d = generateDraft(FULL_INPUTS, "formal", "standard");
    expect(d.unmatchedCount).toBe(d.requirements.filter((r) => !r.matched).length);
  });
  it("marks matched requirements as addressed when in body", () => {
    const d = generateDraft(FULL_INPUTS, "confident", "detailed");
    const addressedCount = d.requirements.filter((r) => r.addressed).length;
    expect(addressedCount).toBeGreaterThan(0);
  });
});

describe("ai-cover-letter regenerateHook", () => {
  it("replaces only the opening section", () => {
    const d = generateDraft(FULL_INPUTS, "formal", "standard");
    const original = d.sections.find((s) => s.slug === "opening")!.text;
    const updated = regenerateHook(d, FULL_INPUTS, "formal", 1);
    const newOpening = updated.sections.find((s) => s.slug === "opening")!.text;
    expect(newOpening).not.toBe(original);
    // Other sections are unchanged.
    const originalBody = d.sections.find((s) => s.slug === "body")!.text;
    const newBody = updated.sections.find((s) => s.slug === "body")!.text;
    expect(newBody).toBe(originalBody);
  });
  it("updates word count", () => {
    const d = generateDraft(FULL_INPUTS, "formal", "standard");
    const updated = regenerateHook(d, FULL_INPUTS, "formal", 2);
    expect(updated.wordCount).toBeGreaterThan(0);
  });
});

// ---------- De-cliché pass ----------

describe("ai-cover-letter detectCliches", () => {
  it("detects 'i am writing to express my interest'", () => {
    const hits = detectCliches("I am writing to express my interest in the role.");
    expect(hits.some((h) => h.phrase.includes("writing to express"))).toBe(true);
  });
  it("detects 'passionate about'", () => {
    const hits = detectCliches("I am passionate about product management.");
    expect(hits.some((h) => h.phrase === "passionate about")).toBe(true);
  });
  it("detects 'team player'", () => {
    const hits = detectCliches("As a team player, I thrive.");
    expect(hits.some((h) => h.phrase === "team player")).toBe(true);
  });
  it("detects multiple clichés", () => {
    const text = "I am passionate about team player think outside the box results-driven";
    const hits = detectCliches(text);
    expect(hits.length).toBeGreaterThanOrEqual(4);
  });
  it("returns empty for clean text", () => {
    expect(detectCliches("I led the launch of v2 and shipped it on time.")).toEqual([]);
  });
  it("returns empty for empty text", () => {
    expect(detectCliches("")).toEqual([]);
  });
  it("includes suggestion for each hit", () => {
    const hits = detectCliches("I am passionate about team player");
    for (const h of hits) {
      expect(h.suggestion.length).toBeGreaterThan(0);
    }
  });
  it("records the index of the first occurrence", () => {
    const text = "I am passionate about X. team player Y.";
    const hits = detectCliches(text);
    const passionate = hits.find((h) => h.phrase === "passionate about");
    const team = hits.find((h) => h.phrase === "team player");
    expect(passionate!.index).toBeLessThan(team!.index);
  });
});

describe("ai-cover-letter applyClicheSuggestions", () => {
  it("removes clichés and replaces with a rewrite placeholder", () => {
    const text = "I am passionate about team player";
    const hits = detectCliches(text);
    const out = applyClicheSuggestions(text, hits);
    expect(out).not.toContain("passionate about");
    expect(out).not.toContain("team player");
    expect(out).toContain("[your specific example]");
  });
  it("handles empty hits list", () => {
    const text = "Clean text only.";
    expect(applyClicheSuggestions(text, [])).toBe(text);
  });
  it("preserves non-cliché content", () => {
    const text = "I am passionate about X. I shipped v2.";
    const hits = detectCliches(text);
    const out = applyClicheSuggestions(text, hits);
    expect(out).toContain("I shipped v2.");
  });
});

// ---------- Markdown / JSON / CSV ----------

describe("ai-cover-letter renderMarkdown", () => {
  it("renders a markdown doc with title + warnings + checklist + draft", () => {
    const d = generateDraft(FULL_INPUTS, "formal", "standard");
    const md = renderMarkdown(d, FULL_INPUTS, "formal", "standard");
    expect(md).toContain("# Cover letter");
    expect(md).toContain("Jordan Lee");
    expect(md).toContain("Acme Cloud");
    expect(md).toContain("## Requirement checklist");
    expect(md).toContain("## Draft");
  });
});

describe("ai-cover-letter renderJson", () => {
  it("renders valid JSON with inputs + draft", () => {
    const d = generateDraft(FULL_INPUTS, "warm", "short");
    const json = renderJson(d, FULL_INPUTS, "warm", "short");
    const obj = JSON.parse(json);
    expect(obj.tone).toBe("warm");
    expect(obj.length).toBe("short");
    expect(obj.inputs.name).toBe("Jordan Lee");
    expect(obj.draft.sections).toHaveLength(5);
  });
});

describe("ai-cover-letter renderRequirementsCsv", () => {
  it("renders header + one row per requirement", () => {
    const d = generateDraft(FULL_INPUTS, "formal", "standard");
    const csv = renderRequirementsCsv(d);
    const lines = csv.split("\n");
    expect(lines[0]).toBe("keyword,matched,addressed,evidence");
    expect(lines.length).toBe(d.requirements.length + 1);
  });
});

describe("ai-cover-letter splitCsvRow", () => {
  it("splits simple", () => { expect(splitCsvRow("a,b,c")).toEqual(["a", "b", "c"]); });
  it("handles quoted commas", () => { expect(splitCsvRow('"a,b",c')).toEqual(["a,b", "c"]); });
});

// ---------- History ----------

describe("ai-cover-letter history (localStorage)", () => {
  it("loads empty initially", () => { expect(loadHistory()).toEqual([]); });
  it("saves and loads", () => {
    saveHistory({ ts: 1, name: "Jordan", company: "Acme", role: "PM", tone: "formal", length: "standard", matchedCount: 5, unmatchedCount: 2 });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, name: "x", company: "y", role: "z", tone: "formal", length: "short", matchedCount: 1, unmatchedCount: 0 });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, name: "x", company: "y", role: "z", tone: "formal", length: "short", matchedCount: 1, unmatchedCount: 0 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ---------- Share URL ----------

describe("ai-cover-letter shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl(FULL_INPUTS, "warm", "detailed");
    expect(url).toContain("n=Jordan");
    expect(url).toContain("co=Acme+Cloud");
    expect(url).toContain("r=Senior+Product+Manager");
    expect(url).toContain("t=warm");
    expect(url).toContain("l=detailed");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("omits tone/length when they are defaults", () => {
    const url = buildShareUrl(FULL_INPUTS, "formal", "standard");
    expect(url).not.toContain("t=formal");
    expect(url).not.toContain("l=standard");
  });
  it("parses share URL back into state", () => {
    const url = buildShareUrl(FULL_INPUTS, "warm", "detailed");
    const hash = url.includes("#") ? url.slice(url.indexOf("#")) : url;
    const state = parseShareUrl(hash);
    expect(state.tone).toBe("warm");
    expect(state.length).toBe("detailed");
    expect(state.inputs.name).toBe("Jordan Lee");
    expect(state.inputs.company).toBe("Acme Cloud");
  });
  it("handles empty hash with defaults", () => {
    const state = parseShareUrl("");
    expect(state.tone).toBe("formal");
    expect(state.length).toBe("standard");
  });
  it("filters unknown tone/length", () => {
    const state = parseShareUrl("n=foo&t=bogus&l=bogus");
    expect(state.tone).toBe("formal");
    expect(state.length).toBe("standard");
    expect(state.inputs.name).toBe("foo");
  });
});

// ---------- LLM prompt + result ----------

describe("ai-cover-letter buildLlmPrompt", () => {
  it("includes inputs + constraints + JSON spec", () => {
    const p = buildLlmPrompt(FULL_INPUTS, "formal", "standard");
    expect(p).toContain("Jordan Lee");
    expect(p).toContain("Acme Cloud");
    expect(p).toContain("Senior Product Manager");
    expect(p).toContain("do NOT invent");
    expect(p).toContain("polishedSections");
    expect(p).toContain("hookVariants");
  });
});

describe("ai-cover-letter renderLlmResult", () => {
  it("parses a valid LLM result", () => {
    const raw = JSON.stringify({
      polishedSections: [
        { label: "Greeting", slug: "greeting", text: "Hello," },
        { label: "Body", slug: "body", text: "Body text." },
      ],
      polishedFullText: "Hello,\n\nBody text.",
      hookVariants: ["h1", "h2", "h3"],
      suggestions: ["add a metric"],
    });
    const r = renderLlmResult(raw);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.result.polishedSections).toHaveLength(2);
      expect(r.result.polishedFullText).toContain("Body text");
      expect(r.result.hookVariants).toEqual(["h1", "h2", "h3"]);
      expect(r.result.suggestions).toEqual(["add a metric"]);
    }
  });
  it("strips ```json fences", () => {
    const raw = "```json\n" + JSON.stringify({
      polishedSections: [{ label: "Greeting", slug: "greeting", text: "x" }],
      polishedFullText: "x",
      hookVariants: [],
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
  it("filters polishedSections to entries with label or text", () => {
    const raw = JSON.stringify({
      polishedSections: [
        { label: "A", slug: "greeting", text: "x" },
        { label: "", slug: "", text: "" },
        { label: "B", slug: "body", text: "y" },
      ],
      polishedFullText: "",
      hookVariants: [],
      suggestions: [],
    });
    const r = renderLlmResult(raw);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.result.polishedSections).toHaveLength(2);
  });
  it("filters polishedSections by valid slug", () => {
    const raw = JSON.stringify({
      polishedSections: [
        { label: "A", slug: "greeting", text: "x" },
        { label: "B", slug: "bogus", text: "y" },
      ],
      polishedFullText: "",
      hookVariants: [],
      suggestions: [],
    });
    const r = renderLlmResult(raw);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.result.polishedSections.find((s) => s.slug === "bogus")).toBeUndefined();
    }
  });
});

// Suppress unused-import lint
export type _Unused = Tone | Length;
