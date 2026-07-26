"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  computeReorder,
  validateInputs,
  zScoreFromServiceLevel,
  exportReorderCSV,
  exportReorderText,
  shouldReorder,
  forecastStockoutDay,
  sensitivityAnalysis,
  type ReorderInputs,
} from "./logic";

const fmt = (n: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n);
const fmtUSD = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n);

export default function InventoryReorderCalc() {
  const [avgDailyDemand, setAvgDailyDemand] = useState<string>("20");
  const [leadTimeDays, setLeadTimeDays] = useState<string>("7");
  const [serviceLevel, setServiceLevel] = useState<string>("95");
  const [demandStdDev, setDemandStdDev] = useState<string>("5");
  const [unitCost, setUnitCost] = useState<string>("10");
  const [orderingCost, setOrderingCost] = useState<string>("50");
  const [holdingCostRate, setHoldingCostRate] = useState<string>("0.2");
  const [annualDemand, setAnnualDemand] = useState<string>("7300");
  const [currentStock, setCurrentStock] = useState<string>("200");
  const [error, setError] = useState<string>("");

  const inputs: ReorderInputs = {
    avgDailyDemand: Number(avgDailyDemand) || 0,
    leadTimeDays: Number(leadTimeDays) || 0,
    zScore: zScoreFromServiceLevel(Number(serviceLevel) || 95),
    demandStdDev: Number(demandStdDev) || 0,
    unitCost: Number(unitCost) || 0,
    orderingCost: Number(orderingCost) || 0,
    holdingCostRate: Number(holdingCostRate) || 0,
    annualDemand: Number(annualDemand) || 0,
    currentStock: Number(currentStock) || 0,
  };

  const warnings = useMemo(() => validateInputs(inputs), [avgDailyDemand, leadTimeDays, serviceLevel, demandStdDev, unitCost, orderingCost, holdingCostRate, annualDemand, currentStock]);
  const result = useMemo(() => computeReorder(inputs), [avgDailyDemand, leadTimeDays, serviceLevel, demandStdDev, unitCost, orderingCost, holdingCostRate, annualDemand, currentStock]);
  const sensitivity = useMemo(() => sensitivityAnalysis(inputs), [avgDailyDemand, leadTimeDays, serviceLevel, demandStdDev]);
  const needReorder = shouldReorder(inputs.currentStock, result.reorderPoint);
  const stockoutDay = forecastStockoutDay(inputs.currentStock, inputs.avgDailyDemand, result.leadTimeDemand);

  return (
    <div className="space-y-4">
      {error && <ErrorBanner message={error} />}

      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-sm font-semibold">Demand &amp; lead time</Label>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Avg daily demand</Label>
              <input type="number" value={avgDailyDemand} onChange={(e) => setAvgDailyDemand(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Lead time (days)</Label>
              <input type="number" value={leadTimeDays} onChange={(e) => setLeadTimeDays(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Demand std dev</Label>
              <input type="number" value={demandStdDev} onChange={(e) => setDemandStdDev(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Service level %</Label>
              <input type="number" value={serviceLevel} onChange={(e) => setServiceLevel(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Current stock</Label>
              <input type="number" value={currentStock} onChange={(e) => setCurrentStock(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs" />
            </div>
          </div>
          <Label className="text-sm font-semibold pt-2">Cost inputs</Label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Unit cost ($)</Label>
              <input type="number" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Ordering cost ($)</Label>
              <input type="number" value={orderingCost} onChange={(e) => setOrderingCost(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Holding cost rate</Label>
              <input type="number" step="0.01" value={holdingCostRate} onChange={(e) => setHoldingCostRate(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Annual demand</Label>
              <input type="number" value={annualDemand} onChange={(e) => setAnnualDemand(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs" />
            </div>
          </div>
          {warnings.length > 0 && (
            <ul className="text-xs text-amber-700 dark:text-amber-400 list-disc pl-4">
              {warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h3 className="text-base font-semibold">Reorder metrics</h3>
            <div className="flex gap-2 flex-wrap">
              <CopyButton getText={() => exportReorderText(result)} label="Copy text" />
              <DownloadButton getText={() => exportReorderCSV(result)} filename="reorder-metrics.csv" mime="text/csv" label="CSV" />
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="rounded-md border border-border p-2">
              <div className="text-muted-foreground">Lead time demand</div>
              <code className="font-mono">{fmt(result.leadTimeDemand)} units</code>
            </div>
            <div className="rounded-md border border-border p-2">
              <div className="text-muted-foreground">Safety stock</div>
              <code className="font-mono">{fmt(result.safetyStock)} units</code>
            </div>
            <div className="rounded-md border border-border p-2">
              <div className="text-muted-foreground">Reorder point</div>
              <code className="font-mono font-medium">{fmt(result.reorderPoint)} units</code>
            </div>
            <div className="rounded-md border border-border p-2">
              <div className="text-muted-foreground">EOQ</div>
              <code className="font-mono">{fmt(result.eoq)} units</code>
            </div>
            <div className="rounded-md border border-border p-2">
              <div className="text-muted-foreground">Orders/year</div>
              <code className="font-mono">{fmt(result.optimalOrdersPerYear)}</code>
            </div>
            <div className="rounded-md border border-border p-2">
              <div className="text-muted-foreground">Cycle days</div>
              <code className="font-mono">{result.optimalCycleDays}</code>
            </div>
            <div className="rounded-md border border-border p-2">
              <div className="text-muted-foreground">Stockout risk</div>
              <code className="font-mono">{(result.stockoutRisk * 100).toFixed(2)}%</code>
            </div>
            <div className="rounded-md border border-border p-2">
              <div className="text-muted-foreground">Days until reorder</div>
              <code className="font-mono">{result.daysUntilReorder}</code>
            </div>
          </div>
          {needReorder ? (
            <div className="rounded-md border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-700 dark:text-red-400">
              ⚠ Stock is at or below the reorder point. Place an order now.
            </div>
          ) : (
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-2 text-xs text-emerald-700 dark:text-emerald-400">
              ✓ Stock is above the reorder point. Next reorder in ~{result.daysUntilReorder} days. Stockout forecast: day {stockoutDay === Infinity ? "∞" : stockoutDay}.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-sm font-semibold">Annual cost breakdown</Label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            <div className="rounded-md border border-border p-2">
              <div className="text-muted-foreground">Annual holding cost</div>
              <code className="font-mono">{fmtUSD(result.annualHoldingCost)}</code>
            </div>
            <div className="rounded-md border border-border p-2">
              <div className="text-muted-foreground">Annual ordering cost</div>
              <code className="font-mono">{fmtUSD(result.annualOrderingCost)}</code>
            </div>
            <div className="rounded-md border border-border p-2">
              <div className="text-muted-foreground">Total inventory cost</div>
              <code className="font-mono font-medium">{fmtUSD(result.totalInventoryCost)}</code>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-sm font-semibold">Sensitivity analysis (±20% demand)</Label>
          <div className="space-y-1">
            <div className="grid grid-cols-[1fr_100px_100px_100px] gap-2 text-[10px] uppercase text-muted-foreground pb-1 border-b border-border/40">
              <span>Scenario</span>
              <span>Demand</span>
              <span>Safety</span>
              <span>ROP</span>
            </div>
            {sensitivity.map((s, i) => (
              <div key={i} className="grid grid-cols-[1fr_100px_100px_100px] gap-2 text-xs py-1 border-b border-border/40 last:border-0">
                <span>{s.scenario}</span>
                <code className="font-mono">{fmt(s.demand)}</code>
                <code className="font-mono">{fmt(s.ss)}</code>
                <Badge variant="outline" className="text-[10px] justify-self-end">{fmt(s.rop)}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
