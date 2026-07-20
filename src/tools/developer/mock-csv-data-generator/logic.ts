/**
 * Mock CSV Data Generator — pure logic.
 *
 * Generates realistic mock CSV/TSV/JSON datasets from column definitions.
 * Supports 20+ faker types, deterministic seedable PRNG, RFC 4180 strict
 * escaping, configurable delimiter/quoting/line-endings/BOM, blank %, unique
 * constraints, weighted enums, regex patterns, and column inference from a
 * pasted header row.
 *
 * Pure functions only — no DOM, no network, no external deps. The PRNG is a
 * deterministic mulberry32 seeded from a user-provided number/string so the
 * same seed always produces the same dataset.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type ColumnType =
  | "string"
  | "number"
  | "boolean"
  | "date"
  | "date_past"
  | "date_future"
  | "date_recent"
  | "date_iso"
  | "timestamp"
  | "email"
  | "phone"
  | "first_name"
  | "last_name"
  | "full_name"
  | "username"
  | "street"
  | "city"
  | "state"
  | "country"
  | "zip"
  | "company"
  | "job_title"
  | "sentence"
  | "paragraph"
  | "url"
  | "uuid"
  | "ipv4"
  | "ipv6"
  | "hex_color"
  | "age"
  | "money"
  | "enum"
  | "regex"
  | "constant";

export type Delimiter = "comma" | "semicolon" | "tab" | "pipe" | "custom";
export type QuotingPolicy = "always" | "minimal" | "none";
export type LineEnding = "lf" | "crlf";
export type OutputFormat = "csv" | "tsv" | "json";

export interface ColumnDef {
  name: string;
  type: ColumnType;
  /** Min for number / age. */
  min?: number;
  /** Max for number / age. */
  max?: number;
  /** Decimal scale for number/money. */
  scale?: number;
  /** Blank percent 0-100. */
  blankPercent?: number;
  /** Enforce uniqueness (collision-safe retry). */
  unique?: boolean;
  /** ENUM values (weighted: [["a", 3], ["b", 1]] → 75% a, 25% b). */
  enumValues?: Array<string | [string, number]>;
  /** Regex pattern (only when type === "regex"). */
  pattern?: string;
  /** Constant value (only when type === "constant"). */
  constantValue?: string;
  /** Date format (for date types). */
  dateFormat?: string;
}

export interface GenerateOptions {
  columns: ColumnDef[];
  rowCount: number;
  delimiter: Delimiter;
  customDelimiter?: string;
  quoting: QuotingPolicy;
  lineEnding: LineEnding;
  bom: boolean;
  header: boolean;
  seed?: string;
  /** Output format — defaults to "csv" if omitted. */
  format?: OutputFormat;
  /** Locale hint (currently unused but reserved for future i18n). */
  locale?: string;
}

export interface GenerateResult {
  rows: string[][];
  output: string;
  rowCount: number;
  columnCount: number;
  bytes: number;
  delimiterChar: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const COLUMN_TYPES: ColumnType[] = [
  "string", "number", "boolean", "date", "date_past", "date_future",
  "date_recent", "date_iso", "timestamp", "email", "phone",
  "first_name", "last_name", "full_name", "username", "street",
  "city", "state", "country", "zip", "company", "job_title",
  "sentence", "paragraph", "url", "uuid", "ipv4", "ipv6",
  "hex_color", "age", "money", "enum", "regex", "constant",
];

export const COLUMN_TYPE_LABELS: Record<ColumnType, string> = {
  string: "String (Lorem word)",
  number: "Number (int/decimal)",
  boolean: "Boolean (true/false)",
  date: "Date (YYYY-MM-DD)",
  date_past: "Date (past)",
  date_future: "Date (future)",
  date_recent: "Date (recent ±30d)",
  date_iso: "Date (ISO 8601 datetime)",
  timestamp: "Unix timestamp (ms)",
  email: "Email",
  phone: "Phone (+1 NPA NXX XXXX)",
  first_name: "First name",
  last_name: "Last name",
  full_name: "Full name",
  username: "Username",
  street: "Street address",
  city: "City",
  state: "State (US)",
  country: "Country",
  zip: "ZIP code (US)",
  company: "Company name",
  job_title: "Job title",
  sentence: "Sentence",
  paragraph: "Paragraph (3 sentences)",
  url: "URL",
  uuid: "UUID v4",
  ipv4: "IPv4 address",
  ipv6: "IPv6 address",
  hex_color: "Hex color (#RRGGBB)",
  age: "Age (18-90)",
  money: "Money (USD)",
  enum: "Enum (weighted)",
  regex: "Regex pattern",
  constant: "Constant value",
};

export const DELIMITER_CHARS: Record<Delimiter, string> = {
  comma: ",",
  semicolon: ";",
  tab: "\t",
  pipe: "|",
  custom: ",",
};

export const DEFAULT_COLUMNS: ColumnDef[] = [
  { name: "id", type: "number", min: 1, max: 1000000, unique: true },
  { name: "first_name", type: "first_name" },
  { name: "last_name", type: "last_name" },
  { name: "email", type: "email" },
  { name: "age", type: "age" },
  { name: "country", type: "country" },
  { name: "created_at", type: "date_iso" },
];

// ---------------------------------------------------------------------------
// Word/data banks (lightweight, in-file so we stay dependency-free)
// ---------------------------------------------------------------------------

const FIRST_NAMES = [
  "James", "Mary", "John", "Patricia", "Robert", "Jennifer", "Michael", "Linda",
  "William", "Elizabeth", "David", "Barbara", "Richard", "Susan", "Joseph",
  "Jessica", "Thomas", "Sarah", "Charles", "Karen", "Christopher", "Nancy",
  "Daniel", "Lisa", "Matthew", "Betty", "Anthony", "Margaret", "Mark", "Sandra",
  "Donald", "Ashley", "Steven", "Kimberly", "Paul", "Emily", "Andrew", "Donna",
  "Joshua", "Michelle", "Kenneth", "Carol", "Kevin", "Amanda", "Brian", "Dorothy",
  "George", "Melissa", "Edward", "Deborah", "Ronald", "Stephanie", "Timothy", "Rebecca",
  "Jason", "Sharon", "Jeffrey", "Laura", "Ryan", "Cynthia", "Jacob", "Kathleen",
  "Gary", "Amy", "Nicholas", "Shirley", "Eric", "Angela", "Jonathan", "Helen",
  "Stephen", "Anna", "Larry", "Brenda", "Justin", "Pamela", "Scott", "Nicole",
  "Brandon", "Emma", "Benjamin", "Samantha", "Samuel", "Katherine", "Gregory", "Christine",
  "Frank", "Debra", "Alexander", "Rachel", "Raymond", "Catherine", "Patrick", "Carolyn",
  "Jack", "Janet", "Dennis", "Ruth", "Jerry", "Maria", "Tyler", "Heather",
];

const LAST_NAMES = [
  "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis",
  "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson",
  "Thomas", "Taylor", "Moore", "Jackson", "Martin", "Lee", "Perez", "Thompson",
  "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson", "Walker",
  "Young", "Allen", "King", "Wright", "Scott", "Torres", "Nguyen", "Hill",
  "Flores", "Green", "Adams", "Nelson", "Baker", "Hall", "Rivera", "Campbell",
  "Mitchell", "Carter", "Roberts", "Gomez", "Phillips", "Evans", "Turner", "Diaz",
  "Parker", "Cruz", "Edwards", "Collins", "Reyes", "Stewart", "Morris", "Morales",
  "Murphy", "Cook", "Rogers", "Gutierrez", "Ortiz", "Morgan", "Cooper", "Peterson",
  "Bailey", "Reed", "Kelly", "Howard", "Ramos", "Kim", "Cox", "Ward",
  "Richardson", "Watson", "Brooks", "Chavez", "Wood", "James", "Bennett", "Gray",
  "Mendoza", "Ruiz", "Hughes", "Price", "Alvarez", "Castillo", "Sanders", "Patel",
];

const CITIES = [
  "New York", "Los Angeles", "Chicago", "Houston", "Phoenix", "Philadelphia",
  "San Antonio", "San Diego", "Dallas", "San Jose", "Austin", "Jacksonville",
  "Fort Worth", "Columbus", "Charlotte", "San Francisco", "Indianapolis",
  "Seattle", "Denver", "Washington", "Boston", "El Paso", "Nashville",
  "Detroit", "Oklahoma City", "Portland", "Las Vegas", "Memphis", "Louisville",
  "Baltimore", "Milwaukee", "Albuquerque", "Tucson", "Fresno", "Sacramento",
  "Kansas City", "Mesa", "Atlanta", "Omaha", "Miami", "London", "Paris",
  "Berlin", "Madrid", "Rome", "Toronto", "Vancouver", "Sydney", "Melbourne",
  "Tokyo", "Singapore", "Mumbai", "Dubai", "São Paulo", "Mexico City",
];

const STREETS = [
  "Main St", "Oak Ave", "Maple Dr", "Cedar Ln", "Pine Rd", "Elm St",
  "Washington Blvd", "Park Ave", "Lake Dr", "Hill Rd", "Sunset Blvd",
  "River Rd", "Highland Ave", "Spring St", "Forest Dr", "Lincoln Way",
  "Madison Ave", "Jefferson St", "Adams St", "Jackson St", "Franklin St",
  "Hamilton St", "Adams Ave", "Monroe St", "Lee St", "Roosevelt Blvd",
  "Kennedy Blvd", "Eisenhower Dr", "Church St", "Mill St", "Walnut St",
  "Chestnut St", "Willow Ln", "Birch Dr", "Spruce St", "Pearl St",
  "Front St", "Center St", "School St", "Union St", "Bridge St",
];

const STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID",
  "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS",
  "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK",
  "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV",
  "WI", "WY",
];

const COUNTRIES = [
  "United States", "Canada", "United Kingdom", "Australia", "Germany", "France",
  "Spain", "Italy", "Netherlands", "Belgium", "Sweden", "Norway", "Denmark",
  "Finland", "Poland", "Brazil", "Argentina", "Mexico", "Japan", "South Korea",
  "China", "India", "Singapore", "United Arab Emirates", "South Africa",
  "New Zealand", "Ireland", "Portugal", "Greece", "Switzerland", "Austria",
];

const COMPANIES = [
  "Acme Corp", "Globex Inc", "Initech", "Umbrella Corp", "Stark Industries",
  "Wayne Enterprises", "Cyberdyne Systems", "Tyrell Corp", "Soylent Corp",
  "Wonka Industries", "Hooli", "Pied Piper", "Vandelay Industries",
  "Wonka Industries", "Krusty Krab", "Dunder Mifflin", "Massive Dynamic",
  "Aperture Science", "Black Mesa", "Rupture Farms", "Sirius Cybernetics",
  "Tesseract", "Nakatomi Corp", "Weyland-Yutani", "Omni Consumer Products",
  "Monarch Industries", "Gekko & Co", "SPECTRE Holdings", "Imperial Tech",
  "Galactic Federation", "Uplink Corp", "Cyberlink", "Nimbus Labs",
];

const JOB_TITLES = [
  "Software Engineer", "Senior Developer", "Engineering Manager", "Product Manager",
  "Data Scientist", "DevOps Engineer", "Site Reliability Engineer", "Frontend Engineer",
  "Backend Engineer", "Full Stack Developer", "QA Engineer", "Test Engineer",
  "Security Engineer", "Cloud Architect", "Solutions Architect", "Tech Lead",
  "Engineering Director", "VP of Engineering", "CTO", "CIO", "Data Analyst",
  "UX Designer", "UI Designer", "Product Designer", "Scrum Master",
  "Agile Coach", "Technical Writer", "Developer Advocate", "Customer Success Manager",
  "Sales Engineer", "Account Executive", "Recruiter", "Office Manager",
];

const WORDS = [
  "lorem", "ipsum", "dolor", "sit", "amet", "consectetur", "adipiscing", "elit",
  "sed", "do", "eiusmod", "tempor", "incididunt", "ut", "labore", "et", "dolore",
  "magna", "aliqua", "enim", "ad", "minim", "veniam", "quis", "nostrud",
  "exercitation", "ullamco", "laboris", "nisi", "aliquip", "ex", "ea", "commodo",
  "consequat", "duis", "aute", "irure", "in", "reprehenderit", "voluptate",
  "velit", "esse", "cillum", "fugiat", "nulla", "pariatur", "excepteur", "sint",
  "occaecat", "cupidatat", "non", "proident", "sunt", "culpa", "qui", "officia",
  "deserunt", "mollit", "anim", "id", "est", "laborum", "veritatis", "et",
  "quasi", "architecto", "beatae", "vitae", "dicta", "explicabo", "nemo",
  "ipsam", "voluptatem", "quia", "voluptas", "aspernatur", "aut", "odit",
  "fugit", "sed", "quia", "consequuntur", "magni", "dolores", "eos", "ratione",
];

const TOP_LEVEL_DOMAINS = ["com", "org", "net", "io", "dev", "co", "app", "tech"];

// ---------------------------------------------------------------------------
// PRNG — mulberry32 (deterministic, seedable, fast)
// ---------------------------------------------------------------------------

export interface Rng {
  /** Float in [0, 1). */
  next(): number;
  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number;
  /** Pick a random element from arr. */
  pick<T>(arr: readonly T[]): T;
  /** Weighted pick — pairs of [value, weight]. */
  weighted<T>(pairs: Array<[T, number]>): T;
  /** Boolean with prob (0..1) of true. */
  bool(prob?: number): boolean;
}

/** Hash a string to a 32-bit unsigned integer (FNV-1a variant). */
export function hashSeed(s: string): number {
  const str = s || "default-seed";
  let h = 0x811c9dc5 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  if (h === 0) h = 0xdeadbeef;
  return h >>> 0;
}

/** Create a mulberry32 RNG from a numeric seed. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  function next(): number {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function int(min: number, max: number): number {
    if (max < min) { const t = min; min = max; max = t; }
    return Math.floor(next() * (max - min + 1)) + min;
  }
  function pick<T>(arr: readonly T[]): T {
    if (arr.length === 0) throw new Error("pick from empty array");
    return arr[int(0, arr.length - 1)];
  }
  function weighted<T>(pairs: Array<[T, number]>): T {
    const total = pairs.reduce((s, [, w]) => s + Math.max(0, w), 0);
    if (total <= 0) return pairs[0][0];
    let r = next() * total;
    for (const [v, w] of pairs) {
      r -= Math.max(0, w);
      if (r <= 0) return v;
    }
    return pairs[pairs.length - 1][0];
  }
  function bool(prob = 0.5): boolean { return next() < prob; }
  return { next, int, pick, weighted, bool };
}

/** Build an RNG from a seed string (or time-based if empty). */
export function buildRng(seed?: string): Rng {
  if (seed && seed.trim().length > 0) return mulberry32(hashSeed(seed));
  return mulberry32((Date.now() ^ (Math.random() * 0x100000000)) >>> 0);
}

// ---------------------------------------------------------------------------
// Value generators per column type
// ---------------------------------------------------------------------------

export function genUuid(rng: Rng): string {
  const hex = "0123456789abcdef";
  let s = "";
  for (let i = 0; i < 32; i++) {
    if (i === 8 || i === 12 || i === 16 || i === 20) s += "-";
    if (i === 12) s += "4";
    else if (i === 16) s += hex[(rng.int(0, 3))];
    else s += hex[rng.int(0, 15)];
  }
  return s;
}

export function genHexColor(rng: Rng): string {
  const h = "0123456789abcdef";
  let s = "#";
  for (let i = 0; i < 6; i++) s += h[rng.int(0, 15)];
  return s;
}

export function genIpv4(rng: Rng): string {
  return `${rng.int(1, 223)}.${rng.int(0, 255)}.${rng.int(0, 255)}.${rng.int(1, 254)}`;
}

export function genIpv6(rng: Rng): string {
  const parts: string[] = [];
  for (let i = 0; i < 8; i++) {
    parts.push(rng.int(0, 0xffff).toString(16));
  }
  return parts.join(":");
}

export function genEmail(rng: Rng): string {
  const first = rng.pick(FIRST_NAMES).toLowerCase();
  const last = rng.pick(LAST_NAMES).toLowerCase();
  const tld = rng.pick(TOP_LEVEL_DOMAINS);
  const variant = rng.int(0, 4);
  let local: string;
  switch (variant) {
    case 0: local = `${first}.${last}`; break;
    case 1: local = `${first}${rng.int(1, 99)}`; break;
    case 2: local = `${first[0]}${last}`; break;
    case 3: local = `${first}_${last}`; break;
    default: local = `${first}${last}${rng.int(1, 999)}`; break;
  }
  const domains = ["example", "test", "mock", "sample", "demo"];
  return `${local}@${rng.pick(domains)}.${tld}`;
}

export function genPhone(rng: Rng): string {
  const npa = rng.int(200, 989);
  const nxx = rng.int(200, 989);
  const xxxx = rng.int(1000, 9999);
  return `+1 ${npa} ${nxx} ${xxxx}`;
}

export function genFirstName(rng: Rng): string { return rng.pick(FIRST_NAMES); }
export function genLastName(rng: Rng): string { return rng.pick(LAST_NAMES); }
export function genFullName(rng: Rng): string {
  return `${rng.pick(FIRST_NAMES)} ${rng.pick(LAST_NAMES)}`;
}

export function genUsername(rng: Rng): string {
  const first = rng.pick(FIRST_NAMES).toLowerCase();
  const last = rng.pick(LAST_NAMES).toLowerCase();
  const variant = rng.int(0, 3);
  switch (variant) {
    case 0: return `${first}.${last}`;
    case 1: return `${first}${rng.int(1, 99)}`;
    case 2: return `${first[0]}${last}`;
    default: return `${first}_${last}`;
  }
}

export function genStreet(rng: Rng): string {
  return `${rng.int(1, 9999)} ${rng.pick(STREETS)}`;
}

export function genCity(rng: Rng): string { return rng.pick(CITIES); }
export function genState(rng: Rng): string { return rng.pick(STATES); }
export function genCountry(rng: Rng): string { return rng.pick(COUNTRIES); }

export function genZip(rng: Rng): string {
  return `${rng.int(10000, 99999).toString().padStart(5, "0")}`;
}

export function genCompany(rng: Rng): string { return rng.pick(COMPANIES); }
export function genJobTitle(rng: Rng): string { return rng.pick(JOB_TITLES); }

export function genWord(rng: Rng): string { return rng.pick(WORDS); }

export function genSentence(rng: Rng): string {
  const len = rng.int(6, 14);
  const words: string[] = [];
  for (let i = 0; i < len; i++) words.push(rng.pick(WORDS));
  const s = words.join(" ");
  return s.charAt(0).toUpperCase() + s.slice(1) + ".";
}

export function genParagraph(rng: Rng): string {
  const len = rng.int(3, 5);
  const parts: string[] = [];
  for (let i = 0; i < len; i++) parts.push(genSentence(rng));
  return parts.join(" ");
}

export function genString(rng: Rng): string {
  const len = rng.int(3, 10);
  const words: string[] = [];
  for (let i = 0; i < len; i++) words.push(rng.pick(WORDS));
  return words.join(" ");
}

export function genUrl(rng: Rng): string {
  const protocols = ["https", "http"];
  const tld = rng.pick(TOP_LEVEL_DOMAINS);
  const domains = ["example", "test", "mock", "sample", "demo"];
  const paths = ["", "/about", "/contact", "/products", "/blog", "/api/v1/users", "/search"];
  const proto = rng.pick(protocols);
  const domain = rng.pick(domains);
  const path = rng.pick(paths);
  return `${proto}://${domain}.${tld}${path}`;
}

export function genNumber(rng: Rng, min = 0, max = 1000, scale = 0): string {
  const lo = min ?? 0;
  const hi = max ?? 1000;
  if (scale && scale > 0) {
    const v = rng.next() * (hi - lo) + lo;
    return v.toFixed(scale);
  }
  return String(rng.int(Math.ceil(lo), Math.floor(hi)));
}

export function genAge(rng: Rng, min = 18, max = 90): string {
  return String(rng.int(min, max));
}

export function genMoney(rng: Rng, min = 0, max = 100000, scale = 2): string {
  const lo = min ?? 0;
  const hi = max ?? 100000;
  const v = rng.next() * (hi - lo) + lo;
  return v.toFixed(scale ?? 2);
}

export function genBoolean(rng: Rng): string {
  return rng.bool(0.5) ? "true" : "false";
}

export function genDate(rng: Rng, mode: "past" | "future" | "recent" | "iso" | "plain"): string {
  const now = Date.now();
  const day = 86400000;
  let ts: number;
  switch (mode) {
    case "past": ts = now - rng.int(365, 3650) * day; break;
    case "future": ts = now + rng.int(30, 3650) * day; break;
    case "recent": ts = now + (rng.next() - 0.5) * 60 * day; break;
    case "iso": ts = now - rng.int(0, 3650) * day - rng.int(0, day); break;
    case "plain":
    default: ts = now - rng.int(0, 3650) * day; break;
  }
  const d = new Date(ts);
  if (mode === "iso") return d.toISOString();
  return d.toISOString().slice(0, 10);
}

export function genTimestamp(rng: Rng): string {
  // Recent timestamp (within last 5 years)
  const now = Date.now();
  const day = 86400000;
  const ts = now - rng.int(0, 1825) * day - rng.int(0, day);
  return String(ts);
}

export function genEnum(rng: Rng, values: Array<string | [string, number]>): string {
  if (!values || values.length === 0) return "";
  const pairs: Array<[string, number]> = values.map((v) => {
    if (Array.isArray(v)) return [v[0], v[1]];
    return [v, 1];
  });
  return rng.weighted(pairs);
}

/**
 * Generate a string matching a simplified regex pattern.
 *
 * Supports: literal chars, . (any letter), \d (digit), \w (word char),
 * [a-z] char classes, {n} / {n,m} quantifiers, * (0-5), + (1-5), ? (0-1),
 * and | alternation between simple alts. This is a deliberately small subset
 * suitable for mock-data generation; complex patterns may not match exactly.
 */
export function genRegex(rng: Rng, pattern: string): string {
  if (!pattern) return "";
  try {
    return genRegexImpl(rng, pattern);
  } catch {
    return "";
  }
}

function genRegexImpl(rng: Rng, pattern: string): string {
  let out = "";
  let i = 0;
  while (i < pattern.length) {
    const ch = pattern[i];
    if (ch === "^" || ch === "$") { i++; continue; }
    if (ch === "\\") {
      const next = pattern[i + 1] ?? "";
      let atom = "";
      if (next === "d") atom = String(rng.int(0, 9));
      else if (next === "w") atom = rng.pick("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_".split(""));
      else if (next === "s") atom = rng.pick([" ", " ", "\t"]);
      else if (next === "n") atom = "\n";
      else if (next === "t") atom = "\t";
      else atom = next;
      out += applyQuantifier(rng, pattern, i + 2, atom);
      // advance past quantifier (handled inside applyQuantifier)
      i = advancePastQuantifier(pattern, i + 2);
      continue;
    }
    if (ch === ".") {
      const atom = rng.pick("abcdefghijklmnopqrstuvwxyz".split(""));
      out += applyQuantifier(rng, pattern, i + 1, atom);
      i = advancePastQuantifier(pattern, i + 1);
      continue;
    }
    if (ch === "[") {
      const end = pattern.indexOf("]", i);
      if (end === -1) { i++; continue; }
      const cls = pattern.slice(i + 1, end);
      const atom = sampleCharClass(rng, cls);
      out += applyQuantifier(rng, pattern, end + 1, atom);
      i = advancePastQuantifier(pattern, end + 1);
      continue;
    }
    if (ch === "(") {
      // simple group — find matching close (no nesting support beyond simple)
      const end = pattern.indexOf(")", i);
      if (end === -1) { i++; continue; }
      const inner = pattern.slice(i + 1, end);
      const alts = inner.split("|");
      const atom = rng.pick(alts);
      out += applyQuantifier(rng, pattern, end + 1, atom);
      i = advancePastQuantifier(pattern, end + 1);
      continue;
    }
    // literal char
    out += applyQuantifier(rng, pattern, i + 1, ch);
    i = advancePastQuantifier(pattern, i + 1);
  }
  return out;
}

function applyQuantifier(rng: Rng, pattern: string, nextIdx: number, atom: string): string {
  const q = pattern[nextIdx];
  if (q === "*") return repeatStr(atom, rng.int(0, 5));
  if (q === "+") return repeatStr(atom, rng.int(1, 5));
  if (q === "?") return rng.bool(0.5) ? atom : "";
  if (q === "{") {
    const end = pattern.indexOf("}", nextIdx);
    if (end === -1) return atom;
    const spec = pattern.slice(nextIdx + 1, end);
    if (spec.includes(",")) {
      const [lo, hi] = spec.split(",");
      const loN = parseInt(lo, 10);
      const hiN = hi === "" ? loN + 5 : parseInt(hi, 10);
      if (isNaN(loN) || isNaN(hiN)) return atom;
      return repeatStr(atom, rng.int(loN, hiN));
    }
    const n = parseInt(spec, 10);
    if (isNaN(n)) return atom;
    return repeatStr(atom, n);
  }
  return atom;
}

function advancePastQuantifier(pattern: string, nextIdx: number): number {
  const q = pattern[nextIdx];
  if (q === "*" || q === "+" || q === "?") return nextIdx + 1;
  if (q === "{") {
    const end = pattern.indexOf("}", nextIdx);
    if (end === -1) return nextIdx + 1;
    return end + 1;
  }
  return nextIdx;
}

function repeatStr(s: string, n: number): string {
  if (n <= 0) return "";
  let out = "";
  for (let i = 0; i < n; i++) out += s;
  return out;
}

function sampleCharClass(rng: Rng, cls: string): string {
  // Handle ranges like a-z, A-Z, 0-9
  const chars: string[] = [];
  let i = 0;
  let negated = false;
  if (cls.startsWith("^")) { negated = true; cls = cls.slice(1); }
  while (i < cls.length) {
    if (cls[i + 1] === "-" && cls[i + 2]) {
      const start = cls.charCodeAt(i);
      const end = cls.charCodeAt(i + 2);
      for (let c = start; c <= end; c++) chars.push(String.fromCharCode(c));
      i += 3;
    } else {
      chars.push(cls[i]);
      i++;
    }
  }
  if (chars.length === 0) return "";
  if (negated) {
    // crude negation: pick from common ASCII set
    const ascii: string[] = [];
    for (let c = 32; c < 127; c++) {
      const ch = String.fromCharCode(c);
      if (!chars.includes(ch)) ascii.push(ch);
    }
    if (ascii.length === 0) return "";
    return rng.pick(ascii);
  }
  return rng.pick(chars);
}

// ---------------------------------------------------------------------------
// Per-column value dispatch
// ---------------------------------------------------------------------------

export function genValue(rng: Rng, col: ColumnDef): string {
  switch (col.type) {
    case "string": return genString(rng);
    case "number": return genNumber(rng, col.min ?? 0, col.max ?? 1000, col.scale ?? 0);
    case "boolean": return genBoolean(rng);
    case "date": return genDate(rng, "plain");
    case "date_past": return genDate(rng, "past");
    case "date_future": return genDate(rng, "future");
    case "date_recent": return genDate(rng, "recent");
    case "date_iso": return genDate(rng, "iso");
    case "timestamp": return genTimestamp(rng);
    case "email": return genEmail(rng);
    case "phone": return genPhone(rng);
    case "first_name": return genFirstName(rng);
    case "last_name": return genLastName(rng);
    case "full_name": return genFullName(rng);
    case "username": return genUsername(rng);
    case "street": return genStreet(rng);
    case "city": return genCity(rng);
    case "state": return genState(rng);
    case "country": return genCountry(rng);
    case "zip": return genZip(rng);
    case "company": return genCompany(rng);
    case "job_title": return genJobTitle(rng);
    case "sentence": return genSentence(rng);
    case "paragraph": return genParagraph(rng);
    case "url": return genUrl(rng);
    case "uuid": return genUuid(rng);
    case "ipv4": return genIpv4(rng);
    case "ipv6": return genIpv6(rng);
    case "hex_color": return genHexColor(rng);
    case "age": return genAge(rng, col.min ?? 18, col.max ?? 90);
    case "money": return genMoney(rng, col.min ?? 0, col.max ?? 100000, col.scale ?? 2);
    case "enum": return genEnum(rng, col.enumValues ?? []);
    case "regex": return genRegex(rng, col.pattern ?? "");
    case "constant": return col.constantValue ?? "";
    default: return "";
  }
}

// ---------------------------------------------------------------------------
// RFC 4180 CSV serialization
// ---------------------------------------------------------------------------

export function getDelimiterChar(d: Delimiter, custom?: string): string {
  if (d === "custom") {
    if (custom && custom.length > 0) return custom;
    return ",";
  }
  return DELIMITER_CHARS[d];
}

/**
 * Quote a CSV field per RFC 4180. Returns the field wrapped in double quotes
 * with embedded double-quotes doubled, IF the quoting policy requires it
 * (minimal = only when needed) or always.
 */
export function quoteField(value: string, delim: string, policy: QuotingPolicy): string {
  if (policy === "none") return value;
  const needsQuote = /[",\r\n]/.test(value) || value.includes(delim);
  if (policy === "minimal" && !needsQuote) return value;
  // always quote, or minimal+needsQuote
  return `"${value.replace(/"/g, '""')}"`;
}

/** Serialize a single row to a CSV string (no terminator). */
export function serializeRow(row: string[], delim: string, policy: QuotingPolicy): string {
  return row.map((v) => quoteField(v, delim, policy)).join(delim);
}

/** Serialize a 2D array of rows to a full CSV document. */
export function serializeCsv(
  rows: string[][],
  opts: { delim: string; quoting: QuotingPolicy; lineEnding: LineEnding; bom: boolean; header?: boolean; headerRow?: string[] },
): string {
  const eol = opts.lineEnding === "crlf" ? "\r\n" : "\n";
  const parts: string[] = [];
  if (opts.bom) parts.push("\uFEFF");
  if (opts.header && opts.headerRow) {
    parts.push(serializeRow(opts.headerRow, opts.delim, opts.quoting));
    parts.push(eol);
  }
  for (let i = 0; i < rows.length; i++) {
    parts.push(serializeRow(rows[i], opts.delim, opts.quoting));
    if (i < rows.length - 1) parts.push(eol);
  }
  return parts.join("");
}

/** Serialize rows to JSON (array of objects keyed by column name). */
export function serializeJson(rows: string[][], columns: ColumnDef[]): string {
  const objs = rows.map((row) => {
    const obj: Record<string, string> = {};
    columns.forEach((col, i) => {
      obj[col.name] = row[i] ?? "";
    });
    return obj;
  });
  return JSON.stringify(objs, null, 2);
}

// ---------------------------------------------------------------------------
// Column inference from pasted header row
// ---------------------------------------------------------------------------

/**
 * Infer ColumnDefs from a pasted header row (and optionally a sample data row).
 * Heuristics: id → number unique; name with "email" → email; "phone" → phone;
 * "url"/"website"/"href" → url; "uuid"/"guid"/"id" (non-number) → uuid;
 * "date"/"at"/"created"/"updated" → date_iso; "is_"/"has_"/"active" → boolean;
 * "first_name" → first_name; "last_name" → last_name; "city" → city;
 * "state" → state; "country" → country; "zip"/"postal" → zip; "age" → age;
 * "price"/"amount"/"salary"/"cost" → money; "color" → hex_color;
 * "ip" → ipv4; "ip6"/"ipv6" → ipv6; "company" → company; "job"/"title" → job_title;
 * "address"/"street" → street; otherwise → string.
 */
export function inferColumns(headerRow: string, sampleRow?: string): ColumnDef[] {
  const headers = splitCsvRow(headerRow);
  const samples = sampleRow ? splitCsvRow(sampleRow) : [];
  const out: ColumnDef[] = [];
  for (let i = 0; i < headers.length; i++) {
    const raw = headers[i].trim();
    if (!raw) continue;
    const lower = raw.toLowerCase();
    const sample = (samples[i] ?? "").trim();
    const col = inferColumn(raw, lower, sample);
    out.push(col);
  }
  return out;
}

function inferColumn(raw: string, lower: string, sample: string): ColumnDef {
  // Pattern-based inference
  if (lower === "id" || lower === "_id" || lower.endsWith("_id")) {
    // "id" defaults to numeric+unique unless sample is non-numeric (e.g. UUID string)
    if (sample && !/^\d+$/.test(sample)) return { name: raw, type: "uuid" };
    return { name: raw, type: "number", min: 1, max: 1000000, unique: true };
  }
  if (lower.includes("email") || lower === "e-mail") return { name: raw, type: "email" };
  if (lower.includes("phone") || lower === "tel" || lower === "mobile") return { name: raw, type: "phone" };
  if (lower === "url" || lower === "website" || lower === "href" || lower === "link" || lower.endsWith("_url")) {
    return { name: raw, type: "url" };
  }
  if (lower === "uuid" || lower === "guid") return { name: raw, type: "uuid" };
  if (lower === "first_name" || lower === "firstname" || lower === "first") return { name: raw, type: "first_name" };
  if (lower === "last_name" || lower === "lastname" || lower === "last" || lower === "surname") return { name: raw, type: "last_name" };
  if (lower === "full_name" || lower === "name" || lower === "fullname" || lower === "username") {
    return { name: raw, type: lower === "username" ? "username" : "full_name" };
  }
  if (lower === "city") return { name: raw, type: "city" };
  if (lower === "state" || lower === "province" || lower === "region") return { name: raw, type: "state" };
  if (lower === "country") return { name: raw, type: "country" };
  if (lower === "zip" || lower === "zip_code" || lower === "zipcode" || lower === "postal" || lower === "postal_code") {
    return { name: raw, type: "zip" };
  }
  if (lower === "age") return { name: raw, type: "age" };
  if (lower === "address" || lower === "street" || lower === "street_address") return { name: raw, type: "street" };
  if (lower === "company" || lower === "organization" || lower === "employer") return { name: raw, type: "company" };
  if (lower === "job_title" || lower === "jobtitle" || lower === "title" || lower === "position") return { name: raw, type: "job_title" };
  if (lower === "color" || lower === "colour" || lower.endsWith("_color")) return { name: raw, type: "hex_color" };
  if (lower === "ip" || lower === "ip_address" || lower === "ipv4") return { name: raw, type: "ipv4" };
  if (lower === "ipv6" || lower === "ip6") return { name: raw, type: "ipv6" };
  if (lower.startsWith("is_") || lower.startsWith("has_") || lower === "active" || lower === "enabled" || lower === "verified") {
    return { name: raw, type: "boolean" };
  }
  if (lower.includes("date") || lower.endsWith("_at") || lower === "created" || lower === "updated" || lower === "timestamp" || lower === "time") {
    if (lower === "timestamp" || lower === "time" || /^\d+$/.test(sample) && sample.length >= 12) return { name: raw, type: "timestamp" };
    return { name: raw, type: "date_iso" };
  }
  if (lower.includes("price") || lower.includes("amount") || lower.includes("salary") || lower.includes("cost") || lower.includes("balance")) {
    return { name: raw, type: "money", min: 0, max: 100000, scale: 2 };
  }
  if (lower === "count" || lower === "quantity" || lower === "qty" || lower === "num" || lower === "number" || lower === "age_years") {
    return { name: raw, type: "number", min: 0, max: 1000 };
  }
  if (lower === "description" || lower === "bio" || lower === "notes" || lower === "comment" || lower === "body") {
    return { name: raw, type: "paragraph" };
  }
  if (lower === "sentence" || lower === "title_text") return { name: raw, type: "sentence" };
  // Sample-based inference
  if (/^\d+$/.test(sample)) return { name: raw, type: "number", min: 0, max: 1000000 };
  if (/^\d+\.\d+$/.test(sample)) return { name: raw, type: "number", min: 0, max: 1000, scale: 2 };
  if (/^\d{4}-\d{2}-\d{2}$/.test(sample)) return { name: raw, type: "date" };
  if (/^\d{4}-\d{2}-\d{2}T/.test(sample)) return { name: raw, type: "date_iso" };
  if (/^[^@]+@[^@]+\.[^@]+$/.test(sample)) return { name: raw, type: "email" };
  if (/^https?:\/\//.test(sample)) return { name: raw, type: "url" };
  if (/^#[0-9a-f]{6}$/i.test(sample)) return { name: raw, type: "hex_color" };
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(sample)) return { name: raw, type: "ipv4" };
  if (sample === "true" || sample === "false") return { name: raw, type: "boolean" };
  // Default
  return { name: raw, type: "string" };
}

/** Split a CSV row with quoted values (RFC 4180). */
export function splitCsvRow(line: string): string[] {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if ((ch === "," || ch === ";" || ch === "\t" || ch === "|") && !inQuotes) {
      out.push(current); current = "";
    } else { current += ch; }
  }
  out.push(current);
  return out;
}

// ---------------------------------------------------------------------------
// Column / option validation
// ---------------------------------------------------------------------------

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

export function validateColumns(columns: ColumnDef[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (columns.length === 0) {
    errors.push("At least one column is required.");
    return { ok: false, errors, warnings };
  }
  const seen = new Set<string>();
  for (let i = 0; i < columns.length; i++) {
    const c = columns[i];
    if (!c.name || !c.name.trim()) {
      errors.push(`Column ${i + 1}: name is required.`);
    } else if (seen.has(c.name)) {
      errors.push(`Column "${c.name}": duplicate name.`);
    } else {
      seen.add(c.name);
    }
    if (!COLUMN_TYPES.includes(c.type)) {
      errors.push(`Column "${c.name}": unknown type "${c.type}".`);
    }
    if (c.type === "enum" && (!c.enumValues || c.enumValues.length === 0)) {
      errors.push(`Column "${c.name}": enum type requires at least one enum value.`);
    }
    if (c.type === "regex" && !c.pattern) {
      errors.push(`Column "${c.name}": regex type requires a pattern.`);
    }
    if (c.type === "constant" && (c.constantValue === undefined || c.constantValue === null)) {
      warnings.push(`Column "${c.name}": constant type has no constantValue (defaults to empty string).`);
    }
    if (c.blankPercent !== undefined && (c.blankPercent < 0 || c.blankPercent > 100)) {
      errors.push(`Column "${c.name}": blankPercent must be 0-100.`);
    }
    if (c.min !== undefined && c.max !== undefined && c.min > c.max) {
      errors.push(`Column "${c.name}": min (${c.min}) > max (${c.max}).`);
    }
    if (c.scale !== undefined && (c.scale < 0 || c.scale > 10)) {
      warnings.push(`Column "${c.name}": scale ${c.scale} is unusual (expected 0-10).`);
    }
  }
  return { ok: errors.length === 0, errors, warnings };
}

export function validateOptions(opts: GenerateOptions): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!Number.isFinite(opts.rowCount) || opts.rowCount < 0) {
    errors.push("Row count must be a non-negative number.");
  }
  if (opts.rowCount > 1000000) {
    warnings.push("Generating more than 1,000,000 rows may freeze your browser.");
  }
  if (opts.delimiter === "custom" && (!opts.customDelimiter || opts.customDelimiter.length === 0)) {
    errors.push("Custom delimiter requires a non-empty character.");
  }
  if (opts.customDelimiter && opts.customDelimiter.length > 1) {
    warnings.push("Custom delimiter is longer than 1 character; output may not be RFC 4180 compliant.");
  }
  const colVal = validateColumns(opts.columns);
  errors.push(...colVal.errors);
  warnings.push(...colVal.warnings);
  return { ok: errors.length === 0, errors, warnings };
}

// ---------------------------------------------------------------------------
// Main generate function
// ---------------------------------------------------------------------------

export function generate(opts: GenerateOptions): GenerateResult {
  return generateFormat(opts, opts.format ?? "csv");
}

/** Generate with explicit output format (CSV / TSV / JSON). */
export function generateFormat(
  opts: GenerateOptions,
  format: OutputFormat,
): GenerateResult {
  const val = validateOptions(opts);
  if (!val.ok) {
    throw new Error(val.errors.join(" "));
  }
  const rng = buildRng(opts.seed);
  const delim = format === "tsv"
    ? "\t"
    : getDelimiterChar(opts.delimiter, opts.customDelimiter);
  const headerRow = opts.columns.map((c) => c.name);
  const rows: string[][] = [];
  // For unique columns, track seen values for collision-safe retry
  const uniqueSets: Map<number, Set<string>> = new Map();
  opts.columns.forEach((c, i) => {
    if (c.unique) uniqueSets.set(i, new Set());
  });
  const MAX_RETRY = 50;
  for (let r = 0; r < opts.rowCount; r++) {
    const row: string[] = [];
    for (let i = 0; i < opts.columns.length; i++) {
      const col = opts.columns[i];
      // Blank %
      if (col.blankPercent !== undefined && col.blankPercent > 0) {
        if (rng.next() * 100 < col.blankPercent) {
          row.push("");
          continue;
        }
      }
      let v: string;
      if (col.unique && uniqueSets.has(i)) {
        const seen = uniqueSets.get(i)!;
        let attempt = 0;
        do {
          v = genValue(rng, col);
          attempt++;
          if (attempt > MAX_RETRY) {
            // Append suffix to ensure uniqueness
            v = `${genValue(rng, col)}-${seen.size}`;
            break;
          }
        } while (seen.has(v));
        seen.add(v);
        row.push(v);
      } else {
        row.push(genValue(rng, col));
      }
    }
    rows.push(row);
  }
  let output: string;
  if (format === "json") {
    output = serializeJson(rows, opts.columns);
  } else {
    output = serializeCsv(rows, {
      delim,
      quoting: opts.quoting,
      lineEnding: opts.lineEnding,
      bom: opts.bom,
      header: opts.header,
      headerRow,
    });
  }
  return {
    rows,
    output,
    rowCount: rows.length,
    columnCount: opts.columns.length,
    bytes: output.length,
    delimiterChar: delim,
  };
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

export interface GenerationStats {
  rowCount: number;
  columnCount: number;
  bytes: number;
  uniqueColumns: number;
  blankColumns: number;
  estimatedCells: number;
}

export function computeStats(opts: GenerateOptions, result: GenerateResult): GenerationStats {
  const uniqueColumns = opts.columns.filter((c) => c.unique).length;
  const blankColumns = opts.columns.filter((c) => c.blankPercent && c.blankPercent > 0).length;
  return {
    rowCount: result.rowCount,
    columnCount: result.columnCount,
    bytes: result.bytes,
    uniqueColumns,
    blankColumns,
    estimatedCells: result.rowCount * result.columnCount,
  };
}

// ---------------------------------------------------------------------------
// History (localStorage) — metadata only, never the data itself
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:mock-csv-data-generator:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  rowCount: number;
  columnCount: number;
  format: OutputFormat;
  delimiter: Delimiter;
  seed: string;
  columnSummary: string;
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
// Shareable URL — encodes options in the fragment (never sent to server)
// ---------------------------------------------------------------------------

export interface ShareOptions {
  rowCount: number;
  delimiter: Delimiter;
  customDelimiter?: string;
  quoting: QuotingPolicy;
  lineEnding: LineEnding;
  bom: boolean;
  header: boolean;
  seed: string;
  format: OutputFormat;
}

export function buildShareUrl(opts: ShareOptions, columns: ColumnDef[]): string {
  const params = new URLSearchParams();
  params.set("rows", String(opts.rowCount));
  params.set("delim", opts.delimiter);
  if (opts.delimiter === "custom" && opts.customDelimiter) params.set("cdelim", opts.customDelimiter);
  params.set("q", opts.quoting);
  params.set("le", opts.lineEnding);
  params.set("bom", String(opts.bom));
  params.set("hdr", String(opts.header));
  if (opts.seed) params.set("seed", opts.seed);
  params.set("fmt", opts.format);
  // Compact column encoding: name|type|min|max|scale|blank|unique
  const cols = columns.map((c) => {
    const parts = [c.name, c.type];
    if (c.min !== undefined) parts.push(`min=${c.min}`);
    if (c.max !== undefined) parts.push(`max=${c.max}`);
    if (c.scale !== undefined) parts.push(`scale=${c.scale}`);
    if (c.blankPercent !== undefined) parts.push(`blank=${c.blankPercent}`);
    if (c.unique) parts.push("u=1");
    if (c.constantValue !== undefined) parts.push(`cv=${encodeURIComponent(c.constantValue)}`);
    if (c.pattern) parts.push(`pat=${encodeURIComponent(c.pattern)}`);
    if (c.enumValues && c.enumValues.length > 0) {
      // Format: "value:weight,value:weight,..." or "value,value,..."
      const ev = c.enumValues
        .map((v) => Array.isArray(v) ? `${v[0]}:${v[1]}` : v)
        .join(",");
      parts.push(`ev=${encodeURIComponent(ev)}`);
    }
    return parts.join(";");
  });
  params.set("cols", cols.join("||"));
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): { options: ShareOptions; columns: ColumnDef[] } {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { options: defaultShareOptions(), columns: DEFAULT_COLUMNS };
  const params = new URLSearchParams(clean);
  const options: ShareOptions = {
    rowCount: parseInt(params.get("rows") ?? "10", 10) || 10,
    delimiter: (params.get("delim") as Delimiter) ?? "comma",
    customDelimiter: params.get("cdelim") ?? "",
    quoting: (params.get("q") as QuotingPolicy) ?? "minimal",
    lineEnding: (params.get("le") as LineEnding) ?? "lf",
    bom: params.get("bom") === "true",
    header: params.get("hdr") !== "false",
    seed: params.get("seed") ?? "",
    format: (params.get("fmt") as OutputFormat) ?? "csv",
  };
  const colsStr = params.get("cols") ?? "";
  let columns: ColumnDef[] = DEFAULT_COLUMNS;
  if (colsStr) {
    columns = colsStr.split("||").map((part) => parseEncodedColumn(part)).filter((c): c is ColumnDef => c !== null);
    if (columns.length === 0) columns = DEFAULT_COLUMNS;
  }
  return { options, columns };
}

function parseEncodedColumn(part: string): ColumnDef | null {
  const pieces = part.split(";");
  if (pieces.length < 2) return null;
  const name = pieces[0];
  const type = pieces[1] as ColumnType;
  if (!COLUMN_TYPES.includes(type)) return null;
  const col: ColumnDef = { name, type };
  for (let i = 2; i < pieces.length; i++) {
    const p = pieces[i];
    if (p.startsWith("min=")) col.min = Number(p.slice(4));
    else if (p.startsWith("max=")) col.max = Number(p.slice(4));
    else if (p.startsWith("scale=")) col.scale = Number(p.slice(6));
    else if (p.startsWith("blank=")) col.blankPercent = Number(p.slice(6));
    else if (p === "u=1") col.unique = true;
    else if (p.startsWith("cv=")) col.constantValue = decodeURIComponent(p.slice(3));
    else if (p.startsWith("pat=")) col.pattern = decodeURIComponent(p.slice(4));
    else if (p.startsWith("ev=")) {
      const ev = decodeURIComponent(p.slice(3));
      col.enumValues = parseEnumValues(ev);
    }
  }
  return col;
}

function parseEnumValues(s: string): Array<string | [string, number]> {
  // Format: "value:weight,value:weight,..." or "value,value,..."
  if (!s) return [];
  const parts = s.split(",");
  const out: Array<string | [string, number]> = [];
  for (const p of parts) {
    if (!p) continue;
    const [v, w] = p.split(":");
    if (w !== undefined && w !== "") out.push([v, Number(w)]);
    else out.push(v);
  }
  return out;
}

function defaultShareOptions(): ShareOptions {
  return {
    rowCount: 10,
    delimiter: "comma",
    customDelimiter: "",
    quoting: "minimal",
    lineEnding: "lf",
    bom: false,
    header: true,
    seed: "",
    format: "csv",
  };
}

// ---------------------------------------------------------------------------
// Column presets — one-click templates
// ---------------------------------------------------------------------------

export interface ColumnPreset {
  id: string;
  name: string;
  description: string;
  columns: ColumnDef[];
}

export const COLUMN_PRESETS: ColumnPreset[] = [
  {
    id: "users",
    name: "Users",
    description: "id, name, email, age, country, created_at",
    columns: DEFAULT_COLUMNS,
  },
  {
    id: "products",
    name: "Products",
    description: "id, name, price, category, in_stock, sku",
    columns: [
      { name: "id", type: "number", min: 1, max: 1000000, unique: true },
      { name: "name", type: "string" },
      { name: "price", type: "money", min: 1, max: 5000, scale: 2 },
      {
        name: "category",
        type: "enum",
        enumValues: [
          ["Electronics", 3], ["Books", 2], ["Clothing", 2],
          ["Home", 2], ["Toys", 1], ["Sports", 1],
        ],
      },
      { name: "in_stock", type: "boolean" },
      { name: "sku", type: "uuid" },
    ],
  },
  {
    id: "orders",
    name: "Orders",
    description: "id, customer_email, total, status, ordered_at",
    columns: [
      { name: "id", type: "number", min: 1000, max: 999999, unique: true },
      { name: "customer_email", type: "email" },
      { name: "total", type: "money", min: 5, max: 2000, scale: 2 },
      {
        name: "status",
        type: "enum",
        enumValues: [["pending", 3], ["shipped", 2], ["delivered", 2], ["cancelled", 1]],
      },
      { name: "ordered_at", type: "date_iso" },
    ],
  },
  {
    id: "employees",
    name: "Employees",
    description: "id, full_name, email, job_title, department, salary, hire_date",
    columns: [
      { name: "id", type: "number", min: 1, max: 99999, unique: true },
      { name: "full_name", type: "full_name" },
      { name: "email", type: "email" },
      { name: "job_title", type: "job_title" },
      {
        name: "department",
        type: "enum",
        enumValues: ["Engineering", "Sales", "Marketing", "Finance", "HR", "Support"],
      },
      { name: "salary", type: "money", min: 40000, max: 250000, scale: 0 },
      { name: "hire_date", type: "date_past" },
    ],
  },
  {
    id: "addresses",
    name: "Addresses",
    description: "id, full_name, street, city, state, zip, country",
    columns: [
      { name: "id", type: "number", min: 1, max: 999999, unique: true },
      { name: "full_name", type: "full_name" },
      { name: "street", type: "street" },
      { name: "city", type: "city" },
      { name: "state", type: "state" },
      { name: "zip", type: "zip" },
      { name: "country", type: "country" },
    ],
  },
  {
    id: "logs",
    name: "Server Logs",
    description: "timestamp, level, ip, path, status, response_time_ms",
    columns: [
      { name: "timestamp", type: "date_iso" },
      {
        name: "level",
        type: "enum",
        enumValues: [["INFO", 5], ["WARN", 2], ["ERROR", 1], ["DEBUG", 1]],
      },
      { name: "ip", type: "ipv4" },
      { name: "path", type: "url" },
      { name: "status", type: "number", min: 200, max: 599 },
      { name: "response_time_ms", type: "number", min: 5, max: 5000 },
    ],
  },
  {
    id: "blank",
    name: "Empty",
    description: "Start from scratch (one string column)",
    columns: [{ name: "col1", type: "string" }],
  },
];

// ---------------------------------------------------------------------------
// Honesty / privacy banner
// ---------------------------------------------------------------------------

export const HONESTY_BANNER =
  "Generated data is synthetic and reproducible from the seed. Names, emails, " +
  "addresses, and phone numbers are randomly assembled from word banks and do " +
  "not correspond to real people. Do not use generated email addresses or phone " +
  "numbers to contact anyone.";
