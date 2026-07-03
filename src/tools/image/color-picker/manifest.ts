import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "color-picker",
  name: "Color Picker & Converter",
  description:
    "Pick colors and convert between HEX, RGB, HSL, and HSV. Includes WCAG contrast checking for accessibility. 100% private.",
  category: "image",
  keywords: [
    "color picker",
    "hex to rgb",
    "rgb to hex",
    "hsl",
    "hsv",
    "color converter",
    "contrast checker",
    "wcag",
  ],
  icon: "palette",
  requiresNetwork: false,
  seo: {
    title: "Color Picker & Converter — HEX, RGB, HSL, HSV | UnQTools",
    faq: [
      {
        q: "What color formats are supported?",
        a: "HEX (#RGB / #RRGGBB / #RRGGBBAA), RGB / RGBA (0-255), HSL / HSLA (0-360°, 0-100%), and HSV / HSVA. Conversions are mathematically exact.",
      },
      {
        q: "How does the contrast checker work?",
        a: "It computes the WCAG 2.1 contrast ratio between two colors and checks compliance against AA (4.5:1 normal text, 3:1 large text) and AAA (7:1 normal text, 4.5:1 large text) thresholds. Useful for verifying accessible color combinations.",
      },
    ],
  },
  status: "done",
};
