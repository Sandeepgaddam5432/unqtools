/**
 * Mermaid Diagram Live Editor — Tool Manifest.
 * Tool #346 — Category 4 (Developer & Code).
 *
 * Pure-JS Mermaid diagram validator, type detector, syntax reference, and
 * shareable mermaid.live URL generator with PNG/SVG export links. Detects
 * flowchart, sequence, class, ER, gantt, pie, state, mindmap, gitGraph,
 * journey, C4, timeline, quadrant, requirement, and xychart diagram types.
 * 100% client-side.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "mermaid-diagram-live-editor",
  name: "Mermaid Diagram Live Editor",
  description:
    "Validate Mermaid syntax, detect diagram type (flowchart, sequence, class, ER, gantt, pie, state, mindmap, gitGraph, journey, C4, timeline, quadrant, requirement, xychart), generate a shareable mermaid.live preview URL with base64 encoding, browse a syntax reference per type, and export as PNG or SVG via the live editor. Template gallery, line-anchored error decoder, history (localStorage), shareable URL. 100% client-side.",
  category: "developer",
  keywords: [
    "mermaid", "mermaid live editor", "mermaid diagram",
    "mermaid validator", "flowchart from text", "sequence diagram",
    "class diagram", "er diagram", "gantt chart", "state diagram",
    "mermaid to png", "mermaid to svg", "mermaid.live",
  ],
  icon: "git-graph",
  requiresNetwork: false,
  seo: {
    title: "Mermaid Diagram Live Editor — Validator + mermaid.live URL | UnQTools",
    faq: [
      {
        q: "How does the Mermaid live editor work?",
        a: "Type or paste Mermaid syntax in the editor — we detect the diagram type (flowchart, sequence, class, ER, gantt, pie, state, mindmap, gitGraph, journey, C4, timeline, quadrant, requirement, or xychart), validate the syntax line-by-line, show a friendly error decoder with the offending line highlighted, and generate a shareable mermaid.live URL (base64-encoded) so you can open the diagram in the official live editor for rendering and PNG/SVG export.",
      },
      {
        q: "Which Mermaid diagram types are supported?",
        a: "Fifteen types are auto-detected from the first non-comment line of your code: flowchart (graph), sequenceDiagram, classDiagram, erDiagram, gantt, pie, stateDiagram-v2 (and stateDiagram), mindmap, gitGraph, journey, C4Context / C4Container / C4Component, timeline, quadrantChart, requirementDiagram, and xychart-beta. The reference panel shows a minimal starter template for each.",
      },
      {
        q: "How does the syntax validator work without running Mermaid?",
        a: "The validator runs pure-JS structural checks per diagram type — e.g. flowchart validates node IDs and arrow types (--> ---> -.-> ==>), sequenceDiagram checks for `participant`/`actor` declarations and arrow types (`->`, `-->`, `->>`, `-->>`), classDiagram verifies class blocks and relationship arrows (`<|--`, `*--`, `o--`), gantt checks for `section` and date format headers, pie checks for data rows, and stateDiagram checks for `state` declarations and transitions. Line numbers are reported so you can jump to the problem.",
      },
      {
        q: "How do I share or export my diagram?",
        a: "Click \"Open in mermaid.live\" — we encode your source as base64 and append it to the URL fragment (`#base64:...`). The official live editor loads it, renders the diagram, and offers PNG/SVG export buttons. You can also copy the encoded URL, copy the raw Mermaid code, download the .mmd file, or copy a Markdown snippet that embeds the mermaid.live link.",
      },
      {
        q: "What extra features does this tool have versus the official editor?",
        a: "(1) Pure-JS syntax validator with line-anchored errors. (2) Auto diagram-type detector for 15 types. (3) Starter template gallery per type. (4) mermaid.live shareable URL generator (base64). (5) Markdown embed snippet with the live URL. (6) PNG/SVG export hint with link to mermaid.live. (7) Per-type syntax reference card. (8) Live char/line count and last-good render tracking. (9) Auto-format / indent normalizer. (10) Stats (line count, type counts). (11) History (localStorage, last 20). (12) Shareable URL with the source encoded. 100% client-side — no rendering happens on a server, no account, no upload.",
      },
    ],
  },
  status: "done",
};
