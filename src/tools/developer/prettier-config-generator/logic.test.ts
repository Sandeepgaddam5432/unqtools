import { describe, it, expect } from "vitest";
import { defaultConfig, generateJSON, generateYAML, generateJS, getPresets, validate } from "./logic";

describe("Prettier Config Generator", () => {
  it("generates JSON config", () => {
    const json = generateJSON(defaultConfig());
    expect(JSON.parse(json).printWidth).toBe(80);
  });
  it("generates YAML config", () => {
    const yaml = generateYAML(defaultConfig());
    expect(yaml).toContain("printWidth:");
  });
  it("generates JS config", () => {
    const js = generateJS(defaultConfig());
    expect(js).toContain("module.exports");
  });
  it("lists presets", () => {
    expect(getPresets().length).toBeGreaterThan(0);
  });
  it("validates config", () => {
    expect(validate(defaultConfig())).toHaveLength(0);
    expect(validate({ ...defaultConfig(), printWidth: 10 }).length).toBeGreaterThan(0);
  });
});
