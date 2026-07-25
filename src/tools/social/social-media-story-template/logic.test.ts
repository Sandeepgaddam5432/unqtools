/**
 * Story Template Generator — unit tests.
 */
import { describe, it, expect } from "vitest";
import { TEMPLATES, byPlatform, getById, allPlatforms, toText, PLATFORM_LABELS, type Platform } from "./logic";

describe("story TEMPLATES", () => {
  it("has at least 5 templates", () => {
    expect(TEMPLATES.length).toBeGreaterThanOrEqual(5);
  });
  it("every template has slides and tips", () => {
    for (const t of TEMPLATES) {
      expect(t.slides.length).toBeGreaterThan(0);
      expect(t.tips.length).toBeGreaterThan(0);
      expect(t.aspectRatio).toMatch(/^\d+:\d+$/);
      expect(t.recommendedDuration).toBeGreaterThan(0);
    }
  });
});

describe("story byPlatform", () => {
  it("returns templates filtered by platform", () => {
    const ig = byPlatform("instagram");
    expect(ig.length).toBeGreaterThan(0);
    expect(ig.every((t) => t.platform === "instagram")).toBe(true);
  });
  it("returns empty for unknown platform", () => {
    expect(byPlatform("myspace" as Platform)).toEqual([]);
  });
});

describe("story getById", () => {
  it("finds template by id", () => {
    const t = getById("ig-q&a");
    expect(t).toBeDefined();
    expect(t!.title).toBe("Q&A Tuesday");
  });
  it("returns undefined for unknown id", () => {
    expect(getById("nonexistent")).toBeUndefined();
  });
});

describe("story allPlatforms", () => {
  it("returns unique platforms", () => {
    const p = allPlatforms();
    expect(new Set(p).size).toBe(p.length);
    expect(p.length).toBeGreaterThan(0);
  });
});

describe("story toText", () => {
  it("produces text with title and slides", () => {
    const t = TEMPLATES[0]!;
    const text = toText(t);
    expect(text).toContain(t.title);
    expect(text).toContain("1. [hook]");
    expect(text).toContain("Tips:");
  });
});

describe("story PLATFORM_LABELS", () => {
  it("has a label for each known platform", () => {
    for (const p of ["instagram", "snapchat", "facebook", "tiktok"] as Platform[]) {
      expect(PLATFORM_LABELS[p]).toBeTruthy();
    }
  });
});
