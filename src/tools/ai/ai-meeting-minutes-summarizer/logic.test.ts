import { describe, it, expect, beforeEach } from "vitest";
import {
  detectFormat,
  parseTimestamp,
  stripCues,
  detectSpeaker,
  groupTurns,
  extractAttendees,
  splitSentences,
  tokenizeWords,
  buildWordFreq,
  buildSentences,
  scoreSentences,
  pickTopSentences,
  summaryLengthCount,
  generateTldr,
  generateSummary,
  chunkTurns,
  mapReduceSummary,
  extractDecisions,
  extractDueDate,
  normalizeOwner,
  extractActionItems,
  extractOpenQuestions,
  extractRisks,
  extractFollowUps,
  summarizeTranscript,
  renderMarkdown,
  renderRecapEmail,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type SummaryLength,
} from "./logic";

beforeEach(() => {
  const store: Record<string, string> = {};
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; },
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() { return Object.keys(store).length; },
  };
});

describe("ai-meeting-minutes-summarizer format detection", () => {
  it("detects VTT from WEBVTT header", () => {
    expect(detectFormat("WEBVTT\n\n00:00:01.000 --> 00:00:03.000\nHello")).toBe("vtt");
  });
  it("detects VTT from short timestamp cue", () => {
    expect(detectFormat("00:00:01.000 --> 00:00:03.000\nHi there")).toBe("vtt");
  });
  it("detects SRT from index + comma timestamp", () => {
    expect(detectFormat("1\n00:00:01,000 --> 00:00:03,000\nHello")).toBe("srt");
  });
  it("detects plain text", () => {
    expect(detectFormat("Alice: Hello there. Bob: Hi.")).toBe("plain");
  });
});

describe("ai-meeting-minutes-summarizer timestamp parsing", () => {
  it("parses VTT timestamp with dot decimal", () => {
    expect(parseTimestamp("00:01:23.456")).toBe(83.456);
  });
  it("parses SRT timestamp with comma decimal", () => {
    expect(parseTimestamp("00:01:23,456")).toBe(83.456);
  });
  it("parses short MM:SS.mmm", () => {
    expect(parseTimestamp("01:23.456")).toBe(83.456);
  });
  it("returns undefined for garbage", () => {
    expect(parseTimestamp("garbage")).toBeUndefined();
  });
});

describe("ai-meeting-minutes-summarizer stripCues", () => {
  it("strips WEBVTT header and timestamps", () => {
    const out = stripCues("WEBVTT\n\n00:00:01.000 --> 00:00:03.000\nHello world", "vtt");
    expect(out).toContain("Hello world");
    expect(out).not.toContain("WEBVTT");
    expect(out).not.toContain("-->");
  });
  it("strips SRT cue numbers and timestamps", () => {
    const out = stripCues("1\n00:00:01,000 --> 00:00:03,000\nHello", "srt");
    expect(out).toContain("Hello");
    expect(out).not.toContain("-->");
    expect(out).not.toContain("1\n");
  });
  it("strips inline tags", () => {
    const out = stripCues("<c.red>Hello</c>", "vtt");
    expect(out.trim()).toBe("Hello");
  });
});

describe("ai-meeting-minutes-summarizer speaker detection", () => {
  it("detects Speaker: text", () => {
    const d = detectSpeaker("Alice: Let's ship it.");
    expect(d?.speaker).toBe("Alice");
    expect(d?.rest).toBe("Let's ship it.");
  });
  it("detects VTT <v> voice tag", () => {
    const d = detectSpeaker("<v Bob> Hi there");
    expect(d?.speaker).toBe("Bob");
    expect(d?.rest).toBe("Hi there");
  });
  it("returns undefined for plain line", () => {
    expect(detectSpeaker("just talking here")).toBeUndefined();
  });
  it("rejects all-digit 'speaker'", () => {
    expect(detectSpeaker("123: text")).toBeUndefined();
  });
});

describe("ai-meeting-minutes-summarizer groupTurns", () => {
  it("groups consecutive lines under same speaker", () => {
    const turns = groupTurns("Alice: Hello.\nThis is great.\nBob: Hi there.");
    expect(turns).toHaveLength(2);
    expect(turns[0].speaker).toBe("Alice");
    expect(turns[0].text).toContain("Hello.");
    expect(turns[0].text).toContain("This is great.");
    expect(turns[1].speaker).toBe("Bob");
  });
  it("falls back to Unknown for unlabeled text", () => {
    const turns = groupTurns("Just a paragraph of meeting notes.");
    expect(turns).toHaveLength(1);
    expect(turns[0].speaker).toBe("Unknown");
  });
});

describe("ai-meeting-minutes-summarizer attendees", () => {
  it("extracts unique speakers preserving order", () => {
    const turns = groupTurns("Alice: Hi.\nBob: Hey.\nAlice: Bye.");
    const att = extractAttendees(turns);
    expect(att).toEqual(["Alice", "Bob"]);
  });
  it("skips Unknown", () => {
    const turns = groupTurns("Some unlabeled notes.");
    expect(extractAttendees(turns)).toEqual([]);
  });
});

describe("ai-meeting-minutes-summarizer sentence tokenization", () => {
  it("splits on sentence-final punctuation", () => {
    const s = splitSentences("Hello world. This is a test! Is it working? Yes.");
    expect(s).toHaveLength(4);
    expect(s[0]).toBe("Hello world.");
  });
  it("tokenizes words lowercased", () => {
    expect(tokenizeWords("Hello, WORLD! It's great.")).toContain("hello");
    expect(tokenizeWords("Hello, WORLD! It's great.")).toContain("world");
  });
  it("empty input returns empty array", () => {
    expect(splitSentences("")).toEqual([]);
    expect(tokenizeWords("")).toEqual([]);
  });
});

describe("ai-meeting-minutes-summarizer word freq + scoring", () => {
  it("builds a frequency map excluding stop words", () => {
    const turns = groupTurns("Alice: shipping shipping shipping blockers.");
    const freq = buildWordFreq(turns);
    expect(freq.get("shipping")).toBe(3);
    expect(freq.get("blockers")).toBe(1);
    expect(freq.has("the")).toBe(false);
  });
  it("scores sentences and returns them sorted by index in pickTop", () => {
    const turns = groupTurns("Alice: We decided to ship the API. Bob: Sounds good. Alice: Action item: Alice will write tests.");
    const sents = buildSentences(turns);
    const scores = scoreSentences(turns, sents);
    expect(scores).toHaveLength(sents.length);
    const top = pickTopSentences(scores, 2);
    expect(top).toHaveLength(2);
    expect(top[0].index).toBeLessThanOrEqual(top[1].index);
  });
});

describe("ai-meeting-minutes-summarizer summary length", () => {
  it("brief < standard < detailed for large input", () => {
    expect(summaryLengthCount(100, "brief")).toBeLessThanOrEqual(summaryLengthCount(100, "standard"));
    expect(summaryLengthCount(100, "standard")).toBeLessThanOrEqual(summaryLengthCount(100, "detailed"));
  });
  it("brief returns at least 1", () => {
    expect(summaryLengthCount(5, "brief")).toBeGreaterThanOrEqual(1);
  });
});

describe("ai-meeting-minutes-summarizer generateTldr/Summary", () => {
  it("generates a TL;DR from turns", () => {
    const turns = groupTurns(
      "Alice: We decided to ship the new API. Bob: Agreed. Alice: The release is next week. We will write docs.",
    );
    const sents = buildSentences(turns);
    const tldr = generateTldr(turns, sents);
    expect(tldr.length).toBeGreaterThan(0);
  });
  it("generates summary of requested length", () => {
    const turns = groupTurns(
      "Alice: We decided to ship. Bob: Great. Alice: We need tests. Bob: I will write them. Alice: Also docs. Bob: And a blog post. Alice: And a launch tweet.",
    );
    const sents = buildSentences(turns);
    const brief = generateSummary(turns, sents, "brief");
    const detailed = generateSummary(turns, sents, "detailed");
    expect(brief.length).toBeGreaterThan(0);
    expect(detailed.length).toBeGreaterThanOrEqual(brief.length);
  });
});

describe("ai-meeting-minutes-summarizer chunking / map-reduce", () => {
  it("chunks turns by size", () => {
    const turns = groupTurns(
      "Alice: 1.\nBob: 2.\nAlice: 3.\nBob: 4.\nAlice: 5.\nBob: 6.\nAlice: 7.\nBob: 8.",
    );
    const chunks = chunkTurns(turns, 3);
    expect(chunks.length).toBeGreaterThanOrEqual(3);
    expect(chunks.reduce((a, c) => a + c.length, 0)).toBe(turns.length);
  });
  it("map-reduce produces a summary and chunk count", () => {
    const text = Array.from({ length: 60 }, (_, i) => `Alice: Turn number ${i}. Bob: Reply ${i}.`).join("\n");
    const turns = groupTurns(text);
    const out = mapReduceSummary(turns, "standard", 10);
    expect(out.chunkCount).toBeGreaterThan(1);
    expect(out.summary.length).toBeGreaterThan(0);
  });
  it("single-chunk path returns count 1", () => {
    const turns = groupTurns("Alice: One sentence. Bob: Two sentences. Alice: Done.");
    const out = mapReduceSummary(turns, "standard", 100);
    expect(out.chunkCount).toBe(1);
  });
});

describe("ai-meeting-minutes-summarizer decisions extraction", () => {
  it("detects 'we decided'", () => {
    const turns = groupTurns("Alice: We decided to ship on Friday. Bob: Great.");
    const d = extractDecisions(turns);
    expect(d).toHaveLength(1);
    expect(d[0].cue).toBe("decided");
  });
  it("detects 'agreed to'", () => {
    const turns = groupTurns("Alice: Agreed to delay launch.");
    const d = extractDecisions(turns);
    expect(d).toHaveLength(1);
    expect(d[0].cue).toBe("agreed");
  });
  it("detects 'will go with'", () => {
    const turns = groupTurns("Alice: Will go with option B.");
    const d = extractDecisions(turns);
    expect(d).toHaveLength(1);
  });
  it("ignores neutral sentences", () => {
    const turns = groupTurns("Alice: The weather is nice today.");
    expect(extractDecisions(turns)).toHaveLength(0);
  });
});

describe("ai-meeting-minutes-summarizer due date extraction", () => {
  it("detects 'by Friday'", () => {
    expect(extractDueDate("Ship it by Friday.")).toBe("friday");
  });
  it("detects 'by next week'", () => {
    expect(extractDueDate("Done by next week.")).toBe("next week");
  });
  it("detects EOD/EOW", () => {
    expect(extractDueDate("Finish by EOD.")).toBe("EOD");
    expect(extractDueDate("Finish by EOW.")).toBe("EOW");
  });
  it("detects ISO date", () => {
    expect(extractDueDate("Ship by 2025-01-15.")).toBe("2025-01-15");
  });
  it("returns undefined for no date", () => {
    expect(extractDueDate("Just ship it.")).toBeUndefined();
  });
});

describe("ai-meeting-minutes-summarizer owner normalization", () => {
  it("strips @ and capitalizes", () => {
    expect(normalizeOwner("@alice")).toBe("Alice");
    expect(normalizeOwner("BOB")).toBe("Bob");
  });
  it("empty input returns empty", () => {
    expect(normalizeOwner("")).toBe("");
  });
});

describe("ai-meeting-minutes-summarizer action items", () => {
  it("extracts 'will' action with speaker as owner when subject is pronoun", () => {
    const turns = groupTurns("Alice: I will write the docs.");
    const acts = extractActionItems(turns, ["Alice"]);
    expect(acts).toHaveLength(1);
    expect(acts[0].owner).toBe("Alice");
    expect(acts[0].task).toContain("Write the docs");
  });
  it("extracts named owner from attendee list", () => {
    const turns = groupTurns("Alice: Bob will handle the deploy.");
    const acts = extractActionItems(turns, ["Alice", "Bob"]);
    expect(acts).toHaveLength(1);
    expect(acts[0].owner).toBe("Bob");
  });
  it("detects @mention as owner", () => {
    const turns = groupTurns("Alice: @carol needs to file the ticket.");
    const acts = extractActionItems(turns, ["Alice"]);
    expect(acts[0].owner).toBe("Carol");
  });
  it("detects due date in action item", () => {
    const turns = groupTurns("Alice: I will write tests by Friday.");
    const acts = extractActionItems(turns, ["Alice"]);
    expect(acts[0].due).toBe("friday");
  });
  it("detects TODO cue", () => {
    const turns = groupTurns("Alice: TODO: fix the bug.");
    const acts = extractActionItems(turns, ["Alice"]);
    expect(acts).toHaveLength(1);
    expect(acts[0].rawCue).toBe("TODO");
  });
});

describe("ai-meeting-minutes-summarizer open questions + risks", () => {
  it("extracts '?' questions", () => {
    const turns = groupTurns("Alice: What about the rollout? Bob: Should we delay?");
    expect(extractOpenQuestions(turns)).toHaveLength(2);
  });
  it("extracts risks", () => {
    const turns = groupTurns("Alice: Risk is we miss the deadline. Bob: Blocker: API not ready.");
    const risks = extractRisks(turns);
    expect(risks).toHaveLength(2);
  });
  it("extractFollowUps combines questions + risks", () => {
    const qs = extractOpenQuestions(groupTurns("Alice: When do we ship?"));
    const rs = extractRisks(groupTurns("Bob: Risk: capacity low."));
    const f = extractFollowUps(qs, rs);
    expect(f.length).toBeGreaterThanOrEqual(2);
  });
});

describe("ai-meeting-minutes-summarizer end-to-end", () => {
  const transcript = `Alice: Welcome to the standup. We decided to ship the API next week.
Bob: Great. I will write the docs by Friday.
Carol: Risk is the auth flow is not ready.
Alice: What about the load test? @bob needs to run it.
Bob: Agreed to delay the launch by two days.
Alice: TODO: open a ticket for the regression.`;

  it("returns full minutes with attendees, decisions, actions, questions, risks", () => {
    const m = summarizeTranscript(transcript, { title: "Standup 2024-01-15", length: "standard" });
    expect(m.format).toBe("plain");
    expect(m.attendees).toContain("Alice");
    expect(m.attendees).toContain("Bob");
    expect(m.decisions.length).toBeGreaterThanOrEqual(2);
    expect(m.actionItems.length).toBeGreaterThanOrEqual(2);
    expect(m.risks.length).toBeGreaterThanOrEqual(1);
    expect(m.stats.wordCount).toBeGreaterThan(20);
    expect(m.stats.sentenceCount).toBeGreaterThan(4);
    expect(m.warnings).toHaveLength(0);
  });
  it("returns empty minutes for empty input", () => {
    const m = summarizeTranscript("");
    expect(m.turns).toEqual([]);
    expect(m.warnings).toContain("Empty transcript.");
  });
  it("parses VTT input end-to-end", () => {
    const vtt = `WEBVTT

00:00:01.000 --> 00:00:03.000
Alice: We decided to ship.

00:00:04.000 --> 00:00:06.000
Bob: I will write tests.`;
    const m = summarizeTranscript(vtt);
    expect(m.format).toBe("vtt");
    expect(m.attendees).toEqual(["Alice", "Bob"]);
    expect(m.decisions.length).toBeGreaterThanOrEqual(1);
  });
});

describe("ai-meeting-minutes-summarizer markdown + email render", () => {
  const transcript = `Alice: We decided to ship the API.
Bob: I will write the docs by Friday.
Alice: What about testing?`;

  it("renders markdown with sections", () => {
    const m = summarizeTranscript(transcript, { title: "Demo" });
    const md = renderMarkdown(m);
    expect(md).toContain("# Demo");
    expect(md).toContain("## Attendees");
    expect(md).toContain("## Decisions");
    expect(md).toContain("## Action items");
    expect(md).toContain("## Open questions");
    expect(md).toContain("@Bob");
    expect(md).toContain("_(due friday)_");
  });
  it("renders recap email", () => {
    const m = summarizeTranscript(transcript, { title: "Demo" });
    const email = renderRecapEmail(m, "Alice");
    expect(email).toContain("Subject: Recap — Demo");
    expect(email).toContain("Hi team,");
    expect(email).toContain("Thanks,");
    expect(email).toContain("Alice");
  });
});

describe("ai-meeting-minutes-summarizer history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1,
      title: "Standup",
      attendeeCount: 3,
      actionCount: 2,
      decisionCount: 1,
      wordCount: 100,
    });
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0].title).toBe("Standup");
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, title: `M${i}`, attendeeCount: 1, actionCount: 0, decisionCount: 0, wordCount: 10 });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears history", () => {
    saveHistory({ ts: 1, title: "X", attendeeCount: 1, actionCount: 0, decisionCount: 0, wordCount: 1 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("ai-meeting-minutes-summarizer share URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("hello world", { title: "Demo", length: "brief" });
    expect(url).toContain("t=hello+world");
    expect(url).toContain("title=Demo");
    expect(url).toContain("len=brief");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const params = new URLSearchParams();
    params.set("t", "hello");
    params.set("title", "Demo");
    params.set("len", "detailed");
    const r = parseShareUrl(`#${params.toString()}`);
    expect(r.transcript).toBe("hello");
    expect(r.title).toBe("Demo");
    expect(r.length).toBe("detailed");
  });
  it("parses empty hash returns defaults", () => {
    const r = parseShareUrl("");
    expect(r.transcript).toBe("");
    expect(r.title).toBe("");
    expect(r.length).toBe("standard");
  });
  it("falls back to standard for invalid length", () => {
    const r = parseShareUrl("t=hi&len=banana");
    expect(r.length).toBe("standard");
  });
});

// Suppress unused-import lint
export type _Unused = SummaryLength;
