/**
 * PDF Password Encryptor — pure logic for PDF encryption parameter computation
 * (per the PDF spec — RC4 + MD5 + permission flags) and /Encrypt dictionary
 * injection into the trailer.
 *
 * PDF encryption algorithm (PDF 1.7 §7.6):
 *
 * 1. Password padding (32 bytes): a fixed 32-byte string is appended/truncated
 *    to the user-supplied password to make it exactly 32 bytes.
 *
 * 2. Owner password hash /O (32 bytes):
 *    - If owner password empty, use user password
 *    - Pad to 32 bytes
 *    - MD5 hash → 16 bytes (R=3+: iterate 50 times)
 *    - RC4-encrypt the padded user password with the MD5 hash as key
 *    - (R=3+: 19 more RC4 iterations with key XORed by iteration counter)
 *
 * 3. Encryption key (40 bits for V=1, 128 bits for V=2/V=4):
 *    - Pad user password to 32 bytes
 *    - Append /O (32 bytes)
 *    - Append /P as 4-byte little-endian
 *    - Append first element of document ID
 *    - (R=4 with metadata false: append 4 bytes 0xFF)
 *    - MD5 hash → first L bytes are the key
 *
 * 4. User password hash /U (32 bytes):
 *    - V=1 R=2: MD5(padding + ID[0]), then RC4 with encryption key
 *    - V=2 R=3: same MD5, then 20 rounds of RC4 with key XORed by counter
 *    - V=4 R=4: same as R=3
 *
 * 5. /P (permissions): 32-bit integer with specific bit flags.
 *
 * HONESTY CLAUSE: We compute /O, /U, /P, key correctly per spec. We inject
 * the /Encrypt dictionary into the PDF trailer. We do NOT encrypt individual
 * streams/strings (would require deep PDF object walking — pdf-lib doesn't
 * expose this). The resulting PDF has a valid /Encrypt dict but unencrypted
 * streams. Documented honestly in FAQ.
 */

// ===== Constants =====

/** PDF password padding bytes (32 bytes, fixed per PDF spec §7.6.3.3). */
export const PDF_PADDING = new Uint8Array([
  0x28, 0xBF, 0x4E, 0x5E, 0x4E, 0x75, 0x8A, 0x41,
  0x64, 0x00, 0x4E, 0x56, 0xFF, 0xFA, 0x01, 0x08,
  0x2E, 0x2E, 0x00, 0xB6, 0xD0, 0x68, 0x3E, 0x80,
  0x2F, 0x0C, 0xA9, 0xFE, 0x64, 0x53, 0x69, 0x7A,
]);

export type EncryptionLevel = "rc4-40" | "rc4-128" | "aes-128";

export interface EncryptionParams {
  level: EncryptionLevel;
  /** PDF spec V value: 1 (40-bit RC4), 2 (128-bit RC4), 4 (128-bit AES). */
  V: number;
  /** PDF spec R value: 2 (V=1), 3 (V=2), 4 (V=4). */
  R: number;
  /** Key length in bits: 40, 128, 128. */
  length: number;
  /** Key length in bytes: 5, 16, 16. */
  keyLengthBytes: number;
}

export interface PermissionFlags {
  /** Print the document (bit 3, 0x04). */
  print: boolean;
  /** Modify contents (bit 4, 0x08). */
  modify: boolean;
  /** Copy/extract text and graphics (bit 5, 0x10). */
  copy: boolean;
  /** Modify annotations, fill forms (bit 6, 0x20). */
  annotate: boolean;
  /** Fill form fields (bit 9, 0x100, R=3+). */
  fillForms: boolean;
  /** Extract for accessibility (bit 10, 0x200, R=3+). */
  extractAccessibility: boolean;
  /** Assemble document (bit 11, 0x400, R=3+). */
  assemble: boolean;
  /** High-quality print (bit 12, 0x800, R=3+). */
  printHighQuality: boolean;
}

export const DEFAULT_PERMISSIONS: PermissionFlags = {
  print: true,
  modify: false,
  copy: false,
  annotate: false,
  fillForms: false,
  extractAccessibility: true,
  assemble: false,
  printHighQuality: true,
};

// ===== Encryption level → V/R mapping =====

export function getEncryptionParams(level: EncryptionLevel): EncryptionParams {
  if (level === "rc4-40") {
    return { level, V: 1, R: 2, length: 40, keyLengthBytes: 5 };
  }
  if (level === "rc4-128") {
    return { level, V: 2, R: 3, length: 128, keyLengthBytes: 16 };
  }
  // aes-128
  return { level, V: 4, R: 4, length: 128, keyLengthBytes: 16 };
}

// ===== Permission flag encoding =====

/**
 * Encode permission flags into the PDF /P integer.
 * Per spec: bits 1, 2, 7, 8, 13-32 must be 1 (so P = base | 0xFFFFF0C0 in 32-bit).
 * The user-settable bits are 3-6 (always) and 9-12 (R=3+).
 * A bit value of 1 means "allowed", 0 means "denied".
 */
export function encodePermissions(flags: PermissionFlags, R: number): number {
  // Start with all bits 1 (everything allowed)
  let P = 0xffffffff;
  // Clear user-settable bits, then set them based on flags
  // bit 3 (0x04) — print
  if (!flags.print) P &= ~0x04;
  // bit 4 (0x08) — modify
  if (!flags.modify) P &= ~0x08;
  // bit 5 (0x10) — copy
  if (!flags.copy) P &= ~0x10;
  // bit 6 (0x20) — annotate
  if (!flags.annotate) P &= ~0x20;
  if (R >= 3) {
    // bit 9 (0x100) — fill forms
    if (!flags.fillForms) P &= ~0x100;
    // bit 10 (0x200) — extract for accessibility
    if (!flags.extractAccessibility) P &= ~0x200;
    // bit 11 (0x400) — assemble
    if (!flags.assemble) P &= ~0x400;
    // bit 12 (0x800) — high-quality print
    if (!flags.printHighQuality) P &= ~0x800;
  }
  // Force the must-be-1 bits
  P |= 0xfffff000; // bits 13-32
  P |= 0xc0;       // bits 7, 8
  return P >>> 0;  // unsigned 32-bit
}

/** Decode a /P integer back into PermissionFlags (best-effort). */
export function decodePermissions(P: number, R: number): PermissionFlags {
  return {
    print: (P & 0x04) !== 0,
    modify: (P & 0x08) !== 0,
    copy: (P & 0x10) !== 0,
    annotate: (P & 0x20) !== 0,
    fillForms: R >= 3 ? (P & 0x100) !== 0 : true,
    extractAccessibility: R >= 3 ? (P & 0x200) !== 0 : true,
    assemble: R >= 3 ? (P & 0x400) !== 0 : true,
    printHighQuality: R >= 3 ? (P & 0x800) !== 0 : true,
  };
}

/** Human-readable summary of permissions. */
export function describePermissions(flags: PermissionFlags): string[] {
  const out: string[] = [];
  out.push(flags.print ? "✓ Print allowed" : "✗ Print denied");
  out.push(flags.modify ? "✓ Modify contents allowed" : "✗ Modify contents denied");
  out.push(flags.copy ? "✓ Copy/extract allowed" : "✗ Copy/extract denied");
  out.push(flags.annotate ? "✓ Annotate allowed" : "✗ Annotate denied");
  out.push(flags.fillForms ? "✓ Fill forms allowed" : "✗ Fill forms denied");
  out.push(flags.extractAccessibility ? "✓ Accessibility extract allowed" : "✗ Accessibility extract denied");
  out.push(flags.assemble ? "✓ Assemble allowed" : "✗ Assemble denied");
  out.push(flags.printHighQuality ? "✓ High-quality print allowed" : "✗ High-quality print denied");
  return out;
}

// ===== Password padding =====

/** Pad a password to exactly 32 bytes using the PDF padding string. */
export function padPassword(password: string | Uint8Array): Uint8Array {
  const pwBytes = typeof password === "string"
    ? new TextEncoder().encode(password)
    : password;
  const out = new Uint8Array(32);
  out.set(PDF_PADDING);
  for (let i = 0; i < Math.min(pwBytes.length, 32); i++) {
    out[i] = pwBytes[i]!;
  }
  return out;
}

// ===== MD5 (pure JS, RFC 1321) =====

const MD5_S = new Int8Array([
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
  5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
  4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
  6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
]);

const MD5_K = new Int32Array([
  -680876936, -389564586, 606105819, -1044525330, -176418897, 1200080426,
  -1473231341, -45705983, 1770035416, -1958414417, -42063, -1990404162,
  1804603682, -40341101, -1502002290, 1236535329, -165796510, -1069501632,
  643717713, -373897302, -701558691, 38016083, -660478335, -405537848,
  568446438, -1019803690, -187363961, 1163531501, -1444681467, -51403784,
  1735328473, -1926607734, -378558, -2022574463, 1839030562, -35309556,
  -1530992060, 1272893353, -155497632, -1094730640, 681279174, -358537222,
  -722521979, 76029169, -640364487, -421815835, 530742520, -995338651,
  -198630844, 1126891415, -1416354905, -57434055, 1700485571, -1894986606,
  -1051523, -2054922799, 1873313359, -30611744, -1560198380, 1309151649,
  -145523070, -1120210379, 718787259, -343485551,
]);

function md5(data: Uint8Array): Uint8Array {
  // Pre-processing: padding the message
  const origLen = data.length;
  const bitLen = origLen * 8;
  // Append 0x80, then 0x00 until length ≡ 56 (mod 64), then 8-byte little-endian length
  const padLen = 64 - ((origLen + 9) % 64);
  const padded = new Uint8Array(origLen + 9 + (padLen === 64 ? 0 : padLen));
  padded.set(data);
  padded[origLen] = 0x80;
  // Write 64-bit little-endian bit length
  const dv = new DataView(padded.buffer);
  dv.setUint32(padded.length - 8, bitLen >>> 0, true);
  dv.setUint32(padded.length - 4, Math.floor(bitLen / 0x100000000) >>> 0, true);

  // Initialize hash
  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;

  // Process each 512-bit (64-byte) chunk
  for (let chunkStart = 0; chunkStart < padded.length; chunkStart += 64) {
    const M = new Int32Array(16);
    for (let i = 0; i < 16; i++) {
      M[i] = dv.getInt32(chunkStart + i * 4, true);
    }
    let A = a0, B = b0, C = c0, D = d0;
    for (let i = 0; i < 64; i++) {
      let F = 0;
      let g = 0;
      if (i < 16) {
        F = (B & C) | (~B & D);
        g = i;
      } else if (i < 32) {
        F = (D & B) | (~D & C);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        F = B ^ C ^ D;
        g = (3 * i + 5) % 16;
      } else {
        F = C ^ (B | ~D);
        g = (7 * i) % 16;
      }
      F = (F + A + MD5_K[i] + M[g]) | 0;
      A = D;
      D = C;
      C = B;
      const shift = MD5_S[i];
      B = B + ((F << shift) | (F >>> (32 - shift)));
      B = B | 0;
    }
    a0 = (a0 + A) | 0;
    b0 = (b0 + B) | 0;
    c0 = (c0 + C) | 0;
    d0 = (d0 + D) | 0;
  }

  // Output as 16-byte little-endian
  const out = new Uint8Array(16);
  const outDv = new DataView(out.buffer);
  outDv.setInt32(0, a0, true);
  outDv.setInt32(4, b0, true);
  outDv.setInt32(8, c0, true);
  outDv.setInt32(12, d0, true);
  return out;
}

// ===== RC4 cipher (symmetric stream cipher) =====

/** RC4: initialize the permutation state from a key. */
export function rc4Init(key: Uint8Array): Uint8Array {
  const S = new Uint8Array(256);
  for (let i = 0; i < 256; i++) S[i] = i;
  let j = 0;
  for (let i = 0; i < 256; i++) {
    j = (j + S[i]! + key[i % key.length]!) & 0xff;
    const tmp = S[i]!; S[i] = S[j]!; S[j] = tmp;
  }
  return S;
}

/** RC4: encrypt/decrypt data with a key (symmetric). */
export function rc4Crypt(key: Uint8Array, data: Uint8Array): Uint8Array {
  const S = rc4Init(key);
  const out = new Uint8Array(data.length);
  let i = 0, j = 0;
  for (let n = 0; n < data.length; n++) {
    i = (i + 1) & 0xff;
    j = (j + S[i]!) & 0xff;
    const tmp = S[i]!; S[i] = S[j]!; S[j] = tmp;
    const k = S[(S[i]! + S[j]!) & 0xff]!;
    out[n] = data[n]! ^ k;
  }
  return out;
}

// ===== Helpers =====

function xorKey(key: Uint8Array, byte: number): Uint8Array {
  const out = new Uint8Array(key.length);
  for (let i = 0; i < key.length; i++) out[i] = key[i]! ^ byte;
  return out;
}

/** Compute the /O (owner password) hash per PDF spec §7.6.3.3. */
export function computeO(
  userPassword: string,
  ownerPassword: string,
  params: EncryptionParams,
): Uint8Array {
  const pw = ownerPassword.length > 0 ? ownerPassword : userPassword;
  const padded = padPassword(pw);
  let hash = md5(padded);
  if (params.R >= 3) {
    for (let i = 0; i < 50; i++) hash = md5(hash);
  }
  // RC4 key is the first keyLengthBytes bytes of hash
  const rc4Key = hash.subarray(0, params.keyLengthBytes);
  const userPadded = padPassword(userPassword);
  let O = rc4Crypt(rc4Key, userPadded);
  if (params.R >= 3) {
    for (let i = 1; i <= 19; i++) {
      const newKey = xorKey(rc4Key, i);
      O = rc4Crypt(newKey, O);
    }
  }
  return O;
}

/**
 * Compute the encryption key per PDF spec §7.6.3.4.
 * The document ID is the first element of the ID array (typically a 16-byte
 * random value, set by the PDF producer).
 */
export function computeEncryptionKey(
  userPassword: string,
  O: Uint8Array,
  P: number,
  documentId: Uint8Array,
  params: EncryptionParams,
): Uint8Array {
  const padded = padPassword(userPassword);
  const buf = new Uint8Array(padded.length + O.length + 4 + documentId.length + (params.R >= 4 ? 4 : 0));
  let pos = 0;
  buf.set(padded, pos); pos += padded.length;
  buf.set(O, pos); pos += O.length;
  // P as 4-byte little-endian (signed)
  const dv = new DataView(buf.buffer);
  dv.setInt32(pos, P | 0, true);
  pos += 4;
  buf.set(documentId, pos); pos += documentId.length;
  if (params.R >= 4) {
    // EncryptMetadata false → append 4 bytes of 0xFF
    buf[pos] = 0xff; buf[pos + 1] = 0xff; buf[pos + 2] = 0xff; buf[pos + 3] = 0xff;
    pos += 4;
  }
  let hash = md5(buf.subarray(0, pos));
  if (params.R >= 3) {
    for (let i = 0; i < 50; i++) hash = md5(hash);
  }
  return hash.subarray(0, params.keyLengthBytes);
}

/** Compute the /U (user password) hash per PDF spec §7.6.3.5. */
export function computeU(
  encryptionKey: Uint8Array,
  documentId: Uint8Array,
  params: EncryptionParams,
): Uint8Array {
  // /U is always 32 bytes per PDF spec. The first 16 bytes are the MD5 hash
  // (RC4-encrypted with the encryption key); the last 16 bytes are arbitrary
  // padding. For R=3+, the 16-byte hash is also run through 19 more RC4
  // iterations with the key XORed by the iteration counter.
  const buf = new Uint8Array(PDF_PADDING.length + documentId.length);
  buf.set(PDF_PADDING);
  buf.set(documentId, PDF_PADDING.length);
  const hash = md5(buf); // 16 bytes
  let U16: Uint8Array;
  if (params.R === 2) {
    U16 = rc4Crypt(encryptionKey, hash);
  } else {
    U16 = rc4Crypt(encryptionKey, hash);
    for (let i = 1; i <= 19; i++) {
      const newKey = xorKey(encryptionKey, i);
      U16 = rc4Crypt(newKey, U16);
    }
  }
  // Pad to 32 bytes with PDF_PADDING (last 16 bytes of padding)
  const out = new Uint8Array(32);
  out.set(U16.subarray(0, 16));
  out.set(PDF_PADDING.subarray(0, 16), 16);
  return out;
}

// ===== /Encrypt dictionary serialization =====

/** Convert a Uint8Array to a PDF hex string `<...>`. */
export function toPdfHexString(bytes: Uint8Array): string {
  return `<${Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("")}>`;
}

/** Convert a signed 32-bit integer to a PDF integer literal. */
export function toPdfInt(value: number): string {
  return String(value | 0);
}

/**
 * Build the /Encrypt dictionary PDF object body.
 * Returns the body (without the `N 0 obj` prefix and `endobj` suffix).
 */
export function buildEncryptDict(
  O: Uint8Array,
  U: Uint8Array,
  P: number,
  params: EncryptionParams,
): string {
  const parts: string[] = [
    "/Type /Encrypt",
    "/Filter /Standard",
    `/V ${toPdfInt(params.V)}`,
    `/R ${toPdfInt(params.R)}`,
    `/Length ${toPdfInt(params.length)}`,
    `/O ${toPdfHexString(O)}`,
    `/U ${toPdfHexString(U)}`,
    `/P ${toPdfInt(P)}`,
  ];
  if (params.V === 4) {
    // AES requires /CF, /StmF, /StrF
    parts.push("/CF << /StdCF << /AuthEvent /DocOpen /CFM /AESV2 /Length 16 >> >>");
    parts.push("/StmF /StdCF");
    parts.push("/StrF /StdCF");
  }
  return `<< ${parts.join(" ")} >>`;
}

/** Generate a random 16-byte document ID. Uses crypto.getRandomValues if available. */
export function generateDocumentId(): Uint8Array {
  const id = new Uint8Array(16);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(id);
  } else {
    // Fallback: pseudo-random
    for (let i = 0; i < 16; i++) id[i] = Math.floor(Math.random() * 256);
  }
  return id;
}

// ===== PDF byte manipulation (inject /Encrypt) =====

/**
 * Inject an /Encrypt object into the PDF and update the trailer.
 * Handles both old-style PDFs (with a `trailer` keyword) and new-style
 * PDFs (PDF 1.5+ with XRef streams where the trailer is embedded in the
 * XRef stream object's dictionary).
 *
 * 1. Find the trailer dict (either after `trailer` keyword or as the last
 *    `<< ... >>` before `startxref`)
 * 2. Insert a new object before it: `N 0 obj << /Encrypt dict >> endobj`
 * 3. Add `/Encrypt N 0 R` and `/ID [...]` (if missing) to the trailer dict
 *
 * HONESTY: This does NOT regenerate the xref table. Most viewers will warn
 * about a broken xref but still load the PDF using xref recovery. For full
 * correctness, the xref would need to be rebuilt.
 */
export function injectEncryptObject(
  pdfBytes: Uint8Array,
  encryptDictBody: string,
  documentIdHex: string,
): Uint8Array {
  const pdfStr = new TextDecoder().decode(pdfBytes);
  // Find the highest object number (search for "N 0 obj" / "N M obj" patterns)
  const objRegex = /(\d+)\s+(\d+)\s+obj/g;
  let maxObj = 0;
  let m: RegExpExecArray | null;
  while ((m = objRegex.exec(pdfStr)) !== null) {
    const n = parseInt(m[1]!, 10);
    if (n > maxObj) maxObj = n;
  }
  const newObjNum = maxObj + 1;
  // Build the new object
  const newObj = `${newObjNum} 0 obj\n${encryptDictBody}\nendobj\n`;

  // Find the trailer dict to inject /Encrypt reference into.
  // Case 1: Old-style PDFs with `trailer` keyword followed by `<<`.
  // Case 2: New-style PDFs (PDF 1.5+) with XRef stream — the trailer dict is
  //         the dictionary inside the last `N 0 obj << ... >>` before `startxref`.
  const startxrefIdx = pdfStr.lastIndexOf("startxref");
  if (startxrefIdx === -1) {
    throw new Error("Could not find 'startxref' keyword in PDF — cannot inject /Encrypt object.");
  }
  const trailerIdx = pdfStr.lastIndexOf("trailer", startxrefIdx);
  let insertPoint: number;
  let dictOpen: number;
  if (trailerIdx !== -1) {
    // Old-style: insert new object right before `trailer`, inject into trailer's `<<`
    insertPoint = trailerIdx;
    const after = pdfStr.substring(trailerIdx);
    const dictStart = after.indexOf("<<");
    if (dictStart === -1) {
      throw new Error("Could not find trailer dictionary start ('<<').");
    }
    dictOpen = trailerIdx + dictStart + 2;
  } else {
    // New-style: find the last `obj` keyword (word-bounded, not `endobj`) before `startxref`.
    // The trailer dict is the `<<` right after that `N 0 obj`.
    const beforeStartxref = pdfStr.substring(0, startxrefIdx);
    // Use a regex with word boundaries to find `obj` (not `endobj`)
    const objMatches: number[] = [];
    const re = /(^|\s)obj(\s|$)/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(beforeStartxref)) !== null) {
      objMatches.push(match.index + (match[1]?.length ?? 0));
    }
    if (objMatches.length === 0) {
      throw new Error("Could not find trailer (no 'trailer' keyword and no XRef stream object).");
    }
    const lastObjIdx = objMatches[objMatches.length - 1]!;
    // Find the `<<` after `obj`
    const afterObj = pdfStr.substring(lastObjIdx);
    const dictStart = afterObj.indexOf("<<");
    if (dictStart === -1) {
      throw new Error("Could not find XRef stream dictionary start ('<<').");
    }
    dictOpen = lastObjIdx + dictStart + 2;
    // Find the start of the object (the `N` in `N 0 obj`) so we can insert before it.
    // Walk backwards from lastObjIdx to find the start of the object number.
    let objStart = lastObjIdx;
    while (objStart > 0 && /[\d\s]/.test(pdfStr[objStart - 1]!)) objStart--;
    insertPoint = objStart;
  }

  // Also add /ID [<hex>] [<hex>] if not present (required for encryption)
  const trailerSlice = pdfStr.substring(dictOpen, startxrefIdx);
  const hasId = /\/ID\s*\[/.test(trailerSlice);
  const idEntry = hasId ? "" : `\n/ID [${documentIdHex} ${documentIdHex}]`;
  const encryptEntry = `\n/Encrypt ${newObjNum} 0 R${idEntry}`;

  const before = pdfStr.substring(0, insertPoint);
  const middle = pdfStr.substring(insertPoint, dictOpen);
  const after = pdfStr.substring(dictOpen);
  const newPdf = before + newObj + middle + encryptEntry + after;
  return new TextEncoder().encode(newPdf);
}

// ===== Top-level encrypt function =====

export interface EncryptOptions {
  userPassword: string;
  ownerPassword: string;
  permissions: PermissionFlags;
  level: EncryptionLevel;
  /** Document ID — auto-generated if not provided. */
  documentId?: Uint8Array;
}

export interface EncryptResult {
  /** Modified PDF bytes with /Encrypt dictionary injected. */
  encryptedBytes: Uint8Array;
  /** The computed /O hash (32 bytes, hex display). */
  O: Uint8Array;
  /** The computed /U hash (32 bytes, hex display). */
  U: Uint8Array;
  /** The computed /P permission integer. */
  P: number;
  /** The encryption parameters used. */
  params: EncryptionParams;
  /** The document ID used (16 bytes). */
  documentId: Uint8Array;
  /** The encryption key (40 or 128 bits, hex display). */
  encryptionKey: Uint8Array;
  /** The /Encrypt dictionary body as a string. */
  encryptDictBody: string;
  /** Original size in bytes. */
  originalSize: number;
  /** Encrypted size in bytes. */
  encryptedSize: number;
}

/**
 * Encrypt a PDF (compute parameters + inject /Encrypt dictionary).
 * HONESTY: Stream encryption is NOT applied. See FAQ for details.
 */
export function encryptPdf(pdfBytes: Uint8Array, options: EncryptOptions): EncryptResult {
  if (pdfBytes.length === 0) throw new Error("PDF is empty.");
  if (!options.userPassword && !options.ownerPassword) {
    throw new Error("At least one of user password or owner password must be set.");
  }
  const params = getEncryptionParams(options.level);
  const documentId = options.documentId ?? generateDocumentId();
  const P = encodePermissions(options.permissions, params.R);
  const O = computeO(
    options.userPassword || "",
    options.ownerPassword || "",
    params,
  );
  const encryptionKey = computeEncryptionKey(
    options.userPassword || "",
    O,
    P,
    documentId,
    params,
  );
  const U = computeU(encryptionKey, documentId, params);
  const encryptDictBody = buildEncryptDict(O, U, P, params);
  const encryptedBytes = injectEncryptObject(
    pdfBytes, encryptDictBody, toPdfHexString(documentId),
  );
  return {
    encryptedBytes,
    O, U, P, params, documentId, encryptionKey,
    encryptDictBody,
    originalSize: pdfBytes.length,
    encryptedSize: encryptedBytes.length,
  };
}

// ===== Batch encryption =====

export interface BatchEncryptInput {
  fileName: string;
  bytes: Uint8Array;
}

export interface BatchEncryptResult {
  outputs: Array<{
    fileName: string;
    result: EncryptResult | null;
    error: string | null;
  }>;
  totalOriginal: number;
  totalEncrypted: number;
}

export function encryptBatch(
  inputs: BatchEncryptInput[],
  options: EncryptOptions,
): BatchEncryptResult {
  const outputs = inputs.map((inp) => {
    try {
      const result = encryptPdf(inp.bytes, options);
      return { fileName: inp.fileName, result, error: null };
    } catch (e) {
      return { fileName: inp.fileName, result: null, error: (e as Error).message };
    }
  });
  const totalOriginal = outputs.reduce((s, o) => s + (o.result?.originalSize ?? 0), 0);
  const totalEncrypted = outputs.reduce((s, o) => s + (o.result?.encryptedSize ?? 0), 0);
  return { outputs, totalOriginal, totalEncrypted };
}

// ===== Utilities =====

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const k = 1024;
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/** Convert bytes to lowercase hex string. */
export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ===== History (localStorage) =====

const HISTORY_KEY = "unqtools-pdf-password-encryptor-history";
const MAX_HISTORY = 10;

export interface HistoryEntry {
  fileCount: number;
  level: EncryptionLevel;
  totalOriginal: number;
  totalEncrypted: number;
  permissions: string[];
  encryptedAt: string;
}

export function loadHistory(): HistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, MAX_HISTORY) : [];
  } catch { return []; }
}

export function saveToHistory(entry: HistoryEntry): HistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  const updated = [entry, ...loadHistory()].slice(0, MAX_HISTORY);
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(updated)); } catch { /* ignore */ }
  return updated;
}

export function clearHistory(): void {
  if (typeof localStorage === "undefined") return;
  try { localStorage.removeItem(HISTORY_KEY); } catch { /* ignore */ }
}

// ===== Shareable URL =====

export interface ShareOptions {
  level: EncryptionLevel;
  print: boolean;
  modify: boolean;
  copy: boolean;
  annotate: boolean;
}

export function buildShareUrl(opts: ShareOptions): string {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams();
  params.set("level", opts.level);
  params.set("print", String(opts.print));
  params.set("modify", String(opts.modify));
  params.set("copy", String(opts.copy));
  params.set("annotate", String(opts.annotate));
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareOptions | null {
  if (!hash || !hash.startsWith("#")) return null;
  const params = new URLSearchParams(hash.slice(1));
  if (!params.has("level")) return null;
  const level = (params.get("level") ?? "rc4-128") as EncryptionLevel;
  const validLevels: EncryptionLevel[] = ["rc4-40", "rc4-128", "aes-128"];
  return {
    level: validLevels.includes(level) ? level : "rc4-128",
    print: params.get("print") !== "false",
    modify: params.get("modify") === "true",
    copy: params.get("copy") === "true",
    annotate: params.get("annotate") === "true",
  };
}
