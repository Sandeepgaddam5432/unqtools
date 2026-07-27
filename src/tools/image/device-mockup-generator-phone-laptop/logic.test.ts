import { describe, it, expect } from "vitest";
import { getDevice, generateMockupHtml, DEVICES, getDeviceList } from "./logic";

describe("Device Mockup Generator", () => {
  it("gets device by type", () => {
    expect(getDevice("iphone")?.name).toContain("iPhone");
  });
  it("generates mockup HTML", () => {
    const html = generateMockupHtml("iphone", "test.jpg");
    expect(html).toContain("test.jpg");
  });
  it("lists all devices", () => {
    expect(DEVICES.length).toBeGreaterThan(3);
  });
  it("gets device list", () => {
    expect(getDeviceList().length).toBe(DEVICES.length);
  });
});
