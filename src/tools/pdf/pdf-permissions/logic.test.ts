import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { toEncryptionPermissions, inspectPermissions, setPermissions } from "./logic";

async function makePdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([200, 300]);
  page.drawText("hi", { x: 5, y: 5, size: 8 });
  return doc.save();
}

describe("toEncryptionPermissions", () => {
  it("maps high printing to true", () => {
    const p = toEncryptionPermissions({ printing: "high" });
    expect(p.printing).toBe(true);
  });
  it("maps none printing to false", () => {
    const p = toEncryptionPermissions({ printing: "none" });
    expect(p.printing).toBe(false);
  });
  it("maps low printing to low", () => {
    const p = toEncryptionPermissions({ printing: "low" });
    expect(p.printing).toBe("low");
  });
  it("defaults copying/modifying to true", () => {
    const p = toEncryptionPermissions({});
    expect(p.copying).toBe(true);
    expect(p.modifying).toBe(true);
  });
});

describe("inspectPermissions", () => {
  it("reports unencrypted PDFs", async () => {
    const doc = await PDFDocument.load(await makePdf());
    const info = inspectPermissions(doc);
    expect(info.encrypted).toBe(false);
  });
});

describe("setPermissions", () => {
  it("reports clearly when encryption is unavailable (pdf-lib 1.17)", async () => {
    const r = await setPermissions(await makePdf(), {
      ownerPassword: "owner",
      flags: { printing: "low", copying: false },
    });
    // pdf-lib 1.17 dropped encrypt(); the tool must fail gracefully, not throw.
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/encryption/i);
  });

  it("rejects an empty owner password", async () => {
    const r = await setPermissions(await makePdf(), { ownerPassword: "" });
    expect(r.ok).toBe(false);
  });

  it("rejects corrupt PDFs", async () => {
    const r = await setPermissions(new Uint8Array([1, 2]), { ownerPassword: "x" });
    expect(r.ok).toBe(false);
  });
});
