/**
 * Test ID Generator (SSN / Tax / National ID) — pure logic.
 *
 * Generates clearly-fake, format-valid national identifiers for testing,
 * using officially reserved or never-issued ranges wherever they exist so
 * output can never collide with a real person's ID. Per-country checksums
 * (Verhoeff, Luhn, mod-11, mod-23, mod-97, German mod-10) are implemented
 * for both generation and validation.
 *
 * Pure functions only — no DOM, no network, no external deps.
 *
 * HONESTY CLAUSE: These IDs are format-valid but UNASSIGNED. They are for
 * sandbox / testing only. They CANNOT be used as real identification.
 */

// ---------------------------------------------------------------------------
// PRNG — deterministic mulberry32 (shared design with other tools)
// ---------------------------------------------------------------------------

/** Mulberry32 — small fast deterministic PRNG. */
export function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hash a string or number seed to a 32-bit unsigned integer (FNV-1a). */
export function hashSeed(seed: string | number): number {
  if (typeof seed === "number" && Number.isFinite(seed)) return seed >>> 0;
  const str = String(seed);
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export interface Rng {
  next(): number;
  int(min: number, max: number): number;
  pick<T>(arr: readonly T[]): T;
  string(len: number, charset: string): string;
  digits(len: number): string;
}

/** Build a seeded RNG instance with helper methods. */
export function createRng(seed: string | number): Rng {
  const r = mulberry32(hashSeed(seed));
  const int = (min: number, max: number): number =>
    Math.floor(r() * (max - min + 1)) + min;
  const pick = <T,>(arr: readonly T[]): T => {
    if (arr.length === 0) throw new Error("pick: empty array");
    return arr[Math.floor(r() * arr.length)] as T;
  };
  const string = (len: number, charset: string): string => {
    let out = "";
    for (let i = 0; i < len; i++) out += charset[Math.floor(r() * charset.length)];
    return out;
  };
  const digits = (len: number): string => {
    let out = "";
    for (let i = 0; i < len; i++) out += Math.floor(r() * 10).toString();
    return out;
  };
  return { next: r, int, pick, string, digits };
}

// ---------------------------------------------------------------------------
// ID type registry
// ---------------------------------------------------------------------------

export type ChecksumAlgorithm =
  | "verhoeff"   // India Aadhaar
  | "luhn"       // Canada SIN
  | "mod11"      // Brazil CPF / CNPJ
  | "mod23"      // Spain NIF / DNI
  | "mod97"      // France INSEE / NIR
  | "mod10w"     // German Steuer-ID (weighted sum mod 10)
  | "structural"; // SSN/EIN/ITIN/NINO/PAN — no checksum, structural rules only

export type IdType =
  | "us-ssn"
  | "us-ein"
  | "us-itin"
  | "uk-nino"
  | "in-pan"
  | "in-aadhaar"
  | "de-steuer"
  | "br-cpf"
  | "br-cnpj"
  | "ca-sin"
  | "es-nif"
  | "fr-insee";

export interface IdSpec {
  type: IdType;
  country: string;
  countryFlag: string;
  label: string;
  description: string;
  checksumAlgorithm: ChecksumAlgorithm;
  /** Reserved/never-issued range used for test output, if any. */
  reservedRange?: string;
  /** Display format hint (with separators). */
  formatHint: string;
  /** Plain-digit length (for checksum-bearing IDs). */
  digitLength: number;
}

export const ID_SPECS: Record<IdType, IdSpec> = {
  "us-ssn": {
    type: "us-ssn",
    country: "United States",
    countryFlag: "US",
    label: "US SSN",
    description: "Social Security Number — 9 digits, AAA-GG-SSSS.",
    checksumAlgorithm: "structural",
    reservedRange: "Area 900-999 (invalid per SSA, never issued)",
    formatHint: "AAA-GG-SSSS",
    digitLength: 9,
  },
  "us-ein": {
    type: "us-ein",
    country: "United States",
    countryFlag: "US",
    label: "US EIN",
    description: "Employer Identification Number — 9 digits, XX-XXXXXXX.",
    checksumAlgorithm: "structural",
    formatHint: "XX-XXXXXXX",
    digitLength: 9,
  },
  "us-itin": {
    type: "us-itin",
    country: "United States",
    countryFlag: "US",
    label: "US ITIN",
    description: "Individual Taxpayer Identification Number — 9 digits, 9XX-7X-XXXX.",
    checksumAlgorithm: "structural",
    reservedRange: "Area 900-999 + group 70-88 (IRS reserved for ITIN)",
    formatHint: "9XX-7X-XXXX",
    digitLength: 9,
  },
  "uk-nino": {
    type: "uk-nino",
    country: "United Kingdom",
    countryFlag: "UK",
    label: "UK NINO",
    description: "National Insurance Number — 2 letters + 6 digits + 1 letter.",
    checksumAlgorithm: "structural",
    reservedRange: "Prefixes TN, NT (administrative, never issued to real people)",
    formatHint: "LL NN NN NN L",
    digitLength: 8, // 2 letters + 6 digits; suffix letter is separate
  },
  "in-pan": {
    type: "in-pan",
    country: "India",
    countryFlag: "IN",
    label: "India PAN",
    description: "Permanent Account Number — 5 letters + 4 digits + 1 letter.",
    checksumAlgorithm: "structural",
    formatHint: "LLLLL NNNN L",
    digitLength: 10,
  },
  "in-aadhaar": {
    type: "in-aadhaar",
    country: "India",
    countryFlag: "IN",
    label: "India Aadhaar",
    description: "12-digit Verhoeff-checksummed UIDAI number.",
    checksumAlgorithm: "verhoeff",
    formatHint: "NNNN NNNN NNNN",
    digitLength: 12,
  },
  "de-steuer": {
    type: "de-steuer",
    country: "Germany",
    countryFlag: "DE",
    label: "German Steuer-ID",
    description: "Steueridentifikationsnummer — 11 digits, weighted-sum mod-10 check.",
    checksumAlgorithm: "mod10w",
    formatHint: "NNNNNNNNNNN",
    digitLength: 11,
  },
  "br-cpf": {
    type: "br-cpf",
    country: "Brazil",
    countryFlag: "BR",
    label: "Brazil CPF",
    description: "Cadastro de Pessoas Físicas — 11 digits, mod-11 check.",
    checksumAlgorithm: "mod11",
    formatHint: "NNN.NNN.NNN-NN",
    digitLength: 11,
  },
  "br-cnpj": {
    type: "br-cnpj",
    country: "Brazil",
    countryFlag: "BR",
    label: "Brazil CNPJ",
    description: "Cadastro Nacional da Pessoa Jurídica — 14 digits, mod-11 check.",
    checksumAlgorithm: "mod11",
    formatHint: "NN.NNN.NNN/NNNN-NN",
    digitLength: 14,
  },
  "ca-sin": {
    type: "ca-sin",
    country: "Canada",
    countryFlag: "CA",
    label: "Canada SIN",
    description: "Social Insurance Number — 9 digits, Luhn check, test prefix 9.",
    checksumAlgorithm: "luhn",
    reservedRange: "First digit 9 (temporary/resident SIN per Service Canada)",
    formatHint: "NNN-NNN-NNN",
    digitLength: 9,
  },
  "es-nif": {
    type: "es-nif",
    country: "Spain",
    countryFlag: "ES",
    label: "Spain NIF/DNI",
    description: "Número de Identificación Fiscal — 8 digits + mod-23 letter.",
    checksumAlgorithm: "mod23",
    formatHint: "NNNNNNNN-L",
    digitLength: 9, // 8 digits + 1 letter
  },
  "fr-insee": {
    type: "fr-insee",
    country: "France",
    countryFlag: "FR",
    label: "France INSEE/NIR",
    description: "Numéro d'inscription au répertoire — 15 digits, mod-97 control key.",
    checksumAlgorithm: "mod97",
    formatHint: "S YY MM DD TTT CCC NN",
    digitLength: 15,
  },
};

export const ID_TYPE_LIST: IdType[] = [
  "us-ssn", "us-ein", "us-itin",
  "uk-nino",
  "in-pan", "in-aadhaar",
  "de-steuer",
  "br-cpf", "br-cnpj",
  "ca-sin",
  "es-nif",
  "fr-insee",
];

export function getIdSpec(type: IdType): IdSpec {
  return ID_SPECS[type];
}

// ---------------------------------------------------------------------------
// Verhoeff algorithm (India Aadhaar)
// ---------------------------------------------------------------------------

// Verhoeff algorithm tables (d, p, inv)
const VERHOEFF_D: readonly (readonly number[])[] = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];

const VERHOEFF_P: readonly (readonly number[])[] = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

const VERHOEFF_INV: readonly number[] = [0, 4, 3, 2, 1, 5, 6, 7, 8, 9];

/** Compute Verhoeff check digit for a digit string (without check digit). */
export function verhoeffCheckDigit(numberWithoutCheck: string): number {
  if (!/^\d+$/.test(numberWithoutCheck)) {
    throw new Error("verhoeffCheckDigit: input must be all digits");
  }
  let c = 0;
  const len = numberWithoutCheck.length;
  for (let i = 0; i < len; i++) {
    const digit = parseInt(numberWithoutCheck[len - 1 - i]!, 10);
    c = VERHOEFF_D[c]![VERHOEFF_P[(i + 1) % 8]![digit]!]!;
  }
  return VERHOEFF_INV[c]!;
}

/** Validate a full Verhoeff number. */
export function verhoeffValidate(fullNumber: string): boolean {
  if (!/^\d+$/.test(fullNumber)) return false;
  if (fullNumber.length < 2) return false;
  let c = 0;
  const len = fullNumber.length;
  for (let i = 0; i < len; i++) {
    const digit = parseInt(fullNumber[len - 1 - i]!, 10);
    c = VERHOEFF_D[c]![VERHOEFF_P[i % 8]![digit]!]!;
  }
  return c === 0;
}

// ---------------------------------------------------------------------------
// Luhn algorithm (Canada SIN)
// ---------------------------------------------------------------------------

/** Compute Luhn check digit for a digit string (without check digit). */
export function luhnCheckDigit(numberWithoutCheck: string): number {
  if (!/^\d+$/.test(numberWithoutCheck)) {
    throw new Error("luhnCheckDigit: input must be all digits");
  }
  const digits = numberWithoutCheck.split("").reverse().map((d) => parseInt(d, 10));
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = digits[i]!;
    if (i % 2 === 0) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return (10 - (sum % 10)) % 10;
}

/** Validate a full Luhn number. */
export function luhnValidate(fullNumber: string): boolean {
  const s = fullNumber.replace(/[\s-]/g, "");
  if (!/^\d+$/.test(s)) return false;
  if (s.length < 2) return false;
  const withoutCheck = s.slice(0, -1);
  const providedCheck = parseInt(s.slice(-1), 10);
  return providedCheck === luhnCheckDigit(withoutCheck);
}

// ---------------------------------------------------------------------------
// mod-11 algorithm (Brazil CPF and CNPJ)
// ---------------------------------------------------------------------------

/** Compute Brazilian mod-11 check digit for a digit string + weight vector. */
export function mod11CheckDigit(numberWithoutCheck: string, weights: readonly number[]): number {
  if (!/^\d+$/.test(numberWithoutCheck)) {
    throw new Error("mod11CheckDigit: input must be all digits");
  }
  if (numberWithoutCheck.length !== weights.length) {
    throw new Error("mod11CheckDigit: weights length must match input length");
  }
  let sum = 0;
  for (let i = 0; i < numberWithoutCheck.length; i++) {
    sum += parseInt(numberWithoutCheck[i]!, 10) * weights[i]!;
  }
  const rem = sum % 11;
  return rem < 2 ? 0 : 11 - rem;
}

/** Compute both Brazil CPF check digits from the 9-digit base. */
export function cpfCheckDigits(base9: string): [number, number] {
  if (!/^\d{9}$/.test(base9)) {
    throw new Error("cpfCheckDigits: base must be 9 digits");
  }
  const w1 = [10, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [11, 10, 9, 8, 7, 6, 5, 4, 3, 2];
  const d1 = mod11CheckDigit(base9, w1);
  const d2 = mod11CheckDigit(base9 + d1.toString(), w2);
  return [d1, d2];
}

/** Compute both Brazil CNPJ check digits from the 12-digit base. */
export function cnpjCheckDigits(base12: string): [number, number] {
  if (!/^\d{12}$/.test(base12)) {
    throw new Error("cnpjCheckDigits: base must be 12 digits");
  }
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const d1 = mod11CheckDigit(base12, w1);
  const d2 = mod11CheckDigit(base12 + d1.toString(), w2);
  return [d1, d2];
}

/** Validate a Brazil CPF (11 digits). */
export function cpfValidate(full: string): boolean {
  const s = full.replace(/[\s.-]/g, "");
  if (!/^\d{11}$/.test(s)) return false;
  // Reject all-equal digits (00000000000, 11111111111, etc.) — known invalid.
  if (/^(\d)\1{10}$/.test(s)) return false;
  const base = s.slice(0, 9);
  const [d1, d2] = cpfCheckDigits(base);
  return parseInt(s.slice(9, 11), 10) === d1 * 10 + d2;
}

/** Validate a Brazil CNPJ (14 digits). */
export function cnpjValidate(full: string): boolean {
  const s = full.replace(/[\s./-]/g, "");
  if (!/^\d{14}$/.test(s)) return false;
  if (/^(\d)\1{13}$/.test(s)) return false;
  const base = s.slice(0, 12);
  const [d1, d2] = cnpjCheckDigits(base);
  return parseInt(s.slice(12, 14), 10) === d1 * 10 + d2;
}

// ---------------------------------------------------------------------------
// mod-23 letter (Spain NIF/DNI)
// ---------------------------------------------------------------------------

const NIF_LETTERS = "TRWAGMYFPDXBNJZSQVHLCKE";

/** Compute the NIF control letter for an 8-digit number. */
export function nifCheckLetter(number8: string): string {
  if (!/^\d{8}$/.test(number8)) {
    throw new Error("nifCheckLetter: input must be 8 digits");
  }
  // For X/Y/Z prefix (NIE), substitute X→0, Y→1, Z→2 before computing.
  const num = parseInt(number8, 10);
  return NIF_LETTERS[num % 23]!;
}

/** Validate a Spain NIF/DNI (8 digits + letter) or NIE (X/Y/Z + 7 digits + letter). */
export function nifValidate(full: string): boolean {
  const s = full.replace(/[\s-]/g, "").toUpperCase();
  // NIE: X/Y/Z + 7 digits + letter
  const nieMatch = /^([XYZ])(\d{7})([A-Z])$/.exec(s);
  if (nieMatch) {
    const prefix = nieMatch[1]!;
    const digits = nieMatch[2]!;
    const letter = nieMatch[3]!;
    const map: Record<string, string> = { X: "0", Y: "1", Z: "2" };
    const replaced = map[prefix]! + digits;
    return nifCheckLetter(replaced) === letter;
  }
  // DNI: 8 digits + letter
  const dniMatch = /^(\d{8})([A-Z])$/.exec(s);
  if (dniMatch) {
    const digits = dniMatch[1]!;
    const letter = dniMatch[2]!;
    return nifCheckLetter(digits) === letter;
  }
  return false;
}

// ---------------------------------------------------------------------------
// mod-97 control key (France INSEE/NIR)
// ---------------------------------------------------------------------------

/** Compute France INSEE 2-digit control key from the 13-digit base. */
export function inseeCheckKey(base13: string): number {
  if (!/^\d{13}$/.test(base13)) {
    throw new Error("inseeCheckKey: base must be 13 digits");
  }
  // For Corsica (department 2A / 2B), substitute A→0 and B→1.
  // Here base13 is already pure digits (we don't generate 2A/2B for test data).
  const num = parseInt(base13, 10);
  return 97 - (num % 97);
}

/** Validate a France INSEE/NIR (15 digits, last 2 = control key). */
export function inseeValidate(full: string): boolean {
  const s = full.replace(/[\s]/g, "");
  if (!/^\d{15}$/.test(s)) return false;
  const base = s.slice(0, 13);
  const providedKey = parseInt(s.slice(13, 15), 10);
  return inseeCheckKey(base) === providedKey;
}

// ---------------------------------------------------------------------------
// German Steuer-ID mod-10 weighted sum
// ---------------------------------------------------------------------------

/** Compute German Steuer-ID check digit (11th digit) using the weighted sum. */
export function germanSteuerCheckDigit(base10: string): number {
  if (!/^\d{10}$/.test(base10)) {
    throw new Error("germanSteuerCheckDigit: base must be 10 digits");
  }
  // Bundeszentralamt für Steuern: sum of digit × (i+1) for i = 0..9, check = sum mod 10.
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(base10[i]!, 10) * (i + 1);
  }
  return sum % 10;
}

/** Validate a German Steuer-ID (11 digits). */
export function germanSteuerValidate(full: string): boolean {
  const s = full.replace(/[\s]/g, "");
  if (!/^\d{11}$/.test(s)) return false;
  const base = s.slice(0, 10);
  const provided = parseInt(s.slice(10, 11), 10);
  return germanSteuerCheckDigit(base) === provided;
}

// ---------------------------------------------------------------------------
// Per-type generation (all use reserved/never-issued ranges where defined)
// ---------------------------------------------------------------------------

/** US SSN — uses area 900-999 (invalid per SSA, never issued). */
export function generateUsSsn(rng: Rng): string {
  const area = rng.int(900, 999); // reserved test range
  const group = rng.int(1, 99);   // 00 is invalid in real SSNs
  const serial = rng.int(1, 9999); // 0000 is invalid in real SSNs
  return `${area.toString().padStart(3, "0")}${group.toString().padStart(2, "0")}${serial.toString().padStart(4, "0")}`;
}

/** US EIN — 9 digits, format XX-XXXXXXX. No reserved test range, format-valid only. */
export function generateUsEin(rng: Rng): string {
  const prefix = rng.int(1, 99); // 00 is not a valid EIN prefix
  return prefix.toString().padStart(2, "0") + rng.digits(7);
}

/** US ITIN — 9XX-7X-XXXX, reserved range per IRS. */
export function generateUsItin(rng: Rng): string {
  const area = rng.int(900, 999);
  const group = rng.int(70, 88); // IRS-reserved ITIN group range
  const serial = rng.int(1, 9999);
  return `${area}${group.toString().padStart(2, "0")}${serial.toString().padStart(4, "0")}`;
}

// UK NINO letters — D, F, I, Q, U, V are not used as first letter;
// D, F, I, O, Q, U, V are not used as second letter. For test data we use
// the administrative prefixes TN and NT which are explicitly not issued.
const NINO_TEST_PREFIXES: readonly string[] = ["TN", "NT"];

/** UK NINO — uses administrative TN/NT prefix (never issued to real people). */
export function generateUkNino(rng: Rng): string {
  const prefix = rng.pick(NINO_TEST_PREFIXES);
  const digits = rng.digits(6);
  const suffix = rng.pick(["A", "B", "C", "D"]);
  return `${prefix}${digits}${suffix}`;
}

// India PAN — 4th char is holder type (P = individual for test data).
const PAN_HOLDER_TYPES: readonly string[] = ["P", "C", "H", "F", "A", "T", "B", "L", "J", "G"];

/** India PAN — 5 letters + 4 digits + 1 letter (4th char = holder type, 5th = surname initial). */
export function generateInPan(rng: Rng): string {
  const alpha = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const first3 = rng.string(3, alpha);
  const holderType = rng.pick(PAN_HOLDER_TYPES);
  const surnameInitial = rng.string(1, alpha);
  const digits = rng.digits(4);
  const last = rng.string(1, alpha);
  return `${first3}${holderType}${surnameInitial}${digits}${last}`;
}

/** India Aadhaar — 12 digits, Verhoeff checksum, first digit 2 (never 0 or 1). */
export function generateInAadhaar(rng: Rng): string {
  const firstDigit = rng.int(2, 9);
  const middle = rng.digits(10);
  const base = firstDigit.toString() + middle;
  const check = verhoeffCheckDigit(base);
  return base + check.toString();
}

/** German Steuer-ID — 11 digits, mod-10 weighted-sum check. */
export function generateDeSteuer(rng: Rng): string {
  const base = rng.digits(10);
  const check = germanSteuerCheckDigit(base);
  return base + check.toString();
}

/** Brazil CPF — 11 digits, mod-11 check, no all-equal digit pattern. */
export function generateBrCpf(rng: Rng): string {
  // Generate a 9-digit base avoiding all-equal-digit patterns.
  let base = "";
  do {
    base = rng.digits(9);
  } while (/^(\d)\1{8}$/.test(base));
  const [d1, d2] = cpfCheckDigits(base);
  return base + d1.toString() + d2.toString();
}

/** Brazil CNPJ — 14 digits, mod-11 check. */
export function generateBrCnpj(rng: Rng): string {
  const base = rng.digits(12);
  const [d1, d2] = cnpjCheckDigits(base);
  return base + d1.toString() + d2.toString();
}

/** Canada SIN — 9 digits, Luhn check, test prefix 9 (temporary/resident). */
export function generateCaSin(rng: Rng): string {
  // First digit 9 = temporary/resident SIN per Service Canada.
  // 9 digits total: 1 (prefix) + 7 (middle) + 1 (Luhn check).
  const middle = rng.digits(7);
  const base = "9" + middle; // 8 digits
  const check = luhnCheckDigit(base);
  return base + check.toString();
}

/** Spain NIF/DNI — 8 digits + mod-23 letter. */
export function generateEsNif(rng: Rng): string {
  // Avoid leading zero to keep DNI semantics (real DNIs are 7-digit serial + check).
  const firstDigit = rng.int(1, 9);
  const rest = rng.digits(7);
  const num = firstDigit.toString() + rest;
  const letter = nifCheckLetter(num);
  return num + letter;
}

/** France INSEE/NIR — 15 digits, mod-97 control key. */
export function generateFrInsee(rng: Rng): string {
  // Sex (1=M, 2=F) + YY MM + dept + commune + serial + control key
  const sex = rng.pick(["1", "2"]);
  const year = rng.string(2, "0123456789");
  const month = rng.int(1, 12).toString().padStart(2, "0");
  // Avoid dept 96, 98, 99 (used for abroad / unassigned). Avoid 2A/2B to keep digits-only.
  const deptPool = ["01", "02", "03", "04", "05", "75", "76", "13", "31", "44", "67", "69"];
  const dept = rng.pick(deptPool);
  const commune = rng.digits(3);
  const serial = rng.digits(3);
  const base = sex + year + month + dept + commune + serial;
  const key = inseeCheckKey(base).toString().padStart(2, "0");
  return base + key;
}

// ---------------------------------------------------------------------------
// Generation dispatch
// ---------------------------------------------------------------------------

export interface GeneratedId {
  type: IdType;
  /** Plain value without separators (canonical form). */
  value: string;
  /** Display-formatted value with separators. */
  formatted: string;
  country: string;
  label: string;
  checksumAlgorithm: ChecksumAlgorithm;
}

/** Format a value for display with country-specific separators. */
export function formatId(type: IdType, value: string): string {
  const digits = value.replace(/[\s.-]/g, "");
  switch (type) {
    case "us-ssn":
    case "us-itin":
      return digits.length === 9
        ? `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`
        : value;
    case "us-ein":
      return digits.length === 9
        ? `${digits.slice(0, 2)}-${digits.slice(2)}`
        : value;
    case "uk-nino":
      // 2 letters + 6 digits + 1 letter
      return /^[A-Z]{2}\d{6}[A-Z]$/.test(value)
        ? `${value.slice(0, 2)} ${value.slice(2, 4)} ${value.slice(4, 6)} ${value.slice(6, 8)} ${value.slice(8)}`
        : value;
    case "in-pan":
      return /^[A-Z]{5}\d{4}[A-Z]$/.test(value)
        ? `${value.slice(0, 5)} ${value.slice(5, 9)} ${value.slice(9)}`
        : value;
    case "in-aadhaar":
      return digits.length === 12
        ? `${digits.slice(0, 4)} ${digits.slice(4, 8)} ${digits.slice(8, 12)}`
        : value;
    case "de-steuer":
      return digits; // 11 digits, no separators
    case "br-cpf":
      return digits.length === 11
        ? `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`
        : value;
    case "br-cnpj":
      return digits.length === 14
        ? `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`
        : value;
    case "ca-sin":
      return digits.length === 9
        ? `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 9)}`
        : value;
    case "es-nif":
      // 8 digits + 1 letter (or NIE X/Y/Z + 7 digits + letter)
      return value.length === 9
        ? `${value.slice(0, 8)}-${value.slice(8)}`
        : value;
    case "fr-insee":
      // Sex YY MM dept commune serial key → S YY MM DDT CCC CCC NN
      if (digits.length === 15) {
        return `${digits.slice(0, 1)} ${digits.slice(1, 3)} ${digits.slice(3, 5)} ${digits.slice(5, 7)} ${digits.slice(7, 10)} ${digits.slice(10, 13)} ${digits.slice(13, 15)}`;
      }
      return value;
    default:
      return value;
  }
}

/** Strip separators and return the canonical digit/letter form for a type. */
export function normalizeId(type: IdType, input: string): string {
  const trimmed = (input || "").trim().toUpperCase();
  switch (type) {
    case "uk-nino":
    case "in-pan":
    case "es-nif":
      // Keep letters, strip only whitespace/separators.
      return trimmed.replace(/[\s.-]/g, "");
    default:
      // For digit-only IDs, strip everything that's not a digit.
      // But for es-nif which has letters too, we already handled above.
      return trimmed.replace(/[\s.\-/]/g, "");
  }
}

/** Generate a single ID of the given type. */
export function generateId(type: IdType, rng: Rng): GeneratedId {
  const spec = ID_SPECS[type];
  let value: string;
  switch (type) {
    case "us-ssn": value = generateUsSsn(rng); break;
    case "us-ein": value = generateUsEin(rng); break;
    case "us-itin": value = generateUsItin(rng); break;
    case "uk-nino": value = generateUkNino(rng); break;
    case "in-pan": value = generateInPan(rng); break;
    case "in-aadhaar": value = generateInAadhaar(rng); break;
    case "de-steuer": value = generateDeSteuer(rng); break;
    case "br-cpf": value = generateBrCpf(rng); break;
    case "br-cnpj": value = generateBrCnpj(rng); break;
    case "ca-sin": value = generateCaSin(rng); break;
    case "es-nif": value = generateEsNif(rng); break;
    case "fr-insee": value = generateFrInsee(rng); break;
    default: {
      const _exhaustive: never = type;
      throw new Error(`generateId: unknown type ${_exhaustive as string}`);
    }
  }
  return {
    type,
    value,
    formatted: formatId(type, value),
    country: spec.country,
    label: spec.label,
    checksumAlgorithm: spec.checksumAlgorithm,
  };
}

export interface BulkOptions {
  count: number;
  types?: IdType[]; // if omitted, random type per ID
  seed?: string | number;
}

/** Generate a batch of IDs. Caps at 5,000 per call. */
export function generateBulk(opts: BulkOptions): GeneratedId[] {
  const seed = opts.seed ?? Math.random().toString(36).slice(2);
  const rng = createRng(seed);
  const types = opts.types && opts.types.length > 0 ? opts.types : ID_TYPE_LIST;
  const n = Math.max(0, Math.min(opts.count, 5000));
  const out: GeneratedId[] = [];
  for (let i = 0; i < n; i++) {
    const type = types.length === 1 ? types[0]! : rng.pick(types);
    out.push(generateId(type, rng));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Validation dispatch
// ---------------------------------------------------------------------------

export interface ValidationResult {
  type: IdType;
  input: string;
  normalized: string;
  valid: boolean;
  reason: string;
}

/** Validate a single ID of the given type. Returns valid flag + reason. */
export function validateId(type: IdType, input: string): ValidationResult {
  const spec = ID_SPECS[type];
  const normalized = normalizeId(type, input);
  if (!normalized) {
    return { type, input, normalized, valid: false, reason: "Empty input" };
  }
  switch (type) {
    case "us-ssn": {
      if (!/^\d{9}$/.test(normalized)) return { type, input, normalized, valid: false, reason: "Must be 9 digits" };
      const area = parseInt(normalized.slice(0, 3), 10);
      const group = parseInt(normalized.slice(3, 5), 10);
      const serial = parseInt(normalized.slice(5, 9), 10);
      if (area === 0 || area === 666) return { type, input, normalized, valid: false, reason: "Area 000 and 666 are invalid (SSA)" };
      if (area >= 900) return { type, input, normalized, valid: true, reason: "Format-valid (reserved test area 900-999)" };
      if (group === 0) return { type, input, normalized, valid: false, reason: "Group 00 is invalid (SSA)" };
      if (serial === 0) return { type, input, normalized, valid: false, reason: "Serial 0000 is invalid (SSA)" };
      return { type, input, normalized, valid: true, reason: "Format-valid SSN" };
    }
    case "us-ein": {
      if (!/^\d{9}$/.test(normalized)) return { type, input, normalized, valid: false, reason: "Must be 9 digits" };
      const prefix = parseInt(normalized.slice(0, 2), 10);
      if (prefix === 0) return { type, input, normalized, valid: false, reason: "Prefix 00 is not a valid EIN campus prefix" };
      return { type, input, normalized, valid: true, reason: "Format-valid EIN" };
    }
    case "us-itin": {
      if (!/^\d{9}$/.test(normalized)) return { type, input, normalized, valid: false, reason: "Must be 9 digits" };
      const area = parseInt(normalized.slice(0, 3), 10);
      const group = parseInt(normalized.slice(3, 5), 10);
      if (area < 900) return { type, input, normalized, valid: false, reason: "ITIN must start with 9XX (900-999)" };
      if (group < 70 || group > 88) return { type, input, normalized, valid: false, reason: "ITIN group must be 70-88 (IRS reserved)" };
      return { type, input, normalized, valid: true, reason: "Format-valid ITIN (reserved 9XX-7X-XXXX range)" };
    }
    case "uk-nino": {
      if (!/^[A-Z]{2}\d{6}[A-Z]$/.test(normalized)) return { type, input, normalized, valid: false, reason: "Must be 2 letters + 6 digits + 1 letter" };
      // Reserved administrative prefixes are valid as test data.
      if (normalized === "TN000000A" || normalized.startsWith("TN") || normalized.startsWith("NT")) {
        return { type, input, normalized, valid: true, reason: "Administrative prefix (TN/NT) — never issued to real people" };
      }
      // Reject invalid first/second letters for non-admin prefixes.
      const first = normalized[0]!;
      const second = normalized[1]!;
      if ("DFIQUV".includes(first)) return { type, input, normalized, valid: false, reason: `First letter '${first}' not used in NINO` };
      if ("DFIOQUV".includes(second)) return { type, input, normalized, valid: false, reason: `Second letter '${second}' not used in NINO` };
      if (!" ABCD".includes(normalized[8]!)) return { type, input, normalized, valid: false, reason: "Suffix must be A, B, C, or D" };
      return { type, input, normalized, valid: true, reason: "Format-valid NINO" };
    }
    case "in-pan": {
      if (!/^[A-Z]{5}\d{4}[A-Z]$/.test(normalized)) return { type, input, normalized, valid: false, reason: "Must be 5 letters + 4 digits + 1 letter" };
      const holderType = normalized[3]!;
      if (!PAN_HOLDER_TYPES.includes(holderType)) return { type, input, normalized, valid: false, reason: `4th char '${holderType}' is not a valid PAN holder type` };
      return { type, input, normalized, valid: true, reason: "Format-valid PAN" };
    }
    case "in-aadhaar": {
      if (!/^\d{12}$/.test(normalized)) return { type, input, normalized, valid: false, reason: "Must be 12 digits" };
      if (normalized[0] === "0" || normalized[0] === "1") return { type, input, normalized, valid: false, reason: "Aadhaar cannot start with 0 or 1" };
      if (!verhoeffValidate(normalized)) return { type, input, normalized, valid: false, reason: "Verhoeff checksum mismatch" };
      return { type, input, normalized, valid: true, reason: "Verhoeff-valid Aadhaar" };
    }
    case "de-steuer": {
      if (!/^\d{11}$/.test(normalized)) return { type, input, normalized, valid: false, reason: "Must be 11 digits" };
      if (!germanSteuerValidate(normalized)) return { type, input, normalized, valid: false, reason: "Mod-10 weighted-sum check failed" };
      return { type, input, normalized, valid: true, reason: "Mod-10 valid German Steuer-ID" };
    }
    case "br-cpf": {
      if (!cpfValidate(normalized)) return { type, input, normalized, valid: false, reason: "CPF mod-11 check failed (or all-equal digit pattern)" };
      return { type, input, normalized, valid: true, reason: "Mod-11 valid CPF" };
    }
    case "br-cnpj": {
      if (!cnpjValidate(normalized)) return { type, input, normalized, valid: false, reason: "CNPJ mod-11 check failed" };
      return { type, input, normalized, valid: true, reason: "Mod-11 valid CNPJ" };
    }
    case "ca-sin": {
      if (!/^\d{9}$/.test(normalized)) return { type, input, normalized, valid: false, reason: "Must be 9 digits" };
      if (!luhnValidate(normalized)) return { type, input, normalized, valid: false, reason: "Luhn checksum mismatch" };
      if (normalized[0] === "9") return { type, input, normalized, valid: true, reason: "Luhn-valid SIN (temporary/resident test prefix 9)" };
      return { type, input, normalized, valid: true, reason: "Luhn-valid SIN" };
    }
    case "es-nif": {
      if (!nifValidate(normalized)) return { type, input, normalized, valid: false, reason: "Mod-23 letter check failed" };
      return { type, input, normalized, valid: true, reason: "Mod-23 valid NIF/DNI" };
    }
    case "fr-insee": {
      if (!/^\d{15}$/.test(normalized)) return { type, input, normalized, valid: false, reason: "Must be 15 digits" };
      if (!inseeValidate(normalized)) return { type, input, normalized, valid: false, reason: "Mod-97 control key mismatch" };
      return { type, input, normalized, valid: true, reason: "Mod-97 valid INSEE/NIR" };
    }
    default: {
      const _exhaustive: never = type;
      return { type, input, normalized, valid: false, reason: `Unknown type ${_exhaustive as string}` };
    }
  }
}

export interface BulkValidationOptions {
  type: IdType;
  inputs: string[];
}

/** Validate a batch of IDs (one per line). Caps at 10,000 rows. */
export function validateBulk(opts: BulkValidationOptions): ValidationResult[] {
  const rows = opts.inputs.slice(0, 10000);
  return rows.map((row) => validateId(opts.type, row));
}

export interface BulkValidationSummary {
  total: number;
  valid: number;
  invalid: number;
  sample: ValidationResult[];
}

/** Summarize bulk validation: total / valid / invalid + first 20 sample rows. */
export function summarizeBulkValidation(opts: BulkValidationOptions): BulkValidationSummary {
  const results = validateBulk(opts);
  const valid = results.filter((r) => r.valid).length;
  return {
    total: results.length,
    valid,
    invalid: results.length - valid,
    sample: results.slice(0, 20),
  };
}

// ---------------------------------------------------------------------------
// Export renderers
// ---------------------------------------------------------------------------

function escapeCsvCell(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function idsToJson(ids: GeneratedId[]): string {
  return JSON.stringify(ids.map((id) => ({
    type: id.type,
    value: id.value,
    formatted: id.formatted,
    country: id.country,
    label: id.label,
    checksumAlgorithm: id.checksumAlgorithm,
  })), null, 2);
}

export function idsToCsv(ids: GeneratedId[]): string {
  const headers = ["type", "value", "formatted", "country", "label", "checksum"];
  const lines = [headers.join(",")];
  for (const id of ids) {
    lines.push([
      escapeCsvCell(id.type),
      escapeCsvCell(id.value),
      escapeCsvCell(id.formatted),
      escapeCsvCell(id.country),
      escapeCsvCell(id.label),
      escapeCsvCell(id.checksumAlgorithm),
    ].join(","));
  }
  return lines.join("\n");
}

export function idsToText(ids: GeneratedId[]): string {
  return ids.map((id) => `${id.label}\t${id.formatted}`).join("\n");
}

export function resultsToJson(results: ValidationResult[]): string {
  return JSON.stringify(results, null, 2);
}

export function resultsToCsv(results: ValidationResult[]): string {
  const headers = ["type", "input", "normalized", "valid", "reason"];
  const lines = [headers.join(",")];
  for (const r of results) {
    lines.push([
      escapeCsvCell(r.type),
      escapeCsvCell(r.input),
      escapeCsvCell(r.normalized),
      escapeCsvCell(r.valid ? "valid" : "invalid"),
      escapeCsvCell(r.reason),
    ].join(","));
  }
  return lines.join("\n");
}

export function resultsToText(results: ValidationResult[]): string {
  return results.map((r) => `${r.valid ? "OK" : "FAIL"}\t${r.type}\t${r.input}\t${r.reason}`).join("\n");
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:test-id-generator:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  seed: string;
  count: number;
  types: IdType[];
  action: "generate" | "validate";
}

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
// Shareable URL
// ---------------------------------------------------------------------------

export function buildShareUrl(
  seed: string,
  count: number,
  types: IdType[],
): string {
  const params = new URLSearchParams();
  if (seed) params.set("seed", seed);
  if (count) params.set("count", String(count));
  if (types.length > 0) params.set("types", types.join(","));
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(
  hash: string,
): { seed: string; count: number; types: IdType[] } {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { seed: "", count: 10, types: [] };
  const params = new URLSearchParams(clean);
  const countStr = params.get("count") ?? "10";
  const parsedCount = parseInt(countStr, 10);
  const count = Number.isNaN(parsedCount) ? 10 : Math.max(1, Math.min(5000, parsedCount));
  const typesStr = params.get("types") ?? "";
  const types = typesStr
    ? typesStr.split(",").filter((t) => ID_TYPE_LIST.includes(t as IdType)) as IdType[]
    : [];
  return {
    seed: params.get("seed") ?? "",
    count,
    types,
  };
}

/** Honesty banner text — these are test-only IDs, never real. */
export const HONESTY_BANNER =
  "These IDs are format-valid (checksums pass) but UNASSIGNED — they use reserved or never-issued ranges where defined so they cannot match a real person's ID. They are for sandbox / testing only. Never use generated IDs against live government or financial systems.";

/** Default count used by the UI. */
export const DEFAULT_COUNT = 10;

/** Max count per bulk generate call. */
export const MAX_COUNT = 5000;

/** Max rows per bulk validate call. */
export const MAX_VALIDATE_ROWS = 10000;
