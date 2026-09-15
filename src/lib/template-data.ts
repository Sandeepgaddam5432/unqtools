/**
 * Bento Dashboard data layer — bridges the `.template` dashboard with
 * the real UnQTools catalog (1,679 tools / 13 categories).
 *
 * Exposes:
 *   - CATEGORIES   → formatted Category[] used by widgets + switcher
 *   - TOTAL_TOOLS  → count from the real catalog
 *   - ALL_TOOLS    → flat list for command-palette search
 *   - findTool(id) → lookup by id (returns null if not found)
 *   - HOT_IDS      → curated list of popular tool ids for the dashboard
 *
 * Lazy-loads lucide-react icons at module-init time so `Category.icon`,
 * `Tool.icon` are stable React components (not strings).
 */

import * as Lucide from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { CATALOG as REAL_CATALOG, countByCategory } from "@/lib/catalog";
import { CATEGORY_LABELS, type ToolCategory } from "@/lib/tool";

/* ------------------------------------------------------------------ */
/*  Lucide icon resolver                                               */
/* ------------------------------------------------------------------ */

const lucideMap = Lucide as unknown as Record<string, LucideIcon>;

function LucideIcon(name: string | undefined, fallback: LucideIcon): LucideIcon {
  if (!name) return fallback;
  return lucideMap[name] ?? fallback;
}

/* ------------------------------------------------------------------ */
/*  Per-category visual identity (gradients, tints, blobs)             */
/* ------------------------------------------------------------------ */

interface CategoryStyle {
  iconTile: string;
  iconShadow: string;
  text: string;
  chipBorder: string;
  chipBg: string;
  cardTint: string;
  blob: string;
  bar: string;
  dot: string;
}

const STYLE: Record<ToolCategory, CategoryStyle> = {
  pdf: {
    iconTile: "from-orange-500 to-amber-500",
    iconShadow: "shadow-orange-500/30",
    text: "text-orange-300",
    chipBorder: "border-orange-400/20",
    chipBg: "bg-orange-400/10",
    cardTint:
      "bg-[linear-gradient(135deg,rgba(249,115,22,0.14),rgba(234,88,12,0.05)_45%,transparent_75%)]",
    blob: "bg-orange-500/20",
    bar: "from-orange-400 to-amber-400",
    dot: "bg-orange-400",
  },
  developer: {
    iconTile: "from-emerald-500 to-teal-500",
    iconShadow: "shadow-emerald-500/30",
    text: "text-emerald-300",
    chipBorder: "border-emerald-400/20",
    chipBg: "bg-emerald-400/10",
    cardTint:
      "bg-[linear-gradient(135deg,rgba(16,185,129,0.13),rgba(13,148,136,0.05)_45%,transparent_75%)]",
    blob: "bg-emerald-500/20",
    bar: "from-emerald-400 to-teal-400",
    dot: "bg-emerald-400",
  },
  "network-security": {
    iconTile: "from-cyan-500 to-blue-600",
    iconShadow: "shadow-cyan-500/30",
    text: "text-cyan-300",
    chipBorder: "border-cyan-400/20",
    chipBg: "bg-cyan-400/10",
    cardTint:
      "bg-[linear-gradient(135deg,rgba(6,182,212,0.13),rgba(37,99,235,0.06)_45%,transparent_75%)]",
    blob: "bg-cyan-500/20",
    bar: "from-cyan-400 to-blue-500",
    dot: "bg-cyan-400",
  },
  ai: {
    iconTile: "from-violet-500 to-fuchsia-500",
    iconShadow: "shadow-violet-500/30",
    text: "text-violet-300",
    chipBorder: "border-violet-400/20",
    chipBg: "bg-violet-400/10",
    cardTint:
      "bg-[linear-gradient(135deg,rgba(139,92,246,0.14),rgba(217,70,239,0.06)_45%,transparent_78%)]",
    blob: "bg-fuchsia-500/20",
    bar: "from-violet-400 to-fuchsia-400",
    dot: "bg-violet-400",
  },
  calculators: {
    iconTile: "from-amber-500 to-yellow-400",
    iconShadow: "shadow-amber-500/30",
    text: "text-amber-300",
    chipBorder: "border-amber-400/20",
    chipBg: "bg-amber-400/10",
    cardTint:
      "bg-[linear-gradient(135deg,rgba(245,158,11,0.13),rgba(234,179,8,0.05)_45%,transparent_75%)]",
    blob: "bg-amber-500/20",
    bar: "from-amber-400 to-yellow-300",
    dot: "bg-amber-400",
  },
  image: {
    iconTile: "from-rose-500 to-red-400",
    iconShadow: "shadow-rose-500/30",
    text: "text-rose-300",
    chipBorder: "border-rose-400/20",
    chipBg: "bg-rose-400/10",
    cardTint:
      "bg-[linear-gradient(135deg,rgba(244,63,94,0.13),rgba(225,29,72,0.05)_45%,transparent_75%)]",
    blob: "bg-rose-500/20",
    bar: "from-rose-400 to-red-400",
    dot: "bg-rose-400",
  },
  text: {
    iconTile: "from-sky-500 to-indigo-500",
    iconShadow: "shadow-sky-500/30",
    text: "text-sky-300",
    chipBorder: "border-sky-400/20",
    chipBg: "bg-sky-400/10",
    cardTint:
      "bg-[linear-gradient(135deg,rgba(14,165,233,0.13),rgba(99,102,241,0.05)_45%,transparent_75%)]",
    blob: "bg-sky-500/20",
    bar: "from-sky-400 to-indigo-400",
    dot: "bg-sky-400",
  },
  seo: {
    iconTile: "from-lime-500 to-green-500",
    iconShadow: "shadow-lime-500/30",
    text: "text-lime-300",
    chipBorder: "border-lime-400/20",
    chipBg: "bg-lime-400/10",
    cardTint:
      "bg-[linear-gradient(135deg,rgba(132,204,22,0.12),rgba(34,197,94,0.05)_45%,transparent_75%)]",
    blob: "bg-lime-500/20",
    bar: "from-lime-400 to-green-400",
    dot: "bg-lime-400",
  },
  "audio-video": {
    iconTile: "from-pink-500 to-fuchsia-500",
    iconShadow: "shadow-pink-500/30",
    text: "text-pink-300",
    chipBorder: "border-pink-400/20",
    chipBg: "bg-pink-400/10",
    cardTint:
      "bg-[linear-gradient(135deg,rgba(236,72,153,0.13),rgba(217,70,239,0.05)_45%,transparent_75%)]",
    blob: "bg-pink-500/20",
    bar: "from-pink-400 to-fuchsia-400",
    dot: "bg-pink-400",
  },
  file: {
    iconTile: "from-slate-500 to-zinc-500",
    iconShadow: "shadow-slate-500/30",
    text: "text-slate-300",
    chipBorder: "border-slate-400/20",
    chipBg: "bg-slate-400/10",
    cardTint:
      "bg-[linear-gradient(135deg,rgba(100,116,139,0.13),rgba(63,63,70,0.05)_45%,transparent_75%)]",
    blob: "bg-slate-500/20",
    bar: "from-slate-400 to-zinc-400",
    dot: "bg-slate-400",
  },
  business: {
    iconTile: "from-emerald-500 to-cyan-500",
    iconShadow: "shadow-emerald-500/30",
    text: "text-emerald-300",
    chipBorder: "border-emerald-400/20",
    chipBg: "bg-emerald-400/10",
    cardTint:
      "bg-[linear-gradient(135deg,rgba(16,185,129,0.13),rgba(6,182,212,0.05)_45%,transparent_75%)]",
    blob: "bg-emerald-500/20",
    bar: "from-emerald-400 to-cyan-400",
    dot: "bg-emerald-400",
  },
  education: {
    iconTile: "from-indigo-500 to-purple-500",
    iconShadow: "shadow-indigo-500/30",
    text: "text-indigo-300",
    chipBorder: "border-indigo-400/20",
    chipBg: "bg-indigo-400/10",
    cardTint:
      "bg-[linear-gradient(135deg,rgba(99,102,241,0.13),rgba(168,85,247,0.05)_45%,transparent_75%)]",
    blob: "bg-indigo-500/20",
    bar: "from-indigo-400 to-purple-400",
    dot: "bg-indigo-400",
  },
  social: {
    iconTile: "from-fuchsia-500 to-pink-500",
    iconShadow: "shadow-fuchsia-500/30",
    text: "text-fuchsia-300",
    chipBorder: "border-fuchsia-400/20",
    chipBg: "bg-fuchsia-400/10",
    cardTint:
      "bg-[linear-gradient(135deg,rgba(217,70,239,0.13),rgba(236,72,153,0.05)_45%,transparent_75%)]",
    blob: "bg-fuchsia-500/20",
    bar: "from-fuchsia-400 to-pink-400",
    dot: "bg-fuchsia-400",
  },
};

/* ------------------------------------------------------------------ */
/*  Per-category Lucide icon (matches marketing landing)              */
/* ------------------------------------------------------------------ */

const CATEGORY_ICON: Record<ToolCategory, LucideIcon> = {
  pdf: Lucide.FileText,
  developer: Lucide.Code2,
  "network-security": Lucide.ShieldCheck,
  ai: Lucide.Sparkles,
  calculators: Lucide.Calculator,
  image: Lucide.Image,
  text: Lucide.Type,
  seo: Lucide.TrendingUp,
  "audio-video": Lucide.Music,
  file: Lucide.FolderTree,
  business: Lucide.Briefcase,
  education: Lucide.GraduationCap,
  social: Lucide.Share2,
};

/* Short labels (≤ 8 chars so the category pills don't overflow). */
const CATEGORY_SHORT: Record<ToolCategory, string> = {
  pdf: "PDF",
  developer: "Dev",
  "network-security": "Security",
  ai: "AI",
  calculators: "Calc",
  image: "Image",
  text: "Text",
  seo: "SEO",
  "audio-video": "Media",
  file: "Files",
  business: "Business",
  education: "Edu",
  social: "Social",
};

const TAGLINES: Record<ToolCategory, string> = {
  pdf: "Merge, compress, convert & sign — entirely in-browser.",
  developer: "Formatters, encoders and debuggers with zero servers.",
  "network-security": "Keys, hashes and vaults that never touch a network.",
  ai: "On-device helpers — no API keys required.",
  calculators: "Every calculator you will ever need, instant & exact.",
  image: "Resize, compress & convert pixels without a cloud.",
  text: "Count, convert, clean and compare any text.",
  seo: "Audit, preview & generate metadata like a pro.",
  "audio-video": "Trim, merge, convert audio & video locally.",
  file: "Inspect, convert, hash & archive files locally.",
  business: "Invoices, payroll, contracts & project tools.",
  education: "Flashcards, planners, math & science practice.",
  social: "Captions, bios, hashtags for every platform.",
};

/* ------------------------------------------------------------------ */
/*  Build categories from real catalog                                 */
/* ------------------------------------------------------------------ */

export interface Tool {
  id: string;
  name: string;
  blurb: string;
  icon: LucideIcon;
  hot?: boolean;
}

export interface Category {
  id: ToolCategory;
  label: string;
  short: string;
  icon: LucideIcon;
  count: number;
  tagline: string;
  iconTile: string;
  iconShadow: string;
  text: string;
  chipBorder: string;
  chipBg: string;
  cardTint: string;
  blob: string;
  bar: string;
  dot: string;
  tools: Tool[];
}

const allCounts = countByCategory();

/* A short, curated per-category list keeps the dashboard JSON small.
   The full catalog (1,679) is still searchable via ALL_TOOLS + command
   palette, so nothing is actually hidden from the user.               */
const MAX_TOOLS_PER_CATEGORY = 12;

/* Curated hot tool ids — these always appear in their category card.   */
const HOT_IDS = new Set<string>([
  "json-formatter",
  "base64",
  "uuid-generator",
  "hash-generator",
  "url-encoder",
  "regex-tester",
  "password-generator",
  "totp-generator",
  "aes-256-encryptor-decryptor",
  "jwt-decoder",
  "word-character-counter",
  "case-converter",
  "diff-checker",
  "lorem-ipsum-generator",
  "color-picker",
  "image-resizer",
  "image-compressor",
  "qr-code-generator-image",
  "compression-pdf",
  "merge-pdf",
  "split-pdf",
  "pdf-to-word",
  "pdf-merge",
  "pdf-split",
  "pdf-compress",
  "pdf-rotate",
  "pdf-to-images",
  "bmi-calculator",
  "emi-calculator",
  "mortgage-calculator",
  "percentage-calculator",
  "tip-calculator",
  "unit-converter-length",
  "temperature-converter",
  "scientific-calculator",
  "currency-converter",
  "discount-calculator",
  "calendar-perpetual",
  "age-calculator",
  "meta-tag-generator",
  "schema-jsonld-generator",
  "serp-snippet-preview",
  "xml-sitemap-generator",
  "robots-txt-generator",
  "utm-url-builder",
  "social-media-post-generator",
  "hashtag-generator",
  "caption-generator",
  "invoice-generator",
  "tax-calculator",
  "pomodoro-timer",
  "budget-planner",
  "flashcard-maker",
  "quiz-generator",
  "study-planner",
  "ai-prompt-improver",
  "ai-paraphrasing-rewriter-tool",
  "ai-regex-builder",
  "audio-trimmer",
  "audio-converter",
  "video-compressor",
  "video-trimmer",
  "file-hash-checker",
  "csv-to-json",
  "json-to-csv",
  "duplicate-file-finder",
  "hex-viewer",
]);

/**
 * Build the ToolCategory list of curated tools (HOT first, then alpha).
 * If the curated set is sparse, fall back to alphabetical to avoid empty cards.
 */
function buildCategoryTools(cat: ToolCategory): Tool[] {
  const items = REAL_CATALOG.filter((t) => t.category === cat && t.status !== "planned");
  const hot = items.filter((t) => HOT_IDS.has(t.id));
  const rest = items.filter((t) => !HOT_IDS.has(t.id));
  rest.sort((a, b) => a.name.localeCompare(b.name));

  const merged: typeof items = [];
  const seen = new Set<string>();
  for (const t of hot) {
    if (!seen.has(t.id)) {
      merged.push(t);
      seen.add(t.id);
    }
  }
  for (const t of rest) {
    if (!seen.has(t.id)) {
      merged.push(t);
      seen.add(t.id);
    }
    if (merged.length >= MAX_TOOLS_PER_CATEGORY) break;
  }

  return merged.slice(0, MAX_TOOLS_PER_CATEGORY).map((t) => ({
    id: t.id,
    name: t.name,
    blurb: t.description,
    icon: LucideIcon(t.icon, Lucide.Wrench),
    hot: HOT_IDS.has(t.id),
  }));
}

export const CATEGORIES: Category[] = (
  Object.keys(CATEGORY_LABELS) as ToolCategory[]
).map((id) => {
  const style = STYLE[id];
  return {
    id,
    label: CATEGORY_LABELS[id],
    short: CATEGORY_SHORT[id],
    icon: CATEGORY_ICON[id],
    count: allCounts[id] ?? 0,
    tagline: TAGLINES[id],
    iconTile: style.iconTile,
    iconShadow: style.iconShadow,
    text: style.text,
    chipBorder: style.chipBorder,
    chipBg: style.chipBg,
    cardTint: style.cardTint,
    blob: style.blob,
    bar: style.bar,
    dot: style.dot,
    tools: buildCategoryTools(id),
  };
});

export const TOTAL_TOOLS = REAL_CATALOG.length;

/* ------------------------------------------------------------------ */
/*  Flat tool list for command palette / directory                     */
/* ------------------------------------------------------------------ */

export interface FlatTool extends Tool {
  category: Category;
  href: string;
}

export const ALL_TOOLS: FlatTool[] = CATEGORIES.flatMap((category) =>
  category.tools.map((t) => ({
    ...t,
    category,
    href: `/tools/${t.id}`,
  }))
);

/** Exhaustive search across ALL tools in the catalog (not just the
 * 12-per-category curated subset). */
export const ALL_SEARCHABLE_TOOLS: FlatTool[] = REAL_CATALOG.map((t) => {
  const category = CATEGORIES.find((c) => c.id === t.category)!;
  return {
    id: t.id,
    name: t.name,
    blurb: t.description,
    icon: LucideIcon(t.icon, Lucide.Wrench),
    hot: HOT_IDS.has(t.id),
    category,
    href: `/tools/${t.id}`,
  };
});

export function findTool(id: string): FlatTool | undefined {
  return ALL_SEARCHABLE_TOOLS.find((t) => t.id === id);
}

/** Curated pinned chips — popular tools that live in the "Recent & Pinned" strip. */
export const RECENT_IDS: readonly string[] = [
  "json-formatter",
  "password-generator",
  "uuid-generator",
  "image-resizer",
  "qr-code-generator-image",
  "merge-pdf",
  "color-picker",
  "word-character-counter",
  "meta-tag-generator",
  "emi-calculator",
  "ai-prompt-improver",
  "video-compressor",
];

/* Mapping used by ToolModal / Directory — converts a tool id to a route. */
export function toolHref(id: string): string {
  return `/tools/${id}`;
}
