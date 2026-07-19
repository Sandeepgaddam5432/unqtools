import { describe, it, expect, beforeEach } from "vitest";
import {
  HISTORY_KEY,
  HISTORY_MAX,
  TEMPLATE_LABELS,
  TEMPLATE_DESCRIPTIONS,
  DEFAULT_THEME,
  FONT_PRESETS,
  SAMPLE_PROMPTS,
  TEMPLATE_KEYWORDS,
  normalizeLine,
  normalizeText,
  escapeHtml,
  parseList,
  parseFeatures,
  parseTestimonials,
  parsePricing,
  parseFaqs,
  parseSchedule,
  parseProjects,
  matchTemplate,
  extractBusinessName,
  extractTagline,
  darken,
  lighten,
  buildCss,
  buildSeoMeta,
  buildJsonLd,
  computeA11y,
  buildPage,
  buildPreviewSrcDoc,
  toReactComponent,
  renderPlainText,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  renderLlmResult,
  type TemplateId,
  type Theme,
  type LandingInputs,
  type GeneratedPage,
  type Feature,
  type Testimonial,
  type PricingTier,
  type FAQItem,
  type ScheduleItem,
  type ProjectItem,
  type ShareState,
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

function makeSampleInputs(overrides: Partial<LandingInputs> = {}): LandingInputs {
  return {
    template: "saas",
    businessName: "Acme Inc.",
    tagline: "Build anything, faster",
    description: "The all-in-one platform for modern teams.",
    cta: "Get Started",
    ctaSecondary: "Learn more",
    url: "https://acme.example.com",
    features: [
      { title: "Fast", description: "Blazing fast performance" },
      { title: "Secure", description: "End-to-end encryption" },
      { title: "Easy", description: "No code required" },
    ],
    testimonials: [
      { quote: "Love it!", author: "Jane Doe", role: "CEO" },
    ],
    pricing: [
      { name: "Starter", price: "$0", period: "mo", features: ["1 user", "5 projects"], cta: "Start free" },
      { name: "Pro", price: "$29", period: "mo", features: ["10 users", "Unlimited projects"], highlighted: true, cta: "Choose Pro" },
    ],
    faqs: [
      { q: "Is there a free plan?", a: "Yes, the Starter plan is free forever." },
      { q: "Can I cancel anytime?", a: "Yes, you can cancel from your account settings." },
    ],
    schedule: [],
    projects: [],
    email: "hello@acme.example.com",
    social: { twitter: "https://twitter.com/acme", github: "https://github.com/acme" },
    sections: {
      features: true, testimonials: true, pricing: true, faq: true,
      schedule: false, projects: false,
    },
    theme: { ...DEFAULT_THEME },
    ...overrides,
  };
}

describe("html-landing constants", () => {
  it("has 5 templates", () => {
    expect(Object.keys(TEMPLATE_LABELS)).toHaveLength(5);
  });
  it("has descriptions for all templates", () => {
    for (const t of Object.keys(TEMPLATE_LABELS) as TemplateId[]) {
      expect(TEMPLATE_DESCRIPTIONS[t].length).toBeGreaterThan(0);
    }
  });
  it("has default theme with primary + accent colors", () => {
    expect(DEFAULT_THEME.primary).toMatch(/^#/);
    expect(DEFAULT_THEME.accent).toMatch(/^#/);
    expect(DEFAULT_THEME.radius).toBeGreaterThan(0);
  });
  it("has 5 font presets", () => {
    expect(FONT_PRESETS).toHaveLength(5);
  });
  it("has 5 sample prompts", () => {
    expect(SAMPLE_PROMPTS).toHaveLength(5);
  });
  it("has keywords for all templates", () => {
    for (const t of Object.keys(TEMPLATE_KEYWORDS) as TemplateId[]) {
      expect(TEMPLATE_KEYWORDS[t].length).toBeGreaterThan(3);
    }
  });
  it("exposes HISTORY_KEY and HISTORY_MAX", () => {
    expect(HISTORY_KEY).toContain("html-landing");
    expect(HISTORY_MAX).toBe(20);
  });
});

describe("normalizers", () => {
  it("normalizeLine collapses whitespace", () => {
    expect(normalizeLine("  hello   world  ")).toBe("hello world");
  });
  it("normalizeText preserves newlines", () => {
    expect(normalizeText("a\n\n\nb")).toBe("a\n\nb");
  });
  it("escapeHtml escapes special chars", () => {
    expect(escapeHtml('<b>"x"&</b>')).toBe("&lt;b&gt;&quot;x&quot;&amp;&lt;/b&gt;");
  });
});

describe("parseList / parseFeatures / parseTestimonials / parsePricing / parseFaqs / parseSchedule / parseProjects", () => {
  it("parseList handles comma or newline", () => {
    expect(parseList("a\nb,c")).toEqual(["a", "b", "c"]);
  });
  it("parseList returns empty for empty", () => {
    expect(parseList("")).toEqual([]);
  });
  it("parseFeatures parses 'Title: Description'", () => {
    const out = parseFeatures("Fast: Blazing fast\nSecure: E2E encryption");
    expect(out).toHaveLength(2);
    expect(out[0].title).toBe("Fast");
    expect(out[0].description).toBe("Blazing fast");
  });
  it("parseFeatures handles no-description", () => {
    const out = parseFeatures("Just a title");
    expect(out[0].title).toBe("Just a title");
    expect(out[0].description).toBe("");
  });
  it("parseTestimonials parses 'Quote | Author | Role'", () => {
    const out = parseTestimonials("Love it! | Jane Doe | CEO");
    expect(out).toHaveLength(1);
    expect(out[0].quote).toBe("Love it!");
    expect(out[0].author).toBe("Jane Doe");
    expect(out[0].role).toBe("CEO");
  });
  it("parseTestimonials skips entries without author", () => {
    expect(parseTestimonials("Quote only")).toEqual([]);
  });
  it("parsePricing parses 'Name | Price | Period | features; list | CTA'", () => {
    const out = parsePricing("Pro | $29 | mo | 10 users; Unlimited | Choose Pro");
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe("Pro");
    expect(out[0].price).toBe("$29");
    expect(out[0].period).toBe("mo");
    expect(out[0].features).toEqual(["10 users", "Unlimited"]);
    expect(out[0].cta).toBe("Choose Pro");
  });
  it("parseFaqs strips Q: and A: prefixes", () => {
    const out = parseFaqs("Q: Is there a free plan? | A: Yes");
    expect(out[0].q).toBe("Is there a free plan?");
    expect(out[0].a).toBe("Yes");
  });
  it("parseSchedule parses 'Time | Title | Speaker'", () => {
    const out = parseSchedule("9:00 | Welcome | Jane Doe");
    expect(out[0].time).toBe("9:00");
    expect(out[0].title).toBe("Welcome");
    expect(out[0].speaker).toBe("Jane Doe");
  });
  it("parseProjects parses 'Title | Description | tags | url'", () => {
    const out = parseProjects("Acme Site | Marketing site | React, Tailwind | https://acme.com");
    expect(out[0].title).toBe("Acme Site");
    expect(out[0].tags).toEqual(["React", "Tailwind"]);
    expect(out[0].url).toBe("https://acme.com");
  });
});

describe("matchTemplate", () => {
  it("matches 'saas' for SaaS keywords", () => {
    const m = matchTemplate("project management saas for small teams");
    expect(m.template).toBe("saas");
    expect(m.confidence).toBeGreaterThan(0);
  });
  it("matches 'app' for app keywords", () => {
    const m = matchTemplate("mobile app for tracking workouts");
    expect(m.template).toBe("app");
  });
  it("matches 'event' for event keywords", () => {
    const m = matchTemplate("developer conference in San Francisco");
    expect(m.template).toBe("event");
  });
  it("matches 'portfolio' for portfolio keywords", () => {
    const m = matchTemplate("freelance designer portfolio");
    expect(m.template).toBe("portfolio");
  });
  it("matches 'product' for product keywords", () => {
    const m = matchTemplate("wireless headphones product");
    expect(m.template).toBe("product");
  });
  it("returns 0 confidence for empty prompt", () => {
    expect(matchTemplate("").confidence).toBe(0);
  });
  it("falls back to 'saas' for no matches", () => {
    expect(matchTemplate("xyz qqq zzz").template).toBe("saas");
  });
});

describe("extractBusinessName / extractTagline", () => {
  it("extracts business name before dash", () => {
    expect(extractBusinessName("TaskFlow — project management SaaS")).toBe("TaskFlow");
  });
  it("extracts tagline after dash", () => {
    expect(extractTagline("TaskFlow — project management SaaS")).toBe("project management SaaS");
  });
  it("returns full string as business name if no dash", () => {
    expect(extractBusinessName("Just a name")).toBe("Just a name");
  });
  it("returns empty tagline if no dash", () => {
    expect(extractTagline("Just a name")).toBe("");
  });
});

describe("darken / lighten", () => {
  it("darkens a hex color", () => {
    expect(darken("#ffffff", 0.5)).toBe("#808080");
  });
  it("lightens a hex color", () => {
    expect(lighten("#000000", 0.5)).toBe("#808080");
  });
  it("handles 3-digit hex", () => {
    expect(darken("#fff", 0.5)).toBe("#808080");
  });
  it("clamps at black", () => {
    expect(darken("#000000", 1)).toBe("#000000");
  });
  it("clamps at white", () => {
    expect(lighten("#ffffff", 1)).toBe("#ffffff");
  });
});

describe("buildCss", () => {
  it("includes --primary CSS var", () => {
    const css = buildCss(DEFAULT_THEME, "saas");
    expect(css).toContain("--primary: #2563eb");
    expect(css).toContain("--accent: #7c3aed");
    expect(css).toContain("--radius: 12px");
  });
  it("includes dark-mode CSS when enabled", () => {
    const css = buildCss({ ...DEFAULT_THEME, darkMode: true }, "saas");
    expect(css).toContain('prefers-color-scheme: dark');
    expect(css).toContain('[data-theme="dark"]');
  });
  it("omits dark-mode CSS when disabled", () => {
    const css = buildCss({ ...DEFAULT_THEME, darkMode: false }, "saas");
    expect(css).not.toContain('prefers-color-scheme');
  });
  it("includes phone mockup for app template", () => {
    const css = buildCss(DEFAULT_THEME, "app");
    expect(css).toContain(".phone-mockup");
  });
  it("does not include phone mockup for saas template", () => {
    const css = buildCss(DEFAULT_THEME, "saas");
    expect(css).not.toContain(".phone-mockup");
  });
});

describe("buildSeoMeta", () => {
  it("includes title and description", () => {
    const meta = buildSeoMeta(makeSampleInputs());
    expect(meta).toContain("<title>Acme Inc. — Build anything, faster</title>");
    expect(meta).toContain('<meta name="description"');
  });
  it("includes Open Graph tags", () => {
    const meta = buildSeoMeta(makeSampleInputs());
    expect(meta).toContain('property="og:title"');
    expect(meta).toContain('property="og:description"');
    expect(meta).toContain('property="og:url"');
  });
  it("includes Twitter Card tags", () => {
    const meta = buildSeoMeta(makeSampleInputs());
    expect(meta).toContain('name="twitter:card"');
  });
  it("includes canonical link", () => {
    const meta = buildSeoMeta(makeSampleInputs());
    expect(meta).toContain('rel="canonical"');
  });
});

describe("buildJsonLd", () => {
  it("returns FAQPage schema when FAQs present", () => {
    const json = buildJsonLd(makeSampleInputs());
    expect(json).toContain('"@type": "FAQPage"');
    expect(json).toContain('"@type": "Question"');
  });
  it("returns empty string when no FAQs", () => {
    const json = buildJsonLd(makeSampleInputs({ faqs: [] }));
    expect(json).toBe("");
  });
});

describe("computeA11y", () => {
  it("detects lang attribute", () => {
    const a11y = computeA11y('<html lang="en"><body></body></html>');
    expect(a11y.hasLang).toBe(true);
  });
  it("detects missing lang", () => {
    const a11y = computeA11y("<html><body></body></html>");
    expect(a11y.hasLang).toBe(false);
  });
  it("detects viewport meta", () => {
    const a11y = computeA11y('<meta name="viewport" content="width=device-width">');
    expect(a11y.hasViewport).toBe(true);
  });
  it("detects semantic landmarks", () => {
    const a11y = computeA11y("<header></header><main></main><footer></footer>");
    expect(a11y.hasSemanticLandmarks).toBe(true);
  });
  it("flags issues when missing", () => {
    const a11y = computeA11y("<html><body></body></html>");
    expect(a11y.issues.length).toBeGreaterThan(0);
  });
});

describe("buildPage", () => {
  it("generates a complete HTML document", () => {
    const page = buildPage(makeSampleInputs());
    expect(page.html).toContain("<!DOCTYPE html>");
    expect(page.html).toContain("<html");
    expect(page.html).toContain("<head>");
    expect(page.html).toContain("<body>");
    expect(page.html).toContain("</html>");
  });
  it("includes SEO meta, OG, Twitter, JSON-LD", () => {
    const page = buildPage(makeSampleInputs());
    expect(page.hasSeoMeta).toBe(true);
    expect(page.hasOpenGraph).toBe(true);
    expect(page.hasTwitterCard).toBe(true);
    expect(page.hasJsonLd).toBe(true);
  });
  it("includes skip link", () => {
    const page = buildPage(makeSampleInputs());
    expect(page.html).toContain('class="skip-link"');
  });
  it("includes semantic landmarks", () => {
    const page = buildPage(makeSampleInputs());
    expect(page.html).toContain("<header");
    expect(page.html).toContain("<main");
    expect(page.html).toContain("<footer");
  });
  it("includes hero section with tagline", () => {
    const page = buildPage(makeSampleInputs());
    expect(page.html).toContain('class="hero"');
    expect(page.html).toContain("Build anything, faster");
  });
  it("includes features section", () => {
    const page = buildPage(makeSampleInputs());
    expect(page.html).toContain('id="features"');
    expect(page.html).toContain("Blazing fast performance");
  });
  it("includes pricing section", () => {
    const page = buildPage(makeSampleInputs());
    expect(page.html).toContain('id="pricing"');
    expect(page.html).toContain("$29");
  });
  it("includes testimonials section", () => {
    const page = buildPage(makeSampleInputs());
    expect(page.html).toContain('id="testimonials"');
    expect(page.html).toContain("Jane Doe");
  });
  it("includes FAQ section", () => {
    const page = buildPage(makeSampleInputs());
    expect(page.html).toContain('id="faq"');
    expect(page.html).toContain("Is there a free plan?");
  });
  it("includes CTA section", () => {
    const page = buildPage(makeSampleInputs());
    expect(page.html).toContain('class="cta"');
    expect(page.html).toContain("Get Started");
  });
  it("skips FAQ section when disabled", () => {
    const page = buildPage(makeSampleInputs({ sections: { features: true, testimonials: false, pricing: false, faq: false, schedule: false, projects: false } }));
    expect(page.html).not.toContain('id="faq"');
    expect(page.hasJsonLd).toBe(false);
  });
  it("includes schedule section for event template", () => {
    const page = buildPage(makeSampleInputs({
      template: "event",
      schedule: [{ time: "9:00", title: "Welcome", speaker: "Jane" }],
      sections: { features: false, testimonials: false, pricing: false, faq: false, schedule: true, projects: false },
    }));
    expect(page.html).toContain('id="schedule"');
    expect(page.html).toContain("Welcome");
  });
  it("includes projects section for portfolio template", () => {
    const page = buildPage(makeSampleInputs({
      template: "portfolio",
      projects: [{ title: "Acme Site", description: "Marketing site", tags: ["React"] }],
      sections: { features: false, testimonials: false, pricing: false, faq: false, schedule: false, projects: true },
    }));
    expect(page.html).toContain('id="projects"');
    expect(page.html).toContain("Acme Site");
  });
  it("includes phone mockup for app template", () => {
    const page = buildPage(makeSampleInputs({
      template: "app",
      sections: { features: false, testimonials: false, pricing: false, faq: false, schedule: false, projects: false },
    }));
    expect(page.html).toContain("phone-mockup");
  });
  it("computes bytes and sectionCount", () => {
    const page = buildPage(makeSampleInputs());
    expect(page.bytes).toBeGreaterThan(1000);
    expect(page.sectionCount).toBeGreaterThanOrEqual(5);
  });
  it("warns when sections enabled but no content", () => {
    const page = buildPage(makeSampleInputs({
      features: [], testimonials: [], pricing: [], faqs: [],
    }));
    expect(page.warnings.length).toBeGreaterThan(0);
  });
  it("includes dark-mode toggle when enabled", () => {
    const page = buildPage(makeSampleInputs({ theme: { ...DEFAULT_THEME, darkMode: true } }));
    expect(page.html).toContain("theme-toggle");
    expect(page.hasDarkMode).toBe(true);
  });
  it("omits dark-mode toggle when disabled", () => {
    const page = buildPage(makeSampleInputs({ theme: { ...DEFAULT_THEME, darkMode: false } }));
    expect(page.html).not.toContain("theme-toggle");
    expect(page.hasDarkMode).toBe(false);
  });
  it("escapes user-provided HTML special characters", () => {
    const page = buildPage(makeSampleInputs({
      businessName: "<script>alert(1)</script>",
    }));
    expect(page.html).toContain("&lt;script&gt;");
    expect(page.html).not.toContain("<script>alert(1)</script>");
  });
});

describe("buildPreviewSrcDoc", () => {
  it("returns the HTML as-is for iframe srcdoc", () => {
    const page = buildPage(makeSampleInputs());
    expect(buildPreviewSrcDoc(page)).toBe(page.html);
  });
});

describe("toReactComponent", () => {
  it("converts class to className", () => {
    const page = buildPage(makeSampleInputs());
    const react = toReactComponent(page);
    expect(react).toContain("className=");
    expect(react).not.toContain('class="');
  });
});

describe("renderPlainText", () => {
  it("strips HTML tags", () => {
    const page = buildPage(makeSampleInputs());
    const text = renderPlainText(page);
    expect(text).not.toContain("<");
    expect(text).toContain("Build anything, faster");
  });
});

describe("history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, template: "saas", businessName: "Acme", sectionCount: 5, bytes: 1000 });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, template: "saas", businessName: "x", sectionCount: 1, bytes: 100 });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, template: "saas", businessName: "x", sectionCount: 1, bytes: 100 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({ inputs: makeSampleInputs() });
    expect(url).toContain("t=saas");
    expect(url).toContain("b=Acme");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({ inputs: makeSampleInputs() });
    const parsed = parseShareUrl(url.slice(url.indexOf("#") + 1));
    expect(parsed.template).toBe("saas");
    expect(parsed.businessName).toBe("Acme Inc.");
    expect(parsed.tagline).toBe("Build anything, faster");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("filters unknown template", () => {
    const parsed = parseShareUrl("t=unknown");
    expect(parsed.template).toBeUndefined();
  });
  it("parses theme overrides", () => {
    const parsed = parseShareUrl("t=saas&p=%23ff0000&r=8&dm=0");
    expect(parsed.theme?.primary).toBe("#ff0000");
    expect(parsed.theme?.radius).toBe(8);
    expect(parsed.theme?.darkMode).toBe(false);
  });
});

describe("LLM prompt", () => {
  it("builds a system + user prompt", () => {
    const p = buildLlmPrompt(makeSampleInputs());
    expect(p.system.toLowerCase()).toContain("html");
    expect(p.user).toContain("Acme Inc.");
    expect(p.user).toContain("Starter");
  });
  it("strips markdown fences from LLM response", () => {
    expect(renderLlmResult("```html\n<!DOCTYPE html>\n<html></html>\n```")).toBe("<!DOCTYPE html>\n<html></html>");
  });
  it("handles raw response without fences", () => {
    expect(renderLlmResult("<!DOCTYPE html><html></html>")).toBe("<!DOCTYPE html><html></html>");
  });
});

// Suppress unused-import lint
export type _Unused =
  | TemplateId | Theme | LandingInputs | GeneratedPage
  | Feature | Testimonial | PricingTier | FAQItem
  | ScheduleItem | ProjectItem | ShareState;
