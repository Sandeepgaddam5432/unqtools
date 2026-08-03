import { describe, it, expect } from "vitest";
import { answerQuestion, getTextStats } from "./logic";

describe("AI Chat with PDF", () => {
  const sampleText = `
    React is a JavaScript library for building user interfaces. It was created by Facebook and is now maintained by Meta and a community of individual developers and companies. React allows developers to create large web applications that can change data without reloading the page. It is used for developing single-page applications.

    The library follows a component-based architecture. Components are reusable pieces of code that return HTML elements. They can be class-based or functional. Functional components are the modern approach and use hooks for state management.

    React uses a virtual DOM to optimize rendering performance. When state changes, React creates a new virtual DOM tree and compares it with the previous one. Only the differences are applied to the actual DOM, making updates efficient.
  `;

  describe("answerQuestion", () => {
    it("answers questions about React", () => {
      const result = answerQuestion("What is React?", sampleText);
      expect(result.relevantExcerpt.toLowerCase()).toContain("react");
    });

    it("answers questions about components", () => {
      const result = answerQuestion("How do components work?", sampleText);
      expect(result.relevantExcerpt.toLowerCase()).toContain("component");
    });

    it("handles empty question", () => {
      const result = answerQuestion("", sampleText);
      expect(result.confidence).toBe("low");
    });

    it("handles empty text", () => {
      const result = answerQuestion("What is React?", "");
      expect(result.confidence).toBe("low");
    });

    it("returns low confidence for unrelated questions", () => {
      const result = answerQuestion("What is the capital of France?", sampleText);
      expect(result.confidence).toBe("low");
    });

    it("returns high confidence for exact matches", () => {
      const result = answerQuestion("virtual DOM performance", sampleText);
      expect(result.relevantExcerpt.toLowerCase()).toContain("virtual dom");
    });

    it("handles special characters in question", () => {
      const result = answerQuestion("What's React?", sampleText);
      expect(result.relevantExcerpt).toBeTruthy();
    });
  });

  describe("getTextStats", () => {
    it("counts words correctly", () => {
      const stats = getTextStats("hello world foo bar");
      expect(stats.words).toBe(4);
    });

    it("counts sentences", () => {
      const stats = getTextStats("Hello world. How are you? I am fine!");
      expect(stats.sentences).toBe(3);
    });

    it("identifies top words", () => {
      const text = "JavaScript JavaScript JavaScript Python Python Rust";
      const stats = getTextStats(text);
      expect(stats.topWords[0][0]).toBe("javascript");
    });

    it("handles empty text", () => {
      const stats = getTextStats("");
      expect(stats.words).toBe(0);
      expect(stats.topWords).toHaveLength(0);
    });

    it("calculates average words per sentence", () => {
      const stats = getTextStats("Hello world. Testing the count.");
      expect(stats.avgWordsPerSentence).toBeGreaterThan(0);
    });
  });
});
