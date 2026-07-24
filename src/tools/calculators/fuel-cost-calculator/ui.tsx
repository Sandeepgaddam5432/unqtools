"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import { process, toCsv, type FuelOptions, type FuelUnit, type FuelResult } from "./logic";

export default function FuelCostCalculator() {
  const [opts, setOpts] = useState<FuelOptions>({
    distance: 500,
    fuelPricePerLiter: 1.5,
    consumption: 8,
    consumptionUnit: "l100km",
  });
  const [result, setResult] = useState<FuelResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(() => {
    setError(null);
    const r = process(opts);
    if ("error" in r) { setError(r.error); setResult(null); }
    else setResult(r);
  }, [opts]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Distance (km)</Label>
              <Input type="number" value={opts.distance} onChange={(e) => setOpts({ ...opts, distance: parseFloat(e.target.value) || 0 })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Fuel price (per L)</Label>
              <Input type="number" step="0.01" value={opts.fuelPricePerLiter} onChange={(e) => setOpts({ ...opts, fuelPricePerLiter: parseFloat(e.target.value) || 0 })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Consumption</Label>
              <Input type="number" step="0.1" value={opts.consumption} onChange={(e) => setOpts({ ...opts, consumption: parseFloat(e.target.value) || 0 })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Unit</Label>
              <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={opts.consumptionUnit} onChange={(e) => setOpts({ ...opts, consumptionUnit: e.target.value as FuelUnit })}>
                <option value="l100km">L/100km</option>
                <option value="kmpl">km/L</option>
                <option value="mpg">MPG (US)</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={run}>Calculate</Button>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && !error && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Liters used</p><p className="text-lg font-bold">{result.litersUsed.toFixed(2)} L</p></CardContent></Card>
            <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Fuel cost</p><p className="text-lg font-bold">{result.fuelCost.toFixed(2)}</p></CardContent></Card>
            <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Cost / km</p><p className="text-lg font-bold">{result.costPerKm.toFixed(2)}</p></CardContent></Card>
            <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">CO₂ emitted</p><p className="text-lg font-bold text-emerald-600">{result.co2Kg.toFixed(2)} kg</p></CardContent></Card>
          </div>
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline">≈ {result.equivalentMpg.toFixed(1)} MPG</Badge>
                <Badge variant="outline">≈ {result.equivalentL100km.toFixed(2)} L/100km</Badge>
                <div className="ml-auto flex gap-2">
                  <CopyButton getText={() => String(result.fuelCost.toFixed(2))} />
                  <DownloadButton getText={() => toCsv(result, opts.distance)} filename="fuel-cost.csv" mime="text/csv" />
                </div>
              </div>
              {result.warnings.length > 0 && <p className="text-xs text-yellow-700 dark:text-yellow-400">{result.warnings.join(" ")}</p>}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
