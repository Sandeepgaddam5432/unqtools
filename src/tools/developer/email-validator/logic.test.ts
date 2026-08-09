import { describe, it, expect } from "vitest";
import {
  validateEmail,
  validateEmailList,
  resultsToCsv,
  summarize,
} from "./logic";

describe("email-validator", () => {
  it("accepts a normal email", () => {
    const r = validateEmail("user@example.com");
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it("accepts dots and plus in local part", () => {
    expect(validateEmail("first.last+tag@example.co").valid).toBe(true);
  });

  it("rejects missing @", () => {
    expect(validateEmail("notanemail").valid).toBe(false);
  });

  it("rejects multiple @", () => {
    expect(validateEmail("a@b@c.com").valid).toBe(false);
  });

  it("rejects empty input", () => {
    expect(validateEmail("").valid).toBe(false);
  });

  it("rejects invalid TLD", () => {
    const r = validateEmail("user@example.notatld");
    expect(r.valid).toBe(false);
    expect(r.errors.join(" ")).toContain("TLD");
  });

  it("rejects single-label domain", () => {
    expect(validateEmail("user@localhost").valid).toBe(false);
  });

  it("rejects leading/trailing dot in local", () => {
    expect(validateEmail(".user@example.com").valid).toBe(false);
    expect(validateEmail("user.@example.com").valid).toBe(false);
  });

  it("rejects invalid local chars", () => {
    expect(validateEmail("us er@example.com").valid).toBe(false);
  });

  it("validates a list", () => {
    const list = validateEmailList("a@b.com\nbad-email\nc@d.org");
    expect(list).toHaveLength(3);
    expect(list[0].valid).toBe(true);
    expect(list[1].valid).toBe(false);
    expect(list[2].valid).toBe(true);
  });

  it("summarizes a batch", () => {
    const s = summarize(validateEmailList("a@b.com\nbad\nd@e.org\nf"));
    expect(s.total).toBe(4);
    expect(s.valid).toBe(2);
    expect(s.invalid).toBe(2);
  });

  it("produces CSV", () => {
    const csv = resultsToCsv([validateEmail("a@b.com")]);
    expect(csv).toContain("email,valid,errors");
    expect(csv).toContain("a@b.com");
  });
});
