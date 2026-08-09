/**
 * Email Validator — Tool Manifest
 * Validate email addresses with a standards-aware parser, entirely offline.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "email-validator",
  name: "Email Validator",
  description:
    "Validate single email addresses or a whole list. Checks format, syntax, length limits, and top-level domain against the real IANA TLD list, with clear per-error explanations. Batch mode + CSV export. 100% private.",
  category: "developer",
  keywords: [
    "email validator",
    "validate email",
    "email checker",
    "email regex",
    "batch email validation",
    "email syntax",
    "email format check",
    "disposable email",
  ],
  icon: "Mail",
  requiresNetwork: false,
  seo: {
    title: "Email Validator — Syntax, Format & TLD Checker (Batch) | UnQTools",
    faq: [
      {
        q: "Does this actually send an email?",
        a: "No. It performs a fully local, standards-aware syntax check. It never sends network requests, so you can validate a list privately.",
      },
      {
        q: "What does it check?",
        a: "Valid characters and structure (local@domain), allowed special characters in the local part, length limits (max 64 local / 255 total), domain format, and the TLD against the real IANA list (e.g. .com, .org, .in, .dev).",
      },
      {
        q: "What extras does it have?",
        a: "Extras: (1) Single + batch modes; (2) Per-email pass/fail with reason; (3) IANA TLD check; (4) Length and character rules; (5) Summary counts; (6) Copy results; (7) CSV export; (8) 100% offline.",
      },
    ],
  },
  status: "done",
};
