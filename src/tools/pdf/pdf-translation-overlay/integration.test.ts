import { describe, it, expect } from "vitest";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { parseTranslations, validateEntries, expandPageRange, computeOverlays, calculateOverlayPosition, parseHexColor, validateFontSize, applyRtlHandling } from "./logic";

describe("pdf-translation-overlay integration", () => {
  it("end-to-end: build a PDF, parse translations, compute overlays, stamp, reload", async () => {
    // 1. Build a source PDF with some "original" text.
    const doc = await PDFDocument.create();
    const page = doc.addPage([612, 792]);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    page.drawText("Hello", { x: 72, y: 700, size: 12, font, color: rgb(0, 0, 0) });
    page.drawText("World", { x: 72, y: 680, size: 12, font, color: rgb(0, 0, 0) });
    const bytes = await doc.save();
    expect(bytes.length).toBeGreaterThan(0);

    // 2. Reload to verify the source PDF is valid.
    const reloaded = await PDFDocument.load(bytes);
    expect(reloaded.getPageCount()).toBe(1);

    // 3. Parse translation entries targeting the original text positions.
    const entries = parseTranslations("1|72|700|Hola|12\n1|72|680|Mundo|12", 1);
    expect(entries).toHaveLength(2);
    expect(validateEntries(entries, 1)).toBeNull();

    // 4. Compute overlays using the "below-original" position.
    const opts = {
      position: "below-original" as const,
      fontSize: 12,
      textColor: "#FF0000",
      backgroundColor: "",
      fontFamily: "Helvetica" as const,
      pageRange: "all",
    };
    const eligible = new Set<number>(expandPageRange(opts.pageRange, 1) ?? []);
    const overlays = computeOverlays(entries, eligible, opts);
    expect(overlays).toHaveLength(2);
    // Below-original: overlay y should be below original y (smaller).
    expect(overlays[0].y).toBeLessThan(entries[0].y);

    // 5. Stamp the overlays onto the reloaded PDF (replicate UI logic).
    const pages = reloaded.getPages();
    const overlayFont = await reloaded.embedFont(StandardFonts.Helvetica);
    const textColor = parseHexColor(opts.textColor) ?? { r: 1, g: 0, b: 0 };
    const textRgb = rgb(textColor.r, textColor.g, textColor.b);
    for (const o of overlays) {
      const fs = validateFontSize(o.entry.fontSize).value;
      const { x, y } = calculateOverlayPosition(opts.position, o.entry.x, o.entry.y, fs, fs);
      const handled = applyRtlHandling(o.entry.text, x, fs, opts.fontFamily);
      pages[0].drawText(handled.text, {
        x: handled.x,
        y,
        size: fs,
        font: overlayFont,
        color: textRgb,
      });
    }
    const out = await reloaded.save();
    expect(out.length).toBeGreaterThan(0);

    // 6. Reload the stamped PDF to confirm it's valid.
    const final = await PDFDocument.load(out);
    expect(final.getPageCount()).toBe(1);
  });

  it("RTL handling: Arabic text is reversed for standard-font rendering", async () => {
    // pdf-lib's StandardFonts only support WinAnsi (Latin-1) encoding, so
    // Arabic glyphs cannot be drawn without embedding a Unicode font. This
    // test verifies that the RTL *handling* (reversal + x-shift) works; the
    // UI catches the glyph-encoding error and surfaces a friendly message.
    const handled = applyRtlHandling("مرحبا", 100, 12, "Helvetica");
    expect(handled.direction).toBe("rtl");
    expect(handled.text).not.toBe("مرحبا"); // reversed
    expect(handled.text).toBe("ابحرم"); // exactly reversed
    expect(handled.x).toBeLessThan(100); // shifted left for right-alignment

    // Verify the same logic via detectTextDirection.
    const { detectTextDirection } = await import("./logic");
    expect(detectTextDirection("مرحبا")).toBe("rtl");
    expect(detectTextDirection("Hello")).toBe("ltr");
  });
});
