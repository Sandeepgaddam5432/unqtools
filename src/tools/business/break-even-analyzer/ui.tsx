"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, EmptyState } from "../../_shared";
import {
  calculateBreakEven,
  projectProfit,
  marginOfSafety,
  formatMoney,
  defaultInput,
} from "./logic";

export default function BreakEvenAnalyzer() {
  const [input, setInput] = useState(defaultInput());
  const [projectedUnits, setProjectedUnits] = useState(500);

  const result = useMemo(() => calculateBreakEven(input), [input]);
  const projection = useMemo(() => projectProfit(input, projectedUnits), [input, projectedUnits]);
  const safety = useMemo(() => marginOfSafety(projectedUnits, result.breakEvenUnits), [projectedUnits, result]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Fixed costs" value={input.fixedCosts} onChange={(v) => setInput((s) => ({ ...s, fixedCosts: v }))} />
            <Field label="Variable cost / unit" value={input.variableCostPerUnit} onChange={(v) => setInput((s) => ({ ...s, variableCostPerUnit: v }))} />
            <Field label="Price / unit" value={input.pricePerUnit} onChange={(v) => setInput((s) => ({ ...s, pricePerUnit: v }))} />
          </div>
          <Field label="Projected sales volume" value={projectedUnits} onChange={setProjectedUnits} />
        </CardContent>
      </Card>

      {result && !result.isValid && <ErrorBanner message={result.error ?? "Invalid input"} />}

      {result?.isValid && (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-xs">Break-even: {Math.ceil(result.breakEvenUnits)} units</Badge>
                <Badge variant="outline" className="text-xs">Revenue: {formatMoney(result.breakEvenRevenue)}</Badge>
                <Badge variant="outline" className="text-xs">CM/unit: {formatMoney(result.contributionMarginPerUnit)}</Badge>
                <Badge variant="outline" className="text-xs">CM ratio: {(result.contributionMarginRatio * 100).toFixed(1)}%</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <Label className="text-sm font-semibold">Projection at {projectedUnits} units</Label>
              <div className="space-y-1">
                <Row label="Revenue" value={formatMoney(projection.revenue)} />
                <Row label="Total costs" value={formatMoney(projection.totalCosts)} />
                <Row label="Profit" value={formatMoney(projection.profit)} highlight={projection.profit >= 0 ? "good" : "bad"} />
                <Row label="Margin" value={`${projection.marginPercent.toFixed(1)}%`} />
                <Row label="Margin of safety" value={`${safety.toFixed(1)}%`} />
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {!result && (
        <EmptyState title="Enter your cost structure" hint="Compute break-even units and revenue, then project profit at any sales volume." />
      )}
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input type="number" min={0} value={value} onChange={(e) => onChange(parseFloat(e.target.value) || 0)} className="text-sm font-mono" />
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: "good" | "bad" }) {
  const color = highlight === "good"
    ? "text-emerald-700 dark:text-emerald-400"
    : highlight === "bad"
    ? "text-red-700 dark:text-red-400"
    : "text-foreground";
  return (
    <div className="grid grid-cols-[160px_1fr] gap-2 items-center text-xs py-1.5 border-b border-border/40 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <code className={`font-mono ${color}`}>{value}</code>
    </div>
  );
}
