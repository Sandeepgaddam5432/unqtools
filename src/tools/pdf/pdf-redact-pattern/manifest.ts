import type { ToolManifest } from "../../../lib/tool";
export const manifest: ToolManifest = {
  id: "pdf-redact-pattern",
  name: "Auto-Redact by Pattern (Regex PII)",
  description: "Regex-based PII detection and black-box redaction in PDFs. Uses pdf-lib, 100% client-side.",
  category: "pdf",
  keywords: ["auto-redact-by-pattern-(regex-pii)", "pdf", "offline", "browser"],
  icon: "EyeOff",
  requiresNetwork: false,
  seo: { title: "Auto-Redact by Pattern (Regex PII) — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Regex-based PII detection and black-box redaction in PDFs" },
      { q: "Is my data sent to a server?", a: "No. All processing uses pdf-lib and runs 100% in your browser." },
      { q: "Does it work offline?", a: "Yes — install as a PWA and use without network." },
    ],
  },
  status: "done",
};
