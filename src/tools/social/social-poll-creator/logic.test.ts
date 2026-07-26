import { describe, it, expect } from "vitest";
import {
  getPollPlatform,
  getAllPollPlatforms,
  createPoll,
  addOption,
  removeOption,
  updateOption,
  vote,
  simulateVotes,
  totalVotes,
  percentages,
  winner,
  validateForPlatform,
  formatPollText,
  formatPollMarkdown,
  exportPollCSV,
  resetVotes,
  marginOfError,
  exportBatchCSV,
  suggestDuration,
  samplePoll,
} from "./logic";

function buildSample() {
  let p = createPoll("Best season?", 24);
  p = addOption(p, "Spring");
  p = addOption(p, "Summer");
  p = addOption(p, "Winter");
  return p;
}

describe("social-poll-creator getPollPlatform", () => {
  it("finds twitter", () => {
    expect(getPollPlatform("twitter")?.maxOptions).toBe(4);
  });
  it("returns null for unknown", () => {
    expect(getPollPlatform("nope")).toBeNull();
  });
  it("returns at least 4 platforms", () => {
    expect(getAllPollPlatforms().length).toBeGreaterThanOrEqual(4);
  });
});

describe("social-poll-creator createPoll", () => {
  it("creates poll with question", () => {
    const p = createPoll("Tea or coffee?");
    expect(p.question).toBe("Tea or coffee?");
    expect(p.options).toEqual([]);
  });
  it("defaults to Untitled", () => {
    expect(createPoll("").question).toBe("Untitled poll");
  });
});

describe("social-poll-creator addOption", () => {
  it("adds option", () => {
    const p = buildSample();
    expect(p.options.length).toBe(3);
  });
  it("starts with 0 votes", () => {
    const p = buildSample();
    expect(p.options[0].votes).toBe(0);
  });
});

describe("social-poll-creator removeOption", () => {
  it("removes by id", () => {
    const p = buildSample();
    const id = p.options[0].id;
    expect(removeOption(p, id).options.length).toBe(2);
  });
});

describe("social-poll-creator updateOption", () => {
  it("patches by id", () => {
    const p = buildSample();
    const id = p.options[0].id;
    expect(updateOption(p, id, { text: "Fall" }).options[0].text).toBe("Fall");
  });
});

describe("social-poll-creator vote", () => {
  it("votes for single option when not multiple", () => {
    const p = buildSample();
    const voted = vote(p, [p.options[0].id, p.options[1].id]);
    expect(voted.options[0].votes).toBe(1);
    expect(voted.options[1].votes).toBe(0);
  });
  it("votes for all options when multiple allowed", () => {
    let p = buildSample();
    p = { ...p, allowMultiple: true };
    const voted = vote(p, [p.options[0].id, p.options[1].id]);
    expect(voted.options[0].votes).toBe(1);
    expect(voted.options[1].votes).toBe(1);
  });
});

describe("social-poll-creator simulateVotes", () => {
  it("distributes votes randomly", () => {
    const p = buildSample();
    const after = simulateVotes(p, 100, () => 0.5);
    expect(totalVotes(after)).toBe(100);
  });
  it("handles empty options", () => {
    const p = createPoll("Q");
    expect(simulateVotes(p, 10)).toBe(p);
  });
});

describe("social-poll-creator totalVotes", () => {
  it("sums all option votes", () => {
    let p = buildSample();
    p = vote(p, [p.options[0].id]);
    p = vote(p, [p.options[1].id]);
    p = vote(p, [p.options[1].id]);
    expect(totalVotes(p)).toBe(3);
  });
});

describe("social-poll-creator percentages", () => {
  it("returns 0% for no votes", () => {
    const p = buildSample();
    expect(percentages(p).every((x) => x.pct === 0)).toBe(true);
  });
  it("computes percentage distribution", () => {
    let p = buildSample();
    p = vote(p, [p.options[0].id]);
    p = vote(p, [p.options[0].id]);
    p = vote(p, [p.options[1].id]);
    const pct = percentages(p);
    expect(pct[0].pct).toBeCloseTo(66.67, 1);
    expect(pct[1].pct).toBeCloseTo(33.33, 1);
  });
});

describe("social-poll-creator winner", () => {
  it("returns option(s) with most votes", () => {
    let p = buildSample();
    p = vote(p, [p.options[0].id]);
    expect(winner(p).length).toBe(3); // tie at 1
  });
  it("returns single winner when unique", () => {
    let p = buildSample();
    p = vote(p, [p.options[0].id]);
    p = vote(p, [p.options[0].id]);
    expect(winner(p).length).toBe(1);
    expect(winner(p)[0].text).toBe("Spring");
  });
});

describe("social-poll-creator validateForPlatform", () => {
  it("warns when too many options for twitter", () => {
    let p = buildSample();
    p = addOption(p, "Fall");
    p = addOption(p, "Monsoon");
    const tw = getPollPlatform("twitter")!;
    expect(validateForPlatform(p, tw).some((w) => w.includes("max 4"))).toBe(true);
  });
  it("warns when option too long", () => {
    let p = createPoll("Q", 24);
    p = addOption(p, "x".repeat(50));
    p = addOption(p, "y");
    const tw = getPollPlatform("twitter")!;
    expect(validateForPlatform(p, tw).some((w) => w.includes("exceeds"))).toBe(true);
  });
  it("warns when fewer than 2 options", () => {
    const p = createPoll("Q", 24);
    const tw = getPollPlatform("twitter")!;
    expect(validateForPlatform(p, tw).some((w) => w.includes("2 options"))).toBe(true);
  });
  it("passes for valid poll", () => {
    const p = buildSample();
    const tw = getPollPlatform("twitter")!;
    expect(validateForPlatform(p, tw)).toEqual([]);
  });
});

describe("social-poll-creator formatPollText", () => {
  it("includes question and numbered options", () => {
    const txt = formatPollText(buildSample());
    expect(txt).toContain("Best season?");
    expect(txt).toContain("1. Spring");
  });
});

describe("social-poll-creator formatPollMarkdown", () => {
  it("uses markdown headings and checkboxes", () => {
    const md = formatPollMarkdown(buildSample());
    expect(md).toContain("## 📊");
    expect(md).toContain("- [ ]");
  });
});

describe("social-poll-creator exportPollCSV", () => {
  it("has header plus one row per option", () => {
    const p = buildSample();
    const csv = exportPollCSV(p);
    const lines = csv.split("\n");
    expect(lines.length).toBe(4);
    expect(lines[0]).toContain("option_index,option_text,votes");
  });
});

describe("social-poll-creator resetVotes", () => {
  it("zeros all vote counts", () => {
    let p = buildSample();
    p = vote(p, [p.options[0].id]);
    p = resetVotes(p);
    expect(totalVotes(p)).toBe(0);
  });
});

describe("social-poll-creator marginOfError", () => {
  it("returns 100 for no votes", () => {
    expect(marginOfError(buildSample())).toBe(100);
  });
  it("decreases with more votes", () => {
    let p = buildSample();
    p = simulateVotes(p, 100, () => 0.5);
    expect(marginOfError(p)).toBeLessThan(100);
  });
});

describe("social-poll-creator exportBatchCSV", () => {
  it("has header plus one row per poll", () => {
    const polls = [buildSample(), buildSample()];
    const csv = exportBatchCSV(polls);
    const lines = csv.split("\n");
    expect(lines.length).toBe(3);
  });
});

describe("social-poll-creator suggestDuration", () => {
  it("suggests 1h for 'now' urgency", () => {
    expect(suggestDuration("Lunch now or later?")).toBe(1);
  });
  it("suggests 24h for default", () => {
    expect(suggestDuration("Best language?")).toBe(24);
  });
  it("suggests 168h for month-long questions", () => {
    expect(suggestDuration("Plan for this month?")).toBe(168);
  });
});

describe("social-poll-creator samplePoll", () => {
  it("returns a poll with options", () => {
    const p = samplePoll();
    expect(p.options.length).toBeGreaterThanOrEqual(2);
  });
});
