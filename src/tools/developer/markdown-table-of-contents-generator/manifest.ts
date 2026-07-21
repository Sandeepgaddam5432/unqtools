/**
 * Markdown TOC Generator — Tool Manifest.
 * Tool #344 — Category 4 (Developer & Code).
 *
 * Paste a Markdown doc and instantly get a clickable table of contents with
 * correct GitHub/GitLab/pandoc/Bitbucket/generic anchor slugs, configurable
 * depth range, ordered/bullet list style, code-fence-aware parsing, duplicate
 * heading disambiguation, skip-first-heading, and an updatable [TOC] /
 * <!-- toc --> marker. 100% client-side.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "markdown-table-of-contents-generator",
  name: "Markdown TOC Generator",
  description:
    "Generate a clickable Markdown table of contents from any document's headings. Per-platform slug algorithm (GitHub, GitLab, pandoc, Bitbucket, generic), duplicate-heading disambiguation (-1, -2…), code-fence-aware parsing, setext heading support, depth range control, skip-first-heading, ordered or bullet list style, and insert/update at a [TOC] or <!-- toc --> marker. 100% client-side.",
  category: "developer",
  keywords: [
    "markdown toc generator", "table of contents generator", "github toc",
    "readme toc", "markdown anchor links", "markdown-toc", "bitdowntoc",
    "gitlab toc", "pandoc toc", "bitbucket toc", "anchor slug",
    "markdown heading parser", "toc marker", "auto toc",
  ],
  icon: "list",
  requiresNetwork: false,
  seo: {
    title: "Markdown TOC Generator — GitHub / GitLab / pandoc Slugs, [TOC] Marker | UnQTools",
    faq: [
      {
        q: "How does the Markdown TOC generator work?",
        a: "Paste your markdown document. The parser walks the source line-by-line, skipping fenced code blocks (``` and ~~~), and extracts H1–H6 ATX headings (# Title) plus setext-style headings (text followed by === for H1 or --- for H2). It then generates a clickable nested list of anchor links using the slug algorithm for your chosen platform. You can set a min/max depth, skip the first heading, switch between bullet and ordered lists, and insert the result back into your document at a [TOC] or <!-- toc --> marker.",
      },
      {
        q: "Why do anchor slugs differ between GitHub, GitLab, pandoc, and Bitbucket?",
        a: "Each platform has its own heading-to-anchor slug rules. GitHub and GitLab lowercase the heading, strip punctuation except hyphens, and join words with hyphens. Pandoc strips all punctuation including existing hyphens. Bitbucket preserves underscores. This tool ships per-platform slugify implementations so every generated link resolves correctly when rendered on the matching platform — switch the dropdown and the slugs update live.",
      },
      {
        q: "How are duplicate headings handled?",
        a: "If your document has two headings with the same text (e.g. two ## Examples sections), the tool appends a -1 suffix to the second occurrence, -2 to the third, and so on — matching GitHub's behavior. So the first link points to #examples, the second to #examples-1, the third to #examples-2. Each generated anchor matches what the platform's renderer will emit.",
      },
      {
        q: "Will # inside a code fence be mistaken for a heading?",
        a: "No. The parser tracks fenced code blocks (both ``` and ~~~) and skips lines inside them, so a comment like `# this is a comment` inside a code block is not picked up as a heading. Setext-style headings (text on one line, === on the next) are also detected, and indented headings inside the document body are handled correctly.",
      },
      {
        q: "What extra features does this tool have versus other TOC generators?",
        a: "(1) Per-platform slug algorithms (GitHub, GitLab, pandoc, Bitbucket, generic). (2) Duplicate-heading disambiguation with -1, -2 suffixes. (3) Code-fence-aware parsing (skips ``` and ~~~ blocks). (4) Setext heading support (=== and ---). (5) Configurable min/max depth (H1–H6). (6) Skip-first-heading option. (7) Bullet or ordered list output. (8) Insert at [TOC] marker. (9) Insert at <!-- toc --> / <!-- tocstop --> marker. (10) Update existing TOC in place. (11) Optional <a name=\"…\"> anchors for renderers without auto-IDs. (12) Emoji-aware heading handling. (13) Stats (heading count per level). (14) History (localStorage, last 20). (15) Shareable URL. 100% client-side — your documents never leave the browser.",
      },
    ],
  },
  status: "done",
};
