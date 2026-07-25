/**
 * HTTP Header Parser — parse headers, validate, security recommendations.
 */
export interface ParsedHeader {
  name: string;
  value: string;
}

export interface SecurityIssue {
  level: "info" | "warning" | "critical";
  message: string;
}

export interface HeaderAnalysis {
  headers: ParsedHeader[];
  issues: SecurityIssue[];
  recommendationCount: number;
}

const HEADER_LINE = /^([A-Za-z][A-Za-z0-9-]*)\s*:\s*(.*)$/;

/** Parse raw header text into name/value pairs. */
export function parseHeaders(raw: string): ParsedHeader[] {
  if (!raw) return [];
  const out: ParsedHeader[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const m = HEADER_LINE.exec(trimmed);
    if (!m) continue;
    out.push({ name: m[1]!, value: m[2]!.trim() });
  }
  return out;
}

/** Normalize a header name to lowercase kebab-case. */
export function normalizeHeaderName(name: string): string {
  return name.toLowerCase().trim();
}

/** Check whether a header name is a known standard HTTP header. */
export function isStandardHeader(name: string): boolean {
  const standard = [
    "accept", "accept-charset", "accept-encoding", "accept-language",
    "authorization", "cache-control", "connection", "content-type",
    "content-length", "cookie", "date", "etag", "expect", "forwarded",
    "host", "if-match", "if-modified-since", "if-none-match", "origin",
    "referer", "user-agent", "via", "warning",
    // security
    "strict-transport-security", "content-security-policy", "x-frame-options",
    "x-content-type-options", "referrer-policy", "permissions-policy",
    "x-xss-protection",
  ];
  return standard.includes(normalizeHeaderName(name));
}

/** Analyze parsed headers for security issues and recommendations. */
export function analyzeHeaders(headers: ParsedHeader[]): HeaderAnalysis {
  const issues: SecurityIssue[] = [];
  const map = new Map<string, string>();
  for (const h of headers) map.set(normalizeHeaderName(h.name), h.value);

  if (!map.has("strict-transport-security")) {
    issues.push({ level: "warning", message: "Missing Strict-Transport-Security (HSTS) header" });
  }
  if (!map.has("content-security-policy")) {
    issues.push({ level: "critical", message: "Missing Content-Security-Policy header" });
  }
  if (!map.has("x-frame-options") && !map.has("content-security-policy")) {
    issues.push({ level: "warning", message: "Missing X-Frame-Options or CSP frame-ancestors (clickjacking risk)" });
  }
  if (!map.has("x-content-type-options")) {
    issues.push({ level: "warning", message: "Missing X-Content-Type-Options: nosniff" });
  }
  if (!map.has("referrer-policy")) {
    issues.push({ level: "info", message: "Consider setting Referrer-Policy" });
  }
  const server = map.get("server");
  if (server && /\d/.test(server)) {
    issues.push({ level: "info", message: `Server header exposes version: "${server}"` });
  }
  return {
    headers,
    issues,
    recommendationCount: issues.length,
  };
}

/** Format the analysis as a plain-text report. */
export function formatReport(analysis: HeaderAnalysis): string {
  const lines: string[] = ["HTTP Header Analysis", "=".repeat(40), ""];
  for (const h of analysis.headers) lines.push(`${h.name}: ${h.value}`);
  lines.push("", "Recommendations:", "-".repeat(40));
  for (const i of analysis.issues) lines.push(`[${i.level.toUpperCase()}] ${i.message}`);
  return lines.join("\n");
}
