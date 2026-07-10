import { describe, expect, it } from "vitest";
import { htmlToPdf } from "./logic";
// Note: html2canvas requires a browser DOM, so most tests check error cases only.
// Full rendering tests run in the e2e suite.
describe("htmlToPdf", () => {
  it("errors on empty HTML", async () => { const r = await htmlToPdf("", { pageSize: "a4", orientation: "portrait", margin: 50 }); expect(r.ok).toBe(false); });
  it("errors on whitespace-only HTML", async () => { const r = await htmlToPdf("   ", { pageSize: "a4", orientation: "portrait", margin: 50 }); expect(r.ok).toBe(false); });
  // The following tests only run in browser context — skipped in Node
  it.skip("converts simple HTML in browser", async () => { /* requires DOM */ });
  it.skip("handles letter page size", async () => { /* requires DOM */ });
  it.skip("handles landscape orientation", async () => { /* requires DOM */ });
});
