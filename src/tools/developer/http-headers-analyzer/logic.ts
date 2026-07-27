/**
 * HTTP Headers Reference & Analyzer — pure logic.
 */

export interface HeaderInfo {
  name: string;
  value: string;
  category: string;
  description: string;
  security: boolean;
}

export interface AnalysisResult {
  headers: HeaderInfo[];
  securityHeaders: string[];
  missingSecurityHeaders: string[];
  cachingHeaders: string[];
  contentHeaders: string[];
  warnings: string[];
  score: number;
}

const HEADER_DB: Record<string, { category: string; description: string; security: boolean }> = {
  "content-security-policy": { category: "Security", description: "Prevents XSS, clickjacking, and code injection", security: true },
  "strict-transport-security": { category: "Security", description: "Forces HTTPS connections (HSTS)", security: true },
  "x-frame-options": { category: "Security", description: "Prevents clickjacking (legacy)", security: true },
  "x-content-type-options": { category: "Security", description: "Prevents MIME type sniffing", security: true },
  "referrer-policy": { category: "Security", description: "Controls referrer information", security: true },
  "permissions-policy": { category: "Security", description: "Controls browser features access", security: true },
  "cache-control": { category: "Caching", description: "Controls caching behavior", security: false },
  "expires": { category: "Caching", description: "Cache expiration date", security: false },
  "etag": { category: "Caching", description: "Cache validation token", security: false },
  "last-modified": { category: "Caching", description: "Last modification date", security: false },
  "content-type": { category: "Content", description: "MIME type of the response", security: false },
  "content-encoding": { category: "Content", description: "Compression method (gzip, br)", security: false },
  "content-length": { category: "Content", description: "Response body size in bytes", security: false },
  "set-cookie": { category: "Content", description: "Sets cookies with attributes", security: true },
  "location": { category: "Content", description: "Redirect target URL", security: false },
  "server": { category: "Server", description: "Server software (information leak)", security: false },
  "x-powered-by": { category: "Server", description: "Technology stack (information leak)", security: false },
};

const REQUIRED_SECURITY_HEADERS = [
  "content-security-policy",
  "strict-transport-security",
  "x-content-type-options",
  "referrer-policy",
];

export function parseHeaders(headerText: string): HeaderInfo[] {
  const headers: HeaderInfo[] = [];
  for (const line of headerText.split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const name = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    const lower = name.toLowerCase();
    const info = HEADER_DB[lower];
    headers.push({
      name,
      value,
      category: info?.category || "Other",
      description: info?.description || "",
      security: info?.security || false,
    });
  }
  return headers;
}

export function analyzeHeaders(headers: HeaderInfo[]): AnalysisResult {
  const present = new Set(headers.map((h) => h.name.toLowerCase()));
  const securityHeaders = headers.filter((h) => h.security).map((h) => h.name);
  const missingSecurityHeaders = REQUIRED_SECURITY_HEADERS.filter((h) => !present.has(h));
  const cachingHeaders = headers.filter((h) => h.category === "Caching").map((h) => h.name);
  const contentHeaders = headers.filter((h) => h.category === "Content").map((h) => h.name);
  const warnings: string[] = [];
  if (missingSecurityHeaders.length > 0) warnings.push(`Missing security headers: ${missingSecurityHeaders.join(", ")}`);
  if (present.has("server")) warnings.push("Server header reveals software info — consider removing");
  if (present.has("x-powered-by")) warnings.push("X-Powered-By reveals technology stack — consider removing");
  const score = Math.max(0, 100 - missingSecurityHeaders.length * 20 - (present.has("server") ? 5 : 0) - (present.has("x-powered-by") ? 5 : 0));
  return { headers, securityHeaders, missingSecurityHeaders, cachingHeaders, contentHeaders, warnings, score };
}

export function getScoreLabel(score: number): string {
  if (score >= 90) return "A+";
  if (score >= 80) return "A";
  if (score >= 70) return "B";
  if (score >= 60) return "C";
  if (score >= 50) return "D";
  return "F";
}

export function getAllHeaders(): { name: string; category: string; description: string }[] {
  return Object.entries(HEADER_DB).map(([name, info]) => ({ name, category: info.category, description: info.description }));
}
