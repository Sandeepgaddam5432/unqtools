/**
 * Fake Data Generator (Faker-style) — pure logic.
 *
 * Pure-JS Faker-style data generator with 30+ field generators (names,
 * emails, phones, addresses, UUIDs, dates, IPs, URLs, companies, lorem
 * ipsum, money, colors, and more). Supports schema-driven batch generation,
 * deterministic seeding via mulberry32, and JSON/CSV/NDJSON export.
 *
 * Pure functions only — no DOM, no network, no external deps.
 */

// ---------------------------------------------------------------------------
// PRNG — deterministic mulberry32 + helpers
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

/** Hash a string or number seed to a 32-bit unsigned integer. */
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
  bool(): boolean;
  hex(len: number): string;
  string(len: number, charset: string): string;
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
  const bool = (): boolean => r() < 0.5;
  const hex = (len: number): string => {
    const c = "0123456789abcdef";
    let out = "";
    for (let i = 0; i < len; i++) out += c[Math.floor(r() * 16)];
    return out;
  };
  const string = (len: number, charset: string): string => {
    let out = "";
    for (let i = 0; i < len; i++) out += charset[Math.floor(r() * charset.length)];
    return out;
  };
  return { next: r, int, pick, bool, hex, string };
}

// ---------------------------------------------------------------------------
// Data dictionaries
// ---------------------------------------------------------------------------

export const FIRST_NAMES: readonly string[] = [
  "James", "Mary", "Robert", "Patricia", "John", "Jennifer", "Michael", "Linda",
  "William", "Elizabeth", "David", "Barbara", "Richard", "Susan", "Joseph", "Jessica",
  "Thomas", "Sarah", "Charles", "Karen", "Christopher", "Nancy", "Daniel", "Lisa",
  "Matthew", "Betty", "Anthony", "Margaret", "Mark", "Sandra", "Donald", "Ashley",
  "Steven", "Kimberly", "Paul", "Emily", "Andrew", "Donna", "Joshua", "Michelle",
  "Kenneth", "Carol", "Kevin", "Amanda", "Brian", "Dorothy", "George", "Melissa",
  "Edward", "Deborah", "Ronald", "Stephanie", "Timothy", "Rebecca", "Jason", "Sharon",
  "Jeffrey", "Laura", "Ryan", "Cynthia", "Jacob", "Kathleen", "Gary", "Amy",
  "Nicholas", "Shirley", "Eric", "Angela", "Jonathan", "Helen", "Stephen", "Anna",
  "Larry", "Brenda", "Justin", "Pamela", "Scott", "Nicole", "Brandon", "Emma",
  "Benjamin", "Samantha", "Samuel", "Katherine", "Gregory", "Christine", "Frank", "Debra",
  "Alexander", "Rachel", "Raymond", "Catherine", "Patrick", "Carolyn", "Jack", "Janet",
];

export const LAST_NAMES: readonly string[] = [
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
];

export const CITIES: readonly string[] = [
  "New York", "Los Angeles", "Chicago", "Houston", "Phoenix", "Philadelphia",
  "San Antonio", "San Diego", "Dallas", "San Jose", "Austin", "Jacksonville",
  "Fort Worth", "Columbus", "Charlotte", "San Francisco", "Indianapolis", "Seattle",
  "Denver", "Washington", "Boston", "El Paso", "Nashville", "Detroit", "Oklahoma City",
  "Portland", "Las Vegas", "Memphis", "Louisville", "Baltimore", "Milwaukee",
  "Albuquerque", "Tucson", "Fresno", "Sacramento", "Kansas City", "Mesa", "Atlanta",
  "Omaha", "Miami", "Tampa", "Pittsburgh", "Cincinnati", "St. Louis", "Orlando",
];

export const US_STATES: readonly string[] = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL", "IN",
  "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV",
  "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN",
  "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
];

export const COUNTRIES: readonly string[] = [
  "United States", "Canada", "United Kingdom", "Australia", "Germany", "France",
  "Japan", "Brazil", "India", "Mexico", "Spain", "Italy", "South Korea", "Netherlands",
  "Sweden", "Norway", "Denmark", "Finland", "Poland", "Belgium", "Austria", "Switzerland",
  "Ireland", "Portugal", "Greece", "New Zealand", "Singapore", "South Africa", "Argentina",
];

export const STREET_NAMES: readonly string[] = [
  "Main", "Oak", "Pine", "Maple", "Cedar", "Elm", "Washington", "Lake", "Hill",
  "Park", "Spring", "North", "South", "East", "West", "Forest", "River", "Sunset",
  "Highland", "Madison", "Jefferson", "Lincoln", "Jackson", "Franklin", "Adams",
  "Cherry", "Birch", "Walnut", "Willow", "Chestnut", "Magnolia", "Dogwood",
];

export const STREET_SUFFIXES: readonly string[] = [
  "St", "Ave", "Blvd", "Rd", "Dr", "Ln", "Way", "Ct", "Pl", "Ter", "Cir", "Pkwy",
];

export const COMPANY_PREFIXES: readonly string[] = [
  "Acme", "Apex", "Bright", "Cobalt", "Delta", "Echo", "Forge", "Granite",
  "Horizon", "Iris", "Juniper", "Keystone", "Lumen", "Mercury", "Nova", "Onyx",
  "Pinnacle", "Quantum", "Radius", "Summit", "Titan", "Unity", "Vector", "Willow",
  "Zenith", "Atlas", "Beacon", "Cipher", "Drift", "Ember", "Frost", "Gale",
];

export const COMPANY_SUFFIXES: readonly string[] = [
  "Inc", "LLC", "Corp", "Co", "Group", "Partners", "Holdings", "Labs", "Solutions",
  "Systems", "Technologies", "Industries", "Enterprises", "Ventures",
];

export const JOB_TITLES: readonly string[] = [
  "Software Engineer", "Product Manager", "Data Scientist", "Designer", "Architect",
  "DevOps Engineer", "QA Engineer", "Engineering Manager", "CTO", "CEO", "CFO",
  "Marketing Director", "Sales Representative", "Customer Success Manager",
  "Business Analyst", "Project Manager", "HR Specialist", "Recruiter", "Accountant",
  "Financial Analyst", "Operations Manager", "UX Researcher", "Frontend Developer",
  "Backend Developer", "Mobile Developer", "Site Reliability Engineer", "Security Analyst",
];

export const LOREM_WORDS: readonly string[] = [
  "lorem", "ipsum", "dolor", "sit", "amet", "consectetur", "adipiscing", "elit",
  "sed", "do", "eiusmod", "tempor", "incididunt", "ut", "labore", "et", "dolore",
  "magna", "aliqua", "enim", "ad", "minim", "veniam", "quis", "nostrud",
  "exercitation", "ullamco", "laboris", "nisi", "aliquip", "ex", "ea", "commodo",
  "consequat", "duis", "aute", "irure", "in", "reprehenderit", "voluptate",
  "velit", "esse", "cillum", "fugiat", "nulla", "pariatur", "excepteur", "sint",
  "occaecat", "cupidatat", "non", "proident", "sunt", "culpa", "qui", "officia",
  "deserunt", "mollit", "anim", "id", "est", "laborum",
];

export const TLDS: readonly string[] = [
  "com", "io", "co", "net", "org", "app", "dev", "tech", "ai", "xyz", "cloud",
  "software", "digital", "systems", "online", "store", "shop", "blog", "news",
];

export const TIMEZONES: readonly string[] = [
  "UTC", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
  "America/Anchorage", "Pacific/Honolulu", "Europe/London", "Europe/Paris",
  "Europe/Berlin", "Europe/Madrid", "Europe/Rome", "Europe/Amsterdam", "Asia/Tokyo",
  "Asia/Shanghai", "Asia/Singapore", "Asia/Dubai", "Asia/Kolkata", "Australia/Sydney",
  "Pacific/Auckland", "America/Sao_Paulo", "America/Mexico_City", "Africa/Cairo",
];

export const NATIONALITIES: readonly string[] = [
  "American", "Canadian", "British", "Australian", "German", "French", "Japanese",
  "Brazilian", "Indian", "Mexican", "Spanish", "Italian", "Korean", "Dutch",
  "Swedish", "Norwegian", "Danish", "Finnish", "Polish", "Belgian", "Austrian",
  "Swiss", "Irish", "Portuguese", "Greek", "New Zealander", "Singaporean",
  "South African", "Argentinian", "Russian", "Chinese",
];

export const COLOR_NAMES: readonly string[] = [
  "red", "orange", "yellow", "green", "blue", "purple", "pink", "brown", "black",
  "white", "gray", "cyan", "magenta", "lime", "teal", "indigo", "violet", "gold",
];

// ---------------------------------------------------------------------------
// Field generators (30+)
// ---------------------------------------------------------------------------

export function firstName(rng: Rng): string {
  return rng.pick(FIRST_NAMES);
}

export function lastName(rng: Rng): string {
  return rng.pick(LAST_NAMES);
}

export function fullName(rng: Rng): string {
  return `${firstName(rng)} ${lastName(rng)}`;
}

export function username(rng: Rng): string {
  const a = rng.pick(FIRST_NAMES).toLowerCase();
  const b = rng.pick(LAST_NAMES).toLowerCase();
  const n = rng.int(1, 9999);
  const style = rng.int(0, 3);
  switch (style) {
    case 0: return `${a}${b}`;
    case 1: return `${a}.${b}`;
    case 2: return `${a}_${b}${n}`;
    case 3: return `${a}${n}`;
    default: return `${a}${b}`;
  }
}

export function email(rng: Rng): string {
  const u = username(rng);
  const domain = domainName(rng);
  return `${u}@${domain}`.toLowerCase();
}

export function phone(rng: Rng): string {
  const a = rng.int(201, 989);
  const b = rng.int(200, 989);
  const c = rng.int(1000, 9999);
  return `(${a}) ${b}-${c}`;
}

export function street(rng: Rng): string {
  return `${rng.int(1, 9999)} ${rng.pick(STREET_NAMES)} ${rng.pick(STREET_SUFFIXES)}`;
}

export function city(rng: Rng): string {
  return rng.pick(CITIES);
}

export function state(rng: Rng): string {
  return rng.pick(US_STATES);
}

export function zip(rng: Rng): string {
  return String(rng.int(1001, 99950)).padStart(5, "0");
}

export function country(rng: Rng): string {
  return rng.pick(COUNTRIES);
}

export function fullAddress(rng: Rng): string {
  return `${street(rng)}, ${city(rng)}, ${state(rng)} ${zip(rng)}`;
}

export function uuid(rng: Rng): string {
  const h = (n: number) => rng.hex(n);
  return `${h(8)}-${h(4)}-4${h(3)}-a${h(3)}-${h(12)}`;
}

export function ipv4(rng: Rng): string {
  return `${rng.int(1, 255)}.${rng.int(0, 255)}.${rng.int(0, 255)}.${rng.int(0, 255)}`;
}

export function ipv6(rng: Rng): string {
  const parts: string[] = [];
  for (let i = 0; i < 8; i++) parts.push(rng.hex(4));
  return parts.join(":");
}

export function mac(rng: Rng): string {
  const parts: string[] = [];
  for (let i = 0; i < 6; i++) parts.push(rng.hex(2).toUpperCase());
  return parts.join(":");
}

export function domainName(rng: Rng): string {
  const a = rng.pick(COMPANY_PREFIXES).toLowerCase();
  const tld = rng.pick(TLDS);
  return `${a}.${tld}`;
}

export function url(rng: Rng): string {
  const proto = rng.bool() ? "https" : "http";
  const d = domainName(rng);
  const paths = ["", "/", "/about", "/products", "/blog", "/api/v1", "/login"];
  const p = rng.pick(paths);
  return `${proto}://${d}${p}`;
}

export function slug(rng: Rng, wordCount = 5): string {
  const words: string[] = [];
  for (let i = 0; i < wordCount; i++) words.push(rng.pick(LOREM_WORDS));
  return words.join("-");
}

export function company(rng: Rng): string {
  return `${rng.pick(COMPANY_PREFIXES)} ${rng.pick(COMPANY_SUFFIXES)}`;
}

export function jobTitle(rng: Rng): string {
  return rng.pick(JOB_TITLES);
}

export function catchPhrase(rng: Rng): string {
  const adj = ["Seamless", "Next-gen", "Adaptive", "Proactive", "Innovative", "Robust", "Scalable", "Decentralized"];
  const noun = ["synergy", "paradigm", "mindshare", "solutions", "ecosystem", "marketplace", "platform", "infrastructure"];
  const verb = ["empowers", "transforms", "reimagines", "reinvents", "leverages", "accelerates", "orchestrates"];
  return `${rng.pick(adj)} ${rng.pick(noun)} ${rng.pick(verb)} ${rng.pick(noun)}`;
}

export function loremWord(rng: Rng): string {
  return rng.pick(LOREM_WORDS);
}

export function loremSentence(rng: Rng, wordCount?: number): string {
  const n = wordCount ?? rng.int(6, 14);
  const words: string[] = [];
  for (let i = 0; i < n; i++) words.push(rng.pick(LOREM_WORDS));
  let s = words.join(" ");
  s = s.charAt(0).toUpperCase() + s.slice(1) + ".";
  return s;
}

export function loremParagraph(rng: Rng, sentences?: number): string {
  const n = sentences ?? rng.int(3, 6);
  const parts: string[] = [];
  for (let i = 0; i < n; i++) parts.push(loremSentence(rng));
  return parts.join(" ");
}

export interface DateOptions {
  /** Year min (default 1970). */
  minYear?: number;
  /** Year max (default current year + 5). */
  maxYear?: number;
}

export function date(rng: Rng, opts: DateOptions = {}): string {
  const maxYear = opts.maxYear ?? new Date().getFullYear() + 5;
  const minYear = opts.minYear ?? 1970;
  const y = rng.int(minYear, maxYear);
  const m = rng.int(1, 12);
  const d = rng.int(1, 28);
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function timestamp(rng: Rng): string {
  const y = rng.int(2000, 2099);
  const m = rng.int(1, 12);
  const d = rng.int(1, 28);
  const h = rng.int(0, 23);
  const mi = rng.int(0, 59);
  const s = rng.int(0, 59);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${y}-${pad(m)}-${pad(d)}T${pad(h)}:${pad(mi)}:${pad(s)}Z`;
}

export function time(rng: Rng): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(rng.int(0, 23))}:${pad(rng.int(0, 59))}:${pad(rng.int(0, 59))}`;
}

export interface MoneyOptions {
  min?: number;
  max?: number;
  currency?: string;
}

export function money(rng: Rng, opts: MoneyOptions = {}): string {
  const min = opts.min ?? 1;
  const max = opts.max ?? 10000;
  const dollars = rng.int(min, max);
  const cents = rng.int(0, 99);
  const currency = opts.currency ?? "$";
  return `${currency}${dollars}.${String(cents).padStart(2, "0")}`;
}

export function age(rng: Rng, min = 18, max = 90): number {
  return rng.int(min, max);
}

export function hexColor(rng: Rng): string {
  return `#${rng.hex(6)}`;
}

export function rgbColor(rng: Rng): string {
  return `rgb(${rng.int(0, 255)}, ${rng.int(0, 255)}, ${rng.int(0, 255)})`;
}

export function colorName(rng: Rng): string {
  return rng.pick(COLOR_NAMES);
}

export function boolean(rng: Rng): boolean {
  return rng.bool();
}

export function integer(rng: Rng, min = 0, max = 1000): number {
  return rng.int(min, max);
}

export function decimal(rng: Rng, min = 0, max = 1000, precision = 2): number {
  const v = rng.next() * (max - min) + min;
  const f = Math.pow(10, precision);
  return Math.round(v * f) / f;
}

export function password(rng: Rng, len = 16): string {
  const charset = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%^&*";
  return rng.string(len, charset);
}

export function nationality(rng: Rng): string {
  return rng.pick(NATIONALITIES);
}

export function isbn(rng: Rng): string {
  // ISBN-13 with 978 prefix
  const group = rng.pick(["0", "1", "2"]);
  const publisher = rng.string(4, "0123456789");
  const title = rng.string(4, "0123456789");
  const core = `978${group}${publisher}${title}`;
  // Compute check digit (ISBN-13 mod 10)
  let sum = 0;
  for (let i = 0; i < core.length; i++) {
    const d = parseInt(core[i]!, 10);
    sum += i % 2 === 0 ? d : d * 3;
  }
  const check = (10 - (sum % 10)) % 10;
  return `${core}${check}`;
}

export function semver(rng: Rng): string {
  return `${rng.int(0, 9)}.${rng.int(0, 99)}.${rng.int(0, 99)}`;
}

export function timezone(rng: Rng): string {
  return rng.pick(TIMEZONES);
}

// ---------------------------------------------------------------------------
// Schema-driven generation
// ---------------------------------------------------------------------------

export type FieldType =
  | "firstName" | "lastName" | "fullName" | "username" | "email"
  | "phone" | "street" | "city" | "state" | "zip" | "country" | "fullAddress"
  | "uuid" | "ipv4" | "ipv6" | "mac" | "url" | "domain" | "slug" | "colorName"
  | "company" | "jobTitle" | "catchPhrase"
  | "loremWord" | "loremSentence" | "loremParagraph" | "time"
  | "date" | "timestamp" | "money" | "age" | "integer" | "decimal" | "boolean"
  | "hexColor" | "rgbColor" | "password" | "nationality" | "isbn" | "semver"
  | "timezone" | "constant";

export interface FieldSchema {
  name: string;
  type: FieldType;
  value?: string;
  min?: number;
  max?: number;
  precision?: number;
  wordCount?: number;
  sentences?: number;
  nullChance?: number;
}

export interface Schema {
  fields: FieldSchema[];
}

export const FIELD_TYPES: readonly FieldType[] = [
  "firstName", "lastName", "fullName", "username", "email",
  "phone", "street", "city", "state", "zip", "country", "fullAddress",
  "uuid", "ipv4", "ipv6", "mac", "url", "domain", "slug", "colorName",
  "company", "jobTitle", "catchPhrase",
  "loremWord", "loremSentence", "loremParagraph", "time",
  "date", "timestamp", "money", "age", "integer", "decimal", "boolean",
  "hexColor", "rgbColor", "password", "nationality", "isbn", "semver",
  "timezone", "constant",
];

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  firstName: "First Name",
  lastName: "Last Name",
  fullName: "Full Name",
  username: "Username",
  email: "Email",
  phone: "Phone",
  street: "Street Address",
  city: "City",
  state: "State (US)",
  zip: "ZIP Code",
  country: "Country",
  fullAddress: "Full Address",
  uuid: "UUID v4",
  ipv4: "IPv4 Address",
  ipv6: "IPv6 Address",
  mac: "MAC Address",
  url: "URL",
  domain: "Domain",
  slug: "URL Slug",
  colorName: "Color Name",
  company: "Company Name",
  jobTitle: "Job Title",
  catchPhrase: "Catch Phrase",
  loremWord: "Lorem Word",
  loremSentence: "Lorem Sentence",
  loremParagraph: "Lorem Paragraph",
  time: "Time (HH:MM:SS)",
  date: "Date (YYYY-MM-DD)",
  timestamp: "ISO Timestamp",
  money: "Money",
  age: "Age",
  integer: "Integer",
  decimal: "Decimal",
  boolean: "Boolean",
  hexColor: "Hex Color",
  rgbColor: "RGB Color",
  password: "Password",
  nationality: "Nationality",
  isbn: "ISBN-13",
  semver: "SemVer",
  timezone: "Timezone",
  constant: "Constant",
};

export const DEFAULT_SCHEMA: Schema = {
  fields: [
    { name: "id", type: "uuid" },
    { name: "name", type: "fullName" },
    { name: "email", type: "email" },
    { name: "phone", type: "phone" },
    { name: "address", type: "fullAddress" },
    { name: "company", type: "company" },
    { name: "jobTitle", type: "jobTitle" },
    { name: "website", type: "url" },
    { name: "createdAt", type: "timestamp" },
  ],
};

/** Generate a single field value given a schema field. */
export function generateField(field: FieldSchema, rng: Rng): unknown {
  if (field.nullChance !== undefined && field.nullChance > 0 && rng.next() < field.nullChance) {
    return null;
  }
  const min = field.min ?? 0;
  const max = field.max ?? 1000;
  switch (field.type) {
    case "firstName": return firstName(rng);
    case "lastName": return lastName(rng);
    case "fullName": return fullName(rng);
    case "username": return username(rng);
    case "email": return email(rng);
    case "phone": return phone(rng);
    case "street": return street(rng);
    case "city": return city(rng);
    case "state": return state(rng);
    case "zip": return zip(rng);
    case "country": return country(rng);
    case "fullAddress": return fullAddress(rng);
    case "uuid": return uuid(rng);
    case "ipv4": return ipv4(rng);
    case "ipv6": return ipv6(rng);
    case "mac": return mac(rng);
    case "url": return url(rng);
    case "domain": return domainName(rng);
    case "slug": return slug(rng, field.wordCount ?? 5);
    case "colorName": return colorName(rng);
    case "company": return company(rng);
    case "jobTitle": return jobTitle(rng);
    case "catchPhrase": return catchPhrase(rng);
    case "loremWord": return loremWord(rng);
    case "loremSentence": return loremSentence(rng, field.wordCount);
    case "loremParagraph": return loremParagraph(rng, field.sentences);
    case "time": return time(rng);
    case "date": return date(rng, { minYear: min || undefined, maxYear: max || undefined });
    case "timestamp": return timestamp(rng);
    case "money": return money(rng, { min, max });
    case "age": return age(rng, min || 18, max || 90);
    case "integer": return integer(rng, min, max);
    case "decimal": return decimal(rng, min, max, field.precision ?? 2);
    case "boolean": return boolean(rng);
    case "hexColor": return hexColor(rng);
    case "rgbColor": return rgbColor(rng);
    case "password": return password(rng, field.min ?? 16);
    case "nationality": return nationality(rng);
    case "isbn": return isbn(rng);
    case "semver": return semver(rng);
    case "timezone": return timezone(rng);
    case "constant": return field.value ?? "";
    default: return null;
  }
}

/** Generate a single record from a schema. */
export function generateRecord(schema: Schema, rng: Rng): Record<string, unknown> {
  const rec: Record<string, unknown> = {};
  for (const f of schema.fields) {
    rec[f.name] = generateField(f, rng);
  }
  return rec;
}

/** Generate a batch of records deterministically from a seed. */
export function generateBatch(schema: Schema, count: number, seed: string | number): Record<string, unknown>[] {
  const rng = createRng(seed);
  const out: Record<string, unknown>[] = [];
  const n = Math.max(0, Math.min(count, 100000));
  for (let i = 0; i < n; i++) {
    out.push(generateRecord(schema, rng));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Export formats
// ---------------------------------------------------------------------------

function escapeCsvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function exportJson(records: Record<string, unknown>[]): string {
  return JSON.stringify(records, null, 2);
}

export function exportNdjson(records: Record<string, unknown>[]): string {
  return records.map((r) => JSON.stringify(r)).join("\n");
}

export function exportCsv(records: Record<string, unknown>[]): string {
  if (records.length === 0) return "";
  const headers = Object.keys(records[0]!);
  const lines = [headers.join(",")];
  for (const r of records) {
    lines.push(headers.map((h) => escapeCsvCell(r[h])).join(","));
  }
  return lines.join("\n");
}

export function exportSql(
  records: Record<string, unknown>[],
  table = "fake_data",
): string {
  if (records.length === 0) return "";
  const headers = Object.keys(records[0]!);
  const cols = headers.map((h) => `\`${h}\``).join(", ");
  const lines: string[] = [];
  for (const r of records) {
    const vals = headers
      .map((h) => sqlEscape(r[h]))
      .join(", ");
    lines.push(`INSERT INTO \`${table}\` (${cols}) VALUES (${vals});`);
  }
  return lines.join("\n");
}

function sqlEscape(v: unknown): string {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "NULL";
  if (typeof v === "boolean") return v ? "1" : "0";
  const s = String(v).replace(/'/g, "''");
  return `'${s}'`;
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:fake-data-generator:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  seed: string;
  count: number;
  fieldCount: number;
  format: string;
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

export function buildShareUrl(seed: string, count: number, format: string, schemaJson: string): string {
  const params = new URLSearchParams();
  if (seed) params.set("seed", seed);
  if (count) params.set("count", String(count));
  if (format) params.set("fmt", format);
  if (schemaJson) params.set("schema", schemaJson);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(
  hash: string,
): { seed: string; count: number; format: string; schema: string } {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { seed: "", count: 10, format: "json", schema: "" };
  const params = new URLSearchParams(clean);
  const countStr = params.get("count") ?? "10";
  const parsed = parseInt(countStr, 10);
  const count = Number.isNaN(parsed) ? 10 : Math.max(1, Math.min(100000, parsed));
  const fmt = params.get("fmt") ?? "json";
  const validFmts = ["json", "csv", "ndjson", "sql"];
  const format = validFmts.includes(fmt) ? fmt : "json";
  return {
    seed: params.get("seed") ?? "",
    count,
    format,
    schema: params.get("schema") ?? "",
  };
}

/** Parse a JSON schema string; returns null on parse failure. */
export function parseSchema(json: string): Schema | null {
  if (!json) return null;
  try {
    const obj = JSON.parse(json) as Schema;
    if (!obj || !Array.isArray(obj.fields)) return null;
    for (const f of obj.fields) {
      if (typeof f.name !== "string" || typeof f.type !== "string") return null;
      if (!FIELD_TYPES.includes(f.type as FieldType)) return null;
    }
    return obj;
  } catch {
    return null;
  }
}

/** Serialize a schema to a compact JSON string. */
export function serializeSchema(schema: Schema): string {
  return JSON.stringify(schema);
}

/** Add a new field to a schema, returning a new schema. */
export function addField(schema: Schema, field: FieldSchema): Schema {
  return { fields: [...schema.fields, field] };
}

/** Remove a field by name from a schema, returning a new schema. */
export function removeField(schema: Schema, name: string): Schema {
  return { fields: schema.fields.filter((f) => f.name !== name) };
}

/** Compute the total number of generator functions exposed. */
export const GENERATOR_COUNT = FIELD_TYPES.length;
