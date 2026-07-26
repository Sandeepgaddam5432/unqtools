"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  planBalance, planBatch, renderBatchCsv, renderReport, parseEquation, parseFormula,
} from "./logic";

export default function ChemicalEquationBalancer() {
  const [equation, setEquation] = useState("H2 + O2 -> H2O");
  const [error, setError] = useState<string | null>(null);

  const result = useMemo(() => planBalance(equation), [equation]);

  const parsed = useMemo(() => {
    try { return parseEquation(equation); } catch { return null; }
  }, [equation]);

  const exportBatch = () => {
    setError(null);
    try { planBatch([equation, "Fe + O2 -> Fe2O3", "CH4 + O2 -> CO2 + H2O"]); } catch (e) { setError(String(e)); }
  };

  return (
    <div className="space-y-4">
      {error && <ErrorBanner message={error} />}

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 gap-3">
            <Field label="Equation (use -> or = as arrow)"><input value={equation} onChange={(e) => setEquation(e.target.value)} className="w-full rounded-md border bg-background px-2 py-1.5 text-sm font-mono" placeholder="e.g. H2 + O2 -> H2O" /></Field>
          </div>
          <div className="flex flex-wrap gap-2">
            <CopyButton getText={() => result.balancedEquation} label="Copy balanced" />
            <CopyButton getText={() => renderReport(result)} label="Copy report" />
            <DownloadButton getText={() => renderReport(result)} filename="balancer-report.txt" label="Download report" />
            <DownloadButton getText={() => renderBatchCsv(planBatch([equation]))} filename="balancer-batch.csv" mime="text/csv" label="Download CSV" />
            <button onClick={exportBatch} className="text-xs text-primary hover:underline cursor-pointer">Plan batch (3 equations)</button>
          </div>
          <div className="flex flex-wrap gap-1 text-xs">
            <span className="text-muted-foreground">Examples:</span>
            {["H2 + O2 -> H2O", "Fe + O2 -> Fe2O3", "CH4 + O2 -> CO2 + H2O", "C3H8 + O2 -> CO2 + H2O"].map((ex) => (
              <button key={ex} onClick={() => setEquation(ex)} className="text-primary hover:underline cursor-pointer">{ex}</button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold">Balanced equation</Label>
            <Badge variant="outline" className={`text-xs ${result.coefficients ? "border-emerald-500/30 text-emerald-700 dark:text-emerald-400" : "border-destructive/30 text-destructive"}`}>{result.coefficients ? "balanced" : "failed"}</Badge>
          </div>
          <div className="rounded-md border bg-muted/40 p-3 text-lg font-mono break-all">{result.balancedEquation || "—"}</div>
          {result.coefficients && (
            <div className="text-xs text-muted-foreground">Coefficients: {result.coefficients.join(", ")}</div>
          )}
          {result.warnings.length > 0 && (
            <div className="space-y-1 pt-1">{result.warnings.map((w, i) => <div key={i} className="text-xs text-amber-700 dark:text-amber-400">! {w}</div>)}</div>
          )}
          {result.notes.length > 0 && (
            <div className="space-y-1 pt-1">{result.notes.map((n, i) => <div key={i} className="text-xs text-blue-700 dark:text-blue-400">• {n}</div>)}</div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <Label className="text-sm font-semibold">Step-by-step solution</Label>
          <div className="space-y-1">
            {result.steps.map((s, i) => (
              <div key={i} className="text-xs py-1 border-b border-border/40 last:border-0">
                <span className="text-muted-foreground">{i + 1}.</span> {s}
              </div>
            ))}
            {result.steps.length === 0 && <div className="text-xs text-muted-foreground">No steps available.</div>}
          </div>
        </CardContent>
      </Card>

      {parsed && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <Label className="text-sm font-semibold">Compound breakdown</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="text-xs font-medium mb-1">Reactants</div>
                {parsed.reactants.compounds.map((c, i) => (
                  <div key={i} className="text-xs py-1 border-b border-border/40 last:border-0">
                    <span className="font-mono">{c.formula}</span>
                    <span className="text-muted-foreground ml-2">{JSON.stringify(parseFormula(c.formula))}</span>
                  </div>
                ))}
              </div>
              <div>
                <div className="text-xs font-medium mb-1">Products</div>
                {parsed.products.compounds.map((c, i) => (
                  <div key={i} className="text-xs py-1 border-b border-border/40 last:border-0">
                    <span className="font-mono">{c.formula}</span>
                    <span className="text-muted-foreground ml-2">{JSON.stringify(parseFormula(c.formula))}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (<div className="space-y-1"><Label className="text-xs text-muted-foreground">{label}</Label>{children}</div>);
}
