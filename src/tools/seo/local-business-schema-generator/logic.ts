/**
 * Local Business Schema Generator — pure logic.
 *
 * Generate LocalBusiness JSON-LD for local SEO. Pure functions only — no DOM,
 * no network.
 */

export type BusinessType =
  | "LocalBusiness"
  | "Restaurant"
  | "Store"
  | "MedicalBusiness"
  | "Dentist"
  | "HealthAndBeautyBusiness"
  | "AutoRepair"
  | "Electrician"
  | "Plumber"
  | "HairSalon"
  | "Hotel"
  | "FinancialService"
  | "TravelAgency"
  | "Pharmacy"
  | "AnimalShelter"
  | "VeterinaryCare";

export const BUSINESS_TYPES: BusinessType[] = [
  "LocalBusiness",
  "Restaurant",
  "Store",
  "MedicalBusiness",
  "Dentist",
  "HealthAndBeautyBusiness",
  "AutoRepair",
  "Electrician",
  "Plumber",
  "HairSalon",
  "Hotel",
  "FinancialService",
  "TravelAgency",
  "Pharmacy",
  "AnimalShelter",
  "VeterinaryCare",
];

export type DayOfWeek = "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday";

export const DAYS: DayOfWeek[] = [
  "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
];

export interface DayHours {
  day: DayOfWeek;
  open: string; // HH:MM or ""
  close: string; // HH:MM or ""
}

export interface BusinessInput {
  type: BusinessType;
  name: string;
  description?: string;
  url?: string;
  image?: string;
  telephone?: string;
  email?: string;
  streetAddress: string;
  addressLocality: string;
  addressRegion: string;
  postalCode: string;
  addressCountry: string;
  geoLat?: string;
  geoLng?: string;
  priceRange?: string;
  ratingValue?: string;
  reviewCount?: string;
  areaServed?: string;
  hours: DayHours[];
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

export function isValidUrl(url: string): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function isValidEmail(email: string): boolean {
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidTime(t: string): boolean {
  if (!t) return false;
  return /^\d{2}:\d{2}$/.test(t) && parseInt(t.slice(0, 2)) < 24 && parseInt(t.slice(3, 5)) < 60;
}

export function isValidGeo(s: string): boolean {
  if (!s) return false;
  const n = parseFloat(s);
  return !isNaN(n) && isFinite(n);
}

export function isValidGeoLat(lat: string): boolean {
  if (!isValidGeo(lat)) return false;
  const n = parseFloat(lat);
  return n >= -90 && n <= 90;
}

export function isValidGeoLng(lng: string): boolean {
  if (!isValidGeo(lng)) return false;
  const n = parseFloat(lng);
  return n >= -180 && n <= 180;
}

/** Validate the business input. */
export function validate(input: BusinessInput): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!input.name || !input.name.trim()) errors.push("Business name is required");
  if (!input.streetAddress || !input.streetAddress.trim()) errors.push("Street address is required");
  if (!input.addressLocality || !input.addressLocality.trim()) errors.push("City (addressLocality) is required");
  if (!input.addressCountry || !input.addressCountry.trim()) errors.push("Country is required");
  if (input.url && !isValidUrl(input.url)) errors.push("Website URL must be a valid http(s) URL");
  if (input.image && !isValidUrl(input.image)) errors.push("Image URL must be a valid http(s) URL");
  if (input.email && !isValidEmail(input.email)) errors.push("Email is invalid");
  if (input.geoLat && !isValidGeoLat(input.geoLat)) errors.push("Geo latitude must be -90 to 90");
  if (input.geoLng && !isValidGeoLng(input.geoLng)) errors.push("Geo longitude must be -180 to 180");
  if (input.ratingValue) {
    const r = parseFloat(input.ratingValue);
    if (isNaN(r) || r < 0 || r > 5) errors.push("Rating value must be 0-5");
  }
  if (input.reviewCount) {
    const c = parseInt(input.reviewCount, 10);
    if (isNaN(c) || c < 0) errors.push("Review count must be a non-negative integer");
  }
  // Validate hours — if open is set, close must be too, and vice versa
  for (const h of input.hours) {
    if (h.open && !h.close) errors.push(`${h.day}: open time set but close time missing`);
    if (!h.open && h.close) errors.push(`${h.day}: close time set but open time missing`);
    if (h.open && !isValidTime(h.open)) errors.push(`${h.day}: open time must be HH:MM`);
    if (h.close && !isValidTime(h.close)) errors.push(`${h.day}: close time must be HH:MM`);
  }
  // Warnings
  if (!input.telephone || !input.telephone.trim()) warnings.push("Telephone is recommended for local SEO");
  if (!input.image) warnings.push("Image is recommended — Google shows photos in local packs");
  if (!input.priceRange) warnings.push("Price range helps users filter (e.g. $, $$, $$$)");
  if (!input.geoLat || !input.geoLng) warnings.push("Geo coordinates improve map accuracy");
  return { ok: errors.length === 0, errors, warnings };
}

/** Build the JSON-LD object. */
export function buildJsonLd(input: BusinessInput): Record<string, unknown> {
  const v = validate(input);
  if (!v.ok) throw new Error(v.errors.join("; "));
  const obj: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": input.type,
    name: input.name,
  };
  if (input.description) obj.description = input.description;
  if (input.url) obj.url = input.url;
  if (input.image) obj.image = input.image;
  if (input.telephone) obj.telephone = input.telephone;
  if (input.email) obj.email = input.email;
  obj.address = {
    "@type": "PostalAddress",
    streetAddress: input.streetAddress,
    addressLocality: input.addressLocality,
    addressRegion: input.addressRegion || undefined,
    postalCode: input.postalCode || undefined,
    addressCountry: input.addressCountry,
  };
  if (input.geoLat && input.geoLng) {
    obj.geo = {
      "@type": "GeoCoordinates",
      latitude: parseFloat(input.geoLat),
      longitude: parseFloat(input.geoLng),
    };
  }
  if (input.priceRange) obj.priceRange = input.priceRange;
  if (input.areaServed) obj.areaServed = input.areaServed;
  if (input.ratingValue && input.reviewCount) {
    obj.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: parseFloat(input.ratingValue),
      reviewCount: parseInt(input.reviewCount, 10),
    };
  }
  // Opening hours
  const hoursSpec = input.hours
    .filter((h) => h.open && h.close)
    .map((h) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: h.day,
      opens: h.open,
      closes: h.close,
    }));
  if (hoursSpec.length > 0) obj.openingHoursSpecification = hoursSpec;
  return obj;
}

/** Build a JSON-LD <script> tag. */
export function buildScriptTag(json: Record<string, unknown>): string {
  return `<script type="application/ld+json">\n${JSON.stringify(json, null, 2)}\n</script>`;
}

/** Full pipeline: build + script tag. */
export function generate(input: BusinessInput): string {
  return buildScriptTag(buildJsonLd(input));
}

/** Build a Google Rich Results test URL. */
export function buildGoogleRichResultsLink(): string {
  return "https://search.google.com/test/rich-results";
}

/** Build a Schema.org docs link for the type. */
export function buildSchemaDocsLink(type: BusinessType): string {
  return `https://schema.org/${type}`;
}

/** Get default empty hours structure. */
export function defaultHours(): DayHours[] {
  return DAYS.map((day) => ({ day, open: "", close: "" }));
}

// ---- History ----

const HISTORY_KEY = "unqtools:local-business-schema-generator:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  type: BusinessType;
  name: string;
  city: string;
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

// ---- Shareable URL ----

export function buildShareUrl(input: Partial<BusinessInput>): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(input)) {
    if (v === undefined || v === null || v === "") continue;
    if (k === "hours") {
      // Compact hours: day=open|close;day=open|close
      const compact = (v as DayHours[])
        .filter((h) => h.open && h.close)
        .map((h) => `${h.day}=${h.open}|${h.close}`)
        .join(";");
      if (compact) params.set("hours", compact);
    } else {
      params.set(k, String(v));
    }
  }
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<BusinessInput> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Partial<BusinessInput> = {};
  for (const [k, v] of params.entries()) {
    if (k === "hours") {
      const hours: DayHours[] = defaultHours();
      for (const part of v.split(";")) {
        const [daySpec, timeSpec] = part.split("=");
        if (!daySpec || !timeSpec) continue;
        const [open, close] = timeSpec.split("|");
        const idx = hours.findIndex((h) => h.day === daySpec);
        if (idx >= 0) {
          hours[idx] = { day: daySpec as DayOfWeek, open: open || "", close: close || "" };
        }
      }
      out.hours = hours;
    } else {
      (out as Record<string, unknown>)[k] = v;
    }
  }
  return out;
}
