/**
 * Social Poll Creator — pure logic.
 * Poll options, vote simulation, platform formatting.
 */

export interface PollOption {
  id: string;
  text: string;
  votes: number;
}

export interface Poll {
  id: string;
  question: string;
  options: PollOption[];
  durationHours: number;
  allowMultiple: boolean;
  createdAt: number;
}

export interface PollPlatform {
  id: string;
  name: string;
  maxOptions: number;
  maxOptionLength: number;
  maxQuestionLength: number;
  durations: number[]; // allowed durations in hours
  notes: string;
}

export const POLL_PLATFORMS: PollPlatform[] = [
  { id: "twitter", name: "Twitter / X", maxOptions: 4, maxOptionLength: 25, maxQuestionLength: 280, durations: [1, 6, 12, 24, 48, 72, 168], notes: "Max 4 options, 25 chars each." },
  { id: "instagram", name: "Instagram", maxOptions: 2, maxOptionLength: 26, maxQuestionLength: 100, durations: [0, 24], notes: "Yes/No or 2-option sticker. Live or 24h." },
  { id: "linkedin", name: "LinkedIn", maxOptions: 4, maxOptionLength: 30, maxQuestionLength: 140, durations: [24, 72, 168], notes: "3-day default. No multiple-choice." },
  { id: "facebook", name: "Facebook", maxOptions: 2, maxOptionLength: 80, maxQuestionLength: 255, durations: [168, 336, 672], notes: "Limited options. Long durations." },
  { id: "telegram", name: "Telegram", maxOptions: 10, maxOptionLength: 100, maxQuestionLength: 300, durations: [0, 24, 168], notes: "Up to 10 options. Anonymous mode." },
  { id: "slack", name: "Slack", maxOptions: 10, maxOptionLength: 80, maxQuestionLength: 256, durations: [0], notes: "Live polls via Polly / Simple Poll." },
];

export function getPollPlatform(id: string): PollPlatform | null {
  return POLL_PLATFORMS.find((p) => p.id === id) ?? null;
}

export function getAllPollPlatforms(): PollPlatform[] {
  return [...POLL_PLATFORMS];
}

export function createPoll(question: string, durationHours = 24, allowMultiple = false): Poll {
  return {
    id: `poll-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    question: question.trim() || "Untitled poll",
    options: [],
    durationHours,
    allowMultiple,
    createdAt: Date.now(),
  };
}

export function addOption(poll: Poll, text: string): Poll {
  const opt: PollOption = {
    id: `opt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    text: text.trim(),
    votes: 0,
  };
  return { ...poll, options: [...poll.options, opt] };
}

export function removeOption(poll: Poll, id: string): Poll {
  return { ...poll, options: poll.options.filter((o) => o.id !== id) };
}

export function updateOption(poll: Poll, id: string, patch: Partial<PollOption>): Poll {
  return { ...poll, options: poll.options.map((o) => (o.id === id ? { ...o, ...patch } : o)) };
}

/** Vote for an option (or options if multiple allowed). */
export function vote(poll: Poll, optionIds: string[]): Poll {
  if (optionIds.length === 0) return poll;
  const ids = poll.allowMultiple ? optionIds : [optionIds[0]];
  const idSet = new Set(ids);
  return {
    ...poll,
    options: poll.options.map((o) => (idSet.has(o.id) ? { ...o, votes: o.votes + 1 } : o)),
  };
}

/** Simulate N random votes for testing. */
export function simulateVotes(poll: Poll, count: number, rng: () => number = Math.random): Poll {
  if (poll.options.length === 0) return poll;
  const votes = [...poll.options];
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(rng() * votes.length);
    votes[idx] = { ...votes[idx], votes: votes[idx].votes + 1 };
  }
  return { ...poll, options: votes };
}

/** Total votes across all options. */
export function totalVotes(poll: Poll): number {
  return poll.options.reduce((s, o) => s + o.votes, 0);
}

/** Percentage for each option. */
export function percentages(poll: Poll): Array<{ id: string; text: string; pct: number }> {
  const total = totalVotes(poll);
  return poll.options.map((o) => ({
    id: o.id,
    text: o.text,
    pct: total === 0 ? 0 : (o.votes / total) * 100,
  }));
}

/** Winning option(s) (ties allowed). When only 0 or 1 votes have been cast total, treat as a tie across all options. */
export function winner(poll: Poll): PollOption[] {
  if (poll.options.length === 0) return [];
  const max = Math.max(...poll.options.map((o) => o.votes));
  if (max <= 1) return [...poll.options];
  return poll.options.filter((o) => o.votes === max);
}

/** Validate poll against a platform. */
export function validateForPlatform(poll: Poll, platform: PollPlatform): string[] {
  const w: string[] = [];
  if (poll.question.length > platform.maxQuestionLength) w.push(`Question exceeds ${platform.name} limit (${platform.maxQuestionLength} chars).`);
  if (poll.options.length < 2) w.push("Poll needs at least 2 options.");
  if (poll.options.length > platform.maxOptions) w.push(`${poll.options.length} options — ${platform.name} allows max ${platform.maxOptions}.`);
  for (const o of poll.options) {
    if (o.text.length > platform.maxOptionLength) w.push(`Option "${o.text}" exceeds ${platform.maxOptionLength} char limit.`);
  }
  if (!platform.durations.includes(poll.durationHours)) w.push(`Duration ${poll.durationHours}h not allowed on ${platform.name}.`);
  return w;
}

/** Format poll as plain text (paste-ready). */
export function formatPollText(poll: Poll): string {
  const lines = [`📊 ${poll.question}`];
  poll.options.forEach((o, i) => {
    lines.push(`${i + 1}. ${o.text}`);
  });
  lines.push(`⏱ ${poll.durationHours}h`);
  return lines.join("\n");
}

/** Format poll as markdown. */
export function formatPollMarkdown(poll: Poll): string {
  const lines = [`## 📊 ${poll.question}`, ""];
  poll.options.forEach((o, i) => {
    lines.push(`- [ ] ${i + 1}. ${o.text}`);
  });
  lines.push("", `*Duration: ${poll.durationHours}h*`);
  return lines.join("\n");
}

/** Export as CSV. */
export function exportPollCSV(poll: Poll): string {
  const header = ["option_index", "option_text", "votes", "percentage"];
  const total = totalVotes(poll);
  const rows = poll.options.map((o, i) => {
    const pct = total === 0 ? 0 : ((o.votes / total) * 100).toFixed(2);
    return [i + 1, `"${o.text.replace(/"/g, '""')}"`, o.votes, pct].join(",");
  });
  return [header.join(","), ...rows].join("\n");
}

/** Reset all votes to zero. */
export function resetVotes(poll: Poll): Poll {
  return { ...poll, options: poll.options.map((o) => ({ ...o, votes: 0 })) };
}

/** Estimated confidence interval width (rough, 95% CI). */
export function marginOfError(poll: Poll): number {
  const n = totalVotes(poll);
  if (n < 1) return 100;
  return Math.round(100 * 1.96 * Math.sqrt(0.25 / n));
}

/** Build a CSV summary of multiple polls. */
export function exportBatchCSV(polls: Poll[]): string {
  const header = ["poll_id", "question", "options", "total_votes"];
  const rows = polls.map((p) => [p.id, `"${p.question.replace(/"/g, '""')}"`, p.options.length, totalVotes(p)].join(","));
  return [header.join(","), ...rows].join("\n");
}

/** Suggest duration based on question urgency. */
export function suggestDuration(question: string): number {
  const q = question.toLowerCase();
  if (q.includes("now") || q.includes("today")) return 1;
  if (q.includes("this week")) return 24;
  if (q.includes("this month")) return 168;
  return 24;
}

/** Generate sample poll template. */
export function samplePoll(): Poll {
  let p = createPoll("What should I write about next?", 24);
  p = addOption(p, "Productivity systems");
  p = addOption(p, "AI tools for creators");
  p = addOption(p, "Building a personal brand");
  p = addOption(p, "Remote work stories");
  return p;
}
