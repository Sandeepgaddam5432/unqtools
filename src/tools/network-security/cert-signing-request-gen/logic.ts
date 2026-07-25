/**
 * CSR Generator Reference — pure logic.
 * Reference for CSR format and best-effort PEM/ASN.1 parsing.
 * No actual CSR generation (no WebCrypto keygen) — pure parsing & documentation.
 */

export interface CSRInfo {
  hasPemHeader: boolean;
  hasPemFooter: boolean;
  base64Body: string;
  derByteLength: number;
  outerTag: number;
  outerLength: number;
  subjectBlock: { tag: number; length: number; raw: string } | null;
  publicKeyBlock: { tag: number; length: number } | null;
  signatureAlgorithmOid: string | null;
  errors: string[];
}

const PEM_BEGIN = "-----BEGIN CERTIFICATE REQUEST-----";
const PEM_END = "-----END CERTIFICATE REQUEST-----";

/** Decode base64 PEM body into a Uint8Array (browser-safe atob). */
function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/\s+/g, "");
  const bin = typeof atob === "function" ? atob(clean) : Buffer.from(clean, "base64").toString("binary");
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Read a DER length field starting at offset; returns { length, headerBytes }. */
function readDerLength(bytes: Uint8Array, offset: number): { length: number; headerBytes: number } | null {
  if (offset >= bytes.length) return null;
  const first = bytes[offset];
  if (first < 0x80) return { length: first, headerBytes: 1 };
  const numBytes = first & 0x7f;
  if (numBytes === 0 || offset + 1 + numBytes > bytes.length) return null;
  let len = 0;
  for (let i = 0; i < numBytes; i++) len = (len << 8) | bytes[offset + 1 + i];
  return { length: len, headerBytes: 1 + numBytes };
}

/** Parse a CSR PEM string. Returns best-effort info; never throws. */
export function parseCSR(pem: string): CSRInfo {
  const trimmed = pem.trim();
  const errors: string[] = [];
  const hasPemHeader = trimmed.includes(PEM_BEGIN);
  const hasPemFooter = trimmed.includes(PEM_END);

  let body = trimmed;
  if (hasPemHeader) body = body.replace(PEM_BEGIN, "");
  if (hasPemFooter) body = body.replace(PEM_END, "");
  body = body.replace(/-----[A-Z ]+-----/g, "").trim();

  if (!body) {
    return {
      hasPemHeader,
      hasPemFooter,
      base64Body: "",
      derByteLength: 0,
      outerTag: -1,
      outerLength: 0,
      subjectBlock: null,
      publicKeyBlock: null,
      signatureAlgorithmOid: null,
      errors: ["Empty body — expected base64-encoded CSR"],
    };
  }

  let bytes: Uint8Array;
  try {
    bytes = base64ToBytes(body);
  } catch {
    errors.push("Base64 decode failed");
    return {
      hasPemHeader, hasPemFooter, base64Body: body,
      derByteLength: 0, outerTag: -1, outerLength: 0,
      subjectBlock: null, publicKeyBlock: null, signatureAlgorithmOid: null, errors,
    };
  }

  if (bytes.length < 2) {
    errors.push("DER too short");
    return { hasPemHeader, hasPemFooter, base64Body: body, derByteLength: bytes.length, outerTag: -1, outerLength: 0, subjectBlock: null, publicKeyBlock: null, signatureAlgorithmOid: null, errors };
  }

  const outerTag = bytes[0];
  const lenInfo = readDerLength(bytes, 1);
  if (!lenInfo) {
    errors.push("Could not parse outer DER length");
    return { hasPemHeader, hasPemFooter, base64Body: body, derByteLength: bytes.length, outerTag, outerLength: 0, subjectBlock: null, publicKeyBlock: null, signatureAlgorithmOid: null, errors };
  }
  const outerLength = lenInfo.length;
  const contentStart = 1 + lenInfo.headerBytes;

  let subjectBlock: CSRInfo["subjectBlock"] = null;
  let publicKeyBlock: CSRInfo["publicKeyBlock"] = null;
  if (contentStart + 1 < bytes.length) {
    // First child of CSR is the CertificationRequestInfo SEQUENCE (tag 0x30)
    const sTag = bytes[contentStart];
    const sLen = readDerLength(bytes, contentStart + 1);
    if (sLen) {
      subjectBlock = { tag: sTag, length: sLen.length, raw: body.slice(0, Math.min(40, body.length)) };
      // Inside CertificationRequestInfo: version, subject, subjectPKInfo, attributes
      const innerStart = contentStart + 1 + sLen.headerBytes;
      if (innerStart + 1 < bytes.length) {
        // Skip INTEGER (version)
        let p = innerStart;
        if (bytes[p] === 0x02) {
          const vLen = readDerLength(bytes, p + 1);
          if (vLen) p += 1 + vLen.headerBytes + vLen.length;
        }
        // Now subject SEQUENCE
        if (bytes[p] === 0x30) {
          const subjLen = readDerLength(bytes, p + 1);
          if (subjLen) p += 1 + subjLen.headerBytes + subjLen.length;
        }
        // Now subjectPublicKeyInfo SEQUENCE
        if (bytes[p] === 0x30) {
          const pkLen = readDerLength(bytes, p + 1);
          if (pkLen) publicKeyBlock = { tag: 0x30, length: pkLen.length };
        }
      }
    }
  }

  if (!hasPemHeader) errors.push("Missing PEM header — expected '-----BEGIN CERTIFICATE REQUEST-----'");
  if (!hasPemFooter) errors.push("Missing PEM footer — expected '-----END CERTIFICATE REQUEST-----'");

  return {
    hasPemHeader,
    hasPemFooter,
    base64Body: body,
    derByteLength: bytes.length,
    outerTag,
    outerLength,
    subjectBlock,
    publicKeyBlock,
    signatureAlgorithmOid: null,
    errors,
  };
}

export const CSR_REFERENCE = {
  opensslCommand: "openssl req -new -newkey rsa:2048 -nodes -keyout server.key -out server.csr -subj '/C=US/ST=NY/L=NYC/O=Acme/OU=IT/CN=acme.com'",
  fields: [
    { code: "C", name: "Country", example: "US (2 letters)" },
    { code: "ST", name: "State/Province", example: "NY" },
    { code: "L", name: "Locality", example: "NYC" },
    { code: "O", name: "Organization", example: "Acme Inc." },
    { code: "OU", name: "Org Unit", example: "IT" },
    { code: "CN", name: "Common Name", example: "acme.com" },
    { code: "emailAddress", name: "Email", example: "admin@acme.com" },
  ],
};
