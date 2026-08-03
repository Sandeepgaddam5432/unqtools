import { describe, it, expect } from "vitest";
import { calculateStrength, generateSalt, PRESETS } from "./logic";

describe("Argon2 Hash Generator", () => {
  it("calculates strength for low params", () => {
    const r = calculateStrength(PRESETS["Low (interactive)"]);
    expect(r.score).toBeLessThan(3);
  });
  it("calculates strength for high params", () => {
    const r = calculateStrength(PRESETS["High (sensitive)"]);
    expect(r.score).toBeGreaterThanOrEqual(4);
  });
  it("generates salt of correct length", () => {
    const salt = generateSalt(16);
    expect(salt.length).toBe(32); // hex encoding
  });
  it("generates unique salts", () => {
    const s1 = generateSalt();
    const s2 = generateSalt();
    expect(s1).not.toBe(s2);
  });
  it("has presets", () => {
    expect(Object.keys(PRESETS).length).toBeGreaterThanOrEqual(3);
  });
});
