import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "password-generator",
  name: "Password Generator",
  description:
    "Generate strong, cryptographically-secure passwords with custom length, character sets, and exclusions. Uses crypto.getRandomValues — 100% private.",
  category: "network-security",
  keywords: [
    "password",
    "generator",
    "strong password",
    "random password",
    "secure password",
    "password strength",
    "crypto",
    "web crypto",
  ],
  icon: "key",
  requiresNetwork: false,
  seo: {
    title: "Password Generator — Strong, Secure, Private | UnQTools",
    faq: [
      {
        q: "Are these passwords truly random?",
        a: "Yes. We use the browser's native crypto.getRandomValues API, which is a cryptographically secure pseudo-random number generator (CSPRNG). This is the same API used by banks and crypto wallets. We never use Math.random() for passwords.",
      },
      {
        q: "How long should my password be?",
        a: "For modern security, we recommend at least 16 characters for general accounts and 20+ characters for sensitive accounts (email, banking, password manager master password). Length matters more than complexity — a 20-char lowercase password is stronger than a 12-char mixed password.",
      },
      {
        q: "Can I exclude ambiguous characters?",
        a: "Yes. Enable 'Exclude ambiguous' to remove characters that look similar (0/O, 1/l/I, etc). This is useful when passwords need to be typed manually or read over the phone.",
      },
      {
        q: "Is my generated password sent anywhere?",
        a: "No. The password is generated entirely in your browser using local cryptographic primitives. It never leaves your device, is never logged, and is never sent to any server. You can verify this by disconnecting your internet — the tool still works.",
      },
    ],
  },
  status: "done",
};
