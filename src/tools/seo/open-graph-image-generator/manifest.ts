import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "open-graph-image-generator",
  name: "Open Graph Image Generator",
  description:
    "Generate Open Graph images as SVG (1200×630). Title, subtitle, background color, text color, font size, logo URL, template selector (gradient / solid / pattern), text positioning, SVG download, preview, history, shareable URL. 100% client-side.",
  category: "seo",
  keywords: [
    "open graph", "og image", "social image", "svg", "1200x630",
    "twitter card", "facebook share image", "preview",
  ],
  icon: "image",
  requiresNetwork: false,
  seo: {
    title: "Open Graph Image Generator — 1200×630 SVG OG Images | UnQTools",
    faq: [
      {
        q: "What size is an Open Graph image?",
        a: "The recommended OG image size is 1200×630 pixels (1.91:1 ratio). Facebook, LinkedIn, Twitter, and Slack all use this size for link previews. This tool generates SVG at exactly 1200×630, which you can convert to PNG/JPG if needed.",
      },
      {
        q: "Why SVG instead of PNG?",
        a: "SVG is vector — perfectly sharp at any size, tiny file size, and editable in any text editor. Many platforms now accept SVG. For platforms that require raster formats, convert the SVG to PNG using any browser or a free tool.",
      },
      {
        q: "Which templates are available?",
        a: "Three templates: Solid (single background color), Gradient (two-stop linear gradient), and Pattern (background color plus a subtle dot grid overlay). Each supports a custom title, subtitle, text color, font size, and optional logo URL.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Title input. (2) Subtitle input. (3) Background color picker. (4) Text color picker. (5) Font size slider. (6) Logo URL input (embedded as image). (7) Template selector (solid / gradient / pattern). (8) Text positioning (left/center/right). (9) SVG download. (10) Live preview. (11) History (localStorage, last 20). (12) Shareable URL.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. SVG generation runs locally. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};
