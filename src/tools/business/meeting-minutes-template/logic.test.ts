/**
 * Meeting Minutes Template — unit tests.
 */
import { describe, it, expect } from "vitest";
import { generateMinutes, isValidDate, type MeetingInput } from "./logic";

const base: MeetingInput = {
  title: "Sprint Planning",
  date: "2024-09-30",
  startTime: "10:00",
  endTime: "11:00",
  location: "Room A",
  facilitator: "Alice",
  noteTaker: "Bob",
  attendees: [
    { name: "Alice", role: "Lead", present: true },
    { name: "Bob", role: "Engineer", present: true },
    { name: "Carol", present: false },
  ],
  agenda: [
    { topic: "Review last sprint", presenter: "Alice", durationMinutes: 10 },
    { topic: "Plan next sprint", presenter: "Bob", durationMinutes: 40, notes: "Focus on auth" },
  ],
  decisions: [
    { text: "Ship auth in sprint 12", decidedBy: "Alice" },
  ],
  actionItems: [
    { task: "Write auth spec", assignee: "Bob", dueDate: "2024-10-04", priority: "high" },
    { task: "Schedule design review", assignee: "Carol" },
  ],
  notes: "Demo next week.",
  nextMeeting: { date: "2024-10-07", time: "10:00", location: "Room A" },
};

describe("generateMinutes — validation", () => {
  it("errors when title is missing", () => {
    expect("error" in generateMinutes({ ...base, title: "" })).toBe(true);
  });
  it("errors when date is missing", () => {
    expect("error" in generateMinutes({ ...base, date: "" })).toBe(true);
  });
  it("errors when attendees is empty", () => {
    expect("error" in generateMinutes({ ...base, attendees: [] })).toBe(true);
  });
});

describe("generateMinutes — markdown", () => {
  it("includes title and date", () => {
    const r = generateMinutes(base);
    if ("error" in r) throw new Error("should not error");
    expect(r.markdown).toContain("# Sprint Planning");
    expect(r.markdown).toContain("2024-09-30");
  });
  it("lists present attendees", () => {
    const r = generateMinutes(base);
    if ("error" in r) throw new Error("should not error");
    expect(r.markdown).toContain("- Alice (Lead)");
    expect(r.markdown).toContain("- Bob (Engineer)");
  });
  it("lists absent attendees under Absent heading", () => {
    const r = generateMinutes(base);
    if ("error" in r) throw new Error("should not error");
    expect(r.markdown).toContain("**Absent:**");
    expect(r.markdown).toContain("- Carol");
  });
  it("renders agenda as numbered list", () => {
    const r = generateMinutes(base);
    if ("error" in r) throw new Error("should not error");
    expect(r.markdown).toContain("1. **Review last sprint**");
    expect(r.markdown).toContain("2. **Plan next sprint**");
  });
  it("renders decisions as bullet list", () => {
    const r = generateMinutes(base);
    if ("error" in r) throw new Error("should not error");
    expect(r.markdown).toContain("## Decisions");
    expect(r.markdown).toContain("Ship auth in sprint 12");
  });
  it("renders action items as a markdown table", () => {
    const r = generateMinutes(base);
    if ("error" in r) throw new Error("should not error");
    expect(r.markdown).toContain("## Action Items");
    expect(r.markdown).toContain("| # | Task | Assignee | Due | Priority |");
    expect(r.markdown).toContain("Write auth spec");
  });
  it("includes next meeting section", () => {
    const r = generateMinutes(base);
    if ("error" in r) throw new Error("should not error");
    expect(r.markdown).toContain("## Next Meeting");
  });
});

describe("generateMinutes — text & HTML", () => {
  it("plain text contains all sections", () => {
    const r = generateMinutes(base);
    if ("error" in r) throw new Error("should not error");
    expect(r.text).toContain("MEETING MINUTES");
    expect(r.text).toContain("ATTENDEES:");
    expect(r.text).toContain("AGENDA:");
    expect(r.text).toContain("DECISIONS:");
    expect(r.text).toContain("ACTION ITEMS:");
    expect(r.text).toContain("NEXT MEETING:");
  });
  it("HTML contains table for action items", () => {
    const r = generateMinutes(base);
    if ("error" in r) throw new Error("should not error");
    expect(r.html).toContain("<table");
    expect(r.html).toContain("Write auth spec");
  });
  it("HTML escapes special characters", () => {
    const r = generateMinutes({ ...base, title: "<b>Sprint</b> & Planning" });
    if ("error" in r) throw new Error("should not error");
    expect(r.html).not.toContain("<b>Sprint</b>");
    expect(r.html).toContain("&lt;b&gt;Sprint&lt;/b&gt;");
  });
});

describe("generateMinutes — warnings", () => {
  it("warns on action items without assignee", () => {
    const r = generateMinutes({ ...base, actionItems: [{ task: "Thing", dueDate: "2024-10-01" }] });
    if ("error" in r) throw new Error("should not error");
    expect(r.warnings.some((w) => w.includes("no assignee"))).toBe(true);
  });
  it("warns on action items without due date", () => {
    const r = generateMinutes({ ...base, actionItems: [{ task: "Thing", assignee: "Bob" }] });
    if ("error" in r) throw new Error("should not error");
    expect(r.warnings.some((w) => w.includes("no due date"))).toBe(true);
  });
  it("warns on empty agenda", () => {
    const r = generateMinutes({ ...base, agenda: [] });
    if ("error" in r) throw new Error("should not error");
    expect(r.warnings.some((w) => w.includes("Agenda is empty"))).toBe(true);
  });
});

describe("isValidDate", () => {
  it("accepts valid ISO dates", () => {
    expect(isValidDate("2024-01-15")).toBe(true);
    expect(isValidDate("2024-12-31")).toBe(true);
  });
  it("rejects malformed strings", () => {
    expect(isValidDate("01/15/2024")).toBe(false);
    expect(isValidDate("not a date")).toBe(false);
    expect(isValidDate("")).toBe(false);
  });
  it("rejects impossible dates", () => {
    expect(isValidDate("2024-13-01")).toBe(false);
    expect(isValidDate("2024-02-31")).toBe(false);
  });
});
