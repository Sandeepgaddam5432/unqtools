/**
 * XML Formatter — Tool Manifest
 * Format, minify, and validate XML entirely in the browser.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "xml-formatter",
  name: "XML Formatter",
  description:
    "Format, beautify, minify, and validate XML in your browser. Pretty-print with adjustable indentation, collapse to compact form, and validate well-formedness with line/column error reports. 100% private.",
  category: "developer",
  keywords: [
    "xml formatter",
    "xml beautifier",
    "format xml",
    "minify xml",
    "pretty print xml",
    "xml validator",
    "well-formed xml",
    "indent xml",
  ],
  icon: "Code2",
  requiresNetwork: false,
  seo: {
    title: "XML Formatter & Beautifier — Pretty-Print, Minify, Validate | UnQTools",
    faq: [
      {
        q: "Does this tool send my XML anywhere?",
        a: "No. Formatting, minification, and validation all happen locally in your browser. Nothing is uploaded, tracked, or stored.",
      },
      {
        q: "What does it validate?",
        a: "It checks well-formedness — balanced tags, proper nesting, valid attribute quoting, and single root element — reporting the line and column of any error.",
      },
      {
        q: "What extras does it have?",
        a: "Extras: (1) Pretty-print with 2/4/8/tab indent; (2) Minify to one line; (3) Validate with line/column errors; (4) Copy/Download; (5) Character/line/byte counts; (6) Handles comments, CDATA, and processing instructions; (7) Large-input aware (works on sizable docs); (8) 100% offline.",
      },
    ],
  },
  status: "done",
};
