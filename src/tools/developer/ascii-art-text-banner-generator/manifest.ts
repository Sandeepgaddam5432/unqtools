/**
 * ASCII Art Text Banner Generator — Tool Manifest.
 * Tool #370 — Category 4 (Developer & Code).
 *
 * Convert text to ASCII art banners using 10+ bundled font styles (block,
 * banner, standard, big, small, shadow, slant, digital, thin, thick, mini,
 * letters). Each font is hand-tuned with uppercase A–Z, digits 0–9, space,
 * and common punctuation. Multiple character set options (hash, block, slash,
 * dot), adjustable custom width with line wrapping, horizontal and vertical
 * flip, downloadable as .txt or HTML, and live preview. 100% client-side.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ascii-art-text-banner-generator",
  name: "ASCII Art Text Banner Generator",
  description:
    "Convert text into ASCII art banners using 10+ bundled font styles (block, banner, standard, big, small, shadow, slant, digital, thin, thick, mini, letters). Each font is hand-tuned with uppercase A–Z, digits 0–9, space, and common punctuation. Choose a character set (hash, block, slash, dot), set a custom output width with line wrapping, flip horizontally or vertically, copy as monospaced text, wrap as Markdown code block or HTML <pre>, and download as .txt or HTML. 100% client-side.",
  category: "developer",
  keywords: [
    "ascii art", "ascii banner", "text to ascii",
    "figlet generator", "ascii text", "ascii font",
    "block text", "banner text", "ascii letters",
    "ascii art generator", "text banner", "ascii name",
  ],
  icon: "type",
  requiresNetwork: false,
  seo: {
    title: "ASCII Art Text Banner Generator (10+ fonts, 100% client-side) | UnQTools",
    faq: [
      {
        q: "What is ASCII art and what does this tool do?",
        a: "ASCII art is pictures or banners drawn using the printable ASCII characters (letters, digits, punctuation) instead of pixels. This tool converts any text you type into a large ASCII-art banner using one of 10+ bundled font styles — block, banner, standard, big, small, shadow, slant, digital, thin, thick, mini, letters — each hand-tuned with uppercase A–Z, digits 0–9, space, and common punctuation. The output renders correctly in any monospaced font (terminal, code editor, README, console output).",
      },
      {
        q: "What fonts and character sets are supported?",
        a: "Twelve bundled fonts ranging from 3-row 'mini' to 5-row 'block', including slanted and shadowed styles. Each font has glyphs for A–Z, 0–9, space, and . , ! ? ' - / + : ; ( ) — characters not in the font are rendered as a blank of the font's height. You can additionally choose a character-set overlay that re-maps the rendered output to a single character (hash '#', block '█', slash '/', dot '·') so the banner becomes a uniform-density pattern — useful for terminal splash screens and console banners.",
      },
      {
        q: "How does the custom width and line wrapping work?",
        a: "Set a maximum output width (in columns / characters) and the tool wraps long input text across multiple banners — each word starts on its own line of banners, and the renderer joins as many words per line as fit within the width. Very long words wider than the limit are rendered on their own line and allowed to overflow. There is no font hinting or kerning — the rendering is pure column concatenation of fixed-width glyphs separated by a single-space column.",
      },
      {
        q: "Can I flip or transform the banner?",
        a: "Yes. Two transform toggles: (1) Flip horizontal — mirror each row left-to-right (great for slant fonts to get a reverse-italic look). (2) Flip vertical — reverse the row order, which inverts shadowed or 3D-style fonts. Both toggles are composable with the character-set overlay. The live preview updates instantly, and the raw text you copy or download reflects the transformed output.",
      },
      {
        q: "What extra features does this tool have compared to other ASCII art generators?",
        a: "(1) 12 bundled hand-tuned fonts (most free tools ship only 3-5). (2) Character-set overlay that re-maps rendered output to a single uniform character (hash, block, slash, dot). (3) Custom output width with intelligent word-wrap. (4) Horizontal AND vertical flip transforms. (5) Three export formats: plain monospaced text, Markdown fenced code block, and HTML <pre>. (6) Download as .txt or .html. (7) Live preview that updates as you type. (8) One-click preset phrases (Hello, README, banner, console). (9) History (localStorage, last 20). (10) Shareable URL with the text + font + options round-tripped. 100% client-side and offline — your text never leaves the device.",
      },
    ],
  },
  status: "done",
};
