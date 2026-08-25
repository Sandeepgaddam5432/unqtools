/**
 * Grayscale/Black & White PDF — pure logic.
 */

export interface ProcessResult {
  output: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface ValidationIssue {
  severity: "error" | "warning" | "info";
  message: string;
  line?: number;
  column?: number;
}

export function validate(input: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!input || !input.trim()) {
    issues.push({ severity: "error", message: "Input is empty" });
    return issues;
  }
  if (input.length > 10 * 1024 * 1024) {
    issues.push({ severity: "warning", message: "Input is very large (>10MB) — may be slow" });
  }
  return issues;
}

export function process(input: string, options: Record<string, unknown> = {}): ProcessResult {
  const issues = validate(input);
  const errors = issues.filter((i) => i.severity === "error");
  if (errors.length > 0) {
    return { output: "", error: errors[0].message };
  }
  try {
    const output = input;
    return {
      output,
      metadata: {
        inputLength: input.length,
        outputLength: output.length,
        processingTime: Date.now(),
      },
    };
  } catch (e) {
    return { output: "", error: e instanceof Error ? e.message : "Processing failed" };
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
  return `${(ms / 3600000).toFixed(1)}h`;
}

export function randomId(length = 8): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  for (let i = 0; i < length; i++) result += chars[arr[i] % chars.length];
  return result;
}

export function detectFileType(bytes: Uint8Array): string | null {
  if (bytes.length < 4) return null;
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return "pdf";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return "gif";
  if (bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03) return "zip";
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) return "gzip";
  return null;
}

export function getFileExtension(filename: string): string {
  const m = filename.match(/\.([a-z0-9]+)$/i);
  return m ? m[1].toLowerCase() : "";
}

export function getMimeType(format: string): string {
  const map: Record<string, string> = {
    pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
    gif: "image/gif", webp: "image/webp", svg: "image/svg+xml", html: "text/html",
    css: "text/css", js: "application/javascript", json: "application/json",
    xml: "application/xml", csv: "text/csv", txt: "text/plain", md: "text/markdown",
    zip: "application/zip",
  };
  return map[format.toLowerCase()] || "application/octet-stream";
}

export function getStats(input: string, output: string): {
  inputSize: number; outputSize: number; ratio: number; savings: number;
} {
  const inputSize = new TextEncoder().encode(input).length;
  const outputSize = new TextEncoder().encode(output).length;
  const ratio = inputSize > 0 ? outputSize / inputSize : 0;
  const savings = inputSize - outputSize;
  return { inputSize, outputSize, ratio, savings };
}

export function bulkProcess(inputs: string[], options?: Record<string, unknown>): ProcessResult[] {
  return inputs.map((input) => process(input, options));
}
