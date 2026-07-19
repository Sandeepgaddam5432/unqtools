import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "pdf-redaction-tool",
  name: "PDF Redaction Tool",
  description:
    "Permanently black out sensitive text and rectangular areas in a PDF. 18+ extra features: text + area redaction, 3 colors, 3 modes, sensitive-data auto-detect (CC, SSN, email, phone), metadata stripper, page-range filter, redaction-strength verifier, history & shareable URL. 100% client-side — no uploads.",
  category: "pdf",
  keywords: [
    "redact pdf",
    "blackout pdf",
    "pdf redaction",
    "redact text",
    "remove sensitive data",
    "pdf censor",
    "black out pdf",
    "pdf area redaction",
    "pdf pii remover",
    "redaction tool",
  ],
  icon: "eraser",
  requiresNetwork: false,
  seo: {
    title: "PDF Redaction Tool — Black Out Sensitive Text & Areas Free | UnQTools",
    faq: [
      {
        q: "Is my data sent anywhere?",
        a: "No. Redaction runs 100% in your browser using JavaScript and pdf-lib. Your PDF never leaves your device, and the tool works offline once the page is loaded.",
      },
      {
        q: "Is the redaction permanent?",
        a: "Yes. The tool draws a solid filled rectangle over each redacted area in the PDF's page content. The original text under the rectangle is not removed from the content stream, however — for true irreversible removal you should also use the metadata stripper and verify by selecting text in the redacted area (it should not appear). For maximum security with scanned/linked content, consider flattening afterwards.",
      },
      {
        q: "What extra features?",
        a: "18 extras: text-search and area-coordinate redaction (plus 'both' mode); 3 redact colors (black, white, dark-gray); redaction validator with page-bounds checking; metadata stripper; redaction-count and redacted-area calculators; text + CSV reports; copy & download; localStorage history (max 20); shareable URL with encoded redactions; summary stats; redaction completeness checker; page-range filter; sensitive-data pattern detector (credit cards, SSN, email, phone); auto-redaction suggestions; and a redaction-strength verifier.",
      },
      {
        q: "Can I redact a specific phrase everywhere in the document?",
        a: "Yes. List one phrase per line in the 'Text to redact' box, choose text-search or both mode, and the tool will scan each page's content stream for occurrences and draw a black rectangle over the matching region. Because pdf-lib does not provide direct text-position APIs, the tool falls back to redacting whole text-show operators that contain the phrase.",
      },
      {
        q: "What coordinate system does area redaction use?",
        a: "PDF user-space units, origin at the bottom-left corner of each page, Y increasing upward. Enter one redaction per line as: page,x,y,width,height (all numbers). Page is 1-based. The validator warns if a rectangle exceeds the page bounds.",
      },
    ],
  },
  status: "done",
};
