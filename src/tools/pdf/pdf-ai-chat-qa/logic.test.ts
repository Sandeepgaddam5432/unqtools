import { describe, it, expect } from "vitest";
import { generateSummary, searchPassages } from "./logic";

describe("AI Chat with PDF (Q&A)", () => {
  const sampleText = `React is a JavaScript library for building user interfaces. Created by Facebook, React is now maintained by Meta and the community. React enables building large web applications that change data without reloading the page. React uses a component-based architecture for reusable code. The virtual DOM optimizes rendering performance by comparing changes. React Hooks allow functional components to manage state and side effects.`;

  describe("generateSummary", () => {
    it("generates a summary", () => {
      const summary = generateSummary(sampleText);
      expect(summary.length).toBeGreaterThan(0);
      expect(summary.length).toBeLessThanOrEqual(300 + 3); // +3 for "…"
    });

    it("handles empty text", () => {
      expect(generateSummary("")).toBe("No text content found in this PDF.");
    });

    it("respects max length", () => {
      const summary = generateSummary(sampleText, 100);
      expect(summary.length).toBeLessThanOrEqual(103); // +3 for "…"
    });
  });

  describe("searchPassages", () => {
    it("finds relevant passages", () => {
      const results = searchPassages("React components", sampleText);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].passage.toLowerCase()).toContain("react");
    });

    it("returns empty for empty query", () => {
      expect(searchPassages("", sampleText)).toHaveLength(0);
    });

    it("returns empty for empty text", () => {
      expect(searchPassages("test", "")).toHaveLength(0);
    });

    it("limits results to maxResults", () => {
      const results = searchPassages("React", sampleText, 2);
      expect(results.length).toBeLessThanOrEqual(2);
    });

    it("sorts by relevance", () => {
      const results = searchPassages("React", sampleText);
      if (results.length > 1) {
        expect(results[0].relevance).toBeGreaterThanOrEqual(results[1].relevance);
      }
    });
  });
});
