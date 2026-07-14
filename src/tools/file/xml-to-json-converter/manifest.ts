import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "xml-to-json-converter",
  name: "XML to JSON Converter",
  description:
    "Convert XML to JSON with attribute handling, namespace support, array detection, CDATA preservation, pretty-print, custom attribute prefix and text key. Includes reverse JSON→XML, drag-drop, validation, and history. 100% client-side.",
  category: "file",
  keywords: [
    "xml to json", "xml parser", "convert xml", "json from xml",
    "attributes", "namespace", "cdata", "array detection", "pretty print",
    "xml converter", "xml json", "dom parser",
  ],
  icon: "braces",
  requiresNetwork: false,
  seo: {
    title: "XML to JSON Converter — Namespace-aware with Array Detection | UnQTools",
    faq: [
      { q: "How does XML-to-JSON conversion work?", a: "Each XML element becomes a JSON object property, each attribute becomes a prefixed key (e.g. id=\"1\" → \"@id\": \"1\"), and text content is captured under a configurable #text key. Repeated child elements with the same name are automatically detected and collapsed into JSON arrays." },
      { q: "How are XML namespaces handled?", a: "By default, namespaces are stripped (e.g. <ns:foo> → \"foo\"). You can toggle namespace preservation, in which case the prefix is kept on the element/attribute name (e.g. \"ns:foo\"). xmlns declarations can optionally be preserved as regular attributes." },
      { q: "How are arrays detected?", a: "When two or more child elements share the same tag name, they are grouped into a JSON array. A single child stays a single object. This mirrors how most production XML→JSON libraries (fast-xml-parser, xml2js) behave." },
      { q: "What extra features does this tool have?", a: "10 extras: (1) Drag-drop XML file. (2) Paste XML text. (3) Live XML validation. (4) Copy/download JSON output. (5) Reverse JSON→XML conversion. (6) Custom attribute prefix (default @). (7) Custom text key (default #text). (8) Collapse empty elements (omit / null / empty string). (9) Trim whitespace option. (10) History (localStorage — last 10 conversions)." },
      { q: "Is my XML data uploaded anywhere?", a: "No. All parsing happens in your browser using pure JavaScript. Your data never leaves your device." },
      { q: "What's the maximum input size?", a: "There's no hard limit, but very large XML (> 10MB) may slow the browser. A depth limit (default 100) prevents stack overflow on deeply nested input." },
    ],
  },
  status: "done",
};
