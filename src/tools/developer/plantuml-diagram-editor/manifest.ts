/**
 * PlantUML Diagram Editor — Tool Manifest.
 * Tool #347 — Category 4 (Developer & Code).
 *
 * Pure-JS PlantUML syntax validator, diagram-type detector (sequence,
 * class, use case, activity, component, state, object, deployment),
 * plantuml.com render URL generator (deflate-encoded), syntax reference
 * per type, and PNG/SVG/ASCII export links. 100% client-side.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "plantuml-diagram-editor",
  name: "PlantUML Diagram Editor",
  description:
    "Validate PlantUML syntax, detect diagram type (sequence, class, use case, activity, component, state, object, deployment), generate a shareable plantuml.com render URL (deflate+base64 encoded), browse a syntax reference per type, and export as PNG, SVG, or ASCII art via the official server. Template gallery, line-anchored error decoder, history (localStorage), shareable URL. 100% client-side.",
  category: "developer",
  keywords: [
    "plantuml", "plantuml editor", "plantuml online",
    "plantuml validator", "uml from text", "sequence diagram",
    "class diagram", "use case diagram", "activity diagram",
    "component diagram", "state diagram", "object diagram",
    "deployment diagram", "plantuml to png", "plantuml to svg",
    "plantuml url encode", "deflate",
  ],
  icon: "git-graph",
  requiresNetwork: false,
  seo: {
    title: "PlantUML Diagram Editor — Validator + plantuml.com Render URL | UnQTools",
    faq: [
      {
        q: "How does the PlantUML diagram editor work?",
        a: "Type or paste PlantUML syntax in the editor — we detect the diagram type (sequence, class, use case, activity, component, state, object, or deployment), validate the syntax line-by-line, show a friendly error decoder with the offending line highlighted, and generate a shareable plantuml.com render URL using the official deflate+base64 encoding. Open the URL to view the diagram as PNG, SVG, or ASCII art.",
      },
      {
        q: "Which PlantUML diagram types are supported?",
        a: "Eight types are auto-detected from the @startuml ... @enduml block keywords: sequence (`participant`/`->`/`-->`), class (`class`/`interface`/`<|--`), use case (`usecase`/`actor`/`(use)`), activity (`:action;`/`if-then-else`/`start`/`stop`), component (`component`/`[...]`/`()--`), state (`state`/`[*]`/`-->`), object (`object`/`:`), and deployment (`node`/`database`/`cloud`). The reference panel shows a minimal starter template for each.",
      },
      {
        q: "How does the syntax validator work without running PlantUML?",
        a: "The validator runs pure-JS structural checks per diagram type — e.g. sequence checks `participant`/`actor` declarations and arrow types (`->`, `-->`, `->>`), class verifies class blocks and relationship arrows (`<|--`, `*--`, `o--`), activity checks `start`/`stop` matching and `if/else/endif` nesting, state checks `[*]` transitions, and component checks `[id]` block references. `@startuml`/`@enduml` matching is always verified. Line numbers are reported so you can jump to the problem.",
      },
      {
        q: "How do I share or export my diagram?",
        a: "Click \"Open in plantuml.com\" — we deflate-compress your source and base64-encode it (the official PlantUML URL encoding), then append it to the server path (e.g. `/svg/<encoded>` for SVG, `/png/<encoded>` for PNG, `/uml/<encoded>` for ASCII). You can copy the encoded URL, copy the raw PlantUML code, download the .puml file, or copy a Markdown snippet that embeds the rendered image link.",
      },
      {
        q: "What extra features does this tool have versus the official editor?",
        a: "(1) Pure-JS syntax validator with line-anchored errors. (2) Auto diagram-type detector for 8 types. (3) Starter template gallery per type. (4) plantuml.com shareable URL generator (deflate+base64). (5) PNG/SVG/ASCII export links. (6) Markdown embed snippet with image URL. (7) Per-type syntax reference card. (8) Live char/line count and stats. (9) Theme picker (plain, plantuml, minty, etc.). (10) Encoded URL decoder (paste a plantuml.com URL to extract source). (11) History (localStorage, last 20). (12) Shareable URL with the source encoded. 100% client-side — no rendering happens on our servers, no account, no upload.",
      },
    ],
  },
  status: "done",
};
