"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import {
  computeAreaWithUnit,
  validateAreaInput,
  batchCompute,
  batchStats,
  batchToCsv,
  convertAllToCsv,
  convertArea,
  formatArea,
  SHAPE_LABELS,
  SHAPE_FORMULAS,
  SHAPE_PARAMS,
  UNIT_LABELS,
  type Shape,
  type AreaUnit,
  type AreaInput,
} from "./logic";

const SHAPES: Shape[] = ["rectangle", "circle", "triangle", "trapezoid", "ellipse", "parallelogram"];
const UNITS = Object.keys(UNIT_LABELS) as AreaUnit[];

export default function AreaCalculator() {
  const [shape, setShape] = useState<Shape>("rectangle");
  const [values, setValues] = useState<number[]>([4, 5]);
  const [unit, setUnit] = useState<AreaUnit>("m2");
  const [batchText, setBatchText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const params = SHAPE_PARAMS[shape];
  const result = useMemo(() => {
    const v = validateAreaInput({ shape, values });
    if ("error" in v) { setError(v.error); return null; }
    setError(null);
    return computeAreaWithUnit({ shape, values }, unit);
  }, [shape, values, unit]);

  const allUnits = useMemo(() => {
    if (!result || "error" in result) return [];
    return (UNITS as AreaUnit[]).map((u) => ({ unit: u, value: convertArea(result.area, unit, u) }));
  }, [result, unit]);

  const batchInputs = useMemo<AreaInput[]>(() => {
    return batchText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((line) => {
        const nums = line.split(/[,\s]+/).map(Number).filter((n) => Number.isFinite(n));
        return { shape, values: nums };
      })
      .filter((i) => i.values.length > 0);
  }, [batchText, shape]);

  const batchResults = useMemo(() => batchCompute(batchInputs, unit), [batchInputs, unit]);
  const stats = useMemo(() => batchStats(batchResults), [batchResults]);

  const switchShape = (s: Shape) => {
    setShape(s);
    setValues(new Array(SHAPE_PARAMS[s].length).fill(0));
  };

  const fmt = (n: number, u: AreaUnit) => formatArea(n, u);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-xs text-muted-foreground">Shape</Label>
          <div className="flex flex-wrap gap-2">
            {SHAPES.map((s) => (
              <Button key={s} size="sm" variant={shape === s ? "default" : "outline"} onClick={() => switchShape(s)}>{s}</Button>
            ))}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Output unit</Label>
            <select className="h-9 w-full sm:w-64 rounded-md border bg-background px-3 text-sm" value={unit} onChange={(e) => setUnit(e.target.value as AreaUnit)}>
              {UNITS.map((u) => <option key={u} value={u}>{UNIT_LABELS[u]}</option>)}
            </select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">{SHAPE_LABELS[shape]}</Label>
            <Badge variant="outline" className="font-mono">{SHAPE_FORMULAS[shape]}</Badge>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {params.map((p, i) => (
              <div key={p}>
                <Label className="text-xs text-muted-foreground">{p}</Label>
                <input
                  type="number"
                  className="w-full rounded-md border px-2 py-1 text-sm"
                  value={values[i] ?? 0}
                  onChange={(e) => {
                    const next = [...values];
                    next[i] = Number(e.target.value);
                    setValues(next);
                  }}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && !("error" in result) && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Area</p>
                <p className="text-2xl font-bold font-mono">{fmt(result.area, result.unit)}</p>
                <p className="text-xs text-muted-foreground mt-1 font-mono">{result.formulaFilled} = {result.area}</p>
              </div>
              <div className="flex gap-2">
                <CopyButton getText={() => String(result.area)} />
                <DownloadButton getText={() => convertAllToCsv(result.area, unit)} filename="area-all-units.csv" mime="text/csv" />
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-border/50">
              {allUnits.map((r) => (
                <div key={r.unit} className="rounded-md border border-border/50 p-2">
                  <p className="text-xs text-muted-foreground">{UNIT_LABELS[r.unit]}</p>
                  <p className="text-sm font-mono font-bold">{r.value.toFixed(4)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Batch mode (one shape per line, comma-separated values)</CardTitle></CardHeader>
        <CardContent className="p-4 pt-0 space-y-3">
          <textarea
            className="rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px] font-mono"
            placeholder={SHAPE_PARAMS[shape].length === 1 ? "1\n2.5\n10" : "3,4\n5,5\n2,8"}
            value={batchText}
            onChange={(e) => setBatchText(e.target.value)}
          />
          {batchResults.length > 0 && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex gap-2 text-xs">
                  <Badge variant="outline">{stats.count} shapes</Badge>
                  <Badge variant="secondary">total {fmt(stats.total, unit)}</Badge>
                  <Badge variant="outline">min {fmt(stats.min, unit)}</Badge>
                  <Badge variant="outline">max {fmt(stats.max, unit)}</Badge>
                  <Badge variant="outline">mean {fmt(stats.mean, unit)}</Badge>
                </div>
                <DownloadButton getText={() => batchToCsv(batchResults)} filename="area-batch.csv" mime="text/csv" />
              </div>
              <pre className="text-xs overflow-x-auto p-3 bg-muted/40 rounded-md font-mono">
                {batchResults.map((r, i) => `${i + 1}\t${r.shape}\t${r.formulaFilled} = ${r.area} ${r.unit}`).join("\n")}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>

      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all calculations run locally in your browser.</p></CardContent></Card>
    </div>
  );
}
