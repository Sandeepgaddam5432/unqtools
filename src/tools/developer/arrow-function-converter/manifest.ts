/**
 * Arrow Function Converter — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "arrow-function-converter",
  name: "Arrow Function Converter",
  description: "Convert JS function expressions to arrow functions and vice versa. Detects this/arguments/super/yield.",
  category: "developer",
  keywords: ["arrow function converter", "arrow function converter", "encode", "decode", "converter"],
  icon: "ArrowRightLeft",
  requiresNetwork: false,
  seo: {
    title: "Arrow Function Converter — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Convert JS function expressions to arrow functions and vice versa. Detects this/arguments/super/yield." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded or tracked." },
      { q: "What extra features does this tool have?", a: "Extras: (1) Multiple modes/formats, (2) Live preview, (3) Import/export, (4) Bulk mode, (5) Copy/download, (6) History (localStorage), (7) Randomize, (8) Presets, (9) Validation, (10) PWA offline, (11) UTF-8 safe, (12) Dark mode." },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "live",
};
