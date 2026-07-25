/**
 * Inventory Tracker — pure logic.
 * Track stock levels, reorder points, valuation (FIFO/LIFO/AVG).
 */

export interface Purchase {
  qty: number;
  unitCost: number;
  date: string; // ISO date for sorting
}

export interface Item {
  id: string;
  name: string;
  sku: string;
  purchases: Purchase[];
  soldQty: number;
  reorderPoint: number;
}

export type ValuationMethod = "FIFO" | "LIFO" | "AVG";

export interface ItemValuation {
  id: string;
  name: string;
  sku: string;
  totalPurchased: number;
  onHand: number;
  reorderPoint: number;
  needsReorder: boolean;
  unitCost: number;
  inventoryValue: number;
  cogs: number;
  method: ValuationMethod;
}

export interface ValuationResult {
  items: ItemValuation[];
  totalValue: number;
  totalCogs: number;
  totalOnHand: number;
  reorderCount: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Compute COGS and inventory value for an item using FIFO, LIFO, or AVG. */
export function valueItem(item: Item, method: ValuationMethod): ItemValuation {
  const totalPurchased = item.purchases.reduce((s, p) => s + p.qty, 0);
  const onHand = Math.max(0, totalPurchased - item.soldQty);

  // Sort purchases by date for FIFO/LIFO
  const sorted = [...item.purchases].sort((a, b) => a.date.localeCompare(b.date));
  const lifo = [...sorted].reverse();

  let inventoryValue = 0;
  let cogs = 0;
  let remainingSold = item.soldQty;

  // COGS: deduct from cost layers based on method
  const layersForCogs = method === "LIFO" ? lifo : sorted;
  for (const layer of layersForCogs) {
    if (remainingSold <= 0) break;
    const consumed = Math.min(layer.qty, remainingSold);
    cogs += consumed * layer.unitCost;
    remainingSold -= consumed;
  }

  // On-hand value: layers minus consumed-for-sale
  // We need a separate set of layers for what's left.
  let remaining = item.soldQty;
  const layersForOnHand = method === "LIFO" ? lifo : sorted;
  for (const layer of layersForOnHand) {
    if (remaining <= 0) {
      inventoryValue += layer.qty * layer.unitCost;
      continue;
    }
    const consumed = Math.min(layer.qty, remaining);
    const left = layer.qty - consumed;
    inventoryValue += left * layer.unitCost;
    remaining -= consumed;
  }

  // AVG: compute weighted average
  if (method === "AVG") {
    const totalCost = item.purchases.reduce((s, p) => s + p.qty * p.unitCost, 0);
    const totalQty = item.purchases.reduce((s, p) => s + p.qty, 0);
    const avgCost = totalQty > 0 ? totalCost / totalQty : 0;
    inventoryValue = avgCost * onHand;
    cogs = avgCost * Math.min(item.soldQty, totalPurchased);
  }

  const unitCost = onHand > 0 ? inventoryValue / onHand : (method === "AVG" ? (item.purchases.reduce((s, p) => s + p.qty * p.unitCost, 0) / Math.max(1, item.purchases.reduce((s, p) => s + p.qty, 0))) : (sorted[0]?.unitCost ?? 0));

  return {
    id: item.id,
    name: item.name,
    sku: item.sku,
    totalPurchased,
    onHand,
    reorderPoint: item.reorderPoint,
    needsReorder: onHand <= item.reorderPoint,
    unitCost: round2(unitCost),
    inventoryValue: round2(inventoryValue),
    cogs: round2(cogs),
    method,
  };
}

export function valueInventory(items: Item[], method: ValuationMethod): ValuationResult {
  const valued = items.map((it) => valueItem(it, method));
  const totalValue = round2(valued.reduce((s, v) => s + v.inventoryValue, 0));
  const totalCogs = round2(valued.reduce((s, v) => s + v.cogs, 0));
  const totalOnHand = valued.reduce((s, v) => s + v.onHand, 0);
  const reorderCount = valued.filter((v) => v.needsReorder).length;
  return { items: valued, totalValue, totalCogs, totalOnHand, reorderCount };
}

export function toCsv(result: ValuationResult): string {
  const lines = ["id,name,sku,onHand,reorderPoint,needsReorder,unitCost,inventoryValue,cogs,method"];
  for (const v of result.items) {
    lines.push([v.id, `"${v.name}"`, v.sku, v.onHand, v.reorderPoint, v.needsReorder, v.unitCost, v.inventoryValue, v.cogs, v.method].join(","));
  }
  return lines.join("\n");
}
