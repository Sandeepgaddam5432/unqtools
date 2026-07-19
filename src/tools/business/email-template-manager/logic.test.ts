import { describe, it, expect, beforeEach } from "vitest";
import {
  EMAIL_TYPES,
  EMAIL_TYPE_LABELS,
  EMAIL_TONES,
  EMAIL_TONE_LABELS,
  TONE_MODIFIERS,
  parseCustomFields,
  buildVariables,
  substituteVariables,
  findPlaceholders,
  generateSubject,
  resolveSubject,
  getBodyTemplate,
  countWords,
  estimateReadTime,
  formatReadTime,
  renderText,
  renderMarkdown,
  renderHtml,
  computeStats,
  isSubjectTooLong,
  validatePlaceholders,
  generateBatch,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type EmailType,
  type EmailTone,
  type EmailInput,
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

const FULL_INPUT: EmailInput = {
  templateType: "welcome",
  recipientName: "John",
  senderName: "Sarah",
  senderCompany: "Acme",
  subject: "",
  customFields: "plan,Pro",
  tone: "professional",
};

describe("email-template-manager constants", () => {
  it("has 10 email types", () => {
    expect(EMAIL_TYPES).toHaveLength(10);
  });
  it("has 5 tones", () => {
    expect(EMAIL_TONES).toHaveLength(5);
  });
  it("has a label for every email type", () => {
    for (const t of EMAIL_TYPES) {
      expect(typeof EMAIL_TYPE_LABELS[t]).toBe("string");
      expect(EMAIL_TYPE_LABELS[t].length).toBeGreaterThan(0);
    }
  });
  it("has a label for every tone", () => {
    for (const t of EMAIL_TONES) {
      expect(typeof EMAIL_TONE_LABELS[t]).toBe("string");
      expect(EMAIL_TONE_LABELS[t].length).toBeGreaterThan(0);
    }
  });
  it("has a tone modifier for every tone", () => {
    for (const t of EMAIL_TONES) {
      const mod = TONE_MODIFIERS[t];
      expect(typeof mod.greeting).toBe("function");
      expect(typeof mod.closing).toBe("function");
      expect(typeof mod.subjectPrefix).toBe("string");
    }
  });
});

describe("email-template-manager parseCustomFields", () => {
  it("parses key,value lines", () => {
    expect(parseCustomFields("meeting_date,2026-07-20\nmeeting_time,14:00")).toEqual({
      meeting_date: "2026-07-20",
      meeting_time: "14:00",
    });
  });
  it("trims whitespace around key and value", () => {
    expect(parseCustomFields("  key ,  value  ")).toEqual({ key: "value" });
  });
  it("handles values with commas (only first comma splits)", () => {
    expect(parseCustomFields("note,hello, world")).toEqual({ note: "hello, world" });
  });
  it("handles keys with spaces (converts to underscores)", () => {
    expect(parseCustomFields("Meeting Date,2026-07-20")).toEqual({ Meeting_Date: "2026-07-20" });
  });
  it("skips empty lines", () => {
    expect(parseCustomFields("a,1\n\nb,2")).toEqual({ a: "1", b: "2" });
  });
  it("returns empty for empty input", () => {
    expect(parseCustomFields("")).toEqual({});
  });
  it("handles line with no comma", () => {
    expect(parseCustomFields("justakey")).toEqual({ justakey: "" });
  });
});

describe("email-template-manager buildVariables", () => {
  it("includes standard vars", () => {
    const v = buildVariables(FULL_INPUT);
    expect(v.recipientName).toBe("John");
    expect(v.senderName).toBe("Sarah");
    expect(v.senderCompany).toBe("Acme");
  });
  it("includes custom fields", () => {
    const v = buildVariables(FULL_INPUT);
    expect(v.plan).toBe("Pro");
  });
  it("custom fields override standard vars if names clash", () => {
    const v = buildVariables({ ...FULL_INPUT, customFields: "recipientName,Override" });
    expect(v.recipientName).toBe("Override");
  });
});

describe("email-template-manager substituteVariables", () => {
  it("replaces known placeholders", () => {
    const out = substituteVariables("Hello {{recipientName}}!", { recipientName: "John" });
    expect(out).toBe("Hello John!");
  });
  it("leaves unknown placeholders intact", () => {
    const out = substituteVariables("Hi {{unknown}}!", { recipientName: "John" });
    expect(out).toBe("Hi {{unknown}}!");
  });
  it("handles multiple placeholders", () => {
    const out = substituteVariables("{{a}} and {{b}}", { a: "1", b: "2" });
    expect(out).toBe("1 and 2");
  });
  it("handles whitespace inside braces", () => {
    const out = substituteVariables("Hi {{  recipientName  }}!", { recipientName: "John" });
    expect(out).toBe("Hi John!");
  });
  it("returns empty string for known key with empty value", () => {
    const out = substituteVariables("Hi {{name}}", { name: "" });
    expect(out).toBe("Hi ");
  });
  it("handles keys with dots", () => {
    const out = substituteVariables("{{user.name}}", { "user.name": "John" });
    expect(out).toBe("John");
  });
});

describe("email-template-manager findPlaceholders", () => {
  it("finds all placeholders", () => {
    expect(findPlaceholders("Hi {{a}} and {{b}} and {{a}}")).toEqual(["a", "b"]);
  });
  it("returns empty for no placeholders", () => {
    expect(findPlaceholders("Hello John!")).toEqual([]);
  });
  it("deduplicates", () => {
    expect(findPlaceholders("{{a}} {{a}} {{a}}")).toEqual(["a"]);
  });
  it("handles whitespace in braces", () => {
    expect(findPlaceholders("{{ a }}")).toEqual(["a"]);
  });
});

describe("email-template-manager generateSubject", () => {
  it("generates welcome subject", () => {
    const s = generateSubject(FULL_INPUT);
    expect(s).toBe("Welcome to Acme, John!");
  });
  it("adds urgent prefix for urgent tone", () => {
    const s = generateSubject({ ...FULL_INPUT, tone: "urgent", templateType: "reminder" });
    expect(s.startsWith("[URGENT] ")).toBe(true);
  });
  it("no prefix for non-urgent tone", () => {
    const s = generateSubject({ ...FULL_INPUT, tone: "professional", templateType: "reminder" });
    expect(s.startsWith("[URGENT] ")).toBe(false);
  });
  it("substitutes variables in subject", () => {
    const s = generateSubject({ ...FULL_INPUT, templateType: "meeting-request", customFields: "" });
    expect(s).toBe("Meeting request — Acme");
  });
  it("generates for each type without throwing", () => {
    for (const t of EMAIL_TYPES) {
      expect(() => generateSubject({ ...FULL_INPUT, templateType: t })).not.toThrow();
    }
  });
});

describe("email-template-manager resolveSubject", () => {
  it("uses user-provided subject when present", () => {
    const s = resolveSubject({ ...FULL_INPUT, subject: "Custom subject for {{recipientName}}" });
    expect(s).toBe("Custom subject for John");
  });
  it("auto-generates when subject is blank", () => {
    const s = resolveSubject({ ...FULL_INPUT, subject: "" });
    expect(s).toBe("Welcome to Acme, John!");
  });
  it("auto-generates when subject is whitespace", () => {
    const s = resolveSubject({ ...FULL_INPUT, subject: "   " });
    expect(s).toBe("Welcome to Acme, John!");
  });
  it("trims user-provided subject", () => {
    const s = resolveSubject({ ...FULL_INPUT, subject: "  Custom  " });
    expect(s).toBe("Custom");
  });
});

describe("email-template-manager getBodyTemplate", () => {
  it("returns non-empty template for each type", () => {
    for (const t of EMAIL_TYPES) {
      const body = getBodyTemplate(t);
      expect(body.length).toBeGreaterThan(0);
    }
  });
  it("welcome template mentions senderCompany placeholder", () => {
    expect(getBodyTemplate("welcome")).toContain("{{senderCompany}}");
  });
  it("meeting-request template mentions meeting_date and meeting_time", () => {
    const body = getBodyTemplate("meeting-request");
    expect(body).toContain("{{meeting_date}}");
    expect(body).toContain("{{meeting_time}}");
  });
  it("out-of-office template mentions senderName", () => {
    expect(getBodyTemplate("out-of-office")).toContain("{{senderName}}");
  });
});

describe("email-template-manager countWords / estimateReadTime / formatReadTime", () => {
  it("counts words correctly", () => {
    expect(countWords("Hello world from Acme")).toBe(4);
  });
  it("returns 0 for empty", () => {
    expect(countWords("")).toBe(0);
    expect(countWords("   ")).toBe(0);
  });
  it("estimates read time at 200 wpm", () => {
    // 200 words = 60 seconds
    const text = "word ".repeat(200).trim();
    expect(estimateReadTime(text)).toBe(60);
  });
  it("returns minimum 1 second", () => {
    expect(estimateReadTime("hello")).toBe(1);
  });
  it("formats seconds-only read time", () => {
    expect(formatReadTime(45)).toBe("45s");
  });
  it("formats minute read time", () => {
    expect(formatReadTime(60)).toBe("1m");
  });
  it("formats minute + second read time", () => {
    expect(formatReadTime(90)).toBe("1m 30s");
  });
});

describe("email-template-manager renderText", () => {
  it("renders welcome email with greeting and closing", () => {
    const r = renderText(FULL_INPUT);
    expect(r.subject).toBe("Welcome to Acme, John!");
    expect(r.body).toContain("Hi John,");
    expect(r.body).toContain("Best regards,");
    expect(r.body).toContain("Sarah");
    expect(r.body).toContain("Acme");
  });
  it("uses formal tone greeting/closing", () => {
    const r = renderText({ ...FULL_INPUT, tone: "formal" });
    expect(r.body).toContain("Dear John,");
    expect(r.body).toContain("Respectfully,");
  });
  it("uses casual tone greeting/closing", () => {
    const r = renderText({ ...FULL_INPUT, tone: "casual" });
    expect(r.body).toContain("Hey John,");
    expect(r.body).toContain("Cheers,");
  });
  it("uses friendly tone greeting/closing", () => {
    const r = renderText({ ...FULL_INPUT, tone: "friendly" });
    expect(r.body).toContain("Hi John!");
    expect(r.body).toContain("Warmly,");
  });
  it("substitutes custom fields in body", () => {
    const r = renderText({ ...FULL_INPUT, templateType: "meeting-request", customFields: "meeting_date,2026-07-20\nmeeting_time,14:00" });
    expect(r.body).toContain("2026-07-20");
    expect(r.body).toContain("14:00");
  });
  it("flags unsubstituted placeholders", () => {
    const r = renderText({ ...FULL_INPUT, templateType: "meeting-request", customFields: "" });
    expect(r.hasPlaceholders).toBe(true);
    expect(r.placeholders).toContain("meeting_date");
    expect(r.placeholders).toContain("meeting_time");
  });
  it("computes word count", () => {
    const r = renderText(FULL_INPUT);
    expect(r.wordCount).toBeGreaterThan(20);
  });
  it("computes read time", () => {
    const r = renderText(FULL_INPUT);
    expect(r.readTimeSeconds).toBeGreaterThanOrEqual(1);
  });
  it("renders each type without throwing", () => {
    for (const t of EMAIL_TYPES) {
      expect(() => renderText({ ...FULL_INPUT, templateType: t })).not.toThrow();
    }
  });
});

describe("email-template-manager renderMarkdown", () => {
  it("renders markdown with subject and body", () => {
    const md = renderMarkdown(FULL_INPUT);
    expect(md).toContain("**Subject:**");
    expect(md).toContain("Welcome to Acme, John!");
    expect(md).toContain("Hi John,");
  });
  it("includes a horizontal rule", () => {
    const md = renderMarkdown(FULL_INPUT);
    expect(md).toContain("---");
  });
});

describe("email-template-manager renderHtml", () => {
  it("renders valid HTML with subject and body", () => {
    const html = renderHtml(FULL_INPUT);
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("<title>");
    expect(html).toContain("Welcome to Acme, John!");
    expect(html).toContain("</body></html>");
  });
  it("uses inline CSS for email-client compatibility", () => {
    const html = renderHtml(FULL_INPUT);
    expect(html).toContain('style="');
  });
  it("escapes angle brackets in user content", () => {
    const html = renderHtml({ ...FULL_INPUT, recipientName: "<script>" });
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("email-template-manager computeStats", () => {
  it("computes stats for full input", () => {
    const stats = computeStats(FULL_INPUT);
    expect(stats.type).toBe("welcome");
    expect(stats.typeLabel).toBe("Welcome");
    expect(stats.tone).toBe("professional");
    expect(stats.toneLabel).toBe("Professional");
    expect(stats.wordCount).toBeGreaterThan(0);
    expect(stats.readTimeSeconds).toBeGreaterThanOrEqual(1);
    expect(stats.subjectLength).toBeGreaterThan(0);
    expect(stats.subjectTooLong).toBe(false);
    expect(stats.hasPlaceholders).toBe(false);
  });
  it("flags long subject", () => {
    const longSubject = "A".repeat(70);
    const stats = computeStats({ ...FULL_INPUT, subject: longSubject });
    expect(stats.subjectLength).toBe(70);
    expect(stats.subjectTooLong).toBe(true);
  });
  it("reports placeholders when unsubstituted", () => {
    const stats = computeStats({ ...FULL_INPUT, templateType: "meeting-request", customFields: "" });
    expect(stats.hasPlaceholders).toBe(true);
    expect(stats.placeholders.length).toBeGreaterThan(0);
  });
});

describe("email-template-manager isSubjectTooLong", () => {
  it("returns false for short subject", () => {
    expect(isSubjectTooLong("Hello")).toBe(false);
  });
  it("returns true for subject over 60 chars", () => {
    expect(isSubjectTooLong("A".repeat(61))).toBe(true);
  });
  it("returns false for subject exactly 60 chars", () => {
    expect(isSubjectTooLong("A".repeat(60))).toBe(false);
  });
  it("supports custom threshold", () => {
    expect(isSubjectTooLong("A".repeat(50), 40)).toBe(true);
  });
});

describe("email-template-manager validatePlaceholders", () => {
  it("returns list of unsubstituted placeholders", () => {
    const r = renderText({ ...FULL_INPUT, templateType: "meeting-request", customFields: "" });
    const missing = validatePlaceholders(r);
    expect(missing).toContain("meeting_date");
    expect(missing).toContain("meeting_time");
  });
  it("returns empty when all substituted", () => {
    const r = renderText(FULL_INPUT);
    expect(validatePlaceholders(r)).toEqual([]);
  });
});

describe("email-template-manager generateBatch", () => {
  it("generates all 10 types", () => {
    const batch = generateBatch(FULL_INPUT, EMAIL_TYPES);
    expect(Object.keys(batch)).toHaveLength(10);
  });
  it("generates a subset", () => {
    const batch = generateBatch(FULL_INPUT, ["welcome", "thank-you"]);
    expect(Object.keys(batch)).toHaveLength(2);
    expect(batch.welcome.subject).toContain("Welcome");
    expect(batch["thank-you"].subject).toContain("Thank");
  });
  it("uses same sender info across batch", () => {
    const batch = generateBatch(FULL_INPUT, EMAIL_TYPES);
    for (const t of EMAIL_TYPES) {
      expect(batch[t].body).toContain("Sarah");
    }
  });
  it("handles empty types list", () => {
    const batch = generateBatch(FULL_INPUT, []);
    expect(Object.keys(batch)).toHaveLength(0);
  });
});

describe("email-template-manager history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1,
      templateType: "welcome",
      tone: "professional",
      recipientName: "John",
      subject: "Welcome to Acme!",
      wordCount: 50,
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i,
        templateType: "welcome",
        tone: "professional",
        recipientName: `R${i}`,
        subject: `S${i}`,
        wordCount: 10,
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1,
      templateType: "welcome",
      tone: "professional",
      recipientName: "John",
      subject: "Subject",
      wordCount: 5,
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("email-template-manager shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl(FULL_INPUT);
    expect(url).toContain("type=welcome");
    expect(url).toContain("tone=professional");
    expect(url).toContain("rn=John");
    expect(url).toContain("sn=Sarah");
    expect(url).toContain("sc=Acme");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("round-trips share URL", () => {
    const url = buildShareUrl(FULL_INPUT);
    const hash = url.includes("#") ? url.slice(url.indexOf("#")) : "";
    const parsed = parseShareUrl(hash);
    expect(parsed.templateType).toBe("welcome");
    expect(parsed.tone).toBe("professional");
    expect(parsed.recipientName).toBe("John");
    expect(parsed.senderName).toBe("Sarah");
    expect(parsed.senderCompany).toBe("Acme");
  });
  it("parses empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("filters unknown template type", () => {
    const parsed = parseShareUrl("type=unknown-type&rn=John");
    expect(parsed.templateType).toBeUndefined();
    expect(parsed.recipientName).toBe("John");
  });
  it("filters unknown tone", () => {
    const parsed = parseShareUrl("tone=invalid");
    expect(parsed.tone).toBeUndefined();
  });
  it("preserves custom fields with newlines", () => {
    const url = buildShareUrl({ ...FULL_INPUT, customFields: "a,1\nb,2" });
    const hash = url.includes("#") ? url.slice(url.indexOf("#")) : "";
    const parsed = parseShareUrl(hash);
    expect(parsed.customFields).toBe("a,1\nb,2");
  });
});

// Suppress unused-import lint
export type _Unused = EmailType | EmailTone;
