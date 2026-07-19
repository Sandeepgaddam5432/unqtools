/**
 * AI HTML Landing Page Generator — pure logic.
 *
 * Five templates (SaaS, App, Product, Event, Portfolio) assembled from
 * structured inputs (business name, tagline, features, CTA, testimonials,
 * pricing, FAQ) into a complete single-file HTML document with inline CSS,
 * SEO meta tags, Open Graph, Twitter Card, and JSON-LD FAQPage schema.
 *
 * Pure functions only — no DOM, no network. The optional LLM call (BYO API
 * key) lives in ui.tsx because it touches the network.
 */

// ---------- Types ----------

export type TemplateId = "saas" | "app" | "product" | "event" | "portfolio";

export interface Theme {
  primary: string;       // hex, e.g. "#2563eb"
  accent: string;        // hex
  bg: string;            // hex (light background)
  text: string;          // hex (light text)
  font: string;          // CSS font-family stack
  radius: number;        // px
  darkMode: boolean;     // include dark-mode CSS + toggle
}

export interface Feature {
  title: string;
  description: string;
  icon?: string;         // emoji or short label
}

export interface PricingTier {
  name: string;
  price: string;
  period?: string;
  features: string[];
  highlighted?: boolean;
  cta?: string;
}

export interface Testimonial {
  quote: string;
  author: string;
  role?: string;
  avatar?: string;       // initials or URL
}

export interface FAQItem {
  q: string;
  a: string;
}

export interface ScheduleItem {
  time: string;
  title: string;
  speaker?: string;
}

export interface ProjectItem {
  title: string;
  description: string;
  tags?: string[];
  url?: string;
}

export interface LandingInputs {
  template: TemplateId;
  businessName: string;
  tagline: string;
  description: string;       // for meta description + hero subtitle
  cta: string;               // primary CTA text
  ctaSecondary?: string;     // secondary CTA text
  url?: string;              // canonical URL
  features: Feature[];
  testimonials: Testimonial[];
  pricing: PricingTier[];
  faqs: FAQItem[];
  schedule: ScheduleItem[];  // for event template
  projects: ProjectItem[];   // for portfolio template
  email?: string;
  social: { twitter?: string; github?: string; linkedin?: string };
  sections: {
    features: boolean;
    testimonials: boolean;
    pricing: boolean;
    faq: boolean;
    schedule: boolean;
    projects: boolean;
  };
  theme: Theme;
}

export interface GeneratedPage {
  id: string;
  template: TemplateId;
  html: string;
  css: string;          // inline CSS extracted (also embedded in html)
  bytes: number;
  sectionCount: number;
  hasSeoMeta: boolean;
  hasOpenGraph: boolean;
  hasTwitterCard: boolean;
  hasJsonLd: boolean;
  hasDarkMode: boolean;
  a11y: A11yReport;
  warnings: string[];
}

export interface A11yReport {
  hasLang: boolean;
  hasViewport: boolean;
  hasSkipLink: boolean;
  hasAltText: boolean;
  hasSemanticLandmarks: boolean;
  hasAriaLabels: boolean;
  issues: string[];
}

export interface HistoryEntry {
  ts: number;
  template: TemplateId;
  businessName: string;
  sectionCount: number;
  bytes: number;
}

export interface ShareState {
  inputs: LandingInputs;
}

export interface LlmPrompt {
  system: string;
  user: string;
}

// ---------- Constants ----------

export const HISTORY_KEY = "unqtools:ai-html-landing:history";
export const HISTORY_MAX = 20;

export const TEMPLATE_LABELS: Record<TemplateId, string> = {
  saas: "SaaS",
  app: "Mobile App",
  product: "Product",
  event: "Event",
  portfolio: "Portfolio",
};

export const TEMPLATE_DESCRIPTIONS: Record<TemplateId, string> = {
  saas: "Hero + features + pricing + FAQ + CTA. Best for software and subscription services.",
  app: "Hero with phone mockup + features + testimonials + download CTA. Best for mobile apps.",
  product: "Hero + features + benefit grid + social proof + buy CTA. Best for physical/digital products.",
  event: "Hero with date/location + schedule + speakers + register CTA. Best for conferences and meetups.",
  portfolio: "Hero + projects + skills + about + contact. Best for personal portfolios and freelancers.",
};

export const DEFAULT_THEME: Theme = {
  primary: "#2563eb",
  accent: "#7c3aed",
  bg: "#ffffff",
  text: "#0f172a",
  font: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  radius: 12,
  darkMode: true,
};

export const FONT_PRESETS: { label: string; value: string }[] = [
  { label: "System UI", value: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" },
  { label: "Inter", value: "'Inter', system-ui, sans-serif" },
  { label: "Poppins", value: "'Poppins', system-ui, sans-serif" },
  { label: "Georgia (serif)", value: "Georgia, 'Times New Roman', serif" },
  { label: "Mono", value: "'JetBrains Mono', 'Courier New', monospace" },
];

export const SAMPLE_PROMPTS: string[] = [
  "TaskFlow — project management SaaS for small teams",
  "FitTrack — mobile app for tracking workouts and nutrition",
  "Aurora Headphones — wireless noise-cancelling headphones",
  "DevWorld 2025 — developer conference in San Francisco",
  "Jane Doe — freelance product designer portfolio",
];

/** Keyword → template hints for prompt matching. */
export const TEMPLATE_KEYWORDS: Record<TemplateId, string[]> = {
  saas: ["saas", "software", "subscription", "platform", "dashboard", "tool", "crm", "erp", "analytics", "automation"],
  app: ["app", "mobile", "ios", "android", "download", "install", "fitness", "tracker"],
  product: ["product", "store", "shop", "buy", "headphones", "gadget", "device", "physical"],
  event: ["event", "conference", "meetup", "summit", "webinar", "festival", "talk", "speaker", "schedule"],
  portfolio: ["portfolio", "designer", "developer", "freelance", "personal", "resume", "cv", "about me"],
};

// ---------- Normalization ----------

/** Normalize a single-line string (collapse whitespace, trim). */
export function normalizeLine(s: string): string {
  return (s || "").replace(/\s+/g, " ").trim();
}

/** Normalize a multi-line string (preserve newlines, collapse internal spaces). */
export function normalizeText(s: string): string {
  if (!s) return "";
  return s
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Escape HTML special characters. */
export function escapeHtml(s: string): string {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Escape text for use inside a CSS string. */
export function escapeCss(s: string): string {
  return (s || "").replace(/"/g, '\\"');
}

/** Parse a comma-or-newline-separated list into trimmed non-empty strings. */
export function parseList(input: string): string[] {
  if (!input) return [];
  return input
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Parse features from "Title: Description" lines (one per line). */
export function parseFeatures(input: string): Feature[] {
  if (!input) return [];
  return input
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((line) => {
      const idx = line.indexOf(":");
      if (idx === -1) return { title: line, description: "" };
      return {
        title: line.slice(0, idx).trim(),
        description: line.slice(idx + 1).trim(),
      };
    });
}

/** Parse testimonials from "Quote | Author | Role" lines. */
export function parseTestimonials(input: string): Testimonial[] {
  if (!input) return [];
  return input
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split("|").map((p) => p.trim());
      return {
        quote: parts[0] ?? "",
        author: parts[1] ?? "",
        role: parts[2] ?? "",
      };
    })
    .filter((t) => t.quote && t.author);
}

/** Parse pricing tiers from "Name | $price | period | feature1; feature2 | CTA" lines. */
export function parsePricing(input: string): PricingTier[] {
  if (!input) return [];
  return input
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split("|").map((p) => p.trim());
      return {
        name: parts[0] ?? "",
        price: parts[1] ?? "",
        period: parts[2] || undefined,
        features: (parts[3] ?? "").split(/[;]/).map((s) => s.trim()).filter(Boolean),
        cta: parts[4] || undefined,
      };
    })
    .filter((p) => p.name && p.price);
}

/** Parse FAQs from "Q: question | A: answer" or "Question | Answer" lines. */
export function parseFaqs(input: string): FAQItem[] {
  if (!input) return [];
  return input
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split("|").map((p) => p.trim());
      let q = parts[0] ?? "";
      let a = parts[1] ?? "";
      // Strip "Q:" prefix
      q = q.replace(/^Q[:.]\s*/i, "");
      a = a.replace(/^A[:.]\s*/i, "");
      return { q, a };
    })
    .filter((f) => f.q && f.a);
}

/** Parse schedule from "Time | Title | Speaker" lines. */
export function parseSchedule(input: string): ScheduleItem[] {
  if (!input) return [];
  return input
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split("|").map((p) => p.trim());
      return {
        time: parts[0] ?? "",
        title: parts[1] ?? "",
        speaker: parts[2] || undefined,
      };
    })
    .filter((s) => s.time && s.title);
}

/** Parse projects from "Title | Description | tag1, tag2 | url" lines. */
export function parseProjects(input: string): ProjectItem[] {
  if (!input) return [];
  return input
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split("|").map((p) => p.trim());
      return {
        title: parts[0] ?? "",
        description: parts[1] ?? "",
        tags: (parts[2] ?? "").split(/[,;]/).map((s) => s.trim()).filter(Boolean),
        url: parts[3] || undefined,
      };
    })
    .filter((p) => p.title);
}

// ---------- Prompt matching ----------

/** Match a free-text prompt to a template using keyword overlap. */
export function matchTemplate(prompt: string): { template: TemplateId; confidence: number; matched: string[] } {
  const p = (prompt || "").toLowerCase();
  if (!p) return { template: "saas", confidence: 0, matched: [] };
  const scores: Record<TemplateId, { score: number; matched: string[] }> = {
    saas: { score: 0, matched: [] },
    app: { score: 0, matched: [] },
    product: { score: 0, matched: [] },
    event: { score: 0, matched: [] },
    portfolio: { score: 0, matched: [] },
  };
  for (const t of Object.keys(TEMPLATE_KEYWORDS) as TemplateId[]) {
    for (const kw of TEMPLATE_KEYWORDS[t]) {
      if (p.includes(kw)) {
        scores[t].score += 1;
        scores[t].matched.push(kw);
      }
    }
  }
  let best: TemplateId = "saas";
  let bestScore = -1;
  for (const t of Object.keys(scores) as TemplateId[]) {
    if (scores[t].score > bestScore) {
      bestScore = scores[t].score;
      best = t;
    }
  }
  const totalKws = Object.values(TEMPLATE_KEYWORDS).reduce((a, b) => a + b.length, 0);
  const maxPossible = Math.max(...Object.values(TEMPLATE_KEYWORDS).map((kws) => kws.length));
  const confidence = bestScore <= 0 ? 0 : Math.min(100, Math.round((bestScore / maxPossible) * 100));
  return { template: best, confidence, matched: scores[best].matched };
}

/** Extract a business name from a prompt (text before "—" or "–" or ":"). */
export function extractBusinessName(prompt: string): string {
  const p = normalizeLine(prompt);
  if (!p) return "";
  const m = p.split(/[—–:\-|]/);
  return normalizeLine(m[0] || "");
}

/** Extract a tagline (text after "—" or ":" or "|" in a prompt). */
export function extractTagline(prompt: string): string {
  const p = normalizeLine(prompt);
  if (!p) return "";
  const m = p.split(/[—–|]/);
  if (m.length < 2) return "";
  return normalizeLine(m.slice(1).join(" — "));
}

// ---------- HTML/CSS builders ----------

function genId(): string {
  return `lp-${Math.random().toString(36).slice(2, 9)}-${Date.now().toString(36).slice(-4)}`;
}

/** Build the CSS for a theme. */
export function buildCss(theme: Theme, template: TemplateId): string {
  const darkCss = theme.darkMode ? `
  @media (prefers-color-scheme: dark) {
    :root { --bg: ${darken(theme.bg)}; --text: ${lighten(theme.text)}; --card: ${darken(theme.bg, 0.15)}; --muted: ${lighten(theme.text, 0.4)}; }
    .hero { background: linear-gradient(135deg, ${theme.primary}, ${theme.accent}); color: #fff; }
  }
  [data-theme="dark"] { --bg: ${darken(theme.bg)}; --text: ${lighten(theme.text)}; --card: ${darken(theme.bg, 0.15)}; --muted: ${lighten(theme.text, 0.4)}; }
  [data-theme="dark"] .hero { background: linear-gradient(135deg, ${theme.primary}, ${theme.accent}); color: #fff; }` : "";
  const templateExtras = template === "app" ? `
  .phone-mockup { width: 240px; height: 480px; border: 12px solid var(--text); border-radius: 36px; background: var(--bg); margin: 0 auto; position: relative; box-shadow: 0 24px 60px rgba(0,0,0,0.18); }
  .phone-mockup::before { content: ""; position: absolute; top: 0; left: 50%; transform: translateX(-50%); width: 100px; height: 18px; background: var(--text); border-radius: 0 0 12px 12px; }` : "";
  return `:root {
    --primary: ${theme.primary};
    --accent: ${theme.accent};
    --bg: ${theme.bg};
    --text: ${theme.text};
    --card: ${lighten(theme.bg, 0.02)};
    --muted: ${darken(theme.text, 0.4)};
    --radius: ${theme.radius}px;
    --font: ${theme.font};
  }
  * { box-sizing: border-box; }
  html { scroll-behavior: smooth; }
  body { margin: 0; font-family: var(--font); color: var(--text); background: var(--bg); line-height: 1.6; }
  a { color: var(--primary); text-decoration: none; }
  a:hover { text-decoration: underline; }
  .container { max-width: 1080px; margin: 0 auto; padding: 0 20px; }
  header { position: sticky; top: 0; z-index: 10; background: var(--bg); border-bottom: 1px solid var(--muted); }
  .nav { display: flex; align-items: center; justify-content: space-between; padding: 14px 0; }
  .nav .brand { font-weight: 700; font-size: 18px; color: var(--text); }
  .nav .links a { margin-left: 18px; color: var(--text); }
  .nav .links a:hover { color: var(--primary); }
  .skip-link { position: absolute; left: -999px; top: 0; background: var(--primary); color: #fff; padding: 8px 16px; z-index: 100; }
  .skip-link:focus { left: 8px; top: 8px; }
  .hero { padding: 64px 0; text-align: center; background: linear-gradient(135deg, ${theme.primary}15, ${theme.accent}15); }
  .hero h1 { font-size: clamp(28px, 5vw, 48px); margin: 0 0 16px; }
  .hero p { font-size: clamp(16px, 2.5vw, 20px); color: var(--muted); max-width: 640px; margin: 0 auto 24px; }
  .btn { display: inline-block; padding: 12px 24px; border-radius: var(--radius); font-weight: 600; font-size: 16px; cursor: pointer; border: 0; transition: transform 0.1s; }
  .btn:hover { transform: translateY(-1px); text-decoration: none; }
  .btn-primary { background: var(--primary); color: #fff; }
  .btn-secondary { background: transparent; color: var(--primary); border: 2px solid var(--primary); }
  section { padding: 56px 0; }
  section h2 { font-size: clamp(24px, 3.5vw, 32px); margin: 0 0 24px; text-align: center; }
  .grid { display: grid; gap: 24px; }
  .grid-2 { grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); }
  .grid-3 { grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
  .card { background: var(--card); border-radius: var(--radius); padding: 24px; border: 1px solid var(--muted); }
  .card .icon { font-size: 28px; margin-bottom: 12px; display: block; }
  .card h3 { margin: 0 0 8px; font-size: 18px; }
  .card p { margin: 0; color: var(--muted); font-size: 14px; }
  .pricing-card { text-align: center; }
  .pricing-card.highlighted { border: 2px solid var(--primary); position: relative; }
  .pricing-card .price { font-size: 36px; font-weight: 700; margin: 12px 0; }
  .pricing-card ul { list-style: none; padding: 0; margin: 16px 0; }
  .pricing-card li { padding: 6px 0; color: var(--muted); }
  .testimonial { background: var(--card); border-radius: var(--radius); padding: 24px; border: 1px solid var(--muted); }
  .testimonial blockquote { margin: 0 0 12px; font-style: italic; }
  .testimonial .author { font-weight: 600; }
  .testimonial .role { color: var(--muted); font-size: 13px; }
  .faq details { background: var(--card); border: 1px solid var(--muted); border-radius: var(--radius); padding: 16px; margin-bottom: 12px; }
  .faq summary { font-weight: 600; cursor: pointer; }
  .faq p { margin: 12px 0 0; color: var(--muted); }
  .schedule-item { display: grid; grid-template-columns: 120px 1fr; gap: 16px; padding: 12px 0; border-bottom: 1px solid var(--muted); }
  .schedule-item:last-child { border-bottom: 0; }
  .schedule-item .time { font-weight: 600; color: var(--primary); }
  .project { background: var(--card); border-radius: var(--radius); padding: 24px; border: 1px solid var(--muted); }
  .project h3 { margin: 0 0 8px; }
  .project .tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
  .project .tag { background: ${theme.primary}15; color: var(--primary); padding: 4px 10px; border-radius: 999px; font-size: 12px; }
  .cta { background: linear-gradient(135deg, var(--primary), var(--accent)); color: #fff; padding: 64px 0; text-align: center; }
  .cta h2 { color: #fff; }
  .cta p { color: rgba(255,255,255,0.85); max-width: 560px; margin: 0 auto 24px; }
  .cta .btn-primary { background: #fff; color: var(--primary); }
  footer { padding: 32px 0; border-top: 1px solid var(--muted); color: var(--muted); font-size: 14px; }
  .footer-grid { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 16px; }${theme.darkMode ? "\n  .theme-toggle { background: var(--card); border: 1px solid var(--muted); border-radius: 999px; padding: 6px 12px; cursor: pointer; font-size: 13px; }" : ""}${templateExtras}${darkCss}
  @media (max-width: 640px) {
    .nav .links { display: none; }
    .schedule-item { grid-template-columns: 1fr; }
  }`;
}

// Color helpers (rough)

function clamp(n: number): number { return Math.max(0, Math.min(255, Math.round(n))); }

function parseHex(hex: string): [number, number, number] {
  const h = (hex || "#000000").replace("#", "");
  if (h.length === 3) {
    return [parseInt(h[0] + h[0], 16), parseInt(h[1] + h[1], 16), parseInt(h[2] + h[2], 16)];
  }
  return [parseInt(h.slice(0, 2), 16) || 0, parseInt(h.slice(2, 4), 16) || 0, parseInt(h.slice(4, 6), 16) || 0];
}

function toHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map((n) => clamp(n).toString(16).padStart(2, "0")).join("");
}

/** Darken a hex color by `amount` (0..1). */
export function darken(hex: string, amount = 0.2): string {
  const [r, g, b] = parseHex(hex);
  return toHex(r * (1 - amount), g * (1 - amount), b * (1 - amount));
}

/** Lighten a hex color by `amount` (0..1). */
export function lighten(hex: string, amount = 0.2): string {
  const [r, g, b] = parseHex(hex);
  return toHex(r + (255 - r) * amount, g + (255 - g) * amount, b + (255 - b) * amount);
}

// ---------- Section builders ----------

function buildSkipLink(): string {
  return '<a href="#main" class="skip-link">Skip to content</a>';
}

function buildHeader(inputs: LandingInputs): string {
  const links: string[] = [];
  if (inputs.sections.features) links.push('<a href="#features">Features</a>');
  if (inputs.sections.pricing) links.push('<a href="#pricing">Pricing</a>');
  if (inputs.sections.testimonials) links.push('<a href="#testimonials">Testimonials</a>');
  if (inputs.sections.schedule) links.push('<a href="#schedule">Schedule</a>');
  if (inputs.sections.projects) links.push('<a href="#projects">Projects</a>');
  if (inputs.sections.faq) links.push('<a href="#faq">FAQ</a>');
  const toggle = inputs.theme.darkMode
    ? '<button class="theme-toggle" type="button" aria-label="Toggle dark mode" onclick="document.documentElement.dataset.theme=document.documentElement.dataset.theme===\'dark\'?\'\':\'dark\'">◐</button>'
    : "";
  return `<header>
  <div class="container nav">
    <a href="#" class="brand">${escapeHtml(inputs.businessName || "Brand")}</a>
    <div class="links">
      ${links.join("\n      ")}
    </div>
    ${toggle}
  </div>
</header>`;
}

function buildHero(inputs: LandingInputs): string {
  const phoneMockup = inputs.template === "app"
    ? `<div class="phone-mockup" aria-hidden="true"></div>`
    : "";
  const secondary = inputs.ctaSecondary
    ? `<a href="#cta" class="btn btn-secondary">${escapeHtml(inputs.ctaSecondary)}</a>`
    : "";
  const dateLine = inputs.template === "event" && inputs.schedule.length > 0
    ? `<p style="font-weight:600;color:var(--primary)">${escapeHtml(inputs.schedule[0].time)}</p>`
    : "";
  return `<section class="hero" id="home">
  <div class="container">
    <h1>${escapeHtml(inputs.tagline || inputs.businessName || "Welcome")}</h1>
    ${dateLine}
    <p>${escapeHtml(inputs.description || "")}</p>
    <a href="#cta" class="btn btn-primary">${escapeHtml(inputs.cta || "Get Started")}</a>
    ${secondary}
    ${phoneMockup}
  </div>
</section>`;
}

function buildFeatures(inputs: LandingInputs): string {
  if (!inputs.sections.features || inputs.features.length === 0) return "";
  const cards = inputs.features.map((f) => `      <div class="card">
        <span class="icon" aria-hidden="true">${escapeHtml(f.icon || "★")}</span>
        <h3>${escapeHtml(f.title)}</h3>
        <p>${escapeHtml(f.description)}</p>
      </div>`).join("\n");
  return `<section id="features">
  <div class="container">
    <h2>Features</h2>
    <div class="grid grid-3">
${cards}
    </div>
  </div>
</section>`;
}

function buildTestimonials(inputs: LandingInputs): string {
  if (!inputs.sections.testimonials || inputs.testimonials.length === 0) return "";
  const cards = inputs.testimonials.map((t) => `      <div class="testimonial">
        <blockquote>"${escapeHtml(t.quote)}"</blockquote>
        <div class="author">${escapeHtml(t.author)}</div>
        ${t.role ? `<div class="role">${escapeHtml(t.role)}</div>` : ""}
      </div>`).join("\n");
  return `<section id="testimonials">
  <div class="container">
    <h2>What people say</h2>
    <div class="grid grid-2">
${cards}
    </div>
  </div>
</section>`;
}

function buildPricing(inputs: LandingInputs): string {
  if (!inputs.sections.pricing || inputs.pricing.length === 0) return "";
  const cards = inputs.pricing.map((p) => `      <div class="card pricing-card${p.highlighted ? " highlighted" : ""}">
        <h3>${escapeHtml(p.name)}</h3>
        <div class="price">${escapeHtml(p.price)}${p.period ? `<span style="font-size:14px;color:var(--muted)">/${escapeHtml(p.period)}</span>` : ""}</div>
        <ul>
          ${p.features.map((f) => `<li>${escapeHtml(f)}</li>`).join("\n          ")}
        </ul>
        <a href="#cta" class="btn btn-primary">${escapeHtml(p.cta || "Choose")}</a>
      </div>`).join("\n");
  return `<section id="pricing">
  <div class="container">
    <h2>Pricing</h2>
    <div class="grid grid-3">
${cards}
    </div>
  </div>
</section>`;
}

function buildFaq(inputs: LandingInputs): string {
  if (!inputs.sections.faq || inputs.faqs.length === 0) return "";
  const items = inputs.faqs.map((f) => `      <details>
        <summary>${escapeHtml(f.q)}</summary>
        <p>${escapeHtml(f.a)}</p>
      </details>`).join("\n");
  return `<section id="faq" class="faq">
  <div class="container">
    <h2>Frequently asked questions</h2>
${items}
  </div>
</section>`;
}

function buildSchedule(inputs: LandingInputs): string {
  if (!inputs.sections.schedule || inputs.schedule.length === 0) return "";
  const items = inputs.schedule.map((s) => `      <div class="schedule-item">
        <div class="time">${escapeHtml(s.time)}</div>
        <div>
          <div style="font-weight:600">${escapeHtml(s.title)}</div>
          ${s.speaker ? `<div style="color:var(--muted);font-size:14px">${escapeHtml(s.speaker)}</div>` : ""}
        </div>
      </div>`).join("\n");
  return `<section id="schedule">
  <div class="container">
    <h2>Schedule</h2>
${items}
  </div>
</section>`;
}

function buildProjects(inputs: LandingInputs): string {
  if (!inputs.sections.projects || inputs.projects.length === 0) return "";
  const cards = inputs.projects.map((p) => `      <div class="project">
        <h3>${p.url ? `<a href="${escapeHtml(p.url)}">${escapeHtml(p.title)}</a>` : escapeHtml(p.title)}</h3>
        <p style="color:var(--muted)">${escapeHtml(p.description)}</p>
        ${p.tags && p.tags.length > 0 ? `<div class="tags">${p.tags.map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join("")}</div>` : ""}
      </div>`).join("\n");
  return `<section id="projects">
  <div class="container">
    <h2>Projects</h2>
    <div class="grid grid-2">
${cards}
    </div>
  </div>
</section>`;
}

function buildCta(inputs: LandingInputs): string {
  return `<section class="cta" id="cta">
  <div class="container">
    <h2>${escapeHtml(inputs.cta || "Get started today")}</h2>
    <p>${escapeHtml(inputs.description || "")}</p>
    <a href="#" class="btn btn-primary">${escapeHtml(inputs.cta || "Get Started")}</a>
  </div>
</section>`;
}

function buildFooter(inputs: LandingInputs): string {
  const social: string[] = [];
  if (inputs.social.twitter) social.push(`<a href="${escapeHtml(inputs.social.twitter)}">Twitter</a>`);
  if (inputs.social.github) social.push(`<a href="${escapeHtml(inputs.social.github)}">GitHub</a>`);
  if (inputs.social.linkedin) social.push(`<a href="${escapeHtml(inputs.social.linkedin)}">LinkedIn</a>`);
  return `<footer>
  <div class="container footer-grid">
    <div>
      <div style="font-weight:700;color:var(--text)">${escapeHtml(inputs.businessName || "Brand")}</div>
      ${inputs.email ? `<div><a href="mailto:${escapeHtml(inputs.email)}">${escapeHtml(inputs.email)}</a></div>` : ""}
    </div>
    <div>
      ${social.join(" · ")}
    </div>
    <div>© ${new Date().getFullYear()} ${escapeHtml(inputs.businessName || "Brand")}. All rights reserved.</div>
  </div>
</footer>`;
}

// ---------- SEO meta ----------

export function buildSeoMeta(inputs: LandingInputs): string {
  const title = inputs.businessName ? `${inputs.businessName} — ${inputs.tagline || "Home"}` : "Landing Page";
  const description = inputs.description || inputs.tagline || "";
  const lines: string[] = [
    "<title>" + escapeHtml(title) + "</title>",
    '<meta name="description" content="' + escapeHtml(description) + '">',
    '<meta name="keywords" content="' + escapeHtml([inputs.businessName, inputs.tagline].filter(Boolean).join(", ")) + '">',
    '<link rel="canonical" href="' + escapeHtml(inputs.url || "#") + '">',
    '<meta property="og:type" content="website">',
    '<meta property="og:title" content="' + escapeHtml(title) + '">',
    '<meta property="og:description" content="' + escapeHtml(description) + '">',
    '<meta property="og:site_name" content="' + escapeHtml(inputs.businessName || "") + '">',
    '<meta property="og:url" content="' + escapeHtml(inputs.url || "") + '">',
    '<meta name="twitter:card" content="summary">',
    '<meta name="twitter:title" content="' + escapeHtml(title) + '">',
    '<meta name="twitter:description" content="' + escapeHtml(description) + '">',
  ];
  return lines.join("\n  ");
}

export function buildJsonLd(inputs: LandingInputs): string {
  if (!inputs.sections.faq || inputs.faqs.length === 0) return "";
  const obj = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    name: inputs.businessName || "FAQ",
    mainEntity: inputs.faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
  // Escape `<` to \u003c so a `<script>` literal in user content cannot break out of the JSON-LD script element.
  return JSON.stringify(obj, null, 2).replace(/</g, "\\u003c");
}

// ---------- A11y report ----------

export function computeA11y(html: string): A11yReport {
  const issues: string[] = [];
  const hasLang = /<html[^>]*\blang=/.test(html);
  const hasViewport = /<meta[^>]*name=["']viewport["']/.test(html);
  const hasSkipLink = /class=["'][^"']*skip-link/.test(html);
  const hasAltText = !/<img(?![^>]*\balt=)/i.test(html); // no img without alt
  const hasSemanticLandmarks = /<header[\s>]/.test(html) && /<main[\s>]/.test(html) && /<footer[\s>]/.test(html);
  const hasAriaLabels = /aria-label=/.test(html);
  if (!hasLang) issues.push("Missing lang attribute on <html>");
  if (!hasViewport) issues.push("Missing viewport meta tag");
  if (!hasSkipLink) issues.push("Missing skip-to-content link");
  if (!hasSemanticLandmarks) issues.push("Missing semantic landmarks (header/main/footer)");
  if (!hasAriaLabels) issues.push("Interactive elements may need aria-labels");
  return { hasLang, hasViewport, hasSkipLink, hasAltText, hasSemanticLandmarks, hasAriaLabels, issues };
}

// ---------- Page assembly ----------

/** Build the complete HTML document. */
export function buildPage(inputs: LandingInputs): GeneratedPage {
  const id = genId();
  const sections: string[] = [];
  sections.push(buildSkipLink());
  sections.push(buildHeader(inputs));
  sections.push('<main id="main">');
  sections.push(buildHero(inputs));
  if (inputs.template === "event") {
    const s = buildSchedule(inputs);
    if (s) sections.push(s);
  }
  if (inputs.template === "portfolio") {
    const p = buildProjects(inputs);
    if (p) sections.push(p);
  }
  const f = buildFeatures(inputs);
  if (f) sections.push(f);
  const t = buildTestimonials(inputs);
  if (t) sections.push(t);
  const p = buildPricing(inputs);
  if (p) sections.push(p);
  const faq = buildFaq(inputs);
  if (faq) sections.push(faq);
  sections.push(buildCta(inputs));
  sections.push("</main>");
  sections.push(buildFooter(inputs));

  const css = buildCss(inputs.theme, inputs.template);
  const seoMeta = buildSeoMeta(inputs);
  const jsonLd = buildJsonLd(inputs);
  const lang = "en";

  const html = `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  ${seoMeta}
  ${jsonLd ? `<script type="application/ld+json">\n${jsonLd}\n  </script>` : ""}
  <style>
${css}
  </style>
</head>
<body>
${sections.join("\n")}
</body>
</html>`;

  const a11y = computeA11y(html);
  const warnings: string[] = [];
  if (inputs.features.length === 0 && inputs.sections.features) {
    warnings.push("Features section is enabled but no features were provided — section was skipped.");
  }
  if (inputs.testimonials.length === 0 && inputs.sections.testimonials) {
    warnings.push("Testimonials section is enabled but no testimonials were provided — section was skipped.");
  }
  if (inputs.pricing.length === 0 && inputs.sections.pricing) {
    warnings.push("Pricing section is enabled but no pricing tiers were provided — section was skipped.");
  }
  if (inputs.faqs.length === 0 && inputs.sections.faq) {
    warnings.push("FAQ section is enabled but no FAQs were provided — section was skipped (and no JSON-LD was generated).");
  }

  // Count sections actually present
  const sectionCount = (html.match(/<section[\s>]/g) ?? []).length;

  return {
    id,
    template: inputs.template,
    html,
    css,
    bytes: html.length,
    sectionCount,
    hasSeoMeta: /<title>/.test(html) && /<meta name="description"/.test(html),
    hasOpenGraph: /property="og:title"/.test(html),
    hasTwitterCard: /name="twitter:card"/.test(html),
    hasJsonLd: /application\/ld\+json/.test(html),
    hasDarkMode: inputs.theme.darkMode,
    a11y,
    warnings,
  };
}

/** Build a sandboxed srcdoc for an iframe preview. */
export function buildPreviewSrcDoc(page: GeneratedPage): string {
  return page.html;
}

// ---------- Renderers ----------

/** Render the page as React/JSX-like component (string). Best-effort — for users who want to drop into a React app. */
export function toReactComponent(page: GeneratedPage): string {
  // Strip DOCTYPE and outer html/head/body, convert class→className, replace <style> with a comment.
  let body = page.html
    .replace(/<!DOCTYPE html>\s*/, "")
    .replace(/<html[^>]*>/, "")
    .replace(/<\/html>/, "")
    .replace(/<head>[\s\S]*?<\/head>/, "{/* head tags omitted — paste into your <head> */}")
    .replace(/<body>/, "")
    .replace(/<\/body>/, "")
    .replace(/\bclass=/g, "className=")
    .replace(/<style>[\s\S]*?<\/style>/, "{/* paste CSS into a CSS module or styled-components */}")
    .replace(/for=/g, "htmlFor=");
  return `export default function LandingPage() {\n  return (\n    ${body.trim().split("\n").map((l) => "    " + l).join("\n")}\n  );\n}`;
}

/** Render the page as plain text (strip tags) — for quick copy. */
export function renderPlainText(page: GeneratedPage): string {
  return page.html
    .replace(/<style>[\s\S]*?<\/style>/g, "")
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ---------- History (localStorage) ----------

export function loadHistory(): HistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(arr) ? arr.slice(0, HISTORY_MAX) : [];
  } catch {
    return [];
  }
}

export function saveHistory(entry: HistoryEntry): HistoryEntry[] {
  const next = [entry, ...loadHistory()].slice(0, HISTORY_MAX);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}

export function clearHistory(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    // ignore
  }
}

// ---------- Shareable URL ----------

export function buildShareUrl(state: ShareState): string {
  const params = new URLSearchParams();
  // Compact representation: only non-default fields
  const i = state.inputs;
  params.set("t", i.template);
  if (i.businessName) params.set("b", i.businessName);
  if (i.tagline) params.set("tg", i.tagline);
  if (i.description) params.set("d", i.description);
  if (i.cta) params.set("c", i.cta);
  if (i.ctaSecondary) params.set("cs", i.ctaSecondary);
  if (i.url) params.set("u", i.url);
  if (i.email) params.set("e", i.email);
  if (i.theme.primary !== DEFAULT_THEME.primary) params.set("p", i.theme.primary);
  if (i.theme.accent !== DEFAULT_THEME.accent) params.set("a", i.theme.accent);
  if (i.theme.radius !== DEFAULT_THEME.radius) params.set("r", String(i.theme.radius));
  if (i.theme.darkMode !== DEFAULT_THEME.darkMode) params.set("dm", i.theme.darkMode ? "1" : "0");
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<ShareState["inputs"]> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Partial<ShareState["inputs"]> = {};
  const t = params.get("t") as TemplateId | null;
  if (t && ["saas", "app", "product", "event", "portfolio"].includes(t)) out.template = t;
  if (params.get("b")) out.businessName = params.get("b")!;
  if (params.get("tg")) out.tagline = params.get("tg")!;
  if (params.get("d")) out.description = params.get("d")!;
  if (params.get("c")) out.cta = params.get("c")!;
  if (params.get("cs")) out.ctaSecondary = params.get("cs")!;
  if (params.get("u")) out.url = params.get("u")!;
  if (params.get("e")) out.email = params.get("e")!;
  const theme: Partial<Theme> = {};
  if (params.get("p")) theme.primary = params.get("p")!;
  if (params.get("a")) theme.accent = params.get("a")!;
  if (params.get("r")) {
    const n = Number.parseInt(params.get("r")!, 10);
    if (Number.isFinite(n) && n >= 0 && n <= 48) theme.radius = n;
  }
  if (params.get("dm")) theme.darkMode = params.get("dm") === "1";
  if (Object.keys(theme).length > 0) out.theme = { ...DEFAULT_THEME, ...theme } as Theme;
  return out;
}

// ---------- Optional LLM prompt builder ----------

export function buildLlmPrompt(inputs: LandingInputs): LlmPrompt {
  const system = [
    "You are a senior front-end engineer who writes clean, accessible, responsive landing pages.",
    "Output a single self-contained HTML file with inline CSS — no external resources, no JavaScript frameworks.",
    "Include semantic HTML5 landmarks, SEO meta tags, Open Graph tags, and JSON-LD FAQPage schema when FAQ content is provided.",
    "Use the provided theme colors and font. Return ONLY the HTML code — no commentary, no markdown fences.",
  ].join(" ");
  const user = [
    `Template: ${TEMPLATE_LABELS[inputs.template]}`,
    `Business name: ${inputs.businessName || "(none)"}`,
    `Tagline: ${inputs.tagline || "(none)"}`,
    `Description: ${inputs.description || "(none)"}`,
    `Primary CTA: ${inputs.cta || "(none)"}`,
    inputs.features.length > 0 ? `Features:\n${inputs.features.map((f) => `- ${f.title}: ${f.description}`).join("\n")}` : "",
    inputs.testimonials.length > 0 ? `Testimonials:\n${inputs.testimonials.map((t) => `- ${t.author} (${t.role}): "${t.quote}"`).join("\n")}` : "",
    inputs.pricing.length > 0 ? `Pricing:\n${inputs.pricing.map((p) => `- ${p.name}: ${p.price}/${p.period ?? "mo"} — ${p.features.join(", ")}`).join("\n")}` : "",
    inputs.faqs.length > 0 ? `FAQs:\n${inputs.faqs.map((f) => `- Q: ${f.q}\n  A: ${f.a}`).join("\n")}` : "",
    `Theme: primary=${inputs.theme.primary}, accent=${inputs.theme.accent}, radius=${inputs.theme.radius}px, font=${inputs.theme.font}, darkMode=${inputs.theme.darkMode}`,
    "Generate the complete HTML page now.",
  ].filter(Boolean).join("\n\n");
  return { system, user };
}

/** Parse a raw LLM response — returns the HTML body (strips markdown fences if present). */
export function renderLlmResult(raw: string): string {
  let out = (raw || "").trim();
  // Strip ```html fences
  out = out.replace(/^```(?:html)?\s*\n?/i, "").replace(/\n?```\s*$/i, "");
  return out.trim();
}
