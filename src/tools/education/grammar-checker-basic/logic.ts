/**
 * Basic Grammar Checker — pure logic.
 * Regex checks + common misspelling map.
 */

export interface GrammarIssue {
  type: "capitalization" | "spacing" | "spelling" | "punctuation" | "double-word";
  message: string;
  excerpt: string;
  index: number;
  fix?: string;
}

const COMMON_MISSPELLINGS: Record<string, string> = {
  teh: "the",
  recieve: "receive",
  occured: "occurred",
  seperate: "separate",
  definately: "definitely",
  accomodate: "accommodate",
  acheive: "achieve",
  arguement: "argument",
  beggining: "beginning",
  beleive: "believe",
  calender: "calendar",
  cemetary: "cemetery",
  changable: "changeable",
  collegue: "colleague",
  comming: "coming",
  commited: "committed",
  concious: "conscious",
  embarass: "embarrass",
  enviroment: "environment",
  existance: "existence",
  feasable: "feasible",
  foriegn: "foreign",
  goverment: "government",
  grammer: "grammar",
  harrass: "harass",
  independant: "independent",
  knowlege: "knowledge",
  liason: "liaison",
  maintainance: "maintenance",
  neccessary: "necessary",
  noticable: "noticeable",
  occassion: "occasion",
  persistant: "persistent",
  priviledge: "privilege",
  recomend: "recommend",
  rythm: "rhythm",
  succesful: "successful",
  tommorow: "tomorrow",
  truely: "truly",
  unfortunatly: "unfortunately",
  untill: "until",
  wierd: "weird",
  writting: "writing",
  your: "your", // context-dependent, skip in auto-fix
};

export function checkGrammar(text: string): GrammarIssue[] {
  const issues: GrammarIssue[] = [];

  // 1. Sentence must start with a capital letter
  const sentences = text.split(/(?<=[.!?])\s+/);
  let idx = 0;
  for (const s of sentences) {
    const pos = text.indexOf(s, idx);
    if (s && /^[a-z]/.test(s)) {
      issues.push({
        type: "capitalization",
        message: "Sentence should start with a capital letter",
        excerpt: s.slice(0, 30),
        index: pos,
        fix: s[0]!.toUpperCase() + s.slice(1),
      });
    }
    idx = pos + s.length;
  }

  // 2. The pronoun "i" should be "I"
  let m: RegExpExecArray | null;
  const iRe = /\bi\b/g;
  while ((m = iRe.exec(text)) !== null) {
    issues.push({
      type: "capitalization",
      message: "The pronoun 'i' should be capitalized as 'I'",
      excerpt: text.slice(Math.max(0, m.index - 10), m.index + 10),
      index: m.index,
      fix: "I",
    });
  }

  // 3. Double spaces
  const dsRe = / {2,}/g;
  while ((m = dsRe.exec(text)) !== null) {
    issues.push({
      type: "spacing",
      message: "Multiple consecutive spaces",
      excerpt: m[0],
      index: m.index,
      fix: " ",
    });
  }

  // 4. Space before punctuation
  const spRe = /\s+([,.;:!?])/g;
  while ((m = spRe.exec(text)) !== null) {
    issues.push({
      type: "punctuation",
      message: `No space should precede '${m[1]}'`,
      excerpt: m[0],
      index: m.index,
      fix: m[1],
    });
  }

  // 5. Common misspellings
  const wordRe = /\b([a-zA-Z]+)\b/g;
  while ((m = wordRe.exec(text)) !== null) {
    const word = m[1]!.toLowerCase();
    if (word === "your") continue;
    if (COMMON_MISSPELLINGS[word] && COMMON_MISSPELLINGS[word] !== word) {
      issues.push({
        type: "spelling",
        message: `Possible misspelling: "${m[1]}" → "${COMMON_MISSPELLINGS[word]}"`,
        excerpt: m[1],
        index: m.index,
        fix: COMMON_MISSPELLINGS[word],
      });
    }
  }

  // 6. Doubled words (the the)
  const dwRe = /\b(\w+)\s+\1\b/gi;
  while ((m = dwRe.exec(text)) !== null) {
    issues.push({
      type: "double-word",
      message: `Doubled word: "${m[0]}"`,
      excerpt: m[0],
      index: m.index,
      fix: m[1],
    });
  }

  return issues.sort((a, b) => a.index - b.index);
}

export function applyFix(text: string, issue: GrammarIssue): string {
  if (!issue.fix) return text;
  return text.slice(0, issue.index) + issue.fix + text.slice(issue.index + issue.excerpt.length);
}

export function summary(issues: GrammarIssue[]): Record<GrammarIssue["type"], number> {
  const out: Record<GrammarIssue["type"], number> = {
    capitalization: 0, spacing: 0, spelling: 0, punctuation: 0, "double-word": 0,
  };
  for (const i of issues) out[i.type] += 1;
  return out;
}
