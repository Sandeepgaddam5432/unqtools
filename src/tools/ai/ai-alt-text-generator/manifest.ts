import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ai-alt-text-generator",
  name: "AI Alt Text Generator for Images",
  description:
    "Generate WCAG-friendly alt text for images. On-device metadata extractor (dimensions, format, dominant color, filename → suggest), context-aware descriptive templates, decorative vs informative vs complex classifier, length meter, 'don't start with image of' linter, optional SEO keyword weaving, 100+ language templates, batch CSV/JSON export, optional BYO-key LLM caption enhancement. 100% client-side — images never uploaded.",
  category: "ai",
  keywords: [
    "alt text", "alt text generator", "image alt", "wcag alt",
    "image accessibility", "alt attribute", "img alt",
    "accessibility", "screen reader", "image description",
  ],
  icon: "image",
  requiresNetwork: false,
  seo: {
    title: "AI Alt Text Generator — WCAG-friendly Image Descriptions, On-Device | UnQTools",
    faq: [
      {
        q: "How does the AI alt text generator work?",
        a: "Drop or select an image and the tool extracts its metadata (dimensions, format, dominant color, file name) to suggest a starting alt text. You provide context (what the image is for — e.g., 'product photo', 'screenshot of dashboard') and the tool generates descriptive, WCAG-friendly alt text using template patterns. Optionally paste your own LLM API key for higher-quality captions.",
      },
      {
        q: "How does it decide between decorative and informative images?",
        a: "A WCAG-aware classifier asks you to pick a category: decorative (gets empty alt = ''), informative (gets a concise description), complex (gets a longer description, optionally with a longdesc). Decorative images never get filler text like 'image of a divider' — they get the empty alt that screen readers correctly skip.",
      },
      {
        q: "Does it avoid common alt-text mistakes?",
        a: "Yes. A built-in linter flags: starting with 'image of' / 'picture of' / 'photo of' (redundant — screen readers already announce 'image'), alt text over 125 characters (most screen readers truncate), alt text identical to the filename, and SEO keyword stuffing (keyword appears more than twice).",
      },
      {
        q: "Can I use my own LLM API key for better captions?",
        a: "Yes. The tool builds an optimal prompt (image base64 + context + WCAG guidelines) and calls OpenAI Vision or Anthropic Claude with a key you paste — stored only in localStorage on this device. If no key is provided, the on-device metadata extractor + template generator produces solid baseline alt text fully offline.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Image metadata extractor (dimensions, format, dominant color, file size). (2) Filename-based alt hint. (3) Context-aware template generator. (4) Decorative/informative/complex classifier with WCAG guidance. (5) 'Don't start with image of' linter. (6) Length meter (target ≤ 125 chars). (7) SEO keyword weaver with stuffing warning. (8) 100+ language templates. (9) Batch CSV/JSON export (filename → alt). (10) Inline-editable alt fields. (11) Optional BYO-key LLM caption. (12) Copy alt as HTML <img> tag. (13) History (localStorage, last 20). (14) Shareable URL. (15) Decorative-image empty-alt guidance.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All image analysis (metadata extraction, dominant-color computation, template generation, linting) runs locally in your browser. Images never leave this device. The only network call is if you paste your own LLM API key and click 'Enhance with LLM' — that request goes directly from your browser to the LLM provider you choose.",
      },
    ],
  },
  status: "done",
};
