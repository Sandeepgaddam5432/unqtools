import type { ToolManifest } from "../../../lib/tool";
export const manifest: ToolManifest = {
  id: "arrow-function-converter",
  name: "Arrow Function Converter",
  description: "Convert between function declarations and arrow functions. Bidirectional, instant, 100% client-side.",
  category: "developer",
  keywords: ["arrow function", "function converter", "javascript", "es6", "refactor"],
  icon: "ArrowRight",
  requiresNetwork: false,
  seo: { title: "Arrow Function Converter — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Converts JavaScript function declarations to arrow function expressions and vice versa." },
      { q: "Is the conversion perfect?", a: "It handles most common patterns. Complex cases with `this` binding differences may need manual review." },
      { q: "Is my code sent to a server?", a: "No. All conversion runs 100% in your browser." },
    ],
  },
  status: "done",
};
