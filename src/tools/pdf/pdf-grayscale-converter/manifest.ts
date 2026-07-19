import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "pdf-grayscale-converter",
  name: "PDF Grayscale Converter",
  description:
    "Convert color PDF to grayscale using luminance, average, lightness, desaturate, or custom-weighted " +
    "methods. Optional B&W threshold, black/white preservation, dithering, ink-usage estimation, before/after " +
    "histograms, history, and shareable URL. 100% client-side — no uploads.",
  category: "pdf",
  keywords: [
    "pdf grayscale",
    "convert pdf to black and white",
    "pdf to gray",
    "luminance pdf",
    "desaturate pdf",
    "bw pdf",
    "ink saver pdf",
    "monochrome pdf",
  ],
  icon: "contrast",
  requiresNetwork: false,
  seo: {
    title: "PDF Grayscale Converter — Luminance / B&W / Dithering | UnQTools",
    faq: [
      {
        q: "How does the PDF grayscale converter work?",
        a: "It walks every page's content stream, finds the color-setting operators (rg, RG, k, K, g, G), converts each color to grayscale using the chosen method, and rewrites the operators in DeviceGray space. The page geometry, text, and images stay in place — only the fill/stroke colors are remapped. A threshold mode further reduces the result to pure black-and-white.",
      },
      {
        q: "Which conversion methods are available?",
        a: "Five: (1) Luminance — NTSC 0.299R + 0.587G + 0.114B (default, best perceived brightness). (2) Average — simple (R+G+B)/3. (3) Lightness — HSL-style (max+min)/2. (4) Desaturate — HSL with S=0. (5) Custom-weighted — you supply comma-separated r,g,b weights such as 0.4,0.4,0.2. An optional threshold (-1 to skip) produces a binary black-and-white PDF.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) 5 conversion methods (luminance, average, lightness, desaturate, custom). (2) Custom weights parser & validator. (3) Threshold applier for B&W mode. (4) Pure-black / pure-white preservers. (5) Per-page color analyzer. (6) Ink usage calculator. (7) Color distance calculator (Euclidean RGB). (8) Text + CSV renderers. (9) Copy + Download. (10) History (localStorage, last 20). (11) Shareable URL. (12) Summary stats (pages, colors converted, ink saved %). (13) Ink savings estimator. (14) Before/after color comparison. (15) Dithering options (none, Floyd-Steinberg, ordered) for B&W threshold mode. (16) Histogram generator (color distribution before/after).",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. The conversion runs entirely in your browser using JavaScript and pdf-lib. Your PDF never leaves your device, and the tool works offline. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};
