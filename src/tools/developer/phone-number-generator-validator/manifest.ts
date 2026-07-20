/**
 * Phone Number Generator & Validator — Tool Manifest.
 * Tool #295 — Category 4 (Developer & Code).
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "phone-number-generator-validator",
  name: "Phone Number Generator & Validator",
  description:
    "Generate valid-format test phone numbers for 30+ countries and validate, parse, and format any number across E.164, international, national, and RFC 3966 (tel:) forms. Detects country, type (mobile/fixed/toll-free), and structural validity — pure JS, 100% client-side, no network.",
  category: "developer",
  keywords: [
    "phone number", "phone generator", "phone validator",
    "e.164", "e164", "tel uri", "rfc 3966",
    "libphonenumber", "phone format", "fake phone number",
    "national number", "calling code",
  ],
  icon: "phone",
  requiresNetwork: false,
  seo: {
    title: "Phone Number Generator & Validator — E.164 + 30+ Countries | UnQTools",
    faq: [
      {
        q: "How does the phone number validator work?",
        a: "We normalize your input (strip spaces, dashes, parentheses, dots), detect the country from the leading +<calling-code> or a default country you pick, then check the national significant number (NSN) length and prefix against a bundled 30+ country registry. We distinguish 'possible' (right length) from 'valid' (matches known prefix rules) just like Google libphonenumber's isPossible / isValid split — but the entire check runs in your browser with zero network calls.",
      },
      {
        q: "Which countries does the generator support?",
        a: "The bundled registry covers 30+ countries including the US/Canada (NANP), UK, France, Germany, Italy, Spain, Netherlands, Australia, Japan, China, India, Brazil, Mexico, Russia, South Africa, Saudi Arabia, UAE, Sweden, Norway, Denmark, Finland, Poland, Turkey, South Korea, Singapore, New Zealand, Ireland, Portugal, Greece, Belgium, Austria, Switzerland, and more — each with calling code, NSN length, and mobile/fixed/toll-free prefix patterns.",
      },
      {
        q: "Can I generate test phone numbers for sandbox use?",
        a: "Yes. Pick a country and a number type (mobile, fixed, or toll-free) and we generate a structurally-valid number with the correct calling code, NSN length, and prefix. These numbers are sandbox/test only — they match the country's numbering plan but are not assigned to real subscribers. Never use them for real calls, SMS, or 2FA.",
      },
      {
        q: "Are my phone numbers uploaded to a server?",
        a: "Never. Every normalization, validation, formatting, and generation step runs 100% client-side in your browser. There is no server endpoint, no analytics on the input field, and no logging of phone data. The history feature stores only operation metadata (counts + timestamps) in localStorage on this device — never the phone numbers themselves.",
      },
      {
        q: "What extra features does this tool have versus other phone tools?",
        a: "(1) 30+ country numbering-plan registry with calling codes + NSN lengths. (2) Multi-format normalization (E.164, international, national, RFC 3966 tel: URI). (3) Country auto-detect from +prefix. (4) Number-type detection (mobile / fixed / toll-free / VoIP). (5) Batch validate up to 10k rows. (6) Batch generate up to 1k numbers per click. (7) Typo-tolerant input parser (spaces, dashes, parentheses, dots). (8) Privacy masking. (9) CSV export of batch results. (10) Canonical test vectors. (11) localStorage history (max 20, no numbers stored). (12) Shareable URL with country + count + format encoded.",
      },
    ],
  },
  status: "done",
};
