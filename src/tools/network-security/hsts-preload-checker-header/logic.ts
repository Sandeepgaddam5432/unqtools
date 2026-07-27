/**
 * HSTS Preload Checker & Header Generator — pure logic.
 */

export interface HSTSHeader {
  maxAge: number;
  includeSubDomains: boolean;
  preload: boolean;
  raw: string;
}

export interface PreloadChecklist {
  domain: string;
  isHttps: boolean;
  hasHsts: boolean;
  maxAgeSufficient: boolean;
  includesSubDomains: boolean;
  hasPreload: boolean;
  isPreloaded: boolean;
  issues: string[];
  ready: boolean;
}

export function generateHSTSHeader(maxAge: number, includeSubDomains: boolean, preload: boolean): string {
  let header = `Strict-Transport-Security: max-age=${maxAge}`;
  if (includeSubDomains) header += "; includeSubDomains";
  if (preload) header += "; preload";
  return header;
}

export function parseHSTSHeader(header: string): HSTSHeader | null {
  const match = header.match(/Strict-Transport-Security:\s*(.+)/i);
  const value = match ? match[1] : header;
  const maxAgeMatch = value.match(/max-age=(\d+)/i);
  if (!maxAgeMatch) return null;
  return {
    maxAge: parseInt(maxAgeMatch[1], 10),
    includeSubDomains: /includeSubDomains/i.test(value),
    preload: /preload/i.test(value),
    raw: value.trim(),
  };
}

export function checkPreloadEligibility(domain: string, hsts?: HSTSHeader | null): PreloadChecklist {
  const issues: string[] = [];
  const isHttps = domain.startsWith("https://");
  const domainClean = domain.replace(/^https?:\/\//, "").split("/")[0];
  if (!isHttps) issues.push("Domain must be served over HTTPS");
  const hasHsts = !!hsts;
  if (!hasHsts) issues.push("HSTS header not present");
  const maxAgeSufficient = hsts ? hsts.maxAge >= 31536000 : false;
  if (hasHsts && !maxAgeSufficient) issues.push(`max-age must be at least 31536000 (1 year), got ${hsts?.maxAge}`);
  const includesSubDomains = hsts?.includeSubDomains ?? false;
  if (hasHsts && !includesSubDomains) issues.push("includeSubDomains directive required");
  const hasPreload = hsts?.preload ?? false;
  if (hasHsts && !hasPreload) issues.push("preload directive required");
  return {
    domain: domainClean,
    isHttps,
    hasHsts,
    maxAgeSufficient,
    includesSubDomains,
    hasPreload,
    isPreloaded: false,
    issues,
    ready: isHttps && hasHsts && maxAgeSufficient && includesSubDomains && hasPreload,
  };
}

export function getPreloadSubmissionUrl(domain: string): string {
  return `https://hstspreload.org/?domain=${encodeURIComponent(domain)}`;
}

export function generateNginxConfig(hsts: HSTSHeader): string {
  return `# Nginx HSTS configuration
add_header Strict-Transport-Security "${hsts.raw}" always;`;
}

export function generateApacheConfig(hsts: HSTSHeader): string {
  return `# Apache HSTS configuration
Header always set Strict-Transport-Security "${hsts.raw}"`;
}

export function generateExpressConfig(hsts: HSTSHeader): string {
  return `// Express.js HSTS configuration
const helmet = require("helmet");
app.use(helmet.hsts({
  maxAge: ${hsts.maxAge},
  includeSubDomains: ${hsts.includeSubDomains},
  preload: ${hsts.preload}
}));`;
}

export function formatDuration(seconds: number): string {
  if (seconds < 3600) return `${Math.round(seconds / 60)} minutes`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)} hours`;
  if (seconds < 2592000) return `${Math.round(seconds / 86400)} days`;
  if (seconds < 31536000) return `${Math.round(seconds / 2592000)} months`;
  return `${Math.round(seconds / 31536000)} years`;
}

export function getMaxAgePresets(): { label: string; value: number }[] {
  return [
    { label: "5 minutes", value: 300 },
    { label: "1 hour", value: 3600 },
    { label: "1 day", value: 86400 },
    { label: "1 week", value: 604800 },
    { label: "1 month", value: 2592000 },
    { label: "6 months", value: 15768000 },
    { label: "1 year (recommended)", value: 31536000 },
    { label: "2 years (preload minimum)", value: 63072000 },
  ];
}
