/**
 * Flashcard Deck Organizer — pure logic.
 * Deck management, SM-2 review scheduling, CSV/Anki export.
 */

export interface Flashcard {
  id: string;
  front: string;
  back: string;
  tags: string[];
  createdAt: number;
  ease: number; // SM-2 ease factor (default 2.5)
  intervalDays: number;
  repetitions: number;
  dueAt: number; // unix ms
  lastReviewedAt: number | null;
}

export interface Deck {
  id: string;
  name: string;
  description: string;
  cards: Flashcard[];
  createdAt: number;
}

export function createDeck(name: string, description = ""): Deck {
  return {
    id: `deck-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: name.trim() || "Untitled deck",
    description,
    cards: [],
    createdAt: Date.now(),
  };
}

export function createCard(front: string, back: string, tags: string[] = []): Flashcard {
  return {
    id: `card-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    front: front.trim(),
    back: back.trim(),
    tags,
    createdAt: Date.now(),
    ease: 2.5,
    intervalDays: 0,
    repetitions: 0,
    dueAt: Date.now(),
    lastReviewedAt: null,
  };
}

/** Add a card to a deck (immutably). */
export function addCard(deck: Deck, card: Flashcard): Deck {
  return { ...deck, cards: [...deck.cards, card] };
}

/** Remove a card by id. */
export function removeCard(deck: Deck, cardId: string): Deck {
  return { ...deck, cards: deck.cards.filter((c) => c.id !== cardId) };
}

/** Update a card by id. */
export function updateCard(deck: Deck, cardId: string, patch: Partial<Flashcard>): Deck {
  return {
    ...deck,
    cards: deck.cards.map((c) => (c.id === cardId ? { ...c, ...patch } : c)),
  };
}

/** Search cards by text or tag. */
export function searchCards(deck: Deck, query: string): Flashcard[] {
  const q = query.trim().toLowerCase();
  if (!q) return deck.cards;
  return deck.cards.filter(
    (c) => c.front.toLowerCase().includes(q) || c.back.toLowerCase().includes(q) || c.tags.some((t) => t.toLowerCase().includes(q)),
  );
}

/** Get cards due for review. */
export function getDueCards(deck: Deck, now = Date.now()): Flashcard[] {
  return deck.cards.filter((c) => c.dueAt <= now);
}

/** SM-2 algorithm: review a card with quality 0-5. */
export function reviewCard(card: Flashcard, quality: number, now = Date.now()): Flashcard {
  // q: 0=again, 1=hard, 2=hard, 3=good, 4=easy, 5=perfect
  const q = Math.max(0, Math.min(5, quality));
  let { ease, intervalDays, repetitions } = card;

  if (q < 3) {
    repetitions = 0;
    intervalDays = 1; // relearn tomorrow
  } else {
    repetitions += 1;
    if (repetitions === 1) intervalDays = 1;
    else if (repetitions === 2) intervalDays = 6;
    else intervalDays = Math.round(intervalDays * ease);
  }

  // Update ease
  ease = ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  if (ease < 1.3) ease = 1.3;

  const dueAt = now + intervalDays * 24 * 60 * 60 * 1000;
  return { ...card, ease, intervalDays, repetitions, dueAt, lastReviewedAt: now };
}

/** Stats summary for a deck. */
export function deckStats(deck: Deck): {
  total: number;
  dueToday: number;
  learned: number;
  avgEase: number;
  avgInterval: number;
  tags: string[];
} {
  const total = deck.cards.length;
  const now = Date.now();
  const dueToday = deck.cards.filter((c) => c.dueAt <= now).length;
  const learned = deck.cards.filter((c) => c.repetitions >= 2).length;
  const avgEase = total ? deck.cards.reduce((s, c) => s + c.ease, 0) / total : 0;
  const avgInterval = total ? deck.cards.reduce((s, c) => s + c.intervalDays, 0) / total : 0;
  const tags = Array.from(new Set(deck.cards.flatMap((c) => c.tags)));
  return { total, dueToday, learned, avgEase, avgInterval, tags };
}

/** Export deck as CSV. */
export function exportDeckAsCSV(deck: Deck): string {
  const header = ["id", "front", "back", "tags", "ease", "interval_days", "repetitions", "due_at"];
  const rows = deck.cards.map((c) =>
    [c.id, `"${c.front.replace(/"/g, '""')}"`, `"${c.back.replace(/"/g, '""')}"`, `"${c.tags.join("; ")}"`, c.ease, c.intervalDays, c.repetitions, c.dueAt].join(","),
  );
  return [header.join(","), ...rows].join("\n");
}

/** Export deck as Anki TSV (tab-separated, importable). */
export function exportDeckAsAnki(deck: Deck): string {
  const rows = deck.cards.map((c) =>
    [c.front.replace(/\t/g, " "), c.back.replace(/\t/g, " "), c.tags.join(" ")].join("\t"),
  );
  return rows.join("\n");
}

/** Export as JSON. */
export function exportDeckAsJSON(deck: Deck): string {
  return JSON.stringify(deck, null, 2);
}

/** Import cards from CSV (basic). */
export function importFromCSV(csv: string): Flashcard[] {
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const cards: Flashcard[] = [];
  // skip header
  for (let i = 1; i < lines.length; i++) {
    const parts = parseCSVLine(lines[i]);
    if (parts.length >= 2) {
      const tags = parts[2] ? parts[2].split(";").map((t) => t.trim()).filter(Boolean) : [];
      cards.push(createCard(parts[0], parts[1], tags));
    }
  }
  return cards;
}

function parseCSVLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

/** Validate card content. */
export function validateCard(front: string, back: string): string[] {
  const w: string[] = [];
  if (!front.trim()) w.push("Front is empty.");
  if (!back.trim()) w.push("Back is empty.");
  if (front.length > 1000) w.push("Front is very long (>1000 chars) — consider splitting.");
  if (back.length > 1000) w.push("Back is very long (>1000 chars) — consider splitting.");
  return w;
}

/** Sort cards by due date (ascending). */
export function sortByDue(deck: Deck): Flashcard[] {
  return [...deck.cards].sort((a, b) => a.dueAt - b.dueAt);
}

/** Reset all review state for a deck. */
export function resetProgress(deck: Deck): Deck {
  return {
    ...deck,
    cards: deck.cards.map((c) => ({ ...c, ease: 2.5, intervalDays: 0, repetitions: 0, dueAt: Date.now(), lastReviewedAt: null })),
  };
}

/** Tag frequency map. */
export function tagFrequency(deck: Deck): Record<string, number> {
  const map: Record<string, number> = {};
  for (const c of deck.cards) {
    for (const t of c.tags) {
      map[t] = (map[t] ?? 0) + 1;
    }
  }
  return map;
}

/** Forecast review load for next N days. */
export function forecastReviewLoad(deck: Deck, days: number, now = Date.now()): number[] {
  const out = new Array(days).fill(0);
  const oneDay = 24 * 60 * 60 * 1000;
  for (const c of deck.cards) {
    const dayIndex = Math.floor((c.dueAt - now) / oneDay);
    if (dayIndex >= 0 && dayIndex < days) out[dayIndex]++;
  }
  return out;
}

/** Build a study session of N due cards. */
export function buildStudySession(deck: Deck, maxCards: number, now = Date.now()): Flashcard[] {
  return getDueCards(deck, now).slice(0, maxCards);
}
