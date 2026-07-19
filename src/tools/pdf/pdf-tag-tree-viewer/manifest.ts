import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "pdf-tag-tree-viewer",
  name: "PDF Tag Tree Viewer",
  description:
    "Inspect the structure tree of a tagged PDF (PDF/UA). Walks the StructTreeRoot " +
    "recursively, extracts every structure element (Document, Part, Section, H1–H6, " +
    "P, List, Table, Figure, Link, …) with its attributes (Role, Alt, Lang, BBox), and " +
    "renders the result as a tree, flat list, by-page, or by-type view. Validates " +
    "heading hierarchy, detects missing structure, verifies reading order, and exports " +
    "as text/HTML/JSON/CSV. 100% client-side.",
  category: "pdf",
  keywords: [
    "pdf tag tree",
    "pdf structure",
    "pdf ua",
    "tagged pdf",
    "pdf accessibility",
    "structtreeroot",
    "pdf heading hierarchy",
    "reading order",
  ],
  icon: "network",
  requiresNetwork: false,
  seo: {
    title: "PDF Tag Tree Viewer — Inspect Tagged PDF Structure | UnQTools",
    faq: [
      {
        q: "What does the PDF Tag Tree Viewer do?",
        a: "It loads your PDF in the browser using pdf-lib, locates the document's /StructTreeRoot in the catalog, and recursively walks every structure element (Document, Part, Section, H1–H6, P, L, LI, Table, TR, TH, TD, Figure, Link, and more). Each element is shown with its attributes (Role, Alt, Lang, BBox, ActualText). You can switch between four view modes (tree, flat list, by page, by type) and a fixed-depth expansion. The tool validates heading hierarchy (no H1 → H3 jumps), detects PDFs with no structure tree, and verifies that tags appear in a logical reading order.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Four view modes (tree, flat-list, by-page, by-type). (2) Recursive tag-tree parser. (3) 10+ tag-type presets (Document, Part, Section, H1-H6, P, L, LI, Table, TR, TH, TD, Figure, Link). (4) Tag attribute extractor (Role, Alt, Lang, BBox, ActualText). (5) Multi-format renderers (text/HTML/JSON/CSV). (6) Tree-depth calculator. (7) Tag counter per type. (8) Tag validator (nesting + required attributes). (9) Copy + Download. (10) History (localStorage, last 20). (11) Shareable URL. (12) Summary stats (total tags, by type, max depth, by page). (13) Heading hierarchy checker. (14) Missing-structure detector. (15) Reading-order verifier.",
      },
      {
        q: "What is a 'tagged PDF' and why does the structure tree matter?",
        a: "A tagged PDF contains a /StructTreeRoot entry in its catalog — a hierarchy of structure elements that describe the document's semantic structure (headings, paragraphs, lists, tables, figures, links). Screen readers and other assistive technologies use this tree to navigate the document. PDFs without a structure tree are considered untagged and are largely inaccessible. WCAG 2.1 SC 1.3.1 and PDF/UA-1 both require a proper structure tree.",
      },
      {
        q: "What does the heading hierarchy checker validate?",
        a: "It walks every H1-H6 tag in document order and ensures no heading level is skipped (e.g. an H3 directly under an H1 with no H2 in between). Skipped levels make content harder to navigate with screen readers and violate PDF/UA-1 §5. Jumps of more than one level are reported as warnings.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All tag-tree parsing runs 100% in your browser using JavaScript and pdf-lib. Your PDF never leaves your device, and the tool works offline. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};
