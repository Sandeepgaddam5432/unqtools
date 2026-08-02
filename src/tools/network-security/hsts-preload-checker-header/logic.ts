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

// ============================================================================
// Backward-compat stub exports (added to satisfy UI template imports).
// ============================================================================

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export function getStats(input: string, output: string): {
  inputSize: number;
  outputSize: number;
} {
  return {
    inputSize: new Blob([input]).size,
    outputSize: new Blob([output]).size,
  };
}

export function validate(input: string): string[] {
  const issues: string[] = [];
  if (!input || input.trim().length === 0) {
    issues.push("Input is empty.");
  }
  return issues;
}

export function process(input: string): { output: string; error: string | null } {
  try {
    const result = parseHSTSHeader(input);
    if (typeof result === "string") {
      return { output: result, error: null };
    }
    if (result && typeof result === "object") {
      const r = result as Record<string, unknown>;
      const output =
        (typeof r.output === "string" && r.output) ||
        (typeof r.html === "string" && r.html) ||
        (typeof r.result === "string" && r.result) ||
        (typeof r.text === "string" && r.text) ||
        (typeof r.code === "string" && r.code) ||
        (typeof r.value === "string" && r.value) ||
        JSON.stringify(result, null, 2);
      const error =
        (typeof r.error === "string" && r.error) ||
        (r.ok === false && typeof r.message === "string" && r.message) ||
        null;
      return { output, error };
    }
    return { output: String(result), error: null };
  } catch (e) {
    return { output: "", error: (e as Error).message };
  }
}
