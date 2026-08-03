import type { ToolManifest } from "../../../lib/tool";
export const manifest: ToolManifest = {
  id: "pdf-redact-pattern-tool",
  name: "Auto-Redact by Pattern (Regex PII)",
  description: "Find and redact PII patterns (emails, phones, SSNs) in PDF text. Uses pdf-lib, 100% client-side.",
  category: "pdf",
  keywords: ["auto-redact-by-pattern-(regex-pii)", "pdf", "offline", "browser"],
  icon: "EyeOff",
  requiresNetwork: false,
  seo: { title: "Auto-Redact by Pattern (Regex PII) — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Find and redact PII patterns (emails, phones, SSNs) in PDF text" },
      { q: "Is my data sent to a server?", a: "No. All processing uses pdf-lib and runs 100% in your browser." },
      { q: "Does it work offline?", a: "Yes — install as a PWA and use without network." },
    ],
  },
  status: "done",
};
