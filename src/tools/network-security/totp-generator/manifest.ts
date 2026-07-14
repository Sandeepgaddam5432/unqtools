import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "totp-generator",
  name: "TOTP Generator",
  description:
    "Generate RFC 6238 Time-based One-Time Passwords (TOTP) for 2FA. Enter a base32 secret, choose period and digits, get live codes. 100% private, works offline.",
  category: "network-security",
  keywords: [
    "totp",
    "2fa",
    "mfa",
    "one-time password",
    "authenticator",
    "google authenticator",
    "rfc 6238",
    "hotp",
    "base32",
  ],
  icon: "key-round",
  requiresNetwork: false,
  seo: {
    title: "TOTP Generator — RFC 6238 2FA Codes | UnQTools",
    faq: [
      {
        q: "What is TOTP?",
        a: "Time-based One-Time Password (TOTP) is the algorithm used by Google Authenticator, Authy, and similar 2FA apps. It generates a fresh 6-digit code every 30 seconds from a shared secret and the current time. Defined in RFC 6238.",
      },
      {
        q: "How do I get my secret?",
        a: "When you enable 2FA on a website, they show a QR code containing an otpauth:// URL. The secret is the base32 string inside that URL (e.g. JBSWY3DPEHPK3PXP). You can also usually view it as text — copy it here and click Generate.",
      },
      {
        q: "Why doesn't my code match Google Authenticator?",
        a: "Make sure period (30s default), digits (6 default), and algorithm (SHA1 default) match. Also check that your device clock is accurate — TOTP is time-sensitive. If your clock drifts by more than 30 seconds, codes will not match.",
      },
      {
        q: "Is my secret sent anywhere?",
        a: "No. TOTP generation is done entirely in your browser using Web Crypto (HMAC-SHA1). Your secret never leaves your device, is never logged, and is never transmitted. You can verify this by disconnecting your internet — codes still refresh.",
      },
    ],
  },
  status: "done",
};
