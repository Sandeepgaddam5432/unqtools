/** Fuel Cost Calculator — pure logic. No DOM access. */

export type FuelUnit = "mpg" | "l100km" | "kmpl";
export type Currency = "USD" | "EUR" | "GBP" | "JPY" | "CAD" | "AUD" | "INR" | "CNY";

export interface FuelOptions {
  /** Distance (km). */
  distance: number;
  /** Fuel price per litre in chosen currency. */
  fuelPricePerLiter: number;
  /** Fuel consumption value. */
  consumption: number;
  /** Units of consumption. */
  consumptionUnit: FuelUnit;
  /** kg CO2 per litre (default 2.31 for gasoline). */
  co2PerLiter?: number;
}

export interface FuelResult {
  litersUsed: number;
  fuelCost: number;
  costPerKm: number;
  co2Kg: number;
  equivalentMpg: number;
  equivalentL100km: number;
  warnings: string[];
}

export interface ComparisonResult {
  vehicles: { name: string; litersUsed: number; fuelCost: number; co2Kg: number }[];
  cheapest: string;
  cleanest: string;
}

export const CURRENCY_SYMBOL: Record<Currency, string> = {
  USD: "$", EUR: "€", GBP: "£", JPY: "¥",
  CAD: "C$", AUD: "A$", INR: "₹", CNY: "¥",
};

/** Default CO2 emissions per litre by fuel type (kg/L). */
export const CO2_BY_FUEL: Record<string, number> = {
  gasoline: 2.31,
  diesel: 2.68,
  e10: 2.17,
  e85: 1.32,
  biodiesel: 2.45,
  lpg: 1.51,
  cng: 1.51,
};

const isFin = (n: number) => Number.isFinite(n);
const isNonNeg = (n: number) => isFin(n) && n >= 0;
const isPos = (n: number) => isFin(n) && n > 0;

/** Convert consumption to litres per 100 km. */
export function toL100km(consumption: number, unit: FuelUnit): number | { error: string } {
  if (!isPos(consumption)) return { error: "Consumption must be positive" };
  switch (unit) {
    case "l100km": return consumption;
    case "kmpl": return 100 / consumption;
    case "mpg": {
      const km = consumption * 1.609344;
      const liters = 3.785411784;
      return (liters / km) * 100;
    }
    default: return { error: "Unknown fuel unit" };
  }
}

/** Convert L/100km back to MPG (US). */
export function l100kmToMpg(l100: number): number {
  if (l100 === 0) return 0;
  return (3.785411784 / 1.609344) * 100 / l100;
}

/** Convert L/100km to km/L. */
export function l100kmToKmpl(l100: number): number {
  if (l100 === 0) return 0;
  return 100 / l100;
}

/** Convert MPG to L/100km. */
export function mpgToL100km(mpg: number): number | { error: string } {
  if (!isPos(mpg)) return { error: "MPG must be positive" };
  return (3.785411784 / (mpg * 1.609344)) * 100;
}

export function process(input: FuelOptions): FuelResult | { error: string } {
  if (!isNonNeg(input.distance)) return { error: "Distance cannot be negative" };
  if (!isNonNeg(input.fuelPricePerLiter)) return { error: "Fuel price cannot be negative" };
  if (!isPos(input.consumption)) return { error: "Consumption must be positive" };
  const co2PerLiter = input.co2PerLiter ?? CO2_BY_FUEL.gasoline;
  const l100 = toL100km(input.consumption, input.consumptionUnit);
  if (typeof l100 !== "number") return l100;
  const warnings: string[] = [];
  const litersUsed = (l100 / 100) * input.distance;
  const fuelCost = litersUsed * input.fuelPricePerLiter;
  const costPerKm = input.distance > 0 ? fuelCost / input.distance : 0;
  const co2Kg = litersUsed * co2PerLiter;
  if (litersUsed > 100) warnings.push("High fuel usage — verify consumption input.");
  if (co2PerLiter > 2.5) warnings.push("High CO2 fuel type detected.");
  return {
    litersUsed, fuelCost, costPerKm, co2Kg,
    equivalentMpg: l100kmToMpg(l100),
    equivalentL100km: l100,
    warnings,
  };
}

/** Compare multiple vehicles on the same trip. */
export function compareVehicles(
  vehicles: { name: string; consumption: number; unit: FuelUnit; pricePerLiter: number }[],
  distance: number,
  co2PerLiter = CO2_BY_FUEL.gasoline,
): ComparisonResult | { error: string } {
  if (!vehicles.length) return { error: "No vehicles provided" };
  const rows = vehicles.map((v) => {
    const r = process({ distance, fuelPricePerLiter: v.pricePerLiter, consumption: v.consumption, consumptionUnit: v.unit, co2PerLiter });
    if ("error" in r) return { name: v.name, litersUsed: NaN, fuelCost: NaN, co2Kg: NaN };
    return { name: v.name, litersUsed: r.litersUsed, fuelCost: r.fuelCost, co2Kg: r.co2Kg };
  });
  const cheapest = [...rows].sort((a, b) => a.fuelCost - b.fuelCost)[0]!.name;
  const cleanest = [...rows].sort((a, b) => a.co2Kg - b.co2Kg)[0]!.name;
  return { vehicles: rows, cheapest, cleanest };
}

/** Convert a price between currencies using a static rate table. */
export const CURRENCY_RATES: Record<Currency, number> = {
  USD: 1, EUR: 0.92, GBP: 0.79, JPY: 152,
  CAD: 1.36, AUD: 1.52, INR: 83.5, CNY: 7.2,
};

export function convertCurrency(amount: number, from: Currency, to: Currency): number | { error: string } {
  const f = CURRENCY_RATES[from]; const t = CURRENCY_RATES[to];
  if (!f || !t) return { error: "Unknown currency" };
  return (amount / f) * t;
}

export function toCsv(r: FuelResult, distance: number): string {
  return [
    "Metric,Value",
    `Distance (km),${distance}`,
    `Liters used,${r.litersUsed.toFixed(2)}`,
    `Fuel cost,${r.fuelCost.toFixed(2)}`,
    `Cost per km,${r.costPerKm.toFixed(2)}`,
    `CO2 (kg),${r.co2Kg.toFixed(2)}`,
    `Equivalent MPG,${r.equivalentMpg.toFixed(2)}`,
    `Equivalent L/100km,${r.equivalentL100km.toFixed(2)}`,
  ].join("\n");
}

export function comparisonToCsv(c: ComparisonResult): string {
  const lines = ["Vehicle,Liters used,Fuel cost,CO2 (kg)"];
  for (const v of c.vehicles) lines.push(`${v.name},${v.litersUsed.toFixed(2)},${v.fuelCost.toFixed(2)},${v.co2Kg.toFixed(2)}`);
  lines.push(`Cheapest,${c.cheapest},,`);
  lines.push(`Cleanest,${c.cleanest},,`);
  return lines.join("\n");
}

/** Batch-compute multiple trips for a single vehicle. */
export function batchProcess(
  trips: FuelOptions[],
): { i: number; result: FuelResult | { error: string } }[] {
  return trips.map((input, i) => ({ i, result: process(input) }));
}

/** Format with currency symbol. */
export function formatCurrency(amount: number, currency: Currency): string {
  if (!isFin(amount)) return "—";
  return `${CURRENCY_SYMBOL[currency]}${amount.toFixed(2)}`;
}

/** Pretty-print helper. */
export function fmt(n: number, p = 2): string {
  if (!isFin(n)) return "—";
  const f = Math.pow(10, p);
  return String(Math.round((n + Number.EPSILON) * f) / f);
}
