import { describe, it, expect } from "vitest";
import {
  buildTicketPool,
  shuffle,
  validateGiveaway,
  runGiveaway,
  parseParticipants,
  type GiveawayEntry,
  type GiveawayPrize,
  type RandomSource,
} from "./logic";

function seededRandom(seed: number): RandomSource {
  let s = seed >>> 0;
  return (max: number) => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s % max;
  };
}

const entries: GiveawayEntry[] = [
  { id: "1", name: "Alice", entries: 1 },
  { id: "2", name: "Bob", entries: 2 },
  { id: "3", name: "Carol", entries: 3 },
  { id: "4", name: "Dave", entries: 1 },
];

const prizes: GiveawayPrize[] = [
  { label: "T-Shirt", count: 2, value: 20 },
  { label: "Mug", count: 1, value: 10 },
];

describe("social-media-giveaway buildTicketPool", () => {
  it("expands entries into tickets", () => {
    const pool = buildTicketPool([{ id: "1", name: "A", entries: 3 }]);
    expect(pool.length).toBe(3);
  });

  it("defaults to 1 ticket", () => {
    const pool = buildTicketPool([{ id: "1", name: "A", entries: 0 }]);
    expect(pool.length).toBe(1);
  });
});

describe("social-media-giveaway shuffle", () => {
  it("preserves all elements", () => {
    const out = shuffle([1, 2, 3, 4], seededRandom(1));
    expect(out.sort()).toEqual([1, 2, 3, 4]);
  });
});

describe("social-media-giveaway validateGiveaway", () => {
  it("accepts valid input", () => {
    expect(validateGiveaway(entries, prizes)).toBeNull();
  });

  it("rejects empty entries", () => {
    expect(validateGiveaway([], prizes)).not.toBeNull();
  });

  it("rejects empty prizes", () => {
    expect(validateGiveaway(entries, [])).not.toBeNull();
  });

  it("rejects zero count prize", () => {
    expect(validateGiveaway(entries, [{ label: "X", count: 0, value: 0 }])).not.toBeNull();
  });
});

describe("social-media-giveaway runGiveaway", () => {
  it("assigns all prizes when enough participants", () => {
    const r = runGiveaway(entries, prizes, seededRandom(1));
    expect(r.isValid).toBe(true);
    expect(r.assignments.length).toBe(3);
  });

  it("no participant wins twice", () => {
    const r = runGiveaway(entries, prizes, seededRandom(1));
    const ids = r.assignments.map((a) => a.participant.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("reports total tickets correctly", () => {
    const r = runGiveaway(entries, prizes, seededRandom(1));
    expect(r.totalTickets).toBe(7); // 1+2+3+1
  });

  it("reports total prize value", () => {
    const r = runGiveaway(entries, prizes, seededRandom(1));
    expect(r.totalPrizeValue).toBe(50); // 2*20 + 1*10
  });

  it("lists unassigned participants", () => {
    const r = runGiveaway(entries, prizes, seededRandom(1));
    expect(r.unassigned.length).toBe(1); // 4 participants, 3 prizes
  });

  it("returns error for invalid input", () => {
    const r = runGiveaway([], prizes, seededRandom(1));
    expect(r.isValid).toBe(false);
    expect(r.error).toBeTruthy();
  });

  it("honors prize preferences when possible", () => {
    const e: GiveawayEntry[] = [
      { id: "1", name: "A", entries: 1, prizePreference: "Mug" },
      { id: "2", name: "B", entries: 1, prizePreference: "T-Shirt" },
    ];
    const r = runGiveaway(e, prizes, seededRandom(1));
    expect(r.isValid).toBe(true);
    const mugWinner = r.assignments.find((a) => a.prize.label === "Mug");
    expect(mugWinner?.participant.id).toBe("1");
  });
});

describe("social-media-giveaway parseParticipants", () => {
  it("parses name,entries pairs", () => {
    const e = parseParticipants("Alice,1\nBob,3");
    expect(e.length).toBe(2);
    expect(e[1].entries).toBe(3);
  });

  it("defaults entries to 1 when missing", () => {
    const e = parseParticipants("Carol");
    expect(e[0].entries).toBe(1);
  });

  it("returns empty for empty input", () => {
    expect(parseParticipants("")).toEqual([]);
  });
});
