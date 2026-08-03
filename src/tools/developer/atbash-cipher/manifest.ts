import type { ToolManifest } from "../../../lib/tool";
export const manifest: ToolManifest = {
  id: "atbash-cipher",
  name: "Atbash Cipher",
  description: "Encode/decode Atbash cipher (a↔z, b↔y, c↔x). Self-inverse. Preserves case and non-alpha. Grouped output option.",
  category: "developer",
  keywords: ["atbash", "cipher", "substitution cipher", "encode", "decode", "cryptography"],
  icon: "Lock",
  requiresNetwork: false,
  seo: { title: "Atbash Cipher — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What is Atbash?", a: "Atbash is an ancient substitution cipher where a↔z, b↔y, c↔x, etc. It is self-inverse." },
      { q: "Does the same operation encode and decode?", a: "Yes — applying Atbash twice returns the original text." },
      { q: "Is my data sent to a server?", a: "No. All processing is 100% client-side." },
    ],
  },
  status: "done",
};
