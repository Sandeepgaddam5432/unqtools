import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "pdf-accessibility-checker",
  name: "PDF Accessibility Checker",
  description:
    "Check PDF accessibility compliance against WCAG 2.1 AA/AAA, PDF/UA-1, and Section 508. " +
    "Runs 10+ checks (document title, language, structure tree, image alt text, form labels, " +
    "reading order, color contrast, bookmarks, tab order, metadata), computes a compliance " +
    "percentage, lists critical must-fix issues, and generates best-practice recommendations. " +
    "Multi-format reports (text/HTML/CSV/JSON), history, shareable URL, and 100% client-side.",
  category: "pdf",
  keywords: [
    "pdf accessibility",
    "wcag checker",
    "pdf ua",
    "section 508",
    "pdf compliance",
    "accessibility audit",
    "tagged pdf",
    "alt text checker",
  ],
  icon: "accessibility",
  requiresNetwork: false,
  seo: {
    title: "PDF Accessibility Checker — WCAG, PDF/UA & Section 508 | UnQTools",
    faq: [
      {
        q: "What does the PDF Accessibility Checker do?",
        a: "It loads your PDF in the browser using pdf-lib and runs 10+ accessibility checks across the document catalog and each page's resources: document title, language, structure tree (PDF/UA), image alt text, form field labels, reading order, color contrast, bookmarks, tab order, and metadata. It then compares the results against WCAG 2.1 AA, WCAG 2.1 AAA, PDF/UA-1, and Section 508, computing a compliance percentage for each standard, a list of critical must-fix issues, and best-practice recommendations.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Page-range parser (reuse shared module). (2) 5 accessibility standards (WCAG 2.1 AA, WCAG 2.1 AAA, PDF/UA-1, Section 508, all). (3) 3 check levels (errors-only, errors-and-warnings, full). (4) 10+ accessibility checks (title, language, tags, alt text, form labels, reading order, color contrast, bookmarks, tab order, metadata). (5) Color contrast analyzer (WCAG ratio). (6) Compliance level calculator (% passed per standard). (7) Standard comparator (which standard most/least met). (8) Multi-format renderers (text/HTML/CSV/JSON). (9) Copy + Download. (10) History (localStorage, last 20). (11) Shareable URL. (12) Summary stats (total checks, passed, failed, warnings, compliance %). (13) Critical issue list (must-fix before publish). (14) Recommendation generator (best-practice suggestions). (15) Page-by-page issue count. (16) Severity tagging (error/warning/info). (17) Category grouping. (18) WCAG success-criteria mapping.",
      },
      {
        q: "How does the color contrast check work?",
        a: "The checker scans each page's content stream for fill-color operators (rg, k, g, sc, scn) and text-showing operators (Tj, TJ, ', \"). When it can pair a fill color with adjacent text, it computes the WCAG contrast ratio between the text color and the nearest background fill. Ratios below 4.5:1 are flagged as errors for AA compliance; ratios below 7:1 are flagged as warnings for AAA compliance. The check is heuristic — it cannot follow z-order, transparency, or inherited colors — so results should be treated as a triage list, not a substitute for a screen-reader test.",
      },
      {
        q: "What's the difference between 'errors-only', 'errors-and-warnings', and 'full' levels?",
        a: "'errors-only' shows only failures that block compliance (missing title, missing language, untagged PDF, missing alt text on informative images, contrast below 4.5:1). 'errors-and-warnings' adds warnings about issues that may not block compliance but reduce usability (low-contrast text passing AA but failing AAA, missing bookmarks in long documents, missing form-field tooltips). 'full' adds informational notes and best-practice recommendations.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All accessibility checks run 100% in your browser using JavaScript and pdf-lib. Your PDF never leaves your device, and the tool works offline. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};
