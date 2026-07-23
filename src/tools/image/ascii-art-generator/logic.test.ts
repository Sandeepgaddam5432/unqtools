/**
 * ASCII Art Generator — unit tests.
 */
import { describe, it, expect } from "vitest";
import {
  applyAspectCorrection,
  applyBrightnessContrastGamma,
  applyEdgeDetect,
  applyGrayscale,
  applyInvert,
  asciiToAnsi,
  asciiToHtml,
  asciiToSvg,
  computeCrop,
  createImageDataLike,
  ditherAtkinson,
  ditherFloydSteinberg,
  ditherJJN,
  ditherStucki,
  downsampleToLuminanceGrid,
  encodeSettingsHash,
  estimateClipboardSize,
  FIGLET_FONTS,
  getSampleGallery,
  imageToAscii,
  listFigletFonts,
  luminance,
  luminanceToChar,
  makeSampleImage,
  noDither,
  parseSettingsHash,
  RAMP_PRESETS,
  reverseAsciiToImage,
  textToAscii,
  type ImageDataLike,
} from "./logic";

/* ---------- helpers ---------- */

function solidImage(width: number, height: number, r: number, g: number, b: number): ImageDataLike {
  const img = createImageDataLike(width, height);
  for (let i = 0; i < img.data.length; i += 4) {
    img.data[i] = r;
    img.data[i + 1] = g;
    img.data[i + 2] = b;
    img.data[i + 3] = 255;
  }
  return img;
}

function gradientImage(width: number, height: number): ImageDataLike {
  const img = createImageDataLike(width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const v = (x / width) * 255;
      const i = (y * width + x) * 4;
      img.data[i] = v;
      img.data[i + 1] = v;
      img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
  }
  return img;
}

/* ---------- luminance ---------- */

describe("luminance", () => {
  it("computes per-ITU-R BT.601 luma", () => {
    expect(luminance(255, 255, 255)).toBeCloseTo(255, 1);
    expect(luminance(0, 0, 0)).toBe(0);
    // Red contributes ~76/255 of full white.
    expect(luminance(255, 0, 0)).toBeCloseTo(76.245, 1);
    // Green dominates.
    expect(luminance(0, 255, 0)).toBeGreaterThan(luminance(255, 0, 0));
  });
});

/* ---------- brightness / contrast / gamma ---------- */

describe("applyBrightnessContrastGamma", () => {
  it("does not mutate the input image", () => {
    const img = solidImage(2, 2, 100, 100, 100);
    const before = new Uint8ClampedArray(img.data);
    applyBrightnessContrastGamma(img, 50, 0, 1);
    expect(Array.from(img.data)).toEqual(Array.from(before));
  });

  it("applies brightness as an additive offset", () => {
    const img = solidImage(1, 1, 100, 100, 100);
    const out = applyBrightnessContrastGamma(img, 50, 0, 1);
    expect(out.data[0]).toBe(150);
    expect(out.data[1]).toBe(150);
    expect(out.data[2]).toBe(150);
  });

  it("clamps brightness to 0-255", () => {
    const img = solidImage(1, 1, 200, 200, 200);
    const out = applyBrightnessContrastGamma(img, 200, 0, 1);
    expect(out.data[0]).toBe(255);
    const dark = applyBrightnessContrastGamma(solidImage(1, 1, 50, 50, 50), -100, 0, 1);
    expect(dark.data[0]).toBe(0);
  });

  it("applies contrast around midpoint 128", () => {
    // Full contrast (c=100) makes 100 → 28, 200 → 228 (approx).
    const img = solidImage(1, 1, 100, 100, 100);
    const out = applyBrightnessContrastGamma(img, 0, 100, 1);
    expect(out.data[0]).toBeLessThan(100);
    const bright = applyBrightnessContrastGamma(solidImage(1, 1, 200, 200, 200), 0, 100, 1);
    expect(bright.data[0]).toBeGreaterThan(200);
  });

  it("applies gamma correction", () => {
    // GIMP/Photoshop convention: gamma > 1 brightens mid-tones
    // (lifts shadows); gamma < 1 darkens.
    const img = solidImage(1, 1, 128, 128, 128);
    const out = applyBrightnessContrastGamma(img, 0, 0, 2);
    expect(out.data[0]).toBeGreaterThan(128);
    // Gamma=0.5 makes mid-gray darker.
    const bright = applyBrightnessContrastGamma(solidImage(1, 1, 128, 128, 128), 0, 0, 0.5);
    expect(bright.data[0]).toBeLessThan(128);
  });

  it("preserves alpha channel", () => {
    const img = createImageDataLike(1, 1);
    img.data[0] = 100; img.data[1] = 100; img.data[2] = 100; img.data[3] = 128;
    const out = applyBrightnessContrastGamma(img, 50, 0, 1);
    expect(out.data[3]).toBe(128);
  });
});

/* ---------- invert / grayscale / edge-detect ---------- */

describe("applyInvert", () => {
  it("inverts RGB channels", () => {
    const img = solidImage(1, 1, 100, 50, 0);
    const out = applyInvert(img);
    expect(out.data[0]).toBe(155);
    expect(out.data[1]).toBe(205);
    expect(out.data[2]).toBe(255);
  });

  it("preserves alpha", () => {
    const img = createImageDataLike(1, 1);
    img.data[0] = 0; img.data[1] = 0; img.data[2] = 0; img.data[3] = 200;
    const out = applyInvert(img);
    expect(out.data[3]).toBe(200);
  });
});

describe("applyGrayscale", () => {
  it("sets RGB to luminance", () => {
    const img = solidImage(1, 1, 255, 0, 0);
    const out = applyGrayscale(img);
    expect(out.data[0]).toBe(out.data[1]);
    expect(out.data[1]).toBe(out.data[2]);
    // 0.299 * 255 = 76.245 → rounded/clamped to 76 by Uint8ClampedArray.
    expect(out.data[0]).toBe(76);
  });
});

describe("applyEdgeDetect", () => {
  it("detects a vertical edge in a half-black / half-white image", () => {
    const img = createImageDataLike(4, 4);
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        const i = (y * 4 + x) * 4;
        const v = x < 2 ? 255 : 0;
        img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v; img.data[i + 3] = 255;
      }
    }
    const out = applyEdgeDetect(img);
    // The edge between x=1 and x=2 should have high magnitude.
    const edgeIdx = (1 * 4 + 1) * 4;
    const flatIdx = (1 * 4 + 0) * 4;
    expect(out.data[edgeIdx]!).toBeGreaterThan(out.data[flatIdx]!);
  });

  it("returns zero gradient on a solid image", () => {
    const img = solidImage(4, 4, 128, 128, 128);
    const out = applyEdgeDetect(img);
    expect(out.data[0]).toBe(0);
    expect(out.data[5]).toBe(0);
  });
});

/* ---------- aspect correction ---------- */

describe("applyAspectCorrection", () => {
  it("halves the height with default cell ratio 0.5", () => {
    // Source 1600x900, width=160 cells.
    const out = applyAspectCorrection(160, 90, 0.5);
    expect(out.width).toBe(160);
    expect(out.height).toBeCloseTo(45, 0); // 160 * (90/160) * 0.5 = 45
  });

  it("16:9 → ~16:4.5 with cell ratio 0.5", () => {
    // Source is 16:9; if width=16, source height = 9, output height = 9 * 0.5 = 4.5 → 5 rounded.
    const out = applyAspectCorrection(16, 9, 0.5);
    expect(out.width).toBe(16);
    expect(out.height).toBeGreaterThanOrEqual(4);
    expect(out.height).toBeLessThanOrEqual(5);
  });

  it("returns zero for zero width", () => {
    const out = applyAspectCorrection(0, 100, 0.5);
    expect(out.width).toBe(0);
    expect(out.height).toBe(0);
  });

  it("respects a custom cell ratio", () => {
    const out = applyAspectCorrection(100, 100, 1.0);
    expect(out.height).toBe(100);
  });
});

/* ---------- downsampling ---------- */

describe("downsampleToLuminanceGrid", () => {
  it("returns a grid of the requested dimensions", () => {
    const img = gradientImage(8, 8);
    const grid = downsampleToLuminanceGrid(img, 4, 4);
    expect(grid.length).toBe(16);
  });

  it("treats fully transparent pixels as the supplied background", () => {
    const img = createImageDataLike(2, 2);
    for (let i = 0; i < img.data.length; i += 4) {
      img.data[i] = 0; img.data[i + 1] = 0; img.data[i + 2] = 0; img.data[i + 3] = 0;
    }
    const grid = downsampleToLuminanceGrid(img, 1, 1, 255);
    expect(grid[0]).toBe(255);
  });
});

/* ---------- ramp mapping ---------- */

describe("luminanceToChar", () => {
  it("maps 0 to the first (darkest) ramp char", () => {
    expect(luminanceToChar(0, " .#")).toBe(" ");
  });

  it("maps 255 to the last (lightest) ramp char", () => {
    expect(luminanceToChar(255, " .#")).toBe("#");
  });

  it("returns a space for an empty ramp", () => {
    expect(luminanceToChar(128, "")).toBe(" ");
  });
});

/* ---------- dithering engines ---------- */

describe("dithering engines", () => {
  const cases: Array<[string, (img: ImageDataLike, ramp: string) => string]> = [
    ["noDither", noDither],
    ["floyd-steinberg", ditherFloydSteinberg],
    ["atkinson", ditherAtkinson],
    ["jjn", ditherJJN],
    ["stucki", ditherStucki],
  ];

  for (const [name, fn] of cases) {
    it(`${name}: produces non-empty output for valid input`, () => {
      const img = gradientImage(8, 8);
      const out = fn(img, " .:-=+*#%@");
      expect(out.length).toBeGreaterThan(0);
      expect(out.split("\n").length).toBe(8);
      expect(out.split("\n")[0]!.length).toBe(8);
    });

    it(`${name}: returns empty string for 0x0 image`, () => {
      const img = createImageDataLike(0, 0);
      const out = fn(img, " .#");
      expect(out).toBe("");
    });

    it(`${name}: works with a unicode ramp`, () => {
      const img = gradientImage(4, 4);
      const out = fn(img, " \u2591\u2592\u2593\u2588");
      expect(out.length).toBeGreaterThan(0);
    });
  }

  it("floyd-steinberg produces visibly different output than noDither", () => {
    const img = gradientImage(16, 16);
    const plain = noDither(img, " .:-=+*#%@");
    const dithered = ditherFloydSteinberg(img, " .:-=+*#%@");
    expect(dithered).not.toEqual(plain);
  });
});

/* ---------- imageToAscii ---------- */

describe("imageToAscii", () => {
  it("returns an error for zero width", () => {
    const img = gradientImage(8, 8);
    const res = imageToAscii(img, { width: 0, ramp: " .#", dithering: "none" });
    expect(res.ok).toBe(false);
  });

  it("returns an error for empty ramp", () => {
    const img = gradientImage(8, 8);
    const res = imageToAscii(img, { width: 8, ramp: "", dithering: "none" });
    expect(res.ok).toBe(false);
  });

  it("produces ASCII output of the correct cell dimensions", () => {
    const img = gradientImage(32, 32);
    const res = imageToAscii(img, {
      width: 8, ramp: " .#", dithering: "none", aspectCorrection: true, cellRatio: 0.5,
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      const lines = res.output.split("\n");
      expect(lines.length).toBe(4); // 32×32 → 8×4 with 0.5 cell ratio
      expect(lines[0]!.length).toBe(8);
    }
  });

  it("applies invert filter when requested", () => {
    const img = gradientImage(8, 8);
    const normal = imageToAscii(img, { width: 4, ramp: " .#", dithering: "none", aspectCorrection: false });
    const inverted = imageToAscii(img, { width: 4, ramp: " .#", dithering: "none", aspectCorrection: false, invert: true });
    expect(normal.ok).toBe(true);
    expect(inverted.ok).toBe(true);
    if (normal.ok && inverted.ok) {
      expect(inverted.output).not.toEqual(normal.output);
    }
  });

  it("works with a 1x1 image", () => {
    const img = solidImage(1, 1, 128, 128, 128);
    const res = imageToAscii(img, { width: 1, ramp: " .#", dithering: "none", aspectCorrection: false });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.output.length).toBeGreaterThan(0);
  });
});

/* ---------- FIGlet ---------- */

describe("listFigletFonts", () => {
  it("returns at least 60 fonts", () => {
    expect(listFigletFonts().length).toBeGreaterThanOrEqual(60);
  });

  it("includes the Standard font", () => {
    expect(FIGLET_FONTS).toContain("Standard");
  });

  it("includes the Big, Block, Banner, Slant, ANSI Shadow, Star Wars, Doom, Ghost, Shadow, Small, Mini fonts", () => {
    const expected = ["Big", "Block", "Banner", "Slant", "ANSI Shadow", "Star Wars", "Doom", "Ghost", "Shadow", "Small", "Mini"];
    for (const f of expected) expect(FIGLET_FONTS).toContain(f);
  });
});

describe("textToAscii", () => {
  it("returns an error for empty text", async () => {
    const res = await textToAscii("", "Standard");
    expect(res.ok).toBe(false);
  });

  it("returns an error for an unknown font", async () => {
    const res = await textToAscii("Hi", "This Font Does Not Exist");
    expect(res.ok).toBe(false);
  });

  it("renders ASCII art for the Standard font", async () => {
    const res = await textToAscii("Hi", "Standard");
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.output.length).toBeGreaterThan(0);
      expect(res.output.split("\n").length).toBeGreaterThanOrEqual(3);
    }
  }, 15000);

  it("renders a second font without re-loading", async () => {
    const res1 = await textToAscii("A", "Big");
    const res2 = await textToAscii("A", "Small");
    expect(res1.ok).toBe(true);
    expect(res2.ok).toBe(true);
    if (res1.ok && res2.ok) {
      expect(res1.output).not.toEqual(res2.output);
    }
  }, 15000);
});

/* ---------- ASCII → HTML ---------- */

describe("asciiToHtml", () => {
  it("wraps plain text in a <pre> for bw mode", () => {
    const html = asciiToHtml("Hi\n##", "bw");
    expect(html).toContain("<pre");
    expect(html).toContain("Hi");
    expect(html).not.toContain("<span");
  });

  it("HTML-escapes special characters", () => {
    const html = asciiToHtml("<>&", "bw");
    expect(html).toContain("&lt;");
    expect(html).toContain("&gt;");
    expect(html).toContain("&amp;");
    expect(html).not.toContain("<>");
  });

  it("uses inline styles for truecolor mode", () => {
    const html = asciiToHtml("#", "truecolor");
    expect(html).toContain("color:#");
    expect(html).toContain("<span");
  });

  it("uses inline styles for ansi256 mode", () => {
    const html = asciiToHtml("#", "ansi256");
    expect(html).toContain("color:#");
  });

  it("uses inline styles for ansi16 mode", () => {
    const html = asciiToHtml("#", "ansi16");
    expect(html).toContain("color:#");
  });

  it("applies phosphor green for phosphor mode", () => {
    const html = asciiToHtml("Hi", "phosphor");
    expect(html).toContain("#33ff66");
  });
});

/* ---------- ASCII → ANSI ---------- */

describe("asciiToAnsi", () => {
  it("returns the input unchanged for bw mode", () => {
    expect(asciiToAnsi("Hi", "bw")).toBe("Hi");
  });

  it("wraps the whole string in green for phosphor mode", () => {
    const out = asciiToAnsi("Hi", "phosphor");
    expect(out.startsWith("\x1b[32m")).toBe(true);
    expect(out.endsWith("\x1b[0m")).toBe(true);
  });

  it("emits SGR escape codes for truecolor mode", () => {
    const out = asciiToAnsi("#", "truecolor");
    expect(out).toContain("\x1b[38;2;");
    expect(out).toContain("\x1b[0m");
  });

  it("emits 256-color escape codes for ansi256 mode", () => {
    const out = asciiToAnsi("#", "ansi256");
    expect(out).toContain("\x1b[38;5;");
  });

  it("emits 16-color escape codes for ansi16 mode", () => {
    const out = asciiToAnsi("#", "ansi16");
    // 30-37 or 90-97 for foreground.
    expect(out).toMatch(/\x1b\[(3\d|9\d)m/);
  });
});

/* ---------- ASCII → SVG ---------- */

describe("asciiToSvg", () => {
  it("produces a valid SVG document", () => {
    const svg = asciiToSvg("Hi\n##", 12);
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
  });

  it("includes a <text> element per line", () => {
    const svg = asciiToSvg("a\nb\nc", 12);
    const matches = svg.match(/<text/g);
    expect(matches?.length).toBe(3);
  });

  it("escapes special XML characters", () => {
    const svg = asciiToSvg("<&>", 12);
    expect(svg).toContain("&lt;");
    expect(svg).toContain("&amp;");
  });

  it("uses the requested font size", () => {
    const svg = asciiToSvg("Hi", 24);
    expect(svg).toContain('font-size="24"');
  });
});

/* ---------- clipboard size ---------- */

describe("estimateClipboardSize", () => {
  it("returns 0 chars for empty string", () => {
    const s = estimateClipboardSize("");
    expect(s.chars).toBe(0);
    expect(s.kb).toBe(0);
    expect(s.lines).toBe(0);
  });

  it("counts characters and lines", () => {
    const s = estimateClipboardSize("abc\ndef");
    expect(s.chars).toBe(7);
    expect(s.lines).toBe(2);
  });

  it("estimates bytes for multibyte text", () => {
    // Each emoji is 4 UTF-8 bytes.
    const s = estimateClipboardSize("\u{1F600}");
    expect(s.chars).toBe(1);
    expect(s.kb).toBeCloseTo(4 / 1024, 5);
  });
});

/* ---------- reverse ASCII ---------- */

describe("reverseAsciiToImage", () => {
  it("returns an error for empty input", () => {
    const res = reverseAsciiToImage("", " .#");
    expect(res.ok).toBe(false);
  });

  it("returns an error for empty ramp", () => {
    const res = reverseAsciiToImage("abc", "");
    expect(res.ok).toBe(false);
  });

  it("returns ImageDataLike with correct dimensions", () => {
    const res = reverseAsciiToImage("##\n# ", " .#", 4);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.output.width).toBe(8);
      expect(res.output.height).toBe(8);
      expect(res.output.data.length).toBe(8 * 8 * 4);
    }
  });

  it("reconstructs space characters as white background", () => {
    const res = reverseAsciiToImage("  ", " .#", 4);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.output.data[0]).toBe(255);
      expect(res.output.data[1]).toBe(255);
    }
  });

  it("reconstructs the last ramp character as black", () => {
    const res = reverseAsciiToImage("#", " .#", 4);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.output.data[0]).toBe(0);
    }
  });

  it("handles unknown characters as mid-gray", () => {
    const res = reverseAsciiToImage("?", " .#", 4);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.output.data[0]).toBe(128);
    }
  });
});

/* ---------- crop presets ---------- */

describe("computeCrop", () => {
  it("square preset returns a 1:1 region", () => {
    const crop = computeCrop(800, 600, "square");
    expect(crop.width).toBe(crop.height);
    expect(crop.width).toBe(600);
  });

  it("16:9 preset fits inside the source", () => {
    const crop = computeCrop(1600, 900, "16:9");
    expect(crop.width).toBeLessThanOrEqual(1600);
    expect(crop.height).toBeLessThanOrEqual(900);
    expect(crop.width / crop.height).toBeCloseTo(16 / 9, 1);
  });

  it("9:16 preset is portrait", () => {
    const crop = computeCrop(1000, 1000, "9:16");
    expect(crop.height).toBeGreaterThan(crop.width);
  });

  it("free preset defaults to square", () => {
    const crop = computeCrop(400, 200, "free");
    expect(crop.width).toBe(crop.height);
  });
});

/* ---------- sample gallery ---------- */

describe("getSampleGallery", () => {
  it("returns exactly 10 entries", () => {
    expect(getSampleGallery().length).toBe(10);
  });

  it("every entry has a non-empty image", () => {
    for (const item of getSampleGallery()) {
      expect(item.image.width).toBeGreaterThan(0);
      expect(item.image.height).toBeGreaterThan(0);
      expect(item.image.data.length).toBe(item.image.width * item.image.height * 4);
    }
  });
});

describe("makeSampleImage", () => {
  it("produces the requested size", () => {
    const img = makeSampleImage("gradient", 32);
    expect(img.width).toBe(32);
    expect(img.height).toBe(32);
  });

  it("fills all pixels as opaque", () => {
    const img = makeSampleImage("radial", 16);
    for (let i = 3; i < img.data.length; i += 4) {
      expect(img.data[i]).toBe(255);
    }
  });
});

/* ---------- ramp presets ---------- */

describe("RAMP_PRESETS", () => {
  it("exposes at least 10 curated ramps", () => {
    expect(RAMP_PRESETS.length).toBeGreaterThanOrEqual(10);
  });

  it("every ramp is non-empty", () => {
    for (const p of RAMP_PRESETS) expect(p.ramp.length).toBeGreaterThan(0);
  });

  it("includes blocks, braille, kana, shade, emoji ramps", () => {
    const ids = RAMP_PRESETS.map((p) => p.id);
    expect(ids).toContain("blocks");
    expect(ids).toContain("braille");
    expect(ids).toContain("kana");
    expect(ids).toContain("shade");
    expect(ids).toContain("emoji");
  });
});

/* ---------- settings hash ---------- */

describe("encodeSettingsHash / parseSettingsHash", () => {
  it("round-trips a settings object", () => {
    const settings = { width: 80, ramp: " .#", dithering: "floyd-steinberg" };
    const hash = encodeSettingsHash(settings);
    expect(hash.length).toBeGreaterThan(0);
    const parsed = parseSettingsHash(hash);
    expect(parsed).toEqual(settings);
  });

  it("returns null for invalid hash", () => {
    expect(parseSettingsHash("not valid base64!!")).toBeNull();
  });

  it("returns null for empty input", () => {
    expect(parseSettingsHash("")).toBeNull();
  });
});

/* ---------- very wide image ---------- */

describe("very wide image edge case", () => {
  it("produces output for a wide image with no crash", () => {
    const img = gradientImage(64, 8);
    const res = imageToAscii(img, {
      width: 40, ramp: " .:-=+*#%@", dithering: "floyd-steinberg", aspectCorrection: true,
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      const lines = res.output.split("\n");
      expect(lines[0]!.length).toBe(40);
    }
  });
});
