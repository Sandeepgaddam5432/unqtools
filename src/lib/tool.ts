/**
 * Tool Module Contract — the single interface every UnQTools tool implements.
 * See: unqtools-docs / "8 Tool Module Contract & Architecture".
 *
 * v6.0: migrated from Preact to React (Next.js 16 App Router).
 */
import type { ComponentType } from "react";

export type ToolCategory =
  | "pdf"
  | "image"
  | "audio-video"
  | "developer"
  | "seo"
  | "calculators"
  | "text"
  | "network-security"
  | "file"
  | "business"
  | "education"
  | "social"
  | "ai";

export const ALL_CATEGORIES: readonly ToolCategory[] = [
  "pdf",
  "image",
  "audio-video",
  "developer",
  "seo",
  "calculators",
  "text",
  "network-security",
  "file",
  "business",
  "education",
  "social",
  "ai",
] as const;

export const CATEGORY_LABELS: Record<ToolCategory, string> = {
  pdf: "PDF & Document",
  image: "Image & Graphics",
  "audio-video": "Audio & Video",
  developer: "Developer & Code",
  seo: "SEO & Marketing",
  calculators: "Calculators & Converters",
  text: "Text & Writing",
  "network-security": "Network, Security & Privacy",
  file: "File Management, Archiving & Compression",
  business: "Business & Productivity",
  education: "Education & Learning",
  social: "Social Media",
  ai: "AI & Smart Tools",
};

export interface ToolManifest {
  /** Stable unique id, kebab-case. Used in the URL: /tools/<id> */
  id: string;
  /** Display name, e.g. "JSON Formatter" */
  name: string;
  /** One-line description for cards + meta description */
  description: string;
  /** Category bucket (drives nav + grouping) */
  category: ToolCategory;
  /** Search keywords / aliases */
  keywords: string[];
  /** Lucide icon name or inline svg id */
  icon: string;
  /** Does this tool need network? Default false (offline-capable) */
  requiresNetwork?: boolean;
  /** Lazy-loaded interactive UI (React client component).
   *  Optional in Phase 0 — added back in Phase 2 when UIs are rebuilt. */
  component?: () => Promise<{ default: ComponentType<Record<string, unknown>> }>;
  /** Optional: SEO long description / FAQ for the tool page */
  seo?: { title?: string; faq?: { q: string; a: string }[] };
  /** Status for the build tracker */
  status?: "planned" | "in-progress" | "done";
}

/**
 * Result type returned by every tool's pure logic function.
 * Either ok with an output, or an error with a human-readable message.
 */
export type ToolResult<T = string> = { ok: true; output: T } | { ok: false; error: string };
