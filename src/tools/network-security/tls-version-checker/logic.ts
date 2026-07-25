/**
 * TLS Version Checker — pure data + lookup logic.
 * Reference for TLS 1.0–1.3 versions, key ciphers, and deprecation status.
 */

export type TLSVersion = "TLS 1.0" | "TLS 1.1" | "TLS 1.2" | "TLS 1.3";

export interface TLSInfo {
  version: TLSVersion;
  rfc: string;
  publishedYear: number;
  deprecated: boolean;
  deprecatedYear: number | null;
  status: "Deprecated" | "Supported (legacy)" | "Recommended";
  keyExchange: string[];
  ciphers: string[];
  notes: string;
}

export const TLS_VERSIONS: TLSInfo[] = [
  {
    version: "TLS 1.0",
    rfc: "RFC 2246",
    publishedYear: 1999,
    deprecated: true,
    deprecatedYear: 2020,
    status: "Deprecated",
    keyExchange: ["RSA", "DH"],
    ciphers: ["RC4", "DES", "3DES", "AES-CBC"],
    notes: "Deprecated by IETF (RFC 8996) in 2020. Vulnerable to BEAST, POODLE. Disable in production.",
  },
  {
    version: "TLS 1.1",
    rfc: "RFC 4346",
    publishedYear: 2006,
    deprecated: true,
    deprecatedYear: 2020,
    status: "Deprecated",
    keyExchange: ["RSA", "DH"],
    ciphers: ["3DES", "AES-CBC"],
    notes: "Deprecated by IETF (RFC 8996) in 2020. Lacks modern AEAD ciphers. Disable.",
  },
  {
    version: "TLS 1.2",
    rfc: "RFC 5246",
    publishedYear: 2008,
    deprecated: false,
    deprecatedYear: null,
    status: "Supported (legacy)",
    keyExchange: ["RSA", "DHE", "ECDHE"],
    ciphers: ["AES-GCM", "AES-CBC", "ChaCha20-Poly1305", "Camellia"],
    notes: "Widely supported. Use AEAD ciphers (AES-GCM, ChaCha20-Poly1305) with ECDHE. Still acceptable, but migrate to 1.3.",
  },
  {
    version: "TLS 1.3",
    rfc: "RFC 8446",
    publishedYear: 2018,
    deprecated: false,
    deprecatedYear: null,
    status: "Recommended",
    keyExchange: ["ECDHE", "PSK"],
    ciphers: ["AES-256-GCM", "AES-128-GCM", "ChaCha20-Poly1305"],
    notes: "Recommended. Removed legacy primitives (RSA key exchange, CBC, SHA-1, MD5). Faster 1-RTT handshake, forward secrecy by default.",
  },
];

export function lookup(version: string): TLSInfo | undefined {
  const v = version.trim().toLowerCase();
  return TLS_VERSIONS.find((t) => t.version.toLowerCase() === v);
}

export function allVersions(): TLSInfo[] {
  return [...TLS_VERSIONS];
}

export function recommended(): TLSInfo[] {
  return TLS_VERSIONS.filter((t) => t.status === "Recommended");
}

export function deprecatedVersions(): TLSInfo[] {
  return TLS_VERSIONS.filter((t) => t.deprecated);
}

export function isSecure(version: string): boolean {
  const info = lookup(version);
  if (!info) return false;
  return !info.deprecated;
}

export function toMarkdown(info: TLSInfo): string {
  const lines = [
    `## ${info.version}`,
    "",
    `- RFC: ${info.rfc}`,
    `- Published: ${info.publishedYear}`,
    `- Status: ${info.status}`,
    `- Deprecated: ${info.deprecated ? `Yes (${info.deprecatedYear ?? "n/a"})` : "No"}`,
    `- Key exchange: ${info.keyExchange.join(", ")}`,
    `- Ciphers: ${info.ciphers.join(", ")}`,
    "",
    info.notes,
  ];
  return lines.join("\n");
}
