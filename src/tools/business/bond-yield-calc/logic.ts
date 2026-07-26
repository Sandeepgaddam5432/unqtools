/**
 * Bond Yield Calculator — pure logic.
 * Current yield, YTM (yield to maturity), bond price, coupon rate, maturity, par value.
 */

export interface BondInput {
  /** Par (face) value of the bond. */
  parValue: number;
  /** Annual coupon rate as a decimal (e.g., 0.05 for 5%). */
  couponRate: number;
  /** Years to maturity. */
  yearsToMaturity: number;
  /** Current market price (as a percentage of par, or absolute). */
  marketPrice: number;
  /** Whether marketPrice is in percent (true) or absolute dollars (false). */
  priceIsPercent: boolean;
  /** Coupon payment frequency per year. */
  frequency: 1 | 2 | 4 | 12;
}

export interface BondResult {
  input: BondInput;
  /** Absolute market price in dollars. */
  marketPriceDollars: number;
  /** Coupon payment per period in dollars. */
  couponPayment: number;
  /** Annual coupon payment in dollars. */
  annualCoupon: number;
  /** Current yield = annual coupon / market price. */
  currentYield: number;
  /** Yield to maturity (decimal, annualized). */
  ytm: number;
  /** Whether the bond trades at a premium/discount/par. */
  tradingStatus: "premium" | "discount" | "par";
  warnings: string[];
  notes: string[];
  /** Yield curve points for plotting (price → yield). */
  yieldCurve: { price: number; yield: number }[];
}

/** Compute current yield. */
export function calcCurrentYield(annualCoupon: number, marketPrice: number): number {
  if (marketPrice <= 0) return 0;
  return annualCoupon / marketPrice;
}

/** Compute bond price given YTM. */
export function calcBondPrice(parValue: number, couponPayment: number, periodicYtm: number, totalPeriods: number): number {
  if (periodicYtm === 0) return parValue + couponPayment * totalPeriods;
  const pvCoupons = couponPayment * (1 - Math.pow(1 + periodicYtm, -totalPeriods)) / periodicYtm;
  const pvPar = parValue / Math.pow(1 + periodicYtm, totalPeriods);
  return pvCoupons + pvPar;
}

/** Compute YTM using Newton-Raphson iteration. */
export function calcYTM(parValue: number, couponPayment: number, marketPrice: number, totalPeriods: number): number {
  if (marketPrice <= 0) return 0;
  // Initial guess: current yield (annualized)
  let ytm = couponPayment / marketPrice;
  for (let iter = 0; iter < 100; iter++) {
    const price = calcBondPrice(parValue, couponPayment, ytm, totalPeriods);
    const diff = price - marketPrice;
    if (Math.abs(diff) < 1e-6) break;
    // Numerical derivative
    const dytm = ytm * 1e-6;
    const priceUp = calcBondPrice(parValue, couponPayment, ytm + dytm, totalPeriods);
    const deriv = (priceUp - price) / dytm;
    if (Math.abs(deriv) < 1e-12) break;
    ytm = ytm - diff / deriv;
    if (ytm <= 0) ytm = 1e-6;
  }
  return ytm;
}

export function planBond(input: BondInput): BondResult {
  const warnings: string[] = [];
  const notes: string[] = [];

  if (input.parValue <= 0) warnings.push("Par value must be > 0.");
  if (input.couponRate < 0) warnings.push("Coupon rate should be ≥ 0.");
  if (input.yearsToMaturity <= 0) warnings.push("Years to maturity must be > 0.");
  if (input.marketPrice <= 0) warnings.push("Market price must be > 0.");

  const marketPriceDollars = input.priceIsPercent ? input.marketPrice / 100 * input.parValue : input.marketPrice;
  const annualCoupon = input.parValue * input.couponRate;
  const couponPayment = annualCoupon / input.frequency;
  const totalPeriods = input.yearsToMaturity * input.frequency;

  const currentYield = calcCurrentYield(annualCoupon, marketPriceDollars);
  const periodicYtm = calcYTM(input.parValue, couponPayment, marketPriceDollars, totalPeriods);
  const ytm = periodicYtm * input.frequency; // annualize

  let tradingStatus: "premium" | "discount" | "par" = "par";
  if (marketPriceDollars > input.parValue * 1.001) tradingStatus = "premium";
  else if (marketPriceDollars < input.parValue * 0.999) tradingStatus = "discount";

  if (tradingStatus === "premium") notes.push(`Bond trades at a premium — YTM (${(ytm * 100).toFixed(2)}%) < coupon rate (${(input.couponRate * 100).toFixed(2)}%).`);
  if (tradingStatus === "discount") notes.push(`Bond trades at a discount — YTM (${(ytm * 100).toFixed(2)}%) > coupon rate (${(input.couponRate * 100).toFixed(2)}%).`);
  if (tradingStatus === "par") notes.push("Bond trades at par — YTM = coupon rate.");

  // Build yield curve: vary market price ±20% and compute YTM
  const yieldCurve: { price: number; yield: number }[] = [];
  for (let pct = 60; pct <= 140; pct += 5) {
    const price = (pct / 100) * input.parValue;
    const pYtm = calcYTM(input.parValue, couponPayment, price, totalPeriods);
    yieldCurve.push({ price, yield: pYtm * input.frequency });
  }

  return {
    input, marketPriceDollars, couponPayment, annualCoupon, currentYield, ytm, tradingStatus,
    warnings, notes, yieldCurve,
  };
}

export function planBatch(inputs: BondInput[]): BondResult[] {
  return inputs.map(planBond);
}

export function renderBatchCsv(results: BondResult[]): string {
  const lines: string[] = ["index,market_price,current_yield_pct,ytm_pct,trading_status"];
  results.forEach((r, i) => {
    lines.push([
      String(i + 1), r.marketPriceDollars.toFixed(2),
      (r.currentYield * 100).toFixed(3), (r.ytm * 100).toFixed(3), r.tradingStatus,
    ].join(","));
  });
  return lines.join("\n");
}

export function renderReport(r: BondResult): string {
  const lines: string[] = [];
  lines.push("Bond Yield Report");
  lines.push("=================");
  lines.push(`Par value: $${r.input.parValue.toFixed(2)}`);
  lines.push(`Coupon rate: ${(r.input.couponRate * 100).toFixed(3)}%`);
  lines.push(`Annual coupon: $${r.annualCoupon.toFixed(2)}`);
  lines.push(`Coupon payment (per period): $${r.couponPayment.toFixed(2)}`);
  lines.push(`Frequency: ${r.input.frequency}/year`);
  lines.push(`Years to maturity: ${r.input.yearsToMaturity}`);
  lines.push(`Market price: $${r.marketPriceDollars.toFixed(2)} (${(r.marketPriceDollars / r.input.parValue * 100).toFixed(2)}% of par)`);
  lines.push("");
  lines.push(`Current yield: ${(r.currentYield * 100).toFixed(3)}%`);
  lines.push(`Yield to maturity: ${(r.ytm * 100).toFixed(3)}%`);
  lines.push(`Trading status: ${r.tradingStatus}`);
  if (r.warnings.length) { lines.push(""); lines.push("Warnings:"); r.warnings.forEach((w) => lines.push(`  ! ${w}`)); }
  if (r.notes.length) { lines.push(""); lines.push("Notes:"); r.notes.forEach((n) => lines.push(`  • ${n}`)); }
  return lines.join("\n");
}

export const BOND_PRESETS = [
  { id: "us-treasury-10y", label: "US Treasury 10y (5% coupon, par)", parValue: 1000, couponRate: 0.05, yearsToMaturity: 10, marketPrice: 100, priceIsPercent: true, frequency: 2 as const },
  { id: "corp-bond-discount", label: "Corporate bond at discount", parValue: 1000, couponRate: 0.04, yearsToMaturity: 5, marketPrice: 950, priceIsPercent: true, frequency: 2 as const },
  { id: "corp-bond-premium", label: "Corporate bond at premium", parValue: 1000, couponRate: 0.06, yearsToMaturity: 5, marketPrice: 105, priceIsPercent: true, frequency: 2 as const },
  { id: "zero-coupon", label: "Zero-coupon bond (5y, 80)", parValue: 1000, couponRate: 0, yearsToMaturity: 5, marketPrice: 80, priceIsPercent: true, frequency: 2 as const },
];

export function getBondPresets() { return [...BOND_PRESETS]; }

export function formatCurrency(amount: number): string {
  if (!Number.isFinite(amount)) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(amount);
}

export function formatPct(rate: number): string {
  if (!Number.isFinite(rate)) return "—";
  return `${(rate * 100).toFixed(3)}%`;
}

/** Compute Macaulay duration in years. */
export function macaulayDuration(parValue: number, couponPayment: number, periodicYtm: number, totalPeriods: number, frequency: number): number {
  if (periodicYtm === 0) return (totalPeriods + 1) / 2 / frequency;
  let weightedSum = 0;
  let price = 0;
  for (let t = 1; t <= totalPeriods; t++) {
    const cf = t === totalPeriods ? couponPayment + parValue : couponPayment;
    const pv = cf / Math.pow(1 + periodicYtm, t);
    weightedSum += t * pv;
    price += pv;
  }
  if (price === 0) return 0;
  return (weightedSum / price) / frequency;
}

/** Compute modified duration (price sensitivity). */
export function modifiedDuration(macaulay: number, periodicYtm: number, frequency: number): number {
  const annualYtm = periodicYtm * frequency;
  if (annualYtm === 0) return macaulay;
  return macaulay / (1 + annualYtm / frequency);
}
