/**
 * Social Media Giveaway — pure logic.
 * Multi-prize giveaway with weighted entry options.
 */

export interface GiveawayEntry {
  id: string;
  name: string;
  entries: number; // number of entries (tickets) for this participant
  prizePreference?: string; // optional preferred prize label
}

export interface GiveawayPrize {
  label: string;
  count: number;
  value: number;
}

export interface GiveawayAssignment {
  participant: GiveawayEntry;
  prize: GiveawayPrize;
}

export interface GiveawayResult {
  assignments: GiveawayAssignment[];
  unassigned: GiveawayEntry[];
  totalTickets: number;
  totalPrizeValue: number;
  isValid: boolean;
  error?: string;
}

export type RandomSource = (maxExclusive: number) => number;

export function makeCryptoRandomSource(): RandomSource {
  return (max: number) => {
    if (max <= 0) return 0;
    const buf = new Uint32Array(1);
    const u32max = 0xffffffff;
    const limit = u32max - (u32max % max);
    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (typeof globalThis !== "undefined" && globalThis.crypto?.getRandomValues) {
        globalThis.crypto.getRandomValues(buf);
      } else {
        buf[0] = Math.floor(Math.random() * u32max);
      }
      if (buf[0] < limit) return buf[0] % max;
    }
  };
}

/** Build a flat ticket pool (each ticket is an entry id). */
export function buildTicketPool(entries: GiveawayEntry[]): GiveawayEntry[] {
  const pool: GiveawayEntry[] = [];
  for (const e of entries) {
    const n = Math.max(1, Math.floor(e.entries || 1));
    for (let i = 0; i < n; i++) pool.push(e);
  }
  return pool;
}

/** Shuffle in place using Fisher-Yates; returns a new array. */
export function shuffle<T>(arr: T[], random: RandomSource): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = random(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Validate giveaway inputs. */
export function validateGiveaway(entries: GiveawayEntry[], prizes: GiveawayPrize[]): string | null {
  if (!Array.isArray(entries) || entries.length === 0) return "No participants.";
  if (!Array.isArray(prizes) || prizes.length === 0) return "No prizes.";
  for (const e of entries) {
    if (!e.id || !e.name) return "Each participant needs an id and name.";
    if (e.entries < 1) return "Each participant needs at least 1 entry.";
  }
  for (const p of prizes) {
    if (!p.label) return "Each prize needs a label.";
    if (p.count <= 0) return `Prize "${p.label}" must have a positive count.`;
  }
  return null;
}

/** Run the giveaway: assign prizes to participants. Tries to honor preferences. */
export function runGiveaway(
  entries: GiveawayEntry[],
  prizes: GiveawayPrize[],
  random: RandomSource
): GiveawayResult {
  const err = validateGiveaway(entries, prizes);
  if (err) {
    return { assignments: [], unassigned: entries, totalTickets: 0, totalPrizeValue: 0, isValid: false, error: err };
  }
  const pool = shuffle(buildTicketPool(entries), random);
  const assignments: GiveawayAssignment[] = [];
  const winners = new Set<string>();
  const remainingPrizes: Array<GiveawayPrize & { remaining: number }> = prizes.map((p) => ({ ...p, remaining: p.count }));

  // First pass: honor preferences
  for (const ticket of pool) {
    if (winners.has(ticket.id)) continue;
    if (ticket.prizePreference) {
      const prize = remainingPrizes.find((p) => p.label === ticket.prizePreference && p.remaining > 0);
      if (prize) {
        assignments.push({ participant: ticket, prize });
        prize.remaining--;
        winners.add(ticket.id);
      }
    }
  }

  // Second pass: fill remaining prizes from remaining participants
  for (const prize of remainingPrizes) {
    while (prize.remaining > 0) {
      const next = pool.find((t) => !winners.has(t.id));
      if (!next) break;
      assignments.push({ participant: next, prize });
      prize.remaining--;
      winners.add(next.id);
    }
  }

  const totalTickets = pool.length;
  const totalPrizeValue = assignments.reduce((s, a) => s + a.prize.value, 0);
  const unassigned = entries.filter((e) => !winners.has(e.id));

  return {
    assignments,
    unassigned,
    totalTickets,
    totalPrizeValue,
    isValid: true,
  };
}

/** Parse "name,entries" lines into entries. */
export function parseParticipants(text: string): GiveawayEntry[] {
  if (!text || !text.trim()) return [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  return lines.map((line, i) => {
    const [name, entriesStr] = line.split(/[,\t]/).map((s) => s.trim());
    const n = parseInt(entriesStr ?? "1", 10);
    return {
      id: `p-${i}-${name}`,
      name: name ?? "",
      entries: Number.isFinite(n) && n > 0 ? n : 1,
    };
  });
}
