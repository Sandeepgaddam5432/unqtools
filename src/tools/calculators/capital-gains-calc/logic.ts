/**
 * Capital Gains Tax Calculator — pure logic.
 * Supports US short-term/long-term rates, cost basis adjustments, improvements,
 * and Section 121 primary-residence exclusion.
 */

export type FilingStatus = "single" | "marriedJoint" | "marriedSeparate" | "headOfHouse";
export type AssetType = "realEstate" | "stocks" | "crypto" | "collectibles" | "business";

export interface CapitalGainsInput {
  purchasePrice: number;
  salePrice: number;
  purchaseDate: string; // ISO
  saleDate: string; // ISO
  improvements: number;
  sellingCosts: number;
  depreciationRecapture?: number; // for real estate
  filingStatus: FilingStatus;
  taxableIncome: number; // ordinary income excluding gains
  assetType: AssetType;
  isPrimaryResidence?: boolean;
  yearsOwnedAsPrimary?: number;
}

export interface CapitalGainsResult {
  holdingPeriodDays: number;
  holdingPeriodYears: number;
  isLongTerm: boolean;
  costBasis: number;
  gain: number;
  depreciationRecapture: number;
  exclusion: number;
  taxableGain: number;
  federalTax: number;
  effectiveRate: number;
  netProceeds: number;
  breakdown: { label: string; value: number }[];
  notes: string[];
}

const MS_PER_DAY = 86400000;

const round = (n: number) => Math.round(n * 100) / 100;

/** Days between two ISO dates (sale - purchase). */
export function daysBetween(purchaseDate: string, saleDate: string): number {
  const p = new Date(purchaseDate).getTime();
  const s = new Date(saleDate).getTime();
  if (isNaN(p) || isNaN(s)) return NaN;
  return Math.floor((s - p) / MS_PER_DAY);
}

/** Long-term = held more than 1 year (≥366 days). */
export function isLongTerm(purchaseDate: string, saleDate: string): boolean {
  return daysBetween(purchaseDate, saleDate) > 365;
}

/** Long-term capital gains brackets (US 2024 single). */
export const LT_BRACKETS: Record<FilingStatus, { upTo: number | null; rate: number }[]> = {
  single: [
    { upTo: 47025, rate: 0 },
    { upTo: 518900, rate: 15 },
    { upTo: null, rate: 20 },
  ],
  marriedJoint: [
    { upTo: 94050, rate: 0 },
    { upTo: 583750, rate: 15 },
    { upTo: null, rate: 20 },
  ],
  marriedSeparate: [
    { upTo: 47025, rate: 0 },
    { upTo: 291850, rate: 15 },
    { upTo: null, rate: 20 },
  ],
  headOfHouse: [
    { upTo: 63000, rate: 0 },
    { upTo: 551350, rate: 15 },
    { upTo: null, rate: 20 },
  ],
};

/** Short-term = ordinary income brackets (simplified 2024 single). */
export const ST_BRACKETS: Record<FilingStatus, { upTo: number | null; rate: number }[]> = {
  single: [
    { upTo: 11600, rate: 10 },
    { upTo: 47150, rate: 12 },
    { upTo: 100525, rate: 22 },
    { upTo: 191950, rate: 24 },
    { upTo: 243725, rate: 32 },
    { upTo: 609350, rate: 35 },
    { upTo: null, rate: 37 },
  ],
  marriedJoint: [
    { upTo: 23200, rate: 10 },
    { upTo: 94300, rate: 12 },
    { upTo: 201050, rate: 22 },
    { upTo: 383900, rate: 24 },
    { upTo: 487450, rate: 32 },
    { upTo: 731200, rate: 35 },
    { upTo: null, rate: 37 },
  ],
  marriedSeparate: [
    { upTo: 11600, rate: 10 },
    { upTo: 47150, rate: 12 },
    { upTo: 100525, rate: 22 },
    { upTo: 191950, rate: 24 },
    { upTo: 243725, rate: 32 },
    { upTo: 365600, rate: 35 },
    { upTo: null, rate: 37 },
  ],
  headOfHouse: [
    { upTo: 16550, rate: 10 },
    { upTo: 63100, rate: 12 },
    { upTo: 100500, rate: 22 },
    { upTo: 191950, rate: 24 },
    { upTo: 243700, rate: 32 },
    { upTo: 609350, rate: 35 },
    { upTo: null, rate: 37 },
  ],
};

/** Apply progressive brackets to a taxable amount (over base income). */
export function applyBrackets(
  brackets: { upTo: number | null; rate: number }[],
  amount: number,
  baseIncome: number,
): number {
  let remaining = amount;
  let tax = 0;
  let prevThreshold = baseIncome;
  for (const b of brackets) {
    if (remaining <= 0) break;
    const upper = b.upTo === null ? Infinity : b.upTo;
    if (prevThreshold >= upper) {
      prevThreshold = upper;
      continue;
    }
    const room = upper - prevThreshold;
    const slice = Math.min(remaining, room);
    tax += (slice * b.rate) / 100;
    remaining -= slice;
    prevThreshold = upper;
  }
  return round(tax);
}

/** Section 121 primary residence exclusion: $250k single / $500k MFJ. */
export function primaryResidenceExclusion(
  filingStatus: FilingStatus,
  yearsOwnedAsPrimary: number,
  gain: number,
): number {
  if (yearsOwnedAsPrimary < 2) return 0;
  const max = filingStatus === "marriedJoint" ? 500000 : 250000;
  return round(Math.min(gain, max));
}

export function computeCapitalGains(input: CapitalGainsInput): CapitalGainsResult {
  const notes: string[] = [];
  const holdingPeriodDays = daysBetween(input.purchaseDate, input.saleDate);
  const holdingPeriodYears = holdingPeriodDays / 365.25;
  const lt = holdingPeriodDays > 365;
  if (lt) notes.push("Long-term (held >1 year) — qualifies for lower LT rates.");
  else notes.push("Short-term (held ≤1 year) — taxed as ordinary income.");

  const costBasis = round(input.purchasePrice + input.improvements + input.sellingCosts);
  const grossGain = round(input.salePrice - costBasis);
  notes.push(`Cost basis: $${costBasis} (purchase + improvements + selling costs)`);

  let exclusion = 0;
  if (input.assetType === "realEstate" && input.isPrimaryResidence) {
    exclusion = primaryResidenceExclusion(
      input.filingStatus,
      input.yearsOwnedAsPrimary ?? 0,
      grossGain,
    );
    if (exclusion > 0) {
      notes.push(`Section 121 primary-residence exclusion: $${exclusion}`);
    } else if ((input.yearsOwnedAsPrimary ?? 0) < 2) {
      notes.push("No Section 121 exclusion — primary residence owned <2 years.");
    }
  }

  // Depreciation recapture (real estate): 25% on depreciation taken.
  const depRecapture = round(input.depreciationRecapture ?? 0);
  if (depRecapture > 0) {
    notes.push(`Depreciation recapture: $${depRecapture} @ 25% = $${round(depRecapture * 0.25)}`);
  }

  const taxableGain = round(Math.max(0, grossGain - exclusion));
  let federalTax = 0;
  if (input.assetType === "collectibles") {
    federalTax = round(taxableGain * 0.28); // collectibles flat 28% LT
    notes.push("Collectibles: 28% flat long-term rate.");
  } else if (input.assetType === "crypto" && !lt) {
    federalTax = applyBrackets(ST_BRACKETS[input.filingStatus], taxableGain, input.taxableIncome);
    notes.push("Crypto short-term: ordinary income rates.");
  } else if (lt) {
    federalTax = applyBrackets(LT_BRACKETS[input.filingStatus], taxableGain, input.taxableIncome);
  } else {
    federalTax = applyBrackets(ST_BRACKETS[input.filingStatus], taxableGain, input.taxableIncome);
  }
  federalTax += round(depRecapture * 0.25);

  const effectiveRate = grossGain > 0 ? (federalTax / grossGain) * 100 : 0;
  const netProceeds = round(input.salePrice - federalTax - input.sellingCosts);

  const breakdown = [
    { label: "Sale price", value: input.salePrice },
    { label: "Purchase price", value: -input.purchasePrice },
    { label: "Improvements", value: -input.improvements },
    { label: "Selling costs", value: -input.sellingCosts },
    { label: "Gross gain", value: grossGain },
    { label: "Exclusion", value: -exclusion },
    { label: "Depreciation recapture", value: depRecapture },
    { label: "Taxable gain", value: taxableGain },
    { label: "Federal tax", value: -federalTax },
    { label: "Net proceeds", value: netProceeds },
  ];

  return {
    holdingPeriodDays,
    holdingPeriodYears: round(holdingPeriodYears),
    isLongTerm: lt,
    costBasis,
    gain: grossGain,
    depreciationRecapture: depRecapture,
    exclusion,
    taxableGain,
    federalTax: round(federalTax),
    effectiveRate: round(effectiveRate),
    netProceeds,
    breakdown,
    notes,
  };
}

/** Net Investment Income Tax (NIIT): 3.8% on investment income over $200k single / $250k MFJ. */
export function niit(magi: number, filingStatus: FilingStatus, investmentIncome: number): number {
  const threshold = filingStatus === "marriedJoint" ? 250000 : 200000;
  if (magi <= threshold) return 0;
  return round(Math.min(investmentIncome, magi - threshold) * 0.038);
}

/** State capital gains tax (simplified flat estimates). */
export function stateCapitalGainsTax(state: string, gain: number): number {
  const rates: Record<string, number> = {
    CA: 0.133,
    NY: 0.0685,
    TX: 0,
    FL: 0,
    WA: 0,
    OR: 0.099,
    MA: 0.05,
  };
  const rate = rates[state.toUpperCase()] ?? 0.05;
  return round(gain * rate);
}

/** 1031 exchange eligibility: must be like-kind real estate, identify within 45 days, close within 180. */
export function exchange1031Eligibility(
  assetType: AssetType,
  daysSinceSale: number,
): { eligible: boolean; identifyDeadline: number; closeDeadline: number; notes: string } {
  if (assetType !== "realEstate") {
    return {
      eligible: false,
      identifyDeadline: 0,
      closeDeadline: 0,
      notes: "1031 only applies to investment real estate.",
    };
  }
  return {
    eligible: daysSinceSale <= 180,
    identifyDeadline: 45,
    closeDeadline: 180,
    notes: `Identify replacement within 45 days, close within 180. You are at day ${daysSinceSale}.`,
  };
}

/** Tax-loss harvesting suggestion: offset gains with losses. */
export function harvestLosses(gains: number, losses: number): {
  netGain: number;
  deductibleLoss: number;
  carryover: number;
} {
  const net = gains - losses;
  if (net >= 0) {
    return { netGain: round(net), deductibleLoss: 0, carryover: 0 };
  }
  const deductible = Math.min(3000, -net);
  const carryover = round(Math.max(0, -net - 3000));
  return { netGain: round(net), deductibleLoss: round(deductible), carryover };
}

/** Validate inputs. */
export function validateInputs(input: Partial<CapitalGainsInput>): string[] {
  const errs: string[] = [];
  if ((input.purchasePrice ?? 0) < 0) errs.push("Purchase price must be ≥ 0");
  if ((input.salePrice ?? 0) < 0) errs.push("Sale price must be ≥ 0");
  if (input.purchaseDate && input.saleDate) {
    const d = daysBetween(input.purchaseDate, input.saleDate);
    if (isNaN(d)) errs.push("Invalid date format");
    else if (d < 0) errs.push("Sale date must be after purchase date");
  }
  return errs;
}

/** Format currency. */
export function fmtUSD(n: number): string {
  if (!isFinite(n)) return "—";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}
