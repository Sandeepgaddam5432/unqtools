/**
 * Stamp Duty Calculator — pure logic.
 * Supports UK, Australia (state-level), India, and US (state-level).
 * Brackets are progressive unless noted.
 */

export type Jurisdiction = "uk" | "au-nsw" | "au-vic" | "au-qld" | "in" | "us-ny" | "us-ca" | "us-fl" | "us-tx";

export interface StampDutyBracket {
  upTo: number | null; // null = infinity
  ratePct: number;
}

export interface StampDutyInput {
  jurisdiction: Jurisdiction;
  price: number;
  /** Buyer category — affects reliefs. */
  buyerType: "firstTime" | "investor" | "residential" | "nonResident";
  /** Property type */
  propertyType: "residential" | "commercial" | "land";
  /** For AU: foreign buyer surcharge applies. */
  foreignBuyer?: boolean;
  /** For IN: gender (women get discounts in some states). */
  gender?: "male" | "female" | "joint";
  /** For IN: senior citizen discount. */
  senior?: boolean;
}

export interface StampDutyResult {
  duty: number;
  effectiveRate: number;
  breakdown: { from: number; to: number | null; ratePct: number; amount: number }[];
  surcharge: number;
  concession: number;
  total: number;
  notes: string[];
}

// UK SDLT residential brackets (2024)
export const UK_BRACKETS: StampDutyBracket[] = [
  { upTo: 125000, ratePct: 0 },
  { upTo: 250000, ratePct: 2 },
  { upTo: 925000, ratePct: 5 },
  { upTo: 1500000, ratePct: 10 },
  { upTo: null, ratePct: 12 },
];

export const UK_FIRST_TIME: StampDutyBracket[] = [
  { upTo: 425000, ratePct: 0 },
  { upTo: 625000, ratePct: 5 },
  { upTo: null, ratePct: 0 }, // not eligible above 625k -> handled separately
];

export const UK_ADDITIONAL: StampDutyBracket[] = [
  { upTo: 250000, ratePct: 3 },
  { upTo: 925000, ratePct: 8 },
  { upTo: 1500000, ratePct: 13 },
  { upTo: null, ratePct: 15 },
];

export const AU_NSW: StampDutyBracket[] = [
  { upTo: 16000, ratePct: 1.25 },
  { upTo: 35000, ratePct: 1.5 },
  { upTo: 93000, ratePct: 1.75 },
  { upTo: 351000, ratePct: 3.5 },
  { upTo: 1168000, ratePct: 4.5 },
  { upTo: 3504000, ratePct: 5.5 },
  { upTo: null, ratePct: 7 },
];

export const AU_VIC: StampDutyBracket[] = [
  { upTo: 25000, ratePct: 1.4 },
  { upTo: 130000, ratePct: 2.4 },
  { upTo: 960000, ratePct: 6 },
  { upTo: 2000000, ratePct: 5.5 },
  { upTo: null, ratePct: 6.5 },
];

export const AU_QLD: StampDutyBracket[] = [
  { upTo: 5000, ratePct: 0 },
  { upTo: 75000, ratePct: 1.5 },
  { upTo: 540000, ratePct: 3.5 },
  { upTo: 1000000, ratePct: 4.5 },
  { upTo: null, ratePct: 5.75 },
];

export const IN_BRACKETS: StampDutyBracket[] = [
  // Simplified — actual varies by state; here we model a generic 5-7% slab.
  { upTo: 3000000, ratePct: 4 },
  { upTo: 7000000, ratePct: 6 },
  { upTo: null, ratePct: 7 },
];

export const US_NY: StampDutyBracket[] = [
  { upTo: 25000, ratePct: 0.4 },
  { upTo: 50000, ratePct: 0.65 },
  { upTo: 100000, ratePct: 0.85 },
  { upTo: 250000, ratePct: 1.25 },
  { upTo: 500000, ratePct: 1.4 },
  { upTo: 1000000, ratePct: 1.65 },
  { upTo: null, ratePct: 2.05 },
];

export const US_CA: StampDutyBracket[] = [
  // California: county-level base, simplified
  { upTo: 100000, ratePct: 0.55 },
  { upTo: 250000, ratePct: 1.1 },
  { upTo: null, ratePct: 1.45 },
];

export const US_FL: StampDutyBracket[] = [
  // Florida: ~$0.70 per $100 of value (doc stamp)
  { upTo: null, ratePct: 0.7 },
];

export const US_TX: StampDutyBracket[] = [
  // Texas has no state stamp duty
  { upTo: null, ratePct: 0 },
];

export function getBrackets(jurisdiction: Jurisdiction, buyerType: string): StampDutyBracket[] {
  switch (jurisdiction) {
    case "uk":
      if (buyerType === "firstTime") return UK_FIRST_TIME;
      if (buyerType === "investor") return UK_ADDITIONAL;
      return UK_BRACKETS;
    case "au-nsw":
      return AU_NSW;
    case "au-vic":
      return AU_VIC;
    case "au-qld":
      return AU_QLD;
    case "in":
      return IN_BRACKETS;
    case "us-ny":
      return US_NY;
    case "us-ca":
      return US_CA;
    case "us-fl":
      return US_FL;
    case "us-tx":
      return US_TX;
  }
}

const round = (n: number) => Math.round(n * 100) / 100;

/** Compute progressive duty from brackets. */
export function computeDuty(brackets: StampDutyBracket[], price: number): {
  duty: number;
  breakdown: { from: number; to: number | null; ratePct: number; amount: number }[];
} {
  let prev = 0;
  let duty = 0;
  const breakdown: { from: number; to: number | null; ratePct: number; amount: number }[] = [];
  for (const b of brackets) {
    const upper = b.upTo === null ? Infinity : b.upTo;
    if (price <= prev) break;
    const slice = Math.min(price, upper) - prev;
    if (slice > 0) {
      const amt = (slice * b.ratePct) / 100;
      duty += amt;
      breakdown.push({ from: prev, to: b.upTo, ratePct: b.ratePct, amount: round(amt) });
    }
    prev = upper;
  }
  return { duty: round(duty), breakdown };
}

export function computeStampDuty(input: StampDutyInput): StampDutyResult {
  const notes: string[] = [];
  const brackets = getBrackets(input.jurisdiction, input.buyerType);
  const { duty, breakdown } = computeDuty(brackets, input.price);

  // Surcharges
  let surcharge = 0;
  if (input.jurisdiction === "uk" && input.buyerType === "nonResident") {
    surcharge = (input.price * 2) / 100;
    notes.push("Non-UK resident surcharge: 2% added.");
  }
  if (input.jurisdiction.startsWith("au-") && input.foreignBuyer) {
    const pct = input.jurisdiction === "au-nsw" ? 8 : input.jurisdiction === "au-vic" ? 8 : 7;
    surcharge = (input.price * pct) / 100;
    notes.push(`Foreign buyer surcharge: ${pct}% added.`);
  }

  // Concessions
  let concession = 0;
  if (input.jurisdiction === "uk" && input.buyerType === "firstTime" && input.price > 625000) {
    notes.push("First-time buyer relief not available above £625,000 — standard rates apply.");
  }
  if (input.jurisdiction === "in" && input.gender === "female") {
    concession = (duty * 10) / 100;
    notes.push("Women buyer concession: 10% off stamp duty (some Indian states).");
  }
  if (input.jurisdiction === "in" && input.senior) {
    concession += (duty * 5) / 100;
    notes.push("Senior citizen concession: additional 5% off.");
  }
  if (input.jurisdiction === "us-tx") {
    notes.push("Texas has no state-level stamp duty.");
  }

  const total = round(Math.max(0, duty + surcharge - concession));
  const effectiveRate = input.price > 0 ? (total / input.price) * 100 : 0;

  return {
    duty: round(duty),
    effectiveRate: round(effectiveRate),
    breakdown,
    surcharge: round(surcharge),
    concession: round(concession),
    total,
    notes,
  };
}

/** Format currency by jurisdiction. */
export function formatCurrency(n: number, jurisdiction: Jurisdiction): string {
  if (!isFinite(n)) return "—";
  if (jurisdiction === "uk") return `£${n.toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;
  if (jurisdiction.startsWith("au-")) return `A$${n.toLocaleString("en-AU", { maximumFractionDigits: 0 })}`;
  if (jurisdiction === "in") return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

/** Validate inputs. */
export function validateInput(input: Partial<StampDutyInput>): string[] {
  const errs: string[] = [];
  if ((input.price ?? 0) < 0) errs.push("Price must be ≥ 0");
  if (!input.jurisdiction) errs.push("Jurisdiction is required");
  return errs;
}

/** Quick-reference table of effective rates for typical price points. */
export function rateCard(jurisdiction: Jurisdiction, prices: number[] = [250000, 500000, 1000000, 2000000]): {
  price: number;
  duty: number;
  effectivePct: number;
}[] {
  return prices.map((price) => {
    const r = computeStampDuty({ jurisdiction, price, buyerType: "residential", propertyType: "residential" });
    return { price, duty: r.total, effectivePct: r.effectiveRate };
  });
}

/** Compare jurisdictions side-by-side. */
export function compareJurisdictions(price: number, jurisdictions: Jurisdiction[]): {
  jurisdiction: Jurisdiction;
  duty: number;
  effectivePct: number;
}[] {
  return jurisdictions.map((j) => {
    const r = computeStampDuty({
      jurisdiction: j,
      price,
      buyerType: "residential",
      propertyType: "residential",
    });
    return { jurisdiction: j, duty: r.total, effectivePct: r.effectiveRate };
  });
}

/** Estimate additional fees: registration, legal, mortgage. */
export function additionalFees(price: number, jurisdiction: Jurisdiction): {
  registration: number;
  legal: number;
  mortgage: number;
  total: number;
} {
  const registration = Math.min(1000, Math.max(100, price * 0.0005));
  const legal = Math.max(800, price * 0.001);
  const mortgage = price * 0.0015;
  return {
    registration: round(registration),
    legal: round(legal),
    mortgage: round(mortgage),
    total: round(registration + legal + mortgage),
  };
}
