/**
 * AI CSS UI Component Generator — pure logic.
 *
 * Describe a UI component in plain English; the engine matches keywords
 * against a built-in template library and renders clean, responsive HTML +
 * CSS, Tailwind, or inline-styled markup. Pure functions only — no DOM, no
 * network. The optional LLM call (BYO API key) lives in ui.tsx.
 */

// ---------- Types ----------

export type ComponentType =
  | "button"
  | "card"
  | "modal"
  | "navbar"
  | "form"
  | "alert"
  | "badge"
  | "dropdown"
  | "tabs"
  | "hero"
  | "footer"
  | "accordion"
  | "tooltip"
  | "progress"
  | "input";

export type OutputTarget = "vanilla" | "tailwind" | "inline";
export type Variant = "primary" | "secondary" | "outline" | "ghost" | "destructive" | "gradient";

export interface Theme {
  primary: string;       // hex
  radius: number;        // px
  font: string;          // CSS font-family
  dark: boolean;
}

export interface GeneratedComponent {
  id: string;
  type: ComponentType;
  variant: Variant;
  target: OutputTarget;
  confidence: number;    // 0-100 keyword match confidence
  html: string;
  css: string;           // empty for inline/tailwind (classes embedded in html)
  tailwind: string;      // tailwind version (same as html for tailwind target)
  a11y: A11yReport;
  score: number;         // 0-100
  keywords: string[];
}

export interface A11yReport {
  hasAriaLabel: boolean;
  hasSemanticHtml: boolean;
  hasAltText: boolean;
  contrastOk: boolean;
  issues: string[];
}

export interface ComponentStats {
  type: ComponentType;
  count: number;
  avgScore: number;
}

export interface RefinementMod {
  mods: string[];
  makeDark: boolean;
  makeLight: boolean;
  addShadow: boolean;
  rounded: boolean;
  smaller: boolean;
  larger: boolean;
}

// ---------- Constants ----------

export const HISTORY_KEY = "unqtools:ai-css-ui-comp:history";
export const HISTORY_MAX = 20;
export const FAVES_KEY = "unqtools:ai-css-ui-comp:faves";

export const TYPE_LABELS: Record<ComponentType, string> = {
  button: "Button",
  card: "Card",
  modal: "Modal dialog",
  navbar: "Navbar",
  form: "Form",
  alert: "Alert / Banner",
  badge: "Badge",
  dropdown: "Dropdown menu",
  tabs: "Tabs",
  hero: "Hero section",
  footer: "Footer",
  accordion: "Accordion",
  tooltip: "Tooltip",
  progress: "Progress bar",
  input: "Input field",
};

export const TARGET_LABELS: Record<OutputTarget, string> = {
  vanilla: "Vanilla HTML + CSS",
  tailwind: "Tailwind utility classes",
  inline: "Inline-styled HTML",
};

export const VARIANT_LABELS: Record<Variant, string> = {
  primary: "Primary",
  secondary: "Secondary",
  outline: "Outline",
  ghost: "Ghost",
  destructive: "Destructive",
  gradient: "Gradient",
};

export const FONT_PRESETS: string[] = [
  "system-ui, -apple-system, sans-serif",
  "'Inter', system-ui, sans-serif",
  "'Helvetica Neue', Arial, sans-serif",
  "Georgia, 'Times New Roman', serif",
  "'Courier New', monospace",
  "'Comic Sans MS', cursive",
];

export const COMPONENT_PRESETS: string[] = [
  "pricing card with toggle",
  "navbar with search and dark mode",
  "hero section with CTA button",
  "login form with email and password",
  "success alert banner",
  "gradient button",
  "modal dialog with close button",
  "tabs with three sections",
  "footer with social links",
  "accordion with FAQ items",
  "progress bar at 60 percent",
  "dropdown menu with icons",
  "card with image and title",
  "tooltip on hover",
  "outline input with label",
];

// Keyword → component-type matcher (lowercased)
export const KEYWORD_MAP: Record<ComponentType, string[]> = {
  button: ["button", "btn", "cta button", "action button", "click", "submit button"],
  card: ["card", "pricing card", "product card", "tile", "panel"],
  modal: ["modal", "dialog", "popup", "overlay", "lightbox"],
  navbar: ["navbar", "nav", "header", "menu bar", "top bar", "navigation"],
  form: ["form", "login form", "signup form", "contact form", "register"],
  alert: ["alert", "banner", "notice", "warning", "toast", "notification"],
  badge: ["badge", "tag", "pill", "label", "chip"],
  dropdown: ["dropdown", "drop-down", "select menu", "context menu", "menu"],
  tabs: ["tabs", "tabbed", "tabbed interface", "section tabs"],
  hero: ["hero", "hero section", "landing", "jumbotron", "cover"],
  footer: ["footer", "bottom bar", "page footer"],
  accordion: ["accordion", "collapsible", "expandable", "faq"],
  tooltip: ["tooltip", "hint", "popover", "info bubble"],
  progress: ["progress", "progress bar", "loader", "meter", "loading bar"],
  input: ["input", "text field", "input field", "textbox", "search box"],
};

// ---------- Utilities ----------

const STOPWORDS = new Set([
  "the", "a", "an", "of", "in", "on", "at", "to", "for", "with", "and", "or",
  "is", "are", "be", "by", "as", "from", "that", "this", "it", "its", "into",
  "make", "add", "give", "need", "want", "please", "me", "i", "we", "you",
  "show", "build", "create", "generate", "design", "with", "have", "has",
]);

/** Lowercase + collapse whitespace. */
export function normalizeDescription(s: string): string {
  return (s || "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** Tokenize a description into lowercase words (length >= 2, no stopwords). */
export function tokenize(s: string): string[] {
  const n = normalizeDescription(s);
  if (!n) return [];
  return n
    .split(/[^a-z0-9-]+/i)
    .filter((w) => w.length >= 2 && !STOPWORDS.has(w));
}

/** Extract meaningful keywords (single words + 2-grams). */
export function extractKeywords(s: string): string[] {
  const tokens = tokenize(s);
  if (tokens.length === 0) return [];
  const out: string[] = [...tokens];
  for (let i = 0; i < tokens.length - 1; i++) {
    out.push(`${tokens[i]} ${tokens[i + 1]}`);
  }
  return out;
}

/** Deterministic hash for ids. */
function simpleHash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) ^ s.charCodeAt(i);
    h = h >>> 0;
  }
  return h;
}

function makeId(type: ComponentType, variant: Variant, target: OutputTarget, idx: number): string {
  return `c-${simpleHash(`${type}|${variant}|${target}|${idx}`).toString(36)}`;
}

// ---------- Component-type matcher ----------

/** Match a description to a component type, returning confidence 0-100. */
export function matchComponentType(description: string): { type: ComponentType; confidence: number; matched: string[] } {
  const n = normalizeDescription(description);
  if (!n) return { type: "card", confidence: 0, matched: [] };
  const keywords = extractKeywords(description);
  const scores: Record<ComponentType, number> = {
    button: 0, card: 0, modal: 0, navbar: 0, form: 0, alert: 0, badge: 0,
    dropdown: 0, tabs: 0, hero: 0, footer: 0, accordion: 0, tooltip: 0,
    progress: 0, input: 0,
  };
  const matchedByType: Record<ComponentType, string[]> = {
    button: [], card: [], modal: [], navbar: [], form: [], alert: [], badge: [],
    dropdown: [], tabs: [], hero: [], footer: [], accordion: [], tooltip: [],
    progress: [], input: [],
  };
  for (const t of Object.keys(KEYWORD_MAP) as ComponentType[]) {
    for (const kw of KEYWORD_MAP[t]) {
      if (n.includes(kw)) {
        scores[t] += kw.includes(" ") ? 3 : 2;
        matchedByType[t].push(kw);
      }
    }
  }
  // Pick highest
  let best: ComponentType = "card";
  let bestScore = 0;
  for (const t of Object.keys(scores) as ComponentType[]) {
    if (scores[t] > bestScore) { bestScore = scores[t]; best = t; }
  }
  const confidence = bestScore === 0 ? 25 : Math.min(100, 50 + bestScore * 7);
  return { type: best, confidence, matched: matchedByType[best] };
}

// ---------- Theme helpers ----------

export const DEFAULT_THEME: Theme = {
  primary: "#4f46e5",
  radius: 8,
  font: "system-ui, -apple-system, sans-serif",
  dark: false,
};

/** Compute a readable text color (black or white) for a given hex background. */
export function readableTextOn(hex: string): string {
  const m = /^#?([a-f0-9]{6})$/i.exec(hex.trim());
  if (!m) return "#ffffff";
  const r = parseInt(m[1].slice(0, 2), 16);
  const g = parseInt(m[1].slice(2, 4), 16);
  const b = parseInt(m[1].slice(4, 6), 16);
  // YIQ contrast
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 140 ? "#111827" : "#ffffff";
}

/** Lighten/darken a hex color by a percentage (-100 to 100). */
export function shade(hex: string, percent: number): string {
  const m = /^#?([a-f0-9]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  let r = parseInt(m[1].slice(0, 2), 16);
  let g = parseInt(m[1].slice(2, 4), 16);
  let b = parseInt(m[1].slice(4, 6), 16);
  const t = percent < 0 ? 0 : 255;
  const p = Math.abs(percent) / 100;
  r = Math.round((t - r) * p) + r;
  g = Math.round((t - g) * p) + g;
  b = Math.round((t - b) * p) + b;
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/** Check WCAG-ish contrast between two hex colors. */
export function contrastOk(fg: string, bg: string): boolean {
  const lum = (hex: string): number => {
    const m = /^#?([a-f0-9]{6})$/i.exec(hex.trim());
    if (!m) return 0;
    const r = parseInt(m[1].slice(0, 2), 16) / 255;
    const g = parseInt(m[1].slice(2, 4), 16) / 255;
    const b = parseInt(m[1].slice(4, 6), 16) / 255;
    const f = (v: number) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const l1 = lum(fg);
  const l2 = lum(bg);
  const [bright, dark] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (bright + 0.05) / (dark + 0.05) >= 4.5;
}

// ---------- Component template library ----------

interface TemplateContext {
  theme: Theme;
  variant: Variant;
  text: string;
}

interface ComponentTemplate {
  html: (ctx: TemplateContext) => string;
  css: (ctx: TemplateContext) => string;
  tailwind: (ctx: TemplateContext) => string;
  a11y: (ctx: TemplateContext) => A11yReport;
  variants: Variant[];
}

function variantColor(variant: Variant, theme: Theme): { bg: string; text: string; border: string } {
  switch (variant) {
    case "primary":
      return { bg: theme.primary, text: readableTextOn(theme.primary), border: theme.primary };
    case "secondary":
      return { bg: shade(theme.primary, 80), text: theme.primary, border: shade(theme.primary, 30) };
    case "outline":
      return { bg: "transparent", text: theme.primary, border: theme.primary };
    case "ghost":
      return { bg: "transparent", text: theme.primary, border: "transparent" };
    case "destructive":
      return { bg: "#dc2626", text: "#ffffff", border: "#dc2626" };
    case "gradient":
      return { bg: theme.primary, text: readableTextOn(theme.primary), border: theme.primary };
    default:
      return { bg: theme.primary, text: readableTextOn(theme.primary), border: theme.primary };
  }
}

function radiusCss(theme: Theme): string {
  return `${theme.radius}px`;
}

function fontCss(theme: Theme): string {
  return theme.font;
}

function bgPage(theme: Theme): string {
  return theme.dark ? "#0f172a" : "#ffffff";
}
function textPage(theme: Theme): string {
  return theme.dark ? "#e5e7eb" : "#111827";
}
function mutedPage(theme: Theme): string {
  return theme.dark ? "#94a3b8" : "#6b7280";
}

const TEMPLATES: Record<ComponentType, ComponentTemplate> = {
  button: {
    variants: ["primary", "secondary", "outline", "ghost", "destructive", "gradient"],
    html: (ctx) => {
      const label = ctx.text || "Click me";
      return `<button class="uq-btn uq-btn--${ctx.variant}" type="button" aria-label="${escapeAttr(label)}">${escapeHtml(label)}</button>`;
    },
    css: (ctx) => {
      const c = variantColor(ctx.variant, ctx.theme);
      const bg = ctx.variant === "gradient"
        ? `background: linear-gradient(135deg, ${ctx.theme.primary}, ${shade(ctx.theme.primary, -25)});`
        : `background: ${c.bg};`;
      return [
        `.uq-btn { font-family: ${fontCss(ctx.theme)}; font-size: 14px; font-weight: 600; padding: 10px 18px; border: 1px solid ${c.border}; border-radius: ${radiusCss(ctx.theme)}; color: ${c.text}; cursor: pointer; transition: all .15s ease; }`,
        `.uq-btn--${ctx.variant} { ${bg} }`,
        `.uq-btn:hover { filter: brightness(0.95); transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.12); }`,
        `.uq-btn:focus-visible { outline: 2px solid ${ctx.theme.primary}; outline-offset: 2px; }`,
      ].join("\n");
    },
    tailwind: (ctx) => {
      const c = variantColor(ctx.variant, ctx.theme);
      const label = ctx.text || "Click me";
      const base = `inline-flex items-center justify-center font-semibold text-sm px-4 py-2 rounded transition hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2`;
      const styles: Record<Variant, string> = {
        primary: `text-[${c.text}] bg-[${c.bg}] border border-[${c.border}] shadow-sm hover:shadow-md`,
        secondary: `text-[${c.text}] bg-[${c.bg}] border border-[${c.border}]`,
        outline: `text-[${c.text}] bg-transparent border border-[${c.border}]`,
        ghost: `text-[${c.text}] bg-transparent`,
        destructive: `text-white bg-red-600 border border-red-600`,
        gradient: `text-[${c.text}] bg-gradient-to-br from-[${ctx.theme.primary}] to-[${shade(ctx.theme.primary, -25)}] border border-[${c.border}]`,
      };
      return `<button class="${base} ${styles[ctx.variant]}" type="button" aria-label="${escapeAttr(label)}">${escapeHtml(label)}</button>`;
    },
    a11y: (ctx) => {
      const label = ctx.text || "Click me";
      const issues: string[] = [];
      if (!label.trim()) issues.push("Button has no accessible label");
      const c = variantColor(ctx.variant, ctx.theme);
      const contrast = contrastOk(c.text, c.bg === "transparent" ? bgPage(ctx.theme) : c.bg);
      if (!contrast) issues.push("Text/background contrast below WCAG AA (4.5:1)");
      return {
        hasAriaLabel: !!label.trim(),
        hasSemanticHtml: true,
        hasAltText: true,
        contrastOk: contrast,
        issues,
      };
    },
  },
  card: {
    variants: ["primary", "secondary", "outline", "ghost"],
    html: (ctx) => {
      const title = ctx.text || "Card title";
      return `<div class="uq-card uq-card--${ctx.variant}" role="article">
  <div class="uq-card__body">
    <h3 class="uq-card__title">${escapeHtml(title)}</h3>
    <p class="uq-card__text">A short description that explains what this card is about and why it matters.</p>
    <button class="uq-card__btn" type="button">Learn more</button>
  </div>
</div>`;
    },
    css: (ctx) => {
      const c = variantColor(ctx.variant, ctx.theme);
      return [
        `.uq-card { font-family: ${fontCss(ctx.theme)}; background: ${bgPage(ctx.theme)}; color: ${textPage(ctx.theme)}; border: 1px solid ${ctx.variant === "outline" ? c.border : shade(ctx.theme.primary, 60)}; border-radius: ${radiusCss(ctx.theme)}; padding: 20px; max-width: 320px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }`,
        `.uq-card__title { margin: 0 0 8px; font-size: 18px; font-weight: 700; }`,
        `.uq-card__text { margin: 0 0 16px; color: ${mutedPage(ctx.theme)}; font-size: 14px; line-height: 1.5; }`,
        `.uq-card__btn { background: ${ctx.theme.primary}; color: ${readableTextOn(ctx.theme.primary)}; border: none; padding: 8px 14px; border-radius: ${radiusCss(ctx.theme)}; font-weight: 600; font-size: 13px; cursor: pointer; }`,
        `.uq-card__btn:hover { filter: brightness(0.95); }`,
      ].join("\n");
    },
    tailwind: (ctx) => {
      const title = ctx.text || "Card title";
      const cardBg = ctx.theme.dark ? "bg-slate-900" : "bg-white";
      const cardText = ctx.theme.dark ? "text-slate-200" : "text-gray-900";
      const mutedText = ctx.theme.dark ? "text-slate-400" : "text-gray-500";
      return `<div class="${cardBg} ${cardText} border border-[${shade(ctx.theme.primary, 60)}] rounded-[${ctx.theme.radius}px] p-5 max-w-sm shadow-sm" role="article">
  <h3 class="text-lg font-bold mb-2">${escapeHtml(title)}</h3>
  <p class="${mutedText} text-sm leading-relaxed mb-4">A short description that explains what this card is about and why it matters.</p>
  <button class="bg-[${ctx.theme.primary}] text-[${readableTextOn(ctx.theme.primary)}] px-3.5 py-2 rounded text-sm font-semibold hover:brightness-95" type="button">Learn more</button>
</div>`;
    },
    a11y: (ctx) => {
      const issues: string[] = [];
      const c = variantColor(ctx.variant, ctx.theme);
      const cardBg = ctx.variant === "ghost" ? bgPage(ctx.theme) : bgPage(ctx.theme);
      if (!contrastOk(textPage(ctx.theme), cardBg)) issues.push("Card text contrast below WCAG AA");
      if (!contrastOk(readableTextOn(ctx.theme.primary), ctx.theme.primary)) issues.push("Button text contrast low");
      return {
        hasAriaLabel: false,
        hasSemanticHtml: true,
        hasAltText: true,
        contrastOk: issues.length === 0,
        issues,
      };
    },
  },
  modal: {
    variants: ["primary", "secondary", "outline"],
    html: (ctx) => {
      const title = ctx.text || "Dialog title";
      return `<div class="uq-modal" role="dialog" aria-modal="true" aria-labelledby="uq-modal-title">
  <div class="uq-modal__backdrop"></div>
  <div class="uq-modal__panel">
    <h2 id="uq-modal-title" class="uq-modal__title">${escapeHtml(title)}</h2>
    <p class="uq-modal__text">Dialog body content goes here.</p>
    <div class="uq-modal__actions">
      <button class="uq-modal__btn uq-modal__btn--cancel" type="button">Cancel</button>
      <button class="uq-modal__btn uq-modal__btn--ok" type="button">Confirm</button>
    </div>
  </div>
</div>`;
    },
    css: (ctx) => {
      const c = variantColor(ctx.variant, ctx.theme);
      return [
        `.uq-modal { font-family: ${fontCss(ctx.theme)}; position: fixed; inset: 0; display: grid; place-items: center; }`,
        `.uq-modal__backdrop { position: absolute; inset: 0; background: rgba(0,0,0,0.5); }`,
        `.uq-modal__panel { position: relative; background: ${bgPage(ctx.theme)}; color: ${textPage(ctx.theme)}; border: 1px solid ${c.border}; border-radius: ${radiusCss(ctx.theme)}; padding: 24px; max-width: 420px; width: 90%; box-shadow: 0 20px 40px rgba(0,0,0,0.2); z-index: 1; }`,
        `.uq-modal__title { margin: 0 0 8px; font-size: 20px; font-weight: 700; }`,
        `.uq-modal__text { margin: 0 0 20px; color: ${mutedPage(ctx.theme)}; }`,
        `.uq-modal__actions { display: flex; justify-content: flex-end; gap: 8px; }`,
        `.uq-modal__btn { padding: 8px 16px; border-radius: ${radiusCss(ctx.theme)}; font-weight: 600; font-size: 13px; cursor: pointer; border: 1px solid transparent; }`,
        `.uq-modal__btn--cancel { background: transparent; color: ${mutedPage(ctx.theme)}; border-color: ${mutedPage(ctx.theme)}; }`,
        `.uq-modal__btn--ok { background: ${ctx.theme.primary}; color: ${readableTextOn(ctx.theme.primary)}; }`,
      ].join("\n");
    },
    tailwind: (ctx) => {
      const title = ctx.text || "Dialog title";
      const cardBg = ctx.theme.dark ? "bg-slate-900" : "bg-white";
      const cardText = ctx.theme.dark ? "text-slate-200" : "text-gray-900";
      const mutedText = ctx.theme.dark ? "text-slate-400" : "text-gray-500";
      return `<div class="fixed inset-0 grid place-items-center" role="dialog" aria-modal="true" aria-labelledby="uq-modal-title">
  <div class="absolute inset-0 bg-black/50"></div>
  <div class="relative ${cardBg} ${cardText} border border-[${variantColor(ctx.variant, ctx.theme).border}] rounded-[${ctx.theme.radius}px] p-6 max-w-md w-[90%] shadow-2xl z-10">
    <h2 id="uq-modal-title" class="text-xl font-bold mb-2">${escapeHtml(title)}</h2>
    <p class="${mutedText} mb-5">Dialog body content goes here.</p>
    <div class="flex justify-end gap-2">
      <button class="px-4 py-2 rounded text-sm font-semibold text-[${mutedPage(ctx.theme)}] border border-[${mutedPage(ctx.theme)}]" type="button">Cancel</button>
      <button class="px-4 py-2 rounded text-sm font-semibold bg-[${ctx.theme.primary}] text-[${readableTextOn(ctx.theme.primary)}]" type="button">Confirm</button>
    </div>
  </div>
</div>`;
    },
    a11y: (ctx) => ({
      hasAriaLabel: false,
      hasSemanticHtml: true,
      hasAltText: true,
      contrastOk: contrastOk(textPage(ctx.theme), bgPage(ctx.theme)),
      issues: [],
    }),
  },
  navbar: {
    variants: ["primary", "secondary", "outline"],
    html: (ctx) => {
      const brand = ctx.text || "Brand";
      return `<nav class="uq-nav" aria-label="Main navigation">
  <div class="uq-nav__brand">${escapeHtml(brand)}</div>
  <ul class="uq-nav__links">
    <li><a href="#home" class="uq-nav__link">Home</a></li>
    <li><a href="#features" class="uq-nav__link">Features</a></li>
    <li><a href="#pricing" class="uq-nav__link">Pricing</a></li>
    <li><a href="#contact" class="uq-nav__link">Contact</a></li>
  </ul>
  <button class="uq-nav__cta" type="button">Get started</button>
</nav>`;
    },
    css: (ctx) => {
      const c = variantColor(ctx.variant, ctx.theme);
      return [
        `.uq-nav { font-family: ${fontCss(ctx.theme)}; display: flex; align-items: center; justify-content: space-between; padding: 12px 24px; background: ${bgPage(ctx.theme)}; color: ${textPage(ctx.theme)}; border-bottom: 1px solid ${c.border}; }`,
        `.uq-nav__brand { font-weight: 800; font-size: 18px; color: ${ctx.theme.primary}; }`,
        `.uq-nav__links { display: flex; gap: 18px; list-style: none; margin: 0; padding: 0; }`,
        `.uq-nav__link { color: ${mutedPage(ctx.theme)}; text-decoration: none; font-size: 14px; font-weight: 500; }`,
        `.uq-nav__link:hover { color: ${ctx.theme.primary}; }`,
        `.uq-nav__cta { background: ${ctx.theme.primary}; color: ${readableTextOn(ctx.theme.primary)}; border: none; padding: 8px 16px; border-radius: ${radiusCss(ctx.theme)}; font-weight: 600; font-size: 13px; cursor: pointer; }`,
        `@media (max-width: 640px) { .uq-nav__links { display: none; } }`,
      ].join("\n");
    },
    tailwind: (ctx) => {
      const brand = ctx.text || "Brand";
      const cardBg = ctx.theme.dark ? "bg-slate-900" : "bg-white";
      const cardText = ctx.theme.dark ? "text-slate-200" : "text-gray-900";
      const mutedText = ctx.theme.dark ? "text-slate-400" : "text-gray-500";
      return `<nav class="flex items-center justify-between px-6 py-3 ${cardBg} ${cardText} border-b border-[${variantColor(ctx.variant, ctx.theme).border}]" aria-label="Main navigation">
  <div class="font-extrabold text-lg text-[${ctx.theme.primary}]">${escapeHtml(brand)}</div>
  <ul class="flex gap-4 list-none m-0 p-0 max-sm:hidden">
    <li><a href="#home" class="${mutedText} text-sm font-medium hover:text-[${ctx.theme.primary}] no-underline">Home</a></li>
    <li><a href="#features" class="${mutedText} text-sm font-medium hover:text-[${ctx.theme.primary}] no-underline">Features</a></li>
    <li><a href="#pricing" class="${mutedText} text-sm font-medium hover:text-[${ctx.theme.primary}] no-underline">Pricing</a></li>
    <li><a href="#contact" class="${mutedText} text-sm font-medium hover:text-[${ctx.theme.primary}] no-underline">Contact</a></li>
  </ul>
  <button class="bg-[${ctx.theme.primary}] text-[${readableTextOn(ctx.theme.primary)}] px-4 py-2 rounded text-sm font-semibold" type="button">Get started</button>
</nav>`;
    },
    a11y: (ctx) => ({
      hasAriaLabel: true,
      hasSemanticHtml: true,
      hasAltText: true,
      contrastOk: contrastOk(mutedPage(ctx.theme), bgPage(ctx.theme)),
      issues: [],
    }),
  },
  form: {
    variants: ["primary", "secondary", "outline"],
    html: (ctx) => {
      const action = ctx.text || "Submit";
      return `<form class="uq-form" onsubmit="return false;" aria-label="${escapeAttr(action)} form">
  <div class="uq-form__field">
    <label class="uq-form__label" for="uq-email">Email</label>
    <input class="uq-form__input" id="uq-email" type="email" required autocomplete="email" placeholder="you@example.com" />
  </div>
  <div class="uq-form__field">
    <label class="uq-form__label" for="uq-pwd">Password</label>
    <input class="uq-form__input" id="uq-pwd" type="password" required autocomplete="current-password" placeholder="••••••••" />
  </div>
  <button class="uq-form__submit" type="submit">${escapeHtml(action)}</button>
</form>`;
    },
    css: (ctx) => [
      `.uq-form { font-family: ${fontCss(ctx.theme)}; display: flex; flex-direction: column; gap: 14px; max-width: 320px; }`,
      `.uq-form__field { display: flex; flex-direction: column; gap: 6px; }`,
      `.uq-form__label { font-size: 13px; font-weight: 600; color: ${textPage(ctx.theme)}; }`,
      `.uq-form__input { font-family: inherit; font-size: 14px; padding: 10px 12px; border: 1px solid ${mutedPage(ctx.theme)}; border-radius: ${radiusCss(ctx.theme)}; background: ${bgPage(ctx.theme)}; color: ${textPage(ctx.theme)}; }`,
      `.uq-form__input:focus { outline: 2px solid ${ctx.theme.primary}; outline-offset: 1px; border-color: ${ctx.theme.primary}; }`,
      `.uq-form__submit { background: ${ctx.theme.primary}; color: ${readableTextOn(ctx.theme.primary)}; border: none; padding: 10px 16px; border-radius: ${radiusCss(ctx.theme)}; font-weight: 700; font-size: 14px; cursor: pointer; }`,
    ].join("\n"),
    tailwind: (ctx) => {
      const action = ctx.text || "Submit";
      const cardBg = ctx.theme.dark ? "bg-slate-900" : "bg-white";
      const cardText = ctx.theme.dark ? "text-slate-200" : "text-gray-900";
      return `<form class="flex flex-col gap-3.5 max-w-sm" onsubmit="return false;" aria-label="${escapeAttr(action)} form">
  <div class="flex flex-col gap-1.5">
    <label class="text-[13px] font-semibold ${cardText}" for="uq-email">Email</label>
    <input class="text-sm px-3 py-2.5 border border-[${mutedPage(ctx.theme)}] rounded-[${ctx.theme.radius}px] ${cardBg} ${cardText} focus:outline-none focus:ring-2 focus:ring-[${ctx.theme.primary}]" id="uq-email" type="email" required autocomplete="email" placeholder="you@example.com" />
  </div>
  <div class="flex flex-col gap-1.5">
    <label class="text-[13px] font-semibold ${cardText}" for="uq-pwd">Password</label>
    <input class="text-sm px-3 py-2.5 border border-[${mutedPage(ctx.theme)}] rounded-[${ctx.theme.radius}px] ${cardBg} ${cardText} focus:outline-none focus:ring-2 focus:ring-[${ctx.theme.primary}]" id="uq-pwd" type="password" required autocomplete="current-password" placeholder="••••••••" />
  </div>
  <button class="bg-[${ctx.theme.primary}] text-[${readableTextOn(ctx.theme.primary)}] px-4 py-2.5 rounded text-sm font-bold" type="submit">${escapeHtml(action)}</button>
</form>`;
    },
    a11y: (ctx) => ({
      hasAriaLabel: true,
      hasSemanticHtml: true,
      hasAltText: true,
      contrastOk: contrastOk(textPage(ctx.theme), bgPage(ctx.theme)),
      issues: [],
    }),
  },
  alert: {
    variants: ["primary", "secondary", "outline", "destructive"],
    html: (ctx) => {
      const msg = ctx.text || "Action completed successfully.";
      const role = ctx.variant === "destructive" ? "alert" : "status";
      return `<div class="uq-alert uq-alert--${ctx.variant}" role="${role}" aria-live="polite">
  <span class="uq-alert__msg">${escapeHtml(msg)}</span>
  <button class="uq-alert__close" type="button" aria-label="Dismiss">×</button>
</div>`;
    },
    css: (ctx) => {
      const c = variantColor(ctx.variant, ctx.theme);
      const bg = ctx.variant === "destructive" ? "#fee2e2" : shade(c.bg === "transparent" ? ctx.theme.primary : c.bg, 75);
      const fg = ctx.variant === "destructive" ? "#991b1b" : ctx.theme.primary;
      return [
        `.uq-alert { font-family: ${fontCss(ctx.theme)}; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 16px; background: ${bg}; color: ${fg}; border: 1px solid ${c.border}; border-radius: ${radiusCss(ctx.theme)}; max-width: 480px; }`,
        `.uq-alert__msg { font-size: 14px; font-weight: 500; }`,
        `.uq-alert__close { background: transparent; border: none; color: inherit; font-size: 20px; line-height: 1; cursor: pointer; padding: 0 4px; }`,
      ].join("\n");
    },
    tailwind: (ctx) => {
      const msg = ctx.text || "Action completed successfully.";
      const role = ctx.variant === "destructive" ? "alert" : "status";
      const styles: Record<Variant, string> = {
        primary: "bg-indigo-100 text-indigo-800 border-indigo-400",
        secondary: "bg-slate-100 text-slate-800 border-slate-400",
        outline: "bg-transparent text-indigo-700 border-indigo-600",
        ghost: "bg-transparent text-indigo-700 border-transparent",
        destructive: "bg-red-100 text-red-800 border-red-400",
        gradient: "bg-gradient-to-r from-indigo-100 to-purple-100 text-indigo-800 border-indigo-400",
      };
      return `<div class="flex items-center justify-between gap-3 px-4 py-3 ${styles[ctx.variant]} border rounded-[${ctx.theme.radius}px] max-w-md" role="${role}" aria-live="polite">
  <span class="text-sm font-medium">${escapeHtml(msg)}</span>
  <button class="bg-transparent border-none text-xl leading-none cursor-pointer px-1" type="button" aria-label="Dismiss">×</button>
</div>`;
    },
    a11y: (ctx) => ({
      hasAriaLabel: true,
      hasSemanticHtml: true,
      hasAltText: true,
      contrastOk: ctx.variant === "destructive" ? contrastOk("#991b1b", "#fee2e2") : contrastOk(ctx.theme.primary, bgPage(ctx.theme)),
      issues: [],
    }),
  },
  badge: {
    variants: ["primary", "secondary", "outline", "destructive", "gradient"],
    html: (ctx) => {
      const label = ctx.text || "New";
      return `<span class="uq-badge uq-badge--${ctx.variant}">${escapeHtml(label)}</span>`;
    },
    css: (ctx) => {
      const c = variantColor(ctx.variant, ctx.theme);
      const bg = ctx.variant === "gradient"
        ? `background: linear-gradient(135deg, ${ctx.theme.primary}, ${shade(ctx.theme.primary, -25)});`
        : `background: ${c.bg};`;
      return [
        `.uq-badge { font-family: ${fontCss(ctx.theme)}; display: inline-block; padding: 3px 10px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: ${c.text}; border: 1px solid ${c.border}; border-radius: 999px; ${bg} }`,
      ].join("\n");
    },
    tailwind: (ctx) => {
      const label = ctx.text || "New";
      const c = variantColor(ctx.variant, ctx.theme);
      const styles: Record<Variant, string> = {
        primary: `text-[${c.text}] bg-[${c.bg}] border-[${c.border}]`,
        secondary: `text-[${c.text}] bg-[${c.bg}] border-[${c.border}]`,
        outline: `text-[${c.text}] bg-transparent border-[${c.border}]`,
        ghost: `text-[${c.text}] bg-transparent border-transparent`,
        destructive: `text-white bg-red-600 border-red-600`,
        gradient: `text-[${c.text}] bg-gradient-to-br from-[${ctx.theme.primary}] to-[${shade(ctx.theme.primary, -25)}] border-[${c.border}]`,
      };
      return `<span class="inline-block px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide rounded-full border ${styles[ctx.variant]}">${escapeHtml(label)}</span>`;
    },
    a11y: () => ({
      hasAriaLabel: false,
      hasSemanticHtml: true,
      hasAltText: true,
      contrastOk: true,
      issues: [],
    }),
  },
  dropdown: {
    variants: ["primary", "secondary", "outline"],
    html: (ctx) => {
      const trigger = ctx.text || "Options";
      return `<div class="uq-dropdown">
  <button class="uq-dropdown__trigger" type="button" aria-haspopup="true" aria-expanded="false">${escapeHtml(trigger)} ▾</button>
  <ul class="uq-dropdown__menu" role="menu">
    <li role="menuitem"><a href="#" class="uq-dropdown__item">Profile</a></li>
    <li role="menuitem"><a href="#" class="uq-dropdown__item">Settings</a></li>
    <li role="menuitem"><a href="#" class="uq-dropdown__item">Help</a></li>
    <li role="menuseparator"><hr class="uq-dropdown__sep" /></li>
    <li role="menuitem"><a href="#" class="uq-dropdown__item uq-dropdown__item--danger">Sign out</a></li>
  </ul>
</div>`;
    },
    css: (ctx) => [
      `.uq-dropdown { font-family: ${fontCss(ctx.theme)}; position: relative; display: inline-block; }`,
      `.uq-dropdown__trigger { background: ${ctx.theme.primary}; color: ${readableTextOn(ctx.theme.primary)}; border: none; padding: 8px 14px; border-radius: ${radiusCss(ctx.theme)}; font-weight: 600; font-size: 13px; cursor: pointer; }`,
      `.uq-dropdown__menu { position: absolute; top: calc(100% + 4px); left: 0; min-width: 160px; background: ${bgPage(ctx.theme)}; border: 1px solid ${mutedPage(ctx.theme)}; border-radius: ${radiusCss(ctx.theme)}; list-style: none; margin: 0; padding: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }`,
      `.uq-dropdown__item { display: block; padding: 8px 12px; color: ${textPage(ctx.theme)}; text-decoration: none; font-size: 13px; border-radius: ${Math.max(2, ctx.theme.radius - 4)}px; }`,
      `.uq-dropdown__item:hover { background: ${shade(ctx.theme.primary, 80)}; color: ${ctx.theme.primary}; }`,
      `.uq-dropdown__item--danger { color: #dc2626; }`,
      `.uq-dropdown__sep { border: none; border-top: 1px solid ${mutedPage(ctx.theme)}; margin: 4px 0; }`,
    ].join("\n"),
    tailwind: (ctx) => {
      const trigger = ctx.text || "Options";
      const cardBg = ctx.theme.dark ? "bg-slate-900" : "bg-white";
      const cardText = ctx.theme.dark ? "text-slate-200" : "text-gray-900";
      const mutedText = ctx.theme.dark ? "text-slate-400" : "text-gray-500";
      return `<div class="relative inline-block">
  <button class="bg-[${ctx.theme.primary}] text-[${readableTextOn(ctx.theme.primary)}] px-3.5 py-2 rounded text-sm font-semibold" type="button" aria-haspopup="true" aria-expanded="false">${escapeHtml(trigger)} ▾</button>
  <ul class="absolute top-full mt-1 left-0 min-w-[160px] ${cardBg} border border-[${mutedPage(ctx.theme)}] rounded list-none m-0 p-1 shadow-md" role="menu">
    <li role="menuitem"><a href="#" class="block px-3 py-2 ${cardText} text-sm no-underline rounded hover:bg-[${shade(ctx.theme.primary, 80)}] hover:text-[${ctx.theme.primary}]">Profile</a></li>
    <li role="menuitem"><a href="#" class="block px-3 py-2 ${cardText} text-sm no-underline rounded hover:bg-[${shade(ctx.theme.primary, 80)}] hover:text-[${ctx.theme.primary}]">Settings</a></li>
    <li role="menuitem"><a href="#" class="block px-3 py-2 ${cardText} text-sm no-underline rounded hover:bg-[${shade(ctx.theme.primary, 80)}] hover:text-[${ctx.theme.primary}]">Help</a></li>
    <li role="menuseparator"><hr class="border-t border-[${mutedPage(ctx.theme)}] my-1" /></li>
    <li role="menuitem"><a href="#" class="block px-3 py-2 text-red-600 text-sm no-underline rounded hover:bg-red-50">Sign out</a></li>
  </ul>
</div>`;
    },
    a11y: (ctx) => ({
      hasAriaLabel: false,
      hasSemanticHtml: true,
      hasAltText: true,
      contrastOk: contrastOk(textPage(ctx.theme), bgPage(ctx.theme)),
      issues: [],
    }),
  },
  tabs: {
    variants: ["primary", "secondary", "outline"],
    html: () => `<div class="uq-tabs" role="tablist" aria-label="Section tabs">
  <button class="uq-tabs__tab uq-tabs__tab--active" role="tab" aria-selected="true" id="uq-tab-1" aria-controls="uq-panel-1">Overview</button>
  <button class="uq-tabs__tab" role="tab" aria-selected="false" id="uq-tab-2" aria-controls="uq-panel-2">Details</button>
  <button class="uq-tabs__tab" role="tab" aria-selected="false" id="uq-tab-3" aria-controls="uq-panel-3">Reviews</button>
</div>
<div class="uq-tabs__panel" role="tabpanel" id="uq-panel-1" aria-labelledby="uq-tab-1">Overview content here.</div>
<div class="uq-tabs__panel uq-tabs__panel--hidden" role="tabpanel" id="uq-panel-2" aria-labelledby="uq-tab-2" hidden>Details content here.</div>
<div class="uq-tabs__panel uq-tabs__panel--hidden" role="tabpanel" id="uq-panel-3" aria-labelledby="uq-tab-3" hidden>Reviews content here.</div>`,
    css: (ctx) => [
      `.uq-tabs { font-family: ${fontCss(ctx.theme)}; display: flex; gap: 4px; border-bottom: 2px solid ${mutedPage(ctx.theme)}; }`,
      `.uq-tabs__tab { background: transparent; border: none; padding: 10px 18px; font-size: 14px; font-weight: 600; color: ${mutedPage(ctx.theme)}; cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -2px; }`,
      `.uq-tabs__tab--active { color: ${ctx.theme.primary}; border-bottom-color: ${ctx.theme.primary}; }`,
      `.uq-tabs__panel { padding: 16px 0; color: ${textPage(ctx.theme)}; font-size: 14px; }`,
      `.uq-tabs__panel--hidden { display: none; }`,
    ].join("\n"),
    tailwind: (ctx) => {
      const cardText = ctx.theme.dark ? "text-slate-200" : "text-gray-900";
      const mutedText = ctx.theme.dark ? "text-slate-400" : "text-gray-500";
      return `<div class="flex gap-1 border-b-2 border-[${mutedPage(ctx.theme)}]" role="tablist" aria-label="Section tabs">
  <button class="bg-transparent border-none px-4 py-2.5 text-sm font-semibold text-[${ctx.theme.primary}] border-b-2 border-[${ctx.theme.primary}] -mb-0.5" role="tab" aria-selected="true">Overview</button>
  <button class="bg-transparent border-none px-4 py-2.5 text-sm font-semibold ${mutedText}" role="tab" aria-selected="false">Details</button>
  <button class="bg-transparent border-none px-4 py-2.5 text-sm font-semibold ${mutedText}" role="tab" aria-selected="false">Reviews</button>
</div>
<div class="py-4 ${cardText} text-sm" role="tabpanel">Overview content here.</div>`;
    },
    a11y: (ctx) => ({
      hasAriaLabel: true,
      hasSemanticHtml: true,
      hasAltText: true,
      contrastOk: contrastOk(textPage(ctx.theme), bgPage(ctx.theme)),
      issues: [],
    }),
  },
  hero: {
    variants: ["primary", "gradient"],
    html: (ctx) => {
      const title = ctx.text || "Build something great";
      return `<section class="uq-hero uq-hero--${ctx.variant}">
  <div class="uq-hero__inner">
    <h1 class="uq-hero__title">${escapeHtml(title)}</h1>
    <p class="uq-hero__sub">A clear, short subheading that explains the value proposition in one sentence.</p>
    <div class="uq-hero__actions">
      <button class="uq-hero__cta" type="button">Get started free</button>
      <button class="uq-hero__link" type="button">Learn more</button>
    </div>
  </div>
</section>`;
    },
    css: (ctx) => {
      const bg = ctx.variant === "gradient"
        ? `background: linear-gradient(135deg, ${ctx.theme.primary}, ${shade(ctx.theme.primary, -40)});`
        : `background: ${ctx.theme.primary};`;
      const textColor = readableTextOn(ctx.theme.primary);
      return [
        `.uq-hero { font-family: ${fontCss(ctx.theme)}; ${bg} color: ${textColor}; padding: 64px 24px; border-radius: ${radiusCss(ctx.theme)}; text-align: center; }`,
        `.uq-hero__inner { max-width: 720px; margin: 0 auto; }`,
        `.uq-hero__title { font-size: 40px; font-weight: 800; margin: 0 0 12px; line-height: 1.1; }`,
        `.uq-hero__sub { font-size: 18px; opacity: 0.92; margin: 0 0 28px; }`,
        `.uq-hero__actions { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }`,
        `.uq-hero__cta { background: ${bgPage(ctx.theme)}; color: ${ctx.theme.primary}; border: none; padding: 12px 22px; border-radius: ${radiusCss(ctx.theme)}; font-weight: 700; font-size: 15px; cursor: pointer; }`,
        `.uq-hero__link { background: transparent; color: ${textColor}; border: 2px solid ${textColor}; padding: 10px 20px; border-radius: ${radiusCss(ctx.theme)}; font-weight: 700; font-size: 15px; cursor: pointer; }`,
        `@media (max-width: 640px) { .uq-hero__title { font-size: 28px; } .uq-hero__sub { font-size: 16px; } }`,
      ].join("\n");
    },
    tailwind: (ctx) => {
      const title = ctx.text || "Build something great";
      const bg = ctx.variant === "gradient"
        ? `bg-gradient-to-br from-[${ctx.theme.primary}] to-[${shade(ctx.theme.primary, -40)}]`
        : `bg-[${ctx.theme.primary}]`;
      const textColor = readableTextOn(ctx.theme.primary);
      return `<section class="${bg} text-[${textColor}] py-16 px-6 rounded-[${ctx.theme.radius}px] text-center">
  <div class="max-w-2xl mx-auto">
    <h1 class="text-4xl font-extrabold mb-3 leading-tight max-sm:text-3xl">${escapeHtml(title)}</h1>
    <p class="text-lg opacity-90 mb-7 max-sm:text-base">A clear, short subheading that explains the value proposition in one sentence.</p>
    <div class="flex gap-3 justify-center flex-wrap">
      <button class="bg-[${bgPage(ctx.theme)}] text-[${ctx.theme.primary}] px-5 py-3 rounded text-base font-bold" type="button">Get started free</button>
      <button class="bg-transparent text-[${textColor}] border-2 border-[${textColor}] px-5 py-3 rounded text-base font-bold" type="button">Learn more</button>
    </div>
  </div>
</section>`;
    },
    a11y: (ctx) => ({
      hasAriaLabel: false,
      hasSemanticHtml: true,
      hasAltText: true,
      contrastOk: contrastOk(readableTextOn(ctx.theme.primary), ctx.theme.primary),
      issues: [],
    }),
  },
  footer: {
    variants: ["primary", "secondary", "outline"],
    html: (ctx) => {
      const brand = ctx.text || "Brand";
      return `<footer class="uq-footer" aria-label="Site footer">
  <div class="uq-footer__top">
    <div class="uq-footer__brand">${escapeHtml(brand)}</div>
    <nav class="uq-footer__nav" aria-label="Footer navigation">
      <a href="#" class="uq-footer__link">Privacy</a>
      <a href="#" class="uq-footer__link">Terms</a>
      <a href="#" class="uq-footer__link">Contact</a>
    </nav>
    <div class="uq-footer__social">
      <a href="#" class="uq-footer__social-link" aria-label="Twitter">𝕏</a>
      <a href="#" class="uq-footer__social-link" aria-label="GitHub">GH</a>
    </div>
  </div>
  <div class="uq-footer__bottom">© ${new Date().getFullYear()} ${escapeHtml(brand)}. All rights reserved.</div>
</footer>`;
    },
    css: (ctx) => [
      `.uq-footer { font-family: ${fontCss(ctx.theme)}; background: ${ctx.theme.dark ? "#020617" : "#f9fafb"}; color: ${textPage(ctx.theme)}; border-top: 1px solid ${mutedPage(ctx.theme)}; padding: 32px 24px 16px; }`,
      `.uq-footer__top { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; max-width: 960px; margin: 0 auto; }`,
      `.uq-footer__brand { font-weight: 800; font-size: 18px; color: ${ctx.theme.primary}; }`,
      `.uq-footer__nav { display: flex; gap: 16px; }`,
      `.uq-footer__link { color: ${mutedPage(ctx.theme)}; text-decoration: none; font-size: 13px; }`,
      `.uq-footer__link:hover { color: ${ctx.theme.primary}; }`,
      `.uq-footer__social { display: flex; gap: 8px; }`,
      `.uq-footer__social-link { display: inline-grid; place-items: center; width: 32px; height: 32px; border: 1px solid ${mutedPage(ctx.theme)}; border-radius: 999px; color: ${textPage(ctx.theme)}; text-decoration: none; font-size: 12px; }`,
      `.uq-footer__bottom { text-align: center; color: ${mutedPage(ctx.theme)}; font-size: 12px; margin-top: 20px; padding-top: 16px; border-top: 1px solid ${mutedPage(ctx.theme)}; }`,
    ].join("\n"),
    tailwind: (ctx) => {
      const brand = ctx.text || "Brand";
      const bg = ctx.theme.dark ? "bg-slate-950" : "bg-gray-50";
      const cardText = ctx.theme.dark ? "text-slate-200" : "text-gray-900";
      const mutedText = ctx.theme.dark ? "text-slate-400" : "text-gray-500";
      return `<footer class="${bg} ${cardText} border-t border-[${mutedPage(ctx.theme)}] pt-8 pb-4 px-6" aria-label="Site footer">
  <div class="flex justify-between items-center flex-wrap gap-4 max-w-4xl mx-auto">
    <div class="font-extrabold text-lg text-[${ctx.theme.primary}]">${escapeHtml(brand)}</div>
    <nav class="flex gap-4" aria-label="Footer navigation">
      <a href="#" class="${mutedText} text-sm no-underline hover:text-[${ctx.theme.primary}]">Privacy</a>
      <a href="#" class="${mutedText} text-sm no-underline hover:text-[${ctx.theme.primary}]">Terms</a>
      <a href="#" class="${mutedText} text-sm no-underline hover:text-[${ctx.theme.primary}]">Contact</a>
    </nav>
    <div class="flex gap-2">
      <a href="#" class="inline-grid place-items-center w-8 h-8 border border-[${mutedPage(ctx.theme)}] rounded-full ${cardText} text-xs no-underline" aria-label="Twitter">𝕏</a>
      <a href="#" class="inline-grid place-items-center w-8 h-8 border border-[${mutedPage(ctx.theme)}] rounded-full ${cardText} text-xs no-underline" aria-label="GitHub">GH</a>
    </div>
  </div>
  <div class="text-center ${mutedText} text-xs mt-5 pt-4 border-t border-[${mutedPage(ctx.theme)}]">© ${new Date().getFullYear()} ${escapeHtml(brand)}. All rights reserved.</div>
</footer>`;
    },
    a11y: (ctx) => ({
      hasAriaLabel: true,
      hasSemanticHtml: true,
      hasAltText: true,
      contrastOk: contrastOk(mutedPage(ctx.theme), ctx.theme.dark ? "#020617" : "#f9fafb"),
      issues: [],
    }),
  },
  accordion: {
    variants: ["primary", "secondary", "outline"],
    html: () => `<div class="uq-acc">
  <details class="uq-acc__item" open>
    <summary class="uq-acc__summary">What is this tool?</summary>
    <p class="uq-acc__text">It's a free, private UI component generator that runs in your browser.</p>
  </details>
  <details class="uq-acc__item">
    <summary class="uq-acc__summary">Is it really free?</summary>
    <p class="uq-acc__text">Yes. No sign-up, no credits, no data sent anywhere.</p>
  </details>
  <details class="uq-acc__item">
    <summary class="uq-acc__summary">Can I use the output commercially?</summary>
    <p class="uq-acc__text">Yes. The generated HTML and CSS are yours to use however you like.</p>
  </details>
</div>`,
    css: (ctx) => [
      `.uq-acc { font-family: ${fontCss(ctx.theme)}; max-width: 540px; border: 1px solid ${mutedPage(ctx.theme)}; border-radius: ${radiusCss(ctx.theme)}; overflow: hidden; }`,
      `.uq-acc__item { border-bottom: 1px solid ${mutedPage(ctx.theme)}; }`,
      `.uq-acc__item:last-child { border-bottom: none; }`,
      `.uq-acc__summary { padding: 14px 16px; cursor: pointer; font-weight: 600; font-size: 14px; color: ${textPage(ctx.theme)}; background: ${bgPage(ctx.theme)}; list-style: none; }`,
      `.uq-acc__summary:hover { background: ${shade(ctx.theme.primary, 85)}; }`,
      `.uq-acc__summary::after { content: "+"; float: right; color: ${ctx.theme.primary}; }`,
      `.uq-acc__item[open] .uq-acc__summary::after { content: "−"; }`,
      `.uq-acc__text { margin: 0; padding: 0 16px 14px; color: ${mutedPage(ctx.theme)}; font-size: 13px; line-height: 1.5; }`,
    ].join("\n"),
    tailwind: (ctx) => {
      const cardBg = ctx.theme.dark ? "bg-slate-900" : "bg-white";
      const cardText = ctx.theme.dark ? "text-slate-200" : "text-gray-900";
      const mutedText = ctx.theme.dark ? "text-slate-400" : "text-gray-500";
      return `<div class="max-w-xl border border-[${mutedPage(ctx.theme)}] rounded-[${ctx.theme.radius}px] overflow-hidden">
  <details open class="border-b border-[${mutedPage(ctx.theme)}]">
    <summary class="px-4 py-3.5 cursor-pointer font-semibold text-sm ${cardText} ${cardBg} list-none">What is this tool?</summary>
    <p class="m-0 px-4 pb-3.5 ${mutedText} text-sm leading-relaxed">It's a free, private UI component generator that runs in your browser.</p>
  </details>
  <details class="border-b border-[${mutedPage(ctx.theme)}]">
    <summary class="px-4 py-3.5 cursor-pointer font-semibold text-sm ${cardText} ${cardBg} list-none">Is it really free?</summary>
    <p class="m-0 px-4 pb-3.5 ${mutedText} text-sm leading-relaxed">Yes. No sign-up, no credits, no data sent anywhere.</p>
  </details>
  <details>
    <summary class="px-4 py-3.5 cursor-pointer font-semibold text-sm ${cardText} ${cardBg} list-none">Can I use the output commercially?</summary>
    <p class="m-0 px-4 pb-3.5 ${mutedText} text-sm leading-relaxed">Yes. The generated HTML and CSS are yours to use however you like.</p>
  </details>
</div>`;
    },
    a11y: (ctx) => ({
      hasAriaLabel: false,
      hasSemanticHtml: true,
      hasAltText: true,
      contrastOk: contrastOk(textPage(ctx.theme), bgPage(ctx.theme)),
      issues: [],
    }),
  },
  tooltip: {
    variants: ["primary", "secondary", "outline"],
    html: () => `<div class="uq-tip">
  <button class="uq-tip__trigger" type="button" aria-describedby="uq-tip-text">Hover me</button>
  <span class="uq-tip__text" id="uq-tip-text" role="tooltip">Helpful hint appears on hover.</span>
</div>`,
    css: (ctx) => [
      `.uq-tip { font-family: ${fontCss(ctx.theme)}; position: relative; display: inline-block; }`,
      `.uq-tip__trigger { background: ${ctx.theme.primary}; color: ${readableTextOn(ctx.theme.primary)}; border: none; padding: 8px 14px; border-radius: ${radiusCss(ctx.theme)}; font-weight: 600; font-size: 13px; cursor: pointer; }`,
      `.uq-tip__text { position: absolute; bottom: calc(100% + 8px); left: 50%; transform: translateX(-50%); background: ${textPage(ctx.theme)}; color: ${bgPage(ctx.theme)}; padding: 6px 10px; border-radius: ${Math.max(2, ctx.theme.radius - 4)}px; font-size: 12px; white-space: nowrap; opacity: 0; pointer-events: none; transition: opacity .15s; }`,
      `.uq-tip__text::after { content: ""; position: absolute; top: 100%; left: 50%; transform: translateX(-50%); border: 5px solid transparent; border-top-color: ${textPage(ctx.theme)}; }`,
      `.uq-tip:hover .uq-tip__text, .uq-tip__trigger:focus + .uq-tip__text { opacity: 1; }`,
    ].join("\n"),
    tailwind: (ctx) => `<div class="relative inline-block group">
  <button class="bg-[${ctx.theme.primary}] text-[${readableTextOn(ctx.theme.primary)}] px-3.5 py-2 rounded text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-[${ctx.theme.primary}]" type="button" aria-describedby="uq-tip-text">Hover me</button>
  <span class="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-[${textPage(ctx.theme)}] text-[${bgPage(ctx.theme)}] px-2.5 py-1.5 rounded text-xs whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition" id="uq-tip-text" role="tooltip">Helpful hint appears on hover.</span>
</div>`,
    a11y: (ctx) => ({
      hasAriaLabel: true,
      hasSemanticHtml: true,
      hasAltText: true,
      contrastOk: contrastOk(bgPage(ctx.theme), textPage(ctx.theme)),
      issues: [],
    }),
  },
  progress: {
    variants: ["primary", "gradient"],
    html: (ctx) => {
      const pct = parseProgress(ctx.text);
      return `<div class="uq-prog" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="Progress">
  <div class="uq-prog__bar uq-prog__bar--${ctx.variant}" style="width: ${pct}%"></div>
</div>
<span class="uq-prog__label">${pct}%</span>`;
    },
    css: (ctx) => {
      const bg = ctx.variant === "gradient"
        ? `background: linear-gradient(90deg, ${ctx.theme.primary}, ${shade(ctx.theme.primary, -25)});`
        : `background: ${ctx.theme.primary};`;
      return [
        `.uq-prog { font-family: ${fontCss(ctx.theme)}; width: 100%; max-width: 360px; height: 10px; background: ${shade(ctx.theme.primary, 80)}; border-radius: 999px; overflow: hidden; }`,
        `.uq-prog__bar { height: 100%; ${bg} border-radius: 999px; transition: width .3s ease; }`,
        `.uq-prog__label { display: inline-block; margin-top: 6px; font-size: 12px; color: ${mutedPage(ctx.theme)}; font-weight: 600; }`,
      ].join("\n");
    },
    tailwind: (ctx) => {
      const pct = parseProgress(ctx.text);
      const bar = ctx.variant === "gradient"
        ? `bg-gradient-to-r from-[${ctx.theme.primary}] to-[${shade(ctx.theme.primary, -25)}]`
        : `bg-[${ctx.theme.primary}]`;
      return `<div class="w-full max-w-sm h-2.5 bg-[${shade(ctx.theme.primary, 80)}] rounded-full overflow-hidden" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="Progress">
  <div class="h-full ${bar} rounded-full transition-all" style="width: ${pct}%"></div>
</div>
<span class="inline-block mt-1.5 text-xs font-semibold text-[${mutedPage(ctx.theme)}]">${pct}%</span>`;
    },
    a11y: () => ({
      hasAriaLabel: true,
      hasSemanticHtml: true,
      hasAltText: true,
      contrastOk: true,
      issues: [],
    }),
  },
  input: {
    variants: ["primary", "secondary", "outline"],
    html: (ctx) => {
      const label = ctx.text || "Username";
      return `<div class="uq-input-wrap">
  <label class="uq-input-label" for="uq-input-1">${escapeHtml(label)}</label>
  <input class="uq-input" id="uq-input-1" type="text" placeholder="Enter ${escapeAttr(label.toLowerCase())}" />
  <p class="uq-input-hint">Must be 3-20 characters.</p>
</div>`;
    },
    css: (ctx) => [
      `.uq-input-wrap { font-family: ${fontCss(ctx.theme)}; display: flex; flex-direction: column; gap: 6px; max-width: 320px; }`,
      `.uq-input-label { font-size: 13px; font-weight: 600; color: ${textPage(ctx.theme)}; }`,
      `.uq-input { font-family: inherit; font-size: 14px; padding: 10px 12px; border: 1px solid ${mutedPage(ctx.theme)}; border-radius: ${radiusCss(ctx.theme)}; background: ${bgPage(ctx.theme)}; color: ${textPage(ctx.theme)}; }`,
      `.uq-input::placeholder { color: ${mutedPage(ctx.theme)}; }`,
      `.uq-input:focus { outline: 2px solid ${ctx.theme.primary}; outline-offset: 1px; border-color: ${ctx.theme.primary}; }`,
      `.uq-input-hint { font-size: 11px; color: ${mutedPage(ctx.theme)}; margin: 0; }`,
    ].join("\n"),
    tailwind: (ctx) => {
      const label = ctx.text || "Username";
      const cardBg = ctx.theme.dark ? "bg-slate-900" : "bg-white";
      const cardText = ctx.theme.dark ? "text-slate-200" : "text-gray-900";
      const mutedText = ctx.theme.dark ? "text-slate-400" : "text-gray-500";
      return `<div class="flex flex-col gap-1.5 max-w-sm">
  <label class="text-[13px] font-semibold ${cardText}" for="uq-input-1">${escapeHtml(label)}</label>
  <input class="text-sm px-3 py-2.5 border border-[${mutedPage(ctx.theme)}] rounded-[${ctx.theme.radius}px] ${cardBg} ${cardText} placeholder:text-[${mutedPage(ctx.theme)}] focus:outline-none focus:ring-2 focus:ring-[${ctx.theme.primary}]" id="uq-input-1" type="text" placeholder="Enter ${escapeAttr(label.toLowerCase())}" />
  <p class="text-[11px] ${mutedText} m-0">Must be 3-20 characters.</p>
</div>`;
    },
    a11y: (ctx) => ({
      hasAriaLabel: true,
      hasSemanticHtml: true,
      hasAltText: true,
      contrastOk: contrastOk(textPage(ctx.theme), bgPage(ctx.theme)),
      issues: [],
    }),
  },
};

function parseProgress(text: string): number {
  const m = /(\d{1,3})\s*(?:%|percent)/.exec((text || "").toLowerCase());
  if (m) return Math.max(0, Math.min(100, parseInt(m[1], 10)));
  return 60;
}

function escapeHtml(s: string): string {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/"/g, "&quot;");
}

// ---------- Component generation ----------

export interface GenerateOptions {
  description: string;
  variant?: Variant;
  target?: OutputTarget;
  theme?: Partial<Theme>;
  text?: string;
}

export function generateComponent(opts: GenerateOptions): GeneratedComponent | null {
  const description = normalizeDescription(opts.description);
  if (!description) return null;
  const match = matchComponentType(description);
  const tpl = TEMPLATES[match.type];
  const variant = opts.variant && tpl.variants.includes(opts.variant)
    ? opts.variant
    : tpl.variants[0];
  const target = opts.target ?? "vanilla";
  const theme: Theme = { ...DEFAULT_THEME, ...(opts.theme ?? {}) };
  // Extract text from the ORIGINAL (case-preserving) description so quoted
  // labels keep their casing. Fall back to the normalized description.
  const text = (opts.text ?? extractText(match.type, opts.description)).trim();
  const ctx: TemplateContext = { theme, variant, text };
  const html = target === "tailwind" ? tpl.tailwind(ctx) : tpl.html(ctx);
  const css = target === "vanilla" ? tpl.css(ctx) : "";
  const tailwind = target === "tailwind" ? tpl.tailwind(ctx) : tpl.tailwind(ctx);
  const a11y = tpl.a11y(ctx);
  const score = scoreComponent({ a11y, html, css, confidence: match.confidence, target });
  return {
    id: makeId(match.type, variant, target, Date.now()),
    type: match.type,
    variant,
    target,
    confidence: match.confidence,
    html,
    css,
    tailwind,
    a11y,
    score,
    keywords: match.matched,
  };
}

/** Try to extract a meaningful text/label from the description. */
function extractText(type: ComponentType, description: string): string {
  // Look for "with" or "called" or "labeled" patterns
  const m = /(?:with|called|labeled|labelled|named|titled|saying|text)\s+["']?([^"'\n.]{2,40})["']?/i.exec(description);
  if (m) return m[1].trim();
  // Look for quoted strings
  const q = /["']([^"'\n]{2,40})["']/i.exec(description);
  if (q) return q[1].trim();
  // Look for percentage for progress
  if (type === "progress") {
    const p = /(\d{1,3})\s*(?:%|percent)/i.exec(description);
    if (p) return `${p[1]}%`;
  }
  // Default per type
  const defaults: Record<ComponentType, string> = {
    button: "Click me", card: "Card title", modal: "Dialog title",
    navbar: "Brand", form: "Submit", alert: "Action completed successfully.",
    badge: "New", dropdown: "Options", tabs: "", hero: "Build something great",
    footer: "Brand", accordion: "", tooltip: "", progress: "60%",
    input: "Username",
  };
  return defaults[type];
}

/** Score a generated component 0-100. */
export function scoreComponent(opts: {
  a11y: A11yReport;
  html: string;
  css: string;
  confidence: number;
  target: OutputTarget;
}): number {
  let s = 40;
  if (opts.a11y.hasSemanticHtml) s += 10;
  if (opts.a11y.hasAriaLabel) s += 8;
  if (opts.a11y.contrastOk) s += 10;
  if (opts.a11y.issues.length === 0) s += 6;
  if (opts.html.includes("class=")) s += 5;
  if (opts.target === "vanilla" && opts.css.length > 50) s += 5;
  if (opts.target === "tailwind" && opts.html.includes("class=")) s += 5;
  if (opts.target === "inline" && opts.html.includes("style=")) s += 5;
  s += Math.round(opts.confidence / 8);
  return Math.max(0, Math.min(100, s));
}

// ---------- Refinement parser ----------

/** Parse a refinement like "make it dark, add shadow, more rounded". */
export function parseRefinement(text: string): RefinementMod {
  const n = normalizeDescription(text);
  const mods: string[] = [];
  const makeDark = /\b(dark|night|dark-mode|black)\b/.test(n);
  const makeLight = /\b(light|day|light-mode|white)\b/.test(n);
  const addShadow = /\bshadow\b/.test(n);
  const rounded = /\b(rounded|round|softer|pill)\b/.test(n);
  const smaller = /\bsmaller|tiny|compact\b/.test(n);
  const larger = /\b(larger|bigger|huge|giant)\b/.test(n);
  if (makeDark) mods.push("dark");
  if (makeLight) mods.push("light");
  if (addShadow) mods.push("shadow");
  if (rounded) mods.push("rounded");
  if (smaller) mods.push("smaller");
  if (larger) mods.push("larger");
  // Capture additional free-text mods
  const extra = n.replace(/\b(make|it|add|more|less|please)\b/g, " ").trim();
  if (extra) mods.push(extra.slice(0, 60));
  return { mods, makeDark, makeLight, addShadow, rounded, smaller, larger };
}

/** Apply a refinement to a theme + component. Returns updated theme (and possibly re-renders). */
export function applyRefinement(theme: Theme, mod: RefinementMod): Theme {
  const next: Theme = { ...theme };
  if (mod.makeDark) next.dark = true;
  if (mod.makeLight) next.dark = false;
  if (mod.rounded) next.radius = Math.min(48, next.radius + 8);
  if (mod.smaller) next.radius = Math.max(0, next.radius - 4);
  if (mod.larger) next.radius = Math.min(48, next.radius + 8);
  return next;
}

// ---------- Tailwind class generator from inline CSS ----------

const CSS_TO_TAILWIND: Array<{ test: RegExp; tw: string }> = [
  { test: /display:\s*flex/i, tw: "flex" },
  { test: /display:\s*grid/i, tw: "grid" },
  { test: /display:\s*none/i, tw: "hidden" },
  { test: /display:\s*inline-block/i, tw: "inline-block" },
  { test: /display:\s*block/i, tw: "block" },
  { test: /justify-content:\s*center/i, tw: "justify-center" },
  { test: /justify-content:\s*space-between/i, tw: "justify-between" },
  { test: /align-items:\s*center/i, tw: "items-center" },
  { test: /flex-direction:\s*column/i, tw: "flex-col" },
  { test: /position:\s*relative/i, tw: "relative" },
  { test: /position:\s*absolute/i, tw: "absolute" },
  { test: /position:\s*fixed/i, tw: "fixed" },
  { test: /font-weight:\s*700/i, tw: "font-bold" },
  { test: /font-weight:\s*600/i, tw: "font-semibold" },
  { test: /font-weight:\s*800/i, tw: "font-extrabold" },
  { test: /text-align:\s*center/i, tw: "text-center" },
  { test: /text-align:\s*right/i, tw: "text-right" },
  { test: /border-radius:\s*9999px|border-radius:\s*999px/i, tw: "rounded-full" },
];

/** Convert simple inline CSS declarations to Tailwind class suggestions. */
export function cssToTailwind(css: string): string[] {
  const out: string[] = [];
  for (const { test, tw } of CSS_TO_TAILWIND) {
    if (test.test(css)) out.push(tw);
  }
  // Capture padding
  const pm = /padding:\s*(\d+)px/i.exec(css);
  if (pm) out.push(`p-[${pm[1]}px]`);
  // Capture margin
  const mm = /margin:\s*(\d+)px/i.exec(css);
  if (mm) out.push(`m-[${mm[1]}px]`);
  // Capture font-size
  const fm = /font-size:\s*(\d+)px/i.exec(css);
  if (fm) out.push(`text-[${fm[1]}px]`);
  // Capture border-radius
  const rm = /border-radius:\s*(\d+)px/i.exec(css);
  if (rm) out.push(`rounded-[${rm[1]}px]`);
  return out;
}

// ---------- React JSX wrapper ----------

/** Wrap a generated HTML string into a small React component snippet. */
export function toReactComponent(html: string, componentName = "GeneratedComponent"): string {
  // Convert class= to className= and for= to htmlFor=
  const jsx = html
    .replace(/\bclass=/g, "className=")
    .replace(/\bfor=/g, "htmlFor=");
  return `export function ${componentName}() {\n  return (\n    ${jsx.split("\n").map((l) => "    " + l).join("\n").trim()}\n  );\n}`;
}

// ---------- Live preview (sandboxed iframe srcdoc) ----------

export function buildPreviewSrcDoc(component: GeneratedComponent, theme: Theme): string {
  const body = component.html;
  const css = component.target === "vanilla"
    ? `<style>${component.css}</style>`
    : component.target === "tailwind"
      ? `<script src="https://cdn.tailwindcss.com"></script>`
      : "";
  return `<!DOCTYPE html>
<html lang="en" data-theme="${theme.dark ? "dark" : "light"}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Preview</title>
  <style>
    body { margin: 0; padding: 24px; background: ${bgPage(theme)}; color: ${textPage(theme)}; font-family: ${fontCss(theme)}; display: grid; place-items: center; min-height: 100vh; box-sizing: border-box; }
    * { box-sizing: border-box; }
  </style>
  ${css}
</head>
<body>
${body}
</body>
</html>`;
}

// ---------- Stats ----------

export function computeStats(components: GeneratedComponent[]): ComponentStats[] {
  const byType = new Map<ComponentType, GeneratedComponent[]>();
  for (const c of components) {
    if (!byType.has(c.type)) byType.set(c.type, []);
    byType.get(c.type)!.push(c);
  }
  const out: ComponentStats[] = [];
  for (const [type, list] of byType) {
    const avg = list.length > 0
      ? Math.round(list.reduce((a, b) => a + b.score, 0) / list.length)
      : 0;
    out.push({ type, count: list.length, avgScore: avg });
  }
  out.sort((a, b) => b.avgScore - a.avgScore);
  return out;
}

// ---------- Renderers ----------

export function renderText(components: GeneratedComponent[]): string {
  return components.map((c) => {
    const lines = [
      `${TYPE_LABELS[c.type]} — ${VARIANT_LABELS[c.variant]} — ${TARGET_LABELS[c.target]} — score ${c.score}/100`,
      `HTML:`,
      c.html,
    ];
    if (c.css) lines.push("", "CSS:", c.css);
    if (c.target === "tailwind") lines.push("", "Tailwind:", c.tailwind);
    lines.push("", `A11y: ${c.a11y.issues.length === 0 ? "OK" : c.a11y.issues.join("; ")}`);
    return lines.join("\n");
  }).join("\n\n---\n\n");
}

export function renderMarkdown(components: GeneratedComponent[]): string {
  return components.map((c) => {
    const lines = [
      `### ${TYPE_LABELS[c.type]} · ${VARIANT_LABELS[c.variant]} · ${TARGET_LABELS[c.target]} · score ${c.score}/100`,
      "",
      "**HTML**",
      "",
      "```html",
      c.html,
      "```",
    ];
    if (c.css) {
      lines.push("", "**CSS**", "", "```css", c.css, "```");
    }
    if (c.target === "tailwind") {
      lines.push("", "**Tailwind**", "", "```html", c.tailwind, "```");
    }
    if (c.a11y.issues.length > 0) {
      lines.push("", "**A11y issues:** " + c.a11y.issues.join("; "));
    }
    return lines.join("\n");
  }).join("\n\n---\n\n");
}

export function renderJson(components: GeneratedComponent[]): string {
  return JSON.stringify(components, null, 2);
}

// ---------- History (localStorage) ----------

export interface HistoryEntry {
  ts: number;
  description: string;
  type: ComponentType;
  variant: Variant;
  target: OutputTarget;
  score: number;
}

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
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  }
  return next;
}

export function clearHistory(): void {
  if (typeof localStorage === "undefined") return;
  try { localStorage.removeItem(HISTORY_KEY); } catch { /* ignore */ }
}

// ---------- Favorites / snippet library (localStorage) ----------

export interface FavoriteEntry {
  id: string;
  ts: number;
  description: string;
  type: ComponentType;
  variant: Variant;
  target: OutputTarget;
  html: string;
  css: string;
  tailwind: string;
  score: number;
}

export function loadFavorites(): FavoriteEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(FAVES_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as FavoriteEntry[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function saveFavorite(entry: FavoriteEntry): FavoriteEntry[] {
  const current = loadFavorites().filter((f) => f.id !== entry.id);
  const next = [entry, ...current].slice(0, 50);
  if (typeof localStorage !== "undefined") {
    try { localStorage.setItem(FAVES_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  }
  return next;
}

export function removeFavorite(id: string): FavoriteEntry[] {
  const next = loadFavorites().filter((f) => f.id !== id);
  if (typeof localStorage !== "undefined") {
    try { localStorage.setItem(FAVES_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  }
  return next;
}

export function clearFavorites(): void {
  if (typeof localStorage === "undefined") return;
  try { localStorage.removeItem(FAVES_KEY); } catch { /* ignore */ }
}

// ---------- Shareable URL ----------

export interface ShareState {
  description: string;
  variant: Variant;
  target: OutputTarget;
  theme: Theme;
  text: string;
}

export function buildShareUrl(state: ShareState): string {
  const params = new URLSearchParams();
  if (state.description) params.set("d", state.description);
  if (state.variant) params.set("v", state.variant);
  if (state.target) params.set("t", state.target);
  if (state.theme.primary) params.set("p", state.theme.primary);
  if (state.theme.radius !== undefined) params.set("r", String(state.theme.radius));
  if (state.theme.font) params.set("f", state.theme.font);
  if (state.theme.dark) params.set("dk", "1");
  if (state.text) params.set("tx", state.text);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<ShareState> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Partial<ShareState> = {};
  const d = params.get("d");
  if (d) out.description = d;
  const v = params.get("v") as Variant | null;
  if (v && v in VARIANT_LABELS) out.variant = v;
  const t = params.get("t") as OutputTarget | null;
  if (t && t in TARGET_LABELS) out.target = t;
  const theme: Theme = { ...DEFAULT_THEME };
  const p = params.get("p");
  if (p) theme.primary = p;
  const r = params.get("r");
  if (r) theme.radius = Math.max(0, Math.min(48, parseInt(r, 10) || 0));
  const f = params.get("f");
  if (f) theme.font = f;
  if (params.get("dk") === "1") theme.dark = true;
  out.theme = theme;
  const tx = params.get("tx");
  if (tx) out.text = tx;
  return out;
}

// ---------- LLM prompt builder (optional BYO-key enhancement) ----------

export function buildLlmPrompt(
  description: string,
  type: ComponentType,
  variant: Variant,
  target: OutputTarget,
  theme: Theme,
): string {
  return [
    "You are a senior front-end engineer who writes clean, accessible, responsive UI components.",
    `User request: ${description}.`,
    `Detected component type: ${TYPE_LABELS[type]}.`,
    `Variant: ${VARIANT_LABELS[variant]}.`,
    `Output target: ${TARGET_LABELS[target]}.`,
    `Theme — primary color: ${theme.primary}, border radius: ${theme.radius}px, font: ${theme.font}, dark mode: ${theme.dark ? "yes" : "no"}.`,
    "",
    "Generate ONE component. Output ONLY a JSON object with:",
    '- "html": the HTML markup (string)',
    '- "css": the CSS rules (string, empty if target is tailwind/inline)',
    '- "tailwind": the Tailwind-class version (string)',
    '- "notes": a one-line note on accessibility or responsiveness (string)',
    "",
    "Rules:",
    "- Use semantic HTML (button, nav, dialog, form, etc.).",
    "- Include aria attributes where appropriate.",
    "- Make it responsive (mobile-friendly).",
    "- No markdown fences, no commentary — only the JSON object.",
  ].join("\n");
}

export function renderLlmResult(rawText: string):
  | { ok: true; html: string; css: string; tailwind: string; notes: string }
  | { ok: false; error: string } {
  let s = (rawText || "").trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  }
  let obj: unknown;
  try {
    obj = JSON.parse(s);
  } catch {
    return { ok: false, error: "Could not parse LLM output as JSON. Try again or edit manually." };
  }
  if (typeof obj !== "object" || obj === null) {
    return { ok: false, error: "LLM output was not a JSON object." };
  }
  const o = obj as Record<string, unknown>;
  const html = typeof o.html === "string" ? o.html : "";
  if (!html) return { ok: false, error: "LLM output had no html field." };
  return {
    ok: true,
    html,
    css: typeof o.css === "string" ? o.css : "",
    tailwind: typeof o.tailwind === "string" ? o.tailwind : "",
    notes: typeof o.notes === "string" ? o.notes : "",
  };
}
