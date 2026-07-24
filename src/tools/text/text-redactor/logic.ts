/** Text Redactor — pure logic. */

export interface RedactOptions {
  redactEmails?: boolean;
  redactPhones?: boolean;
  redactSsns?: boolean;
  redactCreditCards?: boolean;
  redactIps?: boolean;
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

const PATTERNS: Record<string, RegExp> = {
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  phone: /(?:\+?\d{1,2}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g,
  ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
  creditCard: /\b(?:\d[ -]*?){13,16}\b/g,
  ip: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
};

export function process(input: string, options: RedactOptions): RedactResult | { error: string } {
  const warnings: string[] = [];
  const replacement = options.replacement ?? "█".repeat(8);
  const counts: Record<string, number> = {};
  let total = 0;
  let working = input;
  const applyPattern = (name: string, re: RegExp) => {
    working = working.replace(re, (m) => {
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

export function statsToCsv(r: RedactResult): string {
  const lines = ["Type,Count"];
  for (const [k, v] of Object.entries(r.redactionCounts)) {
    lines.push(`${k},${v}`);
  }
  lines.push(`Total,${r.totalRedacted}`);
  return lines.join("\n");
}
