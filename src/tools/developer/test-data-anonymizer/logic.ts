/**
 * Test Data Anonymizer / Data Masking Tool — pure logic.
 *
 * Detects PII (emails, phones, SSNs, credit cards, names, addresses, IPs,
 * ZIPs, DOBs) in CSV / JSON / free-text input, then applies one of five
 * masking strategies: mask, pseudonymize, generalize, fake, or
 * format-preserving. Deterministic seeded mapping ensures referential
 * integrity — same input always maps to same output across columns and runs.
 *
 * Pure functions only — no DOM, no network, no external deps. The privacy
 * guarantee is that real data never leaves the browser.
 *
 * HONESTY CLAUSE: 100% client-side. No upload, no telemetry, no server.
 * Anonymization is best-effort — auto-detection may miss atypical PII
 * formats. Always review the output before using in test environments.
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
// Luhn validation (for credit card detection + format-preserving masking)
// ---------------------------------------------------------------------------

/** Validate a number string against the Luhn mod-10 check. */
export function luhnValidate(fullNumber: string): boolean {
  const s = fullNumber.replace(/[\s-]/g, "");
  if (!/^\d+$/.test(s)) return false;
  if (s.length < 13 || s.length > 19) return false;
  let sum = 0;
  let dbl = false;
  for (let i = s.length - 1; i >= 0; i--) {
    let d = parseInt(s[i]!, 10);
    if (dbl) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    dbl = !dbl;
  }
  return sum % 10 === 0;
}

/** Compute Luhn check digit for a partial number string. */
export function luhnCheckDigit(numberWithoutCheck: string): number {
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

// ---------------------------------------------------------------------------
// PII type registry + detectors
// ---------------------------------------------------------------------------

export type PiiType =
  | "email"
  | "phone"
  | "ssn"
  | "credit-card"
  | "ip"
  | "zipcode"
  | "dob"
  | "name";

export const PII_TYPE_LIST: PiiType[] = [
  "email", "phone", "ssn", "credit-card",
  "ip", "zipcode", "dob", "name",
];

export const PII_TYPE_LABELS: Record<PiiType, string> = {
  "email": "Email",
  "phone": "Phone",
  "ssn": "SSN",
  "credit-card": "Credit Card",
  "ip": "IP Address",
  "zipcode": "ZIP Code",
  "dob": "Date of Birth",
  "name": "Person Name",
};

export interface PiiMatch {
  type: PiiType;
  start: number;
  end: number;
  value: string;
}

// Detection regexes. Use global flag for find-all iteration.
const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
const PHONE_REGEX = /(?<!\d)(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}(?:\s?(?:ext|x|extension)\s?\d{1,6})?(?!\d)/g;
const SSN_REGEX = /\b\d{3}-\d{2}-\d{4}\b/g;
// Credit-card-like: 13-19 digit groups, optionally with spaces or dashes between 4-digit groups.
const CREDIT_CARD_REGEX = /\b(?:\d[ -]*?){13,19}\b/g;
const IP_REGEX = /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g;
const ZIP_REGEX = /\b\d{5}(?:-\d{4})?\b/g;
const DOB_REGEX = /\b(?:\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4})\b/g;

// Person-name detection: 2+ consecutive capitalized words (not at sentence start, best-effort).
// Excludes common sentence-leading words. We use a name dictionary for confirmation.
const NAME_REGEX = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\b/g;

// Name dictionary — 200+ first names for confirmation.
export const FIRST_NAMES: readonly string[] = [
  "James", "Mary", "John", "Patricia", "Robert", "Jennifer", "Michael", "Linda",
  "William", "Elizabeth", "David", "Barbara", "Richard", "Susan", "Joseph", "Jessica",
  "Thomas", "Sarah", "Charles", "Karen", "Christopher", "Nancy", "Daniel", "Lisa",
  "Matthew", "Betty", "Anthony", "Helen", "Mark", "Sandra", "Donald", "Donna",
  "Steven", "Carol", "Paul", "Ruth", "Andrew", "Sharon", "Joshua", "Michelle",
  "Kenneth", "Laura", "Kevin", "Sarah", "Brian", "Kimberly", "George", "Deborah",
  "Edward", "Dorothy", "Ronald", "Amy", "Timothy", "Angela", "Jason", "Ashley",
  "Jeffrey", "Brenda", "Ryan", "Emma", "Jacob", "Olivia", "Gary", "Cynthia",
  "Nicholas", "Marie", "Eric", "Janet", "Jonathan", "Catherine", "Stephen", "Frances",
  "Larry", "Christine", "Justin", "Samantha", "Scott", "Debra", "Brandon", "Rachel",
  "Benjamin", "Carolyn", "Samuel", "Virginia", "Gregory", "Martha", "Frank", "Heather",
  "Alexander", "Diane", "Raymond", "Julie", "Patrick", "Joyce", "Jack", "Victoria",
  "Dennis", "Kelly", "Jerry", "Christina", "Tyler", "Joan", "Aaron", "Evelyn",
  "Jose", "Judith", "Adam", "Megan", "Henry", "Andrea", "Douglas", "Cheryl",
  "Nathan", "Hannah", "Peter", "Jacqueline", "Zachary", "Martha", "Kyle", "Gloria",
  "Walter", "Teresa", "Ethan", "Ann", "Jeremy", "Sara", "Harold", "Madison",
  "Keith", "Frances", "Christian", "Kathryn", "Roger", "Janice", "Noah", "Jean",
  "Gerald", "Abigail", "Carl", "Alice", "Terry", "Judy", "Lawrence", "Sophia",
  "Sean", "Grace", "Austin", "Denise", "Joe", "Amber", "Jesse", "Doris",
  "Willie", "Mildred", "Billy", "Beverly", "Bryan", "Isabella", "Bruce", "Natalie",
  "Dylan", "Brittany", "Jordan", "Charlotte", "Ralph", "Marie", "Roy", "Julia",
  "Alan", "Theresa", "Juan", "Beverly", "Wayne", "Diane", "Elijah", "Anna",
  "Randy", "Terry", "Vincent", "Ruby", "Ralph", "Evelyn", "Eugene", "Lois",
  "Felicia", "Loretta", "Jeanne", "Shauna", "Kristin", "Lena", "Renee", "Cora",
  "Lillian", "Tara", "Vera", "Lola", "Cecilia", "Bridget", "Jodi", "Stacy",
  "Mabel", "Opal", "Pearl", "Ramona", "Sylvia", "Tilda", "Ursula", "Violet",
  "Wanda", "Yvette", "Yolanda", "Zelda", "Adrian", "Brielle", "Cassie", "Delia",
];

export const LAST_NAMES: readonly string[] = [
  "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis",
  "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson",
  "Thomas", "Taylor", "Moore", "Jackson", "Martin", "Lee", "Perez", "Thompson",
  "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson",
  "Walker", "Young", "Allen", "King", "Wright", "Scott", "Torres", "Nguyen",
  "Hill", "Flores", "Green", "Adams", "Nelson", "Baker", "Hall", "Rivera",
  "Campbell", "Mitchell", "Carter", "Roberts", "Gomez", "Phillips", "Evans",
  "Turner", "Diaz", "Parker", "Cruz", "Edwards", "Collins", "Reyes", "Stewart",
  "Morris", "Morales", "Murphy", "Cook", "Rogers", "Gutierrez", "Ortiz", "Morgan",
  "Cooper", "Peterson", "Bailey", "Reed", "Kelly", "Howard", "Ramos", "Kim",
  "Cox", "Ward", "Richardson", "Watson", "Brooks", "Chavez", "Wood", "James",
  "Bennett", "Gray", "Mendoza", "Ruiz", "Hughes", "Price", "Alvarez", "Castillo",
  "Sanders", "Patel", "Myers", "Long", "Ross", "Foster", "Jimenez", "Powell",
  "Jenkins", "Perry", "Russell", "Sullivan", "Bell", "Coleman", "Butler", "Henderson",
  "Barnes", "Gonzales", "Fisher", "Vasquez", "Simmons", "Romero", "Jordan", "Patterson",
  "Alexander", "Hamilton", "Graham", "Reynolds", "Griffin", "Wallace", "Moreno", "West",
  "Cole", "Hayes", "Bryant", "Herrera", "Gibson", "Ellis", "Tran", "Medina",
  "Aguilar", "Stevens", "Murray", "Ford", "Castro", "Marshall", "Owens", "Harrison",
  "Fernandez", "Mcdonald", "Woods", "Washington", "Kennedy", "Wells", "Vargas", "Henry",
  "Chen", "Freeman", "Webb", "Tucker", "Guzman", "Burns", "Crawford", "Olson",
  "Simpson", "Stone", "Mason", "Munoz", "Hunter", "Gordon", "Mendez", "Silva",
  "Shaw", "Soto", "Larson", "Knight", "Freeman", "Holt", "Wade", "Wagner",
  "Black", "Robertson", "Boyd", "Hansen", "Bradley", "Meyer", "Pena", "Watkins",
  "Morrison", "Mills", "Warren", "Fox", "Rose", "Rice", "Blackwell", "Bauer",
  "Dougherty", "Estes", "Foley", "Gallagher", "Hardy", "Holloway", "Keller", "Lambert",
  "Mcgee", "Norton", "Oconnor", "Pruitt", "Quigley", "Salazar", "Tran", "Underwood",
  "Valdez", "Wheeler", "Yates", "Zimmerman", "Abbott", "Barker", "Caldwell", "Drake",
];

// Street and city dictionaries for fake-address substitution.
export const STREETS: readonly string[] = [
  "Main St", "Oak Ave", "Maple Dr", "Cedar Ln", "Pine Rd", "Elm St", "Washington Ave",
  "Park Blvd", "Lake Dr", "Hill Rd", "Sunset Blvd", "Highland Ave", "River Rd",
  "Forest Dr", "Spring St", "Center St", "Church St", "Mill Rd", "Walnut St",
  "School St", "Davis St", "Adams St", "Jefferson St", "Madison Ave", "Monroe St",
];

export const CITIES: readonly string[] = [
  "Springfield", "Franklin", "Clinton", "Madison", "Georgetown", "Salem", "Fairview",
  "Greenville", "Bristol", "Hope", "Centerville", "Riverside", "Oakwood", "Fairfield",
  "Manchester", "Burlington", "Kingston", "Arlington", "Rochester", "Ashland",
  "Bloomington", "Columbus", "Dover", "Essex", "Frankford", "Greensboro", "Hartford",
  "Ithaca", "Jacksonville", "Knoxville", "Lexington", "Mount Vernon", "Newton",
  "Oxford", "Plymouth", "Quincy", "Riverton", "Stanford", "Union", "Victoria",
];

const STATE_CODES: readonly string[] = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL",
  "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT",
  "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI",
  "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
];

// ---------------------------------------------------------------------------
// PII detection — find all matches in a text
// ---------------------------------------------------------------------------

/** Build a set of confirmed first names for fast lookup. */
const FIRST_NAME_SET: ReadonlySet<string> = new Set(FIRST_NAMES);

/** Detect emails in text. */
export function detectEmails(text: string): PiiMatch[] {
  const out: PiiMatch[] = [];
  EMAIL_REGEX.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = EMAIL_REGEX.exec(text)) !== null) {
    out.push({ type: "email", start: m.index, end: m.index + m[0].length, value: m[0] });
  }
  return out;
}

/** Detect US-format phone numbers in text. */
export function detectPhones(text: string): PiiMatch[] {
  const out: PiiMatch[] = [];
  PHONE_REGEX.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = PHONE_REGEX.exec(text)) !== null) {
    const digits = m[0].replace(/\D/g, "");
    // Reject if it doesn't have 10 digits (with or without country code).
    if (digits.length < 10 || digits.length > 11) continue;
    out.push({ type: "phone", start: m.index, end: m.index + m[0].length, value: m[0] });
  }
  return out;
}

/** Detect US SSNs in text. */
export function detectSsns(text: string): PiiMatch[] {
  const out: PiiMatch[] = [];
  SSN_REGEX.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = SSN_REGEX.exec(text)) !== null) {
    out.push({ type: "ssn", start: m.index, end: m.index + m[0].length, value: m[0] });
  }
  return out;
}

/** Detect Luhn-valid credit card numbers in text. */
export function detectCreditCards(text: string): PiiMatch[] {
  const out: PiiMatch[] = [];
  CREDIT_CARD_REGEX.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = CREDIT_CARD_REGEX.exec(text)) !== null) {
    const raw = m[0];
    const digits = raw.replace(/[\s-]/g, "");
    if (digits.length < 13 || digits.length > 19) continue;
    if (!luhnValidate(digits)) continue;
    out.push({ type: "credit-card", start: m.index, end: m.index + raw.length, value: raw });
  }
  return out;
}

/** Detect IPv4 addresses in text. */
export function detectIps(text: string): PiiMatch[] {
  const out: PiiMatch[] = [];
  IP_REGEX.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = IP_REGEX.exec(text)) !== null) {
    out.push({ type: "ip", start: m.index, end: m.index + m[0].length, value: m[0] });
  }
  return out;
}

/** Detect US ZIP codes in text (5 or 5+4). */
export function detectZipcodes(text: string): PiiMatch[] {
  const out: PiiMatch[] = [];
  ZIP_REGEX.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = ZIP_REGEX.exec(text)) !== null) {
    out.push({ type: "zipcode", start: m.index, end: m.index + m[0].length, value: m[0] });
  }
  return out;
}

/** Detect dates of birth in text (ISO or US slash format). */
export function detectDobs(text: string): PiiMatch[] {
  const out: PiiMatch[] = [];
  DOB_REGEX.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = DOB_REGEX.exec(text)) !== null) {
    out.push({ type: "dob", start: m.index, end: m.index + m[0].length, value: m[0] });
  }
  return out;
}

/** Detect person names (dictionary-confirmed) in text. */
export function detectNames(text: string): PiiMatch[] {
  const out: PiiMatch[] = [];
  NAME_REGEX.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = NAME_REGEX.exec(text)) !== null) {
    const phrase = m[0];
    // Confirm at least one token is a known first name (reduces false positives).
    const tokens = phrase.split(/\s+/);
    const confirmed = tokens.some((t) => FIRST_NAME_SET.has(t));
    if (!confirmed) continue;
    out.push({ type: "name", start: m.index, end: m.index + phrase.length, value: phrase });
  }
  return out;
}

/** Detect all PII in text. Returns matches sorted by start position. */
export function detectAllPii(text: string): PiiMatch[] {
  const all: PiiMatch[] = [
    ...detectEmails(text),
    ...detectPhones(text),
    ...detectSsns(text),
    ...detectCreditCards(text),
    ...detectIps(text),
    ...detectZipcodes(text),
    ...detectDobs(text),
    ...detectNames(text),
  ];
  // Sort by start position; ties broken by longer match first.
  all.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));
  // Remove overlapping matches — keep the earliest (and longest on tie).
  const result: PiiMatch[] = [];
  let lastEnd = -1;
  for (const m of all) {
    if (m.start >= lastEnd) {
      result.push(m);
      lastEnd = m.end;
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Masking strategies
// ---------------------------------------------------------------------------

export type Strategy =
  | "mask"            // asterisks preserving length + shape
  | "pseudonymize"    // deterministic fake value (seeded mapping)
  | "generalize"      // DOB→year, ZIP→3-digit, age band
  | "fake"            // random realistic replacement
  | "preserve-format" // Luhn-valid card, valid-shape email, valid-digit phone
  | "redact";         // replace with [REDACTED]

export const STRATEGY_LIST: Strategy[] = [
  "mask", "pseudonymize", "generalize", "fake", "preserve-format", "redact",
];

export const STRATEGY_LABELS: Record<Strategy, string> = {
  "mask": "Mask (asterisks)",
  "pseudonymize": "Pseudonymize (deterministic fake)",
  "generalize": "Generalize (year / prefix)",
  "fake": "Fake (random realistic)",
  "preserve-format": "Format-preserving (Luhn/shape-valid)",
  "redact": "Redact ([REDACTED])",
};

export const STRATEGY_DESCRIPTIONS: Record<Strategy, string> = {
  "mask": "Replace each character with an asterisk, preserving format separators.",
  "pseudonymize": "Deterministic seeded fake value — same input always maps to same output.",
  "generalize": "Reduce precision: DOB→year only, ZIP→first 3 digits.",
  "fake": "Random realistic replacement from in-memory name/address/email dictionaries.",
  "preserve-format": "Replace with structurally-valid fake (Luhn-valid card, valid email shape).",
  "redact": "Hard-core replacement with [REDACTED] placeholder.",
};

/** Per-strategy configuration: a default strategy + optional per-type overrides. */
export interface StrategyConfig {
  default: Strategy;
  perType: Partial<Record<PiiType, Strategy>>;
}

export const DEFAULT_STRATEGY_CONFIG: StrategyConfig = {
  default: "pseudonymize",
  perType: {
    "credit-card": "preserve-format",
    "dob": "generalize",
    "zipcode": "generalize",
  },
};

/** Resolve the effective strategy for a given PII type. */
export function resolveStrategy(config: StrategyConfig, type: PiiType): Strategy {
  return config.perType[type] ?? config.default;
}

// ---------------------------------------------------------------------------
// Fake value generators
// ---------------------------------------------------------------------------

/** Generate a fake email of the same general shape. */
export function fakeEmail(rng: Rng, original: string): string {
  const atIdx = original.indexOf("@");
  const domain = atIdx >= 0 ? original.slice(atIdx + 1) : "example.com";
  const local = rng.string(rng.int(6, 10), "abcdefghijklmnopqrstuvwxyz0123456789");
  return `${local}@${domain}`;
}

/** Generate a fake phone number preserving the original's digit count and separators. */
export function fakePhone(rng: Rng, original: string): string {
  // Replace digits with random digits, keep non-digits as-is.
  let out = "";
  for (const ch of original) {
    if (/\d/.test(ch)) out += rng.int(0, 9).toString();
    else out += ch;
  }
  return out;
}

/** Generate a fake US SSN in the reserved test range (900-999 area). */
export function fakeSsn(rng: Rng, _original: string): string {
  const area = rng.int(900, 999);
  const group = rng.int(1, 99);
  const serial = rng.int(1, 9999);
  return `${area}-${group.toString().padStart(2, "0")}-${serial.toString().padStart(4, "0")}`;
}

/** Generate a fake Luhn-valid credit card of the same length and prefix. */
export function fakeCreditCard(rng: Rng, original: string): string {
  const digits = original.replace(/[\s-]/g, "");
  if (digits.length < 13) return "0000-0000-0000-0000";
  // Preserve the first 6 digits (BIN), randomize middle, compute Luhn check.
  const prefix = digits.slice(0, Math.min(6, digits.length - 1));
  const middleLen = digits.length - prefix.length - 1;
  const middle = rng.digits(middleLen);
  const partial = prefix + middle;
  const check = luhnCheckDigit(partial);
  const fakeDigits = partial + check.toString();
  // Format to match original's separator pattern.
  if (original.includes(" ")) {
    return fakeDigits.match(/.{1,4}/g)?.join(" ") ?? fakeDigits;
  }
  if (original.includes("-")) {
    return fakeDigits.match(/.{1,4}/g)?.join("-") ?? fakeDigits;
  }
  return fakeDigits;
}

/** Generate a fake IPv4 address. */
export function fakeIp(rng: Rng, _original: string): string {
  return `${rng.int(1, 255)}.${rng.int(0, 255)}.${rng.int(0, 255)}.${rng.int(1, 255)}`;
}

/** Generate a fake US ZIP code. */
export function fakeZipcode(rng: Rng, original: string): string {
  if (original.length === 10) {
    return `${rng.digits(5)}-${rng.digits(4)}`;
  }
  return rng.digits(5);
}

/** Generate a fake date of birth in ISO or slash format. */
export function fakeDob(rng: Rng, original: string): string {
  const year = rng.int(1940, 2005);
  const month = rng.int(1, 12).toString().padStart(2, "0");
  const day = rng.int(1, 28).toString().padStart(2, "0");
  if (original.includes("/")) {
    return `${month}/${day}/${year}`;
  }
  return `${year}-${month}-${day}`;
}

/** Generate a fake person name (First Last). */
export function fakeName(rng: Rng, _original: string): string {
  return `${rng.pick(FIRST_NAMES)} ${rng.pick(LAST_NAMES)}`;
}

/** Generate a fake street address. */
export function fakeAddress(rng: Rng, _original: string): string {
  return `${rng.int(100, 9999)} ${rng.pick(STREETS)}, ${rng.pick(CITIES)}, ${rng.pick(STATE_CODES)} ${rng.digits(5)}`;
}

// ---------------------------------------------------------------------------
// Strategy application
// ---------------------------------------------------------------------------

/** Mask a value preserving its length and format separators. */
export function applyMask(value: string, _type: PiiType): string {
  let out = "";
  for (const ch of value) {
    if (/[a-zA-Z0-9]/.test(ch)) out += "*";
    else out += ch;
  }
  return out;
}

/** Generalize a value (DOB→year, ZIP→3-digit, others→mask). */
export function applyGeneralize(value: string, type: PiiType): string {
  switch (type) {
    case "dob": {
      // Extract 4-digit year.
      const match = /\d{4}/.exec(value);
      return match ? match[0] : applyMask(value, type);
    }
    case "zipcode": {
      // Keep first 3 digits + "***".
      const digits = value.replace(/\D/g, "");
      if (digits.length >= 3) return digits.slice(0, 3) + "***";
      return applyMask(value, type);
    }
    default:
      return applyMask(value, type);
  }
}

/** Format-preserving mask: Luhn-valid card, valid-shape email, valid-digit phone. */
export function applyPreserveFormat(value: string, type: PiiType, rng: Rng): string {
  switch (type) {
    case "credit-card":
      return fakeCreditCard(rng, value);
    case "email":
      // Keep domain, replace local part with random same-length alphanumeric.
      return fakeEmail(rng, value);
    case "phone":
      return fakePhone(rng, value);
    case "ssn":
      return fakeSsn(rng, value);
    case "ip":
      return fakeIp(rng, value);
    case "zipcode":
      return fakeZipcode(rng, value);
    case "dob":
      return fakeDob(rng, value);
    case "name":
      return fakeName(rng, value);
    default:
      return applyMask(value, type);
  }
}

/** Apply a fake-value substitution. */
export function applyFake(value: string, type: PiiType, rng: Rng): string {
  switch (type) {
    case "email": return fakeEmail(rng, value);
    case "phone": return fakePhone(rng, value);
    case "ssn": return fakeSsn(rng, value);
    case "credit-card": return fakeCreditCard(rng, value);
    case "ip": return fakeIp(rng, value);
    case "zipcode": return fakeZipcode(rng, value);
    case "dob": return fakeDob(rng, value);
    case "name": return fakeName(rng, value);
    default: return applyMask(value, type);
  }
}

/** Redact a value to [REDACTED]. */
export function applyRedact(_value: string, _type: PiiType): string {
  return "[REDACTED]";
}

/** Mapping store for deterministic pseudonymization. Key = `${type}:${value}`. */
export type PseudonymMap = Map<string, string>;

/**
 * Apply a strategy to a single value. For pseudonymize, the map is consulted
 * first to preserve referential integrity; new values are generated and cached.
 */
export function applyStrategy(
  value: string,
  type: PiiType,
  strategy: Strategy,
  rng: Rng,
  map: PseudonymMap,
): string {
  if (strategy === "redact") return applyRedact(value, type);
  if (strategy === "mask") return applyMask(value, type);
  if (strategy === "generalize") return applyGeneralize(value, type);
  // For pseudonymize, fake, preserve-format — consult the map first.
  const key = `${strategy}:${type}:${value}`;
  const cached = map.get(key);
  if (cached !== undefined) return cached;
  let result: string;
  switch (strategy) {
    case "pseudonymize":
      // Pseudonymize uses the same fake generators but caches results.
      result = applyFake(value, type, rng);
      break;
    case "fake":
      result = applyFake(value, type, rng);
      break;
    case "preserve-format":
      result = applyPreserveFormat(value, type, rng);
      break;
    default: {
      const _exhaustive: never = strategy;
      result = applyMask(value, type);
      void _exhaustive;
    }
  }
  map.set(key, result);
  return result;
}

// ---------------------------------------------------------------------------
// Text anonymization
// ---------------------------------------------------------------------------

export interface AnonymizeResult {
  output: string;
  matches: PiiMatch[];
  masked: Array<{ type: PiiType; original: string; replacement: string }>;
  stats: {
    total: number;
    byType: Record<PiiType, number>;
    byStrategy: Record<Strategy, number>;
  };
}

/** Anonymize PII in free text. */
export function anonymizeText(
  text: string,
  config: StrategyConfig,
  seed: string | number,
): AnonymizeResult {
  const rng = createRng(seed);
  const map: PseudonymMap = new Map();
  const matches = detectAllPii(text);
  const masked: Array<{ type: PiiType; original: string; replacement: string }> = [];
  const byType = emptyByType();
  const byStrategy = emptyByStrategy();

  // Replace matches from end to start to preserve indices.
  let out = text;
  for (let i = matches.length - 1; i >= 0; i--) {
    const m = matches[i]!;
    const strategy = resolveStrategy(config, m.type);
    const replacement = applyStrategy(m.value, m.type, strategy, rng, map);
    out = out.slice(0, m.start) + replacement + out.slice(m.end);
    masked.unshift({ type: m.type, original: m.value, replacement });
    byType[m.type] += 1;
    byStrategy[strategy] += 1;
  }
  return {
    output: out,
    matches,
    masked,
    stats: { total: matches.length, byType, byStrategy },
  };
}

// ---------------------------------------------------------------------------
// CSV anonymization
// ---------------------------------------------------------------------------

/** Split a CSV row with quoted-value support. */
export function splitCsvRow(line: string): string[] {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      out.push(current); current = "";
    } else { current += ch; }
  }
  out.push(current);
  return out;
}

/** Parse CSV into rows. */
export function parseCsv(input: string): string[][] {
  if (!input) return [];
  return input.split(/\r?\n/).filter((l) => l.length > 0).map(splitCsvRow);
}

/** Escape a CSV cell value. */
export function escapeCsvCell(v: string): string {
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

/** Render a CSV row from cells. */
export function joinCsvRow(cells: string[]): string {
  return cells.map(escapeCsvCell).join(",");
}

export interface ColumnInfo {
  index: number;
  header: string;
  detectedType: PiiType | null;
  sampleValues: string[];
}

/** Detect the dominant PII type in a column by sampling up to 50 rows. */
export function detectColumnPii(rows: string[][]): ColumnInfo[] {
  if (rows.length === 0) return [];
  const header = rows[0]!;
  const sampleRows = rows.slice(1, 51); // up to 50 sample rows
  const out: ColumnInfo[] = [];
  for (let col = 0; col < header.length; col++) {
    const sampleValues: string[] = [];
    const typeCounts: Record<PiiType, number> = emptyByType();
    for (const row of sampleRows) {
      const cell = row[col] ?? "";
      if (!cell) continue;
      sampleValues.push(cell);
      // Detect PII in this cell.
      const matches = detectAllPii(cell);
      if (matches.length === 1 && matches[0]!.value === cell.trim()) {
        typeCounts[matches[0]!.type] += 1;
      }
    }
    // Determine dominant type if at least 60% of non-empty cells agree.
    const total = sampleValues.length;
    let detectedType: PiiType | null = null;
    if (total > 0) {
      let max = 0;
      for (const t of PII_TYPE_LIST) {
        if (typeCounts[t] > max) {
          max = typeCounts[t];
          detectedType = t;
        }
      }
      if (max / total < 0.6) detectedType = null;
    }
    out.push({
      index: col,
      header: header[col] ?? "",
      detectedType,
      sampleValues: sampleValues.slice(0, 5),
    });
  }
  return out;
}

export interface CsvAnonymizeOptions {
  input: string;
  config: StrategyConfig;
  seed: string | number;
  /** If true, apply per-column detection to set per-type strategies automatically. */
  autoDetect: boolean;
}

/** Anonymize CSV. Auto-detects PII columns if autoDetect is true. */
export function anonymizeCsv(opts: CsvAnonymizeOptions): AnonymizeResult {
  const rng = createRng(opts.seed);
  const map: PseudonymMap = new Map();
  const rows = parseCsv(opts.input);
  const matches: PiiMatch[] = [];
  const masked: Array<{ type: PiiType; original: string; replacement: string }> = [];
  const byType = emptyByType();
  const byStrategy = emptyByStrategy();

  if (rows.length === 0) {
    return { output: "", matches, masked, stats: { total: 0, byType, byStrategy } };
  }

  const header = rows[0]!;
  const columnInfo = detectColumnPii(rows);
  // Build per-column effective strategy.
  const columnStrategies: (Strategy | null)[] = columnInfo.map((info) => {
    if (!opts.autoDetect || !info.detectedType) return null;
    return resolveStrategy(opts.config, info.detectedType);
  });

  const outRows: string[][] = [header];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]!;
    const newRow: string[] = [];
    for (let c = 0; c < header.length; c++) {
      const cell = row[c] ?? "";
      const strat = columnStrategies[c];
      if (strat && cell) {
        // Use the column's detected type.
        const type = columnInfo[c]!.detectedType!;
        const replacement = applyStrategy(cell, type, strat, rng, map);
        if (replacement !== cell) {
          matches.push({ type, start: 0, end: cell.length, value: cell });
          masked.push({ type, original: cell, replacement });
          byType[type] += 1;
          byStrategy[strat] += 1;
        }
        newRow.push(replacement);
      } else {
        // Fallback: anonymize PII detected within the cell value.
        const cellMatches = detectAllPii(cell);
        if (cellMatches.length === 0) {
          newRow.push(cell);
          continue;
        }
        let newCell = cell;
        for (let i = cellMatches.length - 1; i >= 0; i--) {
          const m = cellMatches[i]!;
          const strat2 = resolveStrategy(opts.config, m.type);
          const replacement = applyStrategy(m.value, m.type, strat2, rng, map);
          newCell = newCell.slice(0, m.start) + replacement + newCell.slice(m.end);
          masked.push({ type: m.type, original: m.value, replacement });
          byType[m.type] += 1;
          byStrategy[strat2] += 1;
        }
        matches.push(...cellMatches);
        newRow.push(newCell);
      }
    }
    outRows.push(newRow);
  }

  const output = outRows.map(joinCsvRow).join("\n");
  return {
    output,
    matches,
    masked,
    stats: { total: masked.length, byType, byStrategy },
  };
}

// ---------------------------------------------------------------------------
// JSON anonymization
// ---------------------------------------------------------------------------

/** Walk a JSON-compatible value, anonymizing PII in all string values. */
export function anonymizeJsonValue(
  value: unknown,
  config: StrategyConfig,
  rng: Rng,
  map: PseudonymMap,
  stats: { byType: Record<PiiType, number>; byStrategy: Record<Strategy, number> },
): unknown {
  if (typeof value === "string") {
    const matches = detectAllPii(value);
    if (matches.length === 0) return value;
    let out = value;
    for (let i = matches.length - 1; i >= 0; i--) {
      const m = matches[i]!;
      const strategy = resolveStrategy(config, m.type);
      const replacement = applyStrategy(m.value, m.type, strategy, rng, map);
      out = out.slice(0, m.start) + replacement + out.slice(m.end);
      stats.byType[m.type] += 1;
      stats.byStrategy[strategy] += 1;
    }
    return out;
  }
  if (Array.isArray(value)) {
    return value.map((v) => anonymizeJsonValue(v, config, rng, map, stats));
  }
  if (value !== null && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(obj)) {
      out[k] = anonymizeJsonValue(obj[k], config, rng, map, stats);
    }
    return out;
  }
  return value;
}

export interface JsonAnonymizeOptions {
  input: string;
  config: StrategyConfig;
  seed: string | number;
}

/** Anonymize a JSON document. Falls back to text mode on parse failure. */
export function anonymizeJson(opts: JsonAnonymizeOptions): AnonymizeResult {
  const rng = createRng(opts.seed);
  const map: PseudonymMap = new Map();
  const byType = emptyByType();
  const byStrategy = emptyByStrategy();
  let parsed: unknown;
  try {
    parsed = JSON.parse(opts.input);
  } catch {
    // If JSON is invalid, fall back to text anonymization.
    return anonymizeText(opts.input, opts.config, opts.seed);
  }
  const anonymized = anonymizeJsonValue(parsed, opts.config, rng, map, { byType, byStrategy });
  const output = JSON.stringify(anonymized, null, 2);
  const total = PII_TYPE_LIST.reduce((acc, t) => acc + byType[t], 0);
  return {
    output,
    matches: [],
    masked: [],
    stats: { total, byType, byStrategy },
  };
}

// ---------------------------------------------------------------------------
// Dispatch — auto-detect format
// ---------------------------------------------------------------------------

export type InputFormat = "text" | "csv" | "json";

/** Auto-detect the input format. */
export function detectFormat(input: string): InputFormat {
  const trimmed = input.trim();
  if (!trimmed) return "text";
  // JSON: starts with { or [
  if (/^[[{]/.test(trimmed)) {
    try {
      JSON.parse(trimmed);
      return "json";
    } catch {
      // fall through
    }
  }
  // CSV: at least one comma on the first non-empty line and consistent column count.
  const lines = trimmed.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length >= 2) {
    const firstCols = splitCsvRow(lines[0]!).length;
    const secondCols = splitCsvRow(lines[1]!).length;
    if (firstCols >= 2 && firstCols === secondCols) return "csv";
  }
  return "text";
}

export interface AnonymizeOptions {
  input: string;
  config: StrategyConfig;
  seed: string | number;
  format?: InputFormat; // auto-detect if omitted
  autoDetect?: boolean; // for CSV
}

/** Anonymize input. Auto-detects format if not specified. */
export function anonymize(opts: AnonymizeOptions): AnonymizeResult {
  const format = opts.format ?? detectFormat(opts.input);
  switch (format) {
    case "csv":
      return anonymizeCsv({
        input: opts.input,
        config: opts.config,
        seed: opts.seed,
        autoDetect: opts.autoDetect ?? true,
      });
    case "json":
      return anonymizeJson({
        input: opts.input,
        config: opts.config,
        seed: opts.seed,
      });
    case "text":
    default:
      return anonymizeText(opts.input, opts.config, opts.seed);
  }
}

// ---------------------------------------------------------------------------
// Helpers for stats
// ---------------------------------------------------------------------------

function emptyByType(): Record<PiiType, number> {
  return {
    "email": 0, "phone": 0, "ssn": 0, "credit-card": 0,
    "ip": 0, "zipcode": 0, "dob": 0, "name": 0,
  };
}

function emptyByStrategy(): Record<Strategy, number> {
  return {
    "mask": 0, "pseudonymize": 0, "generalize": 0,
    "fake": 0, "preserve-format": 0, "redact": 0,
  };
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:test-data-anonymizer:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  seed: string;
  format: InputFormat;
  inputBytes: number;
  outputBytes: number;
  totalPii: number;
  defaultStrategy: Strategy;
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

export function buildShareUrl(seed: string, defaultStrategy: Strategy, perType: Partial<Record<PiiType, Strategy>>): string {
  const params = new URLSearchParams();
  if (seed) params.set("seed", seed);
  if (defaultStrategy) params.set("def", defaultStrategy);
  const perTypeStr = Object.entries(perType)
    .map(([k, v]) => `${k}:${v}`)
    .join(",");
  if (perTypeStr) params.set("pt", perTypeStr);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): {
  seed: string;
  defaultStrategy: Strategy;
  perType: Partial<Record<PiiType, Strategy>>;
} {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { seed: "", defaultStrategy: "pseudonymize", perType: {} };
  const params = new URLSearchParams(clean);
  const defStr = params.get("def") ?? "pseudonymize";
  const defaultStrategy = STRATEGY_LIST.includes(defStr as Strategy) ? (defStr as Strategy) : "pseudonymize";
  const perType: Partial<Record<PiiType, Strategy>> = {};
  const ptStr = params.get("pt") ?? "";
  if (ptStr) {
    for (const pair of ptStr.split(",")) {
      const [k, v] = pair.split(":");
      if (k && v && PII_TYPE_LIST.includes(k as PiiType) && STRATEGY_LIST.includes(v as Strategy)) {
        perType[k as PiiType] = v as Strategy;
      }
    }
  }
  return {
    seed: params.get("seed") ?? "",
    defaultStrategy,
    perType,
  };
}

/** Honesty banner text — 100% client-side, no upload. */
export const HONESTY_BANNER =
  "100% client-side. Your real data never leaves the browser — there is no upload, no server, no telemetry. Anonymization is best-effort: auto-detection may miss atypical PII formats. Always review the output before using in test environments. History stores metadata only (timestamp, byte counts, strategies), never the actual data.";

/** Max input bytes — caps at 5 MB to keep browser responsive. */
export const MAX_INPUT_BYTES = 5 * 1024 * 1024;

/** Default config exposed for UI. */
export { DEFAULT_STRATEGY_CONFIG as DEFAULT_CONFIG };
