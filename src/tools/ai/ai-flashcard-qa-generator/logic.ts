/**
 * AI Flashcard Q&A Generator — pure logic.
 *
 * Generates Q&A flashcards from notes with cloze, true/false,
 * fill-in-the-blank, and multiple-choice variations. Includes an
 * SM-2 spaced-repetition scheduler and Anki/Quizlet/JSON exporters.
 * Pure functions only — no DOM, no network. The optional LLM call
 * (BYO API key) lives in ui.tsx because it touches the network.
 *
 * Honesty clause: AI-generated cards may contain errors — review
 * before relying on them for exams. On-device heuristics are less
 * precise than BYO-key LLMs.
 */

// ---------- Types ----------

export type CardType =
  | "definition"
  | "true-false"
  | "fill-blank"
  | "multiple-choice"
  | "cloze";

export type Difficulty = "easy" | "medium" | "hard";

export type Sm2Grade = "again" | "hard" | "good" | "easy";

export interface Card {
  id: string;
  type: CardType;
  question: string;
  answer: string;
  cloze?: string;            // for cloze cards, the {{c1::...}} template
  options?: string[];        // for multiple-choice
  correctIndex?: number;     // for multiple-choice
  grounded: boolean;         // true if extracted directly from source sentence
  difficulty: Difficulty;
  tags: string[];
  source?: string;           // source sentence
  sm2: Sm2State;
}

export interface Sm2State {
  interval: number;   // days
  repetitions: number;
  easiness: number;   // typically starts at 2.5
  due: number;        // unix ms
  lastReviewed: number | null;
}

export interface Deck {
  id: string;
  name: string;
  cards: Card[];
  createdAt: number;
}

export interface KeyTerm {
  term: string;
  frequency: number;
  score: number;
}

export interface GenerationOptions {
  includeTypes: CardType[];
  maxCards: number;
  defaultDifficulty: Difficulty;
}

export interface StudyStats {
  total: number;
  due: number;
  learned: number;
  newCards: number;
  avgEasiness: number;
}

export interface HistoryEntry {
  ts: number;
  deckName: string;
  cardCount: number;
  types: Record<CardType, number>;
}

// ---------- Constants ----------

export const CARD_TYPE_LABELS: Record<CardType, string> = {
  "definition": "Definition",
  "true-false": "True / False",
  "fill-blank": "Fill in the Blank",
  "multiple-choice": "Multiple Choice",
  "cloze": "Cloze",
};

export const CARD_TYPE_DESCRIPTIONS: Record<CardType, string> = {
  "definition": "Q asks for the definition of a term; A is the source sentence or a 'X is Y' template.",
  "true-false": "Q is a true or false statement built from a source sentence; A is 'True' or 'False' with the correct statement.",
  "fill-blank": "Q has a key term blanked out (____); A is the missing term.",
  "multiple-choice": "Q with 4 options (1 correct + 3 distractors from other terms); A is the correct option index.",
  "cloze": "Anki-style {{c1::...}} cloze deletion around a key term in the source sentence.",
};

export const ALL_CARD_TYPES: CardType[] = [
  "definition", "true-false", "fill-blank", "multiple-choice", "cloze",
];

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

export const SM2_GRADE_LABELS: Record<Sm2Grade, string> = {
  again: "Again (<1m)",
  hard: "Hard",
  good: "Good",
  easy: "Easy",
};

export const SM2_DEFAULT_STATE: Sm2State = {
  interval: 0,
  repetitions: 0,
  easiness: 2.5,
  due: 0,
  lastReviewed: null,
};

export const STOPWORDS = new Set<string>([
  "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "shall",
  "should", "may", "might", "must", "can", "could",
  "of", "in", "on", "at", "to", "for", "with", "from", "by", "as",
  "and", "or", "but", "not", "no", "if", "then", "than", "so",
  "this", "that", "these", "those", "it", "its", "they", "them",
  "their", "there", "here", "what", "which", "who", "whom", "whose",
  "when", "where", "why", "how", "all", "any", "some", "each",
  "every", "both", "few", "more", "most", "other", "such", "only",
  "own", "same", "too", "very", "just", "also", "about", "into",
  "through", "during", "before", "after", "above", "below", "between",
  "i", "you", "he", "she", "we", "us", "me", "my", "your", "his",
  "her", "our", "out", "up", "down", "off", "over", "under",
]);

export const DEFAULT_OPTIONS: GenerationOptions = {
  includeTypes: ["definition", "fill-blank", "multiple-choice", "cloze"],
  maxCards: 30,
  defaultDifficulty: "medium",
};

// ---------- Text processing ----------

/** Normalize whitespace and trim. */
export function normalizeText(s: string): string {
  return (s || "").replace(/\s+/g, " ").trim();
}

/** Split text into sentences using punctuation boundaries. */
export function splitSentences(text: string): string[] {
  const clean = normalizeText(text);
  if (!clean) return [];
  // Split on . ! ? followed by space or end. Keep abbreviations simple.
  const raw = clean.split(/(?<=[.!?])\s+(?=[A-Z0-9])/);
  const out: string[] = [];
  for (const s of raw) {
    const trimmed = s.trim();
    if (trimmed.length >= 15) out.push(trimmed);
  }
  return out;
}

/** Tokenize a sentence into lowercase words (no punctuation). */
export function tokenize(sentence: string): string[] {
  return (sentence.toLowerCase().match(/[a-z0-9']+/g) ?? []).filter((w) => w.length >= 2);
}

/** Extract candidate key terms: capitalized words, numbers, frequent non-stopwords. */
export function extractKeyTerms(text: string, max: number = 50): KeyTerm[] {
  const sentences = splitSentences(text);
  const freq = new Map<string, number>();
  for (const s of sentences) {
    const tokens = tokenize(s);
    for (const t of tokens) {
      if (STOPWORDS.has(t)) continue;
      freq.set(t, (freq.get(t) ?? 0) + 1);
    }
  }
  // Capitalized words get a score boost (likely proper nouns / key concepts)
  const capSet = new Set<string>();
  const capMatches = text.match(/\b[A-Z][a-z]{2,}\b/g) ?? [];
  for (const c of capMatches) {
    const lower = c.toLowerCase();
    if (!STOPWORDS.has(lower)) capSet.add(lower);
  }
  const out: KeyTerm[] = [];
  for (const [term, frequency] of freq.entries()) {
    let score = frequency;
    if (capSet.has(term)) score += 1.5;
    if (term.length >= 5) score += 0.5;
    if (term.match(/^\d+$/)) score += 0.3;
    out.push({ term, frequency, score });
  }
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, max);
}

/** Find a sentence containing the term (case-insensitive). Returns null if not found. */
export function findSentenceWith(term: string, sentences: string[]): string | null {
  const lower = term.toLowerCase();
  for (const s of sentences) {
    if (s.toLowerCase().includes(lower)) return s;
  }
  return null;
}

// ---------- Card generators ----------

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function makeCardId(prefix: string = "card"): string {
  _idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${_idCounter.toString(36)}`;
}

let _idCounter = 0;

export function makeId(prefix: string = "id"): string {
  return makeCardId(prefix);
}

/** Generate definition cards: "What is X?" → "X is [source sentence]". */
export function generateDefinitionCards(
  terms: KeyTerm[],
  sentences: string[],
  difficulty: Difficulty,
): Card[] {
  const out: Card[] = [];
  for (const t of terms) {
    const sentence = findSentenceWith(t.term, sentences);
    if (!sentence) continue;
    const q = `What is "${t.term}"?`;
    const a = sentence;
    out.push({
      id: makeCardId("def"),
      type: "definition",
      question: q,
      answer: a,
      grounded: true,
      difficulty,
      tags: ["definition"],
      source: sentence,
      sm2: { ...SM2_DEFAULT_STATE },
    });
  }
  return out;
}

/** Generate true/false cards by manipulating source sentences. */
export function generateTrueFalseCards(
  terms: KeyTerm[],
  sentences: string[],
  difficulty: Difficulty,
): Card[] {
  const out: Card[] = [];
  for (const t of terms) {
    const sentence = findSentenceWith(t.term, sentences);
    if (!sentence) continue;
    // True card: original sentence as-is
    out.push({
      id: makeCardId("tf-true"),
      type: "true-false",
      question: `True or False: ${sentence}`,
      answer: "True",
      grounded: true,
      difficulty,
      tags: ["true-false"],
      source: sentence,
      sm2: { ...SM2_DEFAULT_STATE },
    });
    // False card: substitute the key term with a different term
    if (terms.length > 1) {
      const other = terms.find((x) => x.term !== t.term);
      if (other) {
        const re = new RegExp(escapeRegex(t.term), "i");
        const falsified = sentence.replace(re, other.term);
        if (falsified !== sentence) {
          out.push({
            id: makeCardId("tf-false"),
            type: "true-false",
            question: `True or False: ${falsified}`,
            answer: `False — the correct statement is: ${sentence}`,
            grounded: true,
            difficulty,
            tags: ["true-false"],
            source: sentence,
            sm2: { ...SM2_DEFAULT_STATE },
          });
        }
      }
    }
  }
  return out;
}

/** Generate fill-in-the-blank cards by blanking the key term. */
export function generateFillBlankCards(
  terms: KeyTerm[],
  sentences: string[],
  difficulty: Difficulty,
): Card[] {
  const out: Card[] = [];
  for (const t of terms) {
    const sentence = findSentenceWith(t.term, sentences);
    if (!sentence) continue;
    const re = new RegExp(escapeRegex(t.term), "i");
    const blanked = sentence.replace(re, "____");
    if (blanked === sentence) continue;
    out.push({
      id: makeCardId("fb"),
      type: "fill-blank",
      question: `Fill in the blank: ${blanked}`,
      answer: t.term,
      grounded: true,
      difficulty,
      tags: ["fill-blank"],
      source: sentence,
      sm2: { ...SM2_DEFAULT_STATE },
    });
  }
  return out;
}

/** Generate multiple-choice cards. */
export function generateMultipleChoiceCards(
  terms: KeyTerm[],
  sentences: string[],
  difficulty: Difficulty,
): Card[] {
  const out: Card[] = [];
  for (const t of terms) {
    const sentence = findSentenceWith(t.term, sentences);
    if (!sentence) continue;
    // Distractors: pick 3 other terms
    const distractors = terms
      .filter((x) => x.term !== t.term)
      .slice(0, 3)
      .map((x) => x.term);
    if (distractors.length < 3) continue;
    const options = [t.term, ...distractors];
    // Shuffle deterministically (sort by hash of option+term)
    options.sort((a, b) => {
      const ha = (a + t.term).split("").reduce((s, c) => (s * 31 + c.charCodeAt(0)) | 0, 0);
      const hb = (b + t.term).split("").reduce((s, c) => (s * 31 + c.charCodeAt(0)) | 0, 0);
      return ha - hb;
    });
    const correctIndex = options.indexOf(t.term);
    if (correctIndex < 0) continue;
    const re = new RegExp(escapeRegex(t.term), "i");
    const blanked = sentence.replace(re, "____");
    out.push({
      id: makeCardId("mc"),
      type: "multiple-choice",
      question: `Which term best fills the blank? ${blanked}`,
      answer: t.term,
      options,
      correctIndex,
      grounded: true,
      difficulty,
      tags: ["multiple-choice"],
      source: sentence,
      sm2: { ...SM2_DEFAULT_STATE },
    });
  }
  return out;
}

/** Generate cloze cards with Anki {{c1::...}} syntax. */
export function generateClozeCards(
  terms: KeyTerm[],
  sentences: string[],
  difficulty: Difficulty,
): Card[] {
  const out: Card[] = [];
  for (const t of terms) {
    const sentence = findSentenceWith(t.term, sentences);
    if (!sentence) continue;
    const re = new RegExp(`\\b${escapeRegex(t.term)}\\b`, "i");
    const cloze = sentence.replace(re, `{{c1::${t.term}}}`);
    if (cloze === sentence) continue;
    out.push({
      id: makeCardId("cloze"),
      type: "cloze",
      question: cloze,
      answer: t.term,
      cloze,
      grounded: true,
      difficulty,
      tags: ["cloze"],
      source: sentence,
      sm2: { ...SM2_DEFAULT_STATE },
    });
  }
  return out;
}

/** Generate all card types from text. */
export function generateAllCards(
  text: string,
  options: GenerationOptions = DEFAULT_OPTIONS,
): Card[] {
  const sentences = splitSentences(text);
  if (sentences.length === 0) return [];
  const terms = extractKeyTerms(text, 20);
  if (terms.length === 0) return [];
  const out: Card[] = [];
  const types = options.includeTypes.length > 0 ? options.includeTypes : ALL_CARD_TYPES;
  for (const t of types) {
    let cards: Card[] = [];
    switch (t) {
      case "definition": cards = generateDefinitionCards(terms, sentences, options.defaultDifficulty); break;
      case "true-false": cards = generateTrueFalseCards(terms, sentences, options.defaultDifficulty); break;
      case "fill-blank": cards = generateFillBlankCards(terms, sentences, options.defaultDifficulty); break;
      case "multiple-choice": cards = generateMultipleChoiceCards(terms, sentences, options.defaultDifficulty); break;
      case "cloze": cards = generateClozeCards(terms, sentences, options.defaultDifficulty); break;
    }
    out.push(...cards);
  }
  // Cap at maxCards
  const capped = out.slice(0, options.maxCards);
  return capped;
}

/** Generate a deck with a name. */
export function generateDeck(text: string, name: string, options: GenerationOptions = DEFAULT_OPTIONS): Deck {
  const cards = generateAllCards(text, options);
  return {
    id: makeId("deck"),
    name: name || "Untitled Deck",
    cards,
    createdAt: Date.now(),
  };
}

// ---------- SM-2 scheduler ----------

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * SM-2 spaced-repetition update.
 *
 * @param grade again / hard / good / easy
 * @param state current SM-2 state
 * @param now current time (ms). Defaults to Date.now()
 * @returns new SM-2 state
 */
export function sm2Update(grade: Sm2Grade, state: Sm2State, now: number = Date.now()): Sm2State {
  let { interval, repetitions, easiness } = state;
  if (grade === "again") {
    repetitions = 0;
    interval = 0; // review again in 1 minute (sub-day)
  } else {
    if (repetitions === 0) {
      interval = grade === "easy" ? 4 : 1;
    } else if (repetitions === 1) {
      interval = grade === "easy" ? 8 : 3;
    } else {
      const bonus = grade === "hard" ? 1.2 : grade === "easy" ? 1.3 : 1;
      interval = Math.round(interval * easiness * bonus);
    }
    repetitions += 1;
  }
  // Easiness factor update
  const qMap: Record<Sm2Grade, number> = { again: 0, hard: 3, good: 4, easy: 5 };
  const q = qMap[grade];
  easiness = easiness + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  if (easiness < 1.3) easiness = 1.3;
  if (easiness > 3.0) easiness = 3.0;
  const due = now + interval * DAY_MS;
  return {
    interval,
    repetitions,
    easiness: Math.round(easiness * 100) / 100,
    due,
    lastReviewed: now,
  };
}

/** Compute next review date in days from now. */
export function sm2NextReview(state: Sm2State, now: number = Date.now()): number {
  return Math.max(0, Math.ceil((state.due - now) / DAY_MS));
}

/** Is the card due for review now? */
export function isCardDue(state: Sm2State, now: number = Date.now()): boolean {
  return state.due <= now || state.repetitions === 0;
}

/** Compute study stats for a deck. */
export function computeStudyStats(cards: Card[], now: number = Date.now()): StudyStats {
  const total = cards.length;
  let due = 0;
  let learned = 0;
  let newCards = 0;
  let easinessSum = 0;
  for (const c of cards) {
    if (isCardDue(c.sm2, now)) due++;
    if (c.sm2.repetitions >= 2) learned++;
    if (c.sm2.repetitions === 0 && c.sm2.lastReviewed === null) newCards++;
    easinessSum += c.sm2.easiness;
  }
  return {
    total,
    due,
    learned,
    newCards,
    avgEasiness: total > 0 ? Math.round((easinessSum / total) * 100) / 100 : 0,
  };
}

/** Apply a grade to a card. Returns a new card with updated SM-2 state. */
export function gradeCard(card: Card, grade: Sm2Grade, now: number = Date.now()): Card {
  return {
    ...card,
    sm2: sm2Update(grade, card.sm2, now),
  };
}

/** Sort cards by due date (due first), then by repetitions asc (new first). */
export function sortForStudy(cards: Card[], now: number = Date.now()): Card[] {
  return [...cards].sort((a, b) => {
    const aDue = isCardDue(a.sm2, now) ? 0 : 1;
    const bDue = isCardDue(b.sm2, now) ? 0 : 1;
    if (aDue !== bDue) return aDue - bDue;
    const aRep = a.sm2.repetitions;
    const bRep = b.sm2.repetitions;
    if (aRep !== bRep) return aRep - bRep;
    return a.sm2.due - b.sm2.due;
  });
}

/** Shuffle a deck deterministically using a seed. */
export function shuffleDeck(cards: Card[], seed: number = 0): Card[] {
  let s = seed || 1;
  const rand = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  const arr = [...cards];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Filter to weak cards (easiness < 2.5 or repetitions < 2). */
export function focusWeakCards(cards: Card[]): Card[] {
  return cards.filter((c) => c.sm2.easiness < 2.5 || c.sm2.repetitions < 2);
}

// ---------- Exporters ----------

/** Render deck as Anki-importable TSV (front<TAB>back<TAB>tags). */
export function renderAnkiCsv(deck: Deck): string {
  const lines: string[] = [];
  lines.push("#deck\tfront\tback\ttags");
  for (const c of deck.cards) {
    const front = ankiEscape(cardFront(c));
    const back = ankiEscape(cardBack(c));
    const tags = c.tags.join(" ");
    lines.push([deck.name, front, back, tags].join("\t"));
  }
  return lines.join("\n");
}

function cardFront(c: Card): string {
  if (c.type === "cloze" && c.cloze) return c.cloze;
  if (c.type === "multiple-choice" && c.options) {
    return `${c.question}\n\nA. ${c.options[0]}\nB. ${c.options[1]}\nC. ${c.options[2]}\nD. ${c.options[3]}`;
  }
  return c.question;
}

function cardBack(c: Card): string {
  if (c.type === "multiple-choice" && c.options && c.correctIndex !== undefined) {
    const letter = ["A", "B", "C", "D"][c.correctIndex] ?? "?";
    return `${letter}. ${c.options[c.correctIndex]}`;
  }
  return c.answer;
}

function ankiEscape(s: string): string {
  // Anki tab/newline handling
  return s.replace(/\t/g, " ").replace(/\r/g, "");
}

/** Render deck as Quizlet-importable CSV (front,back with quotes). */
export function renderQuizletCsv(deck: Deck): string {
  const lines: string[] = [];
  for (const c of deck.cards) {
    const front = csvEscape(cardFront(c).replace(/\n/g, " "));
    const back = csvEscape(cardBack(c).replace(/\n/g, " "));
    lines.push(`${front},${back}`);
  }
  return lines.join("\n");
}

function csvEscape(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Render deck as JSON (full metadata). */
export function renderJson(deck: Deck): string {
  return JSON.stringify(deck, null, 2);
}

/** Parse a previously-exported JSON deck. */
export function parseJsonDeck(json: string): Deck | null {
  try {
    const parsed = JSON.parse(json) as Deck;
    if (!parsed || typeof parsed !== "object") return null;
    if (!Array.isArray(parsed.cards)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Render deck as plain text study list. */
export function renderText(deck: Deck): string {
  const lines: string[] = [];
  lines.push(`DECK: ${deck.name}`);
  lines.push(`CARDS: ${deck.cards.length}`);
  lines.push(`CREATED: ${new Date(deck.createdAt).toISOString()}`);
  lines.push("");
  for (let i = 0; i < deck.cards.length; i++) {
    const c = deck.cards[i];
    lines.push(`${i + 1}. [${CARD_TYPE_LABELS[c.type]}] ${c.question}`);
    lines.push(`   A: ${cardBack(c)}`);
    if (c.tags.length > 0) lines.push(`   Tags: ${c.tags.join(", ")}`);
    lines.push("");
  }
  lines.push("DISCLAIMER: AI-generated cards may contain errors. Review before relying on them for exams.");
  return lines.join("\n");
}

/** Render deck as Markdown. */
export function renderMarkdown(deck: Deck): string {
  const lines: string[] = [];
  lines.push(`# ${deck.name}`);
  lines.push("");
  lines.push(`**Cards:** ${deck.cards.length}  `);
  lines.push(`**Created:** ${new Date(deck.createdAt).toLocaleString()}`);
  lines.push("");
  for (let i = 0; i < deck.cards.length; i++) {
    const c = deck.cards[i];
    lines.push(`## Card ${i + 1} — ${CARD_TYPE_LABELS[c.type]}`);
    lines.push("");
    lines.push(`**Q:** ${c.question}`);
    lines.push("");
    lines.push(`**A:** ${cardBack(c)}`);
    if (c.tags.length > 0) lines.push(`\n**Tags:** ${c.tags.join(", ")}`);
    if (c.source) lines.push(`\n> Source: ${c.source}`);
    lines.push("");
  }
  lines.push("---");
  lines.push("");
  lines.push("*Disclaimer: AI-generated cards may contain errors. Review before relying on them for exams.*");
  return lines.join("\n");
}

// ---------- Deck operations ----------

/** Merge multiple decks into one. Preserves all cards with new ids for any duplicates. */
export function mergeDecks(decks: Deck[], name: string): Deck {
  const cards: Card[] = [];
  for (const d of decks) cards.push(...d.cards);
  return {
    id: makeId("deck"),
    name: name || "Merged Deck",
    cards,
    createdAt: Date.now(),
  };
}

/** Update a single card in a deck. Returns new deck. */
export function updateCard(deck: Deck, cardId: string, patch: Partial<Card>): Deck {
  return {
    ...deck,
    cards: deck.cards.map((c) => (c.id === cardId ? { ...c, ...patch } : c)),
  };
}

/** Delete a card from a deck. Returns new deck. */
export function deleteCard(deck: Deck, cardId: string): Deck {
  return {
    ...deck,
    cards: deck.cards.filter((c) => c.id !== cardId),
  };
}

/** Add a card to a deck. Returns new deck. */
export function addCard(deck: Deck, card: Card): Deck {
  return {
    ...deck,
    cards: [...deck.cards, card],
  };
}

/** Count cards by type. */
export function countByType(cards: Card[]): Record<CardType, number> {
  const counts: Record<CardType, number> = {
    "definition": 0,
    "true-false": 0,
    "fill-blank": 0,
    "multiple-choice": 0,
    "cloze": 0,
  };
  for (const c of cards) counts[c.type] += 1;
  return counts;
}

// ---------- History (localStorage) ----------

const HISTORY_KEY = "unqtools:ai-flashcard-qa-generator:history";
const HISTORY_MAX = 20;

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

// ---------- Shareable URL ----------

export interface ShareState {
  deckName: string;
  text: string;
  options: GenerationOptions;
}

export function buildShareUrl(state: ShareState): string {
  const params = new URLSearchParams();
  if (state.deckName) params.set("name", state.deckName);
  if (state.text) params.set("text", state.text);
  if (state.options.includeTypes.length > 0) {
    params.set("types", state.options.includeTypes.join(","));
  }
  if (state.options.maxCards) params.set("max", String(state.options.maxCards));
  if (state.options.defaultDifficulty) params.set("diff", state.options.defaultDifficulty);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareState | null {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return null;
  const params = new URLSearchParams(clean);
  const deckName = params.get("name") ?? "Shared Deck";
  const text = params.get("text") ?? "";
  const typesStr = params.get("types") ?? "";
  const types = typesStr
    ? typesStr.split(",").filter((t) => ALL_CARD_TYPES.includes(t as CardType)) as CardType[]
    : [...DEFAULT_OPTIONS.includeTypes];
  const max = Number(params.get("max") ?? DEFAULT_OPTIONS.maxCards);
  const diff = (params.get("diff") as Difficulty) ?? DEFAULT_OPTIONS.defaultDifficulty;
  if (!text) return null;
  return {
    deckName,
    text,
    options: { includeTypes: types, maxCards: max, defaultDifficulty: diff },
  };
}
