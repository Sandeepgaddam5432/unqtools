/**
 * SSL/TLS Certificate Decoder & Checker — pure logic.
 *
 * Decodes PEM-encoded X.509 certificates and PKCS#10 CSRs by running a
 * pure-JavaScript ASN.1/DER parser on the decoded bytes. Extracts subject,
 * issuer, serial, validity, public-key algorithm + bit length, signature
 * algorithm, SAN list, key usage, basic constraints; computes SHA-1/SHA-256
 * fingerprints via small RFC-compliant pure-JS hash implementations; checks
 * expiry with a live countdown; detects self-signed certs; validates chain
 * order across multiple PEM blocks; matches SANs against a hostname
 * (wildcard-aware); flags weak algorithms / short keys; and generates the
 * exact openssl commands for live-host checks.
 *
 * Pure functions only — no DOM, no network, no external deps. WebCrypto is
 * intentionally NOT used so the module stays synchronous and testable.
 *
 * PRIVACY: The history feature stores only operation metadata
 * (action + subjectCn + issuerCn + expiryDate + sha256 fingerprint + ts),
 * NEVER the PEM, private key, or full certificate bytes. The shareable URL
 * encodes only the active tab and a hostname for the openssl-command
 * generator.
 *
 * References:
 *  - RFC 5280: X.509 PKI Certificate and CRL Profile
 *  - RFC 2986: PKCS#10 Certification Request Syntax
 *  - RFC 7468: Textual Encodings of PKI objects (PEM)
 *  - FIPS 180-4: SHA-1 / SHA-256
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Known PEM block labels (RFC 7468). */
export type PemLabel =
  | "CERTIFICATE"
  | "CERTIFICATE REQUEST"
  | "X509 CRL"
  | "PRIVATE KEY"
  | "RSA PRIVATE KEY"
  | "EC PRIVATE KEY"
  | "ENCRYPTED PRIVATE KEY"
  | "PUBLIC KEY";

/** A single decoded PEM block. */
export interface PemBlock {
  label: PemLabel | string;
  /** Decoded DER bytes (as number[] for JSON-serializability / portability). */
  der: number[];
  /** Raw base64 body (without the BEGIN/END armor). */
  base64: string;
}

/** Result of PEM parsing. */
export interface PemParseResult {
  ok: boolean;
  blocks: PemBlock[];
  errors: string[];
}

/** Single ASN.1 TLV node. */
export interface Asn1Node {
  /** Raw tag byte. */
  tag: number;
  /** Tag class: 0=UNIVERSAL, 1=APPLICATION, 2=CONTEXT, 3=PRIVATE. */
  tagClass: number;
  /** True if constructed (SEQUENCE, SET, or [n] EXPLICIT). */
  constructed: boolean;
  /** Tag number within class. */
  tagNumber: number;
  /** Value bytes (excluding tag + length). */
  value: number[];
  /** Child nodes (only meaningful for constructed nodes). */
  children: Asn1Node[];
  /** Original raw bytes (tag + length + value) — useful for fingerprints. */
  raw: number[];
}

/** Distinguished-name attribute (one RDN component). */
export interface DnAttribute {
  oid: string;
  oidName: string;
  value: string;
}

/** Decoded distinguished name. */
export interface DistinguishedName {
  attributes: DnAttribute[];
  /** RFC 4514 string form: CN=foo,O=bar,C=US */
  rfc4514: string;
}

/** Subject Alternative Name entry. */
export interface SanEntry {
  type: "DNS" | "IP" | "email" | "URI" | "other";
  value: string;
}

/** Public-key info extracted from SubjectPublicKeyInfo. */
export interface PublicKeyInfo {
  algorithm: string;       // friendly name (rsaEncryption, id-ecPublicKey, …)
  algorithmOid: string;
  /** Bit length (RSA modulus bits, EC curve bits, Ed25519=256). Null if unknown. */
  bitLength: number | null;
  /** Curve name for EC keys (e.g. prime256v1 / secp384r1 / secp521r1). */
  curveName?: string | null;
  /** Raw hex of the public-key bytes (truncated to 64 chars + …). */
  publicKeyHex: string;
}

/** Decoded X.509 certificate (subset of RFC 5280 fields). */
export interface DecodedCertificate {
  kind: "certificate";
  version: number;            // 0,1,2 (= v1,v2,v3)
  serialHex: string;
  signatureAlgorithm: string;
  signatureAlgorithmOid: string;
  issuer: DistinguishedName;
  subject: DistinguishedName;
  notBefore: string;          // ISO 8601 UTC
  notAfter: string;           // ISO 8601 UTC
  publicKey: PublicKeyInfo;
  sans: SanEntry[];
  keyUsage: string[];         // friendly names
  extKeyUsage: string[];      // friendly names
  isCa: boolean;
  der: number[];              // raw DER bytes (for fingerprinting)
  sha1: string;               // hex
  sha256: string;             // hex
  parseWarnings: string[];
}

/** Decoded PKCS#10 CSR. */
export interface DecodedCsr {
  kind: "csr";
  version: number;
  subject: DistinguishedName;
  publicKey: PublicKeyInfo;
  sans: SanEntry[];
  signatureAlgorithm: string;
  signatureAlgorithmOid: string;
  der: number[];
  sha1: string;
  sha256: string;
  parseWarnings: string[];
}

/** Anything the decoder can return. */
export type Decoded =
  | DecodedCertificate
  | DecodedCsr
  | { kind: "private-key"; label: string; der: number[]; sha1: string; sha256: string; parseWarnings: string[] }
  | { kind: "public-key"; label: string; der: number[]; sha1: string; sha256: string; parseWarnings: string[] }
  | { kind: "crl"; label: string; der: number[]; sha1: string; sha256: string; parseWarnings: string[] };

/** Generic validation issue. */
export interface ValidationIssue {
  level: "error" | "warning" | "info";
  message: string;
}

/** Result of an expiry check. */
export interface ExpiryCheck {
  status: "valid" | "expired" | "not-yet-valid";
  notBefore: string;
  notAfter: string;
  /** Days until notAfter (negative if expired). */
  daysRemaining: number;
  /** Days since notBefore (negative if not-yet-valid). */
  daysSinceIssue: number;
  /** Total validity span in days. */
  totalValidityDays: number;
  /** 0–100 percent of validity elapsed. */
  percentElapsed: number;
}

/** Chain-validation result. */
export interface ChainValidation {
  ok: boolean;
  issues: ValidationIssue[];
  /** Subject CN at each position, in input order. */
  order: string[];
}

/** Weakness check result. */
export interface WeaknessCheck {
  issues: ValidationIssue[];
  hasWeakSig: boolean;
  hasWeakKey: boolean;
  isSelfSigned: boolean;
}

/** Generated openssl command. */
export interface OpensslCommand {
  tool: "s_client" | "x509" | "req" | "verify" | "ecparam" | "genpkey" | "genrsa";
  label: string;
  command: string;
  explanation: string;
}

/** Field explanation. */
export interface FieldExplanation {
  field: string;
  short: string;
  long: string;
}

/** History entry — METADATA ONLY, no PEM. */
export interface HistoryEntry {
  ts: number;
  action: "decode" | "check";
  subjectCn: string | null;
  issuerCn: string | null;
  expiryDate: string | null;
  sha256: string | null;
}

/** Shareable-URL state. */
export interface ShareState {
  tab?: "decode" | "commands";
  host?: string;
  port?: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Common OIDs and their friendly names (RFC 5280 + RFC 4519). */
export const OID_NAMES: Readonly<Record<string, string>> = {
  // Attribute types (subject / issuer)
  "2.5.4.3": "CN",
  "2.5.4.6": "C",
  "2.5.4.7": "L",
  "2.5.4.8": "ST",
  "2.5.4.10": "O",
  "2.5.4.11": "OU",
  "2.5.4.5": "serialNumber",
  "1.2.840.113549.1.9.1": "emailAddress",
  "0.9.2342.19200300.100.1.25": "DC",
  "0.9.2342.19200300.100.1.1": "UID",
  // Signature algorithms
  "1.2.840.113549.1.1.1": "rsaEncryption",
  "1.2.840.113549.1.1.2": "md2WithRSAEncryption",
  "1.2.840.113549.1.1.4": "md5WithRSAEncryption",
  "1.2.840.113549.1.1.5": "sha1WithRSAEncryption",
  "1.2.840.113549.1.1.11": "sha256WithRSAEncryption",
  "1.2.840.113549.1.1.12": "sha384WithRSAEncryption",
  "1.2.840.113549.1.1.13": "sha512WithRSAEncryption",
  "1.2.840.10045.2.1": "id-ecPublicKey",
  "1.2.840.10045.4.1": "ecdsa-with-SHA1",
  "1.2.840.10045.4.3.1": "ecdsa-with-SHA224",
  "1.2.840.10045.4.3.2": "ecdsa-with-SHA256",
  "1.2.840.10045.4.3.3": "ecdsa-with-SHA384",
  "1.2.840.10045.4.3.4": "ecdsa-with-SHA512",
  "1.3.101.110": "Ed25519",
  "1.3.101.111": "Ed448",
  "1.3.101.112": "id-EdDSA25519",
  "1.3.101.113": "id-EdDSA448",
  "1.3.101.100": "X25519",
  "1.3.101.101": "X448",
  "1.2.840.10040.4.1": "id-dsa",
  "1.2.840.10040.4.3": "dsa-with-sha1",
  "2.16.840.1.101.3.4.3.1": "dsa-with-sha224",
  "2.16.840.1.101.3.4.3.2": "dsa-with-sha256",
  // EC curves
  "1.2.840.10045.3.1.7": "prime256v1",
  "1.3.132.0.34": "secp384r1",
  "1.3.132.0.35": "secp521r1",
  "1.3.132.0.10": "secp256k1",
  // X.509 extensions
  "2.5.29.14": "subjectKeyIdentifier",
  "2.5.29.15": "keyUsage",
  "2.5.29.17": "subjectAltName",
  "2.5.29.18": "issuerAltName",
  "2.5.29.19": "basicConstraints",
  "2.5.29.31": "cRLDistributionPoints",
  "2.5.29.32": "certificatePolicies",
  "2.5.29.35": "authorityKeyIdentifier",
  "2.5.29.37": "extKeyUsage",
  "1.3.6.1.5.5.7.1.1": "authorityInfoAccess",
  "1.3.6.1.5.5.7.3.1": "serverAuth",
  "1.3.6.1.5.5.7.3.2": "clientAuth",
  "1.3.6.1.5.5.7.3.3": "codeSigning",
  "1.3.6.1.5.5.7.3.4": "emailProtection",
  "1.3.6.1.5.5.7.3.8": "timeStamping",
  "1.3.6.1.5.5.7.3.9": "OCSPSigning",
};

/** X.509 KeyUsage bits → friendly names (RFC 5280 §4.2.1.3, bit order 0..8). */
export const KEY_USAGE_BITS: readonly string[] = [
  "digitalSignature",
  "nonRepudiation",
  "keyEncipherment",
  "dataEncipherment",
  "keyAgreement",
  "keyCertSign",
  "cRLSign",
  "encipherOnly",
  "decipherOnly",
];

/** Signature algorithms considered cryptographically weak. */
export const WEAK_SIG_ALGORITHMS: ReadonlySet<string> = new Set([
  "md2WithRSAEncryption",
  "md5WithRSAEncryption",
  "sha1WithRSAEncryption",
  "ecdsa-with-SHA1",
  "dsa-with-sha1",
]);

/** Minimum acceptable RSA key size (NIST SP 800-57). */
export const MIN_RSA_BITS = 2048;

/** Default TLS port for openssl command generator. */
export const DEFAULT_TLS_PORT = 443;

// ---------------------------------------------------------------------------
// Base64 decoder (pure JS, RFC 4648 — accepts standard + URL-safe, with/without padding)
// ---------------------------------------------------------------------------

const B64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const B64_LOOKUP: Record<number, number> = (() => {
  const m: Record<number, number> = {};
  for (let i = 0; i < B64_CHARS.length; i++) m[B64_CHARS.charCodeAt(i)] = i;
  // URL-safe aliases
  m["-".charCodeAt(0)] = 62;
  m["_".charCodeAt(0)] = 63;
  return m;
})();

/** Decode a base64 string into an array of byte values. */
export function decodeBase64(input: string): number[] {
  const s = input.replace(/[^A-Za-z0-9+/_-]/g, "");
  const out: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (let i = 0; i < s.length; i++) {
    const c = B64_LOOKUP[s.charCodeAt(i)];
    if (c === undefined) continue;
    buffer = (buffer << 6) | c;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((buffer >> bits) & 0xff);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// PEM parser (RFC 7468)
// ---------------------------------------------------------------------------

const PEM_RE = /-----BEGIN ([A-Z0-9 ]+)-----\r?\n([\s\S]*?)-----END \1-----/g;

/** Detect the first PEM block label in the input, if any. */
export function detectPemType(text: string): PemLabel | string | null {
  const m = /-----BEGIN ([A-Z0-9 ]+)-----/.exec(text);
  return m ? m[1].trim() : null;
}

/** Parse all PEM blocks out of an arbitrary text blob. */
export function decodePem(text: string): PemParseResult {
  const blocks: PemBlock[] = [];
  const errors: string[] = [];
  if (!text || !text.trim()) {
    return { ok: false, blocks: [], errors: ["Empty input."] };
  }
  let m: RegExpExecArray | null;
  PEM_RE.lastIndex = 0;
  while ((m = PEM_RE.exec(text)) !== null) {
    const label = m[1].trim();
    const body = m[2];
    const cleaned = body.replace(/\s+/g, "");
    if (!cleaned) {
      errors.push(`PEM block "${label}" has an empty base64 body.`);
      continue;
    }
    const der = decodeBase64(cleaned);
    if (der.length === 0) {
      errors.push(`PEM block "${label}" could not be base64-decoded.`);
      continue;
    }
    blocks.push({ label, der, base64: cleaned });
  }
  if (blocks.length === 0) {
    errors.push("No PEM blocks found. Look for -----BEGIN CERTIFICATE----- armor.");
  }
  return { ok: blocks.length > 0, blocks, errors };
}

// ---------------------------------------------------------------------------
// ASN.1 / DER parser (X.690)
// ---------------------------------------------------------------------------

/**
 * Parse a single ASN.1 TLV starting at `offset` in `bytes`.
 * Returns the node and the index just past it. Throws on malformed input.
 */
function parseTlv(bytes: number[], offset: number): { node: Asn1Node; next: number } {
  if (offset >= bytes.length) throw new Error("ASN.1: unexpected end of input (tag).");
  const tagByte = bytes[offset];
  const tagClass = (tagByte >> 6) & 0x03;
  const constructed = (tagByte & 0x20) !== 0;
  let tagNumber = tagByte & 0x1f;
  let i = offset + 1;

  // Long-form tag (tagNumber === 31)
  if (tagNumber === 0x1f) {
    tagNumber = 0;
    while (i < bytes.length) {
      const b = bytes[i++];
      tagNumber = (tagNumber << 7) | (b & 0x7f);
      if ((b & 0x80) === 0) break;
    }
  }

  if (i >= bytes.length) throw new Error("ASN.1: unexpected end of input (length).");
  let length = bytes[i++];
  let indefinite = false;
  if (length === 0x80) {
    // Indefinite length — only valid for constructed BER, not DER. We tolerate it.
    indefinite = true;
    length = 0;
  } else if (length & 0x80) {
    const n = length & 0x7f;
    if (n === 0) throw new Error("ASN.1: invalid length (reserved).");
    if (i + n > bytes.length) throw new Error("ASN.1: length bytes exceed input.");
    length = 0;
    for (let k = 0; k < n; k++) length = (length << 8) | bytes[i++];
  }
  if (i + length > bytes.length) throw new Error("ASN.1: value exceeds input.");

  const valueStart = i;
  const valueEnd = i + length;
  const value = bytes.slice(valueStart, valueEnd);
  const raw = bytes.slice(offset, valueEnd);

  const children: Asn1Node[] = [];
  if (constructed && !indefinite) {
    let ci = valueStart;
    while (ci < valueEnd) {
      try {
        const { node, next } = parseTlv(bytes, ci);
        children.push(node);
        ci = next;
      } catch {
        // Children failed to parse (e.g. non-TLV value). Stop here.
        break;
      }
    }
  }

  return {
    node: { tag: tagByte, tagClass, constructed, tagNumber, value, children, raw },
    next: valueEnd,
  };
}

/** Parse a top-level ASN.1 DER blob. */
export function parseDer(bytes: number[]): Asn1Node {
  if (bytes.length === 0) throw new Error("ASN.1: empty input.");
  const { node } = parseTlv(bytes, 0);
  return node;
}

/** Friendly name for an OID string, or the dotted form if unknown. */
export function oidName(oid: string): string {
  return OID_NAMES[oid] ?? oid;
}

/** Decode an OID's value bytes to dotted-decimal string. */
export function parseObjectIdentifier(value: number[]): string {
  if (value.length === 0) return "";
  const parts: number[] = [];
  // First byte = 40*X + Y
  const first = value[0];
  parts.push(Math.floor(first / 40));
  parts.push(first % 40);
  let i = 1;
  while (i < value.length) {
    let n = 0;
    while (i < value.length) {
      const b = value[i++];
      n = (n << 7) | (b & 0x7f);
      if ((b & 0x80) === 0) break;
    }
    parts.push(n);
  }
  return parts.join(".");
}

/** Read an INTEGER node as a bigint-friendly hex string (handles leading 0x00 sign byte). */
export function integerToHex(node: Asn1Node): string {
  if (!node.value || node.value.length === 0) return "00";
  let hex = node.value.map((b) => b.toString(16).padStart(2, "0")).join("");
  // Strip a single leading 0x00 added for sign-extension
  if (hex.length > 2 && hex.startsWith("00")) hex = hex.slice(2);
  return hex.toUpperCase();
}

/**
 * Parse an ASN.1 time node (UTCTime or GeneralizedTime) into ISO 8601 UTC.
 * UTCTime: YYMMDDHHMMSSZ (2-digit year; <50 → 20YY, >=50 → 19YY)
 * GeneralizedTime: YYYYMMDDHHMMSSZ
 */
export function parseAsn1Time(node: Asn1Node): string {
  const s = node.value.map((b) => String.fromCharCode(b)).join("").trim();
  // GeneralizedTime has 4-digit year
  const isGeneralized = node.tagNumber === 24;
  let year: number, mon = 1, day = 1, hh = 0, mm = 0, ss = 0;
  if (isGeneralized) {
    year = parseInt(s.slice(0, 4), 10);
    if (s.length >= 6) mon = parseInt(s.slice(4, 6), 10);
    if (s.length >= 8) day = parseInt(s.slice(6, 8), 10);
    if (s.length >= 10) hh = parseInt(s.slice(8, 10), 10);
    if (s.length >= 12) mm = parseInt(s.slice(10, 12), 10);
    if (s.length >= 14) ss = parseInt(s.slice(12, 14), 10);
  } else {
    // UTCTime: YYMMDDHHMMSSZ
    const yy = parseInt(s.slice(0, 2), 10);
    year = yy < 50 ? 2000 + yy : 1900 + yy;
    if (s.length >= 4) mon = parseInt(s.slice(2, 4), 10);
    if (s.length >= 6) day = parseInt(s.slice(4, 6), 10);
    if (s.length >= 8) hh = parseInt(s.slice(6, 8), 10);
    if (s.length >= 10) mm = parseInt(s.slice(8, 10), 10);
    if (s.length >= 12) ss = parseInt(s.slice(10, 12), 10);
  }
  const pad = (n: number, w = 2) => n.toString().padStart(w, "0");
  return `${pad(year, 4)}-${pad(mon)}-${pad(day)}T${pad(hh)}:${pad(mm)}:${pad(ss)}Z`;
}

/** Parse a DistinguishedName SEQUENCE OF SET OF AttributeTypeAndValue. */
export function parseDistinguishedName(node: Asn1Node): DistinguishedName {
  const attributes: DnAttribute[] = [];
  for (const rdnSet of node.children) {
    // Each RDN is a SET OF AttributeTypeAndValue
    for (const atv of rdnSet.children) {
      // atv = SEQUENCE { type OID, value ANY }
      if (atv.children.length < 2) continue;
      const oidNode = atv.children[0];
      const valueNode = atv.children[1];
      const oid = parseObjectIdentifier(oidNode.value);
      const value = valueNode.value.map((b) => String.fromCharCode(b)).join("");
      attributes.push({ oid, oidName: oidName(oid), value });
    }
  }
  const rfc4514 = attributes
    .map((a) => `${a.oidName}=${a.value.replace(/([,+"\\<>;=])/g, "\\$1")}`)
    .join(",");
  return { attributes, rfc4514 };
}

// ---------------------------------------------------------------------------
// Public-key info parser
// ---------------------------------------------------------------------------

/** Estimated bit length of an RSA modulus from its INTEGER node. */
function rsaBitsFromModulus(modulusNode: Asn1Node): number {
  // Strip the leading 0x00 sign byte if present
  let v = modulusNode.value;
  while (v.length > 0 && v[0] === 0) v = v.slice(1);
  return v.length * 8;
}

/** Parse SubjectPublicKeyInfo into a PublicKeyInfo object. */
export function parseSubjectPublicKeyInfo(spk: Asn1Node): PublicKeyInfo {
  const warnings: string[] = [];
  // spk = SEQUENCE { AlgorithmIdentifier, BIT STRING }
  if (spk.children.length < 2) {
    return { algorithm: "unknown", algorithmOid: "", bitLength: null, publicKeyHex: "" };
  }
  const algId = spk.children[0];
  const bitString = spk.children[1];
  const algOid = algId.children.length > 0
    ? parseObjectIdentifier(algId.children[0].value)
    : "";
  const algName = oidName(algOid);
  // BIT STRING: first byte is unused-bits count
  const keyBytes = bitString.value.length > 0 ? bitString.value.slice(1) : [];

  let bitLength: number | null = null;
  let curveName: string | null = null;
  let publicKeyHex = keyBytes.map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
  if (publicKeyHex.length > 64) publicKeyHex = publicKeyHex.slice(0, 64) + "…";

  if (algName === "rsaEncryption") {
    // keyBytes = SEQUENCE { modulus INTEGER, publicExponent INTEGER }
    try {
      const inner = parseDer(keyBytes);
      if (inner.children.length >= 1) {
        bitLength = rsaBitsFromModulus(inner.children[0]);
      }
    } catch {
      warnings.push("Could not parse RSA modulus.");
    }
  } else if (algName === "id-ecPublicKey") {
    // algId = SEQUENCE { OID, curve OID }
    if (algId.children.length >= 2) {
      const curveOid = parseObjectIdentifier(algId.children[1].value);
      curveName = oidName(curveOid);
      if (curveName === "prime256v1") bitLength = 256;
      else if (curveName === "secp384r1") bitLength = 384;
      else if (curveName === "secp521r1") bitLength = 521;
      else if (curveName === "secp256k1") bitLength = 256;
    }
  } else if (algName === "Ed25519" || algName === "id-EdDSA25519" || algName === "X25519") {
    bitLength = 256;
  } else if (algName === "Ed448" || algName === "id-EdDSA448" || algName === "X448") {
    bitLength = 448;
  } else if (algName === "id-dsa") {
    // keyBytes = SEQUENCE { p, q, g } — p gives the bit length
    try {
      const inner = parseDer(keyBytes);
      if (inner.children.length >= 1) bitLength = rsaBitsFromModulus(inner.children[0]);
    } catch {
      // ignore
    }
  }

  return { algorithm: algName, algorithmOid: algOid, bitLength, curveName, publicKeyHex };
}

// ---------------------------------------------------------------------------
// X.509 extension parsers (best-effort)
// ---------------------------------------------------------------------------

/** Parse the SubjectAltName extension into a list of typed entries. */
function parseSanExtension(extValue: Asn1Node): SanEntry[] {
  const out: SanEntry[] = [];
  // The extnValue is an OCTET STRING wrapping a SEQUENCE OF GeneralName.
  // OCTET STRING is primitive (no children), so we parse its bytes as DER.
  let seq: Asn1Node;
  if (extValue.tagNumber === 4) {
    try {
      seq = parseDer(extValue.value);
    } catch {
      return out;
    }
  } else {
    seq = extValue;
  }
  for (const gn of seq.children) {
    // GeneralName is a CHOICE with context tags
    // [0] otherName, [1] rfc822Name (email), [2] dNSName, [3] x400Address,
    // [4] directoryName, [5] ediPartyName, [6] uniformResourceIdentifier (URI),
    // [7] iPAddress (OCTET STRING), [8] registeredID
    const ctx = gn.tagNumber;
    const text = gn.value.map((b) => String.fromCharCode(b)).join("");
    if (ctx === 2) out.push({ type: "DNS", value: text });
    else if (ctx === 6) out.push({ type: "URI", value: text });
    else if (ctx === 1) out.push({ type: "email", value: text });
    else if (ctx === 7) {
      // IP address — IPv4 = 4 bytes, IPv6 = 16 bytes
      if (gn.value.length === 4) {
        out.push({ type: "IP", value: gn.value.join(".") });
      } else if (gn.value.length === 16) {
        const groups: string[] = [];
        for (let i = 0; i < 16; i += 2) {
          groups.push(((gn.value[i] << 8) | gn.value[i + 1]).toString(16));
        }
        out.push({ type: "IP", value: groups.join(":") });
      } else {
        out.push({ type: "IP", value: gn.value.map((b) => b.toString(16)).join(":") });
      }
    } else {
      out.push({ type: "other", value: text || `[tag ${ctx}]` });
    }
  }
  return out;
}

/** Parse the KeyUsage extension BIT STRING into friendly names. */
function parseKeyUsageExtension(extValue: Asn1Node): string[] {
  // The extnValue is an OCTET STRING wrapping a BIT STRING.
  let bitString: Asn1Node;
  if (extValue.tagNumber === 4) {
    try {
      bitString = parseDer(extValue.value);
    } catch {
      return [];
    }
  } else {
    bitString = extValue;
  }
  if (bitString.value.length === 0) return [];
  const unused = bitString.value[0];
  const bits = bitString.value.slice(1);
  const out: string[] = [];
  let bitIndex = 0;
  for (const byte of bits) {
    for (let b = 7; b >= 0; b--) {
      if (bitIndex < KEY_USAGE_BITS.length && (byte >> b) & 1) {
        out.push(KEY_USAGE_BITS[bitIndex]);
      }
      bitIndex++;
      if (bitIndex >= KEY_USAGE_BITS.length) break;
    }
    if (bitIndex >= KEY_USAGE_BITS.length) break;
  }
  // `unused` bits at the end are not meaningful; we ignore.
  void unused;
  return out;
}

/** Parse the ExtendedKeyUsage extension SEQUENCE OF OID. */
function parseExtKeyUsageExtension(extValue: Asn1Node): string[] {
  let seq: Asn1Node;
  if (extValue.tagNumber === 4) {
    try {
      seq = parseDer(extValue.value);
    } catch {
      return [];
    }
  } else {
    seq = extValue;
  }
  const out: string[] = [];
  for (const oidNode of seq.children) {
    const oid = parseObjectIdentifier(oidNode.value);
    out.push(oidName(oid));
  }
  return out;
}

/** Parse the BasicConstraints extension. Returns isCa. */
function parseBasicConstraintsExtension(extValue: Asn1Node): boolean {
  let seq: Asn1Node;
  if (extValue.tagNumber === 4) {
    try {
      seq = parseDer(extValue.value);
    } catch {
      return false;
    }
  } else {
    seq = extValue;
  }
  // SEQUENCE { cA BOOLEAN DEFAULT FALSE, pathLenConstraint INTEGER OPTIONAL }
  for (const child of seq.children) {
    if (child.tagNumber === 1 && child.value.length > 0 && child.value[0] !== 0) {
      return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Certificate + CSR top-level parsers
// ---------------------------------------------------------------------------

/**
 * Walk the X.509 extensions SEQUENCE and pull out SAN, KeyUsage, EKU,
 * BasicConstraints.
 */
function parseExtensions(extSeq: Asn1Node): {
  sans: SanEntry[];
  keyUsage: string[];
  extKeyUsage: string[];
  isCa: boolean;
} {
  const result = { sans: [] as SanEntry[], keyUsage: [] as string[], extKeyUsage: [] as string[], isCa: false };
  for (const ext of extSeq.children) {
    // ext = SEQUENCE { OID, BOOLEAN critical OPTIONAL, OCTET STRING extnValue }
    if (ext.children.length < 2) continue;
    const oid = parseObjectIdentifier(ext.children[0].value);
    // Find the OCTET STRING (the last child)
    const extValue = ext.children[ext.children.length - 1];
    if (oid === "2.5.29.17") result.sans = parseSanExtension(extValue);
    else if (oid === "2.5.29.15") result.keyUsage = parseKeyUsageExtension(extValue);
    else if (oid === "2.5.29.37") result.extKeyUsage = parseExtKeyUsageExtension(extValue);
    else if (oid === "2.5.29.19") result.isCa = parseBasicConstraintsExtension(extValue);
  }
  return result;
}

/** Parse an X.509 certificate DER blob. */
export function parseCertificate(der: number[]): DecodedCertificate {
  const warnings: string[] = [];
  const root = parseDer(der);
  // Certificate ::= SEQUENCE { tbsCertificate, signatureAlgorithm, signatureValue }
  if (root.children.length < 3) {
    throw new Error("X.509: malformed Certificate (expected 3 children).");
  }
  const tbs = root.children[0];
  const sigAlgNode = root.children[1];
  // signatureValue is root.children[2] (a BIT STRING) — we don't need it here.

  // tbsCertificate ::= SEQUENCE {
  //   [0] EXPLICIT version DEFAULT v1,
  //   serialNumber INTEGER,
  //   signature AlgorithmIdentifier,
  //   issuer Name,
  //   validity Validity,
  //   subject Name,
  //   subjectPublicKeyInfo SubjectPublicKeyInfo,
  //   [1] IMPLICIT issuerUniqueID OPTIONAL,
  //   [2] IMPLICIT subjectUniqueID OPTIONAL,
  //   [3] EXPLICIT extensions OPTIONAL
  // }
  let idx = 0;
  let version = 0; // default v1
  if (tbs.children[0]?.tagClass === 2 && tbs.children[0]?.tagNumber === 0) {
    // [0] EXPLICIT version
    const vNode = tbs.children[0].children[0];
    if (vNode) version = vNode.value.length > 0 ? vNode.value[0] : 0;
    idx = 1;
  }
  const serialNode = tbs.children[idx++];
  const sigAlgInTbs = tbs.children[idx++];
  const issuerNode = tbs.children[idx++];
  const validityNode = tbs.children[idx++];
  const subjectNode = tbs.children[idx++];
  const spkiNode = tbs.children[idx++];

  // Skip optional [1], [2] unique IDs
  while (idx < tbs.children.length &&
         (tbs.children[idx].tagClass === 2 && (tbs.children[idx].tagNumber === 1 || tbs.children[idx].tagNumber === 2))) {
    idx++;
  }
  // [3] EXPLICIT extensions
  let extensions = { sans: [] as SanEntry[], keyUsage: [] as string[], extKeyUsage: [] as string[], isCa: false };
  if (idx < tbs.children.length && tbs.children[idx].tagClass === 2 && tbs.children[idx].tagNumber === 3) {
    const extSeq = tbs.children[idx].children[0];
    if (extSeq) extensions = parseExtensions(extSeq);
  }

  const sigAlgOid = sigAlgInTbs.children.length > 0
    ? parseObjectIdentifier(sigAlgInTbs.children[0].value)
    : "";
  const sigAlgName = oidName(sigAlgOid);
  const sigAlgOuterOid = sigAlgNode.children.length > 0
    ? parseObjectIdentifier(sigAlgNode.children[0].value)
    : "";
  // Use the outer signature algorithm OID for display; fall back to the inner one.
  const sigOid = sigAlgOuterOid || sigAlgOid;

  const validity = validityNode.children;
  if (validity.length < 2) throw new Error("X.509: malformed Validity.");
  const notBefore = parseAsn1Time(validity[0]);
  const notAfter = parseAsn1Time(validity[1]);

  const publicKey = parseSubjectPublicKeyInfo(spkiNode);

  const sha1 = sha1Hex(der);
  const sha256 = sha256Hex(der);

  return {
    kind: "certificate",
    version,
    serialHex: integerToHex(serialNode),
    signatureAlgorithm: oidName(sigOid),
    signatureAlgorithmOid: sigOid,
    issuer: parseDistinguishedName(issuerNode),
    subject: parseDistinguishedName(subjectNode),
    notBefore,
    notAfter,
    publicKey,
    sans: extensions.sans,
    keyUsage: extensions.keyUsage,
    extKeyUsage: extensions.extKeyUsage,
    isCa: extensions.isCa,
    der,
    sha1,
    sha256,
    parseWarnings: warnings,
  };
}

/** Parse a PKCS#10 CSR DER blob. */
export function parseCsr(der: number[]): DecodedCsr {
  const root = parseDer(der);
  // CertificationRequest ::= SEQUENCE { certificationRequestInfo, signatureAlgorithm, signature }
  if (root.children.length < 3) {
    throw new Error("PKCS#10: malformed CSR (expected 3 children).");
  }
  const cri = root.children[0];
  const sigAlgNode = root.children[1];
  // CertificationRequestInfo ::= SEQUENCE {
  //   version INTEGER,
  //   subject Name,
  //   subjectPKInfo SubjectPublicKeyInfo,
  //   attributes [0] IMPLICIT Attributes
  // }
  const versionNode = cri.children[0];
  const subjectNode = cri.children[1];
  const spkiNode = cri.children[2];
  let sans: SanEntry[] = [];
  // attributes [0] IMPLICIT — may contain extensionRequest with SANs
  if (cri.children.length >= 4 && cri.children[3].tagClass === 2 && cri.children[3].tagNumber === 0) {
    const attrsSeq = cri.children[3];
    for (const attr of attrsSeq.children) {
      // Attribute ::= SEQUENCE { type OID, values SET OF ANY }
      if (attr.children.length < 2) continue;
      const attrOid = parseObjectIdentifier(attr.children[0].value);
      if (attrOid === "1.2.840.113549.1.9.14") {
        // extensionRequest
        const extsSeq = attr.children[1].children[0];
        if (extsSeq) {
          const extResult = parseExtensions(extsSeq);
          sans = extResult.sans;
        }
      }
    }
  }

  const version = versionNode.value.length > 0 ? versionNode.value[0] : 0;
  const publicKey = parseSubjectPublicKeyInfo(spkiNode);

  const sigOid = sigAlgNode.children.length > 0
    ? parseObjectIdentifier(sigAlgNode.children[0].value)
    : "";

  const sha1 = sha1Hex(der);
  const sha256 = sha256Hex(der);

  return {
    kind: "csr",
    version,
    subject: parseDistinguishedName(subjectNode),
    publicKey,
    sans,
    signatureAlgorithm: oidName(sigOid),
    signatureAlgorithmOid: sigOid,
    der,
    sha1,
    sha256,
    parseWarnings: [],
  };
}

/** Decode any PEM block — certificate, CSR, or report label-only for private keys. */
export function decodePemBlock(block: PemBlock): Decoded {
  const der = block.der;
  const sha1 = sha1Hex(der);
  const sha256 = sha256Hex(der);
  const label = block.label;
  if (label === "CERTIFICATE") return parseCertificate(der);
  if (label === "CERTIFICATE REQUEST") return parseCsr(der);
  if (label === "RSA PRIVATE KEY" || label === "EC PRIVATE KEY" ||
      label === "PRIVATE KEY" || label === "ENCRYPTED PRIVATE KEY") {
    return { kind: "private-key", label, der, sha1, sha256, parseWarnings: [] };
  }
  if (label === "PUBLIC KEY") {
    return { kind: "public-key", label, der, sha1, sha256, parseWarnings: [] };
  }
  if (label === "X509 CRL") {
    return { kind: "crl", label, der, sha1, sha256, parseWarnings: [] };
  }
  // Unknown label — still report fingerprints
  return { kind: "crl", label, der, sha1, sha256, parseWarnings: [`Unknown PEM label "${label}".`] };
}

// ---------------------------------------------------------------------------
// Pure-JS SHA-1 (FIPS 180-4)
// ---------------------------------------------------------------------------

function rotl(n: number, b: number): number {
  return ((n << b) | (n >>> (32 - b))) >>> 0;
}

/** Compute SHA-1 over an array of bytes; returns 20 byte values. */
export function sha1(bytes: number[]): number[] {
  const h0 = 0x67452301, h1 = 0xEFCDAB89, h2 = 0x98BADCFE, h3 = 0x10325476, h4 = 0xC3D2E1F0;
  const msg = bytes.slice();
  const origLen = msg.length;
  // Pad
  msg.push(0x80);
  while (msg.length % 64 !== 56) msg.push(0);
  // 64-bit big-endian length in bits (high 32 bits = 0 for any realistic input)
  const bitLen = origLen * 8;
  msg.push(0, 0, 0, 0);
  msg.push((bitLen >>> 24) & 0xff, (bitLen >>> 16) & 0xff, (bitLen >>> 8) & 0xff, bitLen & 0xff);

  let hh0 = h0, hh1 = h1, hh2 = h2, hh3 = h3, hh4 = h4;
  for (let chunk = 0; chunk < msg.length; chunk += 64) {
    const w = new Array<number>(80);
    for (let i = 0; i < 16; i++) {
      w[i] = ((msg[chunk + i * 4] << 24) | (msg[chunk + i * 4 + 1] << 16) |
              (msg[chunk + i * 4 + 2] << 8) | msg[chunk + i * 4 + 3]) >>> 0;
    }
    for (let i = 16; i < 80; i++) {
      w[i] = rotl(w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16], 1);
    }
    let a = hh0, b = hh1, c = hh2, d = hh3, e = hh4;
    for (let i = 0; i < 80; i++) {
      let f: number, k: number;
      if (i < 20) { f = (b & c) | (~b & d); k = 0x5A827999; }
      else if (i < 40) { f = b ^ c ^ d; k = 0x6ED9EBA1; }
      else if (i < 60) { f = (b & c) | (b & d) | (c & d); k = 0x8F1BBCDC; }
      else { f = b ^ c ^ d; k = 0xCA62C1D6; }
      const t = (rotl(a, 5) + f + e + k + w[i]) >>> 0;
      e = d; d = c; c = rotl(b, 30); b = a; a = t;
    }
    hh0 = (hh0 + a) >>> 0;
    hh1 = (hh1 + b) >>> 0;
    hh2 = (hh2 + c) >>> 0;
    hh3 = (hh3 + d) >>> 0;
    hh4 = (hh4 + e) >>> 0;
  }
  const out: number[] = [];
  for (const h of [hh0, hh1, hh2, hh3, hh4]) {
    out.push((h >>> 24) & 0xff, (h >>> 16) & 0xff, (h >>> 8) & 0xff, h & 0xff);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Pure-JS SHA-256 (FIPS 180-4)
// ---------------------------------------------------------------------------

const SHA256_K: readonly number[] = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

function rotr(n: number, b: number): number {
  return ((n >>> b) | (n << (32 - b))) >>> 0;
}

/** Compute SHA-256 over an array of bytes; returns 32 byte values. */
export function sha256(bytes: number[]): number[] {
  const h = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];
  const msg = bytes.slice();
  const origLen = msg.length;
  msg.push(0x80);
  while (msg.length % 64 !== 56) msg.push(0);
  const bitLen = origLen * 8;
  msg.push(0, 0, 0, 0);
  msg.push((bitLen >>> 24) & 0xff, (bitLen >>> 16) & 0xff, (bitLen >>> 8) & 0xff, bitLen & 0xff);

  for (let chunk = 0; chunk < msg.length; chunk += 64) {
    const w = new Array<number>(64);
    for (let i = 0; i < 16; i++) {
      w[i] = ((msg[chunk + i * 4] << 24) | (msg[chunk + i * 4 + 1] << 16) |
              (msg[chunk + i * 4 + 2] << 8) | msg[chunk + i * 4 + 3]) >>> 0;
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + S1 + ch + SHA256_K[i] + w[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      hh = g; g = f; f = e; e = (d + t1) >>> 0;
      d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    h[0] = (h[0] + a) >>> 0;
    h[1] = (h[1] + b) >>> 0;
    h[2] = (h[2] + c) >>> 0;
    h[3] = (h[3] + d) >>> 0;
    h[4] = (h[4] + e) >>> 0;
    h[5] = (h[5] + f) >>> 0;
    h[6] = (h[6] + g) >>> 0;
    h[7] = (h[7] + hh) >>> 0;
  }
  const out: number[] = [];
  for (const v of h) {
    out.push((v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff);
  }
  return out;
}

/** Format byte array as colon-separated uppercase hex (openssl fingerprint style). */
export function formatFingerprint(bytes: number[]): string {
  return bytes.map((b) => b.toString(16).padStart(2, "0").toUpperCase()).join(":");
}

/** Compute SHA-1 fingerprint as colon-separated uppercase hex. */
export function sha1Hex(bytes: number[]): string {
  return formatFingerprint(sha1(bytes));
}

/** Compute SHA-256 fingerprint as colon-separated uppercase hex. */
export function sha256Hex(bytes: number[]): string {
  return formatFingerprint(sha256(bytes));
}

/** Compute both fingerprints. */
export function computeFingerprints(der: number[]): { sha1: string; sha256: string } {
  return { sha1: sha1Hex(der), sha256: sha256Hex(der) };
}

// ---------------------------------------------------------------------------
// Expiry check
// ---------------------------------------------------------------------------

/** Days between two ISO timestamps. */
export function daysBetween(fromIso: string, toIso: string): number {
  const a = Date.parse(fromIso);
  const b = Date.parse(toIso);
  if (isNaN(a) || isNaN(b)) return 0;
  return Math.floor((b - a) / 86400000);
}

/** Check expiry against a `now` instant (defaults to current time). */
export function checkExpiry(
  notBefore: string,
  notAfter: string,
  now: Date = new Date(),
): ExpiryCheck {
  const nowMs = now.getTime();
  const nb = Date.parse(notBefore);
  const na = Date.parse(notAfter);
  const status = nowMs < nb ? "not-yet-valid" : nowMs > na ? "expired" : "valid";
  const daysRemaining = Math.floor((na - nowMs) / 86400000);
  const daysSinceIssue = Math.floor((nowMs - nb) / 86400000);
  const totalValidityDays = Math.max(1, Math.floor((na - nb) / 86400000));
  const percentElapsed = Math.max(0, Math.min(100, Math.round((daysSinceIssue / totalValidityDays) * 100)));
  return {
    status, notBefore, notAfter,
    daysRemaining, daysSinceIssue, totalValidityDays, percentElapsed,
  };
}

// ---------------------------------------------------------------------------
// Self-signed detection
// ---------------------------------------------------------------------------

/** Extract the CN value from a DistinguishedName (or null). */
export function getCn(dn: DistinguishedName): string | null {
  const cn = dn.attributes.find((a) => a.oid === "2.5.4.3");
  return cn ? cn.value : null;
}

/** True if subject and issuer are byte-identical (RFC 5280 self-signed test). */
export function isSelfSigned(cert: DecodedCertificate): boolean {
  return cert.subject.rfc4514 === cert.issuer.rfc4514 && cert.subject.rfc4514 !== "";
}

// ---------------------------------------------------------------------------
// Chain-order validation
// ---------------------------------------------------------------------------

/**
 * Validate the order of a PEM chain. Each cert's issuer DN must match the
 * next cert's subject DN. The final cert is assumed to be the trust anchor
 * (root / self-signed).
 */
export function validateChain(certs: DecodedCertificate[]): ChainValidation {
  const issues: ValidationIssue[] = [];
  const order = certs.map((c) => getCn(c.subject) ?? c.subject.rfc4514 ?? "(unknown)");
  if (certs.length === 0) {
    return { ok: false, issues: [{ level: "error", message: "No certificates to validate." }], order };
  }
  if (certs.length === 1) {
    return {
      ok: true,
      issues: [{ level: "info", message: "Single certificate — chain order not applicable." }],
      order,
    };
  }
  for (let i = 0; i < certs.length - 1; i++) {
    const leaf = certs[i];
    const issuer = certs[i + 1];
    if (leaf.issuer.rfc4514 !== issuer.subject.rfc4514) {
      issues.push({
        level: "error",
        message: `Chain break at position ${i + 1}: cert subject "${getCn(leaf.subject) ?? "(unknown)"}" is issued by "${getCn(leaf.issuer) ?? "(unknown)"}" but the next cert's subject is "${getCn(issuer.subject) ?? "(unknown)"}".`,
      });
    }
  }
  const root = certs[certs.length - 1];
  if (!isSelfSigned(root)) {
    issues.push({
      level: "warning",
      message: `Final cert "${getCn(root.subject) ?? "(unknown)"}" is not self-signed — chain may be missing a root.`,
    });
  }
  return { ok: issues.every((i) => i.level !== "error"), issues, order };
}

// ---------------------------------------------------------------------------
// SAN-vs-hostname matching (wildcard-aware)
// ---------------------------------------------------------------------------

/** Match a hostname against a single SAN DNS name (supports leading *. wildcard). */
export function matchHostnameOne(sanDns: string, hostname: string): boolean {
  const san = sanDns.trim().toLowerCase().replace(/^\*\./, "");
  const host = hostname.trim().toLowerCase();
  if (sanDns.trim().toLowerCase().startsWith("*.")) {
    // Wildcard matches exactly one leftmost label
    const idx = host.indexOf(".");
    if (idx <= 0) return false;
    const tail = host.slice(idx + 1);
    return tail === san;
  }
  return host === san;
}

/** True if any DNS SAN matches the given hostname. */
export function matchHostname(sans: SanEntry[], hostname: string): boolean {
  const host = hostname.trim().toLowerCase();
  if (!host) return false;
  return sans.some((s) => s.type === "DNS" && matchHostnameOne(s.value, host));
}

// ---------------------------------------------------------------------------
// Weakness detection
// ---------------------------------------------------------------------------

/** Check a cert for weak signature algorithm, short key, and self-signedness. */
export function detectWeaknesses(cert: DecodedCertificate): WeaknessCheck {
  const issues: ValidationIssue[] = [];
  let hasWeakSig = false;
  let hasWeakKey = false;

  if (WEAK_SIG_ALGORITHMS.has(cert.signatureAlgorithm)) {
    hasWeakSig = true;
    issues.push({
      level: "warning",
      message: `Signature algorithm "${cert.signatureAlgorithm}" is cryptographically weak. Re-issue with SHA-256 or stronger.`,
    });
  }
  if (cert.publicKey.algorithm === "rsaEncryption" &&
      cert.publicKey.bitLength !== null &&
      cert.publicKey.bitLength < MIN_RSA_BITS) {
    hasWeakKey = true;
    issues.push({
      level: "warning",
      message: `RSA key is ${cert.publicKey.bitLength} bits — below the ${MIN_RSA_BITS}-bit minimum. Re-issue with ≥ 2048 bits.`,
    });
  }
  const self = isSelfSigned(cert);
  if (self) {
    issues.push({
      level: "info",
      message: "Self-signed certificate (subject == issuer). Not trusted by browsers unless manually installed.",
    });
  }
  return { issues, hasWeakSig, hasWeakKey, isSelfSigned: self };
}

// ---------------------------------------------------------------------------
// OpenSSL command generator
// ---------------------------------------------------------------------------

/**
 * Generate openssl commands for a live-host TLS check. The commands are
 * copy-ready for a terminal — the tool never connects anywhere itself.
 */
export function generateOpensslCommands(host: string, port: number = DEFAULT_TLS_PORT): OpensslCommand[] {
  const h = host.trim().toLowerCase();
  if (!h) return [];
  const hp = `${h}:${port}`;
  const cmds: OpensslCommand[] = [
    {
      tool: "s_client",
      label: "Retrieve the full certificate chain",
      command: `openssl s_client -connect ${hp} -servername ${h} -showcerts </dev/null`,
      explanation: "Connect to the host with TLS, send SNI, and print every certificate in the chain. Redirection from /dev/null closes stdin so openssl exits cleanly.",
    },
    {
      tool: "x509",
      label: "One-liner expiry check",
      command: `echo | openssl s_client -connect ${hp} -servername ${h} 2>/dev/null | openssl x509 -noout -dates`,
      explanation: "Fetch the leaf cert and print its notBefore / notAfter dates. Useful for cron-job monitoring.",
    },
    {
      tool: "x509",
      label: "Full leaf-certificate decode",
      command: `echo | openssl s_client -connect ${hp} -servername ${h} 2>/dev/null | openssl x509 -noout -text`,
      explanation: "Print the human-readable X.509 dump (subject, issuer, SAN, key usage, …).",
    },
    {
      tool: "x509",
      label: "Subject + issuer only",
      command: `echo | openssl s_client -connect ${hp} -servername ${h} 2>/dev/null | openssl x509 -noout -subject -issuer`,
      explanation: "Quick subject/issuer line. Pipe through `grep -v subject` etc. as needed.",
    },
    {
      tool: "x509",
      label: "Subject Alternative Names",
      command: `echo | openssl s_client -connect ${hp} -servername ${h} 2>/dev/null | openssl x509 -noout -ext subjectAltName`,
      explanation: "Print the SAN list. Required for verifying that the cert covers all hostnames you serve.",
    },
    {
      tool: "x509",
      label: "Serial number",
      command: `echo | openssl s_client -connect ${hp} -servername ${h} 2>/dev/null | openssl x509 -noout -serial`,
      explanation: "Print the certificate's serial number — useful for revocation lookups (OCSP / CRL).",
    },
    {
      tool: "x509",
      label: "SHA-256 fingerprint",
      command: `echo | openssl s_client -connect ${hp} -servername ${h} 2>/dev/null | openssl x509 -noout -fingerprint -sha256`,
      explanation: "Print the SHA-256 fingerprint of the leaf cert. Compare against a known-good value to detect tampering.",
    },
    {
      tool: "x509",
      label: "SHA-1 fingerprint (legacy)",
      command: `echo | openssl s_client -connect ${hp} -servername ${h} 2>/dev/null | openssl x509 -noout -fingerprint -sha1`,
      explanation: "Print the SHA-1 fingerprint. SHA-1 is deprecated for signing but still widely used for identification.",
    },
    {
      tool: "verify",
      label: "Verify chain (saved PEMs)",
      command: `cat cert.pem intermediate.pem > chain.pem && openssl verify -CAfile chain.pem -untrusted intermediate.pem cert.pem`,
      explanation: "After saving the leaf as cert.pem and intermediate as intermediate.pem, verify the chain locally. Replace chain.pem with your trust store for full verification.",
    },
    {
      tool: "s_client",
      label: "Negotiated protocol + cipher",
      command: `echo | openssl s_client -connect ${hp} -servername ${h} 2>/dev/null | grep -E "Protocol|Cipher|Server certificate"`,
      explanation: "Show the negotiated TLS protocol version (e.g. TLSv1.3) and cipher suite. Useful for hardening checks.",
    },
  ];
  return cmds;
}

/** Generate openssl commands for inspecting a saved PEM file (cert or CSR). */
export function generatePemInspectionCommands(filename: string, isCsr: boolean): OpensslCommand[] {
  const fn = filename.trim() || "cert.pem";
  if (isCsr) {
    return [
      {
        tool: "req",
        label: "Full CSR decode",
        command: `openssl req -in ${fn} -noout -text`,
        explanation: "Print the human-readable PKCS#10 CSR dump (subject, public key, requested extensions).",
      },
      {
        tool: "req",
        label: "CSR subject only",
        command: `openssl req -in ${fn} -noout -subject`,
        explanation: "Print just the subject DN from the CSR.",
      },
      {
        tool: "req",
        label: "CSR public key",
        command: `openssl req -in ${fn} -noout -pubkey`,
        explanation: "Print the SubjectPublicKeyInfo embedded in the CSR.",
      },
      {
        tool: "req",
        label: "CSR SAN extension",
        command: `openssl req -in ${fn} -noout -text | grep -A1 "Subject Alternative Name"`,
        explanation: "Extract any requested Subject Alternative Names from the CSR.",
      },
    ];
  }
  return [
    {
      tool: "x509",
      label: "Full cert decode",
      command: `openssl x509 -in ${fn} -noout -text`,
      explanation: "Print the human-readable X.509 certificate dump.",
    },
    {
      tool: "x509",
      label: "Subject + issuer",
      command: `openssl x509 -in ${fn} -noout -subject -issuer`,
      explanation: "Print the subject and issuer DNs.",
    },
    {
      tool: "x509",
      label: "Validity dates",
      command: `openssl x509 -in ${fn} -noout -dates`,
      explanation: "Print notBefore and notAfter.",
    },
    {
      tool: "x509",
      label: "Serial number",
      command: `openssl x509 -in ${fn} -noout -serial`,
      explanation: "Print the certificate's serial number.",
    },
    {
      tool: "x509",
      label: "SHA-256 fingerprint",
      command: `openssl x509 -in ${fn} -noout -fingerprint -sha256`,
      explanation: "Print the SHA-256 fingerprint of the certificate.",
    },
    {
      tool: "x509",
      label: "Subject Alternative Name",
      command: `openssl x509 -in ${fn} -noout -ext subjectAltName`,
      explanation: "Print the SAN list embedded in the certificate.",
    },
    {
      tool: "x509",
      label: "Convert PEM → DER",
      command: `openssl x509 -in ${fn} -outform der -out cert.der`,
      explanation: "Convert the PEM cert to binary DER form (e.g. for Java keystore import).",
    },
    {
      tool: "x509",
      label: "Convert PEM → PKCS#12 (with key)",
      command: `openssl pkcs12 -export -in ${fn} -inkey key.pem -out cert.p12 -name "alias"`,
      explanation: "Bundle the cert + private key into a PKCS#12 (.p12) file. Requires the matching private key.",
    },
  ];
}

// ---------------------------------------------------------------------------
// Field explanations
// ---------------------------------------------------------------------------

const FIELD_EXPLANATIONS: FieldExplanation[] = [
  {
    field: "Subject",
    short: "Who the cert is for",
    long: "The Distinguished Name (DN) of the entity the certificate identifies. For TLS server certs, the Common Name (CN) and Subject Alternative Names (SANs) must match the hostname the client connects to. Modern clients match against SANs; CN is legacy.",
  },
  {
    field: "Issuer",
    short: "Who signed the cert",
    long: "The DN of the Certificate Authority (CA) that issued this cert. If issuer == subject, the cert is self-signed (untrusted by default).",
  },
  {
    field: "Validity",
    short: "notBefore → notAfter",
    long: "The time window during which the cert is valid. Outside this window, clients MUST treat the cert as invalid (expired or not-yet-valid). Most CAs issue for 90–398 days.",
  },
  {
    field: "Serial",
    short: "Unique within the issuer",
    long: "A positive integer assigned by the issuer. Must be unique per issuer. Used in OCSP / CRL revocation checks (the serial + issuer identify a cert).",
  },
  {
    field: "Public Key",
    short: "Algorithm + bit length",
    long: "The subject's public key. RSA ≥2048 bits, ECDSA P-256/384/521, or Ed25519 are current best practice. RSA 1024 and ECDSA P-192 / Ed25519 below 256 bits are weak.",
  },
  {
    field: "Signature Algorithm",
    short: "How the issuer signed",
    long: "Algorithm the issuer used to sign the TBS (to-be-signed) cert fields. sha256WithRSAEncryption, ecdsa-with-SHA256, and Ed25519 are current. md5WithRSAEncryption, sha1WithRSAEncryption, and ecdsa-with-SHA1 are deprecated.",
  },
  {
    field: "Subject Alternative Name",
    short: "SAN list",
    long: "A list of DNS names, IP addresses, email addresses, or URIs the cert covers. RFC 6125 mandates that clients match the hostname against SAN entries, not the CN. A wildcard like *.example.com matches exactly one leftmost label.",
  },
  {
    field: "Key Usage",
    short: "What the key may do",
    long: "Bit flags describing the cryptographic operations the public key may be used for (digitalSignature, keyEncipherment, keyCertSign, …). For a TLS server cert, expect digitalSignature + keyEncipherment (RSA) or just digitalSignature (ECDSA/Ed25519).",
  },
  {
    field: "Extended Key Usage",
    short: "What the cert may be used for",
    long: "OIDs restricting the cert to specific purposes: serverAuth (TLS server), clientAuth (TLS client), codeSigning, emailProtection, timeStamping, OCSPSigning. A TLS server cert MUST include serverAuth.",
  },
  {
    field: "Basic Constraints",
    short: "CA: TRUE or FALSE",
    long: "Marks whether the cert is a CA (may sign other certs). End-entity (leaf) certs MUST have CA:FALSE or omit the extension. A pathLenConstraint may also limit how deep a CA can sign.",
  },
  {
    field: "Fingerprint",
    short: "SHA-1 / SHA-256 of the DER",
    long: "A hash of the certificate's DER bytes. Used for pinning, comparison, and revocation checks. SHA-256 is preferred; SHA-1 is shown for legacy compatibility.",
  },
];

/** Explain a single field by name (case-insensitive match on `field`). */
export function explainField(field: string): FieldExplanation | undefined {
  const f = field.trim().toLowerCase();
  return FIELD_EXPLANATIONS.find((e) => e.field.toLowerCase() === f);
}

/** Return all known field explanations. */
export function explainAllFields(): FieldExplanation[] {
  return FIELD_EXPLANATIONS;
}

/** Explain a PEM block label (what kind of object the user pasted). */
export function explainPemLabel(label: string): string {
  switch (label) {
    case "CERTIFICATE": return "An X.509 TLS certificate (RFC 5280). Decoded in full — subject, issuer, validity, SAN, key, fingerprints.";
    case "CERTIFICATE REQUEST": return "A PKCS#10 Certificate Signing Request (RFC 2986). Sent to a CA to obtain a signed certificate.";
    case "X509 CRL": return "An X.509 Certificate Revocation List. Lists certs revoked by a CA before their notAfter date.";
    case "PRIVATE KEY":
    case "RSA PRIVATE KEY":
    case "EC PRIVATE KEY":
    case "ENCRYPTED PRIVATE KEY": return "A private key. Private keys MUST NEVER be pasted into a web tool — the tool reports the label and fingerprints only and does not parse the key material.";
    case "PUBLIC KEY": return "A SubjectPublicKeyInfo (RFC 5280) — the public half of a key pair, safe to share.";
    default: return `Unknown PEM label "${label}".`;
  }
}

// ---------------------------------------------------------------------------
// History (localStorage) — METADATA ONLY
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:ssl-tls-certificate-decoder-checker:history";
const HISTORY_MAX = 20;

export function loadHistory(): HistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(arr) ? arr.slice(0, HISTORY_MAX) : [];
  } catch {
    return [];
  }
}

export function saveHistory(entry: HistoryEntry): HistoryEntry[] {
  const next = [entry, ...loadHistory()].slice(0, HISTORY_MAX);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}

export function clearHistory(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Shareable URL (encodes only the active tab + a hostname — NEVER the PEM)
// ---------------------------------------------------------------------------

export function buildShareUrl(state: ShareState): string {
  const params = new URLSearchParams();
  if (state.tab) params.set("tab", state.tab);
  if (state.host) params.set("host", state.host);
  if (state.port) params.set("port", String(state.port));
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareState {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const tabRaw = params.get("tab") ?? "";
  const tab = tabRaw === "decode" || tabRaw === "commands" ? tabRaw : undefined;
  const host = params.get("host") ?? undefined;
  const portRaw = params.get("port");
  const port = portRaw && /^\d+$/.test(portRaw) ? parseInt(portRaw, 10) : undefined;
  return { tab, host, port };
}
