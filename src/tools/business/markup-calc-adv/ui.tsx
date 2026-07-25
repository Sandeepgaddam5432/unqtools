"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, EmptyState } from "../../_shared";
import { calculateMarkup, formatMoney, markupToMargin, defaultInput } from "./logic";

export default function MarkupCalcAdv() {
  const [input, setInput] = useState(defaultInput());

  const result = useMemo(() => calculateMarkup(input), [input]);
  const impliedMargin = useMemo(() => markupToMargin(input.markupPercent), [input.markupPercent]);

  const rows = useMemo(() => {
    if (!result.isValid) return [];
    return [
      { label: "Cost", value: formatMoney(result.cost) },
      { label: "Markup amount", value: formatMoney(result.markupAmount) },
      { label: "Pre-tax price", value: formatMoney(result.preTaxPrice) },
      { label: "Discount amount", value: formatMoney(result.discountAmount) },
      { label: "Discounted price", value: formatMoney(result.discountedPrice) },
      { label: "Tax amount", value: formatMoney(result.taxAmount) },
      { label: "Final price", value: formatMoney(result.finalPrice) },
      { label: "Profit", value: formatMoney(result.profit) },
      { label: "Gross margin", value: `${result.grossMarginPercent.toFixed(2)}%` },
    ];
  }, [result]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Field label="Cost" value={input.cost} onChange={(v) => setInput((s) => ({ ...s, cost: v }))} />
            <Field label="Markup %" value={input.markupPercent} onChange={(v) => setInput((s) => ({ ...s, markupPercent: v }))} />
            <Field label="Discount %" value={input.discountPercent} onChange={(v) => setInput((s) => ({ ...s, discountPercent: v }))} />
            <Field label="Tax %" value={input.taxPercent} onChange={(v) => setInput((s) => ({ ...s, taxPercent: v }))} />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs">Markup {input.markupPercent}% → Margin {impliedMargin.toFixed(2)}%</Badge>
          </div>
        </CardContent>
      </Card>

      {result && !result.isValid && <ErrorBanner message={result.error ?? "Invalid input"} />}

      {result?.isValid && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="text-xs">Final: {formatMoney(result.finalPrice)}</Badge>
              <Badge variant="outline" className="text-xs border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                Profit: {formatMoney(result.profit)}
              </Badge>
              <Badge variant="outline" className="text-xs">Margin: {result.grossMarginPercent.toFixed(1)}%</Badge>
            </div>
            <div className="space-y-1">
              {rows.map((r) => (
                <div key={r.label} className="grid grid-cols-[160px_1fr] gap-2 items-center text-xs py-1.5 border-b border-border/40 last:border-0">
                  <span className="text-muted-foreground">{r.label}</span>
                  <code className="font-mono">{r.value}</code>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {!result && (
        <EmptyState title="Enter cost and markup" hint="Compute retail price, tax, discount, profit, and gross margin — all in real time." />
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
