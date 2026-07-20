/**
 * Email Address Generator & Validator — Tool Manifest.
 * Tool #296 — Category 4 (Developer & Code).
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "email-address-generator-validator",
  name: "Email Address Generator & Validator",
  description:
    "Generate valid-format test email addresses (random or name-based, custom domain) and validate any address in layers — RFC 5322 syntax, domain/TLD sanity, disposable-provider detection, typo suggestion (gmial→gmail), and role-address flag. Batch support, pure JS, 100% client-side.",
  category: "developer",
  keywords: [
    "email", "email validator", "email generator",
    "rfc 5322", "disposable email", "fake email",
    "email syntax", "email checker", "email typo",
    "role address", "mx lookup", "mail",
  ],
  icon: "mail",
  requiresNetwork: false,
  seo: {
    title: "Email Address Generator & Validator — RFC 5322 + Disposable + Typo | UnQTools",
    faq: [
      {
        q: "How does the email validator work?",
        a: "We check every address in layers: (1) RFC 5322 simplified syntax — local-part and domain structure, plus-addressing, quoted local parts, length limits; (2) domain/TLD sanity — well-formed labels and a valid TLD; (3) disposable-provider detection against a bundled list of 100+ throwaway domains; (4) typo suggestion (gmial.com → gmail.com); (5) role-address flag (info@, admin@, billing@). All checks run locally — your addresses never leave the browser.",
      },
      {
        q: "Can I generate test email addresses for sandbox use?",
        a: "Yes. Generate either random-format addresses (random local-parts at a real provider domain) or name-based addresses from first/last name parts using common formats: first.last@, flast@, firstl@, last.first@. You can also supply a custom domain. These addresses are structurally valid RFC 5322 — they are not assigned to real inboxes. Never use them to send real mail or sign up for services you don't control.",
      },
      {
        q: "What disposable providers does the tool detect?",
        a: "The bundled list covers 100+ known throwaway providers including Mailinator, 10minutemail, Guerrillamail, TempMail, Yopmail, Getairmail, Sharklasers, Trashmail, Dispostable, Mailnesia, and many more. The list is bundled in the page — no network call is made. Detection is offline, instant, and private.",
      },
      {
        q: "Are my email addresses uploaded to a server?",
        a: "Never. Every syntax check, disposable lookup, typo suggestion, and generation step runs 100% client-side. There is no MX-record lookup (the blueprint's optional DoH MX check is intentionally omitted to keep the tool fully offline). The history feature stores only operation metadata (counts + timestamps) in localStorage on this device — never the email addresses themselves.",
      },
      {
        q: "What extra features does this tool have versus other email tools?",
        a: "(1) RFC 5322 simplified syntax validation with quoted-local-part support. (2) Plus-addressing aware (user+tag@domain). (3) Bundled 100+ disposable-domain list, fully offline. (4) Common-provider typo detection (gmial, hotnail, yaho, etc.). (5) Role-address flag (info@, admin@, billing@, etc.). (6) Random and name-based generation. (7) Custom-domain support. (8) Batch validate up to 10k rows. (9) Batch generate up to 1k addresses per click. (10) Privacy masking. (11) CSV export of batch results. (12) Canonical RFC test vectors. (13) localStorage history (max 20, no addresses stored). (14) Shareable URL with mode + count + domain encoded.",
      },
    ],
  },
  status: "done",
};
