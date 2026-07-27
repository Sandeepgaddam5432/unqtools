import { describe, it, expect } from "vitest";
import { getAllSizes, getSizesByPlatform, IOS_SIZES, ANDROID_SIZES, calculateTotalIcons } from "./logic";

describe("App Icon Generator", () => {
  it("lists all sizes", () => {
    expect(getAllSizes().length).toBe(IOS_SIZES.length + ANDROID_SIZES.length);
  });
  it("filters by platform", () => {
    expect(getSizesByPlatform("iOS").every(s => s.platform === "iOS")).toBe(true);
    expect(getSizesByPlatform("Android").every(s => s.platform === "Android")).toBe(true);
  });
  it("calculates total icons", () => {
    expect(calculateTotalIcons(true, true)).toBe(IOS_SIZES.length + ANDROID_SIZES.length);
    expect(calculateTotalIcons(true, false)).toBe(IOS_SIZES.length);
  });
});
