import { describe, it, expect } from "vitest";
import { parseEmailHeaders, formatDelay, exportAnalysis } from "./logic";

const SAMPLE_HEADERS = `From: Alice <alice@example.com>
To: bob@example.com
Subject: Hello
Date: Mon, 01 Jan 2024 12:00:00 +0000
Message-ID: <abc@example.com>
Received: by mail.example.com for <bob@example.com>; Mon, 01 Jan 2024 12:00:01 +0000
Received: from alice.example.com by mail.example.com; Mon, 01 Jan 2024 12:00:00 +0000
Received-SPF: pass (example.com: domain of alice@example.com designates 1.2.3.4 as permitted sender)
Authentication-Results: example.com; spf=pass (sender IP authorized); dkim=pass (good signature); dmarc=pass
DKIM-Signature: v=1; a=rsa-sha256; d=example.com; s=selector; b=abc123
Return-Path: <alice@example.com>`;

describe("Email Header Analyzer", () => {
  it("parses From address", () => {
    const r = parseEmailHeaders(SAMPLE_HEADERS);
    expect(r.from).toBe("alice@example.com");
  });

  it("parses To address", () => {
    const r = parseEmailHeaders(SAMPLE_HEADERS);
    expect(r.to).toEqual(["bob@example.com"]);
  });

  it("parses Subject", () => {
    const r = parseEmailHeaders(SAMPLE_HEADERS);
    expect(r.subject).toBe("Hello");
  });

  it("parses Date", () => {
    const r = parseEmailHeaders(SAMPLE_HEADERS);
    expect(r.date).toContain("Mon, 01 Jan 2024");
  });

  it("parses Message-ID", () => {
    const r = parseEmailHeaders(SAMPLE_HEADERS);
    expect(r.messageId).toBe("<abc@example.com>");
  });

  it("extracts Received hops", () => {
    const r = parseEmailHeaders(SAMPLE_HEADERS);
    expect(r.receivedHops.length).toBe(2);
  });

  it("parses SPF result from Received-SPF header", () => {
    const r = parseEmailHeaders(SAMPLE_HEADERS);
    expect(r.auth.spf.result).toBe("pass");
  });

  it("parses DKIM result from Authentication-Results", () => {
    const r = parseEmailHeaders(SAMPLE_HEADERS);
    expect(r.auth.dkim.result).toBe("pass");
  });

  it("parses DMARC result from Authentication-Results", () => {
    const r = parseEmailHeaders(SAMPLE_HEADERS);
    expect(r.auth.dmarc.result).toBe("pass");
  });

  it("handles empty input", () => {
    const r = parseEmailHeaders("");
    expect(r.error).toBeDefined();
  });

  it("decodes RFC 2047 encoded-word subject", () => {
    const headers = "Subject: =?UTF-8?B?SGVsbG8gV29ybGQ=?=\nFrom: <a@b.com>";
    const r = parseEmailHeaders(headers);
    expect(r.subject).toBe("Hello World");
  });

  it("unfolds multi-line headers", () => {
    const headers = `Received: by mail.example.com (Postfix)
\tfor <bob@example.com>; Mon, 01 Jan 2024 12:00:00 +0000
From: <alice@example.com>`;
    const r = parseEmailHeaders(headers);
    expect(r.receivedHops.length).toBe(1);
    expect(r.receivedHops[0].for).toBe("bob@example.com");
  });

  it("flags From vs Return-Path mismatch", () => {
    const headers = `From: <alice@example.com>\nReturn-Path: <evil@spam.com>`;
    const r = parseEmailHeaders(headers);
    expect(r.suspicious.length).toBeGreaterThan(0);
  });

  it("flags failed SPF", () => {
    const headers = `From: <a@b.com>\nReceived-SPF: fail (not authorized)`;
    const r = parseEmailHeaders(headers);
    expect(r.suspicious.some((s) => s.includes("SPF"))).toBe(true);
  });

  it("formats delay milliseconds", () => {
    expect(formatDelay(500)).toBe("500ms");
    expect(formatDelay(1500)).toBe("1.5s");
    expect(formatDelay(90000)).toBe("1.5m");
    expect(formatDelay(7200000)).toBe("2.0h");
  });

  it("formats negative delays", () => {
    expect(formatDelay(-1500)).toBe("-1.5s");
  });

  it("exports analysis as JSON", () => {
    const r = parseEmailHeaders(SAMPLE_HEADERS);
    const json = exportAnalysis(r, "json");
    const parsed = JSON.parse(json);
    expect(parsed.from).toBe("alice@example.com");
  });

  it("exports analysis as CSV", () => {
    const r = parseEmailHeaders(SAMPLE_HEADERS);
    const csv = exportAnalysis(r, "csv");
    expect(csv).toContain("From,alice@example.com");
    expect(csv).toContain("SPF,pass");
  });
});
