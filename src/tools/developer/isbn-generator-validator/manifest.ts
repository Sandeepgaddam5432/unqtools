/**
 * ISBN Generator & Validator — Tool Manifest.
 * Tool #291 — Category 4 (Developer & Code).
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "isbn-generator-validator",
  name: "ISBN Generator & Validator",
  description:
    "Generate valid test ISBN-10 and ISBN-13 numbers with correct check digits, validate any ISBN with structural reason codes, convert ISBN-10 ↔ ISBN-13 (978/979 handling), parse ISBNs into prefix/group/publisher/title/check components with range-table hyphenation, and bulk-process up to 5k rows. 100% client-side — test ISBNs only, structurally valid but unregistered.",
  category: "developer",
  keywords: [
    "isbn", "isbn generator", "isbn validator", "isbn 10", "isbn 13",
    "isbn check digit", "isbn 10 to 13", "isbn converter", "isbn parser",
    "isbn hyphenation", "book identifier", "isbn barcode",
  ],
  icon: "book-open",
  requiresNetwork: false,
  seo: {
    title: "ISBN Generator & Validator — ISBN-10/13 Check Digit + Convert | UnQTools",
    faq: [
      {
        q: "How does an ISBN check digit work?",
        a: "ISBN-10 uses mod-11: each digit is multiplied by its position (10 down to 1), the sum is divided by 11, and the remainder becomes the check digit — with 'X' representing 10. ISBN-13 uses weighted mod-10: digits alternate between weight 1 and 3, the sum is rounded up to the next multiple of 10, and the difference is the check digit. Both algorithms are computed locally — no network calls.",
      },
      {
        q: "Can this tool convert ISBN-10 to ISBN-13 and back?",
        a: "Yes. To convert ISBN-10 → ISBN-13 we prepend the 978 GS1 prefix, drop the ISBN-10 check digit, and recompute the ISBN-13 check digit. Reverse conversion (ISBN-13 → ISBN-10) only works when the prefix is 978; 979-prefixed ISBN-13s have no ISBN-10 equivalent because they belong to a newer allocation range that did not exist when ISBN-10 was the standard.",
      },
      {
        q: "How does the parser split an ISBN into prefix, group, publisher, title, and check digit?",
        a: "We bundle the ISBN range message table published by the International ISBN Agency. After stripping the 978/979 prefix (ISBN-13 only) and the trailing check digit, we walk the registration group ranges (e.g. 0–5 = English-speaking, 2 = French, 3 = German) to identify the group, then walk the publisher ranges within that group to identify the publisher block. The remaining digits form the title identifier.",
      },
      {
        q: "Are my ISBNs uploaded to a server?",
        a: "Never. Every check-digit computation, validation, conversion, and parse runs 100% client-side in your browser. There is no server endpoint, no analytics on the input field, and no logging of ISBN data. The history feature stores only operation metadata (counts + timestamps) in localStorage on this device — never the ISBNs themselves.",
      },
      {
        q: "What extra features does this tool have versus other ISBN tools?",
        a: "(1) ISBN-10 mod-11 + ISBN-13 weighted mod-10 validate/generate. (2) ISBN-10 ↔ ISBN-13 conversion with 979-prefix edge handling. (3) Bundled ISBN range table for proper hyphenation. (4) Structural parser breaking ISBN into prefix/group/publisher/title/check. (5) Batch validate up to 5k rows. (6) Batch generate up to 1k ISBNs per click. (7) EAN-13 barcode render (text-art). (8) X check-digit handling for ISBN-10. (9) CSV export of batch results. (10) Deterministic seeded PRNG for reproducible test fixtures. (11) Format toggle (hyphenated vs raw). (12) localStorage history (max 20, no ISBNs stored). (13) Shareable URL with format + count + version encoded.",
      },
    ],
  },
  status: "done",
};
