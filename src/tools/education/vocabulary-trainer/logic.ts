/**
 * Vocabulary Trainer — pure logic.
 * SM-2 lite spaced repetition scheduling.
 */

export interface Flashcard {
  id: string;
  front: string;
  back: string;
  // SM-2 state
  repetitions: number;
  interval: number;  // days
  ease: number;      // ease factor
  nextReview: string; // ISO date yyyy-mm-dd
  lastReview: string | null;
}

export type Quality = 0 | 1 | 2 | 3 | 4 | 5;
// 0-2 = forgot; 3 = hard; 4 = good; 5 = easy

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Apply SM-2 algorithm to schedule the next review. */
export function schedule(card: Flashcard, quality: Quality): Flashcard {
  let { repetitions, interval, ease } = card;

  if (quality < 3) {
    repetitions = 0;
    interval = 1;
  } else {
    if (repetitions === 0) interval = 1;
    else if (repetitions === 1) interval = 6;
    else interval = Math.round(interval * ease);
    repetitions += 1;
  }

  // Update ease
  ease = ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  if (ease < 1.3) ease = 1.3;

  return {
    ...card,
    repetitions,
    interval,
    ease: Math.round(ease * 100) / 100,
    lastReview: todayISO(),
    nextReview: addDaysISO(todayISO(), interval),
  };
}

export function newCard(front: string, back: string, id?: string): Flashcard {
  return {
    id: id ?? String(Date.now()),
    front,
    back,
    repetitions: 0,
    interval: 0,
    ease: 2.5,
    nextReview: todayISO(),
    lastReview: null,
  };
}

/** Return cards due for review today (or earlier). */
export function dueCards(cards: Flashcard[], today: string = todayISO()): Flashcard[] {
  return cards.filter((c) => c.nextReview <= today).sort((a, b) => a.nextReview.localeCompare(b.nextReview));
}

export interface ReviewStats {
  total: number;
  due: number;
  learned: number;
  avgEase: number;
}

export function stats(cards: Flashcard[], today: string = todayISO()): ReviewStats {
  const due = cards.filter((c) => c.nextReview <= today).length;
  const learned = cards.filter((c) => c.repetitions > 0).length;
  const avgEase = cards.length > 0 ? cards.reduce((s, c) => s + c.ease, 0) / cards.length : 0;
  return { total: cards.length, due, learned, avgEase: Math.round(avgEase * 100) / 100 };
}
