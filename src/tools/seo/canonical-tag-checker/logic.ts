/**
 * Canonical Tag Checker — pure logic.
 * Canonical tag checker utilities.
 */

export interface CanonicalCheck {
  url: string;
  canonical: string | null;
  isSelfReferencing: boolean;
  isHttps: boolean;
  isCrossDomain: boolean;
  warnings: string[];
  errors: string[];
  htmlTag: string | null;
}

export function extractCanonical(html: string): string | null {
  // Match <link rel="canonical" href="...">
  const m = html.match(/<link\s+[^>]*rel=["']canonical["'][^>]*>/i);
  if (!m) return null;
  const hrefMatch = m[0].match(/href=["']([^"']+)["']/i);
  return hrefMatch ? hrefMatch[1] : null;
}

export function generateCanonicalTag(url: string): string {
  const escaped = url.replace(/"/g, "&quot;");
  return `<link rel="canonical" href="${escaped}" />`;
}

export function checkCanonical(url: string, html: string): CanonicalCheck {
  const warnings: string[] = [];
  const errors: string[] = [];
  const canonical = extractCanonical(html);
  let isSelfReferencing = false;
  let isHttps = false;
  let isCrossDomain = false;

  if (!canonical) {
    errors.push("No canonical tag found");
    return {
      url, canonical: null, isSelfReferencing: false, isHttps: false,
      isCrossDomain: false, warnings, errors, htmlTag: null,
    };
  }

  // Normalize URLs for comparison
  const normalizedUrl = normalizeUrl(url);
  const normalizedCanonical = normalizeUrl(canonical);
  isSelfReferencing = normalizedUrl === normalizedCanonical;

  isHttps = canonical.startsWith("https://");
  if (!isHttps) warnings.push("Canonical URL is not HTTPS");

  isCrossDomain = isDifferentDomain(url, canonical);
  if (isCrossDomain) warnings.push("Canonical URL is on a different domain");

  if (!isSelfReferencing && !isCrossDomain) {
    warnings.push("Canonical URL differs from page URL (same domain)");
  }

  // Check for multiple canonical tags
  const canonicalCount = (html.match(/<link\s+[^>]*rel=["']canonical["'][^>]*>/gi) || []).length;
  if (canonicalCount > 1) errors.push(`Multiple canonical tags found (${canonicalCount})`);

  return {
    url, canonical, isSelfReferencing, isHttps, isCrossDomain,
    warnings, errors, htmlTag: generateCanonicalTag(canonical),
  };
}

function normalizeUrl(url: string): string {
  let u = url.trim().toLowerCase();
  u = u.replace(/\/$/, ""); // remove trailing slash
  u = u.replace(/^(https?:)?\/\//, ""); // remove protocol
  return u;
}

function isDifferentDomain(a: string, b: string): boolean {
  try {
    const urlA = new URL(a);
    const urlB = new URL(b);
    return urlA.hostname !== urlB.hostname;
  } catch {
    return false;
  }
}

export function checkBulk(items: { url: string; html: string }[]): CanonicalCheck[] {
  return items.map((item) => checkCanonical(item.url, item.html));
}

export function validateCanonicalUrl(url: string): string[] {
  const errors: string[] = [];
  if (!url) errors.push("URL is required");
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") errors.push("Canonical URL should use HTTPS");
    if (u.hostname.length < 3) errors.push("Hostname seems invalid");
  } catch {
    errors.push("URL is not valid");
  }
  return errors;
}

export function exportReport(check: CanonicalCheck): string {
  return JSON.stringify(check, null, 2);
}
