import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "pdf-header-footer-adder",
  name: "PDF Header & Footer Adder",
  description:
    "Add custom headers and footers to PDF pages — page numbers, document title, dates, or any text. " +
    "Variables ({page}, {total}, {title}, {date}, {author}, {filename}), 3 positions (left/center/right), " +
    "first-page-different, page-range filtering, multi-format reports, history, shareable URL. " +
    "17 extra features. 100% client-side — your PDF never leaves your browser.",
  category: "pdf",
  keywords: [
    "pdf header",
    "pdf footer",
    "add header to pdf",
    "add footer to pdf",
    "page numbers",
    "pdf stamper",
    "pdf banner",
    "pdf title",
    "pdf date stamp",
    "header footer adder",
  ],
  icon: "panel-top",
  requiresNetwork: false,
  seo: {
    title: "Add Header & Footer to PDF — Page Numbers, Title, Date | UnQTools",
    faq: [
      {
        q: "How does the PDF Header & Footer Adder work?",
        a: "Load a PDF, type your header/footer text, and choose positions (left/center/right), font size, color, and margins. The tool draws the text on each page using pdf-lib, substituting variables like {page}, {total}, {title}, {date}, {author}, and {filename} with their actual values. The modified PDF is saved and downloaded — 100% in your browser.",
      },
      {
        q: "What variables can I use in the header or footer text?",
        a: "Six variables: {page} (current page number), {total} (total page count), {title} (PDF Title metadata), {date} (today's date in your chosen format), {author} (PDF Author metadata), and {filename} (original file name without extension). The tool warns you if a variable requires metadata that's missing from the PDF.",
      },
      {
        q: "Can I use different header/footer text on the first page?",
        a: "Yes. Toggle 'First page different' and provide separate first-page header and footer text. This is useful for cover pages where you don't want a page number, or where you want a different title.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Page-range parser ('all' or '1-3, 5, 8-'). (2) Variable substitutor ({page}/{total}/{title}/{date}/{author}/{filename}). (3) 3 position presets (left/center/right) for header and footer independently. (4) Font size validator (6–72 pt). (5) Hex color parser. (6) Margin calculator. (7) Page number formatter (3 formats: '1', '1 of 10', 'Page 1 of 10'). (8) Date formatter (3 formats: YYYY-MM-DD, MM/DD/YYYY, DD/MM/YYYY). (9) First-page-different handler. (10) Text + CSV renderers. (11) Copy + Download. (12) History (localStorage, last 20). (13) Shareable URL. (14) Summary stats (pages with/without header/footer, by position). (15) Variable availability checker. (16) Header/footer collision detector. (17) Page count validator. Multi-line header/footer support included.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All PDF processing runs 100% in your browser using JavaScript and pdf-lib. Your PDF never leaves your device, and the tool works offline. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};
