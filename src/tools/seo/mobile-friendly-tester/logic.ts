/**
 * Mobile-Friendly Tester — pure logic.
 *
 * Test mobile-friendliness from HTML: viewport meta, font size readability,
 * tap target spacing, content width, responsive images. Score 0-100 and
 * generate recommendations.
 *
 * Pure functions only — no DOM, no network.
 */

export type Rating = "pass" | "warn" | "fail";

export interface CheckResult {
  name: string;
  label: string;
  rating: Rating;
  score: number; // 0-100 contribution
  details: string;
  recommendation: string;
}

export interface MobileResult {
  checks: CheckResult[];
  score: number;
  rating: Rating;
  passCount: number;
  warnCount: number;
  failCount: number;
  recommendations: string[];
  viewportContent: string | null;
  hasViewport: boolean;
}

/** Extract the viewport meta tag content. */
export function extractViewport(html: string): { content: string | null; tag: string | null } {
  if (!html) return { content: null, tag: null };
  const re = /<meta\s+[^>]*name\s*=\s*["']viewport["'][^>]*>/gi;
  const match = re.exec(html);
  if (!match) return { content: null, tag: null };
  const tag = match[0];
  const contentMatch = /content\s*=\s*["']([^"']*)["']/i.exec(tag);
  if (!contentMatch) return { content: null, tag };
  return { content: contentMatch[1], tag };
}

/** Check viewport meta. */
export function checkViewport(html: string): CheckResult {
  const { content } = extractViewport(html);
  if (!content) {
    return {
      name: "viewport",
      label: "Viewport meta tag",
      rating: "fail",
      score: 0,
      details: "Missing viewport meta tag.",
      recommendation: "Add <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"> to the <head>.",
    };
  }
  const c = content.toLowerCase();
  const hasWidthDevice = c.includes("width=device-width") || c.includes("width=device-width");
  const hasInitialScale = c.includes("initial-scale");
  if (hasWidthDevice && hasInitialScale) {
    return {
      name: "viewport",
      label: "Viewport meta tag",
      rating: "pass",
      score: 25,
      details: `Viewport meta present: ${content}`,
      recommendation: "Viewport is properly configured.",
    };
  }
  if (hasWidthDevice || hasInitialScale) {
    return {
      name: "viewport",
      label: "Viewport meta tag",
      rating: "warn",
      score: 12,
      details: `Viewport meta present but incomplete: ${content}`,
      recommendation: "Use content=\"width=device-width, initial-scale=1\" for full mobile support.",
    };
  }
  return {
    name: "viewport",
    label: "Viewport meta tag",
    rating: "fail",
    score: 3,
    details: `Viewport meta present but missing critical directives: ${content}`,
    recommendation: "Use content=\"width=device-width, initial-scale=1\".",
  };
}

/** Extract inline font-size declarations from <style> and inline style attributes. */
export function extractFontSizes(html: string): number[] {
  if (!html) return [];
  const sizes: number[] = [];
  // Inline style="font-size: 14px"
  const inlineRe = /font-size\s*:\s*(\d+(?:\.\d+)?)\s*px/gi;
  let m: RegExpExecArray | null;
  while ((m = inlineRe.exec(html)) !== null) {
    const n = parseFloat(m[1]);
    if (Number.isFinite(n)) sizes.push(n);
  }
  return sizes;
}

/** Check font-size readability. Mobile font sizes should be ≥16px for body text. */
export function checkFontSizes(html: string): CheckResult {
  const sizes = extractFontSizes(html);
  if (sizes.length === 0) {
    return {
      name: "font-size",
      label: "Font size readability",
      rating: "warn",
      score: 10,
      details: "No inline font-size declarations found. Verify via CSS that body text is ≥16px.",
      recommendation: "Ensure body text is at least 16px (1rem) for readability on mobile devices.",
    };
  }
  const tooSmall = sizes.filter((s) => s < 12);
  const small = sizes.filter((s) => s >= 12 && s < 16);
  const ok = sizes.filter((s) => s >= 16);
  if (tooSmall.length > 0) {
    return {
      name: "font-size",
      label: "Font size readability",
      rating: "fail",
      score: 5,
      details: `${tooSmall.length} of ${sizes.length} font sizes are below 12px (too small for mobile).`,
      recommendation: "Increase font sizes below 12px to at least 16px for body text. Small fonts are hard to read on mobile.",
    };
  }
  if (small.length > sizes.length / 2) {
    return {
      name: "font-size",
      label: "Font size readability",
      rating: "warn",
      score: 12,
      details: `${small.length} of ${sizes.length} font sizes are 12-16px. Consider increasing to ≥16px.`,
      recommendation: "Most font sizes are below 16px. Increase to at least 16px for better mobile readability.",
    };
  }
  return {
    name: "font-size",
    label: "Font size readability",
    rating: "pass",
    score: 20,
    details: `${ok.length} of ${sizes.length} font sizes are ≥16px.`,
    recommendation: "Font sizes look good for mobile readability.",
  };
}

/** Count <a> and <button> elements (rough tap-target proxy). */
export function countTapTargets(html: string): number {
  if (!html) return 0;
  const matches = html.match(/<(?:a|button)\b[^>]*>/gi);
  return matches ? matches.length : 0;
}

/** Check tap target density. Too many tap targets packed tightly = bad UX. */
export function checkTapTargets(html: string): CheckResult {
  const count = countTapTargets(html);
  if (count === 0) {
    return {
      name: "tap-targets",
      label: "Tap target spacing",
      rating: "warn",
      score: 10,
      details: "No <a> or <button> elements detected.",
      recommendation: "Ensure tap targets are at least 48×48px (Apple) / 24×24px (Google) with adequate spacing.",
    };
  }
  // Heuristic: extract inline width/height from tap targets
  const targets = html.match(/<(?:a|button)\b[^>]*>/gi) ?? [];
  const smallTargets = targets.filter((t) => {
    const wMatch = /width\s*=\s*["']?(\d+)/i.exec(t);
    const hMatch = /height\s*=\s*["']?(\d+)/i.exec(t);
    if (wMatch && hMatch) {
      const w = parseInt(wMatch[1], 10);
      const h = parseInt(hMatch[1], 10);
      return w < 48 || h < 48;
    }
    return false;
  });
  if (smallTargets.length > 0) {
    return {
      name: "tap-targets",
      label: "Tap target spacing",
      rating: "warn",
      score: 12,
      details: `${smallTargets.length} of ${count} tap targets have explicit dimensions below 48×48px.`,
      recommendation: "Make tap targets at least 48×48px (Apple HIG) with 8px spacing between them.",
    };
  }
  return {
    name: "tap-targets",
    label: "Tap target spacing",
    rating: "pass",
    score: 15,
    details: `${count} tap target(s) detected. None have explicit sub-48px dimensions.`,
    recommendation: "Tap targets look properly sized.",
  };
}

/** Check responsive images — looking for srcset, sizes, or <picture> elements. */
export function checkResponsiveImages(html: string): CheckResult {
  if (!html) {
    return {
      name: "responsive-images",
      label: "Responsive images",
      rating: "warn",
      score: 10,
      details: "Empty input.",
      recommendation: "Use srcset, sizes, or <picture> elements for responsive images.",
    };
  }
  const imgs = html.match(/<img\b[^>]*>/gi) ?? [];
  if (imgs.length === 0) {
    return {
      name: "responsive-images",
      label: "Responsive images",
      rating: "warn",
      score: 10,
      details: "No <img> elements found.",
      recommendation: "If your page has images, use srcset or <picture> for responsive delivery.",
    };
  }
  const withSrcset = imgs.filter((t) => /\bsrcset\s*=/i.test(t));
  const withSizes = imgs.filter((t) => /\bsizes\s*=/i.test(t));
  const pictureTags = (html.match(/<picture\b/gi) ?? []).length;
  if (withSrcset.length === imgs.length && withSizes.length === imgs.length) {
    return {
      name: "responsive-images",
      label: "Responsive images",
      rating: "pass",
      score: 15,
      details: `All ${imgs.length} image(s) have srcset + sizes. ${pictureTags} <picture> element(s).`,
      recommendation: "Images are properly responsive.",
    };
  }
  if (withSrcset.length > 0 || pictureTags > 0) {
    return {
      name: "responsive-images",
      label: "Responsive images",
      rating: "warn",
      score: 10,
      details: `${withSrcset.length} of ${imgs.length} image(s) have srcset. ${pictureTags} <picture> element(s).`,
      recommendation: "Add srcset + sizes to all images for full responsive delivery.",
    };
  }
  return {
    name: "responsive-images",
    label: "Responsive images",
    rating: "fail",
    score: 5,
    details: `None of ${imgs.length} image(s) use srcset, sizes, or <picture>.`,
    recommendation: "Add srcset and sizes attributes (or use <picture>) so browsers can serve appropriately sized images.",
  };
}

/** Check content width — look for fixed-width containers > 980px. */
export function checkContentWidth(html: string): CheckResult {
  if (!html) {
    return {
      name: "content-width",
      label: "Content width",
      rating: "warn",
      score: 10,
      details: "Empty input.",
      recommendation: "Use percentage or max-width for containers; avoid fixed pixel widths above 980px.",
    };
  }
  // Find width: 1200px etc.
  const widthRe = /(?:^|[^-])width\s*:\s*(\d+)\s*px/gi;
  const widths: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = widthRe.exec(html)) !== null) {
    const n = parseInt(m[1], 10);
    if (Number.isFinite(n) && n > 320) widths.push(n);
  }
  const tooWide = widths.filter((w) => w > 980);
  if (tooWide.length > 0) {
    return {
      name: "content-width",
      label: "Content width",
      rating: "fail",
      score: 5,
      details: `${tooWide.length} fixed-width element(s) wider than 980px detected (max: ${Math.max(...tooWide)}px).`,
      recommendation: "Avoid fixed-width containers wider than the device. Use max-width: 100% or media queries.",
    };
  }
  if (widths.length > 0) {
    return {
      name: "content-width",
      label: "Content width",
      rating: "pass",
      score: 15,
      details: `${widths.length} fixed-width element(s), all ≤980px (max: ${widths.length > 0 ? Math.max(...widths) : 0}px).`,
      recommendation: "Content widths look fine. Consider using relative units (%, vw) for fully fluid layouts.",
    };
  }
  return {
    name: "content-width",
    label: "Content width",
    rating: "pass",
    score: 15,
    details: "No problematic fixed-width elements detected.",
    recommendation: "Content uses relative widths — good for mobile.",
  };
}

/** Run all checks and compute the overall score. */
export function analyze(html: string): MobileResult {
  const checks: CheckResult[] = [
    checkViewport(html),
    checkFontSizes(html),
    checkTapTargets(html),
    checkResponsiveImages(html),
    checkContentWidth(html),
  ];
  const totalScore = checks.reduce((acc, c) => acc + c.score, 0);
  const maxScore = 90; // viewport 25 + fonts 20 + tap 15 + img 15 + width 15
  const score = Math.min(100, Math.round((totalScore / maxScore) * 100));
  const passCount = checks.filter((c) => c.rating === "pass").length;
  const warnCount = checks.filter((c) => c.rating === "warn").length;
  const failCount = checks.filter((c) => c.rating === "fail").length;
  let rating: Rating;
  if (failCount > 0) rating = score >= 60 ? "warn" : "fail";
  else if (warnCount > 0) rating = "warn";
  else rating = "pass";
  const viewportInfo = extractViewport(html);
  const recommendations = checks
    .filter((c) => c.rating !== "pass")
    .map((c) => `[${c.label}] ${c.recommendation}`);
  return {
    checks,
    score,
    rating,
    passCount,
    warnCount,
    failCount,
    recommendations,
    viewportContent: viewportInfo.content,
    hasViewport: viewportInfo.content !== null,
  };
}

/** Render a plain-text report. */
export function renderReport(result: MobileResult): string {
  const lines: string[] = [];
  lines.push("Mobile-Friendly Test Report");
  lines.push("===========================");
  lines.push(`Score: ${result.score}/100 (${result.rating})`);
  lines.push(`Pass: ${result.passCount} · Warn: ${result.warnCount} · Fail: ${result.failCount}`);
  if (result.viewportContent) {
    lines.push(`Viewport: ${result.viewportContent}`);
  } else {
    lines.push("Viewport: MISSING");
  }
  lines.push("");
  lines.push("Checks:");
  for (const c of result.checks) {
    lines.push(`  [${c.rating.toUpperCase()}] ${c.label}: ${c.details}`);
  }
  if (result.recommendations.length > 0) {
    lines.push("");
    lines.push("Recommendations:");
    for (const r of result.recommendations) {
      lines.push(`  - ${r}`);
    }
  }
  return lines.join("\n");
}

/** Common mobile device dimensions for preview reference. */
export const DEVICE_DIMENSIONS = [
  { name: "iPhone SE", width: 375, height: 667 },
  { name: "iPhone 14", width: 390, height: 844 },
  { name: "iPhone 14 Pro Max", width: 430, height: 932 },
  { name: "Samsung Galaxy S22", width: 360, height: 780 },
  { name: "Google Pixel 7", width: 412, height: 915 },
  { name: "iPad Mini", width: 768, height: 1024 },
];

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:mobile-friendly-tester:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  score: number;
  rating: string;
  passCount: number;
  warnCount: number;
  failCount: number;
  hasViewport: boolean;
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

// ---- Shareable URL ----

export function buildShareUrl(payload: string): string {
  const params = new URLSearchParams();
  if (payload) params.set("data", payload);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): { data: string } {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { data: "" };
  const params = new URLSearchParams(clean);
  return { data: params.get("data") ?? "" };
}
