/**
 * Local Citation Finder — pure logic.
 *
 * Match a business against a built-in database of 50+ local citation
 * sources (general, niche-specific, country-specific). Pure functions
 * only — no DOM, no network.
 */

export type DirectoryCategory = "general" | "niche" | "country";
export type Priority = "high" | "medium" | "low";

export interface Directory {
  id: string;
  name: string;
  /** Direct submission URL (if known). If empty, a Google search fallback is used. */
  submitUrl?: string;
  category: DirectoryCategory;
  /** Niche keywords that trigger this directory (lowercase). Empty for general/country. */
  niches: string[];
  /** ISO country codes this directory applies to. Empty for general/niche. */
  countries: string[];
  priority: Priority;
  /** Estimated minutes to submit a listing. */
  timeMinutes: number;
  /** Required fields for submission. */
  requiredFields: string[];
  /** Domain (for reference). */
  domain: string;
}

export interface CitationInputs {
  businessName: string;
  niche: string;
  city: string;
  state: string;
  country: string;
}

export interface Citation extends Directory {
  /** Resolved URL: direct submit URL if known, otherwise a Google search URL. */
  submissionUrl: string;
  /** Matched niche keyword (if any). */
  matchedNiche?: string;
}

export interface SummaryStats {
  total: number;
  byPriority: Record<Priority, number>;
  byCategory: Record<DirectoryCategory, number>;
  totalTimeMinutes: number;
}

export interface FilterOptions {
  priority?: Priority | "";
  category?: DirectoryCategory | "";
}

export const PRIORITY_LABELS: Record<Priority, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

export const CATEGORY_LABELS: Record<DirectoryCategory, string> = {
  general: "General",
  niche: "Niche-specific",
  country: "Country-specific",
};

/** 15+ common business niche presets. */
export const NICHE_PRESETS: string[] = [
  "plumber", "electrician", "hvac", "roofing", "contractor",
  "restaurant", "cafe", "bakery", "bar",
  "dentist", "doctor", "lawyer", "accountant", "cpa",
  "realtor", "salon", "gym", "auto-repair", "hotel",
];

export const COUNTRY_OPTIONS: string[] = [
  "US", "UK", "CA", "AU", "IN",
];

// ---- Directory database (50+ entries) ----

export const DIRECTORIES: Directory[] = [
  // ===== General (10) — always included =====
  {
    id: "yelp",
    name: "Yelp for Business",
    submitUrl: "https://biz.yelp.com/claim",
    category: "general",
    niches: [],
    countries: [],
    priority: "high",
    timeMinutes: 10,
    requiredFields: ["NAP", "Website", "Hours", "Photos", "Category"],
    domain: "yelp.com",
  },
  {
    id: "bing-places",
    name: "Bing Places for Business",
    submitUrl: "https://www.bingplaces.com/",
    category: "general",
    niches: [],
    countries: [],
    priority: "high",
    timeMinutes: 15,
    requiredFields: ["NAP", "Website", "Hours", "Photos", "Service Areas"],
    domain: "bingplaces.com",
  },
  {
    id: "apple-maps",
    name: "Apple Business Connect",
    submitUrl: "https://business.apple.com/",
    category: "general",
    niches: [],
    countries: [],
    priority: "high",
    timeMinutes: 15,
    requiredFields: ["NAP", "Website", "Hours", "Photos", "Category"],
    domain: "business.apple.com",
  },
  {
    id: "facebook",
    name: "Facebook Pages",
    submitUrl: "https://www.facebook.com/pages/creation/",
    category: "general",
    niches: [],
    countries: [],
    priority: "high",
    timeMinutes: 15,
    requiredFields: ["Business Name", "Address", "Phone", "Hours", "Photos", "About"],
    domain: "facebook.com",
  },
  {
    id: "foursquare",
    name: "Foursquare for Business",
    submitUrl: "https://foursquare.com/business/claim",
    category: "general",
    niches: [],
    countries: [],
    priority: "medium",
    timeMinutes: 10,
    requiredFields: ["NAP", "Category", "Hours"],
    domain: "foursquare.com",
  },
  {
    id: "yellowpages-us",
    name: "YellowPages.com",
    submitUrl: "https://www.yellowpages.com/claim-listing",
    category: "general",
    niches: [],
    countries: [],
    priority: "medium",
    timeMinutes: 10,
    requiredFields: ["NAP", "Website", "Category"],
    domain: "yellowpages.com",
  },
  {
    id: "bbb",
    name: "Better Business Bureau",
    submitUrl: "https://www.bbb.org/business-reviews/accreditation",
    category: "general",
    niches: [],
    countries: [],
    priority: "medium",
    timeMinutes: 15,
    requiredFields: ["NAP", "Website", "Business Type", "Owner Info"],
    domain: "bbb.org",
  },
  {
    id: "manta",
    name: "Manta",
    submitUrl: "https://www.manta.com/claim",
    category: "general",
    niches: [],
    countries: [],
    priority: "low",
    timeMinutes: 5,
    requiredFields: ["NAP", "Website", "Category"],
    domain: "manta.com",
  },
  {
    id: "hotfrog",
    name: "Hotfrog",
    submitUrl: "https://www.hotfrog.com/business/add",
    category: "general",
    niches: [],
    countries: [],
    priority: "low",
    timeMinutes: 5,
    requiredFields: ["NAP", "Website", "Category", "Description"],
    domain: "hotfrog.com",
  },
  {
    id: "tupalo",
    name: "Tupalo",
    submitUrl: "https://tupalo.com/add-business",
    category: "general",
    niches: [],
    countries: [],
    priority: "low",
    timeMinutes: 5,
    requiredFields: ["NAP", "Category", "Description"],
    domain: "tupalo.com",
  },

  // ===== Niche-specific (30) =====
  {
    id: "healthgrades",
    name: "HealthGrades",
    submitUrl: "https://www.healthgrades.com/physician/claim-profile",
    category: "niche",
    niches: ["medical", "doctor", "dentist", "healthcare", "physician", "clinic"],
    countries: [],
    priority: "high",
    timeMinutes: 15,
    requiredFields: ["NAP", "Specialty", "Insurance", "Credentials", "Photo"],
    domain: "healthgrades.com",
  },
  {
    id: "zocdoc",
    name: "Zocdoc",
    submitUrl: "https://www.zocdoc.com/practice/claim-profile",
    category: "niche",
    niches: ["medical", "doctor", "dentist", "physician", "clinic"],
    countries: [],
    priority: "high",
    timeMinutes: 15,
    requiredFields: ["NAP", "Specialty", "Insurance", "Booking Hours"],
    domain: "zocdoc.com",
  },
  {
    id: "vitals",
    name: "Vitals",
    submitUrl: "https://www.vitals.com/claim-profile",
    category: "niche",
    niches: ["medical", "doctor", "physician", "dentist"],
    countries: [],
    priority: "medium",
    timeMinutes: 10,
    requiredFields: ["NAP", "Specialty", "Credentials"],
    domain: "vitals.com",
  },
  {
    id: "avvo",
    name: "Avvo",
    submitUrl: "https://www.avvo.com/claim-your-profile",
    category: "niche",
    niches: ["legal", "lawyer", "attorney", "law firm"],
    countries: [],
    priority: "high",
    timeMinutes: 15,
    requiredFields: ["NAP", "Practice Area", "Bar Number", "Photo"],
    domain: "avvo.com",
  },
  {
    id: "lawyers-com",
    name: "Lawyers.com",
    submitUrl: "https://www.lawyers.com/claim-profile",
    category: "niche",
    niches: ["legal", "lawyer", "attorney", "law firm"],
    countries: [],
    priority: "medium",
    timeMinutes: 10,
    requiredFields: ["NAP", "Practice Area", "Bar Number"],
    domain: "lawyers.com",
  },
  {
    id: "martindale",
    name: "Martindale-Hubbell",
    submitUrl: "https://www.martindale.com/claim-listing",
    category: "niche",
    niches: ["legal", "lawyer", "attorney", "law firm"],
    countries: [],
    priority: "medium",
    timeMinutes: 10,
    requiredFields: ["NAP", "Practice Area", "Credentials"],
    domain: "martindale.com",
  },
  {
    id: "houzz",
    name: "Houzz Pro",
    submitUrl: "https://www.houzz.com/proClaim",
    category: "niche",
    niches: ["home services", "contractor", "remodeling", "interior design", "architect", "roofing", "hvac"],
    countries: [],
    priority: "high",
    timeMinutes: 15,
    requiredFields: ["NAP", "Website", "Portfolio Photos", "Services", "Service Area"],
    domain: "houzz.com",
  },
  {
    id: "angi",
    name: "Angi (Angie's List)",
    submitUrl: "https://business.angi.com/claim",
    category: "niche",
    niches: ["home services", "contractor", "plumber", "electrician", "roofing", "hvac", "cleaning"],
    countries: [],
    priority: "high",
    timeMinutes: 15,
    requiredFields: ["NAP", "Services", "Service Area", "License"],
    domain: "angi.com",
  },
  {
    id: "porch",
    name: "Porch",
    submitUrl: "https://porch.com/claim-business",
    category: "niche",
    niches: ["home services", "contractor", "plumber", "electrician", "roofing", "hvac"],
    countries: [],
    priority: "medium",
    timeMinutes: 10,
    requiredFields: ["NAP", "Services", "Service Area"],
    domain: "porch.com",
  },
  {
    id: "homeadvisor",
    name: "HomeAdvisor",
    submitUrl: "https://pro.homeadvisor.com/claim",
    category: "niche",
    niches: ["home services", "contractor", "plumber", "electrician", "roofing", "hvac", "landscaping"],
    countries: [],
    priority: "high",
    timeMinutes: 15,
    requiredFields: ["NAP", "Services", "Service Area", "License", "Insurance"],
    domain: "homeadvisor.com",
  },
  {
    id: "opentable",
    name: "OpenTable",
    submitUrl: "https://restaurant.opentable.com/get-listed",
    category: "niche",
    niches: ["restaurant", "cafe", "dining", "bistro"],
    countries: [],
    priority: "high",
    timeMinutes: 15,
    requiredFields: ["NAP", "Cuisine", "Hours", "Menu", "Photos", "Reservation Hours"],
    domain: "opentable.com",
  },
  {
    id: "zomato",
    name: "Zomato",
    submitUrl: "https://www.zomato.com/add-restaurant",
    category: "niche",
    niches: ["restaurant", "cafe", "dining", "bistro", "bakery"],
    countries: [],
    priority: "medium",
    timeMinutes: 10,
    requiredFields: ["NAP", "Cuisine", "Menu", "Photos"],
    domain: "zomato.com",
  },
  {
    id: "tripadvisor",
    name: "Tripadvisor for Business",
    submitUrl: "https://www.tripadvisor.com/Owners",
    category: "niche",
    niches: ["restaurant", "hotel", "travel", "attraction", "cafe"],
    countries: [],
    priority: "high",
    timeMinutes: 15,
    requiredFields: ["NAP", "Category", "Photos", "Hours", "Description"],
    domain: "tripadvisor.com",
  },
  {
    id: "booking-com",
    name: "Booking.com Partner",
    submitUrl: "https://join.booking.com/",
    category: "niche",
    niches: ["hotel", "travel", "lodging", "motel", "bnb"],
    countries: [],
    priority: "high",
    timeMinutes: 15,
    requiredFields: ["NAP", "Room Types", "Amenities", "Photos", "Pricing"],
    domain: "booking.com",
  },
  {
    id: "hotels-com",
    name: "Hotels.com Partner",
    submitUrl: "https://partner.hotelshotels.com/",
    category: "niche",
    niches: ["hotel", "travel", "lodging", "motel"],
    countries: [],
    priority: "medium",
    timeMinutes: 10,
    requiredFields: ["NAP", "Room Types", "Amenities", "Photos"],
    domain: "hotels.com",
  },
  {
    id: "cars-com",
    name: "Cars.com Dealer",
    submitUrl: "https://www.cars.com/dealers/claim",
    category: "niche",
    niches: ["auto", "car dealer", "automotive", "used cars"],
    countries: [],
    priority: "high",
    timeMinutes: 15,
    requiredFields: ["NAP", "Inventory", "Dealer License", "Photos"],
    domain: "cars.com",
  },
  {
    id: "edmunds",
    name: "Edmunds Dealer",
    submitUrl: "https://www.edmunds.com/dealers/claim",
    category: "niche",
    niches: ["auto", "car dealer", "automotive"],
    countries: [],
    priority: "medium",
    timeMinutes: 10,
    requiredFields: ["NAP", "Inventory", "Dealer License"],
    domain: "edmunds.com",
  },
  {
    id: "autotrader",
    name: "AutoTrader Dealer",
    submitUrl: "https://www.autotrader.com/dealers/claim",
    category: "niche",
    niches: ["auto", "car dealer", "automotive", "used cars"],
    countries: [],
    priority: "medium",
    timeMinutes: 10,
    requiredFields: ["NAP", "Inventory", "Dealer License"],
    domain: "autotrader.com",
  },
  {
    id: "repairpal",
    name: "RepairPal Certified Shop",
    submitUrl: "https://www.repairpal.com/apply",
    category: "niche",
    niches: ["auto", "mechanic", "auto repair", "automotive"],
    countries: [],
    priority: "medium",
    timeMinutes: 15,
    requiredFields: ["NAP", "Services", "Technician Credentials", "Warranty Info"],
    domain: "repairpal.com",
  },
  {
    id: "zillow",
    name: "Zillow Premier Agent",
    submitUrl: "https://www.zillow.com/profile/claim/",
    category: "niche",
    niches: ["real estate", "realtor", "realty", "property"],
    countries: [],
    priority: "high",
    timeMinutes: 15,
    requiredFields: ["NAP", "License Number", "Brokerage", "Service Area", "Photo"],
    domain: "zillow.com",
  },
  {
    id: "realtor-com",
    name: "Realtor.com Pro",
    submitUrl: "https://www.realtor.com/professionals/claim",
    category: "niche",
    niches: ["real estate", "realtor", "realty", "property"],
    countries: [],
    priority: "high",
    timeMinutes: 15,
    requiredFields: ["NAP", "License Number", "Brokerage", "Service Area"],
    domain: "realtor.com",
  },
  {
    id: "trulia",
    name: "Trulia",
    submitUrl: "https://www.trulia.com/profile/claim",
    category: "niche",
    niches: ["real estate", "realtor", "realty", "property"],
    countries: [],
    priority: "medium",
    timeMinutes: 10,
    requiredFields: ["NAP", "License Number", "Brokerage"],
    domain: "trulia.com",
  },
  {
    id: "thumbtack",
    name: "Thumbtack Pro",
    submitUrl: "https://www.thumbtack.com/pro/claim",
    category: "niche",
    niches: ["services", "professional", "contractor", "plumber", "electrician", "cleaning", "photographer", "tutor"],
    countries: [],
    priority: "medium",
    timeMinutes: 10,
    requiredFields: ["NAP", "Services", "Service Area", "Pricing"],
    domain: "thumbtack.com",
  },
  {
    id: "care-com",
    name: "Care.com",
    submitUrl: "https://www.care.com/claim-profile",
    category: "niche",
    niches: ["childcare", "senior care", "caregiver", "nanny", "babysitter"],
    countries: [],
    priority: "medium",
    timeMinutes: 10,
    requiredFields: ["NAP", "Services", "Background Check", "Credentials"],
    domain: "care.com",
  },
  {
    id: "styleseat",
    name: "StyleSeat",
    submitUrl: "https://www.styleseat.com/claim",
    category: "niche",
    niches: ["salon", "beauty", "hair", "barber", "stylist", "spa"],
    countries: [],
    priority: "medium",
    timeMinutes: 10,
    requiredFields: ["NAP", "Services", "Pricing", "Portfolio Photos"],
    domain: "styleseat.com",
  },
  {
    id: "vagaro",
    name: "Vagaro",
    submitUrl: "https://www.vagaro.com/claim-business",
    category: "niche",
    niches: ["salon", "beauty", "spa", "fitness", "yoga", "hair"],
    countries: [],
    priority: "medium",
    timeMinutes: 10,
    requiredFields: ["NAP", "Services", "Hours", "Pricing"],
    domain: "vagaro.com",
  },
  {
    id: "mindbody",
    name: "Mindbody Business",
    submitUrl: "https://www.mindbodyonline.com/claim-listing",
    category: "niche",
    niches: ["fitness", "gym", "yoga", "spa", "wellness", "pilates"],
    countries: [],
    priority: "high",
    timeMinutes: 15,
    requiredFields: ["NAP", "Class Schedule", "Pricing", "Photos"],
    domain: "mindbodyonline.com",
  },
  {
    id: "weddingwire",
    name: "WeddingWire",
    submitUrl: "https://www.weddingwire.com/claim-listing",
    category: "niche",
    niches: ["wedding", "event planning", "photographer", "catering", "florist"],
    countries: [],
    priority: "high",
    timeMinutes: 15,
    requiredFields: ["NAP", "Services", "Pricing", "Portfolio Photos", "Service Area"],
    domain: "weddingwire.com",
  },
  {
    id: "greatschools",
    name: "GreatSchools",
    submitUrl: "https://www.greatschools.org/school/claim/",
    category: "niche",
    niches: ["school", "education", "tutoring", "preschool", "daycare"],
    countries: [],
    priority: "low",
    timeMinutes: 10,
    requiredFields: ["NAP", "School Type", "Grades", "Programs"],
    domain: "greatschools.org",
  },
  {
    id: "angies-list-clean",
    name: "Housecall Pro",
    submitUrl: "https://www.housecallpro.com/claim",
    category: "niche",
    niches: ["cleaning", "house cleaning", "cleaning service", "janitorial"],
    countries: [],
    priority: "medium",
    timeMinutes: 10,
    requiredFields: ["NAP", "Services", "Service Area", "Pricing"],
    domain: "housecallpro.com",
  },

  // ===== Country-specific (10) =====
  {
    id: "yell-com",
    name: "Yell.com (UK)",
    submitUrl: "https://business.yell.com/claim-listing/",
    category: "country",
    niches: [],
    countries: ["UK"],
    priority: "high",
    timeMinutes: 10,
    requiredFields: ["NAP", "Category", "Website", "Hours"],
    domain: "yell.com",
  },
  {
    id: "thomson-local",
    name: "Thomson Local (UK)",
    submitUrl: "https://www.thomsonlocal.com/claim-listing",
    category: "country",
    niches: [],
    countries: ["UK"],
    priority: "medium",
    timeMinutes: 10,
    requiredFields: ["NAP", "Category", "Website"],
    domain: "thomsonlocal.com",
  },
  {
    id: "scoot",
    name: "Scoot (UK)",
    submitUrl: "https://www.scoot.co.uk/claim-listing",
    category: "country",
    niches: [],
    countries: ["UK"],
    priority: "medium",
    timeMinutes: 10,
    requiredFields: ["NAP", "Category", "Website"],
    domain: "scoot.co.uk",
  },
  {
    id: "yellowpages-ca",
    name: "YellowPages.ca",
    submitUrl: "https://www.yellowpages.ca/claim-listing",
    category: "country",
    niches: [],
    countries: ["CA"],
    priority: "high",
    timeMinutes: 10,
    requiredFields: ["NAP", "Category", "Website", "Hours"],
    domain: "yellowpages.ca",
  },
  {
    id: "canpages",
    name: "Canpages (CA)",
    submitUrl: "https://www.canpages.ca/claim-listing",
    category: "country",
    niches: [],
    countries: ["CA"],
    priority: "low",
    timeMinutes: 5,
    requiredFields: ["NAP", "Category"],
    domain: "canpages.ca",
  },
  {
    id: "truelocal-au",
    name: "TrueLocal (AU)",
    submitUrl: "https://www.truelocal.com.au/business/claim",
    category: "country",
    niches: [],
    countries: ["AU"],
    priority: "high",
    timeMinutes: 10,
    requiredFields: ["NAP", "Category", "Website", "Hours"],
    domain: "truelocal.com.au",
  },
  {
    id: "startlocal-au",
    name: "StartLocal (AU)",
    submitUrl: "https://www.startlocal.com.au/claim-listing",
    category: "country",
    niches: [],
    countries: ["AU"],
    priority: "low",
    timeMinutes: 5,
    requiredFields: ["NAP", "Category"],
    domain: "startlocal.com.au",
  },
  {
    id: "hotfrog-au",
    name: "Hotfrog AU",
    submitUrl: "https://www.hotfrog.com.au/business/add",
    category: "country",
    niches: [],
    countries: ["AU"],
    priority: "low",
    timeMinutes: 5,
    requiredFields: ["NAP", "Category", "Description"],
    domain: "hotfrog.com.au",
  },
  {
    id: "justdial-in",
    name: "JustDial (IN)",
    submitUrl: "https://www.justdial.com/claim-listing",
    category: "country",
    niches: [],
    countries: ["IN"],
    priority: "high",
    timeMinutes: 10,
    requiredFields: ["NAP", "Category", "Website", "Hours"],
    domain: "justdial.com",
  },
  {
    id: "indiamart-in",
    name: "IndiaMART (IN)",
    submitUrl: "https://www.indiamart.com/claim-listing",
    category: "country",
    niches: [],
    countries: ["IN"],
    priority: "medium",
    timeMinutes: 10,
    requiredFields: ["NAP", "Category", "Products", "Website"],
    domain: "indiamart.com",
  },
  {
    id: "sulekha-in",
    name: "Sulekha (IN)",
    submitUrl: "https://www.sulekha.com/claim-listing",
    category: "country",
    niches: [],
    countries: ["IN"],
    priority: "medium",
    timeMinutes: 10,
    requiredFields: ["NAP", "Category", "Services"],
    domain: "sulekha.com",
  },
];

// ---- Normalize / parse ----

/** Normalize a free-text input: lowercase optional, collapse whitespace, trim. */
export function normalizeInput(s: string, lowercase = false): string {
  const trimmed = (s || "").replace(/\s+/g, " ").trim();
  return lowercase ? trimmed.toLowerCase() : trimmed;
}

/** Parse and normalize the full CitationInputs object. */
export function parseInputs(raw: Partial<CitationInputs>): CitationInputs {
  return {
    businessName: normalizeInput(raw.businessName || ""),
    niche: normalizeInput(raw.niche || "", true),
    city: normalizeInput(raw.city || ""),
    state: normalizeInput(raw.state || ""),
    country: normalizeInput(raw.country || "US", true).toUpperCase() || "US",
  };
}

/** Build a Google search URL for a query string. */
export function buildGoogleSearchUrl(query: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

/** Resolve the submission URL: direct if known, otherwise a Google search fallback. */
export function buildSubmissionUrl(dir: Directory, inputs: CitationInputs): string {
  if (dir.submitUrl) return dir.submitUrl;
  const q = `${dir.name} add business ${inputs.city} ${inputs.country}`.trim();
  return buildGoogleSearchUrl(q);
}

/** Check if a directory's niche list matches the input niche. */
export function matchesNiche(dir: Directory, niche: string): string | null {
  if (dir.category !== "niche" || !niche) return null;
  for (const n of dir.niches) {
    if (n === niche) return n;
    // Substring match: input "plumbing" matches directory niche "plumber" via shared "plumb" prefix
    if (n.includes(niche) || niche.includes(n)) return n;
    // Prefix match: "plumbing" / "plumber" share first 5 chars "plumb"
    const prefix = niche.slice(0, Math.min(5, niche.length));
    if (prefix.length >= 4 && n.startsWith(prefix)) return n;
  }
  return null;
}

/** Check if a directory's country list matches the input country. */
export function matchesCountry(dir: Directory, country: string): boolean {
  if (dir.category !== "country" || !country) return false;
  return dir.countries.includes(country.toUpperCase());
}

/**
 * Generate the full citation list for the given inputs:
 * - All general directories
 * - Niche-specific directories whose niches match
 * - Country-specific directories whose countries match
 */
export function generateCitations(inputs: CitationInputs): Citation[] {
  const out: Citation[] = [];
  for (const dir of DIRECTORIES) {
    if (dir.category === "general") {
      out.push({
        ...dir,
        submissionUrl: buildSubmissionUrl(dir, inputs),
      });
      continue;
    }
    if (dir.category === "niche") {
      const matched = matchesNiche(dir, inputs.niche);
      if (matched) {
        out.push({
          ...dir,
          submissionUrl: buildSubmissionUrl(dir, inputs),
          matchedNiche: matched,
        });
      }
      continue;
    }
    if (dir.category === "country") {
      if (matchesCountry(dir, inputs.country)) {
        out.push({
          ...dir,
          submissionUrl: buildSubmissionUrl(dir, inputs),
        });
      }
    }
  }
  return out;
}

/** Filter citations by priority and/or category. */
export function filterCitations(citations: Citation[], opts: FilterOptions): Citation[] {
  return citations.filter((c) => {
    if (opts.priority && c.priority !== opts.priority) return false;
    if (opts.category && c.category !== opts.category) return false;
    return true;
  });
}

/** Compute summary stats across a set of citations. */
export function computeSummaryStats(citations: Citation[]): SummaryStats {
  const byPriority: Record<Priority, number> = { high: 0, medium: 0, low: 0 };
  const byCategory: Record<DirectoryCategory, number> = { general: 0, niche: 0, country: 0 };
  let totalTimeMinutes = 0;
  for (const c of citations) {
    byPriority[c.priority] += 1;
    byCategory[c.category] += 1;
    totalTimeMinutes += c.timeMinutes;
  }
  return {
    total: citations.length,
    byPriority,
    byCategory,
    totalTimeMinutes,
  };
}

/** Format minutes as a human-readable string (e.g. "1h 30m" or "45m"). */
export function formatMinutes(min: number): string {
  if (min <= 0) return "0m";
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// ---- Render ----

/** Render the citations as a plain-text report. */
export function renderText(citations: Citation[], inputs: CitationInputs): string {
  const stats = computeSummaryStats(citations);
  const lines: string[] = [];
  lines.push("=== LOCAL CITATION FINDINGS ===");
  lines.push(`Business: ${inputs.businessName || "(not set)"}`);
  lines.push(`Niche: ${inputs.niche || "(not set)"}`);
  lines.push(`City: ${inputs.city || "(not set)"}`);
  if (inputs.state) lines.push(`State: ${inputs.state}`);
  lines.push(`Country: ${inputs.country}`);
  lines.push("");
  lines.push("--- SUMMARY ---");
  lines.push(`Total citation opportunities: ${stats.total}`);
  lines.push(`High priority: ${stats.byPriority.high}`);
  lines.push(`Medium priority: ${stats.byPriority.medium}`);
  lines.push(`Low priority: ${stats.byPriority.low}`);
  lines.push(`General: ${stats.byCategory.general} | Niche: ${stats.byCategory.niche} | Country: ${stats.byCategory.country}`);
  lines.push(`Estimated total time to submit: ${formatMinutes(stats.totalTimeMinutes)}`);
  lines.push("");
  lines.push("--- CITATION SOURCES ---");
  for (const c of citations) {
    lines.push(`[${c.priority.toUpperCase()}] ${c.name}`);
    lines.push(`  URL: ${c.submissionUrl}`);
    lines.push(`  Category: ${CATEGORY_LABELS[c.category]}`);
    lines.push(`  Time: ${c.timeMinutes} minutes`);
    lines.push(`  Required fields: ${c.requiredFields.join(", ")}`);
    if (c.matchedNiche) lines.push(`  Matched niche: ${c.matchedNiche}`);
    lines.push("");
  }
  return lines.join("\n");
}

/** Render citations as CSV (directory, url, priority, time, fields). */
export function renderCsv(citations: Citation[]): string {
  const lines = ["directory,url,priority,category,time_minutes,required_fields"];
  for (const c of citations) {
    lines.push([
      escapeCsv(c.name),
      escapeCsv(c.submissionUrl),
      c.priority,
      c.category,
      String(c.timeMinutes),
      escapeCsv(c.requiredFields.join(", ")),
    ].join(","));
  }
  return lines.join("\n");
}

/** Split a CSV row that may contain quoted values. */
export function splitCsvRow(line: string): string[] {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
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

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:citation-finder:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  businessName: string;
  niche: string;
  city: string;
  country: string;
  totalCitations: number;
  totalTimeMinutes: number;
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

export function buildShareUrl(inputs: CitationInputs): string {
  const params = new URLSearchParams();
  if (inputs.businessName) params.set("name", inputs.businessName);
  if (inputs.niche) params.set("niche", inputs.niche);
  if (inputs.city) params.set("city", inputs.city);
  if (inputs.state) params.set("state", inputs.state);
  if (inputs.country && inputs.country !== "US") params.set("country", inputs.country);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<CitationInputs> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Partial<CitationInputs> = {};
  const name = params.get("name");
  if (name) out.businessName = name;
  const niche = params.get("niche");
  if (niche) out.niche = niche;
  const city = params.get("city");
  if (city) out.city = city;
  const state = params.get("state");
  if (state) out.state = state;
  const country = params.get("country");
  if (country) out.country = country.toUpperCase();
  return out;
}
