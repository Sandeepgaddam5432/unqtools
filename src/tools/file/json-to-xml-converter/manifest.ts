import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "json-to-xml-converter",
  name: "JSON to XML Converter",
  description:
    "Convert JSON to XML with custom root element, attribute handling (@attr keys), array item naming, CDATA wrapping, pretty-print, namespaces, and reverse XML→JSON. 100% client-side.",
  category: "file",
  keywords: [
    "json to xml", "xml converter", "json xml", "convert json",
    "xml from json", "attributes", "cdata", "namespace", "pretty print",
    "xml to json", "reverse", "json to xml converter",
  ],
  icon: "braces",
  requiresNetwork: false,
  seo: {
    title: "JSON to XML Converter — Bi-directional with Attributes & CDATA | UnQTools",
    faq: [
      { q: "How does JSON-to-XML conversion work?", a: "Each JSON object becomes an XML element, each property becomes a child element, and each array becomes a series of repeated elements. Special keys prefixed with @ become attributes (e.g. {\"@id\": 1} → <root id=\"1\">). The #text key sets an element's text content." },
      { q: "How are arrays handled?", a: "Arrays become repeated sibling elements with a configurable item name. For example, {\"items\": [1,2,3]} with arrayItemName=\"item\" becomes <items><item>1</item><item>2</item><item>3</item></items>." },
      { q: "Can I convert XML back to JSON?", a: "Yes. The tool includes a reverse converter (XML → JSON) that turns attributes back into @-prefixed keys and reconstructs arrays from repeated elements. Round-trip fidelity is high for JSON-first data." },
      { q: "What extra features does this tool have?", a: "10 extras: (1) XML validation (well-formedness check). (2) Copy output. (3) Download .xml file. (4) Reverse conversion (XML→JSON). (5) Custom namespace declaration on root. (6) Configurable attribute prefix (default @). (7) Configurable array item element name. (8) Depth limit (prevents runaway recursion). (9) History (localStorage — last 10 conversions). (10) Type info annotation (xsi:type-style hints) for primitives." },
      { q: "Is my JSON data uploaded anywhere?", a: "No. All conversion happens in your browser using pure JavaScript. Your data never leaves your device." },
      { q: "What's the maximum input size?", a: "There's no hard limit, but very large JSON (> 10MB) may slow the browser. A depth limit (default 100) prevents stack overflow on deeply nested input." },
    ],
  },
  status: "done",
};
