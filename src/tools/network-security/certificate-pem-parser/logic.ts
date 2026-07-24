/** Certificate PEM Parser — pure logic (best-effort ASN.1 decoding). */

export interface PemParseResult {
  valid: boolean;
  type: string;          // e.g. "CERTIFICATE", "PRIVATE KEY"
  base64: string;        // stripped, joined base64 body
  der: Uint8Array;       // decoded DER bytes
  derHex: string;
  warnings: string[];
  asn1TopLevel?: Asn1Node;
  errors: string[];
}

export interface Asn1Node {
  tag: number;
  tagClass: number;
  constructed: boolean;
  length: number;
  offset: number;
  children?: Asn1Node[];
  raw?: string; // hex of contents
}

const PEM_RE = /-----BEGIN ([A-Z0-9 ]+)-----\s*([\s\S]*?)-----END \1-----/;

function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/\s/g, "").replace(/-/g, "+").replace(/_/g, "/");
  const padded = clean + "=".repeat((4 - (clean.length % 4)) % 4);
  const bin = typeof atob === "function" ? atob(padded) : Buffer.from(padded, "base64").toString("binary");
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const TAG_CLASS_NAMES = ["universal", "application", "context", "private"];

function parseDerLength(bytes: Uint8Array, offset: number): { length: number; next: number } | null {
  if (offset >= bytes.length) return null;
  const first = bytes[offset]!;
  if (first < 0x80) return { length: first, next: offset + 1 };
  const numBytes = first & 0x7f;
  if (numBytes === 0 || offset + 1 + numBytes > bytes.length) return null;
  let length = 0;
  for (let i = 0; i < numBytes; i++) length = (length << 8) | bytes[offset + 1 + i]!;
  return { length, next: offset + 1 + numBytes };
}

function parseDerNode(bytes: Uint8Array, offset: number): { node: Asn1Node; next: number } | null {
  if (offset >= bytes.length) return null;
  const tagByte = bytes[offset]!;
  const tagClass = (tagByte >> 6) & 0x3;
  const constructed = (tagByte & 0x20) !== 0;
  const tag = tagByte & 0x1f;
  const lenInfo = parseDerLength(bytes, offset + 1);
  if (!lenInfo) return null;
  const contentStart = lenInfo.next;
  const contentEnd = contentStart + lenInfo.length;
  if (contentEnd > bytes.length) return null;
  const node: Asn1Node = { tag, tagClass, constructed, length: lenInfo.length, offset };
  if (constructed && tagClass === 0) {
    const children: Asn1Node[] = [];
    let cur = contentStart;
    while (cur < contentEnd) {
      const child = parseDerNode(bytes, cur);
      if (!child) break;
      children.push(child.node);
      cur = child.next;
    }
    node.children = children;
  } else {
    node.raw = bytesToHex(bytes.slice(contentStart, contentEnd));
  }
  return { node, next: contentEnd };
}

export function parse(pem: string): PemParseResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const m = PEM_RE.exec(pem);
  if (!m) {
    errors.push("No PEM block found. Expected -----BEGIN ... ----- ... -----END ... -----");
    return { valid: false, type: "", base64: "", der: new Uint8Array(0), derHex: "", warnings, errors };
  }
  const type = m[1]!;
  const base64 = m[2]!.replace(/\s/g, "");
  let der: Uint8Array;
  try {
    der = base64ToBytes(base64);
  } catch (e) {
    errors.push(`Base64 decode failed: ${(e as Error).message}`);
    return { valid: false, type, base64, der: new Uint8Array(0), derHex: "", warnings, errors };
  }
  const derHex = bytesToHex(der);
  const result: PemParseResult = { valid: true, type, base64, der, derHex, warnings, errors };
  try {
    const parsed = parseDerNode(der, 0);
    if (parsed) result.asn1TopLevel = parsed.node;
    else warnings.push("Could not parse ASN.1 structure.");
  } catch (e) {
    warnings.push(`ASN.1 parse error: ${(e as Error).message}`);
  }
  if (der.length > 65536) warnings.push("Large DER payload — performance may be affected.");
  return result;
}

export function summarize(r: PemParseResult): string {
  const lines = [`Type: ${r.type}`, `Base64 length: ${r.base64.length} chars`, `DER length: ${r.der.length} bytes`];
  if (r.asn1TopLevel) {
    lines.push(`Top-level tag: 0x${r.asn1TopLevel.tag.toString(16)} (${TAG_CLASS_NAMES[r.asn1TopLevel.tagClass]})`);
    lines.push(`Top-level length: ${r.asn1TopLevel.length}`);
    if (r.asn1TopLevel.children) lines.push(`Children: ${r.asn1TopLevel.children.length}`);
  }
  return lines.join("\n");
}
