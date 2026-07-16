/**
 * FAQ Schema Generator — pure logic.
 */

export interface FaqPair {
  question: string;
  answer: string;
}

export interface FaqInput {
  pairs: FaqPair[];
}

export const QUESTION_MAX = 200;
export const ANSWER_MAX = 3000;

export function escapeJsonString(input: string): string {
  return JSON.stringify(input);
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

export function validatePair(pair: FaqPair, index: number): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!pair.question || !pair.question.trim()) {
    errors.push(`Pair #${index + 1}: question is empty`);
  } else if (pair.question.length > QUESTION_MAX) {
    warnings.push(`Pair #${index + 1}: question is very long (${pair.question.length} chars)`);
  }
  if (!pair.answer || !pair.answer.trim()) {
    errors.push(`Pair #${index + 1}: answer is empty`);
  } else if (pair.answer.length > ANSWER_MAX) {
    warnings.push(`Pair #${index + 1}: answer is very long (${pair.answer.length} chars) — may be truncated`);
  }
  // FAQ questions should end with a question mark
  if (pair.question && pair.question.trim() && !pair.question.trim().endsWith("?")) {
    warnings.push(`Pair #${index + 1}: question does not end with '?'`);
  }
  return { errors, warnings };
}

export function validateInput(input: FaqInput): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (input.pairs.length === 0) {
    errors.push("At least one Q&A pair is required");
  }
  // Detect duplicate questions
  const seen = new Set<string>();
  for (let i = 0; i < input.pairs.length; i++) {
    const r = validatePair(input.pairs[i], i);
    errors.push(...r.errors);
    warnings.push(...r.warnings);
    const q = input.pairs[i].question.trim().toLowerCase();
    if (q && seen.has(q)) {
      warnings.push(`Pair #${i + 1}: duplicate question detected`);
    }
    seen.add(q);
  }
  return { ok: errors.length === 0, errors, warnings };
}

/** Parse a bulk paste of Q&A. Supports formats:
 *  - "Question?|Answer"
 *  - "Q: Question?\nA: Answer"
 *  - "Question?\nAnswer"
 *  Each pair separated by a blank line.
 */
export function parseBulkPairs(text: string): FaqPair[] {
  if (!text || !text.trim()) return [];
  // Try the "Q:" / "A:" pattern first
  if (/^Q[:\)]/im.test(text.trim())) {
    const pairs: FaqPair[] = [];
    const lines = text.split(/\n/);
    let currentQ = "";
    let currentA = "";
    let inA = false;
    const flush = (): void => {
      if (currentQ.trim() || currentA.trim()) {
        pairs.push({ question: currentQ.trim(), answer: currentA.trim() });
      }
      currentQ = "";
      currentA = "";
      inA = false;
    };
    for (const line of lines) {
      if (/^Q[:\)]\s*/i.test(line)) {
        flush();
        currentQ = line.replace(/^Q[:\)]\s*/i, "");
        inA = false;
      } else if (/^A[:\)]\s*/i.test(line)) {
        currentA = line.replace(/^A[:\)]\s*/i, "");
        inA = true;
      } else if (line.trim() === "") {
        flush();
      } else if (inA) {
        currentA += (currentA ? "\n" : "") + line;
      } else {
        currentQ += (currentQ ? "\n" : "") + line;
      }
    }
    flush();
    return pairs.filter((p) => p.question || p.answer);
  }
  // Try pipe-separated
  if (text.includes("|")) {
    return text
      .split(/\n+/)
      .map((line) => {
        const [q, ...a] = line.split("|");
        return { question: (q || "").trim(), answer: a.join("|").trim() };
      })
      .filter((p) => p.question && p.answer);
  }
  // Fall back: alternating lines
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const pairs: FaqPair[] = [];
  for (let i = 0; i < lines.length - 1; i += 2) {
    pairs.push({ question: lines[i], answer: lines[i + 1] });
  }
  return pairs;
}

export function buildJsonLd(input: FaqInput): Record<string, unknown> {
  const v = validateInput(input);
  if (!v.ok) throw new Error(v.errors.join("; "));
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: input.pairs.map((p) => ({
      "@type": "Question",
      name: p.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: p.answer,
      },
    })),
  };
}

export function buildScriptTag(json: Record<string, unknown>): string {
  return `<script type="application/ld+json">\n${JSON.stringify(json, null, 2)}\n</script>`;
}

export function generateFaqSchema(input: FaqInput): string {
  return buildScriptTag(buildJsonLd(input));
}

/** Multi-FAQ support — combine multiple FAQPage blocks into a @graph. */
export function generateMultiFaq(inputs: FaqInput[]): string {
  if (inputs.length === 0) throw new Error("At least one FAQ block is required");
  const graph = inputs.map((i) => buildJsonLd(i));
  return buildScriptTag({
    "@context": "https://schema.org",
    "@graph": graph,
  });
}

export function buildGoogleRichResultsLink(url: string): string {
  return `https://search.google.com/test/rich-results?url=${encodeURIComponent(url || "https://example.com")}`;
}

export interface CharCount {
  value: number;
  max: number;
  isOver: boolean;
  isWarn: boolean;
}

export function countChars(value: string, max: number): CharCount {
  const v = value ?? "";
  return {
    value: v.length,
    max,
    isOver: v.length > max,
    isWarn: v.length > max * 0.9 && v.length <= max,
  };
}

// ---- History ----
const HISTORY_KEY = "unqtools:faq-schema-generator:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  pairCount: number;
  snippet: string;
}

export function loadHistory(): HistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(arr) ? arr.slice(0, HISTORY_MAX) : [];
  } catch {
    return [];
  }
}

export function saveHistory(entry: HistoryEntry): HistoryEntry[] {
  const next = [entry, ...loadHistory()].slice(0, HISTORY_MAX);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}

export function clearHistory(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    // ignore
  }
}

export function buildShareUrl(input: FaqInput): string {
  const params = new URLSearchParams();
  params.set("pairs", JSON.stringify(input.pairs));
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<FaqInput> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const pairs = params.get("pairs");
  if (!pairs) return {};
  try {
    return { pairs: JSON.parse(pairs) as FaqPair[] };
  } catch {
    return {};
  }
}
