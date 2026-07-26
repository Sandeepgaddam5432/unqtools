/**
 * Inventory Reorder Calculator — pure logic.
 * Reorder point, safety stock, EOQ, lead time demand.
 */

export interface ReorderInputs {
  avgDailyDemand: number;
  leadTimeDays: number;
  zScore: number; // service-level z (1.65 = 95%, 2.33 = 99%)
  demandStdDev: number; // std dev of daily demand
  unitCost: number;
  orderingCost: number; // cost per order
  holdingCostRate: number; // annual holding cost as fraction of unit cost
  annualDemand: number;
  currentStock: number;
}

export interface ReorderResult {
  leadTimeDemand: number;
  safetyStock: number;
  reorderPoint: number;
  eoq: number;
  optimalOrdersPerYear: number;
  optimalCycleDays: number;
  annualHoldingCost: number;
  annualOrderingCost: number;
  totalInventoryCost: number;
  stockoutRisk: number; // approximate % based on z
  daysUntilReorder: number;
}

/** Lead time demand = avgDailyDemand × leadTimeDays. */
export function leadTimeDemand(avgDailyDemand: number, leadTimeDays: number): number {
  return avgDailyDemand * leadTimeDays;
}

/** Safety stock = z × σ × √leadTime. */
export function safetyStock(zScore: number, demandStdDev: number, leadTimeDays: number): number {
  return zScore * demandStdDev * Math.sqrt(leadTimeDays);
}

/** Reorder point = lead time demand + safety stock. */
export function reorderPoint(avgDailyDemand: number, leadTimeDays: number, zScore: number, demandStdDev: number): number {
  return leadTimeDemand(avgDailyDemand, leadTimeDays) + safetyStock(zScore, demandStdDev, leadTimeDays);
}

/** Economic Order Quantity (EOQ): √(2DS/H) where H = unitCost × holdingRate. */
export function economicOrderQuantity(annualDemand: number, orderingCost: number, unitCost: number, holdingCostRate: number): number {
  const H = unitCost * holdingCostRate;
  if (H <= 0) return 0;
  return Math.sqrt((2 * annualDemand * orderingCost) / H);
}

/** Compute full reorder result. */
export function computeReorder(inputs: ReorderInputs): ReorderResult {
  const ltd = leadTimeDemand(inputs.avgDailyDemand, inputs.leadTimeDays);
  const ss = safetyStock(inputs.zScore, inputs.demandStdDev, inputs.leadTimeDays);
  const rop = ltd + ss;
  const eoq = economicOrderQuantity(inputs.annualDemand, inputs.orderingCost, inputs.unitCost, inputs.holdingCostRate);
  const optimalOrdersPerYear = eoq > 0 ? inputs.annualDemand / eoq : 0;
  const optimalCycleDays = inputs.avgDailyDemand > 0 ? Math.round(eoq / inputs.avgDailyDemand) : 0;
  const annualHoldingCost = (eoq / 2) * inputs.unitCost * inputs.holdingCostRate;
  const annualOrderingCost = optimalOrdersPerYear * inputs.orderingCost;
  const totalInventoryCost = annualHoldingCost + annualOrderingCost;
  const stockoutRisk = normCdfTail(inputs.zScore);
  const daysUntilReorder = inputs.avgDailyDemand > 0 ? Math.max(0, Math.floor((inputs.currentStock - rop) / inputs.avgDailyDemand)) : 0;
  return {
    leadTimeDemand: ltd,
    safetyStock: ss,
    reorderPoint: rop,
    eoq,
    optimalOrdersPerYear,
    optimalCycleDays,
    annualHoldingCost,
    annualOrderingCost,
    totalInventoryCost,
    stockoutRisk,
    daysUntilReorder,
  };
}

/** Tail probability of standard normal: P(Z > z) — Abramowitz & Stegun 26.2.17. */
export function normCdfTail(z: number): number {
  // Polynomial approximates the right tail P(Z > |z|) directly.
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989422804014327 * Math.exp(-0.5 * z * z);
  const rightTail = d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  // For z >= 0, the right tail is what we want. For z < 0, the right tail of |z| = left tail of z = 1 - P(Z > z).
  return z >= 0 ? rightTail : 1 - rightTail;
}

/** Validate inputs. */
export function validateInputs(inputs: ReorderInputs): string[] {
  const w: string[] = [];
  if (inputs.avgDailyDemand <= 0) w.push("Average daily demand must be positive.");
  if (inputs.leadTimeDays <= 0) w.push("Lead time must be positive.");
  if (inputs.zScore < 0) w.push("Z-score cannot be negative.");
  if (inputs.demandStdDev < 0) w.push("Demand std dev cannot be negative.");
  if (inputs.unitCost <= 0) w.push("Unit cost must be positive.");
  if (inputs.orderingCost <= 0) w.push("Ordering cost must be positive.");
  if (inputs.holdingCostRate <= 0 || inputs.holdingCostRate > 1) w.push("Holding cost rate must be between 0 and 1.");
  if (inputs.annualDemand < 0) w.push("Annual demand cannot be negative.");
  if (inputs.currentStock < 0) w.push("Current stock cannot be negative.");
  return w;
}

/** Suggest z-score from a service level percentage. */
export function zScoreFromServiceLevel(serviceLevelPct: number): number {
  const map: Record<number, number> = {
    90: 1.28,
    95: 1.65,
    97.5: 1.96,
    99: 2.33,
    99.5: 2.58,
    99.9: 3.09,
  };
  if (map[serviceLevelPct] !== undefined) return map[serviceLevelPct];
  // Linear interpolation fallback
  const entries = Object.entries(map).map(([k, v]) => [Number(k), v] as [number, number]).sort((a, b) => a[0] - b[0]);
  for (let i = 0; i < entries.length - 1; i++) {
    if (serviceLevelPct >= entries[i][0] && serviceLevelPct <= entries[i + 1][0]) {
      const t = (serviceLevelPct - entries[i][0]) / (entries[i + 1][0] - entries[i][0]);
      return entries[i][1] + t * (entries[i + 1][1] - entries[i][1]);
    }
  }
  return serviceLevelPct > 99.9 ? 3.09 : 1.65;
}

/** Format as CSV. */
export function exportReorderCSV(result: ReorderResult): string {
  const header = ["metric", "value"];
  const rows = [
    ["lead_time_demand", result.leadTimeDemand.toFixed(2)],
    ["safety_stock", result.safetyStock.toFixed(2)],
    ["reorder_point", result.reorderPoint.toFixed(2)],
    ["eoq", result.eoq.toFixed(2)],
    ["optimal_orders_per_year", result.optimalOrdersPerYear.toFixed(2)],
    ["optimal_cycle_days", String(result.optimalCycleDays)],
    ["annual_holding_cost", result.annualHoldingCost.toFixed(2)],
    ["annual_ordering_cost", result.annualOrderingCost.toFixed(2)],
    ["total_inventory_cost", result.totalInventoryCost.toFixed(2)],
    ["stockout_risk_pct", (result.stockoutRisk * 100).toFixed(3)],
    ["days_until_reorder", String(result.daysUntilReorder)],
  ];
  return [header.join(","), ...rows.map((r) => r.join(","))].join("\n");
}

/** Plain-text summary. */
export function exportReorderText(result: ReorderResult): string {
  return [
    `INVENTORY REORDER SUMMARY`,
    `Lead time demand:    ${result.leadTimeDemand.toFixed(2)} units`,
    `Safety stock:        ${result.safetyStock.toFixed(2)} units`,
    `Reorder point:       ${result.reorderPoint.toFixed(2)} units`,
    `EOQ:                 ${result.eoq.toFixed(2)} units`,
    `Optimal orders/yr:   ${result.optimalOrdersPerYear.toFixed(2)}`,
    `Optimal cycle:       ${result.optimalCycleDays} days`,
    `Annual holding cost: $${result.annualHoldingCost.toFixed(2)}`,
    `Annual ordering:     $${result.annualOrderingCost.toFixed(2)}`,
    `Total inventory:     $${result.totalInventoryCost.toFixed(2)}`,
    `Stockout risk:       ${(result.stockoutRisk * 100).toFixed(2)}%`,
    `Days until reorder:  ${result.daysUntilReorder}`,
  ].join("\n");
}

/** Should you reorder right now? */
export function shouldReorder(currentStock: number, reorderPoint: number): boolean {
  return currentStock <= reorderPoint;
}

/** Forecast stockout date if no reorder. */
export function forecastStockoutDay(currentStock: number, avgDailyDemand: number, leadTimeDemand: number): number {
  if (avgDailyDemand <= 0) return Infinity;
  return Math.floor((currentStock - leadTimeDemand) / avgDailyDemand);
}

/** Sensitivity analysis: vary demand ±20% and report new ROP. */
export function sensitivityAnalysis(inputs: ReorderInputs): Array<{ scenario: string; demand: number; rop: number; ss: number }> {
  const scenarios = [
    { name: "−20% demand", factor: 0.8 },
    { name: "Base", factor: 1 },
    { name: "+20% demand", factor: 1.2 },
  ];
  return scenarios.map((s) => {
    const newDemand = inputs.avgDailyDemand * s.factor;
    const newStdDev = inputs.demandStdDev * s.factor;
    return {
      scenario: s.name,
      demand: newDemand,
      rop: reorderPoint(newDemand, inputs.leadTimeDays, inputs.zScore, newStdDev),
      ss: safetyStock(inputs.zScore, newStdDev, inputs.leadTimeDays),
    };
  });
}

/** Annual demand from daily average. */
export function annualFromDaily(avgDailyDemand: number, daysOpenPerYear = 365): number {
  return avgDailyDemand * daysOpenPerYear;
}

/** Compute total cost for a given order quantity Q (vs EOQ). */
export function totalCostForQ(Q: number, annualDemand: number, orderingCost: number, unitCost: number, holdingCostRate: number): number {
  const holding = (Q / 2) * unitCost * holdingCostRate;
  const ordering = (annualDemand / Q) * orderingCost;
  return holding + ordering;
}
