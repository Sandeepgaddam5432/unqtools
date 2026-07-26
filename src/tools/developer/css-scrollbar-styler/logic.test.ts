import { describe, it, expect } from "vitest";
import {
  generateCSS, parseCSS, defaultLayer, presetLayers,
  exportJSON, importJSON, randomColor, randomLayer,
  hexToRgba, rgbaToHex, validateLayer,
  darkenColor, lightenColor, type LayerSpec,
} from "./logic";

describe("CSS Scrollbar Styler", () => {
  it("generates CSS from a single layer", () => {
    const css = generateCSS({ layers: [defaultLayer()] });
    expect(css).toContain("scrollbar:");
  });

  it("generates CSS with multiple layers", () => {
    const layers = [defaultLayer(), defaultLayer()];
    const css = generateCSS({ layers });
    expect(css).toContain(",");
  });

  it("handles inset shadows", () => {
    const layer: LayerSpec = { offsetX: 0, offsetY: 0, blur: 5, spread: 0, color: "#000", inset: true };
    const css = generateCSS({ layers: [layer] });
    expect(css).toContain("inset");
  });

  it("handles !important flag", () => {
    const css = generateCSS({ layers: [defaultLayer()], important: true });
    expect(css).toContain("!important");
  });

  it("returns empty string for no layers", () => {
    expect(generateCSS({ layers: [] })).toBe("");
  });

  it("parses a simple CSS string back into layers", () => {
    const css = `scrollbar: 1px 2px 3px 4px #000000;`;
    const layers = parseCSS(css);
    expect(layers).not.toBeNull();
    expect(layers!.length).toBe(1);
    expect(layers![0].offsetX).toBe(1);
  });

  it("parses inset layers", () => {
    const css = `scrollbar: inset 1px 2px 3px 4px #000;`;
    const layers = parseCSS(css);
    expect(layers![0].inset).toBe(true);
  });

  it("parses multiple comma-separated layers", () => {
    const css = `scrollbar: 1px 2px 3px #fff, 4px 5px 6px #000;`;
    const layers = parseCSS(css);
    expect(layers!.length).toBe(2);
  });

  it("handles rgba colors with commas inside parens", () => {
    const css = `scrollbar: 1px 2px 3px rgba(0, 0, 0, 0.5);`;
    const layers = parseCSS(css);
    expect(layers!.length).toBe(1);
    expect(layers![0].color).toBe("rgba(0, 0, 0, 0.5)");
  });

  it("default layer has sensible values", () => {
    const l = defaultLayer();
    expect(l.offsetX).toBe(0);
    expect(l.offsetY).toBe(4);
    expect(l.blur).toBe(6);
    expect(l.color).toBeTruthy();
  });

  it("presetLayers returns multiple presets", () => {
    const presets = presetLayers();
    const keys = Object.keys(presets);
    expect(keys.length).toBeGreaterThan(5);
    expect(presets["Material Elevation 1"]).toBeDefined();
    expect(presets["Neumorphism"]).toBeDefined();
  });

  it("exports and re-imports JSON", () => {
    const opts = { layers: [defaultLayer()] };
    const json = exportJSON(opts);
    const parsed = importJSON(json);
    expect(parsed).toEqual(opts);
  });

  it("rejects invalid JSON", () => {
    expect(importJSON("not-json")).toBeNull();
  });

  it("generates a random color", () => {
    const c = randomColor();
    expect(c).toMatch(/^rgba\(\d+,\d+,\d+,/);
  });

  it("generates a random layer", () => {
    const l = randomLayer();
    expect(l.offsetX).toBeGreaterThanOrEqual(-20);
    expect(l.offsetX).toBeLessThanOrEqual(20);
  });

  it("converts hex to rgba", () => {
    expect(hexToRgba("#ff0000", 1)).toBe("rgba(255,0,0,1)");
  });

  it("converts rgba to hex", () => {
    expect(rgbaToHex("rgba(255, 0, 0, 1)")).toBe("#ff0000");
  });

  it("validates layer ranges", () => {
    const ok: LayerSpec = { offsetX: 0, offsetY: 0, blur: 0, spread: 0, color: "#000", inset: false };
    expect(validateLayer(ok)).toHaveLength(0);
  });

  it("darkens a color", () => {
    expect(darkenColor("#ffffff", 0.5)).toBe("#7f7f7f");
  });

  it("lightens a color", () => {
    expect(lightenColor("#000000", 0.5)).toBe("#808080");
  });
});
