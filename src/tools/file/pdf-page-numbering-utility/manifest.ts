import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "pdf-page-numbering-utility",
  name: "PDF Page Numbering Utility",
  description:
    "Add page numbers to PDF files in the browser — pure JavaScript via pdf-lib. Choose from 9 positions (top/bottom × left/center/right), 5 number formats (arabic, roman-lower, roman-upper, alpha-lower, alpha-upper, or custom '{page}/{total}'), custom start number, skip first N pages, font size, color, and margin. 100% client-side.",
  category: "file",
  keywords: [
    "pdf page numbers", "pdf numbering", "add page numbers to pdf",
    "pdf pagination", "pdf footer", "pdf header",
    "roman numerals pdf", "pdf page counter",
    "pdf-page-numbering-utility", "pdf-bates",
  ],
  icon: "file-text",
  requiresNetwork: false,
  seo: {
    title: "PDF Page Numbering Utility — Add Page Numbers to PDF in Browser | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Adds page numbers to any PDF file in your browser using pdf-lib. You choose from 9 positions (top-left, top-center, top-right, middle-left, middle-center, middle-right, bottom-left, bottom-center, bottom-right — though typically you want top or bottom), 5 number formats (arabic 1,2,3 / roman-lower i,ii,iii / roman-upper I,II,III / alpha-lower a,b,c / alpha-upper A,B,C / custom like 'Page 1 of 10' using {page} and {total} placeholders), a custom start number, the ability to skip the first N pages, font size, hex color, and margin. The output is a fresh PDF ready to download." },
      { q: "What is the difference between arabic and roman page numbers?", a: "Arabic numerals are the standard 1, 2, 3, 4, 5. Roman numerals are i, ii, iii, iv, v (lowercase) or I, II, III, IV, V (uppercase) — commonly used for front-matter pages (preface, table of contents) in books. Alpha numerals are a, b, c, d (lowercase) or A, B, C, D (uppercase) — used for very short documents or appendices. The custom format lets you write any template like 'Page 1 of 10' using {page} and {total} placeholders." },
      { q: "Can I skip the cover page or first few pages?", a: "Yes — set 'Skip first N pages' to a number (e.g. 1 for the cover, 2 for cover + title page). Skipped pages will not get a page number; the page count continues normally on subsequent pages (so page 2 in the file becomes page 1 in the numbering, unless you also set a custom start number)." },
      { q: "How does the {page}/{total} custom format work?", a: "Use {page} as a placeholder for the current page number (after applying start offset and skip) and {total} as a placeholder for the total number of numbered pages. Examples: 'Page {page} of {total}' → 'Page 1 of 10', '{page}/{total}' → '1/10', '- {page} -' → '- 1 -'. The placeholders are case-sensitive." },
      { q: "What extra features does this tool have compared to others?", a: "10 extras: (1) Drag-drop file input. (2) 9 page-number positions (top/middle/bottom × left/center/right). (3) 5 number formats — arabic, roman-lower, roman-upper, alpha-lower, alpha-upper, plus a custom template option. (4) Custom start number (e.g. start at 5 instead of 1). (5) Skip first N pages. (6) Adjustable font size (6pt-72pt). (7) Custom hex color picker. (8) Adjustable margin (px). (9) History of recently numbered PDFs (localStorage — last 10). (10) Shareable URL with all options encoded in the hash." },
      { q: "Is my PDF uploaded anywhere?", a: "No. All PDF parsing and page-number rendering happens in your browser using pdf-lib (a pure-JS PDF library). The PDF binary is processed locally — file contents never leave your device. Only file summaries (filename, page count, format used) are saved to local history." },
      { q: "Can I number pages in a password-protected PDF?", a: "No — pdf-lib cannot open encrypted PDFs without the password. If your PDF is password-protected, remove the password first using a desktop tool (qpdf, Adobe Acrobat), then upload the unprotected file." },
    ],
  },
  status: "done",
};
