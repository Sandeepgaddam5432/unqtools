"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, EmptyState } from "../../_shared";
import { forecast, classifyTrend, suggestReorderPoint, type UsagePoint } from "./logic";

export default function InventoryForecast() {
  const [historyText, setHistoryText] = useState("W1,100\nW2,110\nW3,120\nW4,130");
  const [stock, setStock] = useState(500);
  const [periods, setPeriods] = useState(6);
  const [leadTime, setLeadTime] = useState(2);
  const [safety, setSafety] = useState(50);

  const history = useMemo<UsagePoint[]>(() => {
    const lines = historyText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    return lines.map((line) => {
      const [period, units] = line.split(/[,\t]/).map((s) => s.trim());
      return { period: period ?? "", units: parseInt(units ?? "0", 10) || 0 };
    });
  }, [historyText]);

  const result = useMemo(() => forecast(history, stock, periods), [history, stock, periods]);
  const reorder = useMemo(() => suggestReorderPoint(result?.averageUsage ?? 0, leadTime, safety), [result, leadTime, safety]);
  const trend = useMemo(() => classifyTrend(result?.slope ?? 0), [result]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1">
            <Label htmlFor="history" className="text-xs text-muted-foreground">Usage history (period,units per line)</Label>
            <Textarea
              id="history"
              value={historyText}
              onChange={(e) => setHistoryText(e.target.value)}
              className="font-mono text-sm min-h-[100px]"
            />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Field label="Current stock" value={stock} onChange={setStock} />
            <Field label="Forecast periods" value={periods} onChange={setPeriods} />
            <Field label="Lead time (periods)" value={leadTime} onChange={setLeadTime} />
            <Field label="Safety stock" value={safety} onChange={setSafety} />
          </div>
        </CardContent>
      </Card>

      {result && !result.isValid && <ErrorBanner message={result.error ?? "Invalid forecast input"} />}

      {result?.isValid && (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-xs">Slope: {result.slope.toFixed(2)}</Badge>
                <Badge variant="outline" className="text-xs">Avg usage: {result.averageUsage.toFixed(1)}</Badge>
                <Badge variant="outline" className="text-xs">R²: {result.r2.toFixed(3)}</Badge>
                <Badge variant="outline" className={`text-xs ${trend === "rising" ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400" : trend === "falling" ? "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400" : ""}`}>Trend: {trend}</Badge>
                {result.projectedStockoutPeriod !== null && (
                  <Badge variant="outline" className="text-xs border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400">
                    Stockout in period {result.projectedStockoutPeriod + 1}
                  </Badge>
                )}
                <Badge variant="outline" className="text-xs">Reorder point: {reorder} units</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <Label className="text-sm font-semibold">Forecast ({periods} periods)</Label>
              <div className="space-y-1 max-h-[300px] overflow-auto">
                <div className="grid grid-cols-[60px_1fr_60px] gap-2 text-[10px] text-muted-foreground px-1">
                  <span>Period</span><span>Projected usage</span><span>Units</span>
                </div>
                {result.projected.map((u, i) => (
                  <div key={i} className="grid grid-cols-[60px_1fr_60px] gap-2 items-center text-xs py-1 border-b border-border/40 last:border-0">
                    <span className="text-muted-foreground">+{i + 1}</span>
                    <div className="h-4 bg-muted rounded overflow-hidden">
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${Math.min(100, (u / Math.max(...result.projected, 1)) * 100)}%` }}
                      />
                    </div>
                    <code className="font-mono text-right">{u}</code>
                  </div>
                ))}
              </div>
              <div className="text-xs text-muted-foreground">
                Total projected usage: <span className="font-mono text-foreground">{result.totalProjected}</span> units
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {!result && (
        <EmptyState title="Enter usage history" hint="At least 2 periods of history for a linear projection. Stockout and reorder point are computed automatically." />
      )}
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input type="number" value={value} onChange={(e) => onChange(parseInt(e.target.value, 10) || 0)} className="text-sm font-mono" />
    </div>
  );
}
