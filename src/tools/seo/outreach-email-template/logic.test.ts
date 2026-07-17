import { describe, it, expect, beforeEach } from "vitest";
import {
  TEMPLATE_INFO,
  TEMPLATE_LABEL_MAP,
  substituteVariables,
  greeting,
  signOff,
  generateSubject,
  generateEmailBody,
  generateEmail,
  countWords,
  validateInput,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type OutreachInput,
  type TemplateType,
  type Tone,
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

const baseInput: OutreachInput = {
  template: "guest-post",
  tone: "friendly",
  recipientName: "Sarah",
  recipientSite: "example-blog.com",
  yourName: "Alex",
  yourSite: "https://mysite.com",
  yourEmail: "alex@mysite.com",
  topic: "running tips for beginners",
  yourArticleTitle: "The Beginner's Guide to Running",
  theirArticleUrl: "",
  brokenLinkUrl: "",
  replacementUrl: "",
  customMessage: "",
};

describe("outreach-email-template templates", () => {
  it("has all 5 templates", () => {
    expect(TEMPLATE_INFO).toHaveLength(5);
    const types = TEMPLATE_INFO.map((t) => t.type);
    expect(types).toContain("guest-post");
    expect(types).toContain("backlink-request");
    expect(types).toContain("broken-link");
    expect(types).toContain("collaboration");
    expect(types).toContain("influencer-outreach");
  });
  it("each template has required fields", () => {
    for (const t of TEMPLATE_INFO) {
      expect(t.requiredFields.length).toBeGreaterThan(0);
      expect(t.label).toBeTruthy();
      expect(t.description).toBeTruthy();
    }
  });
  it("label map matches template types", () => {
    for (const t of TEMPLATE_INFO) {
      expect(TEMPLATE_LABEL_MAP[t.type]).toBe(t.label);
    }
  });
});

describe("outreach-email-template substituteVariables", () => {
  it("substitutes simple variables", () => {
    const out = substituteVariables("Hi {name}!", { name: "Sarah" });
    expect(out).toBe("Hi Sarah!");
  });
  it("substitutes multiple variables", () => {
    const out = substituteVariables("{greeting} {name}, welcome to {site}", {
      name: "Alex",
      site: "Example",
      greeting: "Hi",
    });
    expect(out).toBe("Hi Alex, welcome to Example");
  });
  it("leaves unknown variables as-is", () => {
    const out = substituteVariables("Hi {unknown}!", { name: "Sarah" });
    expect(out).toBe("Hi {unknown}!");
  });
  it("handles empty vars", () => {
    const out = substituteVariables("Hi {name}!", {});
    expect(out).toBe("Hi {name}!");
  });
  it("substitutes numeric values", () => {
    const out = substituteVariables("{count} items", { count: "5" });
    expect(out).toBe("5 items");
  });
});

describe("outreach-email-template greeting and signOff", () => {
  it("formal greeting uses 'Dear'", () => {
    expect(greeting("Sarah", "formal")).toBe("Dear Sarah,");
  });
  it("casual greeting uses 'Hey'", () => {
    expect(greeting("Sarah", "casual")).toBe("Hey Sarah!");
  });
  it("friendly greeting uses 'Hi'", () => {
    expect(greeting("Sarah", "friendly")).toBe("Hi Sarah,");
  });
  it("uses 'there' when name is empty", () => {
    expect(greeting("", "friendly")).toBe("Hi there,");
  });
  it("formal signoff uses 'Sincerely'", () => {
    expect(signOff("Alex", "formal")).toContain("Sincerely");
    expect(signOff("Alex", "formal")).toContain("Alex");
  });
  it("casual signoff uses 'Cheers'", () => {
    expect(signOff("Alex", "casual")).toContain("Cheers");
  });
  it("friendly signoff uses 'Best'", () => {
    expect(signOff("Alex", "friendly")).toContain("Best");
  });
});

describe("outreach-email-template generateSubject", () => {
  it("guest post subject includes topic", () => {
    const s = generateSubject({ ...baseInput, template: "guest-post" });
    expect(s).toContain("Guest post");
    expect(s).toContain(baseInput.topic);
    expect(s).toContain(baseInput.recipientSite);
  });
  it("backlink subject mentions resource suggestion", () => {
    const s = generateSubject({ ...baseInput, template: "backlink-request" });
    expect(s).toContain("Resource suggestion");
  });
  it("broken link subject mentions broken link", () => {
    const s = generateSubject({ ...baseInput, template: "broken-link" });
    expect(s).toContain("broken link");
    expect(s).toContain(baseInput.recipientSite);
  });
  it("collaboration subject includes topic", () => {
    const s = generateSubject({ ...baseInput, template: "collaboration" });
    expect(s).toContain("Collaboration");
    expect(s).toContain(baseInput.topic);
  });
  it("influencer subject includes topic", () => {
    const s = generateSubject({ ...baseInput, template: "influencer-outreach" });
    expect(s).toContain(baseInput.topic);
  });
});

describe("outreach-email-template generateEmailBody", () => {
  it("guest post body mentions recipient site and topic", () => {
    const body = generateEmailBody({ ...baseInput, template: "guest-post" });
    expect(body).toContain(baseInput.recipientSite);
    expect(body).toContain(baseInput.topic);
    expect(body).toContain(baseInput.yourArticleTitle);
    expect(body).toContain(baseInput.yourName);
  });
  it("backlink body mentions article title and your site", () => {
    const body = generateEmailBody({ ...baseInput, template: "backlink-request" });
    expect(body).toContain(baseInput.yourArticleTitle);
    expect(body).toContain(baseInput.yourSite);
  });
  it("broken link body mentions broken and replacement URLs", () => {
    const body = generateEmailBody({
      ...baseInput,
      template: "broken-link",
      brokenLinkUrl: "https://broken.example.com",
      replacementUrl: "https://mysite.com/article",
    });
    expect(body).toContain("https://broken.example.com");
    expect(body).toContain("https://mysite.com/article");
  });
  it("collaboration body mentions your site and topic", () => {
    const body = generateEmailBody({ ...baseInput, template: "collaboration" });
    expect(body).toContain(baseInput.yourSite);
    expect(body).toContain(baseInput.topic);
  });
  it("influencer body mentions your site", () => {
    const body = generateEmailBody({ ...baseInput, template: "influencer-outreach" });
    expect(body).toContain(baseInput.yourSite);
  });
  it("respects tone in greeting", () => {
    const formal = generateEmailBody({ ...baseInput, tone: "formal" });
    expect(formal).toContain("Dear Sarah,");
    const casual = generateEmailBody({ ...baseInput, tone: "casual" });
    expect(casual).toContain("Hey Sarah!");
  });
  it("includes custom message when provided", () => {
    const body = generateEmailBody({
      ...baseInput,
      customMessage: "Looking forward to your reply by Friday.",
    });
    expect(body).toContain("Looking forward to your reply by Friday.");
  });
});

describe("outreach-email-template generateEmail", () => {
  it("returns subject, body, and stats", () => {
    const email = generateEmail(baseInput);
    expect(email.subject).toBeTruthy();
    expect(email.body).toBeTruthy();
    expect(email.wordCount).toBeGreaterThan(0);
    expect(email.charCount).toBeGreaterThan(0);
    expect(email.estimatedReadTime).toBeGreaterThanOrEqual(1);
  });
  it("subject and body are consistent", () => {
    const email = generateEmail(baseInput);
    expect(email.body).toContain(baseInput.recipientName);
  });
  it("char count matches body length", () => {
    const email = generateEmail(baseInput);
    expect(email.charCount).toBe(email.body.length);
  });
});

describe("outreach-email-template countWords", () => {
  it("counts words", () => {
    expect(countWords("hello world")).toBe(2);
    expect(countWords("one two three four")).toBe(4);
  });
  it("returns 0 for empty", () => {
    expect(countWords("")).toBe(0);
    expect(countWords("   ")).toBe(0);
  });
  it("handles extra whitespace", () => {
    expect(countWords("  hello   world  ")).toBe(2);
  });
});

describe("outreach-email-template validateInput", () => {
  it("passes for valid input", () => {
    const v = validateInput(baseInput);
    expect(v.ok).toBe(true);
    expect(v.errors).toHaveLength(0);
  });
  it("errors when required fields missing for guest-post", () => {
    const v = validateInput({ ...baseInput, recipientName: "" });
    expect(v.ok).toBe(false);
    expect(v.errors.some((e) => /recipientName/i.test(e))).toBe(true);
  });
  it("warns when site looks invalid", () => {
    const v = validateInput({ ...baseInput, recipientSite: "not a site" });
    expect(v.warnings.length).toBeGreaterThan(0);
  });
  it("broken link template requires brokenLinkUrl and replacementUrl", () => {
    const v = validateInput({ ...baseInput, template: "broken-link", brokenLinkUrl: "", replacementUrl: "" });
    expect(v.ok).toBe(false);
    expect(v.errors.some((e) => /brokenLinkUrl/i.test(e))).toBe(true);
    expect(v.errors.some((e) => /replacementUrl/i.test(e))).toBe(true);
  });
  it("returns warnings but ok=true for sites with valid domain format", () => {
    const v = validateInput({ ...baseInput, recipientSite: "example.com" });
    expect(v.warnings.some((w) => /recipient site/i.test(w))).toBe(false);
  });
});

describe("outreach-email-template history", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, template: "guest-post", tone: "friendly", recipient: "Sarah", snippet: "..." });
    saveHistory({ ts: 2, template: "broken-link", tone: "formal", recipient: "Bob", snippet: "..." });
    expect(loadHistory()).toHaveLength(2);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, template: "guest-post", tone: "friendly", recipient: "x", snippet: "x" });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, template: "guest-post", tone: "friendly", recipient: "x", snippet: "x" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("outreach-email-template shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({ input: baseInput });
    expect(url).toContain("template=guest-post");
    expect(url).toContain("recipientName=Sarah");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = {
      location: { origin: "https://app.example.com", pathname: "/tools/outreach-email-template" },
    };
    try {
      const url = buildShareUrl({ input: baseInput });
      const hash = url.includes("#") ? `#${url.split("#")[1]}` : "";
      const parsed = parseShareUrl(hash);
      expect(parsed.template).toBe("guest-post");
      expect(parsed.recipientName).toBe("Sarah");
      expect(parsed.yourName).toBe("Alex");
    } finally {
      (globalThis as Record<string, unknown>).window = origWindow;
    }
  });
  it("returns empty for empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("omits empty fields", () => {
    const url = buildShareUrl({
      input: { ...baseInput, customMessage: "", yourArticleTitle: "" },
    });
    expect(url).not.toContain("customMessage=");
    expect(url).not.toContain("yourArticleTitle=");
  });
});

describe("outreach-email-template all templates compile", () => {
  const templates: TemplateType[] = [
    "guest-post",
    "backlink-request",
    "broken-link",
    "collaboration",
    "influencer-outreach",
  ];
  const tones: Tone[] = ["formal", "casual", "friendly"];
  it("every template + tone combination generates valid output", () => {
    for (const template of templates) {
      for (const tone of tones) {
        const email = generateEmail({
          ...baseInput,
          template,
          tone,
          brokenLinkUrl: template === "broken-link" ? "https://broken.com" : "",
          replacementUrl: template === "broken-link" ? "https://mysite.com/x" : "",
        });
        expect(email.subject.length).toBeGreaterThan(0);
        expect(email.body.length).toBeGreaterThan(50);
        expect(email.wordCount).toBeGreaterThan(20);
      }
    }
  });
});
