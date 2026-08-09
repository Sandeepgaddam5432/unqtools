import { describe, expect, it } from "vitest";
import { maskValue, findPii, redactText } from "./logic";

describe("maskValue", () => {
  it("masks emails keeping domain", () => {
    expect(maskValue("john.doe@example.com", "email")).toContain("***@example.com");
  });

  it("masks numbers keeping edges", () => {
    const m = maskValue("123456789012", "aadhaar");
    expect(m).toContain("****");
    expect(m.length).toBeLessThan(12);
  });
});

describe("findPii", () => {
  it("finds emails and phones", () => {
    const matches = findPii("Contact john@corp.com or 98765 43210 today.");
    expect(matches.some((m) => m.kind === "email")).toBe(true);
    expect(matches.some((m) => m.kind === "phone")).toBe(true);
  });

  it("finds aadhaar-like numbers", () => {
    const matches = findPii("ID: 2345 6789 0123");
    expect(matches.some((m) => m.kind === "aadhaar")).toBe(true);
  });

  it("finds IP addresses and PAN", () => {
    const matches = findPii("server 192.168.1.1 pan ABCDE1234F");
    expect(matches.some((m) => m.kind === "ip")).toBe(true);
    expect(matches.some((m) => m.kind === "pan")).toBe(true);
  });

  it("no matches for clean text", () => {
    expect(findPii("This is a normal sentence without secrets.")).toEqual([]);
  });
});

describe("redactText", () => {
  it("masks all matches in order", () => {
    const matches = [
      { start: 7, end: 20, value: "john@corp.com", kind: "email" as const },
    ];
    const out = redactText("Email: john@corp.com here", matches);
    expect(out).toContain("Email: jo***@corp.com here");
    expect(out).not.toContain("john@corp.com");
  });
});
