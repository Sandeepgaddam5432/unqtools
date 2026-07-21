/**
 * GitHub Badge (shields.io) Generator — pure logic.
 *
 * Generate shields.io badge URLs with correct label/message/color escaping,
 * plus Markdown/HTML/RST/AsciiDoc embed snippets. Pure functions only —
 * no DOM, no network. The badge image itself is loaded by <img> in the UI
 * (img.shields.io is the only network hop).
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BadgeStyle =
  | "flat"
  | "flat-square"
  | "for-the-badge"
  | "plastic"
  | "social";

export type BadgeType =
  | "static"
  | "github-stars"
  | "github-forks"
  | "github-issues"
  | "github-watchers"
  | "github-last-commit"
  | "npm-version"
  | "npm-downloads"
  | "license"
  | "build-circleci"
  | "build-github-actions"
  | "coverage-codecov"
  | "dependencies-david";

export interface BadgeConfig {
  type: BadgeType;
  /** Static badge: left-side label. */
  label: string;
  /** Static badge: right-side message. */
  message: string;
  /** Named color or hex (with or without #). */
  color: string;
  /** Optional named color override for the label background. */
  labelColor?: string;
  /** Optional simple-icons slug (e.g. "github", "npm"). */
  logo?: string;
  /** Optional hex color for the logo (without #). */
  logoColor?: string;
  /** Badge style. */
  style: BadgeStyle;
  /** Optional clickable link wrapped around the badge. */
  link?: string;
  /** For dynamic badges: GitHub repo "owner/name". */
  repo?: string;
  /** For dynamic badges: npm package name. */
  npmPackage?: string;
  /** For build badges: CI workflow name or branch. */
  workflow?: string;
  /** For license badges: license type (MIT, Apache-2.0, GPL-3.0). */
  license?: string;
}

export interface GeneratedBadge {
  url: string;
  config: BadgeConfig;
  altText: string;
}

export interface BrandPreset {
  slug: string;
  label: string;
  color: string;
  logo: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const SHIELDS_BASE = "https://img.shields.io";

export const STYLES: BadgeStyle[] = [
  "flat",
  "flat-square",
  "for-the-badge",
  "plastic",
  "social",
];

export const STYLE_LABELS: Record<BadgeStyle, string> = {
  "flat": "Flat (default)",
  "flat-square": "Flat Square",
  "for-the-badge": "For The Badge",
  "plastic": "Plastic",
  "social": "Social",
};

export const NAMED_COLORS: string[] = [
  "brightgreen", "green", "yellowgreen", "yellow", "orange", "red",
  "blue", "lightgrey", "success", "important", "critical",
  "informational", "inactive", "blueviolet", "ff69b4", "9cf",
  "beeaed", "fedora",
];

export const BADGE_TYPES: BadgeType[] = [
  "static",
  "github-stars",
  "github-forks",
  "github-issues",
  "github-watchers",
  "github-last-commit",
  "npm-version",
  "npm-downloads",
  "license",
  "build-circleci",
  "build-github-actions",
  "coverage-codecov",
  "dependencies-david",
];

export const BADGE_TYPE_LABELS: Record<BadgeType, string> = {
  "static": "Static (custom label/message)",
  "github-stars": "GitHub Stars",
  "github-forks": "GitHub Forks",
  "github-issues": "GitHub Issues",
  "github-watchers": "GitHub Watchers",
  "github-last-commit": "GitHub Last Commit",
  "npm-version": "npm Version",
  "npm-downloads": "npm Downloads",
  "license": "License (MIT/Apache/GPL)",
  "build-circleci": "CircleCI Build",
  "build-github-actions": "GitHub Actions Build",
  "coverage-codecov": "Codecov Coverage",
  "dependencies-david": "David-DM Dependencies",
};

export const BRAND_PRESETS: BrandPreset[] = [
  { slug: "github", label: "GitHub", color: "181717", logo: "github" },
  { slug: "npm", label: "npm", color: "CB3837", logo: "npm" },
  { slug: "docker", label: "Docker", color: "2496ED", logo: "docker" },
  { slug: "react", label: "React", color: "61DAFB", logo: "react" },
  { slug: "vue", label: "Vue.js", color: "4FC08D", logo: "vuedotjs" },
  { slug: "node", label: "Node.js", color: "339933", logo: "nodedotjs" },
  { slug: "typescript", label: "TypeScript", color: "3178C6", logo: "typescript" },
  { slug: "python", label: "Python", color: "3776AB", logo: "python" },
  { slug: "rust", label: "Rust", color: "000000", logo: "rust" },
  { slug: "go", label: "Go", color: "00ADD8", logo: "go" },
  { slug: "linux", label: "Linux", color: "FCC624", logo: "linux" },
  { slug: "vscode", label: "VS Code", color: "007ACC", logo: "visualstudiocode" },
];

// ---------------------------------------------------------------------------
// Escaping
// ---------------------------------------------------------------------------

/**
 * Escape a single segment (label or message) per shields.io rules:
 *  - literal `-` becomes `--`
 *  - literal `_` becomes `__`
 *  - then `%20` encodes any remaining spaces (and other URL-unsafe chars
 *    via encodeURIComponent on the post-doubled string, but NOT doubling the
 *    percent sign of existing %20).
 *
 * Implementation: replace `_` → `__` and `-` → `--` first, then run
 * encodeURIComponent on the result so spaces become %20 and other unsafe
 * characters are encoded. We must NOT double-encode `%` so we do the doubling
 * before encoding.
 */
export function escapeSegment(s: string): string {
  if (s == null) return "";
  return encodeURIComponent(
    String(s)
      .replace(/_/g, "__")
      .replace(/-/g, "--"),
  );
}

/** Normalize a color value: strip leading `#`, lowercase. Empty → "". */
export function normalizeColor(color: string): string {
  if (!color) return "";
  const trimmed = color.trim();
  const withoutHash = trimmed.startsWith("#") ? trimmed.slice(1) : trimmed;
  return withoutHash.toLowerCase();
}

/** Validate hex color (3 or 6 hex digits) or named shields color. */
export function isValidColor(color: string): boolean {
  const c = normalizeColor(color);
  if (!c) return false;
  if (NAMED_COLORS.includes(c)) return true;
  return /^([0-9a-f]{3}|[0-9a-f]{6})$/.test(c);
}

/** Validate hex color for logoColor (only hex; named not allowed). */
export function isValidHexColor(color: string): boolean {
  const c = normalizeColor(color);
  if (!c) return false;
  return /^([0-9a-f]{3}|[0-9a-f]{6})$/.test(c);
}

/** Validate simple-icons slug — lowercase letters, digits, hyphens. */
export function isValidLogoSlug(slug: string): boolean {
  if (!slug) return false;
  return /^[a-z0-9][a-z0-9-]*$/.test(slug.trim());
}

/** Validate GitHub repo string "owner/name". */
export function isValidRepo(repo: string): boolean {
  if (!repo) return false;
  return /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/.test(repo.trim());
}

/** Validate npm package name (allow @scope/name). */
export function isValidNpmPackage(name: string): boolean {
  if (!name) return false;
  return /^(@[a-z0-9-]+\/)?[a-z0-9][a-z0-9._-]*$/.test(name.trim());
}

// ---------------------------------------------------------------------------
// URL construction
// ---------------------------------------------------------------------------

/** Build the query string for style, logo, logoColor, labelColor. */
export function buildQuery(config: BadgeConfig): string {
  const params: string[] = [];
  params.push(`style=${encodeURIComponent(config.style)}`);
  if (config.logo) params.push(`logo=${encodeURIComponent(config.logo)}`);
  if (config.logoColor) params.push(`logoColor=${encodeURIComponent(normalizeColor(config.logoColor))}`);
  if (config.labelColor) params.push(`labelColor=${encodeURIComponent(normalizeColor(config.labelColor))}`);
  return params.join("&");
}

/** Build the shields.io path (without query) for the badge type. */
export function buildPath(config: BadgeConfig): string {
  switch (config.type) {
    case "static":
    case "license":
      // Static-style path: query parameters hold label/message/color
      return "/static/v1";
    case "github-stars":
      return `/github/stars/${(config.repo || "").trim()}`;
    case "github-forks":
      return `/github/forks/${(config.repo || "").trim()}`;
    case "github-issues":
      return `/github/issues/${(config.repo || "").trim()}`;
    case "github-watchers":
      return `/github/watchers/${(config.repo || "").trim()}`;
    case "github-last-commit":
      return `/github/last-commit/${(config.repo || "").trim()}`;
    case "npm-version":
      return `/npm/v/${(config.npmPackage || "").trim()}`;
    case "npm-downloads":
      return `/npm/dm/${(config.npmPackage || "").trim()}`;
    case "build-circleci":
      return `/circleci/build/${(config.repo || "").trim()}`;
    case "build-github-actions": {
      const wf = (config.workflow || "").trim();
      const wfSuffix = wf ? `${wf}.yml` : "ci.yml";
      return `/github/actions/workflow/status/${(config.repo || "").trim()}/${wfSuffix}`;
    }
    case "coverage-codecov":
      return `/codecov/c/github/${(config.repo || "").trim()}`;
    case "dependencies-david":
      return `/david/${(config.repo || "").trim()}`;
    default:
      return "/static/v1";
  }
}

/** Build the per-type query params (label/message/color for static badges). */
export function buildTypeQuery(config: BadgeConfig): string[] {
  const out: string[] = [];
  if (config.type === "static") {
    const label = escapeSegment(config.label || "");
    const message = escapeSegment(config.message || "");
    const color = normalizeColor(config.color) || "lightgrey";
    out.push(`label=${label}`);
    out.push(`message=${message}`);
    out.push(`color=${color}`);
    if (config.labelColor) {
      out.push(`labelColor=${normalizeColor(config.labelColor)}`);
    }
  } else if (config.type === "license") {
    const lic = (config.license || "MIT").trim().toLowerCase();
    const color = lic === "mit" ? "brightgreen" : lic === "apache-2.0" ? "blue" : "red";
    out.push(`label=license`);
    out.push(`message=${encodeURIComponent((config.license || "MIT").trim())}`);
    out.push(`color=${color}`);
  }
  return out;
}

/** Generate the full shields.io badge URL for a config. */
export function generateBadge(config: BadgeConfig): GeneratedBadge {
  const path = buildPath(config);
  const typeQuery = buildTypeQuery(config);
  const styleQuery = buildQuery(config);
  const allQuery = [...typeQuery, ...styleQuery.split("&")].filter(Boolean);
  const queryStr = allQuery.length > 0 ? `?${allQuery.join("&")}` : "";
  const url = `${SHIELDS_BASE}${path}${queryStr}`;
  const altText = buildAltText(config);
  return { url, config, altText };
}

/** Build a friendly alt-text for the badge. */
export function buildAltText(config: BadgeConfig): string {
  switch (config.type) {
    case "static":
      return `${config.label || ""}: ${config.message || ""}`.trim();
    case "github-stars":
      return `GitHub Stars - ${config.repo || ""}`.trim();
    case "github-forks":
      return `GitHub Forks - ${config.repo || ""}`.trim();
    case "github-issues":
      return `GitHub Issues - ${config.repo || ""}`.trim();
    case "github-watchers":
      return `GitHub Watchers - ${config.repo || ""}`.trim();
    case "github-last-commit":
      return `GitHub Last Commit - ${config.repo || ""}`.trim();
    case "npm-version":
      return `npm Version - ${config.npmPackage || ""}`.trim();
    case "npm-downloads":
      return `npm Downloads - ${config.npmPackage || ""}`.trim();
    case "license":
      return `License - ${config.npmPackage || ""}`.trim();
    case "build-circleci":
      return `CircleCI Build - ${config.repo || ""}`.trim();
    case "build-github-actions":
      return `GitHub Actions Build - ${config.repo || ""}`.trim();
    case "coverage-codecov":
      return `Codecov Coverage - ${config.repo || ""}`.trim();
    case "dependencies-david":
      return `Dependencies - ${config.repo || ""}`.trim();
    default:
      return "Badge";
  }
}

// ---------------------------------------------------------------------------
// Embed snippets
// ---------------------------------------------------------------------------

export function renderMarkdown(badge: GeneratedBadge): string {
  const alt = badge.altText.replace(/[\[\]]/g, "");
  if (badge.config.link) {
    return `[![${alt}](${badge.url})](${badge.config.link})`;
  }
  return `![${alt}](${badge.url})`;
}

export function renderHtml(badge: GeneratedBadge): string {
  const alt = badge.altText.replace(/"/g, "&quot;");
  if (badge.config.link) {
    return `<a href="${badge.config.link}"><img src="${badge.url}" alt="${alt}" /></a>`;
  }
  return `<img src="${badge.url}" alt="${alt}" />`;
}

export function renderRst(badge: GeneratedBadge): string {
  const alt = badge.altText.replace(/[`]/g, "");
  if (badge.config.link) {
    return `.. image:: ${badge.url}\n   :alt: ${alt}\n   :target: ${badge.config.link}`;
  }
  return `.. image:: ${badge.url}\n   :alt: ${alt}`;
}

export function renderAsciiDoc(badge: GeneratedBadge): string {
  const alt = badge.altText.replace(/[=]/g, "");
  if (badge.config.link) {
    return `image:${badge.url}[${alt}, link=${badge.config.link}]`;
  }
  return `image:${badge.url}[${alt}]`;
}

/** Render a row of badges (markdown) — useful for README headers. */
export function renderRowMarkdown(badges: GeneratedBadge[]): string {
  return badges.map(renderMarkdown).join(" ");
}

/** Render a row of badges (HTML). */
export function renderRowHtml(badges: GeneratedBadge[]): string {
  return badges.map(renderHtml).join("\n");
}

// ---------------------------------------------------------------------------
// Brand presets
// ---------------------------------------------------------------------------

export function presetToConfig(preset: BrandPreset, message?: string): BadgeConfig {
  return {
    type: "static",
    label: preset.label,
    message: message || preset.label,
    color: preset.color,
    logo: preset.logo,
    style: "flat",
  };
}

export function findPreset(slug: string): BrandPreset | undefined {
  return BRAND_PRESETS.find((p) => p.slug === slug);
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

export interface BadgeStats {
  total: number;
  byType: Record<BadgeType, number>;
  withLogo: number;
  withLink: number;
}

export function computeStats(badges: GeneratedBadge[]): BadgeStats {
  const byType = {} as Record<BadgeType, number>;
  for (const t of BADGE_TYPES) byType[t] = 0;
  let withLogo = 0;
  let withLink = 0;
  for (const b of badges) {
    byType[b.config.type] += 1;
    if (b.config.logo) withLogo += 1;
    if (b.config.link) withLink += 1;
  }
  return { total: badges.length, byType, withLogo, withLink };
}

// ---------------------------------------------------------------------------
// Default config
// ---------------------------------------------------------------------------

export function defaultConfig(): BadgeConfig {
  return {
    type: "static",
    label: "build",
    message: "passing",
    color: "brightgreen",
    style: "flat",
  };
}

export function defaultDynamicConfig(type: BadgeType): BadgeConfig {
  return {
    type,
    label: "",
    message: "",
    color: "blue",
    style: "flat",
    repo: "owner/repo",
    npmPackage: "npm",
    workflow: "ci",
    license: "MIT",
  };
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:github-badge-shields:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  type: BadgeType;
  url: string;
  altText: string;
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

// ---------------------------------------------------------------------------
// Shareable URL
// ---------------------------------------------------------------------------

export function buildShareUrl(config: BadgeConfig): string {
  const params = new URLSearchParams();
  params.set("type", config.type);
  if (config.label) params.set("label", config.label);
  if (config.message) params.set("message", config.message);
  if (config.color) params.set("color", config.color);
  if (config.labelColor) params.set("labelColor", config.labelColor);
  if (config.logo) params.set("logo", config.logo);
  if (config.logoColor) params.set("logoColor", config.logoColor);
  params.set("style", config.style);
  if (config.link) params.set("link", config.link);
  if (config.repo) params.set("repo", config.repo);
  if (config.npmPackage) params.set("pkg", config.npmPackage);
  if (config.workflow) params.set("wf", config.workflow);
  if (config.license) params.set("license", config.license);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): BadgeConfig {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return defaultConfig();
  const params = new URLSearchParams(clean);
  const style = (params.get("style") as BadgeStyle) || "flat";
  const type = (params.get("type") as BadgeType) || "static";
  const validTypes = BADGE_TYPES;
  const validStyles = STYLES;
  return {
    type: validTypes.includes(type) ? type : "static",
    label: params.get("label") ?? "",
    message: params.get("message") ?? "",
    color: params.get("color") ?? "",
    labelColor: params.get("labelColor") ?? undefined,
    logo: params.get("logo") ?? undefined,
    logoColor: params.get("logoColor") ?? undefined,
    style: validStyles.includes(style) ? style : "flat",
    link: params.get("link") ?? undefined,
    repo: params.get("repo") ?? undefined,
    npmPackage: params.get("pkg") ?? undefined,
    workflow: params.get("wf") ?? undefined,
    license: params.get("license") ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// Validation summary
// ---------------------------------------------------------------------------

export interface ValidationIssue {
  field: string;
  message: string;
  severity: "error" | "warn";
}

export function validateConfig(config: BadgeConfig): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  if (config.type === "static") {
    if (!config.label.trim()) {
      out.push({ field: "label", message: "Label is required for static badges", severity: "error" });
    }
    if (!config.message.trim()) {
      out.push({ field: "message", message: "Message is required for static badges", severity: "error" });
    }
  }
  if (config.color && !isValidColor(config.color)) {
    out.push({ field: "color", message: "Color must be a named color or hex (3 or 6 digits)", severity: "error" });
  }
  if (config.logoColor && !isValidHexColor(config.logoColor)) {
    out.push({ field: "logoColor", message: "logoColor must be a hex color (3 or 6 digits)", severity: "error" });
  }
  if (config.logo && !isValidLogoSlug(config.logo)) {
    out.push({ field: "logo", message: "Logo must be a simple-icons slug (lowercase letters, digits, hyphens)", severity: "error" });
  }
  if (config.type.startsWith("github-")) {
    if (!config.repo || !isValidRepo(config.repo)) {
      out.push({ field: "repo", message: "GitHub badges require a repo in 'owner/name' format", severity: "error" });
    }
  }
  if (config.type.startsWith("npm-") || config.type === "license") {
    if (!config.npmPackage || !isValidNpmPackage(config.npmPackage)) {
      out.push({ field: "npmPackage", message: "npm badges require a valid package name", severity: "error" });
    }
  }
  if (config.type === "build-github-actions" && !config.workflow?.trim()) {
    out.push({ field: "workflow", message: "GitHub Actions build needs a workflow name (e.g. 'ci')", severity: "warn" });
  }
  if (config.link && !/^https?:\/\//.test(config.link)) {
    out.push({ field: "link", message: "Link should be an http(s) URL", severity: "warn" });
  }
  return out;
}
