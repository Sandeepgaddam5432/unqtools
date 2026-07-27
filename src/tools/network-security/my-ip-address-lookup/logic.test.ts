import { describe, it, expect } from "vitest";
import { detectIPVersion, isValidIPv4, isValidIPv6, getIPType, analyzeIP, getReverseDns } from "./logic";

describe("My IP Address Lookup", () => {
  it("detects IPv4", () => { expect(detectIPVersion("192.168.1.1")).toBe(4); });
  it("detects IPv6", () => { expect(detectIPVersion("::1")).toBe(6); });
  it("validates IPv4", () => {
    expect(isValidIPv4("192.168.1.1")).toBe(true);
    expect(isValidIPv4("999.999.999.999")).toBe(false);
  });
  it("detects private IP type", () => {
    expect(getIPType("192.168.1.1")).toBe("private");
    expect(getIPType("10.0.0.1")).toBe("private");
    expect(getIPType("8.8.8.8")).toBe("public");
  });
  it("detects loopback", () => {
    expect(getIPType("127.0.0.1")).toBe("loopback");
    expect(getIPType("::1")).toBe("loopback");
  });
  it("analyzes IP", () => {
    const info = analyzeIP("192.168.1.1");
    expect(info.isPrivate).toBe(true);
    expect(info.version).toBe(4);
  });
  it("generates reverse DNS", () => {
    expect(getReverseDns("1.2.3.4")).toBe("4.3.2.1.in-addr.arpa");
  });
});
