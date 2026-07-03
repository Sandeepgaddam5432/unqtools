import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "caesar-cipher",
  name: "Caesar Cipher",
  description:
    "Encrypt/decrypt with the Caesar shift cipher — any shift 1-25, ROT13 preset, brute-force solver showing all 25 candidates, and frequency-analysis auto-crack. 100% private.",
  category: "text",
  keywords: [
    "caesar cipher",
    "rot13",
    "shift cipher",
    "brute force",
    "frequency analysis",
    "decrypt",
  ],
  icon: "hash",
  requiresNetwork: false,
  seo: {
    title: "Caesar Cipher — encrypt, decrypt, brute-force solver | UnQTools",
    faq: [
      {
        q: "Is the Caesar cipher secure?",
        a: "No. The Caesar cipher is a classical cipher from antiquity — it has only 25 possible keys and is trivially broken by frequency analysis. Never use it for real security. It's included here for education and puzzle-solving.",
      },
      {
        q: "How does the brute-force solver work?",
        a: "It tries all 25 possible shifts, computes a chi-squared statistic comparing the letter frequencies of each candidate plaintext to English, and ranks them. The lowest chi-squared score is the most likely correct decryption.",
      },
    ],
  },
  status: "done",
};
