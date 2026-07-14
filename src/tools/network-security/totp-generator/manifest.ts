import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "totp-generator",
  name: "TOTP & HOTP Generator",
  description:
    "Generate RFC 6238 TOTP, RFC 4226 HOTP, and Steam Guard codes. Multi-account management, QR otpauth URI, backup codes, time-skew warning, next-N codes preview, and code history. 100% private, works offline.",
  category: "network-security",
  keywords: [
    "totp", "hotp", "2fa", "mfa", "one-time password", "authenticator",
    "google authenticator", "rfc 6238", "rfc 4226", "steam guard", "base32",
    "otpauth", "qr code",
  ],
  icon: "key-round",
  requiresNetwork: false,
  seo: {
    title: "TOTP & HOTP Generator — 2FA, Steam Guard, Multi-Account | UnQTools",
    faq: [
      {
        q: "What is TOTP and how does it differ from HOTP?",
        a: "TOTP (RFC 6238) generates time-based codes that change every 30 seconds, synchronized via the current time. HOTP (RFC 4226) is counter-based — each new code increments a counter, so it's event-driven rather than time-driven. TOTP is more common (Google Authenticator, Authy). HOTP is used when devices may not have synced clocks.",
      },
      {
        q: "What code types does this tool support?",
        a: "Three types: (1) TOTP — standard time-based 6 or 8-digit codes (RFC 6238). (2) HOTP — counter-based codes (RFC 4226), useful for offline scenarios. (3) Steam Guard — 5-character alphanumeric codes using Steam's custom alphabet (no ambiguous chars like 0/O, 1/I). All use HMAC-SHA1/SHA256/SHA512 via WebCrypto.",
      },
      {
        q: "Can I manage multiple accounts?",
        a: "Yes — add unlimited accounts with issuer, account name, secret, and type (TOTP/HOTP/Steam). Accounts are stored in localStorage on your device only. Generate codes for all accounts at once, with a live countdown showing seconds until each refreshes. Export/import accounts as JSON for backup (contains secrets — store securely).",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "Beyond standard TOTP/HOTP generation, we ship: (1) Multi-account management (localStorage, add/remove, export/import). (2) HOTP mode (counter-based, RFC 4226). (3) Steam Guard codes (custom alphabet). (4) Backup code generator (8 codes, XXXX-XXXX format). (5) Time-skew warning — detects if device clock drifts >5s. (6) QR otpauth URI builder for scanning into mobile apps. (7) otpauth:// URI parser — paste a URI from a QR code to extract secret/issuer/account. (8) Next N codes preview — see future codes for the next N time windows. (9) Secret strength check — verify secret is at least 160 bits. (10) Code history (last 50 codes, localStorage) + algorithm reference table.",
      },
      {
        q: "How do I get my secret?",
        a: "When you enable 2FA on a website, they show a QR code containing an otpauth:// URL. You can either: (1) scan the QR with your phone's authenticator app, or (2) copy the secret (base32 string like JBSWY3DPEHPK3PXP) and paste it here. Some sites also let you paste an otpauth:// URI directly — use the parser to extract the secret automatically.",
      },
      {
        q: "Is my secret sent anywhere?",
        a: "No. All TOTP/HOTP/Steam code generation is done entirely in your browser using WebCrypto (HMAC-SHA1/256/512). Your secret never leaves your device, is never logged, and is never transmitted. Account data is stored in localStorage on your device only. You can verify this by disconnecting your internet — codes still refresh.",
      },
    ],
  },
  status: "done",
};
