/**
 * Definition Lookup — pure logic.
 * Offline dictionary with multiple definitions, parts of speech, etymology,
 * synonyms, and antonyms for a curated word list.
 */

export type PartOfSpeech = "noun" | "verb" | "adjective" | "adverb" | "pronoun" | "preposition" | "conjunction" | "interjection" | "determiner";

export interface Definition {
  partOfSpeech: PartOfSpeech;
  text: string;
  example?: string;
}

export interface WordEntry {
  word: string;
  phonetic?: string;
  definitions: Definition[];
  synonyms: string[];
  antonyms: string[];
  etymology?: string;
}

/** Curated offline dictionary. */
export const DICTIONARY: WordEntry[] = [
  {
    word: "serendipity",
    phonetic: "/ˌsɛrənˈdɪpɪti/",
    definitions: [
      { partOfSpeech: "noun", text: "The occurrence of finding pleasant or valuable things by chance.", example: "Discovering that café was pure serendipity." },
    ],
    synonyms: ["chance", "fortune", "luck", "kismet"],
    antonyms: ["misfortune", "planning"],
    etymology: "Coined by Horace Walpole in 1754 from the Persian fairy tale 'The Three Princes of Serendip'.",
  },
  {
    word: "ephemeral",
    phonetic: "/əˈfɛmərəl/",
    definitions: [
      { partOfSpeech: "adjective", text: "Lasting for a very short time.", example: "The ephemeral nature of cherry blossoms." },
    ],
    synonyms: ["fleeting", "transient", "momentary", "short-lived"],
    antonyms: ["permanent", "enduring", "lasting"],
    etymology: "From Greek 'ephēmeros' — lasting only a day.",
  },
  {
    word: "ubiquitous",
    phonetic: "/juːˈbɪkwɪtəs/",
    definitions: [
      { partOfSpeech: "adjective", text: "Present, appearing, or found everywhere.", example: "Smartphones have become ubiquitous." },
    ],
    synonyms: ["omnipresent", "pervasive", "universal", "widespread"],
    antonyms: ["rare", "scarce", "uncommon"],
    etymology: "From Latin 'ubique' — everywhere.",
  },
  {
    word: "eloquent",
    phonetic: "/ˈɛləkwənt/",
    definitions: [
      { partOfSpeech: "adjective", text: "Fluent and persuasive in speaking or writing.", example: "An eloquent defense of free speech." },
    ],
    synonyms: ["articulate", "fluent", "persuasive", "expressive"],
    antonyms: ["inarticulate", "halting", "clumsy"],
    etymology: "From Latin 'eloqui' — to speak out.",
  },
  {
    word: "resilient",
    phonetic: "/rɪˈzɪliənt/",
    definitions: [
      { partOfSpeech: "adjective", text: "Able to recover quickly from difficulties.", example: "Children are remarkably resilient." },
    ],
    synonyms: ["tough", "hardy", "flexible", "buoyant"],
    antonyms: ["fragile", "vulnerable", "weak"],
    etymology: "From Latin 'resilire' — to leap back.",
  },
  {
    word: "paradigm",
    phonetic: "/ˈpærədaɪm/",
    definitions: [
      { partOfSpeech: "noun", text: "A typical example or pattern; a model.", example: "A paradigm shift in scientific thinking." },
    ],
    synonyms: ["model", "pattern", "template", "standard"],
    antonyms: ["anomaly", "exception"],
    etymology: "From Greek 'paradeigma' — to show side by side.",
  },
  {
    word: "ambiguous",
    phonetic: "/æmˈbɪɡjuəs/",
    definitions: [
      { partOfSpeech: "adjective", text: "Open to more than one interpretation.", example: "His reply was deliberately ambiguous." },
    ],
    synonyms: ["equivocal", "unclear", "vague", "obscure"],
    antonyms: ["clear", "unambiguous", "explicit"],
    etymology: "From Latin 'ambigere' — to wander.",
  },
  {
    word: "meticulous",
    phonetic: "/məˈtɪkjʊləs/",
    definitions: [
      { partOfSpeech: "adjective", text: "Showing great attention to detail; very careful.", example: "Meticulous record-keeping." },
    ],
    synonyms: ["thorough", "careful", "precise", "diligent"],
    antonyms: ["careless", "sloppy", "negligent"],
    etymology: "From Latin 'meticulosus' — fearful (from metus, fear).",
  },
  {
    word: "pragmatic",
    phonetic: "/præɡˈmætɪk/",
    definitions: [
      { partOfSpeech: "adjective", text: "Dealing with things sensibly and realistically.", example: "A pragmatic approach to problem-solving." },
    ],
    synonyms: ["practical", "realistic", "sensible", "down-to-earth"],
    antonyms: ["idealistic", "theoretical", "impractical"],
    etymology: "From Greek 'pragmatikos' — practical.",
  },
  {
    word: "vex",
    phonetic: "/vɛks/",
    definitions: [
      { partOfSpeech: "verb", text: "To make someone feel annoyed or frustrated.", example: "The delay vexed the passengers." },
    ],
    synonyms: ["annoy", "irritate", "frustrate", "bother"],
    antonyms: ["please", "soothe", "calm"],
    etymology: "From Latin 'vexare' — to shake.",
  },
  {
    word: "gratitude",
    phonetic: "/ˈɡrætɪtuːd/",
    definitions: [
      { partOfSpeech: "noun", text: "The quality of being thankful; readiness to show appreciation.", example: "She expressed her gratitude with a card." },
    ],
    synonyms: ["thankfulness", "appreciation", "recognition"],
    antonyms: ["ingratitude", "ungratefulness"],
    etymology: "From Latin 'gratitudo' — from 'gratus', pleasing.",
  },
  {
    word: "tenacious",
    phonetic: "/təˈneɪʃəs/",
    definitions: [
      { partOfSpeech: "adjective", text: "Holding firmly; persistent.", example: "A tenacious fighter." },
    ],
    synonyms: ["persistent", "determined", "steadfast", "resolute"],
    antonyms: ["yielding", "weak", "irresolute"],
    etymology: "From Latin 'tenax' — holding fast.",
  },
];

/** Normalize a word for lookup (lowercase, trim). */
export function normalizeWord(word: string): string {
  return word.toLowerCase().trim().replace(/[^a-z-]/g, "");
}

/** Look up a word in the dictionary. Returns null if not found. */
export function lookupWord(word: string): WordEntry | null {
  const normalized = normalizeWord(word);
  if (!normalized) return null;
  return DICTIONARY.find((e) => e.word === normalized) ?? null;
}

/** Search for words containing a substring (case-insensitive). */
export function searchWords(query: string): WordEntry[] {
  const q = normalizeWord(query);
  if (!q) return [];
  return DICTIONARY.filter((e) => e.word.includes(q));
}

/** Get all parts of speech represented in a word entry. */
export function partsOfSpeech(entry: WordEntry): PartOfSpeech[] {
  return Array.from(new Set(entry.definitions.map((d) => d.partOfSpeech)));
}

/** Get all definitions for a specific part of speech. */
export function definitionsByPos(entry: WordEntry, pos: PartOfSpeech): Definition[] {
  return entry.definitions.filter((d) => d.partOfSpeech === pos);
}

/** Format an entry as a text report. */
export function formatEntry(entry: WordEntry): string {
  const lines: string[] = [entry.word];
  if (entry.phonetic) lines.push(entry.phonetic);
  lines.push("");
  for (const d of entry.definitions) {
    lines.push(`(${d.partOfSpeech}) ${d.text}`);
    if (d.example) lines.push(`  Example: "${d.example}"`);
  }
  if (entry.synonyms.length > 0) lines.push(`\nSynonyms: ${entry.synonyms.join(", ")}`);
  if (entry.antonyms.length > 0) lines.push(`Antonyms: ${entry.antonyms.join(", ")}`);
  if (entry.etymology) lines.push(`\nEtymology: ${entry.etymology}`);
  return lines.join("\n");
}

/** Get a random word from the dictionary. */
export function randomWord(): WordEntry {
  return DICTIONARY[Math.floor(Math.random() * DICTIONARY.length)];
}

/** Get all words (sorted). */
export function allWords(): string[] {
  return DICTIONARY.map((e) => e.word).sort();
}

/** Validate a word for lookup. */
export function validateWord(word: string): { ok: boolean; reason?: string } {
  if (!word || word.trim().length === 0) return { ok: false, reason: "Enter a word to look up." };
  if (word.length > 50) return { ok: false, reason: "Word too long." };
  return { ok: true };
}

/** Word of the day: deterministic based on date. */
export function wordOfDay(date = new Date()): WordEntry {
  const dayOfYear = Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000);
  return DICTIONARY[dayOfYear % DICTIONARY.length];
}

/** Build a CSV of all entries. */
export function dictionaryToCsv(): string {
  const rows = ["word,phonetic,part_of_speech,definition,example"];
  for (const entry of DICTIONARY) {
    for (const d of entry.definitions) {
      rows.push([
        entry.word,
        entry.phonetic ?? "",
        d.partOfSpeech,
        `"${d.text.replace(/"/g, '""')}"`,
        d.example ? `"${d.example.replace(/"/g, '""')}"` : "",
      ].join(","));
    }
  }
  return rows.join("\n");
}
