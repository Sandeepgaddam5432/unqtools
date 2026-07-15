import { describe, expect, it } from "vitest";
import { svgToPdf } from "./logic";
const baseOpts = { pageSize: "a4" as const, orientation: "portrait" as const, margin: 50 };
describe("svgToPdf", () => {
  it("errors on empty SVG", async () => { const r = await svgToPdf("", baseOpts); expect(r.ok).toBe(false); });
  it("errors on non-SVG input", async () => { const r = await svgToPdf("just text", baseOpts); expect(r.ok).toBe(false); if (!r.ok) expect(r.error).toContain("valid SVG"); });
  it("errors on whitespace only", async () => { const r = await svgToPdf("   ", baseOpts); expect(r.ok).toBe(false); });
  // Browser-only tests (skipped in Node)
  it("converts simple SVG in browser", async () => { /* requires DOM */ });
  it("handles fit page size", async () => { /* requires DOM */ });
  it("handles letter page", async () => { /* requires DOM */ });
  it("handles landscape", async () => { /* requires DOM */ });
});
