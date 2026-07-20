/**
 * Random User Profile Generator — pure logic.
 *
 * Generates coherent fake personas with 50+ correlated fields:
 *   - gender → name.title, name.first (gender-correct)
 *   - name.first + name.last → email, username (deterministic derivation)
 *   - dob.date → dob.age (always consistent)
 *   - registered.date → registered.age (always consistent)
 *   - nat (nationality) → matching country, city, state, postcode format, phone format
 *   - seed → deterministic identicon avatar (SVG data URL — no real faces)
 *
 * Pure functions only — no DOM, no network, no external deps. Safe to unit
 * test and to run inside a Web Worker.
 *
 * Design references: randomuser.me API shape, Faker.js persons, DiceBear.
 */

// ---------------------------------------------------------------------------
// PRNG — deterministic mulberry32 + helpers
// ---------------------------------------------------------------------------

/** Mulberry32 — small, fast, deterministic PRNG. */
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
// Public types
// ---------------------------------------------------------------------------

export type Gender = "male" | "female";
export type GenderMix = "any" | "male" | "female";

export type Nationality =
  | "US" | "GB" | "CA" | "AU" | "IE"
  | "DE" | "FR" | "ES" | "IT" | "NL"
  | "BR" | "IN" | "JP";

export type ExportFormat = "json" | "csv" | "xml" | "ndjson";

export interface ProfileOptions {
  gender: GenderMix;
  nat: Nationality;
  count: number;
  seed: string;
  emailDomain: string;
  passwordPolicy: "weak" | "medium" | "strong";
  includeFields: string[]; // empty = all
  excludeFields: string[];
}

export type Result<T> = { ok: true; output: T } | { ok: false; error: string };

// ---------------------------------------------------------------------------
// Constants / catalogs
// ---------------------------------------------------------------------------

export const GENDER_MIX_OPTIONS: ReadonlyArray<{ value: GenderMix; label: string }> = [
  { value: "any", label: "Any (mixed)" },
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
];

export const NAT_OPTIONS: ReadonlyArray<{ value: Nationality; label: string }> = [
  { value: "US", label: "🇺🇸 United States" },
  { value: "GB", label: "🇬🇧 United Kingdom" },
  { value: "CA", label: "🇨🇦 Canada" },
  { value: "AU", label: "🇦🇺 Australia" },
  { value: "IE", label: "🇮🇪 Ireland" },
  { value: "DE", label: "🇩🇪 Germany" },
  { value: "FR", label: "🇫🇷 France" },
  { value: "ES", label: "🇪🇸 Spain" },
  { value: "IT", label: "🇮🇹 Italy" },
  { value: "NL", label: "🇳🇱 Netherlands" },
  { value: "BR", label: "🇧🇷 Brazil" },
  { value: "IN", label: "🇮🇳 India" },
  { value: "JP", label: "🇯🇵 Japan" },
];

export const PASSWORD_POLICY_OPTIONS: ReadonlyArray<{ value: ProfileOptions["passwordPolicy"]; label: string }> = [
  { value: "weak", label: "Weak (8 chars, letters)" },
  { value: "medium", label: "Medium (10 chars, letters+digits)" },
  { value: "strong", label: "Strong (16 chars, mixed+symbols)" },
];

/** Catalog of all top-level + nested fields the generator can emit.
 *  Dot-notation keys mirror the JSON path. */
export const FIELD_KEYS: readonly string[] = [
  "gender",
  "name.title", "name.first", "name.last", "name.full",
  "location.street.number", "location.street.name",
  "location.city", "location.state", "location.country", "location.postcode",
  "location.coordinates.latitude", "location.coordinates.longitude",
  "location.timezone.offset", "location.timezone.description",
  "email",
  "login.uuid", "login.username", "login.password",
  "login.salt", "login.md5", "login.sha1", "login.sha256",
  "dob.date", "dob.age",
  "registered.date", "registered.age",
  "phone", "cell",
  "id.name", "id.value",
  "picture.large", "picture.medium", "picture.thumbnail",
  "nat",
  "company.name", "company.department", "company.title",
  "website", "domain",
  "ip", "mac",
  "avatar",
  "license_plate", "ssn",
  "credit_card.type", "credit_card.number", "credit_card.expiry",
  "favorite_color", "blood_type", "zodiac",
];

export const DEFAULT_OPTIONS: ProfileOptions = {
  gender: "any",
  nat: "US",
  count: 5,
  seed: "",
  emailDomain: "example.com",
  passwordPolicy: "medium",
  includeFields: [],
  excludeFields: [],
};

export const SAMPLE_SEEDS: readonly string[] = [
  "test-fixture-001",
  "qa-load-test-2024",
  "demo-persona-acme",
  "ci-staging-42",
  "design-review-mockups",
];

/** Maximum number of profiles per batch — keeps the browser responsive. */
export const MAX_BATCH = 50_000;

// ---------------------------------------------------------------------------
// Data dictionaries
// ---------------------------------------------------------------------------

const FIRST_MALE: readonly string[] = [
  "James", "John", "Robert", "Michael", "William", "David", "Joseph", "Thomas",
  "Charles", "Christopher", "Daniel", "Matthew", "Anthony", "Mark", "Donald",
  "Steven", "Paul", "Andrew", "Joshua", "Kenneth", "Kevin", "Brian", "George",
  "Edward", "Ronald", "Timothy", "Jason", "Jeffrey", "Ryan", "Jacob", "Gary",
  "Nicholas", "Eric", "Jonathan", "Stephen", "Larry", "Justin", "Scott", "Brandon",
  "Benjamin", "Samuel", "Gregory", "Frank", "Alexander", "Raymond", "Patrick",
  "Jack", "Dennis", "Jerry", "Tyler", "Aaron", "Henry", "Douglas", "Peter",
  "Adam", "Nathan", "Zachary", "Walter", "Harold", "Kyle", "Carl", "Arthur",
];

const FIRST_FEMALE: readonly string[] = [
  "Mary", "Patricia", "Jennifer", "Linda", "Elizabeth", "Barbara", "Susan",
  "Jessica", "Sarah", "Karen", "Nancy", "Lisa", "Betty", "Margaret", "Sandra",
  "Ashley", "Kimberly", "Emily", "Donna", "Michelle", "Carol", "Amanda",
  "Dorothy", "Melissa", "Deborah", "Stephanie", "Rebecca", "Sharon", "Laura",
  "Cynthia", "Kathleen", "Amy", "Shirley", "Angela", "Helen", "Anna", "Brenda",
  "Pamela", "Nicole", "Emma", "Samantha", "Katherine", "Christine", "Debra",
  "Rachel", "Catherine", "Carolyn", "Janet", "Ruth", "Maria", "Heather",
  "Diane", "Virginia", "Julie", "Joyce", "Victoria", "Olivia", "Kelly",
  "Christina", "Lauren", "Joan", "Evelyn", "Judith", "Andrea", "Hannah",
];

const LAST_NAMES: readonly string[] = [
  "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis",
  "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson",
  "Thomas", "Taylor", "Moore", "Jackson", "Martin", "Lee", "Perez", "Thompson",
  "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson", "Walker",
  "Young", "Allen", "King", "Wright", "Scott", "Torres", "Nguyen", "Hill",
  "Flores", "Green", "Adams", "Nelson", "Baker", "Hall", "Rivera", "Campbell",
  "Mitchell", "Carter", "Roberts", "Gomez", "Phillips", "Evans", "Turner", "Diaz",
  "Parker", "Cruz", "Edwards", "Collins", "Reyes", "Stewart", "Morris", "Morales",
  "Murphy", "Cook", "Rogers", "Gutierrez", "Ortiz", "Morgan", "Cooper", "Peterson",
  "Bailey", "Reed", "Kelly", "Howard", "Ramos", "Kim", "Cox", "Ward", "Richardson",
];

const TITLE_MALE = ["Mr", "Mr", "Mr", "Dr", "Prof"] as const;
const TITLE_FEMALE = ["Ms", "Mrs", "Miss", "Ms", "Dr", "Prof"] as const;

const STREET_NAMES: readonly string[] = [
  "Main St", "Oak Ave", "Maple Dr", "Cedar Ln", "Pine Rd", "Elm St", "Washington Blvd",
  "Park Ave", "Lake View Dr", "Hill Rd", "Sunset Blvd", "River Rd", "High St",
  "Church St", "Forest Dr", "Spring St", "Meadow Ln", "Birchwood Dr", "Market St",
  "School St", "Mill Rd", "Victoria Rd", "King St", "Queen St", "Station Rd",
];

const COMPANY_NAMES: readonly string[] = [
  "Acme", "Globex", "Umbrella", "Stark", "Wayne", "Initech", "Hooli", "Vandelay",
  "Pied Piper", "Soylent", "Cyberdyne", "Aperture", "Tyrell", "Wonka", "Nakatomi",
  "Gringotts", "Stark Industries", "Massive Dynamic", "Oceanic", "Soylent Corp",
  "Trex", "Helix", "Lumen", "Vortex", "Quantum", "Nimbus", "Stratos", "Zenith",
];

const COMPANY_DEPARTMENTS: readonly string[] = [
  "Engineering", "Product", "Design", "Marketing", "Sales", "Support",
  "Finance", "Operations", "Legal", "Human Resources", "Research", "Data",
];

const JOB_TITLES: readonly string[] = [
  "Software Engineer", "Senior Developer", "Product Manager", "Designer",
  "Data Analyst", "DevOps Engineer", "QA Engineer", "Engineering Manager",
  "Frontend Developer", "Backend Developer", "Full-Stack Developer",
  "Site Reliability Engineer", "Solutions Architect", "Tech Lead",
  "Customer Success Manager", "Account Executive", "Marketing Manager",
  "Content Strategist", "UX Researcher", "Graphic Designer",
];

const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;

const COLOR_NAMES: readonly string[] = [
  "Crimson", "Azure", "Forest Green", "Goldenrod", "Slate Gray", "Lavender",
  "Coral", "Teal", "Indigo", "Maroon", "Olive", "Salmon", "Plum", "Periwinkle",
];

/** Per-nationality locale data: country, sample cities, state names, postcode format,
 *  phone format, coordinates box. */
interface NatData {
  country: string;
  cities: readonly string[];
  states: readonly string[];
  postcodeFormat: string; // # = digit, A = uppercase letter
  phoneFormat: string;
  latRange: [number, number];
  lngRange: [number, number];
  tzOffset: string;
  tzDescription: string;
  idName: string;
  idFormat: string;
  ssnFormat: string;
  plateFormat: string;
}

const NAT_DATA: Record<Nationality, NatData> = {
  US: {
    country: "United States",
    cities: ["New York", "Los Angeles", "Chicago", "Houston", "Phoenix", "Philadelphia", "San Antonio", "San Diego", "Dallas", "San Jose"],
    states: ["Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut", "Delaware", "Florida", "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire", "New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota", "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington", "West Virginia", "Wisconsin", "Wyoming"],
    postcodeFormat: "#####",
    phoneFormat: "(###) ###-####",
    latRange: [25, 49],
    lngRange: [-125, -70],
    tzOffset: "-08:00",
    tzDescription: "Pacific Time (US & Canada)",
    idName: "SSN",
    idFormat: "###-##-####",
    ssnFormat: "###-##-####",
    plateFormat: "AAA-####",
  },
  GB: {
    country: "United Kingdom",
    cities: ["London", "Manchester", "Birmingham", "Leeds", "Glasgow", "Sheffield", "Bradford", "Liverpool", "Edinburgh", "Bristol"],
    states: ["England", "Scotland", "Wales", "Northern Ireland"],
    postcodeFormat: "AA## #AA",
    phoneFormat: "0##-#### ####",
    latRange: [50, 59],
    lngRange: [-6, 2],
    tzOffset: "+00:00",
    tzDescription: "Greenwich Mean Time",
    idName: "NINO",
    idFormat: "AA######A",
    ssnFormat: "AA######A",
    plateFormat: "AA## AAA",
  },
  CA: {
    country: "Canada",
    cities: ["Toronto", "Montreal", "Vancouver", "Calgary", "Edmonton", "Ottawa", "Winnipeg", "Quebec City", "Hamilton", "Halifax"],
    states: ["Ontario", "Quebec", "British Columbia", "Alberta", "Manitoba", "Saskatchewan", "Nova Scotia", "New Brunswick", "Newfoundland and Labrador", "Prince Edward Island"],
    postcodeFormat: "A#A #A#",
    phoneFormat: "(###) ###-####",
    latRange: [49, 60],
    lngRange: [-130, -60],
    tzOffset: "-05:00",
    tzDescription: "Eastern Time (US & Canada)",
    idName: "SIN",
    idFormat: "###-###-###",
    ssnFormat: "###-###-###",
    plateFormat: "ABCD-###",
  },
  AU: {
    country: "Australia",
    cities: ["Sydney", "Melbourne", "Brisbane", "Perth", "Adelaide", "Gold Coast", "Newcastle", "Canberra", "Sunshine Coast", "Wollongong"],
    states: ["New South Wales", "Victoria", "Queensland", "Western Australia", "South Australia", "Tasmania", "Australian Capital Territory", "Northern Territory"],
    postcodeFormat: "####",
    phoneFormat: "0# #### ####",
    latRange: [-43, -12],
    lngRange: [113, 154],
    tzOffset: "+10:00",
    tzDescription: "Australian Eastern Time",
    idName: "TFN",
    idFormat: "### ### ###",
    ssnFormat: "### ### ###",
    plateFormat: "AAA-###A",
  },
  IE: {
    country: "Ireland",
    cities: ["Dublin", "Cork", "Galway", "Limerick", "Waterford", "Drogheda", "Dundalk", "Bray", "Sligo", "Tralee"],
    states: ["Leinster", "Munster", "Connacht", "Ulster"],
    postcodeFormat: "A## ####",
    phoneFormat: "0#-### ####",
    latRange: [51, 55],
    lngRange: [-10, -5],
    tzOffset: "+00:00",
    tzDescription: "Greenwich Mean Time",
    idName: "PPS",
    idFormat: "#######A",
    ssnFormat: "#######A",
    plateFormat: "##-A-####",
  },
  DE: {
    country: "Germany",
    cities: ["Berlin", "Hamburg", "Munich", "Cologne", "Frankfurt", "Stuttgart", "Düsseldorf", "Leipzig", "Dortmund", "Essen"],
    states: ["Bavaria", "Berlin", "Hamburg", "Hesse", "Lower Saxony", "North Rhine-Westphalia", "Rhineland-Palatinate", "Saxony", "Baden-Württemberg"],
    postcodeFormat: "#####",
    phoneFormat: "0### #######",
    latRange: [47, 55],
    lngRange: [6, 15],
    tzOffset: "+01:00",
    tzDescription: "Central European Time",
    idName: "Steuer-ID",
    idFormat: "###########",
    ssnFormat: "###########",
    plateFormat: "A-##-####",
  },
  FR: {
    country: "France",
    cities: ["Paris", "Marseille", "Lyon", "Toulouse", "Nice", "Nantes", "Strasbourg", "Montpellier", "Bordeaux", "Lille"],
    states: ["Île-de-France", "Provence-Alpes-Côte d'Azur", "Auvergne-Rhône-Alpes", "Occitanie", "Nouvelle-Aquitaine", "Grand Est", "Pays de la Loire", "Brittany", "Normandy"],
    postcodeFormat: "#####",
    phoneFormat: "0# ## ## ## ##",
    latRange: [42, 51],
    lngRange: [-5, 8],
    tzOffset: "+01:00",
    tzDescription: "Central European Time",
    idName: "INSEE",
    idFormat: "#############",
    ssnFormat: "#############",
    plateFormat: "AA-###-AA",
  },
  ES: {
    country: "Spain",
    cities: ["Madrid", "Barcelona", "Valencia", "Seville", "Zaragoza", "Málaga", "Murcia", "Palma", "Bilbao", "Alicante"],
    states: ["Andalusia", "Catalonia", "Madrid", "Valencia", "Galicia", "Castile and León", "Basque Country", "Canary Islands"],
    postcodeFormat: "#####",
    phoneFormat: "### ### ###",
    latRange: [36, 44],
    lngRange: [-9, 3],
    tzOffset: "+01:00",
    tzDescription: "Central European Time",
    idName: "DNI",
    idFormat: "########A",
    ssnFormat: "########A",
    plateFormat: "#### AAA",
  },
  IT: {
    country: "Italy",
    cities: ["Rome", "Milan", "Naples", "Turin", "Palermo", "Genoa", "Bologna", "Florence", "Bari", "Catania"],
    states: ["Lazio", "Lombardy", "Campania", "Piedmont", "Sicily", "Liguria", "Emilia-Romagna", "Tuscany", "Apulia", "Veneto"],
    postcodeFormat: "#####",
    phoneFormat: "### #### ####",
    latRange: [36, 47],
    lngRange: [7, 18],
    tzOffset: "+01:00",
    tzDescription: "Central European Time",
    idName: "Codice Fiscale",
    idFormat: "######AA##A###A",
    ssnFormat: "######AA##A###A",
    plateFormat: "AA###AA",
  },
  NL: {
    country: "Netherlands",
    cities: ["Amsterdam", "Rotterdam", "The Hague", "Utrecht", "Eindhoven", "Tilburg", "Groningen", "Almere", "Breda", "Nijmegen"],
    states: ["North Holland", "South Holland", "Utrecht", "North Brabant", "Gelderland", "Limburg", "Friesland", "Overijssel"],
    postcodeFormat: "#### AA",
    phoneFormat: "0# ########",
    latRange: [51, 53],
    lngRange: [3, 7],
    tzOffset: "+01:00",
    tzDescription: "Central European Time",
    idName: "BSN",
    idFormat: "#########",
    ssnFormat: "#########",
    plateFormat: "##-AAA-#",
  },
  BR: {
    country: "Brazil",
    cities: ["São Paulo", "Rio de Janeiro", "Salvador", "Brasília", "Fortaleza", "Belo Horizonte", "Manaus", "Curitiba", "Recife", "Porto Alegre"],
    states: ["São Paulo", "Rio de Janeiro", "Bahia", "Minas Gerais", "Paraná", "Rio Grande do Sul", "Pernambuco", "Ceará", "Amazonas", "Pará"],
    postcodeFormat: "#####-###",
    phoneFormat: "(##) ####-####",
    latRange: [-33, 5],
    lngRange: [-74, -34],
    tzOffset: "-03:00",
    tzDescription: "Brasília Time",
    idName: "CPF",
    idFormat: "###.###.###-##",
    ssnFormat: "###.###.###-##",
    plateFormat: "AAA-####",
  },
  IN: {
    country: "India",
    cities: ["Mumbai", "Delhi", "Bangalore", "Hyderabad", "Chennai", "Kolkata", "Pune", "Ahmedabad", "Jaipur", "Surat"],
    states: ["Maharashtra", "Delhi", "Karnataka", "Telangana", "Tamil Nadu", "West Bengal", "Gujarat", "Rajasthan", "Uttar Pradesh", "Kerala"],
    postcodeFormat: "######",
    phoneFormat: "#####-#####",
    latRange: [8, 35],
    lngRange: [68, 92],
    tzOffset: "+05:30",
    tzDescription: "India Standard Time",
    idName: "Aadhaar",
    idFormat: "#### #### ####",
    ssnFormat: "#### #### ####",
    plateFormat: "## AA ####",
  },
  JP: {
    country: "Japan",
    cities: ["Tokyo", "Yokohama", "Osaka", "Nagoya", "Sapporo", "Fukuoka", "Kobe", "Kyoto", "Kawasaki", "Saitama"],
    states: ["Tokyo", "Osaka", "Hokkaido", "Aichi", "Kanagawa", "Hyogo", "Kyoto", "Fukuoka", "Saitama", "Chiba"],
    postcodeFormat: "###-####",
    phoneFormat: "0#-####-####",
    latRange: [31, 45],
    lngRange: [129, 146],
    tzOffset: "+09:00",
    tzDescription: "Japan Standard Time",
    idName: "My Number",
    idFormat: "############",
    ssnFormat: "############",
    plateFormat: "###-AA",
  },
};

const CREDIT_CARD_TYPES: ReadonlyArray<{ type: string; prefixes: readonly string[]; length: number }> = [
  { type: "Visa", prefixes: ["4"], length: 16 },
  { type: "Mastercard", prefixes: ["51", "52", "53", "54", "55"], length: 16 },
  { type: "American Express", prefixes: ["34", "37"], length: 15 },
  { type: "Discover", prefixes: ["6011", "65"], length: 16 },
];

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

/** Format a template like "(###) ###-####" using RNG for digits/letters. */
export function formatTemplate(rng: Rng, tpl: string): string {
  let out = "";
  for (const ch of tpl) {
    if (ch === "#") out += String(rng.int(0, 9));
    else if (ch === "A") out += "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[rng.int(0, 25)];
    else if (ch === "a") out += "abcdefghijklmnopqrstuvwxyz"[rng.int(0, 25)];
    else out += ch;
  }
  return out;
}

/** Slug a name into a lowercase username-safe form. */
export function slugify(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, ".");
}

/** Generate a username from a first + last name with a random suffix. */
export function makeUsername(rng: Rng, first: string, last: string): string {
  const style = rng.int(0, 3);
  const num = rng.int(0, 999);
  const f = slugify(first);
  const l = slugify(last);
  switch (style) {
    case 0: return `${f}.${l}${num}`;
    case 1: return `${f}${l[0] ?? "x"}${num}`;
    case 2: return `${f[0] ?? "x"}${l}${num}`;
    default: return `${f}_${l}${num}`;
  }
}

/** Generate an email from a name and domain. */
export function makeEmail(rng: Rng, first: string, last: string, domain: string): string {
  const style = rng.int(0, 2);
  const num = rng.int(0, 99);
  const f = slugify(first);
  const l = slugify(last);
  let local: string;
  switch (style) {
    case 0: local = `${f}.${l}${num}`; break;
    case 1: local = `${f}${l[0] ?? "x"}${num}`; break;
    default: local = `${f}_${l}${num}`; break;
  }
  return `${local}@${domain}`;
}

/** Generate a password honoring the chosen policy. */
export function makePassword(rng: Rng, policy: ProfileOptions["passwordPolicy"]): string {
  switch (policy) {
    case "weak": {
      const c = "abcdefghijklmnopqrstuvwxyz";
      return rng.string(8, c) + rng.string(2, c.toUpperCase());
    }
    case "strong": {
      const c = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
      return rng.string(16, c);
    }
    case "medium":
    default: {
      const c = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
      return rng.string(10, c);
    }
  }
}

/** Format an ISO date string (YYYY-MM-DD) from year/month/day. */
function isoDate(y: number, m: number, d: number): string {
  const mm = String(m).padStart(2, "0");
  const dd = String(d).padStart(2, "0");
  return `${y}-${mm}-${dd}`;
}

/** Compute integer age given a dob year/month/day vs. a reference date. */
function ageFromDob(dobY: number, dobM: number, dobD: number, refY: number, refM: number, refD: number): number {
  let age = refY - dobY;
  if (refM < dobM || (refM === dobM && refD < dobD)) age--;
  return age;
}

/** Generate a Luhn-valid credit-card number with the given prefix and length. */
export function makeCreditCardNumber(rng: Rng, prefix: string, length: number): string {
  const partial = prefix + Array.from({ length: length - prefix.length - 1 }, () => rng.int(0, 9)).join("");
  // Luhn checksum
  let sum = 0;
  let alt = true;
  for (let i = partial.length - 1; i >= 0; i--) {
    let d = partial.charCodeAt(i) - 48;
    if (alt) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    alt = !alt;
  }
  const check = (10 - (sum % 10)) % 10;
  return partial + String(check);
}

/** Simple deterministic hash (FNV-1a) → 8 hex chars; used for identicon seed. */
function shortHash(s: string): string {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

// ---------------------------------------------------------------------------
// Identicon avatar (algorithmic SVG — no real faces)
// ---------------------------------------------------------------------------

/** Generate an inline SVG identicon as a data URL, deterministic by seed string.
 *  Mirrors GitHub-style 5x5 mirrored-block identicons. */
export function identiconDataUrl(seed: string, size = 128): string {
  const h = shortHash(seed);
  // 15 hex chars → 15 cells of a 5x5 grid (left half + center, mirrored)
  const cells = h + shortHash(h).padStart(8, "0").slice(0, 7); // 15 chars
  const hue = parseInt(cells.slice(0, 2), 16) % 360;
  const sat = 50 + (parseInt(cells.slice(2, 4), 16) % 30); // 50-79
  const light = 40 + (parseInt(cells.slice(4, 6), 16) % 25); // 40-64
  const fg = `hsl(${hue} ${sat}% ${light}%)`;
  const bg = "hsl(0 0% 96%)";
  const n = 5;
  const cell = size / (n + 2); // 1-cell padding all around
  const pad = cell;
  let rects = `<rect width="${size}" height="${size}" fill="${bg}"/>`;
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < Math.ceil(n / 2); col++) {
      const idx = row * Math.ceil(n / 2) + col;
      const on = parseInt(cells[idx % cells.length], 16) % 2 === 0;
      if (!on) continue;
      // mirrored x
      const x = pad + col * cell;
      const y = pad + row * cell;
      rects += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${cell.toFixed(1)}" height="${cell.toFixed(1)}" fill="${fg}"/>`;
      // mirror
      const mx = pad + (n - 1 - col) * cell;
      if (mx !== x) {
        rects += `<rect x="${mx.toFixed(1)}" y="${y.toFixed(1)}" width="${cell.toFixed(1)}" height="${cell.toFixed(1)}" fill="${fg}"/>`;
      }
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${rects}</svg>`;
  // URL-encode for data: URI (compact, no base64 padding overhead)
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

// ---------------------------------------------------------------------------
// Field-level generators (return raw values; profile assembler wires them up)
// ---------------------------------------------------------------------------

export function pickFirstName(rng: Rng, gender: Gender): string {
  return gender === "male" ? rng.pick(FIRST_MALE) : rng.pick(FIRST_FEMALE);
}

export function pickLastName(rng: Rng): string {
  return rng.pick(LAST_NAMES);
}

export function pickTitle(rng: Rng, gender: Gender): string {
  return gender === "male" ? rng.pick([...TITLE_MALE]) : rng.pick([...TITLE_FEMALE]);
}

export function pickStreet(rng: Rng): { number: number; name: string } {
  return { number: rng.int(100, 9999), name: rng.pick(STREET_NAMES) };
}

export function pickCompany(rng: Rng): { name: string; department: string; title: string } {
  return {
    name: `${rng.pick(COMPANY_NAMES)} ${rng.pick(["Inc", "Corp", "LLC", "Ltd", "Group", "Holdings"])}`,
    department: rng.pick(COMPANY_DEPARTMENTS),
    title: rng.pick(JOB_TITLES),
  };
}

export function pickCreditCard(rng: Rng): { type: string; number: string; expiry: string } {
  const cc = rng.pick(CREDIT_CARD_TYPES);
  const prefix = rng.pick(cc.prefixes);
  const number = makeCreditCardNumber(rng, prefix, cc.length);
  const mm = String(rng.int(1, 12)).padStart(2, "0");
  const yy = String(rng.int(26, 35));
  return { type: cc.type, number, expiry: `${mm}/${yy}` };
}

export function pickZodiac(month: number, day: number): string {
  // month 1-12
  if ((month === 3 && day >= 21) || (month === 4 && day <= 19)) return "Aries";
  if ((month === 4 && day >= 20) || (month === 5 && day <= 20)) return "Taurus";
  if ((month === 5 && day >= 21) || (month === 6 && day <= 20)) return "Gemini";
  if ((month === 6 && day >= 21) || (month === 7 && day <= 22)) return "Cancer";
  if ((month === 7 && day >= 23) || (month === 8 && day <= 22)) return "Leo";
  if ((month === 8 && day >= 23) || (month === 9 && day <= 22)) return "Virgo";
  if ((month === 9 && day >= 23) || (month === 10 && day <= 22)) return "Libra";
  if ((month === 10 && day >= 23) || (month === 11 && day <= 21)) return "Scorpio";
  if ((month === 11 && day >= 22) || (month === 12 && day <= 21)) return "Sagittarius";
  if ((month === 12 && day >= 22) || (month === 1 && day <= 19)) return "Capricorn";
  if ((month === 1 && day >= 20) || (month === 2 && day <= 18)) return "Aquarius";
  return "Pisces";
}

// ---------------------------------------------------------------------------
// Profile assembly
// ---------------------------------------------------------------------------

export interface UserProfile {
  gender: Gender;
  name: { title: string; first: string; last: string; full: string };
  location: {
    street: { number: number; name: string };
    city: string;
    state: string;
    country: string;
    postcode: string;
    coordinates: { latitude: string; longitude: string };
    timezone: { offset: string; description: string };
  };
  email: string;
  login: {
    uuid: string;
    username: string;
    password: string;
    salt: string;
    md5: string;
    sha1: string;
    sha256: string;
  };
  dob: { date: string; age: number };
  registered: { date: string; age: number };
  phone: string;
  cell: string;
  id: { name: string; value: string };
  picture: { large: string; medium: string; thumbnail: string };
  nat: Nationality;
  company: { name: string; department: string; title: string };
  website: string;
  domain: string;
  ip: string;
  mac: string;
  avatar: string;
  license_plate: string;
  ssn: string;
  credit_card: { type: string; number: string; expiry: string };
  favorite_color: string;
  blood_type: string;
  zodiac: string;
}

/** Generate a single coherent profile from a seeded RNG. */
export function generateProfile(rng: Rng, opts: ProfileOptions): UserProfile {
  const gender: Gender = opts.gender === "any"
    ? (rng.bool() ? "male" : "female")
    : opts.gender;

  const natData = NAT_DATA[opts.nat] ?? NAT_DATA.US;

  const first = pickFirstName(rng, gender);
  const last = pickLastName(rng);
  const title = pickTitle(rng, gender);

  // DOB: 18-90 years old
  const refY = 2024, refM = 6, refD = 15; // fixed reference → deterministic
  const ageYears = rng.int(18, 90);
  const dobY = refY - ageYears - (rng.int(0, 1) === 0 ? 0 : 1);
  const dobM = rng.int(1, 12);
  const dobD = rng.int(1, 28);
  const dobDate = isoDate(dobY, dobM, dobD);
  const dobAge = ageFromDob(dobY, dobM, dobD, refY, refM, refD);

  // Registered: 0-15 years ago
  const regYearsAgo = rng.int(0, 15);
  const regY = refY - regYearsAgo;
  const regM = rng.int(1, 12);
  const regD = rng.int(1, 28);
  const registeredDate = isoDate(regY, regM, regD);
  const registeredAge = ageFromDob(regY, regM, regD, refY, refM, refD);

  const username = makeUsername(rng, first, last);
  const email = makeEmail(rng, first, last, opts.emailDomain);
  const password = makePassword(rng, opts.passwordPolicy);
  const salt = rng.hex(8);
  const loginUuid = `${rng.hex(8)}-${rng.hex(4)}-${rng.hex(4)}-${rng.hex(4)}-${rng.hex(12)}`;

  const street = pickStreet(rng);
  const city = rng.pick(natData.cities);
  const state = rng.pick(natData.states);
  const country = natData.country;
  const postcode = formatTemplate(rng, natData.postcodeFormat);

  const lat = (natData.latRange[0] + rng.next() * (natData.latRange[1] - natData.latRange[0])).toFixed(6);
  const lng = (natData.lngRange[0] + rng.next() * (natData.lngRange[1] - natData.lngRange[0])).toFixed(6);

  const company = pickCompany(rng);
  const cc = pickCreditCard(rng);
  const zodiac = pickZodiac(dobM, dobD);

  const avatar = identiconDataUrl(`${first}.${last}.${username}`, 128);
  const avatarLarge = identiconDataUrl(`${first}.${last}.${username}`, 128);
  const avatarMed = identiconDataUrl(`${first}.${last}.${username}`, 72);
  const avatarThumb = identiconDataUrl(`${first}.${last}.${username}`, 48);

  return {
    gender,
    name: { title, first, last, full: `${first} ${last}` },
    location: {
      street,
      city,
      state,
      country,
      postcode,
      coordinates: { latitude: lat, longitude: lng },
      timezone: { offset: natData.tzOffset, description: natData.tzDescription },
    },
    email,
    login: {
      uuid: loginUuid,
      username,
      password,
      salt,
      md5: rng.hex(32),
      sha1: rng.hex(40),
      sha256: rng.hex(64),
    },
    dob: { date: dobDate, age: dobAge },
    registered: { date: registeredDate, age: registeredAge },
    phone: formatTemplate(rng, natData.phoneFormat),
    cell: formatTemplate(rng, natData.phoneFormat),
    id: { name: natData.idName, value: formatTemplate(rng, natData.idFormat) },
    picture: { large: avatarLarge, medium: avatarMed, thumbnail: avatarThumb },
    nat: opts.nat,
    company,
    website: `https://www.${slugify(company.name)}.${rng.pick(["com", "io", "net", "co"])}`,
    domain: `${slugify(company.name)}.${rng.pick(["com", "io", "net", "co"])}`,
    ip: `${rng.int(1, 255)}.${rng.int(0, 255)}.${rng.int(0, 255)}.${rng.int(0, 255)}`,
    mac: Array.from({ length: 6 }, () => rng.hex(2)).join(":").toUpperCase(),
    avatar,
    license_plate: formatTemplate(rng, natData.plateFormat),
    ssn: formatTemplate(rng, natData.ssnFormat),
    credit_card: cc,
    favorite_color: rng.pick(COLOR_NAMES),
    blood_type: rng.pick([...BLOOD_TYPES]),
    zodiac,
  };
}

// ---------------------------------------------------------------------------
// Field filtering (include/exclude — dot-path aware)
// ---------------------------------------------------------------------------

function getPath(obj: unknown, path: string): unknown {
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur && typeof cur === "object" && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return undefined;
    }
  }
  return cur;
}

function setPath(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split(".");
  let cur: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i]!;
    if (typeof cur[p] !== "object" || cur[p] === null) cur[p] = {};
    cur = cur[p] as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]!] = value;
}

function pruneEmpty(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(pruneEmpty);
  if (obj && typeof obj === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      const p = pruneEmpty(v);
      if (p !== undefined && !(typeof p === "object" && p !== null && Object.keys(p).length === 0)) {
        out[k] = p;
      }
    }
    return out;
  }
  return obj;
}

/** Apply include/exclude field filters to a profile (dot-path aware). */
export function applyFieldFilter(profile: UserProfile, opts: ProfileOptions): Record<string, unknown> {
  const include = opts.includeFields.length > 0 ? new Set(opts.includeFields) : null;
  const exclude = new Set(opts.excludeFields);
  const out: Record<string, unknown> = {};
  for (const key of FIELD_KEYS) {
    if (exclude.has(key)) continue;
    if (include && !include.has(key)) continue;
    const v = getPath(profile, key);
    if (v !== undefined) setPath(out, key, v);
  }
  return pruneEmpty(out) as Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Batch generation
// ---------------------------------------------------------------------------

/** Validate options before batch generation. */
export function validateOptions(opts: ProfileOptions): Result<void> {
  if (opts.count < 1) return { ok: false, error: "Count must be at least 1." };
  if (opts.count > MAX_BATCH) return { ok: false, error: `Count exceeds max batch (${MAX_BATCH.toLocaleString()}).` };
  if (!opts.emailDomain || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(opts.emailDomain)) {
    return { ok: false, error: "Email domain must look like example.com." };
  }
  return { ok: true, output: undefined };
}

/** Generate a batch of profiles. Each profile gets a deterministic seed
 *  derived from (baseSeed, index). */
export function generateBatch(opts: ProfileOptions): Result<UserProfile[]> {
  const v = validateOptions(opts);
  if (!v.ok) return v;
  const baseSeed = opts.seed || `auto-${Date.now()}`;
  const profiles: UserProfile[] = [];
  for (let i = 0; i < opts.count; i++) {
    const rng = createRng(`${baseSeed}::${opts.nat}::${opts.gender}::${i}`);
    profiles.push(generateProfile(rng, opts));
  }
  return { ok: true, output: profiles };
}

// ---------------------------------------------------------------------------
// Exporters
// ---------------------------------------------------------------------------

/** Export profiles to JSON (pretty-printed, optionally field-filtered). */
export function exportJson(profiles: UserProfile[], opts: ProfileOptions): string {
  const filtered = profiles.map((p) => applyFieldFilter(p, opts));
  return JSON.stringify(filtered, null, 2);
}

/** Export profiles to NDJSON (one JSON object per line, optionally filtered). */
export function exportNdjson(profiles: UserProfile[], opts: ProfileOptions): string {
  const filtered = profiles.map((p) => applyFieldFilter(p, opts));
  return filtered.map((p) => JSON.stringify(p)).join("\n");
}

/** Flatten a filtered profile into a single-level record for CSV. */
function flatten(obj: unknown, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  if (obj && typeof obj === "object") {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      const key = prefix ? `${prefix}.${k}` : k;
      if (v && typeof v === "object" && !Array.isArray(v)) {
        Object.assign(out, flatten(v, key));
      } else {
        out[key] = String(v ?? "");
      }
    }
  }
  return out;
}

/** CSV-escape a single cell value. */
export function csvEscape(v: string): string {
  if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

/** Export profiles to CSV (flattened, dot-path columns). */
export function exportCsv(profiles: UserProfile[], opts: ProfileOptions): string {
  const rows = profiles.map((p) => flatten(applyFieldFilter(p, opts)));
  const headers = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  const lines = [headers.map(csvEscape).join(",")];
  for (const r of rows) {
    lines.push(headers.map((h) => csvEscape(r[h] ?? "")).join(","));
  }
  return lines.join("\n");
}

/** XML-escape a value. */
export function xmlEscape(v: string): string {
  return v.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case "<": return "&lt;";
      case ">": return "&gt;";
      case "&": return "&amp;";
      case "'": return "&apos;";
      case '"': return "&quot;";
      default: return c;
    }
  });
}

function toXml(obj: unknown, name: string, indent: string): string {
  if (obj === null || obj === undefined) return "";
  if (typeof obj !== "object") return `${indent}<${name}>${xmlEscape(String(obj))}</${name}>`;
  if (Array.isArray(obj)) {
    return obj.map((v) => toXml(v, name, indent)).join("\n");
  }
  const inner = Object.entries(obj as Record<string, unknown>)
    .map(([k, v]) => toXml(v, k, indent + "  "))
    .filter(Boolean)
    .join("\n");
  return `${indent}<${name}>\n${inner}\n${indent}</${name}>`;
}

/** Export profiles to XML. */
export function exportXml(profiles: UserProfile[], opts: ProfileOptions): string {
  const filtered = profiles.map((p) => applyFieldFilter(p, opts));
  const body = filtered
    .map((p, i) => toXml(p, "user", "  "))
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<users count="${filtered.length}">\n${body}\n</users>`;
}

/** Dispatch an export by format. */
export function exportProfiles(profiles: UserProfile[], opts: ProfileOptions, fmt: ExportFormat): string {
  switch (fmt) {
    case "csv": return exportCsv(profiles, opts);
    case "xml": return exportXml(profiles, opts);
    case "ndjson": return exportNdjson(profiles, opts);
    case "json":
    default: return exportJson(profiles, opts);
  }
}

/** File extension + mime for each export format. */
export function exportMime(fmt: ExportFormat): { ext: string; mime: string } {
  switch (fmt) {
    case "csv": return { ext: "csv", mime: "text/csv" };
    case "xml": return { ext: "xml", mime: "application/xml" };
    case "ndjson": return { ext: "ndjson", mime: "application/x-ndjson" };
    case "json":
    default: return { ext: "json", mime: "application/json" };
  }
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:random-user-profile:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  count: number;
  gender: GenderMix;
  nat: Nationality;
  seed: string;
  format: ExportFormat;
  previewName: string;
  bytes: number;
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
// Shareable URL (config encoded in fragment — never sent to server)
// ---------------------------------------------------------------------------

export function buildShareUrl(opts: ProfileOptions): string {
  const params = new URLSearchParams();
  params.set("g", opts.gender);
  params.set("n", opts.nat);
  params.set("c", String(opts.count));
  params.set("pp", opts.passwordPolicy);
  if (opts.seed) params.set("s", opts.seed);
  if (opts.emailDomain && opts.emailDomain !== DEFAULT_OPTIONS.emailDomain) {
    params.set("d", opts.emailDomain);
  }
  if (opts.includeFields.length) params.set("inc", opts.includeFields.join(","));
  if (opts.excludeFields.length) params.set("exc", opts.excludeFields.join(","));
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ProfileOptions {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  const base: ProfileOptions = { ...DEFAULT_OPTIONS };
  if (!clean) return base;
  const params = new URLSearchParams(clean);

  const g = params.get("g");
  if (g && (["any", "male", "female"] as GenderMix[]).includes(g as GenderMix)) {
    base.gender = g as GenderMix;
  }
  const n = params.get("n");
  if (n && (NAT_OPTIONS.map((o) => o.value) as Nationality[]).includes(n as Nationality)) {
    base.nat = n as Nationality;
  }
  const c = Number(params.get("c"));
  if (Number.isFinite(c) && c >= 1 && c <= MAX_BATCH) base.count = Math.floor(c);
  const pp = params.get("pp");
  if (pp && (["weak", "medium", "strong"] as ProfileOptions["passwordPolicy"][]).includes(pp as ProfileOptions["passwordPolicy"])) {
    base.passwordPolicy = pp as ProfileOptions["passwordPolicy"];
  }
  const s = params.get("s");
  if (s) base.seed = s.slice(0, 200);
  const d = params.get("d");
  if (d && /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(d)) base.emailDomain = d.toLowerCase();
  const inc = params.get("inc");
  if (inc) base.includeFields = inc.split(",").filter((f) => FIELD_KEYS.includes(f));
  const exc = params.get("exc");
  if (exc) base.excludeFields = exc.split(",").filter((f) => FIELD_KEYS.includes(f));
  return base;
}

// ---------------------------------------------------------------------------
// Stats helpers
// ---------------------------------------------------------------------------

/** Count distinct top-level + nested fields produced by a profile. */
export function countProfileFields(): number {
  return FIELD_KEYS.length;
}

/** Return a per-field sample value from a single profile. */
export function sampleFieldValues(profile: UserProfile): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of FIELD_KEYS) {
    const v = getPath(profile, key);
    if (v !== undefined) out[key] = v;
  }
  return out;
}
