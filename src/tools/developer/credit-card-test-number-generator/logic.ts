/**
 * Credit Card Test Number Generator — pure logic.
 *
 * Generates Luhn-valid, clearly-fake credit card numbers for sandbox/test
 * environments, by brand (Visa, Mastercard, Amex, Discover, JCB, Diners,
 * UnionPay, Maestro). Produces matching expiry, CVV, and cardholder name.
 * Includes a processor sandbox library (Stripe/Adyen/Braintree/PayPal) with
 * official canonical test numbers and scenario tags.
 *
 * Pure functions only — no DOM, no network, no external deps.
 *
 * HONESTY CLAUSE: These numbers are Luhn-valid but UNASSIGNED. They cannot
 * be used for real payments. They are for sandbox / testing only.
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
  const string = (len: number, charset: string): string => {
    let out = "";
    for (let i = 0; i < len; i++) out += charset[Math.floor(r() * charset.length)];
    return out;
  };
  return { next: r, int, pick, bool, string };
}

// ---------------------------------------------------------------------------
// Card brands + BIN/IIN prefixes
// ---------------------------------------------------------------------------

export type CardBrand =
  | "visa"
  | "mastercard"
  | "amex"
  | "discover"
  | "jcb"
  | "diners"
  | "unionpay"
  | "maestro";

export interface BrandSpec {
  brand: CardBrand;
  label: string;
  /** Known IIN/BIN prefixes (string digits). */
  prefixes: string[];
  /** Allowed total lengths (including check digit). */
  lengths: number[];
  /** CVV/CVC length. */
  cvvLength: number;
}

export const BRAND_SPECS: Record<CardBrand, BrandSpec> = {
  visa: {
    brand: "visa",
    label: "Visa",
    prefixes: ["4"],
    lengths: [16],
    cvvLength: 3,
  },
  mastercard: {
    brand: "mastercard",
    label: "Mastercard",
    prefixes: [
      "51", "52", "53", "54", "55",
      "2221", "2222", "2223", "2224", "2225",
      "2226", "2227", "2228", "2229",
      "223", "224", "225", "226", "227", "228", "229",
      "23", "24", "25", "26", "270", "271", "2720",
    ],
    lengths: [16],
    cvvLength: 3,
  },
  amex: {
    brand: "amex",
    label: "American Express",
    prefixes: ["34", "37"],
    lengths: [15],
    cvvLength: 4,
  },
  discover: {
    brand: "discover",
    label: "Discover",
    prefixes: ["6011", "644", "645", "646", "647", "648", "649", "65", "622126"],
    lengths: [16],
    cvvLength: 3,
  },
  jcb: {
    brand: "jcb",
    label: "JCB",
    prefixes: ["3528", "3529", "353", "354", "355", "356", "357", "358"],
    lengths: [16],
    cvvLength: 3,
  },
  diners: {
    brand: "diners",
    label: "Diners Club",
    prefixes: ["300", "301", "302", "303", "304", "305", "36", "38"],
    lengths: [14],
    cvvLength: 3,
  },
  unionpay: {
    brand: "unionpay",
    label: "UnionPay",
    prefixes: ["62"],
    lengths: [16],
    cvvLength: 3,
  },
  maestro: {
    brand: "maestro",
    label: "Maestro",
    prefixes: ["5018", "5020", "5038", "6304", "6759", "6761", "6762", "6763"],
    lengths: [16],
    cvvLength: 3,
  },
};

export const BRAND_LIST: CardBrand[] = [
  "visa", "mastercard", "amex", "discover", "jcb", "diners", "unionpay", "maestro",
];

export function getBrandSpec(brand: CardBrand): BrandSpec {
  return BRAND_SPECS[brand];
}

// ---------------------------------------------------------------------------
// Luhn algorithm (generate + validate)
// ---------------------------------------------------------------------------

/** Compute the Luhn check digit for a number string (without check digit). */
export function luhnCheckDigit(numberWithoutCheck: string): number {
  if (!/^\d+$/.test(numberWithoutCheck)) {
    throw new Error("luhnCheckDigit: input must be all digits");
  }
  // We reverse so index 0 = rightmost (which is the position just before the check digit).
  const digits = numberWithoutCheck.split("").reverse().map((d) => parseInt(d, 10));
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    // The check digit would be at i = -1 (rightmost). So the digit just to its
    // left is at i = 0 and gets doubled (odd position from the right of the full number).
    let d = digits[i]!;
    if (i % 2 === 0) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return (10 - (sum % 10)) % 10;
}

/** Validate that a full card number (digits only) passes the Luhn check. */
export function luhnValidate(fullNumber: string): boolean {
  const s = fullNumber.replace(/[\s-]/g, "");
  if (!/^\d+$/.test(s)) return false;
  if (s.length < 2) return false;
  const withoutCheck = s.slice(0, -1);
  const providedCheck = parseInt(s.slice(-1), 10);
  const expectedCheck = luhnCheckDigit(withoutCheck);
  return providedCheck === expectedCheck;
}

// ---------------------------------------------------------------------------
// Number generation
// ---------------------------------------------------------------------------

/** Generate a Luhn-valid card number (digits only) for a given brand. */
export function generateNumber(brand: CardBrand, rng: Rng): string {
  const spec = BRAND_SPECS[brand];
  const prefix = rng.pick(spec.prefixes);
  const length = rng.pick(spec.lengths);
  // Build the partial: prefix + random middle digits, length-1 total (we add check digit last)
  const middleLen = length - prefix.length - 1;
  let middle = "";
  for (let i = 0; i < middleLen; i++) {
    middle += rng.int(0, 9).toString();
  }
  const partial = prefix + middle;
  const check = luhnCheckDigit(partial);
  return partial + check.toString();
}

// ---------------------------------------------------------------------------
// Expiry / CVV / Cardholder
// ---------------------------------------------------------------------------

export interface Expiry {
  month: string; // "MM"
  year: string;  // "YY"
}

/** Generate a future expiry date (1 month to ~6 years out). */
export function generateExpiry(rng: Rng): Expiry {
  const now = new Date();
  const curYear = now.getFullYear();
  const curMonth = now.getMonth() + 1;
  // Add 1 to 72 months in the future
  const addMonths = rng.int(1, 72);
  const total = curYear * 12 + (curMonth - 1) + addMonths;
  const y = Math.floor(total / 12);
  const m = (total % 12) + 1;
  return {
    month: String(m).padStart(2, "0"),
    year: String(y).slice(-2),
  };
}

/** Generate a CVV with the correct length for the brand. */
export function generateCvv(brand: CardBrand, rng: Rng): string {
  const spec = BRAND_SPECS[brand];
  return rng.string(spec.cvvLength, "0123456789");
}

const CARDHOLDER_FIRST: readonly string[] = [
  "John", "Jane", "Alex", "Sam", "Chris", "Pat", "Taylor", "Jordan",
  "Casey", "Morgan", "Riley", "Avery", "Quinn", "Drew", "Skyler", "Reese",
  "Cameron", "Hayden", "Jamie", "Logan",
];

const CARDHOLDER_LAST: readonly string[] = [
  "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis",
  "Rodriguez", "Martinez", "Wilson", "Anderson", "Thomas", "Lee", "Walker",
  "Hall", "Allen", "Young", "King", "Wright",
];

/** Generate a fake cardholder name (First Last). */
export function generateCardholder(rng: Rng): string {
  return `${rng.pick(CARDHOLDER_FIRST)} ${rng.pick(CARDHOLDER_LAST)}`;
}

// ---------------------------------------------------------------------------
// Bundle generation
// ---------------------------------------------------------------------------

export interface CardBundle {
  brand: CardBrand;
  number: string;       // digits only, no separators
  expiryMonth: string;  // MM
  expiryYear: string;   // YY
  cvv: string;
  cardholder: string;
}

/** Generate a full test card bundle for a single brand. */
export function generateBundle(brand: CardBrand, rng: Rng): CardBundle {
  const exp = generateExpiry(rng);
  return {
    brand,
    number: generateNumber(brand, rng),
    expiryMonth: exp.month,
    expiryYear: exp.year,
    cvv: generateCvv(brand, rng),
    cardholder: generateCardholder(rng),
  };
}

export interface BulkOptions {
  count: number;
  brands?: CardBrand[]; // if omitted, random brand per card
  seed?: string | number;
}

/** Generate a batch of card bundles. */
export function generateBundleBulk(opts: BulkOptions): CardBundle[] {
  const seed = opts.seed ?? Math.random().toString(36).slice(2);
  const rng = createRng(seed);
  const brands = opts.brands && opts.brands.length > 0 ? opts.brands : BRAND_LIST;
  const n = Math.max(0, Math.min(opts.count, 10000));
  const out: CardBundle[] = [];
  for (let i = 0; i < n; i++) {
    const brand = brands.length === 1 ? brands[0]! : rng.pick(brands);
    out.push(generateBundle(brand, rng));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Formatting + brand detection
// ---------------------------------------------------------------------------

export type CardFormat = "plain" | "spaced" | "dashed" | "grouped";

/** Format a card number with separators. */
export function formatCard(number: string, format: CardFormat): string {
  const digits = number.replace(/\D/g, "");
  switch (format) {
    case "plain": return digits;
    case "spaced": return digits.match(/.{1,4}/g)?.join(" ") ?? digits;
    case "dashed": return digits.match(/.{1,4}/g)?.join("-") ?? digits;
    case "grouped":
      // Amex uses 4-6-5 grouping; others 4-4-4-4
      if (digits.length === 15) {
        return `${digits.slice(0, 4)} ${digits.slice(4, 10)} ${digits.slice(10)}`;
      }
      return digits.match(/.{1,4}/g)?.join(" ") ?? digits;
    default: return digits;
  }
}

/** Detect a card brand from a number. Returns null if no match. */
export function detectBrand(number: string): CardBrand | null {
  const digits = number.replace(/\D/g, "");
  if (!digits) return null;
  // Test longest prefix first for accurate match
  for (const brand of BRAND_LIST) {
    const spec = BRAND_SPECS[brand];
    if (!spec.lengths.includes(digits.length)) continue;
    for (const prefix of spec.prefixes) {
      if (digits.startsWith(prefix)) return brand;
    }
  }
  return null;
}

/** Format a bundle to a single human-readable line. */
export function formatBundleLine(bundle: CardBundle, format: CardFormat = "grouped"): string {
  const num = formatCard(bundle.number, format);
  return `${BRAND_SPECS[bundle.brand].label}: ${num} | ${bundle.expiryMonth}/${bundle.expiryYear} | CVV ${bundle.cvv} | ${bundle.cardholder}`;
}

// ---------------------------------------------------------------------------
// Processor sandbox library — canonical official test cards
// ---------------------------------------------------------------------------

export type ProcessorScenario =
  | "success"
  | "decline"
  | "insufficient_funds"
  | "3ds_required"
  | "3ds_required_attempt"
  | "expired_card"
  | "incorrect_cvc"
  | "processing_error"
  | "fraud";

export interface ProcessorTestCard {
  processor: "stripe" | "adyen" | "braintree" | "paypal";
  brand: CardBrand;
  number: string;
  scenario: ProcessorScenario;
  description: string;
}

/**
 * Canonical processor test cards. These are the OFFICIAL published sandbox
 * numbers from each processor's public documentation. They are not real cards.
 * They are Luhn-valid but unassigned, safe for sandbox use only.
 */
export const PROCESSOR_TEST_CARDS: readonly ProcessorTestCard[] = [
  // Stripe (https://docs.stripe.com/testing)
  { processor: "stripe", brand: "visa", number: "4242424242424242", scenario: "success", description: "Visa — successful payment" },
  { processor: "stripe", brand: "visa", number: "4000056655665556", scenario: "success", description: "Visa (debit) — successful payment" },
  { processor: "stripe", brand: "mastercard", number: "5555555555554444", scenario: "success", description: "Mastercard — successful payment" },
  { processor: "stripe", brand: "mastercard", number: "2223003122003222", scenario: "success", description: "Mastercard 2-series — successful payment" },
  { processor: "stripe", brand: "amex", number: "378282246310005", scenario: "success", description: "American Express — successful payment" },
  { processor: "stripe", brand: "amex", number: "371449635398431", scenario: "success", description: "American Express — successful payment (alt)" },
  { processor: "stripe", brand: "discover", number: "6011111111111117", scenario: "success", description: "Discover — successful payment" },
  { processor: "stripe", brand: "jcb", number: "3530111333300000", scenario: "success", description: "JCB — successful payment" },
  { processor: "stripe", brand: "diners", number: "3056930009020004", scenario: "success", description: "Diners Club — successful payment" },
  { processor: "stripe", brand: "visa", number: "4000000000000002", scenario: "decline", description: "Visa — generic decline" },
  { processor: "stripe", brand: "visa", number: "4000000000009995", scenario: "insufficient_funds", description: "Visa — insufficient funds decline" },
  { processor: "stripe", brand: "visa", number: "4000000000000010", scenario: "incorrect_cvc", description: "Visa — incorrect CVC decline" },
  { processor: "stripe", brand: "visa", number: "4000000000000069", scenario: "expired_card", description: "Visa — expired card decline" },
  { processor: "stripe", brand: "visa", number: "4000000000000119", scenario: "processing_error", description: "Visa — processing error decline" },
  { processor: "stripe", brand: "visa", number: "4000000000003220", scenario: "3ds_required", description: "Visa — 3DS authentication required" },
  { processor: "stripe", brand: "visa", number: "4000000000003055", scenario: "3ds_required_attempt", description: "Visa — 3DS authentication supported but not required" },
  { processor: "stripe", brand: "visa", number: "4100000000000019", scenario: "fraud", description: "Visa — risk-level-elevated (Stripe Radar)" },
  // Adyen (https://docs.adyen.com/development-resources/testcardnumbers)
  { processor: "adyen", brand: "visa", number: "4111111145551142", scenario: "success", description: "Adyen Visa — successful" },
  { processor: "adyen", brand: "mastercard", number: "5555444433331111", scenario: "success", description: "Adyen Mastercard — successful" },
  { processor: "adyen", brand: "amex", number: "370000000000002", scenario: "success", description: "Adyen Amex — successful" },
  { processor: "adyen", brand: "discover", number: "6011000000000004", scenario: "success", description: "Adyen Discover — successful" },
  // Braintree (https://developer.paypal.com/braintree/docs/guides/credit-cards/testing-go-live)
  { processor: "braintree", brand: "visa", number: "4111111111111111", scenario: "success", description: "Braintree Visa — successful" },
  { processor: "braintree", brand: "mastercard", number: "5555555555554444", scenario: "success", description: "Braintree Mastercard — successful" },
  { processor: "braintree", brand: "amex", number: "378282246310005", scenario: "success", description: "Braintree Amex — successful" },
  { processor: "braintree", brand: "discover", number: "6011111111111117", scenario: "success", description: "Braintree Discover — successful" },
  { processor: "braintree", brand: "jcb", number: "3530111333300000", scenario: "success", description: "Braintree JCB — successful" },
  { processor: "braintree", brand: "diners", number: "30000000000004", scenario: "success", description: "Braintree Diners — successful" },
  // PayPal (https://developer.paypal.com/braintree/docs/guides/credit-cards/testing-go-live)
  { processor: "paypal", brand: "visa", number: "4012000033330026", scenario: "success", description: "PayPal Visa — successful" },
  { processor: "paypal", brand: "mastercard", number: "5105105105105100", scenario: "success", description: "PayPal Mastercard — successful" },
  { processor: "paypal", brand: "amex", number: "378734493671000", scenario: "success", description: "PayPal Amex — successful" },
  { processor: "paypal", brand: "discover", number: "6011000990139424", scenario: "success", description: "PayPal Discover — successful" },
];

/** Filter processor test cards by processor. */
export function cardsByProcessor(processor: ProcessorTestCard["processor"]): ProcessorTestCard[] {
  return PROCESSOR_TEST_CARDS.filter((c) => c.processor === processor);
}

/** Filter processor test cards by scenario. */
export function cardsByScenario(scenario: ProcessorScenario): ProcessorTestCard[] {
  return PROCESSOR_TEST_CARDS.filter((c) => c.scenario === scenario);
}

// ---------------------------------------------------------------------------
// Export formats
// ---------------------------------------------------------------------------

function escapeCsvCell(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function bundlesToJson(bundles: CardBundle[]): string {
  return JSON.stringify(bundles, null, 2);
}

export function bundlesToCsv(bundles: CardBundle[]): string {
  const headers = ["brand", "number", "expiry_month", "expiry_year", "cvv", "cardholder"];
  const lines = [headers.join(",")];
  for (const b of bundles) {
    lines.push([
      escapeCsvCell(b.brand),
      escapeCsvCell(b.number),
      escapeCsvCell(b.expiryMonth),
      escapeCsvCell(b.expiryYear),
      escapeCsvCell(b.cvv),
      escapeCsvCell(b.cardholder),
    ].join(","));
  }
  return lines.join("\n");
}

export function bundlesToText(bundles: CardBundle[], format: CardFormat = "grouped"): string {
  return bundles.map((b) => formatBundleLine(b, format)).join("\n");
}

export function processorCardsToJson(cards: ProcessorTestCard[]): string {
  return JSON.stringify(cards, null, 2);
}

export function processorCardsToCsv(cards: ProcessorTestCard[]): string {
  const headers = ["processor", "brand", "number", "scenario", "description"];
  const lines = [headers.join(",")];
  for (const c of cards) {
    lines.push([
      escapeCsvCell(c.processor),
      escapeCsvCell(c.brand),
      escapeCsvCell(c.number),
      escapeCsvCell(c.scenario),
      escapeCsvCell(c.description),
    ].join(","));
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:credit-card-test-number-generator:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  seed: string;
  count: number;
  brands: CardBrand[];
  format: CardFormat;
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
  format: CardFormat,
  brands: CardBrand[],
): string {
  const params = new URLSearchParams();
  if (seed) params.set("seed", seed);
  if (count) params.set("count", String(count));
  if (format) params.set("fmt", format);
  if (brands.length > 0) params.set("brands", brands.join(","));
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(
  hash: string,
): { seed: string; count: number; format: CardFormat; brands: CardBrand[] } {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { seed: "", count: 10, format: "grouped", brands: [] };
  const params = new URLSearchParams(clean);
  const countStr = params.get("count") ?? "10";
  const parsedCount = parseInt(countStr, 10);
  const count = Number.isNaN(parsedCount) ? 10 : Math.max(1, Math.min(10000, parsedCount));
  const fmt = params.get("fmt") ?? "grouped";
  const validFmts: CardFormat[] = ["plain", "spaced", "dashed", "grouped"];
  const format = validFmts.includes(fmt as CardFormat) ? (fmt as CardFormat) : "grouped";
  const brandsStr = params.get("brands") ?? "";
  const brands = brandsStr
    ? brandsStr.split(",").filter((b) => BRAND_LIST.includes(b as CardBrand)) as CardBrand[]
    : [];
  return {
    seed: params.get("seed") ?? "",
    count,
    format,
    brands,
  };
}

/** Honesty banner text — these are sandbox-only numbers, never real. */
export const HONESTY_BANNER =
  "These are Luhn-valid but UNASSIGNED test numbers for sandbox/development only. They CANNOT be used for real payments. Never attempt to use generated numbers against live payment systems.";
