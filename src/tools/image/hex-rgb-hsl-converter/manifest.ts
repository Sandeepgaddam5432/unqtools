/**
 * HEX RGB HSL Converter — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "hex-rgb-hsl-converter",
  name: "HEX RGB HSL Converter",
  description: "Convert between HEX, RGB, HSL, HSV color formats. Color picker, palette generator, WCAG check.",
  category: "image",
  keywords: ["hex rgb", "color converter", "hsl converter", "color format"],
  icon: "Palette",
  requiresNetwork: false,
  seo: {
    title: "HEX RGB HSL Converter — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Convert between HEX, RGB, HSL, HSV color formats. Color picker, palette generator, WCAG check." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) (1) HEX to RGB, (2) (2) RGB to HEX, (3) (3) HSL conversion, (4) (4) HSV conversion, (5) (5) Color picker, (6) (6) WCAG contrast, (7) (7) Copy any format, (8) (8) Palette generator, (9) (9) Shades/tints, (10) (10) Random color, (11) (11) Named colors, (12) (12) PWA offline" },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};
