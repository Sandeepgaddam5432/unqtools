/**
 * Vocabulary Trainer — unit tests.
 */
import { describe, it, expect } from "vitest";
import { newCard, schedule, dueCards, stats, todayISO } from "./logic";

describe("vocab newCard", () => {
  it("creates a card with default SM-2 state", () => {
    const c = newCard("hello", "hola");
    expect(c.front).toBe("hello");
    expect(c.back).toBe("hola");
    expect(c.repetitions).toBe(0);
    expect(c.interval).toBe(0);
    expect(c.ease).toBe(2.5);
    expect(c.nextReview).toBe(todayISO());
  });
});

describe("vocab schedule SM-2", () => {
  it("resets repetitions on quality < 3 (forgot)", () => {
    const c = newCard("a", "b");
    const updated = schedule(c, 1);
    expect(updated.repetitions).toBe(0);
    expect(updated.interval).toBe(1);
  });
  it("sets interval to 1 on first correct review", () => {
    const c = newCard("a", "b");
    const updated = schedule(c, 4);
    expect(updated.repetitions).toBe(1);
    expect(updated.interval).toBe(1);
  });
  it("sets interval to 6 on second correct review", () => {
    let c = newCard("a", "b");
    c = schedule(c, 4);
    c = schedule(c, 4);
    expect(c.repetitions).toBe(2);
    expect(c.interval).toBe(6);
  });
  it("multiplies interval by ease on subsequent reviews", () => {
    let c = newCard("a", "b");
    c = schedule(c, 4); // reps 1, interval 1
    c = schedule(c, 4); // reps 2, interval 6
    c = schedule(c, 4); // reps 3, interval ~ round(6 * ease)
    expect(c.repetitions).toBe(3);
    expect(c.interval).toBeGreaterThan(6);
  });
  it("never lets ease drop below 1.3", () => {
    let c = newCard("a", "b");
    for (let i = 0; i < 5; i++) c = schedule(c, 0);
    expect(c.ease).toBeGreaterThanOrEqual(1.3);
  });
  it("updates lastReview to today", () => {
    const c = newCard("a", "b");
    const updated = schedule(c, 4);
    expect(updated.lastReview).toBe(todayISO());
  });
});

describe("vocab dueCards", () => {
  it("includes cards with nextReview <= today", () => {
    const today = todayISO();
    const c = newCard("a", "b");
    expect(dueCards([c], today)).toHaveLength(1);
  });
  it("excludes cards scheduled in the future", () => {
    const today = todayISO();
    const c = newCard("a", "b");
    const updated = schedule(c, 5);
    // After schedule, nextReview = today + interval (>= 1)
    expect(dueCards([updated], today)).toHaveLength(0);
  });
});

describe("vocab stats", () => {
  it("computes totals correctly", () => {
    const cards = [newCard("a", "b"), newCard("c", "d"), newCard("e", "f")];
    const s = stats(cards);
    expect(s.total).toBe(3);
    expect(s.due).toBe(3);
    expect(s.learned).toBe(0);
  });
  it("computes learned cards after scheduling", () => {
    let c = newCard("a", "b");
    c = schedule(c, 4);
    const s = stats([c]);
    expect(s.learned).toBe(1);
  });
  it("avgEase is 0 for empty set", () => {
    expect(stats([]).avgEase).toBe(0);
  });
});
