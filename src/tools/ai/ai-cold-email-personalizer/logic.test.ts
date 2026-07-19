import { describe, it, expect, beforeEach } from "vitest";
import {
  HISTORY_KEY,
  HISTORY_MAX,
  LLM_KEY_STORAGE,
  TONE_LABELS,
  CTA_LABELS,
  SPAM_WORDS,
  FIELD_HINTS,
  validateInputs,
  escapeRegex,
  detectSpamWords,
  computeSpamRisk,
  countSentences,
  countWords,
  computeReadability,
  extractContextHook,
  buildOpener,
  buildBody,
  buildCta,
  buildEmailText,
  buildSubject,
  generateVariations,
  generateFollowUpSequence,
  buildMergeFieldTemplate,
  generate,
  renderMarkdown,
  renderJson,
  renderCsv,
  splitCsvRow,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  renderLlmResult,
  type EmailInputs,
  type Tone,
  type CtaType,
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

const FULL_INPUTS: EmailInputs = {
  prospect: {
    name: "Priya",
    company: "Northwind Labs",
    industry: "B2B SaaS",
    role: "VP of Marketing",
    context: "Just published a post on why attribution dashboards break at $10M ARR.",
    painPoints: "Spending 4+ hours/week stitching ad spend data in spreadsheets.",
  },
  sender: {
    name: "Sam Rivera",
    company: "Acme Attribution",
    offer: "Acme gives revenue teams a single live source of truth for ad spend and pipeline, no SQL required.",
    socialProof: "Helped Loom cut reporting time from 8 hours to 20 minutes/week.",
    ctaType: "demo",
  },
};

describe("ai-cold-email constants & hints", () => {
  it("has 3 tones and 4 CTA types", () => {
    expect(Object.keys(TONE_LABELS)).toHaveLength(3);
    expect(Object.keys(CTA_LABELS)).toHaveLength(4);
  });
  it("has at least 40 spam words", () => {
    expect(SPAM_WORDS.length).toBeGreaterThanOrEqual(40);
    expect(SPAM_WORDS).toContain("free");
    expect(SPAM_WORDS).toContain("guarantee");
    expect(SPAM_WORDS).toContain("!!!");
  });
  it("has no duplicate spam words", () => {
    const set = new Set(SPAM_WORDS.map((w) => w.toLowerCase()));
    expect(set.size).toBe(SPAM_WORDS.length);
  });
  it("has hints for all expected fields", () => {
    const expected = [
      "prospectName", "prospectCompany", "prospectIndustry", "prospectRole",
      "prospectContext", "prospectPainPoints",
      "senderName", "senderCompany", "senderOffer", "senderSocialProof", "senderCtaType",
    ];
    for (const k of expected) {
      expect(FIELD_HINTS[k]).toBeTruthy();
      expect(FIELD_HINTS[k].hint.length).toBeGreaterThan(5);
      expect(FIELD_HINTS[k].sample.length).toBeGreaterThan(0);
    }
  });
  it("exposes storage constants", () => {
    expect(HISTORY_KEY).toContain("ai-cold-email-personalizer");
    expect(HISTORY_MAX).toBe(20);
    expect(LLM_KEY_STORAGE).toContain("ai-cold-email-personalizer");
  });
});

describe("ai-cold-email validation", () => {
  it("flags missing required fields", () => {
    const w = validateInputs({ prospect: {} as EmailInputs["prospect"], sender: {} as EmailInputs["sender"] });
    expect(w.length).toBeGreaterThanOrEqual(6);
    expect(w.some((x) => x.includes("Prospect name"))).toBe(true);
    expect(w.some((x) => x.includes("Prospect company"))).toBe(true);
    expect(w.some((x) => x.includes("Your name"))).toBe(true);
  });
  it("flags thin context (< 20 chars)", () => {
    const w = validateInputs({
      prospect: { ...FULL_INPUTS.prospect, context: "short" },
      sender: FULL_INPUTS.sender,
    });
    expect(w.some((x) => x.includes("thin"))).toBe(true);
  });
  it("flags generic superlatives in offer", () => {
    const w = validateInputs({
      prospect: FULL_INPUTS.prospect,
      sender: { ...FULL_INPUTS.sender, offer: "We are the best, world-class platform." },
    });
    expect(w.some((x) => x.includes("superlatives"))).toBe(true);
  });
  it("passes clean inputs with no warnings", () => {
    const w = validateInputs(FULL_INPUTS);
    expect(w).toEqual([]);
  });
});

describe("ai-cold-email spam detection", () => {
  it("escapeRegex escapes special chars", () => {
    expect(escapeRegex("a.b*c")).toBe("a\\.b\\*c");
  });
  it("detects single spam word", () => {
    expect(detectSpamWords("Get this for free today")).toContain("free");
  });
  it("detects multiple spam words", () => {
    const found = detectSpamWords("Free! Act now for a guaranteed discount");
    expect(found).toContain("free");
    expect(found).toContain("act now");
    expect(found).toContain("guaranteed");
    expect(found).toContain("discount");
  });
  it("does not flag safe text", () => {
    expect(detectSpamWords("Hi Priya, saw your work at Northwind Labs.")).toEqual([]);
  });
  it("respects word boundaries (no false positive on 'freedom')", () => {
    expect(detectSpamWords("We value freedom to choose")).not.toContain("free");
  });
  it("computeSpamRisk returns low risk for clean text", () => {
    const r = computeSpamRisk("Hi there — loved your post on attribution.");
    expect(r.level).toBe("low");
    expect(r.score).toBe(0);
    expect(r.triggers).toEqual([]);
  });
  it("computeSpamRisk returns high risk for spammy text", () => {
    const r = computeSpamRisk("FREE!!! Act now for a guaranteed discount. Click here to win!");
    expect(r.level).toBe("high");
    expect(r.score).toBeGreaterThanOrEqual(50);
    expect(r.triggers.length).toBeGreaterThanOrEqual(3);
  });
});

describe("ai-cold-email readability", () => {
  it("countWords returns 0 for empty", () => {
    expect(countWords("")).toBe(0);
  });
  it("countWords counts words", () => {
    expect(countWords("hi there friend")).toBe(3);
  });
  it("countSentences returns 0/1 for empty", () => {
    expect(countSentences("")).toBe(0);
  });
  it("countSentences counts terminators", () => {
    expect(countSentences("Hi. Hello! Howdy?")).toBe(3);
  });
  it("computeReadability flags short emails", () => {
    const r = computeReadability("Hi there.");
    expect(r.note).toBe("short");
    expect(r.wordCount).toBeLessThan(30);
  });
  it("computeReadability flags too-long emails", () => {
    const long = "This is a very long email. ".repeat(30); // 180 words
    const r = computeReadability(long);
    expect(r.note).toBe("too-long");
    expect(r.wordCount).toBeGreaterThan(150);
  });
  it("computeReadability returns on-target for medium length", () => {
    const r = computeReadability("Hi Priya. Saw your post on attribution dashboards breaking at scale. Acme helps revenue teams get a single live source of truth for ad spend and pipeline, with no SQL required. Open to a 15-minute demo this week?");
    expect(r.note).toBe("on-target");
    expect(r.wordCount).toBeGreaterThanOrEqual(30);
    expect(r.wordCount).toBeLessThanOrEqual(150);
    expect(r.readingTimeSec).toBeGreaterThan(0);
  });
});

describe("ai-cold-email extractContextHook", () => {
  it("returns empty for empty input", () => {
    expect(extractContextHook("")).toBe("");
  });
  it("truncates long context to ~140 chars with ellipsis", () => {
    // 20-char words joined by space — 16 words >> 140 chars, so truncation triggers.
    const long = Array.from({ length: 20 }, () => "supercalifragilistic").join(" ");
    const out = extractContextHook(long);
    expect(out.length).toBeLessThanOrEqual(143);
    expect(out.endsWith("…")).toBe(true);
  });
  it("keeps short context unchanged", () => {
    const short = "Just published a post on attribution.";
    expect(extractContextHook(short)).toBe(short);
  });
});

describe("ai-cold-email buildOpener", () => {
  it("returns concise opener variant 0", () => {
    const o = buildOpener(FULL_INPUTS.prospect, "concise", 0);
    expect(o).toContain("Priya");
    expect(o).toContain("Northwind Labs");
  });
  it("rotates variants within a tone", () => {
    const a = buildOpener(FULL_INPUTS.prospect, "concise", 0);
    const b = buildOpener(FULL_INPUTS.prospect, "concise", 1);
    const c = buildOpener(FULL_INPUTS.prospect, "concise", 2);
    expect(a).not.toBe(b);
    expect(b).not.toBe(c);
    expect(a).not.toBe(c);
  });
  it("wraps variant index with modulo", () => {
    const a = buildOpener(FULL_INPUTS.prospect, "concise", 3);
    const b = buildOpener(FULL_INPUTS.prospect, "concise", 0);
    expect(a).toBe(b);
  });
  it("formal tone uses formal greeting", () => {
    const o = buildOpener(FULL_INPUTS.prospect, "formal", 0);
    expect(/Hello|Dear|Hi/.test(o)).toBe(true);
  });
});

describe("ai-cold-email buildBody & buildCta", () => {
  it("buildBody references pain points", () => {
    const b = buildBody(FULL_INPUTS, "concise");
    expect(b.toLowerCase()).toContain("spending 4+ hours");
  });
  it("buildBody includes social proof when present", () => {
    const b = buildBody(FULL_INPUTS, "concise");
    expect(b).toContain("Loom");
  });
  it("buildCta produces demo CTA", () => {
    const cta = buildCta(FULL_INPUTS, "concise");
    expect(cta.toLowerCase()).toContain("demo");
  });
  it("buildCta produces call CTA", () => {
    const cta = buildCta({ ...FULL_INPUTS, sender: { ...FULL_INPUTS.sender, ctaType: "call" } }, "concise");
    expect(cta.toLowerCase()).toContain("call");
  });
  it("buildCta produces reply CTA", () => {
    const cta = buildCta({ ...FULL_INPUTS, sender: { ...FULL_INPUTS.sender, ctaType: "reply" } }, "concise");
    expect(cta.length).toBeGreaterThan(5);
  });
  it("buildCta produces resource CTA", () => {
    const cta = buildCta({ ...FULL_INPUTS, sender: { ...FULL_INPUTS.sender, ctaType: "resource" } }, "concise");
    expect(cta.toLowerCase()).toContain("case study");
  });
});

describe("ai-cold-email buildEmailText & buildSubject", () => {
  it("buildEmailText includes opener, body, CTA, signature, footer", () => {
    const t = buildEmailText(FULL_INPUTS, "concise", 0);
    expect(t).toContain("Priya");
    expect(t).toContain("Acme Attribution");
    expect(t).toContain("Sam Rivera");
    expect(t).toContain("CAN-SPAM");
  });
  it("buildSubject returns different subjects per tone", () => {
    const c = buildSubject(FULL_INPUTS, "concise");
    const f = buildSubject(FULL_INPUTS, "friendly");
    const fo = buildSubject(FULL_INPUTS, "formal");
    expect(c).not.toBe(f);
    expect(f).not.toBe(fo);
    expect(c).toContain("Northwind Labs");
  });
});

describe("ai-cold-email generateVariations", () => {
  it("generates 5+ variations", () => {
    const vs = generateVariations(FULL_INPUTS, "concise");
    expect(vs.length).toBeGreaterThanOrEqual(5);
  });
  it("marks exactly one primary", () => {
    const vs = generateVariations(FULL_INPUTS, "friendly");
    expect(vs.filter((v) => v.primary).length).toBe(1);
    expect(vs.find((v) => v.primary)!.tone).toBe("friendly");
  });
  it("every variation has spam risk and readability", () => {
    const vs = generateVariations(FULL_INPUTS, "concise");
    for (const v of vs) {
      expect(v.spamRisk).toBeTruthy();
      expect(v.readability).toBeTruthy();
      expect(v.readability.wordCount).toBeGreaterThan(0);
      expect(v.fullText.length).toBeGreaterThan(0);
    }
  });
  it("spans multiple tones", () => {
    const vs = generateVariations(FULL_INPUTS, "concise");
    const tones = new Set(vs.map((v) => v.tone));
    expect(tones.size).toBeGreaterThanOrEqual(2);
  });
});

describe("ai-cold-email generateFollowUpSequence", () => {
  it("generates 4 touches", () => {
    const seq = generateFollowUpSequence(FULL_INPUTS, "concise");
    expect(seq).toHaveLength(4);
    expect(seq.map((t) => t.touch)).toEqual([1, 2, 3, 4]);
  });
  it("touch 1 references prospect company", () => {
    const seq = generateFollowUpSequence(FULL_INPUTS, "concise");
    expect(seq[0].fullText).toContain("Northwind Labs");
  });
  it("touch 4 is a break-up email", () => {
    const seq = generateFollowUpSequence(FULL_INPUTS, "concise");
    expect(seq[3].cta.toLowerCase()).toContain("break-up");
  });
  it("every touch has subject and body", () => {
    const seq = generateFollowUpSequence(FULL_INPUTS, "concise");
    for (const t of seq) {
      expect(t.subject.length).toBeGreaterThan(0);
      expect(t.body.length).toBeGreaterThan(0);
      expect(t.fullText).toContain(t.subject);
    }
  });
});

describe("ai-cold-email buildMergeFieldTemplate", () => {
  it("contains merge placeholders", () => {
    const t = buildMergeFieldTemplate(FULL_INPUTS, "concise");
    expect(t).toContain("{{first_name}}");
    expect(t).toContain("{{company}}");
    expect(t).toContain("{{sender_name}}");
    expect(t).toContain("{{opt_out_footer}}");
  });
});

describe("ai-cold-email generate (top-level)", () => {
  it("returns variations, sequence, merge template, warnings", () => {
    const out = generate(FULL_INPUTS, "concise");
    expect(out.variations.length).toBeGreaterThanOrEqual(5);
    expect(out.followUpSequence).toHaveLength(4);
    expect(out.mergeFieldTemplate.length).toBeGreaterThan(0);
    expect(out.warnings).toEqual([]);
  });
  it("returns warnings for thin inputs", () => {
    const out = generate({
      prospect: { name: "X", company: "Y", industry: "", role: "", context: "", painPoints: "" },
      sender: { name: "A", company: "B", offer: "", socialProof: "", ctaType: "demo" },
    }, "concise");
    expect(out.warnings.length).toBeGreaterThan(0);
  });
});

describe("ai-cold-email render functions", () => {
  it("renderMarkdown includes headers and variations", () => {
    const out = generate(FULL_INPUTS, "concise");
    const md = renderMarkdown(out, FULL_INPUTS, "concise");
    expect(md).toContain("# Cold email sequence");
    expect(md).toContain("## Variations");
    expect(md).toContain("## Follow-up sequence");
    expect(md).toContain("## Merge-field template");
    expect(md).toContain("CAN-SPAM");
  });
  it("renderJson is valid JSON", () => {
    const out = generate(FULL_INPUTS, "concise");
    const j = renderJson(out, FULL_INPUTS, "concise");
    const parsed = JSON.parse(j);
    expect(parsed.inputs).toBeTruthy();
    expect(parsed.output).toBeTruthy();
  });
  it("renderCsv includes header and rows", () => {
    const out = generate(FULL_INPUTS, "concise");
    const csv = renderCsv(out);
    expect(csv.split("\n")[0]).toContain("id,tone,primary");
    expect(csv.split("\n").length).toBe(out.variations.length + 1);
  });
  it("splitCsvRow handles quoted commas", () => {
    expect(splitCsvRow('"a,b",c')).toEqual(["a,b", "c"]);
  });
});

describe("ai-cold-email history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, prospectName: "Priya", prospectCompany: "Northwind", tone: "concise", primaryExcerpt: "Hi Priya" });
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0].prospectName).toBe("Priya");
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, prospectName: `p${i}`, prospectCompany: "co", tone: "concise", primaryExcerpt: "x" } as HistoryEntry);
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, prospectName: "x", prospectCompany: "y", tone: "concise", primaryExcerpt: "z" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("ai-cold-email shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl(FULL_INPUTS, "friendly");
    expect(url).toContain("pname=Priya");
    expect(url).toContain("pco=Northwind+Labs");
    expect(url).toContain("tone=friendly");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const url = buildShareUrl(FULL_INPUTS, "formal");
    // Extract hash portion
    const hash = url.includes("#") ? url.slice(url.indexOf("#")) : url;
    const p = parseShareUrl(hash);
    expect(p.prospect.name).toBe("Priya");
    expect(p.prospect.company).toBe("Northwind Labs");
    expect(p.sender.company).toBe("Acme Attribution");
    expect(p.tone).toBe("formal");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({ prospect: {}, sender: {}, tone: "concise" });
  });
  it("filters invalid CTA and tone", () => {
    const p = parseShareUrl("scta=bogus&tone=hacker");
    expect(p.sender.ctaType).toBeUndefined();
    expect(p.tone).toBe("concise");
  });
  it("accepts valid CTA type", () => {
    const p = parseShareUrl("scta=call");
    expect(p.sender.ctaType).toBe("call");
  });
});

describe("ai-cold-email LLM prompt & result", () => {
  it("buildLlmPrompt includes prospect and sender details", () => {
    const p = buildLlmPrompt(FULL_INPUTS, "concise");
    expect(p).toContain("Priya");
    expect(p).toContain("Northwind Labs");
    expect(p).toContain("Sam Rivera");
    expect(p).toContain("Acme Attribution");
    expect(p).toContain("JSON");
  });
  it("renderLlmResult parses valid JSON", () => {
    const raw = JSON.stringify({
      polishedOpener: "Hi",
      polishedBody: "Body",
      polishedCta: "Wanna?",
      polishedFullText: "Hi\n\nBody\n\nWanna?\n— Sam",
      subjectLines: ["s1", "s2", "s3"],
      suggestions: ["add a stat"],
    });
    const r = renderLlmResult(raw);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.result.polishedOpener).toBe("Hi");
      expect(r.result.subjectLines).toHaveLength(3);
      expect(r.result.suggestions).toEqual(["add a stat"]);
    }
  });
  it("renderLlmResult handles ```json fences", () => {
    const raw = "```json\n" + JSON.stringify({ polishedOpener: "X", subjectLines: [], suggestions: [] }) + "\n```";
    const r = renderLlmResult(raw);
    expect(r.ok).toBe(true);
  });
  it("renderLlmResult errors on bad JSON", () => {
    const r = renderLlmResult("not json");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("JSON");
  });
  it("renderLlmResult errors on non-object", () => {
    const r = renderLlmResult("[1,2,3]");
    expect(r.ok).toBe(false);
  });
});

// Suppress unused-import lint
export type _Unused = Tone | CtaType | HistoryEntry;
