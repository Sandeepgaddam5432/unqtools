/**
 * SSH Key Fingerprint Explorer — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ssh-key-fingerprint-explorer",
  name: "SSH Key Fingerprint Explorer",
  description:
    "Parse SSH public keys (RSA, ED25519, ECDSA), compute MD5/SHA256 fingerprints, extract metadata, validate format, and 10+ extras. 100% private.",
  category: "network-security",
  keywords: ["ssh key", "fingerprint", "rsa", "ed25519", "ecdsa", "ssh-rsa", "ssh-ed25519", "public key"],
  icon: "key",
  requiresNetwork: false,
  seo: {
    title: "SSH Key Fingerprint Explorer — MD5 + SHA256 + Parse | UnQTools",
    faq: [
      { q: "What's an SSH key fingerprint?", a: "A short hash of an SSH public key used for verification. MD5 fingerprints look like 'a1:b2:c3:...'. SHA256 fingerprints look like 'SHA256:base64string'. Modern OpenSSH shows SHA256 by default." },
      { q: "What extras does this tool have?", a: "Extras: (1) Parse ssh-rsa, ssh-ed25519, ssh-ecdsa keys, (2) Compute MD5 fingerprint (colon-separated hex), (3) Compute SHA256 fingerprint (base64), (4) Compute SHA512 fingerprint, (5) Extract key length (bits), (6) Extract key comment, (7) Validate format, (8) Show base64-decoded raw bytes hex, (9) Randomart visualization (ASCII art), (10) Show key type + bit count, (11) Compare two keys, (12) Batch mode (multiple keys), (13) Copy individual fingerprints, (14) Generate authorized_keys entry." },
    ],
  },
  status: "done",
};
