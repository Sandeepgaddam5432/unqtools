import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ai-mermaid-flowchart-generator",
  name: "AI Mermaid.js Flowchart Generator",
  description:
    "Describe a process in plain English ('A leads to B, B leads to C; if X then Y else Z') and get valid Mermaid flowchart code with decision diamonds, parallel paths, loops, and subgraphs — auto-fixed for common syntax errors and rendered live. Direction toggle (TD/LR), node shapes, theme styling, and SVG/PNG export via mermaid.live. 100% client-side — nothing uploaded.",
  category: "ai",
  keywords: [
    "mermaid flowchart", "mermaid generator", "flowchart from text",
    "mermaid ai", "process diagram", "mermaid no login",
    "mermaid live alternative", "eraser alternative", "diagram from description",
    "mermaid syntax fixer", "decision tree",
  ],
  icon: "workflow",
  requiresNetwork: false,
  seo: {
    title: "AI Mermaid.js Flowchart Generator — Text to Flowchart, Private | UnQTools",
    faq: [
      {
        q: "How does the Mermaid flowchart generator work?",
        a: "Type a description like 'User signs in → check credentials → if valid then dashboard else login error' or paste a list of steps. The parser detects transition cues ('leads to', 'then', 'after', '→', '->', arrows), decision cues ('if', 'when', 'in case', '?'), parallel cues ('in parallel', 'meanwhile', 'at the same time'), loop cues ('loop', 'repeat', 'for each'), and subgraph cues ('phase:', 'stage:', 'during'). It builds nodes (rectangles for steps, diamonds for decisions) and edges, then renders valid Mermaid `flowchart` code with a live preview. A self-healing pass fixes common syntax errors (unclosed quotes, dangling edges, invalid node IDs).",
      },
      {
        q: "What Mermaid features are supported?",
        a: "Standard rectangle, rounded, stadium, subroutine, database, and circle node shapes; decision diamonds; labeled edges; yes/no branches; TD (top-down) and LR (left-right) directions; subgraphs (phase/stage grouping); loops rendered as labeled edges; parallel paths rendered as simultaneous edges; basic styling via classDef. The generator also exposes a validator + self-healer that repairs the most common Mermaid syntax mistakes before rendering.",
      },
      {
        q: "How does the syntax self-healer work?",
        a: "After generation, the code passes through validateMermaid() which checks for: balanced brackets and parentheses, balanced quotes, valid node IDs (alphanumeric + underscore only), no orphan edge arrows (e.g. '--> ' with no target), no duplicate node IDs, no reserved keywords as IDs, and proper subgraph closure. repairMermaid() then rewrites the code to fix what it can (escaping invalid characters in node IDs, removing orphan arrows, closing subgraphs) and emits warnings for what it cannot fix.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Natural-language → Mermaid flowchart parser. (2) Step-list parser (one step per line, arrows + '->'). (3) Decision nodes (if/when/?), parallel paths (in parallel/meanwhile), loops (for each/repeat), subgraphs (phase:/stage:). (4) Direction toggle TD/LR. (5) Six node shapes (rect, rounded, stadium, subroutine, database, circle). (6) Theme presets (default, forest, dark, neutral). (7) Mermaid syntax validator. (8) Self-healing repair pass with warnings. (9) mermaid.live deep-link for instant SVG/PNG export. (10) Refine-via-follow-up (append instructions, regenerate). (11) Local history (max 20). (12) Shareable URL with the description encoded. (13) Copy code / download .mmd. (14) Per-section copy. (15) Honesty disclaimers (review complex diagrams).",
      },
      {
        q: "Is my diagram description sent anywhere?",
        a: "No. All parsing, generation, validation, and self-healing run locally in your browser. Your description never leaves this device. History is stored in localStorage on this device only. The only outbound link is to mermaid.live when you click 'Open in mermaid.live' — that opens in a new tab and is the standard Mermaid playground; we don't send your code there automatically.",
      },
    ],
  },
  status: "done",
};
