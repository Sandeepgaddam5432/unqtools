import { describe, it, expect } from "vitest";
import {
  getAllFormats,
  getFormatById,
  filterFormatsByPlatform,
  filterFormatsByEffort,
  expandKeyword,
  hookTemplates,
  hashtagIdeas,
  weeklyCalendar,
  generateIdeas,
  scoreIdea,
  validateKeyword,
  exportIdeasCSV,
  exportIdeasText,
  randomIdea,
  sortByVirality,
  groupByFormat,
  TRENDING_CATEGORIES,
} from "./logic";

describe("social-content-ideas getAllFormats / getFormatById", () => {
  it("returns at least 6 formats", () => {
    expect(getAllFormats().length).toBeGreaterThanOrEqual(6);
  });
  it("finds carousel by id", () => {
    expect(getFormatById("carousel")?.name).toContain("Carousel");
  });
  it("returns null for unknown", () => {
    expect(getFormatById("nope")).toBeNull();
  });
});

describe("social-content-ideas filterFormatsByPlatform", () => {
  it("returns formats available on instagram", () => {
    const list = filterFormatsByPlatform("instagram");
    expect(list.length).toBeGreaterThanOrEqual(2);
  });
});

describe("social-content-ideas filterFormatsByEffort", () => {
  it("returns low-effort formats", () => {
    const list = filterFormatsByEffort("low");
    expect(list.every((f) => f.effort === "low")).toBe(true);
  });
});

describe("social-content-ideas expandKeyword", () => {
  it("returns 20 angles", () => {
    const a = expandKeyword("productivity");
    expect(a.length).toBe(20);
  });
  it("includes the keyword in angles", () => {
    const a = expandKeyword("AI");
    expect(a.some((x) => x.includes("AI"))).toBe(true);
  });
  it("returns empty for empty keyword", () => {
    expect(expandKeyword("")).toEqual([]);
  });
});

describe("social-content-ideas hookTemplates", () => {
  it("returns 10 hooks", () => {
    expect(hookTemplates("fitness").length).toBe(10);
  });
});

describe("social-content-ideas hashtagIdeas", () => {
  it("returns hashtags containing keyword", () => {
    const t = hashtagIdeas("productivity");
    expect(t[0]).toBe("#productivity");
    expect(t.some((x) => x.includes("productivity"))).toBe(true);
  });
  it("returns empty for empty keyword", () => {
    expect(hashtagIdeas("")).toEqual([]);
  });
});

describe("social-content-ideas weeklyCalendar", () => {
  it("returns 7 days", () => {
    const cal = weeklyCalendar("money");
    expect(cal.length).toBe(7);
    expect(cal[0].day).toBe("Mon");
  });
  it("each entry has a format and idea", () => {
    const cal = weeklyCalendar("money");
    expect(cal[0].format).toBeDefined();
    expect(cal[0].idea.length).toBeGreaterThan(0);
  });
});

describe("social-content-ideas generateIdeas", () => {
  it("returns N ideas", () => {
    const ideas = generateIdeas("AI", 5);
    expect(ideas.length).toBe(5);
  });
  it("each idea has all fields", () => {
    const ideas = generateIdeas("AI", 3);
    const i = ideas[0];
    expect(i.format).toBeDefined();
    expect(i.angle).toContain("AI");
    expect(i.hook.length).toBeGreaterThan(0);
    expect(i.hashtags.length).toBeGreaterThan(0);
    expect(i.estimatedReach).toBeDefined();
  });
});

describe("social-content-ideas scoreIdea", () => {
  it("returns score 0-100", () => {
    const ideas = generateIdeas("AI", 1);
    const s = scoreIdea(ideas[0]);
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(100);
  });
  it("higher score for high-effort + high-reach", () => {
    const ideas = generateIdeas("AI", 10);
    const highEffort = ideas.find((i) => i.format.effort === "high" && i.estimatedReach === "high");
    const lowEffort = ideas.find((i) => i.format.effort === "low" && i.estimatedReach === "low");
    if (highEffort && lowEffort) {
      expect(scoreIdea(highEffort)).toBeGreaterThan(scoreIdea(lowEffort));
    }
  });
});

describe("social-content-ideas validateKeyword", () => {
  it("warns on empty keyword", () => {
    expect(validateKeyword("").some((w) => w.includes("required"))).toBe(true);
  });
  it("warns on overly long keyword", () => {
    expect(validateKeyword("x".repeat(100)).some((w) => w.includes("long"))).toBe(true);
  });
  it("passes for normal keyword", () => {
    expect(validateKeyword("productivity")).toEqual([]);
  });
});

describe("social-content-ideas exportIdeasCSV", () => {
  it("has header plus one row per idea", () => {
    const ideas = generateIdeas("AI", 5);
    const csv = exportIdeasCSV(ideas);
    const lines = csv.split("\n");
    expect(lines.length).toBe(6);
    expect(lines[0]).toContain("format,angle,hook");
  });
});

describe("social-content-ideas exportIdeasText", () => {
  it("includes all idea fields", () => {
    const ideas = generateIdeas("AI", 2);
    const txt = exportIdeasText(ideas);
    expect(txt).toContain("Format:");
    expect(txt).toContain("Hook:");
  });
});

describe("social-content-ideas randomIdea", () => {
  it("returns null for empty list", () => {
    expect(randomIdea([])).toBeNull();
  });
  it("returns an idea from the list", () => {
    const ideas = generateIdeas("AI", 3);
    const r = randomIdea(ideas);
    expect(ideas).toContain(r);
  });
});

describe("social-content-ideas sortByVirality", () => {
  it("sorts high to low score", () => {
    const ideas = generateIdeas("AI", 10);
    const sorted = sortByVirality(ideas);
    for (let i = 1; i < sorted.length; i++) {
      expect(scoreIdea(sorted[i])).toBeLessThanOrEqual(scoreIdea(sorted[i - 1]));
    }
  });
});

describe("social-content-ideas groupByFormat", () => {
  it("groups ideas by format name", () => {
    const ideas = generateIdeas("AI", 10);
    const g = groupByFormat(ideas);
    expect(Object.keys(g).length).toBeGreaterThan(0);
  });
});

describe("social-content-ideas TRENDING_CATEGORIES", () => {
  it("returns at least 8 categories", () => {
    expect(TRENDING_CATEGORIES.length).toBeGreaterThanOrEqual(8);
  });
});
