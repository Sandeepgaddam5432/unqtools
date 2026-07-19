/**
 * PDF Accessibility Checker — pure logic.
 *
 * Pure functions only — no DOM, no pdf-lib. The actual PDF catalog and
 * content-stream scanning lives in ui.tsx; this module handles check
 * definitions, severity classification, standard mapping, compliance-level
 * calculation, multi-format rendering, history (localStorage), and shareable
 * URLs.
 */
import type { ToolResult } from "../../../lib/tool";

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

export type AccessibilityStandard =
  | "wcag-2.1-aa"
  | "wcag-2.1-aaa"
  | "pdf-ua-1"
  | "section-508"
  | "all";

export const STANDARDS: AccessibilityStandard[] = [
  "wcag-2.1-aa",
  "wcag-2.1-aaa",
  "pdf-ua-1",
  "section-508",
  "all",
];

export const STANDARD_LABELS: Record<AccessibilityStandard, string> = {
  "wcag-2.1-aa": "WCAG 2.1 AA",
  "wcag-2.1-aaa": "WCAG 2.1 AAA",
  "pdf-ua-1": "PDF/UA-1",
  "section-508": "Section 508",
  "all": "All standards",
};

export type CheckLevel = "errors-only" | "errors-and-warnings" | "full";

export const CHECK_LEVELS: CheckLevel[] = [
  "errors-only",
  "errors-and-warnings",
  "full",
];

export const CHECK_LEVEL_LABELS: Record<CheckLevel, string> = {
  "errors-only": "Errors only",
  "errors-and-warnings": "Errors + warnings",
  "full": "Full (errors, warnings, info)",
};

export type Severity = "error" | "warning" | "info";

export type CheckCategory =
  | "document"
  | "language"
  | "structure"
  | "images"
  | "forms"
  | "reading-order"
  | "contrast"
  | "navigation"
  | "metadata"
  | "interactive";

export const CATEGORY_LABELS: Record<CheckCategory, string> = {
  "document": "Document",
  "language": "Language",
  "structure": "Structure",
  "images": "Images",
  "forms": "Forms",
  "reading-order": "Reading order",
  "contrast": "Color contrast",
  "navigation": "Navigation",
  "metadata": "Metadata",
  "interactive": "Interactive",
};

export type CheckId =
  | "has-title"
  | "has-language"
  | "has-structure-tree"
  | "has-mark-info"
  | "images-have-alt-text"
  | "forms-have-labels"
  | "has-reading-order"
  | "color-contrast-sufficient"
  | "has-bookmarks"
  | "has-tab-order"
  | "has-metadata"
  | "has-display-doc-title";

export const CHECK_IDS: CheckId[] = [
  "has-title",
  "has-language",
  "has-structure-tree",
  "has-mark-info",
  "images-have-alt-text",
  "forms-have-labels",
  "has-reading-order",
  "color-contrast-sufficient",
  "has-bookmarks",
  "has-tab-order",
  "has-metadata",
  "has-display-doc-title",
];

export const CHECK_DESCRIPTIONS: Record<CheckId, string> = {
  "has-title": "Document has a title in the document info dictionary",
  "has-language": "Document declares a primary language in the catalog",
  "has-structure-tree": "Document has a structure tree root (PDF/UA requirement)",
  "has-mark-info": "Document is marked as tagged (MarkInfo/Marked = true)",
  "images-have-alt-text": "Images have alternative text via Alt or ActualText entries",
  "forms-have-labels": "Form fields have labels (TU entry) or tooltip text",
  "has-reading-order": "Pages define reading order via structure elements or /Tabs",
  "color-contrast-sufficient": "Text/background color pairs meet WCAG contrast ratios",
  "has-bookmarks": "Document has an outline (bookmarks) for multi-page navigation",
  "has-tab-order": "Annotations define a tab order (/Tabs entry on pages)",
  "has-metadata": "Document has an XMP metadata stream",
  "has-display-doc-title": "Viewer preferences request the document title in the window title bar",
};

/** WCAG success criteria mapping (informative). */
export const WCAG_CRITERIA: Record<CheckId, string> = {
  "has-title": "2.4.2 Page Titled",
  "has-language": "3.1.1 Language of Page",
  "has-structure-tree": "1.3.1 Info and Relationships",
  "has-mark-info": "1.3.1 Info and Relationships",
  "images-have-alt-text": "1.1.1 Non-text Content",
  "forms-have-labels": "3.3.2 Labels or Instructions",
  "has-reading-order": "1.3.2 Meaningful Sequence",
  "color-contrast-sufficient": "1.4.3 Contrast (Minimum)",
  "has-bookmarks": "2.4.5 Multiple Ways",
  "has-tab-order": "2.4.3 Focus Order",
  "has-metadata": "4.1.1 Parsing (well-formed metadata)",
  "has-display-doc-title": "2.4.2 Page Titled",
};

/** Mapping of which checks each standard requires. */
export const STANDARD_CHECKS: Record<AccessibilityStandard, CheckId[]> = {
  "wcag-2.1-aa": [
    "has-title",
    "has-language",
    "has-structure-tree",
    "images-have-alt-text",
    "forms-have-labels",
    "has-reading-order",
    "color-contrast-sufficient",
    "has-display-doc-title",
  ],
  "wcag-2.1-aaa": [
    "has-title",
    "has-language",
    "has-structure-tree",
    "images-have-alt-text",
    "forms-have-labels",
    "has-reading-order",
    "color-contrast-sufficient",
    "has-bookmarks",
    "has-display-doc-title",
  ],
  "pdf-ua-1": [
    "has-title",
    "has-language",
    "has-structure-tree",
    "has-mark-info",
    "images-have-alt-text",
    "forms-have-labels",
    "has-reading-order",
    "has-tab-order",
    "has-display-doc-title",
  ],
  "section-508": [
    "has-title",
    "has-language",
    "has-structure-tree",
    "images-have-alt-text",
    "forms-have-labels",
    "has-reading-order",
    "has-bookmarks",
  ],
  "all": CHECK_IDS.slice(),
};

export interface AccessibilityOptions {
  standard: AccessibilityStandard;
  checkLevel: CheckLevel;
  pageRange: string;
  includeRecommendations: boolean;
}

export const DEFAULT_OPTIONS: AccessibilityOptions = {
  standard: "all",
  checkLevel: "full",
  pageRange: "all",
  includeRecommendations: true,
};

/** Raw per-document data extracted from the PDF by ui.tsx. */
export interface DocumentA11yData {
  pageCount: number;
  hasTitle: boolean;
  title: string;
  hasLanguage: boolean;
  language: string;
  hasStructureTree: boolean;
  hasMarkInfo: boolean;
  marked: boolean;
  hasOutline: boolean;
  outlineCount: number;
  hasMetadata: boolean;
  hasDisplayDocTitle: boolean;
  hasAcroForm: boolean;
  formFieldCount: number;
  formFieldsWithLabel: number;
  imageCount: number;
  imagesWithAltText: number;
  pagesWithTabOrder: number;
  /** Per-page contrast results: count of failing pairs and lowest ratio. */
  contrastByPage: {
    pageNumber: number;
    pairsChecked: number;
    failingPairs: number;
    lowestRatio: number;
  }[];
  /** Per-page annotation count. */
  annotationsByPage: { pageNumber: number; count: number }[];
}

export interface CheckResult {
  id: CheckId;
  category: CheckCategory;
  severity: Severity;
  /** True if the check passed. */
  passed: boolean;
  /** Human-readable summary. */
  message: string;
  /** WCAG success criterion (informative). */
  wcagCriterion: string;
  /** 1-based page number (or 0 for document-level). */
  page: number;
  /** Detailed explanation (only for failures or when level=full). */
  detail?: string;
  /** Suggested fix. */
  recommendation?: string;
}

export interface ComplianceResult {
  standard: AccessibilityStandard;
  totalChecks: number;
  passedChecks: number;
  failedChecks: number;
  /** Compliance percentage 0–100. */
  compliancePct: number;
}

export interface SummaryStats {
  totalChecks: number;
  passed: number;
  failed: number;
  warnings: number;
  info: number;
  compliancePct: number;
  criticalIssues: number;
  byCategory: Record<CheckCategory, number>;
  byPage: { pageNumber: number; count: number }[];
}

export interface Recommendation {
  severity: Severity;
  category: CheckCategory;
  message: string;
}

export interface HistoryEntry {
  ts: number;
  fileName: string;
  pageCount: number;
  standard: AccessibilityStandard;
  compliancePct: number;
  criticalIssues: number;
}

// ---------------------------------------------------------------------------
// Page-range normalization
// ---------------------------------------------------------------------------

export function normalizePageRangeSpec(spec: string): string {
  const trimmed = (spec ?? "").trim().toLowerCase();
  if (!trimmed) return "all";
  if (trimmed === "all") return "all";
  return trimmed.replace(/\s+/g, " ");
}

export function resolveAllRange(spec: string, pageCount: number): string {
  const normalized = normalizePageRangeSpec(spec);
  if (normalized === "all") return pageCount > 0 ? `1-${pageCount}` : "1";
  return normalized;
}

// ---------------------------------------------------------------------------
// Color contrast analyzer (WCAG ratio)
// ---------------------------------------------------------------------------

export interface RGBColor { r: number; g: number; b: number; }

/** Convert a 0–1 RGB triple (PDF color space) to 0–255 integers. */
export function normalizeRgb(r: number, g: number, b: number): RGBColor {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v * 255)));
  return { r: clamp(r), g: clamp(g), b: clamp(b) };
}

/** Convert a hex string (#RGB or #RRGGBB) to RGB. */
export function hexToRgb(hex: string): RGBColor {
  const h = (hex ?? "").replace(/^#/, "");
  if (h.length === 3) {
    return {
      r: parseInt(h[0] + h[0], 16),
      g: parseInt(h[1] + h[1], 16),
      b: parseInt(h[2] + h[2], 16),
    };
  }
  if (h.length === 6) {
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
    };
  }
  return { r: 0, g: 0, b: 0 };
}

/** Convert RGB to a hex string. */
export function rgbToHex(rgb: RGBColor): string {
  const h = (n: number) => n.toString(16).padStart(2, "0");
  return `#${h(rgb.r)}${h(rgb.g)}${h(rgb.b)}`;
}

/** Relative luminance per WCAG 2.1. */
export function relativeLuminance(rgb: RGBColor): number {
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
}

/** WCAG contrast ratio between two colors (1.0–21.0). */
export function contrastRatio(a: RGBColor, b: RGBColor): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

/** True if a contrast ratio meets WCAG AA (4.5:1 for normal text). */
export function meetsAa(ratio: number): boolean {
  return ratio >= 4.5;
}

/** True if a contrast ratio meets WCAG AAA (7:1 for normal text). */
export function meetsAaa(ratio: number): boolean {
  return ratio >= 7;
}

/**
 * Classify a contrast ratio into a severity.
 * < 4.5 → error (fails AA)
 * 4.5–7 → warning (passes AA, fails AAA)
 * ≥ 7   → passed
 */
export function classifyContrast(ratio: number): Severity {
  if (ratio < 4.5) return "error";
  if (ratio < 7) return "warning";
  return "info"; // not an error
}

// ---------------------------------------------------------------------------
// Individual checkers
// ---------------------------------------------------------------------------

/** Check that the document has a non-empty title. */
export function checkTitle(data: DocumentA11yData): CheckResult {
  const passed = data.hasTitle && data.title.trim().length > 0;
  return {
    id: "has-title",
    category: "document",
    severity: passed ? "info" : "error",
    passed,
    message: passed ? `Document title: "${data.title}"` : "Document has no title.",
    wcagCriterion: WCAG_CRITERIA["has-title"],
    page: 0,
    detail: passed ? undefined : "Set a meaningful title using the Title field in the document's Info dictionary.",
    recommendation: passed ? undefined : "Add a concise, descriptive title (e.g. the document heading) to the PDF metadata.",
  };
}

/** Check that the document declares a primary language. */
export function checkLanguage(data: DocumentA11yData): CheckResult {
  const passed = data.hasLanguage && data.language.trim().length > 0;
  return {
    id: "has-language",
    category: "language",
    severity: passed ? "info" : "error",
    passed,
    message: passed ? `Document language: ${data.language}` : "Document has no declared language.",
    wcagCriterion: WCAG_CRITERIA["has-language"],
    page: 0,
    detail: passed ? undefined : "Set the /Lang entry in the document catalog (e.g. en-US, fr-FR).",
    recommendation: passed ? undefined : "Add the primary language tag to the document catalog so screen readers pronounce text correctly.",
  };
}

/** Check that the document has a structure tree (PDF/UA requirement). */
export function checkStructureTree(data: DocumentA11yData): CheckResult {
  const passed = data.hasStructureTree;
  return {
    id: "has-structure-tree",
    category: "structure",
    severity: passed ? "info" : "error",
    passed,
    message: passed ? "Structure tree (StructTreeRoot) present." : "No structure tree found — PDF is untagged.",
    wcagCriterion: WCAG_CRITERIA["has-structure-tree"],
    page: 0,
    detail: passed ? undefined : "Add tags to the PDF so structure (headings, paragraphs, lists, tables) is exposed to assistive technology.",
    recommendation: passed ? undefined : "Re-export the document from the source application with 'tagged PDF' enabled.",
  };
}

/** Check that the document is marked as tagged (MarkInfo/Marked = true). */
export function checkMarkInfo(data: DocumentA11yData): CheckResult {
  const passed = data.hasMarkInfo && data.marked;
  return {
    id: "has-mark-info",
    category: "structure",
    severity: passed ? "info" : "warning",
    passed,
    message: passed ? "Document is marked as tagged." : "Document is not marked as tagged (MarkInfo/Marked missing or false).",
    wcagCriterion: WCAG_CRITERIA["has-mark-info"],
    page: 0,
    detail: passed ? undefined : "Even if a structure tree exists, the MarkInfo flag must be true for readers to treat the PDF as tagged.",
    recommendation: passed ? undefined : "Set MarkInfo → Marked = true in the document catalog.",
  };
}

/** Check that images have alt text. */
export function checkImageAltText(data: DocumentA11yData): CheckResult {
  if (data.imageCount === 0) {
    return {
      id: "images-have-alt-text",
      category: "images",
      severity: "info",
      passed: true,
      message: "No images found in the document.",
      wcagCriterion: WCAG_CRITERIA["images-have-alt-text"],
      page: 0,
    };
  }
  const passed = data.imagesWithAltText === data.imageCount;
  const missing = data.imageCount - data.imagesWithAltText;
  return {
    id: "images-have-alt-text",
    category: "images",
    severity: passed ? "info" : "error",
    passed,
    message: passed
      ? `All ${data.imageCount} image(s) have alt text.`
      : `${missing} of ${data.imageCount} image(s) are missing alt text.`,
    wcagCriterion: WCAG_CRITERIA["images-have-alt-text"],
    page: 0,
    detail: passed ? undefined : "Add an /Alt entry (or /ActualText for decorative images) to each image XObject.",
    recommendation: passed ? undefined : "Provide concise alternative text for every informative image; mark decorative images with empty alt.",
  };
}

/** Check that form fields have labels. */
export function checkFormLabels(data: DocumentA11yData): CheckResult {
  if (!data.hasAcroForm || data.formFieldCount === 0) {
    return {
      id: "forms-have-labels",
      category: "forms",
      severity: "info",
      passed: true,
      message: "No interactive form fields found.",
      wcagCriterion: WCAG_CRITERIA["forms-have-labels"],
      page: 0,
    };
  }
  const passed = data.formFieldsWithLabel === data.formFieldCount;
  const missing = data.formFieldCount - data.formFieldsWithLabel;
  return {
    id: "forms-have-labels",
    category: "forms",
    severity: passed ? "info" : "error",
    passed,
    message: passed
      ? `All ${data.formFieldCount} form field(s) have labels.`
      : `${missing} of ${data.formFieldCount} form field(s) are missing labels (TU entry).`,
    wcagCriterion: WCAG_CRITERIA["forms-have-labels"],
    page: 0,
    detail: passed ? undefined : "Add a /TU (tooltip) entry to each form field describing its purpose.",
    recommendation: passed ? undefined : "Provide a descriptive label for every form field so screen-reader users understand what to enter.",
  };
}

/** Check that pages define a reading order (via structure elements or Tabs). */
export function checkReadingOrder(data: DocumentA11yData): CheckResult {
  const passed = data.hasStructureTree || data.pagesWithTabOrder > 0;
  return {
    id: "has-reading-order",
    category: "reading-order",
    severity: passed ? "info" : "warning",
    passed,
    message: passed
      ? "Reading order is defined (structure tree or tab order present)."
      : "No reading order defined — screen readers may read content in document order, which can be confusing.",
    wcagCriterion: WCAG_CRITERIA["has-reading-order"],
    page: 0,
    detail: passed ? undefined : "Tag the document or set /Tabs on pages so reading order follows the visual layout.",
    recommendation: passed ? undefined : "Add structure tags with proper BDC/EMC sequences or set /Tabs /S on each page.",
  };
}

/** Check color contrast across all pages. */
export function checkColorContrast(data: DocumentA11yData): CheckResult {
  if (data.contrastByPage.length === 0) {
    return {
      id: "color-contrast-sufficient",
      category: "contrast",
      severity: "info",
      passed: true,
      message: "No color pairs were tested for contrast.",
      wcagCriterion: WCAG_CRITERIA["color-contrast-sufficient"],
      page: 0,
    };
  }
  const failingPages = data.contrastByPage.filter((p) => p.failingPairs > 0);
  const totalFailing = failingPages.reduce((acc, p) => acc + p.failingPairs, 0);
  const lowestRatio = data.contrastByPage.reduce(
    (min, p) => (p.lowestRatio < min ? p.lowestRatio : min),
    21,
  );
  const passed = totalFailing === 0;
  return {
    id: "color-contrast-sufficient",
    category: "contrast",
    severity: passed ? "info" : "error",
    passed,
    message: passed
      ? `All ${data.contrastByPage.reduce((a, p) => a + p.pairsChecked, 0)} text/background pairs meet WCAG AA.`
      : `${totalFailing} text/background pair(s) fail WCAG AA across ${failingPages.length} page(s). Lowest ratio: ${lowestRatio.toFixed(2)}:1.`,
    wcagCriterion: WCAG_CRITERIA["color-contrast-sufficient"],
    page: 0,
    detail: passed ? undefined : `Lowest ratio observed: ${lowestRatio.toFixed(2)}:1 (WCAG AA requires ≥4.5:1, AAA ≥7:1).`,
    recommendation: passed ? undefined : "Darken text colors or lighten backgrounds to reach at least 4.5:1 contrast.",
  };
}

/** Check that the document has bookmarks (outline). */
export function checkBookmarks(data: DocumentA11yData): CheckResult {
  if (data.pageCount <= 1) {
    return {
      id: "has-bookmarks",
      category: "navigation",
      severity: "info",
      passed: true,
      message: "Single-page document — bookmarks not required.",
      wcagCriterion: WCAG_CRITERIA["has-bookmarks"],
      page: 0,
    };
  }
  const passed = data.hasOutline && data.outlineCount > 0;
  return {
    id: "has-bookmarks",
    category: "navigation",
    severity: passed ? "info" : "warning",
    passed,
    message: passed
      ? `Document has ${data.outlineCount} bookmark(s).`
      : "Multi-page document has no bookmarks.",
    wcagCriterion: WCAG_CRITERIA["has-bookmarks"],
    page: 0,
    detail: passed ? undefined : "Add an outline (Outlines entry in the catalog) so users can jump between sections.",
    recommendation: passed ? undefined : "Generate bookmarks from heading styles when exporting the PDF.",
  };
}

/** Check that pages define a tab order (Tabs entry). */
export function checkTabOrder(data: DocumentA11yData): CheckResult {
  if (data.pageCount === 0) {
    return {
      id: "has-tab-order",
      category: "interactive",
      severity: "info",
      passed: true,
      message: "No pages to check.",
      wcagCriterion: WCAG_CRITERIA["has-tab-order"],
      page: 0,
    };
  }
  const passed = data.pagesWithTabOrder === data.pageCount;
  return {
    id: "has-tab-order",
    category: "interactive",
    severity: passed ? "info" : "warning",
    passed,
    message: passed
      ? "All pages define a tab order."
      : `${data.pagesWithTabOrder}/${data.pageCount} page(s) define a tab order.`,
    wcagCriterion: WCAG_CRITERIA["has-tab-order"],
    page: 0,
    detail: passed ? undefined : "Set /Tabs /S (or /R) on each page so keyboard users can navigate annotations in a sensible order.",
    recommendation: passed ? undefined : "Add /Tabs /S to each page dictionary to enable structure-based tab order.",
  };
}

/** Check that the document has XMP metadata. */
export function checkMetadata(data: DocumentA11yData): CheckResult {
  const passed = data.hasMetadata;
  return {
    id: "has-metadata",
    category: "metadata",
    severity: passed ? "info" : "warning",
    passed,
    message: passed ? "XMP metadata stream present." : "No XMP metadata stream found.",
    wcagCriterion: WCAG_CRITERIA["has-metadata"],
    page: 0,
    detail: passed ? undefined : "Add an XMP metadata stream to the document catalog for richer machine-readable metadata.",
    recommendation: passed ? undefined : "Include an XMP packet with dc:title, dc:creator, and pdf:Producer entries.",
  };
}

/** Check that viewer preferences request the document title in the title bar. */
export function checkDisplayDocTitle(data: DocumentA11yData): CheckResult {
  const passed = data.hasDisplayDocTitle;
  return {
    id: "has-display-doc-title",
    category: "document",
    severity: passed ? "info" : "warning",
    passed,
    message: passed
      ? "Viewer preferences request the document title in the window title bar."
      : "Viewer preferences do not request the document title in the window title bar.",
    wcagCriterion: WCAG_CRITERIA["has-display-doc-title"],
    page: 0,
    detail: passed ? undefined : "Set ViewerPreferences → DisplayDocTitle = true so the document title (not the filename) appears in the reader's title bar.",
    recommendation: passed ? undefined : "Add DisplayDocTitle = true to ViewerPreferences in the catalog.",
  };
}

// ---------------------------------------------------------------------------
// Run all checks
// ---------------------------------------------------------------------------

export function runAllChecks(data: DocumentA11yData): CheckResult[] {
  return [
    checkTitle(data),
    checkLanguage(data),
    checkStructureTree(data),
    checkMarkInfo(data),
    checkImageAltText(data),
    checkFormLabels(data),
    checkReadingOrder(data),
    checkColorContrast(data),
    checkBookmarks(data),
    checkTabOrder(data),
    checkMetadata(data),
    checkDisplayDocTitle(data),
  ];
}

// ---------------------------------------------------------------------------
// Filter by check level
// ---------------------------------------------------------------------------

/** Filter check results by the user's chosen check level. */
export function filterByLevel(results: CheckResult[], level: CheckLevel): CheckResult[] {
  if (level === "full") return results;
  if (level === "errors-and-warnings") {
    return results.filter((r) => r.severity === "error" || r.severity === "warning");
  }
  return results.filter((r) => r.severity === "error");
}

// ---------------------------------------------------------------------------
// Compliance calculation
// ---------------------------------------------------------------------------

/** Compute compliance for a single standard. */
export function computeCompliance(results: CheckResult[], standard: AccessibilityStandard): ComplianceResult {
  const requiredChecks = STANDARD_CHECKS[standard];
  const relevant = results.filter((r) => requiredChecks.includes(r.id));
  const totalChecks = relevant.length;
  const passedChecks = relevant.filter((r) => r.passed).length;
  const failedChecks = totalChecks - passedChecks;
  const compliancePct = totalChecks > 0 ? Math.round((passedChecks / totalChecks) * 100) : 0;
  return { standard, totalChecks, passedChecks, failedChecks, compliancePct };
}

/** Compute compliance for the user's selected standard (or all of them). */
export function computeAllCompliance(results: CheckResult[], standard: AccessibilityStandard): ComplianceResult[] {
  if (standard === "all") {
    return STANDARDS.filter((s) => s !== "all").map((s) => computeCompliance(results, s));
  }
  return [computeCompliance(results, standard)];
}

/** Standard comparator: which standards are most/least met. */
export function compareStandards(compliance: ComplianceResult[]): {
  best: ComplianceResult | null;
  worst: ComplianceResult | null;
} {
  if (compliance.length === 0) return { best: null, worst: null };
  const sorted = [...compliance].sort((a, b) => b.compliancePct - a.compliancePct);
  return { best: sorted[0], worst: sorted[sorted.length - 1] };
}

// ---------------------------------------------------------------------------
// Summary stats
// ---------------------------------------------------------------------------

export function computeSummaryStats(results: CheckResult[], pageCount: number): SummaryStats {
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed && r.severity === "error").length;
  const warnings = results.filter((r) => !r.passed && r.severity === "warning").length;
  const info = results.filter((r) => !r.passed && r.severity === "info").length;
  const compliancePct = total > 0 ? Math.round((passed / total) * 100) : 0;
  const criticalIssues = failed;

  const byCategory = {} as Record<CheckCategory, number>;
  for (const cat of Object.keys(CATEGORY_LABELS) as CheckCategory[]) byCategory[cat] = 0;
  for (const r of results) {
    if (!r.passed) byCategory[r.category] += 1;
  }

  const byPageMap = new Map<number, number>();
  for (const r of results) {
    if (r.passed) continue;
    const key = r.page > 0 ? r.page : 0; // 0 = document-level
    byPageMap.set(key, (byPageMap.get(key) ?? 0) + 1);
  }
  const byPage = Array.from(byPageMap.entries())
    .map(([pageNumber, count]) => ({ pageNumber, count }))
    .sort((a, b) => a.pageNumber - b.pageNumber);
  // Suppress unused pageCount warning when no per-page data exists.
  void pageCount;

  return {
    totalChecks: total,
    passed,
    failed,
    warnings,
    info,
    compliancePct,
    criticalIssues,
    byCategory,
    byPage,
  };
}

// ---------------------------------------------------------------------------
// Critical issue list
// ---------------------------------------------------------------------------

/** Return only the must-fix-before-publish issues (severity=error, failed). */
export function criticalIssues(results: CheckResult[]): CheckResult[] {
  return results.filter((r) => !r.passed && r.severity === "error");
}

// ---------------------------------------------------------------------------
// Recommendation generator
// ---------------------------------------------------------------------------

/** Generate best-practice recommendations from failed/warning checks. */
export function generateRecommendations(results: CheckResult[]): Recommendation[] {
  const out: Recommendation[] = [];
  for (const r of results) {
    if (r.passed) continue;
    if (r.recommendation) {
      out.push({
        severity: r.severity,
        category: r.category,
        message: r.recommendation,
      });
    }
  }
  // Sort by severity (errors first, then warnings, then info).
  const order: Record<Severity, number> = { error: 0, warning: 1, info: 2 };
  out.sort((a, b) => order[a.severity] - order[b.severity]);
  return out;
}

// ---------------------------------------------------------------------------
// Renderers
// ---------------------------------------------------------------------------

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function escapeHtml(s: string): string {
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Render the check results as a human-readable text report. */
export function renderTextReport(
  results: CheckResult[],
  summary: SummaryStats,
  compliance: ComplianceResult[],
): string {
  const lines: string[] = [];
  lines.push("PDF Accessibility Report");
  lines.push("========================");
  lines.push(`Total checks: ${summary.totalChecks}`);
  lines.push(`Passed: ${summary.passed} • Failed: ${summary.failed} • Warnings: ${summary.warnings} • Info: ${summary.info}`);
  lines.push(`Compliance: ${summary.compliancePct}% • Critical issues: ${summary.criticalIssues}`);
  lines.push("");
  lines.push("Compliance by standard:");
  for (const c of compliance) {
    lines.push(`  ${STANDARD_LABELS[c.standard]}: ${c.passedChecks}/${c.totalChecks} (${c.compliancePct}%)`);
  }
  lines.push("");
  lines.push("Issues by category:");
  for (const cat of Object.keys(CATEGORY_LABELS) as CheckCategory[]) {
    if (summary.byCategory[cat] > 0) {
      lines.push(`  ${CATEGORY_LABELS[cat]}: ${summary.byCategory[cat]}`);
    }
  }
  lines.push("");
  for (const r of results) {
    const status = r.passed ? "PASS" : r.severity.toUpperCase();
    lines.push(`[${status}] ${r.id} — ${CATEGORY_LABELS[r.category]}`);
    lines.push(`  WCAG: ${r.wcagCriterion}`);
    lines.push(`  ${r.message}`);
    if (r.detail) lines.push(`  Detail: ${r.detail}`);
    if (r.recommendation) lines.push(`  Recommendation: ${r.recommendation}`);
    lines.push("");
  }
  return lines.join("\n");
}

/** Render the check results as CSV: check_id, status, severity, page, category, message. */
export function renderCsvReport(results: CheckResult[]): string {
  const lines: string[] = [
    "check_id,category,status,severity,page,wcag,message",
  ];
  for (const r of results) {
    const status = r.passed ? "pass" : "fail";
    lines.push([
      r.id,
      r.category,
      status,
      r.severity,
      r.page,
      escapeCsv(r.wcagCriterion),
      escapeCsv(r.message),
    ].join(","));
  }
  return lines.join("\n");
}

/** Render a full structured JSON report. */
export function renderJsonReport(
  results: CheckResult[],
  summary: SummaryStats,
  compliance: ComplianceResult[],
): string {
  return JSON.stringify(
    {
      summary: {
        totalChecks: summary.totalChecks,
        passed: summary.passed,
        failed: summary.failed,
        warnings: summary.warnings,
        info: summary.info,
        compliancePct: summary.compliancePct,
        criticalIssues: summary.criticalIssues,
      },
      compliance: compliance.map((c) => ({
        standard: c.standard,
        label: STANDARD_LABELS[c.standard],
        passedChecks: c.passedChecks,
        totalChecks: c.totalChecks,
        compliancePct: c.compliancePct,
      })),
      byCategory: summary.byCategory,
      byPage: summary.byPage,
      checks: results.map((r) => ({
        id: r.id,
        category: r.category,
        severity: r.severity,
        passed: r.passed,
        message: r.message,
        wcagCriterion: r.wcagCriterion,
        page: r.page,
        detail: r.detail,
        recommendation: r.recommendation,
      })),
    },
    null,
    2,
  );
}

/** Render an HTML report with a per-check table and severity colors. */
export function renderHtmlReport(
  results: CheckResult[],
  summary: SummaryStats,
  compliance: ComplianceResult[],
): string {
  const sevColor: Record<Severity, string> = {
    error: "#dc2626",
    warning: "#d97706",
    info: "#2563eb",
  };
  const rows = results.map((r) => `
    <tr>
      <td>${escapeHtml(r.id)}</td>
      <td>${escapeHtml(CATEGORY_LABELS[r.category])}</td>
      <td style="color:${r.passed ? "#16a34a" : sevColor[r.severity]};font-weight:600">${r.passed ? "PASS" : r.severity.toUpperCase()}</td>
      <td>${escapeHtml(r.wcagCriterion)}</td>
      <td>${r.page > 0 ? r.page : "—"}</td>
      <td>${escapeHtml(r.message)}</td>
    </tr>`).join("");

  const complianceRows = compliance.map((c) => `
    <div class="comp">
      <strong>${escapeHtml(STANDARD_LABELS[c.standard])}</strong><br/>
      ${c.passedChecks}/${c.totalChecks} (${c.compliancePct}%)
    </div>`).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>PDF Accessibility Report</title>
<style>
  body { font-family: -apple-system, system-ui, sans-serif; margin: 24px; color: #111; }
  h1 { font-size: 20px; }
  h2 { font-size: 16px; margin-top: 24px; }
  .comp-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 8px; font-size: 12px; }
  .comp { padding: 10px; background: #f3f4f6; border-radius: 6px; }
  table { border-collapse: collapse; width: 100%; font-size: 12px; }
  th, td { border: 1px solid #e5e7eb; padding: 6px 8px; text-align: left; vertical-align: top; }
  th { background: #f9fafb; }
  .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 8px; font-size: 12px; margin: 12px 0; }
  .summary div { padding: 8px; background: #f3f4f6; border-radius: 6px; }
</style>
</head>
<body>
<h1>PDF Accessibility Report</h1>
<div class="summary">
  <div><strong>Total checks</strong><br/>${summary.totalChecks}</div>
  <div><strong>Passed</strong><br/>${summary.passed}</div>
  <div><strong>Failed</strong><br/>${summary.failed}</div>
  <div><strong>Warnings</strong><br/>${summary.warnings}</div>
  <div><strong>Compliance</strong><br/>${summary.compliancePct}%</div>
  <div><strong>Critical issues</strong><br/>${summary.criticalIssues}</div>
</div>
<h2>Compliance by standard</h2>
<div class="comp-grid">${complianceRows}</div>
<h2>Check results</h2>
<table>
  <thead><tr><th>Check</th><th>Category</th><th>Status</th><th>WCAG</th><th>Page</th><th>Message</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:pdf-accessibility-checker:history";
const HISTORY_MAX = 20;

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
      // ignore quota errors
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

const VALID_STANDARDS = new Set<AccessibilityStandard>(STANDARDS);
const VALID_LEVELS = new Set<CheckLevel>(CHECK_LEVELS);

export function buildShareUrl(opts: AccessibilityOptions): string {
  const params = new URLSearchParams();
  if (opts.standard !== DEFAULT_OPTIONS.standard) params.set("standard", opts.standard);
  if (opts.checkLevel !== DEFAULT_OPTIONS.checkLevel) params.set("level", opts.checkLevel);
  if (opts.pageRange && opts.pageRange !== "all") params.set("range", opts.pageRange);
  if (opts.includeRecommendations !== DEFAULT_OPTIONS.includeRecommendations) params.set("recs", opts.includeRecommendations ? "1" : "0");
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<AccessibilityOptions> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Partial<AccessibilityOptions> = {};
  const std = params.get("standard");
  if (std && VALID_STANDARDS.has(std as AccessibilityStandard)) out.standard = std as AccessibilityStandard;
  const level = params.get("level");
  if (level && VALID_LEVELS.has(level as CheckLevel)) out.checkLevel = level as CheckLevel;
  const range = params.get("range");
  if (range) out.pageRange = range;
  const recs = params.get("recs");
  if (recs !== null) out.includeRecommendations = recs !== "0";
  return out;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function validateOptions(opts: AccessibilityOptions, pageCount: number): ToolResult<AccessibilityOptions> {
  if (!opts) return { ok: false, error: "Missing options." };
  if (!VALID_STANDARDS.has(opts.standard)) {
    return { ok: false, error: `Unknown accessibility standard: ${opts.standard}` };
  }
  if (!VALID_LEVELS.has(opts.checkLevel)) {
    return { ok: false, error: `Unknown check level: ${opts.checkLevel}` };
  }
  const normalized = normalizePageRangeSpec(opts.pageRange);
  if (normalized !== "all" && pageCount > 0) {
    if (!/^[0-9,\-\s]+$/.test(normalized)) {
      return { ok: false, error: `Invalid page range "${opts.pageRange}". Use "all" or e.g. "1-3, 5, 8-".` };
    }
  }
  return { ok: true, output: { ...opts, pageRange: normalized } };
}
