/**
 * Acronym Expander — pure logic.
 * Expand acronyms using a built-in dictionary + custom dictionary.
 * Preserves case (e.g. "NASA" → "National Aeronautics and Space Administration").
 */

export interface AcronymEntry {
  acronym: string;
  expansion: string;
  category?: string;
}

/** Built-in acronym dictionary (commonly used). */
export const DEFAULT_DICTIONARY: AcronymEntry[] = [
  { acronym: "NASA", expansion: "National Aeronautics and Space Administration", category: "govt" },
  { acronym: "FBI", expansion: "Federal Bureau of Investigation", category: "govt" },
  { acronym: "CIA", expansion: "Central Intelligence Agency", category: "govt" },
  { acronym: "NSA", expansion: "National Security Agency", category: "govt" },
  { acronym: "DEA", expansion: "Drug Enforcement Administration", category: "govt" },
  { acronym: "DHS", expansion: "Department of Homeland Security", category: "govt" },
  { acronym: "DOJ", expansion: "Department of Justice", category: "govt" },
  { acronym: "DOD", expansion: "Department of Defense", category: "govt" },
  { acronym: "IRS", expansion: "Internal Revenue Service", category: "govt" },
  { acronym: "FEMA", expansion: "Federal Emergency Management Agency", category: "govt" },
  { acronym: "EU", expansion: "European Union", category: "geo" },
  { acronym: "UN", expansion: "United Nations", category: "geo" },
  { acronym: "NATO", expansion: "North Atlantic Treaty Organization", category: "geo" },
  { acronym: "ASEAN", expansion: "Association of Southeast Asian Nations", category: "geo" },
  { acronym: "WTO", expansion: "World Trade Organization", category: "geo" },
  { acronym: "WHO", expansion: "World Health Organization", category: "geo" },
  { acronym: "USA", expansion: "United States of America", category: "geo" },
  { acronym: "UK", expansion: "United Kingdom", category: "geo" },
  { acronym: "USA", expansion: "United States of America", category: "geo" },
  { acronym: "API", expansion: "Application Programming Interface", category: "tech" },
  { acronym: "CPU", expansion: "Central Processing Unit", category: "tech" },
  { acronym: "GPU", expansion: "Graphics Processing Unit", category: "tech" },
  { acronym: "RAM", expansion: "Random Access Memory", category: "tech" },
  { acronym: "ROM", expansion: "Read Only Memory", category: "tech" },
  { acronym: "SSD", expansion: "Solid State Drive", category: "tech" },
  { acronym: "HDD", expansion: "Hard Disk Drive", category: "tech" },
  { acronym: "URL", expansion: "Uniform Resource Locator", category: "tech" },
  { acronym: "URI", expansion: "Uniform Resource Identifier", category: "tech" },
  { acronym: "HTTP", expansion: "HyperText Transfer Protocol", category: "tech" },
  { acronym: "HTTPS", expansion: "HyperText Transfer Protocol Secure", category: "tech" },
  { acronym: "DNS", expansion: "Domain Name System", category: "tech" },
  { acronym: "TCP", expansion: "Transmission Control Protocol", category: "tech" },
  { acronym: "UDP", expansion: "User Datagram Protocol", category: "tech" },
  { acronym: "IP", expansion: "Internet Protocol", category: "tech" },
  { acronym: "JSON", expansion: "JavaScript Object Notation", category: "tech" },
  { acronym: "XML", expansion: "Extensible Markup Language", category: "tech" },
  { acronym: "HTML", expansion: "HyperText Markup Language", category: "tech" },
  { acronym: "CSS", expansion: "Cascading Style Sheets", category: "tech" },
  { acronym: "SQL", expansion: "Structured Query Language", category: "tech" },
  { acronym: "IDE", expansion: "Integrated Development Environment", category: "tech" },
  { acronym: "SDK", expansion: "Software Development Kit", category: "tech" },
  { acronym: "OS", expansion: "Operating System", category: "tech" },
  { acronym: "AI", expansion: "Artificial Intelligence", category: "tech" },
  { acronym: "ML", expansion: "Machine Learning", category: "tech" },
  { acronym: "NLP", expansion: "Natural Language Processing", category: "tech" },
  { acronym: "LLM", expansion: "Large Language Model", category: "tech" },
  { acronym: "CEO", expansion: "Chief Executive Officer", category: "biz" },
  { acronym: "CFO", expansion: "Chief Financial Officer", category: "biz" },
  { acronym: "CTO", expansion: "Chief Technology Officer", category: "biz" },
  { acronym: "COO", expansion: "Chief Operating Officer", category: "biz" },
  { acronym: "CIO", expansion: "Chief Information Officer", category: "biz" },
  { acronym: "KPI", expansion: "Key Performance Indicator", category: "biz" },
  { acronym: "ROI", expansion: "Return on Investment", category: "biz" },
  { acronym: "MVP", expansion: "Minimum Viable Product", category: "biz" },
  { acronym: "B2B", expansion: "Business to Business", category: "biz" },
  { acronym: "B2C", expansion: "Business to Consumer", category: "biz" },
  { acronym: "CRM", expansion: "Customer Relationship Management", category: "biz" },
  { acronym: "ERP", expansion: "Enterprise Resource Planning", category: "biz" },
  { acronym: "FYI", expansion: "For Your Information", category: "general" },
  { acronym: "ASAP", expansion: "As Soon As Possible", category: "general" },
  { acronym: "BTW", expansion: "By The Way", category: "general" },
  { acronym: "DIY", expansion: "Do It Yourself", category: "general" },
  { acronym: "ETA", expansion: "Estimated Time of Arrival", category: "general" },
  { acronym: "FAQ", expansion: "Frequently Asked Questions", category: "general" },
  { acronym: "TBD", expansion: "To Be Determined", category: "general" },
  { acronym: "TBA", expansion: "To Be Announced", category: "general" },
  { acronym: "AKA", expansion: "Also Known As", category: "general" },
  { acronym: "IMO", expansion: "In My Opinion", category: "general" },
  { acronym: "TTYL", expansion: "Talk To You Later", category: "general" },
  { acronym: "NASA", expansion: "National Aeronautics and Space Administration", category: "govt" },
  { acronym: "PIN", expansion: "Personal Identification Number", category: "general" },
  { acronym: "DOB", expansion: "Date of Birth", category: "general" },
  { acronym: "SSN", expansion: "Social Security Number", category: "govt" },
  { acronym: "PDF", expansion: "Portable Document Format", category: "tech" },
  { acronym: "GIF", expansion: "Graphics Interchange Format", category: "tech" },
  { acronym: "JPEG", expansion: "Joint Photographic Experts Group", category: "tech" },
  { acronym: "PNG", expansion: "Portable Network Graphics", category: "tech" },
  { acronym: "WYSIWYG", expansion: "What You See Is What You Get", category: "tech" },
];

/** Build a lookup map from a list of entries (case-insensitive keys). */
export function buildDictionary(entries: AcronymEntry[]): Map<string, AcronymEntry[]> {
  const map = new Map<string, AcronymEntry[]>();
  for (const e of entries) {
    const key = e.acronym.toUpperCase();
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(e);
  }
  return map;
}

/** Detect candidate acronyms in text (uppercase tokens 2-8 chars, may include digits). */
export function findAcronyms(text: string): string[] {
  const matches = text.match(/\b[A-Z][A-Z0-9]{1,7}\b/g);
  // filter common false positives (single "I" or "A")
  return (matches ?? []).filter((m) => m.length >= 2);
}

/** Preserve the case pattern of an acronym when applying its expansion. */
export function matchCase(acronym: string, expansion: string): string {
  const SMALL_WORDS = new Set(["and", "or", "of", "the", "for", "in", "on", "at", "to", "a", "an", "by", "with", "as", "but"]);
  if (acronym === acronym.toUpperCase() && acronym !== acronym.toLowerCase()) {
    // Title-case, but keep small words lowercase (mid-phrase)
    return expansion
      .split(" ")
      .map((w, i) => {
        if (i > 0 && i < expansion.split(" ").length - 1 && SMALL_WORDS.has(w.toLowerCase())) {
          return w.toLowerCase();
        }
        return w.length > 0 ? w[0].toUpperCase() + w.slice(1) : w;
      })
      .join(" ");
  }
  if (acronym === acronym.toLowerCase()) {
    return expansion.toLowerCase();
  }
  return expansion;
}

/** Expand a single acronym using a dictionary. */
export function expandAcronym(
  acronym: string,
  dictionary: Map<string, AcronymEntry[]>,
): string | null {
  const entries = dictionary.get(acronym.toUpperCase());
  if (!entries || entries.length === 0) return null;
  return matchCase(acronym, entries[0].expansion);
}

/** Expand all acronyms in text inline: "NASA did X" → "National Aeronautics and Space Administration did X". */
export function expandInline(
  text: string,
  dictionary: Map<string, AcronymEntry[]>,
  options: { keepAcronym?: boolean } = {},
): string {
  return text.replace(/\b[A-Z][A-Z0-9]{1,7}\b/g, (m) => {
    const exp = expandAcronym(m, dictionary);
    if (!exp) return m;
    return options.keepAcronym ? `${m} (${exp})` : exp;
  });
}

/** Build a glossary table from text: unique acronyms + their expansions. */
export function buildGlossary(
  text: string,
  dictionary: Map<string, AcronymEntry[]>,
): { acronym: string; expansion: string; count: number; category?: string }[] {
  const counts = new Map<string, number>();
  for (const a of findAcronyms(text)) {
    const k = a.toUpperCase();
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const out: { acronym: string; expansion: string; count: number; category?: string }[] = [];
  for (const [k, count] of counts) {
    const entries = dictionary.get(k);
    if (entries && entries.length > 0) {
      out.push({ acronym: k, expansion: entries[0].expansion, count, category: entries[0].category });
    } else {
      out.push({ acronym: k, expansion: "—", count });
    }
  }
  return out.sort((a, b) => b.count - a.count);
}

/** Parse a custom dictionary file: "ACRONYM = Expansion" or "ACRONYM,Expansion" per line. */
export function parseCustomDictionary(input: string): AcronymEntry[] {
  return input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      // Allow =, comma, or tab as separator
      const m = line.match(/^([^=,\t]+)[=,\t](.+)$/);
      if (!m) return null;
      return {
        acronym: m[1].trim(),
        expansion: m[2].trim(),
      } as AcronymEntry;
    })
    .filter((e): e is AcronymEntry => e !== null);
}

/** Batch process: expand every acronym per line, preserving newlines. */
export function batchExpand(
  text: string,
  dictionary: Map<string, AcronymEntry[]>,
  keepAcronym = false,
): string {
  return text
    .split(/\r?\n/)
    .map((line) => expandInline(line, dictionary, { keepAcronym }))
    .join("\n");
}

/** Statistics: total acronyms, unique, recognized, unrecognized. */
export function analyzeAcronyms(
  text: string,
  dictionary: Map<string, AcronymEntry[]>,
): { total: number; unique: number; recognized: number; unrecognized: number; unrecognizedList: string[] } {
  const all = findAcronyms(text);
  const unique = new Set(all.map((a) => a.toUpperCase()));
  const unrecognized: string[] = [];
  let recognized = 0;
  for (const u of unique) {
    if (dictionary.has(u)) recognized++;
    else unrecognized.push(u);
  }
  return {
    total: all.length,
    unique: unique.size,
    recognized,
    unrecognized: unique.size - recognized,
    unrecognizedList: unrecognized.sort(),
  };
}

/** Suggest expansions for unknown acronyms based on first letters of words in surrounding context. */
export function suggestExpansion(
  acronym: string,
  surroundingText: string,
): string[] {
  // Look for sequences of words whose initials match the acronym letters.
  // Allow skipping common articles/conjunctions ("and", "of", "the") so that
  // "National Aeronautics and Space Administration" matches NASA.
  const SKIP_WORDS = new Set(["and", "of", "the", "for", "in", "at", "on", "to", "a", "an", "&", "et"]);
  const letters = acronym.toUpperCase().split("");
  const words = surroundingText.split(/\s+/).filter((w) => w.length > 0);
  const suggestions: string[] = [];
  for (let i = 0; i <= words.length - letters.length; i++) {
    // Walk through words starting at i, matching each acronym letter.
    // Skip-words (and/of/the/etc.) are allowed between matches.
    let letterIdx = 0;
    let j = i;
    const usedWords: string[] = [];
    while (j < words.length && letterIdx < letters.length) {
      const w = words[j];
      const first = w[0]?.toUpperCase();
      if (first === letters[letterIdx]) {
        usedWords.push(w);
        letterIdx++;
        j++;
      } else if (SKIP_WORDS.has(w.toLowerCase().replace(/[^a-z&]/gi, ""))) {
        usedWords.push(w);
        j++;
      } else {
        break;
      }
    }
    if (letterIdx === letters.length) {
      suggestions.push(usedWords.join(" "));
    }
  }
  return suggestions;
}

/** Validate a custom dictionary entry. */
export function validateEntry(entry: { acronym: string; expansion: string }): string[] {
  const errs: string[] = [];
  if (!entry.acronym.trim()) errs.push("Acronym is empty");
  if (!entry.expansion.trim()) errs.push("Expansion is empty");
  if (entry.acronym.length > 20) errs.push("Acronym too long");
  return errs;
}

/** Filter dictionary entries by category. */
export function filterByCategory(entries: AcronymEntry[], category: string): AcronymEntry[] {
  return entries.filter((e) => e.category === category);
}

/** Export dictionary to CSV format. */
export function exportCsv(entries: AcronymEntry[]): string {
  const header = "acronym,expansion,category";
  const rows = entries.map((e) => `${e.acronym},"${e.expansion.replace(/"/g, '""')}",${e.category ?? ""}`);
  return [header, ...rows].join("\n");
}

/** Format a glossary as Markdown table. */
export function glossaryToMarkdown(glossary: { acronym: string; expansion: string; count: number; category?: string }[]): string {
  const header = "| Acronym | Expansion | Count | Category |\n| --- | --- | --- | --- |";
  const rows = glossary.map((g) => `| ${g.acronym} | ${g.expansion} | ${g.count} | ${g.category ?? ""} |`);
  return [header, ...rows].join("\n");
}
