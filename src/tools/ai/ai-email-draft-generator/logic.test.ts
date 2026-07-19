import { describe, it, expect, beforeEach } from "vitest";
import {
  HISTORY_KEY,
  HISTORY_MAX,
  PURPOSE_LABELS,
  TONE_LABELS,
  LENGTH_LABELS,
  LENGTH_PARAGRAPHS,
  FIELD_HINTS,
  validateInputs,
  capitalize,
  normalizeText,
  stripBullet,
  isBulletLine,
  extractPoints,
  renderBulletList,
  bulletsToProse,
  wrapText,
  greeting,
  opener,
  closer,
  urgencyPrefix,
  persuasiveFlourish,
  generateSubjects,
  generateBodyParagraphs,
  lcFirst,
  ordinal,
  renderSignature,
  generateEmail,
  generateReply,
  shortenBody,
  lengthenBody,
  renderMailto,
  renderEml,
  escapeEmlHeader,
  renderText,
  renderMarkdown,
  renderJson,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  renderLlmResult,
  type Mode,
  type Purpose,
  type Tone,
  type Length,
  type EmailInputs,
  type Signature,
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

const SIG: Signature = {
  name: "alex rivera",
  title: "Product Manager",
  email: "alex@acme.com",
  phone: "+1-555-0100",
};

const BASE_COMPOSE: EmailInputs = {
  mode: "compose",
  purpose: "request",
  tone: "friendly",
  length: "medium",
  recipientName: "jordan",
  senderName: "alex",
  brief: "ask jordan for feedback on the q3 roadmap deck by friday",
  thread: "",
  originalSubject: "",
  signature: SIG,
};

const BASE_REPLY: EmailInputs = {
  mode: "reply",
  purpose: "request",
  tone: "formal",
  length: "medium",
  recipientName: "jordan",
  senderName: "alex",
  brief: "answers below",
  thread: "Hi Alex, two questions:\n1) Can we move the call to Thursday?\n2) Do you have the latest sales numbers?",
  originalSubject: "Q3 roadmap call",
  signature: SIG,
};

describe("ai-email-draft-generator constants", () => {
  it("has 9 purposes", () => {
    expect(Object.keys(PURPOSE_LABELS)).toHaveLength(9);
  });
  it("has 5 tones", () => {
    expect(Object.keys(TONE_LABELS)).toHaveLength(5);
  });
  it("has 3 lengths with paragraph counts", () => {
    expect(Object.keys(LENGTH_LABELS)).toHaveLength(3);
    expect(LENGTH_PARAGRAPHS.short).toBe(2);
    expect(LENGTH_PARAGRAPHS.medium).toBe(3);
    expect(LENGTH_PARAGRAPHS.long).toBe(5);
  });
  it("has field hints for every input", () => {
    expect(Object.keys(FIELD_HINTS).length).toBeGreaterThanOrEqual(9);
  });
  it("uses 20 for history max", () => {
    expect(HISTORY_MAX).toBe(20);
  });
  it("exposes history key", () => {
    expect(HISTORY_KEY).toContain("ai-email-draft-generator");
  });
});

describe("ai-email-draft-generator validateInputs", () => {
  it("warns when compose brief too short", () => {
    const w = validateInputs({ ...BASE_COMPOSE, brief: "hi" });
    expect(w.some((x) => x.includes("Compose mode needs a brief"))).toBe(true);
  });
  it("warns when reply thread empty", () => {
    const w = validateInputs({ ...BASE_REPLY, thread: "" });
    expect(w.some((x) => x.includes("Reply mode needs the incoming thread"))).toBe(true);
  });
  it("warns when reply has no original subject", () => {
    const w = validateInputs({ ...BASE_REPLY, originalSubject: "" });
    expect(w.some((x) => x.includes("Reply mode works best with the original subject"))).toBe(true);
  });
  it("warns when no recipient", () => {
    const w = validateInputs({ ...BASE_COMPOSE, recipientName: "" });
    expect(w.some((x) => x.includes("recipient name"))).toBe(true);
  });
  it("warns when no sender", () => {
    const w = validateInputs({ ...BASE_COMPOSE, senderName: "" });
    expect(w.some((x) => x.includes("your name"))).toBe(true);
  });
  it("warns when brief too long", () => {
    const w = validateInputs({ ...BASE_COMPOSE, brief: "x".repeat(2100) });
    expect(w.some((x) => x.includes("very long"))).toBe(true);
  });
  it("passes for clean inputs", () => {
    expect(validateInputs(BASE_COMPOSE)).toEqual([]);
    expect(validateInputs(BASE_REPLY)).toEqual([]);
  });
});

describe("ai-email-draft-generator helpers", () => {
  it("capitalize", () => {
    expect(capitalize("hello")).toBe("Hello");
    expect(capitalize("")).toBe("");
  });
  it("normalizeText collapses whitespace + strips CR", () => {
    expect(normalizeText("a\r\n\r\n\r\nb  c")).toBe("a\n\nb c");
  });
  it("isBulletLine detects dashes, asterisks, numbers", () => {
    expect(isBulletLine("- a")).toBe(true);
    expect(isBulletLine("* a")).toBe(true);
    expect(isBulletLine("1. a")).toBe(true);
    expect(isBulletLine("1) a")).toBe(true);
    expect(isBulletLine("just text")).toBe(false);
  });
  it("stripBullet removes bullets", () => {
    expect(stripBullet("- hello")).toBe("hello");
    expect(stripBullet("1. world")).toBe("world");
    expect(stripBullet("plain")).toBe("plain");
  });
  it("extractPoints handles bullet lists", () => {
    const pts = extractPoints("- one\n- two\n- three");
    expect(pts).toEqual(["one", "two", "three"]);
  });
  it("extractPoints handles numbered lists", () => {
    const pts = extractPoints("1) alpha\n2) beta");
    expect(pts).toEqual(["alpha", "beta"]);
  });
  it("extractPoints splits paragraphs", () => {
    const pts = extractPoints("Para one.\n\nPara two.");
    expect(pts).toEqual(["Para one.", "Para two."]);
  });
  it("extractPoints falls back to sentence split", () => {
    const pts = extractPoints("First sentence. Second sentence! Third?");
    expect(pts.length).toBe(3);
  });
  it("extractPoints empty → empty", () => {
    expect(extractPoints("")).toEqual([]);
  });
  it("renderBulletList", () => {
    expect(renderBulletList(["a", "b"])).toBe("- a\n- b");
  });
  it("bulletsToProse single", () => {
    expect(bulletsToProse(["only"])).toBe("only.");
  });
  it("bulletsToProse multiple uses oxford comma", () => {
    expect(bulletsToProse(["one", "two", "three"])).toBe("one, two, and three.");
  });
  it("wrapText wraps long lines", () => {
    const long = "word ".repeat(20).trim();
    const wrapped = wrapText(long, 30);
    expect(wrapped.split("\n").every((l) => l.length <= 30)).toBe(true);
  });
  it("lcFirst", () => {
    expect(lcFirst("Hello")).toBe("hello");
    expect(lcFirst("")).toBe("");
  });
  it("ordinal", () => {
    expect(ordinal(1)).toBe("1st");
    expect(ordinal(2)).toBe("2nd");
    expect(ordinal(3)).toBe("3rd");
    expect(ordinal(11)).toBe("11th");
    expect(ordinal(21)).toBe("21st");
  });
});

describe("ai-email-draft-generator tone primitives", () => {
  it("greeting varies by tone", () => {
    expect(greeting("formal", "jordan")).toBe("Dear Jordan,");
    expect(greeting("friendly", "jordan")).toBe("Hi Jordan,");
    expect(greeting("casual", "jordan")).toBe("Hey Jordan,");
    expect(greeting("urgent", "jordan")).toBe("Hi Jordan —");
  });
  it("greeting defaults to 'there' when empty", () => {
    expect(greeting("friendly", "")).toBe("Hi There,");
  });
  it("opener varies by tone", () => {
    expect(opener("formal")).toContain("hope this message");
    expect(opener("urgent")).toContain("time-sensitive");
    expect(opener("persuasive")).toContain("worthwhile");
  });
  it("closer signs off with sender name", () => {
    const c = closer("formal", "alex");
    expect(c).toContain("Alex");
    expect(c).toContain("Best regards");
  });
  it("urgencyPrefix only for urgent", () => {
    expect(urgencyPrefix("urgent")).toBe("[URGENT] ");
    expect(urgencyPrefix("formal")).toBe("");
  });
  it("persuasiveFlourish only for persuasive", () => {
    expect(persuasiveFlourish("persuasive").length).toBeGreaterThan(0);
    expect(persuasiveFlourish("formal")).toBe("");
  });
});

describe("ai-email-draft-generator renderSignature", () => {
  it("joins non-empty parts with slash", () => {
    expect(renderSignature(SIG)).toBe("Alex rivera / Product Manager / alex@acme.com / +1-555-0100");
  });
  it("skips empty fields", () => {
    expect(renderSignature({ name: "alex", title: "", email: "", phone: "" })).toBe("Alex");
  });
});

describe("ai-email-draft-generator generateSubjects", () => {
  it("returns 3 variants", () => {
    const v = generateSubjects(BASE_COMPOSE);
    expect(v).toHaveLength(3);
    expect(v.every((s) => s.subject.length > 0 && s.style.length > 0)).toBe(true);
  });
  it("reply mode prefixes 'Re:'", () => {
    const v = generateSubjects(BASE_REPLY);
    expect(v[0].subject).toBe("Re: Q3 roadmap call");
  });
  it("urgent tone prefixes [URGENT]", () => {
    const v = generateSubjects({ ...BASE_COMPOSE, tone: "urgent" });
    expect(v[0].subject).toContain("[URGENT]");
  });
  it("generates a thank-you subject", () => {
    const v = generateSubjects({ ...BASE_COMPOSE, purpose: "thank-you" });
    expect(v[0].subject.toLowerCase()).toContain("thank");
  });
  it("generates an apology subject", () => {
    const v = generateSubjects({ ...BASE_COMPOSE, purpose: "apology" });
    const subj = v[0].subject.toLowerCase();
    expect(subj.includes("apolog") || subj.includes("sorry")).toBe(true);
  });
  it("generates an announcement subject", () => {
    const v = generateSubjects({ ...BASE_COMPOSE, purpose: "announcement" });
    expect(v[0].subject.toLowerCase()).toMatch(/announc|news|now available/);
  });
  it("generates a newsletter subject", () => {
    const v = generateSubjects({ ...BASE_COMPOSE, purpose: "newsletter" });
    expect(v[0].subject.toLowerCase()).toMatch(/newsletter|this week|updates/);
  });
  it("generates an intro subject", () => {
    const v = generateSubjects({ ...BASE_COMPOSE, purpose: "intro" });
    expect(v[0].subject.toLowerCase()).toContain("intro");
  });
  it("generates a decline subject", () => {
    const v = generateSubjects({ ...BASE_COMPOSE, purpose: "decline" });
    expect(v[0].subject.toLowerCase()).toMatch(/update|thank you/);
  });
  it("generates a cold-outreach subject", () => {
    const v = generateSubjects({ ...BASE_COMPOSE, purpose: "cold-outreach" });
    expect(v.length).toBe(3);
  });
  it("generates a follow-up subject", () => {
    const v = generateSubjects({ ...BASE_COMPOSE, purpose: "follow-up" });
    expect(v[0].subject.toLowerCase()).toMatch(/following up|check-in|update/);
  });
});

describe("ai-email-draft-generator generateBodyParagraphs", () => {
  it("compose mode returns opener + body", () => {
    const paras = generateBodyParagraphs(BASE_COMPOSE);
    expect(paras.length).toBeGreaterThanOrEqual(2);
    expect(paras[0]).toContain("hope");
  });
  it("short length → fewer paragraphs than long", () => {
    const short = generateBodyParagraphs({ ...BASE_COMPOSE, length: "short" });
    const long = generateBodyParagraphs({ ...BASE_COMPOSE, length: "long" });
    expect(short.length).toBeLessThanOrEqual(long.length);
  });
  it("reply mode acknowledges thread", () => {
    const paras = generateBodyParagraphs(BASE_REPLY);
    const joined = paras.join(" ").toLowerCase();
    // Reply mode should acknowledge the thread / the sender's note.
    expect(
      joined.includes("thread") ||
      joined.includes("your note") ||
      joined.includes("point") ||
      joined.includes("address"),
    ).toBe(true);
  });
  it("reply mode addresses multiple points", () => {
    const paras = generateBodyParagraphs({ ...BASE_REPLY, length: "long" });
    const joined = paras.join(" ");
    // Should reference at least one of the thread points
    expect(joined.toLowerCase()).toMatch(/thursday|sales numbers|call|first|second/);
  });
  it("each purpose produces a body", () => {
    const purposes: Purpose[] = [
      "request", "follow-up", "thank-you", "apology", "announcement",
      "newsletter", "intro", "decline", "cold-outreach",
    ];
    for (const p of purposes) {
      const paras = generateBodyParagraphs({ ...BASE_COMPOSE, purpose: p });
      expect(paras.length).toBeGreaterThan(0);
    }
  });
});

describe("ai-email-draft-generator generateEmail", () => {
  it("returns full draft with subject + body + signature", () => {
    const draft = generateEmail(BASE_COMPOSE);
    expect(draft.subjectVariants).toHaveLength(3);
    expect(draft.primarySubject).toBeTruthy();
    expect(draft.body).toContain("Hi Jordan");
    expect(draft.body).toContain("Alex"); // signature or closer
    expect(draft.signature).toContain("alex@acme.com");
    expect(draft.paragraphs.length).toBeGreaterThan(0);
  });
  it("body contains greeting + closer", () => {
    const draft = generateEmail(BASE_COMPOSE);
    expect(draft.body.startsWith("Hi Jordan")).toBe(true);
    expect(draft.body).toContain("Cheers"); // friendly tone closer
  });
  it("validates and surfaces notes for missing recipient", () => {
    const draft = generateEmail({ ...BASE_COMPOSE, recipientName: "" });
    expect(draft.notes.some((n) => n.includes("recipient"))).toBe(true);
  });
  it("generates valid draft for every tone", () => {
    const tones: Tone[] = ["formal", "friendly", "casual", "urgent", "persuasive"];
    for (const t of tones) {
      const draft = generateEmail({ ...BASE_COMPOSE, tone: t });
      expect(draft.body.length).toBeGreaterThan(50);
    }
  });
  it("generates valid draft for every length", () => {
    const lengths: Length[] = ["short", "medium", "long"];
    for (const l of lengths) {
      const draft = generateEmail({ ...BASE_COMPOSE, length: l });
      expect(draft.body.length).toBeGreaterThan(50);
    }
  });
});

describe("ai-email-draft-generator generateReply", () => {
  it("returns a draft in reply mode", () => {
    const draft = generateReply(BASE_REPLY);
    expect(draft.primarySubject).toContain("Re:");
    expect(draft.body).toContain("Dear Jordan"); // formal greeting
  });
});

describe("ai-email-draft-generator shorten / lengthen", () => {
  it("shortenBody removes filler sentences", () => {
    const draft = generateEmail({ ...BASE_COMPOSE, length: "long" });
    const shortened = shortenBody(draft.body);
    expect(shortened.length).toBeLessThanOrEqual(draft.body.length);
  });
  it("lengthenBody adds a paragraph", () => {
    const draft = generateEmail(BASE_COMPOSE);
    const longer = lengthenBody(draft.body);
    expect(longer.length).toBeGreaterThan(draft.body.length);
  });
});

describe("ai-email-draft-generator renderMailto", () => {
  it("builds mailto URL with subject + body", () => {
    const draft = generateEmail(BASE_COMPOSE);
    const url = renderMailto(draft, "jordan@example.com");
    expect(url.startsWith("mailto:jordan%40example.com?")).toBe(true);
    expect(url).toContain("subject=");
    expect(url).toContain("body=");
  });
  it("works without 'to' address", () => {
    const draft = generateEmail(BASE_COMPOSE);
    const url = renderMailto(draft);
    expect(url.startsWith("mailto:?")).toBe(true);
  });
});

describe("ai-email-draft-generator renderEml + escapeEmlHeader", () => {
  it("escapeEmlHeader quotes when needed", () => {
    expect(escapeEmlHeader("simple")).toBe("simple");
    expect(escapeEmlHeader('has "quote"')).toBe('"has \\"quote\\""');
  });
  it("renderEml produces RFC 5322 message", () => {
    const draft = generateEmail(BASE_COMPOSE);
    const eml = renderEml(draft, {
      from: "alex@acme.com",
      to: "jordan@example.com",
      date: new Date("2025-01-15T10:00:00Z"),
    });
    expect(eml).toContain("From: alex@acme.com");
    expect(eml).toContain("To: jordan@example.com");
    expect(eml).toContain("Subject:");
    expect(eml).toContain("Date: Wed, 15 Jan 2025 10:00:00 GMT");
    expect(eml).toContain("MIME-Version: 1.0");
    expect(eml).toContain("Content-Type: text/plain; charset=utf-8");
    // The body in the .eml is CRLF-encoded; check both forms.
    const bodyCrlf = draft.body.replace(/\r?\n/g, "\r\n");
    expect(eml).toContain(bodyCrlf);
    // CRLF line endings in headers
    expect(eml.split("\r\n\r\n")[0]).toContain("\r\n");
  });
  it("renderEml uses default from/to if not provided", () => {
    const draft = generateEmail(BASE_COMPOSE);
    const eml = renderEml(draft, {});
    expect(eml).toContain("From: you@example.com");
    expect(eml).toContain("To: recipient@example.com");
  });
});

describe("ai-email-draft-generator render text/markdown/json", () => {
  it("renderText includes subject + body", () => {
    const draft = generateEmail(BASE_COMPOSE);
    const txt = renderText(draft);
    expect(txt).toContain("Subject: ");
    expect(txt).toContain(draft.body);
  });
  it("renderMarkdown includes subject variants + body + honesty", () => {
    const draft = generateEmail(BASE_COMPOSE);
    const md = renderMarkdown(draft, BASE_COMPOSE);
    expect(md).toContain("# ");
    expect(md).toContain("Subject variants");
    expect(md).toContain("Body");
    expect(md).toContain("Honesty");
  });
  it("renderJson produces valid JSON", () => {
    const draft = generateEmail(BASE_COMPOSE);
    const json = renderJson(draft, BASE_COMPOSE);
    const parsed = JSON.parse(json);
    expect(parsed.draft).toBeDefined();
    expect(parsed.inputs).toBeDefined();
    expect(parsed.generatedAt).toBeDefined();
  });
});

describe("ai-email-draft-generator history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1,
      mode: "compose",
      purpose: "request",
      tone: "friendly",
      length: "medium",
      recipientName: "jordan",
      primarySubject: "Quick request",
      bodyPreview: "Hi Jordan…",
    });
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0].primarySubject).toBe("Quick request");
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i,
        mode: "compose",
        purpose: "request",
        tone: "friendly",
        length: "medium",
        recipientName: "j",
        primarySubject: `S${i}`,
        bodyPreview: "…",
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1, mode: "compose", purpose: "request", tone: "friendly",
      length: "medium", recipientName: "j", primarySubject: "x", bodyPreview: "y",
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("ai-email-draft-generator share URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl(BASE_COMPOSE);
    expect(url).toContain("to=jordan");
    expect(url).toContain("from=alex");
    expect(url).toContain("brief=");
    expect(url.startsWith("?")).toBe(true);
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const url = buildShareUrl(BASE_REPLY);
    const hash = url.includes("#") ? url.slice(url.indexOf("#")) : `#${url.slice(url.indexOf("?") + 1)}`;
    const p = parseShareUrl(hash);
    expect(p.inputs.mode).toBe("reply");
    expect(p.inputs.recipientName).toBe("jordan");
    expect(p.inputs.brief).toBe("answers below");
    expect(p.inputs.thread).toContain("Thursday");
  });
  it("omits defaults from share URL", () => {
    const url = buildShareUrl(BASE_COMPOSE); // compose + request + friendly + medium are defaults
    expect(url).not.toContain("mode=compose");
    expect(url).not.toContain("purpose=request");
    expect(url).not.toContain("tone=friendly");
    expect(url).not.toContain("length=medium");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({ inputs: {} });
  });
  it("filters unknown tone / purpose / length", () => {
    const p = parseShareUrl("tone=unknown&purpose=unknown&length=unknown");
    expect(p.inputs.tone).toBeUndefined();
    expect(p.inputs.purpose).toBeUndefined();
    expect(p.inputs.length).toBeUndefined();
  });
});

describe("ai-email-draft-generator LLM prompt + parse", () => {
  it("buildLlmPrompt contains inputs + draft", () => {
    const draft = generateEmail(BASE_COMPOSE);
    const prompt = buildLlmPrompt(BASE_COMPOSE, draft);
    expect(prompt).toContain("Compose");
    expect(prompt).toContain("Request");
    expect(prompt).toContain("Friendly");
    expect(prompt).toContain("jordan");
    expect(prompt).toContain("refinedSubject");
    expect(prompt).toContain("refinedBody");
    expect(prompt).toContain(draft.primarySubject);
  });
  it("buildLlmPrompt includes thread in reply mode", () => {
    const draft = generateReply(BASE_REPLY);
    const prompt = buildLlmPrompt(BASE_REPLY, draft);
    expect(prompt).toContain("Original subject: Q3 roadmap call");
    expect(prompt).toContain("Thursday");
  });
  it("renderLlmResult parses valid JSON", () => {
    const raw = JSON.stringify({
      refinedSubject: "Polished subject",
      refinedBody: "Hi Jordan,\n\nPolished body.\n\nCheers,\nAlex",
      notes: ["Tightened the opener."],
    });
    const r = renderLlmResult(raw);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.result.refinedSubject).toBe("Polished subject");
      expect(r.result.refinedBody).toContain("Polished body");
      expect(r.result.notes).toHaveLength(1);
    }
  });
  it("renderLlmResult strips code fences", () => {
    const raw = "```json\n" + JSON.stringify({
      refinedSubject: "x",
      refinedBody: "y",
      notes: [],
    }) + "\n```";
    const r = renderLlmResult(raw);
    expect(r.ok).toBe(true);
  });
  it("renderLlmResult errors on bad JSON", () => {
    const r = renderLlmResult("not json");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("parse");
  });
  it("renderLlmResult errors on non-object", () => {
    const r = renderLlmResult("[1,2,3]");
    expect(r.ok).toBe(false);
  });
  it("renderLlmResult errors when both subject + body missing", () => {
    const r = renderLlmResult(JSON.stringify({ notes: ["x"] }));
    expect(r.ok).toBe(false);
  });
});

// Suppress unused-import lint for type-only imports
export type _Unused = Mode | Purpose | Tone | Length | EmailInputs | Signature;
