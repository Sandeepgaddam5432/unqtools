/**
 * CSP (Content Security Policy) Generator — pure logic.
 */

export interface CSPDirective {
  name: string;
  sources: string[];
  enabled: boolean;
}

export interface CSPConfig {
  directives: CSPDirective[];
  reportOnly: boolean;
  reportUri?: string;
}

export function defaultConfig(): CSPConfig {
  return {
    directives: [
      { name: "default-src", sources: ["'self'"], enabled: true },
      { name: "script-src", sources: ["'self'"], enabled: true },
      { name: "style-src", sources: ["'self'", "'unsafe-inline'"], enabled: true },
      { name: "img-src", sources: ["'self'", "data:", "https:"], enabled: true },
      { name: "font-src", sources: ["'self'", "https:"], enabled: true },
      { name: "connect-src", sources: ["'self'"], enabled: true },
      { name: "media-src", sources: ["'self'"], enabled: true },
      { name: "frame-src", sources: ["'none'"], enabled: false },
      { name: "object-src", sources: ["'none'"], enabled: true },
      { name: "base-uri", sources: ["'self'"], enabled: true },
      { name: "form-action", sources: ["'self'"], enabled: true },
    ],
    reportOnly: false,
  };
}

export function generateCSP(config: CSPConfig): string {
  const parts: string[] = [];
  for (const d of config.directives) {
    if (d.enabled && d.sources.length > 0) {
      parts.push(`${d.name} ${d.sources.join(" ")}`);
    }
  }
  if (config.reportUri) parts.push(`report-uri ${config.reportUri}`);
  const header = config.reportOnly ? "Content-Security-Policy-Report-Only" : "Content-Security-Policy";
  return `${header}: ${parts.join("; ")}`;
}

export function parseCSP(header: string): CSPConfig | null {
  const match = header.match(/Content-Security-Policy(?:-Report-Only)?:\s*(.+)/i);
  if (!match) return null;
  const value = match[1].trim();
  const reportOnly = /Report-Only/i.test(header);
  const directives: CSPDirective[] = [];
  for (const part of value.split(";")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const [name, ...sources] = trimmed.split(/\s+/);
    directives.push({ name, sources, enabled: true });
  }
  return { directives, reportOnly };
}

export function validateCSP(config: CSPConfig): { issues: string[]; warnings: string[] } {
  const issues: string[] = [];
  const warnings: string[] = [];
  const defaultSrc = config.directives.find((d) => d.name === "default-src");
  if (!defaultSrc || !defaultSrc.enabled) issues.push("Missing default-src directive");
  const scriptSrc = config.directives.find((d) => d.name === "script-src");
  if (scriptSrc && scriptSrc.sources.includes("'unsafe-inline'")) warnings.push("script-src contains 'unsafe-inline' — consider using nonces or hashes");
  if (scriptSrc && scriptSrc.sources.includes("'unsafe-eval'")) warnings.push("script-src contains 'unsafe-eval' — reduces XSS protection");
  const objectSrc = config.directives.find((d) => d.name === "object-src");
  if (!objectSrc || !objectSrc.enabled) warnings.push("object-src not set — plugins can load from any source");
  return { issues, warnings };
}

export function getPresets(): { name: string; config: CSPConfig }[] {
  return [
    { name: "Strict", config: { directives: [
      { name: "default-src", sources: ["'none'"], enabled: true },
      { name: "script-src", sources: ["'self'"], enabled: true },
      { name: "style-src", sources: ["'self'"], enabled: true },
      { name: "img-src", sources: ["'self'"], enabled: true },
      { name: "connect-src", sources: ["'self'"], enabled: true },
    ], reportOnly: false } },
    { name: "WordPress", config: { directives: [
      { name: "default-src", sources: ["'self'"], enabled: true },
      { name: "script-src", sources: ["'self'", "'unsafe-inline'"], enabled: true },
      { name: "style-src", sources: ["'self'", "'unsafe-inline'"], enabled: true },
      { name: "img-src", sources: ["'self'", "data:", "https:"], enabled: true },
      { name: "font-src", sources: ["'self'", "data:"], enabled: true },
    ], reportOnly: false } },
    { name: "React App", config: { directives: [
      { name: "default-src", sources: ["'self'"], enabled: true },
      { name: "script-src", sources: ["'self'"], enabled: true },
      { name: "style-src", sources: ["'self'", "'unsafe-inline'"], enabled: true },
      { name: "img-src", sources: ["'self'", "data:"], enabled: true },
      { name: "connect-src", sources: ["'self'", "https:"], enabled: true },
    ], reportOnly: false } },
  ];
}

export function generateNginxConfig(csp: string): string {
  return `# Nginx CSP configuration\nadd_header Content-Security-Policy "${csp.replace(/^Content-Security-Policy:\s*/, "")}" always;`;
}

export function generateApacheConfig(csp: string): string {
  return `# Apache CSP configuration\nHeader always set Content-Security-Policy "${csp.replace(/^Content-Security-Policy:\s*/, "")}"`;
}

export function getDirectiveDescriptions(): Record<string, string> {
  return {
    "default-src": "Fallback for all resource types",
    "script-src": "JavaScript sources",
    "style-src": "Stylesheet sources",
    "img-src": "Image sources",
    "font-src": "Font sources",
    "connect-src": "XHR, WebSocket, EventSource",
    "media-src": "Audio/video sources",
    "frame-src": "iframe/frame sources",
    "object-src": "Plugin sources (Flash, Java)",
    "base-uri": "Allowed <base> element URIs",
    "form-action": "Form submission targets",
  };
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
    const result = generateCSP(input);
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
