/**
 * Flashcard Maker & Study Mode — pure logic.
 *
 * Parse cards (pipe/comma/tab/JSON), validate decks, shuffle (Fisher-Yates),
 * iterate sequentially, run simplified SM-2 spaced repetition, compute
 * session/summary stats, render text/CSV/JSON, history (localStorage),
 * shareable URL, search filter, reverse mode, tags, difficulty, presets.
 *
 * Pure functions only — no DOM, no network.
 */

// ---- Types ----

export type StudyMode = "sequential" | "shuffled" | "spaced-repetition-simplified";
export type Difficulty = "easy" | "medium" | "hard";

export interface Card {
  id: string;
  term: string;
  definition: string;
  tags: string[];
  difficulty: Difficulty;
  // SM-2 spaced-repetition state
  easeFactor: number;
  interval: number; // days
  repetitions: number;
  // Session state
  seen: boolean;
  known: boolean | null; // null = unanswered, true = known, false = unknown
}

export interface Deck {
  name: string;
  cards: Card[];
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  cardCount: number;
}

export interface SessionStats {
  totalCards: number;
  seenCards: number;
  knownCount: number;
  unknownCount: number;
  unansweredCount: number;
  accuracy: number; // 0-100
}

export interface SummaryStats {
  totalCards: number;
  totalStudied: number;
  accuracy: number;
  knownCount: number;
  unknownCount: number;
  byDifficulty: Record<Difficulty, number>;
  tagsCount: number;
  uniqueTags: number;
}

export interface HistoryEntry {
  ts: number;
  deckName: string;
  cardCount: number;
  studyMode: StudyMode;
  accuracy: number;
}

// ---- Constants ----

export const STUDY_MODES: StudyMode[] = [
  "sequential",
  "shuffled",
  "spaced-repetition-simplified",
];

export const STUDY_MODE_LABELS: Record<StudyMode, string> = {
  sequential: "Sequential",
  shuffled: "Shuffled",
  "spaced-repetition-simplified": "Spaced Repetition (SM-2)",
};

export const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard"];

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

/** Default SM-2 constants. */
export const SM2_DEFAULT_EASE = 2.5;
export const SM2_MIN_EASE = 1.3;
export const SM2_QUALITY_KNOWN = 5; // q=5 perfect
export const SM2_QUALITY_UNKNOWN = 2; // q<3 incorrect

export interface DeckPreset {
  id: string;
  name: string;
  description: string;
  cardsText: string; // pipe-separated
}

export const DECK_PRESETS: DeckPreset[] = [
  {
    id: "spanish-vocab",
    name: "Spanish Vocabulary",
    description: "10 common Spanish→English words for beginners",
    cardsText: [
      "hola|hello|greeting,basic|easy",
      "gracias|thank you|greeting,basic|easy",
      "por favor|please|greeting,basic|easy",
      "agua|water|food,basic|easy",
      "comida|food|food,basic|medium",
      "amigo|friend|people,basic|easy",
      "casa|house|home,basic|medium",
      "tiempo|time|abstract|medium",
      "trabajo|work|life|medium",
      "feliz|happy|emotion|hard",
    ].join("\n"),
  },
  {
    id: "us-states",
    name: "US State Capitals",
    description: "10 US states and their capitals",
    cardsText: [
      "California|Sacramento|geography|medium",
      "Texas|Austin|geography|medium",
      "New York|Albany|geography|medium",
      "Florida|Tallahassee|geography|hard",
      "Illinois|Springfield|geography|medium",
      "Pennsylvania|Harrisburg|geography|hard",
      "Ohio|Columbus|geography|easy",
      "Georgia|Atlanta|geography|easy",
      "Michigan|Lansing|geography|hard",
      "Arizona|Phoenix|geography|easy",
    ].join("\n"),
  },
  {
    id: "multiplication-tables",
    name: "Multiplication Tables (×2 to ×5)",
    description: "10 basic multiplication facts",
    cardsText: [
      "2 × 3|6|math|easy",
      "2 × 7|14|math|easy",
      "3 × 4|12|math|easy",
      "3 × 8|24|math|medium",
      "4 × 5|20|math|easy",
      "4 × 9|36|math|medium",
      "5 × 6|30|math|easy",
      "5 × 7|35|math|easy",
      "5 × 12|60|math|medium",
      "12 × 12|144|math|hard",
    ].join("\n"),
  },
  {
    id: "periodic-table",
    name: "Periodic Table Symbols",
    description: "10 chemical element symbols and names",
    cardsText: [
      "H|Hydrogen|chemistry|easy",
      "He|Helium|chemistry|easy",
      "Li|Lithium|chemistry|medium",
      "C|Carbon|chemistry|easy",
      "N|Nitrogen|chemistry|easy",
      "O|Oxygen|chemistry|easy",
      "Na|Sodium|chemistry|hard",
      "Fe|Iron|chemistry|hard",
      "Au|Gold|chemistry|medium",
      "Ag|Silver|chemistry|medium",
    ].join("\n"),
  },
];

// ---- Normalization ----

/** Trim + collapse internal whitespace. */
export function normalizeText(s: string): string {
  return (s || "").replace(/\s+/g, " ").trim();
}

/** Generate a stable id for a card (term-based hash). */
export function makeCardId(term: string, idx: number): string {
  const safe = (term || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return safe ? `${safe}-${idx}` : `card-${idx}`;
}

/** Parse a comma-separated tag list. */
export function parseTags(s: string): string[] {
  if (!s) return [];
  return s
    .split(/[,\s]+/)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
}

/** Detect if a string is a valid difficulty. */
export function isDifficulty(s: string): s is Difficulty {
  return s === "easy" || s === "medium" || s === "hard";
}

// ---- Card parser (multi-format) ----

/** Try to parse JSON array of {term, definition, tags?, difficulty?}. */
export function parseJsonCards(text: string): Card[] | null {
  const t = (text || "").trim();
  if (!t.startsWith("[") && !t.startsWith("{")) return null;
  let data: unknown;
  try {
    data = JSON.parse(t);
  } catch {
    return null;
  }
  const arr = Array.isArray(data) ? data : [data];
  const out: Card[] = [];
  arr.forEach((item, idx) => {
    if (!item || typeof item !== "object") return;
    const rec = item as Record<string, unknown>;
    const term = typeof rec.term === "string" ? rec.term : "";
    const definition = typeof rec.definition === "string" ? rec.definition : "";
    if (!term || !definition) return;
    const tagsRaw = Array.isArray(rec.tags)
      ? (rec.tags as unknown[]).map(String)
      : typeof rec.tags === "string" ? [rec.tags] : [];
    const diffRaw = typeof rec.difficulty === "string" ? rec.difficulty : "medium";
    out.push(makeCard(term, definition, parseTags(tagsRaw.join(",")), isDifficulty(diffRaw) ? diffRaw : "medium", idx));
  });
  return out;
}

/** Build a single Card with default SM-2 state. */
export function makeCard(
  term: string,
  definition: string,
  tags: string[] = [],
  difficulty: Difficulty = "medium",
  idx: number = 0,
): Card {
  return {
    id: makeCardId(term, idx),
    term: normalizeText(term),
    definition: normalizeText(definition),
    tags,
    difficulty,
    easeFactor: SM2_DEFAULT_EASE,
    interval: 0,
    repetitions: 0,
    seen: false,
    known: null,
  };
}

/** Split a CSV row (handles quoted commas). */
export function splitCsvRow(line: string): string[] {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      out.push(current); current = "";
    } else { current += ch; }
  }
  out.push(current);
  return out;
}

/**
 * Parse cards from text. Auto-detects format:
 *  - JSON array/object → parsed as JSON
 *  - Lines containing `|` → pipe-separated (supports up to 4 fields:
 *    term | definition | tags | difficulty)
 *  - Lines containing tab → tab-separated (term \t definition)
 *  - Otherwise → comma-separated via splitCsvRow (term, definition)
 *
 * Empty lines and lines starting with `#` are skipped.
 */
export function parseCards(text: string): Card[] {
  if (!text) return [];
  const trimmed = text.trim();
  // JSON?
  const json = parseJsonCards(trimmed);
  if (json) return json;

  const out: Card[] = [];
  const lines = trimmed.split(/\r?\n/);
  let idx = 0;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    let term = "";
    let definition = "";
    let tags: string[] = [];
    let difficulty: Difficulty = "medium";

    if (line.includes("|")) {
      const parts = line.split("|").map((s) => s.trim());
      term = parts[0] || "";
      definition = parts[1] || "";
      if (parts[2]) {
        if (isDifficulty(parts[2])) {
          difficulty = parts[2];
        } else {
          tags = parseTags(parts[2]);
        }
      }
      if (parts[3] && isDifficulty(parts[3])) difficulty = parts[3];
    } else if (line.includes("\t")) {
      const parts = line.split("\t").map((s) => s.trim());
      term = parts[0] || "";
      definition = parts[1] || "";
    } else {
      const parts = splitCsvRow(line).map((s) => s.trim());
      term = parts[0] || "";
      definition = parts[1] || "";
    }

    if (!term || !definition) continue;
    out.push(makeCard(term, definition, tags, difficulty, idx));
    idx += 1;
  }
  return out;
}

// ---- Deck validator ----

/** Validate a deck: at least 1 card, every card has non-empty term + definition. */
export function validateDeck(deck: Deck): ValidationResult {
  const errors: string[] = [];
  if (!deck.name.trim()) errors.push("Deck name is required");
  if (!deck.cards || deck.cards.length === 0) {
    errors.push("Deck must contain at least 1 card");
    return { ok: false, errors, cardCount: 0 };
  }
  deck.cards.forEach((c, i) => {
    if (!c.term.trim()) errors.push(`Card ${i + 1}: term is empty`);
    if (!c.definition.trim()) errors.push(`Card ${i + 1}: definition is empty`);
  });
  return { ok: errors.length === 0, errors, cardCount: deck.cards.length };
}

// ---- Fisher-Yates shuffler (pure, with optional RNG) ----

/**
 * Fisher-Yates shuffle returning a new array. Pass a seedable RNG for
 * deterministic tests; defaults to Math.random.
 */
export function shuffleCards<T>(arr: T[], rng: () => number = Math.random): T[] {
  if (!arr || arr.length <= 1) return arr ? [...arr] : [];
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ---- Sequential iterator ----

/** Compute the next index in a sequential iterator (wraps around). */
export function nextIndex(current: number, total: number): number {
  if (total <= 0) return 0;
  return (current + 1) % total;
}

/** Compute the previous index in a sequential iterator (wraps around). */
export function prevIndex(current: number, total: number): number {
  if (total <= 0) return 0;
  return (current - 1 + total) % total;
}

// ---- SM-2 spaced repetition ----

/**
 * Update a card's SM-2 state based on whether the user marked it known.
 *
 * Simplified SM-2:
 *  - quality q = 5 if known, q = 2 if unknown
 *  - if q >= 3 (known):
 *      repetitions == 0 → interval = 1
 *      repetitions == 1 → interval = 6
 *      else              → interval = round(interval * easeFactor)
 *      repetitions += 1
 *  - else (unknown):
 *      repetitions = 0, interval = 1
 *  - easeFactor = clamp(1.3, easeFactor + (0.1 - (5-q)*(0.08 + (5-q)*0.02)))
 *
 * Returns a NEW card with updated state (does not mutate input).
 */
export function sm2Update(card: Card, known: boolean): Card {
  const q = known ? SM2_QUALITY_KNOWN : SM2_QUALITY_UNKNOWN;
  const next: Card = {
    ...card,
    tags: [...card.tags],
    seen: true,
    known,
  };

  if (q >= 3) {
    if (next.repetitions === 0) next.interval = 1;
    else if (next.repetitions === 1) next.interval = 6;
    else next.interval = Math.round(next.interval * next.easeFactor);
    next.repetitions += 1;
  } else {
    next.repetitions = 0;
    next.interval = 1;
  }

  // ease factor update
  const delta = 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02);
  next.easeFactor = Math.max(SM2_MIN_EASE, next.easeFactor + delta);
  return next;
}

/** Mark a card as known/unknown and update SM-2 state. */
export function markCard(card: Card, known: boolean): Card {
  return sm2Update(card, known);
}

// ---- Session / Summary stats ----

/** Compute session stats from a list of cards (uses known/seen fields). */
export function computeSessionStats(cards: Card[]): SessionStats {
  const totalCards = cards.length;
  const seenCards = cards.filter((c) => c.seen).length;
  const knownCount = cards.filter((c) => c.known === true).length;
  const unknownCount = cards.filter((c) => c.known === false).length;
  const unansweredCount = cards.filter((c) => c.known === null).length;
  const answeredCount = knownCount + unknownCount;
  const accuracy = answeredCount === 0 ? 0 : (knownCount / answeredCount) * 100;
  return {
    totalCards,
    seenCards,
    knownCount,
    unknownCount,
    unansweredCount,
    accuracy: Math.round(accuracy * 10) / 10,
  };
}

/** Compute summary stats for the whole deck. */
export function computeSummaryStats(cards: Card[]): SummaryStats {
  const totalCards = cards.length;
  const knownCount = cards.filter((c) => c.known === true).length;
  const unknownCount = cards.filter((c) => c.known === false).length;
  const totalStudied = cards.filter((c) => c.seen).length;
  const answeredCount = knownCount + unknownCount;
  const accuracy = answeredCount === 0 ? 0 : (knownCount / answeredCount) * 100;
  const byDifficulty: Record<Difficulty, number> = { easy: 0, medium: 0, hard: 0 };
  const tagSet = new Set<string>();
  let tagsCount = 0;
  for (const c of cards) {
    byDifficulty[c.difficulty] += 1;
    for (const t of c.tags) {
      tagSet.add(t);
      tagsCount += 1;
    }
  }
  return {
    totalCards,
    totalStudied,
    accuracy: Math.round(accuracy * 10) / 10,
    knownCount,
    unknownCount,
    byDifficulty,
    tagsCount,
    uniqueTags: tagSet.size,
  };
}

// ---- Renderers ----

/** Render deck as plain text: one "term — definition" per line. */
export function renderText(cards: Card[]): string {
  return cards.map((c) => `${c.term} — ${c.definition}`).join("\n");
}

/** Escape a CSV field. */
function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Render deck as CSV: term, definition, tags, difficulty. */
export function renderCsv(cards: Card[]): string {
  const lines = ["term,definition,tags,difficulty"];
  for (const c of cards) {
    lines.push([
      escapeCsv(c.term),
      escapeCsv(c.definition),
      escapeCsv(c.tags.join(",")),
      c.difficulty,
    ].join(","));
  }
  return lines.join("\n");
}

/** Render deck as JSON for export. */
export function renderJson(deck: Deck): string {
  return JSON.stringify(
    {
      name: deck.name,
      cards: deck.cards.map((c) => ({
        term: c.term,
        definition: c.definition,
        tags: c.tags,
        difficulty: c.difficulty,
      })),
    },
    null,
    2,
  );
}

/** Render the original pipe-separated source text (for re-import). */
export function renderSource(cards: Card[]): string {
  return cards
    .map((c) => {
      const tags = c.tags.length > 0 ? c.tags.join(",") : "";
      if (tags) return `${c.term}|${c.definition}|${tags}|${c.difficulty}`;
      return `${c.term}|${c.definition}`;
    })
    .join("\n");
}

// ---- Search filter ----

/** Filter cards by search query (matches term or definition, case-insensitive). */
export function filterCards(cards: Card[], query: string): Card[] {
  const q = (query || "").toLowerCase().trim();
  if (!q) return [...cards];
  return cards.filter(
    (c) => c.term.toLowerCase().includes(q) || c.definition.toLowerCase().includes(q),
  );
}

// ---- Reverse mode ----

/** Swap term and definition on every card (returns new cards). */
export function reverseCards(cards: Card[]): Card[] {
  return cards.map((c) => ({
    ...c,
    tags: [...c.tags],
    term: c.definition,
    definition: c.term,
  }));
}

// ---- Tag / difficulty helpers ----

/** Add a tag to a card (returns new card). */
export function addTag(card: Card, tag: string): Card {
  const t = tag.trim().toLowerCase();
  if (!t || card.tags.includes(t)) return card;
  return { ...card, tags: [...card.tags, t] };
}

/** Remove a tag from a card (returns new card). */
export function removeTag(card: Card, tag: string): Card {
  return { ...card, tags: card.tags.filter((t) => t !== tag) };
}

/** Set difficulty on a card (returns new card). */
export function setDifficulty(card: Card, difficulty: Difficulty): Card {
  return { ...card, difficulty };
}

// ---- Presets ----

/** Get a deck preset by id. */
export function getDeckPreset(id: string): DeckPreset | undefined {
  return DECK_PRESETS.find((p) => p.id === id);
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:flashcard-maker:history";
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

// ---- Shareable URL ----

/**
 * Build a shareable URL with deck name + cards encoded in the hash.
 * Uses URLSearchParams for the name and base64 for the cards text.
 */
export function buildShareUrl(deckName: string, cardsText: string, studyMode: StudyMode): string {
  const params = new URLSearchParams();
  if (deckName) params.set("name", deckName);
  if (studyMode) params.set("mode", studyMode);
  if (cardsText) {
    try {
      // base64url encode to keep URL short
      const b64 = typeof btoa !== "undefined"
        ? btoa(unescape(encodeURIComponent(cardsText)))
        : Buffer.from(cardsText, "utf8").toString("base64");
      params.set("d", b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""));
    } catch {
      params.set("t", cardsText);
    }
  }
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export interface ShareParams {
  deckName: string;
  cardsText: string;
  studyMode: StudyMode;
}

/** Parse a shareable URL hash back into params. */
export function parseShareUrl(hash: string): ShareParams {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { deckName: "", cardsText: "", studyMode: "sequential" };
  const params = new URLSearchParams(clean);
  const deckName = params.get("name") ?? "";
  const modeRaw = params.get("mode") ?? "sequential";
  const studyMode: StudyMode = STUDY_MODES.includes(modeRaw as StudyMode)
    ? (modeRaw as StudyMode)
    : "sequential";

  let cardsText = "";
  const d = params.get("d");
  if (d) {
    try {
      // base64url → base64
      const b64 = d.replace(/-/g, "+").replace(/_/g, "/");
      const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
      cardsText = typeof atob !== "undefined"
        ? decodeURIComponent(escape(atob(padded)))
        : Buffer.from(padded, "base64").toString("utf8");
    } catch {
      cardsText = "";
    }
  } else {
    cardsText = params.get("t") ?? "";
  }
  return { deckName, cardsText, studyMode };
}
