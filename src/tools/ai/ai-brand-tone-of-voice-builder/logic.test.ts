import { describe, it, expect, beforeEach } from "vitest";
import {
  HISTORY_KEY,
  HISTORY_MAX,
  DIMENSION_ORDER,
  DIMENSION_META,
  STOPWORDS,
  HUMOR_CUES,
  PROFANITY_CUES,
  SARCASM_CUES,
  INTENSIFIERS,
  EARNEST_CUES,
  CYNICAL_CUES,
  SUBVERSIVE_CUES,
  CONSERVATIVE_CUES,
  SLANG_CUES,
  JARGON_TERMS,
  ABLEIST_TERMS,
  GENDERED_TERMS,
  splitSentences,
  tokenize,
  countWords,
  countSyllables,
  escapeRegex,
  countPhrase,
  countCues,
  computeReadability,
  computeSentenceRhythm,
  defaultDimensions,
  estimateDimensions,
  deriveTraits,
  deriveDosAndDonts,
  deriveApprovedVocab,
  detectAvoidVocab,
  deriveExamples,
  buildSystemPrompt,
  detectInclusivityIssues,
  applyInclusivityFixes,
  buildProfile,
  checkDraft,
  renderMarkdown,
  renderJson,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  renderLlmResult,
  type Dimensions,
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

const CASUAL_SAMPLE = `Hey friends! We're super excited to launch our new thing today. It's gonna blow your mind, lol.
Honestly, we love what we built. You'll gonna wanna try this. It's amazing, incredible, and totally awesome.
We're passionate about helping you. We believe in you. Let's go!`;

const FORMAL_SAMPLE = `The Board of Directors is pleased to announce the commencement of a new strategic initiative.
This initiative will facilitate the operationalization of customer success across the enterprise.
Management will provide further updates in due course. Please do not hesitate to contact us should you require additional information.`;

const IRREVERENT_SAMPLE = `Look, the old way is broken. Obviously. We're here to tear it down and build something that doesn't suck.
Disrupt the stale paradigm. Reinvent the wheel. Question everything, especially the so-called experts.
Yeah right, the incumbents will tell you their way works. It doesn't. Smash the mold.`;

describe("ai-brand-tone constants & lexicon integrity", () => {
  it("has 6 dimensions in canonical order", () => {
    expect(DIMENSION_ORDER).toHaveLength(6);
    expect(DIMENSION_ORDER).toEqual([
      "formalCasual", "funnySerious", "respectfulIrreverent",
      "matterOfFactEnthusiastic", "subversiveConservative", "cynicalEarnest",
    ]);
  });
  it("every dimension has meta with left, right, description", () => {
    for (const key of DIMENSION_ORDER) {
      const m = DIMENSION_META[key];
      expect(m.left.length).toBeGreaterThan(0);
      expect(m.right.length).toBeGreaterThan(0);
      expect(m.description.length).toBeGreaterThan(10);
    }
  });
  it("cue lexicons are non-empty", () => {
    expect(HUMOR_CUES.length).toBeGreaterThan(5);
    expect(PROFANITY_CUES.length).toBeGreaterThan(3);
    expect(SARCASM_CUES.length).toBeGreaterThan(3);
    expect(INTENSIFIERS.length).toBeGreaterThan(5);
    expect(EARNEST_CUES.length).toBeGreaterThan(3);
    expect(CYNICAL_CUES.length).toBeGreaterThan(3);
    expect(SUBVERSIVE_CUES.length).toBeGreaterThan(3);
    expect(CONSERVATIVE_CUES.length).toBeGreaterThan(3);
    expect(SLANG_CUES.length).toBeGreaterThan(5);
  });
  it("jargon, ableist, gendered lexicons are non-empty", () => {
    expect(JARGON_TERMS.length).toBeGreaterThan(10);
    expect(Object.keys(ABLEIST_TERMS).length).toBeGreaterThan(5);
    expect(Object.keys(GENDERED_TERMS).length).toBeGreaterThan(5);
  });
  it("stopwords set is non-empty and contains common words", () => {
    expect(STOPWORDS.size).toBeGreaterThan(50);
    expect(STOPWORDS.has("the")).toBe(true);
    expect(STOPWORDS.has("and")).toBe(true);
  });
  it("has correct history constants", () => {
    expect(HISTORY_KEY).toBe("unqtools:ai-brand-tone-of-voice-builder:history");
    expect(HISTORY_MAX).toBe(20);
  });
});

describe("ai-brand-tone text utilities", () => {
  it("splitSentences parses basic sentences", () => {
    const s = splitSentences("Hello world. This is a test! Is it working?");
    expect(s).toHaveLength(3);
  });
  it("splitSentences returns empty for empty input", () => {
    expect(splitSentences("")).toEqual([]);
  });
  it("tokenize lowercases and strips punctuation", () => {
    expect(tokenize("Hello, WORLD! It's working.")).toEqual([
      "hello", "world", "it's", "working",
    ]);
  });
  it("countWords counts whitespace-separated tokens", () => {
    expect(countWords("one two three")).toBe(3);
    expect(countWords("")).toBe(0);
    expect(countWords("   ")).toBe(0);
  });
  it("countSyllables handles short and long words", () => {
    expect(countSyllables("the")).toBe(1);
    expect(countSyllables("apple")).toBe(2);
    expect(countSyllables("banana")).toBeGreaterThanOrEqual(2);
  });
  it("escapeRegex escapes metacharacters", () => {
    const re = new RegExp(escapeRegex("high-quality"));
    expect(re.test("high-quality")).toBe(true);
  });
  it("countPhrase matches case-insensitively and word-bounded", () => {
    expect(countPhrase("We utilize things and Utilize them", "utilize")).toBe(2);
    expect(countPhrase("utilization is different", "utilize")).toBe(0);
  });
  it("countCues returns total and per-cue hits", () => {
    const r = countCues("lol that's hilarious lol", HUMOR_CUES);
    expect(r.total).toBe(3); // lol × 2 + hilarious × 1
    expect(r.hits.find((h) => h.cue === "lol")?.count).toBe(2);
    expect(r.hits.find((h) => h.cue === "hilarious")?.count).toBe(1);
  });
});

describe("ai-brand-tone readability & rhythm", () => {
  it("computeReadability returns 0 for empty text", () => {
    const r = computeReadability("");
    expect(r.fleschScore).toBe(0);
    expect(r.label).toBe("—");
  });
  it("computeReadability scores simple text higher than dense text", () => {
    const simple = computeReadability("The cat sat on the mat. The dog ran fast.");
    const dense = computeReadability("Notwithstanding the aforementioned circumstances, the operationalization of subsequent initiatives necessitates comprehensive methodological frameworks.");
    expect(simple.fleschScore).toBeGreaterThan(dense.fleschScore);
  });
  it("computeReadability produces a label and grade level", () => {
    const r = computeReadability("The cat sat on the mat.");
    expect(r.label.length).toBeGreaterThan(0);
    expect(r.gradeLevel).toBeGreaterThanOrEqual(0);
  });
  it("computeSentenceRhythm returns 0 for empty text", () => {
    const r = computeSentenceRhythm("");
    expect(r.avgSentenceLength).toBe(0);
    expect(r.label).toBe("—");
  });
  it("computeSentenceRhythm computes average and stddev", () => {
    const r = computeSentenceRhythm("Short sentence. This is a much longer sentence with many words in it.");
    expect(r.avgSentenceLength).toBeGreaterThan(0);
    expect(r.stddev).toBeGreaterThan(0);
    expect(r.label.length).toBeGreaterThan(0);
  });
});

describe("ai-brand-tone dimension estimation", () => {
  it("defaultDimensions returns all 50s", () => {
    const d = defaultDimensions();
    for (const key of DIMENSION_ORDER) {
      expect(d[key]).toBe(50);
    }
  });
  it("estimateDimensions returns defaults for empty samples", () => {
    const d = estimateDimensions("");
    for (const key of DIMENSION_ORDER) {
      expect(d[key]).toBe(50);
    }
  });
  it("estimateDimensions shifts casual sample toward casual/funny/enthusiastic/earnest", () => {
    const d = estimateDimensions(CASUAL_SAMPLE);
    expect(d.formalCasual).toBeGreaterThan(50);
    expect(d.funnySerious).toBeLessThan(50);
    expect(d.matterOfFactEnthusiastic).toBeGreaterThan(50);
    expect(d.cynicalEarnest).toBeGreaterThan(50);
  });
  it("estimateDimensions shifts formal sample toward formal/serious", () => {
    const d = estimateDimensions(FORMAL_SAMPLE);
    expect(d.formalCasual).toBeLessThan(50);
    expect(d.funnySerious).toBeGreaterThan(50);
  });
  it("estimateDimensions shifts irreverent sample toward irreverent/subversive/cynical", () => {
    const d = estimateDimensions(IRREVERENT_SAMPLE);
    expect(d.respectfulIrreverent).toBeGreaterThan(50);
    expect(d.subversiveConservative).toBeLessThan(50);
    expect(d.cynicalEarnest).toBeLessThan(50);
  });
  it("estimateDimensions clamps to 0-100", () => {
    const extreme = "lol! lol! lol! gonna gonna gonna yeah right obviously disrupt disrupt disrupt";
    const d = estimateDimensions(extreme);
    for (const key of DIMENSION_ORDER) {
      expect(d[key]).toBeGreaterThanOrEqual(0);
      expect(d[key]).toBeLessThanOrEqual(100);
    }
  });
});

describe("ai-brand-tone trait derivation", () => {
  it("returns 'Balanced' for neutral dimensions", () => {
    expect(deriveTraits(defaultDimensions())).toEqual(["Balanced"]);
  });
  it("returns multiple traits for polarized dimensions", () => {
    const d: Dimensions = {
      ...defaultDimensions(),
      formalCasual: 80,   // Conversational
      funnySerious: 20,   // Playful
      matterOfFactEnthusiastic: 80, // Energetic
    };
    const t = deriveTraits(d);
    expect(t).toContain("Conversational");
    expect(t).toContain("Playful");
    expect(t).toContain("Energetic");
  });
  it("never returns duplicates", () => {
    const d: Dimensions = {
      ...defaultDimensions(),
      formalCasual: 80,
    };
    const t = deriveTraits(d);
    expect(new Set(t).size).toBe(t.length);
  });
});

describe("ai-brand-tone do/don't derivation", () => {
  it("always includes the baseline proofreading rules", () => {
    const { dos, donts } = deriveDosAndDonts(defaultDimensions());
    expect(dos.some((d) => d.includes("aloud"))).toBe(true);
    expect(donts.some((d) => d.includes("proofreading"))).toBe(true);
  });
  it("adds formal rules when formalCasual < 40", () => {
    const d: Dimensions = { ...defaultDimensions(), formalCasual: 20 };
    const { dos, donts } = deriveDosAndDonts(d);
    expect(dos.some((x) => x.includes("complete words"))).toBe(true);
    expect(donts.some((x) => x.includes("contractions"))).toBe(true);
  });
  it("adds casual rules when formalCasual > 60", () => {
    const d: Dimensions = { ...defaultDimensions(), formalCasual: 80 };
    const { dos, donts } = deriveDosAndDonts(d);
    expect(dos.some((x) => x.includes("contractions"))).toBe(true);
    expect(donts.some((x) => x.includes("Latinate"))).toBe(true);
  });
  it("adds enthusiastic rules when matterOfFactEnthusiastic > 60", () => {
    const d: Dimensions = { ...defaultDimensions(), matterOfFactEnthusiastic: 80 };
    const { dos, donts } = deriveDosAndDonts(d);
    expect(dos.some((x) => x.toLowerCase().includes("intensifier"))).toBe(true);
    expect(donts.some((x) => x.toLowerCase().includes("hedge"))).toBe(true);
  });
});

describe("ai-brand-tone vocabulary", () => {
  it("deriveApprovedVocab returns empty for empty samples", () => {
    expect(deriveApprovedVocab("")).toEqual([]);
  });
  it("deriveApprovedVocab excludes stopwords", () => {
    const v = deriveApprovedVocab("the cat sat on the mat and the cat ran fast");
    expect(v).not.toContain("the");
    expect(v).not.toContain("and");
    expect(v).toContain("cat");
  });
  it("deriveApprovedVocab respects the limit", () => {
    const v = deriveApprovedVocab("alpha beta gamma delta epsilon zeta eta theta iota kappa lambda", 5);
    expect(v.length).toBeLessThanOrEqual(5);
  });
  it("deriveApprovedVocab includes bigrams that repeat", () => {
    const v = deriveApprovedVocab("growth teams love growth teams growth teams build", 10);
    expect(v).toContain("growth teams");
  });
  it("detectAvoidVocab finds jargon", () => {
    const v = detectAvoidVocab("We leverage synergies to operationalize our paradigm.");
    expect(v).toContain("leverage");
    expect(v).toContain("synergies");
    expect(v).toContain("operationalize");
    expect(v).toContain("paradigm");
  });
  it("detectAvoidVocab finds ableist terms", () => {
    const v = detectAvoidVocab("That's crazy and insane.");
    expect(v).toContain("crazy");
    expect(v).toContain("insane");
  });
  it("detectAvoidVocab finds gendered terms", () => {
    const v = detectAvoidVocab("The chairman and salesman agreed.");
    expect(v).toContain("chairman");
    expect(v).toContain("salesman");
  });
  it("detectAvoidVocab returns empty for clean text", () => {
    expect(detectAvoidVocab("We help teams build great products.")).toEqual([]);
  });
});

describe("ai-brand-tone examples & system prompt", () => {
  it("deriveExamples returns 3 examples with before/after/note", () => {
    const ex = deriveExamples(defaultDimensions());
    expect(ex).toHaveLength(3);
    for (const e of ex) {
      expect(e.before.length).toBeGreaterThan(0);
      expect(e.after.length).toBeGreaterThan(0);
      expect(e.note.length).toBeGreaterThan(0);
    }
  });
  it("deriveExamples varies the after by dimensions", () => {
    const casual = deriveExamples({ ...defaultDimensions(), formalCasual: 90, matterOfFactEnthusiastic: 90 });
    const formal = deriveExamples({ ...defaultDimensions(), formalCasual: 10, matterOfFactEnthusiastic: 10 });
    expect(casual[0].after).not.toBe(formal[0].after);
  });
  it("buildSystemPrompt includes all 6 dimensions, traits, dos, donts", () => {
    const profile = buildProfile(CASUAL_SAMPLE);
    const prompt = buildSystemPrompt(profile);
    for (const key of DIMENSION_ORDER) {
      const meta = DIMENSION_META[key];
      expect(prompt).toContain(meta.left);
      expect(prompt).toContain(meta.right);
    }
    expect(prompt).toContain("## Do");
    expect(prompt).toContain("## Don't");
    expect(prompt).toContain("## Tone dimensions");
  });
});

describe("ai-brand-tone inclusivity", () => {
  it("detectInclusivityIssues finds ableist terms with suggestions", () => {
    const issues = detectInclusivityIssues("That idea is crazy and lame.");
    expect(issues.length).toBeGreaterThanOrEqual(2);
    expect(issues.some((i) => i.term.toLowerCase() === "crazy")).toBe(true);
    expect(issues.some((i) => i.term.toLowerCase() === "lame")).toBe(true);
    for (const i of issues) {
      expect(i.suggestion.length).toBeGreaterThan(0);
    }
  });
  it("detectInclusivityIssues finds gendered terms", () => {
    const issues = detectInclusivityIssues("Hey guys, the chairman is here.");
    expect(issues.some((i) => i.term.toLowerCase() === "guys")).toBe(true);
    expect(issues.some((i) => i.term.toLowerCase() === "chairman")).toBe(true);
  });
  it("detectInclusivityIssues returns empty for clean text", () => {
    expect(detectInclusivityIssues("Hello team, the chair is here.")).toEqual([]);
  });
  it("applyInclusivityFixes replaces all flagged terms", () => {
    const fixed = applyInclusivityFixes("The chairman told the guys that the plan was crazy.");
    expect(fixed.toLowerCase()).not.toContain("chairman");
    expect(fixed.toLowerCase()).not.toContain("guys");
    expect(fixed.toLowerCase()).not.toContain("crazy");
    expect(fixed.toLowerCase()).toContain("chair");
    expect(fixed.toLowerCase()).toContain("team");
  });
  it("applyInclusivityFixes preserves capitalization", () => {
    const fixed = applyInclusivityFixes("Chairman Smith is here.");
    expect(fixed.startsWith("Chair")).toBe(true);
  });
});

describe("ai-brand-tone profile assembly", () => {
  it("buildProfile returns neutral defaults for empty samples", () => {
    const p = buildProfile("");
    for (const key of DIMENSION_ORDER) expect(p.dimensions[key]).toBe(50);
    expect(p.traits).toEqual(["Balanced"]);
    expect(p.warnings.length).toBeGreaterThan(0);
    expect(p.warnings.some((w) => w.includes("No samples"))).toBe(true);
  });
  it("buildProfile warns on short samples", () => {
    const p = buildProfile("Just a few words.");
    expect(p.warnings.some((w) => w.includes("very short"))).toBe(true);
  });
  it("buildProfile applies dimension overrides", () => {
    const p = buildProfile(CASUAL_SAMPLE, { formalCasual: 90 });
    expect(p.dimensions.formalCasual).toBe(90);
  });
  it("buildProfile populates system prompt", () => {
    const p = buildProfile(CASUAL_SAMPLE);
    expect(p.systemPrompt.length).toBeGreaterThan(100);
    expect(p.systemPrompt).toContain("Tone dimensions");
  });
  it("buildProfile includes inclusivity notes when issues are found", () => {
    const p = buildProfile("That's crazy. The chairman agreed.");
    expect(p.inclusivityNotes.length).toBeGreaterThan(0);
    expect(p.inclusivityNotes[0]).toContain("inclusivity issue");
  });
  it("buildProfile includes default inclusivity guidance when samples are clean", () => {
    const p = buildProfile("We help teams build great products.");
    expect(p.inclusivityNotes.some((n) => n.includes("No ableist"))).toBe(true);
  });
});

describe("ai-brand-tone check-a-draft", () => {
  it("returns 100 score when draft dimensions match target", () => {
    const profile = buildProfile("");
    // Default neutral profile; draft with neutral cues should score high.
    const check = checkDraft("The team met on Tuesday. They reviewed the proposal. The plan was approved.", profile);
    expect(check.score).toBeGreaterThan(70);
  });
  it("returns per-dimension deltas for all 6 dimensions", () => {
    const profile = buildProfile(CASUAL_SAMPLE);
    const check = checkDraft(FORMAL_SAMPLE, profile);
    expect(check.perDimension).toHaveLength(6);
    for (const p of check.perDimension) {
      expect(typeof p.target).toBe("number");
      expect(typeof p.actual).toBe("number");
      expect(p.delta).toBe(Math.abs(p.target - p.actual));
    }
  });
  it("generates fixes when dimensions are far off", () => {
    const casualProfile = buildProfile(CASUAL_SAMPLE);
    const check = checkDraft(FORMAL_SAMPLE, casualProfile);
    expect(check.fixes.length).toBeGreaterThan(0);
  });
  it("flags too many exclamations for a matter-of-fact profile", () => {
    const profile = buildProfile("The team met. They reviewed the proposal. The plan was approved.");
    const check = checkDraft("Wow! Amazing! Incredible! Best ever!", profile);
    expect(check.fixes.some((f) => f.includes("exclamations"))).toBe(true);
  });
  it("flags jargon in the draft", () => {
    const profile = buildProfile(CASUAL_SAMPLE);
    const check = checkDraft("We leverage synergies to operationalize paradigms.", profile);
    expect(check.fixes.some((f) => f.includes("Jargon detected"))).toBe(true);
  });
  it("flags inclusivity issues in the draft", () => {
    const profile = buildProfile(CASUAL_SAMPLE);
    const check = checkDraft("Hey guys, the chairman is crazy.", profile);
    expect(check.fixes.some((f) => f.includes("Inclusivity"))).toBe(true);
    expect(check.inclusivityIssues.length).toBeGreaterThan(0);
  });
  it("includes readability and rhythm for the draft", () => {
    const profile = buildProfile(CASUAL_SAMPLE);
    const check = checkDraft("Hello world. This is a test.", profile);
    expect(typeof check.readability.fleschScore).toBe("number");
    expect(typeof check.rhythm.avgSentenceLength).toBe("number");
  });
});

describe("ai-brand-tone rendering", () => {
  it("renderMarkdown contains all major sections", () => {
    const p = buildProfile(CASUAL_SAMPLE);
    const md = renderMarkdown(p);
    expect(md).toContain("# Brand Tone of Voice Guide");
    expect(md).toContain("## Tone dimensions");
    expect(md).toContain("## Voice traits");
    expect(md).toContain("## Do");
    expect(md).toContain("## Don't");
    expect(md).toContain("## System prompt");
  });
  it("renderMarkdown includes warnings section when present", () => {
    const p = buildProfile("");
    const md = renderMarkdown(p);
    expect(md).toContain("## Warnings");
  });
  it("renderJson produces valid JSON that round-trips", () => {
    const p = buildProfile(CASUAL_SAMPLE);
    const json = renderJson(p);
    const parsed = JSON.parse(json);
    expect(parsed.dimensions.formalCasual).toBe(p.dimensions.formalCasual);
    expect(parsed.traits).toEqual(p.traits);
    expect(typeof parsed.generatedAt).toBe("string");
  });
});

describe("ai-brand-tone history", () => {
  it("starts empty", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads entries", () => {
    const entry: HistoryEntry = {
      ts: Date.now(), snippet: "Casual", score: 92, traits: ["Conversational"],
    };
    const next = saveHistory(entry);
    expect(next).toHaveLength(1);
    expect(loadHistory()[0].snippet).toBe("Casual");
  });
  it("caps at HISTORY_MAX", () => {
    for (let i = 0; i < HISTORY_MAX + 5; i++) {
      saveHistory({ ts: Date.now() + i, snippet: `S ${i}`, score: i, traits: [] });
    }
    expect(loadHistory()).toHaveLength(HISTORY_MAX);
    expect(loadHistory()[0].snippet).toBe("S 24");
  });
  it("clearHistory empties the store", () => {
    saveHistory({ ts: 1, snippet: "x", score: 0, traits: [] });
    expect(loadHistory()).toHaveLength(1);
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("ai-brand-tone share URL", () => {
  it("buildShareUrl encodes samples and non-default dimensions", () => {
    const dims: Dimensions = { ...defaultDimensions(), formalCasual: 75, funnySerious: 30 };
    const url = buildShareUrl("Hello world.", dims);
    expect(url).toContain("samples=Hello");
    expect(url).toContain("formalCasual=75");
    expect(url).toContain("funnySerious=30");
    // Default dims are not encoded.
    expect(url).not.toContain("matterOfFactEnthusiastic=");
  });
  it("parseShareUrl round-trips samples and dimensions", () => {
    const dims: Dimensions = { ...defaultDimensions(), formalCasual: 80, respectfulIrreverent: 20 };
    const url = buildShareUrl("My brand voice.", dims);
    const idx = url.includes("#") ? url.indexOf("#") : url.indexOf("?");
    const hash = idx >= 0 ? url.slice(idx) : "";
    const parsed = parseShareUrl(hash);
    expect(parsed.samples).toBe("My brand voice.");
    expect(parsed.dimensions.formalCasual).toBe(80);
    expect(parsed.dimensions.respectfulIrreverent).toBe(20);
    expect(parsed.dimensions.funnySerious).toBe(50); // default
  });
  it("parseShareUrl returns defaults for empty hash", () => {
    const parsed = parseShareUrl("");
    expect(parsed.samples).toBe("");
    for (const key of DIMENSION_ORDER) expect(parsed.dimensions[key]).toBe(50);
  });
  it("parseShareUrl rejects out-of-range dimension values", () => {
    const parsed = parseShareUrl("formalCasual=999&funnySerious=-50");
    expect(parsed.dimensions.formalCasual).toBe(100);
    expect(parsed.dimensions.funnySerious).toBe(0);
  });
  it("parseShareUrl ignores non-numeric dimension values", () => {
    const parsed = parseShareUrl("formalCasual=abc");
    expect(parsed.dimensions.formalCasual).toBe(50);
  });
});

describe("ai-brand-tone LLM prompt & result", () => {
  it("buildLlmPrompt includes samples and all dimensions", () => {
    const dims = defaultDimensions();
    const p = buildLlmPrompt("We are awesome.", dims);
    expect(p).toContain("We are awesome.");
    for (const key of DIMENSION_ORDER) {
      expect(p).toContain(DIMENSION_META[key].left);
      expect(p).toContain(DIMENSION_META[key].right);
    }
    expect(p).toContain("JSON");
  });
  it("renderLlmResult parses valid JSON", () => {
    const raw = JSON.stringify({
      refinedTraits: ["Conversational", "Playful"],
      refinedDos: ["Use contractions.", "Be specific."],
      refinedDonts: ["Don't use jargon."],
      refinedSystemPrompt: "You are writing in a casual voice. Use contractions...",
      suggestions: ["Add more samples."],
    });
    const r = renderLlmResult(raw);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.result.refinedTraits).toHaveLength(2);
      expect(r.result.refinedDos).toHaveLength(2);
      expect(r.result.refinedSystemPrompt).toContain("casual voice");
      expect(r.result.suggestions).toHaveLength(1);
    }
  });
  it("renderLlmResult strips ```json fences", () => {
    const raw = "```json\n{\"refinedTraits\":[]}\n```";
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
  it("renderLlmResult fills defaults for empty object", () => {
    const r = renderLlmResult("{}");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.result.refinedTraits).toEqual([]);
      expect(r.result.refinedSystemPrompt).toBe("");
    }
  });
  it("renderLlmResult filters non-string entries in arrays", () => {
    const r = renderLlmResult(JSON.stringify({
      refinedDos: ["ok", 42, null, "also ok"],
      refinedTraits: [1, 2, 3],
    }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.result.refinedDos).toEqual(["ok", "also ok"]);
      expect(r.result.refinedTraits).toEqual([]);
    }
  });
});
