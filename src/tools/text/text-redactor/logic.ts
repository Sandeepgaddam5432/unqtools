/** Text Redactor — pure logic. No DOM access.
 *
 * Extras beyond the original thin tool (10+):
 *   1. Email pattern redaction
 *   2. Phone pattern redaction
 *   3. SSN pattern redaction
 *   4. Credit card pattern redaction
 *   5. IP address pattern redaction
 *   6. Custom regex patterns (named)
 *   7. Custom word list redaction
 *   8. Configurable replacement token
 *   9. Per-pattern redaction counts
 *  10. Validation of regex patterns
 *  11. Batch processing
 *  12. CSV export of stats
 */
export interface RedactOptions {
  redactEmails?: boolean;
  redactPhones?: boolean;
  redactSsns?: boolean;
  redactCreditCards?: boolean;
  redactIps?: boolean;
  redactUrls?: boolean;
  redactZipCodes?: boolean;
  customPatterns?: { name: string; pattern: string; flags?: string }[];
  replacement?: string;
  customWords?: string[];
}

export interface RedactResult {
  output: string;
  redactionCounts: Record<string, number>;
  totalRedacted: number;
  warnings: string[];
}

export const PATTERNS: Record<string, RegExp> = {
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  phone: /(?:\+?\d{1,2}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g,
  ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
  creditCard: /\b(?:\d[ -]*?){13,16}\b/g,
  ip: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
  url: /\bhttps?:\/\/[^\s]+/gi,
  zipCode: /\b\d{5}(?:-\d{4})?\b/g,
};

/** List of all available built-in pattern names. */
export const PATTERN_NAMES = Object.keys(PATTERNS);

const isFin = (n: number) => Number.isFinite(n);

export function process(input: string, options: RedactOptions): RedactResult | { error: string } {
  const warnings: string[] = [];
  const replacement = options.replacement ?? "█".repeat(8);
  const counts: Record<string, number> = {};
  let total = 0;
  let working = input;
  const applyPattern = (name: string, re: RegExp) => {
    working = working.replace(re, () => {
      counts[name] = (counts[name] ?? 0) + 1;
      total++;
      return replacement;
    });
  };
  try {
    if (options.redactEmails) applyPattern("email", PATTERNS.email!);
    if (options.redactPhones) applyPattern("phone", PATTERNS.phone!);
    if (options.redactSsns) applyPattern("ssn", PATTERNS.ssn!);
    if (options.redactCreditCards) applyPattern("creditCard", PATTERNS.creditCard!);
    if (options.redactIps) applyPattern("ip", PATTERNS.ip!);
    if (options.redactUrls) applyPattern("url", PATTERNS.url!);
    if (options.redactZipCodes) applyPattern("zipCode", PATTERNS.zipCode!);
    if (options.customWords && options.customWords.length > 0) {
      const escaped = options.customWords.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
      applyPattern("customWords", new RegExp(escaped, "gi"));
    }
    if (options.customPatterns) {
      for (const cp of options.customPatterns) {
        try {
          const re = new RegExp(cp.pattern, cp.flags ?? "g");
          applyPattern(cp.name, re);
        } catch (e) {
          warnings.push(`Invalid custom pattern "${cp.name}": ${(e as Error).message}`);
        }
      }
    }
    if (total === 0) warnings.push("No redactions made.");
    return { output: working, redactionCounts: counts, totalRedacted: total, warnings };
  } catch (e) {
    return { error: `Redaction failed: ${(e as Error).message}` };
  }
}

/** Validate a regex pattern string. */
export function validatePattern(pattern: string, flags?: string): { ok: true } | { error: string } {
  try {
    new RegExp(pattern, flags);
    return { ok: true };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

/** Build a word-boundary regex for a custom word list. */
export function buildWordRegex(words: string[], caseInsensitive = true): RegExp {
  const escaped = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  return new RegExp(`\\b(?:${escaped})\\b`, caseInsensitive ? "gi" : "g");
}

/** Compute stats for a RedactResult. */
export function stats(r: RedactResult): { patterns: number; mostRedacted: string | null; max: number } {
  const entries = Object.entries(r.redactionCounts);
  if (entries.length === 0) return { patterns: 0, mostRedacted: null, max: 0 };
  let max = 0; let mostRedacted: string | null = null;
  for (const [k, v] of entries) {
    if (v > max) { max = v; mostRedacted = k; }
  }
  return { patterns: entries.length, mostRedacted, max };
}

export function statsToCsv(r: RedactResult): string {
  const lines = ["Type,Count"];
  for (const [k, v] of Object.entries(r.redactionCounts)) {
    lines.push(`${k},${v}`);
  }
  lines.push(`Total,${r.totalRedacted}`);
  return lines.join("\n");
}

/** Batch-process multiple inputs. */
export function batchProcess(
  inputs: string[], options: RedactOptions,
): { i: number; result: RedactResult | { error: string } }[] {
  return inputs.map((input, i) => ({ i, result: process(input, options) }));
}

/** Render batch results as CSV. */
export function batchToCsv(
  results: { i: number; result: RedactResult | { error: string } }[],
): string {
  const lines = ["index,totalRedacted,output"];
  for (const r of results) {
    if ("error" in r.result) lines.push(`${r.i},error,"${r.result.error}"`);
    else lines.push(`${r.i},${r.result.totalRedacted},"${r.result.output.replace(/"/g, '""')}"`);
  }
  return lines.join("\n");
}

/** Escape a string for safe use in regex. */
export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Pretty-print helper. */
export function fmt(n: number, p = 2): string {
  if (!isFin(n)) return "—";
  const f = Math.pow(10, p);
  return String(Math.round((n + Number.EPSILON) * f) / f);
}
