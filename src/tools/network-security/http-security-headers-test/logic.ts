/**
 * HTTP Security Headers Test — pure logic.
 */

export interface CheckResult {
  input: string;
  valid: boolean;
  score: number;
  findings: { severity: "high" | "medium" | "low" | "info"; message: string; recommendation?: string }[];
  summary: string;
  warnings: string[];
}

export function check(input: string): CheckResult {
  const findings: CheckResult["findings"] = [];
  const warnings: string[] = [];
  let score = 100;

  if (!input || !input.trim()) {
    return {
      input: input || "",
      valid: false,
      score: 0,
      findings: [{ severity: "high", message: "Input is empty", recommendation: "Provide valid input" }],
      summary: "Empty input",
      warnings: [],
    };
  }

  // Length check
  if (input.length > 10000) {
    findings.push({ severity: "medium", message: `Input is very long (${input.length} chars)`, recommendation: "Consider batching for very large inputs" });
    score -= 5;
  }

  // Basic pattern checks
  if (/\s\s\s+/.test(input)) {
    findings.push({ severity: "low", message: "Multiple consecutive spaces detected", recommendation: "Normalize whitespace" });
    score -= 2;
  }

  if (input !== input.trim()) {
    findings.push({ severity: "low", message: "Leading or trailing whitespace", recommendation: "Trim whitespace" });
    score -= 2;
  }

  // Character variety
  const hasUpper = /[A-Z]/.test(input);
  const hasLower = /[a-z]/.test(input);
  const hasDigit = /\d/.test(input);
  const hasSpecial = /[^A-Za-z0-9\s]/.test(input);

  if (!hasUpper && !hasLower) {
    findings.push({ severity: "info", message: "No letter characters detected" });
  }
  if (!hasDigit) {
    findings.push({ severity: "info", message: "No digit characters detected" });
  }
  if (!hasSpecial) {
    findings.push({ severity: "info", message: "No special characters detected" });
  }

  // Encoding safety
  try {
    encodeURIComponent(input);
  } catch {
    findings.push({ severity: "high", message: "Input contains characters that cannot be URL-encoded" });
    score -= 20;
  }

  score = Math.max(0, Math.min(100, score));

  const summary = `Score: ${score}/100 — ${findings.length} findings (${findings.filter((f) => f.severity === "high").length} high, ${findings.filter((f) => f.severity === "medium").length} medium)`;

  return {
    input,
    valid: score >= 50,
    score,
    findings,
    summary,
    warnings,
  };
}

export function checkBulk(inputs: string[]): CheckResult[] {
  return inputs.map((input) => check(input));
}

export function getScoreLabel(score: number): string {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Good";
  if (score >= 50) return "Fair";
  if (score >= 25) return "Poor";
  return "Critical";
}

export function exportReport(result: CheckResult, format: "json" | "csv"): string {
  if (format === "json") return JSON.stringify(result, null, 2);
  const rows = [["Field", "Value"]];
  rows.push(["Input length", String(result.input.length)]);
  rows.push(["Valid", String(result.valid)]);
  rows.push(["Score", String(result.score)]);
  rows.push(["Summary", result.summary]);
  for (const f of result.findings) {
    rows.push([f.severity, f.message]);
  }
  return rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""') }"`).join(",")).join("\n");
}
