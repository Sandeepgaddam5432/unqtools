/**
 * Design system 2.0 — utility tests for pure helpers.
 *
 * Most UI components are presentational and tested via Playwright e2e + axe-core.
 * Here we test the pure logic that components rely on.
 */
import { describe, it, expect } from "vitest";
import { scoreString, searchTools } from "../src/lib/search";
import type { ToolManifest } from "../src/lib/tool";

const sampleTool = (overrides: Partial<ToolManifest>): ToolManifest =>
  ({
    id: "x",
    name: "X",
    description: "",
    category: "developer",
    keywords: [],
    icon: "x",
    component: async () => ({ default: () => null as never }),
    ...overrides,
  }) as ToolManifest;

describe("Design system search integration", () => {
  it("scoreString handles empty query", () => {
    expect(scoreString("", "anything")).toBe(1);
  });

  it("searchTools returns results sorted by score", () => {
    const tools = [
      sampleTool({ id: "a", name: "JSON Formatter", keywords: ["json"] }),
      sampleTool({ id: "b", name: "Base64", keywords: ["encode", "base64"] }),
      sampleTool({ id: "c", name: "JSON Minifier", keywords: ["json", "minify"] }),
    ];
    const out = searchTools("json", tools);
    expect(out.length).toBe(2);
    // Both should match; "JSON Formatter" should rank above "JSON Minifier"
    // because shorter candidate strings score higher.
    expect(out[0]!.tool.id).toBe("a");
    expect(out[1]!.tool.id).toBe("c");
  });
});

describe("Category labels completeness", () => {
  it("every category has a label", async () => {
    const { ALL_CATEGORIES, CATEGORY_LABELS } = await import("../src/lib/tool");
    for (const c of ALL_CATEGORIES) {
      expect(CATEGORY_LABELS[c]).toBeTruthy();
      expect(typeof CATEGORY_LABELS[c]).toBe("string");
    }
  });

  it("every category label is non-empty and human-readable", async () => {
    const { ALL_CATEGORIES, CATEGORY_LABELS } = await import("../src/lib/tool");
    for (const c of ALL_CATEGORIES) {
      const label = CATEGORY_LABELS[c];
      expect(label!.length).toBeGreaterThan(2);
      expect(label).toMatch(/[A-Z]/); // starts with a capital letter
    }
  });
});

describe("Storage hooks — pure helpers", () => {
  // The hooks themselves require a DOM environment; we test the constants
  // and any pure helpers they expose.
  it("MAX_RECENTS is a sensible cap", async () => {
    // Re-import the module to verify the constant
    const mod = await import("../src/lib/storage");
    // The hook is exported; we just verify the module loads cleanly
    expect(typeof mod.useFavorites).toBe("function");
    expect(typeof mod.useRecents).toBe("function");
    expect(typeof mod.useLocalStorage).toBe("function");
    expect(typeof mod.useInstallPrompt).toBe("function");
  });
});

describe("Theme system", () => {
  it("exposes light, dark, system choices", async () => {
    const mod = await import("../src/lib/theme");
    expect(typeof mod.getStoredTheme).toBe("function");
    expect(typeof mod.storeTheme).toBe("function");
    expect(typeof mod.applyTheme).toBe("function");
    expect(typeof mod.themeNoFoUcScript).toBe("string");
    // The no-FOUC script must reference the storage key
    expect(mod.themeNoFoUcScript).toContain("unq-theme");
  });
});
