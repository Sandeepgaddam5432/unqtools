/**
 * Active Voice Suggester — pure logic.
 * Detects passive-voice constructions (be-verb + past participle) in English
 * sentences and proposes active-voice rewrites using rule-based heuristics.
 */

export interface PassiveMatch {
  sentence: string;
  passivePhrase: string;
  startIndex: number;
  endIndex: number;
  beVerb: string;
  pastParticiple: string;
  byAgent?: string;
  suggestions: string[];
}

export interface AnalysisResult {
  matches: PassiveMatch[];
  totalSentences: number;
  passiveCount: number;
  passivePercentage: number;
  warnings: string[];
}

const BE_VERBS = new Set([
  "is", "are", "was", "were", "be", "been", "being", "am",
  "'s", "'re", "'m",
]);

const IRREGULAR_PARTICIPLES: Record<string, string> = {
  written: "write", written: "write",
  done: "do", eaten: "eat", seen: "see", taken: "take", given: "give",
  made: "make", gone: "go", known: "know", thought: "think", told: "tell",
  found: "find", put: "put", brought: "bring", bought: "buy", caught: "catch",
  taught: "teach", sent: "send", spent: "spend", built: "build", held: "hold",
  kept: "keep", let: "let", left: "leave", felt: "feel", began: "begin",
  begun: "begin", drunk: "drink", run: "run", ridden: "ride", worn: "wear",
  torn: "tear", sworn: "swear", drawn: "draw", shown: "show", grown: "grow",
  thrown: "throw", blown: "blow", flown: "fly", frozen: "freeze", chosen: "choose",
  forgotten: "forget", hidden: "hide", bitten: "bite", stolen: "steal",
  broken: "break", spoken: "speak", woken: "wake", arisen: "arise",
};

/** Convert a past participle to its base verb form. */
export function participleToBase(participle: string): string {
  const lower = participle.toLowerCase();
  if (IRREGULAR_PARTICIPLES[lower]) return IRREGULAR_PARTICIPLES[lower];
  // Regular: -ed → strip; -ed after e → strip "d"; consonant+y → -ied → -y
  if (lower.endsWith("ied")) return lower.slice(0, -3) + "y";
  if (lower.endsWith("ed")) {
    const stem = lower.slice(0, -2);
    if (stem.endsWith("e")) return stem; // "baked" → "bake"
    // Double consonant (e.g. "stopped" → "stop")
    if (stem.length >= 2 && stem[stem.length - 1] === stem[stem.length - 2]) {
      return stem.slice(0, -1);
    }
    return stem;
  }
  return lower;
}

/** Tokenize a sentence into words (lowercase) preserving original case for output. */
export function tokenize(sentence: string): string[] {
  return sentence.match(/\b[\w']+\b/g) ?? [];
}

/** Split text into sentences (rough heuristic). */
export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z"'(])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Check if a word looks like a past participle (regular -ed or known irregular). */
export function looksLikePastParticiple(word: string): boolean {
  const lower = word.toLowerCase();
  if (IRREGULAR_PARTICIPLES[lower]) return true;
  if (lower.endsWith("ed") && lower.length > 3) {
    // Filter out common non-participles like "red", "bed"
    const nonParticiples = new Set(["red", "bed", "led", "fed", "wed", "shed"]);
    if (nonParticiples.has(lower)) return false;
    return true;
  }
  return false;
}

/** Detect the "by <agent>" phrase following a passive construction. */
export function findByAgent(sentence: string, startIndex: number): { agent: string; endIndex: number } | null {
  // Look for "by <noun phrase>" after the participle
  const rest = sentence.slice(startIndex);
  const m = /\bby\s+([a-z]+(?:\s+[a-z]+){0,3})\b/i.exec(rest);
  if (!m) return null;
  return {
    agent: m[1].trim(),
    endIndex: startIndex + m.index + m[0].length,
  };
}

/** Find all passive constructions in a sentence. */
export function findPassivesInSentence(sentence: string): PassiveMatch[] {
  const tokens = tokenize(sentence);
  const matches: PassiveMatch[] = [];
  for (let i = 0; i < tokens.length - 1; i++) {
    const be = tokens[i].toLowerCase().replace(/n't$/, "").replace(/'re$/, "").replace(/'s$/, "").replace(/'m$/, "");
    if (!BE_VERBS.has(be) && !BE_VERBS.has(tokens[i].toLowerCase())) continue;
    // Look ahead for an optional "not"/"n't"
    let j = i + 1;
    if (j < tokens.length && (tokens[j].toLowerCase() === "not" || tokens[j].toLowerCase().endsWith("n't"))) {
      j++;
    }
    if (j >= tokens.length) continue;
    const participle = tokens[j];
    if (!looksLikePastParticiple(participle)) continue;
    // Find the phrase span in the original sentence
    const phraseRegex = new RegExp(`\\b${escapeRegex(tokens[i])}\\s+(?:not\\s+|n't\\s+)?${escapeRegex(participle)}\\b`, "i");
    const m = phraseRegex.exec(sentence);
    if (!m) continue;
    const startIndex = m.index;
    const endIndex = startIndex + m[0].length;
    // Try to find "by <agent>"
    const byAgent = findByAgent(sentence, endIndex);
    const agentText = byAgent ? byAgent.agent : undefined;
    const suggestions = generateSuggestions(sentence, tokens[i], participle, agentText, i, j);
    matches.push({
      sentence,
      passivePhrase: m[0],
      startIndex,
      endIndex: byAgent ? byAgent.endIndex : endIndex,
      beVerb: tokens[i],
      pastParticiple: participle,
      byAgent: agentText,
      suggestions,
    });
  }
  return matches;
}

/** Escape regex special chars. */
export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Generate active-voice rewrite suggestions. */
export function generateSuggestions(
  sentence: string,
  beVerb: string,
  participle: string,
  agent: string | undefined,
  beIndex: number,
  participleIndex: number,
): string[] {
  const base = participleToBase(participle);
  const suggestions: string[] = [];
  // Find subject (text before be-verb)
  const before = sentence.slice(0, sentence.toLowerCase().indexOf(beVerb.toLowerCase()));
  const subject = before.trim().replace(/[,\s]+$/, "").trim();
  // Find object (text after participle, up to "by" or end)
  let after = sentence.slice(sentence.toLowerCase().indexOf(participle.toLowerCase()) + participle.length);
  if (agent) {
    // strip "by <agent>"
    after = after.replace(new RegExp(`\\s*by\\s+${escapeRegex(agent)}\\b`, "i"), "");
  }
  const object = after.trim().replace(/^[\s,]+/, "").replace(/[.\s]+$/, "").trim();
  if (agent) {
    // Active: "<agent> <base-verb> <subject>"
    const s1 = capitalize(`${agent} ${base}${object ? " " + object : ""}${subject ? " " + subject : ""}.`);
    suggestions.push(s1);
  } else {
    // No agent — generic suggestions
    if (subject) {
      suggestions.push(capitalize(`${subject} ${base}${object ? " " + object : ""}.`));
    }
    suggestions.push(capitalize(`Someone ${base}${object ? " " + object : ""}${subject ? " " + subject : ""}.`));
  }
  return suggestions;
}

/** Capitalize the first letter. */
export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Analyze a full text for passive constructions. */
export function analyzeText(text: string): AnalysisResult {
  const sentences = splitSentences(text);
  const allMatches: PassiveMatch[] = [];
  const warnings: string[] = [];
  for (const sentence of sentences) {
    const matches = findPassivesInSentence(sentence);
    allMatches.push(...matches);
    if (matches.length > 2) warnings.push(`Sentence has ${matches.length} passive constructions: "${sentence.slice(0, 60)}…"`);
  }
  const passivePercentage = sentences.length > 0 ? Math.round((allMatches.length / sentences.length) * 100) : 0;
  return {
    matches: allMatches,
    totalSentences: sentences.length,
    passiveCount: allMatches.length,
    passivePercentage,
    warnings,
  };
}

/** Rewrite a sentence in active voice using the first suggestion. */
export function rewriteSentence(sentence: string): string {
  const matches = findPassivesInSentence(sentence);
  if (matches.length === 0) return sentence;
  return matches[0].suggestions[0] ?? sentence;
}

/** Build a CSV report of all matches. */
export function matchesToCsv(matches: PassiveMatch[]): string {
  const rows = ["sentence,passive_phrase,be_verb,participle,by_agent,suggestion"];
  for (const m of matches) {
    rows.push(
      [
        escapeCsv(m.sentence),
        escapeCsv(m.passivePhrase),
        m.beVerb,
        m.pastParticiple,
        m.byAgent ?? "",
        escapeCsv(m.suggestions[0] ?? ""),
      ].join(","),
    );
  }
  return rows.join("\n");
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
