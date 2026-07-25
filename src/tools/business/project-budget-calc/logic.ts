/**
 * Project Budget Calculator — pure logic.
 * Compute project budget: labor + materials + overhead + contingency.
 */

export interface LaborLine {
  role: string;
  hours: number;
  rate: number; // per hour
}

export interface MaterialLine {
  name: string;
  qty: number;
  unitCost: number;
}

export interface BudgetInput {
  labor: LaborLine[];
  materials: MaterialLine[];
  overheadPct: number; // percent of (labor + materials)
  contingencyPct: number; // percent of (labor + materials + overhead)
  taxPct: number; // percent of materials
}

export interface BudgetResult {
  laborCost: number;
  materialsCost: number;
  materialsTax: number;
  subtotal: number;
  overhead: number;
  contingency: number;
  total: number;
  costBreakdownPct: { labor: number; materials: number; overhead: number; contingency: number };
  warnings: string[];
}

function round2(n: number): number { return Math.round(n * 100) / 100; }

export function computeBudget(input: BudgetInput): BudgetResult {
  const warnings: string[] = [];
  const laborCost = round2(input.labor.reduce((s, l) => s + l.hours * l.rate, 0));
  const materialsCost = round2(input.materials.reduce((s, m) => s + m.qty * m.unitCost, 0));
  const materialsTax = round2(materialsCost * (input.taxPct / 100));

  if (input.labor.some((l) => l.hours < 0 || l.rate < 0)) warnings.push("Negative hours or rate detected on a labor line.");
  if (input.materials.some((m) => m.qty < 0 || m.unitCost < 0)) warnings.push("Negative quantity or unit cost detected on a material line.");
  if (input.overheadPct < 0 || input.overheadPct > 100) warnings.push("Overhead percent should be 0-100.");
  if (input.contingencyPct < 0 || input.contingencyPct > 100) warnings.push("Contingency percent should be 0-100.");
  if (laborCost === 0 && materialsCost === 0) warnings.push("Labor and materials are both zero.");

  const subtotal = round2(laborCost + materialsCost + materialsTax);
  const overhead = round2(subtotal * (input.overheadPct / 100));
  const contingency = round2((subtotal + overhead) * (input.contingencyPct / 100));
  const total = round2(subtotal + overhead + contingency);

  const total_for_pct = Math.max(1, total);
  return {
    laborCost,
    materialsCost,
    materialsTax,
    subtotal,
    overhead,
    contingency,
    total,
    costBreakdownPct: {
      labor: round2((laborCost / total_for_pct) * 100),
      materials: round2(((materialsCost + materialsTax) / total_for_pct) * 100),
      overhead: round2((overhead / total_for_pct) * 100),
      contingency: round2((contingency / total_for_pct) * 100),
    },
    warnings,
  };
}

export function toMarkdown(r: BudgetResult): string {
  const lines = [
    "# Project Budget",
    "",
    `| Line | Amount |`,
    `| --- | --- |`,
    `| Labor | $${r.laborCost} |`,
    `| Materials | $${r.materialsCost} |`,
    `| Materials tax | $${r.materialsTax} |`,
    `| Subtotal | $${r.subtotal} |`,
    `| Overhead | $${r.overhead} |`,
    `| Contingency | $${r.contingency} |`,
    `| **Total** | **$${r.total}** |`,
  ];
  return lines.join("\n");
}
