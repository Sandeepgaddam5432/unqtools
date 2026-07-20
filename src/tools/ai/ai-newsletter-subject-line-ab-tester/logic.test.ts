import { describe, it, expect, beforeEach } from "vitest";
import {
  HISTORY_KEY,
  HISTORY_MAX,
  ANGLE_LABELS,
  ANGLE_DESCRIPTIONS,
  TEMPLATES,
  TOPIC_PRESETS,
  SPAM_TRIGGERS,
  normalizeText,
  countEmojis,
  hasPersonalizationToken,
  countPersonalizationTokens,
  countAllCapsWords,
  countExclamation,
  countQuestionMarks,
  findSpamTriggers,
  scoreLength,
  scoreSpam,
  scoreEmoji,
  scorePersonalization,
  scoreClarity,
  scorePunctuation,
  scoreSubject,
  truncatePreview,
  lintSubject,
  fillTemplate,
  generateVariants,
  buildVariant,
  sortVariants,
  pickWinner,
  computeSampleSize,
  inverseNormalCdf,
  normalCdf,
  computeAbDesign,
  zTestTwoProportion,
  renderText,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  renderLlmResult,
  type SubjectAngle,
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

describe("newsletter-subject-tester constants", () => {
  it("has 5 angle labels", () => {
    expect(Object.keys(ANGLE_LABELS)).toHaveLength(5);
    expect(ANGLE_LABELS.curiosity).toBe("Curiosity");
  });

  it("has descriptions for each angle", () => {
    for (const k of Object.keys(ANGLE_LABELS) as SubjectAngle[]) {
      expect(ANGLE_DESCRIPTIONS[k].length).toBeGreaterThan(0);
    }
  });

  it("has 5 templates with 3 templates each = 15 base templates", () => {
    expect(TEMPLATES).toHaveLength(5);
    for (const t of TEMPLATES) {
      expect(t.templates.length).toBeGreaterThanOrEqual(3);
      for (const tpl of t.templates) {
        expect(tpl).toContain("{topic}");
      }
    }
  });

  it("has at least 5 topic presets", () => {
    expect(TOPIC_PRESETS.length).toBeGreaterThanOrEqual(5);
  });

  it("has a spam trigger list", () => {
    expect(SPAM_TRIGGERS.length).toBeGreaterThan(10);
    expect(SPAM_TRIGGERS).toContain("free");
  });

  it("exposes HISTORY_KEY and HISTORY_MAX=20", () => {
    expect(HISTORY_KEY).toContain("newsletter-subject-tester");
    expect(HISTORY_MAX).toBe(20);
  });
});

describe("newsletter-subject-tester text helpers", () => {
  it("normalizeText collapses whitespace", () => {
    expect(normalizeText("  hello   world  ")).toBe("hello world");
  });

  it("countEmojis counts emojis", () => {
    expect(countEmojis("Hello 🎉 world 🚀")).toBe(2);
    expect(countEmojis("No emojis here")).toBe(0);
  });

  it("hasPersonalizationToken detects [name] etc.", () => {
    expect(hasPersonalizationToken("[name], your recap")).toBe(true);
    expect(hasPersonalizationToken("Hello there")).toBe(false);
  });

  it("countPersonalizationTokens counts multiple", () => {
    expect(countPersonalizationTokens("[name], your [city] recap")).toBe(2);
  });

  it("countAllCapsWords counts 4+ letter ALL CAPS", () => {
    expect(countAllCapsWords("FREE OFFER NOW")).toBe(2);
    expect(countAllCapsWords("Get this now")).toBe(0);
  });

  it("countExclamation counts !", () => {
    expect(countExclamation("Wow!!!")).toBe(3);
  });

  it("countQuestionMarks counts ?", () => {
    expect(countQuestionMarks("Really???")).toBe(3);
  });

  it("findSpamTriggers finds triggers", () => {
    const t = findSpamTriggers("FREE money — act now!!!");
    expect(t).toContain("free");
    expect(t).toContain("act now");
  });

  it("findSpamTriggers returns empty for clean subject", () => {
    expect(findSpamTriggers("How to write better subject lines")).toEqual([]);
  });
});

describe("newsletter-subject-tester scoring factors", () => {
  it("scoreLength rewards 30-60 chars", () => {
    const r = scoreLength(45);
    expect(r.penalty).toBeGreaterThan(0);
    expect(r.note).toContain("Optimal");
  });

  it("scoreLength penalizes >80 chars", () => {
    const r = scoreLength(120);
    expect(r.penalty).toBeLessThan(0);
  });

  it("scoreLength penalizes empty subject", () => {
    expect(scoreLength(0).penalty).toBe(-40);
  });

  it("scoreSpam penalizes each trigger", () => {
    const r = scoreSpam("FREE guarantee act now");
    expect(r.triggers.length).toBeGreaterThanOrEqual(3);
    expect(r.penalty).toBeLessThan(0);
  });

  it("scoreSpam returns 0 for clean subject", () => {
    const r = scoreSpam("Your weekly recap");
    expect(r.penalty).toBe(0);
  });

  it("scoreEmoji rewards 1 emoji", () => {
    expect(scoreEmoji(1).bonus).toBe(4);
  });

  it("scoreEmoji penalizes 3+ emoji", () => {
    expect(scoreEmoji(3).bonus).toBeLessThan(0);
  });

  it("scorePersonalization rewards tokens", () => {
    expect(scorePersonalization(1).bonus).toBe(5);
    expect(scorePersonalization(2).bonus).toBe(10);
    expect(scorePersonalization(3).bonus).toBe(10); // capped
  });

  it("scoreClarity rewards numbers", () => {
    expect(scoreClarity("5 ways to improve").bonus).toBeGreaterThan(0);
  });

  it("scoreClarity penalizes hype words", () => {
    expect(scoreClarity("amazing incredible offer").bonus).toBeLessThan(0);
  });

  it("scorePunctuation penalizes ALL CAPS", () => {
    const r = scorePunctuation("FREE OFFER NOW");
    expect(r.penalty).toBeLessThan(0);
  });

  it("scoreSubject returns 0-100 with 6 factors", () => {
    const s = scoreSubject("5 quick tips for your morning routine");
    expect(s.total).toBeGreaterThanOrEqual(0);
    expect(s.total).toBeLessThanOrEqual(100);
    expect(s.factors).toHaveLength(6);
    expect(s.factors.map((f) => f.key)).toContain("length");
  });

  it("scoreSubject heavily penalizes spammy subject", () => {
    const spammy = scoreSubject("FREE!!! WINNER act now $$$");
    const clean = scoreSubject("Your weekly newsletter recap");
    expect(spammy.total).toBeLessThan(clean.total);
  });
});

describe("newsletter-subject-tester inbox preview", () => {
  it("truncatePreview does not modify short subject", () => {
    const p = truncatePreview("Short subject");
    expect(p.desktop).toBe("Short subject");
    expect(p.mobile).toBe("Short subject");
    expect(p.desktopTruncated).toBe(false);
    expect(p.mobileTruncated).toBe(false);
  });

  it("truncatePreview truncates long subject on both", () => {
    const long = "This is a really really really really really long subject line that exceeds the desktop and mobile limits";
    const p = truncatePreview(long);
    expect(p.desktopTruncated).toBe(true);
    expect(p.mobileTruncated).toBe(true);
    expect(p.desktop.endsWith("…")).toBe(true);
    expect(p.mobile.endsWith("…")).toBe(true);
    expect(p.mobile.length).toBeLessThan(p.desktop.length);
  });

  it("truncatePreview respects custom limits", () => {
    const p = truncatePreview("Hello there", "", 5, 3);
    expect(p.desktop.length).toBe(5);
    expect(p.mobile.length).toBe(3);
  });
});

describe("newsletter-subject-tester linter", () => {
  it("lintSubject returns danger for empty", () => {
    const l = lintSubject("");
    expect(l.riskLevel).toBe("danger");
  });

  it("lintSubject ok for clean subject", () => {
    const l = lintSubject("Your weekly recap");
    expect(l.riskLevel).toBe("ok");
  });

  it("lintSubject flags spam triggers as danger", () => {
    const l = lintSubject("FREE WINNER act now");
    expect(l.riskLevel).toBe("danger");
    expect(l.issues.some((i) => i.message.includes("Spam trigger"))).toBe(true);
  });

  it("lintSubject flags ALL CAPS", () => {
    const l = lintSubject("HELLO WORLD FRIEND");
    expect(l.issues.some((i) => i.message.includes("ALL-CAPS"))).toBe(true);
  });

  it("lintSubject flags multiple exclamation", () => {
    const l = lintSubject("Wow!!!");
    expect(l.issues.some((i) => i.message.includes("exclamation"))).toBe(true);
  });

  it("lintSubject warns on long subject", () => {
    const l = lintSubject("x".repeat(85));
    expect(l.issues.some((i) => i.message.includes("truncates"))).toBe(true);
  });
});

describe("newsletter-subject-tester variant generation", () => {
  it("fillTemplate fills topic and audience", () => {
    expect(fillTemplate("How {topic} helps {audience}", "email marketing", "marketers"))
      .toBe("How email marketing helps marketers");
  });

  it("fillTemplate uses defaults for empty", () => {
    expect(fillTemplate("How {topic} helps {audience}", "", ""))
      .toBe("How {topic} helps readers");
  });

  it("generateVariants returns at least 5 variants", () => {
    const v = generateVariants({ topic: "email marketing" });
    expect(v.length).toBeGreaterThanOrEqual(5);
  });

  it("generateVariants returns empty for empty topic", () => {
    expect(generateVariants({ topic: "" })).toEqual([]);
  });

  it("generateVariants respects angles filter", () => {
    // Use 3 angles so we get ≥5 naturally (no top-up needed).
    const v = generateVariants({ topic: "productivity", angles: ["curiosity", "urgency", "benefit"] });
    expect(v.length).toBeGreaterThanOrEqual(5);
    expect(v.every((x) => ["curiosity", "urgency", "benefit"].includes(x.angle))).toBe(true);
  });

  it("generateVariants respects maxPerAngle", () => {
    const v = generateVariants({ topic: "productivity", maxPerAngle: 1 });
    const byAngle = new Set(v.map((x) => x.angle));
    // Each angle appears at most once when maxPerAngle=1
    for (const a of byAngle) {
      expect(v.filter((x) => x.angle === a).length).toBeLessThanOrEqual(1);
    }
  });

  it("generateVariants builds complete variant objects", () => {
    const v = generateVariants({ topic: "investing" })[0];
    expect(v.id).toBeTruthy();
    expect(v.text).toContain("investing");
    expect(v.charCount).toBe(v.text.length);
    expect(v.score).toBeDefined();
    expect(v.preview).toBeDefined();
    expect(v.lint).toBeDefined();
  });

  it("generateVariants tops up to 5 even with 1 angle", () => {
    const v = generateVariants({ topic: "fitness", angles: ["curiosity"], maxPerAngle: 2 });
    expect(v.length).toBeGreaterThanOrEqual(5);
  });

  it("buildVariant constructs variant from raw text", () => {
    const v = buildVariant("benefit", "Save 5 hours a week");
    expect(v.angle).toBe("benefit");
    expect(v.charCount).toBe(19); // "Save 5 hours a week" is 19 chars
  });
});

describe("newsletter-subject-tester sort + winner", () => {
  it("sortVariants sorts by score descending", () => {
    const v = generateVariants({ topic: "productivity" });
    const sorted = sortVariants(v);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i].score.total).toBeLessThanOrEqual(sorted[i - 1].score.total);
    }
  });

  it("pickWinner returns top variant", () => {
    const v = generateVariants({ topic: "productivity" });
    const winner = pickWinner(v);
    expect(winner).not.toBeNull();
    const sorted = sortVariants(v);
    expect(winner?.id).toBe(sorted[0].id);
  });

  it("pickWinner returns null for empty list", () => {
    expect(pickWinner([])).toBeNull();
  });
});

describe("newsletter-subject-tester stats engine", () => {
  it("computeSampleSize returns positive integer", () => {
    const n = computeSampleSize(0.20, 0.05, 0.05, 0.80);
    expect(n).toBeGreaterThan(0);
    expect(Number.isInteger(n)).toBe(true);
  });

  it("computeSampleSize larger MDE → smaller sample", () => {
    const small = computeSampleSize(0.20, 0.02, 0.05, 0.80);
    const large = computeSampleSize(0.20, 0.10, 0.05, 0.80);
    expect(large).toBeLessThan(small);
  });

  it("computeSampleSize returns 0 for invalid baseline", () => {
    expect(computeSampleSize(0, 0.05)).toBe(0);
    expect(computeSampleSize(1, 0.05)).toBe(0);
  });

  it("computeSampleSize returns 0 for invalid MDE", () => {
    expect(computeSampleSize(0.20, 0)).toBe(0);
  });

  it("inverseNormalCdf returns z-scores", () => {
    expect(inverseNormalCdf(0.975)).toBeCloseTo(1.96, 1);
    expect(inverseNormalCdf(0.80)).toBeCloseTo(0.84, 1);
  });

  it("normalCdf returns probabilities", () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 2);
    expect(normalCdf(1.96)).toBeCloseTo(0.975, 2);
  });

  it("computeAbDesign returns well-formed design", () => {
    const d = computeAbDesign(50000, 2, 0.20, 0.05, 0.80, 0.05, 5000);
    expect(d.numVariants).toBe(2);
    expect(d.samplePerVariant).toBeGreaterThan(0);
    expect(d.estimatedDays).toBeGreaterThan(0);
    expect(d.note.length).toBeGreaterThan(0);
  });

  it("computeAbDesign warns when audience too small", () => {
    const d = computeAbDesign(100, 5, 0.20, 0.05, 0.80, 0.05, 10);
    expect(d.note.toLowerCase()).toContain("warning");
  });

  it("computeAbDesign clamps variants to 2-5", () => {
    const d = computeAbDesign(100000, 99, 0.20, 0.05, 0.80, 0.05, 5000);
    expect(d.numVariants).toBe(5);
  });

  it("zTestTwoProportion detects significance on large effect", () => {
    // A: 1000 sends, 200 opens (20%). B: 1000 sends, 280 opens (28%).
    const r = zTestTwoProportion(1000, 200, 1000, 280, 0.05);
    expect(r.conversionA).toBeCloseTo(0.20, 5);
    expect(r.conversionB).toBeCloseTo(0.28, 5);
    expect(r.winner).toBe("b");
    expect(r.significant).toBe(true);
    expect(r.pValue).toBeLessThan(0.05);
  });

  it("zTestTwoProportion returns none when not significant", () => {
    // A: 100, 20. B: 100, 22. Tiny difference.
    const r = zTestTwoProportion(100, 20, 100, 22, 0.05);
    expect(r.significant).toBe(false);
    expect(r.winner).toBe("none");
  });

  it("zTestTwoProportion handles zero sends", () => {
    const r = zTestTwoProportion(0, 0, 100, 20, 0.05);
    expect(r.significant).toBe(false);
    expect(r.winner).toBe("none");
  });

  it("zTestTwoProportion picks A when A wins", () => {
    const r = zTestTwoProportion(1000, 280, 1000, 200, 0.05);
    expect(r.winner).toBe("a");
  });
});

describe("newsletter-subject-tester rendering", () => {
  it("renderText outputs one variant per line", () => {
    const v = generateVariants({ topic: "productivity", angles: ["curiosity"] });
    const txt = renderText(v);
    expect(txt.split("\n").length).toBe(v.length);
    expect(txt).toContain("curiosity");
  });

  it("renderCsv outputs header + rows", () => {
    const v = generateVariants({ topic: "productivity", angles: ["curiosity"] });
    const csv = renderCsv(v);
    expect(csv.split("\n")[0]).toBe("angle,score,char_count,emoji_count,subject");
    expect(csv.split("\n").length).toBe(v.length + 1);
  });

  it("renderCsv escapes commas in subjects", () => {
    const v = [buildVariant("benefit", "Hello, world")];
    const csv = renderCsv(v);
    expect(csv).toContain('"Hello, world"');
  });
});

describe("newsletter-subject-tester history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });

  it("saves and loads", () => {
    saveHistory({
      ts: 1,
      topic: "productivity",
      audience: "founders",
      variantCount: 5,
      topScore: 85,
      topVariant: "5 quick tips",
    });
    const h = loadHistory();
    expect(h).toHaveLength(1);
    expect(h[0].topic).toBe("productivity");
  });

  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i,
        topic: `topic${i}`,
        audience: "",
        variantCount: 5,
        topScore: 80,
        topVariant: "x",
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });

  it("clears", () => {
    saveHistory({
      ts: 1, topic: "x", audience: "", variantCount: 1, topScore: 1, topVariant: "x",
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("newsletter-subject-tester shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("email marketing", "marketers", ["curiosity", "urgency"]);
    expect(url).toContain("topic=email+marketing");
    expect(url).toContain("audience=marketers");
    expect(url).toContain("angles=curiosity%2Curgency");
    (globalThis as Record<string, unknown>).window = origWindow;
  });

  it("parses share URL back", () => {
    const p = parseShareUrl("topic=email+marketing&audience=marketers&angles=curiosity%2Curgency");
    expect(p.topic).toBe("email marketing");
    expect(p.audience).toBe("marketers");
    expect(p.angles).toEqual(["curiosity", "urgency"]);
  });

  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({ topic: "", audience: "", angles: [] });
  });

  it("filters unknown angles", () => {
    const p = parseShareUrl("topic=x&angles=curiosity%2Cunknown");
    expect(p.angles).toEqual(["curiosity"]);
  });
});

describe("newsletter-subject-tester LLM prompt", () => {
  it("buildLlmPrompt returns system + user", () => {
    const p = buildLlmPrompt("email marketing", "marketers", ["curiosity"]);
    expect(p.system).toContain("email-marketing");
    expect(p.user).toContain("email marketing");
    expect(p.user).toContain("marketers");
    expect(p.user).toContain("curiosity");
  });

  it("renderLlmResult parses raw text into variants", () => {
    const raw = "5 quick tips for your morning\nLast chance to read this\nHow [name] can save 5 hours";
    const v = renderLlmResult(raw);
    expect(v.length).toBe(3);
    expect(v[0].text).toContain("morning");
    expect(v[0].score).toBeDefined();
  });

  it("renderLlmResult limits to 20 variants", () => {
    const lines = Array.from({ length: 50 }, (_, i) => `Subject line ${i}`);
    const v = renderLlmResult(lines.join("\n"));
    expect(v.length).toBeLessThanOrEqual(20);
  });
});

// Suppress unused-import lint
export type _Unused = SubjectAngle;
