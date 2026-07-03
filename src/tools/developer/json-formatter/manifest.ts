/**
 * JSON Formatter — Tool Manifest
 * Reference tool implementing the Tool Module Contract end-to-end.
 * See: unqtools-docs / "10 Reference Tool Spec — JSON Formatter".
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "json-formatter",
  name: "JSON Formatter",
  description: "Format, validate, minify, and sort JSON — fully in your browser.",
  category: "developer",
  keywords: ["json", "format", "prettify", "validate", "minify", "beautify", "lint"],
  icon: "braces",
  requiresNetwork: false,
  seo: {
    title: "JSON Formatter – Free Online JSON Beautifier & Validator | UnQTools",
    faq: [
      {
        q: "Is my JSON uploaded anywhere?",
        a: "No. All processing happens locally in your browser. Your data never leaves your device.",
      },
      {
        q: "What's the max size?",
        a: "Large inputs (over 100KB) are processed in a background Web Worker so the UI stays responsive. There is no hard limit — your device's memory is the only ceiling.",
      },
      {
        q: "Does this support JSONC (JSON with comments)?",
        a: "Not yet. The formatter accepts strict JSON only. Comments and trailing commas will be reported as syntax errors with line and column.",
      },
    ],
  },
  status: "done",
};
