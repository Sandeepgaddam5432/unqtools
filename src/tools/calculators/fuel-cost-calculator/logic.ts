/** Fuel Cost Calculator — pure logic. */

export type FuelUnit = "mpg" | "l100km" | "kmpl";

export interface FuelOptions {
  distance: number; // km
  fuelPricePerLiter: number;
  consumption: number;
  consumptionUnit: FuelUnit;
  co2PerLiter?: number; // kg CO2 per liter of fuel
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

// Convert consumption to liters per 100 km
function toL100km(consumption: number, unit: FuelUnit): number {
  switch (unit) {
    case "l100km": return consumption;
    case "kmpl": return 100 / consumption;
    case "mpg": {
      // mpg (US) → L/100km
      const km = consumption * 1.609344;
      const liters = 3.785411784;
      return (liters / km) * 100;
    }
  }
}

function l100kmToMpg(l100: number): number {
  if (l100 === 0) return 0;
  return (3.785411784 / 1.609344) * 100 / l100;
}

export function process(input: FuelOptions): FuelResult | { error: string } {
  const warnings: string[] = [];
  if (input.distance < 0) return { error: "Distance cannot be negative" };
  if (input.fuelPricePerLiter < 0) return { error: "Fuel price cannot be negative" };
  if (input.consumption <= 0) return { error: "Consumption must be positive" };
  const co2PerLiter = input.co2PerLiter ?? 2.31; // gasoline default
  const l100km = toL100km(input.consumption, input.consumptionUnit);
  const litersUsed = (l100km / 100) * input.distance;
  const fuelCost = litersUsed * input.fuelPricePerLiter;
  const costPerKm = input.distance > 0 ? fuelCost / input.distance : 0;
  const co2Kg = litersUsed * co2PerLiter;
  if (litersUsed > 100) warnings.push("High fuel usage — verify consumption input.");
  return {
    litersUsed,
    fuelCost,
    costPerKm,
    co2Kg,
    equivalentMpg: l100kmToMpg(l100km),
    equivalentL100km: l100km,
    warnings,
  };
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
