"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import {
  process, toCsv, compareVehicles, comparisonToCsv, batchProcess,
  convertCurrency, formatCurrency, fmt,
  CURRENCY_SYMBOL, CO2_BY_FUEL,
  type FuelUnit, type Currency,
} from "./logic";

const UNITS: { value: FuelUnit; label: string }[] = [
  { value: "l100km", label: "L/100km" },
  { value: "kmpl", label: "km/L" },
  { value: "mpg", label: "MPG (US)" },
];

const CURRENCIES = Object.keys(CURRENCY_SYMBOL) as Currency[];

export default function FuelCostCalculator() {
  const [distance, setDistance] = useState("500");
  const [price, setPrice] = useState("1.5");
  const [consumption, setConsumption] = useState("8");
  const [unit, setUnit] = useState<FuelUnit>("l100km");
  const [currency, setCurrency] = useState<Currency>("USD");
  const [fuelType, setFuelType] = useState("gasoline");
  const [vehicles, setVehicles] = useState("Car A,8,l100km,1.5\nCar B,6,l100km,1.5");
  const [error, setError] = useState<string | null>(null);

  const result = useMemo(() => {
    setError(null);
    const r = process({
      distance: Number(distance), fuelPricePerLiter: Number(price),
      consumption: Number(consumption), consumptionUnit: unit,
      co2PerLiter: CO2_BY_FUEL[fuelType],
    });
    if ("error" in r) { setError(r.error); return null; }
    return r;
  }, [distance, price, consumption, unit, fuelType]);

  const comparison = useMemo(() => {
    const rows = vehicles.split("\n").map((l) => l.trim()).filter(Boolean).map((line) => {
      const [name, c, u, p] = line.split(",");
      return {
        name: name?.trim() ?? "Vehicle",
        consumption: Number(c ?? 0), unit: (u?.trim() ?? "l100km") as FuelUnit,
        pricePerLiter: Number(p ?? 0),
      };
    });
    return compareVehicles(rows, Number(distance), CO2_BY_FUEL[fuelType]);
  }, [vehicles, distance, fuelType]);

  const batchResult = useMemo(() => batchProcess([
    { distance: 100, fuelPricePerLiter: Number(price), consumption: Number(consumption), consumptionUnit: unit, co2PerLiter: CO2_BY_FUEL[fuelType] },
    { distance: 200, fuelPricePerLiter: Number(price), consumption: Number(consumption), consumptionUnit: unit, co2PerLiter: CO2_BY_FUEL[fuelType] },
    { distance: 500, fuelPricePerLiter: Number(price), consumption: Number(consumption), consumptionUnit: unit, co2PerLiter: CO2_BY_FUEL[fuelType] },
  ]), [price, consumption, unit, fuelType]);

  const csv = useMemo(() => {
    if (!result) return "";
    return toCsv(result, Number(distance));
  }, [result, distance]);

  const fullCsv = useMemo(() => {
    let out = csv;
    if (comparison && !("error" in comparison)) out += "\n\n" + comparisonToCsv(comparison);
    return out;
  }, [csv, comparison]);

  const convertedCost = useMemo(() => {
    if (!result) return null;
    const v = convertCurrency(result.fuelCost, "USD", currency);
    return typeof v === "number" ? v : null;
  }, [result, currency]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Distance (km)</Label>
              <Input type="number" value={distance} onChange={(e) => setDistance(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Fuel price (per L)</Label>
              <Input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Consumption</Label>
              <Input type="number" step="0.1" value={consumption} onChange={(e) => setConsumption(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Unit</Label>
              <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={unit} onChange={(e) => setUnit(e.target.value as FuelUnit)}>
                {UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Fuel type</Label>
              <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={fuelType} onChange={(e) => setFuelType(e.target.value)}>
                {Object.keys(CO2_BY_FUEL).map((f) => <option key={f} value={f}>{f} ({CO2_BY_FUEL[f]} kg/L)</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Currency</Label>
              <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
                {CURRENCIES.map((c) => <option key={c} value={c}>{c} ({CURRENCY_SYMBOL[c]})</option>)}
              </select>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="ghost" onClick={() => { setDistance("500"); setPrice("1.5"); setConsumption("8"); setUnit("l100km"); }}>Load sample</Button>
            <CopyButton getText={() => csv} disabled={!result} />
            <DownloadButton getText={() => fullCsv} filename="fuel-cost.csv" mime="text/csv" disabled={!result} />
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && !error && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Liters used</p><p className="text-lg font-bold">{fmt(result.litersUsed)} L</p></CardContent></Card>
            <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Fuel cost</p><p className="text-lg font-bold">{formatCurrency(result.fuelCost, "USD")}</p>{convertedCost !== null && currency !== "USD" && <p className="text-xs">≈ {formatCurrency(convertedCost, currency)}</p>}</CardContent></Card>
            <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Cost / km</p><p className="text-lg font-bold">{fmt(result.costPerKm)}</p></CardContent></Card>
            <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">CO₂ emitted</p><p className="text-lg font-bold text-emerald-600">{fmt(result.co2Kg)} kg</p></CardContent></Card>
          </div>
          <Card><CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline">≈ {fmt(result.equivalentMpg, 1)} MPG</Badge>
              <Badge variant="outline">≈ {fmt(result.equivalentL100km)} L/100km</Badge>
              <Badge variant="outline">Fuel: {fuelType}</Badge>
            </div>
            {result.warnings.length > 0 && <p className="text-xs text-yellow-700 dark:text-yellow-400">{result.warnings.join(" ")}</p>}
          </CardContent></Card>
        </>
      )}

      <Card><CardContent className="p-4 space-y-2">
        <Label className="text-sm font-medium">Compare vehicles (name,consumption,unit,pricePerL)</Label>
        <textarea value={vehicles} onChange={(e) => setVehicles(e.target.value)} rows={3} className="w-full rounded-md border bg-background p-2 text-sm font-mono" />
        {comparison && !("error" in comparison) && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Cheapest: <span className="font-mono text-foreground">{comparison.cheapest}</span> · Cleanest: <span className="font-mono text-foreground">{comparison.cleanest}</span></p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {comparison.vehicles.map((v) => (
                <div key={v.name} className="rounded-md border p-2 text-xs">
                  <p className="font-medium">{v.name}</p>
                  <p className="font-mono">{fmt(v.litersUsed)} L · {formatCurrency(v.fuelCost, "USD")}</p>
                  <p className="font-mono text-emerald-600">{fmt(v.co2Kg)} kg CO₂</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent></Card>

      <Card><CardContent className="p-4 space-y-2">
        <Label className="text-sm font-medium">Batch trips (100, 200, 500 km)</Label>
        <div className="grid grid-cols-3 gap-2">
          {batchResult.map((r) => (
            <div key={r.i} className="rounded-md border p-2 text-xs">
              <p className="text-muted-foreground">{[100, 200, 500][r.i]} km</p>
              <p className="font-mono">{"error" in r.result ? "err" : formatCurrency(r.result.fuelCost, "USD")}</p>
            </div>
          ))}
        </div>
      </CardContent></Card>

      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all calculations run locally in your browser.</p></CardContent></Card>
    </div>
  );
}
