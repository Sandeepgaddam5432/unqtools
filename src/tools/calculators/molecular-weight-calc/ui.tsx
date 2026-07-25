"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CopyButton, ErrorBanner } from "../../_shared";
import { molecularWeight, ATOMIC_WEIGHTS } from "./logic";

export default function MolecularWeightCalc() {
  const [formula, setFormula] = useState("H2O");
  const [result, setResult] = useState<ReturnType<typeof molecularWeight> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const calculate = useCallback(() => {
    setError(null);
    const r = molecularWeight(formula);
    if ("error" in r) { setError(r.error); setResult(null); return; }
    setResult(r);
  }, [formula]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Chemical formula</Label>
            <Input type="text" value={formula} onChange={(e) => setFormula(e.target.value)} placeholder="e.g. H2O, Ca(OH)2, C6H12O6" className="font-mono" />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={calculate}>Calculate</Button>
            <Button size="sm" variant="ghost" onClick={() => { setFormula("H2O"); setResult(null); setError(null); }}>Sample</Button>
            <Button size="sm" variant="ghost" onClick={() => { setFormula(""); setResult(null); setError(null); }}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && !error && !("error" in result) && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Molecular weight</CardTitle>
              <CopyButton getText={() => String(result.weight.toFixed(3))} label="Copy" />
            </div>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            <p className="text-3xl font-bold text-primary">{result.weight.toFixed(3)} g/mol</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/80">
                  <tr><th className="p-2 text-left">Element</th><th className="p-2 text-right">Count</th><th className="p-2 text-right">Weight (g/mol)</th></tr>
                </thead>
                <tbody>
                  {result.tokens.map((t) => {
                    const w = ATOMIC_WEIGHTS[t.element] ?? 0;
                    return (
                      <tr key={t.element} className="border-t border-border/50">
                        <td className="p-2 font-mono">{t.element}</td>
                        <td className="p-2 text-right font-mono">{t.count}</td>
                        <td className="p-2 text-right font-mono">{t.count} × {w.toFixed(3)} = {(t.count * w).toFixed(3)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all calculations run locally in your browser.</p>
        </CardContent>
      </Card>
    </div>
  );
}
